import { spawnSync } from 'node:child_process';

const phpContainer = process.env.MAGENTO_PHP_CONTAINER || 'ecommerce-b2b-system-phpfpm-1';
const locales = process.env.MAGENTO_LOCALES || 'en_US vi_VN';

const command = [
  'docker',
  'exec',
  phpContainer,
  'sh',
  '-lc',
  `cd /var/www/html && rm -rf pub/static/frontend/MyCompany/MyTheme var/view_preprocessed/frontend/MyCompany/MyTheme && php bin/magento cache:clean && php bin/magento cache:flush && php bin/magento setup:static-content:deploy -f ${locales} && php bin/magento indexer:reindex`
];

console.log(`Refreshing Magento in container: ${phpContainer}`);
const result = spawnSync(command[0], command.slice(1), { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('✅ Magento static content/cache/indexers refreshed');
