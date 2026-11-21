# 今晚做什么 · Module A

英国中国留学生晚餐决策 Demo 的 A 模块：首页、搜索、菜谱/食材详情、底部导航、展示示例商品及味道变化确认。**不包含 C 的预算计算和购物单业务逻辑。**

## Quick start

Requires Node.js 20+:

```bash
npm start
# visit http://localhost:5173
npm test
npm run build
```

No `npm install` required. All API-independent data used by this demo lives in `src/demo-data.js`. See [INTEGRATION.md](INTEGRATION.md) for B/C/D module adapter contracts and end-to-end acceptance steps.

The supermarket prices are fictional/illustrative static entries with recorded dates; they are **not** live prices, verified historical prices, or stock availability. Product links may point to supermarket catalog landing pages.

## D 模块：我的菜谱

底部导航点击 **我的菜谱 → 创建菜谱**。填写中文菜名、可选英文名、烹饪分钟数，从当前食材库选择食材并填写数量和单位，再逐行填写制作步骤。支持添加/移除食材与步骤，至少保留一种食材和一个非空步骤；数量、时间必须大于 0，同种食材合并为一行。

保存后可点击菜谱进入现有详情页，也可在“找菜”中按中英文名或关联食材搜索。返回“我的菜谱”可编辑或删除，删除需要再次确认。创建、编辑、删除均写入当前浏览器的 localStorage，刷新后仍保留；不支持跨浏览器同步、账号或云端发布。写入失败时保留表单并提示重试。

`npm test` 包括 D 的增删改、重新加载持久化、失败处理、搜索与适配器集成测试，以及页面控制器流程测试。控制器测试模拟 DOM/FormData 边界，不代替真实浏览器的视觉与原生表单校验验收。`npm run build` 也会检查 D 模块的 JavaScript 语法。

D 的文件和联调边界见 [INTEGRATION.md](INTEGRATION.md#d-模块本地自定义菜谱)。
