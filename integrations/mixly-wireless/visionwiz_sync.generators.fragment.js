// VisionWiz Wi-Fi uses the boot agent's UART1 and NEVER opens UARTHS.
// Append to existing generators/visionwiz_sync.js without changing USB blocks.
function visionwizWirelessImport() {
    Blockly.Python.definitions_['import_visionwiz_wireless_agent'] =
        'import visionwiz_wireless_agent as _visionwiz_wireless';
}

function visionwizWirelessArgs(block) {
    var width = Blockly.Python.valueToCode(block, 'WIDTH', Blockly.Python.ORDER_ATOMIC) || '320';
    var height = Blockly.Python.valueToCode(block, 'HEIGHT', Blockly.Python.ORDER_ATOMIC) || '240';
    var quality = Blockly.Python.valueToCode(block, 'QUALITY', Blockly.Python.ORDER_ATOMIC) || '35';
    var fps = Blockly.Python.valueToCode(block, 'FPS', Blockly.Python.ORDER_ATOMIC) || '2';
    var showLcd = Blockly.Python.valueToCode(block, 'SHOW_LCD', Blockly.Python.ORDER_ATOMIC) || 'True';
    return width + ', ' + height + ', ' + quality + ', ' + fps + ', ' + showLcd;
}

Blockly.Python.forBlock['visionwiz_wireless_start'] = function() {
    visionwizWirelessImport();
    return '_visionwiz_wireless.wireless_preview_start(' + visionwizWirelessArgs(this) + ')\n';
};

Blockly.Python.forBlock['visionwiz_wireless_configure'] = function() {
    visionwizWirelessImport();
    return '_visionwiz_wireless.wireless_preview_configure(' + visionwizWirelessArgs(this) + ')\n';
};

Blockly.Python.forBlock['visionwiz_wireless_stop'] = function() {
    visionwizWirelessImport();
    return '_visionwiz_wireless.wireless_preview_stop()\n';
};

Blockly.Python.forBlock['visionwiz_wireless_active'] = function() {
    visionwizWirelessImport();
    return ['_visionwiz_wireless.wireless_preview_active()', Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python.forBlock['visionwiz_wireless_status'] = function() {
    visionwizWirelessImport();
    return ['_visionwiz_wireless.wireless_preview_status()', Blockly.Python.ORDER_ATOMIC];
};
