import {adapters, getRecipes, getIngredients, ingredientById} from './data.js';
import {REROLL_REASONS} from './c-module.js';

const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const money = value => Number.isFinite(value) ? `£${value.toFixed(2)}` : '无法完整估价';
const qty = value => Number.isFinite(value) ? String(Math.round(value * 1e4) / 1e4) : '待核对';
const state = {error: '', notice: '', shoppingDraft: null, pantryDraft: {ingredientId: '', amount: '', unit: 'g'}, card: () => ''};
const units = (selected = 'g') => ['g', 'kg', 'ml', 'l', '个'].map(unit => `<option ${unit === selected ? 'selected' : ''}>${unit}</option>`).join('');
const button = (command, label, attributes = '') => `<button type="button" class="outline" data-c-action="${command}" ${attributes}>${label}</button>`;
const referenceNote = '<p class="disclaimer">按 B 目录带记录日期的示例参考价估算，非实时价格或库存。逐项比较整包总金额，可能来自不同超市；不含配送费，不代表结账报价。</p>';
function draftPlan() {
  if (!state.shoppingDraft) {
    const saved = adapters().getKitchenState();
    state.shoppingDraft = {recipeIds: [...saved.recipeIds], excluded: [...saved.excluded], budgetGBP: saved.budgetGBP};
  }
  return state.shoppingDraft;
}
export function queueRecipeForShopping(id) {
  const draft = draftPlan();
  if (getRecipes().some(recipe => recipe.id === id) && !draft.recipeIds.includes(id)) draft.recipeIds.push(id);
  draft.excluded = [];
  state.notice = '已加入待确认的晚餐计划，请核对采购项目和预算后保存。'; state.error = '';
}

function pantry() {
  const rows = adapters().getPantry();
  const draft = state.pantryDraft;
  return `<h1 class="page-title">我的<span class="highlight">厨房</span></h1><p class="muted">记录现有食材，报价时自动扣除同种、同维度的库存。数量表示库存总量；修改时填写新总量。</p>
    <form id="c-pantry-add" class="c-panel c-form-grid"><label>食材<select name="ingredientId" required><option value="">请选择食材</option>${getIngredients().map(item => `<option value="${e(item.id)}" ${draft.ingredientId === item.id ? 'selected' : ''}>${e(item.nameZh)} / ${e(item.nameEn || '')}</option>`).join('')}</select></label><label>库存数量<input name="amount" type="number" required min="0" step="any" value="${e(draft.amount)}"/></label><label>单位<select name="unit">${units(draft.unit)}</select></label><button class="primary" type="submit">保存库存</button></form>
    <div class="c-stock-list">${rows.length ? rows.map((item, index) => `<form class="c-panel c-stock-row" data-c-pantry-index="${index}"><label>${e(ingredientById(item.ingredientId)?.nameZh || item.ingredientId)}<input type="number" name="amount" min="0" step="any" required value="${e(item.amount)}" aria-label="${e(item.ingredientId)} 库存数量"/></label><span>${e(item.unit)}</span><button type="submit" class="outline">更新总量</button>${button('remove-pantry', '移除', `data-index="${index}"`)}</form>`).join('') : '<div class="subtle-empty">厨房还没有库存，添加第一种食材吧。</div>'}</div><button class="outline" data-go="recommendations">用库存找每日推荐 →</button>`;
}

function shopping() {
  const kitchen = adapters();
  const draft = draftPlan();
  const all = getRecipes();
  const missing = draft.recipeIds.filter(id => !all.some(recipe => recipe.id === id));
  const quote = kitchen.quoteShoppingPlan(draft.recipeIds, draft.excluded);
  const allRows = kitchen.quoteShoppingPlan(draft.recipeIds).items;
  const saved = kitchen.getKitchenState();
  const savedQuote = kitchen.getShoppingSummary();
  const over = quote.complete && quote.totalGBP > Number(draft.budgetGBP);
  const edited = JSON.stringify({recipeIds: saved.recipeIds, excluded: saved.excluded, budgetGBP: saved.budgetGBP}) !== JSON.stringify(draft);
  return `<h1 class="page-title">今晚的<span class="highlight">购物单</span></h1><p class="muted">选择今晚要做的菜，合并食材、扣除库存后按整包采购。自定义菜谱也在这里。</p>${referenceNote}
    <div class="c-panel"><h2>已保存计划</h2><p>${saved.recipeIds.length} 道菜 · 预算 ${money(saved.budgetGBP)} · ${savedQuote.complete ? '参考采购金额 ' + money(savedQuote.totalGBP) : '仍有未报价项目'}${edited ? ' · 当前有未保存修改' : ''}</p></div>
    <form id="c-shopping-form"><fieldset class="c-panel"><legend>今晚要做的菜</legend><div class="c-recipe-options">${[...all.map(recipe => ({id: recipe.id, name: recipe.nameZh})), ...missing.map(id => ({id, name: `已删除菜谱（请移除）：${id}`}))].map(recipe => `<label><input type="checkbox" name="recipeIds" value="${e(recipe.id)}" ${draft.recipeIds.includes(recipe.id) ? 'checked' : ''}/>${e(recipe.name)}</label>`).join('')}</div></fieldset>
    <label class="c-budget-field">采购预算 (£)<input type="number" name="budgetGBP" min="0" step="0.01" required value="${e(draft.budgetGBP)}"/></label>
    <div class="c-purchase-list">${allRows.filter(row => row.needed > 0 || row.unmatched).map(row => {
      const omitted = draft.excluded.includes(row.key) || draft.excluded.includes(`${row.ingredientId}::${row.unit}`);
      const product = row.product;
      return `<label class="c-panel c-purchase-row ${omitted ? 'c-omitted' : ''}"><input type="checkbox" name="included" value="${e(row.key)}" ${omitted ? '' : 'checked'}/><span><strong>${e(row.nameZh)}</strong><small>需求 ${qty(row.amount)} ${e(row.unit)} · 已有 ${qty(row.have)} · 需购 ${qty(row.needed)}</small>${row.unmatched ? `<small class="c-warning-text">${e(row.problem)}</small><small>英文采购名：${e(ingredientById(row.ingredientId)?.nameEn || '请先核对菜谱')}</small>` : `<small>${e(product?.supermarket || '')} · ${e(product?.packageSize || '')} × ${row.packageCount} 包 · ${money(row.costGBP)}</small><small>参考价记录：${e(product?.recordedAt || '未标注')}</small>`}</span></label>`;
    }).join('') || '<p class="subtle-empty">尚未选菜，或所有需要的食材已有库存。</p>'}</div>
    ${draft.excluded.length ? '<p class="c-warning">已排除部分采购项。下方金额仅覆盖选中项；被排除的食材仍需你自行准备，不代表完整菜谱成本。</p>' : ''}
    <div class="budget-result"><b>${money(quote.totalGBP)}</b><span>${quote.complete ? '选中采购项目的整包参考金额' : `已知部分 ${money(quote.knownSubtotalGBP)}，存在未报价项目`}</span></div>
    ${!quote.complete ? '<p class="c-warning" role="status">存在缺失商品、未知单位或失效菜谱。请处理、修改菜谱或明确排除这些采购项，不能把缺价当作 £0。</p>' : ''}
    ${over ? `<p class="c-warning" role="status">超过当前预算。请减少菜品或采购项，或明确将预算提高至 ${money(quote.totalGBP)}。</p>${button('raise-budget', `明确提高预算至 ${money(quote.totalGBP)}`)}` : ''}
    <div class="c-actions"><button type="submit" class="primary" ${over || !quote.complete ? 'disabled' : ''}>确认并保存购物单</button>${button('reset-shopping', '取消修改，恢复已保存计划')}<button type="button" class="outline" data-go="recommendations">看看每日推荐</button></div></form>`;
}

function recommendations() {
  const kitchen = adapters();
  const saved = kitchen.getKitchenState();
  const chosen = saved.recommendation && getRecipes().find(recipe => recipe.id === saved.recommendation.recipeId);
  const quote = chosen && kitchen.getBudgetSummary(chosen.id);
  return `<h1 class="page-title">每日<span class="highlight">推荐</span></h1><p class="muted">根据当前库存与采购预算，从能完整匹配参考商品的菜谱中随机推荐。不会自动替换食材；没有符合条件的菜会明确说明。推荐按浏览器本地日期保存。</p>${referenceNote}
    <form id="c-budget-form" class="c-panel c-budget-form"><label>今天的采购预算 (£)<input name="budgetGBP" type="number" min="0" step="0.01" required value="${e(saved.budgetGBP)}"/></label><button class="outline" type="submit">更新预算</button></form>
    ${chosen ? `<div class="c-recommendation-card">${state.card(chosen)}</div><div class="budget-result"><b>${money(quote.totalGBP)}</b><span>${e(quote.label)}</span></div>${quote.complete && quote.totalGBP > saved.budgetGBP ? '<p class="c-warning">库存或预算已变动：这道菜现在超预算，请调整或重新推荐。</p>' : ''}<button class="primary" data-c-add-recipe="${e(chosen.id)}">加入购物计划 →</button>` : saved.recommendation ? '<p class="c-warning">上次推荐的自定义菜谱已删除，请选择原因后重新推荐。</p>' : '<p class="subtle-empty">点击下方按钮，找一道今天预算内的家乡菜。</p>'}
    <form id="c-recommend-form" class="c-panel">${saved.recommendation ? `<label>重新推荐前，先选择原因<select name="reason" required><option value="">请选择重抽原因</option>${REROLL_REASONS.map(reason => `<option>${e(reason)}</option>`).join('')}</select></label>` : ''}<button class="primary" type="submit">${saved.recommendation ? '确认原因并重新推荐' : '生成今日推荐'}</button></form>`;
}

function pageContent(page, {recipeCard = () => ''} = {}) {
  state.card = recipeCard;
  const kitchen = adapters();
  if (typeof kitchen.getKitchenState !== 'function') return '<h1>厨房服务尚未加载</h1><p>请通过项目服务端重新打开页面。</p>';
  const saved = kitchen.getKitchenState();
  return `<div class="overline">FANXIANG · YOUR DINNER PLAN</div>${saved.storageError ? `<p class="c-warning" role="alert">${e(saved.storageError)}</p>` : ''}${state.error ? `<p class="c-warning" role="alert" tabindex="-1">${e(state.error)}</p>` : ''}${state.notice ? `<p class="c-notice" role="status">${e(state.notice)}</p>` : ''}${page === 'pantry' ? pantry() : page === 'shopping' ? shopping() : recommendations()}`;
}

export function renderCPage(page, options) {
  return `<section id="c-page" class="inner-page c-page" data-page="${page}">${pageContent(page, options)}</section>`;
}

export function mountCPages(root, page, options) {
  const section = root.querySelector('#c-page');
  if (!section) return;
  const redraw = () => {
    const current = root.querySelector('#c-page');
    if (current) current.innerHTML = pageContent(page, options);
  };
  function capture(form) {
    if (!form) return;
    const data = new FormData(form);
    if (form.id === 'c-pantry-add') state.pantryDraft = {ingredientId: String(data.get('ingredientId') || ''), amount: data.get('amount'), unit: data.get('unit')};
    if (form.id === 'c-shopping-form') {
      const draft = draftPlan();
      draft.recipeIds = data.getAll('recipeIds');
      draft.budgetGBP = data.get('budgetGBP') === '' ? '' : Number(data.get('budgetGBP'));
      const included = new Set(data.getAll('included'));
      const currentRows = adapters().quoteShoppingPlan(draft.recipeIds).items.filter(row => row.needed > 0 || row.unmatched);
      // Newly selected recipes start included; existing checkbox values express explicit exclusions.
      const existingKeys = new Set(Array.from(form.querySelectorAll('[name="included"]'), input => input.value));
      draft.excluded = currentRows.filter(row => existingKeys.has(row.key) && !included.has(row.key)).map(row => row.key);
    }
  }
  section.addEventListener('input', event => capture(event.target.closest('form')));
  section.addEventListener('change', event => {
    capture(event.target.closest('form'));
    if (event.target.closest('form')?.id === 'c-shopping-form') redraw();
    else if (event.target.name === 'ingredientId') {
      state.pantryDraft.unit = adapters().defaultUnit(event.target.value);
      redraw();
    }
  });
  section.addEventListener('click', event => {
    const action = event.target.closest('[data-c-action]');
    if (!action) return;
    state.error = ''; state.notice = '';
    try {
      if (action.dataset.cAction === 'remove-pantry') adapters().removePantryItem(Number(action.dataset.index));
      if (action.dataset.cAction === 'reset-shopping') state.shoppingDraft = null;
      if (action.dataset.cAction === 'raise-budget') {
        const draft = draftPlan();
        const quote = adapters().quoteShoppingPlan(draft.recipeIds, draft.excluded);
        if (quote.complete) draft.budgetGBP = quote.totalGBP;
      }
    } catch (error) { state.error = error.message; }
    redraw();
  });
  section.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    capture(form);
    const data = new FormData(form);
    const kitchen = adapters();
    state.error = ''; state.notice = '';
    try {
      if (form.id === 'c-pantry-add') {
        kitchen.setPantryQuantity(String(data.get('ingredientId')), data.get('amount'), String(data.get('unit')));
        state.pantryDraft = {ingredientId: '', amount: '', unit: 'g'}; state.notice = '库存已保存，菜谱预算已刷新。';
      } else if (form.dataset.cPantryIndex !== undefined) {
        const item = kitchen.getPantry()[Number(form.dataset.cPantryIndex)];
        if (item) kitchen.setPantryQuantity(item.ingredientId, data.get('amount'), item.unit);
        state.notice = '库存总量已更新。';
      } else if (form.id === 'c-budget-form') {
        if (!kitchen.setBudgetGBP(data.get('budgetGBP'))) throw new Error('预算必须是非负数。');
        state.notice = '预算已更新，未自动重新推荐。';
      } else if (form.id === 'c-recommend-form') {
        const result = kitchen.requestRecommendation({reason: String(data.get('reason') || '')});
        if (!result.ok) throw new Error(result.reason === 'reroll-reason-required' ? '请先选择重新推荐的原因。' : result.closest ? `预算内没有其他可完整报价的菜，最低参考采购金额 ${money(result.closest.costGBP)}。请调整库存或预算。` : '没有能完整报价的候选菜谱，请检查商品匹配或调整食材。');
        state.notice = '今日推荐已保存，确认后可加入购物计划。';
      } else if (form.id === 'c-shopping-form') {
        const result = kitchen.saveShoppingPlan(draftPlan());
        if (!result.ok) throw new Error(result.reason === 'over-budget' ? '当前采购超预算，请调整采购项或明确提高预算。' : '还有未报价项目，请处理后再保存。');
        state.shoppingDraft = null; state.notice = '购物单和预算已保存。';
      }
    } catch (error) { state.error = error.message; }
    redraw();
  });
}
