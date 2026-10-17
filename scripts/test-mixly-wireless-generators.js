'use strict';

// Test fragments intended for Mixly, without editing the user's installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const integration = path.join(__dirname, '..', 'integrations', 'mixly-wireless');
const blockCode = fs.readFileSync(path.join(integration, 'visionwiz_sync.blocks.fragment.js'), 'utf8');
const generatorCode = fs.readFileSync(path.join(integration, 'visionwiz_sync.generators.fragment.js'), 'utf8');
const Blockly = {
  Blocks: {},
  Msg: {
    VESIBIT_IMAGE_SYNC_WIDTH: 'width',
    VESIBIT_IMAGE_SYNC_HEIGHT: 'height',
    VESIBIT_IMAGE_SYNC_QUALITY: 'quality',
    VESIBIT_IMAGE_SYNC_FPS: 'fps',
    VESIBIT_IMAGE_SYNC_SHOW_LCD: 'lcd',
  },
  Python: {
    forBlock: {},
    definitions_: {},
    ORDER_ATOMIC: 0,
    valueToCode(block, key) { return (block.values || {})[key] || ''; },
  },
};
vm.runInNewContext(blockCode + '\n' + generatorCode, { Blockly, Number }, {
  filename: 'Mixly wireless fragments',
});

const blockTypes = ['visionwiz_wireless_start', 'visionwiz_wireless_configure',
  'visionwiz_wireless_stop', 'visionwiz_wireless_active', 'visionwiz_wireless_status'];

for (const type of blockTypes) {
  assert.equal(typeof Blockly.Blocks[type].init, 'function', type + ': missing block');
  assert.equal(typeof Blockly.Python.forBlock[type], 'function', type + ': missing code generator');
}

const fakeBlock = { values: { WIDTH: '320', HEIGHT: '224', QUALITY: '40', FPS: '3', SHOW_LCD: 'False' } };
const generate = (type, block = fakeBlock) => Blockly.Python.forBlock[type].call(block);
assert.equal(generate('visionwiz_wireless_start'),
  '_visionwiz_wireless.wireless_preview_start(320, 224, 40, 3, False)\n');
assert.equal(generate('visionwiz_wireless_configure'),
  '_visionwiz_wireless.wireless_preview_configure(320, 224, 40, 3, False)\n');
assert.equal(generate('visionwiz_wireless_stop'),
  '_visionwiz_wireless.wireless_preview_stop()\n');
assert.equal(generate('visionwiz_wireless_start', { values: {} }),
  '_visionwiz_wireless.wireless_preview_start(320, 240, 25, 6, True)\n');
assert.equal(generate('visionwiz_wireless_active')[0],
  '_visionwiz_wireless.wireless_preview_active()');
assert.equal(generate('visionwiz_wireless_status')[0],
  '_visionwiz_wireless.wireless_preview_status()');
assert.equal(Blockly.Python.definitions_.import_visionwiz_wireless_agent,
  'import visionwiz_wireless_agent as _visionwiz_wireless');
for (const type of blockTypes) {
  assert(!String(generate(type)).includes('UARTHS'), 'Wireless block must not open USB UARTHS');
}
console.log('[PASS] five Mixly wireless blocks produce the correct agent API calls');
console.log('[PASS] custom/default resolution, shared import and no extra UART');
