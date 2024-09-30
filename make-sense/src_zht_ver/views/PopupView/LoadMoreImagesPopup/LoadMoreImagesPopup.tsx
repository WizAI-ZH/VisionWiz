import React from 'react';
import './LoadMoreImagesPopup.scss';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { addImageData } from '../../../store/labels/actionCreators';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { useDropzone } from 'react-dropzone';
import { ImageData } from '../../../store/labels/types';
import { PopupActions } from '../../../logic/actions/PopupActions';
import { ImageDataUtil } from '../../../utils/ImageDataUtil';

interface IProps {
    addImageData: (imageData: ImageData[]) => any;
}

const LoadMoreImagesPopup: React.FC<IProps> = ({ addImageData }) => {
    const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
        accept: {
            'image/*': ['.jpeg', '.png']
        }
    });

    const onAccept = () => {
        if (acceptedFiles.length > 0) {
            addImageData(acceptedFiles.map((fileData: File) => ImageDataUtil.createImageDataFromFileData(fileData)));
            PopupActions.close();
        }
    };

    const onReject = () => {
        PopupActions.close();
    };

    const getDropZoneContent = () => {
        if (acceptedFiles.length === 0)
            return <>
                <input {...getInputProps()} />
                <img
                    draggable={false}
                    alt={'upload'}
                    src={'./ico/box-opened.png'}
                />
                <p className='extraBold'>添加新圖片</p>
                <p>或者</p>
                <p className='extraBold'>點擊此處選擇</p>
            </>;
        else if (acceptedFiles.length === 1)
            return <>
                <img
                    draggable={false}
                    alt={'uploaded'}
                    src={'./ico/box-closed.png'}
                />
                <p className='extraBold'>1 張新圖片加載成功</p>
            </>;
        else
            return <>
                <img
                    draggable={false}
                    key={1}
                    alt={'uploaded'}
                    src={'./ico/box-closed.png'}
                />
                <p key={2} className='extraBold'>{acceptedFiles.length} 張新圖片加載成功</p>
            </>;
    };

    const renderContent = () => {
        return (<div className='LoadMoreImagesPopupContent'>
            <div {...getRootProps({ className: 'DropZone' })}>
                {getDropZoneContent()}
            </div>
        </div>);
    };

    return (
        <GenericYesNoPopup
            title={'加載更多圖片'}
            renderContent={renderContent}
            acceptLabel={'加載'}
            disableAcceptButton={acceptedFiles.length < 1}
            onAccept={onAccept}
            rejectLabel={'取消'}
            onReject={onReject}
        />
    );
};

const mapDispatchToProps = {
    addImageData
};

const mapStateToProps = (state: AppState) => ({});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LoadMoreImagesPopup);