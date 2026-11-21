import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {CUSTOM_RECIPES_KEY, listCustomRecipes} from '../src/custom-recipes.js';
import {getRecipes, searchCatalog} from '../src/data.js';
import {png, extraction} from './fixtures/recognition.js';

const nativeFormData = globalThis.FormData;
const nativeFetch = globalThis.fetch;
const nativeXHR = globalThis.XMLHttpRequest;
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
afterEach(() => { globalThis.FormData = nativeFormData; globalThis.fetch = nativeFetch; globalThis.XMLHttpRequest = nativeXHR; });

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
  const dispatch = (type, target, extra = {}) => {
    const event = new Event(type, {cancelable: true});
    Object.defineProperty(event, 'target', {value: target});
    for (const [key, value] of Object.entries(extra)) Object.defineProperty(event, key, {value});
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
    choose(file) { dispatch('change', {id: 'recipe-image', files: [file], closest: () => null}); },
    drop(files) { return dispatch('drop', {closest: selector => selector === '[data-image-drop]' ? {} : null}, {dataTransfer: {files}}); },
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

const settle = () => new Promise(resolve => setImmediate(resolve));
function mockRecognition(configured = true) {
  globalThis.fetch = async url => {
    assert.equal(url, '/api/recipe-recognition/status');
    return Response.json({configured, message: configured ? '已配置' : 'AI 尚未配置：请设置 OPENAI_API_KEY'});
  };
  globalThis.XMLHttpRequest = class {
    upload = {};
    open() {}
    setRequestHeader() {}
    abort() { this.onabort?.(); }
    send() {
      queueMicrotask(() => {
        this.upload.onload?.();
        this.status = 200; this.responseText = JSON.stringify({recipe: extraction()}); this.onload();
      });
    }
  };
}

test('image recognition requires review, completion, ingredient selection and explicit confirmation before saving', async () => {
  mockRecognition();
  const page = await pageFixture();
  page.click('import-image'); await settle();
  page.choose(new File([png], 'family.png', {type: 'image/png'})); await settle();
  assert.match(page.html(), /待识别的菜谱原图/);
  page.click('recognize-image'); await settle();
  assert.match(page.html(), /识别完成，尚未保存/);
  assert.deepEqual(listCustomRecipes(), []);
  page.click('apply-image-result');
  assert.match(page.html(), /name="timeMinutes"[^>]*value=""/);
  assert.match(page.html(), /未唯一匹配/);
  assert.match(page.html(), /原图：神秘酱 · 少许/);
  assert.match(page.html(), /name="importConfirmed"/);
  assert.deepEqual(listCustomRecipes(), []);
  page.fill(fields());
  page.submit();
  assert.match(page.html(), /勾选确认/);
  assert.deepEqual(listCustomRecipes(), []);
  page.fill([...fields().filter(([name]) => name !== 'timeMinutes'), ['timeMinutes', ''], ['importConfirmed', 'on']]);
  page.submit();
  assert.match(page.html(), /烹饪时间必须/);
  assert.deepEqual(listCustomRecipes(), []);
  page.fill([...fields(), ['ingredientId', ''], ['amount', '1'], ['unit', 'g'], ['importConfirmed', 'on']]);
  page.submit();
  assert.match(page.html(), /现有食材库/);
  page.fill([...fields(), ['ingredientId', 'onion'], ['amount', '0.5'], ['unit', '个'], ['importConfirmed', 'on']]);
  page.submit();
  assert.equal(listCustomRecipes().length, 1);
  assert.ok(searchCatalog('我的鸡蛋饭').recipes.some(item => item.id === listCustomRecipes()[0].id));
  const saved = stored.get(CUSTOM_RECIPES_KEY);
  assert.ok(!saved.includes('blob:'));
  assert.ok(!saved.includes('family.png'));
  assert.ok(!saved.includes('sourceName'));
  assert.ok(!page.html().includes('待识别的菜谱原图'));
});

test('image drop rejects invalid files and unconfigured API is visible without fake recognition', async () => {
  mockRecognition(false);
  const page = await pageFixture();
  page.click('import-image'); await settle();
  assert.match(page.html(), /AI 尚未配置/);
  assert.equal(page.drop([new File(['bad'], 'bad.gif', {type: 'image/gif'})]).defaultPrevented, true);
  await settle(); assert.match(page.html(), /请选择 JPG/);
  page.drop([new File([png], 'family.png', {type: 'image/png'})]); await settle();
  assert.match(page.html(), /待识别的菜谱原图/);
  assert.match(page.html(), /AI 未配置/);
  assert.ok(!page.html().includes('data-custom-action="recognize-image"'));
  page.click('close-image-import');
  assert.ok(!page.html().includes('待识别的菜谱原图'));
  assert.deepEqual(listCustomRecipes(), []);
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
