const { ipcRenderer } = require('electron');
try {
    const path = require('path');
} catch (error) {
    console.warning('Error loading path module:', error);
}
let mini_led_editor_path
let wiz_resizer_path
ipcRenderer.send('get_app_path', 'toolSet');

ipcRenderer.on('get_app_path_reply', (event, appPath) => {
    // 获取 python.exe 和 train.py 的路径  
    mini_led_editor_path = path.join(appPath, 'tools', 'miniLEDdisplay_adv', 'BmpBadge.exe');
    wiz_resizer_path = path.join(appPath, 'tools', 'WizResizer.exe');
});

document.getElementById("btn_open_mini_led_editor").onclick = function () {
    //向主进程main.js发送消息,确定要打开LED控制程序
    ipcRenderer.send('open_tool', mini_led_editor_path);
}


document.getElementById("btn_open_wiz_resizer").onclick = function () {
    //向主进程main.js发送消息,确定要打开威智图改

    ipcRenderer.send('open_tool', wiz_resizer_path);
}

ipcRenderer.on("reply_open_tool", (event, toolpath) => {
    // 获取打开路径并在控制台显示路径
    console.log("Tool path: ", toolpath)
});

document.getElementById('btn_open_make_sense').addEventListener('click', function () {
    //按钮按下时发送“打开make_sense工具”的指令
    ipcRenderer.send('open_make_sense')
});

document.getElementById('btn_open_learn_make_sense').addEventListener('click', function () {
    //按钮按下时发送“打开make_sense教程网页”的指令
    ipcRenderer.send('open_website', 'https://vesibit.yuque.com/ednd8n/rp34u1/zebgq4p81pu6vftt')
});
