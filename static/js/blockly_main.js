Notiflix.Notify.init({  
    position: 'left-top',  
    showOnlyTheLastOne: true,  
    clickToClose: true,  
});  
Notiflix.Report.init({})  

let camold = '';  
document.getElementById('cam_list').innerHTML = '<li><a class="dropdown-item" href="#">没有发现摄像头</a></li>';  

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
                cams = '<li><a class="dropdown-item" href="#">没有发现摄像头</a></li>';  
                document.getElementById('cam_list').innerHTML = cams;  
            }  
            if (camold != cams) {  
                camold = cams;  
                cams += '<li><a id="disconnect_camera" class="dropdown-item" href="#" onclick="stopcam()">断开摄像头</a></li>';  
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
            Notiflix.Notify.success('摄像头已打开。');  
        })  
        .catch(error => {  
            console.log(error);  
            Notiflix.Notify.warning('摄像头开启失败，请检查摄像头是否可用！');  
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
    document.getElementById('cbtn').innerHTML = '连接摄像头';  
    document.getElementById("cbtn").classList.replace("btn-success", "btn-danger");  
    Notiflix.Notify.success('摄像头已断开。');  
    zt = false;  
}  

getVideoList();  
startcam();