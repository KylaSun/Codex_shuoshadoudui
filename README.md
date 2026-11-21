# 饭乡 · A/B/C/D 整合版

给海外留学生的家乡菜晚餐工具。保留 A 的搜索和详情、B 的新版「饭乡」界面与目录、D 的本地菜谱和 AI 图片导入，并接入 C 的库存、整包预算、购物单与每日推荐。所有模块在同一根项目运行，无需启动 `github-repo/` 中的第二套网页。

## Quick start

Requires Node.js 20.12+ (or a current LTS):

```bash
npm start
# visit http://localhost:5173
npm test
npm run build
npm run validate
```

No `npm install` required. B's built-in catalog is loaded from `src/data/catalog.js`; `src/demo-data.js` remains A's fallback. See [INTEGRATION.md](INTEGRATION.md) for B/C/D module adapter contracts and end-to-end acceptance steps.

在仓库根目录执行命令。网站运行支持 Node.js 20.12+；`npm run validate` 读取 B 的原始 TypeScript 目录，需要 Node.js 24+。网页使用已提交的 `catalog.js`，无需安装依赖或重生数据。默认访问 `http://localhost:5173`；端口被占用时可用 `PORT=5186 npm start`，更换地址/端口会使用另一份浏览器本地存储。

The six regional dish images in `assets/regional-dishes.jpg` were generated for this demo and are illustrative. The remaining recipe cards use typographic artwork so that an unrelated dish photo is not mistaken for the recipe.

The supermarket prices are fictional/illustrative static entries with recorded dates; they are **not** live prices, verified historical prices, or stock availability. Product links may point to supermarket catalog landing pages.

## 整合后的使用流程

- **首页 / 找菜**：保留家乡地区入口、菜谱图片、地区和标签搜索，以及食材和商品详情。原始中式食材和替代规则保留，替代必须先确认味道变化；组合替代完整计入主替代与附加食材。
- **我的厨房**：从标准食材库选择食材，填写库存总量和单位，支持更新、删除与刷新恢复。报价合并所有选菜的需求后只扣一次库存，不会把 g、ml、个互相猜测换算；当前不提供“做完了”消费扣库。
- **每日推荐**：设定采购预算后生成今日随机推荐，仅选择能完整匹配参考商品、且按整包计算后不超预算的菜。推荐按浏览器本地日期保存；再次推荐必须选择原因，且不会立即重复上一道。候选不足会明确提示，不自动替换食材或提高预算。
- **购物单**：从菜谱详情或推荐点击“加入购物计划”，再选择菜谱、调整预算和采购项。加入的是草稿，点击“确认并保存购物单”才持久化；取消恢复原计划。超预算时必须调整或点击“明确提高预算”，未报价项目必须处理或明确排除。排除项仍是菜谱所需食材，界面显示的小计不代表完整菜谱成本。
- **我的菜谱**：手工创建或 AI 导入后，经检查保存的自定义菜谱，也能参与 C 的预算、购物计划和推荐。删除已选入计划的自定义菜谱会提示失效，不会显示虚假的 £0 完整报价。

采购按 B 的结构化 `packQuantity/packUnit` 取整包数，逐项选整包总金额较低的参考商品，可能来自不同超市；不含运费。缺失商品、未知单位或无效菜谱会显示“无法完整估价”和已知部分金额，不按零价补齐。已确认的食材替代随 C 状态持久化，恢复原食材会同步刷新预算和购物单。

C 沿用 `tonight-what-c-state-v1`，兼容原库存、计划与预算字段。D 的 `hometaste.custom-recipes.v1` 不变；原图不写入这些存储。存储失败会显示错误并保持原已保存状态；不做账号或云端同步。

## D 模块：我的菜谱

底部导航点击 **我的菜谱 → 创建菜谱**。填写中文菜名、可选英文名、烹饪分钟数，从当前食材库选择食材并填写数量和单位，再逐行填写制作步骤。支持添加/移除食材与步骤，至少保留一种食材和一个非空步骤；数量、时间必须大于 0，同种食材合并为一行。

保存后可点击菜谱进入现有详情页，也可在“找菜”中按中英文名或关联食材搜索。返回“我的菜谱”可编辑或删除，删除需要再次确认。创建、编辑、删除均写入当前浏览器的 localStorage，刷新后仍保留；不支持跨浏览器同步、账号或云端发布。写入失败时保留表单并提示重试。

`npm test` 包括 D 的增删改、重新加载持久化、失败处理、搜索与适配器集成测试，以及页面控制器流程测试。控制器测试模拟 DOM/FormData 边界，不代替真实浏览器的视觉与原生表单校验验收。`npm run build` 也会检查 D 模块的 JavaScript 语法。

D 的文件和联调边界见 [INTEGRATION.md](INTEGRATION.md#d-模块本地自定义菜谱)。

## D 第二阶段：AI 图片导入

在 **我的菜谱 → AI 图片导入** 中选择或拖入一张 JPG、PNG 或 WebP 图片（最多 5 MiB，即界面标注的 5MB）。选择图片只会在本地预览；点击 **开始识别（上传图片）** 后才发往服务端及配置的 AI 服务。支持上传进度、识别中提示、失败重试、取消、重新识别和未配置状态。

识别完成后点击 **检查并填入表单**，逐项修改菜名、食材、数量、单位、步骤和时间。食材按当前 `getIngredients()` 的标准名称/别名做唯一精确匹配；未知或存在歧义时必须手选。用量文字（如“少许”）会保留供核对，不推算数字。时间等未知信息留空并提示，用户核实补齐后，勾选确认并点击 **确认并保存菜谱** 才调用原有 `createCustomRecipe()`。保存后仍能搜索、查看、编辑、删除。

### 配置真实视觉模型

当前仓库不带密钥，不会用演示数据伪造识别成功。无需安装 SDK 或其他依赖。

1. 执行 `cp .env.example .env`，在本机编辑 `.env`，仅填写你已有的服务端 API Key。
2. 默认配置如下；模型必须在你的账号有访问权限：

   ```dotenv
   OPENAI_API_KEY=填写你自己的密钥
   RECIPE_VISION_MODEL=gpt-5.4-mini
   RECIPE_VISION_ENDPOINT=https://api.openai.com/v1/responses
   HOST=127.0.0.1
   PORT=5173
   ```

3. 执行或重启 `npm start`，打开 `http://localhost:5173`。Node.js 20.12+ 会自动加载根目录 `.env`，已有的进程环境变量优先。也可直接由运行环境注入这三个 AI 变量。
4. 打开“AI 图片导入”：配置检查只检查变量是否完整/地址是否合法，**不表示密钥、额度、模型或网络已经验证可用**。上传一张清晰的真实菜谱图片并成功返回可编辑内容后，才算完成真实端到端联调。401/模型不可用、额度不足、网络故障、超时、拒绝、非法 JSON 都会显示失败，不会自动入库。

默认模型的官方文档明确列出 **Image input、Responses 和 Structured outputs** 支持：[GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)。请求使用 [Responses 图片输入](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses) 的 `input_image` + Base64 data URL 和 [JSON Schema 结构化输出](https://developers.openai.com/api/docs/guides/structured-outputs)。可修改模型和完整 HTTPS endpoint，但自定义服务必须兼容 **Responses API、真实图片输入、严格 JSON Schema、`store:false`**；不能只支持文本或仅兼容 Chat Completions。

`.env` 已加入 gitignore，服务端静态资源规则禁止读取 `.env`、`.git` 和服务端源文件，浏览器不会得到密钥。服务端只在内存处理原图，不落盘、不写 localStorage、不记录图像或密钥，向提供方请求设置 `store:false`；提供方自身的数据保留策略仍由其服务条款决定。更换图片、关闭导入、取消表单或保存成功会释放预览 URL；“取消识别”中断请求并保留预览便于重试，已发出的上游请求是否计费由提供方决定。

开发服务器默认仅监听本机，最多同时处理两个识别请求，上游超时 60 秒。此版本没有社区账号/线上鉴权；请勿直接把带密钥的开发服务开放到公网。

### 验证范围

`npm test` 包含文件类型/大小/文件头、识别 JSON 校验、标准食材匹配、上传和取消状态、人工确认保存、真实本地 HTTP 接口、密钥隔离及第一阶段回归。测试里的 AI 响应是**仅限测试的显式桩**；生产代码没有成功回退数据。HTTP 测试需要允许本机临时端口，不访问外网或付费 AI。页面控制器与 XHR 测试模拟浏览器边界，不能作为真实手机/桌面的视觉验收结论。
