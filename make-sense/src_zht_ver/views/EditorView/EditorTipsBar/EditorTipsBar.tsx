import React, {useEffect, useState} from 'react';
import './EditorTipsBar.scss';

const tips: string[] = [
    '提示：Ctrl+V 可以複製上一張圖片的全部矩形框。',
    '提示：在圖片上按右鍵可把上一張圖片的矩形框貼到滑鼠中心位置。',
    '提示：Ctrl+Z / Ctrl+Y 可以復原和重做目前圖片的標註修改。',
    '提示：XML 資料夾匯出和矩形框 ZIP 匯出完成後會自動開啟輸出位置。',
    '提示：自然排序會讓 1.jpg、2.jpg、11.jpg 按正常順序顯示。',
    '提示：AI 協助可能需要網路下載模型或連接推理服務。'
];

interface IProps {
    onClose?: () => void;
}

const EditorTipsBar: React.FC<IProps> = ({onClose}) => {
    const [closed, setClosed] = useState(false);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => setIndex((current) => (current + 1) % tips.length), 12000);
        return () => window.clearInterval(timer);
    }, []);

    if (closed) return null;

    return <div className='EditorTipsBar'>
        <span>{tips[index]}</span>
        <button type='button' onClick={() => {
            setClosed(true);
            !!onClose && onClose();
        }} title='隱藏提示'>x</button>
    </div>;
};

export default EditorTipsBar;
