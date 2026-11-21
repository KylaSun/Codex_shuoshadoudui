import {createServer} from 'node:http';
import {readFile, stat, realpath} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MAX_IMAGE_BYTES, IMAGE_TYPES} from './src/recipe-import.js';
import {RecognitionError, visionConfig, recognizeRecipeImage} from './server/recipe-recognition.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp'};
const sendJSON = (res, status, body) => {
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'});
  res.end(JSON.stringify(body));
};

function readImageBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    let exceeded = false;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_IMAGE_BYTES) {
        if (!exceeded) reject(new RecognitionError(413, 'IMAGE_TOO_LARGE', '图片不能超过 5MB。'));
        exceeded = true;
        chunks.length = 0;
      } else if (!exceeded) chunks.push(chunk);
    });
    req.on('end', () => { if (!exceeded) resolveBody(Buffer.concat(chunks)); });
    req.on('error', reject);
    req.on('aborted', () => reject(new RecognitionError(400, 'UPLOAD_ABORTED', '上传已取消。')));
  });
}

export function createAppServer({env = process.env, fetchImpl = fetch} = {}) {
  let active = 0;
  return createServer(async (req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Bad request'); return; }
    if (pathname.startsWith('/api/')) {
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      try {
        if (req.headers['sec-fetch-site'] === 'cross-site' ||
            (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) {
          throw new RecognitionError(403, 'ORIGIN_DENIED', '只接受同源图片识别请求。');
        }
        if (pathname === '/api/recipe-recognition/status' && req.method === 'GET') {
          const config = visionConfig(env);
          sendJSON(res, 200, {configured: config.configured, message: config.configured ? 'AI 已配置，识别结果仍需人工检查。' : config.message});
          return;
        }
        if (pathname !== '/api/recipe-recognition') throw new RecognitionError(404, 'NOT_FOUND', '接口不存在。');
        if (req.method !== 'POST') throw new RecognitionError(405, 'METHOD_NOT_ALLOWED', '请使用 POST 上传图片。');
        const config = visionConfig(env);
        if (!config.configured) throw new RecognitionError(503, 'AI_NOT_CONFIGURED', config.message);
        const type = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
        if (!IMAGE_TYPES.includes(type)) throw new RecognitionError(415, 'INVALID_IMAGE_TYPE', '仅支持 JPG、PNG 和 WebP 图片。');
        if (Number(req.headers['content-length']) > MAX_IMAGE_BYTES) throw new RecognitionError(413, 'IMAGE_TOO_LARGE', '图片不能超过 5MB。');
        if (active >= 2) throw new RecognitionError(429, 'AI_BUSY', '当前识别请求较多，请稍后重试。');
        active++;
        try {
          const bytes = await readImageBody(req);
          const recipe = await recognizeRecipeImage(bytes, type, {env, fetchImpl, signal: controller.signal});
          if (!controller.signal.aborted) sendJSON(res, 200, {recipe});
        } finally { active--; }
      } catch (error) {
        req.resume();
        if (!res.destroyed) sendJSON(res, error instanceof RecognitionError ? error.status : 400, {
          error: {code: error instanceof RecognitionError ? error.code : 'BAD_REQUEST',
            message: error instanceof RecognitionError ? error.message : '请求无效，请重新选择图片。'},
        });
      }
      return;
    }
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
