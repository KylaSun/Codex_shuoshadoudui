// A-module demo fixtures only. Replace via window.DinnerAppAdapters (see INTEGRATION.md).
export const ingredients = [
  {id:'egg',nameZh:'鸡蛋',nameEn:'Egg',aliases:['eggs'],category:'蛋奶',emoji:'🥚'},
  {id:'tomato',nameZh:'番茄',nameEn:'Tomato',aliases:['西红柿','tomatoes'],category:'蔬菜',emoji:'🍅'},
  {id:'rice',nameZh:'米饭',nameEn:'Rice',aliases:['大米'],category:'主食',emoji:'🍚'},
  {id:'noodle',nameZh:'面条',nameEn:'Noodles',aliases:['noodle'],category:'主食',emoji:'🍜'},
  {id:'chicken',nameZh:'鸡胸肉',nameEn:'Chicken breast',aliases:['鸡肉','chicken'],category:'肉类',emoji:'🍗'},
  {id:'onion',nameZh:'洋葱',nameEn:'Onion',aliases:[],category:'蔬菜',emoji:'🧅'},
  {id:'potato',nameZh:'土豆',nameEn:'Potato',aliases:['马铃薯','potatoes'],category:'蔬菜',emoji:'🥔'},
  {id:'milk',nameZh:'牛奶',nameEn:'Milk',aliases:[],category:'蛋奶',emoji:'🥛'},
  {id:'butter',nameZh:'黄油',nameEn:'Butter',aliases:[],category:'蛋奶',emoji:'🧈'},
  {id:'mushroom',nameZh:'蘑菇',nameEn:'Mushroom',aliases:['菌菇'],category:'蔬菜',emoji:'🍄'},
  {id:'pasta',nameZh:'意面',nameEn:'Pasta',aliases:['意大利面','spaghetti'],category:'主食',emoji:'🍝'},
  {id:'cheese',nameZh:'奶酪',nameEn:'Cheese',aliases:['芝士'],category:'蛋奶',emoji:'🧀'},
];
export const recipes = [
  {id:'tomato-egg',nameZh:'番茄炒蛋',nameEn:'Tomato & Egg Stir-fry',emoji:'🍅',accent:'#f5b69d',timeMinutes:15,difficulty:'简单',tags:['下饭','一人食'],description:'留学厨房经典快手菜，酸甜暖胃。',ingredients:[{ingredientId:'tomato',amount:2,unit:'个'},{ingredientId:'egg',amount:2,unit:'个'},{ingredientId:'rice',amount:150,unit:'g'}],steps:['番茄切块，鸡蛋打散。','热锅先炒鸡蛋，盛出。','炒软番茄，倒入鸡蛋拌匀，配米饭。']},
  {id:'chicken-rice',nameZh:'鸡肉盖饭',nameEn:'Chicken Rice Bowl',emoji:'🍗',accent:'#f9d69d',timeMinutes:25,difficulty:'简单',tags:['高蛋白','饱腹'],description:'鸡肉与洋葱组合，适合课后补充能量。',ingredients:[{ingredientId:'chicken',amount:180,unit:'g'},{ingredientId:'rice',amount:150,unit:'g'},{ingredientId:'onion',amount:0.5,unit:'个'}],steps:['鸡肉切块，洋葱切丝。','炒熟鸡肉与洋葱并调味。','盖在煮好的米饭上。']},
  {id:'creamy-pasta',nameZh:'奶油蘑菇意面',nameEn:'Creamy Mushroom Pasta',emoji:'🍝',accent:'#e6d3b4',timeMinutes:20,difficulty:'中等',tags:['西式','舒适餐'],description:'用英国超市常见食材完成一份奶香意面。',ingredients:[{ingredientId:'pasta',amount:100,unit:'g'},{ingredientId:'mushroom',amount:120,unit:'g'},{ingredientId:'milk',amount:100,unit:'ml'},{ingredientId:'cheese',amount:30,unit:'g'}],steps:['意面煮至喜欢的硬度。','炒香蘑菇，加入牛奶小火收浓。','拌入意面与奶酪。']},
  {id:'potato-egg',nameZh:'土豆鸡蛋饼',nameEn:'Potato Egg Pancake',emoji:'🥔',accent:'#e6ce8d',timeMinutes:20,difficulty:'简单',tags:['省钱','早餐晚餐'],description:'土豆与鸡蛋做成的平底锅料理。',ingredients:[{ingredientId:'potato',amount:1,unit:'个'},{ingredientId:'egg',amount:2,unit:'个'},{ingredientId:'onion',amount:0.25,unit:'个'}],steps:['土豆切细丝、洋葱切丁。','与蛋液混合并调味。','小火双面煎熟。']},
  {id:'tomato-noodles',nameZh:'番茄鸡蛋面',nameEn:'Tomato Egg Noodles',emoji:'🍜',accent:'#f7ba8c',timeMinutes:15,difficulty:'简单',tags:['热汤','快手'],description:'宿舍厨房也能做的热乎番茄汤面。',ingredients:[{ingredientId:'noodle',amount:100,unit:'g'},{ingredientId:'tomato',amount:2,unit:'个'},{ingredientId:'egg',amount:1,unit:'个'}],steps:['番茄炒出汁后加水煮开。','下面条煮熟。','淋入蛋液至凝固。']},
];
export const substitutions = [
  {id:'sub-milk-cheese',recipeId:'creamy-pasta',ingredientId:'cheese',replacementIngredientId:'milk',originalAmount:30,originalUnit:'g',replacementAmount:80,replacementUnit:'ml',flavourNote:'奶香更轻、酱汁更稀；并非等价替代。',equivalent:false,technique:'小火收汁，避免太稀。'},
  {id:'sub-pasta-noodle',recipeId:'creamy-pasta',ingredientId:'pasta',replacementIngredientId:'noodle',originalAmount:100,originalUnit:'g',replacementAmount:100,replacementUnit:'g',flavourNote:'口感更软，挂汁能力不同。',equivalent:false,technique:'煮面时间按包装调整。'},
  {id:'sub-rice-noodle',recipeId:'chicken-rice',ingredientId:'rice',replacementIngredientId:'noodle',originalAmount:150,originalUnit:'g',replacementAmount:120,replacementUnit:'g',flavourNote:'从盖饭变为拌面，口感和主食形态不同。',equivalent:false,technique:'面条单独煮熟再拌。'},
];
export const products = [
  {id:'t-egg',ingredientId:'egg',nameEn:'Tesco 6 Large Eggs',supermarket:'Tesco',packageSize:'6 pcs',priceGBP:1.65,recordedAt:'2026-11-01',url:'https://www.tesco.com/groceries/'},
  {id:'s-tomato',ingredientId:'tomato',nameEn:'Sainsbury’s Tomatoes',supermarket:'Sainsbury’s',packageSize:'6 pcs',priceGBP:1.45,recordedAt:'2026-11-01',url:'https://www.sainsburys.co.uk/gol-ui/groceries'},
  {id:'t-rice',ingredientId:'rice',nameEn:'Tesco Long Grain Rice',supermarket:'Tesco',packageSize:'1 kg',priceGBP:1.35,recordedAt:'2026-11-01',url:'https://www.tesco.com/groceries/'},
  {id:'s-chicken',ingredientId:'chicken',nameEn:'Sainsbury’s Chicken Breast Fillets',supermarket:'Sainsbury’s',packageSize:'500 g',priceGBP:3.75,recordedAt:'2026-11-01',url:'https://www.sainsburys.co.uk/gol-ui/groceries'},
  {id:'t-pasta',ingredientId:'pasta',nameEn:'Tesco Spaghetti Pasta',supermarket:'Tesco',packageSize:'500 g',priceGBP:0.85,recordedAt:'2026-11-01',url:'https://www.tesco.com/groceries/'},
  {id:'s-milk',ingredientId:'milk',nameEn:'Sainsbury’s British Semi Skimmed Milk',supermarket:'Sainsbury’s',packageSize:'1 L',priceGBP:1.25,recordedAt:'2026-11-01',url:'https://www.sainsburys.co.uk/gol-ui/groceries'},
];
