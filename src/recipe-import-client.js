import {validateImageFile, detectImageType, validateRecognition} from './recipe-import.js';

export async function checkImage(file) {
  validateImageFile(file);
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (detectImageType(signature) !== file.type) throw new Error('图片内容与格式不符，请重新选择。');
}

export async function getRecognitionStatus({fetchImpl = fetch, signal} = {}) {
  const response = await fetchImpl('/api/recipe-recognition/status', {cache: 'no-store', signal: signal || AbortSignal.timeout(10000)});
  const status = await response.json();
  if (!response.ok || typeof status.configured !== 'boolean' || typeof status.message !== 'string') throw new Error('无法检查 AI 配置，请确认项目服务端已启动。');
  return status;
}

export function uploadRecipeImage(file, {signal, onProgress = () => {}, createXHR = () => new XMLHttpRequest()} = {}) {
  return new Promise((resolve, reject) => {
    const xhr = createXHR();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const fail = error => { cleanup(); reject(error); };
    const abort = () => { xhr.abort(); fail(new DOMException('已取消', 'AbortError')); };
    xhr.open('POST', '/api/recipe-recognition');
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.timeout = 80000;
    xhr.upload.onprogress = event => onProgress(event.lengthComputable ? Math.round(event.loaded / event.total * 100) : 0);
    xhr.upload.onload = () => onProgress(100);
    xhr.onload = () => {
      cleanup();
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300) {
          const error = new Error(typeof data.error?.message === 'string' ? data.error.message : '识别失败，请重试。');
          error.code = data.error?.code;
          throw error;
        }
        resolve(validateRecognition(data.recipe));
      } catch (error) { reject(error instanceof SyntaxError ? new Error('服务端返回的数据无法解析，请重试。') : error); }
    };
    xhr.onerror = () => fail(new Error('上传或识别连接失败，请检查网络后重试。'));
    xhr.ontimeout = () => fail(new Error('识别超时，请重试或更换较清晰的图片。'));
    xhr.onabort = () => fail(new DOMException('已取消', 'AbortError'));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, {once: true});
    xhr.send(file);
  });
}
