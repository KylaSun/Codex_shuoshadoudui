import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_IMAGE_BYTES, validateImageFile, detectImageType, validateRecognition, matchIngredient, recognitionToDraft} from '../src/recipe-import.js';
import {checkImage, getRecognitionStatus, uploadRecipeImage} from '../src/recipe-import-client.js';
import {ingredients} from '../src/demo-data.js';
import {png, extraction} from './fixtures/recognition.js';

test('image validation permits exactly 5MB and only matching JPG/PNG/WebP extensions and MIME types', () => {
  for (const [name, type] of [['photo.JPG', 'image/jpeg'], ['photo.jpeg', 'image/jpeg'], ['photo.png', 'image/png'], ['photo.webp', 'image/webp']]) {
    assert.doesNotThrow(() => validateImageFile({name, type, size: MAX_IMAGE_BYTES}));
  }
  for (const file of [{name: 'x.gif', type: 'image/gif', size: 1}, {name: 'x.png', type: 'image/jpeg', size: 1},
    {name: 'x.png', type: 'image/png', size: 0}, {name: 'x.png', type: 'image/png', size: MAX_IMAGE_BYTES + 1}]) {
    assert.throws(() => validateImageFile(file));
  }
});

test('image bytes are checked independently of user-provided extension and content type', async () => {
  assert.equal(detectImageType(png), 'image/png');
  assert.equal(detectImageType(Uint8Array.of(255, 216, 255)), 'image/jpeg');
  assert.equal(detectImageType(Buffer.from('RIFF1234WEBP')), 'image/webp');
  assert.equal(detectImageType(Buffer.from('<svg/>')), null);
  await checkImage(new File([png], 'recipe.png', {type: 'image/png'}));
  await assert.rejects(checkImage(new File(['<script>'], 'fake.png', {type: 'image/png'})), /内容与格式不符/);
});

test('recognition JSON schema rejects missing fields, wrong types, extra fields, invalid quantities and excessive output', () => {
  assert.equal(validateRecognition(extraction()).timeMinutes, null);
  const invalid = [{...extraction(), id: 'injected'}, {...extraction(), timeMinutes: '15'}, {...extraction(), timeMinutes: 0},
    {...extraction(), ingredients: [{ingredientId: 'egg'}]}, {...extraction(), steps: ['']},
    {...extraction(), warnings: [12]}, {...extraction(), nameZh: 'x'.repeat(101)}, {...extraction(), ingredients: Array(81).fill(extraction().ingredients[0])}];
  for (const value of invalid) assert.throws(() => validateRecognition(value), /格式无效/);
  assert.throws(() => validateRecognition({...extraction(), isRecipe: false}), /未识别出菜谱/);
});

test('matching uses exact normalized canonical names or aliases and refuses ambiguity or partial guesses', () => {
  assert.equal(matchIngredient('  EGGS  ', ingredients), 'egg');
  assert.equal(matchIngredient('西红柿', ingredients), 'tomato');
  assert.equal(matchIngredient('Ｅｇｇ', ingredients), 'egg');
  assert.equal(matchIngredient('番茄酱', ingredients), '');
  assert.equal(matchIngredient('egg', [...ingredients, {id: 'other', nameZh: '其他', aliases: ['egg']}]), '');
  assert.equal(matchIngredient(null, ingredients), '');
});

test('draft conversion retains unknown fields as blanks with original ingredient evidence and actionable warnings', () => {
  const {draft, warnings} = recognitionToDraft(extraction(), ingredients);
  assert.equal(draft.timeMinutes, '');
  assert.equal(draft.nameEn, '');
  assert.equal(draft.ingredients[0].ingredientId, 'egg');
  assert.equal(draft.ingredients[1].ingredientId, '');
  assert.equal(draft.ingredients[1].amount, '');
  assert.equal(draft.ingredients[1].unit, '');
  assert.equal(draft.ingredients[1].quantityText, '少许');
  assert.ok(warnings.some(item => item.includes('烹饪时间')));
  assert.ok(warnings.some(item => item.includes('手动选择')));
  const incomplete = recognitionToDraft({...extraction(), nameZh: null, ingredients: [], steps: []}, ingredients);
  assert.equal(incomplete.draft.nameZh, '');
  assert.equal(incomplete.draft.ingredients[0].unit, '');
  assert.deepEqual(incomplete.draft.steps, ['']);
});

test('configuration status returns explicit unconfigured state and refuses malformed responses', async () => {
  const status = await getRecognitionStatus({fetchImpl: async () => Response.json({configured: false, message: '未配置'})});
  assert.equal(status.configured, false);
  await assert.rejects(getRecognitionStatus({fetchImpl: async () => Response.json({})}), /无法检查/);
});

function xhrFixture() {
  const xhr = {upload: {}, headers: {}, open(method, url) { this.method = method; this.url = url; },
    setRequestHeader(key, value) { this.headers[key] = value; }, send(file) { this.file = file; }, abort() { this.onabort?.(); }};
  return xhr;
}

test('browser upload sends only image bytes, reports upload/recognition transition and validates the response', async () => {
  const xhr = xhrFixture();
  const progress = [];
  const file = new File([png], 'image.png', {type: 'image/png'});
  const pending = uploadRecipeImage(file, {createXHR: () => xhr, onProgress: value => progress.push(value)});
  assert.equal(xhr.url, '/api/recipe-recognition');
  assert.equal(xhr.file, file);
  assert.deepEqual(xhr.headers, {'Content-Type': 'image/png'});
  xhr.upload.onprogress({lengthComputable: true, loaded: 5, total: 10});
  xhr.upload.onload();
  xhr.status = 200; xhr.responseText = JSON.stringify({recipe: extraction()}); xhr.onload();
  assert.deepEqual(await pending, extraction());
  assert.deepEqual(progress, [50, 100]);
});

test('browser upload handles invalid JSON, invalid recipe schema, unconfigured API, network errors, timeout and cancellation', async () => {
  for (const [status, text, pattern] of [[200, '{broken', /无法解析/], [200, '{"recipe":{}}', /格式无效/], [503, '{"error":{"code":"AI_NOT_CONFIGURED","message":"未配置"}}', /未配置/]]) {
    const xhr = xhrFixture();
    const pending = uploadRecipeImage({type: 'image/png'}, {createXHR: () => xhr});
    xhr.status = status; xhr.responseText = text; xhr.onload();
    await assert.rejects(pending, pattern);
  }
  for (const [event, pattern] of [['onerror', /连接失败/], ['ontimeout', /超时/]]) {
    const xhr = xhrFixture();
    const pending = uploadRecipeImage({type: 'image/png'}, {createXHR: () => xhr});
    xhr[event](); await assert.rejects(pending, pattern);
  }
  const xhr = xhrFixture();
  const controller = new AbortController();
  const pending = uploadRecipeImage({type: 'image/png'}, {createXHR: () => xhr, signal: controller.signal});
  controller.abort();
  await assert.rejects(pending, {name: 'AbortError'});
});
