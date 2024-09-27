//功能菜单相关事件监听

try {  
    const { ipcRenderer } = require('electron');  
} catch (err) {  
    console.error("Error importing ipcRenderer:", err.message);  
}  

// 监听导航信号  
ipcRenderer.on('navigate', (event, htmlFile) => {  
    window.location.href = `./feature/${htmlFile}`;  
}); 