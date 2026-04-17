import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const packageRoot = join(
  process.cwd(),
  'node_modules',
  '@wxperia',
  'liquid-glass-vue'
);

const sourceAssets = join(packageRoot, 'dist', 'assets');
const targetAssets = join(packageRoot, 'assets');
const distIndexJs = join(packageRoot, 'dist', 'index.js');
const distIndexCjs = join(packageRoot, 'dist', 'index.cjs');

function patchWorkerPath(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const original = readFileSync(filePath, 'utf8');
  const patched = original
    .replaceAll('"/assets/shader-worker-CJN-6C3l.js"', '"./assets/shader-worker-CJN-6C3l.js"')
    .replaceAll('"../assets/shader-worker-CJN-6C3l.js"', '"./assets/shader-worker-CJN-6C3l.js"');

  if (patched !== original) {
    writeFileSync(filePath, patched, 'utf8');
  }
}

// Work around upstream package path bug: index.js imports ../assets/*
// while the published file is under dist/assets/*.
if (existsSync(sourceAssets)) {
  mkdirSync(targetAssets, { recursive: true });
  cpSync(sourceAssets, targetAssets, { recursive: true });
  patchWorkerPath(distIndexJs);
  patchWorkerPath(distIndexCjs);
  console.log('Patched @wxperia/liquid-glass-vue assets path.');
}
