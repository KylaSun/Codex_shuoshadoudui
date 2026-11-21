import test from 'node:test';
import assert from 'node:assert/strict';
import {createViewCounter} from '../src/recipe-video-gate.js';
const store = () => {const data = new Map(); return {getItem:k=>data.get(k), setItem:(k,v)=>data.set(k,v)};};
test('requires three distinct dishes and waits until leaving the third', () => {
 const c=createViewCounter(store());
 for(const id of ['a','a','b','c']) assert.equal(c.visit('recipe',id),false);
 assert.equal(c.visit('recipe','c'),false);
 assert.equal(c.visit('home'),true);
});
test('pending survives refresh, completion starts a fresh cycle', () => {
 const storage=store(); const c=createViewCounter(storage);
 for(const id of ['a','b','c']) c.visit('recipe',id);
 c.visit('search');
 const restored=createViewCounter(storage);
 assert.equal(restored.visit('home'),true);
 restored.complete();
 for(const id of ['c','d','e']) assert.equal(restored.visit('recipe',id),false);
 assert.equal(restored.visit('recipe','f'),true);
});
test('broken or unavailable storage does not prevent browsing', () => {
 const c=createViewCounter({getItem(){throw Error();},setItem(){throw Error();}});
 assert.equal(c.visit('home'),false);
 for(const id of ['a','b','c']) c.visit('recipe',id);
 assert.equal(c.visit('shopping'),true);
});
test('refresh after the third dish also requires the video', () => {
 const storage=store(); const c=createViewCounter(storage);
 for(const id of ['a','b','c']) c.visit('recipe',id);
 assert.equal(createViewCounter(storage).visit('home'),true);
});
