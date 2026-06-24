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
const IMAGE_SYNC_RESOLUTIONS = Object.freeze({
  '320x240': { width: 320, height: 240 },
  '320x224': { width: 320, height: 224 },
  '224x224': { width: 224, height: 224 },
});
const CH340_VENDOR_ID = '1A86';
const CH340_PRODUCT_ID = '7523';
const IMAGE_SYNC_FILES = Object.freeze([
  'main.py',
  'usys.mpy',
  'visionwiz_image_sync.mpy',
]);
const MODEL_TEST_FILES = Object.freeze([
  'button.mpy',
  'usys.mpy',
]);
const RAW_REPL_TIMEOUT_MS = 6000;
const RAW_REPL_CHUNK_SIZE = 512;
const MODEL_TEST_UPLOAD_CHUNK_SIZE = 12288;
const MODEL_TEST_FAST_UPLOAD_CHUNK_SIZE = 8192;
const MODEL_TEST_FAST_UPLOAD_ACK_BYTES = 524288;
const MODEL_TEST_FAST_UPLOAD_PROFILES = Object.freeze([
  { name: 'fast-512k', chunkSize: MODEL_TEST_FAST_UPLOAD_CHUNK_SIZE, ackBytes: 524288 },
  { name: 'fast-256k', chunkSize: MODEL_TEST_FAST_UPLOAD_CHUNK_SIZE, ackBytes: 262144 },
  { name: 'fast-128k', chunkSize: MODEL_TEST_FAST_UPLOAD_CHUNK_SIZE, ackBytes: 131072 },
  { name: 'fast-64k', chunkSize: MODEL_TEST_FAST_UPLOAD_CHUNK_SIZE, ackBytes: 65536 },
  { name: 'fast-32k', chunkSize: MODEL_TEST_FAST_UPLOAD_CHUNK_SIZE, ackBytes: 32768 },
]);
const RAW_REPL_BANNER = 'raw REPL; CTRL-B to exit';

console.log('[serialmanager] module loaded');

let currentAuth = null;
let currentPortPath = '';
let currentPortInfo = null;
let disconnectHandled = false;
let portWatchTimer = null;
let suppressPreviewErrors = false;
let modelTestFastUploadProfileCache = {};
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
  supportsImageSyncUpload: false,
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

function emitModelTestUploadProgress(payload = {}) {
  const nextPayload = {
    status: payload.status || 'info',
    message: payload.message || '',
    file: payload.file || '',
    percent: Number.isFinite(payload.percent) ? payload.percent : null,
  };
  console.log('[K210 MODEL TEST][UPLOAD]', JSON.stringify(nextPayload));
  ipcMain.emit('k210-model-test-upload-progress-internal', nextPayload);
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

function resolveModelTestPayloadDir() {
  const candidates = [
    app && app.isPackaged
      ? path.join(process.resourcesPath, 'tools', 'visionwiz_imgreg_test', 'VESIBIT')
      : '',
    path.join(process.cwd(), 'tools', 'visionwiz_imgreg_test', 'VESIBIT'),
    path.join(__dirname, '..', 'tools', 'visionwiz_imgreg_test', 'VESIBIT'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const required = ['main.py', 'main_cls.py', ...MODEL_TEST_FILES];
    if (required.every((fileName) => fs.existsSync(path.join(candidate, fileName)))) {
      return candidate;
    }
  }

  throw new Error(`Model test payload files are missing. Checked: ${candidates.join('; ')}`);
}

function normalizeImageSyncResolution(value) {
  return IMAGE_SYNC_RESOLUTIONS[value] ? value : '320x240';
}

function getModelTestUploadProfileKey(portInfo = {}) {
  return [
    String(portInfo.vendorId || '').toUpperCase(),
    String(portInfo.productId || '').toUpperCase(),
    String(portInfo.serialNumber || portInfo.path || 'default'),
  ].join(':');
}

function getModelTestUploadProfilePath() {
  try {
    return path.join(app.getPath('userData'), 'model-test-upload-profiles.json');
  } catch (_error) {
    return path.join(process.cwd(), 'model-test-upload-profiles.json');
  }
}

function readModelTestUploadProfileStore() {
  try {
    const filePath = getModelTestUploadProfilePath();
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
  } catch (error) {
    console.warn('[K210 MODEL TEST][UPLOAD] read upload profile store failed:', error.message);
    return {};
  }
}

function writeModelTestUploadProfileStore(store = {}) {
  try {
    const filePath = getModelTestUploadProfilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
  } catch (error) {
    console.warn('[K210 MODEL TEST][UPLOAD] write upload profile store failed:', error.message);
  }
}

function findModelTestUploadProfile(profile = {}) {
  return MODEL_TEST_FAST_UPLOAD_PROFILES.find((item) => (
    item.chunkSize === Number(profile.chunkSize)
    && item.ackBytes === Number(profile.ackBytes)
  )) || null;
}

function getModelTestUploadProfiles(portInfo = {}) {
  const key = getModelTestUploadProfileKey(portInfo);
  const store = readModelTestUploadProfileStore();
  const remembered = modelTestFastUploadProfileCache[key] || store[key];
  const first = findModelTestUploadProfile(remembered);
  if (!first) return [...MODEL_TEST_FAST_UPLOAD_PROFILES];
  return [
    first,
    ...MODEL_TEST_FAST_UPLOAD_PROFILES.filter((item) => item !== first),
  ];
}

function rememberModelTestUploadProfile(portInfo = {}, profile) {
  const normalized = findModelTestUploadProfile(profile);
  if (!normalized) return;
  const key = getModelTestUploadProfileKey(portInfo);
  const value = {
    name: normalized.name,
    chunkSize: normalized.chunkSize,
    ackBytes: normalized.ackBytes,
    updatedAt: new Date().toISOString(),
  };
  modelTestFastUploadProfileCache[key] = value;
  const store = readModelTestUploadProfileStore();
  store[key] = value;
  writeModelTestUploadProfileStore(store);
}

function buildImageSyncMainPy(options = {}) {
  const resolution = normalizeImageSyncResolution(options.resolution);
  const { width, height } = IMAGE_SYNC_RESOLUTIONS[resolution];
  return Buffer.from(`import board
import lcd
import usys
import sensor
from visionwiz_image_sync import VisionWizImageSync


lcd.init(freq=15000000,color=0)
sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.QVGA)
sensor.set_windowing((${width}, ${height}))
sensor.run(1)
sensor.skip_frames(10)
sync = VisionWizImageSync(width=${width}, height=${height}, quality=35, fps=2, show_lcd=True)
sync.start_preview(${width}, ${height}, 35, 2, True)
while True:
    sync.handle_control_commands(timeout_ms=1)
    sync.tick()
`, 'utf8');
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

function waitForPattern(port, patterns, timeoutMs = 1000) {
  const patternList = (Array.isArray(patterns) ? patterns : [patterns]).map((pattern) => Buffer.from(pattern, 'utf8'));
  return new Promise((resolve) => {
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      cleanup();
      resolve({
        matched: '',
        text: buffer.toString('utf8'),
      });
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      port.off('data', onData);
      port.off('error', onError);
    }

    function onError() {
      cleanup();
      resolve({
        matched: '',
        text: buffer.toString('utf8'),
      });
    }

    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      for (const pattern of patternList) {
        if (buffer.indexOf(pattern) !== -1 || buffer.toString('utf8').toLowerCase().endsWith(pattern.toString('utf8').toLowerCase())) {
          cleanup();
          resolve({
            matched: pattern.toString('utf8'),
            text: buffer.toString('utf8'),
          });
          return;
        }
      }
    }

    port.on('data', onData);
    port.on('error', onError);
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
        const message = buffer.toString('utf8')
          .replace(/\x04/g, '')
          .replace(/\r/g, '')
          .trim();
        reject(new Error(message));
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
  let replReady = false;
  for (let retry = 0; retry < 10; retry += 1) {
    await writeAndDrain(port, Buffer.from('\r\x03', 'binary'));
    await delay(100);
    await writeAndDrain(port, Buffer.from([0x03]));
    const result = await waitForPattern(port, '>', 350);
    if (result.text.trim().endsWith('>')) {
      replReady = true;
      break;
    }
  }

  if (!replReady) {
    await port.set({ dtr: false, rts: true });
    await delay(100);
    await port.set({ dtr: false, rts: false });
    await delay(700);
  }

  await writeAndDrain(port, Buffer.from('\r\x03', 'binary'));
  await delay(100);
  await writeAndDrain(port, Buffer.from([0x03]));
  await delay(100);

  for (let retry = 0; retry < 5; retry += 1) {
    await writeAndDrain(port, Buffer.from('\r\x01', 'binary'));
    const rawResult = await waitForPattern(port, RAW_REPL_BANNER, 1500);
    if (rawResult.text.includes(RAW_REPL_BANNER)) {
      return;
    }
    await writeAndDrain(port, Buffer.from('\r\x03', 'binary'));
    await delay(100);
    await writeAndDrain(port, Buffer.from([0x03]));
    await delay(100);
  }

  throw new Error('could not enter raw REPL');
}

async function rawExec(port, code, marker) {
  const waitPromise = waitForRawReplResponse(port, marker, RAW_REPL_TIMEOUT_MS);
  await writeAndDrain(port, code.endsWith('\n') ? code : `${code}\n`);
  await writeAndDrain(port, Buffer.from([0x04]));
  return waitPromise;
}

function toPythonBytesLiteral(buffer) {
  let escaped = '';
  for (const byte of buffer) {
    escaped += `\\x${byte.toString(16).padStart(2, '0')}`;
  }
  return `b'${escaped}'`;
}

async function backupBoardMain(port) {
  const marker = 'VW_BACKUP_DONE';
  const code = [
    "try:",
    "    data = open('main.py', 'rb').read()",
    "    open('main_visionwiz_backup.py', 'wb').write(data)",
    "except Exception as e:",
    "    pass",
    `print('${marker}')`,
  ].join('\n');
  await rawExec(port, code, marker);
}

async function writeRemoteFile(port, remotePath, data, progressBase, progressSpan, fileName, progressEmitter = emitImageSyncUploadProgress, chunkSize = RAW_REPL_CHUNK_SIZE) {
  const openMarker = `VW_OPEN_${Date.now()}`;
  await rawExec(port, `f=open('${remotePath}','wb')\nprint('${openMarker}')`, openMarker);

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.slice(offset, offset + chunkSize);
    const marker = `VW_WRITE_${offset}_${Date.now()}`;
    const chunkLiteral = toPythonBytesLiteral(chunk);
    const code = [
      `f.write(${chunkLiteral})`,
      `print('${marker}')`,
    ].join('\n');
    await rawExec(port, code, marker);
    progressEmitter({
      status: 'uploading',
      message: 'uploading',
      file: fileName,
      percent: Math.min(95, progressBase + Math.round(((offset + chunk.length) / data.length) * progressSpan)),
    });
  }

  const closeMarker = `VW_CLOSE_${Date.now()}`;
  await rawExec(port, `f.close()\nprint('${closeMarker}')`, closeMarker);
}

async function writeRemoteFileBase64(port, remotePath, data, progressBase, progressSpan, fileName, progressEmitter, chunkSize) {
  const openMarker = `VW_OPEN_B64_${Date.now()}`;
  await rawExec(port, `import ubinascii\nf=open('${remotePath}','wb')\nprint('${openMarker}')`, openMarker);

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.slice(offset, offset + chunkSize);
    const marker = `VW_WRITE_B64_${offset}_${Date.now()}`;
    const chunkBase64 = chunk.toString('base64');
    const code = [
      `f.write(ubinascii.a2b_base64('${chunkBase64}'))`,
      `print('${marker}')`,
    ].join('\n');
    await rawExec(port, code, marker);
    progressEmitter({
      status: 'uploading',
      message: 'uploading',
      file: fileName,
      percent: Math.min(95, progressBase + Math.round(((offset + chunk.length) / data.length) * progressSpan)),
    });
  }

  const closeMarker = `VW_CLOSE_B64_${Date.now()}`;
  await rawExec(port, `f.close()\nprint('${closeMarker}')`, closeMarker);
}

function encodeFastUploadChunk(buffer) {
  const escaped = [];
  for (const byte of buffer) {
    if (byte === 0x03 || byte === 0x04 || byte === 0x10 || byte === 0x11 || byte === 0x13) {
      escaped.push(0x10, byte ^ 0x20);
    } else {
      escaped.push(byte);
    }
  }
  return Buffer.from(escaped);
}

function buildFastUploadChunks(data, chunkSize) {
  const chunks = [];
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const raw = data.slice(offset, offset + chunkSize);
    chunks.push({
      rawLength: raw.length,
      encoded: encodeFastUploadChunk(raw),
    });
  }
  return chunks;
}

async function writeRemoteFileFastBinary(port, remotePath, data, progressBase, progressSpan, fileName, progressEmitter, profile) {
  const uploadProfile = findModelTestUploadProfile(profile) || MODEL_TEST_FAST_UPLOAD_PROFILES[0];
  const chunks = buildFastUploadChunks(data, uploadProfile.chunkSize);
  const encodedLengths = chunks.map((chunk) => chunk.encoded.length);
  const readyMarker = `VW_BIN_READY_${Date.now()}`;
  const doneMarker = `VW_BIN_DONE_${Date.now()}`;
  const failMarker = `VW_BIN_FAIL_${Date.now()}`;
  const ackPrefix = `VW_BIN_ACK_${Date.now()}_`;
  const receiver = [
    'import sys',
    'try:',
    '    import micropython',
    '    micropython.kbd_intr(-1)',
    'except Exception:',
    '    micropython = None',
    `remote_path = ${JSON.stringify(remotePath)}`,
    `encoded_lengths = ${JSON.stringify(encodedLengths)}`,
    `total_size = ${data.length}`,
    `ack_step = ${uploadProfile.ackBytes}`,
    'esc = 16',
    'reader = getattr(sys.stdin, "buffer", sys.stdin)',
    'def read_exact(n):',
    '    data = b""',
    '    while len(data) < n:',
    '        part = reader.read(n - len(data))',
    '        if part is None:',
    '            continue',
    '        if len(part) == 0:',
    '            continue',
    '        if isinstance(part, str):',
    '            part = part.encode("latin1")',
    '        data += part',
    '    return data',
    'def decode_chunk(data):',
    '    out = bytearray()',
    '    i = 0',
    '    size = len(data)',
    '    while i < size:',
    '        b = data[i]',
    '        if b == esc:',
    '            i += 1',
    '            out.append(data[i] ^ 32)',
    '        else:',
    '            out.append(b)',
    '        i += 1',
    '    return out',
    'written = 0',
    'next_ack = ack_step',
    'f = None',
    'try:',
    '    f = open(remote_path, "wb")',
    `    print("${readyMarker}")`,
    '    for enc_len in encoded_lengths:',
    '        raw = decode_chunk(read_exact(enc_len))',
    '        f.write(raw)',
    '        written += len(raw)',
    '        if written >= total_size:',
    `            print("${doneMarker}:%d" % written)`,
    '        elif written >= next_ack:',
    `            print("${ackPrefix}%d" % written)`,
    '            next_ack += ack_step',
    '    f.close()',
    '    f = None',
    'except Exception as e:',
    `    print("${failMarker}:" + str(e))`,
    '    try:',
    '        if f:',
    '            f.close()',
    '    except Exception:',
    '        pass',
    'finally:',
    '    try:',
    '        if micropython:',
    '            micropython.kbd_intr(3)',
    '    except Exception:',
    '        pass',
  ].join('\n');

  await writeAndDrain(port, `${receiver}\n`);
  await writeAndDrain(port, Buffer.from([0x04]));
  const ready = await waitForPattern(port, [readyMarker, failMarker], 15000);
  if (!ready.text.includes(readyMarker)) {
    throw new Error(`fast upload receiver failed: ${ready.text || 'no ready marker'}`);
  }

  let written = 0;
  let nextAck = uploadProfile.ackBytes;
  for (const chunk of chunks) {
    await writeAndDrain(port, chunk.encoded);
    written += chunk.rawLength;
    const shouldWait = written >= nextAck || written >= data.length;
    if (!shouldWait) continue;

    const expected = written >= data.length ? `${doneMarker}:${data.length}` : `${ackPrefix}${written}`;
    const response = await waitForPattern(port, [expected, failMarker], 30000);
    if (!response.text.includes(expected)) {
      throw new Error(`fast upload failed: ${response.text || `missing ${expected}`}`);
    }
    while (nextAck <= written) {
      nextAck += uploadProfile.ackBytes;
    }
    progressEmitter({
      status: 'uploading',
      message: 'uploading',
      file: fileName,
      percent: Math.min(95, progressBase + Math.round((written / data.length) * progressSpan)),
    });
  }
}

function findFirstFile(dir, predicate) {
  if (!fs.existsSync(dir)) return '';
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && predicate(entry.name, fullPath)) {
        return fullPath;
      }
    }
  }
  return '';
}

function readTextFile(filePath, fallback = '') {
  return filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : fallback;
}

function getModelInputWindow(info) {
  const width = Number(info.input_width || (Array.isArray(info.input_shape) ? info.input_shape[1] : 224)) || 224;
  const height = Number(info.input_height || (Array.isArray(info.input_shape) ? info.input_shape[0] : 224)) || 224;
  return { width, height };
}

function patchDetectorTemplate(template, labels, anchors, info) {
  const { width, height } = getModelInputWindow(info);
  return template
    .replace(/sensor\.set_windowing\(\([^)]+\)\)/, `sensor.set_windowing((${width},${height}))`)
    .replace(/anchor\s*=\s*[^\n\r]+/, `anchor= ${anchors}`)
    .replace(/KPU\s*=\s*kpu\.load\([^)]+\)/, "KPU = kpu.load('/sd/test.kmodel')")
    .replace(/goods\s*=\s*[^\n\r]+(?:\r?\ngoods\s*=\s*[^\n\r]+)?/, `goods= ${labels}`);
}

function patchClassifierTemplate(template, labels, info) {
  const { width, height } = getModelInputWindow(info);
  return template
    .replace(/sensor\.set_windowing\(\([^)]+\)\)/, `sensor.set_windowing((${width},${height}))`)
    .replace(/KPU\s*=\s*kpu\.load\([^)]+\)/, "KPU = kpu.load('/sd/test.kmodel')")
    .replace(/goods\s*=\s*[^\n\r]+/, `goods= ${labels}`);
}

function buildModelTestPayloads(options = {}) {
  const runName = path.basename(String(options.dir || options.runName || ''));
  if (!runName) {
    throw new Error('Training record is not selected.');
  }
  const runDir = path.join(process.cwd(), 'trainOutput', runName);
  if (!fs.existsSync(runDir)) {
    throw new Error('Training record does not exist.');
  }

  const infoPath = path.join(runDir, 'info.json');
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  const isClassifier = info.type === 'classifier';
  const resultDir = findFirstFile(runDir, (_name, fullPath) => fullPath.endsWith('train_data.json'));
  const searchRoot = resultDir ? path.dirname(resultDir) : runDir;
  const kmodelPath = findFirstFile(searchRoot, (name) => name.toLowerCase().endsWith('.kmodel'));
  const labelsPath = findFirstFile(searchRoot, (name) => name.toLowerCase().endsWith('_labels.txt') || name.toLowerCase() === 'labels.txt');
  const anchorsPath = isClassifier ? '' : findFirstFile(searchRoot, (name) => name.toLowerCase().endsWith('_anchors.txt') || name.toLowerCase() === 'anchors.txt');

  if (!kmodelPath) throw new Error('Kmodel file was not found.');
  if (!labelsPath) throw new Error('Labels file was not found.');
  if (!isClassifier && !anchorsPath) throw new Error('Anchors file was not found.');

  const payloadDir = resolveModelTestPayloadDir();
  const labels = readTextFile(labelsPath, '[]');
  const anchors = isClassifier ? '' : readTextFile(anchorsPath, '[]');
  const templatePath = path.join(payloadDir, isClassifier ? 'main_cls.py' : 'main.py');
  const template = fs.readFileSync(templatePath, 'utf8');
  const mainPy = isClassifier
    ? patchClassifierTemplate(template, labels, info)
    : patchDetectorTemplate(template, labels, anchors, info);

  return [
    { fileName: 'main.py', remotePath: '/sd/main.py', data: Buffer.from(mainPy, 'utf8') },
    { fileName: 'test.kmodel', remotePath: '/sd/test.kmodel', data: fs.readFileSync(kmodelPath) },
    ...MODEL_TEST_FILES.map((fileName) => ({
      fileName,
      remotePath: `/sd/${fileName}`,
      data: fs.readFileSync(path.join(payloadDir, fileName)),
    })),
  ];
}

async function assertSdWritable(port) {
  const marker = `VW_SD_OK_${Date.now()}`;
  const code = [
    "sd_ok = False",
    "try:",
    "    f=open('/sd/.visionwiz_write_test','wb')",
    "    f.write(b'ok')",
    "    f.close()",
    "    import os",
    "    os.remove('/sd/.visionwiz_write_test')",
    "    sd_ok = True",
    "except Exception as e:",
    "    print('VW_SD_ERROR:' + str(e))",
    `print('${marker}' if sd_ok else '${marker}_FAIL')`,
  ].join('\n');
  const result = await rawExec(port, code, marker);
  if (!result.includes(marker) || result.includes(`${marker}_FAIL`)) {
    throw new Error('SD card is not available or not writable.');
  }
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
    if (p.vendorId !== CH340_VENDOR_ID) return false;
    const supportedPids = ['7523', '5523', '55D4', '55D3', '7522'];
    return supportedPids.includes(p.productId);
  }).map((p) => ({
    ...p,
    isCh340: p.vendorId === CH340_VENDOR_ID && p.productId === CH340_PRODUCT_ID,
  }));
}

async function getPortInfo(pathName) {
  const ports = await SerialPort.list();
  const info = ports.find((item) => item.path === pathName) || null;
  return info
    ? {
      ...info,
      isCh340: info.vendorId === CH340_VENDOR_ID && info.productId === CH340_PRODUCT_ID,
    }
    : null;
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

async function uploadReset(path) {
  const temp = new SerialPort({ path, baudRate: 115200, autoOpen: false });
  await new Promise((res, rej) => temp.open((err) => (err ? rej(err) : res())));
  await temp.set({ dtr: false, rts: true });
  await delay(100);
  await temp.set({ dtr: false, rts: false });
  await delay(100);
  await new Promise((res) => temp.close(res));
}

async function connectPassiveImageSyncPreview(path, options = {}) {
  const resolution = normalizeImageSyncResolution(options.resolution);
  const { width, height } = IMAGE_SYNC_RESOLUTIONS[resolution];
  if (currentAuth) {
    try {
      currentAuth.cleanup();
    } catch (_cleanupError) {}
    currentAuth = null;
  }

  currentAuth = new AuthService();
  currentAuth.setPreviewCallbacks({
    onFrame: ({ frameId, jpeg }) => {
      previewState.lastFrameId = frameId;
      console.log('[K210 PREVIEW][PASSIVE FRAME]', `frame=${frameId}`, `bytes=${jpeg.length}`);
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
  currentPortInfo = await getPortInfo(path);
  currentPortPath = path;
  disconnectHandled = false;
  startPortWatch(path);
  currentAuth.startPassivePreview({
    width,
    height,
    quality: 35,
    fps: 2,
  });
  emitPreviewStatus({
    connected: true,
    authenticated: true,
    previewActive: true,
    portPath: path,
    lastFrameId: -1,
    width,
    height,
    quality: 35,
    fps: 2,
    supportsImageSyncUpload: !!currentPortInfo?.isCh340,
    error: '',
  });
  return { ...previewState };
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
  if (suppressPreviewErrors) {
    console.warn('[K210 PREVIEW][ERROR SUPPRESSED]', message);
    return;
  }
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
  currentPortInfo = null;
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
  currentPortInfo = null;
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
    supportsImageSyncUpload: false,
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
    currentPortInfo = await getPortInfo(path);
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
      supportsImageSyncUpload: !!currentPortInfo?.isCh340,
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

exports.setK210ImageSyncParams = async (options = {}) => {
  if (!currentAuth) {
    throw new Error('Device is not connected.');
  }

  const resolution = normalizeImageSyncResolution(options.resolution);
  const { width, height } = IMAGE_SYNC_RESOLUTIONS[resolution];
  const quality = Number(options.quality) || 35;
  const fps = Number(options.fps) || 2;
  const show_lcd = options.show_lcd !== false;

  await currentAuth.setPreviewParams({
    width,
    height,
    quality,
    fps,
    show_lcd,
  });

  emitPreviewStatus({
    connected: true,
    authenticated: previewState.authenticated || true,
    previewActive: true,
    width,
    height,
    quality,
    fps,
    error: '',
  });

  return { ...previewState };
};

exports.uploadImageSyncProgram = async (options = {}) => {
  const uploadPortPath = currentPortPath || previewState.portPath;
  if (!uploadPortPath) {
    throw new Error('Device is not connected.');
  }
  const uploadPortInfo = currentPortInfo || await getPortInfo(uploadPortPath);
  if (!uploadPortInfo?.isCh340) {
    throw new Error('Image sync upload is only available for CH340 K210 controller ports.');
  }

  let uploadPort = null;
  emitImageSyncUploadProgress({
    status: 'preparing',
    message: 'preparing',
    percent: 0,
  });

  try {
    const payloadDir = resolveImageSyncPayloadDir();
    const resolution = normalizeImageSyncResolution(options.resolution);
    const payloads = IMAGE_SYNC_FILES.map((fileName) => {
      const data = fileName === 'main.py'
        ? buildImageSyncMainPy({ resolution })
        : fs.readFileSync(path.join(payloadDir, fileName));
      return {
        fileName,
        remotePath: fileName,
        data,
      };
    });

    emitImageSyncUploadProgress({
      status: 'stopping-preview',
      message: 'stopping-preview',
      percent: 5,
    });
    if (currentAuth) {
      suppressPreviewErrors = true;
      try {
        try {
          await currentAuth.stopPreview({ skipCommand: true });
        } catch (_error) {}
        currentAuth.cleanup();
      currentAuth = null;
      currentPortInfo = null;
      await delay(250);
      } finally {
        suppressPreviewErrors = false;
      }
    }
    stopPortWatch();
    disconnectHandled = true;
    emitPreviewStatus({
      connected: true,
      authenticated: false,
      previewActive: false,
      portPath: uploadPortPath,
      supportsImageSyncUpload: true,
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
    await connectPassiveImageSyncPreview(uploadPortPath, { resolution });

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

exports.uploadK210ModelTestProgram = async (options = {}) => {
  const uploadPortPath = currentPortPath || previewState.portPath;
  if (!uploadPortPath) {
    throw new Error('Device is not connected.');
  }
  const uploadPortInfo = currentPortInfo || await getPortInfo(uploadPortPath);
  if (!uploadPortInfo?.isCh340) {
    throw new Error('Model test upload is only available for CH340 K210 controller ports.');
  }

  let uploadPort = null;
  emitModelTestUploadProgress({
    status: 'preparing',
    message: 'preparing',
    percent: 0,
  });

  try {
    const payloads = buildModelTestPayloads(options);

    emitModelTestUploadProgress({
      status: 'stopping-preview',
      message: 'stopping-preview',
      percent: 5,
    });
    if (currentAuth) {
      suppressPreviewErrors = true;
      try {
        try {
          await currentAuth.stopPreview({ skipCommand: true });
        } catch (_error) {}
        currentAuth.cleanup();
        currentAuth = null;
        await delay(250);
      } finally {
        suppressPreviewErrors = false;
      }
    }
    stopPortWatch();
    disconnectHandled = true;

    emitModelTestUploadProgress({
      status: 'connecting-raw-repl',
      message: 'connecting-raw-repl',
      percent: 10,
    });
    uploadPort = await openSerialPort(uploadPortPath);
    await enterRawRepl(uploadPort);

    emitModelTestUploadProgress({
      status: 'checking-sd',
      message: 'checking-sd',
      percent: 15,
    });
    await assertSdWritable(uploadPort);

    const fileSpan = 75 / payloads.length;
    for (let index = 0; index < payloads.length; index += 1) {
      const item = payloads[index];
      const base = Math.round(18 + index * fileSpan);
      emitModelTestUploadProgress({
        status: 'uploading',
        message: 'uploading',
        file: item.fileName,
        percent: base,
      });
      if (item.fileName === 'test.kmodel') {
        let uploadedByFastPath = false;
        let lastFastError = null;
        const profiles = getModelTestUploadProfiles(uploadPortInfo);
        for (const profile of profiles) {
          try {
            emitModelTestUploadProgress({
              status: 'uploading',
              message: 'uploading',
              file: `${item.fileName} ${profile.name}`,
              percent: base,
            });
            await writeRemoteFileFastBinary(
              uploadPort,
              item.remotePath,
              item.data,
              base,
              Math.round(fileSpan),
              item.fileName,
              emitModelTestUploadProgress,
              profile
            );
            rememberModelTestUploadProfile(uploadPortInfo, profile);
            uploadedByFastPath = true;
            break;
          } catch (fastError) {
            lastFastError = fastError;
            console.warn('[K210 MODEL TEST][UPLOAD] fast upload failed:', profile.name, fastError.message);
            await closeSerialPort(uploadPort);
            uploadPort = null;
            try {
              await hardwareReset(uploadPortPath);
            } catch (_resetError) {}
            await delay(900);
            uploadPort = await openSerialPort(uploadPortPath);
            await enterRawRepl(uploadPort);
            await assertSdWritable(uploadPort);
          }
        }

        if (!uploadedByFastPath) {
          console.warn('[K210 MODEL TEST][UPLOAD] all fast profiles failed, fallback to base64:', lastFastError?.message || 'unknown');
          emitModelTestUploadProgress({
            status: 'uploading',
            message: 'uploading',
            file: `${item.fileName} compatible`,
            percent: base,
          });
          await writeRemoteFileBase64(
            uploadPort,
            item.remotePath,
            item.data,
            base,
            Math.round(fileSpan),
            item.fileName,
            emitModelTestUploadProgress,
            MODEL_TEST_UPLOAD_CHUNK_SIZE
          );
        }
      } else {
        await writeRemoteFileBase64(
          uploadPort,
          item.remotePath,
          item.data,
          base,
          Math.round(fileSpan),
          item.fileName,
          emitModelTestUploadProgress,
          MODEL_TEST_UPLOAD_CHUNK_SIZE
        );
      }
    }

    emitModelTestUploadProgress({
      status: 'done',
      message: 'done',
      percent: 100,
    });
    await writeAndDrain(uploadPort, Buffer.from([0x02]));
    await delay(100);
    await closeSerialPort(uploadPort);
    uploadPort = null;
    try {
      await hardwareReset(uploadPortPath);
    } catch (resetError) {
      console.warn('[K210 MODEL TEST][UPLOAD] reset after upload failed:', resetError.message);
    }
    disconnectHandled = false;
    currentPortPath = uploadPortPath;
    currentPortInfo = uploadPortInfo;
    startPortWatch(uploadPortPath);
    emitPreviewStatus({
      connected: true,
      authenticated: false,
      previewActive: false,
      portPath: uploadPortPath,
      lastFrameId: -1,
      supportsImageSyncUpload: true,
      error: '',
    });
    return { ok: true };
  } catch (error) {
    await closeSerialPort(uploadPort);
    disconnectHandled = false;
    emitModelTestUploadProgress({
      status: 'failed',
      message: error.message,
      percent: null,
    });
    currentPortPath = '';
    currentPortInfo = null;
    emitPreviewStatus({
      connected: false,
      authenticated: false,
      previewActive: false,
      portPath: '',
      lastFrameId: -1,
      supportsImageSyncUpload: false,
      error: error.message,
    });
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
  currentPortInfo = null;
  emitPreviewStatus({
    connected: false,
    authenticated: false,
    previewActive: false,
    portPath: '',
    lastFrameId: -1,
    supportsImageSyncUpload: false,
    error: '',
  });
  ipcMain.emit('disconnected', { status: 'disconnected' });
  disconnectHandled = false;
};

