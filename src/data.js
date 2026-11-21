import {recipes as demoRecipes,ingredients as demoIngredients,products as demoProducts,substitutions as demoSubstitutions} from './demo-data.js';
import {mergeCustomRecipes} from './custom-recipes.js';

// B/C/D may register adapters before this module loads, or dispatch dinner:adapters-updated.
export function adapters(){return window.DinnerAppAdapters || {};}
function getArray(key,fallback){const x=adapters()[key];if(typeof x!=='function')return fallback;try{const result=x();return Array.isArray(result)?result:fallback;}catch(error){console.warn(`Adapter ${key} failed`,error);return fallback;}}
export const getRecipes=()=>mergeCustomRecipes(getArray('getRecipes',demoRecipes));
export const getIngredients=()=>getArray('getIngredients',demoIngredients);
export const getProducts=()=>getArray('getProducts',demoProducts);
export const getSubstitutions=()=>getArray('getSubstitutions',demoSubstitutions);
export function getPantry(){const getter=adapters().getPantry;if(typeof getter!=='function')return null;try{return getter();}catch{return null;}}
export function getBudgetSummary(recipeId, substitutions){const getter=adapters().getBudgetSummary;if(typeof getter!=='function')return null;try{return getter(recipeId,substitutions);}catch{return null;}}
export function getShoppingList(){const getter=adapters().getShoppingList;if(typeof getter!=='function')return null;try{return getter();}catch{return null;}}
export function ingredientById(id){return getIngredients().find(x=>x.id===id);}
export function searchCatalog(raw, type='all'){
 const q=String(raw||'').trim().toLocaleLowerCase();
 const has=(x)=>[x.nameZh,x.nameEn,...(x.aliases||[])].some(s=>String(s||'').toLocaleLowerCase().includes(q));
 const matchedIngredients=getIngredients().filter(has);
 const recipes=type==='ingredient'?[]:getRecipes().filter(r=>!q||has(r)||r.ingredients?.some(x=>matchedIngredients.some(i=>i.id===x.ingredientId)));
 const ingredients=type==='recipe'?[]:matchedIngredients;
 return {recipes,ingredients};
}
export function productsFor(ingredientId){return getProducts().filter(x=>x.ingredientId===ingredientId);}
export function substitutionsFor(recipeId,ingredientId){return getSubstitutions().filter(x=>x.recipeId===recipeId&&x.ingredientId===ingredientId);}
