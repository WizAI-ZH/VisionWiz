'use strict';

const MODEL_NAME_MAX_LENGTH = 24;

function isValidModelName(value) {
  return typeof value === 'string'
    && /^[A-Za-z][A-Za-z0-9_-]{0,23}$/.test(value)
    && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(value);
}

function validateModelName(value) {
  if (!isValidModelName(value)) {
    throw new Error('Model name must start with an English letter, use only English letters, digits, _ or -, and be at most 24 characters. Reserved filenames are not allowed.');
  }
  return value;
}

module.exports = { MODEL_NAME_MAX_LENGTH, isValidModelName, validateModelName };
