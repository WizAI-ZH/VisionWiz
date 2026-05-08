// preload.js
// 版权所有 (C) [2024] [珠海威智人工智能有限公司]
// 根据 GPLv3 或更高版本条款进行许可
// 请参阅 LICENSE 文件获取详细信息

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
      const element = document.getElementById(selector)
      if (element) element.innerText = text
    }

    for (const dependency of ['chrome', 'node', 'electron']) {
      replaceText(`${dependency}-version`, process.versions[dependency])
    }
})

const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

function stripBom(text) {
  return typeof text === 'string' ? text.replace(/^\uFEFF/, '') : text;
}

window.app = {
  getLanguage: () => ipcRenderer.invoke('get-language'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppMeta: () => ipcRenderer.invoke('get-app-meta'),
  onLoadingAppMeta: (callback) => ipcRenderer.on('loading-app-meta', (_event, payload) => callback(payload)),
  setLanguage: (language) => ipcRenderer.invoke('set-language', language),
  loadLanguageFile: async (language) => {
    try {
      const filePath = path.join(__dirname, `locales/${language}.json`);
      const data = stripBom(fs.readFileSync(filePath, 'utf8'));
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading language file:', error);
      return {};
    }
  },
  onChangeLanguage: (callback) => ipcRenderer.on('change-language', (_event, language) => callback(language)),
  sendToMain: (channel, data) => {
    ipcRenderer.send(channel, data);
  }
};
