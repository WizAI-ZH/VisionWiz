﻿const { ipcRenderer } = require('electron');
const { FitAddon } = require('xterm-addon-fit');
const { WebLinksAddon } = require('xterm-addon-web-links');
const echarts = require('echarts');
const { setupXtermCopyBehavior } = require('./xterm-copy-helper');
const { setupHistoryLogSearch } = require('./history-log-search-helper');
let pathModule;
try {
    pathModule = require('path');
} catch (error) {
    console.warn('Error loading path module:', error);
}
let current_locales;
const YOLO_INPUT_SIZES = ['224x224', '240x240', '320x224'];
let modelGraphChart = null;
let pendingTrainGraphData = null;
const historyLogSearch = setupHistoryLogSearch(
    ['train_log', 'train_log_err'],
    () => current_locales
);

function normalizeInputSize(value) {
    return YOLO_INPUT_SIZES.includes(value) ? value : '224x224';
}

function formatInputSize(data) {
    if (data && data.input_width && data.input_height) {
        return `${data.input_width}x${data.input_height}`;
    }
    if (data && Array.isArray(data.input_shape) && data.input_shape.length >= 2) {
        return `${data.input_shape[1]}x${data.input_shape[0]}`;
    }
    return '224x224';
}

function formatDataAugMode(data) {
    const mode = String(data?.data_aug || 'auto').toLowerCase();
    const labels = {
        auto: current_locales?.open || 'Auto',
        open: current_locales?.open || 'Auto',
        off: current_locales?.close || 'Off',
        close: current_locales?.close || 'Off',
        geometry: current_locales?.data_aug_geometry || 'Geometry',
        color: current_locales?.data_aug_color || 'Color / Brightness',
        blur_noise: current_locales?.data_aug_blur_noise || 'Blur / Noise',
    };
    return labels[mode] || mode;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildErrorSummaryHtml(payload) {
    if (!payload) {
        return '';
    }
    const lines = [];
    if (payload.title) {
        lines.push(`<strong>${escapeHtml(payload.title)}</strong>`);
    }
    if (payload.summary) {
        lines.push(escapeHtml(payload.summary));
    }
    if (Array.isArray(payload.suggestions) && payload.suggestions.length > 0) {
        lines.push('');
        lines.push(escapeHtml(current_locales?.train_error_suggestions || 'Suggestions'));
        payload.suggestions.forEach((item, index) => {
            lines.push(`${index + 1}. ${escapeHtml(item)}`);
        });
    }
    return lines.join('<br/>');
}

function renderErrorSummary(containerId, payload) {
    const el = document.getElementById(containerId);
    if (!el) {
        return;
    }
    const html = buildErrorSummaryHtml(payload);
    el.innerHTML = html;
    el.style.display = html ? 'block' : 'none';
}

function buildFailureDialogMessage(payload) {
    if (!payload) {
        return current_locales.train_failed_check_terminal;
    }
    const lines = [];
    if (payload.summary) {
        lines.push(payload.summary);
    }
    if (Array.isArray(payload.suggestions) && payload.suggestions.length > 0) {
        lines.push('');
        lines.push((current_locales?.train_error_suggestions || 'Suggestions') + ':');
        payload.suggestions.forEach((item, index) => {
            lines.push(`${index + 1}. ${item}`);
        });
    }
    return lines.join('\n');
}

function ensureModelGraphChart() {
    const chartElement = document.getElementById('echarts');
    if (!chartElement) {
        return null;
    }
    modelGraphChart = echarts.getInstanceByDom(chartElement) || modelGraphChart;
    if (!modelGraphChart) {
        modelGraphChart = echarts.init(chartElement);
    }
    return modelGraphChart;
}

function renderModelTrainGraph() {
    if (!pendingTrainGraphData) {
        return;
    }
    const chartElement = document.getElementById('echarts');
    const graphPane = document.getElementById('model_graph_pane');
    if (!chartElement || !graphPane) {
        return;
    }
    if (chartElement.clientWidth === 0 || (!graphPane.classList.contains('show') && !graphPane.classList.contains('active'))) {
        return;
    }
    const chart = ensureModelGraphChart();
    if (!chart) {
        return;
    }
    chart.resize();
    chart.setOption({
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' }
        },
        toolbox: {
            show: true,
            feature: {
                dataZoom: {
                    yAxisIndex: 'none'
                },
                dataView: { readOnly: false },
                restore: {},
                saveAsImage: {}
            }
        },
        legend: {},
        xAxis: {
            data: Array.from({ length: pendingTrainGraphData.loss.length }, (v, i) => i)
        },
        yAxis: {
            show: true,
            axisLine: { show: true },
            axisTick: { show: true },
            splitLine: { show: true },
        },
        series: [
            {
                data: pendingTrainGraphData.loss,
                name: current_locales.test_loss,
                type: 'line',
                smooth: true
            },
            {
                data: pendingTrainGraphData.val_loss,
                name: current_locales.val_loss,
                type: 'line',
                smooth: true
            }
        ]
    }, true);
}

async function init_current_locales() {
  try {
    current_locales = await ipcRenderer.invoke('get-current-locales');
    console.log('locales:', current_locales);
  } catch (e) {
    console.error('Failed to load locale data:', e);
  }
}

init_current_locales();

ipcRenderer.on('change-language', async (event, language) => {
    console.log('[RENDERER] language changed, reload locales:', language);
    current_locales = await ipcRenderer.invoke('get-current-locales');
})


let train_situation_yolo = false
let current_tab_dir

// 定义 python 路径和运行脚本变量
let pythonExec
let trainScript
let testScript

// 发送获取应用根目录指令
ipcRenderer.send('get_app_path', 'objectDetection');

ipcRenderer.on('get_app_path_reply', (event, appPath) => {
    // 鑾峰彇 python.exe 鍜?train.py 鐨勮矾寰? 
    pythonExec = pathModule.join(appPath, 'py39', 'python.exe');
    trainScript = pathModule.join(appPath, 'maix_train', 'train.py');
    testScript = pathModule.join(appPath, 'maix_train', 'train', 'detector', 'predict_test.py');
});

document.getElementById("dataset_dir_yolo").onclick = function () {
    // 向主进程 main.js 发送消息，打开目标检测训练集存放目录
    ipcRenderer.send('open_dataset_dir_yolo', '');
}

document.getElementById("train_xml_dir_yolo").onclick = function () {
    // 向主进程 main.js 发送消息，打开目标检测标签存放目录
    ipcRenderer.send('open_train_xml_dir_yolo', '');
}

document.getElementById('test_img_dir_yolo').onclick = function () {
    // 向主进程 main.js 发送消息，打开目标检测测试图片所在目录
    ipcRenderer.send('open_test_img_dir_yolo', '');
}

ipcRenderer.on('update_dataset_dir_yolo', function (event, arg) {
    // 监听主进程返回消息，更新目标检测图片目录到前后端
    console.log("arg:", arg);
    document.getElementById('dataset_dir_yolo').value = arg
    ipcRenderer.send('config_yolo_img', arg)
});

ipcRenderer.on('update_xml_dir_yolo', function (event, arg) {
    // 监听主进程返回消息，更新目标检测标签目录到前后端
    console.log("arg:", arg);
    document.getElementById('train_xml_dir_yolo').value = arg
    ipcRenderer.send('config_yolo_xml', arg)
});

ipcRenderer.on('update_test_img_dir_yolo', function (event, arg) {
    // 监听主进程返回消息，更新目标检测测试集目录到前后端
    console.log("arg:", arg);
    document.getElementById('test_img_dir_yolo').value = arg
    ipcRenderer.send('config_test_img_dir_yolo', arg)
});


var Terminal = require('xterm').Terminal;

// 初始化 xterm 并插入到页面中
const fitAddon_yolo = new FitAddon()

// 实例化目标检测终端窗口
const xterm_yolo = new Terminal(
    {
        lineHeight: 1.2,
        fontSize: 12,
        fontFamily: "Monaco, Menlo, Consolas, 'Courier New', monospace",
        theme: {
            background: '#181d28',
        },
        // 光标闪烁
        cursorBlink: true,
        cursorStyle: 'underline',
        convertEol: true,
        scrollback: 2000,
        tabStopWidth: 4,
        windowsMode: true,
        screenReaderMode: true,
    }
);
xterm_yolo.loadAddon(fitAddon_yolo)
xterm_yolo.loadAddon(new WebLinksAddon());
xterm_yolo.open(document.getElementById('xterm_yolo'));
xterm_yolo.onData(data => { ipcRenderer.send('send_data_terminal_yolo', data); });
const xtermTools_yolo = setupXtermCopyBehavior(
    xterm_yolo,
    document.getElementById('xterm_yolo'),
    () => current_locales
);

function resizeTerminalLayout() {
    const terminalElement = document.getElementById('xterm_yolo');
    if (!terminalElement) {
        return;
    }
    const rect = terminalElement.getBoundingClientRect();
    const availableHeight = Math.max(260, window.innerHeight - rect.top - 72);
    const terminalHeight = Math.max(280, Math.min(460, availableHeight));
    terminalElement.style.width = '100%';
    terminalElement.style.height = Math.floor(terminalHeight) + 'px';
    requestAnimationFrame(() => {
        fitAddon_yolo.fit();
        ipcRenderer.send('resize_terminal_yolo', {
            cols: xterm_yolo.cols,
            rows: xterm_yolo.rows,
        });
    });
}

function scheduleResizeTerminalLayout() {
    resizeTerminalLayout();
    setTimeout(resizeTerminalLayout, 80);
    setTimeout(resizeTerminalLayout, 240);
}

ipcRenderer.on('window-resize', () => {
    scheduleResizeTerminalLayout();
    if (modelGraphChart) {
        requestAnimationFrame(() => {
            modelGraphChart.resize();
        });
    }
})

window.addEventListener('resize', scheduleResizeTerminalLayout);
window.addEventListener('load', scheduleResizeTerminalLayout);
window.addEventListener('focus', scheduleResizeTerminalLayout);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        scheduleResizeTerminalLayout();
    }
});

ipcRenderer.on('write_data_to_xterm_yolo', function (event, arg) {
    // 写入数据 arg 到终端中
    xterm_yolo.write(arg, () => {
      if (xtermTools_yolo) {
        xtermTools_yolo.refreshSearch();
      }
    });
});

ipcRenderer.on('update_progress_bar', function (event, arg) {
    // 更新总进度条效果
    let num = (arg[0] / arg[1]) * 100
    let div = document.getElementById('progress_bar_value_yolo')
    div.style.width = num + '%'
});

ipcRenderer.on('update_progress_bar_epoch', function (event, arg) {
    // 设定每代进度条的长度
    let num = (arg[0] / arg[1]) * 100
    let div = document.getElementById('progress_bar_epoch_value_yolo')
    div.style.width = num + '%'
});

document.getElementById('train_history_dir_yolo').addEventListener('click', function () {
    // 按钮按下时发送“更新训练记录”指令
    ipcRenderer.send('update_train_history_list', '')
});

document.getElementById('make_sense_tool_button').addEventListener('click', function () {
    // 按钮按下时发送“打开 make_sense 工具”指令
    ipcRenderer.send('open_make_sense')
});

document.getElementById('test_model_button').addEventListener('click', function () {
    // 按钮按下时进行模型测试
    // 获取前端的测试图片路径
    let test_dir = document.getElementById('test_img_dir_yolo').value
    // 当前模型的训练资料路径
    let dir = `${process.cwd()}/trainOutput/${current_tab_dir}`
    test_model(dir, test_dir)
    // 更新测试结果到详情窗口中
    ipcRenderer.send('update_test_result_yolo', current_tab_dir)
});

function getModelTestUploadText(key, fallback) {
    return current_locales?.[key] || fallback;
}

async function refreshModelTestUploadButton() {
    const button = document.getElementById('upload_model_test_button');
    const status = document.getElementById('upload_model_test_status');
    if (!button) return;
    button.textContent = getModelTestUploadText('upload_model_test_button', 'Upload Test Program');
    try {
        const state = await ipcRenderer.invoke('get-k210-preview-state');
        const enabled = !!state.connected && !!state.supportsImageSyncUpload && !!current_tab_dir;
        button.disabled = !enabled;
        if (status) {
            status.textContent = enabled ? '' : getModelTestUploadText('upload_model_test_vesibit_only', 'Connect VESIBIT first');
        }
    } catch (error) {
        button.disabled = true;
        if (status) status.textContent = error.message;
    }
}

document.getElementById('upload_model_test_button')?.addEventListener('click', async function () {
    if (!current_tab_dir) {
        Notiflix.Notify.warning(getModelTestUploadText('upload_model_test_no_record', 'Please open a training record first.'));
        return;
    }
    const status = document.getElementById('upload_model_test_status');
    this.disabled = true;
    if (status) status.textContent = getModelTestUploadText('upload_model_test_preparing', 'Preparing upload');
    let finalStatus = '';
    try {
        await ipcRenderer.invoke('upload-k210-model-test-program', { dir: current_tab_dir });
        finalStatus = getModelTestUploadText('upload_model_test_done', 'Test program uploaded');
        Notiflix.Notify.success(getModelTestUploadText('upload_model_test_done', 'Test program uploaded'));
    } catch (error) {
        finalStatus = error.message;
        Notiflix.Notify.failure(error.message);
    } finally {
        await refreshModelTestUploadButton();
        if (status && finalStatus) status.textContent = finalStatus;
    }
});

ipcRenderer.on('k210-model-test-upload-progress', function (_event, payload = {}) {
    const status = document.getElementById('upload_model_test_status');
    if (!status) return;
    const key = `upload_model_test_${payload.status || payload.message || 'preparing'}`;
    const baseText = getModelTestUploadText(key, payload.message || payload.status || '');
    const fileText = payload.file ? ` ${payload.file}` : '';
    const percentText = Number.isFinite(payload.percent) ? ` ${payload.percent}%` : '';
    status.textContent = `${baseText}${fileText}${percentText}`.trim();
});

ipcRenderer.on('k210-preview-status', function () {
    refreshModelTestUploadButton();
});

function getTrainHistoryText(key, fallback) {
    return current_locales?.[key] || fallback;
}

function getDefaultTrainHistoryLabel(dirName) {
    const parts = String(dirName || '').split('_');
    const year = parts[1] || '';
    const time = parts[2] ? parts[2].replace('-', ':').replace('-', ':') : '';
    return `${year} ${time}`.trim() || dirName;
}

function ensureTrainHistoryContextMenu() {
    let menu = document.getElementById('train_history_context_menu_yolo');
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = 'train_history_context_menu_yolo';
    menu.style.cssText = 'position:fixed;display:none;z-index:4000;min-width:170px;padding:6px;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 14px 32px rgba(15,23,42,.2);';
    document.body.appendChild(menu);
    return menu;
}

function hideTrainHistoryContextMenu() {
    const menu = document.getElementById('train_history_context_menu_yolo');
    if (menu) menu.style.display = 'none';
}

function ensureTrainRenameDialog() {
    let overlay = document.getElementById('train_rename_overlay_yolo');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'train_rename_overlay_yolo';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:4100;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.38);';
    overlay.innerHTML = `
        <div style="width:min(430px,96vw);padding:18px;border-radius:14px;background:#fff;box-shadow:0 18px 42px rgba(15,23,42,.26);">
            <h3 style="margin:0 0 12px;font-size:18px;font-weight:600;">${escapeHtml(getTrainHistoryText('train_record_rename_prompt', 'Rename training record'))}</h3>
            <input id="train_rename_input_yolo" class="form-control" type="text">
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
                <button id="train_rename_cancel_yolo" type="button" class="btn btn-secondary">${escapeHtml(getTrainHistoryText('capture_rename_cancel', 'Cancel'))}</button>
                <button id="train_rename_confirm_yolo" type="button" class="btn btn-primary">${escapeHtml(getTrainHistoryText('capture_rename_confirm', 'Rename'))}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function askTrainDisplayName(currentName) {
    return new Promise((resolve) => {
        const overlay = ensureTrainRenameDialog();
        const input = document.getElementById('train_rename_input_yolo');
        const cancel = document.getElementById('train_rename_cancel_yolo');
        const confirm = document.getElementById('train_rename_confirm_yolo');
        const cleanup = (value) => {
            overlay.style.display = 'none';
            cancel.removeEventListener('click', onCancel);
            confirm.removeEventListener('click', onConfirm);
            input.removeEventListener('keydown', onKeydown);
            resolve(value);
        };
        const onCancel = () => cleanup('');
        const onConfirm = () => cleanup(input.value.trim());
        const onKeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                onConfirm();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            }
        };
        input.value = currentName || '';
        overlay.style.display = 'flex';
        cancel.addEventListener('click', onCancel);
        confirm.addEventListener('click', onConfirm);
        input.addEventListener('keydown', onKeydown);
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
    });
}

async function renameTrainRecord(dirName, currentName) {
    const nextName = await askTrainDisplayName(currentName);
    if (!nextName || nextName === currentName) return;
    try {
        await ipcRenderer.invoke('rename-train-history', { dir: dirName, displayName: nextName });
        Notiflix.Notify.success(getTrainHistoryText('capture_rename_success', 'Renamed'));
        ipcRenderer.send('update_train_history_list', '');
    } catch (error) {
        Notiflix.Notify.failure(error.message);
    }
}

function showTrainHistoryContextMenu(event, dirName, currentName, isSuccess) {
    const menu = ensureTrainHistoryContextMenu();
    menu.innerHTML = `
        <button type="button" data-action="open" style="width:100%;border:0;background:transparent;padding:8px 10px;text-align:left;">${escapeHtml(getTrainHistoryText('train_record_menu_open', 'Open'))}</button>
        <button type="button" data-action="rename" style="width:100%;border:0;background:transparent;padding:8px 10px;text-align:left;">${escapeHtml(getTrainHistoryText('capture_menu_rename', 'Rename'))}</button>
        <button type="button" data-action="folder" style="width:100%;border:0;background:transparent;padding:8px 10px;text-align:left;">${escapeHtml(getTrainHistoryText('capture_menu_show_folder', 'Show in folder'))}</button>
        <button type="button" data-action="delete" style="width:100%;border:0;background:transparent;padding:8px 10px;text-align:left;color:#dc2626;">${escapeHtml(getTrainHistoryText('capture_menu_delete', 'Delete'))}</button>`;
    menu.style.display = 'block';
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - rect.height - 8))}px`;
    menu.onclick = async (clickEvent) => {
        const button = clickEvent.target.closest('button[data-action]');
        if (!button) return;
        hideTrainHistoryContextMenu();
        if (button.dataset.action === 'open') {
            isSuccess ? open_model_detail(dirName) : open_model_detail_err(dirName);
        } else if (button.dataset.action === 'rename') {
            await renameTrainRecord(dirName, currentName);
        } else if (button.dataset.action === 'folder') {
            open_dir(dirName);
        } else if (button.dataset.action === 'delete') {
            del_dir(dirName);
        }
    };
}

function buildTrainHistoryItem(d) {
    const dirName = d['name'];
    const displayName = String(d.displayName || '').trim();
    const defaultLabel = getDefaultTrainHistoryLabel(dirName);
    const label = displayName || defaultLabel;
    const isSuccess = d['train_result'] === 'success';
    const openCall = isSuccess ? 'open_model_detail' : 'open_model_detail_err';
    const deleteButton = `<button type="button" class="btn-close train-delete-button" aria-label="Close" data-dir="${escapeHtml(dirName)}"></button>`;
    return `<div class="alert filelist alert-${escapeHtml(d['train_result'])}" role="alert" data-dir="${escapeHtml(dirName)}" data-display="${escapeHtml(label)}" data-success="${isSuccess ? '1' : '0'}">
        <button type="button" class="btn btn-primary btn-sm" onclick=${openCall}("${escapeHtml(dirName)}")>${escapeHtml(current_locales.target_detection)}</button>
        <a class="train-display-name" title="${escapeHtml(dirName)}">${escapeHtml(label)}</a> ${deleteButton}
    </div>`;
}

ipcRenderer.on('update_train_history', function (event, arg) {
    // 更新并显示训练记录
    let html = ''
    console.log(arg)

    for (let d of arg) {
        try {
            let name = d['name'].split('_')[0]
            if (name == 'yolo') {
                html += buildTrainHistoryItem(d)
            }
        } catch (error) {
            console.log("An error occurred while processing the data from " + d["name"] + ":", error);
        }
    }

    document.getElementById('train_history_list_yolo').innerHTML = html
});

document.getElementById('train_history_list_yolo').addEventListener('click', function (event) {
    const button = event.target.closest('.train-delete-button');
    if (!button) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    del_dir(button.dataset.dir);
});

document.getElementById('train_history_list_yolo').addEventListener('dblclick', function (event) {
    const nameNode = event.target.closest('.train-display-name');
    const item = event.target.closest('.filelist');
    if (!nameNode || !item) return;
    event.preventDefault();
    renameTrainRecord(item.dataset.dir, item.dataset.display || '');
});

document.getElementById('train_history_list_yolo').addEventListener('contextmenu', function (event) {
    const item = event.target.closest('.filelist');
    if (!item) return;
    event.preventDefault();
    showTrainHistoryContextMenu(event, item.dataset.dir, item.dataset.display || '', item.dataset.success === '1');
});

document.addEventListener('click', function (event) {
    const menu = document.getElementById('train_history_context_menu_yolo');
    if (menu && !menu.contains(event.target)) {
        hideTrainHistoryContextMenu();
    }
});

function open_dir(dir) {
    // 向主进程发送打开 dir 路径文件夹指令
    ipcRenderer.send('open_dir', dir)
    console.log('open_dir: ', dir)
}

function del_dir(dir) {
    // 向主进程发送删除 dir 路径模型训练结果文件夹指令
    cleanupModalArtifacts();
    ipcRenderer.send('del_dir', dir)
}

ipcRenderer.on('show_del_file_succeed', function (event, arg) {
    // 提示删除文件夹成功
    Notiflix.Notify.success(current_locales.del_succeed + arg);
    // 更新训练记录列表
    ipcRenderer.send('update_train_history_list', '')
});


document.getElementById('start_train_yolo').addEventListener('click', function () {
    // 按下按钮后开始进行训练
    if (train_situation_yolo == false) {
        ipcRenderer.send('send_data_terminal_yolo', 'cls\r'); // 清空终端信息
        // 获取前端的训练超参数
        let img = document.getElementById('dataset_dir_yolo').value
        let xml = document.getElementById('train_xml_dir_yolo').value
        let epoch = document.getElementById('epoch_yolo').value
        let t = document.getElementById("alpha_yolo");
        let alpha = t.options[t.selectedIndex].value;
        let batch_size = document.getElementById("batch_size_yolo").value
        let inputSize = normalizeInputSize(document.getElementById("input_size_yolo").value)
        let dataAug = document.getElementById("data_aug_yolo").value
        // 判断是否有选择训练集路径
        if (img.length == 0) {
            Notiflix.Notify.warning(current_locales.plz_select_img_dir);
        }
        else if (xml.length == 0) {
            Notiflix.Notify.warning(current_locales.plz_select_xml_dir);
        }
        else {
            fitAddon_yolo.fit()
            // 开始训练
            const command = `& "${pythonExec}" "${trainScript}" -t detector -di "${img}" -dx "${xml}" -ep ${epoch} -ap ${alpha} -bz ${batch_size} -is ${inputSize} --data_aug ${dataAug} train\r`;
            ipcRenderer.send('send_data_terminal_yolo', command)
            // 设定开始训练状态为进行中
            train_situation_yolo = true
            renderErrorSummary('train_error_summary', null)
            renderErrorSummary('train_error_summary_err', null)
            // 将状态图标切换成加载图标
            document.getElementById('training_situation_yolo').innerHTML = '<i class="fa fa-spinner fa-spin" style="color:#069b34"></i>'
        }
    }
    else {
        // 如果在训练中，那么不发出训练指令而是发出警告
        Notiflix.Notify.warning(current_locales.train_started_warn);
    }
})

document.getElementById('stop_train_yolo').addEventListener('click', function () {
    // 按下按钮后停止训练并更新状态，如果没有训练则显示警告
    if (train_situation_yolo) {
        ipcRenderer.send('stop_process', '')
        Notiflix.Notify.success(current_locales.train_stopped);

        train_situation_yolo = false
        document.getElementById('training_situation_yolo').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
    }
    else {
        Notiflix.Notify.warning(current_locales.train_not_start);
    }
})

ipcRenderer.on('show_train_succeed', function (event, arg) {
    // 收到主进程发出的训练成功信息，进行提醒并更新状态
    if (!train_situation_yolo) {
        return
    }
    train_situation_yolo = false
    Notiflix.Report.success(current_locales.train_success, current_locales.train_success_to_dir_look_result, current_locales.confirm)
    document.getElementById('training_situation_yolo').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
});

ipcRenderer.on('show_test_succeed', function (event, arg) {
    // 收到主进程发出的测试成功信息，进行提醒并更新状态
    // 更新测试结果到详情窗口中
    ipcRenderer.send('update_test_result_yolo', current_tab_dir)
    train_situation_yolo = false
    Notiflix.Report.success(current_locales.test_succeed, current_locales.test_succeed_to_test_model_result_look_result, current_locales.confirm)
    document.getElementById('training_situation_yolo').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
    document.getElementById('test_situation_yolo').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
});


ipcRenderer.on('show_train_failed', function (event, arg) {
    // 收到主进程发出的训练错误信息，进行提醒并更新状态
    if (!train_situation_yolo) {
        return
    }
    train_situation_yolo = false
    Notiflix.Report.failure(current_locales.train_failed, buildFailureDialogMessage(arg), current_locales.confirm)
    renderErrorSummary('train_error_summary', arg)
    renderErrorSummary('train_error_summary_err', arg)
    document.getElementById('training_situation_yolo').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
    let div = document.getElementById('progress_bar_value_yolo')
    div.style.width = '0%'
    let divs = document.getElementById('progress_bar_epoch_value_yolo')
    divs.style.width = '0%'
});

// 加载脚本时使用本地数据更新一次前端数据
ipcRenderer.send('config', '')
ipcRenderer.on('config', function (event, arg) {
    // 收到主进程消息后进行参数数据更新
    console.log(arg)
    document.getElementById('dataset_dir_yolo').value = arg['yolo_img']
    document.getElementById('train_xml_dir_yolo').value = arg['yolo_xml']
    document.getElementById('epoch_yolo').value = arg['yolo_epoch']
    document.getElementById('batch_size_yolo').value = arg['yolo_batch_size']
    document.getElementById('alpha_yolo').options[arg['yolo_alpha']].selected = true
    document.getElementById('data_aug_yolo').options[arg['yolo_data_aug']].selected = true
    document.getElementById('input_size_yolo').value = normalizeInputSize(arg['yolo_input_size'])
});

// ---- 在前端超参数数据改变时更新本地数据 ----
document.getElementById('epoch_yolo').oninput = function () {
    ipcRenderer.send('config_epoch_yolo', this.value)
}

document.getElementById('alpha_yolo').onchange = function () {
    ipcRenderer.send('config_alpha_yolo', this.selectedIndex)
}

document.getElementById('batch_size_yolo').oninput = function () {
    ipcRenderer.send('config_batch_size_yolo', this.value)
}

document.getElementById('data_aug_yolo').onchange = function () {
    ipcRenderer.send('config_data_aug_yolo', this.selectedIndex)
}

document.getElementById('input_size_yolo').onchange = function () {
    ipcRenderer.send('config_input_size_yolo', normalizeInputSize(this.value))
}



// 实例化并定义模型详情窗口属性
const myModal = new bootstrap.Modal('#model_info_tab_window', {
    keyboard: false
})

const myerrModal = new bootstrap.Modal('#model_info_tab_window_err', {
    keyboard: false
})

function cleanupModalArtifacts() {
    const hasVisibleModal = document.querySelector('.modal.show');
    if (hasVisibleModal) {
        return;
    }
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
}

function attachModalCleanup(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) {
        return;
    }
    modalElement.addEventListener('hide.bs.modal', () => {
        setTimeout(cleanupModalArtifacts, 360);
    });
    modalElement.addEventListener('hidden.bs.modal', () => {
        setTimeout(cleanupModalArtifacts, 0);
    });
}

attachModalCleanup('model_info_tab_window');
attachModalCleanup('model_info_tab_window_err');

document.getElementById('model_info_tab_window').addEventListener('shown.bs.modal', function () {
    requestAnimationFrame(() => {
        renderModelTrainGraph();
    });
});

document.getElementById('model_train_graph_tab').addEventListener('shown.bs.tab', function () {
    requestAnimationFrame(() => {
        renderModelTrainGraph();
    });
});

function open_model_detail(dir) {
    // 打开模型详情窗口
    // 将按钮要打开的路径更新到 HTML 的按钮中
    var button = document.getElementById("open_model_file");
    current_tab_dir = dir
    if (button) {
        // console.log("更新了模型文件夹路径到按钮 open_model_file 中");
        button.onclick = function () {
            open_dir(dir);
        };
    }
    var button = document.getElementById("export_model_file");
    if (button) {
        // console.log("更新了模型文件夹路径到按钮 export_model_file 中");
        button.onclick = function () {
            export_model(dir);
        };
    }
    ipcRenderer.send('read_model_detail_and_show', dir)
    myModal.show()
    refreshModelTestUploadButton()
}

function open_model_detail_err(dir) {
    ipcRenderer.send('read_model_detail_and_show_err', dir)
    myerrModal.show()
}

function test_model(dir, test_dir) {
    // 测试模型
    if (train_situation_yolo == false) {
        // 判断测试路径是否有图片
        if (test_dir.length == 0) {
            Notiflix.Notify.warning(current_locales.plz_select_test_img_dir);
        }
        else {
            ipcRenderer.send('send_data_terminal_yolo', 'cls\r'); // 清空终端信息
            ipcRenderer.send('clean_file', `${dir}/test`); // 清空存放以前测试图片的文件
            fitAddon_yolo.fit()
            // 开始测试图片
            const command = `& "${pythonExec}" "${testScript}" --dir "${dir}" --img_dir "${test_dir}"\r`;
            ipcRenderer.send('send_data_terminal_yolo', command)
            // 设定状态为进行中
            train_situation_yolo = true
            // 将状态图标设为加载图标
            document.getElementById('test_situation_yolo').innerHTML = '<i class="fa fa-spinner fa-spin" style="color:#069b34"></i>'
        }
    }
    else {
        // 如果在运行中，那么不发出指令而是发出警告
        Notiflix.Notify.warning(current_locales.train_started_warn);
    }
}

ipcRenderer.on('update_model_param', function (event, arg) {
    // 接收主进程信息后更新模型详情数据
    data = JSON.parse(arg)
    let modal_type = current_locales.cls
    if (data['type'] == "detector") {
        modal_type = current_locales.target_detection
    }
    document.getElementById("model_type").innerHTML = modal_type
    document.getElementById("model_alpha").innerHTML = data['alpha']
    document.getElementById("model_epoch").innerHTML = data['epochs']
    document.getElementById("model_batchsize").innerHTML = data['batch_size']
    document.getElementById("model_input_size").innerHTML = formatInputSize(data)
    document.getElementById("model_data_aug").innerHTML = formatDataAugMode(data)
});

ipcRenderer.on('update_model_labels', function (event, arg) {
    // 接收主进程信息后更新模型详情标签
    document.getElementById("model_label").innerHTML = arg
});

ipcRenderer.on('update_model_anchors', function (event, arg) {
    // 接收主进程信息后更新模型详情锚点
    document.getElementById("model_anchors").innerHTML = arg
});

ipcRenderer.on('update_model_train_log', function (event, arg) {
    historyLogSearch.setText('train_log', arg[0]);
    // console.log(arg)
});

ipcRenderer.on('update_model_train_error', function (event, payload) {
    renderErrorSummary('train_error_summary', payload)
});


ipcRenderer.on('update_model_train_graph', function (event, arg) {
    // 获取当前模型的训练图表并更新到详情窗口中
    const rawGraphData = Array.isArray(arg) ? arg[0] : arg;
    pendingTrainGraphData = JSON.parse(rawGraphData)
    console.log(pendingTrainGraphData)
    requestAnimationFrame(() => {
        renderModelTrainGraph();
    });
});


ipcRenderer.on('update_model_param_err', function (event, arg) {
    data = JSON.parse(arg)
    let modal_type = current_locales.cls
    if (data['type'] == "detector") {
        modal_type = current_locales.target_detection
    }
    document.getElementById("model_type_err").innerHTML = modal_type
    document.getElementById("model_alpha_err").innerHTML = data['alpha']
    document.getElementById("model_epoch_err").innerHTML = data['epochs']
    document.getElementById("model_batchsize_err").innerHTML = data['batch_size']
    document.getElementById("model_input_size_err").innerHTML = formatInputSize(data)
    document.getElementById("model_data_aug_err").innerHTML = formatDataAugMode(data)
});

ipcRenderer.on('update_model_train_log_err', function (event, arg) {
    historyLogSearch.setText('train_log_err', arg[0]);
    // console.log(arg)
});

ipcRenderer.on('update_model_train_error_err', function (event, payload) {
    renderErrorSummary('train_error_summary_err', payload)
});

ipcRenderer.on('show_test_result_img', function (event, arg) {
    // 接收主进程的图片目录信息，并动态生成 HTML 来展示这些图片
    let html = ''
    let data = arg
    console.log(data)
    let imgPath = data['dir']
    imgPath = pathModule.normalize(imgPath)
    imgPath = imgPath.replace(/\\/g, '/');

    for (let f of data['list']) {
        html += '<div style="padding:20px; cursor: pointer;" onclick="open_image(' + "\'" + imgPath + '/' + f + "\'" + ')\"">' +
            '<img class="rounded mx-auto d-block" style="width: 120px;height: 100%;" src="' + imgPath + '/' + f + '" alt="' + f + '">' +
            '</div>';
    }
    html += "</div>"
    document.getElementById('test_result_wrap').innerHTML = html
});

function open_image(imagePath) {
    ipcRenderer.send('open_image', imagePath);
}


function export_model(dir) {
    ipcRenderer.send('export_model', dir)
}

ipcRenderer.on('show_export_reuslt_succeed', function (event, arg) {
    Notiflix.Notify.success('导出成功\n' + arg);
});

ipcRenderer.on('show_export_reuslt_failed', function (event, arg) {
    Notiflix.Notify.failure('导出失败\n' + arg);
});

ipcRenderer.on('show_train_graph', function (event, arg) {
    document.getElementById('model_train_graph_tab').innerHTML = current_locales.model_train_graph_tab
    html = '<img src="' + arg + '" style="width:50%" class="rounded float-start" alt="' + current_locales.confusion_mx + '">'
    document.getElementById('mximg').innerHTML = html
});
