let delay;
let current_locales_local;

async function init_current_locales_local() {
  try {
    current_locales_local = await ipcRenderer.invoke('get-current-locales');
    console.log('locales:', current_locales_local);
    // 后续初始化逻辑...
  } catch (e) {
    console.error('获取语言库失败:', e);
  }
}

init_current_locales_local();

// const { ipcRenderer } = require('electron');
try {
    delay = ms => new Promise(r => setTimeout(r, ms));
}
catch (e) {
    console.log(e);
}
Notiflix.Notify.init({
    position: 'left-top',
    showOnlyTheLastOne: true,
    clickToClose: true,
});
Notiflix.Report.init({})

let camold = '';
document.getElementById('cam_list').innerHTML = '<li><a class="dropdown-item" href="#">' + 'No Cams' + '</a></li>';

const getVideoList = () => {
    let cams = '';
    navigator.mediaDevices.enumerateDevices()
        .then(function (devices) {
            devices.forEach(function (device) {
                if (device.kind == 'videoinput') {
                    cams += '<li><a class="dropdown-item" href="#" onclick="opencam(\'' + device.deviceId + '\',\'' + device.label + '\')">' + device.label + '</a></li>';
                }
            });

            if (cams.length == 0) {
                cams = '<li><a id="camera_not_found" class="dropdown-item" href="#">' + current_locales_local.camera_not_found + '</a></li>';
                document.getElementById('cam_list').innerHTML = cams;
            }
            if (camold != cams) {
                camold = cams;
                cams += '<li><a id="disconnect_camera" class="dropdown-item" href="#" onclick="stopcam()">' + current_locales_local.disconnect_camera + '</a></li>';
                document.getElementById('cam_list').innerHTML = cams;
            }
        });
};

let MediaStream;
let zt = false;

function opencam(id, name) {
    this.dialogTakePhotoShow = true;
    let video = navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: id } } })  // 更正为 deviceId  
        .then(success => {
            document.getElementById('video').srcObject = success;
            document.getElementById('video').play();
            document.getElementById('cbtn').innerHTML = name;
            document.getElementById("cbtn").classList.replace("btn-danger", "btn-success");
            MediaStream = success.getTracks()[0];
            zt = true;
            Notiflix.Notify.success(current_locales_local.camera_opened);
        })
        .catch(error => {
            console.log(error);
            Notiflix.Notify.warning(current_locales_local.camera_open_failed);
            console.error('摄像头开启失败，请检查摄像头是否可用！');
        });
}

async function startcam() {
    // 延迟 1 秒后执行 getVideoList，确保设备已准备好  
    await delay(1000).then(() => getVideoList());
}

function stopcam() {
    if (MediaStream) {
        MediaStream.stop();
    }
    document.getElementById('cbtn').innerHTML = current_locales_local.connect_camera;
    document.getElementById("cbtn").classList.replace("btn-success", "btn-danger");
    Notiflix.Notify.success(current_locales_local.camera_disconnected);
    zt = false;
}


/**
 * 使用异步轮询的方式等待 current_locales_local 变量就绪，
 * 并在就绪后初始化应用。
 * 这种方式不会阻塞页面加载。
 */
function waitForDataAndInitialize() {
    // 检查全局的 current_locales_local 是否已经被主进程注入
    // (这里不需要用 window.current_locales_local, 直接用 current_locales_local 即可)
    if (typeof current_locales_local !== 'undefined' && current_locales_local !== null) {
        // 数据已就绪！
        startcam(); // 启动摄像头列表获取
    } else {
        // 数据还没到，安排一个短暂的延时后再次调用自己进行检查。
        // 这会将下一次检查任务推迟到事件队列的末尾，
        // 让出主线程去处理其他任务（比如接收和处理主进程发来的数据）。
        console.log('[RENDERER] 语言库未就绪，100ms后重试...');
        setTimeout(waitForDataAndInitialize, 100); // 100毫秒是一个合适的重试间隔
    }
}

ipcRenderer.on('change-language', async (event, language) => {
    console.log('[RENDERER] 语言变更通知，重新加载语言库:', language);
    current_locales_local = await ipcRenderer.invoke('get-current-locales');
    console.log(current_locales_local)
})

waitForDataAndInitialize(); // 启动等待和初始化过程