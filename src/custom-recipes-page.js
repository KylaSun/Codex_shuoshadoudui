import {getIngredients} from './data.js';
import {inspectCustomRecipes, createCustomRecipe, updateCustomRecipe, deleteCustomRecipe} from './custom-recipes.js';
import {icon} from './illustrated-icons.js';

const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const state = {draft: null, editingId: null, pendingDelete: null, error: '', notice: ''};
const blankDraft = () => ({nameZh: '', nameEn: '', timeMinutes: '', ingredients: [{ingredientId: '', amount: '', unit: 'g'}], steps: ['', '']});
const action = (name, label, extra = '') => `<button type="button" class="outline" data-custom-action="${name}" ${extra}>${label}</button>`;

function ingredientRow(item, index, catalog) {
  const missing = item.ingredientId && !catalog.some(ingredient => ingredient.id === item.ingredientId);
  return `<div class="custom-ingredient-row">
    <label>食材 ${index + 1}<select name="ingredientId" required aria-label="食材 ${index + 1}">
      <option value="">请选择食材</option>
      ${missing ? `<option value="${e(item.ingredientId)}" selected>${e(item.ingredientId)}（已不在食材库，请重新选择）</option>` : ''}
      ${catalog.map(ingredient => `<option value="${e(ingredient.id)}" ${ingredient.id === item.ingredientId ? 'selected' : ''}>${e(ingredient.nameZh)}${ingredient.nameEn ? ` / ${e(ingredient.nameEn)}` : ''}</option>`).join('')}
    </select></label>
    <label>数量<input name="amount" type="number" min="0" step="any" required value="${e(item.amount)}" aria-label="食材 ${index + 1} 数量"/></label>
    <label>单位<input name="unit" required maxlength="30" value="${e(item.unit)}" placeholder="g / ml / 个" aria-label="食材 ${index + 1} 单位"/></label>
    ${action('remove-ingredient', '移除', `data-index="${index}" aria-label="移除食材 ${index + 1}" ${state.draft.ingredients.length === 1 ? 'disabled' : ''}`)}
  </div>`;
}

function form() {
  const draft = state.draft;
  const catalog = getIngredients();
  return `<form id="custom-recipe-form" class="custom-form">
    <p class="muted">菜谱保存在当前浏览器中。中文菜名、食材、步骤和时间为必填项。</p>
    <div class="custom-name-fields">
      <label>中文菜名<input name="nameZh" required maxlength="100" value="${e(draft.nameZh)}" autocomplete="off"/></label>
      <label>英文名（可选）<input name="nameEn" maxlength="150" value="${e(draft.nameEn)}" autocomplete="off"/></label>
      <label>烹饪时间（分钟）<input name="timeMinutes" type="number" min="0" step="any" required value="${e(draft.timeMinutes)}"/></label>
    </div>
    <fieldset><legend>需要准备什么</legend>
      ${!catalog.length ? '<p class="custom-error" role="status">食材库暂无数据，请等待食材库加载后再保存。</p>' : ''}
      ${draft.ingredients.map((item, index) => ingredientRow(item, index, catalog)).join('')}
      ${action('add-ingredient', '＋ 添加食材')}
    </fieldset>
    <fieldset><legend>制作步骤</legend>
      ${draft.steps.map((step, index) => `<div class="custom-step-row"><label>步骤 ${index + 1}<textarea name="steps" rows="3" required maxlength="3000">${e(step)}</textarea></label>${action('remove-step', '移除', `data-index="${index}" aria-label="移除步骤 ${index + 1}" ${draft.steps.length === 1 ? 'disabled' : ''}`)}</div>`).join('')}
      ${action('add-step', '＋ 添加步骤')}
    </fieldset>
    <div class="custom-actions"><button class="primary" type="submit">保存菜谱 →</button>${action('cancel', '取消')}</div>
  </form>`;
}

function content() {
  const {recipes, error} = inspectCustomRecipes();
  return `<div class="overline">YOUR OWN RECIPES</div>
    <div class="section-heading custom-heading"><h1 class="page-title">${state.draft ? (state.editingId ? '编辑' : '创建') : '我的'}<span class="highlight">菜谱</span> ${icon("recipes","title-icon")}</h1>${!state.draft ? '<div class="custom-actions"><button type="button" class="primary" data-custom-action="create">＋ 创建菜谱</button></div>' : ''}</div>
    ${state.error || error ? `<p class="custom-error" role="alert" tabindex="-1">${e(state.error || error)}</p>` : ''}
    ${state.notice ? `<p class="custom-notice" role="status">${e(state.notice)}</p>` : ''}
    ${state.draft ? form() : `<p class="muted">把家常味道记下来，随时搜索、查看和修改。仅保存在当前浏览器。</p>
      ${!recipes.length ? '<div class="subtle-empty">还没有自定义菜谱，点击“创建菜谱”记录第一道拿手菜。</div>' : `<div class="recipe-grid">${recipes.map(recipe => `<article class="custom-recipe-card">
        <button type="button" class="recipe-card" data-recipe="${e(recipe.id)}" aria-label="查看 ${e(recipe.nameZh)}"><div class="food-art food-art--type custom-card-art">${icon("recipes","custom-card-icon")}</div><span class="recipe-body"><strong>${e(recipe.nameZh)}</strong><span class="en-name">${e(recipe.nameEn || '')}</span><span class="meta">约 ${e(recipe.timeMinutes)} min · 自定义菜谱</span></span></button>
        <div class="custom-card-actions">${action('edit', '编辑', `data-id="${e(recipe.id)}" aria-label="编辑 ${e(recipe.nameZh)}"`)}${action('delete', '删除', `data-id="${e(recipe.id)}" aria-label="删除 ${e(recipe.nameZh)}"`)}</div>
        ${state.pendingDelete === recipe.id ? `<div class="custom-delete-confirm" role="group" aria-label="确认删除 ${e(recipe.nameZh)}"><p>确定删除“${e(recipe.nameZh)}”？删除后无法恢复。</p>${action('confirm-delete', '确认删除', `data-id="${e(recipe.id)}"`)}${action('cancel-delete', '保留菜谱')}</div>` : ''}
      </article>`).join('')}</div>`}`}`;
}

export function customRecipesPage() {
  return `<section id="custom-recipes-page" class="inner-page custom-recipes">${content()}</section>`;
}

function capture(formElement) {
  if (!formElement || !state.draft) return;
  const data = new FormData(formElement);
  const amounts = data.getAll('amount');
  const units = data.getAll('unit');
  state.draft = {
    nameZh: data.get('nameZh'), nameEn: data.get('nameEn'), timeMinutes: data.get('timeMinutes'),
    ingredients: data.getAll('ingredientId').map((ingredientId, i) => ({ingredientId, amount: amounts[i], unit: units[i]})),
    steps: data.getAll('steps'),
  };
}

export function mountCustomRecipesPage(root) {
  const section = root.querySelector('#custom-recipes-page');
  if (!section) return;
  // Find the current section again: save emits an event that synchronously rerenders A's root.
  const redraw = focus => {
    const current = root.querySelector('#custom-recipes-page');
    if (!current) return;
    current.innerHTML = content();
    if (focus) current.querySelector(focus)?.focus();
  };
  section.addEventListener('input', event => capture(event.target.closest('form')));
  section.addEventListener('change', event => capture(event.target.closest('form')));
  section.addEventListener('click', event => {
    const button = event.target.closest('[data-custom-action]');
    if (!button) return;
    capture(section.querySelector('form'));
    const {customAction: command, id, index} = button.dataset;
    state.error = ''; state.notice = '';
    let focus;
    try {
      if (command === 'create') {
        state.draft = blankDraft(); state.editingId = null; state.pendingDelete = null; focus = '[name="nameZh"]';
      } else if (command === 'edit') {
        const recipe = inspectCustomRecipes().recipes.find(item => item.id === id);
        if (!recipe) throw new Error('菜谱已不存在，请重新选择。');
        state.draft = {...recipe, ingredients: recipe.ingredients.map(item => ({...item})), steps: [...recipe.steps]};
        state.editingId = id; state.pendingDelete = null; focus = '[name="nameZh"]';
      } else if (command === 'cancel') {
        state.draft = null; state.editingId = null; focus = '[data-custom-action="create"]';
      } else if (command === 'add-ingredient') {
        state.draft.ingredients.push({ingredientId: '', amount: '', unit: 'g'});
        focus = '.custom-ingredient-row:last-of-type select';
      } else if (command === 'remove-ingredient' && state.draft.ingredients.length > 1) {
        state.draft.ingredients.splice(Number(index), 1); focus = '[data-custom-action="add-ingredient"]';
      } else if (command === 'add-step') {
        state.draft.steps.push(''); focus = '.custom-step-row:last-of-type textarea';
      } else if (command === 'remove-step' && state.draft.steps.length > 1) {
        state.draft.steps.splice(Number(index), 1); focus = '[data-custom-action="add-step"]';
      } else if (command === 'delete') {
        state.pendingDelete = id; focus = '[data-custom-action="confirm-delete"]';
      } else if (command === 'cancel-delete') {
        state.pendingDelete = null;
      } else if (command === 'confirm-delete' && state.pendingDelete === id) {
        deleteCustomRecipe(id); state.pendingDelete = null; state.notice = '菜谱已删除。';
      }
    } catch (error) { state.error = error.message; }
    redraw(state.error ? '[role="alert"]' : focus);
  });
  section.addEventListener('submit', event => {
    if (event.target.id !== 'custom-recipe-form') return;
    event.preventDefault();
    capture(event.target);
    state.error = ''; state.notice = '';
    try {
      if (state.editingId) updateCustomRecipe(state.editingId, state.draft, getIngredients());
      else createCustomRecipe(state.draft, getIngredients());
      state.draft = null; state.editingId = null;
      state.notice = '菜谱已保存，可在“找菜”中搜索，或点击菜谱查看详情。';
    } catch (error) { state.error = error.message; }
    redraw(state.error ? '[role="alert"]' : '[data-custom-action="create"]');
  });
}
