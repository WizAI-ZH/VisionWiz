
const { ipcRenderer } = require('electron');

document.getElementById("sender").onclick = function () {
  ipcRenderer.send('openfile', '');
};

ipcRenderer.on('save-dir', function (event, arg) {
  document.getElementById('sender').value = arg;
  ipcRenderer.send('config_save_img', arg);
});

let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d');

// ✅ 修订后的拍照函数：始终基于摄像头原始分辨率截图
function handleCaptureClick() {
  if (!zt) {
    return Notiflix.Notify.warning(current_locales_local.openCamera);
  }

  const className = document.getElementById('classname').value.trim();
  const sender = document.getElementById('sender').value.trim();

  if (!className)
    return Notiflix.Notify.warning(current_locales_local.enterClassName);
  if (!sender)
    return Notiflix.Notify.warning(current_locales_local.selectPath);

  try {
    // 获取摄像头真实分辨率
    const realW = video.videoWidth;
    const realH = video.videoHeight;
    if (!realW || !realH) {
      throw new Error('无法获取摄像头分辨率，请确保摄像头已打开');
    }

    // 临时调整 canvas 到真实分辨率再绘制
    canvas.width = realW;
    canvas.height = realH;
    context.drawImage(video, 0, 0, realW, realH);

    const imgData = canvas.toDataURL("image/png");
    const path = `${sender}/${className}_${Date.now()}.jpg`;
    ipcRenderer.send('savedir', path);
    ipcRenderer.send('imgbase64', imgData);
    Notiflix.Notify.success(current_locales_local.captureSuccess);
  } catch (err) {
    console.error('捕获错误:', err);
    Notiflix.Notify.failure('捕获图像失败: ' + err.message);
  }
}

function handleHistoryClick() {
  let path = document.getElementById('sender').value;
  if (path.length == 0) {
    let html = `<div>${current_locales_local.noFiles}</div>`;
    document.getElementById('imglist').innerHTML = html;
  } else {
    ipcRenderer.send('readimgdir', path);
    document.getElementById('imglist').innerHTML = '';
  }
}

document.getElementById('img_capture').addEventListener('click', handleCaptureClick);
document.getElementById('img_history').addEventListener('click', handleHistoryClick);

ipcRenderer.on('readimgdir', function (event, arg) {
  let path = document.getElementById('sender').value;
  let html = "<div class='row row-cols-2 row-cols-lg-5 g-2 g-lg-3'>";
  document.getElementById('imgModalLabel').innerHTML = `${current_locales_local.captureRecord} ( ${arg.length} ${current_locales_local.img_num} )`;
  if (arg.length == 0) {
    document.getElementById('imglist').innerHTML = `<div>${current_locales_local.noFiles}</div>`;
  } else {
    for (let f of arg) {
      html += `<div style="display: flex;flex-direction: column;align-items: center;">
                <img src="${path}/${f}" style="width:140px" class="rounded float-start" alt="${f}">
                <p>${f}</p></div>`;
    }
    html += "</div>";
    document.getElementById('imglist').innerHTML = html;
  }
});

ipcRenderer.send('config', '');
ipcRenderer.on('config', function (event, arg) {
  document.getElementById('classname').value = arg['save_img_name'];
  document.getElementById('sender').value = arg['save_img'];
});

document.getElementById('classname').oninput = function () {
  ipcRenderer.send('config_save_img_name', this.value);
};

// ========== 以下保持你的响应式布局逻辑 ==========

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
    const maxDescW = Math.floor(workW * 0.9);
    const descW = clamp(maxDescW, 320, 1200);
    desc.style.width = `${descW}px`;
    desc.style.margin = '8px auto 0 auto';
    desc.style.fontSize = workW < 480 ? '12px' : workW < 768 ? '14px' : '16px';
    desc.style.lineHeight = '1.4';
    desc.style.borderRadius = workW < 480 ? '6px' : '8px';
    desc.style.boxShadow = workW < 480 ? '0 2px 6px rgba(0,0,0,0.08)' : '0 4px 8px rgba(0,0,0,0.1)';
  }

  const formRow = document.querySelector('.container')?.querySelector('div[style*="linear-gradient"]');
  if (formRow) {
    const maxFormW = clamp(Math.floor(workW * 0.9), 360, 800);
    formRow.style.maxWidth = `${maxFormW}px`;
    const vertical = maxFormW < 640;
    formRow.style.flexDirection = vertical ? 'column' : 'row';
    formRow.style.gap = vertical ? '12px' : '20px';

    const inputs = formRow.querySelectorAll('.form-floating');
    inputs.forEach((el) => {
      el.style.width = vertical ? '100%' : '300px';
    });
  }

  const video = $('#video');
  const rightCol = $('#img_capture')?.parentElement;
  if (video && rightCol) {
    const rightColMinW = 220;
    const gap = 20;
    const maxContentW = workW;

    let videoMaxW = maxContentW - rightColMinW - gap;
    videoMaxW = clamp(videoMaxW, 320, 1280);

    const reservedTopH = 60 + 110 + 40;
    const availH = clamp(workH - reservedTopH, 220, workH);
    let videoW = Math.min(videoMaxW, Math.floor(availH * 4 / 3));
    let videoH = Math.floor(videoW * 3 / 4);

    video.style.width = `${videoW}px`;
    video.style.height = `${videoH}px`;

    rightCol.style.marginLeft = '20px';
    rightCol.style.alignItems = 'center';
    rightCol.style.gap = videoH < 360 ? '10px' : '15px';

    const captureBtn = $('#img_capture');
    if (captureBtn) {
      const btnSize = clamp(Math.floor(videoH * 0.22), 64, 120);
      captureBtn.style.width = `${btnSize}px`;
      captureBtn.style.height = `${btnSize}px`;
      captureBtn.style.fontSize = `${clamp(Math.floor(btnSize * 0.18), 12, 18)}px`;
      captureBtn.style.borderRadius = '50%';
    }

    const historyBtn = $('#img_history');
    if (historyBtn) {
      const histW = clamp(Math.floor(videoW * 0.28), 140, 220);
      historyBtn.style.width = `${histW}px`;
      historyBtn.style.fontSize = `${clamp(Math.floor(histW * 0.09), 12, 16)}px`;
    }

    // ⚠️ 注意：这里只设置视觉宽高，不影响拍照逻辑。
    const canvas = $('#canvas');
    if (canvas) {
      canvas.style.width = `${videoW}px`;
      canvas.style.height = `${videoH}px`;
    }
  }

  const camBtn = $('#cbtn');
  if (camBtn) {
    const targetW = clamp(Math.floor(workW * 0.25), 160, 260);
    camBtn.style.minWidth = `${targetW}px`;
    camBtn.style.textAlign = 'center';
  }
}

let resizeTimer = null;
function scheduleApplyLayout(size) {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    applyResponsiveLayout(size);
    resizeTimer = null;
  }, 50);
}

ipcRenderer.on('window-resize', (event, { width, height }) => {
  scheduleApplyLayout({ width, height });
});

window.addEventListener('DOMContentLoaded', () => {
  const initialW = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const initialH = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  scheduleApplyLayout({ width: initialW, height: initialH });
});

window.addEventListener('resize', () => {
  const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const h = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  scheduleApplyLayout({ width: w, height: h });
});
