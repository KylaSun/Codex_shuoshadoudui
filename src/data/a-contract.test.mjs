import test from 'node:test';
import assert from 'node:assert/strict';
import { getIngredients, getProducts, getRecipes, getSubstitutions, installBAdapters } from '../team-adapters.js';

test('B adapter follows A integration contract', () => {
  const ingredients = getIngredients();
  const recipes = getRecipes();
  const products = getProducts();
  const substitutions = getSubstitutions();
  const ingredientIds = new Set(ingredients.map(x => x.id));
  const recipeIds = new Set(recipes.map(x => x.id));

  assert.ok(recipes.length >= 40);
  assert.ok(ingredients.length >= 43);
  assert.ok(products.every(x => ingredientIds.has(x.ingredientId) && x.packageSize && x.priceGBP > 0 && x.recordedAt && x.url));
  assert.ok(products.some(x => x.supermarket === 'Tesco'));
  assert.ok(products.some(x => x.supermarket === 'Sainsbury’s'));
  for (const recipe of recipes) {
    assert.ok(recipe.timeMinutes > 0 && recipe.steps.length >= 2);
    assert.ok(recipe.ingredients.every(x => ingredientIds.has(x.ingredientId) && x.amount > 0 && x.unit));
  }
  for (const rule of substitutions) {
    assert.ok(recipeIds.has(rule.recipeId));
    assert.ok(ingredientIds.has(rule.ingredientId) && ingredientIds.has(rule.replacementIngredientId));
    assert.ok(rule.replacementAmount > 0 && rule.replacementUnit && rule.flavourNote);
  }
  const mapo = substitutions.find(x => x.id === 'doubanjiang-to-miso-chilli-mapo');
  assert.match(mapo.technique, /5 g 辣椒酱/);
  assert.ok(recipes.find(x => x.id === 'shanghai-scallion-oil-noodles')?.tags.includes('上海'));
  assert.ok(recipes.find(x => x.id === 'gongjin-burst-eggs')?.tags.includes('网络流行菜'));
  assert.ok(substitutions.find(x => x.id === 'wuhan-sesame-to-tahini')?.sourceUrls?.length);
});

test('B installation preserves C/D adapters already registered', () => {
  const getPantry = () => [{ ingredientId: 'rice', amount: 100, unit: 'g' }];
  const target = { DinnerAppAdapters: { getPantry }, dispatchEvent() {} };
  installBAdapters(target);
  assert.equal(target.DinnerAppAdapters.getPantry, getPantry);
  assert.equal(target.DinnerAppAdapters.getRecipes().length, getRecipes().length);
});
