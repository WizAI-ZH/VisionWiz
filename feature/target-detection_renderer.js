const { ipcRenderer } = require('electron');
const { FitAddon } = require('xterm-addon-fit');
const { WebLinksAddon } = require('xterm-addon-web-links');
const echarts = require('echarts');
const path = require('path');

let train_situation_yolo = false
let current_tab_dir

//定义python路径和运行脚本变量
let pythonExec
let trainScript
let testScript

//发送获取应用根目录指令
ipcRenderer.send('get_app_path','objectDetection');

ipcRenderer.on('get_app_path_reply', (event, appPath) => {
    // 获取 python.exe 和 train.py 的路径  
    pythonExec = path.join(appPath, 'py39', 'python.exe');
    trainScript = path.join(appPath, 'maix_train', 'train.py');
    testScript = path.join(appPath, 'maix_train', 'train', 'detector', 'predict_test.py');
});

document.getElementById("dataset_dir_yolo").onclick = function () {
    //向主进程main.js发送消息,确定要打开目标检测训练集存放目录的文件夹
    ipcRenderer.send('open_dataset_dir_yolo', '');
}

document.getElementById("train_xml_dir_yolo").onclick = function () {
    //向主进程main.js发送消息,确定要打开目标检测训练集标签存放目录的文件夹
    ipcRenderer.send('open_train_xml_dir_yolo', '');
}

document.getElementById('test_img_dir_yolo').onclick = function () {
    //向主进程main.js发送消息,确定要打开目标检测测试图片所在的文件夹
    ipcRenderer.send('open_test_img_dir_yolo', '');
}

ipcRenderer.on('update_dataset_dir_yolo', function (event, arg) {
    //监听主进程返回过来的消息，更新目标检测存放目录的文件夹路径到前端以及后端
    console.log("arg:", arg);
    document.getElementById('dataset_dir_yolo').value = arg
    ipcRenderer.send('config_yolo_img', arg)
});

ipcRenderer.on('update_xml_dir_yolo', function (event, arg) {
    //监听主进程返回过来的消息，更新目标检测标签文件存放目录的文件夹路径到前端以及后端
    console.log("arg:", arg);
    document.getElementById('train_xml_dir_yolo').value = arg
    ipcRenderer.send('config_yolo_xml', arg)
});

ipcRenderer.on('update_test_img_dir_yolo', function (event, arg) {
    //监听主进程返回过来的消息，更新目标检测测试集存放目录的文件夹路径到前端以及后端
    console.log("arg:", arg);
    document.getElementById('test_img_dir_yolo').value = arg
    ipcRenderer.send('config_test_img_dir_yolo', arg)
});


var Terminal = require('xterm').Terminal;

// 初始化 xterm 并插入到页面中
const fitAddon_yolo = new FitAddon()

//实例化目标检测的终端窗口
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

ipcRenderer.on('window-resize', (event, { width, height }) => {
    // 窗口尺寸变化时，终端尺寸自适应
    // console.log(document.getElementById('xterm_yolo'))
    fitAddon_yolo.fit()
    // // 获取终端元素  
    const terminalElement = document.getElementById('xterm_yolo');

    // 将宽度缩小到原来的90%  
    terminalElement.style.width = (width * 0.9) + 'px';

    // 将终端居中  
    terminalElement.style.marginLeft = 'auto';
    terminalElement.style.marginRight = 'auto';
    //训练数据图根据详情窗口大小自适应修改
    // const train_chart = document.querySelector('[data-zr-dom-id="zr_0"]')
    // // console.log(train_chart)
    // if (train_chart) {
    //     const train_chart_container = document.getElementById("echarts")
    //     const parentDiv = train_chart.parentElement;
    //     // console.log(parentDiv)
    //     let new_width = document.getElementById("model_graph_pane").offsetWidth * 0.72
    //     let new_height = new_width / 2
    //     train_chart_container.style.width = new_width + 'px';
    //     train_chart_container.style.height = new_height + 'px';
    //     parentDiv.style.width = new_width + 'px';
    //     parentDiv.style.height = new_height + 'px';
    //     // train_chart.width = document.getElementById("model_graph_pane").offsetWidth;
    //     train_chart.style.width = new_width + 'px';
    //     // train_chart.height = document.getElementById("model_graph_pane").offsetHeight;
    //     train_chart.style.height = new_height + 'px';
    //     // console.log('model_graph_plane size:', document.getElementById("model_graph_pane").offsetWidth, document.getElementById("model_graph_pane").offsetHeight)
    // }
})

ipcRenderer.on('write_data_to_xterm_yolo', function (event, arg) {
    // 写入数据arg到终端中
    xterm_yolo.write(arg);
});

ipcRenderer.on('update_progress_bar', function (event, arg) {
    //进度条效果更新
    let num = (arg[0] / arg[1]) * 100
    let div = document.getElementById('progress_bar_value_yolo')
    div.style.width = num + '%'
});

ipcRenderer.on('update_progress_bar_epoch', function (event, arg) {
    //设定每代进度条的长度
    let num = (arg[0] / arg[1]) * 100
    let div = document.getElementById('progress_bar_epoch_value_yolo')
    div.style.width = num + '%'
});

document.getElementById('train_history_dir_yolo').addEventListener('click', function () {
    //按钮按下时发送“更新训练记录”的指令
    ipcRenderer.send('update_train_history_list', '')
});

document.getElementById('make_sense_tool_button').addEventListener('click', function () {
    //按钮按下时发送“打开make_sense工具”的指令
    ipcRenderer.send('open_make_sense')
});

document.getElementById('test_model_button').addEventListener('click', function () {
    //按钮按下时进行模型测试
    //获取前端的测试图片路径
    let test_dir = document.getElementById('test_img_dir_yolo').value
    //当前模型的训练资料路径
    let dir = `${process.cwd()}/trainOutput/${current_tab_dir}`
    test_model(dir, test_dir)
    //更新测试结果到详情窗口中
    ipcRenderer.send('update_test_result_yolo', current_tab_dir)
});

ipcRenderer.on('update_train_history', function (event, arg) {
    //更新并显示训练记录
    let html = ''
    console.log(arg)

    for (let d of arg) {
        try {
            let name = d['name'].split('_')[0]
            let year = d['name'].split('_')[1]
            let time = d['name'].split('_')[2].replace('-', ':').replace('-', ':')
            if (name == 'yolo') {
                if (d['train_result'] == "success") {
                    html += '<div class="alert filelist alert-' + d['train_result'] + '" role="alert"><button type="button" class="btn btn-primary btn-sm" onclick=open_model_detail("' + d['name'] + '")>' + current_locales.target_detection + '</button><a>' + year + ' ' + time + '</a> <button type="button" class="btn-close" aria-label="Close" onclick="del_dir(\'' + d['name'] + '\')"></button></div>'
                }
                else {
                    html += '<div class="alert filelist alert-' + d['train_result'] + '" role="alert"><button type="button" class="btn btn-primary btn-sm" onclick=open_model_detail_err("' + d['name'] + '")>' + current_locales.target_detection + '</button><a>' + year + ' ' + time + '</a> <button type="button" class="btn-close" aria-label="Close" onclick="del_dir(\'' + d['name'] + '\')"></button></div>'
                }
            }
        } catch (error) {
            console.log("An error occurred while processing the data from "+ d["name"] +":", error);
        }
    }

    document.getElementById('train_history_list_yolo').innerHTML = html
});

function open_dir(dir) {
    //向主进程发送打开dir路径文件夹指令
    ipcRenderer.send('open_dir', dir)
    console.log('open_dir: ', dir)
}

function del_dir(dir) {
    //向主进程发送删除dir路径模型训练结果文件夹指令
    ipcRenderer.send('del_dir', dir)
}

ipcRenderer.on('show_del_file_succeed', function (event, arg) {
    //提示删除文件夹成功
    Notiflix.Notify.success(current_locales.del_succeed + arg);
    //更新训练记录列表
    ipcRenderer.send('update_train_history_list', '')
});


document.getElementById('start_train_yolo').addEventListener('click', function () {
    //按下按钮后开始进行训练
    if (train_situation_yolo == false) {
        ipcRenderer.send('send_data_terminal_yolo', 'cls\r'); //清空终端信息
        //获取前端的训练超参数
        let img = document.getElementById('dataset_dir_yolo').value
        let xml = document.getElementById('train_xml_dir_yolo').value
        let epoch = document.getElementById('epoch_yolo').value
        let t = document.getElementById("alpha_yolo");
        let alpha = t.options[t.selectedIndex].value;
        let batch_size = document.getElementById("batch_size_yolo").value
        //判断是否有选择训练集路径
        if (img.length == 0) {
            Notiflix.Notify.warning(current_locales.plz_select_img_dir);
        }
        else if (xml.length == 0) {
            Notiflix.Notify.warning(current_locales.plz_select_xml_dir);
        }
        else {
            fitAddon_yolo.fit()
            //开始训练
            const command = `& "${pythonExec}" "${trainScript}" -t detector -di "${img}" -dx "${xml}" -ep ${epoch} -ap ${alpha} -bz ${batch_size} train\r`;
            ipcRenderer.send('send_data_terminal_yolo', command)
            //设定开始训练状态为进行中
            train_situation_yolo = true
            //将状况图标切换成加载图标
            document.getElementById('training_situation_yolo').innerHTML = '<i class="fa fa-spinner fa-spin" style="color:#069b34"></i>'
        }
    }
    else {
        //如果在训练中，那么不发出训练指令而是发出警告
        Notiflix.Notify.warning(current_locales.train_started_warn);
    }
})

document.getElementById('stop_train_yolo').addEventListener('click', function () {
    //按下按钮后进行停止训练操作并更新状态，如果没有训练的话就显示没有训练中的警告
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
    //收到主进程发出的训练成功信息，进行信息提醒并且更新状态
    train_situation_yolo = false
    Notiflix.Report.success(current_locales.train_success, current_locales.train_success_to_dir_look_result, current_locales.confirm)
    document.getElementById('training_situation_yolo').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
});

ipcRenderer.on('show_test_succeed', function (event, arg) {
    //收到主进程发出的测试成功信息，进行信息提醒并且更新状态
    //更新测试结果到详情窗口中
    ipcRenderer.send('update_test_result_yolo', current_tab_dir)
    train_situation_yolo = false
    Notiflix.Report.success(current_locales.test_succeed, current_locales.test_succeed_to_test_model_result_look_result, current_locales.confirm)
    document.getElementById('training_situation_yolo').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
    document.getElementById('test_situation_yolo').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
});


ipcRenderer.on('show_train_failed', function (event, arg) {
    //收到主进程发出的训练错误信息，进行信息提醒并且更新状态
    train_situation_yolo = false
    Notiflix.Report.failure(current_locales.train_failed, current_locales.train_failed_check_terminal, current_locales.confirm)
    document.getElementById('training_situation_yolo').innerHTML = "<i class='fa fa-check' style='color:#069b34'></i>"
    let div = document.getElementById('progress_bar_value_yolo')
    div.style.width = '0%'
    let divs = document.getElementById('progress_bar_epoch_value_yolo')
    divs.style.width = '0%'
});

//加载脚本时使用本地数据更新一次前端数据
ipcRenderer.send('config', '')
ipcRenderer.on('config', function (event, arg) {
    //收到主进程消息后进行参数数据更新
    console.log(arg)
    document.getElementById('dataset_dir_yolo').value = arg['yolo_img']
    document.getElementById('train_xml_dir_yolo').value = arg['yolo_xml']
    document.getElementById('epoch_yolo').value = arg['yolo_epoch']
    document.getElementById('batch_size_yolo').value = arg['yolo_batch_size']
    document.getElementById('alpha_yolo').options[arg['yolo_alpha']].selected = true
    document.getElementById('data_aug_yolo').options[arg['yolo_data_aug']].selected = true
});

//----在前端超参数数据改变时更新本地数据----
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



//实例化并定义模型详情窗口属性
const myModal = new bootstrap.Modal('#model_info_tab_window', {
    keyboard: false
})

const myerrModal = new bootstrap.Modal('#model_info_tab_window_err', {
    keyboard: false
})

function open_model_detail(dir) {
    //打开模型详情窗口
    //将按钮要打开的路径更新到html的按钮中
    var button = document.getElementById("open_model_file");
    current_tab_dir = dir
    if (button) {
        // console.log("更新了模型文件夹路径到按钮'open_model_file'中");
        button.onclick = function () {
            open_dir(dir);
        };
    }
    var button = document.getElementById("export_model_file");
    if (button) {
        // console.log("更新了模型文件夹路径到按钮'export_model_file'中");
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
    //测试模型
    if (train_situation_yolo == false) {
        //判断测试路径是否有图片
        if (test_dir.length == 0) {
            Notiflix.Notify.warning(current_locales.plz_select_test_img_dir);
        }
        else {
            ipcRenderer.send('send_data_terminal_yolo', 'cls\r'); //清空终端信息
            ipcRenderer.send('clean_file', `${dir}/test`); //清空存放以前测试图片的文件
            fitAddon_yolo.fit()
            //开始测试图片
            const command = `& "${pythonExec}" "${testScript}" --dir "${dir}" --img_dir "${test_dir}"\r`;
            ipcRenderer.send('send_data_terminal_yolo', command)
            //设定状态为进行中
            train_situation_yolo = true
            //将状态图标设为加载图标
            document.getElementById('test_situation_yolo').innerHTML = '<i class="fa fa-spinner fa-spin" style="color:#069b34"></i>'
        }
    }
    else {
        //如果在运行中，那么不发出指令而是发出警告
        Notiflix.Notify.warning(current_locales.train_started_warn);
    }
}

ipcRenderer.on('update_model_param', function (event, arg) {
    //接收到主进程信息后进行模型详情的数据更新
    data = JSON.parse(arg)
    let modal_type = current_locales.cls
    if (data['type'] == "detector") {
        modal_type = current_locales.target_detection
    }
    document.getElementById("model_type").innerHTML = modal_type
    document.getElementById("model_alpha").innerHTML = data['alpha']
    document.getElementById("model_epoch").innerHTML = data['epochs']
    document.getElementById("model_batchsize").innerHTML = data['batch_size']
});

ipcRenderer.on('update_model_labels', function (event, arg) {
    //接收到主进程信息后进行模型详情的标签更新
    document.getElementById("model_label").innerHTML = arg
});

ipcRenderer.on('update_model_anchors', function (event, arg) {
    //接收到主进程信息后进行模型详情的标签更新
    document.getElementById("model_anchors").innerHTML = arg
});

ipcRenderer.on('update_model_train_log', function (event, arg) {
    var reg = new RegExp("\r\n", "g");
    document.getElementById('train_log').innerHTML = arg[0].replaceAll(reg, '<br/>');
    // console.log(arg)
});


ipcRenderer.on('update_model_train_graph', function (event, arg) {
    //获取当前模型的训练图表并更新到详情窗口中
    var model_graph_chart = echarts.init(document.getElementById('echarts'));
    let data = JSON.parse(arg)
    console.log(data)
    model_graph_chart.setOption({
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
            data: Array.from({ length: data['loss'].length }, (v, i) => i)
        },
        yAxis: {
            show: true,
            axisLine: { show: true },
            axisTick: { show: true },
            splitLine: { show: true },
        },
        series: [
            {
                data: data['loss'],
                name: current_locales.test_loss,
                type: 'line',
                smooth: true
            },
            {
                data: data['val_loss'],
                name: current_locales.val_loss,
                type: 'line',
                smooth: true
            }
        ]
    }, true);
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
});

ipcRenderer.on('update_model_train_log_err', function (event, arg) {
    var reg = new RegExp("\r\n", "g");
    document.getElementById('train_log_err').innerHTML = arg[0].replaceAll(reg, '<br/>');
    // console.log(arg)
});

ipcRenderer.on('show_test_result_img', function (event, arg) {
    //接收主进程的图片目录信息，并动态生成 HTML 来展示这些图片
    let html = ''
    let data = arg
    console.log(data)
    let imgPath = data['dir']
    imgPath = path.normalize(imgPath)
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

