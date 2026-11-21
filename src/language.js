import {substitutionEnglish} from './substitution-english.js';
import {uiEnglish} from './translations.js';
import {recipeEnglish} from './recipe-english.js';
import {recipes, ingredients} from './data/catalog.js';

const dictionary = {...uiEnglish, ...substitutionEnglish};
for (const item of ingredients) if(item.nameEn) dictionary[item.nameZh] = item.nameEn;
for (const recipe of recipes) {
  const english = recipeEnglish[recipe.id];
  if (!english) continue;
  dictionary[recipe.nameZh] = english[0];
  if (recipe.description) dictionary[recipe.description] = english[1];
  recipe.steps?.forEach((step, i) => { if(english[i+2]) dictionary[step] = english[i+2]; });
}
const keys = Object.keys(dictionary).sort((a,b) => b.length-a.length);
const pattern = new RegExp(keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
export function translateText(text, language = 'en') {
  return language === 'en' ? text.replace(pattern, key => dictionary[key]) : text;
}

export function initLanguage(doc = document, storage) {
  let language = 'zh';
  try { if(storage?.getItem('fanxiang.language') === 'en') language = 'en'; } catch {}
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const config = {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['placeholder','aria-label','alt','title']};
  let observer;
  const apply = () => {
    observer?.disconnect();
    doc.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    doc.title = language === 'en' ? 'Fanxiang · A taste of home in the UK' : '饭乡 · 在英国，吃口家乡味';
    const walk = node => {
      if(node.nodeType === 3) {
        if(node.parentElement?.closest('script,style,textarea,[data-no-translate],.wordmark,.c-spin-wheel-center')) return;
        const saved = originals.get(node);
        const original = saved && node.data === saved.rendered ? saved.original : node.data;
        const rendered = translateText(original, language);
        if(node.data !== rendered) node.data = rendered;
        originals.set(node,{original,rendered});
      } else if(node.nodeType === 1) {
        if(node.matches('script,style,textarea,[data-no-translate]')) return;
        const saved = attributes.get(node) || {};
        for(const name of ['placeholder','aria-label','alt','title']) {
          if(!node.hasAttribute(name)) continue;
          const value = node.getAttribute(name), old = saved[name];
          const original = old && value === old.rendered ? old.original : value;
          const rendered = translateText(original,language);
          if(value !== rendered) node.setAttribute(name,rendered);
          saved[name] = {original,rendered};
        }
        attributes.set(node,saved);
        for(const child of node.childNodes) walk(child);
      }
    };
    walk(doc.body);
    for(const button of doc.querySelectorAll('[data-language]')) button.setAttribute('aria-pressed',String(button.dataset.language === language));
    observer?.observe(doc.body,config);
  };
  observer = new MutationObserver(apply);
  doc.addEventListener('click', event => {
    const button = event.target.closest?.('[data-language]');
    if(!button) return;
    language = button.dataset.language === 'en' ? 'en' : 'zh';
    try { storage?.setItem('fanxiang.language',language); } catch {}
    apply();
  });
  // Translate in place: keep form values, event handlers, video playback and drafts intact.
  apply();
  return {setLanguage(value) {language=value === 'en'?'en':'zh';apply();},disconnect(){observer.disconnect();}};
}
if (typeof document !== 'undefined' && document.body) {
  let storage; try {storage=window.localStorage;} catch {}
  initLanguage(document,storage);
}
