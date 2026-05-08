// windowManager.js
// 原始软件版权所有者 (C) [2019] [Piotr Skalski]
// 版权所有者 (C) [2024] [珠海威智人工智能有限公司]
// 根据 GPLv3 或更高版本的条款进行许可
// 请参阅 LICENSE 文件以获取详细信息

const { BrowserWindow } = require('electron');
const path = require('path');

const titlename = {
  en: 'Make-Sense',
  zh: '慧标',
  zht: '慧標',
};

function createMakeSenseWindow(language) {
  // 创建 make-sense 窗口
  const makeSenseWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icons', 'make-sense-ico.png'),
    title: titlename[language],
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload_loader.js'),
    },
  });

  // 彻底隐藏菜单栏，避免单独按 Alt 时弹出
  makeSenseWindow.setMenuBarVisibility(false);
  makeSenseWindow.setAutoHideMenuBar(true);

  // 只拦截单独按下 Alt，不影响 Alt + 其他键的组合快捷键
  makeSenseWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Alt' && input.type === 'keyDown') {
      event.preventDefault();
    }
  });

  // 加载 make-sense 对应语言页面
  makeSenseWindow.loadFile(path.join(__dirname, 'tools', `make-sense-${language}`, 'index.html'));

  // makeSenseWindow.webContents.openDevTools({ mode: 'detach' });
}

module.exports = { createMakeSenseWindow };
