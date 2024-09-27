//基础事件管理，比如加载画面、打开新窗口等
const oBtn = document.getElementById('btn');
if (oBtn){  
    oBtn.addEventListener('click', () => {  
        window.app.sendToMain('open-new-window', null);  
    });  
}

const { ipcRenderer } = require('electron');  

ipcRenderer.on('navigate', (event, page) => {  
    console.log(`Navigating to: ${page}`); // 调试输出  
    const webview = document.getElementById('content');  
    webview.src = page;  
});  