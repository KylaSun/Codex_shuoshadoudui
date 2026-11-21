// Module D owns only this local store. B/C adapters are never registered or replaced here.
export const CUSTOM_RECIPES_KEY = 'hometaste.custom-recipes.v1';

const text = value => typeof value === 'string' ? value.trim() : '';
const positive = value => (typeof value === 'number' || typeof value === 'string') &&
  String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0;

function normalizeRecipe(input, catalog) {
  if (!input || !text(input.nameZh)) throw new Error('请填写中文菜名。');
  if (!positive(input.timeMinutes)) throw new Error('烹饪时间必须是大于 0 的分钟数。');
  if (!Array.isArray(input.ingredients) || !input.ingredients.length) throw new Error('请至少选择一种食材。');
  const ids = catalog && new Set(catalog.map(item => item.id));
  const seen = new Set();
  const ingredients = input.ingredients.map(item => {
    if (!text(item?.ingredientId) || (ids && !ids.has(item.ingredientId))) {
      throw new Error('请选择现有食材库中的食材；食材库可能已更新。');
    }
    if (seen.has(item.ingredientId)) throw new Error('同一种食材请合并为一行。');
    seen.add(item.ingredientId);
    if (!positive(item.amount)) throw new Error('每种食材的数量必须大于 0。');
    if (!text(item.unit)) throw new Error('请填写每种食材的单位。');
    return {ingredientId: item.ingredientId, amount: Number(item.amount), unit: text(item.unit)};
  });
  if (!Array.isArray(input.steps) || !input.steps.length || input.steps.some(step => !text(step))) {
    throw new Error('请填写每个制作步骤，至少保留一步。');
  }
  return {
    nameZh: text(input.nameZh),
    ...(text(input.nameEn) ? {nameEn: text(input.nameEn)} : {}),
    timeMinutes: Number(input.timeMinutes), ingredients, steps: input.steps.map(text),
  };
}

function readStore() {
  const storage = globalThis.window?.localStorage;
  if (!storage) throw new Error('浏览器本地存储不可用，请允许本站使用本地存储后重试。');
  const raw = storage.getItem(CUSTOM_RECIPES_KEY);
  if (raw === null) return [];
  let saved;
  try { saved = JSON.parse(raw); } catch { throw new Error('本地菜谱数据损坏，未覆盖原数据。请先备份或恢复本地存储。'); }
  if (saved?.version !== 1 || !Array.isArray(saved.recipes)) throw new Error('无法读取此版本的本地菜谱，未覆盖原数据。');
  const seen = new Set();
  return saved.recipes.map(recipe => {
    if (!text(recipe?.id).startsWith('custom-') || seen.has(recipe.id)) throw new Error('本地菜谱 ID 无效，未覆盖原数据。');
    seen.add(recipe.id);
    // Keep references to ingredients that B may have temporarily removed.
    return {id: recipe.id, ...normalizeRecipe(recipe)};
  });
}

export function inspectCustomRecipes() {
  try { return {recipes: readStore(), error: ''}; }
  catch (error) { return {recipes: [], error: error.message || '无法读取本地菜谱。'}; }
}

export function listCustomRecipes() { return inspectCustomRecipes().recipes; }

function persist(recipes) {
  try { window.localStorage.setItem(CUSTOM_RECIPES_KEY, JSON.stringify({version: 1, recipes})); }
  catch { throw new Error('未能保存：本地存储不可用或空间不足。请保留表单内容并重试。'); }
  window.dispatchEvent(new Event('dinner:adapters-updated'));
}

export function createCustomRecipe(input, catalog) {
  if (!Array.isArray(catalog)) throw new Error('请先加载食材库。');
  const recipe = normalizeRecipe(input, catalog);
  const recipes = readStore();
  const id = `custom-${globalThis.crypto.randomUUID()}`;
  if (recipes.some(item => item.id === id)) throw new Error('菜谱 ID 冲突，请重试。');
  const created = {id, ...recipe};
  persist([...recipes, created]);
  return created;
}

export function updateCustomRecipe(id, input, catalog) {
  if (!Array.isArray(catalog)) throw new Error('请先加载食材库。');
  const recipes = readStore();
  const index = recipes.findIndex(recipe => recipe.id === id);
  if (index < 0) throw new Error('这道自定义菜谱已不存在，请返回列表。');
  const updated = {id, ...normalizeRecipe(input, catalog)};
  recipes[index] = updated;
  persist(recipes);
  return updated;
}

export function deleteCustomRecipe(id) {
  const recipes = readStore();
  if (!recipes.some(recipe => recipe.id === id)) throw new Error('这道自定义菜谱已不存在，请返回列表。');
  persist(recipes.filter(recipe => recipe.id !== id));
}

export function mergeCustomRecipes(baseRecipes) {
  // An upstream collision never replaces B's recipe or mutates B's array.
  const ids = new Set(baseRecipes.map(recipe => recipe.id));
  return [...baseRecipes, ...listCustomRecipes().filter(recipe => !ids.has(recipe.id))];
}
