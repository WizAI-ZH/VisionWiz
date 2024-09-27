// language-manager.js  
// 版权所有 (C) [2024] [珠海威智人工智能有限公司]  
// 根据GPLv3或更高版本的条款进行许可  
// 请参阅LICENSE文件以获取详细信息

const fs = require('fs');  
const path = require('path');   
let locales = {}; // 存储当前语言的文本  

function loadLocale(language) {  
    const localePath = path.join('locales', `${language}.json`);  
    try {  
        const data = fs.readFileSync(localePath, 'utf8');  
        locales = JSON.parse(data);  
    } catch (err) {  
        console.error(`Error loading locale file: ${err}`);  
    }  
}  

function updateLocales(language) {  
    loadLocale(language);  
}  

function getLocales() {  
    return locales;  
}  

module.exports = {  
    updateLocales,  
    getLocales
};