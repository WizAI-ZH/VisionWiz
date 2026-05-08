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

exports.initSerialManager = async () => refreshPortList();

exports.connectPort = async (path) => {
  try {
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
    });

    await currentAuth.connectPort(path);
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
  if (currentAuth) {
    currentAuth.stopPreview({ skipCommand: true }).catch(() => {});
  }
  if (currentAuth) {
    currentAuth.cleanup();
    currentAuth = null;
  }
  emitPreviewStatus({
    connected: false,
    authenticated: false,
    previewActive: false,
    portPath: '',
    lastFrameId: -1,
    error: '',
  });
  ipcMain.emit('disconnected', { status: 'disconnected' });
};

