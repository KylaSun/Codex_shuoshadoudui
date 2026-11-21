import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {ingredients, recipes, substitutions} from '../src/demo-data.js';
import {createCustomRecipe, updateCustomRecipe, deleteCustomRecipe} from '../src/custom-recipes.js';

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
  root.querySelector = selector => selector === '#custom-recipes-page'
    ? (root.innerHTML.includes('id="custom-recipes-page"') ? customSection : null)
    : {focus() {}};
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

test('merged A home, search, ingredient details and all five navigation entries remain available', async () => {
  const ui = await app();
  assert.match(ui.html(), /今天想吃的家乡菜/);
  for (const page of ['home', 'search', 'pantry', 'shopping', 'custom-recipes']) {
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
  assert.match(ui.html(), /厨房功能暂不可用/);
  ui.click({go: 'shopping'});
  assert.match(ui.html(), /购物单暂不可用/);
  ui.click({go: 'custom-recipes'});
  assert.match(ui.html(), /＋ 创建菜谱/);
});

test('shopping switches between recipe groups and ingredients and offers deletion',async()=>{
  const removed=[];
  window.DinnerAppAdapters={
    getShoppingList:()=>[{ingredientId:'egg',nameZh:'鸡蛋',amount:2,unit:'个',costGBP:1.8,product:{supermarket:'Tesco'},packageCount:1}],
    getShoppingRecipeGroups:()=>[{recipeId:'rice-bowl',nameZh:'鸡蛋饭',ingredients:[{ingredientId:'egg',nameZh:'鸡蛋',amount:2,unit:'个'}]}],
    removeShoppingRecipe:id=>removed.push(['recipe',id]),
    removeShoppingIngredient:(id,unit)=>removed.push(['ingredient',id,unit]),
  };
  const ui=await app('#shopping');
  assert.match(ui.html(),/鸡蛋饭/);
  assert.match(ui.html(),/data-remove-shopping-recipe="rice-bowl"/);
  ui.click({shoppingView:'ingredient'});
  assert.ok(!ui.html().includes('鸡蛋饭'));
  assert.match(ui.html(),/data-remove-shopping-ingredient="egg"/);
  ui.click({removeShoppingIngredient:'egg',unit:'个'});
  ui.click({shoppingView:'recipe'});
  ui.click({removeShoppingRecipe:'rice-bowl'});
  assert.deepEqual(removed,[['ingredient','egg','个'],['recipe','rice-bowl']]);
});

test('shopping shows priced subtotal and applies a confirmed recipe substitution',async()=>{
  let selected=false;
  const calls=[];
  window.DinnerAppAdapters={
    getRecipes:()=>[{id:'dinner',nameZh:'测试晚餐',ingredients:[{ingredientId:'cheese',amount:30,unit:'g'}]}],
    getIngredients:()=>ingredients,
    getSubstitutions:()=>[{id:'swap-cheese',recipeId:'dinner',ingredientId:'cheese',replacementIngredientId:'milk',replacementAmount:80,replacementUnit:'ml',flavourNote:'奶味更淡',equivalent:false}],
    getShoppingRecipeGroups:()=>[{recipeId:'dinner',nameZh:'测试晚餐',ingredients:[{ingredientId:selected?'milk':'cheese',nameZh:selected?'牛奶':'奶酪',amount:selected?80:30,unit:selected?'ml':'g'}]}],
    getShoppingList:()=>selected?[{ingredientId:'milk',nameZh:'牛奶',amount:80,unit:'ml',costGBP:1.3,product:{supermarket:'Tesco'},packageCount:1}]:[{ingredientId:'egg',nameZh:'鸡蛋',amount:2,unit:'个',costGBP:1.8,product:{supermarket:'Tesco'},packageCount:1},{ingredientId:'cheese',nameZh:'奶酪',amount:30,unit:'g',costGBP:null,unmatched:true}],
    selectSubstitution:payload=>{calls.push(payload);selected=true;window.dispatchEvent(new Event('dinner:adapters-updated'));return true;},
  };
  const ui=await app('#shopping');
  assert.match(ui.html(),/已匹配商品小计/);
  assert.match(ui.html(),/£1\.80/);
  assert.match(ui.html(),/完整金额未知/);
  ui.click({sub:'swap-cheese',subRecipe:'dinner'});
  assert.match(ui.html(),/确认这次味道变化/);
  ui.click({},'data-confirm-sub');
  assert.deepEqual(calls[0],{recipeId:'dinner',ingredientId:'cheese',substitutionId:'swap-cheese',flavourConfirmed:true});
  assert.match(ui.html(),/预计采购总金额/);
  assert.match(ui.html(),/£1\.30/);
  assert.ok(!ui.html().includes('完整金额未知'));
});

test('ingredient blocking is offered beside recipe search and hides affected recipes',async()=>{
  let opened=0;
  window.DinnerAppAdapters={getBlockedIngredientIds:()=>['egg'],openBlockedIngredientsEditor:()=>{opened++;}};
  const ui=await app('#search');
  assert.match(ui.html(),/data-open-blocked/);
  assert.match(ui.html(),/屏蔽食材（1）/);
  assert.ok(!ui.html().includes('data-recipe="tomato-egg"'));
  assert.ok(ui.html().includes('data-recipe="chicken-rice"'));
  ui.click({},'data-open-blocked');
  assert.equal(opened,1);
});

test('home shows a shopping tip for selected ingredients without a priced substitute',async()=>{
  window.DinnerAppAdapters={
    getShoppingList:()=>[{ingredientId:'sichuan_pepper',nameZh:'花椒',amount:2,unit:'g',costGBP:null,unmatched:true}],
    getShoppingRecipeGroups:()=>[{recipeId:'mapo-tofu',nameZh:'麻婆豆腐饭',ingredients:[{ingredientId:'sichuan_pepper',nameZh:'花椒',amount:2,unit:'g'}]}],
    getSubstitutions:()=>[],
  };
  const ui=await app('#home');
  assert.match(ui.html(),/购物提醒/);
  assert.match(ui.html(),/花椒暂无经过菜谱校对的可计价替代/);
  assert.match(ui.html(),/查看购物单 →/);
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
