import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {ingredients, recipes, substitutions} from '../src/demo-data.js';
import {createCustomRecipe, updateCustomRecipe, deleteCustomRecipe} from '../src/custom-recipes.js';
import {installBAdapters} from '../src/team-adapters.js';
import {installCAdapters} from '../src/c-adapter.js';

let caseId = 0;
beforeEach(() => {
  const stored = new Map();
  globalThis.window = new EventTarget();
  window.localStorage = {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value)};
  window.scrollTo = () => {};
  globalThis.location = {hash: ''};
  globalThis.history = {pushState(state, title, hash) { location.hash = hash; }};
});

async function app(hash = '') {
  // Exercise the actual merged main.js with only the browser DOM boundary stubbed.
  const root = new EventTarget();
  const customSection = new EventTarget();
  const kitchenSection = new EventTarget();
  root.querySelector = selector => selector === '#custom-recipes-page'
    ? (root.innerHTML.includes('id="custom-recipes-page"') ? customSection : null)
    : selector === '#c-page' ? (root.innerHTML.includes('id="c-page"') ? kitchenSection : null) : {focus() {}};
  globalThis.document = {getElementById: id => id === 'app' ? root : null};
  location.hash = hash;
  await import(`../src/main.js?merge-integration=${++caseId}`);
  const dispatch = (type, target) => {
    const event = new Event(type, {cancelable: true});
    Object.defineProperty(event, 'target', {value: target});
    root.dispatchEvent(event);
  };
  return {
    html: () => root.innerHTML,
    click(dataset = {}, attribute) {
      const button = {dataset, hasAttribute: name => name === attribute};
      button.closest = () => button;
      dispatch('click', button);
    },
    search(value) { dispatch('submit', {id: 'search-form', querySelector: () => ({value})}); },
  };
}

const customDraft = nameZh => ({
  nameZh, nameEn: 'My custom egg', timeMinutes: 10,
  ingredients: [{ingredientId: 'egg', amount: 2, unit: '个'}], steps: ['打蛋。', '炒熟。'],
});

test('merged A home, search, ingredient details and all six navigation entries remain available', async () => {
  const ui = await app();
  assert.match(ui.html(), /今天想吃的家乡菜/);
  for (const page of ['home', 'search', 'recommendations', 'pantry', 'shopping', 'custom-recipes']) {
    assert.ok(ui.html().includes(`data-go="${page}"`));
  }
  ui.search('CHICKEN');
  assert.match(ui.html(), /鸡肉盖饭/);
  assert.match(ui.html(), /鸡胸肉/);
  ui.click({filter: 'ingredient'});
  assert.ok(!ui.html().includes('data-recipe="chicken-rice"'));
  ui.click({ingredient: 'chicken'});
  assert.match(ui.html(), /超市参考商品/);
  assert.match(ui.html(), /Tesco Long Grain Rice|Tesco|Sainsbury/);
  ui.click({go: 'pantry'});
  assert.match(ui.html(), /库存编辑属于 C 模块/);
  ui.click({go: 'shopping'});
  assert.match(ui.html(), /购物单及预算调整属于 C 模块/);
  ui.click({go: 'custom-recipes'});
  assert.match(ui.html(), /＋ 创建菜谱/);
});

test('full A+B+C+D page navigation uses C services, contextual B substitutions and pending shopping plans', async () => {
  installBAdapters(window); const c = installCAdapters(window);
  const ui = await app('#recommendations');
  assert.match(ui.html(), /每日/); assert.match(ui.html(), /生成今日推荐/);
  ui.click({go: 'pantry'});
  assert.match(ui.html(), /保存库存/); assert.ok(!ui.html().includes('尚未接入'));
  ui.click({recipe: 'mapo-tofu'});
  assert.match(ui.html(), /无法完整估价/);
  ui.click({sub: 'doubanjiang-to-miso-chilli-mapo'});
  assert.match(ui.html(), /味噌酱 \+ 辣椒酱/);
  ui.click({}, 'data-confirm-sub');
  assert.equal(c.getSelectedSubstitutions()['mapo-tofu:doubanjiang'], 'doubanjiang-to-miso-chilli-mapo');
  const components = c.calculateShoppingList(['mapo-tofu']);
  assert.ok(components.some(x => x.ingredientId === 'chilli_paste' && x.amount === 5));
  ui.click({recipe: 'egg-fried-rice'});
  assert.match(ui.html(), /加入购物计划/);
  ui.click({cAddRecipe: 'egg-fried-rice'});
  assert.match(ui.html(), /超过当前预算/);
  assert.deepEqual(c.getKitchenState().recipeIds, []); // It is a draft, not an auto-saved purchase plan.
  ui.click({go: 'custom-recipes'});
  assert.match(ui.html(), /AI 图片导入/);
});

test('merged A search and details refresh after D creation, edit and deletion without replacing B adapter', async () => {
  const getter = () => recipes;
  window.DinnerAppAdapters = {getRecipes: getter};
  const ui = await app('#custom-recipes');
  assert.match(ui.html(), /＋ 创建菜谱/);
  const created = createCustomRecipe(customDraft('联调鸡蛋'), ingredients);
  assert.ok(ui.html().includes(`data-recipe="${created.id}"`));
  ui.search('联调鸡蛋');
  assert.ok(ui.html().includes(`data-recipe="${created.id}"`));
  ui.click({recipe: created.id});
  assert.match(ui.html(), /联调鸡蛋/);
  assert.match(ui.html(), /打蛋。/);
  assert.match(ui.html(), /2 个/);
  updateCustomRecipe(created.id, customDraft('联调改名鸡蛋'), ingredients);
  assert.match(ui.html(), /联调改名鸡蛋/);
  deleteCustomRecipe(created.id);
  assert.match(ui.html(), /菜谱不存在/);
  assert.equal(window.DinnerAppAdapters.getRecipes, getter);
});

test('merged A substitution labels, suitability, cancel, confirmation and restore preserve the C contract', async () => {
  const calls = [];
  window.DinnerAppAdapters = {
    getSubstitutions: () => substitutions.map(rule => ({...rule, suitability: '谨慎 <参考>'})),
    selectSubstitution: payload => { calls.push(payload); return true; },
  };
  const ui = await app();
  ui.click({recipe: 'creamy-pasta'});
  assert.match(ui.html(), /味道有变化/);
  assert.match(ui.html(), /适用等级：谨慎 &lt;参考&gt;/);
  assert.match(ui.html(), /替代比例为项目估算/);
  ui.click({sub: 'sub-milk-cheese'});
  assert.match(ui.html(), /role="dialog"/);
  assert.match(ui.html(), /请按实际口味和烹饪情况调整/);
  ui.click({}, 'data-cancel-sub');
  assert.equal(calls.length, 0);
  assert.ok(!ui.html().includes('role="dialog"'));
  ui.click({sub: 'sub-milk-cheese'});
  ui.click({}, 'data-confirm-sub');
  assert.deepEqual(calls[0], {recipeId: 'creamy-pasta', ingredientId: 'cheese', substitutionId: 'sub-milk-cheese', flavourConfirmed: true});
  assert.match(ui.html(), /✓ 已选择/);
  ui.click({resetSub: 'cheese'});
  assert.equal(calls[1].substitutionId, null);
  assert.ok(!ui.html().includes('✓ 已选择'));
});
