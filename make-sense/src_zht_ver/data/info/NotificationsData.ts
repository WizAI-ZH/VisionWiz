import {Notification} from '../enums/Notification';

export type NotificationContent = {
    header: string;
    description: string;
}

export type ExportFormatDataMap = Record<Notification, NotificationContent>;

export const NotificationsDataMap: ExportFormatDataMap = {
    [Notification.EMPTY_LABEL_NAME_ERROR]: {  
        header: '標籤名稱為空',  
        description: "看起來您沒有為某個標籤分配名稱。不幸的是，每個標籤都必須有唯一的名稱值。請插入正確的名稱或刪除空標籤並重試。"  
    },  
    [Notification.NON_UNIQUE_LABEL_NAMES_ERROR]: {  
        header: '標籤名稱不唯一',  
        description: '看起來並不是所有的標籤名稱都是唯一的。唯一的名稱對於確保您完成工作時正確的數據導出是必要的。請使您的名稱唯一並重試。'  
    },  
    [Notification.MODEL_DOWNLOAD_ERROR]: {  
        header: '模型無法下載',  
        description: '看起來我們無法從外部服務器下載tensorflow.js模型。請確保您已連接到互聯網並重試。'  
    },  
    [Notification.MODEL_INFERENCE_ERROR]: {  
        header: '推理失敗',  
        description: '看起來我們無法對您的圖像進行推理。請幫助我們改進Make Sense並告知我們。'  
    },  
    [Notification.MODEL_LOAD_ERROR]: {  
        header: '模型無法加載',  
        description: '看起來我們無法從上傳的文件中加載您的tensorflow.js模型。請確保您上傳了所有模型分片文件。請重新上傳所有模型文件。'  
    },  
    [Notification.LABELS_FILE_UPLOAD_ERROR]: {  
        header: '標籤文件未上傳',  
        description: '看起來您忘記上傳包含檢測類名稱列表的文本文件。我們需要它來將YOLOv5模型輸出映射到標籤。請重新上傳所有模型文件。'  
    },  
    [Notification.ANNOTATION_FILE_PARSE_ERROR]: {  
        header: '標註文件無法解析',  
        description: '標註文件的內容不是有效的JSON、CSV或XML。請修復選擇導入的文件並重試。'  
    },  
    [Notification.ANNOTATION_IMPORT_ASSERTION_ERROR]: {  
        header: '標註文件不包含有效數據',  
        description: '導入時提供的標註缺失或無效。請修復選擇導入的文件並重試。'  
    },  
    [Notification.UNSUPPORTED_INFERENCE_SERVER_MESSAGE]: {  
        header: '所選推理服務器尚不支持',  
        description: '與所選推理服務器的集成仍在建設中。請關注我們GitHub上的更多更新。'  
    },  
    [Notification.ROBOFLOW_INFERENCE_SERVER_ERROR]: {  
        header: 'Roboflow連接失敗',  
        description: '看起來我們無法連接到您的Roboflow模型。請確保模型規範和Roboflow API密鑰正確。'  
    }
}
