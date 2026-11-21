// Shared, dependency-free validation. This module contains no provider configuration or secrets.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImageFile(file) {
  const extension = /\.([^.]+)$/.exec(file?.name || '')?.[1]?.toLowerCase();
  const expected = {jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'}[extension];
  if (!expected || file.type !== expected) throw new Error('请选择 JPG、PNG 或 WebP 图片，文件后缀与格式需一致。');
  if (!file.size) throw new Error('图片为空，请重新选择。');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('图片不能超过 5MB，请压缩后重试。');
}

export function detectImageType(bytes) {
  const starts = values => values.every((value, index) => bytes[index] === value);
  if (bytes.length >= 3 && starts([255, 216, 255])) return 'image/jpeg';
  if (bytes.length >= 8 && starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (bytes.length >= 12 && starts([82, 73, 70, 70]) && [87, 69, 66, 80].every((value, i) => bytes[i + 8] === value)) return 'image/webp';
  return null;
}

function keys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
const nullableText = (value, max) => value === null || (typeof value === 'string' && value.length <= max);
const nullableNumber = value => value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0);

export function validateRecognition(value) {
  const invalid = () => { throw new Error('识别结果格式无效，请重新识别或手动创建菜谱。'); };
  if (!keys(value, ['isRecipe', 'nameZh', 'nameEn', 'timeMinutes', 'ingredients', 'steps', 'warnings']) ||
      typeof value.isRecipe !== 'boolean' || !nullableText(value.nameZh, 100) ||
      !nullableText(value.nameEn, 150) || !nullableNumber(value.timeMinutes) ||
      !Array.isArray(value.ingredients) || value.ingredients.length > 80 ||
      !Array.isArray(value.steps) || value.steps.length > 80 ||
      value.steps.some(step => typeof step !== 'string' || !step.trim() || step.length > 3000) ||
      !Array.isArray(value.warnings) || value.warnings.length > 30 ||
      value.warnings.some(item => typeof item !== 'string' || item.length > 500)) invalid();
  for (const item of value.ingredients) {
    if (!keys(item, ['name', 'amount', 'unit', 'quantityText']) || !nullableText(item.name, 200) ||
        !nullableNumber(item.amount) || !nullableText(item.unit, 30) || !nullableText(item.quantityText, 200)) invalid();
  }
  if (!value.isRecipe) throw new Error('图片中未识别出菜谱，请换一张清晰的菜谱图片。');
  return value;
}

const normalized = text => String(text ?? '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
export function matchIngredient(name, catalog) {
  const query = normalized(name);
  if (!query) return '';
  const matches = catalog.filter(item => [item.nameZh, item.nameEn, ...(item.aliases || [])].some(alias => normalized(alias) === query));
  return matches.length === 1 ? matches[0].id : '';
}

export function recognitionToDraft(result, catalog) {
  validateRecognition(result);
  const warnings = [...result.warnings];
  if (!result.nameZh?.trim()) warnings.push('未确定中文菜名，请填写。');
  if (result.timeMinutes === null) warnings.push('未确定烹饪时间，请核实后填写；不会自动估算。');
  if (!result.ingredients.length) warnings.push('未确定食材，请手动添加。');
  if (!result.steps.length) warnings.push('未确定制作步骤，请手动填写。');
  const ingredients = result.ingredients.map((item, index) => {
    const ingredientId = matchIngredient(item.name, catalog);
    if (!ingredientId) warnings.push(`食材 ${index + 1}“${item.name || '未识别'}”未唯一匹配，请手动选择。`);
    if (item.amount === null || !item.unit?.trim()) warnings.push(`食材 ${index + 1} 的用量或单位不完整，请核实填写。`);
    return {ingredientId, amount: item.amount ?? '', unit: item.unit?.trim() || '', sourceName: item.name || '', quantityText: item.quantityText || ''};
  });
  if (new Set(ingredients.filter(item => item.ingredientId).map(item => item.ingredientId)).size < ingredients.filter(item => item.ingredientId).length) {
    warnings.push('有多行食材匹配到同一种食材，请核实用量与单位后合并；不会自动相加。');
  }
  return {draft: {
    nameZh: result.nameZh?.trim() || '', nameEn: result.nameEn?.trim() || '', timeMinutes: result.timeMinutes ?? '',
    ingredients: ingredients.length ? ingredients : [{ingredientId: '', amount: '', unit: ''}],
    steps: result.steps.length ? [...result.steps] : [''],
  }, warnings};
}
