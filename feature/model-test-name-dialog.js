'use strict';

const { MODEL_NAME_MAX_LENGTH, isValidModelName } = require('./model-name-rules');

async function requestModelTestName(ipcRenderer, dir, locales = {}) {
  const initialValue = await ipcRenderer.invoke('get-model-test-name', { dir });
  return new Promise((resolve) => {
    const parent = document.querySelector('.modal.show') || document.body;
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:4100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.38);padding:16px;';
    const dialog = document.createElement('form');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.style.cssText = 'width:430px;max-width:100%;padding:22px;border-radius:8px;background:#fff;color:#212529;box-shadow:0 12px 36px rgba(0,0,0,.22);';
    const title = document.createElement('h3');
    title.id = 'model-test-name-title';
    title.style.cssText = 'font-size:20px;margin:0 0 16px;';
    title.textContent = locales.model_test_name_title || 'Name this model';
    dialog.setAttribute('aria-labelledby', title.id);
    const input = document.createElement('input');
    input.className = 'form-control';
    input.type = 'text';
    input.maxLength = MODEL_NAME_MAX_LENGTH;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = initialValue;
    input.setAttribute('aria-label', title.textContent);
    const hint = document.createElement('p');
    hint.id = 'model-test-name-rules';
    hint.style.cssText = 'margin:12px 0 0;font-size:14px;color:#495057;';
    hint.textContent = locales.model_test_name_rules || 'Start with an English letter. Use letters, digits, _ or -; up to 24 characters. No reserved filenames.';
    input.setAttribute('aria-describedby', hint.id);
    const suffix = document.createElement('div');
    suffix.style.cssText = 'margin-top:8px;font-size:14px;color:#495057;overflow-wrap:anywhere;';
    const error = document.createElement('div');
    error.setAttribute('role', 'alert');
    error.style.cssText = 'margin-top:8px;font-size:14px;color:#b02a37;';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:18px;';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-secondary';
    cancel.textContent = locales.capture_rename_cancel || 'Cancel';
    const confirm = document.createElement('button');
    confirm.type = 'submit';
    confirm.className = 'btn btn-primary';
    confirm.textContent = locales.model_test_name_confirm || 'Use this name';
    let saving = false;
    const validate = () => {
      const valid = isValidModelName(input.value);
      input.setAttribute('aria-invalid', String(!valid));
      suffix.textContent = `${input.value || 'test'}.kmodel`;
      error.textContent = valid ? '' : (locales.model_test_name_rules || 'Start with an English letter. Use letters, digits, _ or -; up to 24 characters. No reserved filenames.');
      confirm.disabled = saving || !valid;
      return valid;
    };
    const close = (value) => {
      overlay.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(value);
    };
    cancel.addEventListener('click', () => { if (!saving) close(null); });
    overlay.addEventListener('click', (event) => { if (event.target === overlay && !saving) close(null); });
    overlay.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!saving) close(null);
      } else if (event.key === 'Tab') {
        const controls = [input, cancel, confirm].filter((control) => !control.disabled);
        const index = controls.indexOf(document.activeElement);
        if ((event.shiftKey && index <= 0) || (!event.shiftKey && index === controls.length - 1)) {
          event.preventDefault();
          controls[event.shiftKey ? controls.length - 1 : 0].focus();
        }
      }
    });
    input.addEventListener('input', validate);
    dialog.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving || !validate()) return;
      saving = true;
      input.disabled = true;
      cancel.disabled = true;
      validate();
      try {
        const modelName = input.value;
        await ipcRenderer.invoke('set-model-test-name', { dir, modelName });
        close(modelName);
      } catch (failure) {
        saving = false;
        input.disabled = false;
        cancel.disabled = false;
        validate();
        error.textContent = failure.message;
        input.focus();
      }
    });
    actions.append(cancel, confirm);
    dialog.append(title, input, suffix, hint, error, actions);
    overlay.append(dialog);
    parent.append(overlay);
    validate();
    input.focus();
    input.select();
  });
}

module.exports = { requestModelTestName };
