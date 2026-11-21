# B 模块：统一数据目录

从 `index.ts` 导入 `getRecipes()`、`getIngredients()`、`getProducts()`、`getSubstitutions()`。类型见 `types.ts`。这些数据不依赖网络或浏览器。

已核对远端 `origin/feature/a-ui-search:INTEGRATION.md`。A 要求通过 `window.DinnerAppAdapters` 提供无参的四个取数函数。B 的原始结构保留以下参数，浏览器适配层 `src/team-adapters.js` 负责映射给 A。

```ts
getRecipes(): Recipe[]
getIngredients(): Ingredient[]
getProducts(ingredientId?: string, supermarket?: 'Tesco' | 'Sainsburys'): Product[]
getSubstitutions(recipeId?: string, ingredientId?: string): Substitution[]
getProductSearchKeywords(ingredientId: string): string[]
```

无参数时前四个函数返回完整目录；有参数时筛选。`searchCatalog(query)` 返回 `{ recipes, ingredients }`，`getRecipesForIngredient(ingredientId)` 返回适用菜谱。

### 接入 A 的网页

浏览器直接加载已生成的 `src/data/catalog.js`。在 A 的 `index.html` 里，于 `src/main.js` 前加一行：

```html
<script type="module" src="./src/team-adapters.js"></script>
<script type="module" src="./src/main.js"></script>
```

适配层把 `quantity/minutes/packLabel/priceGbp/priceRecordedOn/productUrl` 映射为 A 文档中的 `amount/timeMinutes/packageSize/priceGBP/recordedAt/url`；替代规则按 `recipeIds` 展开为带 `recipeId` 的选项。组合替代的附加食材会写进 A 确认弹窗的 `technique`，C 必须继续使用原始 `extraReplacements` 计价。适配层只覆盖 B 的四个 getter，保留已注册的 C/D 方法。更新 `catalog.ts` 后在 Node 24 环境执行 `node scripts/build-browser-data.mjs` 重生浏览器 JS；团队运行网页时只需现成的 `catalog.js`，无需构建步骤。

首页若要突出本产品的重点，可用 `getFeaturedSpecialtyRecipes()` 展示 8 道需要中式食材且有明确替代方案的菜，不必按数组末尾位置硬编码。

地方风味入口可用 `getFeaturedRegionalRecipes()`，现有四川、陕西、上海、东北、武汉、云南、湖南、重庆、广东、厦门、扬州、新疆、南昌、哈尔滨等 16 道。`Recipe.region` 和 `Recipe.inspirationUrls` 是可选字段；A 适配层把 `region` 加入菜谱标签，自定义菜谱无需填写。新菜的名称、食材、步骤与相应替代规则复用相同的 `getRecipes()` / `getSubstitutions()` 契约。鱼香肉丝、酸辣粉、腊肠饭等保留了决定菜品口味的中式原料；若替换后已不是原菜，规则的 `tasteDifference` 和 `suitability: 'variant'` 会说明。为突出地方口味，已移除 13 道重复的普通菜。

网络流行菜入口可用 `getFeaturedViralRecipes()`，目前有公瑾爆蛋盖饭（熟蛋版）、雪碧酸辣拌面、抱蛋煎饺和可乐鸡翅饭。四道菜也都通过 `getRecipes()` 出现在普通搜索中，A 适配层加上“网络流行菜”标签。公瑾爆蛋的白醋目前没有已核实的同款示例商品；用户可保留英文采购名，或确认味道变化后选择苹果醋。公瑾爆蛋换苹果醋、雪碧拌面换麦芽醋与 tahini、抱蛋煎饺换麦芽醋后，以及原版可乐鸡翅饭，均有经校验的 Tesco 整包示例商品路径。抱蛋煎饺两人份需要 16 个，示例商品每包 12 个，因此采购需按两包计算。逐条参考资料与商品价格记录见 [SOURCES.md](./SOURCES.md)。

- 菜谱的 `ingredients[].quantity` 和商品的 `packQuantity` 都使用对应食材的标准单位：`g`、`ml` 或 `each`。同一种食材只保留一个 ID 和单位。
- `substitutions` 仅能在 `recipeIds` 所列菜中使用。选择后，新用量 = 原用量 × `quantityRatio`，**按替代食材的单位解释**。界面应先让用户确认 `tasteDifference`，再应用替代。
- 部分中式调味料需要组合替代：`extraReplacements` 列出额外食材及其相对原用量的比例。C 应调用 `resolveSubstitution(recipeIngredient, substitution)` 取得完整替代食材数组，再扣库存、匹配商品并计价，不能只处理 `replacementId`。
- 例如麻婆豆腐饭中的 25g 郫县豆瓣酱可得到 20g 味噌酱 + 5g 辣椒酱，也可试 20g 韩式辣酱。花椒没有普通超市商品匹配，也没有等价替代规则；应提示去亚洲超市核对或换菜。
- `featuredSpecialtyRecipeIds` 中的 8 道菜是“中式食材难在普通超市找到同款”主题；其中蒜苗肉末盖饭、韭菜炒蛋盖饭、香菇鸡肉汤面、甜面酱肉末拌面在选择相应替代方案后，已校验每项均有 Tesco 示例商品。麻婆豆腐饭仍缺花椒商品，需显示通用英文名和搜索词，不能把金额视为完整结账价。原始中式食材仍保留，用户可以去亚洲超市寻找，不应自动替换。
- `getProducts` 返回匹配的示例商品；空数组表示「暂无匹配商品」，购物单仍可使用 `Ingredient.nameEn` 并展示 `getProductSearchKeywords(ingredientId)`。搜索词供用户手动去超市查找，不代表商品已匹配。应以整包 `packQuantity` 计算采购数量。
- `demoReady: true` 的前五道菜有 Tesco 商品匹配和至少一项上下文替代；Sainsburys 目前只有少量示例，其他菜也可能缺商品。不能把缺商品当作零价格或实时无货。
- `source: 'custom'` 的菜谱由 D 保存在浏览器本地；可复用 `Recipe` 和 `RecipeIngredient`，自定义食材也应遵循 `Ingredient` 字段。
- D 可从浏览器模块 `src/data/catalog.js` 导入并调用 `setCustomRecipeProvider(() => loadLocalRecipes())`。随后 A 通过适配层调用的 `getRecipes()` 会包含本地菜谱；B 不直接读写 `localStorage`。D 需要处理自定义菜谱 ID 与内置 ID 的冲突。若 D 另有自定义食材，也需扩展 `getIngredients()`。
- 商品价格为手工整理的演示参考值，`priceRecordedOn` 为目录记录日期；不代表实时售价或库存。展示时附上 `PRICE_NOTICE`，链接仅供用户到原商品页核对。

## 数据来源与边界

- 菜名、简介、食材用量、做法及适用场景均为本项目原创编写。替代比例和味道变化是厨房演示建议，未作为营养等价或过敏原替代建议。每条规则都标记 `equivalent: false`，由用户确认差异后才应用。
- 有外部烹饪资料支持的替代关系附 `sourceUrls`，并用 `suitability` 区分相近、功能替代和改菜变体。`sourceUrls` 支持食材搭配，不代表资料验证过本项目的克数比例。A 应显示该分级，不应把全部 `equivalent: false` 简写成“不可用”；`false` 仅表示风味并非完全相同。逐条来源及推断界限见 [SOURCES.md](./SOURCES.md)。
- 商品英文名、规格和参考价由人工查看超市公开页面整理；逐条商品页、规格和记录价见 [SOURCES.md](./SOURCES.md)。没有批量抓取。
- `priceRecordedOn` 记录人工查看页面并录入参考价的日期，并非超市承诺的报价时间。进入结账前必须由用户到商品页核对。

运行 `node src/data/validate.mjs` 校验原始数据，`node --test src/data/a-contract.test.mjs` 校验 A 的适配契约。
