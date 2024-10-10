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
                Notiflix.Notify.success(current_locales.captureSuccess);
            } else {
                Notiflix.Notify.warning(current_locales.selectPath);
            }
        } else {
            Notiflix.Notify.warning(current_locales.enterClassName);
        }
    } else {
        Notiflix.Notify.warning(current_locales.openCamera);
    }
}

function handleHistoryClick() {
    let path = document.getElementById('sender').value;
    if (path.length == 0) {
        let html = `<div>${current_locales.noFiles}</div>`;
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
    document.getElementById('imgModalLabel').innerHTML = `${current_locales.captureRecord} ( ${arg.length} ${current_locales.img_num} )`
    if (arg.length == 0) {
        //如果路径内没有图片，则加上没有的图片的
        let noFilesText  = `<div>${current_locales.noFiles}</div>`; 
        document.getElementById('imglist').innerHTML += noFilesText; 
    }
    else{
    for (let f of arg) {
        //路径不为空，则逐一将拍摄的图片展示在拍摄记录窗口中
        html += '<div style="display: flex;flex-direction: column;align-items: center;"><img src="' + path + '/' + f + '" style="width:140px" class="rounded float-start" alt="' + f + '"><p>' + f + '</p></div>'
    }
    html += "</div>"
    document.getElementById('imglist').innerHTML = html
    }
});

//加载脚本时使用本地数据更新一次前端数据
ipcRenderer.send('config','')
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

var preview = new Preview({
    //建立预览图对象
    imgWrap: 'wrap' // 指定该容器里的图片点击预览
})