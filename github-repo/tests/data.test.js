import test from 'node:test';import assert from 'node:assert/strict';
import {ingredients,recipes,products,substitutions} from '../src/demo-data.js';
import {searchCatalog} from '../src/data.js';
globalThis.window={};
test('five recipes and canonical ingredient ids',()=>{assert.ok(recipes.length>=5);const ids=new Set(ingredients.map(x=>x.id));for(const r of recipes){assert.ok(r.ingredients?.length);for(const item of r.ingredients){assert.ok(ids.has(item.ingredientId));assert.ok(item.amount>0);assert.ok(item.unit);}}});
test('Chinese recipe & ingredient and English ingredient aliases search',()=>{assert.ok(searchCatalog('番茄').recipes.some(x=>x.id==='tomato-egg'));assert.ok(searchCatalog('鸡蛋').ingredients.some(x=>x.id==='egg'));assert.ok(searchCatalog('tomato').ingredients.some(x=>x.id==='tomato'));assert.ok(searchCatalog('CHICKEN').recipes.some(x=>x.id==='chicken-rice'));assert.equal(searchCatalog('zzzzzzzzz').recipes.length,0);assert.equal(searchCatalog('zzzzzzzzz').ingredients.length,0);});
test('search filters are respected',()=>{assert.equal(searchCatalog('egg','recipe').ingredients.length,0);assert.equal(searchCatalog('egg','ingredient').recipes.length,0);});
test('substitution rules explicitly describe flavour and quantity',()=>{for(const s of substitutions){assert.ok(s.flavourNote&&s.recipeId&&s.replacementAmount>0&&typeof s.equivalent==='boolean');assert.ok(recipes.some(r=>r.id===s.recipeId));}});
test('demo product records are dated references, not real-time stock',()=>{for(const p of products){assert.ok(p.recordedAt&&p.url&&p.packageSize&&p.priceGBP>=0);assert.ok(['Tesco','Sainsbury’s'].includes(p.supermarket));}});
