import {LabelType} from '../enums/LabelType';
import {ProjectType} from '../enums/ProjectType';

export interface ILabelToolkit {
    labelType: LabelType;
    headerText: string;
    imageSrc: string;
    imageAlt: string;
    projectType: ProjectType;
}

export const LabelToolkitData: ILabelToolkit[] = [  
    {  
        labelType: LabelType.IMAGE_RECOGNITION,  
        headerText: '图像识别',  
        imageSrc: './ico/object.png',  
        imageAlt: '对象',  
        projectType: ProjectType.IMAGE_RECOGNITION,  
    },  
    {  
        labelType: LabelType.RECT,  
        headerText: '矩形',  
        imageSrc: './ico/rectangle.png',  
        imageAlt: '矩形',  
        projectType: ProjectType.OBJECT_DETECTION,  
    },  
    {  
        labelType: LabelType.POINT,  
        headerText: '点',  
        imageSrc: './ico/point.png',  
        imageAlt: '点',  
        projectType: ProjectType.OBJECT_DETECTION,  
    },  
    {  
        labelType: LabelType.LINE,  
        headerText: '线',  
        imageSrc: './ico/line.png',  
        imageAlt: '线',  
        projectType: ProjectType.OBJECT_DETECTION,  
    },  
    {  
        labelType: LabelType.POLYGON,  
        headerText: '多边形',  
        imageSrc: './ico/polygon.png',  
        imageAlt: '多边形',  
        projectType: ProjectType.OBJECT_DETECTION,  
    },  
];