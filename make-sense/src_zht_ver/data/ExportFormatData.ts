import {ILabelFormatData} from '../interfaces/ILabelFormatData';
import {LabelType} from './enums/LabelType';
import {AnnotationFormatType} from './enums/AnnotationFormatType';

export type ExportFormatDataMap = Record<LabelType, ILabelFormatData[]>;

export const ExportFormatData: ExportFormatDataMap = {
    [LabelType.RECT]: [
        {
            type: AnnotationFormatType.VOC,
            label: '（建議用於 VisionWiz 訓練模型）匯出包含 VOC XML 檔案的 .zip 壓縮包。'
        },
        {
            type: AnnotationFormatType.VOC_FOLDER,
            label: '直接將 VOC XML 檔案匯出到指定資料夾。'
        },
        {
            type: AnnotationFormatType.YOLO,
            label: '匯出包含 YOLO 格式檔案的 .zip 壓縮包。'
        },
        {
            type: AnnotationFormatType.CSV,
            label: '匯出單個 CSV 檔案。'
        }
    ],
    [LabelType.POINT]: [
        {
            type: AnnotationFormatType.CSV,
            label: '匯出單個 CSV 檔案。'
        }
    ],
    [LabelType.LINE]: [
        {
            type: AnnotationFormatType.CSV,
            label: '匯出單個 CSV 檔案。'
        }
    ],
    [LabelType.POLYGON]: [
        {
            type: AnnotationFormatType.VGG,
            label: '匯出單個 VGG JSON 檔案。'
        },
        {
            type: AnnotationFormatType.COCO,
            label: '匯出單個 COCO JSON 檔案。'
        }
    ],
    [LabelType.IMAGE_RECOGNITION]: [
        {
            type: AnnotationFormatType.CSV,
            label: '匯出單個 CSV 檔案。'
        },
        {
            type: AnnotationFormatType.JSON,
            label: '匯出單個 JSON 檔案。'
        }
    ]
}
