'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { isValidModelName, validateModelName } = require('../feature/model-name-rules');
const { requestModelTestName } = require('../feature/model-test-name-dialog');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'visionwiz-model-name-'));
const source = fs.readFileSync(path.join(root, 'utils/serialManager.js'), 'utf8');
const api = {};
vm.runInNewContext(source, {
  exports: api, Buffer, console, setTimeout, clearTimeout, setInterval, clearInterval,
  __dirname: path.join(temp, 'utils'),
  process: { cwd: () => temp },
  require: (name) => {
    if (name === 'electron') return { app: { isPackaged: false }, ipcMain: { emit() {} } };
    if (name === 'serialport') return { SerialPort: {} };
    if (name.includes('cryptoservice')) return {};
    if (name === '../feature/model-name-rules') return require('../feature/model-name-rules');
    return require(name);
  },
}, { filename: 'serialManager.js' });

async function main() {
  for (const name of ['test', 'Cats_2026', 'A-b', 'A'.repeat(24)]) {
    assert(isValidModelName(name));
    assert.equal(validateModelName(name), name);
  }
  for (const name of ['', '中文', 'test.kmodel', '../a', 'a/b', 'a\\b', 'a b',
    ' a', 'a ', 'a:', 'a*', 'a?', 'a"', 'a<', 'a>', 'a|', '1model',
    'A'.repeat(25), 'CON', 'nul', 'LPT9', 'COM1', 'é', null]) {
    assert(!isValidModelName(name), String(name));
    assert.throws(() => validateModelName(name));
  }
  const payloadDir = path.join(temp, 'tools/visionwiz_imgreg_test/VESIBIT');
  fs.mkdirSync(payloadDir, { recursive: true });
  for (const file of ['main.py', 'main_cls.py', 'button.mpy', 'usys.mpy']) {
    fs.copyFileSync(path.join(root, 'tools/visionwiz_imgreg_test/VESIBIT', file), path.join(payloadDir, file));
  }
  for (const type of ['classifier', 'detector']) {
    const dir = type + '_fixture';
    const run = path.join(temp, 'trainOutput', dir);
    fs.mkdirSync(run, { recursive: true });
    fs.writeFileSync(path.join(run, 'info.json'), JSON.stringify({ type, input_width: 320, input_height: 224 }));
    fs.writeFileSync(path.join(run, 'mx.kmodel'), Buffer.from([0, 255, 4, 3]));
    fs.writeFileSync(path.join(run, 'mx_labels.txt'), "['cat','dog']");
    fs.writeFileSync(path.join(run, 'mx_anchors.txt'), '[1.2,2.3]');
    assert.equal(api.getModelTestName({ dir }), 'test');
    api.setModelTestName({ dir, modelName: 'Cats_2026' });
    assert.equal(api.getModelTestName({ dir }), 'Cats_2026');
    const payloads = api.buildWirelessModelTestPayloads({ dir });
    const script = payloads[0].data.toString('utf8');
    assert.equal(payloads[0].remotePath, '/sd/visionwiz_model_test.py');
    assert.equal(payloads[0].fileName, 'visionwiz_model_test.py');
    assert(script.includes("kpu.load('/sd/Cats_2026.kmodel')"));
    assert(script.includes('sensor.set_windowing((320,224))'));
    assert(script.includes('import visionwiz_wireless_agent as _vw_agent'),
      'wireless model script must keep the UART agent running');
    assert(script.includes('while _vw_agent._program_mode == "model":'),
      'wireless model script must stop cooperatively on VW_APP:STOP');
    assert(!/^while\s+True:/m.test(script),
      'wireless model test must not keep the camera forever after stop');
    assert(!script.includes('/sd/test.kmodel'));
    assert.equal(payloads[1].remotePath, '/sd/Cats_2026.kmodel');
    assert.equal(payloads[1].fileName, 'Cats_2026.kmodel');
    assert.deepEqual(payloads[1].data, Buffer.from([0, 255, 4, 3]));
    assert.throws(() => api.buildWirelessModelTestPayloads({ dir, modelName: '../bad' }));
    assert.throws(() => api.setModelTestName({ dir, modelName: 'CON' }));
  }
  assert.throws(() => api.getModelTestName({ dir: '../outside' }));
  const dom = new JSDOM('<body><div class="modal" tabindex="-1"><div class="modal-dialog"><div class="modal-content"></div></div></div></body>', { runScripts: 'outside-only' });
  dom.window.eval(fs.readFileSync(require.resolve('bootstrap/dist/js/bootstrap.min.js'), 'utf8'));
  const modal = new dom.window.bootstrap.Modal(dom.window.document.querySelector('.modal'), { keyboard: false });
  modal.show();
  global.document = dom.window.document;
  const calls = [];
  const ipc = { invoke: async (channel, options) => {
    calls.push({ channel, options });
    return channel === 'get-model-test-name' ? 'test' : options.modelName;
  }};
  const result = requestModelTestName(ipc, 'classifier_fixture', { model_test_name_title: 'Name model' });
  await Promise.resolve();
  const input = document.querySelector('input');
  assert(input.closest('.modal.show'), 'dialog must be inside Bootstrap focus trap');
  assert.equal(document.activeElement, input);
  input.value = 'new_model';
  input.dispatchEvent(new dom.window.Event('input'));
  document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  assert.equal(await result, 'new_model');
  assert.equal(calls.at(-1).options.modelName, 'new_model');
  assert.equal(document.querySelector('form'), null);
  const cancelled = requestModelTestName(ipc, 'classifier_fixture');
  await Promise.resolve();
  const invalidInput = document.querySelector('input');
  invalidInput.value = 'bad.name';
  invalidInput.dispatchEvent(new dom.window.Event('input'));
  assert(document.querySelector('button[type=submit]').disabled);
  invalidInput.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(await cancelled, null);
  assert.equal(calls.filter((call) => call.channel === 'set-model-test-name').length, 1);
  modal.hide();
  modal.dispose();
  dom.window.close();
  delete global.document;
  console.log('Model name validation, persistence, payload paths, editable dialog and cancel: PASS');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});
