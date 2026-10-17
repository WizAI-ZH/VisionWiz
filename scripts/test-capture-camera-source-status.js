'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const {
  getCameraSourceStatus,
  applyCameraSourceStatus,
} = require('../feature/camera-source-status');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'feature', 'data-collection.html'), 'utf8');
const dom = new JSDOM(html);
const button = dom.window.document.getElementById('cbtn');
assert(button && button.classList.contains('dropdown-toggle'), 'camera selector must retain its dropdown');

const translations = Object.fromEntries(
  ['zh', 'zht', 'en'].map((lang) => [
    lang,
    JSON.parse(fs.readFileSync(path.join(root, 'locales', lang + '.json'), 'utf8')),
  ])
);

const local = { active: true, label: 'HP True Vision FHD Camera (0408:5487)' };
const connectedBoard = { connected: true, authenticated: true, previewActive: true, connectionType: 'usb', error: '' };
for (const lang of Object.keys(translations)) {
  const text = translations[lang];
  assert(text.vesibit_camera_streaming, 'Missing VESIBIT camera label: ' + lang);
  const absent = getCameraSourceStatus({ board: {}, hasBoardFrame: false }, text);
  assert.equal(absent.kind, 'none');
  applyCameraSourceStatus(button, absent);
  assert(button.classList.contains('btn-danger'));
  assert(!button.classList.contains('btn-success'));
  assert.equal(button.textContent, text.connect_camera);

  // An authenticated device and a START ACK alone do NOT make an image stream.
  const waiting = getCameraSourceStatus({ board: connectedBoard, hasBoardFrame: false }, text);
  assert.equal(waiting.kind, 'none');
  const streaming = getCameraSourceStatus({ board: connectedBoard, hasBoardFrame: true }, text);
  assert.equal(streaming.kind, 'vesibit');
  assert.equal(streaming.label, text.vesibit_camera_streaming);
  applyCameraSourceStatus(button, streaming);
  assert(button.classList.contains('btn-success'));
  assert(!button.classList.contains('btn-danger'));
  assert.equal(button.textContent, text.vesibit_camera_streaming);
  assert.equal(button.getAttribute('data-camera-source'), 'vesibit');
  assert.equal(button.getAttribute('aria-label'), text.vesibit_camera_streaming);
  assert(button.classList.contains('dropdown-toggle'), 'Camera dropdown must still work');

  // USB and Wi-Fi image sync follow precisely the same policy.
  for (const connectionType of ['usb', 'wireless']) {
    assert.equal(getCameraSourceStatus({
      board: { ...connectedBoard, connectionType },
      hasBoardFrame: true,
      local,
    }, text).kind, 'vesibit');
  }
  // Stopping/disconnecting/errored camera must not leave a green VESIBIT label.
  for (const board of [
    { ...connectedBoard, previewActive: false },
    { ...connectedBoard, connected: false },
    { ...connectedBoard, error: 'disconnected' },
  ]) {
    const fallback = getCameraSourceStatus({ board, hasBoardFrame: true, local }, text);
    assert.equal(fallback.kind, 'local');
    applyCameraSourceStatus(button, fallback);
    assert.equal(button.textContent, local.label);
    assert(button.classList.contains('btn-success'));
    const empty = getCameraSourceStatus({ board, hasBoardFrame: false }, text);
    applyCameraSourceStatus(button, empty);
    assert.equal(empty.kind, 'none');
    assert(button.classList.contains('btn-danger'));
  }
  console.log('[PASS]', lang, 'camera streaming, USB/wireless, local fallback, stop/disconnect');
}

const renderer = fs.readFileSync(path.join(root, 'feature', 'data-collection_renderer.js'), 'utf8');
assert(renderer.includes("const cameraSourceSelector = document.getElementById('cbtn')"));
assert(renderer.includes('function refreshCameraSourceSelector()'));
assert(renderer.includes('refreshPreviewSurface();'));
assert(renderer.includes('} else if (!hadPreviewFrame)'));
assert(renderer.includes('refreshCameraSourceSelector();'));
console.log('[PASS] actual capture UI wires incoming first JPEG and status/language refresh to source selector');
