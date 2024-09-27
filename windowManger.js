// windowManager.js  
// make-sense软件原始版权所有 (C) [2019] [Piotr Skalski]  
// 版权所有 (C) [2024] [珠海威智人工智能有限公司]  
// 根据GPLv3或更高版本的条款进行许可  
// 请参阅LICENSE文件以获取详细信息

const { BrowserWindow, ipcMain } = require('electron');  
const path = require('path');  

function createMakeSenseWindow(language) {  
  // 创建 make-sense 窗口  
  const makeSenseWindow = new BrowserWindow({  
    width: 1200,  
    height: 800,  
    autoHideMenuBar: true,
    webPreferences: {  
      nodeIntegration: false, // 禁用 Node.js 集成  
      contextIsolation: true, // 启用上下文隔离  
      preload: path.join(__dirname, 'make-sense-preload.js'), // 预加载脚本
    },  
  });  

  // 加载 make-sense 的 index.html 
  makeSenseWindow.loadFile(path.join(__dirname,'tools', 'make-sense-'+language , 'index.html'));  
  // 可选：打开开发者工具  
  makeSenseWindow.webContents.openDevTools({ mode: 'detach' })
}  

module.exports = {createMakeSenseWindow};