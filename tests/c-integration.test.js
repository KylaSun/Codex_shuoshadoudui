import test from 'node:test';
import assert from 'node:assert/strict';
import {createCModule} from '../src/c-module.js';
import {getRecipes,getIngredients,getProducts,getSubstitutions} from '../src/team-adapters.js';

const memory=()=>({value:null,getItem(){return this.value},setItem(_key,value){this.value=value}});
const makeC=(storage=memory())=>createCModule({getRecipes,getIngredients,getProducts,getSubstitutions,storage});

test('C calculates current B recipes from canonical pack quantities',()=>{
  const c=makeC();
  assert.equal(getRecipes().length,47);
  assert.equal(getProducts().length,42);
  const quote=c.getBudgetSummary('egg-fried-rice');
  assert.ok(Number.isFinite(quote.totalGBP));
  assert.ok(quote.totalGBP>0);
  const incomplete=c.getBudgetSummary('mapo-tofu');
  assert.ok(Number.isNaN(incomplete.totalGBP));
  assert.match(incomplete.label,/无法估算完整采购金额/);
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
