<?php

declare(strict_types=1);

namespace Tmdt\Search\Console\Command;

use Magento\Catalog\Model\Product\Action as ProductAction;
use Magento\Catalog\Model\ResourceModel\Product\CollectionFactory;
use Magento\Framework\App\Area;
use Magento\Framework\App\State;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Indexer\IndexerRegistry;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Tmdt\Search\Model\ProductKeywordGenerator;
use Tmdt\Search\Setup\Patch\Data\AddProductSearchKeywordsAttribute;

class RegenerateProductKeywordsCommand extends Command
{
    private const OPTION_REINDEX = 'reindex';
    private const BATCH_SIZE = 100;

    public function __construct(
        private readonly State $state,
        private readonly CollectionFactory $productCollectionFactory,
        private readonly ProductKeywordGenerator $keywordGenerator,
        private readonly ProductAction $productAction,
        private readonly IndexerRegistry $indexerRegistry
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('tmdt:search:regenerate-keywords')
            ->setDescription('Regenerate generated search keywords for catalog products.')
            ->addOption(
                self::OPTION_REINDEX,
                null,
                InputOption::VALUE_NONE,
                'Reindex catalogsearch_fulltext after keyword updates.'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        try {
            $this->state->setAreaCode(Area::AREA_ADMINHTML);
        } catch (LocalizedException) {
            // Area code may already be set.
        }

        $collection = $this->productCollectionFactory->create();
        $collection->addAttributeToSelect([
            'name',
            'sku',
            'short_description',
            'description',
            'country_of_manufacture',
            AddProductSearchKeywordsAttribute::ATTRIBUTE_CODE,
        ]);
        $collection->addCategoryIds();
        $collection->setPageSize(self::BATCH_SIZE);

        $pages = (int) $collection->getLastPageNumber();
        $updated = 0;
        $seen = 0;

        for ($page = 1; $page <= $pages; $page++) {
            $collection->setCurPage($page);
            $collection->load();

            foreach ($collection as $product) {
                $seen++;
                $keywords = $this->keywordGenerator->generate($product);
                $current = trim((string) $product->getData(AddProductSearchKeywordsAttribute::ATTRIBUTE_CODE));
                if ($keywords === '' || $current === $keywords) {
                    continue;
                }

                $this->productAction->updateAttributes(
                    [(int) $product->getId()],
                    [AddProductSearchKeywordsAttribute::ATTRIBUTE_CODE => $keywords],
                    0
                );
                $updated++;
            }

            $collection->clear();
            $output->writeln(sprintf('Processed page %d/%d, products seen: %d, updated: %d', $page, $pages, $seen, $updated));
        }

        if ($input->getOption(self::OPTION_REINDEX)) {
            $output->writeln('Reindexing catalogsearch_fulltext...');
            $this->indexerRegistry->get('catalogsearch_fulltext')->reindexAll();
        }

        $output->writeln(sprintf('Done. Products seen: %d. Products updated: %d.', $seen, $updated));

        return Command::SUCCESS;
    }
}
