const { ipcRenderer } = require('electron');
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
const CLS_INPUT_SIZES = ['224x224', '240x240', '320x224'];
let modelGraphChart = null;
let pendingTrainGraphData = null;
const historyLogSearch = setupHistoryLogSearch(
    ['train_log', 'train_log_err'],
    () => current_locales
);

function normalizeClsInputSize(value) {
    return CLS_INPUT_SIZES.includes(value) ? value : '224x224';
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

function ensureModelGraphChart() {
    const chartElement = document.getElementById('echarts');
    if (!chartElement) {
        return null;
    }
    if (!modelGraphChart) {
        modelGraphChart = echarts.init(chartElement);
    }
    return modelGraphChart;
}

function renderTrainGraph() {
    if (!pendingTrainGraphData || !current_locales) {
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
                data: pendingTrainGraphData.acc,
                name: current_locales.test_acc,
                type: 'line',
                smooth: true
            },
            {
                data: pendingTrainGraphData.loss,
                name: current_locales.test_loss,
                type: 'line',
                smooth: true
            },
            {
                data: pendingTrainGraphData.val_acc,
                name: current_locales.val_acc,
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
    renderTrainGraph();
  } catch (e) {
    console.error('Failed to load locale data:', e);
  }
}

init_current_locales();

ipcRenderer.on('change-language', async (event, language) => {
    console.log('[RENDERER] language changed, reload locales:', language);
    current_locales = await ipcRenderer.invoke('get-current-locales');
    renderTrainGraph();
})


let train_situation_cls = false
let current_tab_dir

// 定义 python 路径和运行脚本变量
let pythonExec
let trainScript
let testScript

// 发送获取应用根目录指令
ipcRenderer.send('get_app_path', 'imgCls');

ipcRenderer.on('get_app_path_reply', (event, appPath) => {
    // 获取 python.exe、train.py 和测试脚本路径
    pythonExec = pathModule.join(appPath, 'py39', 'python.exe');
    trainScript = pathModule.join(appPath, 'maix_train', 'train.py');
    testScript = pathModule.join(appPath, 'maix_train', 'train', 'classifier', 'predict_test.py')

});



document.getElementById("dataset_dir_cls").onclick = function () {
    //鍚戜富杩涚▼main.js鍙戦€佹秷鎭?纭畾瑕佹墦寮€鍥惧儚鍒嗙被璁粌闆嗗瓨鏀剧洰褰曠殑鏂囦欢澶?
    ipcRenderer.send('open_dataset_dir_cls', '');
}

document.getElementById('test_img_dir_cls').onclick = function () {
    ipcRenderer.send('open_test_img_dir_cls', '');
}

ipcRenderer.on('update_dataset_dir_cls', function (event, arg) {
    //鐩戝惉涓昏繘绋嬭繑鍥炶繃鏉ョ殑娑堟伅锛屾洿鏂板浘鍍忓垎绫诲瓨鏀剧洰褰曠殑鏂囦欢澶硅矾寰勫埌鍓嶇浠ュ強鍚庣
    // console.log("arg:", arg);
    document.getElementById('dataset_dir_cls').value = arg
    ipcRenderer.send('config_cls_img', arg)
});

ipcRenderer.on('update_test_img_dir_cls', function (event, arg) {
    //鐩戝惉涓昏繘绋嬭繑鍥炶繃鏉ョ殑娑堟伅锛屾洿鏂板浘鍍忓垎绫绘祴璇曢泦瀛樻斁鐩綍鐨勬枃浠跺す璺緞鍒板墠绔互鍙婂悗绔?
    console.log("arg:", arg);
    document.getElementById('test_img_dir_cls').value = arg
    ipcRenderer.send('config_test_img_dir_cls', arg)
});


var Terminal = require('xterm').Terminal;

// 鍒濆鍖?xterm 骞舵彃鍏ュ埌椤甸潰涓?
const fitAddon_cls = new FitAddon()

//瀹炰緥鍖栧浘鍍忓垎绫荤殑缁堢绐楀彛
const xterm_cls = new Terminal(
    {
        lineHeight: 1.2,
        fontSize: 12,
        fontFamily: "Monaco, Menlo, Consolas, 'Courier New', monospace",
        theme: {
            background: '#181d28',
        },
        // 鍏夋爣闂儊
        cursorBlink: true,
        cursorStyle: 'underline',
        convertEol: true,
        scrollback: 2000,
        tabStopWidth: 4,
        windowsMode: true,
        screenReaderMode: true,
    }
);
xterm_cls.loadAddon(fitAddon_cls)
xterm_cls.loadAddon(new WebLinksAddon());
xterm_cls.open(document.getElementById('xterm_cls'));
xterm_cls.onData(data => { ipcRenderer.send('send_data_terminal_cls', data); });
const xtermTools_cls = setupXtermCopyBehavior(
    xterm_cls,
    document.getElementById('xterm_cls'),
    () => current_locales
);

function resizeTerminalLayout() {
    const terminalElement = document.getElementById('xterm_cls');
    if (!terminalElement) {
        return;
    }
    const rect = terminalElement.getBoundingClientRect();
    const availableHeight = Math.max(260, window.innerHeight - rect.top - 72);
    const terminalHeight = Math.max(280, Math.min(460, availableHeight));
    terminalElement.style.width = '100%';
    terminalElement.style.height = Math.floor(terminalHeight) + 'px';
    requestAnimationFrame(() => {
        fitAddon_cls.fit();
        ipcRenderer.send('resize_terminal_cls', {
            cols: xterm_cls.cols,
            rows: xterm_cls.rows,
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

ipcRenderer.on('write_data_to_xterm_cls', function (event, arg) {
    // 鍐欏叆鏁版嵁arg鍒扮粓绔腑
    xterm_cls.write(arg, () => {
      if (xtermTools_cls) {
        xtermTools_cls.refreshSearch();
      }
    });
});

ipcRenderer.on('update_progress_bar', function (event, arg) {
    //杩涘害鏉℃晥鏋滄洿鏂?
    let num = (arg[0] / arg[1]) * 100
    let div = document.getElementById('progress_bar_value_cls')
    div.style.width = num + '%'
});

document.getElementById('train_history_dir_cls').addEventListener('click', function () {
    //鎸夐挳鎸変笅鏃跺彂閫佲€滄洿鏂拌缁冭褰曗€濈殑鎸囦护
    ipcRenderer.send('update_train_history_list', '')
});

document.getElementById('test_model_button').addEventListener('click', function () {
    //鎸夐挳鎸変笅鏃惰繘琛屾ā鍨嬫祴璇?
    //鑾峰彇鍓嶇鐨勬祴璇曞浘鐗囪矾寰?
    let test_dir = document.getElementById('test_img_dir_cls').value
    //褰撳墠妯″瀷鐨勮缁冭祫鏂欒矾寰?
    let dir = `${process.cwd()}/trainOutput/${current_tab_dir}`
    test_model(dir, test_dir)
    //鏇存柊娴嬭瘯缁撴灉鍒拌鎯呯獥鍙ｄ腑
    ipcRenderer.send('update_test_result_cls', current_tab_dir)
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
    let menu = document.getElementById('train_history_context_menu_cls');
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = 'train_history_context_menu_cls';
    menu.style.cssText = 'position:fixed;display:none;z-index:4000;min-width:170px;padding:6px;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 14px 32px rgba(15,23,42,.2);';
    document.body.appendChild(menu);
    return menu;
}

function hideTrainHistoryContextMenu() {
    const menu = document.getElementById('train_history_context_menu_cls');
    if (menu) menu.style.display = 'none';
}

function ensureTrainRenameDialog() {
    let overlay = document.getElementById('train_rename_overlay_cls');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'train_rename_overlay_cls';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:4100;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.38);';
    overlay.innerHTML = `
        <div style="width:min(430px,96vw);padding:18px;border-radius:14px;background:#fff;box-shadow:0 18px 42px rgba(15,23,42,.26);">
            <h3 style="margin:0 0 12px;font-size:18px;font-weight:600;">${escapeHtml(getTrainHistoryText('train_record_rename_prompt', 'Rename training record'))}</h3>
            <input id="train_rename_input_cls" class="form-control" type="text">
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
                <button id="train_rename_cancel_cls" type="button" class="btn btn-secondary">${escapeHtml(getTrainHistoryText('capture_rename_cancel', 'Cancel'))}</button>
                <button id="train_rename_confirm_cls" type="button" class="btn btn-primary">${escapeHtml(getTrainHistoryText('capture_rename_confirm', 'Rename'))}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function askTrainDisplayName(currentName) {
    return new Promise((resolve) => {
        const overlay = ensureTrainRenameDialog();
        const input = document.getElementById('train_rename_input_cls');
        const cancel = document.getElementById('train_rename_cancel_cls');
        const confirm = document.getElementById('train_rename_confirm_cls');
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
        <button type="button" class="btn btn-primary btn-sm" onclick=${openCall}("${escapeHtml(dirName)}")>${escapeHtml(current_locales.cls)}</button>
        <a class="train-display-name" title="${escapeHtml(dirName)}">${escapeHtml(label)}</a> ${deleteButton}
    </div>`;
}

ipcRenderer.on('update_train_history', function (event, arg) {
    //鏇存柊骞舵樉绀鸿缁冭褰?
    let html = ''
    //console.log(arg)

    for (let d of arg) {
        try {
            let name = d['name'].split('_')[0]
            if (name == 'classifer') {
                html += buildTrainHistoryItem(d)
            }
        } catch (error) {
            console.log("An error occurred while processing the data from " + d["name"] + ":", error);
        }
    }


    document.getElementById('train_history_list_cls').innerHTML = html
});

document.getElementById('train_history_list_cls').addEventListener('click', function (event) {
    const button = event.target.closest('.train-delete-button');
    if (!button) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    del_dir(button.dataset.dir);
});

document.getElementById('train_history_list_cls').addEventListener('dblclick', function (event) {
    const nameNode = event.target.closest('.train-display-name');
    const item = event.target.closest('.filelist');
    if (!nameNode || !item) return;
    event.preventDefault();
    renameTrainRecord(item.dataset.dir, item.dataset.display || '');
});

document.getElementById('train_history_list_cls').addEventListener('contextmenu', function (event) {
    const item = event.target.closest('.filelist');
    if (!item) return;
    event.preventDefault();
    showTrainHistoryContextMenu(event, item.dataset.dir, item.dataset.display || '', item.dataset.success === '1');
});

document.addEventListener('click', function (event) {
    const menu = document.getElementById('train_history_context_menu_cls');
    if (menu && !menu.contains(event.target)) {
        hideTrainHistoryContextMenu();
    }
});

function open_dir(dir) {
    //鍚戜富杩涚▼鍙戦€佹墦寮€dir璺緞鏂囦欢澶规寚浠?
    ipcRenderer.send('open_dir', dir)
    //console.log('open_dir: ',dir)
}

function del_dir(dir) {
    //鍚戜富杩涚▼鍙戦€佸垹闄ir璺緞妯″瀷璁粌缁撴灉鏂囦欢澶规寚浠?
    cleanupModalArtifacts();
    ipcRenderer.send('del_dir', dir)
}

ipcRenderer.on('show_del_file_succeed', function (event, arg) {
    //鎻愮ず鍒犻櫎鏂囦欢澶规垚鍔?
    Notiflix.Notify.success(current_locales.del_succeed + arg);
    //鏇存柊璁粌璁板綍鍒楄〃
    ipcRenderer.send('update_train_history_list', '')
});



document.getElementById('start_train_cls').addEventListener('click', function () {
    //鎸変笅鎸夐挳鍚庡紑濮嬭繘琛岃缁?
    if (train_situation_cls == false) {
        ipcRenderer.send('send_data_terminal_cls', 'cls\r'); //娓呯┖缁堢淇℃伅
        //鑾峰彇鍓嶇鐨勮缁冭秴鍙傛暟
        let img = document.getElementById('dataset_dir_cls').value
        let epoch = document.getElementById('epoch_cls').value
        let t = document.getElementById("alpha_cls");
        let alpha = t.options[t.selectedIndex].value;
        let batch_size = document.getElementById("batch_size_cls").value
        let input_size = normalizeClsInputSize(document.getElementById('input_size_cls').value)
        let data_aug = document.getElementById('data_aug_cls').value
        //鍒ゆ柇鏄惁鏈夐€夋嫨璁粌闆嗚矾寰?
        if (img.length == 0) {
            Notiflix.Notify.warning(current_locales.plz_select_img_dir);
        }
        else {
            fitAddon_cls.fit()
            //寮€濮嬭缁?
            const command = `& "${pythonExec}" "${trainScript}" -t classifier -dc "${img}" -ep ${epoch} -ap ${alpha} -bz ${batch_size} -is ${input_size} --data_aug ${data_aug} train\r`;
            // 鍙戦€佸紑濮嬭缁冩寚浠? 
            ipcRenderer.send('send_data_terminal_cls', command);
            //璁惧畾寮€濮嬭缁冪姸鎬佷负杩涜涓?
            train_situation_cls = true
            //灏嗙姸鍐靛浘鏍囧垏鎹㈡垚鍔犺浇鍥炬爣
            document.getElementById('training_situation_cls').innerHTML = '<i class="fa fa-spinner fa-spin" style="color:#069b34"></i>'
        }
    }
    else {
        //濡傛灉鍦ㄨ缁冧腑锛岄偅涔堜笉鍙戝嚭璁粌鎸囦护鑰屾槸鍙戝嚭璀﹀憡
        Notiflix.Notify.warning(current_locales.train_started_warn);
    }
})

document.getElementById('stop_train_cls').addEventListener('click', function () {
    //鎸変笅鎸夐挳鍚庤繘琛屽仠姝㈣缁冩搷浣滃苟鏇存柊鐘舵€侊紝濡傛灉娌℃湁璁粌鐨勮瘽灏辨樉绀烘病鏈夎缁冧腑鐨勮鍛?
    if (train_situation_cls) {
        ipcRenderer.send('stop_process', '')
        Notiflix.Notify.success(current_locales.train_stopped);

        train_situation_cls = false
        document.getElementById('training_situation_cls').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
    }
    else {
        Notiflix.Notify.warning(current_locales.train_not_start);
    }
})

ipcRenderer.on('show_train_succeed', function (event, arg) {
    //鏀跺埌涓昏繘绋嬪彂鍑虹殑璁粌鎴愬姛淇℃伅锛岃繘琛屼俊鎭彁閱掑苟涓旀洿鏂扮姸鎬?
    if (!train_situation_cls) {
        return
    }
    train_situation_cls = false
    Notiflix.Report.success(current_locales.train_success, current_locales.train_success_to_dir_look_result, current_locales.confirm)
    document.getElementById('training_situation_cls').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
});

ipcRenderer.on('show_test_succeed', function (event, arg) {
    //鏀跺埌涓昏繘绋嬪彂鍑虹殑娴嬭瘯鎴愬姛淇℃伅锛岃繘琛屼俊鎭彁閱掑苟涓旀洿鏂扮姸鎬?
    //鏇存柊娴嬭瘯缁撴灉鍒拌鎯呯獥鍙ｄ腑
    ipcRenderer.send('update_test_result_cls', current_tab_dir)
    train_situation_cls = false
    Notiflix.Report.success(current_locales.test_succeed, current_locales.test_succeed_to_test_model_result_look_result, current_locales.confirm)
    document.getElementById('training_situation_cls').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
    document.getElementById('test_situation_cls').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
});


ipcRenderer.on('show_train_failed', function (event, arg) {
    //鏀跺埌涓昏繘绋嬪彂鍑虹殑璁粌閿欒淇℃伅锛岃繘琛屼俊鎭彁閱掑苟涓旀洿鏂扮姸鎬?
    if (!train_situation_cls) {
        return
    }
    train_situation_cls = false
    Notiflix.Report.failure(current_locales.train_failed, current_locales.train_failed_check_terminal, current_locales.confirm)
    document.getElementById('training_situation_cls').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
    let div = document.getElementById('progress_bar_value_cls')
    div.style.width = '0%'
    let divs = document.getElementById('progress_bar_epoch_value_cls')
    divs.style.width = '0%'
});

ipcRenderer.on('update_progress_bar_epoch', function (event, arg) {
    //璁惧畾姣忎唬杩涘害鏉＄殑闀垮害
    let num = (arg[0] / arg[1]) * 100
    let div = document.getElementById('progress_bar_epoch_value_cls')
    div.style.width = num + '%'
});

//鍔犺浇鑴氭湰鏃朵娇鐢ㄦ湰鍦版暟鎹洿鏂颁竴娆″墠绔暟鎹?
ipcRenderer.send('config', '')
ipcRenderer.on('config', function (event, arg) {
    //鏀跺埌涓昏繘绋嬫秷鎭悗杩涜鍙傛暟鏁版嵁鏇存柊
    //console.log(arg)
    document.getElementById('dataset_dir_cls').value = arg['cls_img']
    document.getElementById('epoch_cls').value = arg['cls_epoch']
    document.getElementById('batch_size_cls').value = arg['cls_batch_size']
    document.getElementById('alpha_cls').options[arg['cls_alpha']].selected = true
    document.getElementById('data_aug_cls').options[arg['cls_data_aug']].selected = true
    document.getElementById('input_size_cls').value = normalizeClsInputSize(arg['cls_input_size'])
});

//----鍦ㄥ墠绔暟鎹敼鍙樻椂鏇存柊鏈湴鏁版嵁----
document.getElementById('epoch_cls').oninput = function () {
    ipcRenderer.send('config_epoch_cls', this.value)
}

document.getElementById('alpha_cls').onchange = function () {
    ipcRenderer.send('config_alpha_cls', this.selectedIndex)
}

document.getElementById('batch_size_cls').oninput = function () {
    ipcRenderer.send('config_batch_size_cls', this.value)
}

document.getElementById('data_aug_cls').onchange = function () {
    ipcRenderer.send('config_data_aug_cls', this.selectedIndex)
}

document.getElementById('input_size_cls').onchange = function () {
    this.value = normalizeClsInputSize(this.value)
    ipcRenderer.send('config_input_size_cls', this.value)
}



//瀹炰緥鍖栧苟瀹氫箟妯″瀷璇︽儏绐楀彛灞炴€?
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


function open_model_detail(dir) {
    //鎵撳紑妯″瀷璇︽儏绐楀彛
    //灏嗘寜閽鎵撳紑鐨勮矾寰勬洿鏂板埌html鐨勬寜閽腑
    var button = document.getElementById("open_model_file");
    current_tab_dir = dir
    if (button) {
        //console.log("鏇存柊浜嗘ā鍨嬫枃浠跺す璺緞鍒版寜閽?open_model_file'涓?);
        button.onclick = function () {
            open_dir(dir);
        };
    }
    var button = document.getElementById("export_model_file");
    if (button) {
        //console.log("鏇存柊浜嗘ā鍨嬫枃浠跺す璺緞鍒版寜閽?export_model_file'涓?);
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
    //娴嬭瘯妯″瀷
    if (train_situation_cls == false) {
        //鍒ゆ柇娴嬭瘯璺緞鏄惁鏈夊浘鐗?
        if (test_dir.length == 0) {
            Notiflix.Notify.warning(current_locales.plz_select_test_img_dir);
        }
        else {
            ipcRenderer.send('send_data_terminal_cls', 'cls\r'); //娓呯┖缁堢淇℃伅
            ipcRenderer.send('clean_file', `${dir}/test`); //娓呯┖瀛樻斁浠ュ墠娴嬭瘯鍥剧墖鐨勬枃浠?
            fitAddon_cls.fit()
            //寮€濮嬫祴璇曞浘鐗?
            const command = `& "${pythonExec}" "${testScript}" --dir "${dir}" --img_dir "${test_dir}"\r`;
            ipcRenderer.send('send_data_terminal_cls', command)
            //璁惧畾鐘舵€佷负杩涜涓?
            train_situation_cls = true
            //灏嗙姸鎬佸浘鏍囪涓哄姞杞藉浘鏍?
            document.getElementById('test_situation_cls').innerHTML = '<i class="fa fa-spinner fa-spin" style="color:#069b34"></i>'
        }
    }
    else {
        //濡傛灉鍦ㄨ繍琛屼腑锛岄偅涔堜笉鍙戝嚭鎸囦护鑰屾槸鍙戝嚭璀﹀憡
        Notiflix.Notify.warning(current_locales.train_started_warn);
    }
}

ipcRenderer.on('update_model_param', function (event, arg) {
    //鎺ユ敹鍒颁富杩涚▼淇℃伅鍚庤繘琛屾ā鍨嬭鎯呯殑鏁版嵁鏇存柊
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
    //鎺ユ敹鍒颁富杩涚▼淇℃伅鍚庤繘琛屾ā鍨嬭鎯呯殑鏍囩鏇存柊
    document.getElementById("model_label").innerHTML = arg
});

ipcRenderer.on('update_model_train_log', function (event, arg) {
    historyLogSearch.setText('train_log', arg[0]);
    //console.log(arg)
});


ipcRenderer.on('update_model_train_graph', function (event, arg) {
    pendingTrainGraphData = JSON.parse(arg)
    requestAnimationFrame(() => {
        renderTrainGraph();
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
    //console.log(arg)
});

ipcRenderer.on('show_test_result_img', function (event, arg) {
    //鎺ユ敹涓昏繘绋嬬殑鍥剧墖鐩綍淇℃伅锛屽苟鍔ㄦ€佺敓鎴?HTML 鏉ュ睍绀鸿繖浜涘浘鐗?
    let html = ''
    let data = arg
    //console.log(data)
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
    Notiflix.Notify.success('瀵煎嚭鎴愬姛\n' + arg);
});

ipcRenderer.on('show_export_reuslt_failed', function (event, arg) {
    Notiflix.Notify.failure('瀵煎嚭澶辫触\n' + arg);
});

ipcRenderer.on('show_train_graph', function (event, arg) {
    document.getElementById('model_train_graph_tab').innerHTML = current_locales.model_train_graph_tab
    html = '<img src="' + arg + '" style="width:50%" class="rounded float-start" alt="' + current_locales.confusion_mx + '">'
    document.getElementById('mximg').innerHTML = html
});

document.addEventListener('DOMContentLoaded', () => {
    resizeTerminalLayout();
    const detailModal = document.getElementById('model_info_tab_window');
    if (detailModal) {
        detailModal.addEventListener('shown.bs.modal', () => {
            requestAnimationFrame(() => {
                resizeTerminalLayout();
                renderTrainGraph();
            });
        });
    }
    const graphTab = document.getElementById('model_train_graph_tab');
    if (graphTab) {
        graphTab.addEventListener('shown.bs.tab', () => {
            requestAnimationFrame(() => {
                renderTrainGraph();
            });
        });
    }
});

