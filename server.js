import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(import.meta.dirname);const port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const p=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(p!==root&&!p.startsWith(root+sep)){res.writeHead(403).end('Forbidden');return;}const s=await stat(p);if(!s.isFile()){res.writeHead(404).end('Not found');return;}const data=await readFile(p);res.writeHead(200,{'content-type':types[extname(p)]||'application/octet-stream','cache-control':'no-store'}).end(data);}catch{res.writeHead(404).end('Not found');}}).listen(port,'0.0.0.0',()=>console.log(`Open http://localhost:${port}`));
