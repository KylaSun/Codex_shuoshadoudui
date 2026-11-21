// Integrated from origin/feature/c-pantry-shopping:github-repo/src/c-module.js.
// C retains ownership of pantry, whole-pack quotes, meal plans and recommendations.
export const C_STORAGE_KEY = 'tonight-what-c-state-v1';
export const REROLL_REASONS = ['不想吃这道菜', '缺少关键食材', '想换一种口味', '其他'];
const selectionKey = (recipeId, ingredientId) => `${recipeId}:${ingredientId}`;
const finite = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value));
const positive = value => finite(value) && Number(value) > 0;
const rounded = value => Number(value.toPrecision(14));
const pounds = value => Math.round((value + Number.EPSILON) * 100) / 100;
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function unitInfo(value) {
  const unit = String(value || '').trim().toLowerCase();
  if (['g', 'gram', 'grams', '克'].includes(unit)) return {dimension: 'mass', factor: 1};
  if (['kg', 'kilogram', 'kilograms', '公斤', '千克'].includes(unit)) return {dimension: 'mass', factor: 1000};
  if (['ml', 'millilitre', 'milliliter', '毫升'].includes(unit)) return {dimension: 'volume', factor: 1};
  if (['l', 'litre', 'liter', '升'].includes(unit)) return {dimension: 'volume', factor: 1000};
  if (['each', 'pc', 'pcs', 'piece', 'pieces', '个', '枚', '颗', '只'].includes(unit)) return {dimension: 'count', factor: 1};
  return null; // Never guess spoon-to-gram, slice-to-whole, or volume-to-mass conversions.
}

function packageInfo(product) {
  if (Object.hasOwn(product, 'packQuantity') || Object.hasOwn(product, 'packUnit')) {
    const info = unitInfo(product.packUnit);
    return info && positive(product.packQuantity) ? {...info, baseAmount: Number(product.packQuantity) * info.factor} : null;
  }
  const match = String(product.packageSize || '').trim().match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pieces?|pcs?|each|个|枚|颗|只)$/i);
  const info = match && unitInfo(match[2]);
  return info && positive(match[1]) ? {...info, baseAmount: Number(match[1]) * info.factor} : null;
}

export function createCModule({getRecipes = () => [], getIngredients = () => [], getProducts = () => [],
  getSubstitutions = () => [], storage, dispatch = () => {}, today = localDay} = {}) {
  let saved = {};
  let storageError = '';
  try {
    if (!storage) throw new Error('浏览器本地存储不可用，厨房修改无法保存。');
    saved = JSON.parse(storage.getItem(C_STORAGE_KEY) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('本地厨房数据损坏，请先备份恢复。');
    for (const key of ['pantry', 'recipeIds', 'excluded']) if (saved[key] !== undefined && !Array.isArray(saved[key])) throw new Error('本地厨房数据损坏，请先备份恢复。');
  } catch (error) { saved = {}; storageError = error instanceof SyntaxError ? '本地厨房数据损坏，未覆盖原数据。' : error.message; }
  let state = {
    pantry: (saved.pantry || []).filter(x => x && typeof x.ingredientId === 'string' && positive(x.amount) && typeof x.unit === 'string'),
    recipeIds: [...new Set((saved.recipeIds || []).filter(x => typeof x === 'string'))],
    budgetGBP: finite(saved.budgetGBP) && Number(saved.budgetGBP) >= 0 ? pounds(Number(saved.budgetGBP)) : 5,
    excluded: (saved.excluded || []).filter(x => typeof x === 'string'),
    substitutions: saved.substitutions && typeof saved.substitutions === 'object' && !Array.isArray(saved.substitutions) ? saved.substitutions : {},
    recommendation: saved.recommendation && typeof saved.recommendation === 'object' ? saved.recommendation : null,
  };
  const commit = patch => {
    if (storageError) throw new Error(storageError);
    const next = {...state, ...patch};
    try { storage.setItem(C_STORAGE_KEY, JSON.stringify(next)); }
    catch { throw new Error('厨房修改未保存：本地存储不可用或空间不足，请重试。'); }
    state = next; dispatch();
  };
  const recipes = () => getRecipes();
  const ingredients = () => getIngredients();
  const name = id => ingredients().find(x => x.id === id)?.nameZh || id;
  const defaultUnit = id => {
    const canonical = ingredients().find(x => x.id === id)?.unit;
    if (canonical) return canonical === 'each' ? '个' : canonical;
    return recipes().flatMap(x => x.ingredients || []).find(x => x.ingredientId === id)?.unit || 'g';
  };
  function replacementLines(recipe, source, selected) {
    const id = selected[selectionKey(recipe.id, source.ingredientId)];
    const rule = id && getSubstitutions().find(x => x.id === id && x.recipeId === recipe.id && x.ingredientId === source.ingredientId);
    if (!rule) return [source];
    const sourceInfo = unitInfo(source.unit);
    const originalInfo = unitInfo(rule.originalUnit || source.unit);
    const scale = positive(rule.originalAmount) && sourceInfo && sourceInfo.dimension === originalInfo?.dimension
      ? Number(source.amount) * sourceInfo.factor / originalInfo.factor / Number(rule.originalAmount) : 1;
    const primary = {ingredientId: rule.replacementIngredientId, amount: Number(rule.replacementAmount) * scale, unit: rule.replacementUnit};
    const original = positive(rule.originalAmount) ? Number(rule.originalAmount) * scale : Number(source.amount);
    return [primary, ...(rule.extraReplacements || []).map(extra => ({
      ingredientId: extra.ingredientId, amount: original * Number(extra.quantityRatio), unit: defaultUnit(extra.ingredientId),
    }))];
  }
  function calculate(recipeIds = state.recipeIds, selectedSubstitutions = {}, omitted = state.excluded) {
    const selected = {...state.substitutions, ...selectedSubstitutions};
    const needs = new Map();
    const issues = [];
    for (const id of new Set(recipeIds)) {
      const recipe = recipes().find(x => x.id === id);
      if (!recipe || !recipe.ingredients?.length) {
        issues.push({key: `recipe:${id}`, ingredientId: '', nameZh: '菜谱已删除或食材不完整', recipeId: id, amount: 0, needed: 0, unit: '', costGBP: null, unmatched: true, problem: '请移除失效菜谱或补齐食材。'});
        continue;
      }
      for (const source of recipe.ingredients) for (const line of replacementLines(recipe, source, selected)) {
        const info = unitInfo(line.unit);
        const key = `${line.ingredientId}::${info?.dimension || line.unit}`;
        const row = needs.get(key) || {key, ingredientId: line.ingredientId, nameZh: name(line.ingredientId), amount: 0, unit: line.unit,
          dimension: info?.dimension, factor: info?.factor || 1, baseAmount: 0, invalid: false};
        if (!positive(line.amount) || !Number.isFinite(Number(line.amount) * (info?.factor || 1))) row.invalid = true;
        else row.baseAmount = rounded(row.baseAmount + Number(line.amount) * (info?.factor || 1));
        row.amount = rounded(row.baseAmount / row.factor);
        needs.set(key, row);
      }
    }
    const excluded = new Set(omitted);
    const rows = [...needs.values()].map(row => {
      const haveBase = state.pantry.filter(x => x.ingredientId === row.ingredientId && row.dimension && unitInfo(x.unit)?.dimension === row.dimension)
        .reduce((sum, x) => sum + Number(x.amount) * unitInfo(x.unit).factor, 0);
      const neededBase = Math.max(0, rounded(row.baseAmount - haveBase));
      const invalid = row.invalid || !row.dimension || !ingredients().some(x => x.id === row.ingredientId);
      const matches = invalid ? [] : getProducts().filter(p => p.ingredientId === row.ingredientId && finite(p.priceGBP) && Number(p.priceGBP) >= 0)
        .map(product => ({product, size: packageInfo(product)})).filter(x => x.size?.dimension === row.dimension)
        .map(x => ({...x, count: Math.ceil(rounded(neededBase / x.size.baseAmount)), cost: pounds(Math.ceil(rounded(neededBase / x.size.baseAmount)) * Number(x.product.priceGBP))}))
        .sort((a, b) => a.cost - b.cost || a.count - b.count || String(a.product.id).localeCompare(String(b.product.id)));
      const match = matches[0];
      const unmatched = invalid || (neededBase > 0 && !match);
      return {...row, have: rounded(haveBase / row.factor), needed: rounded(neededBase / row.factor),
        product: match?.product || null, packageCount: unmatched ? null : neededBase === 0 ? 0 : match.count,
        costGBP: unmatched ? null : neededBase === 0 ? 0 : match.cost, unmatched,
        problem: invalid ? '食材或单位无法核对，请修改；不自动换算个、克、毫升或汤匙。' : unmatched ? '暂无同单位的匹配参考商品，请自行核对采购。' : '',
      };
    });
    // Legacy C used ingredientId::displayUnit; keep those exclusions readable.
    return [...rows, ...issues].filter(row => !excluded.has(row.key) && !excluded.has(`${row.ingredientId}::${row.unit}`));
  }
  function quote(recipeIds, selections = {}, exclusions = []) {
    const items = calculate(recipeIds, selections, exclusions);
    const complete = !items.some(x => x.unmatched);
    const knownSubtotalGBP = pounds(items.reduce((sum, x) => sum + (x.costGBP ?? 0), 0));
    return {items, complete, totalGBP: complete ? knownSubtotalGBP : Number.NaN, knownSubtotalGBP,
      label: complete ? '已扣除已有库存，按整包参考价估算；非实时价格' : '有食材暂无匹配商品或菜谱失效，无法估算完整采购金额'};
  }
  const getPantry = () => state.pantry.map(x => ({...x}));
  function setPantryQuantity(ingredientId, amount, unit = defaultUnit(ingredientId)) {
    if (!ingredients().some(x => x.id === ingredientId) || !finite(amount) || Number(amount) < 0 || !unitInfo(unit)) throw new Error('请选择有效食材、非负库存数量和支持的单位。');
    const dimension = unitInfo(unit).dimension;
    const pantry = state.pantry.filter(x => x.ingredientId !== ingredientId || unitInfo(x.unit)?.dimension !== dimension);
    if (Number(amount) > 0) pantry.push({ingredientId, amount: Number(amount), unit});
    commit({pantry}); return getPantry();
  }
  function removePantryItem(index) { commit({pantry: state.pantry.filter((_, i) => i !== index)}); }
  function selectSubstitution({recipeId, ingredientId, substitutionId, flavourConfirmed} = {}) {
    const key = selectionKey(recipeId, ingredientId);
    if (substitutionId !== null && (flavourConfirmed !== true || !recipes().find(x => x.id === recipeId)?.ingredients.some(x => x.ingredientId === ingredientId) ||
      !getSubstitutions().some(x => x.id === substitutionId && x.recipeId === recipeId && x.ingredientId === ingredientId))) return false;
    const choices = {...state.substitutions};
    if (substitutionId === null) delete choices[key]; else choices[key] = substitutionId;
    commit({substitutions: choices}); return true;
  }
  function setRecipeIds(ids) {
    commit({recipeIds: [...new Set(ids.filter(id => recipes().some(x => x.id === id)))], excluded: []});
    return [...state.recipeIds];
  }
  function setBudgetGBP(value) {
    if (!finite(value) || Number(value) < 0) return false;
    commit({budgetGBP: pounds(Number(value))}); return true;
  }
  function recommendWithinBudget({budgetGBP = state.budgetGBP, excludeRecipeIds = [], random = Math.random} = {}) {
    if (!finite(budgetGBP) || Number(budgetGBP) < 0) return {ok: false, reason: 'invalid-budget'};
    const options = recipes().filter(x => !excludeRecipeIds.includes(x.id)).map(recipe => ({recipe, ...quote([recipe.id])})).filter(x => x.complete);
    const feasible = options.filter(x => x.totalGBP <= Number(budgetGBP));
    if (!feasible.length) {
      const cheapest = options.sort((a, b) => a.totalGBP - b.totalGBP)[0];
      return {ok: false, reason: 'no-recipe-within-budget', budgetGBP: Number(budgetGBP), closest: cheapest ? {recipe: cheapest.recipe, costGBP: cheapest.totalGBP} : null};
    }
    const picked = feasible[Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * feasible.length)];
    return {ok: true, recipe: picked.recipe, items: picked.items, costGBP: picked.totalGBP};
  }
  function requestRecommendation({reason = '', random = Math.random} = {}) {
    const previous = state.recommendation?.day === today() ? state.recommendation : null;
    if (previous && !REROLL_REASONS.includes(reason)) return {ok: false, reason: 'reroll-reason-required'};
    const result = recommendWithinBudget({excludeRecipeIds: previous ? [previous.recipeId] : [], random});
    if (result.ok) commit({recommendation: {day: today(), recipeId: result.recipe.id, reason: previous ? reason : ''}});
    return result;
  }
  function saveShoppingPlan({recipeIds, excluded = [], budgetGBP}) {
    if (!Array.isArray(recipeIds) || !Array.isArray(excluded) || !finite(budgetGBP) || Number(budgetGBP) < 0) throw new Error('请填写有效预算并选择菜谱。');
    const result = quote(recipeIds, {}, excluded);
    if (!result.complete) return {ok: false, reason: 'unmatched', ...result};
    if (result.totalGBP > pounds(Number(budgetGBP))) return {ok: false, reason: 'over-budget', ...result};
    commit({recipeIds: [...new Set(recipeIds)], excluded: [...new Set(excluded)], budgetGBP: pounds(Number(budgetGBP))});
    return {ok: true, ...result};
  }
  return {
    getPantry, setPantryQuantity, removePantryItem, defaultUnit, selectSubstitution, setRecipeIds, setBudgetGBP,
    calculateShoppingList: calculate, quoteShoppingPlan: (ids, excluded = []) => quote(ids, {}, excluded), saveShoppingPlan,
    getBudgetSummary: (id, selected = {}) => quote([id], selected),
    getShoppingList: () => calculate().filter(x => x.needed > 0 || x.unmatched).map(x => ({...x, amount: x.needed, haveAmount: x.have, requiredAmount: x.amount})),
    getShoppingSummary: () => quote(state.recipeIds, {}, state.excluded),
    getSelectedSubstitutions: () => ({...state.substitutions}), getBudget: () => state.budgetGBP,
    getKitchenState: () => ({...state, pantry: getPantry(), recipeIds: [...state.recipeIds], excluded: [...state.excluded], substitutions: {...state.substitutions},
      recommendation: state.recommendation?.day === today() ? {...state.recommendation} : null, storageError}),
    recommendWithinBudget, requestRecommendation,
  };
}
