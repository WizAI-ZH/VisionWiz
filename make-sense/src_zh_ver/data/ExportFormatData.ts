import {ILabelFormatData} from '../interfaces/ILabelFormatData';
import {LabelType} from './enums/LabelType';
import {AnnotationFormatType} from './enums/AnnotationFormatType';

export type ExportFormatDataMap = Record<LabelType, ILabelFormatData[]>;

export const ExportFormatData: ExportFormatDataMap = {
    [LabelType.RECT]: [
        {
            type: AnnotationFormatType.VOC,
            label: '（推荐用于 VisionWiz 训练模型）导出包含 VOC XML 文件的 .zip 压缩包。'
        },
        {
            type: AnnotationFormatType.VOC_FOLDER,
            label: '直接将 VOC XML 文件导出到指定文件夹。'
        },
        {
            type: AnnotationFormatType.YOLO,
            label: '导出包含 YOLO 格式文件的 .zip 压缩包。'
        },
        {
            type: AnnotationFormatType.CSV,
            label: '导出单个 CSV 文件。'
        }
    ],
    [LabelType.POINT]: [
        {
            type: AnnotationFormatType.CSV,
            label: '导出单个 CSV 文件。'
        }
    ],
    [LabelType.LINE]: [
        {
            type: AnnotationFormatType.CSV,
            label: '导出单个 CSV 文件。'
        }
    ],
    [LabelType.POLYGON]: [
        {
            type: AnnotationFormatType.VGG,
            label: '导出单个 VGG JSON 文件。'
        },
        {
            type: AnnotationFormatType.COCO,
            label: '导出单个 COCO JSON 文件。'
        }
    ],
    [LabelType.IMAGE_RECOGNITION]: [
        {
            type: AnnotationFormatType.CSV,
            label: '导出单个 CSV 文件。'
        },
        {
            type: AnnotationFormatType.JSON,
            label: '导出单个 JSON 文件。'
        }
    ]
}
