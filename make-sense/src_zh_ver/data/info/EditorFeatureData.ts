export interface IEditorFeature {
    displayText:string;
    imageSrc:string;
    imageAlt:string;
}

export const EditorFeatureData: IEditorFeature[] = [
    {  
        "displayText": "开源且可在 GPLv3 许可下免费使用",  
        "imageSrc": "./ico/open-source.png",  
        "imageAlt": "open-source"  
    },  
    {  
        "displayText": "图片都在本地进行标注，保证隐私",  
        "imageSrc": "./ico/private.png",  
        "imageAlt": "private"  
    },  
    {  
        "displayText": "支持多种标注类型 - 矩形、线条、点和多边形",  
        "imageSrc": "./ico/labels.png",  
        "imageAlt": "labels"  
    },  
    {  
        "displayText": "支持输出文件格式如 YOLO, VOC XML, VGG JSON, CSV",  
        "imageSrc": "./ico/file.png",  
        "imageAlt": "file"  
    },  
    {  
        "displayText": "使用人工智能让您的标注更高效",  
        "imageSrc": "./ico/robot.png",  
        "imageAlt": "robot"  
    }
];