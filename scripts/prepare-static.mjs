import {cp, mkdir, rm} from 'node:fs/promises';
await rm('dist', {recursive:true, force:true});
await mkdir('dist', {recursive:true});
for (const name of ['index.html', 'src', 'assets']) await cp(name, `dist/${name}`, {recursive:true});
console.log('Prepared static website in dist/');
