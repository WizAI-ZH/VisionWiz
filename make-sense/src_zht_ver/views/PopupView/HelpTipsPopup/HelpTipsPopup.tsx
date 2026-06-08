import React from 'react';
import {GenericYesNoPopup} from '../GenericYesNoPopup/GenericYesNoPopup';
import {PopupActions} from '../../../logic/actions/PopupActions';
import './HelpTipsPopup.scss';

const HelpTipsPopup: React.FC = () => {
    const renderContent = () => (
        <div className='HelpTipsPopupContent'>
            <p><strong>快捷鍵</strong></p>
            <p>上一張 / 下一張：A / D 或 Ctrl+左方向鍵 / Ctrl+右方向鍵。</p>
            <p>複製上一張圖片的矩形框：Ctrl+V。復原 / 重做：Ctrl+Z / Ctrl+Y。</p>
            <p>在圖片上按右鍵：把上一張圖片的矩形框貼到滑鼠中心位置。</p>
            <p>刪除選中標註：Delete。快速設定類別：Ctrl+1 到 Ctrl+0。</p>
            <p><strong>使用提示</strong></p>
            <p>圖片名包含數字時建議使用自然排序，例如 1.jpg、2.jpg、11.jpg。</p>
            <p>XML 資料夾匯出和矩形框 ZIP 匯出完成後會自動開啟輸出位置。</p>
            <p>AI 協助可能需要網路來下載瀏覽器模型或連接推理服務。</p>
        </div>
    );

    return <GenericYesNoPopup
        title='快捷鍵與使用提示'
        renderContent={renderContent}
        rejectLabel='關閉'
        onReject={PopupActions.close}
        skipAcceptButton={true}
    />;
};

export default HelpTipsPopup;
