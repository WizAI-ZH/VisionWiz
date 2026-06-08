import React from 'react';
import {GenericYesNoPopup} from '../GenericYesNoPopup/GenericYesNoPopup';
import {PopupActions} from '../../../logic/actions/PopupActions';
import './HelpTipsPopup.scss';

const HelpTipsPopup: React.FC = () => {
    const renderContent = () => (
        <div className='HelpTipsPopupContent'>
            <p><strong>Shortcuts</strong></p>
            <p>Previous / next image: A / D or Ctrl+Left / Ctrl+Right.</p>
            <p>Copy previous image rectangles: Ctrl+V. Undo / redo: Ctrl+Z / Ctrl+Y.</p>
            <p>Right-click on the image to paste previous rectangles centered on the mouse position.</p>
            <p>Delete selected annotation: Delete. Assign labels: Ctrl+1 to Ctrl+0.</p>
            <p><strong>Tips</strong></p>
            <p>Use natural sorting when image names contain numbers, for example 1.jpg, 2.jpg, 11.jpg.</p>
            <p>XML folder exports and rectangle ZIP exports open the output location automatically after export.</p>
            <p>AI assistance may need network access to download browser models or connect to an inference service.</p>
        </div>
    );

    return <GenericYesNoPopup
        title='Shortcuts and tips'
        renderContent={renderContent}
        rejectLabel='Close'
        onReject={PopupActions.close}
        skipAcceptButton={true}
    />;
};

export default HelpTipsPopup;
