# A 模块集成说明

## 说明
本目录是原仓库为空时建立的独立前端。UI 由 A 负责；`src/demo-data.js` 是仅供接线和展示的最小示例，**不是 B 的权威数据**。不包含 C 的预算、库存扣减、整包计价或随机推荐算法；不包含 D 的图片解析/菜谱上传逻辑。

## 启动
安装 Node.js 20+。在目录中运行 `npm start`，浏览器打开 `http://localhost:5173`。无需安装第三方依赖。`npm test` 运行搜索和数据测试，`npm run build` 进行 JavaScript 语法检查（不产出构建目录）。

## 对接统一数据
在加载 `src/main.js` 之前设置 `window.DinnerAppAdapters`，例如：

```html
<script src="/team-adapters.js"></script>
<script type="module" src="/src/main.js"></script>
```

```js
window.DinnerAppAdapters = {
  getRecipes: () => recipeStore.list(),
  getIngredients: () => ingredientStore.list(),
  getProducts: () => productStore.list(),
  getSubstitutions: () => substitutionStore.list(),
  getPantry: () => kitchen.getPantry(),
  getBudgetSummary: (recipeId, selectedSubs) => shopping.quoteRecipe(recipeId, selectedSubs),
  getShoppingList: () => shopping.getList(),
  selectSubstitution: ({recipeId, ingredientId, substitutionId, flavourConfirmed}) => shopping.applySubstitution({recipeId, ingredientId, substitutionId, flavourConfirmed}),
  openPantryEditor: () => kitchen.openEditor(),
  openShoppingEditor: () => shopping.openEditor(),
};
window.dispatchEvent(new Event('dinner:adapters-updated'));
```

**必需字段（暂行，合并时优先对齐 B 的已有格式）**：
- Ingredient: `{id, nameZh, nameEn, aliases?: string[], category?, emoji?}`。
- Recipe: `{id, nameZh, nameEn?, emoji?, accent?, timeMinutes?, difficulty?, tags?: string[], description?, ingredients: [{ingredientId, amount:number, unit:string}], steps?: string[]}`。
- Product: `{id, ingredientId, nameEn, supermarket:'Tesco'|'Sainsbury’s', packageSize, priceGBP:number, recordedAt:'YYYY-MM-DD', url}`。
- Substitution: `{id, recipeId, ingredientId, replacementIngredientId, replacementAmount:number, replacementUnit, flavourNote, equivalent:boolean, suitability?:string, sourceUrls?:string[], technique?}`。
- Pantry: 数组 `[{ingredientId, amount, unit}]` 或对象 `{[ingredientId]:{amount,unit}}`。
- BudgetSummary: `{totalGBP:number,label?:string}`（**由 C 计算**）。
- ShoppingList: `[{ingredientId,nameZh?,amount?,unit?}]`（**由 C 计算/管理**）。

如果 B 的字段名不同，**在唯一的适配层完成映射**，不要修改 B 的原始结构或者在 A 中重复维护主数据。

## 行为与边界
- A: 真实中英搜索、菜谱和食材详情、底部导航、空状态、商品查看链接、替代品味道变化确认弹窗。确认后发给 C `selectSubstitution`，C 应计算替代后价格与购物单，A 刷新视图。C 可以返回 `false` 拒绝更改。
- A 不缓存 pantry / 自定义 recipe，也不展示计算出的虚假预算。B/C/D 应使用 localStorage 存储用户自己的数据，A 每次读取适配器。
- C 应在执行“重新随机推荐”前先要求选择原因；超过预算时必须允许修改购物单或明确提高预算。这些流程没有在 A 页面内伪造。
- B 商品目前是静态演示参考值，价格、日期**不代表已验证的真实商品报价**，链接为超市目录入口，不是具体 SKU 页面；正式 B 必须补全可靠记录和具体商品 URL。
- D 在 `getRecipes()` 合并进本地自定义菜谱，确保导入的菜谱能像内置菜谱一样被搜索与查看。
- 适配器替换后触发 `dinner:adapters-updated` 刷新视图。所有外链为新标签页并使用 `noopener noreferrer`。

## 手动验收
1. 首页搜索 `番茄`：同时出现菜谱和食材；搜索 `CHICKEN`：出现鸡肉盖饭及鸡肉食材。
2. 搜索不存在的内容：显示空状态；切换“全部/菜谱/食材”过滤器。
3. 点菜谱 → 查看食材、步骤、库存接入提示及预算接入提示；点击某个食材 → 查看 Tesco/Sainsbury’s 静态商品示例或“无商品匹配”。
4. 打开奶油蘑菇意面 → 将奶酪替代为牛奶：必须先确认味道变化，取消不生效，确认后显示“已选择”，可恢复原食材。
5. 底部首页/找菜/我的厨房/购物单导航可切换；没有 C 时显示诚实的未接入状态，不显示假预算或假购物单。
6. 集成 C 后：检查库存减少采购价、替代改变整包数量与金额、超预算时可调整。**这三项不在 A 独立版本内验证**。

## 替代规则展示
- `equivalent: false` 显示“味道有变化”，不会据此禁用替代选项。
- 选项和确认弹窗展示 B 提供的 `suitability` 字符串，未提供时显示“未标注”；具体取值待 B 数据契约同步后对齐。
- `sourceUrls` 可由适配器原样保留。替代比例仍为项目估算，商品价格仍为带记录日期的示例参考价。
