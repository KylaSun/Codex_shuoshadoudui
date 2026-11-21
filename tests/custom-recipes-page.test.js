import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {CUSTOM_RECIPES_KEY, listCustomRecipes} from '../src/custom-recipes.js';
import {getRecipes, searchCatalog} from '../src/data.js';

const nativeFormData = globalThis.FormData;
let caseId = 0;
let stored;
beforeEach(() => {
  stored = new Map();
  globalThis.window = new EventTarget();
  window.localStorage = {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value)};
  // Only substitute the browser's form-to-entries boundary; use the real D controller and store.
  globalThis.FormData = class {
    constructor(form) { this.entries = form.entries; }
    get(name) { return this.entries.find(([key]) => key === name)?.[1] ?? null; }
    getAll(name) { return this.entries.filter(([key]) => key === name).map(([, value]) => value); }
  };
});
afterEach(() => { globalThis.FormData = nativeFormData; });

async function pageFixture() {
  const page = await import(`../src/custom-recipes-page.js?controller-case=${++caseId}`);
  const form = {id: 'custom-recipe-form', entries: []};
  let section;
  const root = {querySelector: selector => selector === '#custom-recipes-page' ? section : null};
  const rerender = () => {
    section = new EventTarget();
    section.innerHTML = page.customRecipesPage();
    section.querySelector = selector => selector === 'form'
      ? (section.innerHTML.includes('id="custom-recipe-form"') ? form : null)
      : {focus() {}};
    page.mountCustomRecipesPage(root);
  };
  const dispatch = (type, target) => {
    const event = new Event(type, {cancelable: true});
    Object.defineProperty(event, 'target', {value: target});
    section.dispatchEvent(event);
    return event;
  };
  rerender();
  // A synchronously replaces #app when D dispatches the update event.
  window.addEventListener('dinner:adapters-updated', rerender);
  return {
    click(command, extra = {}) {
      const button = {dataset: {customAction: command, ...extra}};
      button.closest = () => button;
      dispatch('click', button);
    },
    fill(entries) { form.entries = entries; dispatch('input', {closest: () => form}); },
    submit() { return dispatch('submit', form); },
    html: () => section.innerHTML,
    rerender,
  };
}

const fields = (name = '我的鸡蛋饭') => [
  ['nameZh', name], ['nameEn', 'My Egg Bowl'], ['timeMinutes', '15'],
  ['ingredientId', 'egg'], ['amount', '2'], ['unit', '个'],
  ['steps', '打散鸡蛋。'], ['steps', '炒熟装盘。'],
];

test('page controller creates, views via A IDs, edits and confirms deletion across synchronous A refreshes', async () => {
  const page = await pageFixture();
  page.click('create');
  assert.match(page.html(), /中文菜名/);
  assert.match(page.html(), /步骤 2/);
  page.fill(fields());
  page.click('add-ingredient');
  assert.match(page.html(), /aria-label="食材 2"/);
  page.fill([...fields(), ['ingredientId', 'rice'], ['amount', '150'], ['unit', 'g']]);
  page.click('add-step');
  assert.match(page.html(), /步骤 3/);
  page.fill([...fields(), ['ingredientId', 'rice'], ['amount', '150'], ['unit', 'g'], ['steps', '配上米饭。']]);
  page.rerender();
  assert.match(page.html(), /我的鸡蛋饭/);
  assert.match(page.html(), /配上米饭。/);
  assert.equal(page.submit().defaultPrevented, true);
  const [recipe] = listCustomRecipes();
  assert.equal(recipe.ingredients.length, 2);
  assert.equal(recipe.steps.length, 3);
  assert.ok(page.html().includes(`data-recipe="${recipe.id}"`));
  assert.match(page.html(), /菜谱已保存/);
  assert.ok(!page.html().includes('id="custom-recipe-form"'));
  assert.ok(getRecipes().some(item => item.id === recipe.id));

  page.click('edit', {id: recipe.id});
  assert.match(page.html(), /编辑/);
  assert.match(page.html(), /value="我的鸡蛋饭"/);
  page.fill(fields('改名鸡蛋饭'));
  page.submit();
  assert.equal(listCustomRecipes()[0].id, recipe.id);
  assert.equal(listCustomRecipes()[0].nameZh, '改名鸡蛋饭');
  assert.equal(searchCatalog('我的鸡蛋饭').recipes.length, 0);
  assert.ok(searchCatalog('改名鸡蛋饭').recipes.some(item => item.id === recipe.id));

  page.click('delete', {id: recipe.id});
  assert.equal(listCustomRecipes().length, 1);
  assert.match(page.html(), /删除后无法恢复/);
  page.click('cancel-delete');
  assert.equal(listCustomRecipes().length, 1);
  page.click('delete', {id: recipe.id});
  page.click('confirm-delete', {id: recipe.id});
  assert.deepEqual(listCustomRecipes(), []);
  assert.match(page.html(), /菜谱已删除/);
  assert.equal(searchCatalog('改名鸡蛋饭').recipes.length, 0);
});

test('failed saves preserve form inputs, show an error, and permit a successful retry', async () => {
  const page = await pageFixture();
  page.click('create');
  page.fill(fields());
  const write = window.localStorage.setItem;
  window.localStorage.setItem = () => { throw new Error('quota'); };
  page.submit();
  assert.match(page.html(), /role="alert"/);
  assert.match(page.html(), /未能保存/);
  assert.match(page.html(), /value="我的鸡蛋饭"/);
  assert.equal(stored.get(CUSTOM_RECIPES_KEY), undefined);
  window.localStorage.setItem = write;
  page.submit();
  assert.equal(listCustomRecipes().length, 1);
  assert.match(page.html(), /菜谱已保存/);
});

test('row removal preserves other inputs, and cancel never writes draft changes', async () => {
  const page = await pageFixture();
  page.click('create');
  page.fill(fields());
  page.click('add-ingredient');
  page.fill([...fields(), ['ingredientId', 'rice'], ['amount', '150'], ['unit', 'g']]);
  page.click('remove-ingredient', {index: '1'});
  assert.ok(!page.html().includes('aria-label="食材 2"'));
  page.fill(fields());
  page.click('remove-step', {index: '0'});
  assert.match(page.html(), /炒熟装盘。/);
  assert.ok(!page.html().includes('打散鸡蛋。'));
  page.click('cancel');
  assert.deepEqual(listCustomRecipes(), []);
  assert.ok(!page.html().includes('id="custom-recipe-form"'));
});
