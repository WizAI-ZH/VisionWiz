import React, { useState } from 'react';
import './LoadLabelNamesPopup.scss';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { updateLabelNames } from '../../../store/labels/actionCreators';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { PopupWindowType } from '../../../data/enums/PopupWindowType';
import { updateActivePopupType } from '../../../store/general/actionCreators';
import { useDropzone } from 'react-dropzone';
import { LabelName } from '../../../store/labels/types';
import { YOLOUtils } from '../../../logic/import/yolo/YOLOUtils';
import {LabelNamesNotUniqueError} from '../../../logic/import/yolo/YOLOErrors';
import {NotificationUtil} from '../../../utils/NotificationUtil';
import {NotificationsDataMap} from '../../../data/info/NotificationsData';
import {Notification} from '../../../data/enums/Notification';
import {submitNewNotification} from '../../../store/notifications/actionCreators';
import {INotification} from '../../../store/notifications/types';
 
interface IProps {
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
    updateLabelNamesAction: (labels: LabelName[]) => any;
    submitNewNotificationAction: (notification: INotification) => any;
}

const LoadLabelNamesPopup: React.FC<IProps> = (
    { updateActivePopupTypeAction, updateLabelNamesAction, submitNewNotificationAction }
) => {
    const [labelsList, setLabelsList] = useState([]);
    const [invalidFileLoadedStatus, setInvalidFileLoadedStatus] = useState(false);

    const onSuccess = (labels: LabelName[]) => {
        setLabelsList(labels);
        setInvalidFileLoadedStatus(false);
    };

    const onFailure = (error: Error) => {
        setInvalidFileLoadedStatus(true);
        if (error instanceof LabelNamesNotUniqueError) {
            submitNewNotificationAction(NotificationUtil
                .createErrorNotification(NotificationsDataMap[Notification.NON_UNIQUE_LABEL_NAMES_ERROR]));
        }
    };

    const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
        accept: { 'text/plain': ['.txt'] },
        multiple: false,
        onDrop: (accepted) => {
            if (accepted.length === 1) {
                YOLOUtils.loadLabelsList(accepted[0], onSuccess, onFailure);
            }
        }
    });


    const onAccept = () => {
        if (labelsList.length > 0) {
            updateLabelNamesAction(labelsList);
            updateActivePopupTypeAction(null);
        }
    };

    const onReject = () => {
        updateActivePopupTypeAction(PopupWindowType.INSERT_LABEL_NAMES);
    };

    const getDropZoneContent = () => {  
        if (invalidFileLoadedStatus)  
            return <>  
                <input {...getInputProps()} />  
                <img  
                    draggable={false}  
                    alt={'upload'}  
                    src={'./ico/box-opened.png'}  
                />  
                <p className='extraBold'>標註文件加載失敗</p>  
                <p className='extraBold'>請重試</p>  
            </>;  
        else if (acceptedFiles.length === 0)  
            return <>  
                <input {...getInputProps()} />  
                <img  
                    draggable={false}  
                    alt={'upload'}  
                    src={'./ico/box-opened.png'}  
                />  
                <p className='extraBold'>拖放標註文件</p>  
                <p>或者</p>  
                <p className='extraBold'>點擊此處選擇</p>  
            </>;  
        else if (labelsList.length === 1)  
            return <>  
                <img  
                    draggable={false}  
                    alt={'uploaded'}  
                    src={'./ico/box-closed.png'}  
                />  
                <p className='extraBold'>僅找到1個標籤</p>  
            </>;  
        else  
            return <>  
                <img  
                    draggable={false}  
                    alt={'uploaded'}  
                    src={'./ico/box-closed.png'}  
                />  
                <p className='extraBold'>{labelsList.length} 個標籤已找到</p>  
            </>;  
    };

    const renderContent = () => {  
        return (<div className='LoadLabelsPopupContent'>  
            <div className='Message'>  
                加載一個包含您計劃使用的標籤列表的文本文件。每個標籤的名稱應以換行符分隔。如果您沒有準備好的文件，您可以創建自己的列表。  
            </div>  
            <div {...getRootProps({ className: 'DropZone' })}>  
                {getDropZoneContent()}  
            </div>  
        </div>);  
    };

    return (
        <GenericYesNoPopup  
            title={'加載包含標籤描述的文件'}  
            renderContent={renderContent}  
            acceptLabel={'開始項目'}  
            onAccept={onAccept}  
            disableAcceptButton={labelsList.length === 0}  
            rejectLabel={'返回'}  
            onReject={onReject}  
        />
    );
};

const mapDispatchToProps = {
    updateActivePopupTypeAction: updateActivePopupType,
    updateLabelNamesAction: updateLabelNames,
    submitNewNotificationAction: submitNewNotification
};

const mapStateToProps = (state: AppState) => ({});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LoadLabelNamesPopup);
