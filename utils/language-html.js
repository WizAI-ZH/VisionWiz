// 版权所有 (C) [2024] [珠海威智人工智能有限公司]  
// 根据GPLv3或更高版本的条款进行许可  
// 请参阅LICENSE文件以获取详细信息

// 处理html的语言本地化
const languageManager = require('../utils/language-manager')
let current_locales

// 初始化页面语言  
async function initializeLanguage() {  
    try {  
        const language = await window.app.getLanguage();  
        const languageData = await window.app.loadLanguageFile(language);  
        applyLanguage(languageData);  
        current_locales = languageData
        languageManager.updateLocales(language); //更新locales内容
    } catch (error) {  
        console.error("Error occurred:", error);  
    }  
}  

function applyLanguage(languageData) {  
    // 更新 DOM 元素的文本  
    Object.keys(languageData).forEach(key => {  
        const element = document.getElementById(key.replace('_tooltip', ''));  
        if (element) {  
            // 检查是否有匹配的 tooltip 键  
            if (key.endsWith('_tooltip')) {  
                element.setAttribute('title', languageData[key]);  
                
            } else {  
                // 如果元素支持 textContent，更新它  
                if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {  
                    // 对于表单元素，必要时更新 placeholder  
                    element.placeholder = languageData[key];  
                } else {  
                    element.textContent = languageData[key];  
                }  
            }  
        } else {  
            // console.warn(`缺少 HTML 元素对应的键: ${key}`);  
        }  
    });  
}


// 监听语言变更事件  
window.app.onChangeLanguage(async(language) => {  
    try {  
        await window.app.setLanguage(language);  
        console.log('onChangeLanguage',language)
        const languageData = await window.app.loadLanguageFile(language);  
        applyLanguage(languageData);  
        current_locales = languageData
        languageManager.updateLocales(language); //更新locales内容
    } catch (error) {  
        console.error("发生错误:", error);  
    }  
});  

window.onload = initializeLanguage;