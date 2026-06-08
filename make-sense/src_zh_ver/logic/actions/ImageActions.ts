import { LabelsSelector } from "../../store/selectors/LabelsSelector";
import { store } from "../../index";
import {
  updateActiveImageIndex,
  updateActiveLabelId,
  updateActiveLabelNameId,
  updateImageData,
  updateImageDataById,
  updateImageSortMode as updateImageSortModeAction,
} from "../../store/labels/actionCreators";
import { ViewPortActions } from "./ViewPortActions";
import { EditorModel } from "../../staticModels/EditorModel";
import { LabelType } from "../../data/enums/LabelType";
import {
  ImageData,
  LabelLine,
  LabelPoint,
  LabelPolygon,
  LabelRect,
} from "../../store/labels/types";
import { LabelStatus } from "../../data/enums/LabelStatus";
import { remove } from "lodash";
import { LabelHistoryActions } from "./LabelHistoryActions";
import { ImageDataUtil } from "../../utils/ImageDataUtil";
import { ImageSortMode } from "../../data/enums/ImageSortMode";
import { ImageRepository } from "../imageRepository/ImageRepository";
import { v4 as uuidv4 } from "uuid";
import { IPoint } from "../../interfaces/IPoint";
import { IRect } from "../../interfaces/IRect";

export class ImageActions {
  public static getPreviousImage(): void {
    const currentImageIndex: number = LabelsSelector.getActiveImageIndex();
    ImageActions.getImageByIndex(currentImageIndex - 1);
  }

  public static getNextImage(): void {
    const currentImageIndex: number = LabelsSelector.getActiveImageIndex();
    ImageActions.getImageByIndex(currentImageIndex + 1);
  }

  public static getImageByIndex(index: number): void {
    if (EditorModel.viewPortActionsDisabled) return;

    const imageCount: number = LabelsSelector.getImagesData().length;

    if (index < 0 || index > imageCount - 1) {
      return;
    } else {
      ViewPortActions.setZoom(1);
      store.dispatch(updateActiveImageIndex(index));
      store.dispatch(updateActiveLabelId(null));
    }
  }

  public static setActiveLabelOnActiveImage(labelIndex: number): void {
    const labelNames = LabelsSelector.getLabelNames();
    if (labelNames.length < labelIndex + 1) {
      return;
    }

    const imageData: ImageData = LabelsSelector.getActiveImageData();
    LabelHistoryActions.recordImageHistory(imageData);
    store.dispatch(
      updateImageDataById(
        imageData.id,
        ImageActions.mapNewImageData(imageData, labelIndex)
      )
    );
    store.dispatch(updateActiveLabelNameId(labelNames[labelIndex].id));
  }

  public static updateImageSortMode(mode: ImageSortMode): void {
    const imagesData: ImageData[] = LabelsSelector.getImagesData();
    const activeImageData: ImageData = LabelsSelector.getActiveImageData();
    const sortedImagesData: ImageData[] = ImageDataUtil.sortImages(imagesData, mode);
    const nextActiveImageIndex: number = activeImageData
      ? sortedImagesData.findIndex((imageData: ImageData) => imageData.id === activeImageData.id)
      : 0;
    store.dispatch(updateImageSortModeAction(mode));
    store.dispatch(updateImageData(sortedImagesData));
    store.dispatch(updateActiveImageIndex(Math.max(nextActiveImageIndex, 0)));
  }

  public static pastePreviousImageRectLabels(centerOnImage?: IPoint): void {
    const activeIndex: number = LabelsSelector.getActiveImageIndex();
    if (activeIndex <= 0) return;

    const imagesData: ImageData[] = LabelsSelector.getImagesData();
    const sourceImageData: ImageData = imagesData[activeIndex - 1];
    const targetImageData: ImageData = imagesData[activeIndex];
    if (!sourceImageData || !targetImageData || sourceImageData.labelRects.length === 0) return;

    const sourceImage = ImageRepository.getById(sourceImageData.id);
    const targetImage = ImageRepository.getById(targetImageData.id);
    if (!sourceImage || !targetImage) return;

    const scaleX: number = targetImage.width / sourceImage.width;
    const scaleY: number = targetImage.height / sourceImage.height;
    let pastedLabelRects: LabelRect[] = sourceImageData.labelRects
      .filter((labelRect: LabelRect) => labelRect.status === LabelStatus.ACCEPTED)
      .map((labelRect: LabelRect) => ({
        ...labelRect,
        id: uuidv4(),
        rect: {
          x: Math.max(0, Math.min(targetImage.width, labelRect.rect.x * scaleX)),
          y: Math.max(0, Math.min(targetImage.height, labelRect.rect.y * scaleY)),
          width: Math.max(1, Math.min(targetImage.width, labelRect.rect.width * scaleX)),
          height: Math.max(1, Math.min(targetImage.height, labelRect.rect.height * scaleY))
        },
        isCreatedByAI: false
      }))
      .map((labelRect: LabelRect) => ({
        ...labelRect,
        rect: {
          ...labelRect.rect,
          width: Math.min(labelRect.rect.width, targetImage.width - labelRect.rect.x),
          height: Math.min(labelRect.rect.height, targetImage.height - labelRect.rect.y)
        }
      }));

    if (pastedLabelRects.length === 0) return;
    if (centerOnImage) {
      const groupRect: IRect = ImageActions.getLabelRectsBounds(pastedLabelRects);
      const delta: IPoint = {
        x: centerOnImage.x - (groupRect.x + groupRect.width / 2),
        y: centerOnImage.y - (groupRect.y + groupRect.height / 2)
      };
      pastedLabelRects = pastedLabelRects.map((labelRect: LabelRect) => ({
        ...labelRect,
        rect: ImageActions.clampRectToImage({
          ...labelRect.rect,
          x: labelRect.rect.x + delta.x,
          y: labelRect.rect.y + delta.y
        }, targetImage.width, targetImage.height)
      }));
    }
    LabelHistoryActions.recordImageHistory(targetImageData);
    store.dispatch(updateImageDataById(targetImageData.id, {
      ...targetImageData,
      labelRects: targetImageData.labelRects.concat(pastedLabelRects)
    }));
    store.dispatch(updateActiveLabelId(pastedLabelRects[pastedLabelRects.length - 1].id));
  }

  private static getLabelRectsBounds(labelRects: LabelRect[]): IRect {
    const minX = Math.min(...labelRects.map((labelRect: LabelRect) => labelRect.rect.x));
    const minY = Math.min(...labelRects.map((labelRect: LabelRect) => labelRect.rect.y));
    const maxX = Math.max(...labelRects.map((labelRect: LabelRect) => labelRect.rect.x + labelRect.rect.width));
    const maxY = Math.max(...labelRects.map((labelRect: LabelRect) => labelRect.rect.y + labelRect.rect.height));
    return {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
  }

  private static clampRectToImage(rect: IRect, imageWidth: number, imageHeight: number): IRect {
    return {
      ...rect,
      x: Math.max(0, Math.min(rect.x, imageWidth - rect.width)),
      y: Math.max(0, Math.min(rect.y, imageHeight - rect.height))
    };
  }

  private static mapNewImageData(
    imageData: ImageData,
    labelIndex: number
  ): ImageData {
    const labelType: LabelType = LabelsSelector.getActiveLabelType();
    const labelNames = LabelsSelector.getLabelNames();
    let newImageData: ImageData = {
      ...imageData,
    };
    switch (labelType) {
      case LabelType.POINT:
        const point = LabelsSelector.getActivePointLabel();
        newImageData.labelPoints = imageData.labelPoints.map(
          (labelPoint: LabelPoint) => {
            if (labelPoint.id === point.id) {
              return {
                ...labelPoint,
                labelId: labelNames[labelIndex].id,
                status: LabelStatus.ACCEPTED,
              };
            }
            return labelPoint;
          }
        );
        store.dispatch(updateActiveLabelId(point.id));
        break;
      case LabelType.LINE:
        const line = LabelsSelector.getActiveLineLabel();
        newImageData.labelLines = imageData.labelLines.map(
          (labelLine: LabelLine) => {
            if (labelLine.id === line.id) {
              return {
                ...labelLine,
                labelId: labelNames[labelIndex].id,
                status: LabelStatus.ACCEPTED,
              };
            }
            return labelLine;
          }
        );
        store.dispatch(updateActiveLabelId(line.id));
        break;
      case LabelType.RECT:
        const rect = LabelsSelector.getActiveRectLabel();
        newImageData.labelRects = imageData.labelRects.map(
          (labelRectangle: LabelRect) => {
            if (labelRectangle.id === rect.id) {
              return {
                ...labelRectangle,
                labelId: labelNames[labelIndex].id,
                status: LabelStatus.ACCEPTED,
              };
            }
            return labelRectangle;
          }
        );
        store.dispatch(updateActiveLabelId(rect.id));
        break;
      case LabelType.POLYGON:
        const polygon = LabelsSelector.getActivePolygonLabel();
        newImageData.labelPolygons = imageData.labelPolygons.map(
          (labelPolygon: LabelPolygon) => {
            if (labelPolygon.id === polygon.id) {
              return {
                ...labelPolygon,
                labelId: labelNames[labelIndex].id,
                status: LabelStatus.ACCEPTED,
              };
            }
            return labelPolygon;
          }
        );
        store.dispatch(updateActiveLabelId(polygon.id));
        break;
      case LabelType.IMAGE_RECOGNITION:
        const labelId: string = labelNames[labelIndex].id;
        if (imageData.labelNameIds.includes(labelId)) {
          newImageData.labelNameIds = remove(
            imageData.labelNameIds,
            (element: string) => element !== labelId
          );
        } else {
          newImageData.labelNameIds = imageData.labelNameIds.concat(labelId);
        }
        break;
    }

    return newImageData;
  }
}
