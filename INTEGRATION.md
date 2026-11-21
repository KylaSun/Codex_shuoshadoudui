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
- Substitution: `{id, recipeId, ingredientId, replacementIngredientId, replacementAmount:number, replacementUnit, flavourNote, equivalent:boolean, technique?}`。
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

## D 模块：本地自定义菜谱

- `src/custom-recipes.js` 负责本地存储和 Recipe 校验；`src/custom-recipes-page.js` 与 `src/custom-recipes.css` 负责列表和创建/编辑表单。A 的 `main.js` 仅接入 `custom-recipes` 路由、导航和页面挂载，复用 A 的 `data-recipe` 详情跳转。
- localStorage key：`hometaste.custom-recipes.v1`；内容为 `{version:1, recipes:Recipe[]}`。ID 使用 `custom-${crypto.randomUUID()}`，创建时生成、编辑时不变，与菜名无关。需要支持 `crypto.randomUUID()` 的现代浏览器（本地开发通过 localhost 访问）。
- 保存的 Recipe 字段为 `{id,nameZh,nameEn?,timeMinutes,ingredients:[{ingredientId,amount,unit}],steps:string[]}`。不维护第二套食材主数据：选项和保存校验均读取当前 `getIngredients()`。若 B 移除旧食材，已有菜谱仍可读取，编辑时提示重新选择有效食材后保存。
- `src/data.js` 导出的 `getRecipes()` **每次**先读当前 B 适配器（未接入时读 demo），再追加本地菜谱，不缓存或修改 B 返回的数组，也不包装或赋值 `window.DinnerAppAdapters.getRecipes`。因此 B 可在 D 加载前后注册或整体替换适配器。上游若意外出现相同 ID，列表优先使用 B 的记录，不产生重复 ID。
- 创建、编辑和删除在 localStorage 写入成功后均触发 `dinner:adapters-updated`。A 原有监听会刷新当前搜索/详情，D 表单草稿在该事件刷新时保留。失败不触发成功事件、不清空表单；损坏或未知版本的存储不覆盖，A 仍能读取 B/demo 菜谱，D 页面显示错误。
- 联调时，其他模块需要完整菜谱列表时应调用 `src/data.js` 导出的 `getRecipes()`。直接调用 `DinnerAppAdapters.getRecipes()` 仍只得到 B 的数据，这是为了不替换 B 适配器。C 的预算/购物单逻辑未修改，需要另行确认其支持 `custom-` ID、当前食材 ID 和用户填写的单位；D 不计算或伪造预算。

手动联调步骤：
1. 底部“我的菜谱”创建一条包含多食材、多步骤的菜谱；保存后列表可见，刷新后 ID 与内容保持不变。
2. 点击列表菜谱，检查 A 的详情、食材数量、步骤；按中文名、英文名和食材别名搜索均可找到。
3. 返回“我的菜谱”编辑名称、食材、步骤和时间，确认 ID 不变，旧名称搜索消失，新名称可搜索；编辑中取消不改动存储。
4. 删除时先取消确认，再确认删除；刷新后仍删除，内置菜谱仍可搜索和查看。
5. B 注册/替换适配器并触发更新事件后，检查 B 菜谱与自定义菜谱均保留，表单选项使用新的食材库；再联调 C 对自定义菜谱的预算与采购。
6. 在桌面和窄屏浏览器检查五个导航入口、表单布局、键盘操作、必填项校验和存储禁用时的提示。
