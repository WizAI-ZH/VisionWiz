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
                <p className='extraBold'>标注文件加载失败</p>  
                <p className='extraBold'>请重试</p>  
            </>;  
        else if (acceptedFiles.length === 0)  
            return <>  
                <input {...getInputProps()} />  
                <img  
                    draggable={false}  
                    alt={'upload'}  
                    src={'./ico/box-opened.png'}  
                />  
                <p className='extraBold'>拖放标注文件</p>  
                <p>或者</p>  
                <p className='extraBold'>点击此处选择</p>  
            </>;  
        else if (labelsList.length === 1)  
            return <>  
                <img  
                    draggable={false}  
                    alt={'uploaded'}  
                    src={'./ico/box-closed.png'}  
                />  
                <p className='extraBold'>仅找到1个标签</p>  
            </>;  
        else  
            return <>  
                <img  
                    draggable={false}  
                    alt={'uploaded'}  
                    src={'./ico/box-closed.png'}  
                />  
                <p className='extraBold'>{labelsList.length} 个标签已找到</p>  
            </>;  
    };

    const renderContent = () => {  
        return (<div className='LoadLabelsPopupContent'>  
            <div className='Message'>  
                加载一个包含您计划使用的标签列表的文本文件。每个标签的名称应以换行符分隔。如果您没有准备好的文件，您可以创建自己的列表。  
            </div>  
            <div {...getRootProps({ className: 'DropZone' })}>  
                {getDropZoneContent()}  
            </div>  
        </div>);  
    };

    return (
        <GenericYesNoPopup  
            title={'加载包含标签描述的文件'}  
            renderContent={renderContent}  
            acceptLabel={'开始项目'}  
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
