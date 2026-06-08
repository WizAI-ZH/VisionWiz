(function () {
    const { ipcRenderer } = require('electron');
    const nodePath = require('path');

    let miniLedEditorPath = '';
    let wizResizerPath = '';

    ipcRenderer.send('get_app_path', 'toolSet');

    ipcRenderer.on('get_app_path_reply', (_event, appPath) => {
        miniLedEditorPath = nodePath.join(appPath, 'tools', 'miniLEDdisplay_adv', 'BmpBadge.exe');
        wizResizerPath = nodePath.join(appPath, 'tools', 'WizResizer.exe');
    });

    document.getElementById('btn_open_mini_led_editor').onclick = function () {
        ipcRenderer.send('open_tool', miniLedEditorPath);
    };

    document.getElementById('btn_open_wiz_resizer').onclick = function () {
        ipcRenderer.send('open_tool', wizResizerPath);
    };

    ipcRenderer.on('reply_open_tool', (_event, toolPath) => {
        console.log('Tool path: ', toolPath);
    });

    document.getElementById('btn_open_make_sense').addEventListener('click', function () {
        ipcRenderer.send('open_make_sense');
    });

    document.getElementById('btn_open_learn_make_sense').addEventListener('click', function () {
        ipcRenderer.send('open_website', 'https://vesibit.yuque.com/ednd8n/rp34u1/zebgq4p81pu6vftt');
    });
})();
