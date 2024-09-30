import {LabelType} from './enums/LabelType';
import {ILabelFormatData} from '../interfaces/ILabelFormatData';
import {AnnotationFormatType} from './enums/AnnotationFormatType';

export type ImportFormatDataMap = Record<LabelType, ILabelFormatData[]>

export const ImportFormatData: ImportFormatDataMap = {
    [LabelType.RECT]: [  
        {  
            type: AnnotationFormatType.VOC,  
            label: '（推荐使用威智慧眼训练模型的威智板用户）多个VOC XML格式的文件。'  
        },  
        {  
            type: AnnotationFormatType.YOLO,  
            label: '多个YOLO格式的文件，以及标签列表文件labels.txt。'  
        },  
        {  
            type: AnnotationFormatType.COCO,  
            label: '（不推荐）单个COCO JSON格式的文件。'  
        }  
    ],  
    [LabelType.POINT]: [],  
    [LabelType.LINE]: [],  
    [LabelType.POLYGON]: [  
        {  
            type: AnnotationFormatType.COCO,  
            label: '单个文件以COCO JSON格式。'  
        }  
    ],  
    [LabelType.IMAGE_RECOGNITION]: []
}
