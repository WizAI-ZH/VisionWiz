// 原始版权所有 (C) [2020] [Sipeed]
// 版权所有 (C) [2024] [珠海威智人工智能有限公司]
// 根据GPLv3或更高版本的条款进行许可
// 请参阅LICENSE文件以获取详细信息
// main.js
console.log('[MAIN] marker', new Date().toISOString());
const VisionWiz_version = "V1.2.5";
// process.on('uncaughtException', e => console.error('[FATAL] uncaughtException:', e));
// process.on('unhandledRejection', r => console.error('[FATAL] unhandledRejection:', r));
const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  dialog,
  globalShortcut,
} = require("electron");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const dns = require("dns");
const process = require("process");
const image = require("imageinfo");
const Store = require("electron-store");
const {
  sendMessageToView,
  sendMessageToAllViews,
} = require("./utils_protected/ipc_commu_loader");
const {
  findFilesWithSubstring,
  delDirRecurse,
  delDirContents,
} = require("./utils_protected/file_process_loader");
console.log('[MAIN] before language-manager');
const languageManager = require("./utils_protected/language-manager_loader")
console.log('[MAIN] after language-manager');
const path_utils = require("./utils_protected/path_utils_loader")
const { initSerialManager, connectPort } = require("./utils_protected/serialManager_loader");
console.log('[MAIN] after serialManager');
console.log('[MAIN] before cryptoservice');
const { validateKey } = require("./cryptoservice_critical_loader");
console.log('[MAIN] after cryptoservice');
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline"); // 新增解析器包

//判断是否打包
if (app.isPackaged) {
  process.env.NODE_ENV = "production";
} else {
  process.env.NODE_ENV = "development";
}

// 设备热插拔监听
SerialPort.list().then((initialPorts) => {
  let lastPorts = initialPorts;

  setInterval(async () => {
    const currentPorts = await SerialPort.list();
    if (currentPorts.length !== lastPorts.length) {
      ipcMain.emit("port-list-updated");
      lastPorts = currentPorts;
    }
  }, 2000); // 每2秒检测一次
});


// 本地数据
let current_locales;
let store;
let config_store = {};

async function initStoreAfterReady() {
  console.log('[STORE] init - before app.whenReady()');
  return app.whenReady().then(() => {
    console.log('[STORE] init - app ready');
    let userDataPath;
    try {
      console.log('[STORE] before app.getPath(userData)');
      userDataPath = app.getPath('userData');
      console.log('[STORE] userDataPath =', userDataPath);
    } catch (e) {
      console.error('[STORE] app.getPath("userData") failed:', e);
    }

    try {
      console.log('[STORE] before new Store()');
      store = new Store({
        cwd: userDataPath,
        name: 'settings'
      });
      console.log('[STORE] new Store OK, file =', store.path);
    } catch (e) {
      console.error('[STORE] new Store failed:', e);
      // 兜底：如果配置可能损坏，先尝试备份并重建
      try {
        const p = path.join(userDataPath || '', 'settings.json');
        if (fs.existsSync(p)) {
          fs.renameSync(p, p + '.bak-' + Date.now());
          console.warn('[STORE] corrupted config backed up:', p);
        }
        store = new Store({
          cwd: userDataPath,
          name: 'settings'
        });
        console.log('[STORE] new Store OK after reset, file =', store.path);
      } catch (e2) {
        console.error('[STORE] new Store still failed after reset:', e2);
      }
    }
  });
}

async function bootstrap() {
  console.log('[BOOTSTRAP] start');
  await initStoreAfterReady();
  console.log('[BOOTSTRAP] store init done');

  const cfg = read_config();
  languageManager.updateLocales(get_store_value("current_lang") || "zh");
  current_locales = languageManager.getLocales();
  console.log('[BOOTSTRAP] read_config done');
}
console.log('Start Store Setup')

let cmd = process.platform === "win32" ? "tasklist" : "ps aux";
const rex = new RegExp("pattern");
const setupWindowManager = require("./windowmanger_loader");
const { setAppMenu, getCurrentView } = require("./menu_loader");

let childWindow;
let mainWindow;
let mainWindow_views = {};



const createWindow = () => {
  childWindow = new BrowserWindow({
    frame: false,
    transparent: true,
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"),
  });
  // Create the browser window.
  mainWindow = new BrowserWindow({
    x: 0,
    y: 0,
    // fullscreen: true,
    maximize: true,
    resizable: true,
    transparent: false, // 是否透明
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true, // 是否显示窗口边框
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  childWindow.loadFile("loading.html");
  // 加载 所有窗口，之后显示主页html内容
  mainWindow_views["Wizhome"] = new BrowserView({
    resizable: true,
    transparent: false,
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow_views["dataCollect"] = new BrowserView({
    resizable: true,
    transparent: false,
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow_views["objectDetection"] = new BrowserView({
    resizable: true,
    transparent: false,
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow_views["imgCls"] = new BrowserView({
    resizable: true,
    transparent: false,
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow_views["toolSet"] = new BrowserView({
    resizable: true,
    transparent: false,
    show: false,
    autoHideMenuBar: false,
    title: "威智慧眼" + VisionWiz_version, //程序窗口名字
    icon: path.join(__dirname, "icons", "visionwiz_logo.ico"), //程序的图标
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload_loader.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // mainWindow.addBrowserView(mainWindow_views['Wizhome']);
  // mainWindow_views['Wizhome'].setBounds({ x: 0, y: 0, width: 800, height: 600 });

  // 加载不同的页面到不同的 BrowserView
  const loadViews = async () => {
    try {
      await Promise.all([
        loadHtmlWithOnlineCheck(
          "Wizhome",
          "https://vesibit.yuque.com/r/organizations/homepage",
          "./feature/offline.html"
        ),
        loadFileWithFallback("dataCollect", "./feature/data-collection.html"),
        loadFileWithFallback(
          "objectDetection",
          "./feature/target-detection.html"
        ),
        loadFileWithFallback("imgCls", "./feature/image-classification.html"),
        loadFileWithFallback("toolSet", "./feature/tool-set.html"),
      ]);
    } catch (err) {
      console.error("Error loading views:", err);
    }
  };

  const checkInternetConnection = () => {
    return new Promise((resolve) => {
      dns.resolve("www.google.com", (err) => {
        resolve(!err); // Resolve true if no error, false otherwise
      });
    });
  };

  const loadHtmlWithOnlineCheck = async (
    viewName,
    urlLink,
    offlineFilePath
  ) => {
    // 根据网络情况加载主页
    const isOnline = await checkInternetConnection();
    console.log(`isOnline = ${isOnline}`);
    if (isOnline) {
      try {
        mainWindow_views[viewName].webContents.loadURL(urlLink);
        console.log(`${viewName} loaded`);
      } catch (err) {
        console.error(`Failed to load ${viewName}:`, err);
      }
    } else {
      console.log("Network unavailable, loading Offline.");
      loadFileWithFallback(viewName, offlineFilePath);
    }
  };

  const loadFileWithFallback = (viewName, filePath) => {
    // mainWindow.addBrowserView(mainWindow_views[viewName]);
    // mainWindow_views[viewName].setBounds({ x: 0, y: 0, width: mainWindow.getBounds().width, height: mainWindow.getBounds().height });
    // mainWindow_views[viewName].webContents.openDevTools({ mode: 'detach' })
    //加载页面并返回回应消息
    return mainWindow_views[viewName].webContents
      .loadFile(path.join(__dirname, filePath))
      .then(() => {
        console.log(`${viewName} loaded from file`);
      })
      .catch((err) => {
        console.error(`Failed to load ${viewName} from file:`, err);
      });
  };

  loadViews().then(() => {
    console.log("All views loaded");
    mainWindow.addBrowserView(mainWindow_views["Wizhome"]);
    mainWindow_views["Wizhome"].setBounds({
      x: 0,
      y: 0,
      width: mainWindow.getBounds().width,
      height: mainWindow.getBounds().height,
    });
    // mainWindow_views['Wizhome'].webContents.openDevTools({ mode: 'detach' })

    childWindow.destroy();
    mainWindow.show();
  });



  // mainWindow.loadFile('mainpage.html')
  childWindow.show();
  console.log('setAppMenu')
  // 设置应用菜单，并传递主窗口的引用
  setAppMenu(
    mainWindow,
    mainWindow_views,
    get_store_value("current_lang") || "zh"
  );
  console.log("finished setAppMenu");

  // mainWindow.once("ready-to-show", () => {
  //   mainWindow.maximize();
  // });

  mainWindow.webContents.on("close", () => {
    console.log("8--->this window is closed");
    mainWindow = null;
  });

  const handleResize = () => {
    const [width, height] = mainWindow.getSize();
    // console.log('resize to width:',width,'height:',height)
    mainWindow_views[getCurrentView()].setBounds({ x: 0, y: 0, width, height });
    // 发送消息到 BrowserView
    sendMessageToAllViews(mainWindow_views, "window-resize", { width, height });
  };

  //主窗口事件处理
  mainWindow.on("resize", handleResize);
  mainWindow.on("maximize", handleResize);
  mainWindow.on("unmaximize", handleResize);

  // 打开开发工具
  // mainWindow.webContents.openDevTools()
};

function createAuthWindow() {
  authWindow = new BrowserWindow({
    width: 500,
    height: 350,
    parent: mainWindow,       // ← 关键：指定父窗  
    modal: true,             // ← 关键：Modal
    autoHideMenuBar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "authpreload.js"),
      backgroundThrottling: false
    },
  });
  authWindow.loadFile("auth.html");
  authWindow.setMenuBarVisibility(false);        // 阻断 Ctrl+W / Alt 键菜单
  authWindow.openDevTools({ mode: "detach" });

  authWindow.on('close', e => {
    app.quit();
  });

  authWindow.webContents.on('render-process-gone', (_e, details) => { // ★★  
    console.warn('[SEC] auth renderer gone:', details);
    app.quit();                      // ★★ 立即退出  
  });
}

// IPC 事件处理
ipcMain.handle("get-language", () => {
  return get_store_value("current_lang") || "zh";
});

ipcMain.handle("get-current-locales", () => {
  console.log('[MAIN] get-current-locales invoked');
  return current_locales;
});

ipcMain.handle("set-language", async (event, language) => {
  try {
    console.log(`[MAIN] set-language requested: ${language}`);
    set_store_value("current_lang", language);
    languageManager.updateLocales(language);
    current_locales = languageManager.getLocales();
  } catch (error) {
    console.error("Error occurred:", error);
  }
  // 可以在此添加更新UI的逻辑, 比如发送事件让窗口刷新语言
});

// 处理端口列表请求
ipcMain.handle("get-ports", () => initSerialManager());

// 处理连接请求
ipcMain.handle("connect-port", (_, path) => connectPort(path));

function afterAuthSuccess() {
  if (authWindow) {
    authWindow.webContents.send("auth-success", "");
    setTimeout(() => {
      authWindow.hide();
    }, 1000);
  }
  if (mainWindow) mainWindow.setEnabled(true);
}

// 这段程序将会在 Electron 结束初始化
// 和创建浏览器窗口的时候调用
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(async () => {
  await bootstrap();
  createWindow();
  createAuthWindow();
  initSerialManager();
  globalShortcut.register("Control+Shift+I", () => {
    try {
      mainWindow_views[getCurrentView()].webContents.openDevTools({
        mode: "detach",
      });
    } catch {
      console.log("Main window not found or not loaded.");
    }
  });
  globalShortcut.register("F5", () => {
    try {
      var current_view = getCurrentView();
      if (current_view == "Wizhome") {
        mainWindow_views[current_view].webContents.reload();
      }
    } catch {
      console.log("Main pages not loaded.");
    }
  });
  // app.on('activate', () => {
  //   // 在 macOS 系统内, 如果没有已开启的应用窗口
  //   // 点击托盘图标时通常会重新创建一个新窗口
  //   if (BrowserWindow.getAllWindows().length === 0) createWindow()
  // })
});

// 除了 macOS 外，当所有窗口都被关闭的时候退出程序。 因此, 通常
// 对应用程序和它们的菜单栏来说应该时刻保持激活状态,
// 直到用户使用 Cmd + Q 明确退出
app.on("window-all-closed", () => {
  console.log("9---->window-all-closed");
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  console.log("10--->before quit");
});

app.on("will-quit", () => {
  console.log("11--->will quit");
  globalShortcut.unregisterAll();
});

function timeout(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms, "done");
  });
}

ipcMain.on("auth-success", afterAuthSuccess);
ipcMain.on("auth-failure", (arg) => {
  if (authWindow) {
    console.log('[AUTH] failure:', arg.error);
    authWindow.webContents.send("auth-failure", arg.error);
    authWindow.focus();
  }
})
ipcMain.on("disconnected", () => {
  if (mainWindow) mainWindow.setEnabled(false);
  if (authWindow) {
    authWindow.webContents.send("disconnected");
    authWindow.show();
    authWindow.focus();
  }
});

//使用系统默认图片查看器打开图片
ipcMain.on("open_image", (event, imagePath) => {
  const fullPath = path.normalize(imagePath);
  console.log(fullPath);
  exec(`start "" "${fullPath}"`, (error) => {
    if (error) {
      console.error("Error opening image:", error);
    }
  });
});

ipcMain.on("open_tool", function (event, arg) {
  const toolPath = path.resolve(__dirname, "tools", arg); // 转换为绝对路径
  const toolDir = path.dirname(toolPath); // 获取工具所在目录
  console.log("Tool Path:", toolPath);

  // 启动子进程
  const childSpawn = spawn(toolPath, [], {
    cwd: toolDir, // 设置工作目录
  });

  // 捕获错误
  childSpawn.on("error", (err) => {
    console.error("Failed to start process:", err);
  });

  sendMessageToView(mainWindow_views, "toolSet", "reply_open_tool", toolPath);
});

//获取当前app根目录
ipcMain.on("get_app_path", (event, viewName) => {
  // event.reply('get_app_path_reply', path_utils.getAppResourcePath('.', 'resources'));
  sendMessageToView(
    mainWindow_views,
    viewName,
    "get_app_path_reply",
    path_utils.getAppResourcePath(".", "resources")
  );
  console.log(viewName, "reply finished");
});

//以下是工具调用相关进程函数
ipcMain.on("open_website", (event, arg) => {
  if (!arg || typeof arg !== "string") {
    console.error("Invalid URL:", arg);
    return;
  }

  console.log("Opening website:", arg);

  // 根据操作系统选择命令
  const platform = process.platform;
  let command;

  if (platform === "win32") {
    // Windows 使用 'start'
    command = "start";
  } else if (platform === "darwin") {
    // macOS 使用 'open'
    command = "open";
  } else {
    // Linux 使用 'xdg-open'
    command = "xdg-open";
  }

  // 使用 spawn 调用系统命令
  const child = spawn(command, [arg], { shell: true });

  // 捕获错误
  child.on("error", (err) => {
    console.error("Failed to open website:", err);
  });

  child.on("close", (code) => {
    console.log(`Child process exited with code ${code}`);
  });
});

ipcMain.on("open_make_sense", () => {
  //打开make-sense软件，并且设定make-sense语言
  setupWindowManager.createMakeSenseWindow(get_store_value("current_lang"));
});

ipcMain.on("openfile", function (event, arg) {
  //打开窗口选择要保存拍摄图片的文件夹
  dialog
    .showOpenDialog({
      title: current_locales.choose_save_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("save-dir", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

ipcMain.on("open_dataset_dir_yolo", function (event, arg) {
  //打开窗口选择目标检测数据集目录
  dialog
    .showOpenDialog({
      title: current_locales.choose_dataset_save_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("update_dataset_dir_yolo", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

ipcMain.on("open_train_xml_dir_yolo", function (event, arg) {
  //收到窗口信息后打开窗口选择目标检测标签集的路径
  dialog
    .showOpenDialog({
      title: current_locales.choose_dataset_xml_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("update_xml_dir_yolo", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

ipcMain.on("open_test_img_dir_yolo", function (event, arg) {
  //收到窗口信息后打开窗口选择目标检测测试集的路径
  dialog
    .showOpenDialog({
      title: current_locales.choose_dataset_xml_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("update_test_img_dir_yolo", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

ipcMain.on("open_dataset_dir_cls", function (event, arg) {
  //收到窗口信息后打开窗口选择图像分类训练集的路径
  dialog
    .showOpenDialog({
      title: current_locales.choose_cls_dataset_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("update_dataset_dir_cls", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

ipcMain.on("open_test_img_dir_cls", function (event, arg) {
  //收到窗口信息后打开窗口选择图像分类测试集的路径
  dialog
    .showOpenDialog({
      title: current_locales.choose_cls_testset_path,
      properties: ["openDirectory"],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log(result.filePaths);
        event.sender.send("update_test_img_dir_cls", result.filePaths);
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

let paths = "";
ipcMain.on("imgbase64", function (event, arg) {
  let base64 = arg.replace(/^data:image\/\w+;base64,/, "");
  let dataBuffer = Buffer(base64, "base64");
  // 利用nodejs的fs文件系统功能进行保存图片，需要先将base64头去掉
  fs.writeFile(paths, dataBuffer, (err) => {
    if (err) {
      event.sender.send("imgsavemsgerr", err);
    } else {
      event.sender.send("imgsavemsgok", current_locales.save_succeed);
    }
  });
});

ipcMain.on("savedir", function (event, arg) {
  paths = arg;
});

let pty;
if (app.isPackaged) {
  // pty = require(path.resolve(process.cwd(),'resources','app.asar.unpacked', 'node_modules', 'node-pty'))
  pty = require(path.resolve(__dirname, "node_modules", "node-pty"));
} else {
  // pty = require(path.resolve(__dirname,'node_modules','node-pty'));
  pty = require(path.resolve(__dirname, "node_modules", "node-pty"));
}
const { main } = require("@popperjs/core");
const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
const ptyProcess_yolo = pty.spawn(shell, [], {
  name: "xterm-color",
  cols: 500,
  rows: 20,
  cwd: process.env.PWD,
  env: process.env,
});

const ptyProcess_cls = pty.spawn(shell, [], {
  name: "xterm_cls",
  cols: 500,
  rows: 20,
  cwd: process.env.PWD,
  env: process.env,
});

ipcMain.on("send_data_terminal_yolo", function (event, arg) {
  //输入信息到目标检测控制台中
  ptyProcess_yolo.write(arg);
});

ipcMain.on("send_data_terminal_cls", function (event, arg) {
  //输入信息到图像分类控制台中
  ptyProcess_cls.write(arg);
});

ptyProcess_cls.onData((data) => {
  var pattern = /Epoch [0-9.]+[/][0-9.]+/;
  var patterns = /[0-9.]+[/][0-9.]+/g;
  if (pattern.test(data)) {
    if (data.length > 1) {
      let num1 = data.split(" ")[1].split("/")[0];
      let num2 = data.split(" ")[1].split("/")[1];
      sendMessageToView(mainWindow_views, "imgCls", "update_progress_bar", [
        num1,
        num2,
      ]);
    }
  }
  if (patterns.test(data)) {
    let nums1 = data.match(patterns)[0].split(" ")[0].split("/")[0];
    let nums2 = data.match(patterns)[0].split(" ")[0].split("/")[1];
    sendMessageToView(mainWindow_views, "imgCls", "update_progress_bar_epoch", [
      nums1,
      nums2,
    ]);
  }
  if (data.indexOf("Training and testing success") != -1) {
    sendMessageToView(mainWindow_views, "imgCls", "show_train_succeed");
  }
  if (data.indexOf("Test succeed!") != -1) {
    sendMessageToView(mainWindow_views, "imgCls", "show_test_succeed");
  }
  if (data.indexOf("训练错误:") != -1) {
    sendMessageToView(mainWindow_views, "imgCls", "show_train_failed", data);
  }
  sendMessageToView(
    mainWindow_views,
    "imgCls",
    "write_data_to_xterm_cls",
    data
  );
});

ptyProcess_yolo.onData((data) => {
  var pattern = /Epoch [0-9.]+[/][0-9.]+/;
  var patterns = /[0-9.]+[/][0-9.]+/g;
  if (pattern.test(data)) {
    if (data.length > 1) {
      let num1 = data.split(" ")[1].split("/")[0];
      let num2 = data.split(" ")[1].split("/")[1];
      sendMessageToView(
        mainWindow_views,
        "objectDetection",
        "update_progress_bar",
        [num1, num2]
      );
    }
  }
  if (patterns.test(data)) {
    let nums1 = data.match(patterns)[0].split(" ")[0].split("/")[0];
    let nums2 = data.match(patterns)[0].split(" ")[0].split("/")[1];
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "update_progress_bar_epoch",
      [nums1, nums2]
    );
  }
  if (data.indexOf("Training and testing success") != -1) {
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "show_train_succeed"
    );
  }
  if (data.indexOf("Test succeed!") != -1) {
    sendMessageToView(mainWindow_views, "objectDetection", "show_test_succeed");
  }
  if (data.indexOf("训练错误:") != -1) {
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "show_train_failed",
      data
    );
  }
  sendMessageToView(
    mainWindow_views,
    "objectDetection",
    "write_data_to_xterm_yolo",
    data
  );
});

ipcMain.on("stop_process", function (event, arg) {
  let qqname = "python";
  exec(cmd, function (err, stdout, stderr) {
    if (err) {
      return console.log(err);
    }
    let ok = stdout.split("\n");
    ok.some(function (line) {
      let p = line.trim().split(/\s+/),
        pname = p[0],
        pid = p[1];
      if (pname.toLowerCase().indexOf(qqname) >= 0 && parseInt(pid)) {
        try {
          process.kill(pid, "SIGTERM");
        } catch (e) {
          console.log(e);
        }
      }
    });
  });
});

ipcMain.on("update_train_history_list", function (event, arg) {
  const outDir = path.join(process.cwd(), "trainOutput");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  //读取并更新训练记录列表
  fs.readdir("trainOutput", function (err, stats) {
    const flist = new Array();

    for (f of stats) {
      //如果文件夹中有success文件，则代码训练成功并且训练成功
      let checkDir = fs.existsSync("trainOutput/" + f + "/success");
      if (checkDir) {
        op = { name: f, train_result: "success" };
      } else {
        op = { name: f, train_result: "danger" };
      }
      flist.push(op);
    }
    sendMessageToView(
      mainWindow_views,
      "imgCls",
      "update_train_history",
      flist
    );
    sendMessageToView(
      mainWindow_views,
      "objectDetection",
      "update_train_history",
      flist
    );
  });
});

ipcMain.on("open_dir", function (event, arg) {
  const dirPath = path.join(process.cwd(), "trainOutput", arg);
  // 检查目录是否存在
  fs.access(dirPath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error("Directory does not exist:", dirPath);
      return;
    }
    // 使用 exec 打开目录
    exec(`explorer.exe "${dirPath}"`, (error) => {
      if (error) {
        console.error("Error opening directory:", error);
      }
    });
  });
});

ipcMain.on("del_dir", function (event, arg) {
  //收到删除文件夹指令后进行文件夹及其内部所有内容的删除
  delDirRecurse(process.cwd() + "/trainOutput/" + arg);
  //更新删除后的记录列表
  sendMessageToView(
    mainWindow_views,
    "imgCls",
    "show_del_file_succeed",
    process.cwd() + "/trainOutput/" + arg
  );
  sendMessageToView(
    mainWindow_views,
    "objectDetection",
    "show_del_file_succeed",
    process.cwd() + "/trainOutput/" + arg
  );
});

ipcMain.on("clean_file", function (event, dir) {
  //删除dir目录内的所有内容
  delDirContents(dir);
});

ipcMain.on("readimgdir", function (event, arg) {
  //向dataCollect窗口发送读取文件夹指令
  let img_list = read_img_dir(arg);
  sendMessageToView(mainWindow_views, "dataCollect", "readimgdir", img_list);
});

ipcMain.on("update_test_result_cls", function (event, current_tab_dir) {
  //更新测试结果到详情窗口中
  let baseDir = process.cwd();
  let dir = `trainOutput/${current_tab_dir}`;
  let imgList = read_img_dir(`${dir}/test`);
  sendMessageToView(mainWindow_views, "imgCls", "show_test_result_img", {
    dir: `${baseDir}/${dir}/test`,
    list: imgList,
  });
});

ipcMain.on("update_test_result_yolo", function (event, current_tab_dir) {
  //更新测试结果到详情窗口中
  let baseDir = process.cwd();
  let dir = `trainOutput/${current_tab_dir}`;
  let imgList = read_img_dir(`${dir}/test`);
  sendMessageToView(
    mainWindow_views,
    "objectDetection",
    "show_test_result_img",
    { dir: `${baseDir}/${dir}/test`, list: imgList }
  );
});

function read_img_dir(path) {
  let imageList = [];
  getFileList(path).forEach((item) => {
    let ms = image(fs.readFileSync(item.path + "/" + item.filename));
    ms.mimeType && imageList.push(item.filename);
  });
  console.log(imageList);
  return imageList;
}

function getFileList(path) {
  let filesList = [];
  readFileList(path, filesList);
  return filesList;
}

function readFileList(path, filesList) {
  let files = fs.readdirSync(path);
  files.forEach(function (itm, index) {
    let stat = fs.statSync(path + "/" + itm);
    if (stat.isDirectory()) {
      //递归读取文件
      readFileList(path + itm + "/", filesList);
    } else {
      let obj = {}; //定义一个对象存放文件的路径和名字
      obj.path = path; //路径
      obj.filename = itm; //名字
      filesList.push(obj);
    }
  });
}

function set_store_value(name, root) {
  //设定指定本地数据的储存值
  store.set(name, root);
}

function get_store_value(name) {
  //获取指定本地数据的储存值
  return store.get(name);
}

// function read_config() {
//   let config = {
//     save_img: get_store_value("save_img") || "",
//     save_img_name: get_store_value("save_img_name") || "",
//     yolo_img: get_store_value("yolo_img") || "",
//     yolo_xml: get_store_value("yolo_xml") || "",
//     yolo_epoch: get_store_value("yolo_epoch") || 25,
//     yolo_alpha: get_store_value("yolo_alpha") || 0,
//     yolo_batch_size: get_store_value("yolo_batch_size") || 8,
//     yolo_data_aug: get_store_value("yolo_data_aug") || 0,
//     cls_img: get_store_value("cls_img") || "",
//     cls_epoch: get_store_value("cls_epoch") || 25,
//     cls_alpha: get_store_value("cls_alpha") || 0,
//     cls_batch_size: get_store_value("cls_batch_size") || 8,
//     cls_data_aug: get_store_value("cls_data_aug") || 0,
//     test_img_dir_cls: get_store_value("test_img_dir_cls") || "",
//     test_img_dir_yolo: get_store_value("test_img_dir_yolo") || "",
//     current_lang: get_store_value("current_lang") || "zh",
//   };
// }

function read_config() {
  console.log('[CFG] read_config start');

  function safeGet(key, def) {
    // console.log(`[CFG] get "${key}" - start`);
    try {
      const v = get_store_value(key);
      // console.log(`[CFG] get "${key}" - end`);
      return (v === undefined || v === null || v === '') ? def : v;
    } catch (e) {
      console.error(`[CFG] get "${key}" failed:`, e);
      return def;
    }
  }

  config_store = {
    save_img: safeGet("save_img", ""),
    save_img_name: safeGet("save_img_name", ""),
    yolo_img: safeGet("yolo_img", ""),
    yolo_xml: safeGet("yolo_xml", ""),
    yolo_epoch: safeGet("yolo_epoch", 25),
    yolo_alpha: safeGet("yolo_alpha", 0),
    yolo_batch_size: safeGet("yolo_batch_size", 8),
    yolo_data_aug: safeGet("yolo_data_aug", 0),
    cls_img: safeGet("cls_img", ""),
    cls_epoch: safeGet("cls_epoch", 25),
    cls_alpha: safeGet("cls_alpha", 0),
    cls_batch_size: safeGet("cls_batch_size", 8),
    cls_data_aug: safeGet("cls_data_aug", 0),
    test_img_dir_cls: safeGet("test_img_dir_cls", ""),
    test_img_dir_yolo: safeGet("test_img_dir_yolo", ""),
    current_lang: safeGet("current_lang", "zh"),
  };
  console.log('[CFG] config ready');
  return config_store;
}

ipcMain.on("config", function (event, arg) {
  //用本地数据初始化所有页面的参数数值
  console.log('[ipcMain] read: "config"')
  console.log('[CFG] read_config request', arg);
  let result = read_config();
  sendMessageToAllViews(mainWindow_views, "config", result);
});


ipcMain.on("config_save_img_name", function (event, arg) {
  //接收到通信信息后进行拍摄保存图片文的更新
  set_store_value("save_img_name", arg);
});

ipcMain.on("config_save_img", function (event, arg) {
  //接收到通信信息后进行拍摄图片存放目录的文件夹路的更新
  set_store_value("save_img", arg);
});

ipcMain.on("config_cls_img", function (event, arg) {
  set_store_value("cls_img", arg);
});

ipcMain.on("config_yolo_img", function (event, arg) {
  set_store_value("yolo_img", arg);
});

ipcMain.on("config_epoch_cls", function (event, arg) {
  set_store_value("cls_epoch", arg);
});

ipcMain.on("config_yolo_xml", function (event, arg) {
  set_store_value("yolo_xml", arg);
});

ipcMain.on("config_epoch_yolo", function (event, arg) {
  set_store_value("yolo_epoch", arg);
});

ipcMain.on("config_alpha_cls", function (event, arg) {
  set_store_value("cls_alpha", arg);
});

ipcMain.on("config_alpha_yolo", function (event, arg) {
  set_store_value("yolo_alpha", arg);
});

ipcMain.on("config_batch_size_cls", function (event, arg) {
  set_store_value("cls_batch_size", arg);
});

ipcMain.on("config_batch_size_yolo", function (event, arg) {
  set_store_value("yolo_batch_size", arg);
});

ipcMain.on("config_test_img_dir_cls", function (event, arg) {
  set_store_value("test_img_dir_cls", arg);
});

ipcMain.on("config_test_img_dir_yolo", function (event, arg) {
  set_store_value("test_img_dir_yolo", arg);
});

ipcMain.on("config_data_aug_cls", function (event, arg) {
  set_store_value("cls_data_aug", arg);
});

ipcMain.on("config_data_aug_yolo", function (event, arg) {
  set_store_value("yolo_data_aug", arg);
});

ipcMain.on("read_model_detail_and_show", function (event, arg) {
  //读取并显示当前选择的模型训练详情
  const dir = `trainOutput/${arg}`;
  const modelInfoPath = `${dir}/info.json`;
  const trainLogPath = `${dir}/train_log.log`;
  const baseDir = process.cwd();

  // Helper function to read file and handle errors
  const readFileWithHandling = (path, callback) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        console.error(`Error reading file at ${path}:`, err);
        return;
      }
      callback(data);
    });
  };

  readFileWithHandling(modelInfoPath, (data) => {
    const modelInfo = JSON.parse(data);
    const isClassifier = modelInfo["type"] === "classifier";
    const resultDir = `${dir}/result_root_dir/${isClassifier ? "classifier_result" : "detector_result"
      }`;
    const viewChannel = isClassifier ? "imgCls" : "objectDetection";
    const labelFileName = findFilesWithSubstring(resultDir, "labels.txt");
    // 更新模型信息到详情窗口
    sendMessageToView(mainWindow_views, viewChannel, "update_model_param", [
      data,
    ]);

    const labelsFilePath = `${resultDir}/${labelFileName}`;
    readFileWithHandling(labelsFilePath, (labelData) => {
      sendMessageToView(mainWindow_views, viewChannel, "update_model_labels", [
        labelData,
      ]);
    });

    if (!isClassifier) {
      //如果模型是目标检测，则再读取anchors参数
      const anchorsFileName = findFilesWithSubstring(resultDir, "anchors.txt");
      const anchorsFilePath = `${resultDir}/${anchorsFileName}`;
      readFileWithHandling(anchorsFilePath, (anchorsData) => {
        sendMessageToView(
          mainWindow_views,
          viewChannel,
          "update_model_anchors",
          [anchorsData]
        );
      });
    }

    const trainDataPath = `${resultDir}/train_data.json`;
    readFileWithHandling(trainDataPath, (trainData) => {
      sendMessageToView(
        mainWindow_views,
        viewChannel,
        "update_model_train_graph",
        [trainData]
      );

      if (isClassifier) {
        const confusionMatrixPath = path.join(
          baseDir,
          dir,
          "result_root_dir",
          "classifier_result",
          "confusion_matrix.png"
        );
        sendMessageToView(
          mainWindow_views,
          viewChannel,
          "show_train_graph",
          confusionMatrixPath
        );
      }
    });
    // 更新训练日志到详情窗口
    readFileWithHandling(trainLogPath, (trainLogData) => {
      sendMessageToView(
        mainWindow_views,
        viewChannel,
        "update_model_train_log",
        [trainLogData]
      );
    });
    // 更新测试结果图片到详情窗口
    const imgList = read_img_dir(`${dir}/test`);
    sendMessageToView(mainWindow_views, viewChannel, "show_test_result_img", {
      dir: `${baseDir}/${dir}/test`,
      list: imgList,
    });
  });
});

ipcMain.on("read_model_detail_and_show_err", function (event, arg) {
  //读取并显示当前选择的模型(训练失败的)训练详情
  const dir = `trainOutput/${arg}`;
  const modelInfoPath = `${dir}/info.json`;
  const trainLogPath = `${dir}/train_log.log`;
  // Helper function to read file and handle errors
  const readFileWithHandling = (path, callback) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        console.error(`Error reading file at ${path}:`, err);
        return;
      }
      callback(data);
    });
  };

  readFileWithHandling(modelInfoPath, (data) => {
    const modelInfo = JSON.parse(data);
    const isClassifier = modelInfo["type"] === "classifier";
    const viewChannel = isClassifier ? "imgCls" : "objectDetection";
    // 更新模型信息到详情窗口
    sendMessageToView(mainWindow_views, viewChannel, "update_model_param_err", [
      data,
    ]);

    // 更新训练日志到详情窗口
    readFileWithHandling(trainLogPath, (trainLogData) => {
      sendMessageToView(
        mainWindow_views,
        viewChannel,
        "update_model_train_log_err",
        [trainLogData]
      );
    });
  });
});

ipcMain.on("export_model", function (event, arg) {
  dialog
    .showSaveDialog({
      title: current_locales.choose_export_path,
      defaultPath: arg + "_model.zip",
      filters: [{ name: "zip", extensions: ["zip"] }],
    })
    .then((result) => {
      // 是否取消
      if (!result.canceled) {
        console.log("Export to:" + result.filePaths);
        if (arg.split("_")[0] == "classifer") {
          file_dir =
            process.cwd() + "/trainOutput/" + arg + "/classifier_result.zip";
          save_dir = result.filePath;
          fs.cp(file_dir, save_dir, (err) => {
            if (err) {
              event.sender.send("show_export_reuslt_failed", err);
            } else {
              event.sender.send("show_export_reuslt_succeed", save_dir);
            }
          });
        } else {
          file_dir =
            process.cwd() + "/trainOutput/" + arg + "/detector_result.zip";
          save_dir = result.filePath;
          fs.cp(file_dir, save_dir, (err) => {
            if (err) {
              event.sender.send("show_export_reuslt_failed", save_dir);
            } else {
              event.sender.send("show_export_reuslt_succeed", save_dir);
            }
          });
        }
      }
    })
    .catch((error) => {
      console.log(error);
    });
});
