// preload.js
// 版权所有 (C) [2024] [珠海威智人工智能有限公司]  
// 根据GPLv3或更高版本的条款进行许可  
// 请参阅LICENSE文件以获取详细信息
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
      const element = document.getElementById(selector)
      if (element) element.innerText = text
    }
  
    for (const dependency of ['chrome', 'node', 'electron']) {
      replaceText(`${dependency}-version`, process.versions[dependency])
    }
  })

const { contextBridge,ipcRenderer } = require('electron');  
const fs = require('fs');  
const path = require('path');  
// 设置你需要的全局变量  
const globalSettings = {
  language: 'zh',  
  theme: 'dark'
};

// 设置你需要的全局变量  
window.app = {  
  // 获取当前语言  
  getLanguage: () => ipcRenderer.invoke('get-language'),  

  // 更新语言  
  setLanguage: (language) => ipcRenderer.invoke('set-language', language),  

  // 加载语言文件  
  loadLanguageFile: async (language) => {  
    try {  
      const filePath = path.join(__dirname, `locales/${language}.json`);  
      const data = fs.readFileSync(filePath, 'utf8');  
      return JSON.parse(data);  
    } catch (error) {  
      console.error('Error loading language file:', error);  
      return null;  
    }  
  },  
  onChangeLanguage: (callback) => ipcRenderer.on('change-language', (event, language) => callback(language)),  
  sendGetState: () => ipcRenderer.send('get-state'),  
  onStateData: (callback) => ipcRenderer.on('state-data', (event, stateData) => callback(stateData)),  
  startTask: (taskData) => ipcRenderer.send('task-start', taskData),  
  sendToMain: (channel, data) => {  
    // 在这里可以同样加入安全检查  
    ipcRenderer.send(channel, data);  
  }
}; 