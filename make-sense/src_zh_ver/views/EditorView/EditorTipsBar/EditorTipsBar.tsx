import React, {useEffect, useState} from 'react';
import './EditorTipsBar.scss';

const tips: string[] = [
    '提示：Ctrl+V 可以复制上一张图片的全部矩形框。',
    '提示：在图片上按右键可把上一张图片的矩形框粘贴到鼠标中心位置。',
    '提示：Ctrl+Z / Ctrl+Y 可以撤销和重做当前图片的标注修改。',
    '提示：XML 文件夹导出和矩形框 ZIP 导出完成后会自动打开输出位置。',
    '提示：自然排序会让 1.jpg、2.jpg、11.jpg 按正常顺序显示。',
    '提示：AI 协助可能需要网络下载模型或连接推理服务。'
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
        }} title='隐藏提示'>x</button>
    </div>;
};

export default EditorTipsBar;
