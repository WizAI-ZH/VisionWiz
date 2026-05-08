const { ipcRenderer } = require('electron');

let currentPreviewUrl = null;
let currentPreviewDataUrl = '';
let latestPreviewState = {
  connected: false,
  authenticated: false,
  previewActive: false,
  error: '',
};

document.getElementById('sender').onclick = function () {
  ipcRenderer.send('openfile', '');
};

ipcRenderer.on('save-dir', function (_event, arg) {
  document.getElementById('sender').value = arg;
  ipcRenderer.send('config_save_img', arg);
});

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const k210PreviewImage = document.getElementById('k210_preview_image');
const k210PreviewPlaceholder = document.getElementById('k210_preview_placeholder');
const k210PreviewStatus = document.getElementById('k210_preview_status');
const k210PreviewStart = document.getElementById('k210_preview_start');
const k210PreviewStop = document.getElementById('k210_preview_stop');
const previewSourceBadge = document.getElementById('preview_source_badge');
const burstModeCheckbox = document.getElementById('burst_mode');
const burstCountInput = document.getElementById('burst_count');

let burstCaptureState = null;

function isUsingK210Preview() {
  return latestPreviewState.previewActive && !!currentPreviewDataUrl;
}

function refreshPreviewSurface() {
  const localCameraActive = typeof zt !== 'undefined' && zt;
  const usingK210 = isUsingK210Preview();

  k210PreviewImage.style.display = usingK210 ? 'block' : 'none';
  video.style.display = usingK210 ? 'none' : 'block';

  if (usingK210) {
    k210PreviewPlaceholder.style.display = 'none';
    previewSourceBadge.textContent = current_locales_local ? current_locales_local.k210_preview_title : 'K210';
    return;
  }

  previewSourceBadge.textContent = current_locales_local ? current_locales_local.local_camera_preview_title : 'Local Camera';
  if (localCameraActive) {
    k210PreviewPlaceholder.style.display = 'none';
  } else {
    k210PreviewPlaceholder.style.display = 'flex';
    k210PreviewPlaceholder.textContent = current_locales_local
      ? current_locales_local.k210_preview_placeholder
      : 'Open the local camera or controller preview to continue.';
  }
}

function buildCaptureFilePath(baseDir, className, index = 0) {
  const stamp = `${Date.now()}_${index}`;
  return `${baseDir}/${className}_${stamp}.jpg`;
}

function saveCapturedImage(imgData, filePath) {
  ipcRenderer.send('savedir', filePath);
  ipcRenderer.send('imgbase64', imgData);
}

function finishBurstCapture(successCount) {
  burstCaptureState = null;
  Notiflix.Notify.success(`${current_locales_local.captureSuccess} (${successCount})`);
}

async function captureLocalBurst(sender, className, totalCount) {
  if (!zt) {
    Notiflix.Notify.warning(current_locales_local.openCamera);
    return;
  }
  let savedCount = 0;
  for (let index = 0; index < totalCount; index += 1) {
    const realW = video.videoWidth;
    const realH = video.videoHeight;
    if (!realW || !realH) {
      throw new Error('Unable to read the current camera resolution.');
    }
    canvas.width = realW;
    canvas.height = realH;
    context.drawImage(video, 0, 0, realW, realH);
    const imgData = canvas.toDataURL('image/png');
    saveCapturedImage(imgData, buildCaptureFilePath(sender, className, index));
    savedCount += 1;
    if (index < totalCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  finishBurstCapture(savedCount);
}

function startK210Burst(sender, className, totalCount) {
  if (!isUsingK210Preview()) {
    Notiflix.Notify.warning(current_locales_local.k210_preview_status_ready || 'K210 preview is required.');
    return;
  }
  burstCaptureState = {
    source: 'k210',
    sender,
    className,
    totalCount,
    savedCount: 0,
    lastFrameId: -1,
  };
  Notiflix.Notify.info(`${current_locales_local.burst_capture_waiting || 'Waiting for preview frames...'} (${totalCount})`);
}

async function handleCaptureClick() {
  const className = document.getElementById('classname').value.trim();
  const sender = document.getElementById('sender').value.trim();
  const burstEnabled = !!burstModeCheckbox.checked;
  const burstCount = Math.max(1, parseInt(burstCountInput.value, 10) || 10);

  if (burstCaptureState) {
    Notiflix.Notify.warning(current_locales_local.train_started_warn || 'A burst capture task is already running.');
    return;
  }

  if (!className) return Notiflix.Notify.warning(current_locales_local.enterClassName);
  if (!sender) return Notiflix.Notify.warning(current_locales_local.selectPath);

  try {
    if (burstEnabled) {
      if (isUsingK210Preview()) {
        startK210Burst(sender, className, burstCount);
      } else {
        await captureLocalBurst(sender, className, burstCount);
      }
      return;
    }

    let imgData = '';

    if (isUsingK210Preview()) {
      imgData = currentPreviewDataUrl;
    } else {
      if (!zt) {
        return Notiflix.Notify.warning(current_locales_local.openCamera);
      }

      const realW = video.videoWidth;
      const realH = video.videoHeight;
      if (!realW || !realH) {
        throw new Error('Unable to read the current camera resolution.');
      }

      canvas.width = realW;
      canvas.height = realH;
      context.drawImage(video, 0, 0, realW, realH);
      imgData = canvas.toDataURL('image/png');
    }

    const path = buildCaptureFilePath(sender, className);
    saveCapturedImage(imgData, path);
    Notiflix.Notify.success(current_locales_local.captureSuccess);
  } catch (err) {
    console.error('Capture failed:', err);
    Notiflix.Notify.failure(`Capture failed: ${err.message}`);
  }
}

function handleHistoryClick() {
  const path = document.getElementById('sender').value;
  if (path.length === 0) {
    document.getElementById('imglist').innerHTML = `<div>${current_locales_local.noFiles}</div>`;
  } else {
    ipcRenderer.send('readimgdir', path);
    document.getElementById('imglist').innerHTML = '';
  }
}

document.getElementById('img_capture').addEventListener('click', handleCaptureClick);
document.getElementById('img_history').addEventListener('click', handleHistoryClick);
document.getElementById('open_capture_path').addEventListener('click', () => {
  const savePath = document.getElementById('sender').value.trim();
  if (!savePath) {
    Notiflix.Notify.warning(current_locales_local.selectPath);
    return;
  }
  ipcRenderer.send('open-path', savePath);
});

ipcRenderer.on('readimgdir', function (_event, arg) {
  const path = document.getElementById('sender').value;
  let html = "<div class='row row-cols-2 row-cols-lg-5 g-2 g-lg-3'>";
  document.getElementById('imgModalLabel').innerHTML = `${current_locales_local.captureRecord} ( ${arg.length} ${current_locales_local.img_num} )`;
  if (arg.length === 0) {
    document.getElementById('imglist').innerHTML = `<div>${current_locales_local.noFiles}</div>`;
  } else {
    for (const f of arg) {
      html += `<div style="display:flex;flex-direction:column;align-items:center;">
                <img src="${path}/${f}" style="width:140px" class="rounded float-start" alt="${f}">
                <p>${f}</p></div>`;
    }
    html += '</div>';
    document.getElementById('imglist').innerHTML = html;
  }
});

ipcRenderer.send('config', '');
ipcRenderer.on('config', function (_event, arg) {
  document.getElementById('classname').value = arg.save_img_name;
  document.getElementById('sender').value = arg.save_img;
  if (typeof arg.burst_mode === 'boolean') {
    burstModeCheckbox.checked = arg.burst_mode;
  }
  if (arg.burst_count) {
    burstCountInput.value = arg.burst_count;
  }
});

document.getElementById('classname').oninput = function () {
  ipcRenderer.send('config_save_img_name', this.value);
};

burstModeCheckbox.addEventListener('change', function () {
  ipcRenderer.send('config_burst_mode', this.checked);
});

burstCountInput.addEventListener('input', function () {
  const normalized = Math.max(1, parseInt(this.value, 10) || 10);
  this.value = normalized;
  ipcRenderer.send('config_burst_count', normalized);
});

function revokePreviewUrl() {
  if (currentPreviewUrl && currentPreviewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(currentPreviewUrl);
  }
  currentPreviewUrl = null;
}

function resetPreviewImage() {
  if (burstCaptureState && burstCaptureState.source === 'k210') {
    burstCaptureState = null;
  }
  revokePreviewUrl();
  currentPreviewDataUrl = '';
  k210PreviewImage.removeAttribute('src');
  refreshPreviewSurface();
}

function getPreviewStatusText(state) {
  if (!current_locales_local) return 'K210 preview';
  if (state.error) return `${current_locales_local.k210_preview_error}: ${state.error}`;
  if (state.previewActive) return current_locales_local.k210_preview_status_streaming;
  if (state.authenticated) return current_locales_local.k210_preview_status_ready;
  if (state.connected) return current_locales_local.k210_preview_status_wait_auth;
  return current_locales_local.k210_preview_status_wait_auth;
}

function updatePreviewButtons(state) {
  k210PreviewStart.disabled = !state.authenticated || state.previewActive;
  k210PreviewStop.disabled = !state.previewActive;
}

function updatePreviewState(partial = {}) {
  latestPreviewState = {
    ...latestPreviewState,
    ...partial,
  };
  console.log('[K210 PREVIEW][RENDERER STATUS]', latestPreviewState);

  k210PreviewStatus.textContent = getPreviewStatusText(latestPreviewState);
  if (latestPreviewState.error) {
    k210PreviewStatus.style.background = '#fee2e2';
    k210PreviewStatus.style.color = '#991b1b';
  } else if (latestPreviewState.previewActive) {
    k210PreviewStatus.style.background = '#dcfce7';
    k210PreviewStatus.style.color = '#166534';
  } else if (latestPreviewState.authenticated) {
    k210PreviewStatus.style.background = '#dbeafe';
    k210PreviewStatus.style.color = '#1d4ed8';
  } else {
    k210PreviewStatus.style.background = '#e5e7eb';
    k210PreviewStatus.style.color = '#374151';
  }

  updatePreviewButtons(latestPreviewState);
  refreshPreviewSurface();
}

k210PreviewStart.addEventListener('click', async () => {
  try {
    const state = await ipcRenderer.invoke('start-k210-preview');
    updatePreviewState(state || {});
  } catch (error) {
    updatePreviewState({
      error: error.message,
      previewActive: false,
    });
    Notiflix.Notify.failure(error.message);
  }
});

k210PreviewStop.addEventListener('click', async () => {
  try {
    const state = await ipcRenderer.invoke('stop-k210-preview');
    updatePreviewState(state || {});
    resetPreviewImage();
  } catch (error) {
    updatePreviewState({ error: error.message });
    Notiflix.Notify.failure(error.message);
  }
});

ipcRenderer.on('k210-preview-frame', (_event, payload) => {
  if (!payload || !payload.jpegBase64) return;
  console.log('[K210 PREVIEW][RENDERER FRAME]', payload.frameId, payload.width, payload.height);
  currentPreviewDataUrl = `data:image/jpeg;base64,${payload.jpegBase64}`;
  revokePreviewUrl();
  currentPreviewUrl = currentPreviewDataUrl;
  k210PreviewImage.src = currentPreviewDataUrl;
  updatePreviewState({
    previewActive: true,
    error: '',
  });

  if (burstCaptureState && burstCaptureState.source === 'k210') {
    if (burstCaptureState.lastFrameId === payload.frameId) {
      return;
    }
    burstCaptureState.lastFrameId = payload.frameId;
    saveCapturedImage(
      currentPreviewDataUrl,
      buildCaptureFilePath(burstCaptureState.sender, burstCaptureState.className, burstCaptureState.savedCount)
    );
    burstCaptureState.savedCount += 1;
    if (burstCaptureState.savedCount >= burstCaptureState.totalCount) {
      finishBurstCapture(burstCaptureState.savedCount);
    }
  }
});

ipcRenderer.on('k210-preview-status', (_event, payload = {}) => {
  console.log('[K210 PREVIEW][RENDERER STATUS EVENT]', payload);
  updatePreviewState(payload);
  if (!payload.previewActive) {
    resetPreviewImage();
  }
});

ipcRenderer.on('k210-preview-error', (_event, payload = {}) => {
  console.error('[K210 PREVIEW][RENDERER ERROR EVENT]', payload);
  updatePreviewState({
    ...payload,
    previewActive: false,
  });
  resetPreviewImage();
});

ipcRenderer.on('change-language', () => {
  setTimeout(() => updatePreviewState({}), 120);
});

window.addEventListener('beforeunload', () => {
  revokePreviewUrl();
  ipcRenderer.invoke('stop-k210-preview').catch(() => {});
});

const $ = (sel) => document.querySelector(sel);
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function applyResponsiveLayout({ width, height }) {
  const paddingX = 24;
  const paddingY = 16;
  const workW = Math.max(320, width - paddingX * 2);
  const workH = Math.max(300, height - paddingY * 2);

  const desc = $('#descript_data_collect');
  if (desc) {
    const descW = clamp(Math.floor(workW * 0.96), 320, 1200);
    desc.style.maxWidth = `${descW}px`;
    desc.style.margin = '0 auto 12px auto';
    desc.style.fontSize = workW < 480 ? '12px' : workW < 768 ? '14px' : '16px';
    desc.style.lineHeight = '1.4';
    desc.style.borderRadius = workW < 480 ? '8px' : '12px';
  }

  const formRow = document.querySelector('.collect-form-card');
  if (formRow) {
    const maxFormW = clamp(Math.floor(workW * 0.9), 360, 820);
    formRow.style.maxWidth = `${maxFormW}px`;
    const vertical = maxFormW < 640;
    formRow.style.flexDirection = vertical ? 'column' : 'row';
    formRow.style.gap = vertical ? '12px' : '20px';
  }

  const workspace = document.querySelector('.collect-workspace');
  const sidebar = document.querySelector('.collect-sidebar');
  if (workspace && sidebar) {
    const stackSidebar = workW < 1100;
    workspace.style.gridTemplateColumns = stackSidebar ? '1fr' : 'minmax(0, 1fr) minmax(180px, 220px)';
    sidebar.style.flexDirection = stackSidebar ? 'row' : 'column';
    sidebar.style.flexWrap = stackSidebar ? 'wrap' : 'nowrap';
    sidebar.style.justifyContent = stackSidebar ? 'center' : 'flex-start';
  }

  const captureBtn = $('#img_capture');
  if (captureBtn) {
    const btnSize = clamp(Math.floor(workW < 1100 ? 90 : 112), 84, 112);
    captureBtn.style.width = `${btnSize}px`;
    captureBtn.style.height = `${btnSize}px`;
    captureBtn.style.fontSize = `${clamp(Math.floor(btnSize * 0.16), 14, 18)}px`;
  }

  ['#img_history', '#k210_preview_start', '#k210_preview_stop', '#cbtn'].forEach((selector) => {
    const el = $(selector);
    if (el) {
      el.style.minWidth = `${clamp(Math.floor(workW * 0.14), 140, 200)}px`;
    }
  });

  if (video && canvas) {
    canvas.style.width = video.clientWidth ? `${video.clientWidth}px` : '100%';
    canvas.style.height = video.clientHeight ? `${video.clientHeight}px` : 'auto';
  }

  const surfaceHeight = clamp(Math.floor(workH - 240), 240, 560);
  document.querySelectorAll('.preview-surface').forEach((surface) => {
    surface.style.maxHeight = `${surfaceHeight}px`;
  });
}

let resizeTimer = null;
function scheduleApplyLayout(size) {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    applyResponsiveLayout(size);
    resizeTimer = null;
  }, 50);
}

ipcRenderer.on('window-resize', (_event, { width, height }) => {
  scheduleApplyLayout({ width, height });
});

window.addEventListener('DOMContentLoaded', () => {
  const initialW = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const initialH = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  scheduleApplyLayout({ width: initialW, height: initialH });
  refreshPreviewSurface();
});

window.addEventListener('resize', () => {
  const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const h = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  scheduleApplyLayout({ width: w, height: h });
});

function syncPreviewState() {
  ipcRenderer.invoke('get-k210-preview-state')
    .then((state) => {
      if (state) updatePreviewState(state);
    })
    .catch(() => {});
}

syncPreviewState();
setInterval(syncPreviewState, 1500);
