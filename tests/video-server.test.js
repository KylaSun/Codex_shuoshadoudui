import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppServer} from '../server.js';
test('video is served with MIME, byte ranges, HEAD and invalid-range handling', async () => {
 const server=createAppServer();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
 const url=`http://127.0.0.1:${server.address().port}/assets/recipe-break.mp4`;
 const full=await fetch(url); const bytes=await full.arrayBuffer();
 assert.equal(full.headers.get('content-type'),'video/mp4'); assert.ok(bytes.byteLength>0);
 const range=await fetch(url,{headers:{Range:'bytes=0-31'}});
 assert.equal(range.status,206); assert.equal((await range.arrayBuffer()).byteLength,32);
 const head=await fetch(url,{method:'HEAD'}); assert.equal(Number(head.headers.get('content-length')),bytes.byteLength);
 assert.equal((await fetch(url,{headers:{Range:'bytes=999999999-'}})).status,416);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
