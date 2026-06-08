import {store} from '../../index';
import {LabelsSelector} from '../../store/selectors/LabelsSelector';
import {ImageData, LabelHistorySnapshot, LabelLine, LabelPoint, LabelPolygon, LabelRect} from '../../store/labels/types';
import {pushLabelHistory, redoLabelHistory, undoLabelHistory} from '../../store/labels/actionCreators';
import {EditorActions} from './EditorActions';

export class LabelHistoryActions {
    public static recordImageHistory(imageData: ImageData): void {
        if (!imageData) return;
        store.dispatch(pushLabelHistory(imageData.id, LabelHistoryActions.createSnapshot(imageData)));
    }

    public static recordActiveImageHistory(): void {
        LabelHistoryActions.recordImageHistory(LabelsSelector.getActiveImageData());
    }

    public static undoActiveImage(): void {
        const imageData = LabelsSelector.getActiveImageData();
        if (!imageData || !LabelsSelector.canUndoActiveImage()) return;
        store.dispatch(undoLabelHistory(imageData.id));
        EditorActions.fullRender();
    }

    public static redoActiveImage(): void {
        const imageData = LabelsSelector.getActiveImageData();
        if (!imageData || !LabelsSelector.canRedoActiveImage()) return;
        store.dispatch(redoLabelHistory(imageData.id));
        EditorActions.fullRender();
    }

    private static createSnapshot(imageData: ImageData): LabelHistorySnapshot {
        return {
            labelRects: imageData.labelRects.map((item: LabelRect) => ({...item, rect: {...item.rect}})),
            labelPoints: imageData.labelPoints.map((item: LabelPoint) => ({...item, point: {...item.point}})),
            labelLines: imageData.labelLines.map((item: LabelLine) => ({...item, line: {...item.line}})),
            labelPolygons: imageData.labelPolygons.map((item: LabelPolygon) => ({
                ...item,
                vertices: item.vertices.map((vertex) => ({...vertex}))
            })),
            labelNameIds: imageData.labelNameIds.slice()
        };
    }
}
