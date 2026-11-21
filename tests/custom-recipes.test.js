import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {CUSTOM_RECIPES_KEY, createCustomRecipe, updateCustomRecipe, deleteCustomRecipe, listCustomRecipes, inspectCustomRecipes} from '../src/custom-recipes.js';
import {getRecipes, getIngredients, searchCatalog} from '../src/data.js';
import {ingredients, recipes as demoRecipes} from '../src/demo-data.js';
import {customRecipesPage} from '../src/custom-recipes-page.js';

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
}

const draft = () => ({
  nameZh: '  家常番茄拌饭  ', nameEn: '  My Tomato Bowl  ', timeMinutes: '12.5',
  ingredients: [{ingredientId: 'tomato', amount: '1.5', unit: ' 个 '}, {ingredientId: 'rice', amount: 150, unit: 'g'}],
  steps: [' 切好番茄。 ', '炒熟后拌入米饭。'],
});
let storage;
let events;
beforeEach(() => {
  storage = new MemoryStorage();
  globalThis.window = new EventTarget();
  window.localStorage = storage;
  events = 0;
  window.addEventListener('dinner:adapters-updated', () => { events++; });
});

test('create stores a normalized Recipe with a stable unique ID and notifies after persistence', () => {
  window.addEventListener('dinner:adapters-updated', () => assert.equal(listCustomRecipes().length, events));
  const first = createCustomRecipe(draft(), ingredients);
  const second = createCustomRecipe({...draft(), nameEn: ''}, ingredients);
  assert.match(first.id, /^custom-[0-9a-f-]{36}$/);
  assert.notEqual(first.id, second.id);
  assert.equal(first.nameZh, '家常番茄拌饭');
  assert.equal(first.nameEn, 'My Tomato Bowl');
  assert.equal(first.timeMinutes, 12.5);
  assert.deepEqual(first.ingredients[0], {ingredientId: 'tomato', amount: 1.5, unit: '个'});
  assert.deepEqual(first.steps, ['切好番茄。', '炒熟后拌入米饭。']);
  assert.ok(!Object.hasOwn(second, 'nameEn'));
  assert.equal(events, 2);
  assert.equal(JSON.parse(storage.getItem(CUSTOM_RECIPES_KEY)).version, 1);
});

test('reload recovers recipes solely from localStorage, and returned objects cannot mutate the store', async () => {
  const created = createCustomRecipe(draft(), ingredients);
  const saved = storage.getItem(CUSTOM_RECIPES_KEY);
  const freshStorage = new MemoryStorage();
  freshStorage.setItem(CUSTOM_RECIPES_KEY, saved);
  window.localStorage = freshStorage;
  const freshModule = await import('../src/custom-recipes.js?reload-test');
  assert.deepEqual(freshModule.listCustomRecipes(), [created]);
  const copy = freshModule.listCustomRecipes()[0];
  copy.nameZh = '改动副本'; copy.ingredients[0].amount = 999;
  assert.deepEqual(freshModule.listCustomRecipes(), [created]);
});

test('editing keeps the original ID, replaces all editable fields and survives reload', () => {
  const created = createCustomRecipe(draft(), ingredients);
  const updated = updateCustomRecipe(created.id, {
    nameZh: '鸡蛋饭', nameEn: '', timeMinutes: 20,
    ingredients: [{ingredientId: 'egg', amount: 2, unit: '个'}], steps: ['打蛋。', '炒熟。', '配饭。'],
  }, ingredients);
  assert.equal(updated.id, created.id);
  assert.equal(updated.nameZh, '鸡蛋饭');
  assert.ok(!Object.hasOwn(updated, 'nameEn'));
  assert.equal(updated.steps.length, 3);
  assert.deepEqual(listCustomRecipes(), [updated]);
  assert.equal(events, 2);
});

test('delete persists, notifies, and only removes the selected custom recipe', () => {
  const first = createCustomRecipe(draft(), ingredients);
  const second = createCustomRecipe(draft(), ingredients);
  deleteCustomRecipe(first.id);
  assert.deepEqual(listCustomRecipes(), [second]);
  assert.equal(events, 3);
  assert.throws(() => deleteCustomRecipe('tomato-egg'), /已不存在/);
  assert.throws(() => updateCustomRecipe(first.id, draft(), ingredients), /已不存在/);
  assert.equal(events, 3);
});

test('invalid names, numbers, units, steps and ingredient references never persist or notify', () => {
  const invalid = [
    {nameZh: ' '}, {timeMinutes: 0}, {timeMinutes: Infinity}, {timeMinutes: true},
    {ingredients: []}, {ingredients: [null]},
    {ingredients: [{ingredientId: 'unknown', amount: 1, unit: 'g'}]},
    {ingredients: [{ingredientId: 'egg', amount: -1, unit: '个'}]},
    {ingredients: [{ingredientId: 'egg', amount: 'NaN', unit: '个'}]},
    {ingredients: [{ingredientId: 'egg', amount: true, unit: '个'}]},
    {ingredients: [{ingredientId: 'egg', amount: 1, unit: ' '}]},
    {ingredients: [{ingredientId: 'egg', amount: 1, unit: '个'}, {ingredientId: 'egg', amount: 2, unit: '个'}]},
    {steps: []}, {steps: ['备菜', ' ']},
  ];
  for (const change of invalid) assert.throws(() => createCustomRecipe({...draft(), ...change}, ingredients));
  assert.throws(() => createCustomRecipe(draft()), /加载食材库/);
  assert.equal(storage.getItem(CUSTOM_RECIPES_KEY), null);
  assert.equal(events, 0);
});

test('invalid edits preserve the previously saved recipe', () => {
  const created = createCustomRecipe(draft(), ingredients);
  assert.throws(() => updateCustomRecipe(created.id, {...draft(), steps: ['']}, ingredients));
  assert.deepEqual(listCustomRecipes(), [created]);
  assert.equal(events, 1);
});

test('storage write failures leave existing data intact and do not dispatch success events', () => {
  const created = createCustomRecipe(draft(), ingredients);
  const saved = storage.getItem(CUSTOM_RECIPES_KEY);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => createCustomRecipe(draft(), ingredients), /未能保存/);
  assert.throws(() => updateCustomRecipe(created.id, draft(), ingredients), /未能保存/);
  assert.throws(() => deleteCustomRecipe(created.id), /未能保存/);
  assert.equal(storage.getItem(CUSTOM_RECIPES_KEY), saved);
  assert.equal(events, 1);
});

test('malformed, unsupported or invalid stored data does not break the catalog or get overwritten', () => {
  for (const raw of ['{broken', '{"version":2,"recipes":[]}', '{"version":1,"recipes":[{}]}']) {
    storage.setItem(CUSTOM_RECIPES_KEY, raw);
    assert.deepEqual(listCustomRecipes(), []);
    assert.ok(inspectCustomRecipes().error);
    assert.deepEqual(getRecipes(), demoRecipes);
    assert.throws(() => createCustomRecipe(draft(), ingredients));
    assert.equal(storage.getItem(CUSTOM_RECIPES_KEY), raw);
  }
  assert.equal(events, 0);
});

test('blocked localStorage keeps A search usable and reports the failure in D', () => {
  Object.defineProperty(window, 'localStorage', {get() { throw new Error('Storage access denied'); }});
  assert.ok(searchCatalog('番茄').recipes.length);
  assert.ok(inspectCustomRecipes().error);
  assert.match(customRecipesPage(), /role="alert"/);
  assert.throws(() => createCustomRecipe(draft(), ingredients));
});

test('custom recipes participate in Chinese, English, ingredient alias search and filters', () => {
  const created = createCustomRecipe(draft(), ingredients);
  for (const query of ['家常番茄拌饭', 'MY TOMATO BOWL', '西红柿', 'tomatoes']) {
    assert.ok(searchCatalog(query).recipes.some(recipe => recipe.id === created.id), query);
  }
  assert.equal(searchCatalog('家常', 'ingredient').recipes.length, 0);
  assert.equal(searchCatalog('家常', 'recipe').ingredients.length, 0);
  assert.deepEqual(getRecipes().find(recipe => recipe.id === created.id), created);
  updateCustomRecipe(created.id, {...draft(), nameZh: '更新后的菜名', nameEn: 'Renamed bowl'}, ingredients);
  assert.equal(searchCatalog('家常番茄拌饭').recipes.length, 0);
  assert.ok(searchCatalog('renamed bowl').recipes.some(recipe => recipe.id === created.id));
  deleteCustomRecipe(created.id);
  assert.equal(searchCatalog('renamed bowl').recipes.length, 0);
  assert.ok(searchCatalog('番茄炒蛋').recipes.some(recipe => recipe.id === 'tomato-egg'));
});

test('B adapters registered before or after creation remain untouched and are read on every call', () => {
  const original = {...demoRecipes[0], id: 'b-original'};
  const originalArray = Object.freeze([original]);
  const before = () => originalArray;
  window.DinnerAppAdapters = {getRecipes: before};
  const created = createCustomRecipe(draft(), ingredients);
  assert.equal(window.DinnerAppAdapters.getRecipes, before);
  assert.deepEqual(getRecipes().map(recipe => recipe.id), ['b-original', created.id]);
  assert.equal(originalArray.length, 1);
  const after = () => [{...demoRecipes[1], id: 'b-later'}];
  window.DinnerAppAdapters = {getRecipes: after, getIngredients: () => ingredients};
  assert.deepEqual(getRecipes().map(recipe => recipe.id), ['b-later', created.id]);
  assert.equal(window.DinnerAppAdapters.getRecipes, after);
  assert.ok(searchCatalog('鸡肉').recipes.some(recipe => recipe.id === 'b-later'));
});

test('current B ingredient catalog supplies IDs for creation and survives temporary catalog changes', () => {
  const catalog = [{id: 'b-tofu', nameZh: '豆腐', nameEn: 'Tofu', aliases: ['bean curd']}];
  window.DinnerAppAdapters = {getIngredients: () => catalog, getRecipes: () => []};
  const input = {...draft(), ingredients: [{ingredientId: 'b-tofu', amount: 100, unit: 'g'}]};
  const created = createCustomRecipe(input, getIngredients());
  assert.ok(searchCatalog('bean curd').recipes.some(recipe => recipe.id === created.id));
  window.DinnerAppAdapters.getIngredients = () => [];
  assert.deepEqual(listCustomRecipes(), [created]);
  assert.throws(() => updateCustomRecipe(created.id, input, getIngredients()), /现有食材库/);
});

test('upstream ID collisions preserve B data without duplicate recipe results', () => {
  const created = createCustomRecipe(draft(), ingredients);
  const upstream = {...demoRecipes[0], id: created.id};
  window.DinnerAppAdapters = {getRecipes: () => [upstream]};
  assert.deepEqual(getRecipes(), [upstream]);
  assert.deepEqual(listCustomRecipes(), [created]);
});

test('an invalid B adapter response still falls back to demo recipes plus local recipes', () => {
  const created = createCustomRecipe(draft(), ingredients);
  window.DinnerAppAdapters = {getRecipes: () => null};
  assert.deepEqual(getRecipes().map(recipe => recipe.id), [...demoRecipes.map(recipe => recipe.id), created.id]);
});

test('my recipes uses A detail buttons and escapes user-provided names', () => {
  const created = createCustomRecipe({...draft(), nameZh: '<img src=x onerror=alert(1)>', nameEn: '" onclick="bad()'}, ingredients);
  const html = customRecipesPage();
  assert.ok(html.includes(`data-recipe="${created.id}"`));
  assert.ok(html.includes('＋ 创建菜谱'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('" onclick="bad()'));
});
