import {createServer} from 'node:http';
import {readFile, stat, realpath} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'};

export function createAppServer() {
  return createServer(async (req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Bad request'); return; }
    // Serve only public UI assets. In particular, .env, .git and server source are never public.
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end('Method not allowed'); return; }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const rootAsset = ['index.html', 'team-adapters.js'].includes(relative);
    const publicFolder = relative.startsWith('assets/') ? 'assets' : 'src';
    if (!rootAsset && (!relative.startsWith(`${publicFolder}/`) || !types[extname(relative)] || relative.split('/').some(part => part.startsWith('.')))) {
      res.writeHead(404).end('Not found'); return;
    }
    try {
      const path = await realpath(resolve(root, relative));
      if (!path.startsWith(root) || (rootAsset ? path !== resolve(root, relative) : !path.startsWith(resolve(root, publicFolder) + sep))) {
        res.writeHead(403).end('Forbidden'); return;
      }
      if (!(await stat(path)).isFile()) { res.writeHead(404).end('Not found'); return; }
      const data = await readFile(path);
      res.writeHead(200, {'content-type': types[extname(path)], 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404).end('Not found'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.loadEnvFile) {
    try { process.loadEnvFile(resolve(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const port = Number(process.env.PORT || 5173);
  const host = process.env.HOST || '127.0.0.1';
  createAppServer().listen(port, host, () => console.log(`Open http://${host}:${port}`));
}
