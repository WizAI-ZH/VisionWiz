export interface IEditorFeature {
    displayText:string;
    imageSrc:string;
    imageAlt:string;
}

export const EditorFeatureData: IEditorFeature[] = [
    {  
        "displayText": "開源且可在 GPLv3 許可下免費使用",  
        "imageSrc": "./ico/open-source.png",  
        "imageAlt": "open-source"  
    },  
    {  
        "displayText": "圖片都在本地進行標註，保證隱私",  
        "imageSrc": "./ico/private.png",  
        "imageAlt": "private"  
    },  
    {  
        "displayText": "支持多種標註類型 - 矩形、線條、點和多邊形",  
        "imageSrc": "./ico/labels.png",  
        "imageAlt": "labels"  
    },  
    {  
        "displayText": "支持輸出文件格式如 YOLO, VOC XML, VGG JSON, CSV",  
        "imageSrc": "./ico/file.png",  
        "imageAlt": "file"  
    },  
    {  
        "displayText": "使用人工智慧讓您的標註更高效",  
        "imageSrc": "./ico/robot.png",  
        "imageAlt": "robot"  
    }
];