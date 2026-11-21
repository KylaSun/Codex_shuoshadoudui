# 数据来源记录（2026-11-21）

## 菜谱、食材与替代规则

47 道菜的名称、简介、两人份用量及步骤均由项目手工编写，没有复制外部菜谱。74 种食材的中英文名称、别名和搜索词由人工整理；搜索词是去超市手动查找时的提示，不保证对应商品或库存。为突出中国口味，移除了 13 道重复的普通炖菜、意面、炒饭和炒面，并清理失去适用菜谱的替代规则。

16 道地方风味菜的地域背景和关键组成参考了下列烹饪资料；**步骤、用量和“学生厨房”简化均由本项目重新编写**，不表示原菜的正宗做法。每道菜的 `inspirationUrls` 保留对应页面。

| 地方风味菜 | 做法参考 | 简化与保留的关键点 |
| --- | --- | --- |
| 四川宫保鸡丁饭 | [The Woks of Life 宫保鸡丁](https://thewoksoflife.com/kung-pao-chicken/) | 保留鸡丁、花生、干辣椒和花椒；少量料汁配饭。花椒和花生不作假等价替换。 |
| 陕西油泼面（现成面版） | [The Woks of Life 油泼面](https://thewoksoflife.com/hot-oil-noodles-you-po-mian/) | 保留热油激香的手法；现成鸡蛋面与手扯面的口感不同，菜名已标明。 |
| 上海葱油拌面 | [The Woks of Life 上海葱油拌面](https://thewoksoflife.com/soy-scallion-noodles-cong-ban-mian/) | 保留慢炸葱和咸甜酱油的特点，用现成干面。 |
| 东北地三鲜盖饭 | [The Woks of Life 地三鲜](https://thewoksoflife.com/di-san-xian-stir-fry/) | 保留茄子、土豆、彩椒三样主料；先预熟土豆，减少用油。 |
| 武汉热干面风味拌面 | [The Woks of Life 热干面](https://thewoksoflife.com/hot-dry-noodles-re-gan-mian/) | 芝麻酱、榨菜、小葱构成风味；现成鸡蛋面不能重现碱水面口感，所以明确写“风味拌面”。 |
| 云南小锅米线（家常版） | [The Woks of Life 云南小锅米线](https://thewoksoflife.com/yunnan-rice-noodle-soup/) | 保留米线、肉末和酸腌菜；商品目录中的扁米粉与云南圆米线口感不同。 |
| 四川鱼香肉丝 | [The Woks of Life 鱼香肉丝](https://thewoksoflife.com/pork-garlic-sauce/) | 保留豆瓣、木耳和酸甜辣鱼香汁；胡萝卜替代莴笋，已在食材行注明。 |
| 湖南辣椒小炒肉 | [The Woks of Life 辣椒炒肉](https://thewoksoflife.com/pork-pepper-stir-fry/) | 保留鲜青辣椒和猪肉快炒；彩椒加碎辣椒只能做口味变体。 |
| 重庆酸辣粉 | [The Woks of Life 酸辣粉](https://thewoksoflife.com/suan-la-fen-hot-sour-sweet-potato-glass-noodle-soup/) | 保留红薯粉条、香醋和麻辣；若改米粉须标成酸辣米粉。 |
| 广式腊肠焖饭（电饭锅版） | [The Woks of Life 电饭锅腊肠饭](https://thewoksoflife.com/chinese-sausage-rice-cooker-lap-cheong/) | 保留腊肠甜咸香；没有砂锅锅巴，不用普通香肠冒充广式腊肠。 |
| 厦门炒米粉（家常版） | [The Woks of Life 厦门炒米粉](https://thewoksoflife.com/xiamen-mei-fun-noodles/) | 保留细米粉、虾、蛋和火腿组合；用较宽米粉时口感变体。 |
| 扬州炒饭 | [The Woks of Life Young Chow Fried Rice](https://thewoksoflife.com/young-chow-fried-rice/) | 虾仁、蛋、火腿与豌豆配隔夜饭；用普通熟火腿，不冒充金华火腿。 |
| 新疆大盘鸡拌面（简化版） | [The Woks of Life 大盘鸡](https://thewoksoflife.com/big-plate-chicken-noodles/) | 保留鸡、土豆、辣椒、香料与面；鸡胸和现成面是学生厨房简化。 |
| 南昌拌粉 | [Eating in China 南昌拌粉](https://eatinginchina.co/en/food/nanchang-mixed-rice-noodles/) | 保留米粉、萝卜干、花生、雪菜等咸脆配料；调味比例为本项目估算。 |
| 哈尔滨锅包肉（浅炸版） | [The Woks of Life 锅包肉](https://thewoksoflife.com/guo-bao-rou-dongbei/) | 保留土豆淀粉脆壳和酸甜汁；浅炸无法重现传统复炸口感。 |
| 上海本帮红烧肉 | [The Woks of Life 上海红烧肉](https://thewoksoflife.com/shanghai-style-braised-pork-belly/) | 保留五花肉、糖、老抽和绍兴酒炖香；具体比例与时间由本项目制定。 |

四道网络流行菜另用 `getFeaturedViralRecipes()` 汇总。**只有公瑾爆蛋是据 2026 年报道走红的新菜**；雪碧拌面、抱蛋煎饺和可乐鸡翅是已有多年的网络流行或快手做法，不将其误称为 2026 年新发明。

| 菜品 | 做法参考 | 本项目调整 |
| --- | --- | --- |
| 公瑾爆蛋盖饭（熟蛋版） | [原作者视频的步骤索引](https://bilifood.com/r/bv1facrzveqc-0)，[中国青年网关于菜品走红的报道](https://d.youth.cn/newtech/202608/t20260803_16797350.htm) | 保留煎蛋、蒜、番茄酱、生抽、老抽、白醋和糖；本项目降低糖量并将蛋煎熟，名称明确标注“熟蛋版”。不复制原视频文案。 |
| 雪碧酸辣拌面 | [下厨房雪碧拌面示例](https://m.xiachufang.com/recipe/106801773/) | 取其汽水、黄瓜、醋、芝麻酱与辣味组合；用量和步骤自行编写。 |
| 抱蛋煎饺 | [下厨房抱蛋煎饺示例](https://www.xiachufang.com/recipe/107356020/)，[The Woks of Life 冻饺子熟制方法](https://thewoksoflife.com/how-to-cook-frozen-dumplings/) | 速冻饺子先焖熟再加蛋液；依具体品牌包装核对熟制时间。 |
| 可乐鸡翅饭 | [The Woks of Life 可乐鸡翅](https://thewoksoflife.com/coca-cola-chicken-wings/) | 保留鸡翅、可乐、姜和酱油收汁，另配米饭；这是经典快手菜，非 2026 年新菜。 |

60 条替代规则按具体菜和做法编写。其中有来源的食材搭配记录在规则的 `sourceUrls` 及下表；其余为项目编写的演示建议。所有克数比例、适用菜及味道说明均由本项目制定，未经过独立烹饪、营养或过敏原验证。`suitability` 为「相近／功能替代／改菜变体」，并不代表风味等价。所有规则的 `equivalent: false` 只表示风味有变化，**不能解释成“不可用”**。花椒→黑胡椒单独替换已删除，因为无法提供麻感。难买的中式食材是**主流英国超市不一定有同款**，并非英国完全买不到。

| 原料 → 方案 | 食材搭配依据 | 本项目的场景与界限 |
| --- | --- | --- |
| 郫县豆瓣酱 → 韩式辣酱；或味噌＋辣椒酱 | [Omnivore's Cookbook 中式食材替代指南](https://omnivorescookbook.com/ingredient-substitutions-for-chinese-cooking/)，[The Woks of Life 豆瓣酱说明](https://thewoksoflife.com/doubanjiang/) | 麻婆豆腐可完成辣豆腐变体；韩式辣酱偏甜，组合酱缺豆瓣香。比例为本项目估算。 |
| 镇江香醋 → 麦芽醋 | [Omnivore's Cookbook 中式食材替代指南](https://omnivorescookbook.com/ingredient-substitutions-for-chinese-cooking/) | 用于酸辣土豆丝；有酸味和部分麦芽香，但缺米醋香，大麦过敏原需核对。旧苹果醋方案仅替代酸度，证据弱于麦芽醋。 |
| 甜面酱 → 海鲜酱 | [The Woks of Life 甜面酱](https://thewoksoflife.com/sweet-bean-sauce-tian-mian-jiang/)，[Omnivore's Cookbook 中式食材替代指南](https://omnivorescookbook.com/ingredient-substitutions-for-chinese-cooking/) | 两家对主酱用途看法不同；本项目只用于少量肉末拌面酱底并明确更甜更稀，不推荐冒充正宗炸酱面。旧味噌＋糖方案仅为项目经验。 |
| 干香菇 → 鲜香菇 | [Omnivore's Cookbook 中式食材替代指南](https://omnivorescookbook.com/ingredient-substitutions-for-chinese-cooking/)，[干香菇说明](https://omnivorescookbook.com/dried-shiitake-mushroom/) | 汤面可保留菌菇口感，但干菇泡发汤汁和浓郁香气无法重现；第二篇资料对替代更保守。 |
| 韭菜 → 小葱 | [The Woks of Life Pad Thai](https://thewoksoflife.com/pad-thai/) | 该资料在炒面场景用小葱替中国韭菜；用于本项目炒蛋是**场景外推**，要改称葱香炒蛋。 |
| 雪菜 → 德式酸菜 | [The Woks of Life 腌制食材说明](https://thewoksoflife.com/chinese-ingredients-glossary/chinese-dried-preserved-ingredients/) | 资料只直接建议德式酸菜替酸白菜，**并未建议替雪菜**；本项目仅将酸咸腌菜作用外推到豆腐汤，标为改菜变体。 |
| 花椒 → 黑胡椒 | [Omnivore's Cookbook 中式食材替代指南](https://omnivorescookbook.com/ingredient-substitutions-for-chinese-cooking/)，[花椒说明](https://omnivorescookbook.com/sichuan-peppercorn/) | 前者建议黑胡椒＋柠檬皮模拟辛香、明确无麻感；单用黑胡椒更不合适，已移除该规则，缺花椒时保留通用英文采购名或换菜。 |
| 中式芝麻酱 → tahini | [The Woks of Life 中式芝麻酱说明](https://thewoksoflife.com/chinese-sesame-paste/) | 用于武汉热干面风味拌面，能提供芝麻酱质地，但缺少中式焙炒香。 |
| 云南酸腌菜 → 韩式泡菜 | [The Woks of Life 小锅米线](https://thewoksoflife.com/yunnan-rice-noodle-soup/) | 原资料允许用切碎泡菜代替腌菜；味道转向韩式蒜姜辣，菜名应标示变体。 |
| 鱼香肉丝豆瓣酱 → 韩式辣酱 | [Omnivore's Cookbook 中式食材替代指南](https://omnivorescookbook.com/ingredient-substitutions-for-chinese-cooking/) | 借用发酵辣酱的功能；更甜且缺豆瓣香，属于鱼香风味肉丝变体。克数比例为项目估算。 |
| 湖南小炒肉青辣椒 → 彩椒＋碎辣椒 | [The Woks of Life 辣椒炒肉](https://thewoksoflife.com/pork-pepper-stir-fry/) | 原资料说明鲜辣椒的重要性；彩椒补口感、碎辣椒补辣度是本项目的**场景推断**，缺新鲜青椒香，非等价。 |
| 重庆酸辣粉红薯粉条 → 米粉 | [The Woks of Life 酸辣粉](https://thewoksoflife.com/suan-la-fen-hot-sour-sweet-potato-glass-noodle-soup/) | 资料说明红薯粉条的典型口感；米粉只让酸辣汤仍可完成，必须改称酸辣米粉。 |
| 厦门细米粉 → 较宽米粉 | [The Woks of Life 厦门炒米粉](https://thewoksoflife.com/xiamen-mei-fun-noodles/) | 同为米制干粉，炒后干爽度与宽度不同；比例为项目估算。 |
| 南昌拌粉雪菜 → 德式酸菜 | [The Woks of Life 腌制食材说明](https://thewoksoflife.com/chinese-ingredients-glossary/chinese-dried-preserved-ingredients/) | 仅将酸咸腌菜作用**外推**到拌粉；没有雪菜芥香，属于酸菜拌粉变体。 |
| 公瑾爆蛋白醋 → 苹果醋 | [The Woks of Life 中式醋说明](https://thewoksoflife.com/chinese-ingredients-glossary/chinese-sauces-vinegars-oils/) | 只承担酸味；苹果果香与颜色会改变料汁。页面讨论中式白醋与苹果醋的差异，具体比例是本项目估算。 |
| 雪碧拌面芝麻酱 → tahini | [The Woks of Life 中式芝麻酱说明](https://thewoksoflife.com/chinese-sesame-paste/) | 保留芝麻酱质地但焙炒香较弱，需用户确认味道变化。 |
| 可乐鸡翅 → 鸡胸肉 | [Student Eats 可乐鸡肉](https://studenteats.co.uk/recipe/sticky-coca-cola-chicken/) | 资料说明可乐鸡可用不同鸡肉部位；去骨鸡胸更瘦且易柴，菜名须改“可乐鸡肉饭”。 |

## 超市商品目录

以下 42 条是人工查看 Tesco / Sainsbury’s 公开商品页或商品目录后记录的英文名、规格和页面参考价格。`priceRecordedOn` 表示**本目录记录页面参考价的日期**，不是 API 时间戳；超市价格、商品详情和库存可能随时变化。商品页链接用于核对，不用于自动抓取。下表采用普通展示价，不将限时 Clubcard 价作为默认价格。

| 数据 ID | 页面来源 | 记录规格 | 记录参考价 |
| --- | --- | ---: | ---: |
| tesco-rice | [Tesco Easy Cook Long Grain Rice](https://www.tesco.com/shop/en-GB/products/254877356) | 1 kg | £1.25 |
| tesco-eggs | [Tesco Large Free Range Eggs](https://www.tesco.com/shop/en-GB/products/250802567) | 6 pack | £2.10 |
| tesco-chicken | [Tesco British Chicken Breast Fillets](https://www.tesco.com/shop/en-GB/products/294007923) | 650 g | £4.95 |
| tesco-broccoli | [Tesco Broccoli Loose](https://www.tesco.com/shop/en-GB/products/257231200) | 1 head | £0.90 |
| tesco-tofu | [The Tofoo Co Naked Tofu](https://www.tesco.com/shop/en-GB/products/294476706) | 280 g | £2.50 |
| tesco-noodles | [Tesco Fine Egg Noodles](https://www.tesco.com/shop/en-GB/products/272640511) | 250 g | £0.95 |
| tesco-soy | [Tesco Light Soy Sauce](https://www.tesco.com/shop/en-GB/products/294781229) | 150 ml | £0.55 |
| tesco-oil | [Tesco Pure Vegetable Oil](https://www.tesco.com/shop/en-GB/products/254918067) | 1 L | £1.75 |
| sainsburys-rice | [Sainsbury's Easy Cook Long Grain White Rice](https://www.sainsburys.co.uk/groceries/product/sainsburys-easy-cook-long-grain-white-rice-1kg) | 1 kg | £1.25 |
| sainsburys-chicken | [Sainsbury's Chicken Breast Fillets](https://www.sainsburys.co.uk/groceries/product/sainsburys-640g-british-fresh-skinless-boneless-chicken-breast-fillets) | 640 g | £4.62 |
| tesco-onion | [Tesco Brown Onions](https://www.tesco.com/shop/en-GB/products/255736044) | 1 kg | £0.95 |
| tesco-mushroom | [Tesco Closed Cup Mushrooms](https://www.tesco.com/shop/en-GB/products/280046682) | 300 g | £0.97 |
| tesco-miso | [Tesco Miso Paste](https://www.tesco.com/shop/en-GB/products/304368111) | 100 g | £1.95 |
| tesco-chilli-paste | [Tesco Chilli Paste](https://www.tesco.com/shop/en-GB/products/278393177) | 90 g | £1.95 |
| tesco-chilli-flakes | [Tesco Crushed Chillies](https://www.tesco.com/shop/en-GB/products/251620901) | 28 g | £1.00 |
| tesco-spring-onion | [Tesco Bunched Spring Onions](https://www.tesco.com/shop/en-GB/products/281035500) | 100 g | £0.65 |
| tesco-cider-vinegar | [Tesco Cider Vinegar](https://www.tesco.com/shop/en-GB/products/297021296) | 350 ml | £1.65 |
| tesco-pork-mince | [Tesco Pork Mince 20% Fat](https://www.tesco.com/shop/en-GB/products/317417731) | 500 g | £2.30 |
| tesco-black-pepper | [Tesco Coarse Black Pepper](https://www.tesco.com/shop/en-GB/products/257536462) | 50 g | £1.60 |
| tesco-garlic-paste | [Tesco Garlic Paste](https://www.tesco.com/shop/en-GB/products/278392921) | 90 g | £1.95 |
| tesco-sugar | [Tate & Lyle Fairtrade Granulated Sugar](https://www.tesco.com/shop/en-GB/products/266386106) | 1 kg | £1.09 |
| tesco-gochujang | [Tesco Gochujang Paste](https://www.tesco.com/shop/en-GB/products/316199373) | 90 g | £1.95 |
| tesco-malt-vinegar | [Tesco Malt Vinegar](https://www.tesco.com/shop/en-GB/products/272338207) | 568 ml | £0.35 |
| tesco-hoisin | [Lee Kum Kee Hoisin Sauce](https://www.tesco.com/shop/en-GB/products/276731075) | 210 g | £2.25 |
| tesco-fresh-shiitake | [Tesco Finest Shiitake Mushrooms](https://www.tesco.com/shop/en-GB/products/323647605) | 125 g | £2.00 |
| tesco-sauerkraut | [Dawtona Sauerkraut](https://www.tesco.com/shop/en-GB/products/305046773) | 500 g，沥干后 335 g | £1.75 |
| tesco-aubergine | [Tesco Aubergine](https://www.tesco.com/shop/en-GB/products/293610620) | 1 个 | £0.95 |
| tesco-potato | [Tesco All Rounder Potatoes](https://www.tesco.com/shop/en-GB/products/313165959) | 2 kg | £1.39 |
| tesco-peanuts | [Stockwell & Co Roasted & Salted Peanuts](https://www.tesco.com/shop/en-GB/products/300283810) | 200 g | £0.59 |
| tesco-tahini | [Tesco Tahini](https://www.tesco.com/shop/en-GB/products/301554009) | 300 g | £3.10 |
| tesco-rice-noodles | [Blue Dragon Pad Thai Rice Noodles](https://www.tesco.com/shop/en-GB/products/317312083) | 200 g | £1.85 |
| tesco-kimchi | [Sun Hee Kimchi](https://www.tesco.com/shop/en-GB/products/309163852) | 190 g | £2.00 |
| sainsburys-kimchi | [Sun Hee Kimchi](https://www.sainsburys.co.uk/groceries/product/sun-hee-kimchi-spicy-fermented-cabbage-190g) | 190 g | £2.10 |
| tesco-tomato-ketchup | [Tesco Tomato Ketchup](https://www.tesco.com/shop/en-GB/products/305834749) | 555 g | £1.15 |
| tesco-sprite | [Sprite Lemon-Lime Soft Drink](https://www.tesco.com/shop/en-GB/products/251806135) | 500 ml | £2.10 |
| tesco-cucumber | [Tesco Whole Cucumber](https://www.tesco.com/shop/en-GB/products/253558972) | 1 根 | £0.99 |
| tesco-frozen-dumplings | [itsu Chicken Gyoza Dinner Dumplings](https://www.tesco.com/shop/en-GB/products/299955276) | 12 个／240 g | £4.25 |
| tesco-chicken-wings | [Tesco Chicken Wings](https://www.tesco.com/shop/en-GB/products/308865524) | 1.5 kg | £4.25 |
| tesco-cola | [Coca-Cola Original Taste](https://www.tesco.com/shop/en-GB/products/258458190) | 500 ml | £1.89 |
| tesco-dark-soy | [Amoy Dark Soy Sauce](https://www.tesco.com/shop/en-GB/products/253778008) | 150 ml | £2.00 |
| tesco-chopped-garlic | [Tesco Frozen Chopped Garlic](https://www.tesco.com/shop/en-GB/products/289766503) | 100 g | £2.45 |
| tesco-ginger | [Tesco Ginger](https://www.tesco.com/shop/en-GB/products/314931777) | 100 g | £1.30 |

没有商品记录的食材，如郫县豆瓣酱、韭菜、蒜苗、榨菜、公瑾爆蛋的白醋，只提供英文采购名和搜索词；不能把它们当作零价格，也不能在界面声称 Tesco / Sainsbury’s 没有现货。Tesco 的 [Distilled Vinegar](https://www.tesco.com/shop/en-GB/products/261781314) 商品页标明是**蒸馏麦芽醋，含大麦**，所以没有将其匹配到白醋。示例商品目录的缺口不代表整个英国市场的供应情况。
