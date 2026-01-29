import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '..', 'dist');
const outFile = path.resolve(__dirname, '..', 'dfg_3dviewer-dist.zip');

if (!fs.existsSync(distDir)) {
  console.error('dist directory not found. Run `npm run build` first.');
  process.exit(1);
}

// Normalize index.html asset paths from absolute (/file) to relative (./file)
const indexPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  // replace href=/file or href="/file" or href='/file' with href="./file"
  html = html.replace(/href=\/?"?\/?([^\s'">]+)"?/g, (m, p1) => `href="./${p1.replace(/^\/+/, '')}"`);
  html = html.replace(/src=\/?"?\/?([^\s'">]+)"?/g, (m, p1) => `src="./${p1.replace(/^\/+/, '')}"`);
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('Rewrote asset paths in dist/index.html to use relative paths');
}

const output = fs.createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Created ${outFile} (${archive.pointer()} total bytes)`);
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') console.warn(err);
  else throw err;
});

archive.on('error', (err) => { throw err; });

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
