import test from 'node:test';
import assert from 'node:assert/strict';
import {translateText} from '../src/language.js';
import {recipes} from '../src/data/catalog.js';
import {recipeEnglish} from '../src/recipe-english.js';
test('English translates interface, recipe names and dynamic numbers',()=>{
 assert.equal(translateText('我的厨房'),'My kitchen');
 assert.equal(translateText('约 25 分钟'),'About 25 min');
 assert.equal(translateText('麻婆豆腐饭'),'Mapo tofu rice');
 assert.equal(translateText('请完整观看 · 剩余 8 秒'),'Please watch to the end · Remaining 8 sec');
});
test('all built-in recipes have English names, descriptions and the same number of steps',()=>{
 for(const r of recipes){const en=recipeEnglish[r.id]; assert.ok(en,r.id);assert.equal(en.length,r.steps.length+2,r.id);assert.doesNotMatch(translateText(r.description),/[\u3400-\u9fff]/);r.steps.forEach(s=>assert.doesNotMatch(translateText(s),/[\u3400-\u9fff]/));}
});
test('Chinese and custom text are preserved',()=>{
 assert.equal(translateText('我的厨房','zh'),'我的厨房');
 assert.equal(translateText('My own recipe 123'),'My own recipe 123');
});
test('substitution flavour notes and techniques are available in English',async()=>{
 const {substitutions}=await import('../src/data/catalog.js');
 for(const rule of substitutions)for(const key of ['tasteDifference','context','quantityAdvice'])if(rule[key])assert.doesNotMatch(translateText(rule[key]),/[\u3400-\u9fff]/);
});
