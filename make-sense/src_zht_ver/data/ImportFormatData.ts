import {LabelType} from './enums/LabelType';
import {ILabelFormatData} from '../interfaces/ILabelFormatData';
import {AnnotationFormatType} from './enums/AnnotationFormatType';

export type ImportFormatDataMap = Record<LabelType, ILabelFormatData[]>

export const ImportFormatData: ImportFormatDataMap = {
    [LabelType.RECT]: [  
        {  
            type: AnnotationFormatType.VOC,  
            label: '（推薦使用威智慧眼訓練模型的威智板用戶）多個VOC XML格式的文件。'  
        },  
        {  
            type: AnnotationFormatType.YOLO,  
            label: '多個YOLO格式的文件，以及標籤列表文件labels.txt。'  
        },  
        {  
            type: AnnotationFormatType.COCO,  
            label: '（不推薦）單個COCO JSON格式的文件。'  
        }  
    ],  
    [LabelType.POINT]: [],  
    [LabelType.LINE]: [],  
    [LabelType.POLYGON]: [  
        {  
            type: AnnotationFormatType.COCO,  
            label: '單個COCO JSON格式的文件。'  
        }  
    ],  
    [LabelType.IMAGE_RECOGNITION]: []
}
