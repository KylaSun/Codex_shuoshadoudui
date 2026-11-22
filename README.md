# 饭乡 · A/B/C/D

英国中国留学生晚餐决策 Demo 的 A 模块：首页、搜索、菜谱/食材详情、底部导航、展示示例商品及味道变化确认。已接入 C 的厨房、预算和购物单。

## Quick start

Requires Node.js 20.12+ (or a current LTS):

```bash
npm start
# visit http://localhost:5173
npm test
npm run build
```

No `npm install` required. B's built-in catalog is loaded from `src/data/catalog.js`; `src/demo-data.js` remains A's fallback. See [INTEGRATION.md](INTEGRATION.md) for B/C/D module adapter contracts and end-to-end acceptance steps.

47 道内置菜谱使用 `assets/recipe-art/` 中对应的水彩插画。

商品价格是带记录日期的静态参考值，不代表实时售价或库存。进入结账前请打开商品页核对。C 的整包预算仅在所有食材有匹配商品时显示完整金额；当前 24/47 道菜符合条件，缺口见 [C_HANDOFF.md](C_HANDOFF.md)。缺商品时购物单显示已匹配小计和可选替代；确认替代后重算，仍有缺口时不把小计称为总金额。已选菜品有无可计价替代的缺价食材时，首页显示采购提醒。购物单可按菜品或食材查看和删除，选菜与厨房添加食材均可搜索。找菜搜索框旁可屏蔽食材；含该食材的菜会从找菜结果隐藏，也不会加入购物单或参与随机推荐。

## D 模块：我的菜谱

底部导航点击 **我的菜谱 → 创建菜谱**。填写中文菜名、可选英文名、烹饪分钟数，从当前食材库选择食材并填写数量和单位，再逐行填写制作步骤。支持添加/移除食材与步骤，至少保留一种食材和一个非空步骤；数量、时间必须大于 0，同种食材合并为一行。

保存后可点击菜谱进入现有详情页，也可在“找菜”中按中英文名或关联食材搜索。返回“我的菜谱”可编辑或删除，删除需要再次确认。创建、编辑、删除均写入当前浏览器的 localStorage，刷新后仍保留；不支持跨浏览器同步、账号或云端发布。写入失败时保留表单并提示重试。

`npm test` 包括 D 的增删改、重新加载持久化、失败处理、搜索与适配器集成测试，以及页面控制器流程测试。控制器测试模拟 DOM/FormData 边界，不代替真实浏览器的视觉与原生表单校验验收。`npm run build` 也会检查 D 模块的 JavaScript 语法。

D 的文件和联调边界见 [INTEGRATION.md](INTEGRATION.md#d-模块本地自定义菜谱)。

## 每看两道菜后的必看视频

同一标签页每打开两次菜谱，点开第三道时显示必看视频 `assets/recipe-break.mp4`。完整播放后点击“已看完，继续找菜”解锁，之后重新累计；同一菜谱内重新渲染不重复累计。sessionStorage 保留计数和待观看状态，刷新不会跳过，关闭标签页后重新开始。播放器不提供快进、倍速或关闭入口；切到后台暂停，加载失败可重试。此功能是前端比赛演示，不属于防篡改鉴权。

## 中英文切换

右上角“中文 / English”即时切换界面、内置菜谱名称与做法、食材名称及替代说明；语言偏好保存在当前浏览器。切换不刷新、不清空表单，也不重置视频和购物计划。用户录入的菜谱内容保留原文。翻译表位于 `src/translations.js`、`src/recipe-english.js` 和 `src/substitution-english.js`。
