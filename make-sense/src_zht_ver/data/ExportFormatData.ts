import {ILabelFormatData} from '../interfaces/ILabelFormatData';
import {LabelType} from './enums/LabelType';
import {AnnotationFormatType} from './enums/AnnotationFormatType';

export type ExportFormatDataMap = Record<LabelType, ILabelFormatData[]>;

export const ExportFormatData: ExportFormatDataMap = {
    [LabelType.RECT]: [  
        {  
            type: AnnotationFormatType.VOC,  
            label: '（推薦使用威智慧眼訓練模型的威智板用戶）一個包含VOC XML格式文件的.zip包。'  
        },  
        {  
            type: AnnotationFormatType.YOLO,  
            label: '一個包含YOLO格式文件的.zip包。'  
        },  
        {  
            type: AnnotationFormatType.CSV,  
            label: '單個CSV文件。'  
        }  
    ],  
    [LabelType.POINT]: [  
        {  
            type: AnnotationFormatType.CSV,  
            label: '單個CSV文件。'  
        }  
    ],  
    [LabelType.LINE]: [  
        {  
            type: AnnotationFormatType.CSV,  
            label: '單個CSV文件。'  
        }  
    ],  
    [LabelType.POLYGON]: [  
        {  
            type: AnnotationFormatType.VGG,  
            label: 'VGG JSON格式的單個文件。'  
        },  
        {  
            type: AnnotationFormatType.COCO,  
            label: 'COCO JSON格式的單個文件。'  
        }  
    ],  
    [LabelType.IMAGE_RECOGNITION]: [  
        {  
            type: AnnotationFormatType.CSV,  
            label: '單個CSV文件。'  
        },  
        {  
            type: AnnotationFormatType.JSON,  
            label: '單個JSON文件。'  
        }  
    ]
}
