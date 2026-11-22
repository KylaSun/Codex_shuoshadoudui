const KEY = 'fanxiang.recipe-video.v2';

export function createViewCounter(storage) {
  let saved;
  try { saved = JSON.parse(storage?.getItem(KEY) || 'null'); } catch {}
  let views = Number.isInteger(saved?.views) ? Math.max(0, Math.min(2, saved.views)) : 0;
  let pending = saved?.pending === true;
  let previous = typeof saved?.previous === 'string' ? saved.previous : null;
  const persist = () => { try { storage?.setItem(KEY, JSON.stringify({views, pending, previous})); } catch {} };
  return {
    visit(page, id) {
      const current = page === 'recipe' && id ? id : null;
      if (!pending && current && current !== previous) {
        if (views >= 2) pending = true;
        else views += 1;
      }
      previous = current;
      persist();
      return pending;
    },
    complete() { views = 0; pending = false; previous = null; persist(); },
  };
}

export function createRecipeVideoGate(root) {
  let storage;
  try { storage = window.sessionStorage; } catch {}
  const counter = createViewCounter(storage);
  let overlay;
  return {visit(page, id) {
    const pending = counter.visit(page, id);
    if (!pending || overlay || !document.createElement) return;
    const previousFocus = document.activeElement;
    overlay = document.createElement('div');
    overlay.className = 'recipe-video-backdrop';
    overlay.innerHTML = `<section class="recipe-video-dialog" role="dialog" aria-modal="true" aria-labelledby="recipe-video-title" tabindex="-1">
      <span class="recipe-video-label">饭乡 · 视频时间</span>
      <h2 id="recipe-video-title">看了两道菜，休息一下吧</h2>
      <p>完整观看这段视频后，即可继续浏览菜谱。</p>
      <video playsinline preload="auto" disablepictureinpicture disableremoteplayback aria-label="必看视频" src="./assets/recipe-break.mp4"></video>
      <p class="recipe-video-status" role="status" aria-live="polite">点击下方按钮开始播放</p>
      <button type="button" class="primary recipe-video-play">开始播放</button>
      <button type="button" class="primary recipe-video-continue" hidden>已看完，继续找菜 →</button>
    </section>`;
    document.body.append(overlay);
    root.inert = true;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = overlay.querySelector('section');
    const video = overlay.querySelector('video');
    const status = overlay.querySelector('.recipe-video-status');
    const play = overlay.querySelector('.recipe-video-play');
    const next = overlay.querySelector('.recipe-video-continue');
    let watched = 0, finished = false, lastTick = performance.now();
    const update = () => {
      const now = performance.now();
      const elapsed = Math.max(0, (now - lastTick) / 1000);
      lastTick = now;
      if (video.currentTime > watched + elapsed + 0.5) { video.currentTime = watched; return; }
      watched = Math.max(watched, video.currentTime);
      if (Number.isFinite(video.duration)) status.textContent = `请完整观看 · 剩余 ${Math.max(0, Math.ceil(video.duration - watched))} 秒`;
    };
    video.addEventListener('timeupdate', update);
    video.addEventListener('seeking', () => { if (video.currentTime > watched + 0.25) video.currentTime = watched; });
    video.addEventListener('ratechange', () => { if (video.playbackRate !== 1) video.playbackRate = 1; });
    video.addEventListener('play', () => { lastTick = performance.now(); play.hidden = true; });
    video.addEventListener('pause', () => { if (!finished) { play.hidden = false; play.textContent = '继续播放'; } });
    video.addEventListener('error', () => { status.textContent = '视频加载失败，请检查网络后重试。'; play.hidden = false; play.textContent = '重新加载视频'; });
    video.addEventListener('ended', () => {
      if (!Number.isFinite(video.duration) || watched < video.duration - 0.5) return;
      finished = true;
      status.textContent = '观看完成，感谢你的耐心！'; play.hidden = true; next.hidden = false; next.focus();
    });
    play.addEventListener('click', async () => {
      if (video.error) { watched = 0; video.load(); }
      try { await video.play(); } catch { status.textContent = '暂时无法播放，请点击重试。'; play.hidden = false; }
    });
    const visibility = () => { if (document.hidden) video.pause(); };
    document.addEventListener('visibilitychange', visibility);
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
      if (event.key === 'Tab') { event.preventDefault(); (finished ? next : play.hidden ? dialog : play).focus(); }
    });
    next.addEventListener('click', () => {
      if (!finished) return;
      counter.complete(); document.removeEventListener('visibilitychange', visibility);
      overlay.remove(); overlay = null; root.inert = false; document.body.style.overflow = oldOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    });
    dialog.focus();
  }};
}
