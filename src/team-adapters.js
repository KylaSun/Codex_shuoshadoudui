/** Load this module before A's src/main.js. C may extend DinnerAppAdapters later. */
import {
  getIngredients as getRawIngredients,
  getProducts as getRawProducts,
  getRecipes as getRawRecipes,
  getSubstitutions as getRawSubstitutions,
  featuredSpecialtyRecipeIds,
  featuredViralRecipeIds,
  ingredientById,
  recipeById,
} from './data/catalog.js';

const categoryNames = { vegetable: '蔬菜', meat_egg: '肉蛋', staple: '主食', seasoning: '调味料' };
const unitNames = { g: 'g', ml: 'ml', each: '个' };
const formatQuantity = (amount) => Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)));

export function getRecipes() {
  return getRawRecipes().map(recipe => ({
    ...recipe,
    timeMinutes: recipe.minutes,
    difficulty: recipe.difficulty === 'easy' ? '简单' : '中等',
    tags: [...new Set([...(recipe.tags ?? []), ...(recipe.region ? [recipe.region] : []), ...(featuredSpecialtyRecipeIds.includes(recipe.id) ? ['中式食材替代'] : []), ...(featuredViralRecipeIds.includes(recipe.id) ? ['网络流行菜'] : [])])],
    ingredients: recipe.ingredients.map(line => ({
      ...line,
      amount: line.quantity,
      unit: unitNames[ingredientById[line.ingredientId]?.unit] ?? line.unit ?? '',
    })),
  }));
}

export function getIngredients() {
  return getRawIngredients().map(ingredient => ({
    ...ingredient,
    category: categoryNames[ingredient.category] ?? ingredient.category,
  }));
}

export function getProducts() {
  return getRawProducts().map(product => ({
    ...product,
    supermarket: product.supermarket === 'Sainsburys' ? 'Sainsbury’s' : 'Tesco',
    packageSize: product.packLabel,
    priceGBP: product.priceGbp,
    recordedAt: product.priceRecordedOn,
    url: product.productUrl,
  }));
}

export function getSubstitutions() {
  return getRawSubstitutions().flatMap(rule => rule.recipeIds.map(recipeId => {
    const originalAmount = recipeById[recipeId]?.ingredients.find(line => line.ingredientId === rule.ingredientId)?.quantity ?? 0;
    const replacementAmount = originalAmount * rule.quantityRatio;
    const extras = (rule.extraReplacements ?? []).map(extra => {
      const ingredient = ingredientById[extra.ingredientId];
      return `${formatQuantity(originalAmount * extra.quantityRatio)} ${unitNames[ingredient?.unit] ?? ''} ${ingredient?.nameZh ?? extra.ingredientId}`;
    });
    return {
      ...rule,
      recipeId,
      replacementIngredientId: rule.replacementId,
      originalAmount,
      originalUnit: unitNames[ingredientById[rule.ingredientId]?.unit] ?? '',
      replacementAmount,
      replacementUnit: unitNames[ingredientById[rule.replacementId]?.unit] ?? '',
      flavourNote: rule.tasteDifference,
      technique: [rule.context, extras.length ? `还需 ${extras.join(' + ')}` : '', rule.quantityAdvice].filter(Boolean).join('；'),
    };
  }));
}

export function installBAdapters(target = window) {
  target.DinnerAppAdapters = {
    ...(target.DinnerAppAdapters ?? {}),
    getRecipes,
    getIngredients,
    getProducts,
    getSubstitutions,
  };
  target.dispatchEvent?.(new Event('dinner:adapters-updated'));
}

if (typeof window !== 'undefined') installBAdapters(window);
