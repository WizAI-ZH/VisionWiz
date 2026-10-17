'use strict';

const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

app.whenReady().then(() => {
  const root = process.cwd();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'visionwiz-protected-model-'));
  try {
    const api = require('../utils_protected/serialManager_loader');
    const dir = 'classifier_fixture';
    const run = path.join(temp, 'trainOutput', dir);
    fs.mkdirSync(run, { recursive: true });
    fs.writeFileSync(path.join(run, 'info.json'), JSON.stringify({
      type: 'classifier', input_width: 320, input_height: 224
    }));
    fs.writeFileSync(path.join(run, 'mx.kmodel'), Buffer.from([0, 255, 4, 3]));
    fs.writeFileSync(path.join(run, 'mx_labels.txt'), "['cat','dog']");
    process.chdir(temp);
    assert.equal(api.getModelTestName({ dir }), 'test');
    api.setModelTestName({ dir, modelName: 'Cats_2026' });
    const payloads = api.buildWirelessModelTestPayloads({ dir });
    assert.equal(payloads[1].remotePath, '/sd/Cats_2026.kmodel');
    assert(payloads[0].data.toString('utf8').includes("kpu.load('/sd/Cats_2026.kmodel')"));
    assert.throws(() => api.setModelTestName({ dir, modelName: '../bad' }));
    console.log('Protected Electron model-name backend: PASS');
  } finally {
    process.chdir(root);
    fs.rmSync(temp, { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(root, 'out', 'model-name-protected-test.json'),
    JSON.stringify({ passed: true, electron: process.versions.electron, date: new Date().toISOString() }));
  app.exit(0);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
