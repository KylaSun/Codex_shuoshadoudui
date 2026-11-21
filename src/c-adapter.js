import {createCModule} from './c-module.js';
import {getRecipes, getIngredients, getProducts, getSubstitutions} from './team-adapters.js';
import {mergeCustomRecipes} from './custom-recipes.js';

const c = createCModule({
  getRecipes: () => mergeCustomRecipes(getRecipes()),
  getIngredients,
  getProducts,
  getSubstitutions,
  dispatch: () => window.dispatchEvent(new Event('dinner:adapters-updated')),
});

window.DinnerAppAdapters = {...window.DinnerAppAdapters, ...c};
window.dispatchEvent(new Event('dinner:adapters-updated'));

export default c;
