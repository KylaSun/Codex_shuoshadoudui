import test from 'node:test';
import assert from 'node:assert/strict';
import { createCModule } from '../src/c-module.js';
const ingredients=[{id:'egg',nameZh:'鸡蛋'},{id:'rice',nameZh:'米饭'},{id:'milk',nameZh:'牛奶'},{id:'pasta',nameZh:'意面'},{id:'cheese',nameZh:'奶酪'},{id:'noodle',nameZh:'面条'}];
const recipes=[
 {id:'rice-bowl',nameZh:'鸡蛋饭',ingredients:[{ingredientId:'egg',amount:2,unit:'个'},{ingredientId:'rice',amount:150,unit:'g'}]},
 {id:'pasta',nameZh:'奶油意面',ingredients:[{ingredientId:'pasta',amount:100,unit:'g'},{ingredientId:'cheese',amount:30,unit:'g'}]}
];
const products=[
 {id:'egg-box',ingredientId:'egg',nameEn:'6 eggs',supermarket:'Tesco',packageSize:'6 pcs',priceGBP:1.8,recordedAt:'2026-11-01',url:'https://example.test/egg'},
 {id:'rice-bag',ingredientId:'rice',nameEn:'Rice 1kg',supermarket:'Tesco',packageSize:'1 kg',priceGBP:1.4,recordedAt:'2026-11-01',url:'https://example.test/rice'},
 {id:'pasta-bag',ingredientId:'pasta',nameEn:'Pasta 500g',supermarket:'Tesco',packageSize:'500 g',priceGBP:1,recordedAt:'2026-11-01',url:'https://example.test/pasta'},
 {id:'cheese-pack',ingredientId:'cheese',nameEn:'Cheese 200g',supermarket:'Sainsbury’s',packageSize:'200 g',priceGBP:2,recordedAt:'2026-11-01',url:'https://example.test/cheese'},
 {id:'milk-bottle',ingredientId:'milk',nameEn:'Milk 1L',supermarket:'Sainsbury’s',packageSize:'1 L',priceGBP:1.3,recordedAt:'2026-11-01',url:'https://example.test/milk'},
 {id:'noodles',ingredientId:'noodle',nameEn:'Noodles 400g',supermarket:'Tesco',packageSize:'400 g',priceGBP:0.9,recordedAt:'2026-11-01',url:'https://example.test/noodles'}
];
const substitutions=[{id:'milk-for-cheese',recipeId:'pasta',ingredientId:'cheese',replacementIngredientId:'milk',replacementAmount:80,replacementUnit:'ml',flavourNote:'奶味更轻。',equivalent:false}];
function fixture(storage={value:null,getItem(){return this.value},setItem(_k,v){this.value=v}}){const c=createCModule({getRecipes:()=>recipes,getIngredients:()=>ingredients,getProducts:()=>products,getSubstitutions:()=>substitutions,storage});return {c,storage};}
test('getPantry and editing persist quantities locally',()=>{const {c,storage}=fixture();c.setPantryQuantity('egg',2,'个');assert.deepEqual(c.getPantry(),[{ingredientId:'egg',amount:2,unit:'个'}]);const restored=fixture(storage).c;assert.equal(restored.getPantry()[0].amount,2);});
test('budget quote subtracts pantry stock and uses whole product packs',()=>{const {c}=fixture();let quote=c.getBudgetSummary('rice-bowl');assert.equal(quote.totalGBP,3.2);c.setPantryQuantity('egg',2,'个');quote=c.getBudgetSummary('rice-bowl');assert.equal(quote.totalGBP,1.4);});
test('confirmed substitute changes list quantity, matched product and cost',()=>{const {c}=fixture();c.setRecipeIds(['pasta']);assert.equal(c.selectSubstitution({recipeId:'pasta',ingredientId:'cheese',substitutionId:'milk-for-cheese',flavourConfirmed:false}),false);assert.equal(c.selectSubstitution({recipeId:'pasta',ingredientId:'cheese',substitutionId:'milk-for-cheese',flavourConfirmed:true}),true);const list=c.getShoppingList();assert.equal(list.some(x=>x.ingredientId==='cheese'),false);const milk=list.find(x=>x.ingredientId==='milk');assert.equal(milk.amount,80);assert.equal(milk.costGBP,1.3);assert.equal(c.getBudgetSummary('pasta').totalGBP,2.3);});
test('shopping list merges items and persists selected recipes',()=>{const {c,storage}=fixture();c.setRecipeIds(['rice-bowl','pasta']);const list=c.getShoppingList();assert.equal(list.length,4);assert.ok(list.some(x=>x.ingredientId==='rice'));const restored=fixture(storage).c;assert.deepEqual(restored.getShoppingList().map(x=>x.ingredientId),list.map(x=>x.ingredientId));});
test('unmatched products are reported rather than assigned invented prices',()=>{const noProducts=createCModule({getRecipes:()=>recipes,getIngredients:()=>ingredients,getProducts:()=>[],getSubstitutions:()=>[],storage:{getItem:()=>null,setItem:()=>{}}});const quote=noProducts.getBudgetSummary('rice-bowl');assert.ok(Number.isNaN(quote.totalGBP));assert.match(quote.label,/暂无匹配商品/);assert.ok(noProducts.getShoppingList().every(x=>x.unmatched));});

test('budget random recommendation filters unmatched and over-budget meals',()=>{const {c}=fixture();const result=c.recommendWithinBudget({budgetGBP:3.5,random:()=>0});assert.equal(result.ok,true);assert.equal(result.recipe.id,'rice-bowl');const none=c.recommendWithinBudget({budgetGBP:0});assert.equal(none.ok,false);assert.equal(none.reason,'no-recipe-within-budget');});

test('fully stocked ingredients are omitted from the purchase list',()=>{const {c}=fixture();c.setRecipeIds(['rice-bowl']);c.setPantryQuantity('egg',2,'个');assert.equal(c.getShoppingList().some(x=>x.ingredientId==='egg'),false);});

test('blocked ingredients persist and exclude affected recipes from planning and recommendations',()=>{
  const {c,storage}=fixture();
  c.setRecipeIds(['rice-bowl','pasta']);
  assert.deepEqual(c.setBlockedIngredientIds(['egg','egg','unknown']),['egg']);
  assert.deepEqual(c.getBlockedIngredientIds(),['egg']);
  assert.deepEqual(c.getShoppingList().map(x=>x.ingredientId),['pasta','cheese']);
  assert.deepEqual(c.setRecipeIds(['rice-bowl','pasta']),['pasta']);
  assert.equal(c.recommendWithinBudget({budgetGBP:10,random:()=>0}).recipe.id,'pasta');
  assert.deepEqual(fixture(storage).c.getBlockedIngredientIds(),['egg']);
  c.setBlockedIngredientIds([]);
  assert.deepEqual(c.setRecipeIds(['rice-bowl']),['rice-bowl']);
});
