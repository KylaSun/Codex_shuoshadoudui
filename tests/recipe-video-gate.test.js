import test from 'node:test';
import assert from 'node:assert/strict';
import {createViewCounter} from '../src/recipe-video-gate.js';
const store = () => {const data = new Map(); return {getItem:k=>data.get(k), setItem:(k,v)=>data.set(k,v)};};
test('opens the video on the third recipe visit', () => {
 const c=createViewCounter(store());
 assert.equal(c.visit('recipe','a'),false);
 assert.equal(c.visit('recipe','a'),false);
 assert.equal(c.visit('home'),false);
 assert.equal(c.visit('recipe','b'),false);
 assert.equal(c.visit('home'),false);
 assert.equal(c.visit('recipe','c'),true);
 assert.equal(c.visit('home'),true);
});
test('pending survives refresh, completion starts a fresh cycle', () => {
 const storage=store(); const c=createViewCounter(storage);
 for(const id of ['a','b']) { c.visit('recipe',id); c.visit('search'); }
 c.visit('recipe','c');
 const restored=createViewCounter(storage);
 assert.equal(restored.visit('home'),true);
 restored.complete();
 for(const id of ['c','d']) { assert.equal(restored.visit('recipe',id),false); restored.visit('home'); }
 assert.equal(restored.visit('recipe','e'),true);
});
test('broken or unavailable storage does not prevent browsing', () => {
 const c=createViewCounter({getItem(){throw Error();},setItem(){throw Error();}});
 assert.equal(c.visit('home'),false);
 for(const id of ['a','b']) { c.visit('recipe',id); c.visit('shopping'); }
 assert.equal(c.visit('recipe','c'),true);
});
test('refresh while the video is pending still requires it', () => {
 const storage=store(); const c=createViewCounter(storage);
 for(const id of ['a','b']) { c.visit('recipe',id); c.visit('home'); }
 c.visit('recipe','c');
 assert.equal(createViewCounter(storage).visit('home'),true);
});
