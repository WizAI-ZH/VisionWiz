const { ipcRenderer } = require('electron');
const path = require('path');

document.getElementById("btn_open_mini_led_editor").onclick = function(){
    //向主进程main.js发送消息,确定要打开LED控制程序
    ipcRenderer.send('open_tool', 'miniLEDdisplay_adv/BmpBadge');
}

document.getElementById("btn_open_wiz_resizer").onclick = function(){
    //向主进程main.js发送消息,确定要打开威智图改
    ipcRenderer.send('open_tool', 'WizResizer');
}

document.getElementById('btn_open_make_sense').addEventListener('click', function () {
    //按钮按下时发送“打开make_sense工具”的指令
    ipcRenderer.send('open_make_sense')
});

document.getElementById('btn_open_learn_make_sense').addEventListener('click', function () {
    //按钮按下时发送“打开make_sense教程网页”的指令
    ipcRenderer.send('open_website','https://vesibit.yuque.com/ednd8n/rp34u1/zebgq4p81pu6vftt')
});
