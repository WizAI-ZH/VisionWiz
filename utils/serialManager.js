const { ipcMain } = require('electron');
const { SerialPort } = require('serialport');
const AuthService = require('../cryptoservice_critical_loader.js');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const PREVIEW_DEFAULTS = Object.freeze({
  width: 320,
  height: 240,
  quality: 20,
  fps: 1,
});

console.log('[serialmanager] module loaded');

let currentAuth = null;
let currentPortPath = '';
let disconnectHandled = false;
let portWatchTimer = null;
let previewState = {
  connected: false,
  authenticated: false,
  previewActive: false,
  portPath: '',
  lastFrameId: -1,
  width: PREVIEW_DEFAULTS.width,
  height: PREVIEW_DEFAULTS.height,
  quality: PREVIEW_DEFAULTS.quality,
  fps: PREVIEW_DEFAULTS.fps,
  error: '',
};

function stopPortWatch() {
  if (portWatchTimer) {
    clearInterval(portWatchTimer);
    portWatchTimer = null;
  }
}

function startPortWatch(path) {
  stopPortWatch();
  if (!path) {
    return;
  }
  portWatchTimer = setInterval(async () => {
    try {
      const ports = await refreshPortList();
      const stillPresent = ports.some((item) => item.path === path);
      if (!stillPresent) {
        console.warn('[SERIAL] monitored port disappeared:', path);
        handleUnexpectedDisconnect(new Error('serial device disconnected'));
      }
    } catch (error) {
      console.warn('[SERIAL] port watch failed:', error.message);
    }
  }, 300);
}

async function refreshPortList() {
  const all = await SerialPort.list();
  return all.filter((p) => {
    if (p.vendorId !== '1A86') return false;
    const supportedPids = ['7523', '5523', '55D4', '55D3', '7522'];
    return supportedPids.includes(p.productId);
  });
}

async function hardwareReset(path) {
  const temp = new SerialPort({ path, baudRate: 115200, autoOpen: false });
  await new Promise((res, rej) => temp.open((err) => (err ? rej(err) : res())));
  await temp.set({ dtr: false, rts: true });
  await delay(50);
  await temp.set({ dtr: true });
  await delay(1200);
  await new Promise((res) => temp.close(res));
}

function emitPreviewStatus(extra = {}) {
  previewState = {
    ...previewState,
    ...extra,
  };
  console.log('[K210 PREVIEW][STATUS]', JSON.stringify(previewState));
  ipcMain.emit('k210-preview-status-internal', { ...previewState });
}

function emitPreviewError(error) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown preview error');
  previewState.error = message;
  console.error('[K210 PREVIEW][ERROR]', message);
  ipcMain.emit('k210-preview-error-internal', {
    ...previewState,
    error: message,
  });
}

function resetConnectionState() {
  stopPortWatch();
  currentPortPath = '';
  disconnectHandled = false;
}

function clearCurrentAuthReference(authInstance) {
  if (!authInstance || currentAuth === authInstance) {
    currentAuth = null;
  }
}

function handleUnexpectedDisconnect(error) {
  if (disconnectHandled) {
    return;
  }
  disconnectHandled = true;
  console.warn('[SERIAL] unexpected disconnect:', error ? error.message : 'unknown');
  const authInstance = currentAuth;
  stopPortWatch();
  if (authInstance) {
    authInstance.stopPreview({ skipCommand: true }).catch(() => {});
    authInstance.cleanup();
  }
  clearCurrentAuthReference(authInstance);
  emitPreviewStatus({
    connected: false,
    authenticated: false,
    previewActive: false,
    portPath: '',
    lastFrameId: -1,
    error: '',
  });
  ipcMain.emit('disconnected', {
    status: 'disconnected',
    reason: error instanceof Error ? error.message : String(error || 'serial device disconnected'),
  });
}

exports.initSerialManager = async () => refreshPortList();

exports.connectPort = async (path) => {
  try {
    if (currentAuth) {
      exports.disconnectPort();
    }
    disconnectHandled = false;
    currentPortPath = path;
    console.log('[RST] hardware reset');
    await hardwareReset(path);

    currentAuth = new AuthService();
    currentAuth.setPreviewCallbacks({
      onFrame: ({ frameId, jpeg }) => {
        previewState.lastFrameId = frameId;
        console.log('[K210 PREVIEW][FRAME]', `frame=${frameId}`, `bytes=${jpeg.length}`);
        ipcMain.emit('k210-preview-frame-internal', {
          frameId,
          jpegBase64: jpeg.toString('base64'),
          width: previewState.width,
          height: previewState.height,
        });
      },
      onStatus: (payload) => emitPreviewStatus(payload),
      onError: (error) => emitPreviewError(error),
      onDisconnect: ({ error }) => handleUnexpectedDisconnect(error),
    });

    await currentAuth.connectPort(path);
    startPortWatch(path);
    emitPreviewStatus({
      connected: true,
      authenticated: false,
      previewActive: false,
      portPath: path,
      lastFrameId: -1,
      error: '',
    });

    await currentAuth.sendChallenge()
      .then((res) => {
        console.log('auth-success!');
        emitPreviewStatus({
          authenticated: true,
          previewActive: false,
          error: '',
        });
        ipcMain.emit('auth-success', { deviceId: res.deviceId });
      })
      .catch((err) => {
        console.log('auth-fail!');
        console.log('error: ' + err.message);
        emitPreviewStatus({
          authenticated: false,
          previewActive: false,
        });
        emitPreviewError(err);
        ipcMain.emit('auth-failure', { error: err.message });
        throw err;
      });

    return true;
  } catch (err) {
    if (currentAuth) {
      try {
        currentAuth.cleanup();
      } catch (_cleanupError) {}
    }
    resetConnectionState();
    clearCurrentAuthReference(currentAuth);
    throw err;
  }
};

exports.startK210Preview = async () => {
  if (!currentAuth) {
    throw new Error('Device is not connected.');
  }
  if (previewState.previewActive) {
    return { ...previewState };
  }

  previewState.error = '';
  console.log('[K210 PREVIEW] start requested', PREVIEW_DEFAULTS);
  await currentAuth.startPreview(PREVIEW_DEFAULTS);
  emitPreviewStatus({
    previewActive: true,
    width: PREVIEW_DEFAULTS.width,
    height: PREVIEW_DEFAULTS.height,
    quality: PREVIEW_DEFAULTS.quality,
    fps: PREVIEW_DEFAULTS.fps,
    error: '',
  });
  return { ...previewState };
};

exports.stopK210Preview = async () => {
  if (currentAuth) {
    console.log('[K210 PREVIEW] stop requested');
    await currentAuth.stopPreview();
  }
  emitPreviewStatus({
    previewActive: false,
    lastFrameId: -1,
  });
  return { ...previewState };
};

exports.getK210PreviewState = () => ({ ...previewState });

exports.disconnectPort = () => {
  disconnectHandled = true;
  stopPortWatch();
  if (currentAuth) {
    currentAuth.stopPreview({ skipCommand: true }).catch(() => {});
  }
  if (currentAuth) {
    currentAuth.cleanup();
    currentAuth = null;
  }
  currentPortPath = '';
  emitPreviewStatus({
    connected: false,
    authenticated: false,
    previewActive: false,
    portPath: '',
    lastFrameId: -1,
    error: '',
  });
  ipcMain.emit('disconnected', { status: 'disconnected' });
  disconnectHandled = false;
};

