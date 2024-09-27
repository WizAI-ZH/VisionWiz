//用于保存不同进程、窗口之间沟通使用到的函数
/*
目前窗口：
Wizhome
dataCollect
objectDetection
imgCls
*/

// 版权所有 (C) [2024] [珠海威智人工智能有限公司]  
// 根据GPLv3或更高版本的条款进行许可  
// 请参阅LICENSE文件以获取详细信息

//发送信息到对应窗口
function sendMessageToView(mainWindowViews, viewName, channel, ...args) {  
    const view = mainWindowViews[viewName];  
    if (view) {  
        view.webContents.send(channel, ...args);  
    } else {  
        console.error(`View ${viewName} not found. channel ${channel}, args ${args}`);  
    }  
}  

function sendMessageToAllViews(mainWindowViews, channel, ...args) {  
    for (const viewName in mainWindowViews) {  
        if (mainWindowViews.hasOwnProperty(viewName)) {  
            const view = mainWindowViews[viewName];  
            if (view) {  
                view.webContents.send(channel, ...args);  
            }  
        }  
    }  
} 


module.exports = { sendMessageToView, sendMessageToAllViews }