import { ContextType } from '../../../data/enums/ContextType';
import './EditorTopNavigationBar.scss';
import React from 'react';
import classNames from 'classnames';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { updateCrossHairVisibleStatus, updateImageDragModeStatus } from '../../../store/general/actionCreators';
import { GeneralSelector } from '../../../store/selectors/GeneralSelector';
import { ViewPointSettings } from '../../../settings/ViewPointSettings';
import { ImageButton } from '../../Common/ImageButton/ImageButton';
import { ViewPortActions } from '../../../logic/actions/ViewPortActions';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';
import { LabelType } from '../../../data/enums/LabelType';
import { AISelector } from '../../../store/selectors/AISelector';
import { ISize } from '../../../interfaces/ISize';
import { AIActions } from '../../../logic/actions/AIActions';
import { Fade, styled, Tooltip, tooltipClasses, TooltipProps } from '@mui/material';
const BUTTON_SIZE: ISize = { width: 30, height: 30 };
const BUTTON_PADDING: number = 10;

const StyledTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
  ))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: '#171717',
        color: '#ffffff',
        boxShadow: theme.shadows[1],
        fontSize: 12,
        maxWidth: 200,
        textAlign: 'center'
    },
  }));

const getButtonWithTooltip = (
    key: string,
    tooltipMessage: string,
    imageSrc: string,
    imageAlt: string,
    isActive: boolean,
    href?: string,
    onClick?: () => any
): React.ReactElement => {
    return <StyledTooltip
        key={key}
        disableFocusListener={true}
        title={tooltipMessage}
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 600 }}
        placement='bottom'
    >
        <div>
            <ImageButton
                buttonSize={BUTTON_SIZE}
                padding={BUTTON_PADDING}
                image={imageSrc}
                imageAlt={imageAlt}
                href={href}
                onClick={onClick}
                isActive={isActive}
            />
        </div>
    </StyledTooltip>;
};

interface IProps {
    activeContext: ContextType;
    updateImageDragModeStatusAction: (imageDragMode: boolean) => any;
    updateCrossHairVisibleStatusAction: (crossHairVisible: boolean) => any;
    imageDragMode: boolean;
    crossHairVisible: boolean;
    activeLabelType: LabelType;
}

const EditorTopNavigationBar: React.FC<IProps> = (
    {
        activeContext,
        updateImageDragModeStatusAction,
        updateCrossHairVisibleStatusAction,
        imageDragMode,
        crossHairVisible,
        activeLabelType
    }) => {
    const getClassName = () => {
        return classNames(
            'EditorTopNavigationBar',
            {
                'with-context': activeContext === ContextType.EDITOR
            }
        );
    };

    const imageDragOnClick = () => {
        if (imageDragMode) {
            updateImageDragModeStatusAction(!imageDragMode);
        }
        else if (GeneralSelector.getZoom() !== ViewPointSettings.MIN_ZOOM) {
            updateImageDragModeStatusAction(!imageDragMode);
        }
    };

    const crossHairOnClick = () => {
        updateCrossHairVisibleStatusAction(!crossHairVisible);
    };

    const withAI = (
        (activeLabelType === LabelType.RECT && AISelector.isAISSDObjectDetectorModelLoaded()) ||
        (activeLabelType === LabelType.RECT && AISelector.isAIYOLOObjectDetectorModelLoaded()) ||
        (activeLabelType === LabelType.RECT && AISelector.isRoboflowAPIModelLoaded()) ||
        (activeLabelType === LabelType.POINT && AISelector.isAIPoseDetectorModelLoaded())
    )

    return (
        <div className={getClassName()}>
            <div className='ButtonWrapper'>
                {
                    getButtonWithTooltip(
                        'zoom-in',
                        '放大圖片',
                        './ico/zoom-in.png',
                        'zoom-in',
                        false,
                        undefined,
                        () => ViewPortActions.zoomIn()
                    )
                }
                {
                    getButtonWithTooltip(
                        'zoom-out',
                        '縮小圖片',
                        './ico/zoom-out.png',
                        'zoom-out',
                        false,
                        undefined,
                        () => ViewPortActions.zoomOut()
                    )
                }
                {
                    getButtonWithTooltip(
                        'zoom-fit',
                        '調整圖像大小到顯示邊界尺寸',
                        './ico/zoom-fit.png',
                        'zoom-fit',
                        false,
                        undefined,
                        () => ViewPortActions.setDefaultZoom()
                    )
                }
                {
                    getButtonWithTooltip(
                        'zoom-max',
                        '放大到最大倍率',
                        './ico/zoom-max.png',
                        'zoom-max',
                        false,
                        undefined,
                        () => ViewPortActions.setOneForOneZoom()
                    )
                }
            </div>
            <div className='ButtonWrapper'>
                {
                    getButtonWithTooltip(
                        'image-drag-mode',
                        imageDragMode ? '關閉圖像拖動模式' : '打開圖像拖動模式（只能在圖像被放大的情況下才能打開）',
                        './ico/hand.png',
                        'image-drag-mode',
                        imageDragMode,
                        undefined,
                        imageDragOnClick
                    )
                }
                {
                    getButtonWithTooltip(
                        'cursor-cross-hair',
                        crossHairVisible ? '關閉鼠標十字準星' : '打開鼠標十字準星',
                        './ico/cross-hair.png',
                        'cross-hair',
                        crossHairVisible,
                        undefined,
                        crossHairOnClick
                    )
                }
            </div>
            {withAI && <div className='ButtonWrapper'>
                    {
                        getButtonWithTooltip(
                            'accept-all',
                            '同意所有當前圖片所有AI協助標註的結果',
                            './ico/accept-all.png',
                            'accept-all',
                            false,
                            undefined,
                            () => AIActions.acceptAllSuggestedLabels(LabelsSelector.getActiveImageData())
                        )
                    }
                    {
                        getButtonWithTooltip(
                            'reject-all',
                            '拒絕所有當前圖片所有AI協助標註的結果',
                            './ico/reject-all.png',
                            'reject-all',
                            false,
                            undefined,
                            () => AIActions.rejectAllSuggestedLabels(LabelsSelector.getActiveImageData())
                        )
                    }
                </div>}
        </div>
    );
};

const mapDispatchToProps = {
    updateImageDragModeStatusAction: updateImageDragModeStatus,
    updateCrossHairVisibleStatusAction: updateCrossHairVisibleStatus
};

const mapStateToProps = (state: AppState) => ({
    activeContext: state.general.activeContext,
    imageDragMode: state.general.imageDragMode,
    crossHairVisible: state.general.crossHairVisible,
    activeLabelType: state.labels.activeLabelType
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditorTopNavigationBar);
