import { ingredients, products, recipes, substitutions, getFeaturedRegionalRecipes, getFeaturedSpecialtyRecipes, getFeaturedViralRecipes, getIngredients, getProducts, getProductSearchKeywords, getRecipes, getRecipeById, getSubstitutions, resolveSubstitution, searchCatalog, setCustomRecipeProvider } from './catalog.ts';

const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const unique = (items, label) => {
  const ids = items.map(x => x.id);
  check(new Set(ids).size === ids.length, `${label}: duplicate id`);
};
for (const [label, items] of [['ingredients', ingredients], ['recipes', recipes], ['substitutions', substitutions], ['products', products]]) unique(items, label);

const ingredientIds = new Set(ingredients.map(x => x.id));
const recipeIds = new Set(recipes.map(x => x.id));
const referencedIngredientIds = new Set([
  ...recipes.flatMap(recipe => recipe.ingredients.map(line => line.ingredientId)),
  ...substitutions.flatMap(rule => [rule.ingredientId, rule.replacementId, ...(rule.extraReplacements ?? []).map(extra => extra.ingredientId)]),
  ...products.map(product => product.ingredientId),
]);
const normalizedNames = new Set();
for (const ingredient of ingredients) {
  check(referencedIngredientIds.has(ingredient.id), `orphan ingredient: ${ingredient.id}`);
  const name = ingredient.nameZh.trim().toLowerCase();
  check(!normalizedNames.has(name), `duplicate ingredient name: ${name}`);
  normalizedNames.add(name);
  check(['g', 'ml', 'each'].includes(ingredient.unit), `invalid unit: ${ingredient.id}`);
  check(ingredient.nameEn.trim() && ingredient.usage.trim(), `missing ingredient metadata: ${ingredient.id}`);
  check(getProductSearchKeywords(ingredient.id).length > 0, `missing product search keyword: ${ingredient.id}`);
}
for (const recipe of recipes) {
  check(recipe.servings > 0 && recipe.minutes > 0 && recipe.steps.length >= 2, `incomplete recipe: ${recipe.id}`);
  check(new Set(recipe.ingredients.map(x => x.ingredientId)).size === recipe.ingredients.length, `duplicate recipe ingredient: ${recipe.id}`);
  for (const line of recipe.ingredients) {
    check(ingredientIds.has(line.ingredientId), `unknown ingredient: ${recipe.id}/${line.ingredientId}`);
    check(Number.isFinite(line.quantity) && line.quantity > 0, `invalid quantity: ${recipe.id}/${line.ingredientId}`);
    if (recipe.demoReady) check(getProducts(line.ingredientId, 'Tesco').length > 0, `missing Tesco match: ${recipe.id}/${line.ingredientId}`);
  }
}
for (const swap of substitutions) {
  check(ingredientIds.has(swap.ingredientId) && ingredientIds.has(swap.replacementId), `unknown substitution ingredient: ${swap.id}`);
  check(swap.ingredientId !== swap.replacementId && swap.quantityRatio > 0, `invalid substitution quantity: ${swap.id}`);
  check(swap.context.trim() && swap.quantityAdvice.trim() && swap.tasteDifference.trim(), `incomplete substitution: ${swap.id}`);
  check(swap.recipeIds.length > 0, `substitution missing context: ${swap.id}`);
  const replacementIds = [swap.replacementId, ...(swap.extraReplacements ?? []).map(x => x.ingredientId)];
  check(new Set(replacementIds).size === replacementIds.length, `duplicate replacement component: ${swap.id}`);
  for (const extra of swap.extraReplacements ?? []) check(ingredientIds.has(extra.ingredientId) && extra.quantityRatio > 0, `invalid extra replacement: ${swap.id}/${extra.ingredientId}`);
  for (const id of swap.recipeIds) {
    const recipe = recipes.find(x => x.id === id);
    check(recipeIds.has(id) && recipe?.ingredients.some(x => x.ingredientId === swap.ingredientId), `substitution not applicable: ${swap.id}/${id}`);
    for (const replacementId of replacementIds) check(!recipe?.ingredients.some(x => x.ingredientId === replacementId), `substitution duplicates recipe ingredient: ${swap.id}/${id}/${replacementId}`);
    if (recipe) {
      const line = recipe.ingredients.find(x => x.ingredientId === swap.ingredientId);
      const resolved = resolveSubstitution(line, swap);
      check(resolved.length === replacementIds.length && resolved.every(x => Number.isFinite(x.quantity) && x.quantity > 0), `invalid resolved amounts: ${swap.id}/${id}`);
    }
  }
}
for (const product of products) {
  check(ingredientIds.has(product.ingredientId), `unknown product ingredient: ${product.id}`);
  check(product.packUnit === ingredients.find(x => x.id === product.ingredientId)?.unit, `product unit mismatch: ${product.id}`);
  check(product.packQuantity > 0 && product.priceGbp > 0, `invalid product quantity/price: ${product.id}`);
  check(/^202\d-\d\d-\d\d$/.test(product.priceRecordedOn), `invalid product date: ${product.id}`);
  const domain = product.supermarket === 'Tesco' ? 'www.tesco.com' : 'www.sainsburys.co.uk';
  check(product.productUrl.startsWith(`https://${domain}/`) && product.productUrl.includes('/product'), `invalid direct product link: ${product.id}`);
}
check(recipes.length >= 20, 'fewer than 20 recipes');
check(recipes.filter(x => x.demoReady).length >= 5, 'fewer than five complete demo recipes');
check(products.some(x => x.supermarket === 'Tesco') && products.some(x => x.supermarket === 'Sainsburys'), 'missing supermarket');
check(getRecipes().length === recipes.length && getIngredients().length === ingredients.length, 'integration catalog exports failed');
check(getProducts().length === products.length && getSubstitutions().length === substitutions.length, 'integration list exports failed');
const customRecipe = { ...recipes[0], id: 'custom-smoke', nameZh: '测试自定义炒饭', source: 'custom' };
setCustomRecipeProvider(() => [customRecipe]);
check(getRecipes().length === recipes.length + 1 && getRecipeById(customRecipe.id)?.nameZh === customRecipe.nameZh && searchCatalog('测试自定义').recipes.length === 1, 'custom recipe integration failed');
setCustomRecipeProvider();
check(searchCatalog('鸡蛋').recipes.length > 0 && searchCatalog('鸡蛋').ingredients.length > 0, 'Chinese search failed');
check(searchCatalog('chicken').ingredients.some(x => x.id === 'chicken'), 'English search failed');
check(getSubstitutions('chicken-broccoli-noodles', 'chicken').some(x => x.replacementId === 'tofu'), 'demo substitution missing');
check(getSubstitutions('egg-fried-rice', 'rice').length === 0, 'invalid rice substitution offered for fried rice');
// User-path smoke test for B's contract: find dinner, choose a contextual swap,
// resolve its revised quantity to a purchasable pack, and handle a catalog miss.
const dinner = searchCatalog('鸡肉西兰花炒面').recipes[0];
const chickenLine = dinner?.ingredients.find(x => x.ingredientId === 'chicken');
const tofuSwap = getSubstitutions(dinner?.id, 'chicken').find(x => x.replacementId === 'tofu');
const replacementAmount = (chickenLine?.quantity ?? 0) * (tofuSwap?.quantityRatio ?? 0);
const tofuPack = getProducts('tofu', 'Tesco')[0];
check(replacementAmount === 250 && tofuPack && Math.ceil(replacementAmount / tofuPack.packQuantity) === 1, 'swap-to-product user path failed');
check(getProducts('pepper', 'Tesco').length === 0 && ingredients.find(x => x.id === 'pepper')?.nameEn && getProductSearchKeywords('pepper').length > 0, 'missing-product fallback failed');
const regional = getFeaturedRegionalRecipes();
check(regional.length === 16 && new Set(regional.map(x => x.id)).size === 16 && new Set(regional.map(x => x.region)).size >= 12, 'regional recipe collection incomplete');
for (const recipe of regional) {
  check(recipe.inspirationUrls?.length && searchCatalog(recipe.nameZh).recipes.some(x => x.id === recipe.id), `regional recipe search/source failed: ${recipe.id}`);
}
check(searchCatalog('武汉').recipes.some(x => x.id === 'wuhan-sesame-noodles') && searchCatalog('云南').recipes.some(x => x.id === 'yunnan-small-pot-rice-noodles'), 'region name search failed');
for (const id of [
  'sichuan-fish-fragrant-pork', 'hunan-pork-pepper', 'chongqing-suan-la-fen',
  'guangdong-lap-cheong-rice', 'xiamen-fried-vermicelli', 'yangzhou-fried-rice',
  'xinjiang-big-plate-chicken', 'nanchang-mixed-rice-noodles', 'dongbei-guo-bao-rou',
  'shanghai-red-braised-pork',
]) check(regional.some(recipe => recipe.id === id), `new regional recipe missing: ${id}`);
for (const id of ['chickpea-tomato-stew', 'tuna-tomato-pasta', 'potato-egg-hash', 'garlic-spinach-pasta', 'tuna-spinach-rice', 'carrot-chickpea-pasta', 'potato-chickpea-stew', 'carrot-egg-rice', 'peas-egg-rice', 'ginger-tofu-broccoli-rice', 'pepper-chicken-noodles', 'cabbage-tofu-noodles', 'mushroom-tofu-rice']) {
  check(!getRecipeById(id), `retired generic recipe remains: ${id}`);
}
const hunanLine = getRecipeById('hunan-pork-pepper')?.ingredients.find(line => line.ingredientId === 'hot_green_pepper');
const hunanSwap = getSubstitutions('hunan-pork-pepper', 'hot_green_pepper')[0];
const hunanReplacement = hunanLine && hunanSwap && resolveSubstitution(hunanLine, hunanSwap);
check(hunanReplacement?.length === 2 && hunanReplacement[0].ingredientId === 'pepper' && hunanReplacement[0].quantity === 220 && hunanReplacement[1].ingredientId === 'chilli_flakes' && hunanReplacement[1].quantity === 3.3, 'Hunan combined alternative failed');
check(getSubstitutions('chongqing-suan-la-fen', 'sweet_potato_noodles').some(x => x.replacementId === 'rice_noodles') && getSubstitutions('guangdong-lap-cheong-rice', 'chinese_sausage').length === 0, 'regional substitute boundary failed');
check(getProducts('chinese_sausage').length === 0 && getProductSearchKeywords('chinese_sausage').length > 0, 'regional unmatched product fallback failed');
const viral = getFeaturedViralRecipes();
check(viral.length === 4 && new Set(viral.map(recipe => recipe.id)).size === 4, 'viral collection incomplete');
for (const recipe of viral) check(recipe.inspirationUrls?.length && searchCatalog(recipe.nameZh).recipes.some(result => result.id === recipe.id), `viral source/search failed: ${recipe.id}`);
check(searchCatalog('公瑾').recipes.some(recipe => recipe.id === 'gongjin-burst-eggs') && searchCatalog('雪碧').recipes.some(recipe => recipe.id === 'sprite-chilli-noodles'), 'viral Chinese search failed');
check(getProducts('white_vinegar').length === 0 && getSubstitutions('gongjin-burst-eggs', 'white_vinegar').some(rule => rule.replacementId === 'cider_vinegar'), 'white vinegar honest fallback failed');
for (const [recipeId, selectedRules] of [
  ['gongjin-burst-eggs', ['gongjin-white-to-cider-vinegar']],
  ['sprite-chilli-noodles', ['viral-black-vinegar-to-malt', 'sprite-sesame-to-tahini']],
  ['egg-skirt-dumplings', ['viral-black-vinegar-to-malt']],
  ['cola-chicken-wings', []],
]) {
  const recipe = getRecipeById(recipeId);
  const basket = recipe?.ingredients.flatMap(line => {
    const rule = getSubstitutions(recipeId, line.ingredientId).find(option => selectedRules.includes(option.id));
    return rule ? resolveSubstitution(line, rule) : [line];
  });
  check(basket?.every(line => getProducts(line.ingredientId, 'Tesco').length > 0), `viral complete Tesco basket failed: ${recipeId}`);
  const checkout = basket?.reduce((total, line) => {
    const product = getProducts(line.ingredientId, 'Tesco')[0];
    return total + (product ? Math.ceil(line.quantity / product.packQuantity) * product.priceGbp : 0);
  }, 0);
  check(Number.isFinite(checkout) && checkout > 0, `viral whole-pack checkout failed: ${recipeId}`);
}
const dumplingPack = getProducts('frozen_dumplings', 'Tesco')[0];
check(dumplingPack?.packUnit === 'each' && Math.ceil(16 / dumplingPack.packQuantity) === 2, 'dumpling two-pack checkout failed');
const shanghai = getRecipeById('shanghai-scallion-oil-noodles');
check(shanghai?.ingredients.every(line => getProducts(line.ingredientId, 'Tesco').length > 0), 'Shanghai regional dinner has incomplete Tesco basket');
const shanghaiCheckout = shanghai?.ingredients.reduce((total, line) => {
  const product = getProducts(line.ingredientId, 'Tesco')[0];
  return total + Math.ceil(line.quantity / product.packQuantity) * product.priceGbp;
}, 0);
check(Number.isFinite(shanghaiCheckout) && shanghaiCheckout > 0, 'Shanghai regional whole-pack checkout failed');
for (const [recipeId, ingredientId, replacementId] of [
  ['wuhan-sesame-noodles', 'sesame_paste', 'tahini'],
  ['yunnan-small-pot-rice-noodles', 'yunnan_pickles', 'kimchi'],
  ['sichuan-kung-pao-chicken', 'chinkiang_vinegar', 'malt_vinegar'],
]) {
  const rule = getSubstitutions(recipeId, ingredientId).find(x => x.replacementId === replacementId);
  const line = getRecipeById(recipeId)?.ingredients.find(x => x.ingredientId === ingredientId);
  check(rule?.sourceUrls?.length && line && resolveSubstitution(line, rule)[0]?.quantity > 0 && getProducts(replacementId, 'Tesco').length > 0, `regional replacement path failed: ${recipeId}`);
}
const mapo = recipes.find(x => x.id === 'mapo-tofu');
const doubanSwap = getSubstitutions('mapo-tofu', 'doubanjiang')[0];
const mapoReplacement = resolveSubstitution(mapo.ingredients.find(x => x.ingredientId === 'doubanjiang'), doubanSwap);
check(mapoReplacement.length === 2 && mapoReplacement[0].ingredientId === 'miso' && mapoReplacement[0].quantity === 20 && mapoReplacement[1].ingredientId === 'chilli_paste' && mapoReplacement[1].quantity === 5, 'compound Chinese seasoning substitution failed');
check(mapoReplacement.every(x => getProducts(x.ingredientId, 'Tesco').length > 0), 'compound substitution product coverage failed');
const mapoChoices = new Map([
  ['doubanjiang', 'doubanjiang-to-miso-chilli-mapo'],
  ['garlic', 'fresh-garlic-to-paste-mapo'],
]);
const mapoBasket = mapo.ingredients.flatMap(line => {
  const selectedId = mapoChoices.get(line.ingredientId);
  return selectedId ? resolveSubstitution(line, substitutions.find(x => x.id === selectedId)) : [line];
});
check(mapoBasket.some(line => line.ingredientId === 'sichuan_pepper') && getSubstitutions('mapo-tofu', 'sichuan_pepper').length === 0, 'Sichuan pepper must remain an explicit unmatched ingredient');
check(getFeaturedSpecialtyRecipes().length === 8, 'specialty recipe showcase failed');
for (const [recipeId, ingredientId, replacementId] of [
  ['mapo-tofu', 'doubanjiang', 'gochujang'],
  ['sour-spicy-potatoes', 'chinkiang_vinegar', 'malt_vinegar'],
  ['sweet-bean-pork-noodles', 'sweet_bean_sauce', 'hoisin_sauce'],
  ['shiitake-chicken-noodles', 'dried_shiitake', 'fresh_shiitake'],
  ['preserved-mustard-tofu-soup', 'preserved_mustard', 'sauerkraut'],
]) {
  const rule = getSubstitutions(recipeId, ingredientId).find(x => x.replacementId === replacementId);
  check(rule?.sourceUrls?.length && rule.suitability && getProducts(replacementId, 'Tesco').length, `sourced UK alternative missing: ${replacementId}`);
}
check(getSubstitutions('sour-spicy-potatoes', 'chinkiang_vinegar')[0]?.replacementId === 'malt_vinegar', 'better sourced vinegar option must appear first');
check(getSubstitutions('sweet-bean-pork-noodles', 'sweet_bean_sauce')[0]?.replacementId === 'hoisin_sauce', 'better sourced sauce option must appear first');
check(getSubstitutions('shiitake-chicken-noodles', 'dried_shiitake')[0]?.replacementId === 'fresh_shiitake', 'fresh shiitake must appear before generic mushroom');
const mapoCheckout = mapoBasket.reduce((total, line) => {
  const product = getProducts(line.ingredientId, 'Tesco')[0];
  return total + (product ? Math.ceil(line.quantity / product.packQuantity) * product.priceGbp : 0);
}, 0);
check(Number.isFinite(mapoCheckout) && mapoCheckout > 0, 'Chinese-ingredient replacement checkout failed');
const specialtyPaths = [
  ['garlic-shoot-pork-rice', { garlic_shoots: 'garlic-shoots-to-spring-onion-garlic' }],
  ['chive-egg-rice', { chinese_chives: 'chinese-chives-to-spring-onion-garlic' }],
  ['shiitake-chicken-noodles', { dried_shiitake: 'shiitake-to-fresh-shiitake-soup' }],
  ['sweet-bean-pork-noodles', { sweet_bean_sauce: 'sweet-bean-to-hoisin-noodles' }],
];
for (const [recipeId, choices] of specialtyPaths) {
  const recipe = recipes.find(x => x.id === recipeId);
  const basket = recipe.ingredients.flatMap(line => {
    const swapId = choices[line.ingredientId];
    return swapId ? resolveSubstitution(line, substitutions.find(x => x.id === swapId)) : [line];
  });
  check(basket.every(line => getProducts(line.ingredientId, 'Tesco').length > 0), `specialty demo checkout incomplete: ${recipeId}`);
}
for (const id of ['mapo-tofu', 'garlic-shoot-pork-rice', 'chive-egg-rice', 'zhacai-chicken-noodles', 'sour-spicy-potatoes', 'shiitake-chicken-noodles', 'sweet-bean-pork-noodles', 'preserved-mustard-tofu-soup']) {
  check(substitutions.some(x => x.recipeIds.includes(id)), `specialty recipe has no contextual swap: ${id}`);
}
const porkSwap = getSubstitutions('pork-tomato-noodles', 'pork_mince').find(x => x.replacementId === 'tofu');
check(porkSwap && 250 * porkSwap.quantityRatio === 300 && Math.ceil(300 / tofuPack.packQuantity) === 2, 'new recipe two-pack substitution failed');
const gingerSwap = getSubstitutions('ginger-chicken-rice', 'ginger').find(x => x.replacementId === 'garlic');
check(gingerSwap && 12 * gingerSwap.quantityRatio === 9 && getProductSearchKeywords('garlic').length > 0, 'new recipe missing-product substitution failed');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Catalog valid: ${recipes.length} recipes, ${ingredients.length} ingredients, ${substitutions.length} contextual substitutions, ${products.length} products.`);
}
