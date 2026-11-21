import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageImporter} from '../src/recipe-image-importer.js';
import {extraction} from './fixtures/recognition.js';

function fixture(options = {}) {
  const revoked = [];
  const phases = [];
  let importer;
  importer = createImageImporter({status: async () => ({configured: true}), check: async () => {},
    createURL: file => `blob:${file.name}`, revokeURL: url => revoked.push(url),
    changed: () => phases.push(importer.state.phase), ...options});
  return {importer, revoked, phases};
}

test('import lifecycle shows preview, uploading, recognizing, ready and review without saving', async () => {
  const {importer, phases, revoked} = fixture({upload: async (file, {onProgress}) => { onProgress(50); onProgress(100); return extraction(); }});
  await importer.open();
  await importer.selectFiles([{name: 'recipe.png'}]);
  assert.equal(importer.state.preview, 'blob:recipe.png');
  await importer.recognize();
  assert.deepEqual(importer.state.result, extraction());
  for (const phase of ['checking', 'selected', 'uploading', 'recognizing', 'ready']) assert.ok(phases.includes(phase));
  importer.applied(); assert.equal(importer.state.phase, 'review');
  importer.close(); assert.equal(importer.state.preview, '');
  assert.deepEqual(revoked, ['blob:recipe.png']);
});

test('missing API configuration is explicit and never attempts upload; configuration can be rechecked', async () => {
  let configured = false;
  let calls = 0;
  const {importer} = fixture({status: async () => ({configured, message: '请配置密钥'}), upload: async () => { calls++; return extraction(); }});
  await importer.open();
  assert.equal(importer.state.phase, 'unconfigured');
  await importer.selectFiles([{name: 'x.png'}]);
  await importer.recognize(); assert.equal(calls, 0);
  configured = true; await importer.refreshStatus(); await importer.recognize();
  assert.equal(calls, 1);
});

test('failed recognition can retry and selecting a replacement revokes the old preview', async () => {
  let calls = 0;
  const {importer, revoked} = fixture({upload: async () => { if (++calls === 1) throw new Error('解析失败'); return extraction(); }});
  await importer.open(); await importer.selectFiles([{name: 'first.png'}]);
  await importer.recognize(); assert.equal(importer.state.phase, 'failure');
  await importer.recognize(); assert.equal(importer.state.phase, 'ready');
  await importer.selectFiles([{name: 'next.png'}]);
  assert.deepEqual(revoked, ['blob:first.png']);
  assert.equal(importer.state.result, null);
  await importer.selectFiles([]); assert.match(importer.state.error, /一张/);
});

test('cancel aborts requests, ignores late results and leaves a retryable selected image', async () => {
  let resolve;
  let signal;
  const {importer} = fixture({upload: async (file, options) => { signal = options.signal; return new Promise(done => { resolve = done; }); }});
  await importer.open(); await importer.selectFiles([{name: 'x.png'}]);
  const pending = importer.recognize();
  importer.cancelRecognition();
  assert.equal(signal.aborted, true);
  resolve(extraction()); await pending;
  assert.equal(importer.state.phase, 'cancelled');
  assert.equal(importer.state.result, null);
  assert.equal(importer.state.preview, 'blob:x.png');
});

test('closing while file validation is pending never recreates a preview or retains the file', async () => {
  let finish;
  const {importer} = fixture({check: () => new Promise(resolve => { finish = resolve; })});
  await importer.open();
  const pending = importer.selectFiles([{name: 'late.png'}]);
  importer.close(); finish(); await pending;
  assert.equal(importer.state.active, false);
  assert.equal(importer.state.preview, '');
});
