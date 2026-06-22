const { ipcRenderer } = require('electron');

let currentPreviewUrl = null;
let currentPreviewDataUrl = '';
let latestPreviewState = {
  connected: false,
  authenticated: false,
  previewActive: false,
  supportsImageSyncUpload: false,
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
const k210ImageSyncUpload = document.getElementById('k210_image_sync_upload');
const k210ImageSyncUploadStatus = document.getElementById('k210_image_sync_upload_status');
const k210ImageSyncResolution = document.getElementById('k210_image_sync_resolution');
const captureResolutionBadge = document.getElementById('capture_resolution_badge');
const customResolutionRow = document.getElementById('custom_resolution_row');
const customResolutionWidth = document.getElementById('custom_resolution_width');
const customResolutionHeight = document.getElementById('custom_resolution_height');
const customResolutionApply = document.getElementById('custom_resolution_apply');
const previewSourceBadge = document.getElementById('preview_source_badge');
const burstModeCheckbox = document.getElementById('burst_mode');
const burstCountInput = document.getElementById('burst_count');
const imglist = document.getElementById('imglist');
const captureContextMenu = document.getElementById('capture_context_menu');
const captureRenameOverlay = document.getElementById('capture_rename_overlay');
const captureRenameInput = document.getElementById('capture_rename_input');
const captureRenameTitle = document.getElementById('capture_rename_dialog_title');
const captureRenameCancel = document.getElementById('capture_rename_cancel');
const captureRenameConfirm = document.getElementById('capture_rename_confirm');
const captureSortMode = document.getElementById('capture_sort_mode');
const captureSortLabel = document.getElementById('capture_sort_label');
const BOARD_IMAGE_SYNC_RESOLUTIONS = ['320x240', '320x224', '224x224'];
const LOCAL_CAMERA_COMMON_RESOLUTIONS = [
  '224x224',
  '320x224',
  '320x240',
  '640x360',
  '640x400',
  '640x480',
  '800x450',
  '800x500',
  '800x600',
  '1024x576',
  '1024x640',
  '1280x720',
  '1280x800',
  '1920x1080',
  '1920x1200',
];

let burstCaptureState = null;
let imageSyncUploading = false;
let rawCaptureImageFiles = [];
let captureImageFiles = [];
let selectedCapturePaths = new Set();
let captureSelectionAnchorPath = '';
let captureUndoStack = [];
let captureRedoStack = [];
let captureSortValue = 'name-asc';
let localCameraState = {
  active: false,
  width: 0,
  height: 0,
};
let currentResolutionMode = '';
let updatingResolutionOptions = false;

function isUsingK210Preview() {
  return latestPreviewState.previewActive && !!currentPreviewDataUrl;
}

function parseResolution(value) {
  const match = String(value || '').match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function getResolutionKey(width, height) {
  const normalizedWidth = Number(width) || 0;
  const normalizedHeight = Number(height) || 0;
  return normalizedWidth && normalizedHeight ? `${normalizedWidth}x${normalizedHeight}` : '';
}

function getResolutionMode() {
  if (localCameraState.active && !isUsingK210Preview()) {
    return 'local';
  }
  return latestPreviewState.connected ? 'k210' : 'local';
}

function getCurrentOutputResolution() {
  if (getResolutionMode() === 'local') {
    const videoResolution = getResolutionKey(video.videoWidth, video.videoHeight);
    return videoResolution || getResolutionKey(localCameraState.width, localCameraState.height);
  }
  if (latestPreviewState.connected || latestPreviewState.previewActive) {
    return getResolutionKey(latestPreviewState.width, latestPreviewState.height);
  }
  return '';
}

function updateCaptureResolutionBadge() {
  if (!captureResolutionBadge) return;
  const label = current_locales_local?.capture_output_resolution || 'Output';
  const resolution = getCurrentOutputResolution() || '--';
  captureResolutionBadge.textContent = `${label}: ${resolution}`;
}

function buildLocalResolutionOptions() {
  const options = new Set(LOCAL_CAMERA_COMMON_RESOLUTIONS);
  const actualResolution = getCurrentOutputResolution();
  if (actualResolution) {
    options.add(actualResolution);
  }
  return Array.from(options);
}

function refreshResolutionOptions(force = false) {
  if (!k210ImageSyncResolution) return;
  const mode = getResolutionMode();
  const options = mode === 'k210' ? BOARD_IMAGE_SYNC_RESOLUTIONS : buildLocalResolutionOptions();
  const currentValue = k210ImageSyncResolution.value;
  const preferred = mode === 'k210'
    ? (BOARD_IMAGE_SYNC_RESOLUTIONS.includes(getCurrentOutputResolution())
      ? getCurrentOutputResolution()
      : (BOARD_IMAGE_SYNC_RESOLUTIONS.includes(currentValue) ? currentValue : '320x240'))
    : (options.includes(getCurrentOutputResolution()) ? getCurrentOutputResolution() : currentValue);

  if (!force && currentResolutionMode === mode && options.includes(currentValue)) {
    return;
  }

  updatingResolutionOptions = true;
  k210ImageSyncResolution.innerHTML = options
    .map((item) => `<option value="${item}">${item}</option>`)
    .join('');
  if (options.includes(preferred)) {
    k210ImageSyncResolution.value = preferred;
  }
  currentResolutionMode = mode;
  updatingResolutionOptions = false;
  if (customResolutionRow) {
    customResolutionRow.style.display = mode === 'local' ? 'grid' : 'none';
  }
  if (customResolutionWidth && customResolutionHeight) {
    const current = parseResolution(getCurrentOutputResolution());
    if (current) {
      customResolutionWidth.value = current.width;
      customResolutionHeight.value = current.height;
    }
  }
}

function refreshPreviewSurface() {
  const localCameraActive = typeof zt !== 'undefined' && zt;
  const usingK210 = isUsingK210Preview();
  const previewSurface = document.querySelector('.preview-surface');

  k210PreviewImage.style.display = usingK210 ? 'block' : 'none';
  video.style.display = usingK210 ? 'none' : 'block';

  if (usingK210) {
    if (previewSurface && latestPreviewState.width && latestPreviewState.height) {
      previewSurface.style.aspectRatio = `${latestPreviewState.width} / ${latestPreviewState.height}`;
    }
    k210PreviewPlaceholder.style.display = 'none';
    previewSourceBadge.textContent = current_locales_local ? current_locales_local.k210_preview_title : 'K210';
    return;
  }

  if (previewSurface) {
    previewSurface.style.aspectRatio = '4 / 3';
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

function joinCaptureImagePath(basePath, fileName) {
  const normalizedBase = String(basePath || '').replace(/[\\/]+$/, '');
  return `${normalizedBase}/${fileName}`;
}

const captureNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function splitCaptureFileName(fileName) {
  const normalized = String(fileName || '');
  const dotIndex = normalized.lastIndexOf('.');
  if (dotIndex <= 0) {
    return { baseName: normalized, ext: '' };
  }
  return {
    baseName: normalized.slice(0, dotIndex),
    ext: normalized.slice(dotIndex),
  };
}

function normalizeCaptureFileEntry(entry) {
  const basePath = document.getElementById('sender').value;
  const name = typeof entry === 'string' ? entry : entry?.filename;
  const safeName = String(name || '');
  const ext = typeof entry === 'string'
    ? splitCaptureFileName(safeName).ext.toLowerCase()
    : (entry?.ext || splitCaptureFileName(safeName).ext).toLowerCase();
  return {
    name: safeName,
    path: joinCaptureImagePath(basePath, safeName),
    size: Number(entry?.size || 0),
    mtimeMs: Number(entry?.mtimeMs || 0),
    ext,
  };
}

function getCaptureSortOptions() {
  return [
    ['name-asc', getCaptureMenuText('capture_sort_name_asc', 'Name ascending')],
    ['name-desc', getCaptureMenuText('capture_sort_name_desc', 'Name descending')],
    ['time-desc', getCaptureMenuText('capture_sort_time_desc', 'Newest first')],
    ['time-asc', getCaptureMenuText('capture_sort_time_asc', 'Oldest first')],
    ['type-asc', getCaptureMenuText('capture_sort_type_asc', 'Type')],
    ['size-desc', getCaptureMenuText('capture_sort_size_desc', 'Largest first')],
    ['size-asc', getCaptureMenuText('capture_sort_size_asc', 'Smallest first')],
  ];
}

function refreshCaptureSortOptions() {
  if (captureSortLabel) {
    captureSortLabel.textContent = getCaptureMenuText('capture_sort_label', 'Sort');
  }
  if (!captureSortMode) return;
  const currentValue = captureSortMode.value || captureSortValue;
  captureSortMode.innerHTML = getCaptureSortOptions()
    .map(([value, label]) => `<option value="${escapeHtmlAttr(value)}">${escapeHtmlAttr(label)}</option>`)
    .join('');
  captureSortMode.value = getCaptureSortOptions().some(([value]) => value === currentValue)
    ? currentValue
    : captureSortValue;
}

function sortCaptureFiles(files) {
  const sorted = files.slice();
  const compareName = (a, b) => captureNameCollator.compare(a.name, b.name);
  sorted.sort((a, b) => {
    if (captureSortValue === 'name-desc') return compareName(b, a);
    if (captureSortValue === 'time-desc') return (b.mtimeMs - a.mtimeMs) || compareName(a, b);
    if (captureSortValue === 'time-asc') return (a.mtimeMs - b.mtimeMs) || compareName(a, b);
    if (captureSortValue === 'type-asc') {
      return captureNameCollator.compare(a.ext, b.ext) || compareName(a, b);
    }
    if (captureSortValue === 'size-desc') return (b.size - a.size) || compareName(a, b);
    if (captureSortValue === 'size-asc') return (a.size - b.size) || compareName(a, b);
    return compareName(a, b);
  });
  return sorted;
}

function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function hideCaptureContextMenu() {
  if (captureContextMenu) {
    captureContextMenu.style.display = 'none';
  }
}

function getSelectedCapturePaths() {
  return Array.from(selectedCapturePaths);
}

function updateCaptureSelectionUI() {
  document.querySelectorAll('#imglist .capture-item').forEach((item) => {
    item.classList.toggle('selected', selectedCapturePaths.has(item.dataset.path));
  });
}

function selectAllCaptureImages() {
  selectedCapturePaths = new Set(captureImageFiles.map((item) => item.path));
  captureSelectionAnchorPath = captureImageFiles[0]?.path || '';
  updateCaptureSelectionUI();
}

function selectCaptureRange(targetPath) {
  const paths = captureImageFiles.map((item) => item.path);
  const anchorPath = captureSelectionAnchorPath || targetPath;
  const anchorIndex = paths.indexOf(anchorPath);
  const targetIndex = paths.indexOf(targetPath);
  if (anchorIndex === -1 || targetIndex === -1) {
    selectedCapturePaths = new Set([targetPath]);
    captureSelectionAnchorPath = targetPath;
    updateCaptureSelectionUI();
    return;
  }
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  selectedCapturePaths = new Set(paths.slice(start, end + 1));
  updateCaptureSelectionUI();
}

function refreshCaptureHistory() {
  handleHistoryClick();
}

function getCaptureMenuText(key, fallback) {
  return current_locales_local?.[key] || fallback;
}

function askCaptureRenameName(currentName) {
  return new Promise((resolve) => {
    if (!captureRenameOverlay || !captureRenameInput || !captureRenameCancel || !captureRenameConfirm) {
      resolve('');
      return;
    }

    const cleanup = (value) => {
      captureRenameOverlay.style.display = 'none';
      captureRenameConfirm.removeEventListener('click', onConfirm);
      captureRenameCancel.removeEventListener('click', onCancel);
      captureRenameInput.removeEventListener('keydown', onKeydown);
      resolve(value);
    };
    const onConfirm = () => cleanup(captureRenameInput.value.trim());
    const onCancel = () => cleanup('');
    const onKeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onConfirm();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    if (captureRenameTitle) {
      captureRenameTitle.textContent = getCaptureMenuText('capture_rename_prompt', 'Enter a new image name');
    }
    captureRenameCancel.textContent = getCaptureMenuText('capture_rename_cancel', 'Cancel');
    captureRenameConfirm.textContent = getCaptureMenuText('capture_rename_confirm', 'Rename');
    captureRenameInput.value = currentName;
    captureRenameInput.disabled = false;
    captureRenameInput.readOnly = false;
    captureRenameOverlay.style.display = 'flex';
    captureRenameOverlay.onmousedown = (event) => {
      event.stopPropagation();
    };
    const dialog = captureRenameOverlay.querySelector('.capture-rename-dialog');
    if (dialog) {
      dialog.onmousedown = (event) => {
        event.stopPropagation();
      };
      dialog.onclick = (event) => {
        event.stopPropagation();
      };
    }
    captureRenameConfirm.addEventListener('click', onConfirm);
    captureRenameCancel.addEventListener('click', onCancel);
    captureRenameInput.addEventListener('keydown', onKeydown);
    setTimeout(() => {
      captureRenameInput.focus({ preventScroll: true });
      captureRenameInput.setSelectionRange(0, captureRenameInput.value.length);
    }, 50);
  });
}

async function deleteSelectedCaptureImages() {
  const paths = getSelectedCapturePaths();
  if (!paths.length) return;
  const message = `${getCaptureMenuText('capture_delete_confirm', 'Delete selected images?')} (${paths.length})`;
  const ok = window.confirm(message);
  if (!ok) return;

  try {
    const result = await ipcRenderer.invoke('capture-images-delete', { paths });
    selectedCapturePaths.clear();
    captureSelectionAnchorPath = '';
    if (result.operation && result.deleted) {
      captureUndoStack.push(result.operation);
      captureRedoStack = [];
    }
    refreshCaptureHistory();
    Notiflix.Notify.success(`${getCaptureMenuText('capture_delete_success', 'Deleted')} (${result.deleted || 0})`);
  } catch (error) {
    Notiflix.Notify.failure(error.message);
  }
}

async function renameSelectedCaptureImage() {
  const paths = getSelectedCapturePaths();
  if (!paths.length) return;
  const currentName = paths[0].split(/[\\/]/).pop();
  const currentParts = splitCaptureFileName(currentName);
  const nextName = await askCaptureRenameName(paths.length === 1 ? currentParts.baseName : currentParts.baseName);
  if (!nextName || (paths.length === 1 && (nextName === currentParts.baseName || nextName === currentName))) return;

  try {
    const result = paths.length === 1
      ? await ipcRenderer.invoke('capture-image-rename', {
        path: paths[0],
        newName: nextName,
      })
      : await ipcRenderer.invoke('capture-images-rename', {
        paths,
        baseName: nextName,
      });
    selectedCapturePaths.clear();
    captureSelectionAnchorPath = '';
    if (result.operation) {
      captureUndoStack.push(result.operation);
      captureRedoStack = [];
    }
    refreshCaptureHistory();
    Notiflix.Notify.success(getCaptureMenuText('capture_rename_success', 'Renamed'));
  } catch (error) {
    Notiflix.Notify.failure(error.message);
  }
}

async function undoCaptureOperation() {
  const operation = captureUndoStack.pop();
  if (!operation) return;
  try {
    await ipcRenderer.invoke('capture-images-undo', operation);
    captureRedoStack.push(operation);
    selectedCapturePaths.clear();
    captureSelectionAnchorPath = '';
    refreshCaptureHistory();
  } catch (error) {
    captureUndoStack.push(operation);
    Notiflix.Notify.failure(error.message);
  }
}

async function redoCaptureOperation() {
  const operation = captureRedoStack.pop();
  if (!operation) return;
  try {
    await ipcRenderer.invoke('capture-images-redo', operation);
    captureUndoStack.push(operation);
    selectedCapturePaths.clear();
    captureSelectionAnchorPath = '';
    refreshCaptureHistory();
  } catch (error) {
    captureRedoStack.push(operation);
    Notiflix.Notify.failure(error.message);
  }
}

function showCaptureContextMenu(x, y) {
  if (!captureContextMenu) return;
  const selectedCount = selectedCapturePaths.size;
  const selected = getSelectedCapturePaths();
  captureContextMenu.innerHTML = `
    <button type="button" data-action="open" ${selectedCount !== 1 ? 'disabled' : ''}>${escapeHtmlAttr(getCaptureMenuText('capture_menu_open', 'Open'))}</button>
    <button type="button" data-action="show-folder" ${selectedCount !== 1 ? 'disabled' : ''}>${escapeHtmlAttr(getCaptureMenuText('capture_menu_show_folder', 'Show in folder'))}</button>
    <button type="button" data-action="rename" ${selectedCount < 1 ? 'disabled' : ''}>${escapeHtmlAttr(getCaptureMenuText('capture_menu_rename', 'Rename'))}</button>
    <button type="button" data-action="delete" ${selectedCount < 1 ? 'disabled' : ''}>${escapeHtmlAttr(getCaptureMenuText('capture_menu_delete', 'Delete'))}</button>
    <button type="button" data-action="select-all" ${captureImageFiles.length < 1 ? 'disabled' : ''}>${escapeHtmlAttr(getCaptureMenuText('capture_menu_select_all', 'Select all'))}</button>
  `;
  captureContextMenu.style.display = 'block';
  const menuRect = captureContextMenu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - menuRect.width - 8);
  const top = Math.min(y, window.innerHeight - menuRect.height - 8);
  captureContextMenu.style.left = `${Math.max(8, left)}px`;
  captureContextMenu.style.top = `${Math.max(8, top)}px`;
  captureContextMenu.dataset.singlePath = selected[0] || '';
}

function renderCaptureImages(files) {
  if (Array.isArray(files)) {
    rawCaptureImageFiles = files;
  }
  refreshCaptureSortOptions();
  captureImageFiles = sortCaptureFiles(rawCaptureImageFiles.map(normalizeCaptureFileEntry));
  selectedCapturePaths = new Set(
    Array.from(selectedCapturePaths).filter((item) => captureImageFiles.some((file) => file.path === item))
  );
  if (captureSelectionAnchorPath && !captureImageFiles.some((file) => file.path === captureSelectionAnchorPath)) {
    captureSelectionAnchorPath = '';
  }

  document.getElementById('imgModalLabel').innerHTML = `${current_locales_local.captureRecord} ( ${captureImageFiles.length} ${current_locales_local.img_num} )`;
  if (captureImageFiles.length === 0) {
    imglist.innerHTML = `<div>${current_locales_local.noFiles}</div>`;
    return;
  }

  let html = "<div class='capture-grid'>";
  for (const item of captureImageFiles) {
    const imagePathAttr = escapeHtmlAttr(item.path);
    const fileNameAttr = escapeHtmlAttr(item.name);
    html += `<div class="capture-item" data-path="${imagePathAttr}">
              <img src="${imagePathAttr}" class="rounded capture-open-image" alt="${fileNameAttr}" data-path="${imagePathAttr}" tabindex="0" title="${fileNameAttr}">
              <p>${fileNameAttr}</p></div>`;
  }
  html += '</div>';
  imglist.innerHTML = html;
  updateCaptureSelectionUI();
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
  renderCaptureImages(arg || []);
});

if (captureSortMode) {
  captureSortMode.addEventListener('change', function () {
    captureSortValue = this.value || 'name-asc';
    renderCaptureImages();
  });
}

imglist.addEventListener('click', (event) => {
  const item = event.target.closest('.capture-item');
  if (!item) {
    selectedCapturePaths.clear();
    updateCaptureSelectionUI();
    return;
  }
  const targetPath = item.dataset.path;
  if (event.shiftKey) {
    selectCaptureRange(targetPath);
    return;
  }
  if (event.ctrlKey || event.metaKey) {
    if (selectedCapturePaths.has(targetPath)) {
      selectedCapturePaths.delete(targetPath);
    } else {
      selectedCapturePaths.add(targetPath);
    }
    captureSelectionAnchorPath = targetPath;
    updateCaptureSelectionUI();
    return;
  }
  selectedCapturePaths = new Set([targetPath]);
  captureSelectionAnchorPath = targetPath;
  updateCaptureSelectionUI();
});

imglist.addEventListener('dblclick', (event) => {
  const item = event.target.closest('.capture-item');
  if (!item) return;
  ipcRenderer.send('open-path', item.dataset.path);
});

imglist.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const item = event.target.closest('.capture-item');
  if (!item) return;
  event.preventDefault();
  if (event.key === 'Enter') {
    ipcRenderer.send('open-path', item.dataset.path);
    return;
  }
  const targetPath = item.dataset.path;
  if (selectedCapturePaths.has(targetPath)) {
    selectedCapturePaths.delete(targetPath);
  } else {
    selectedCapturePaths.add(targetPath);
  }
  captureSelectionAnchorPath = targetPath;
  updateCaptureSelectionUI();
});

imglist.addEventListener('contextmenu', (event) => {
  const item = event.target.closest('.capture-item');
  event.preventDefault();
  if (!item) {
    selectedCapturePaths.clear();
    updateCaptureSelectionUI();
    hideCaptureContextMenu();
    return;
  }
  const targetPath = item.dataset.path;
  if (!selectedCapturePaths.has(targetPath)) {
    selectedCapturePaths = new Set([targetPath]);
    captureSelectionAnchorPath = targetPath;
    updateCaptureSelectionUI();
  }
  showCaptureContextMenu(event.clientX, event.clientY);
});

if (captureContextMenu) {
  captureContextMenu.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    const selected = getSelectedCapturePaths();
    hideCaptureContextMenu();
    if (action === 'open' && selected.length === 1) {
      ipcRenderer.send('open-path', selected[0]);
    } else if (action === 'show-folder' && selected.length === 1) {
      await ipcRenderer.invoke('capture-image-show-in-folder', selected[0]).catch((error) => {
        Notiflix.Notify.failure(error.message);
      });
    } else if (action === 'rename') {
      await renameSelectedCaptureImage();
    } else if (action === 'delete') {
      await deleteSelectedCaptureImages();
    } else if (action === 'select-all') {
      selectAllCaptureImages();
    }
  });
}

document.addEventListener('click', (event) => {
  if (captureContextMenu && !captureContextMenu.contains(event.target)) {
    hideCaptureContextMenu();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideCaptureContextMenu();
    return;
  }
  const modal = document.getElementById('ImgModal');
  const modalVisible = modal && modal.classList.contains('show');
  if (!modalVisible) return;
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedCapturePaths.size > 0) {
    event.preventDefault();
    deleteSelectedCaptureImages();
    return;
  }
  if (event.ctrlKey && String(event.key).toLowerCase() === 'z') {
    event.preventDefault();
    undoCaptureOperation();
    return;
  }
  if (event.ctrlKey && String(event.key).toLowerCase() === 'y') {
    event.preventDefault();
    redoCaptureOperation();
    return;
  }
  if (modalVisible && event.ctrlKey && String(event.key).toLowerCase() === 'a') {
    event.preventDefault();
    selectAllCaptureImages();
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
  k210PreviewStart.disabled = imageSyncUploading || !state.authenticated || state.previewActive;
  k210PreviewStop.disabled = imageSyncUploading || !state.previewActive;
  if (k210ImageSyncUpload) {
    const unsupportedConnectedPort = state.connected && !state.supportsImageSyncUpload;
    k210ImageSyncUpload.disabled = imageSyncUploading || !state.connected || unsupportedConnectedPort;
    k210ImageSyncUpload.classList.toggle('btn-warning', !unsupportedConnectedPort);
    k210ImageSyncUpload.classList.toggle('btn-secondary', unsupportedConnectedPort);
    k210ImageSyncUpload.textContent = unsupportedConnectedPort
      ? (current_locales_local?.k210_image_sync_upload_vesibit_only || 'Upload Image Sync Program (Only VESIBIT is supported)')
      : (current_locales_local?.k210_image_sync_upload || 'Upload Image Sync Program');
    k210ImageSyncUpload.title = unsupportedConnectedPort
      ? (current_locales_local?.k210_image_sync_ch340_required || 'Image sync upload requires a CH340 K210 controller port.')
      : '';
  }
  if (k210ImageSyncResolution) {
    k210ImageSyncResolution.disabled = imageSyncUploading;
  }
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
  refreshResolutionOptions();
  updateCaptureResolutionBadge();
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

function getImageSyncUploadText(payload = {}) {
  const locales = current_locales_local || {};
  const key = `k210_image_sync_upload_${payload.status}`;
  const baseText = locales[key] || payload.message || payload.status || '';
  const fileText = payload.file ? ` ${payload.file}` : '';
  const percentText = Number.isFinite(payload.percent) ? ` ${payload.percent}%` : '';
  return `${baseText}${fileText}${percentText}`.trim();
}

function setImageSyncUploadStatus(payload = {}) {
  if (!k210ImageSyncUploadStatus) return;
  const status = payload.status || '';
  const isVisible = !!status && status !== 'idle';
  k210ImageSyncUploadStatus.style.display = isVisible ? 'block' : 'none';
  k210ImageSyncUploadStatus.textContent = getImageSyncUploadText(payload);

  if (status === 'failed') {
    k210ImageSyncUploadStatus.style.background = '#fee2e2';
    k210ImageSyncUploadStatus.style.color = '#991b1b';
  } else if (status === 'done') {
    k210ImageSyncUploadStatus.style.background = '#dcfce7';
    k210ImageSyncUploadStatus.style.color = '#166534';
  } else {
    k210ImageSyncUploadStatus.style.background = '#eef2ff';
    k210ImageSyncUploadStatus.style.color = '#3730a3';
  }
}

async function startImageSyncUpload() {
  if (imageSyncUploading) return;
  if (!latestPreviewState.supportsImageSyncUpload) {
    Notiflix.Notify.warning(current_locales_local?.k210_image_sync_ch340_required || 'Image sync upload requires a CH340 K210 controller port.');
    return;
  }
  imageSyncUploading = true;
  updatePreviewButtons(latestPreviewState);
  setImageSyncUploadStatus({
    status: 'preparing',
    percent: 0,
  });

  try {
    const resolution = BOARD_IMAGE_SYNC_RESOLUTIONS.includes(k210ImageSyncResolution?.value)
      ? k210ImageSyncResolution.value
      : '320x240';
    const result = await ipcRenderer.invoke('upload-k210-image-sync-program', { resolution });
    if (result && result.state) {
      updatePreviewState(result.state);
    }
    setImageSyncUploadStatus({
      status: 'done',
      percent: 100,
    });
    Notiflix.Notify.success(current_locales_local.k210_image_sync_upload_done || 'Image sync program uploaded.');
  } catch (error) {
    setImageSyncUploadStatus({
      status: 'failed',
      message: error.message,
    });
    Notiflix.Notify.failure(error.message);
  } finally {
    imageSyncUploading = false;
    updatePreviewButtons(latestPreviewState);
  }
}

function confirmImageSyncUpload() {
  const title = current_locales_local.k210_image_sync_upload_confirm_title || 'Upload image sync program?';
  const message = current_locales_local.k210_image_sync_upload_confirm_message
    || 'This will back up and replace the controller main.py, then restart and reconnect preview.';
  const uploadButton = current_locales_local.k210_image_sync_upload_confirm_button || 'Upload';
  const cancelButton = current_locales_local.k210_image_sync_upload_cancel_button
    || current_locales_local.update_cancel_button
    || 'Cancel';

  if (typeof Notiflix !== 'undefined' && Notiflix.Report && typeof Notiflix.Report.warning === 'function') {
    Notiflix.Report.warning(title, message, uploadButton, startImageSyncUpload);
    setTimeout(() => {
      const wrap = document.getElementById('NotiflixReportWrap');
      const primary = document.getElementById('NXReportButton');
      const content = wrap ? wrap.querySelector('.notiflix-report-content') : null;
      if (!wrap || !primary || !content || document.getElementById('NXReportCancelButton')) return;
      const cancel = primary.cloneNode(false);
      cancel.id = 'NXReportCancelButton';
      cancel.textContent = cancelButton;
      cancel.style.background = '#6b7280';
      cancel.style.marginRight = '10px';
      cancel.addEventListener('click', () => {
        wrap.classList.add('nx-remove');
        setTimeout(() => {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        }, 360);
      });
      content.appendChild(cancel);
    }, 0);
    return;
  }

  if (window.confirm(`${title}\n\n${message}`)) {
    startImageSyncUpload();
  }
}

if (k210ImageSyncUpload) {
  k210ImageSyncUpload.addEventListener('click', confirmImageSyncUpload);
}

if (k210ImageSyncResolution) {
  k210ImageSyncResolution.addEventListener('change', async () => {
    if (imageSyncUploading || updatingResolutionOptions) return;
    const mode = getResolutionMode();

    if (mode !== 'k210') {
      const resolution = parseResolution(k210ImageSyncResolution.value);
      if (!resolution || !localCameraState.active || typeof window.applyLocalCameraResolution !== 'function') {
        updateCaptureResolutionBadge();
        return;
      }

      try {
        const state = await window.applyLocalCameraResolution(resolution.width, resolution.height);
        localCameraState = {
          ...localCameraState,
          ...(state || {}),
          active: true,
        };
        refreshResolutionOptions(true);
        updateCaptureResolutionBadge();
        const message = current_locales_local?.capture_resolution_changed || 'Resolution changed';
        Notiflix.Notify.success(`${message}: ${getCurrentOutputResolution() || k210ImageSyncResolution.value}`);
      } catch (error) {
        Notiflix.Notify.failure(error.message);
      }
      return;
    }

    const resolution = BOARD_IMAGE_SYNC_RESOLUTIONS.includes(k210ImageSyncResolution.value)
      ? k210ImageSyncResolution.value
      : '320x240';

    try {
      const state = await ipcRenderer.invoke('set-k210-image-sync-params', { resolution });
      updatePreviewState(state || {});
      const message = current_locales_local?.capture_resolution_changed || 'Resolution changed';
      Notiflix.Notify.success(`${message}: ${resolution}`);
    } catch (error) {
      updatePreviewState({ error: error.message });
      Notiflix.Notify.failure(error.message);
    }
  });
}

if (customResolutionApply) {
  customResolutionApply.addEventListener('click', async () => {
    const width = Math.max(1, parseInt(customResolutionWidth?.value, 10) || 0);
    const height = Math.max(1, parseInt(customResolutionHeight?.value, 10) || 0);

    if (!width || !height) {
      Notiflix.Notify.warning(current_locales_local?.capture_resolution_invalid || 'Please enter a valid resolution.');
      return;
    }
    if (!localCameraState.active || typeof window.applyLocalCameraResolution !== 'function') {
      Notiflix.Notify.warning(current_locales_local?.openCamera || 'Please turn on the camera first.');
      return;
    }

    try {
      const state = await window.applyLocalCameraResolution(width, height);
      localCameraState = {
        ...localCameraState,
        ...(state || {}),
        active: true,
      };
      refreshResolutionOptions(true);
      updateCaptureResolutionBadge();
      const resolution = getCurrentOutputResolution() || getResolutionKey(width, height);
      const message = current_locales_local?.capture_resolution_changed || 'Resolution changed';
      Notiflix.Notify.success(`${message}: ${resolution}`);
    } catch (error) {
      const unsupported = current_locales_local?.capture_resolution_apply_failed || 'The camera did not accept this resolution.';
      Notiflix.Notify.failure(`${unsupported} ${error.message || ''}`.trim());
    }
  });
}

ipcRenderer.on('k210-image-sync-upload-progress', (_event, payload = {}) => {
  if (payload.status && payload.status !== 'done' && payload.status !== 'failed') {
    imageSyncUploading = true;
    updatePreviewButtons(latestPreviewState);
  }
  setImageSyncUploadStatus(payload);
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

window.addEventListener('visionwiz-local-camera-opened', (event) => {
  localCameraState = {
    ...localCameraState,
    ...(event.detail || {}),
    active: true,
  };
  refreshResolutionOptions(true);
  updateCaptureResolutionBadge();
  refreshPreviewSurface();
});

window.addEventListener('visionwiz-local-camera-closed', () => {
  localCameraState = {
    active: false,
    width: 0,
    height: 0,
  };
  refreshResolutionOptions(true);
  updateCaptureResolutionBadge();
  refreshPreviewSurface();
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
  setTimeout(() => {
    updatePreviewState({});
    refreshCaptureSortOptions();
  }, 120);
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

  ['#img_history', '#k210_preview_start', '#k210_preview_stop', '#k210_image_sync_upload', '#k210_image_sync_resolution', '#cbtn'].forEach((selector) => {
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
  refreshResolutionOptions(true);
  updateCaptureResolutionBadge();
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
