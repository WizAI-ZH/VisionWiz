const { SerialPort } = require('serialport')  
const { validateKey } = require('./cryptoService.js')  
const { ipcMain } = require('electron')  
const os = require('os')
const { ReadlineParser } = require('@serialport/parser-readline') // 新增解析器包  

// CH340标准配置  
const CH340_CONFIG = {  
  baudRate: 115200,  
  dataBits: 8,  
  stopBits: 1,  
  parity: 'none',  
  autoOpen: false  
}  


async function checkWindowsDriver() {  
  const { execSync } = require('child_process')  
  try {  
    const output = execSync('pnputil /enum-devices /class "Ports"')  
    return output.includes('CH340')  
  } catch {  
    return false  
  }  
} 

let currentPort = null  

// 初始化设备列表  
exports.initSerialManager = async () => {
  if(os.platform() === 'win32') {  
    const driverInstalled = await checkWindowsDriver()  
    if(!driverInstalled) {  
      console.error('CH340驱动未安装')  
      throw new Error('请先安装CH340驱动程序')  
    }  
  }
  const allPorts = await SerialPort.list()  
  console.log('所有检测到设备:', allPorts.map(p => `${p.path} [${p.vendorId}:${p.productId}]`))  
  
  const ch340Ports = allPorts.filter(p =>   
    p.vendorId === '1A86' && ['7523', '5523'].includes(p.productId)  
  )  
  
  console.log('过滤后CH340设备:', ch340Ports)  
  return ch340Ports
}  

// 连接设备  
exports.connectPort = async (path) => {
  currentPort = new SerialPort({ path, ...CH340_CONFIG })
  const crlfDelimiter = Buffer.from([0x0D, 0x0A]) // 明确的CRLF字节序列 
  const delimiter = '\r\n' // 或从配置读取
  console.log('crlfDelimiter Type:', typeof crlfDelimiter)  
  console.log('crlfDelimiter Length:', crlfDelimiter.length)   
  // 配置数据解析器  
  const parser = currentPort.pipe(new ReadlineParser({  
    delimiter: crlfDelimiter,                // 直接使用CRLF字符串  
    encoding: 'hex',                     // 保持hex编码  
    includeDelimiter: false
  }))  

  // 数据接收处理  
  parser.on('data', async data => {  
    console.log('Received:', data)  
    if (await validateKey(data)) {  
      ipcMain.emit('auth-success')  
    }  
  })  

  // 错误处理  
  currentPort.on('error', err => console.error('Port error:', err))  
  
  return new Promise((resolve, reject) => {  
    currentPort.open(err => err ? reject(err) : resolve())  
  })  
} 