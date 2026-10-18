// Bundles src/ into one self-contained HTML file: dist/seamline.html.
// three.js loads from jsDelivr through the import map in src/app.html.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: 'es2022',
  external: ['three', 'three/addons/*'],
});
const code = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const body = readFileSync('src/app.html', 'utf8').replace('/*__APP__*/', () => code);

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${body}
</html>
`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/seamline.html', page);
console.log(`dist/seamline.html  ${(page.length / 1024).toFixed(1)} KB`);

// `node build.mjs --hosted <file>` also writes a copy for a sandboxed host that wraps
// the page in its own document and blocks downloads.
const hostedAt = process.argv.indexOf('--hosted');
if (hostedAt > 0) {
  const out = process.argv[hostedAt + 1];
  writeFileSync(out, body.replace('<script type="importmap">', '<script>window.SEAMLINE_NO_EXPORT = true;</script>\n<script type="importmap">'));
  console.log(`${out}  (hosted copy, exports off)`);
}
