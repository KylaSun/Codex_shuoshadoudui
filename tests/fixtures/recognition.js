// Offline test fixtures only. Production code never imports these or fakes AI success.
export const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jkZkAAAAASUVORK5CYII=', 'base64');
export const extraction = () => ({
  isRecipe: true, nameZh: '家里的蛋饭', nameEn: null, timeMinutes: null,
  ingredients: [{name: 'eggs', amount: 2, unit: '个', quantityText: '鸡蛋 2 个'}, {name: '神秘酱', amount: null, unit: null, quantityText: '少许'}],
  steps: ['打散鸡蛋。', '炒熟后配饭。'], warnings: ['手写酱料名称不清晰。'],
});
export const providerResponse = result => ({status: 'completed', output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify(result)}]}]});
