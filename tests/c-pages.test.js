import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {installBAdapters} from '../src/team-adapters.js';
import {installCAdapters} from '../src/c-adapter.js';

const NativeFormData = globalThis.FormData;
let kitchen;
let caseId = 0;
beforeEach(() => {
  globalThis.window = new EventTarget(); const data = new Map();
  window.localStorage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v)};
  installBAdapters(window); kitchen = installCAdapters(window);
  globalThis.FormData = class {
    constructor(form) { this.entries = form.entries; }
    get(name) { return this.entries.find(([key]) => key === name)?.[1] ?? null; }
    getAll(name) { return this.entries.filter(([key]) => key === name).map(([, value]) => value); }
  };
});
afterEach(() => { globalThis.FormData = NativeFormData; });

const form = (id, entries, dataset = {}, included = []) => ({id, entries, dataset,
  querySelectorAll: () => included.map(value => ({value}))});
async function fixture(page) {
  const module = await import(`../src/c-pages.js?case=${++caseId}`);
  let section;
  const root = {querySelector: selector => selector === '#c-page' ? section : null};
  const options = {recipeCard: recipe => `<button data-recipe="${recipe.id}">${recipe.nameZh}</button>`};
  const render = () => { section = new EventTarget(); section.innerHTML = module.renderCPage(page, options); module.mountCPages(root, page, options); };
  render(); window.addEventListener('dinner:adapters-updated', render);
  const dispatch = (type, target) => { const event = new Event(type, {cancelable: true}); Object.defineProperty(event, 'target', {value: target}); section.dispatchEvent(event); };
  return {module, render, html: () => section.innerHTML,
    submit: value => dispatch('submit', value),
    click(command, extra = {}) { const button = {dataset: {cAction: command, ...extra}}; button.closest = () => button; dispatch('click', button); },
    change(value) { dispatch('change', {closest: () => value}); },
  };
}

test('kitchen page creates, edits and deletes pantry entries across synchronous A refreshes', async () => {
  const ui = await fixture('pantry');
  assert.match(ui.html(), /厨房还没有库存/);
  ui.submit(form('c-pantry-add', [['ingredientId', 'egg'], ['amount', '2'], ['unit', '个']]));
  assert.equal(kitchen.getPantry()[0].amount, 2);
  assert.match(ui.html(), /库存已保存/);
  ui.submit(form('stock-row', [['amount', '5']], {cPantryIndex: '0'}));
  assert.equal(kitchen.getPantry()[0].amount, 5);
  ui.click('remove-pantry', {index: '0'});
  assert.equal(kitchen.getPantry().length, 0);
  assert.ok(!ui.html().includes('id="c-page"')); // redraw replaces content, never nests another page.
});

test('shopping page blocks overspend, supports explicit budget raise and only commits on confirmation', async () => {
  const ui = await fixture('shopping');
  ui.module.queueRecipeForShopping('egg-fried-rice'); ui.render();
  const rows = kitchen.quoteShoppingPlan(['egg-fried-rice']).items;
  const keys = rows.filter(x => x.needed > 0).map(x => x.key);
  const shoppingForm = budget => form('c-shopping-form', [['recipeIds', 'egg-fried-rice'], ['budgetGBP', String(budget)], ...keys.map(key => ['included', key])], {}, keys);
  ui.change(shoppingForm(0));
  assert.match(ui.html(), /超过当前预算/);
  ui.submit(shoppingForm(0));
  assert.deepEqual(kitchen.getKitchenState().recipeIds, []);
  ui.click('raise-budget');
  const total = kitchen.quoteShoppingPlan(['egg-fried-rice']).totalGBP;
  assert.match(ui.html(), new RegExp(`value="${total}"`));
  assert.equal(kitchen.getBudget(), 5); // raising a draft alone does not write storage.
  ui.submit(shoppingForm(total));
  assert.deepEqual(kitchen.getKitchenState().recipeIds, ['egg-fried-rice']);
  assert.equal(kitchen.getBudget(), total);
  assert.match(ui.html(), /购物单和预算已保存/);
});

test('shopping page shows missing product names and unknown totals; explicit exclusions have a partial-cost notice', async () => {
  const ui = await fixture('shopping'); ui.module.queueRecipeForShopping('mapo-tofu'); ui.render();
  assert.match(ui.html(), /无法完整估价/);
  assert.match(ui.html(), /英文采购名/);
  assert.match(ui.html(), /不能把缺价当作 £0/);
  const rows = kitchen.quoteShoppingPlan(['mapo-tofu']).items;
  const keys = rows.map(x => x.key);
  const entries = [['recipeIds', 'mapo-tofu'], ['budgetGBP', '100'], ...rows.filter(x => !x.unmatched).map(x => ['included', x.key])];
  ui.change(form('c-shopping-form', entries, {}, keys));
  assert.match(ui.html(), /不代表完整菜谱成本/);
  ui.submit(form('c-shopping-form', entries, {}, keys));
  assert.deepEqual(kitchen.getKitchenState().recipeIds, ['mapo-tofu']);
  assert.equal(kitchen.getBudgetSummary('mapo-tofu').complete, false);
});

test('daily page renders actual recipe details, requires a reroll reason and keeps the old result on rejected rerolls', async () => {
  kitchen.setBudgetGBP(100);
  const ui = await fixture('recommendations');
  ui.submit(form('c-recommend-form', []));
  const first = kitchen.getKitchenState().recommendation.recipeId;
  assert.ok(ui.html().includes(`data-recipe="${first}"`));
  assert.match(ui.html(), /重新推荐前，先选择原因/);
  ui.submit(form('c-recommend-form', []));
  assert.equal(kitchen.getKitchenState().recommendation.recipeId, first);
  assert.match(ui.html(), /请先选择/);
  ui.submit(form('c-recommend-form', [['reason', '想换一种口味']]));
  assert.notEqual(kitchen.getKitchenState().recommendation.recipeId, first);
  assert.match(ui.html(), /今日推荐已保存/);
});

test('no feasible daily recommendation is reported honestly without a fake recipe', async () => {
  kitchen.setBudgetGBP(0); const ui = await fixture('recommendations');
  ui.submit(form('c-recommend-form', []));
  assert.match(ui.html(), /预算内没有其他可完整报价的菜/);
  assert.equal(kitchen.getKitchenState().recommendation, null);
});
