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
        headerText: '圖像識別',  
        imageSrc: './ico/object.png',  
        imageAlt: '對象',  
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
        headerText: '點',  
        imageSrc: './ico/point.png',  
        imageAlt: '點',  
        projectType: ProjectType.OBJECT_DETECTION,  
    },  
    {  
        labelType: LabelType.LINE,  
        headerText: '線',  
        imageSrc: './ico/line.png',  
        imageAlt: '線',  
        projectType: ProjectType.OBJECT_DETECTION,  
    },  
    {  
        labelType: LabelType.POLYGON,  
        headerText: '多邊形',  
        imageSrc: './ico/polygon.png',  
        imageAlt: '多邊形',  
        projectType: ProjectType.OBJECT_DETECTION,  
    },  
];