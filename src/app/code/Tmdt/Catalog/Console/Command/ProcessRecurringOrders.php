<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Console\Command;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Magento\Framework\App\State;
use Magento\Framework\App\ResourceConnection;
use Tmdt\Catalog\Api\OrderManagementInterface;
use Tmdt\Catalog\Model\Recurring;

class ProcessRecurringOrders extends Command
{
    private const COMMAND_NAME = 'tmdt:recurring:process';

    public function __construct(
        private readonly State $state,
        private readonly ResourceConnection $resourceConnection,
        private readonly OrderManagementInterface $orderManagement,
        private readonly Recurring $recurringModel,
        ?string $name = null
    ) {
        parent::__construct($name);
    }

    protected function configure(): void
    {
        $this->setName(self::COMMAND_NAME)
            ->setDescription('Process due recurring orders and generate new pending orders.');
        parent::configure();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $output->writeln('<info>=== Processing recurring order schedules ===</info>');

        try {
            $this->state->setAreaCode(\Magento\Framework\App\Area::AREA_FRONTEND);
        } catch (\Magento\Framework\Exception\LocalizedException $e) {
            // Already set
        }

        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName('tmdt_recurring_schedules');

        $today = date('Y-m-d');
        $output->writeln("<comment>Checking for active schedules due on or before: {$today}</comment>");

        try {
            $select = $connection->select()
                ->from($table)
                ->where('status = ?', 'active')
                ->where('next_run_date <= ?', $today);

            $dueSchedules = $connection->fetchAll($select);

            if (empty($dueSchedules)) {
                $output->writeln('<info>No due recurring schedules found.</info>');
                return Command::SUCCESS;
            }

            $output->writeln('<comment>Found ' . count($dueSchedules) . ' due schedules.</comment>');

            foreach ($dueSchedules as $schedule) {
                $scheduleId = (int)$schedule['id'];
                $customerEmail = $schedule['customer_email'];
                $customerName = $schedule['customer_name'];
                $itemsJson = $schedule['items_json'];
                $shippingJson = $schedule['shipping_json'];

                $output->writeln("Processing schedule ID #{$scheduleId} for customer: {$customerEmail}");

                $items = json_decode($itemsJson, true);
                if (empty($items)) {
                    $output->writeln("<error>Schedule #{$scheduleId} has empty or invalid items_json.</error>");
                    continue;
                }

                // Calculate total amount based on items
                $totalAmount = 0.0;
                foreach ($items as $item) {
                    $qty = (float)($item['quantity'] ?? 1);
                    $price = (float)($item['unitPrice'] ?? 0);
                    $totalAmount += $qty * $price;
                }

                if ($totalAmount <= 0) {
                    $output->writeln("<error>Schedule #{$scheduleId} total amount is <= 0. Skipping.</error>");
                    continue;
                }

                // Create the pending order
                $result = $this->orderManagement->createOrder(
                    $customerEmail,
                    $customerName,
                    $totalAmount,
                    $itemsJson,
                    $shippingJson
                );

                if (!empty($result['success']) && !empty($result['orderCode'])) {
                    $orderCode = $result['orderCode'];
                    $output->writeln("<info>Successfully created order {$orderCode} for schedule #{$scheduleId}.</info>");

                    // Calculate next run date starting from today
                    $nextRunDate = $this->recurringModel->calculateNextRunDate(
                        $schedule['frequency'],
                        $schedule['weekdays'],
                        $schedule['month_day'] ? (int)$schedule['month_day'] : null,
                        $today
                    );

                    // Update schedule
                    $connection->update(
                        $table,
                        [
                            'last_run_date' => $today,
                            'next_run_date' => $nextRunDate
                        ],
                        ['id = ?' => $scheduleId]
                    );

                    $output->writeln("<comment>Updated schedule #{$scheduleId}: last_run_date = {$today}, next_run_date = {$nextRunDate}</comment>");
                } else {
                    $errorMsg = $result['message'] ?? 'Unknown error';
                    $output->writeln("<error>Failed to create order for schedule #{$scheduleId}: {$errorMsg}</error>");
                }
            }

            $output->writeln('<info>=== Processing completed ===</info>');
            return Command::SUCCESS;
        } catch (\Exception $e) {
            $output->writeln("<error>Error processing schedules: {$e->getMessage()}</error>");
            return Command::FAILURE;
        }
    }
}
