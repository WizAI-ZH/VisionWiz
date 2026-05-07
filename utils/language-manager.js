// language-manager.js
// 版权所有 (C) [2024] [珠海威智人工智能有限公司]
// 根据 GPLv3 或更高版本条款进行许可
// 请参阅 LICENSE 文件获取详细信息

const fs = require('fs');
const path = require('path');

let locales = {};
console.log('language-manager loaded');

function stripBom(text) {
    return typeof text === 'string' ? text.replace(/^\uFEFF/, '') : text;
}

function loadLocale(language) {
    const localePath = path.join(__dirname, '..', 'locales', `${language}.json`);

    try {
        const data = stripBom(fs.readFileSync(localePath, 'utf8'));
        locales = JSON.parse(data);
    } catch (err) {
        console.error(`Error loading locale file: ${err}`);
        locales = {};
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
    getLocales,
};
