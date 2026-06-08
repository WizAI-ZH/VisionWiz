import {ImageData} from '../store/labels/types';
import { v4 as uuidv4 } from 'uuid';
import {FileUtil} from './FileUtil';
import {ImageRepository} from '../logic/imageRepository/ImageRepository';
import {ImageSortMode} from '../data/enums/ImageSortMode';

export class ImageDataUtil {
    public static createImageDataFromFileData(fileData: File): ImageData {
        return {
            id: uuidv4(),
            fileData,
            loadStatus: false,
            labelRects: [],
            labelPoints: [],
            labelLines: [],
            labelPolygons: [],
            labelNameIds: [],
            isVisitedByYOLOObjectDetector: false,
            isVisitedBySSDObjectDetector: false,
            isVisitedByPoseDetector: false,
            isVisitedByRoboflowAPI: false
        }
    }

    public static cleanAnnotations(item: ImageData): ImageData {
        return {
            ...item,
            labelRects: [],
            labelPoints: [],
            labelLines: [],
            labelPolygons: [],
            labelNameIds: []
        }
    }

    public static arrange(items: ImageData[], idArrangement: string[]): ImageData[] {
        return items.sort((a: ImageData, b: ImageData) => {
            return idArrangement.indexOf(a.id) - idArrangement.indexOf(b.id)
        })
    }

    public static sortImages(items: ImageData[], mode: ImageSortMode = ImageSortMode.NATURAL_ASC): ImageData[] {
        return items.slice().sort((a: ImageData, b: ImageData) => ImageDataUtil.compareImages(a, b, mode));
    }

    private static compareImages(a: ImageData, b: ImageData, mode: ImageSortMode): number {
        switch (mode) {
            case ImageSortMode.NATURAL_DESC:
                return -ImageDataUtil.naturalCompare(a.fileData.name, b.fileData.name);
            case ImageSortMode.NAME_ASC:
                return a.fileData.name.localeCompare(b.fileData.name);
            case ImageSortMode.NAME_DESC:
                return b.fileData.name.localeCompare(a.fileData.name);
            case ImageSortMode.MODIFIED_DESC:
                return b.fileData.lastModified - a.fileData.lastModified || ImageDataUtil.naturalCompare(a.fileData.name, b.fileData.name);
            case ImageSortMode.MODIFIED_ASC:
                return a.fileData.lastModified - b.fileData.lastModified || ImageDataUtil.naturalCompare(a.fileData.name, b.fileData.name);
            case ImageSortMode.NATURAL_ASC:
            default:
                return ImageDataUtil.naturalCompare(a.fileData.name, b.fileData.name);
        }
    }

    private static naturalCompare(a: string, b: string): number {
        return a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'});
    }

    public static loadMissingImages(images: ImageData[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const missingImages = images.filter((i: ImageData) => !i.loadStatus);
            const missingImagesFiles = missingImages.map((i: ImageData) => i.fileData);
            FileUtil.loadImages(missingImagesFiles)
                .then((htmlImageElements:HTMLImageElement[]) => {
                    ImageRepository.storeImages(missingImages.map((i: ImageData) => i.id), htmlImageElements);
                    resolve()
                })
                .catch((error: Error) => reject(error));
        });
    }
}
