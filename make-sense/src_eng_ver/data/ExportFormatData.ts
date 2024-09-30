import {ILabelFormatData} from '../interfaces/ILabelFormatData';
import {LabelType} from './enums/LabelType';
import {AnnotationFormatType} from './enums/AnnotationFormatType';

export type ExportFormatDataMap = Record<LabelType, ILabelFormatData[]>;

export const ExportFormatData: ExportFormatDataMap = {
    [LabelType.RECT]: [
        {
            type: AnnotationFormatType.VOC,
            label: '(Recommended for VESIBIT user train model using VisionWiz) A .zip package containing files in VOC XML format.'
        },
        {
            type: AnnotationFormatType.YOLO,
            label: 'A .zip package containing files in YOLO format.'
        },
        {
            type: AnnotationFormatType.CSV,
            label: 'Single CSV file.'
        }
    ],
    [LabelType.POINT]: [
        {
            type: AnnotationFormatType.CSV,
            label: 'Single CSV file.'
        }
    ],
    [LabelType.LINE]: [
        {
            type: AnnotationFormatType.CSV,
            label: 'Single CSV file.'
        }
    ],
    [LabelType.POLYGON]: [
        {
            type: AnnotationFormatType.VGG,
            label: 'Single file in VGG JSON format.'
        },
        {
            type: AnnotationFormatType.COCO,
            label: 'Single file in COCO JSON format.'
        }
    ],
    [LabelType.IMAGE_RECOGNITION]: [
        {
            type: AnnotationFormatType.CSV,
            label: 'Single CSV file.'
        },
        {
            type: AnnotationFormatType.JSON,
            label: 'Single JSON file.'
        }
    ]
}
