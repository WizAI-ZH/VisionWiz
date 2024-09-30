import {ILabelFormatData} from '../interfaces/ILabelFormatData';
import {LabelType} from './enums/LabelType';
import {AnnotationFormatType} from './enums/AnnotationFormatType';

export type ExportFormatDataMap = Record<LabelType, ILabelFormatData[]>;

export const ExportFormatData: ExportFormatDataMap = {
    [LabelType.RECT]: [  
        {  
            type: AnnotationFormatType.VOC,  
            label: '（推荐使用威智慧眼训练模型的威智板用户）一个包含VOC XML格式文件的.zip包。'  
        },  
        {  
            type: AnnotationFormatType.YOLO,  
            label: '一个包含YOLO格式文件的.zip包。'  
        },  
        {  
            type: AnnotationFormatType.CSV,  
            label: '单个CSV文件。'  
        }  
    ],  
    [LabelType.POINT]: [  
        {  
            type: AnnotationFormatType.CSV,  
            label: '单个CSV文件。'  
        }  
    ],  
    [LabelType.LINE]: [  
        {  
            type: AnnotationFormatType.CSV,  
            label: '单个CSV文件。'  
        }  
    ],  
    [LabelType.POLYGON]: [  
        {  
            type: AnnotationFormatType.VGG,  
            label: 'VGG JSON格式的单个文件。'  
        },  
        {  
            type: AnnotationFormatType.COCO,  
            label: 'COCO JSON格式的单个文件。'  
        }  
    ],  
    [LabelType.IMAGE_RECOGNITION]: [  
        {  
            type: AnnotationFormatType.CSV,  
            label: '单个CSV文件。'  
        },  
        {  
            type: AnnotationFormatType.JSON,  
            label: '单个JSON文件。'  
        }  
    ]
}
