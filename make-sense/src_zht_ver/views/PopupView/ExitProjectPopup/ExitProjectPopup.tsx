import React from 'react';
import './ExitProjectPopup.scss';
import { GenericYesNoPopup } from "../GenericYesNoPopup/GenericYesNoPopup";
import {
    updateActiveImageIndex as storeUpdateActiveImageIndex,
    updateActiveLabelNameId as storeUpdateActiveLabelNameId,
    updateFirstLabelCreatedFlag as storeUpdateFirstLabelCreatedFlag,
    updateImageData as storeUpdateImageData,
    updateLabelNames as storeUpdateLabelNames
} from "../../../store/labels/actionCreators";
import { AppState } from "../../../store";
import { connect } from "react-redux";
import { ImageData, LabelName } from "../../../store/labels/types";
import { PopupActions } from "../../../logic/actions/PopupActions";
import { ProjectData } from "../../../store/general/types";
import { updateProjectData as storeUpdateProjectData } from "../../../store/general/actionCreators";

interface IProps {
    updateActiveImageIndex: (activeImageIndex: number) => any;
    updateActiveLabelNameId: (activeLabelId: string) => any;
    updateLabelNames: (labelNames: LabelName[]) => any;
    updateImageData: (imageData: ImageData[]) => any;
    updateFirstLabelCreatedFlag: (firstLabelCreatedFlag: boolean) => any;
    updateProjectData: (projectData: ProjectData) => any;
}

const ExitProjectPopup: React.FC<IProps> = ({
    updateActiveLabelNameId,
    updateLabelNames,
    updateActiveImageIndex,
    updateImageData,
    updateFirstLabelCreatedFlag,
    updateProjectData
}: IProps) => {


    const renderContent = () => {
        return (
            <div className="ExitProjectPopupContent">
                <div className="Message">
                您確定要離開編輯器嗎？您將永久失去目前項目的所有進度。
                </div>
            </div>
        );
    };

    const onAccept = () => {
        updateActiveLabelNameId(null);
        updateLabelNames([]);
        updateProjectData({ type: null, name: "my-project-name" });
        updateActiveImageIndex(null);
        updateImageData([]);
        updateFirstLabelCreatedFlag(false);
        PopupActions.close();
    };

    const onReject = () => {
        PopupActions.close();
    };

    return (
        <GenericYesNoPopup
            title={"離開項目"}
            renderContent={renderContent}
            acceptLabel={"確定離開"}
            onAccept={onAccept}
            rejectLabel={"返回項目"}
            onReject={onReject}
        />);
};

const mapDispatchToProps = {
    updateActiveLabelNameId: storeUpdateActiveLabelNameId,
    updateLabelNames: storeUpdateLabelNames,
    updateProjectData: storeUpdateProjectData,
    updateActiveImageIndex: storeUpdateActiveImageIndex,
    updateImageData: storeUpdateImageData,
    updateFirstLabelCreatedFlag: storeUpdateFirstLabelCreatedFlag
};

const mapStateToProps = (state: AppState) => ({});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ExitProjectPopup);