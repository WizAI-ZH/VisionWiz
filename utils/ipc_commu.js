// 用于保存不同进程、窗口之间通信会用到的函数
/*
当前窗口名称：
Wizhome
dataCollect
objectDetection
imgCls
*/

// 版权所有者 (C) [2024] [珠海威智人工智能有限公司]
// 根据 GPLv3 或更高版本的条款进行许可
// 请参阅 LICENSE 文件以获取详细信息

// 向指定窗口发送消息
function sendMessageToView(mainWindowViews, viewName, channel, ...args) {
  const view = mainWindowViews[viewName];
  if (view) {
    view.webContents.send(channel, ...args);
  } else {
    console.error(`View ${viewName} not found. channel ${channel}, args ${args}`);
  }
}

// 向全部窗口广播消息
function sendMessageToAllViews(mainWindowViews, channel, ...args) {
  for (const viewName in mainWindowViews) {
    if (Object.prototype.hasOwnProperty.call(mainWindowViews, viewName)) {
      const view = mainWindowViews[viewName];
      if (view) {
        view.webContents.send(channel, ...args);
      }
    }
  }
}

module.exports = { sendMessageToView, sendMessageToAllViews };
