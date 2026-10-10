// VisionWiz wireless preview blocks (append to existing blocks/visionwiz_sync.js).
// USB blocks remain unchanged. Requires the K210 VisionWiz wireless boot agent.
Blockly.Blocks['visionwiz_wireless_start'] = {
    init: function() {
        this.setColour(195);
        this.appendDummyInput().appendField(Blockly.Msg.VESIBIT_WIRELESS_PREVIEW_START || '开启无线图传');
        this.appendValueInput('WIDTH').setCheck(Number).appendField(Blockly.Msg.VESIBIT_IMAGE_SYNC_WIDTH);
        this.appendValueInput('HEIGHT').setCheck(Number).appendField(Blockly.Msg.VESIBIT_IMAGE_SYNC_HEIGHT);
        this.appendValueInput('QUALITY').setCheck(Number).appendField(Blockly.Msg.VESIBIT_IMAGE_SYNC_QUALITY);
        this.appendValueInput('FPS').setCheck(Number).appendField(Blockly.Msg.VESIBIT_IMAGE_SYNC_FPS);
        this.appendValueInput('SHOW_LCD').appendField(Blockly.Msg.VESIBIT_IMAGE_SYNC_SHOW_LCD);
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip(Blockly.Msg.VESIBIT_WIRELESS_PREVIEW_START_TOOLTIP || 'Use the installed Wi-Fi agent; no UARTHS initialization.');
    }
};

Blockly.Blocks['visionwiz_wireless_configure'] = {
    init: function() {
        this.setColour(195);
        this.appendDummyInput().appendField(Blockly.Msg.VESIBIT_WIRELESS_PREVIEW_CONFIGURE || '调整无线图传');
        this.appendValueInput('WIDTH').setCheck(Number).appendField(Blockly.Msg.VESIBIT_IMAGE_SYNC_WIDTH);
        this.appendValueInput('HEIGHT').setCheck(Number).appendField(Blockly.Msg.VESIBIT_IMAGE_SYNC_HEIGHT);
        this.appendValueInput('QUALITY').setCheck(Number).appendField(Blockly.Msg.VESIBIT_IMAGE_SYNC_QUALITY);
        this.appendValueInput('FPS').setCheck(Number).appendField(Blockly.Msg.VESIBIT_IMAGE_SYNC_FPS);
        this.appendValueInput('SHOW_LCD').appendField(Blockly.Msg.VESIBIT_IMAGE_SYNC_SHOW_LCD);
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip(Blockly.Msg.VESIBIT_WIRELESS_PREVIEW_CONFIGURE_TOOLTIP || 'Change Wi-Fi JPEG camera parameters.');
    }
};

Blockly.Blocks['visionwiz_wireless_stop'] = {
    init: function() {
        this.setColour(195);
        this.appendDummyInput().appendField(Blockly.Msg.VESIBIT_WIRELESS_PREVIEW_STOP || '停止无线图传');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip(Blockly.Msg.VESIBIT_WIRELESS_PREVIEW_STOP_TOOLTIP || 'Stop the wireless camera, leaving the connection agent alive.');
    }
};

Blockly.Blocks['visionwiz_wireless_active'] = {
    init: function() {
        this.setColour(195);
        this.appendDummyInput().appendField(Blockly.Msg.VESIBIT_WIRELESS_PREVIEW_ACTIVE || '无线图传是否运行');
        this.setOutput(true, 'Boolean');
        this.setTooltip(Blockly.Msg.VESIBIT_WIRELESS_PREVIEW_ACTIVE_TOOLTIP || 'Board-side state only; not a confirmation that the PC received an image.');
    }
};

Blockly.Blocks['visionwiz_wireless_status'] = {
    init: function() {
        this.setColour(195);
        this.appendDummyInput().appendField(Blockly.Msg.VESIBIT_WIRELESS_PREVIEW_STATUS || '读取无线图传状态');
        this.setOutput(true);
        this.setTooltip(Blockly.Msg.VESIBIT_WIRELESS_PREVIEW_STATUS_TOOLTIP || 'Return active/mode/width/height/quality/fps/frame_id.');
    }
};
