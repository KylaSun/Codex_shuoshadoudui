import {createRecipeVideoGate} from './recipe-video-gate.js';
import {getRecipes,getIngredients,ingredientById,searchCatalog,productsFor,substitutionsFor,getPantry,getBudgetSummary,getShoppingList,adapters} from './data.js';

import {customRecipesPage,mountCustomRecipesPage} from './custom-recipes-page.js';
import {recipeArt} from './recipe-art.js';
import {icon} from './illustrated-icons.js';

const root=document.getElementById('app');
const videoGate=createRecipeVideoGate(root);
const state={page:'home',query:'',filter:'all',shoppingView:'recipe',recipeId:null,ingredientId:null,selectedSubs:window.DinnerAppAdapters?.getSelectedSubstitutions?.()||{},pendingSub:null,notice:''};
let noticeTimer;
function scheduleNoticeDismiss(){
 clearTimeout(noticeTimer);
 if(!state.notice)return;
 const shown=state.notice;
 noticeTimer=setTimeout(()=>{
  if(state.notice!==shown)return;
  state.notice='';
  root.querySelector('.toast')?.remove?.();
 },3200);
 noticeTimer.unref?.();
}
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const i18n=id=>ingredientById(id)?.nameZh||id;
const money=n=>Number.isFinite(Number(n))?'£'+Number(n).toFixed(2):'价格待接入';
const suitability=o=>({functional:'作用相近',partial:'部分适用',equivalent:'较接近',contextual:'按做法适用'}[o.suitability]||o.suitability||'按做法适用');
const flavourLabel=o=>o.equivalent===false?'味道有变化':o.equivalent===true?'可等价替代':'等价性未标注';
const regionOf=r=>r.region||['四川','陕西','东北','武汉','上海','湖南','广东','云南','重庆','新疆','厦门','扬州','南昌','哈尔滨'].find(name=>r.nameZh?.includes(name))||'家乡';
const img=r=>{
 const src=recipeArt(r.id);
 return src
  ?`<div class="food-art food-art--illustration"><img src="${src}" alt="${e(r.nameZh)}水彩插画" loading="lazy" decoding="async"/></div>`
  :`<div class="food-art food-art--type" aria-hidden="true"><span class="food-art-region">${e(regionOf(r))}味</span><span class="food-art-title">${e(r.nameZh?.slice(0,4)||'今晚吃饭')}</span><span class="food-art-seal">饭乡</span></div>`;
};
const nav=(page,label)=>`<button data-go="${page}" class="nav-button ${state.page===page?'active':''}" aria-label="${label}" ${state.page===page?'aria-current="page"':''}>${icon(page==='custom-recipes'?'recipes':page,'nav-icon')}<small>${label}</small></button>`;
const header=()=>`<header class="topbar"><button class="brand" data-go="home" aria-label="饭乡，回到首页">${icon('brand','brandmark')}<span class="wordmark">饭乡<small>FANXIANG</small></span></button><span class="top-right">给在英国的中国胃 <span class="status-dot"></span></span></header>`;
const blockedIngredientIds=()=>adapters().getBlockedIngredientIds?.()||[];
const recipeIsBlocked=r=>r.ingredients?.some(item=>blockedIngredientIds().includes(item.ingredientId));
const search=()=>`<div class="search-with-blocking"><form id="search-form" role="search" class="search-box">${icon("search","search-paint")}<input id="query" type="search" placeholder="想吃什么？搜菜名或食材" aria-label="搜索菜谱或食材" value="${e(state.query)}" autocomplete="off"/><button aria-label="执行搜索" type="submit">找菜</button></form>${typeof adapters().openBlockedIngredientsEditor==='function'?`<button type="button" class="blocked-search-trigger" data-open-blocked>屏蔽食材${blockedIngredientIds().length?`（${blockedIngredientIds().length}）`:''} ↗</button>`:''}</div>`;
const recipeCard=r=>`<button class="recipe-card" data-recipe="${e(r.id)}">${img(r)}<span class="recipe-body"><span class="recipe-region">${e(regionOf(r))} · 家乡味</span><strong>${e(r.nameZh)}</strong><span class="en-name">${e(r.nameEn||'')}</span><span class="meta">${e(r.timeMinutes||'?')} 分钟 <span>·</span> ${e(r.difficulty||'')} <span>·</span> ${e(r.servings||2)} 人份</span></span><span class="card-arrow" aria-hidden="true">↗</span></button>`;
const ingredientArt = Object.fromEntries(Object.entries({
 tomato:['tomato'],broccoli:['broccoli'],carrot:['carrot'],potato:['potato'],
 onion:['onion'],mushroom:['mushroom','dried_shiitake','fresh_shiitake','wood_ear'],
 pepper:['pepper','hot_green_pepper'],cabbage:['cabbage','sauerkraut'],
 chicken:['chicken','chicken_wings'],meat:['beef','pork_mince','pork_strips','pork_belly','ham','chinese_sausage','prawns'],
 tofu:['tofu'],egg:['egg'],rice:['rice'],grain:['chickpeas','peas','roasted_peanuts','sugar'],
 leaf:['spinach','chinese_chives','garlic_shoots','spring_onion','preserved_mustard','yunnan_pickles','gherkins','cucumber','aubergine','zhacai'],
 noodles:['noodles','rice_noodles','rice_vermicelli','sweet_potato_noodles','frozen_dumplings'],
 bottle:['soy_sauce','dark_soy','oil','chinkiang_vinegar','cider_vinegar','malt_vinegar','white_vinegar','shaoxing_wine','tomato_ketchup','cola','sprite','garlic_paste'],
 spice:['garlic','ginger','doubanjiang','sichuan_pepper','dried_red_chilli','chilli_flakes','chilli_paste','gochujang','sweet_bean_sauce','hoisin_sauce','sesame_paste','tahini','miso','black_pepper','star_anise','pickled_radish']
}).flatMap(([art,ids])=>ids.map(id=>[id,art])));
const ingredientIcon=x=>icon(ingredientArt[x?.id]||({staple:'grain',meat_egg:'egg',vegetable:'leaf',seasoning:'spice'})[x?.category]||'leaf','ingredient-paint');
const ingredientCard=x=>`<button class="ingredient-card" data-ingredient="${e(x.id)}"><span class="ingredient-icon">${ingredientIcon(x)}</span><span><strong>${e(x.nameZh)}</strong><small>${e(x.nameEn||'')}</small></span><span class="card-arrow">↗</span></button>`;
const recipeGrid=rs=>`<div class="recipe-grid">${rs.map(recipeCard).join('')}</div>`;
const filterBar=()=>`<div class="filters" role="group" aria-label="筛选搜索类别">${[['all','全部'],['recipe','菜谱'],['ingredient','食材']].map(([k,n])=>`<button data-filter="${k}" class="chip ${state.filter===k?'chosen':''}" aria-pressed="${state.filter===k}">${n}</button>`).join('')}</div>`;
const empty=(title,detail)=>`<section class="empty-state">${icon('empty','empty-icon')}<h3>${e(title)}</h3><p>${e(detail)}</p><button class="outline" data-go="home">返回首页</button></section>`;
function shoppingUnavailableTip(){
 const list=getShoppingList(),groups=adapters().getShoppingRecipeGroups?.()||[];
 if(!Array.isArray(list)||!groups.length)return '';
 const unresolved=list.filter(row=>row.unmatched&&!groups.some(group=>substitutionsFor(group.recipeId,row.ingredientId).length));
 if(!unresolved.length)return '';
 const names=unresolved.slice(0,3).map(row=>row.nameZh||i18n(row.ingredientId)).join('、')+(unresolved.length>3?`等 ${unresolved.length} 种`:'');
 return `<aside class="home-unpriced-tip" aria-label="购物提醒"><div><strong>购物提醒</strong><p>${e(names)}暂无经过菜谱校对的可计价替代。请核对原食材价格；购物单总额暂不完整。</p></div><button type="button" data-go="shopping">查看购物单 →</button></aside>`;
}
function home(){const rs=getRecipes().filter(r=>!recipeIsBlocked(r));const featured=['mapo-tofu','shaanxi-hot-oil-noodles','northeast-di-san-xian','wuhan-sesame-noodles','sichuan-kung-pao-chicken','shanghai-red-braised-pork'].map(id=>rs.find(r=>r.id===id)).filter(Boolean);return `<section class="hero"><div class="hero-copy"><div class="eyebrow">饭乡 · 在英国，也能做家乡菜</div><h1>今晚，<br/>吃口<span>家乡味。</span></h1><p>想念哪一口，就从这里找起。缺了熟悉的食材，也有适合这道菜的替代办法。</p>${search()}<div class="hero-tip">试试搜索 <button data-query="麻婆豆腐">麻婆豆腐</button><button data-query="油泼面">油泼面</button><button data-query="韭菜">韭菜</button></div></div><div class="hero-visual" role="img" aria-label="麻婆豆腐饭水彩插画"><span class="hero-stamp">一口就到家</span></div></section>${shoppingUnavailableTip()}<section class="quick-links"><button data-go="search" class="quick"><span class="quick-number">01</span><span class="quick-content"><strong>按家乡找菜</strong><small>找想念的那一道</small></span><span class="link-arrow" aria-hidden="true">↗</span></button><button data-go="pantry" class="quick"><span class="quick-number">02</span><span class="quick-content"><strong>看看家里有啥</strong><small>从现有食材开始</small></span><span class="link-arrow" aria-hidden="true">↗</span></button></section><section class="section region-section"><div class="section-heading"><div><span class="overline">FIND YOUR HOMETOWN FLAVOUR</span><h2>从哪一口开始？</h2></div></div><div class="region-list">${['四川','陕西','东北','武汉','上海','湖南'].map(region=>`<button data-query="${region}">${region}<span aria-hidden="true">↗</span></button>`).join('')}</div></section><section class="section"><div class="section-heading"><div><span class="overline">COOK SOMETHING FAMILIAR</span><h2>今天想吃的家乡菜</h2></div><button data-go="search" class="text-button">全部菜谱 ↗</button></div>${featured.length?recipeGrid(featured):empty('还没有菜谱','请 B 模块提供菜谱数据。')}</section><div class="footer-note">饭乡 · 给在英国认真吃饭的你</div>`;}
function results(){const found=searchCatalog(state.query,state.filter);const recipes=found.recipes.filter(r=>!recipeIsBlocked(r)),ingredients=found.ingredients;const any=recipes.length+ingredients.length;return `<section class="inner-page"><div class="overline">FIND YOUR DINNER</div><h1 class="page-title">找点<span class="highlight">好吃的</span></h1>${search()}${filterBar()}<div class="result-count">${state.query?`“${e(state.query)}” 的搜索结果`:'全部菜谱与食材'} <b>${any}</b></div>${!any?empty('没找到相关结果','试试其他菜名或取消屏蔽食材。'):''}${recipes.length?`<div class="section-heading"><h2>菜谱 <span class="count">${recipes.length}</span></h2></div>${recipeGrid(recipes)}`:''}${ingredients.length?`<div class="section-heading spaced"><h2>食材 <span class="count">${ingredients.length}</span></h2></div><div class="ingredient-grid">${ingredients.map(ingredientCard).join('')}</div>`:''}</section>`;}
function productList(id){const ps=productsFor(id);return ps.length?`<div class="products">${ps.map(p=>`<article class="product"><div class="product-head"><span class="store ${p.supermarket==='Tesco'?'tesco':'sains'}">${e(p.supermarket||'超市')}</span><strong>${money(p.priceGBP)}</strong></div><h4>${e(p.nameEn||'')}</h4><div class="product-bottom"><small>${e(p.packageSize||'规格未知')} · 参考价记录 ${e(p.recordedAt||'日期未知')}</small>${p.url?`<a href="${e(p.url)}" target="_blank" rel="noopener noreferrer">查看商品页 ↗</a>`:''}</div></article>`).join('')}</div><p class="disclaimer">商品价格仅为带记录日期的示例参考价，非实时价格或库存。链接可能指向超市目录页。</p>`:`<div class="subtle-empty">${icon("shopping","inline-icon")} 暂无匹配商品。可以查看其他食材，或等待 B 模块补充商品数据。</div>`;}
function substituteOptions(recipeId,item){const options=substitutionsFor(recipeId,item.ingredientId);const selected=state.selectedSubs[`${recipeId}:${item.ingredientId}`];return options.length?`<div class="sub-options"><span class="mini-label">可选替代</span>${options.map(o=>`<button class="sub-option ${selected===o.id?'picked':''}" data-sub="${e(o.id)}"><span><b>${e(i18n(o.replacementIngredientId))}</b><small>${e(o.replacementAmount)} ${e(o.replacementUnit)} · ${flavourLabel(o)} · 适用等级：${e(suitability(o))}</small></span><span>${selected===o.id?'✓ 已选择':'选择 ↗'}</span></button>`).join('')}<small>替代比例为项目估算。</small>${selected?`<button class="reset-sub" data-reset-sub="${e(item.ingredientId)}">恢复原食材</button>`:''}</div>`:'';}
function recipeDetail(){const r=getRecipes().find(x=>x.id===state.recipeId);if(!r)return empty('菜谱不存在','请从首页重新选择菜谱。');let summary=getBudgetSummary(r.id,state.selectedSubs);return `<section class="detail"><button class="back" data-back>← 返回</button><div class="detail-hero">${img(r)}<div class="detail-heading"><span class="overline">TONIGHT'S PICK</span><h1>${e(r.nameZh)}</h1><p>${e(r.nameEn||'')}</p><div class="tags"><span>约 ${e(r.timeMinutes||'?')} 分钟</span><span>${e(r.difficulty||'')}</span>${(r.tags||[]).map(t=>`<span>${e(t)}</span>`).join('')}</div></div></div><p class="desc">${e(r.description||'')}</p><div class="detail-section"><h2>需要准备什么 <small>INGREDIENTS</small></h2><div class="ingredient-rows">${(r.ingredients||[]).map(item=>`<div class="ingredient-row"><button data-ingredient="${e(item.ingredientId)}" class="row-main"><span class="row-emoji">${ingredientIcon(ingredientById(item.ingredientId))}</span><span><b>${e(i18n(item.ingredientId))}</b><small>${e(ingredientById(item.ingredientId)?.nameEn||'')}</small></span><strong>${e(item.amount)} ${e(item.unit)}</strong><span class="card-arrow">↗</span></button>${substituteOptions(r.id,item)}</div>`).join('')}</div></div><div class="detail-section"><h2>怎么做 <small>METHOD</small></h2><ol class="steps">${(r.steps||[]).map(s=>`<li>${e(s)}</li>`).join('')}</ol></div><div class="detail-section"><h2>预算 & 购物单 <small>整包参考价</small></h2>${summary?`<div class="budget-result"><b>${Number.isFinite(summary.totalGBP)?money(summary.totalGBP):`已匹配商品小计 ${money(summary.knownSubtotalGBP||0)}`}</b><span>${e(summary.label||'根据已有食材与选择的替代品计算')}</span></div>`:`<div class="integration-note">${icon("shopping","inline-icon")} 预算和整包采购计算由 C 模块提供。接入后会自动在这里展示结果，A 不使用假金额。</div>`}<button class="primary" data-go="shopping">去看购物单 →</button></div></section>`;}
function ingredientDetail(){const x=ingredientById(state.ingredientId);if(!x)return empty('食材不存在','请返回重新搜索。');const rs=getRecipes().filter(r=>r.ingredients?.some(t=>t.ingredientId===x.id));return `<section class="detail ingredient-detail"><button class="back" data-back>← 返回</button><div class="ingredient-banner"><span class="banner-icon">${ingredientIcon(x)}</span><div><span class="overline">INGREDIENT LIBRARY</span><h1>${e(x.nameZh)}</h1><p>${e(x.nameEn||'')}</p></div></div><div class="detail-section"><h2>超市参考商品 <small>TESCO / SAINSBURY’S</small></h2>${productList(x.id)}</div><div class="detail-section"><h2>用它做点什么 <small>RECIPES</small></h2>${rs.length?recipeGrid(rs):'<p class="muted">暂无关联菜谱。</p>'}</div></section>`;}
function pantryPage(){const pantry=getPantry();let rows=pantry===null?null:Array.isArray(pantry)?pantry:Object.entries(pantry).map(([id,v])=>({ingredientId:id,...v}));return `<section class="inner-page"><div class="overline">YOUR KITCHEN</div><h1 class="page-title">我的<span class="highlight">厨房</span> ${icon("pantry","title-icon")}</h1>${rows===null?`<div class="integration-note">厨房功能暂不可用。</div>`:rows.length?`<div class="ingredient-rows">${rows.map(x=>`<div class="pantry-entry"><b>${e(i18n(x.ingredientId||x.id))}</b><span>${e(x.amount??x.quantity??'')} ${e(x.unit||'')}</span></div>`).join('')}</div>`:'<div class="subtle-empty">你的厨房还是空的。</div>'}${typeof adapters().openPantryEditor==='function'?'<button class="primary" id="open-pantry">管理库存 →</button>':''}<button class="outline" data-go="search">寻找食材 →</button></section>`;}
function shoppingPage(){
 const list=getShoppingList();
 const groups=adapters().getShoppingRecipeGroups?.()||[];
 const missing=list?.filter(x=>x.unmatched)||[];
 const total=list?.reduce((sum,x)=>sum+(Number(x.costGBP)||0),0)||0;
 const recipeView=groups.length?`<div class="shopping-recipes">${groups.map(group=>`<section class="shopping-recipe"><div class="shopping-recipe-head"><h2>${e(group.nameZh)}</h2><button type="button" data-remove-shopping-recipe="${e(group.recipeId)}" aria-label="从购物单删除 ${e(group.nameZh)}">删除菜品</button></div><ul>${group.ingredients.length?group.ingredients.map(row=>`<li><span>${e(row.nameZh||i18n(row.ingredientId))}</span><b>${e(row.amount)} ${e(row.unit)}</b></li>`).join(''):'<li class="shopping-no-ingredients">这道菜的食材已从购物单移除。</li>'}</ul></section>`).join('')}</div>`:'<div class="subtle-empty">还没有添加菜品。点击下方按钮选择今晚要做的菜。</div>';
 const ingredientView=list?.length?`<div class="shopping-ingredients">${list.map(row=>`<div class="shopping-ingredient"><div><b>${e(row.nameZh||i18n(row.ingredientId))}</b><small>${e(row.amount??'')} ${e(row.unit||'')}${row.product?` · ${e(row.product.supermarket)} 整包 × ${e(row.packageCount)} · ${money(row.costGBP)}`:' · 暂无匹配商品'}</small></div><button type="button" data-remove-shopping-ingredient="${e(row.ingredientId)}" data-unit="${e(row.unit||'')}" aria-label="从购物单删除 ${e(row.nameZh||i18n(row.ingredientId))}">删除</button></div>`).join('')}</div>`:'<div class="subtle-empty">购物单暂无需要采购的食材。</div>';
 const substitutionChoices=missing.map(item=>{
  const choices=groups.flatMap(group=>substitutionsFor(group.recipeId,item.ingredientId).map(rule=>({group,rule})));
  return `<div class="shopping-unpriced-item"><strong>${e(item.nameZh||i18n(item.ingredientId))}</strong>${choices.length?`<div class="shopping-sub-choices">${choices.map(({group,rule})=>`<button type="button" data-sub="${e(rule.id)}" data-sub-recipe="${e(group.recipeId)}">${groups.length>1?`${e(group.nameZh)}：`:''}改用 ${e(i18n(rule.replacementIngredientId))} · ${flavourLabel(rule)}</button>`).join('')}</div>`:'<small>暂无经过菜谱校对的可计价替代；此项仍需自行核对价格。</small>'}</div>`;
 }).join('');
 const budgetView=list?.length?`<div class="budget-result shopping-budget"><small>${missing.length?'已匹配商品小计':'预计采购总金额'}</small><b>${money(total)}</b><span>${missing.length?`另有 ${missing.length} 项未计价，完整金额未知。确认可用替代后会立即重算。`:'已扣除已有食材；按整包参考价计算，结账前请核对。'}</span></div>${missing.length?`<section class="shopping-unpriced"><h2>未计价食材 · 可选替代</h2>${substitutionChoices}</section>`:''}`:'';
 return `<section class="inner-page shopping-page"><div class="overline">SHOPPING TIME</div><h1 class="page-title">我的<span class="highlight">购物单</span> ${icon('shopping','title-icon')}</h1>${list===null?'<div class="integration-note">购物单暂不可用。</div>':`<div class="shopping-view-switch" role="group" aria-label="购物单显示方式"><button type="button" data-shopping-view="recipe" aria-pressed="${state.shoppingView==='recipe'}" class="${state.shoppingView==='recipe'?'active':''}">按菜品</button><button type="button" data-shopping-view="ingredient" aria-pressed="${state.shoppingView==='ingredient'}" class="${state.shoppingView==='ingredient'?'active':''}">按食材</button></div>${state.shoppingView==='recipe'?recipeView:ingredientView}${budgetView}`}${typeof adapters().openShoppingEditor==='function'?'<button class="primary" id="open-shopping">添加 / 调整菜品与食材 →</button>':''}<button class="outline" data-go="search">继续选菜 →</button></section>`;
}
function modal(){const sub=state.pendingSub;if(!sub)return '';const o=sub.rule;return `<div class="modal-backdrop" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading"><div class="modal-icon">${icon("spice","modal-paint")}</div><h2 id="modal-heading">确认这次味道变化？</h2><p>将 <b>${e(i18n(o.ingredientId))}</b> 换成 <b>${e(i18n(o.replacementIngredientId))}</b>（${e(o.replacementAmount)} ${e(o.replacementUnit)}）。</p><div class="flavour"><strong>${flavourLabel(o)}</strong><span>适用等级：${e(suitability(o))}</span><span>${e(o.flavourNote)}</span><small>替代比例为项目估算，请按实际口味和烹饪情况调整。</small><small>${e(o.technique||'')}</small></div><div class="modal-actions"><button class="outline" data-cancel-sub>不替换</button><button class="primary" data-confirm-sub>我接受味道变化 →</button></div></div></div>`;}
function render(){videoGate.visit(state.page,state.recipeId);const content=state.page==='home'?home():state.page==='search'?results():state.page==='recipe'?recipeDetail():state.page==='ingredient'?ingredientDetail():state.page==='pantry'?pantryPage():state.page==='custom-recipes'?customRecipesPage():shoppingPage();root.innerHTML=`<div class="shell">${header()}<main id="main">${content}</main><nav class="bottom-nav" aria-label="主导航">${nav('home','首页')}${nav('search','找菜')}${nav('pantry','我的厨房')}${nav('shopping','购物单')}${nav('custom-recipes','我的菜谱')}</nav>${state.notice?`<div class="toast" role="status">${e(state.notice)}</div>`:''}${modal()}</div>`;mountCustomRecipesPage(root);if(state.pendingSub){const button=root.querySelector('[data-confirm-sub]');button?.focus();}scheduleNoticeDismiss(); }
function go(page){state.page=page;state.pendingSub=null;state.notice='';history.pushState({page},'',`#${page}`);render();window.scrollTo(0,0);}
root.addEventListener('submit',ev=>{if(ev.target.id!=='search-form')return;ev.preventDefault();state.query=ev.target.querySelector('input').value.trim();state.filter='all';go('search');});
root.addEventListener('click',ev=>{
 const el=ev.target.closest('button');if(!el)return;
 if(el.dataset.query){state.query=el.dataset.query;state.filter='all';go('search');return;}
 if(el.dataset.go){go(el.dataset.go);return;}
 if(el.dataset.recipe){state.recipeId=el.dataset.recipe;go('recipe');return;}
 if(el.dataset.ingredient){state.ingredientId=el.dataset.ingredient;go('ingredient');return;}
 if(el.dataset.filter){state.filter=el.dataset.filter;render();return;}
 if(el.dataset.shoppingView){state.shoppingView=el.dataset.shoppingView;render();return;}
 if(el.hasAttribute('data-open-blocked')){adapters().openBlockedIngredientsEditor?.();return;}
 if(el.dataset.removeShoppingRecipe){adapters().removeShoppingRecipe?.(el.dataset.removeShoppingRecipe);return;}
 if(el.dataset.removeShoppingIngredient){adapters().removeShoppingIngredient?.(el.dataset.removeShoppingIngredient,el.dataset.unit);return;}
 if(el.hasAttribute('data-back')){if(history.length>1)history.back();else go('search');return;}
 if(el.dataset.sub){const recipeId=el.dataset.subRecipe||state.recipeId;const all=getRecipes().find(x=>x.id===recipeId)?.ingredients||[];const rules=all.flatMap(x=>substitutionsFor(recipeId,x.ingredientId));const rule=rules.find(x=>x.id===el.dataset.sub);if(rule){state.pendingSub={rule,recipeId};render();}return;}
 if(el.hasAttribute('data-cancel-sub')){state.pendingSub=null;render();return;}
 if(el.hasAttribute('data-confirm-sub')){const rule=state.pendingSub?.rule,recipeId=state.pendingSub?.recipeId;if(!rule||!recipeId)return;const key=`${recipeId}:${rule.ingredientId}`;const cb=adapters().selectSubstitution;try{if(typeof cb==='function'){const accepted=cb({recipeId,ingredientId:rule.ingredientId,substitutionId:rule.id,flavourConfirmed:true});if(accepted===false){state.notice='替代失败，请检查库存或规则';state.pendingSub=null;render();return;}}state.selectedSubs[key]=rule.id;state.notice='已确认味道变化并选择替代品';}catch(error){console.error(error);state.notice='替代未保存，请重试';}state.pendingSub=null;render();return;}
 if(el.dataset.resetSub){const key=`${state.recipeId}:${el.dataset.resetSub}`;try{adapters().selectSubstitution?.({recipeId:state.recipeId,ingredientId:el.dataset.resetSub,substitutionId:null,flavourConfirmed:true});delete state.selectedSubs[key];state.notice='已恢复原食材';}catch{state.notice='恢复失败';}render();return;}
 if(el.id==='open-pantry'){adapters().openPantryEditor?.();return;}
 if(el.id==='open-shopping'){adapters().openShoppingEditor?.();return;}
});
window.addEventListener('popstate',event=>{state.page=event.state?.page||location.hash.substring(1)||'home';render();});
window.addEventListener('dinner:adapters-updated',render);
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.pendingSub){state.pendingSub=null;render();}});
if(['home','search','recipe','ingredient','pantry','shopping','custom-recipes'].includes(location.hash.substring(1)))state.page=location.hash.substring(1);
render();
