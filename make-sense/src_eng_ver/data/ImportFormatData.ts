import {LabelType} from './enums/LabelType';
import {ILabelFormatData} from '../interfaces/ILabelFormatData';
import {AnnotationFormatType} from './enums/AnnotationFormatType';

export type ImportFormatDataMap = Record<LabelType, ILabelFormatData[]>

export const ImportFormatData: ImportFormatDataMap = {
    [LabelType.RECT]: [

        {
            type: AnnotationFormatType.VOC,
            label: '(Recommended for VESIBIT user train model using VisionWiz) Multiple files in VOC XML format.'
        },
        {
            type: AnnotationFormatType.YOLO,
            label: 'Multiple files in YOLO format along with labels names definition - labels.txt file.'
        },
        {
            type: AnnotationFormatType.COCO,
            label: '(Not Recommend) Single file in COCO JSON format.'
        },
    ],
    [LabelType.POINT]: [],
    [LabelType.LINE]: [],
    [LabelType.POLYGON]: [
        {
            type: AnnotationFormatType.COCO,
            label: 'Single file in COCO JSON format.'
        }
    ],
    [LabelType.IMAGE_RECOGNITION]: []
}
