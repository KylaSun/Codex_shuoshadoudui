import {cp, mkdir, readdir, rm} from 'node:fs/promises';
await rm('dist', {recursive:true, force:true});
await mkdir('dist/src/data', {recursive:true});
await cp('index.html', 'dist/index.html');
for (const name of await readdir('src')) {
  if (name.endsWith('.js') || name.endsWith('.css')) await cp(`src/${name}`, `dist/src/${name}`);
}
await cp('src/data/catalog.js', 'dist/src/data/catalog.js');
await mkdir('dist/assets', {recursive:true});
await cp('assets/recipe-art', 'dist/assets/recipe-art', {recursive:true});
await cp('assets/recipe-break.mp4', 'dist/assets/recipe-break.mp4');
console.log('Prepared static website in dist/');
