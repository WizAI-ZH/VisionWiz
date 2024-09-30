Notiflix.Notify.init({  
    position: 'left-top',  
    showOnlyTheLastOne: true,  
    clickToClose: true,  
});  
Notiflix.Report.init({})  

let camold = '';  
document.getElementById('cam_list').innerHTML = '<li><a class="dropdown-item" href="#">'+'No Cams'+'</a></li>';  

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
                cams = '<li><a id="camera_not_found" class="dropdown-item" href="#">'+current_locales.camera_not_found+'</a></li>';  
                document.getElementById('cam_list').innerHTML = cams;  
            }  
            if (camold != cams) {  
                camold = cams;  
                cams += '<li><a id="disconnect_camera" class="dropdown-item" href="#" onclick="stopcam()">'+current_locales.disconnect_camera+'</a></li>';  
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
            Notiflix.Notify.success(current_locales.camera_opened);  
        })  
        .catch(error => {  
            console.log(error);  
            Notiflix.Notify.warning(current_locales.camera_open_failed);  
            console.error('摄像头开启失败，请检查摄像头是否可用！');  
        });  
}  

function startcam() {  
    // 延迟 1 秒后执行 getVideoList，确保设备已准备好  
    setTimeout(getVideoList, 1000);  
}  

function stopcam() {  
    if (MediaStream) {  
        MediaStream.stop();  
    }  
    document.getElementById('cbtn').innerHTML = current_locales.connect_camera;  
    document.getElementById("cbtn").classList.replace("btn-success", "btn-danger");  
    Notiflix.Notify.success(current_locales.camera_disconnected);  
    zt = false;  
}  
 
startcam();