import {Notification} from '../enums/Notification';

export type NotificationContent = {
    header: string;
    description: string;
}

export type ExportFormatDataMap = Record<Notification, NotificationContent>;

export const NotificationsDataMap: ExportFormatDataMap = {
    [Notification.EMPTY_LABEL_NAME_ERROR]: {  
        header: '标签名称为空',  
        description: "看起来您没有为某个标签分配名称。不幸的是，每个标签都必须有唯一的名称值。请插入正确的名称或删除空标签并重试。"  
    },  
    [Notification.NON_UNIQUE_LABEL_NAMES_ERROR]: {  
        header: '标签名称不唯一',  
        description: '看起来并不是所有的标签名称都是唯一的。唯一的名称对于确保您完成工作时正确的数据导出是必要的。请使您的名称唯一并重试。'  
    },  
    [Notification.MODEL_DOWNLOAD_ERROR]: {  
        header: '模型无法下载',  
        description: '看起来我们无法从外部服务器下载tensorflow.js模型。请确保您已连接到互联网并重试。'  
    },  
    [Notification.MODEL_INFERENCE_ERROR]: {  
        header: '推理失败',  
        description: '看起来我们无法对您的图像进行推理。请帮助我们改进Make Sense并告知我们。'  
    },  
    [Notification.MODEL_LOAD_ERROR]: {  
        header: '模型无法加载',  
        description: '看起来我们无法从上传的文件中加载您的tensorflow.js模型。请确保您上传了所有模型分片文件。请重新上传所有模型文件。'  
    },  
    [Notification.LABELS_FILE_UPLOAD_ERROR]: {  
        header: '标签文件未上传',  
        description: '看起来您忘记上传包含检测类名称列表的文本文件。我们需要它来将YOLOv5模型输出映射到标签。请重新上传所有模型文件。'  
    },  
    [Notification.ANNOTATION_FILE_PARSE_ERROR]: {  
        header: '标注文件无法解析',  
        description: '标注文件的内容不是有效的JSON、CSV或XML。请修复选择导入的文件并重试。'  
    },  
    [Notification.ANNOTATION_IMPORT_ASSERTION_ERROR]: {  
        header: '标注文件不包含有效数据',  
        description: '导入时提供的标注缺失或无效。请修复选择导入的文件并重试。'  
    },  
    [Notification.UNSUPPORTED_INFERENCE_SERVER_MESSAGE]: {  
        header: '所选推理服务器尚不支持',  
        description: '与所选推理服务器的集成仍在建设中。请关注我们GitHub上的更多更新。'  
    },  
    [Notification.ROBOFLOW_INFERENCE_SERVER_ERROR]: {  
        header: 'Roboflow连接失败',  
        description: '看起来我们无法连接到您的Roboflow模型。请确保模型规范和Roboflow API密钥正确。'  
    }
}
