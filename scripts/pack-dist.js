import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
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

if (fs.existsSync(outFile)) {
  fs.rmSync(outFile);
}

const zipProcess = spawnSync('zip', ['-rq', outFile, '.'], {
  cwd: distDir,
  stdio: 'inherit',
});

if (zipProcess.error) {
  if (zipProcess.error.code === 'ENOENT') {
    console.error('`zip` command not found. Install it or use an environment that provides it before running `npm run pack-dist`.');
    process.exit(1);
  }

  throw zipProcess.error;
}

if (zipProcess.status !== 0) {
  process.exit(zipProcess.status ?? 1);
}

const archiveSize = fs.statSync(outFile).size;
console.log(`Created ${outFile} (${archiveSize} total bytes)`);
