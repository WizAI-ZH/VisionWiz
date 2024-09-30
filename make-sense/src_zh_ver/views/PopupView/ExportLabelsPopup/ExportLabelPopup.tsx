import React, { useState } from 'react';
import './ExportLabelPopup.scss';
import { AnnotationFormatType } from '../../../data/enums/AnnotationFormatType';
import { RectLabelsExporter } from '../../../logic/export/RectLabelsExporter';
import { LabelType } from '../../../data/enums/LabelType';
import { ILabelFormatData } from '../../../interfaces/ILabelFormatData';
import { PointLabelsExporter } from '../../../logic/export/PointLabelsExport';
import { PolygonLabelsExporter } from '../../../logic/export/polygon/PolygonLabelsExporter';
import { PopupActions } from '../../../logic/actions/PopupActions';
import { LineLabelsExporter } from '../../../logic/export/LineLabelExport';
import { TagLabelsExporter } from '../../../logic/export/TagLabelsExport';
import GenericLabelTypePopup from '../GenericLabelTypePopup/GenericLabelTypePopup';
import { ExportFormatData } from '../../../data/ExportFormatData';
import { AppState } from '../../../store';
import { connect } from 'react-redux';

interface IProps {
    activeLabelType: LabelType,
}

const ExportLabelPopup: React.FC<IProps> = ({ activeLabelType }) => {
    const [labelType, setLabelType] = useState(activeLabelType);
    const [exportFormatType, setExportFormatType] = useState(null);

    const onAccept = (type: LabelType) => {
        switch (type) {
            case LabelType.RECT:
                RectLabelsExporter.export(exportFormatType);
                break;
            case LabelType.POINT:
                PointLabelsExporter.export(exportFormatType);
                break;
            case LabelType.LINE:
                LineLabelsExporter.export(exportFormatType);
                break;
            case LabelType.POLYGON:
                PolygonLabelsExporter.export(exportFormatType);
                break;
            case LabelType.IMAGE_RECOGNITION:
                TagLabelsExporter.export(exportFormatType);
                break;
        }
        PopupActions.close();
    };

    const onReject = (type: LabelType) => {
        PopupActions.close();
    };

    const onSelect = (type: AnnotationFormatType) => {
        setExportFormatType(type);
    };

    const getOptions = (exportFormatData: ILabelFormatData[]) => {
        return exportFormatData.map((entry: ILabelFormatData) => {
            return <div
                className='OptionsItem'
                onClick={() => onSelect(entry.type)}
                key={entry.type}
            >
                {entry.type === exportFormatType ?
                    <img
                        draggable={false}
                        src={'./ico/checkbox-checked.png'}
                        alt={'checked'}
                    /> :
                    <img
                        draggable={false}
                        src={'./ico/checkbox-unchecked.png'}
                        alt={'unchecked'}
                    />}
                {entry.label}
            </div>;
        });
    };

    const renderInternalContent = (type: LabelType) => {
        return <>
            <div className='Message'>
            选择您想要用于导出标注文件的标签类型和文件格式。
            </div>
            <div className='Options'>
                {getOptions(ExportFormatData[type])}
            </div>
        </>;
    };

    const onLabelTypeChange = (type: LabelType) => {
        setLabelType(type);
        setExportFormatType(null);
    };

    const getLabelTypeName = (type: LabelType) =>{
        if(type.toLowerCase() == "rect"){
            return "矩形"
        }else if(type.toLowerCase() == "point"){
            return "点"
        }else if(type.toLowerCase() == "line"){
            return "线段"
        }else if(type.toLowerCase() == "polygon"){
            return "多边形"
        }
    }

    return (
        <GenericLabelTypePopup
            activeLabelType={labelType}
            title={`导出 ${getLabelTypeName(labelType)} 标注文件`}
            onLabelTypeChange={onLabelTypeChange}
            acceptLabel={'导出'}
            onAccept={onAccept}
            disableAcceptButton={!exportFormatType}
            rejectLabel={'取消'}
            onReject={onReject}
            renderInternalContent={renderInternalContent}
        />
    );
};

const mapDispatchToProps = {};

const mapStateToProps = (state: AppState) => ({
    activeLabelType: state.labels.activeLabelType,
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ExportLabelPopup);