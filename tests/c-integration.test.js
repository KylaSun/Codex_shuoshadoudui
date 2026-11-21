import test from 'node:test';
import assert from 'node:assert/strict';
import {createCModule} from '../src/c-module.js';
import {getRecipes,getIngredients,getProducts,getSubstitutions} from '../src/team-adapters.js';

const memory=()=>({value:null,getItem(){return this.value},setItem(_key,value){this.value=value}});
const makeC=(storage=memory())=>createCModule({getRecipes,getIngredients,getProducts,getSubstitutions,storage});

test('C calculates current B recipes from canonical pack quantities',()=>{
  const c=makeC();
  assert.equal(getRecipes().length,47);
  assert.equal(getProducts().length,55);
  const quote=c.getBudgetSummary('egg-fried-rice');
  assert.ok(Number.isFinite(quote.totalGBP));
  assert.ok(quote.totalGBP>0);
  const incomplete=c.getBudgetSummary('mapo-tofu');
  assert.ok(Number.isNaN(incomplete.totalGBP));
  assert.match(incomplete.label,/部分参考金额，完整预算未知/);
  assert.ok(incomplete.knownSubtotalGBP>0);
});

test('C includes every ingredient of a combined B substitution',()=>{
  const c=makeC();
  c.setRecipeIds(['mapo-tofu']);
  const rule=getSubstitutions().find(x=>x.id==='doubanjiang-to-miso-chilli-mapo');
  assert.ok(rule);
  assert.equal(c.selectSubstitution({recipeId:'mapo-tofu',ingredientId:'doubanjiang',substitutionId:rule.id,flavourConfirmed:true}),true);
  const list=c.getShoppingList();
  assert.ok(list.some(x=>x.ingredientId==='miso'));
  assert.ok(list.some(x=>x.ingredientId==='chilli_paste'));
  assert.ok(!list.some(x=>x.ingredientId==='doubanjiang'));
});

test('C persists selections and subtracts canonical each units',()=>{
  const storage=memory();
  const c=makeC(storage);
  c.setRecipeIds(['egg-fried-rice']);
  const before=c.getShoppingList().find(x=>x.ingredientId==='egg');
  assert.ok(before);
  c.setPantryQuantity('egg',before.requiredAmount,'each');
  assert.ok(!c.getShoppingList().some(x=>x.ingredientId==='egg'));
  assert.ok(!makeC(storage).getShoppingList().some(x=>x.ingredientId==='egg'));
});

test('multiple real B recipes merge pantry-adjusted ingredients and persist after reload',()=>{
  const storage=memory();
  const c=makeC(storage);
  c.setRecipeIds(['egg-fried-rice','tomato-egg-rice']);
  const list=c.getShoppingList();
  assert.equal(list.filter(x=>x.ingredientId==='rice').length,1);
  assert.equal(list.find(x=>x.ingredientId==='rice').amount,360);
  assert.equal(list.find(x=>x.ingredientId==='egg').amount,5);
  c.setPantryQuantity('egg',2,'each');
  assert.equal(c.getShoppingList().find(x=>x.ingredientId==='egg').amount,3);
  const afterReload=makeC(storage).getShoppingList();
  assert.equal(afterReload.find(x=>x.ingredientId==='egg').amount,3);
  assert.equal(afterReload.find(x=>x.ingredientId==='rice').amount,360);
});

test('unmatched B ingredients remain on the list and only matched products contribute to partial subtotal',()=>{
  const c=makeC();
  c.setRecipeIds(['mapo-tofu']);
  const summary=c.getBudgetSummary('mapo-tofu');
  const list=c.getShoppingList();
  assert.ok(Number.isNaN(summary.totalGBP));
  assert.ok(Number.isFinite(summary.knownSubtotalGBP));
  assert.ok(summary.missingItems.length>0);
  assert.ok(list.some(item=>item.unmatched));
  assert.ok(list.filter(item=>item.unmatched).every(item=>item.costGBP===null));
});

test('B budget recommendation can select a feasible recipe, and reroll excludes the previous pick',()=>{
  const c=makeC();
  const first=c.recommendWithinBudget({budgetGBP:100,random:()=>0});
  assert.equal(first.ok,true);
  assert.equal(first.recipe.id,'egg-fried-rice');
  const next=c.recommendWithinBudget({budgetGBP:100,excludeRecipeIds:[first.recipe.id],random:()=>0});
  assert.equal(next.ok,true);
  assert.notEqual(next.recipe.id,first.recipe.id);
  const none=c.recommendWithinBudget({budgetGBP:0});
  assert.equal(none.ok,false);
  assert.equal(none.reason,'no-recipe-within-budget');
});

test('deleted custom recipe IDs are ignored instead of leaving ghost shopping items',()=>{
  const storage=memory();
  storage.setItem('tonight-what-c-state-v1',JSON.stringify({recipeIds:['d-custom-recipe-that-was-deleted']}));
  const c=createCModule({getRecipes:()=>getRecipes(),getIngredients,getProducts,getSubstitutions,storage});
  assert.deepEqual(c.getShoppingList(),[]);
  assert.equal(makeC(storage).getShoppingList().length,0);
});

test('custom recipes with compatible units merge with B needs; unknown units stay unpriced',()=>{
  const custom={id:'custom-rice',nameZh:'自定义米饭',ingredients:[{ingredientId:'rice',amount:0.2,unit:'kg'}]};
  const c=createCModule({getRecipes:()=>[...getRecipes(),custom],getIngredients,getProducts,getSubstitutions,storage:memory()});
  c.setRecipeIds(['egg-fried-rice','custom-rice']);
  assert.equal(c.getShoppingList().find(x=>x.ingredientId==='rice').requiredAmount,380);

  const ambiguous={id:'custom-cup-rice',nameZh:'杯量米饭',ingredients:[{ingredientId:'rice',amount:1,unit:'cup'}]};
  const customC=createCModule({getRecipes:()=>[ambiguous],getIngredients,getProducts,getSubstitutions,storage:memory()});
  customC.setRecipeIds(['custom-cup-rice']);
  const row=customC.getShoppingList().find(x=>x.ingredientId==='rice');
  assert.equal(row.unmatched,true);
  assert.equal(row.costGBP,null);
  assert.ok(Number.isNaN(customC.getBudgetSummary('custom-cup-rice').totalGBP));
});
