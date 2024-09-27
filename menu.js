const { Menu } = require('electron');
let currentLanguage
let currentView

//菜单本地化数据翻译
const languages = {
    en: {
        menu: {
            language: "Language",
            english: "English",
            chinese_simple: "Chinese(simplified)",
            chinese_traditional: "Chinese(traditional)",
            main_page: 'Main Page',
            image_collection: 'Image Collect',
            object_detection: 'Object Detection',
            image_classification: 'Image Classification',
            tool_set: 'Tookkit',
        },
        title: 'VisionWiz V1.0'
    },
    zh: {
        menu: {
            language: "语言",
            english: "英语",
            chinese_simple: "中文简体",
            chinese_traditional: "中文繁體",
            main_page: '主页',
            image_collection: '图像采集',
            object_detection: '目标检测',
            image_classification: '图像分类',
            tool_set: '工具集',
        },
        title: '威智慧眼V1.0'
    },
    zht: {
        menu: {
            language: "語言",
            english: "英語",
            chinese_simple: "中文簡體",
            chinese_traditional: "中文繁體",
            main_page: '主頁',
            image_collection: '圖像採集',
            object_detection: '目標檢測',
            image_classification: '圖像分類',
            tool_set: '工具集',
        },
        title: '威智慧眼V1.0'
    }
};

const { sendMessageToAllViews, sendMessageToView } = require('./utils/ipc_commu')

function changeLanguage(language, browserWindow, views) {
    console.log('changeLanguage to', language)
    currentLanguage = language
    console.log('currentLanguage', language)
    const menu = Menu.buildFromTemplate(menuTemplate(browserWindow, views));
    Menu.setApplicationMenu(menu);
    // 发送语言更改事件到所有子窗口中  
    sendMessageToAllViews(views, 'change-language', language);
}


function switchView(mainWindow, views, viewName) {
    console.log(views)
    if (views[viewName]) {
        mainWindow.setBrowserView(views[viewName]);
        currentView = viewName;
        views[viewName].setBounds({ x: 0, y: 0, width: mainWindow.getBounds().width, height: mainWindow.getBounds().height });
        views[viewName].webContents.openDevTools({ mode: 'detach' })
    }
}

function getCurrentView() {
    return currentView;
}
// 动态生成菜单模板函数  
const menuTemplate = (browserWindow, views) => [
    {
        label: languages[currentLanguage].menu.main_page,
        click: () => switchView(browserWindow, views, 'Wizhome')
    },
    {
        label: languages[currentLanguage].menu.language,
        submenu: [
            {
                label: languages[currentLanguage].menu.english,
                click: () => {
                    changeLanguage('en', browserWindow, views)
                    browserWindow.setTitle(languages[currentLanguage].title)
                }
            },
            {
                label: languages[currentLanguage].menu.chinese_simple,
                click: () => {
                    changeLanguage('zh', browserWindow, views)
                    browserWindow.setTitle(languages[currentLanguage].title)
                }
            },
            {
                label: languages[currentLanguage].menu.chinese_traditional,
                click: () => {
                    changeLanguage('zht', browserWindow, views)
                    browserWindow.setTitle(languages[currentLanguage].title)
                }
            }
        ]
    },
    {
        label: languages[currentLanguage].menu.image_collection,
        click: () => switchView(browserWindow, views, 'dataCollect')
    },
    {
        label: languages[currentLanguage].menu.object_detection,
        click: () => switchView(browserWindow, views, 'objectDetection')
    },
    {
        label: languages[currentLanguage].menu.image_classification,
        click: () => switchView(browserWindow, views, 'imgCls')
    }
];

// 创建和设置菜单函数  
function setAppMenu(browserWindow, views, language) {
    currentLanguage = language
    browserWindow.setTitle(languages[currentLanguage].title)
    currentView = 'Wizhome'
    const menu = Menu.buildFromTemplate(menuTemplate(browserWindow, views));
    Menu.setApplicationMenu(menu);
}

module.exports = { setAppMenu, getCurrentView };