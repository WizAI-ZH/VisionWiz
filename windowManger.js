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
      nodeIntegration: true, 
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
    },  
  });  

  // 加载 make-sense 的 index.html 
  makeSenseWindow.loadFile(path.join(__dirname,'tools', 'make-sense-'+language , 'index.html'));  
  // makeSenseWindow.loadFile(path.join(__dirname, 'make-sense','dist' , 'index.html'));  
  // makeSenseWindow.webContents.openDevTools({ mode: 'detach' })
}  

module.exports = {createMakeSenseWindow};