'use strict';

/**
 * Describes the image source actually displayed in the capture preview.
 * A verified/connected board is NOT a streaming camera until a JPEG arrives.
 * Local USB webcams and the K210 (USB or Wi-Fi image sync) share one selector.
 */
function getCameraSourceStatus({ board = {}, hasBoardFrame = false, local = {} } = {}, translations = {}) {
  if (board.connected && board.previewActive && !board.error && hasBoardFrame) {
    return {
      kind: 'vesibit',
      label: translations.vesibit_camera_streaming || 'VESIBIT 摄像头同传中',
      connected: true,
    };
  }

  if (local.active) {
    return {
      kind: 'local',
      label: String(local.label || translations.local_camera_preview_title || 'Local Camera'),
      connected: true,
    };
  }

  return {
    kind: 'none',
    label: translations.connect_camera || '选择要连接的摄像头',
    connected: false,
  };
}

function applyCameraSourceStatus(button, status) {
  if (!button) return;
  button.textContent = status.label;
  button.classList.toggle('btn-success', status.connected);
  button.classList.toggle('btn-danger', !status.connected);
  button.dataset.cameraSource = status.kind;
  button.setAttribute('aria-label', status.label);
  button.title = status.label;
}

module.exports = { getCameraSourceStatus, applyCameraSourceStatus };
