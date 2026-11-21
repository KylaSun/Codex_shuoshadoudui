import {icon} from './illustrated-icons.js';

const STORAGE_KEY = 'tonight-what-c-state-v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const itemKey = (ingredientId, unit) => `${ingredientId}::${unit}`;
const selectionKey = (recipeId, ingredientId) => `${recipeId}:${ingredientId}`;
const unitInfo = raw => {
  const u=String(raw||'').trim().toLocaleLowerCase();
  if(['g','gram','grams','克'].includes(u))return {dimension:'mass',factor:1};
  if(['kg','kilogram','kilograms','公斤'].includes(u))return {dimension:'mass',factor:1000};
  if(['ml','millilitre','milliliter','毫升'].includes(u))return {dimension:'volume',factor:1};
  if(['l','litre','liter','升'].includes(u))return {dimension:'volume',factor:1000};
  if(['each','pc','pcs','piece','pieces','pack','packs','head','heads','个','枚','颗','只','片','slice'].includes(u))return {dimension:'count',factor:1};
  return null;
};
function parsePackageSize(value){
  const match=String(value||'').trim().replace(',','.').match(/([\d.]+)\s*(kg|g|ml|l|pieces?|pcs?|个|枚|颗|只|片|slice)/i);
  if(!match)return null;
  const unit=match[2].toLocaleLowerCase(), info=unitInfo(unit);if(!info)return null;
  const amount=Number(match[1]);return amount>0?{amount,unit:match[2],baseAmount:amount*info.factor,dimension:info.dimension}:null;
}
function amountBase(amount,unit){const info=unitInfo(unit);return info?Number(amount)*info.factor:null;}
function convertBase(value,unit){const info=unitInfo(unit);return info?value/info.factor:null;}

export function createCModule({getRecipes=()=>[],getIngredients=()=>[],getProducts=()=>[],getSubstitutions=()=>[],storage=globalThis.localStorage,documentRef=globalThis.document,dispatch=()=>{}}={}){
  let saved={};try{saved=JSON.parse(storage?.getItem(STORAGE_KEY)||'{}')||{};}catch{}
  const state={pantry:Array.isArray(saved.pantry)?saved.pantry:[],recipeIds:Array.isArray(saved.recipeIds)?saved.recipeIds:[],blockedIngredients:Array.isArray(saved.blockedIngredients)?saved.blockedIngredients:[],budgetGBP:Number.isFinite(Number(saved.budgetGBP))?Number(saved.budgetGBP):5,excluded:Array.isArray(saved.excluded)?saved.excluded:[],substitutions:saved.substitutions&&typeof saved.substitutions==='object'?saved.substitutions:{},lastRecommendationId:null,lastRerollReason:null};
  const recipes=()=>{try{return getRecipes()||[]}catch{return []}};
  const ingredients=()=>{try{return getIngredients()||[]}catch{return []}};
  const products=()=>{try{return getProducts()||[]}catch{return []}};
  const substitutionRules=()=>{try{return getSubstitutions()||[]}catch{return []}};
  const persist=()=>{try{storage?.setItem(STORAGE_KEY,JSON.stringify({pantry:state.pantry,recipeIds:state.recipeIds,blockedIngredients:state.blockedIngredients,budgetGBP:state.budgetGBP,excluded:state.excluded,substitutions:state.substitutions}));}catch{};dispatch();};
  const ingredientName=id=>ingredients().find(i=>i.id===id)?.nameZh||ingredients().find(i=>i.id===id)?.nameEn||id;
  const defaultUnit=id=>{for(const recipe of recipes()){const row=(recipe.ingredients||[]).find(x=>x.ingredientId===id);if(row)return row.unit;}return 'g';};
  const hasBlockedIngredient=(recipe,blocked=state.blockedIngredients)=>Boolean(recipe?.ingredients?.some(row=>blocked.includes(row.ingredientId)));
  const getBlockedIngredientIds=()=>[...state.blockedIngredients];
  function setBlockedIngredientIds(ids){state.blockedIngredients=[...new Set(ids.filter(id=>ingredients().some(i=>i.id===id)))];state.recipeIds=state.recipeIds.filter(id=>!hasBlockedIngredient(recipes().find(r=>r.id===id)));persist();return getBlockedIngredientIds();}
  function useSubstitutions(passed={}){return {...state.substitutions,...(passed&&typeof passed==='object'?passed:{})};}
  function calculate(recipeIds=state.recipeIds,selectedSubstitutions={},omitted=state.excluded){
    const selected=useSubstitutions(selectedSubstitutions),needs=new Map();
    const addNeed=(ingredientId,amount,unit)=>{
      const info=unitInfo(unit),base=amountBase(amount,unit),key=info?itemKey(ingredientId,info.dimension):itemKey(ingredientId,unit);
      const row=needs.get(key)||{ingredientId,nameZh:ingredientName(ingredientId),amount:0,unit,dimension:info?.dimension||null,baseAmount:0};
      row.amount+=base!==null&&info?.dimension===row.dimension?convertBase(base,row.unit):amount;
      if(base!==null)row.baseAmount+=base;
      needs.set(key,row);
    };
    for(const recipeId of recipeIds){const recipe=recipes().find(r=>r.id===recipeId);if(!recipe)continue;
      for(const source of recipe.ingredients||[]){let ingredientId=source.ingredientId,amount=Number(source.amount),unit=source.unit;const chosenId=selected[selectionKey(recipeId,source.ingredientId)];
        const rule=chosenId&&substitutionRules().find(s=>s.id===chosenId&&s.recipeId===recipeId&&s.ingredientId===source.ingredientId);
        if(rule){
          ingredientId=rule.replacementIngredientId;amount=Number(rule.replacementAmount);unit=rule.replacementUnit;
          for(const extra of rule.extraReplacements||[]){
            const extraUnit=ingredients().find(i=>i.id===extra.ingredientId)?.unit||source.unit;
            addNeed(extra.ingredientId,Number(source.amount)*Number(extra.quantityRatio),extraUnit);
          }
        }
        addNeed(ingredientId,amount,unit);
      }
    }
    const excluded=new Set(omitted);
    return [...needs.values()].filter(row=>!excluded.has(itemKey(row.ingredientId,row.unit))).map(row=>{
      const pantry=state.pantry.filter(x=>x.ingredientId===row.ingredientId);
      const haveBase=pantry.reduce((sum,x)=>{const value=amountBase(x.amount??x.quantity,x.unit||row.unit);const info=unitInfo(x.unit||row.unit);return info&&info.dimension===row.dimension?sum+value:sum;},0);
      const neededBase=row.dimension===null?null:Math.max(0,row.baseAmount-haveBase);
      const needed=neededBase===null?Math.max(0,row.amount):convertBase(neededBase,row.unit);
      const matches=products().map(p=>({product:p,size:Number(p.packQuantity)>0&&unitInfo(p.packUnit)?{baseAmount:amountBase(p.packQuantity,p.packUnit),dimension:unitInfo(p.packUnit).dimension}:parsePackageSize(p.packageSize)})).filter(x=>x.product.ingredientId===row.ingredientId&&x.size&&x.size.dimension===row.dimension&&Number.isFinite(Number(x.product.priceGBP))&&Number(x.product.priceGBP)>=0).sort((a,b)=>Math.ceil(neededBase/a.size.baseAmount)*Number(a.product.priceGBP)-Math.ceil(neededBase/b.size.baseAmount)*Number(b.product.priceGBP));
      const match=matches[0],packageCount=needed===0?0:match?Math.ceil(neededBase/match.size.baseAmount):null;
      return {...row,have:row.dimension?convertBase(haveBase,row.unit):pantry.reduce((sum,x)=>sum+(Number(x.amount??x.quantity)||0),0),needed,product:match?.product||null,packageCount,costGBP:packageCount===null?null:packageCount*Number(match.product.priceGBP),unmatched:needed>0&&!match};
    });
  }
  const sum=rows=>rows.reduce((total,row)=>total+(Number(row.costGBP)||0),0);
  const getPantry=()=>state.pantry.map(x=>({...x}));
  function setPantryQuantity(ingredientId,amount,unit=defaultUnit(ingredientId)){
    const quantity=Number(amount);state.pantry=state.pantry.filter(x=>x.ingredientId!==ingredientId);
    if(Number.isFinite(quantity)&&quantity>0)state.pantry.push({ingredientId,amount:quantity,unit});persist();return getPantry();
  }
  function getBudgetSummary(recipeId,selectedSubs={}){const rows=calculate([recipeId],selectedSubs);const missingItems=rows.filter(x=>x.unmatched).map(x=>({ingredientId:x.ingredientId,nameZh:x.nameZh}));const knownSubtotalGBP=sum(rows);if(missingItems.length)return {totalGBP:Number.NaN,knownSubtotalGBP,missingItems,label:`已扣除已有食材；${missingItems.map(x=>x.nameZh).join('、')}暂无匹配商品，以上仅为部分参考金额，完整预算未知`};return {totalGBP:knownSubtotalGBP,knownSubtotalGBP,missingItems:[],label:'已扣除已有食材，按整包参考价估算'};}
  function recommendWithinBudget({budgetGBP=state.budgetGBP,excludeRecipeIds=[],random=Math.random}={}){const options=recipes().filter(recipe=>!hasBlockedIngredient(recipe)).map(recipe=>({recipe,items:calculate([recipe.id],state.substitutions,[])})).map(x=>({...x,costGBP:sum(x.items),unmatched:x.items.some(item=>item.unmatched)}));const feasible=options.filter(x=>!x.unmatched&&x.costGBP<=Number(budgetGBP)&&!excludeRecipeIds.includes(x.recipe.id));if(!feasible.length){const closest=options.filter(x=>!x.unmatched).sort((a,b)=>a.costGBP-b.costGBP)[0]||null;return {ok:false,reason:'no-recipe-within-budget',budgetGBP:Number(budgetGBP),closest:closest?{recipe:closest.recipe,costGBP:closest.costGBP}:null};}const result=feasible[Math.min(feasible.length-1,Math.floor(Math.max(0,Math.min(.999999,random()))*feasible.length))];return {ok:true,...result};}
  function getShoppingList(){return calculate().filter(row=>row.needed>0||row.unmatched).map(row=>({ingredientId:row.ingredientId,nameZh:row.nameZh,amount:row.needed,unit:row.unit,haveAmount:row.have,requiredAmount:row.amount,product:row.product,packageCount:row.packageCount,costGBP:row.costGBP,unmatched:row.unmatched}));}
  const getSelectedRecipeIds=()=>[...state.recipeIds];
  function getShoppingRecipeGroups(){return state.recipeIds.map(id=>recipes().find(recipe=>recipe.id===id)).filter(Boolean).map(recipe=>({recipeId:recipe.id,nameZh:recipe.nameZh||recipe.nameEn||recipe.id,ingredients:calculate([recipe.id],{},state.excluded).map(row=>({ingredientId:row.ingredientId,nameZh:row.nameZh,amount:row.amount,unit:row.unit}))}));}
  function removeShoppingRecipe(recipeId){if(!state.recipeIds.includes(recipeId))return false;state.recipeIds=state.recipeIds.filter(id=>id!==recipeId);const remaining=new Set(calculate(state.recipeIds,{},[]).map(row=>itemKey(row.ingredientId,row.unit)));state.excluded=state.excluded.filter(key=>remaining.has(key));persist();return true;}
  function removeShoppingIngredient(ingredientId,unit){const key=itemKey(ingredientId,unit);if(!calculate(state.recipeIds,{},[]).some(row=>itemKey(row.ingredientId,row.unit)===key))return false;if(!state.excluded.includes(key))state.excluded.push(key);persist();return true;}
  function selectSubstitution({recipeId,ingredientId,substitutionId,flavourConfirmed}={}){
    const key=selectionKey(recipeId,ingredientId);if(substitutionId===null){delete state.substitutions[key];persist();return true;}
    if(flavourConfirmed!==true)return false;
    const exists=substitutionRules().some(s=>s.id===substitutionId&&s.recipeId===recipeId&&s.ingredientId===ingredientId);if(!exists)return false;
    state.substitutions[key]=substitutionId;persist();return true;
  }
  function setRecipeIds(ids){state.recipeIds=[...new Set(ids.filter(id=>recipes().some(r=>r.id===id&&!hasBlockedIngredient(r))))];state.excluded=[];persist();return [...state.recipeIds];}
  function setBudgetGBP(value){const n=Number(value);if(!Number.isFinite(n)||n<0)return false;state.budgetGBP=n;persist();return true;}
  function openEditor(kind) {
    if (!documentRef?.body) return false;
    documentRef.querySelector('.c-editor-backdrop')?.remove();
    const overlay = documentRef.createElement('div');
    overlay.className = 'modal-backdrop c-editor-backdrop';
    overlay.setAttribute('role', 'presentation');
    documentRef.body.append(overlay);

    let draftPantry = getPantry();
    let draftIds = [...state.recipeIds];
    let draftBlocked = getBlockedIngredientIds();
    let draftExcluded = new Set(state.excluded);
    let draftBudget = state.budgetGBP;
    let pantrySearch = '';
    let blockSearch = '';
    let recipeSearch = '';
    let rerollOpen = false;
    let rerollReason = '';
    let drawMessage = '';

    const close = () => overlay.remove();
    const matches = (item, query) => {
      const term = query.trim().toLocaleLowerCase();
      return !term || [item.nameZh, item.nameEn, item.region, ...(item.aliases || [])]
        .some(value => String(value || '').toLocaleLowerCase().includes(term));
    };
    const ingredientOptions = (query, excluded = []) => ingredients()
      .filter(item => !excluded.includes(item.id) && matches(item, query))
      .map(item => `<option value="${esc(item.id)}">${esc(item.nameZh || item.nameEn || item.id)}</option>`).join('');
    const pantryEditor = () => `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="c-editor-title">
      <button type="button" data-close class="c-close" aria-label="关闭">×</button>
      <div class="modal-icon">${icon('pantry', 'modal-paint')}</div>
      <h2 id="c-editor-title">管理我的厨房</h2>
      <p>记录已有食材。设置只保存在这个浏览器。</p>
      <div class="c-pantry-rows">${draftPantry.length ? draftPantry.map((row, index) => `<div class="c-pantry-row"><b>${esc(ingredientName(row.ingredientId))}</b><input aria-label="${esc(ingredientName(row.ingredientId))} 数量" type="number" min="0" step="any" data-pantry-index="${index}" value="${esc(row.amount)}"><span>${esc(row.unit)}</span><button type="button" data-pantry-remove="${index}" aria-label="移除 ${esc(ingredientName(row.ingredientId))}">移除</button></div>`).join('') : '<p class="subtle-empty">还没有记录食材。</p>'}</div>
      <form id="c-add-pantry" class="c-add-pantry">
        <label class="c-picker-label">搜索要添加的食材<input type="search" data-pantry-search value="${esc(pantrySearch)}" placeholder="输入中文、英文或别名" autocomplete="off"></label>
        <label>选择食材<select name="ingredientId" required>${ingredientOptions(pantrySearch)}</select></label>
        <label>数量<input name="amount" type="number" min="0.01" step="any" required></label>
        <span class="c-unit" id="c-pantry-unit"></span>
        <button class="outline" type="submit">加入厨房</button>
      </form>
      <div class="modal-actions"><button type="button" data-close class="outline">取消</button><button type="button" data-save-pantry class="primary">保存厨房</button></div>
    </div>`;
    const blockedEditor = () => `<div class="modal c-blocked-modal" role="dialog" aria-modal="true" aria-labelledby="c-editor-title">
      <button type="button" data-close class="c-close" aria-label="关闭">×</button>
      <div class="modal-icon">${icon('leaf', 'modal-paint')}</div>
      <h2 id="c-editor-title">屏蔽食材</h2>
      <p>含屏蔽食材的菜会从找菜结果隐藏，也不能加入购物单或参与随机推荐。</p>
      <div class="c-blocked-list">${draftBlocked.length ? draftBlocked.map(id => `<button type="button" data-block-remove="${esc(id)}" aria-label="取消屏蔽 ${esc(ingredientName(id))}">${esc(ingredientName(id))} <span aria-hidden="true">×</span></button>`).join('') : '<span class="c-empty-inline">尚未屏蔽食材</span>'}</div>
      <label class="c-picker-label">搜索要屏蔽的食材<input type="search" data-block-search value="${esc(blockSearch)}" placeholder="输入中文、英文或别名" autocomplete="off"></label>
      <div class="c-block-picker"><select data-block-select aria-label="选择要屏蔽的食材">${ingredientOptions(blockSearch, draftBlocked)}</select><button type="button" data-block-add class="outline">屏蔽所选</button></div>
      <div class="modal-actions"><button type="button" data-close class="outline">取消</button><button type="button" data-save-blocked class="primary">保存屏蔽设置</button></div>
    </div>`;
    const shoppingRows = () => calculate(draftIds, state.substitutions, [])
      .filter(row => row.needed > 0 || row.unmatched)
      .map(row => ({...row, excluded: draftExcluded.has(itemKey(row.ingredientId, row.unit))}));
    const recipeOptions = () => recipes().filter(recipe => matches(recipe, recipeSearch) || (recipe.ingredients || []).some(row => matches(ingredients().find(item => item.id === row.ingredientId) || {}, recipeSearch))).map(recipe => {
      const blocked = hasBlockedIngredient(recipe);
      return `<label class="${blocked ? 'c-recipe-blocked' : ''}"><input type="checkbox" data-plan-recipe="${esc(recipe.id)}" ${draftIds.includes(recipe.id) ? 'checked' : ''} ${blocked ? 'disabled' : ''}><span>${esc(recipe.nameZh || recipe.nameEn || recipe.id)}${blocked ? '<small>含屏蔽食材</small>' : ''}</span></label>`;
    }).join('') || '<p class="subtle-empty">没有找到菜谱。</p>';
    const shoppingEditor = () => {
      const rows = shoppingRows();
      const total = sum(rows.filter(row => !row.excluded));
      const over = total > draftBudget;
      return `<div class="modal c-shopping-modal" role="dialog" aria-modal="true" aria-labelledby="c-editor-title">
        <button type="button" data-close class="c-close" aria-label="关闭">×</button>
        <div class="modal-icon">${icon('shopping', 'modal-paint')}</div>
        <h2 id="c-editor-title">编辑今晚购物单</h2>
        <p>勾选要加入清单的菜；取消单项可以调整采购内容。金额按整包参考价计算。</p>
        <label class="c-picker-label">搜索今晚要做的菜<input type="search" data-recipe-search value="${esc(recipeSearch)}" placeholder="搜索菜名、地区或食材" autocomplete="off"></label>
        <fieldset class="c-recipes"><legend>今晚要做的菜</legend><div class="c-recipe-options">
          ${recipeOptions()}
        </div>
        </fieldset>
        <div class="c-random-controls"><button type="button" data-random-recommend class="outline">预算随机推荐一道</button>
          ${rerollOpen ? `<label>重抽原因<select data-reroll-reason><option value="">请选择</option>${['不想吃这道菜', '缺少关键食材', '想换一种口味', '其他'].map(value => `<option ${rerollReason === value ? 'selected' : ''} value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label><button type="button" data-confirm-reroll class="secondary">确认原因并重抽</button>` : ''}
          <p class="c-random-message" role="status">${esc(drawMessage)}</p>
        </div>
        <label class="c-budget-label">预算 (£)<input id="c-budget-input" type="number" min="0" step="0.01" value="${draftBudget.toFixed(2)}"></label>
        <div class="c-shopping-rows">${rows.length ? rows.map(row => `<label class="c-shopping-row"><input type="checkbox" data-shopping-item="${esc(itemKey(row.ingredientId, row.unit))}" ${row.excluded ? '' : 'checked'}><span><b>${esc(row.nameZh)}</b><small>需购 ${esc(row.needed)} ${esc(row.unit)}${row.product ? ` · ${esc(row.product.supermarket)} 整包 × ${esc(row.packageCount)}` : ' · 无匹配商品'}</small></span><strong>${row.costGBP === null ? '—' : '£' + row.costGBP.toFixed(2)}</strong></label>`).join('') : '<p class="subtle-empty">先选择一道菜，购物项会自动生成。</p>'}</div>
        <div class="c-total"><span>已匹配商品参考价</span><strong>£${total.toFixed(2)}</strong></div>
        <div class="c-budget-message" role="status">${[rows.some(row => row.unmatched && !row.excluded) ? `有 ${rows.filter(row => row.unmatched && !row.excluded).length} 项暂无匹配商品；仍会保留在清单，金额不计入小计，完整金额未知。` : '', over ? '已匹配商品小计超过当前预算；请调整清单，或明确提高预算。' : ''].filter(Boolean).join(' ')}</div>
        <div class="modal-actions">${over ? `<button type="button" data-raise-budget class="outline">明确把预算提高至至少 £${total.toFixed(2)}${rows.some(row => row.unmatched && !row.excluded) ? '（不含未匹配商品；完整金额仍未知）' : ''}</button>` : ''}<button type="button" data-close class="outline">取消</button><button type="button" data-save-shopping class="primary" ${over ? 'disabled' : ''}>保存购物单</button></div>
      </div>`;
    };
    const updateUnit = () => {
      const select = overlay.querySelector('[name="ingredientId"]');
      const unit = overlay.querySelector('#c-pantry-unit');
      if (unit) unit.textContent = select?.value ? defaultUnit(select.value) : '';
    };
    const paint = () => {
      const priorModal=overlay.querySelector('.modal');
      const scroll={overlay:overlay.scrollTop,modal:priorModal?.scrollTop||0,recipes:overlay.querySelector('.c-recipes')?.scrollTop||0,shopping:overlay.querySelector('.c-shopping-rows')?.scrollTop||0};
      const active=documentRef.activeElement;
      const focusAttribute=active?.hasAttribute?.('data-plan-recipe')?'data-plan-recipe':active?.hasAttribute?.('data-shopping-item')?'data-shopping-item':null;
      const focusValue=focusAttribute?active.getAttribute(focusAttribute):null;
      overlay.innerHTML = kind === 'pantry' ? pantryEditor() : kind === 'blocked' ? blockedEditor() : shoppingEditor();
      overlay.scrollTop=scroll.overlay;
      const nextModal=overlay.querySelector('.modal');if(nextModal)nextModal.scrollTop=scroll.modal;
      const nextRecipes=overlay.querySelector('.c-recipes');if(nextRecipes)nextRecipes.scrollTop=scroll.recipes;
      const nextShopping=overlay.querySelector('.c-shopping-rows');if(nextShopping)nextShopping.scrollTop=scroll.shopping;
      if(focusAttribute){const next=[...overlay.querySelectorAll(`[${focusAttribute}]`)].find(node=>node.getAttribute(focusAttribute)===focusValue);next?.focus({preventScroll:true});}
      updateUnit();
    };
    paint();

    overlay.addEventListener('input', event => {
      const target = event.target;
      if (target.matches('[data-pantry-index]')) {
        const index = Number(target.dataset.pantryIndex);
        draftPantry[index] = {...draftPantry[index], amount: Math.max(0, Number(target.value) || 0)};
      }
      if (target.matches('[data-pantry-search]')) {
        pantrySearch = target.value;
        const select = overlay.querySelector('[name="ingredientId"]');
        select.innerHTML = ingredientOptions(pantrySearch);
        updateUnit();
      }
      if (target.matches('[data-block-search]')) {
        blockSearch = target.value;
        overlay.querySelector('[data-block-select]').innerHTML = ingredientOptions(blockSearch, draftBlocked);
      }
      if (target.matches('[data-recipe-search]')) {
        recipeSearch = target.value;
        overlay.querySelector('.c-recipe-options').innerHTML = recipeOptions();
        overlay.querySelector('.c-recipes').scrollTop = 0;
      }
    });
    overlay.addEventListener('change', event => {
      const target = event.target;
      if (target.matches('[name="ingredientId"]')) updateUnit();
      if (target.matches('[data-reroll-reason]')) rerollReason = target.value;
      if (target.matches('[data-plan-recipe]')) {
        draftIds = target.checked ? [...new Set([...draftIds, target.dataset.planRecipe])] : draftIds.filter(id => id !== target.dataset.planRecipe);
        paint();
      }
      if (target.matches('[data-shopping-item]')) {
        if (target.checked) draftExcluded.delete(target.dataset.shoppingItem);
        else draftExcluded.add(target.dataset.shoppingItem);
        paint();
      }
      if (target.id === 'c-budget-input') {
        draftBudget = Math.max(0, Number(target.value) || 0);
        paint();
      }
    });
    overlay.addEventListener('submit', event => {
      if (event.target.id !== 'c-add-pantry') return;
      event.preventDefault();
      const form = event.target;
      const id = form.elements.ingredientId.value;
      const amount = Number(form.elements.amount.value);
      if (!id || !Number.isFinite(amount) || amount <= 0) return;
      const unit = defaultUnit(id);
      const index = draftPantry.findIndex(row => row.ingredientId === id);
      if (index >= 0) draftPantry[index] = {ingredientId: id, amount: Number(draftPantry[index].amount) + amount, unit};
      else draftPantry.push({ingredientId: id, amount, unit});
      pantrySearch = '';
      paint();
    });
    overlay.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-close')) { close(); return; }
      if (button.hasAttribute('data-pantry-remove')) { draftPantry.splice(Number(button.dataset.pantryRemove), 1); paint(); return; }
      if (button.hasAttribute('data-block-add')) {
        const id = overlay.querySelector('[data-block-select]')?.value;
        if (id && !draftBlocked.includes(id)) draftBlocked.push(id);
        blockSearch = '';
        paint();
        return;
      }
      if (button.hasAttribute('data-block-remove')) {
        draftBlocked = draftBlocked.filter(id => id !== button.dataset.blockRemove);
        paint();
        return;
      }
      if (button.hasAttribute('data-save-pantry')) {
        state.pantry = draftPantry.filter(row => Number(row.amount) > 0);
        persist();
        close();
        return;
      }
      if (button.hasAttribute('data-save-blocked')) {
        setBlockedIngredientIds(draftBlocked);
        close();
        return;
      }
      if (button.hasAttribute('data-random-recommend')) {
        if (state.lastRecommendationId) { rerollOpen = true; drawMessage = '重抽前请先选择一个原因。'; paint(); return; }
        const result = recommendWithinBudget({budgetGBP: draftBudget});
        if (!result.ok) { drawMessage = result.closest ? `预算内没有符合的菜；最低可匹配估算 £${result.closest.costGBP.toFixed(2)}。` : '当前菜谱暂无完整商品匹配，无法随机推荐。'; paint(); return; }
        state.lastRecommendationId = result.recipe.id;
        draftIds = [...new Set([...draftIds, result.recipe.id])];
        drawMessage = `已推荐：${result.recipe.nameZh || result.recipe.nameEn} · £${result.costGBP.toFixed(2)}`;
        paint();
        return;
      }
      if (button.hasAttribute('data-confirm-reroll')) {
        if (!rerollReason) { drawMessage = '请先选择重抽原因。'; paint(); return; }
        const result = recommendWithinBudget({budgetGBP: draftBudget, excludeRecipeIds: [state.lastRecommendationId]});
        if (!result.ok) { drawMessage = result.closest ? `没有其他菜符合预算；最低可匹配估算 £${result.closest.costGBP.toFixed(2)}。` : '没有其他菜可匹配预算和商品。'; paint(); return; }
        state.lastRerollReason = rerollReason;
        state.lastRecommendationId = result.recipe.id;
        draftIds = [...new Set([...draftIds, result.recipe.id])];
        drawMessage = `已按“${rerollReason}”重抽：${result.recipe.nameZh || result.recipe.nameEn} · £${result.costGBP.toFixed(2)}`;
        rerollOpen = false;
        rerollReason = '';
        paint();
        return;
      }
      if (button.hasAttribute('data-raise-budget')) {
        draftBudget = sum(shoppingRows().filter(row => !row.excluded));
        state.budgetGBP = draftBudget;
        persist();
        paint();
        return;
      }
      if (button.hasAttribute('data-save-shopping')) {
        const total = sum(shoppingRows().filter(row => !row.excluded));
        if (total > draftBudget) {
          overlay.querySelector('.c-budget-message').textContent = '请先调整购物单或明确提高预算。';
          return;
        }
        state.recipeIds = draftIds.filter(id => !hasBlockedIngredient(recipes().find(recipe => recipe.id === id)));
        state.excluded = [...draftExcluded];
        state.budgetGBP = draftBudget;
        persist();
        close();
      }
    });
    overlay.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    return true;
  }
  return {getPantry,getBlockedIngredientIds,setBlockedIngredientIds,getBudgetSummary,getShoppingList,getSelectedRecipeIds,getShoppingRecipeGroups,removeShoppingRecipe,removeShoppingIngredient,getSelectedSubstitutions:()=>({...state.substitutions}),selectSubstitution,recommendWithinBudget,openPantryEditor:()=>openEditor('pantry'),openBlockedIngredientsEditor:()=>openEditor('blocked'),openShoppingEditor:()=>openEditor('shopping'),setPantryQuantity,setRecipeIds,setBudgetGBP,calculateShoppingList:calculate,getBudget:()=>state.budgetGBP};
}
