# 饭乡 · Module A/B Demo

英国中国留学生晚餐决策 Demo 的 A 模块：首页、搜索、菜谱/食材详情、底部导航、展示示例商品及味道变化确认。**不包含 C 的预算计算和购物单业务逻辑。**

## Quick start

Requires Node.js 20+:

```bash
npm start
# visit http://localhost:5173
npm test
npm run build
```

No `npm install` required. B's built-in catalog is loaded from `src/data/catalog.js`; `src/demo-data.js` remains A's fallback. See [INTEGRATION.md](INTEGRATION.md) for B/C/D module adapter contracts and end-to-end acceptance steps.

The six regional dish images in `assets/regional-dishes.jpg` were generated for this demo and are illustrative. The remaining recipe cards use typographic artwork so that an unrelated dish photo is not mistaken for the recipe.

The supermarket prices are fictional/illustrative static entries with recorded dates; they are **not** live prices, verified historical prices, or stock availability. Product links may point to supermarket catalog landing pages.
