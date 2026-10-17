'use strict';

// The K210 preview protocol transmits JPEG bytes. Some existing firmware
// versions still send QVGA JPEGs even after acknowledging a 320x224/224x224
// preview configuration. This is a CAPTURE-TIME fallback, not a per-frame
// conversion: live preview FPS and the original on-device JPEG stay intact.

const BOARD_CAPTURE_RESOLUTIONS = Object.freeze({
  '320x240': Object.freeze({ width: 320, height: 240 }),
  '320x224': Object.freeze({ width: 320, height: 224 }),
  '224x224': Object.freeze({ width: 224, height: 224 }),
});

function getBoardCaptureSize(width, height) {
  const key = String(Number(width)) + 'x' + String(Number(height));
  return BOARD_CAPTURE_RESOLUTIONS[key] || null;
}

function centeredCoverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const numbers = [sourceWidth, sourceHeight, targetWidth, targetHeight].map(Number);
  if (numbers.some((number) => !Number.isFinite(number) || number <= 0)) {
    throw new Error('Invalid image dimensions for capture.');
  }
  const [sw, sh, tw, th] = numbers;
  const sourceRatio = sw / sh;
  const targetRatio = tw / th;
  const cropWidth = sourceRatio > targetRatio ? sh * targetRatio : sw;
  const cropHeight = sourceRatio > targetRatio ? sh : sw / targetRatio;
  return {
    sx: (sw - cropWidth) / 2,
    sy: (sh - cropHeight) / 2,
    sw: cropWidth,
    sh: cropHeight,
    width: tw,
    height: th,
  };
}

async function normalizeJpegCapture(dataUrl, width, height, environment = {}) {
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(String(dataUrl || ''))) {
    throw new Error('The controller preview does not contain a valid JPEG.');
  }
  if (!getBoardCaptureSize(width, height)) {
    throw new Error('Unsupported K210 capture resolution.');
  }
  const ImageClass = environment.Image || (typeof Image === 'function' ? Image : null);
  const documentObject = environment.document || (typeof document !== 'undefined' ? document : null);
  if (!ImageClass || !documentObject) {
    throw new Error('Camera capture requires image decoding and a canvas.');
  }
  const img = new ImageClass();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Cannot decode the controller JPEG frame.'));
    img.src = dataUrl;
  });
  const originalWidth = Number(img.naturalWidth || img.width);
  const originalHeight = Number(img.naturalHeight || img.height);
  if (!originalWidth || !originalHeight) {
    throw new Error('Controller JPEG contains no readable image dimensions.');
  }
  if (originalWidth === width && originalHeight === height) {
    return { dataUrl, originalWidth, originalHeight, converted: false };
  }
  const canvas = documentObject.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to prepare the capture image canvas.');
  const crop = centeredCoverCrop(originalWidth, originalHeight, width, height);
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
  const normalized = canvas.toDataURL('image/jpeg', 0.92);
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(normalized)) {
    throw new Error('Unable to encode the JPEG at the requested resolution.');
  }
  return { dataUrl: normalized, originalWidth, originalHeight, converted: true };
}

module.exports = {
  BOARD_CAPTURE_RESOLUTIONS,
  getBoardCaptureSize,
  centeredCoverCrop,
  normalizeJpegCapture,
};
