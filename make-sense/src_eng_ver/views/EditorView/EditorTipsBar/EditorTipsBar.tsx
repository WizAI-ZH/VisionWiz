import React, {useEffect, useState} from 'react';
import './EditorTipsBar.scss';

const tips: string[] = [
    'Tip: Ctrl+V copies all rectangle labels from the previous image.',
    'Tip: Right-click on the image to paste previous rectangles centered on the mouse position.',
    'Tip: Ctrl+Z / Ctrl+Y undo and redo annotation changes on the current image.',
    'Tip: XML folder exports and rectangle ZIP exports open their output location automatically.',
    'Tip: Natural sorting keeps 1.jpg, 2.jpg, 11.jpg in the expected order.',
    'Tip: AI assistance may need network access to download models or connect services.'
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
        }} title='Hide tips'>x</button>
    </div>;
};

export default EditorTipsBar;
