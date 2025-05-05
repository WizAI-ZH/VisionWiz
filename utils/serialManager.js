const { SerialPort } = require('serialport');  
const { ipcMain }    = require('electron');  
const os             = require('os');  
const AuthService    = require('./cryptoService.js');  
const delay = ms => new Promise(r => setTimeout(r, ms));  

let currentAuth = null;  

/* ---------- CH340 端口列表 ---------- */  
async function refreshPortList() {  
  const all = await SerialPort.list();  
  // console.log(all);
  return all.filter(p => p.vendorId === '1A86' && ['7523', '5523'].includes(p.productId));  
}  


/* ---------- 复位：拉低 DTR 50 ms，再拉高 ---------- */
async function hardwareReset(path) {  
  const temp = new SerialPort({ path, baudRate: 115200, autoOpen: false });  
  await new Promise((res, rej) => temp.open(err => err ? rej(err) : res()));  
  await temp.set({ dtr: false, rts: true });  // 拉低 (多见于 K210+CH340)  
  await delay(50);  
  await temp.set({ dtr: true });  
  await delay(1200);                           // 给固件一点启动时间  
  await new Promise(res => temp.close(res));  
}

/* ========== 初始化串口监视器 ========== */  
exports.initSerialManager = async () => {  
  return refreshPortList();  
};  

exports.connectPort = async path => {  
  try {  
    console.log('[RST] hardware reset');  
    await hardwareReset(path);  

    currentAuth = new AuthService();  
    await currentAuth.connectPort(path);  

    /* ★ 等待 sendChallenge 结束才返回 ★ */  
    await currentAuth.sendChallenge()  
      .then(res => {  
        console.log('auth-success! ')
        ipcMain.emit('auth-success', { deviceId: res.deviceId });  
      })  
      .catch(err => {  
        console.log('auth-fail! ')
        console.log('error: ' + err.message)
        ipcMain.emit('auth-failure', { error: err.message }); 
        throw err;                       // 让外层 catch 触发 disconnect  
      });  
    return true;                         // 成功才返回 true  
  } catch (err) { 
    // exports.disconnectPort();  
    throw err;                           // 让 UI 层看到失败  
  }  
};  

exports.disconnectPort = () => {  
  if (currentAuth) {  
    currentAuth.cleanup();  
    currentAuth = null;  
  }  
  ipcMain.emit('disconnected', { status: 'disconnected' });  
}; 

/* ---------- IPC 主动断开 ---------- */  
ipcMain.handle('disconnect-port', () => exports.disconnectPort());  