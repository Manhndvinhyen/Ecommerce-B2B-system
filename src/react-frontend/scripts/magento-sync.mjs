import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const buildDirCandidates = [
  process.env.REACT_BUILD_DIR,
  path.join(projectRoot, 'dist'),
  path.join(projectRoot, '..', 'pub', 'react')
].filter(Boolean);

const distDir = buildDirCandidates.find((dir) => fs.existsSync(dir));
const themeDir = process.env.MAGENTO_THEME_DIR || '/Users/socnhi/Sites/Ecommerce-B2B-system/src/app/design/frontend/MyCompany/MyTheme';
const targetAssetDir = path.join(themeDir, 'web', 'react-home');
const targetTemplateDir = path.join(themeDir, 'Magento_Theme', 'templates');
const targetLayoutDir = path.join(themeDir, 'Magento_Theme', 'layout');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDirIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function readManifest() {
  if (!distDir) {
    throw new Error('Build output not found. Run npm run build first.');
  }

  const manifestPath = path.join(distDir, '.vite', 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest: ${manifestPath}. Run npm run build first.`);
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function resolveEntry(manifest) {
  const entry = manifest['index.html'] || manifest['src/main.tsx'];

  if (!entry || !entry.file) {
    throw new Error('Cannot resolve entry file from dist/.vite/manifest.json');
  }

  return {
    jsFile: entry.file,
    cssFiles: entry.css || []
  };
}

function writeMagentoHomepageTemplate() {
  ensureDir(targetTemplateDir);

  const template = `<?php
/** @var \\Magento\\Framework\\View\\Element\\Template $block */
?>
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #fff;
  }

  .react-home-iframe {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    border: 0;
    display: block;
    background: #fff;
  }
</style>

<iframe
  class="react-home-iframe"
  src="<?= $block->escapeUrl($block->getViewFileUrl('react-home/index.html')) ?>"
  title="React Homepage"
  loading="eager"
></iframe>
`;

  fs.writeFileSync(path.join(targetTemplateDir, 'homepage.phtml'), template, 'utf8');
}

function writeMagentoHomepageLayout() {
  ensureDir(targetLayoutDir);

  const layout = `<?xml version="1.0"?>
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  layout="empty"
      xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <body>
        <referenceContainer name="header.container" remove="true"/>
        <referenceContainer name="footer-container" remove="true"/>
        <referenceContainer name="page.top" remove="true"/>
        <referenceContainer name="columns.top" remove="true"/>
        <referenceContainer name="columns.bottom" remove="true"/>
        <referenceContainer name="content.top" remove="true"/>
        <referenceContainer name="content.aside" remove="true"/>
        <referenceBlock name="breadcrumbs" remove="true"/>
        <referenceBlock name="cms_page" remove="true"/>
        <referenceBlock name="authenticationPopup" remove="true"/>
        <referenceBlock name="formkey" remove="true"/>
        <referenceContainer name="content">
            <block class="Magento\\Framework\\View\\Element\\Template"
                   name="react.homepage"
                   template="Magento_Theme::homepage.phtml"/>
        </referenceContainer>
    </body>
</page>
`;

  fs.writeFileSync(path.join(targetLayoutDir, 'cms_index_index.xml'), layout, 'utf8');
}

function writeMagentoBridgeCss() {
  const bridgeCss = `/* Applied only to homepage to keep other Magento pages untouched */
html,
body.cms-index-index {
  margin: 0 !important;
  padding: 0 !important;
}

body.cms-index-index .page-header,
body.cms-index-index .page-footer,
body.cms-index-index .nav-sections,
body.cms-index-index .messages,
body.cms-index-index .breadcrumbs {
  display: none !important;
}

body.cms-index-index input[name="form_key"],
body.cms-index-index #authenticationPopup,
body.cms-index-index .authentication-wrapper,
body.cms-index-index .modal-popup,
body.cms-index-index .modals-overlay {
  display: none !important;
}

body.cms-index-index .page-main,
body.cms-index-index .columns,
body.cms-index-index .column.main,
body.cms-index-index .page-wrapper,
body.cms-index-index .page-main .block {
  max-width: none !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
}

body.cms-index-index #maincontent {
  min-height: 100vh;
}

body.cms-index-index .column.main > *:not(#root) {
  display: none !important;
}

body.cms-index-index #root {
  width: 100%;
}
`;

  fs.writeFileSync(path.join(targetAssetDir, 'magento-bridge.css'), bridgeCss, 'utf8');
}

function copyDistToTheme() {
  if (!distDir || !fs.existsSync(distDir)) {
    throw new Error('Build output directory not found. Run npm run build first.');
  }

  removeDirIfExists(targetAssetDir);
  ensureDir(targetAssetDir);

  fs.cpSync(distDir, targetAssetDir, { recursive: true });
}

function main() {
  console.log(`Using theme dir: ${themeDir}`);
  ensureDir(themeDir);

  copyDistToTheme();
  writeMagentoBridgeCss();
  const manifest = readManifest();
  resolveEntry(manifest);
  writeMagentoHomepageTemplate();
  writeMagentoHomepageLayout();

  console.log('✅ Synced dist to Magento theme: web/react-home');
  console.log('✅ Updated Magento homepage template/layout -> React mount');
}

main();
