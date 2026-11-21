// C uses A's public data layer, which already composes B's current adapters with D's local recipes.
import {getRecipes, getIngredients, getProducts, getSubstitutions} from './data.js';
import {createCModule} from './c-module.js';

export function installCAdapters(target = window) {
  let storage;
  try { storage = target.localStorage; } catch { /* Read-only UI will explain unavailable storage. */ }
  const kitchen = createCModule({getRecipes, getIngredients, getProducts, getSubstitutions, storage,
    dispatch: () => target.dispatchEvent(new Event('dinner:adapters-updated'))});
  const navigate = page => target.dispatchEvent(new CustomEvent('dinner:navigate', {detail: {page}}));
  target.DinnerAppAdapters = {...(target.DinnerAppAdapters || {}), ...kitchen,
    openPantryEditor: () => navigate('pantry'), openShoppingEditor: () => navigate('shopping')};
  target.dispatchEvent(new Event('dinner:adapters-updated'));
  return kitchen;
}

if (typeof window !== 'undefined') installCAdapters(window);
