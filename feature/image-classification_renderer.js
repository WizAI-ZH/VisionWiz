const { ipcRenderer } = require('electron');
const { FitAddon } = require('xterm-addon-fit');
const { WebLinksAddon } = require('xterm-addon-web-links');
const echarts = require('echarts');
const { setupXtermCopyBehavior } = require('./xterm-copy-helper');
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
setupXtermCopyBehavior(
    xterm_cls,
    document.getElementById('xterm_cls'),
    () => current_locales
);

function resizeTerminalLayout() {
    const terminalElement = document.getElementById('xterm_cls');
    if (!terminalElement) {
        return;
    }
    terminalElement.style.width = '100%';
    terminalElement.style.height = Math.max(360, Math.floor(window.innerHeight * 0.58)) + 'px';
    terminalElement.style.marginLeft = 'auto';
    terminalElement.style.marginRight = 'auto';
    requestAnimationFrame(() => fitAddon_cls.fit());
}

ipcRenderer.on('window-resize', () => {
    resizeTerminalLayout();
    if (modelGraphChart) {
        requestAnimationFrame(() => {
            modelGraphChart.resize();
        });
    }
})

ipcRenderer.on('write_data_to_xterm_cls', function (event, arg) {
    // 鍐欏叆鏁版嵁arg鍒扮粓绔腑
    xterm_cls.write(arg);
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

ipcRenderer.on('update_train_history', function (event, arg) {
    //鏇存柊骞舵樉绀鸿缁冭褰?
    let html = ''
    //console.log(arg)

    for (let d of arg) {
        try {
            let name = d['name'].split('_')[0]
            let year = d['name'].split('_')[1]
            let time = d['name'].split('_')[2].replace('-', ':').replace('-', ':')
            if (name == 'classifer') {
                if (d['train_result'] == "success") {
                    html += '<div class="alert filelist alert-' + d['train_result'] + '" role="alert"><button type="button" class="btn btn-primary btn-sm" onclick=open_model_detail("' + d['name'] + '")>' + current_locales.cls + '</button><a>' + year + ' ' + time + '</a> <button type="button" class="btn-close" aria-label="Close" onclick="del_dir(\'' + d['name'] + '\')"></button></div>'
                }
                else {
                    html += '<div class="alert filelist alert-' + d['train_result'] + '" role="alert"><button type="button" class="btn btn-primary btn-sm" onclick=open_model_detail_err("' + d['name'] + '")>' + current_locales.cls + '</button><a>' + year + ' ' + time + '</a> <button type="button" class="btn-close" aria-label="Close" onclick="del_dir(\'' + d['name'] + '\')"></button></div>'
                }
            }
        } catch (error) {
            console.log("An error occurred while processing the data from " + d["name"] + ":", error);
        }
    }


    document.getElementById('train_history_list_cls').innerHTML = html
});

function open_dir(dir) {
    //鍚戜富杩涚▼鍙戦€佹墦寮€dir璺緞鏂囦欢澶规寚浠?
    ipcRenderer.send('open_dir', dir)
    //console.log('open_dir: ',dir)
}

function del_dir(dir) {
    //鍚戜富杩涚▼鍙戦€佸垹闄ir璺緞妯″瀷璁粌缁撴灉鏂囦欢澶规寚浠?
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
});

ipcRenderer.on('update_model_labels', function (event, arg) {
    //鎺ユ敹鍒颁富杩涚▼淇℃伅鍚庤繘琛屾ā鍨嬭鎯呯殑鏍囩鏇存柊
    document.getElementById("model_label").innerHTML = arg
});

ipcRenderer.on('update_model_train_log', function (event, arg) {
    var reg = new RegExp("\r\n", "g");
    document.getElementById('train_log').innerHTML = arg[0].replaceAll(reg, '<br/>');
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
});

ipcRenderer.on('update_model_train_log_err', function (event, arg) {
    var reg = new RegExp("\r\n", "g");
    document.getElementById('train_log_err').innerHTML = arg[0].replaceAll(reg, '<br/>');
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

