import {checkImage, getRecognitionStatus, uploadRecipeImage} from './recipe-import-client.js';

// In-memory only. Sequence checks prevent cancelled/replaced uploads from restoring stale results.
export function createImageImporter({changed = () => {}, check = checkImage, status = getRecognitionStatus,
  upload = uploadRecipeImage, createURL = file => URL.createObjectURL(file), revokeURL = url => URL.revokeObjectURL(url)} = {}) {
  const state = {active: false, phase: 'idle', configured: null, preview: '', filename: '', progress: 0, error: '', result: null};
  let file = null;
  let controller;
  let version = 0;
  let configVersion = 0;
  const stop = () => { version++; controller?.abort(); controller = null; };
  const clearImage = () => {
    if (state.preview) revokeURL(state.preview);
    state.preview = ''; state.filename = ''; state.result = null; file = null;
  };
  const close = () => {
    stop(); configVersion++; clearImage();
    Object.assign(state, {active: false, phase: 'idle', configured: null, error: '', progress: 0});
    changed();
  };
  async function refreshStatus() {
    const current = ++configVersion;
    state.phase = 'checking'; state.error = ''; changed();
    try {
      const config = await status();
      if (current !== configVersion || !state.active) return;
      state.configured = config.configured;
      state.phase = config.configured ? 'idle' : 'unconfigured';
      state.error = config.configured ? '' : config.message;
    } catch (error) {
      if (current !== configVersion || !state.active) return;
      state.configured = null; state.phase = 'failure'; state.error = error.message;
    }
    changed();
  }
  return {
    state, close, refreshStatus,
    async open() { close(); state.active = true; return refreshStatus(); },
    async selectFiles(files) {
      stop(); clearImage();
      const current = version;
      state.error = ''; state.phase = 'validating'; changed();
      try {
        if (files.length !== 1) throw new Error('请一次选择一张菜谱图片。');
        const selected = files[0];
        await check(selected);
        if (current !== version || !state.active) return;
        file = selected; state.preview = createURL(selected); state.filename = selected.name;
        state.phase = state.configured === false ? 'unconfigured' : 'selected';
      } catch (error) {
        if (current !== version || !state.active) return;
        state.phase = 'failure'; state.error = error.message;
      }
      changed();
    },
    async recognize() {
      if (!file || state.configured !== true) return;
      stop();
      const current = version;
      controller = new AbortController();
      state.result = null; state.error = ''; state.phase = 'uploading'; state.progress = 0; changed();
      try {
        const result = await upload(file, {signal: controller.signal, onProgress(progress) {
          if (current !== version || !state.active) return;
          state.progress = progress; state.phase = progress >= 100 ? 'recognizing' : 'uploading'; changed();
        }});
        if (current !== version || !state.active) return;
        state.result = result; state.phase = 'ready';
      } catch (error) {
        if (current !== version || !state.active) return;
        state.phase = error.code === 'AI_NOT_CONFIGURED' ? 'unconfigured' : 'failure';
        if (error.code === 'AI_NOT_CONFIGURED') state.configured = false;
        state.error = error.message;
      }
      if (current === version) controller = null;
      changed();
    },
    applied() { state.result = null; state.phase = 'review'; changed(); },
    cancelRecognition() {
      stop(); state.result = null; state.phase = 'cancelled'; state.error = ''; changed();
    },
  };
}
