const { app, ipcMain } = require('electron');
const { SerialPort } = require('serialport');
const fs = require('fs');
const path = require('path');
const AuthService = require('../cryptoservice_critical_loader.js');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const PREVIEW_DEFAULTS = Object.freeze({
  width: 320,
  height: 240,
  quality: 20,
  fps: 1,
});
const IMAGE_SYNC_FILES = Object.freeze([
  'main.py',
  'usys.mpy',
  'visionwiz_image_sync.mpy',
]);
const RAW_REPL_TIMEOUT_MS = 6000;
const RAW_REPL_CHUNK_SIZE = 512;

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

function emitImageSyncUploadProgress(payload = {}) {
  const nextPayload = {
    status: payload.status || 'info',
    message: payload.message || '',
    file: payload.file || '',
    percent: Number.isFinite(payload.percent) ? payload.percent : null,
  };
  console.log('[K210 IMAGE SYNC][UPLOAD]', JSON.stringify(nextPayload));
  ipcMain.emit('k210-image-sync-upload-progress-internal', nextPayload);
}

function resolveImageSyncPayloadDir() {
  const candidates = [
    app && app.isPackaged
      ? path.join(process.resourcesPath, 'tools', 'visionwiz_image_sync', 'VESIBIT')
      : '',
    path.join(process.cwd(), 'tools', 'visionwiz_image_sync', 'VESIBIT'),
    path.join(__dirname, '..', 'tools', 'visionwiz_image_sync', 'VESIBIT'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (IMAGE_SYNC_FILES.every((fileName) => fs.existsSync(path.join(candidate, fileName)))) {
      return candidate;
    }
  }

  throw new Error(`Image sync payload files are missing. Checked: ${candidates.join('; ')}`);
}

function openSerialPort(pathName) {
  const port = new SerialPort({
    path: pathName,
    baudRate: 115200,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    autoOpen: false,
  });
  return new Promise((resolve, reject) => {
    port.open((error) => (error ? reject(error) : resolve(port)));
  });
}

function closeSerialPort(port) {
  return new Promise((resolve) => {
    if (!port || !port.isOpen) {
      resolve();
      return;
    }
    port.close(() => resolve());
  });
}

function writeAndDrain(port, payload) {
  return new Promise((resolve, reject) => {
    if (!port || !port.isOpen) {
      reject(new Error('serial port is not open'));
      return;
    }
    port.write(payload, (writeError) => {
      if (writeError) {
        reject(writeError);
        return;
      }
      port.drain((drainError) => (drainError ? reject(drainError) : resolve()));
    });
  });
}

function waitForRawReplResponse(port, marker, timeoutMs = RAW_REPL_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const markerBuffer = Buffer.from(marker, 'utf8');
    const errorBuffer = Buffer.from('Traceback', 'utf8');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`raw REPL response timeout: ${marker}`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      port.off('data', onData);
      port.off('error', onError);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.indexOf(errorBuffer) !== -1) {
        cleanup();
        reject(new Error(buffer.toString('utf8')));
        return;
      }
      if (buffer.indexOf(markerBuffer) !== -1) {
        cleanup();
        resolve(buffer.toString('utf8'));
      }
    }

    port.on('data', onData);
    port.on('error', onError);
  });
}

async function enterRawRepl(port) {
  await writeAndDrain(port, Buffer.from([0x03, 0x03]));
  await delay(250);
  await writeAndDrain(port, Buffer.from([0x01]));
  try {
    await waitForRawReplResponse(port, 'raw REPL', 2500);
  } catch (_error) {
    await writeAndDrain(port, Buffer.from([0x03, 0x03]));
    await delay(250);
    await writeAndDrain(port, Buffer.from([0x01]));
    await waitForRawReplResponse(port, 'raw REPL', RAW_REPL_TIMEOUT_MS);
  }
}

async function rawExec(port, code, marker) {
  const waitPromise = waitForRawReplResponse(port, marker, RAW_REPL_TIMEOUT_MS);
  await writeAndDrain(port, code);
  await writeAndDrain(port, Buffer.from([0x04]));
  return waitPromise;
}

async function backupBoardMain(port) {
  const marker = 'VW_BACKUP_DONE';
  const code = [
    "import os",
    "try:",
    "    data = open('/flash/main.py', 'rb').read()",
    "    open('/flash/main_visionwiz_backup.py', 'wb').write(data)",
    "except Exception as e:",
    "    pass",
    `print('${marker}')`,
  ].join('\n');
  await rawExec(port, code, marker);
}

async function writeRemoteFile(port, remotePath, data, progressBase, progressSpan, fileName) {
  const openMarker = `VW_OPEN_${Date.now()}`;
  await rawExec(port, `f=open('${remotePath}','wb')\nprint('${openMarker}')`, openMarker);

  for (let offset = 0; offset < data.length; offset += RAW_REPL_CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + RAW_REPL_CHUNK_SIZE);
    const marker = `VW_WRITE_${offset}_${Date.now()}`;
    const chunkLiteral = JSON.stringify(chunk.toString('base64'));
    const code = [
      "import ubinascii",
      `f.write(ubinascii.a2b_base64(${chunkLiteral}))`,
      `print('${marker}')`,
    ].join('\n');
    await rawExec(port, code, marker);
    emitImageSyncUploadProgress({
      status: 'uploading',
      message: 'uploading',
      file: fileName,
      percent: Math.min(95, progressBase + Math.round(((offset + chunk.length) / data.length) * progressSpan)),
    });
  }

  const closeMarker = `VW_CLOSE_${Date.now()}`;
  await rawExec(port, `f.close()\nprint('${closeMarker}')`, closeMarker);
}

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

exports.uploadImageSyncProgram = async () => {
  const uploadPortPath = currentPortPath || previewState.portPath;
  if (!uploadPortPath) {
    throw new Error('Device is not connected.');
  }

  let uploadPort = null;
  emitImageSyncUploadProgress({
    status: 'preparing',
    message: 'preparing',
    percent: 0,
  });

  try {
    const payloadDir = resolveImageSyncPayloadDir();
    const payloads = IMAGE_SYNC_FILES.map((fileName) => ({
      fileName,
      remotePath: `/flash/${fileName}`,
      data: fs.readFileSync(path.join(payloadDir, fileName)),
    }));

    emitImageSyncUploadProgress({
      status: 'stopping-preview',
      message: 'stopping-preview',
      percent: 5,
    });
    if (currentAuth) {
      try {
        await currentAuth.stopPreview({ skipCommand: true });
      } catch (_error) {}
      currentAuth.cleanup();
      currentAuth = null;
    }
    stopPortWatch();
    disconnectHandled = true;
    emitPreviewStatus({
      connected: true,
      authenticated: false,
      previewActive: false,
      portPath: uploadPortPath,
      error: '',
    });
    await delay(800);

    emitImageSyncUploadProgress({
      status: 'connecting-raw-repl',
      message: 'connecting-raw-repl',
      percent: 10,
    });
    uploadPort = await openSerialPort(uploadPortPath);
    await enterRawRepl(uploadPort);

    emitImageSyncUploadProgress({
      status: 'backup',
      message: 'backup',
      percent: 18,
    });
    await backupBoardMain(uploadPort);

    const fileSpan = 60 / payloads.length;
    for (let index = 0; index < payloads.length; index += 1) {
      const item = payloads[index];
      emitImageSyncUploadProgress({
        status: 'uploading',
        message: 'uploading',
        file: item.fileName,
        percent: Math.round(22 + index * fileSpan),
      });
      await writeRemoteFile(
        uploadPort,
        item.remotePath,
        item.data,
        Math.round(22 + index * fileSpan),
        Math.round(fileSpan),
        item.fileName
      );
    }

    emitImageSyncUploadProgress({
      status: 'restarting',
      message: 'restarting',
      percent: 88,
    });
    await writeAndDrain(uploadPort, Buffer.from([0x04]));
    await delay(250);
    await closeSerialPort(uploadPort);
    uploadPort = null;
    try {
      await hardwareReset(uploadPortPath);
    } catch (_resetError) {}
    await delay(1200);

    emitImageSyncUploadProgress({
      status: 'reconnecting',
      message: 'reconnecting',
      percent: 94,
    });
    disconnectHandled = false;
    await exports.connectPort(uploadPortPath);

    emitImageSyncUploadProgress({
      status: 'starting-preview',
      message: 'starting-preview',
      percent: 98,
    });
    await exports.startK210Preview();

    emitImageSyncUploadProgress({
      status: 'done',
      message: 'done',
      percent: 100,
    });
    return {
      ok: true,
      state: exports.getK210PreviewState(),
    };
  } catch (error) {
    await closeSerialPort(uploadPort);
    disconnectHandled = false;
    emitImageSyncUploadProgress({
      status: 'failed',
      message: error.message,
      percent: null,
    });
    emitPreviewError(error);
    try {
      if (!currentAuth) {
        await exports.connectPort(uploadPortPath);
      }
    } catch (restoreError) {
      console.warn('[K210 IMAGE SYNC][UPLOAD] restore connection failed:', restoreError.message);
    }
    throw error;
  }
};

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

