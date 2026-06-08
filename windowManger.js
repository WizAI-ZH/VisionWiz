const { BrowserWindow, Menu } = require('electron');
const path = require('path');

const makeSenseTitles = {
  en: 'Make-Sense',
  zh: '\u6167\u6807',
  zht: '\u6167\u6a19',
};

function normalizeMakeSenseLanguage(language) {
  const languageMap = {
    en: 'en',
    english: 'en',
    zh: 'zh',
    cn: 'zh',
    'zh-cn': 'zh',
    zh_cn: 'zh',
    zhs: 'zh',
    zht: 'zht',
    tw: 'zht',
    'zh-tw': 'zht',
    zh_tw: 'zht',
  };
  return languageMap[String(language || 'zh').toLowerCase()] || 'zh';
}

function createMakeSenseWindow(language) {
  const normalizedLanguage = normalizeMakeSenseLanguage(language);
  const makeSensePath = path.join(__dirname, 'tools', `make-sense-${normalizedLanguage}`, 'index.html');

  const makeSenseWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icons', 'make-sense-ico.png'),
    title: makeSenseTitles[normalizedLanguage],
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload_loader.js'),
    },
  });

  makeSenseWindow.setMenuBarVisibility(false);
  makeSenseWindow.setAutoHideMenuBar(true);

  makeSenseWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[MAKE-SENSE] did-fail-load:', {
      language,
      normalizedLanguage,
      makeSensePath,
      errorCode,
      errorDescription,
      validatedURL,
    });
  });

  makeSenseWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log('[MAKE-SENSE console]', { level, message, line, sourceId });
  });

  makeSenseWindow.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([
      {
        label: '\u6253\u5f00\u5f00\u53d1\u8005\u5de5\u5177 / Open DevTools',
        click: () => makeSenseWindow.webContents.openDevTools({ mode: 'detach' }),
      },
    ]).popup({ window: makeSenseWindow });
  });

  makeSenseWindow.webContents.on('before-input-event', (event, input) => {
    const key = String(input.key || '').toLowerCase();
    const shouldOpenDevTools =
      input.type === 'keyDown' &&
      (key === 'f12' ||
        (input.control && input.shift && key === 'i') ||
        (input.meta && input.alt && key === 'i'));

    if (shouldOpenDevTools) {
      event.preventDefault();
      makeSenseWindow.webContents.openDevTools({ mode: 'detach' });
      return;
    }

    if (input.key === 'Alt' && input.type === 'keyDown') {
      event.preventDefault();
    }
  });

  console.log('[MAKE-SENSE] loading:', { language, normalizedLanguage, makeSensePath });
  makeSenseWindow.loadFile(makeSensePath);
}

module.exports = { createMakeSenseWindow };
