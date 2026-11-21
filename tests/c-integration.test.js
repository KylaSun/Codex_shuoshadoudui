import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createCModule, C_STORAGE_KEY} from '../src/c-module.js';
import {installCAdapters} from '../src/c-adapter.js';
import {installBAdapters} from '../src/team-adapters.js';
import {getRecipes, getIngredients, getProducts, getSubstitutions} from '../src/data.js';
import {createCustomRecipe, updateCustomRecipe, deleteCustomRecipe} from '../src/custom-recipes.js';

let data;
beforeEach(() => {
  data = new Map(); globalThis.window = new EventTarget();
  window.localStorage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
});
function integrated() { installBAdapters(window); return installCAdapters(window); }
const custom = (name = '整合蛋饭') => ({nameZh: name, timeMinutes: 15, ingredients: [{ingredientId: 'egg', amount: 2, unit: '个'}, {ingredientId: 'rice', amount: 0.15, unit: 'kg'}], steps: ['打蛋', '配饭']});

test('B and C installation preserves getters and D recipes participate in quotes, plan and recommendations', () => {
  installBAdapters(window); const bGetter = window.DinnerAppAdapters.getRecipes;
  const c = installCAdapters(window);
  assert.equal(window.DinnerAppAdapters.getRecipes, bGetter);
  const created = createCustomRecipe(custom(), getIngredients());
  const quote = c.getBudgetSummary(created.id);
  assert.equal(quote.complete, true); assert.ok(quote.totalGBP > 0);
  assert.equal(quote.items.find(x => x.ingredientId === 'rice').amount, .15);
  c.setRecipeIds([created.id]);
  assert.ok(c.getShoppingList().some(x => x.ingredientId === 'egg'));
  assert.ok(c.recommendWithinBudget({budgetGBP: 100, excludeRecipeIds: getRecipes().filter(x => x.id !== created.id).map(x => x.id)}).ok);
  updateCustomRecipe(created.id, {...custom(), ingredients: [{ingredientId: 'egg', amount: 20, unit: '个'}]}, getIngredients());
  assert.equal(c.getBudgetSummary(created.id).items[0].packageCount, 4);
  installBAdapters(window);
  assert.equal(window.DinnerAppAdapters.getBudgetSummary, c.getBudgetSummary);
  deleteCustomRecipe(created.id);
  assert.equal(c.getBudgetSummary(created.id).complete, false);
  assert.ok(Number.isNaN(c.getShoppingSummary().totalGBP));
});

test('combined B replacement includes every component, preserves flavour confirmation and survives reload', () => {
  const c = integrated();
  const args = {recipeId: 'mapo-tofu', ingredientId: 'doubanjiang', substitutionId: 'doubanjiang-to-miso-chilli-mapo'};
  assert.equal(c.selectSubstitution({...args, flavourConfirmed: false}), false);
  assert.equal(c.selectSubstitution({...args, flavourConfirmed: true}), true);
  const rows = c.calculateShoppingList(['mapo-tofu']);
  assert.equal(rows.some(x => x.ingredientId === 'doubanjiang'), false);
  assert.equal(rows.find(x => x.ingredientId === 'miso').amount, 20);
  assert.equal(rows.find(x => x.ingredientId === 'chilli_paste').amount, 5);
  assert.ok(rows.find(x => x.ingredientId === 'chilli_paste').costGBP > 0);
  assert.equal(c.getBudgetSummary('mapo-tofu').complete, false); // Flower pepper is genuinely unmatched.
  c.setPantryQuantity('chilli_paste', 5, 'g');
  assert.equal(c.calculateShoppingList(['mapo-tofu']).find(x => x.ingredientId === 'chilli_paste').costGBP, 0);
  const restored = installCAdapters(window);
  assert.equal(restored.getSelectedSubstitutions()['mapo-tofu:doubanjiang'], args.substitutionId);
  restored.selectSubstitution({...args, substitutionId: null});
  assert.ok(restored.calculateShoppingList(['mapo-tofu']).some(x => x.ingredientId === 'doubanjiang'));
});

test('structured B pack quantities handle 16 dumplings in 12-piece packs instead of parsing weight as count', () => {
  const c = integrated();
  const item = c.calculateShoppingList(['egg-skirt-dumplings']).find(x => x.ingredientId === 'frozen_dumplings');
  assert.equal(item.product.packQuantity, 12); assert.equal(item.packageCount, 2); assert.equal(item.costGBP, 8.5);
  c.setPantryQuantity('frozen_dumplings', 4, '个');
  assert.equal(c.calculateShoppingList(['egg-skirt-dumplings']).find(x => x.ingredientId === 'frozen_dumplings').packageCount, 1);
});

test('ingredients aggregate before pantry deduction and whole-pack rounding across several recipes', () => {
  const c = integrated();
  const a = createCustomRecipe({...custom('第一道'), ingredients: [{ingredientId: 'rice', amount: 600, unit: 'g'}]}, getIngredients());
  const b = createCustomRecipe({...custom('第二道'), ingredients: [{ingredientId: 'rice', amount: .6, unit: 'kg'}]}, getIngredients());
  c.setPantryQuantity('rice', .3, 'kg');
  const row = c.calculateShoppingList([a.id, b.id, a.id])[0];
  assert.equal(row.amount, 1200); assert.equal(row.have, 300); assert.equal(row.needed, 900); assert.equal(row.packageCount, 1);
});

test('unknown units, unknown IDs, invalid price/quantity and missing recipe cannot silently quote £0', () => {
  const c = integrated();
  const spoon = createCustomRecipe({...custom(), ingredients: [{ingredientId: 'oil', amount: 1, unit: '汤匙'}]}, getIngredients());
  assert.equal(c.getBudgetSummary(spoon.id).complete, false);
  assert.equal(c.getBudgetSummary('not-a-recipe').complete, false);
  const fixture = createCModule({getRecipes: () => [{id: 'invalid', ingredients: [{ingredientId: 'x', amount: NaN, unit: 'g'}]}],
    getIngredients: () => [{id: 'x'}], getProducts: () => [{ingredientId: 'x', packageSize: '100 g', priceGBP: NaN}], storage: window.localStorage});
  assert.ok(Number.isNaN(fixture.getBudgetSummary('invalid').totalGBP));
});

test('whole-pack selection compares total checkout cost rather than the lowest sticker price', () => {
  const c = createCModule({storage: window.localStorage,
    getRecipes: () => [{id: 'meal', ingredients: [{ingredientId: 'rice', amount: 250, unit: 'g'}]}], getIngredients: () => [{id: 'rice'}],
    getProducts: () => [{id: 'small', ingredientId: 'rice', packageSize: '100 g', priceGBP: 1}, {id: 'large', ingredientId: 'rice', packageSize: '300 g', priceGBP: 2}]});
  assert.equal(c.getBudgetSummary('meal').totalGBP, 2);
  assert.equal(c.getBudgetSummary('meal').items[0].product.id, 'large');
});

test('over-budget and unmatched shopping cannot save until explicit adjustments; rejected writes are transactional', () => {
  const c = integrated();
  let result = c.saveShoppingPlan({recipeIds: ['egg-fried-rice'], budgetGBP: 0, excluded: []});
  assert.equal(result.reason, 'over-budget'); assert.deepEqual(c.getKitchenState().recipeIds, []);
  result = c.saveShoppingPlan({recipeIds: ['mapo-tofu'], budgetGBP: 100, excluded: []});
  assert.equal(result.reason, 'unmatched');
  const quote = c.getBudgetSummary('egg-fried-rice');
  assert.equal(c.saveShoppingPlan({recipeIds: ['egg-fried-rice'], budgetGBP: quote.totalGBP, excluded: []}).ok, true);
  const raw = data.get(C_STORAGE_KEY);
  window.localStorage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => c.setPantryQuantity('egg', 4, '个'), /未保存/);
  assert.equal(c.getPantry().length, 0); assert.equal(data.get(C_STORAGE_KEY), raw);
});

test('missing products stay unknown and exclusions apply only to explicitly removed shopping items', () => {
  const c = integrated(); const rows = c.getBudgetSummary('mapo-tofu').items;
  const excluded = rows.filter(x => x.unmatched).map(x => x.key);
  assert.ok(excluded.length > 0);
  const result = c.saveShoppingPlan({recipeIds: ['mapo-tofu'], budgetGBP: 100, excluded});
  assert.equal(result.ok, true); assert.ok(result.totalGBP > 0);
  assert.equal(c.getBudgetSummary('mapo-tofu').complete, false); // A full recipe quote never hides exclusions.
});

test('daily recommendations persist by local day, require reroll reason, and never repeat the current result', () => {
  integrated(); let day = '2026-11-21';
  const options = {getRecipes, getIngredients, getProducts, getSubstitutions, storage: window.localStorage, today: () => day};
  const c = createCModule(options); c.setBudgetGBP(100);
  const first = c.requestRecommendation({random: () => 0}); assert.equal(first.ok, true);
  assert.equal(c.requestRecommendation({random: () => 0}).reason, 'reroll-reason-required');
  assert.equal(c.requestRecommendation({reason: 'invalid'}).ok, false);
  const second = c.requestRecommendation({reason: '想换一种口味', random: () => 0}); assert.equal(second.ok, true);
  assert.notEqual(first.recipe.id, second.recipe.id);
  assert.equal(createCModule(options).getKitchenState().recommendation.recipeId, second.recipe.id);
  day = '2026-11-22'; assert.equal(c.getKitchenState().recommendation, null);
  assert.equal(c.requestRecommendation({random: () => 0}).ok, true);
});

test('legacy C storage restores; corrupt storage remains untouched and yields an explicit error', () => {
  integrated();
  data.set(C_STORAGE_KEY, JSON.stringify({pantry: [{ingredientId: 'rice', amount: 200, unit: 'g'}], budgetGBP: 8, recipeIds: ['egg-fried-rice'], excluded: []}));
  assert.equal(installCAdapters(window).getPantry()[0].amount, 200);
  data.set(C_STORAGE_KEY, '{broken');
  const c = installCAdapters(window);
  assert.ok(c.getKitchenState().storageError);
  assert.throws(() => c.setBudgetGBP(10));
  assert.equal(data.get(C_STORAGE_KEY), '{broken');
});
