const { ipcRenderer } = require('electron');

document.getElementById("sender").onclick = function () {
  //向主进程main.js发送消息,确定要打开拍摄图片存放目录的文件夹
  ipcRenderer.send('openfile', '');
}

ipcRenderer.on('save-dir', function (event, arg) {
  //监听主进程返回过来的消息，更新拍摄图片存放目录的文件夹路径到前端以及后端
  console.log("arg:", arg);
  document.getElementById('sender').value = arg
  ipcRenderer.send('config_save_img', arg)
});

let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d');

function handleCaptureClick() {
  if (zt) {
    if ((document.getElementById('classname').value).length > 0) {
      if ((document.getElementById('sender').value).length > 0) {
        context.drawImage(video, 0, 0, 640, 480);
        const imgData = canvas.toDataURL("image/png");
        const path = document.getElementById('sender').value + '/' + document.getElementById('classname').value + '_' + Date.now() + '.jpg';
        ipcRenderer.send('savedir', path);
        ipcRenderer.send('imgbase64', imgData);
        Notiflix.Notify.success(current_locales_local.captureSuccess);
      } else {
        Notiflix.Notify.warning(current_locales_local.selectPath);
      }
    } else {
      Notiflix.Notify.warning(current_locales_local.enterClassName);
    }
  } else {
    Notiflix.Notify.warning(current_locales_local.openCamera);
  }
}

function handleHistoryClick() {
  let path = document.getElementById('sender').value;
  if (path.length == 0) {
    let html = `<div>${current_locales_local.noFiles}</div>`;
    document.getElementById('imglist').innerHTML = html;
  } else {
    ipcRenderer.send('readimgdir', path);
    console.log('img_history button pressed');
    document.getElementById('imglist').innerHTML = '';
  }
}

document.getElementById('img_capture').addEventListener('click', handleCaptureClick);
document.getElementById('img_history').addEventListener('click', handleHistoryClick);

ipcRenderer.on('readimgdir', function (event, arg) {
  //收到主进程发送的'readimgdir'ipc通信信息后对"arg"图片列表进行图片展示
  console.log(arg)
  let path = document.getElementById('sender').value
  let html = ''
  html += "<div class='row row-cols-2 row-cols-lg-5 g-2 g-lg-3'>"
  document.getElementById('imgModalLabel').innerHTML = `${current_locales_local.captureRecord} ( ${arg.length} ${current_locales_local.img_num} )`
  if (arg.length == 0) {
    //如果路径内没有图片，则加上没有的图片的
    let noFilesText = `<div>${current_locales_local.noFiles}</div>`;
    document.getElementById('imglist').innerHTML += noFilesText;
  }
  else {
    for (let f of arg) {
      //路径不为空，则逐一将拍摄的图片展示在拍摄记录窗口中
      html += '<div style="display: flex;flex-direction: column;align-items: center;"><img src="' + path + '/' + f + '" style="width:140px" class="rounded float-start" alt="' + f + '"><p>' + f + '</p></div>'
    }
    html += "</div>"
    document.getElementById('imglist').innerHTML = html
  }
});

//加载脚本时使用本地数据更新一次前端数据
ipcRenderer.send('config', '')
ipcRenderer.on('config', function (event, arg) {
  //更新目前页面的数据
  console.log(arg)
  document.getElementById('classname').value = arg['save_img_name']
  document.getElementById('sender').value = arg['save_img']
});

document.getElementById('classname').oninput = function () {
  //更新种类名称，用于命名拍摄的图像名字
  ipcRenderer.send('config_save_img_name', this.value)
}

// 选择器缓存
const $ = (sel) => document.querySelector(sel);

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// 根据窗口尺寸，计算各区域目标尺寸并应用
function applyResponsiveLayout({ width, height }) {
  // 1) 安全边距和工作区
  const paddingX = 24;   // 左右留白
  const paddingY = 16;   // 上下留白
  const workW = Math.max(320, width - paddingX * 2);
  const workH = Math.max(300, height - paddingY * 2);

  // 2) 顶部说明条
  const desc = $('#descript_data_collect');
  if (desc) {
    // 最大 90% 居中，最小 320px
    const maxDescW = Math.floor(workW * 0.9);
    const descW = clamp(maxDescW, 320, 1200);
    desc.style.width = `${descW}px`;
    desc.style.margin = '8px auto 0 auto';
    desc.style.fontSize = workW < 480 ? '12px' : workW < 768 ? '14px' : '16px';
    desc.style.lineHeight = '1.4';
    // 额外：在窄屏时稍微减小圆角与阴影
    desc.style.borderRadius = workW < 480 ? '6px' : '8px';
    desc.style.boxShadow = workW < 480 ? '0 2px 6px rgba(0,0,0,0.08)' : '0 4px 8px rgba(0,0,0,0.1)';
  }

  // 3) 表单输入行（两个输入框）
  // 该容器是 inline style 的外层 div（display:flex ...），这里通过计算调整外层块的最大宽度与方向
  const formRow = document.querySelector('.container')?.querySelector('div[style*="linear-gradient"]');
  if (formRow) {
    // 最大宽度限制，随窗口缩放
    const maxFormW = clamp(Math.floor(workW * 0.9), 360, 800);
    formRow.style.maxWidth = `${maxFormW}px`;
    // 适配窄屏：改为垂直布局
    const vertical = maxFormW < 640;
    formRow.style.flexDirection = vertical ? 'column' : 'row';
    formRow.style.gap = vertical ? '12px' : '20px';

    // 子项宽度
    const inputs = formRow.querySelectorAll('.form-floating');
    inputs.forEach((el) => {
      el.style.width = vertical ? '100%' : '300px';
    });
  }

  // 4) 视频与右侧控制区域
  const video = $('#video');
  const rightCol = $('#img_capture')?.parentElement; // 右侧列是 video 右边的包裹 div
  if (video && rightCol) {
    // 右侧列与 video 的父容器是 display:flex; 这里计算可用宽度，决定横向布局空间
    // 右侧列固定最小宽度估计：按钮列约 160-220px
    const rightColMinW = 220;
    const gap = 20; // video 和右侧列之间的间距（和 HTML 内联样式一致）
    const maxContentW = workW;

    // 视频保持 4:3，优先宽度受限布局
    // 目标：videoW + gap + rightColW <= maxContentW
    // 先试图给 rightColMinW，剩余给视频
    let videoMaxW = maxContentW - rightColMinW - gap;
    // 限制视频最大宽度
    videoMaxW = clamp(videoMaxW, 320, 1280);

    // 基于高度也限制，顶部说明和表单占用大致 160-240 高度，这里估算剩余高度
    const reservedTopH = 60 /*desc*/ + 110 /*form*/ + 40 /*间距*/;
    const availH = clamp(workH - reservedTopH, 220, workH);
    // 按 4:3 比例，视频的高度 = videoW * 3/4，受 availH 限制
    let videoW = Math.min(videoMaxW, Math.floor((availH) * 4 / 3));
    let videoH = Math.floor(videoW * 3 / 4);

    // 设定最终视频尺寸
    video.style.width = `${videoW}px`;
    video.style.height = `${videoH}px`;

    // 右侧列顶对齐居中
    rightCol.style.marginLeft = '20px';
    rightCol.style.alignItems = 'center';
    rightCol.style.gap = videoH < 360 ? '10px' : '15px';

    // 按钮尺寸随视频高度微调
    const captureBtn = $('#img_capture');
    if (captureBtn) {
      const btnSize = clamp(Math.floor(videoH * 0.22), 64, 120); // 拍摄按钮直径
      captureBtn.style.width = `${btnSize}px`;
      captureBtn.style.height = `${btnSize}px`;
      captureBtn.style.fontSize = `${clamp(Math.floor(btnSize * 0.18), 12, 18)}px`;
      captureBtn.style.borderRadius = '50%';
    }

    // 下方历史按钮宽度略随视频宽度变化
    const historyBtn = $('#img_history');
    if (historyBtn) {
      const histW = clamp(Math.floor(videoW * 0.28), 140, 220);
      historyBtn.style.width = `${histW}px`;
      historyBtn.style.fontSize = `${clamp(Math.floor(histW * 0.09), 12, 16)}px`;
    }

    // 5) canvas 与 video 同步尺寸，方便截图
    const canvas = $('#canvas');
    if (canvas) {
      canvas.width = videoW;
      canvas.height = videoH;
      canvas.style.width = `${videoW}px`;
      canvas.style.height = `${videoH}px`;
    }
  }

  // 6) 下拉菜单按钮（选择摄像头）宽度随布局微调
  const camBtn = $('#cbtn');
  if (camBtn) {
    const targetW = clamp(Math.floor(workW * 0.25), 160, 260);
    camBtn.style.minWidth = `${targetW}px`;
    camBtn.style.textAlign = 'center';
  }
}

// 简单节流：短时间内多次 resize 事件只处理最后一次
let resizeTimer = null;
function scheduleApplyLayout(size) {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    applyResponsiveLayout(size);
    resizeTimer = null;
  }, 50);
}

// 接收主进程广播的窗口尺寸
ipcRenderer.on('window-resize', (event, { width, height }) => {
  scheduleApplyLayout({ width, height });
});

// 初始加载时，根据当前可用窗口大小做一次自适应
window.addEventListener('DOMContentLoaded', () => {
  // 使用当前渲染窗口的可视区域作为初始值
  const initialW = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const initialH = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  scheduleApplyLayout({ width: initialW, height: initialH });
});

// 可选：当窗口内在变化（如字体加载、Bootstrap Modal）触发重算
window.addEventListener('resize', () => {
  const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const h = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  scheduleApplyLayout({ width: w, height: h });
});


