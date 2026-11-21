import { recipes as demoRecipes, ingredients as demoIngredients, products as demoProducts, substitutions as demoSubstitutions } from './demo-data.js';
import { createCModule } from './c-module.js';

const previous = window.DinnerAppAdapters || {};
const fromExisting = (name, fallback) => {
  const candidate = window.DinnerAppAdapters?.[name] || previous[name];
  if (typeof candidate !== 'function') return fallback;
  try { const value = candidate(); return Array.isArray(value) ? value : fallback; }
  catch { return fallback; }
};
const moduleC = createCModule({
  getRecipes: () => fromExisting('getRecipes', demoRecipes),
  getIngredients: () => fromExisting('getIngredients', demoIngredients),
  getProducts: () => fromExisting('getProducts', demoProducts),
  getSubstitutions: () => fromExisting('getSubstitutions', demoSubstitutions),
  dispatch: () => window.dispatchEvent(new Event('dinner:adapters-updated')),
});
export const { getPantry, getBudgetSummary, getShoppingList, selectSubstitution, recommendWithinBudget, openPantryEditor, openShoppingEditor } = moduleC;
window.DinnerAppAdapters = { ...previous, ...moduleC };
window.dispatchEvent(new Event('dinner:adapters-updated'));
