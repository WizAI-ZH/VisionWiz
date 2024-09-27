// make-sense-preload.js  
const { contextBridge, ipcRenderer } = require('electron');  

// 如果需要暴露特定的 API 给 make-sense  
contextBridge.exposeInMainWorld('electronAPI', {  
  // 示例：发送消息给主进程  
  sendMessage: (channel, data) => {  
    const validChannels = ['save-data', 'load-data']; // 定义允许的通道  
    if (validChannels.includes(channel)) {  
      ipcRenderer.send(channel, data);  
    }  
  },  
  
  // 示例：接收主进程的消息  
  onMessage: (channel, callback) => {  
    const validChannels = ['reply-data'];  
    if (validChannels.includes(channel)) {  
      ipcRenderer.on(channel, (event, data) => callback(data));  
    }  
  },  
});