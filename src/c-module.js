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
  const state={pantry:Array.isArray(saved.pantry)?saved.pantry:[],recipeIds:Array.isArray(saved.recipeIds)?saved.recipeIds:[],budgetGBP:Number.isFinite(Number(saved.budgetGBP))?Number(saved.budgetGBP):5,excluded:Array.isArray(saved.excluded)?saved.excluded:[],substitutions:saved.substitutions&&typeof saved.substitutions==='object'?saved.substitutions:{},lastRecommendationId:null,lastRerollReason:null};
  const recipes=()=>{try{return getRecipes()||[]}catch{return []}};
  const ingredients=()=>{try{return getIngredients()||[]}catch{return []}};
  const products=()=>{try{return getProducts()||[]}catch{return []}};
  const substitutionRules=()=>{try{return getSubstitutions()||[]}catch{return []}};
  const persist=()=>{try{storage?.setItem(STORAGE_KEY,JSON.stringify({pantry:state.pantry,recipeIds:state.recipeIds,budgetGBP:state.budgetGBP,excluded:state.excluded,substitutions:state.substitutions}));}catch{};dispatch();};
  const ingredientName=id=>ingredients().find(i=>i.id===id)?.nameZh||ingredients().find(i=>i.id===id)?.nameEn||id;
  const defaultUnit=id=>{for(const recipe of recipes()){const row=(recipe.ingredients||[]).find(x=>x.ingredientId===id);if(row)return row.unit;}return 'g';};
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
  function getBudgetSummary(recipeId,selectedSubs={}){const rows=calculate([recipeId],selectedSubs);const missing=rows.filter(x=>x.unmatched).map(x=>x.nameZh);if(missing.length)return {totalGBP:Number.NaN,label:`${missing.join('、')}暂无匹配商品，无法估算完整采购金额`};return {totalGBP:sum(rows),label:'已扣除已有食材，按整包参考价估算'};}
  function recommendWithinBudget({budgetGBP=state.budgetGBP,excludeRecipeIds=[],random=Math.random}={}){const options=recipes().map(recipe=>({recipe,items:calculate([recipe.id],state.substitutions,[])})).map(x=>({...x,costGBP:sum(x.items),unmatched:x.items.some(item=>item.unmatched)}));const feasible=options.filter(x=>!x.unmatched&&x.costGBP<=Number(budgetGBP)&&!excludeRecipeIds.includes(x.recipe.id));if(!feasible.length){const closest=options.filter(x=>!x.unmatched).sort((a,b)=>a.costGBP-b.costGBP)[0]||null;return {ok:false,reason:'no-recipe-within-budget',budgetGBP:Number(budgetGBP),closest:closest?{recipe:closest.recipe,costGBP:closest.costGBP}:null};}const result=feasible[Math.min(feasible.length-1,Math.floor(Math.max(0,Math.min(.999999,random()))*feasible.length))];return {ok:true,...result};}
  function getShoppingList(){return calculate().filter(row=>row.needed>0||row.unmatched).map(row=>({ingredientId:row.ingredientId,nameZh:row.nameZh,amount:row.needed,unit:row.unit,haveAmount:row.have,requiredAmount:row.amount,product:row.product,packageCount:row.packageCount,costGBP:row.costGBP,unmatched:row.unmatched}));}
  function selectSubstitution({recipeId,ingredientId,substitutionId,flavourConfirmed}={}){
    const key=selectionKey(recipeId,ingredientId);if(substitutionId===null){delete state.substitutions[key];persist();return true;}
    if(flavourConfirmed!==true)return false;
    const exists=substitutionRules().some(s=>s.id===substitutionId&&s.recipeId===recipeId&&s.ingredientId===ingredientId);if(!exists)return false;
    state.substitutions[key]=substitutionId;persist();return true;
  }
  function setRecipeIds(ids){state.recipeIds=[...new Set(ids.filter(id=>recipes().some(r=>r.id===id)))];state.excluded=[];persist();return [...state.recipeIds];}
  function setBudgetGBP(value){const n=Number(value);if(!Number.isFinite(n)||n<0)return false;state.budgetGBP=n;persist();return true;}
  function openEditor(kind){if(!documentRef?.body)return false;documentRef.querySelector('.c-editor-backdrop')?.remove();const overlay=documentRef.createElement('div');overlay.className='modal-backdrop c-editor-backdrop';overlay.setAttribute('role','presentation');documentRef.body.append(overlay);let draftPantry=getPantry(),draftIds=[...state.recipeIds],draftExcluded=new Set(state.excluded),draftBudget=state.budgetGBP,rerollOpen=false,rerollReason='',drawMessage='';
    const close=()=>overlay.remove();const pantryEditor=()=>`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="c-editor-title"><button type="button" data-close class="c-close" aria-label="关闭">×</button><div class="modal-icon">${icon("pantry","modal-paint")}</div><h2 id="c-editor-title">管理我的厨房</h2><p>库存数量按菜谱食材单位记录，只保存在这个浏览器。</p><div class="c-pantry-rows">${draftPantry.length?draftPantry.map((x,n)=>`<div class="c-pantry-row"><b>${esc(ingredientName(x.ingredientId))}</b><input aria-label="${esc(ingredientName(x.ingredientId))} 库存数量" type="number" min="0" step="any" data-pantry-index="${n}" value="${esc(x.amount)}"><span>${esc(x.unit)}</span><button type="button" data-pantry-remove="${n}" aria-label="移除 ${esc(ingredientName(x.ingredientId))}">移除</button></div>`).join(''):'<p class="subtle-empty">还没有记录库存。</p>'}</div><form id="c-add-pantry" class="c-add-pantry"><label>添加食材<select name="ingredientId">${ingredients().map(i=>`<option value="${esc(i.id)}">${esc(i.nameZh||i.nameEn||i.id)}</option>`).join('')}</select></label><label>数量<input name="amount" type="number" min="0.01" step="any" required></label><span class="c-unit" id="c-pantry-unit">${esc(defaultUnit(ingredients()[0]?.id))}</span><button class="outline" type="submit">加入库存</button></form><div class="modal-actions"><button type="button" data-close class="outline">取消</button><button type="button" data-save-pantry class="primary">保存库存</button></div></div>`;
    const shoppingRows=()=>calculate(draftIds,state.substitutions,[]).filter(row=>row.needed>0||row.unmatched).map(x=>({...x,excluded:draftExcluded.has(itemKey(x.ingredientId,x.unit))}));
    const shoppingEditor=()=>{const rows=shoppingRows(),total=sum(rows.filter(x=>!x.excluded));const over=total>draftBudget;return `<div class="modal c-shopping-modal" role="dialog" aria-modal="true" aria-labelledby="c-editor-title"><button type="button" data-close class="c-close" aria-label="关闭">×</button><div class="modal-icon">${icon("shopping","modal-paint")}</div><h2 id="c-editor-title">编辑今晚购物单</h2><p>勾选要加入清单的菜；取消单项可以调整采购内容。金额按整包参考价计算。</p><fieldset class="c-recipes"><legend>今晚要做的菜</legend>${recipes().map(r=>`<label><input type="checkbox" data-plan-recipe="${esc(r.id)}" ${draftIds.includes(r.id)?'checked':''}> ${esc(r.nameZh||r.nameEn||r.id)}</label>`).join('')}</fieldset><div class="c-random-controls"><button type="button" data-random-recommend class="outline">预算随机推荐一道</button>${rerollOpen?`<label>重抽原因<select data-reroll-reason><option value="">请选择</option>${['不想吃这道菜','缺少关键食材','想换一种口味','其他'].map(x=>`<option ${rerollReason===x?'selected':''} value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label><button type="button" data-confirm-reroll class="secondary">确认原因并重抽</button>`:''}<p class="c-random-message" role="status">${esc(drawMessage)}</p></div><label class="c-budget-label">预算 (£)<input id="c-budget-input" type="number" min="0" step="0.01" value="${draftBudget.toFixed(2)}"></label><div class="c-shopping-rows">${rows.length?rows.map((x,n)=>`<label class="c-shopping-row"><input type="checkbox" data-shopping-item="${esc(itemKey(x.ingredientId,x.unit))}" ${x.excluded?'':'checked'}><span><b>${esc(x.nameZh)}</b><small>需购 ${esc(x.needed)} ${esc(x.unit)}${x.product?` · ${esc(x.product.supermarket)} 整包 × ${esc(x.packageCount)}`:' · 无匹配商品'}</small></span><strong>${x.costGBP===null?'—':'£'+x.costGBP.toFixed(2)}</strong></label>`).join(''):'<p class="subtle-empty">先选择一道菜，购物项会自动生成。</p>'}</div><div class="c-total"><span>已匹配商品参考价</span><strong>£${total.toFixed(2)}</strong></div><div class="c-budget-message" role="status">${rows.some(x=>x.unmatched&&!x.excluded)?'至少一项没有匹配的示例商品。':over?'超过当前预算；请调整菜品/购物项，或明确提高预算。':''}</div><div class="modal-actions">${over?`<button type="button" data-raise-budget class="outline">明确提高至 £${total.toFixed(2)}</button>`:''}<button type="button" data-close class="outline">取消</button><button type="button" data-save-shopping class="primary" ${over?'disabled':''}>保存购物单</button></div></div>`;};
    const paint=()=>{overlay.innerHTML=kind==='pantry'?pantryEditor():shoppingEditor();};paint();
    overlay.addEventListener('change',ev=>{const t=ev.target;if(t.matches('[data-pantry-index]')){const idx=Number(t.dataset.pantryIndex);draftPantry[idx]={...draftPantry[idx],amount:Math.max(0,Number(t.value)||0)};}if(t.matches('[data-reroll-reason]')){rerollReason=t.value;}if(t.matches('[data-plan-recipe]')){draftIds=t.checked?[...new Set([...draftIds,t.dataset.planRecipe])]:draftIds.filter(id=>id!==t.dataset.planRecipe);paint();}if(t.matches('[data-shopping-item]')){if(t.checked)draftExcluded.delete(t.dataset.shoppingItem);else draftExcluded.add(t.dataset.shoppingItem);paint();}if(t.id==='c-budget-input'){draftBudget=Math.max(0,Number(t.value)||0);paint();}});
    overlay.addEventListener('input',ev=>{if(ev.target.matches('[data-pantry-index]')){const idx=Number(ev.target.dataset.pantryIndex);draftPantry[idx]={...draftPantry[idx],amount:Math.max(0,Number(ev.target.value)||0)};}});
    overlay.addEventListener('submit',ev=>{if(ev.target.id!=='c-add-pantry')return;ev.preventDefault();const fd=new FormData(ev.target),id=String(fd.get('ingredientId')),amount=Number(fd.get('amount')),unit=defaultUnit(id);if(amount>0){const ix=draftPantry.findIndex(x=>x.ingredientId===id);if(ix>=0)draftPantry[ix]={ingredientId:id,amount:draftPantry[ix].amount+amount,unit};else draftPantry.push({ingredientId:id,amount,unit});paint();}});
    overlay.addEventListener('click',ev=>{const button=ev.target.closest('button');if(!button)return;if(button.hasAttribute('data-close')){close();return;}if(button.hasAttribute('data-random-recommend')){if(state.lastRecommendationId){rerollOpen=true;drawMessage='重抽前请先选择一个原因。';paint();return;}const result=recommendWithinBudget({budgetGBP:draftBudget});if(!result.ok){drawMessage=result.closest?`预算内没有符合的菜；最低可匹配估算 £${result.closest.costGBP.toFixed(2)}。`:'当前菜谱暂无完整商品匹配，无法随机推荐。';paint();return;}state.lastRecommendationId=result.recipe.id;draftIds=[...new Set([...draftIds,result.recipe.id])];drawMessage=`已推荐：${result.recipe.nameZh||result.recipe.nameEn} · £${result.costGBP.toFixed(2)}`;paint();return;}if(button.hasAttribute('data-confirm-reroll')){if(!rerollReason){drawMessage='请先选择重抽原因。';paint();return;}const result=recommendWithinBudget({budgetGBP:draftBudget,excludeRecipeIds:[state.lastRecommendationId]});if(!result.ok){drawMessage=result.closest?`没有其他菜符合预算；最低可匹配估算 £${result.closest.costGBP.toFixed(2)}。`:'没有其他菜可匹配预算和商品。';paint();return;}state.lastRerollReason=rerollReason;state.lastRecommendationId=result.recipe.id;draftIds=[...new Set([...draftIds,result.recipe.id])];drawMessage=`已按“${rerollReason}”重抽：${result.recipe.nameZh||result.recipe.nameEn} · £${result.costGBP.toFixed(2)}`;rerollOpen=false;rerollReason='';paint();return;}if(button.hasAttribute('data-pantry-remove')){draftPantry.splice(Number(button.dataset.pantryRemove),1);paint();return;}if(button.hasAttribute('data-save-pantry')){state.pantry=draftPantry.filter(x=>Number(x.amount)>0);persist();close();return;}if(button.hasAttribute('data-raise-budget')){const rows=shoppingRows().filter(x=>!x.excluded);draftBudget=sum(rows);state.budgetGBP=draftBudget;persist();paint();return;}if(button.hasAttribute('data-save-shopping')){const rows=shoppingRows().filter(x=>!x.excluded);const total=sum(rows);if(total>draftBudget){const msg=overlay.querySelector('.c-budget-message');if(msg)msg.textContent='请先调整购物单或明确提高预算。';return;}state.recipeIds=[...draftIds];state.excluded=[...draftExcluded];state.budgetGBP=draftBudget;persist();close();return;}});
    overlay.addEventListener('keydown',ev=>{if(ev.key==='Escape')close();});overlay.addEventListener('click',ev=>{if(ev.target===overlay)close();});return true;
  }
  return {getPantry,getBudgetSummary,getShoppingList,getSelectedSubstitutions:()=>({...state.substitutions}),selectSubstitution,recommendWithinBudget,openPantryEditor:()=>openEditor('pantry'),openShoppingEditor:()=>openEditor('shopping'),setPantryQuantity,setRecipeIds,setBudgetGBP,calculateShoppingList:calculate,getBudget:()=>state.budgetGBP};
}
