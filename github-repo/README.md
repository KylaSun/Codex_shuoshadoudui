# 今晚做什么 · Module A

英国中国留学生晚餐决策 Demo 的 A 模块：首页、搜索、菜谱/食材详情、底部导航、展示示例商品及味道变化确认。预算、厨房库存和购物单通过 C 适配器接入；数据模型以 B 的集成为准。

## Quick start

Requires Node.js 20+:

```bash
npm start
# visit http://localhost:5173
npm test
npm run build
```

No `npm install` required. All API-independent data used by this demo lives in `src/demo-data.js`. `src/c-adapter.js` registers the C module before the A UI loads. See [INTEGRATION.md](INTEGRATION.md) for B/C/D adapter contracts and end-to-end acceptance steps.

The supermarket prices are fictional/illustrative static entries with recorded dates; they are **not** live prices, verified historical prices, or stock availability. Product links may point to supermarket catalog landing pages.
