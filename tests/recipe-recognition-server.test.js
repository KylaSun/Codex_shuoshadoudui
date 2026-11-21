import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {once} from 'node:events';
import {createAppServer} from '../server.js';
import {visionConfig, recognizeRecipeImage} from '../server/recipe-recognition.js';
import {MAX_IMAGE_BYTES} from '../src/recipe-import.js';
import {png, extraction, providerResponse} from './fixtures/recognition.js';

const env = {OPENAI_API_KEY: 'test-only-key'};
const fakeProvider = async () => Response.json(providerResponse(extraction()));

test('provider config stays server-side and rejects insecure or credential-bearing endpoints', () => {
  assert.equal(visionConfig({}).configured, false);
  assert.equal(visionConfig(env).model, 'gpt-5.4-mini');
  for (const endpoint of ['http://example.com', 'https://user:password@example.com', 'https://example.com?key=secret']) {
    assert.equal(visionConfig({...env, RECIPE_VISION_ENDPOINT: endpoint}).configured, false);
  }
  assert.equal(visionConfig({...env, RECIPE_VISION_MODEL: 'my-vision-model', RECIPE_VISION_ENDPOINT: 'https://example.com/v1/responses'}).model, 'my-vision-model');
});

test('provider adapter sends real image input and strict JSON schema, with provider response storage disabled', async () => {
  const result = await recognizeRecipeImage(png, 'image/png', {env, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-only-key');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(body.text.format.strict, true);
    const image = body.input[0].content.find(item => item.type === 'input_image');
    assert.equal(image.image_url, `data:image/png;base64,${png.toString('base64')}`);
    assert.match(body.instructions, /不补全常识或猜测/);
    return fakeProvider();
  }});
  assert.deepEqual(result, extraction());
});

test('provider adapter rejects bad image type, bytes, size, and missing credentials without making network calls', async () => {
  const fetchImpl = () => { throw new Error('Network must not be called'); };
  for (const [bytes, type, config, code] of [[png, 'image/gif', env, 'INVALID_IMAGE_TYPE'], [Buffer.alloc(0), 'image/png', env, 'EMPTY_IMAGE'],
    [Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image/png', env, 'IMAGE_TOO_LARGE'], [Buffer.from('fake'), 'image/png', env, 'INVALID_IMAGE_CONTENT'], [png, 'image/png', {}, 'AI_NOT_CONFIGURED']]) {
    await assert.rejects(recognizeRecipeImage(bytes, type, {env: config, fetchImpl}), error => error.code === code);
  }
});

test('upstream errors, refusal, truncated output, malformed JSON and invalid data never become successful recipes or leak upstream details', async () => {
  const cases = [
    [() => new Response('test-only-key private upstream error', {status: 401}), 'AI_UPSTREAM_ERROR'],
    [() => new Response('quota', {status: 429}), 'AI_UPSTREAM_ERROR'],
    [() => Response.json({status: 'incomplete'}), 'AI_INCOMPLETE'],
    [() => Response.json({status: 'completed', output: [{type: 'message', content: [{type: 'refusal', refusal: 'private'}]}]}), 'AI_REFUSED'],
    [() => Response.json({status: 'completed', output: [{type: 'message', content: [{type: 'output_text', text: '{broken'}]}]}), 'AI_INVALID_RESULT'],
    [() => Response.json(providerResponse({...extraction(), timeMinutes: 'unknown'})), 'AI_INVALID_RESULT'],
    [() => Response.json(providerResponse({...extraction(), isRecipe: false})), 'AI_INVALID_RESULT'],
    [() => new Response('not json'), 'AI_CONNECTION_ERROR'],
  ];
  for (const [fetchImpl, code] of cases) {
    await assert.rejects(recognizeRecipeImage(png, 'image/png', {env, fetchImpl}), error => error.code === code && !error.message.includes('test-only-key'));
  }
  const controller = new AbortController(); controller.abort();
  await assert.rejects(recognizeRecipeImage(png, 'image/png', {env, signal: controller.signal, fetchImpl: async () => { throw new DOMException('aborted', 'AbortError'); }}), error => error.code === 'AI_TIMEOUT');
});

async function serverFixture(t, config = {}) {
  const server = createAppServer({env, fetchImpl: fakeProvider, ...config});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('HTTP API recognizes uploaded bytes, validates requests, hides secrets, and preserves public UI assets', async t => {
  const base = await serverFixture(t);
  const status = await (await fetch(`${base}/api/recipe-recognition/status`)).json();
  assert.equal(status.configured, true);
  assert.ok(!JSON.stringify(status).includes('test-only-key'));
  const success = await fetch(`${base}/api/recipe-recognition`, {method: 'POST', headers: {'Content-Type': 'image/png'}, body: png});
  assert.equal(success.status, 200);
  assert.deepEqual((await success.json()).recipe, extraction());
  for (const path of ['/', '/src/main.js', '/src/recipe-import-client.js', '/src/c-adapter.js', '/src/integration.css', '/assets/regional-dishes.jpg']) assert.equal((await fetch(base + path)).status, 200);
  for (const path of ['/.env', '/.env.example', '/.git/config', '/server.js', '/server/recipe-recognition.js', '/src/../.env', '/package.json']) assert.equal((await fetch(base + path)).status, 404);
  assert.equal((await fetch(`${base}/api/recipe-recognition`)).status, 405);
  assert.equal((await fetch(`${base}/api/recipe-recognition`, {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: 'text'})).status, 415);
  assert.equal((await fetch(`${base}/api/recipe-recognition`, {method: 'POST', headers: {'Content-Type': 'image/png'}, body: 'fake'})).status, 415);
  assert.equal((await fetch(`${base}/api/recipe-recognition`, {method: 'POST', headers: {'Content-Type': 'image/png'}})).status, 400);
  assert.equal((await fetch(`${base}/api/recipe-recognition`, {method: 'POST', headers: {'Content-Type': 'image/png', Origin: 'https://other.example'}, body: png})).status, 403);
});

test('HTTP API explicitly reports absent configuration without calling the provider', async t => {
  const base = await serverFixture(t, {env: {}, fetchImpl: () => { throw new Error('Must not call provider'); }});
  assert.equal((await (await fetch(`${base}/api/recipe-recognition/status`)).json()).configured, false);
  const response = await fetch(`${base}/api/recipe-recognition`, {method: 'POST', headers: {'Content-Type': 'image/png'}, body: png});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AI_NOT_CONFIGURED');
});

test('HTTP API enforces the body limit for declared sizes and chunked uploads', async t => {
  const base = await serverFixture(t);
  const declared = await fetch(`${base}/api/recipe-recognition`, {method: 'POST', headers: {'Content-Type': 'image/png'}, body: Buffer.alloc(MAX_IMAGE_BYTES + 1)});
  assert.equal(declared.status, 413);
  const status = await new Promise((resolve, reject) => {
    const req = request(`${base}/api/recipe-recognition`, {method: 'POST', headers: {'Content-Type': 'image/png', 'Transfer-Encoding': 'chunked'}}, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write(Buffer.alloc(MAX_IMAGE_BYTES)); req.end(Buffer.alloc(1));
  });
  assert.equal(status, 413);
});

test('HTTP concurrency limit rejects excess work and disconnecting clients abort upstream requests', async t => {
  let started = 0;
  let ready;
  const bothStarted = new Promise(resolve => { ready = resolve; });
  let cancelled;
  const upstreamCancelled = new Promise(resolve => { cancelled = resolve; });
  const finish = [];
  const base = await serverFixture(t, {fetchImpl: async (url, options) => new Promise((resolve, reject) => {
    finish.push(() => resolve(Response.json(providerResponse(extraction()))));
    options.signal.addEventListener('abort', () => { cancelled(); reject(new DOMException('aborted', 'AbortError')); }, {once: true});
    if (++started === 2) ready();
  })});
  const controllers = [new AbortController(), new AbortController()];
  const pending = controllers.map(controller => fetch(`${base}/api/recipe-recognition`, {
    method: 'POST', headers: {'Content-Type': 'image/png'}, body: png, signal: controller.signal,
  }));
  await bothStarted;
  const third = await fetch(`${base}/api/recipe-recognition`, {method: 'POST', headers: {'Content-Type': 'image/png'}, body: png});
  assert.equal(third.status, 429);
  controllers[0].abort();
  await assert.rejects(pending[0], {name: 'AbortError'});
  await upstreamCancelled;
  finish[1]();
  assert.equal((await pending[1]).status, 200);
});
