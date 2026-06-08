import React from 'react';
import {GenericYesNoPopup} from '../GenericYesNoPopup/GenericYesNoPopup';
import {PopupActions} from '../../../logic/actions/PopupActions';
import './HelpTipsPopup.scss';

const HelpTipsPopup: React.FC = () => {
    const renderContent = () => (
        <div className='HelpTipsPopupContent'>
            <p><strong>快捷键</strong></p>
            <p>上一张 / 下一张：A / D 或 Ctrl+左方向键 / Ctrl+右方向键。</p>
            <p>复制上一张图片的矩形框：Ctrl+V。撤销 / 重做：Ctrl+Z / Ctrl+Y。</p>
            <p>在图片上按右键：把上一张图片的矩形框粘贴到鼠标中心位置。</p>
            <p>删除选中标注：Delete。快速设置类别：Ctrl+1 到 Ctrl+0。</p>
            <p><strong>使用提示</strong></p>
            <p>图片名包含数字时建议使用自然排序，例如 1.jpg、2.jpg、11.jpg。</p>
            <p>XML 文件夹导出和矩形框 ZIP 导出完成后会自动打开输出位置。</p>
            <p>AI 协助可能需要网络来下载浏览器模型或连接推理服务。</p>
        </div>
    );

    return <GenericYesNoPopup
        title='快捷键与使用提示'
        renderContent={renderContent}
        rejectLabel='关闭'
        onReject={PopupActions.close}
        skipAcceptButton={true}
    />;
};

export default HelpTipsPopup;
