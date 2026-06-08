import {LabelsActionTypes, LabelsState, ImageData, LabelHistorySnapshot} from './types';
import {Action} from '../Actions';
import {ImageSortMode} from '../../data/enums/ImageSortMode';

const makeSnapshot = (imageData: ImageData): LabelHistorySnapshot => ({
    labelRects: imageData.labelRects,
    labelPoints: imageData.labelPoints,
    labelLines: imageData.labelLines,
    labelPolygons: imageData.labelPolygons,
    labelNameIds: imageData.labelNameIds
});

const applySnapshot = (imageData: ImageData, snapshot: LabelHistorySnapshot): ImageData => ({
    ...imageData,
    labelRects: snapshot.labelRects,
    labelPoints: snapshot.labelPoints,
    labelLines: snapshot.labelLines,
    labelPolygons: snapshot.labelPolygons,
    labelNameIds: snapshot.labelNameIds
});

const initialState: LabelsState = {
    activeImageIndex: null,
    activeLabelNameId: null,
    activeLabelType: null,
    activeLabelId: null,
    highlightedLabelId: null,
    imagesData: [],
    firstLabelCreatedFlag: false,
    labels: [],
    imageSortMode: ImageSortMode.NATURAL_ASC,
    undoStack: {},
    redoStack: {}
};

export function labelsReducer(
    state = initialState,
    action: LabelsActionTypes
): LabelsState {
    switch (action.type) {
        case Action.UPDATE_ACTIVE_IMAGE_INDEX: {
            return {
                ...state,
                activeImageIndex: action.payload.activeImageIndex
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_NAME_ID: {
            return {
                ...state,
                activeLabelNameId: action.payload.activeLabelNameId
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_ID: {
            return {
                ...state,
                activeLabelId: action.payload.activeLabelId
            }
        }
        case Action.UPDATE_HIGHLIGHTED_LABEL_ID: {
            return {
                ...state,
                highlightedLabelId: action.payload.highlightedLabelId
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_TYPE: {
            return {
                ...state,
                activeLabelType: action.payload.activeLabelType
            }
        }
        case Action.UPDATE_IMAGE_DATA_BY_ID: {
            return {
                ...state,
                imagesData: state.imagesData.map((imageData: ImageData) =>
                    imageData.id === action.payload.id ? action.payload.newImageData : imageData
                )
            }
        }
        case Action.ADD_IMAGES_DATA: {
            return {
                ...state,
                imagesData: state.imagesData.concat(action.payload.imageData)
            }
        }
        case Action.UPDATE_IMAGES_DATA: {
            return {
                ...state,
                imagesData: action.payload.imageData
            }
        }
        case Action.UPDATE_LABEL_NAMES: {
            return {
                ...state,
                labels: action.payload.labels
            }
        }
        case Action.UPDATE_FIRST_LABEL_CREATED_FLAG: {
            return {
                ...state,
                firstLabelCreatedFlag: action.payload.firstLabelCreatedFlag
            }
        }
        case Action.UPDATE_IMAGE_SORT_MODE: {
            return {
                ...state,
                imageSortMode: action.payload.imageSortMode
            }
        }
        case Action.PUSH_LABEL_HISTORY: {
            return {
                ...state,
                undoStack: {
                    ...state.undoStack,
                    [action.payload.imageId]: (state.undoStack[action.payload.imageId] || []).concat(action.payload.snapshot)
                },
                redoStack: {
                    ...state.redoStack,
                    [action.payload.imageId]: []
                }
            }
        }
        case Action.UNDO_LABEL_HISTORY: {
            const imageId = action.payload.imageId;
            const undoStack = state.undoStack[imageId] || [];
            if (undoStack.length === 0) return state;
            const imageData = state.imagesData.find((item: ImageData) => item.id === imageId);
            if (!imageData) return state;
            const previousSnapshot = undoStack[undoStack.length - 1];
            return {
                ...state,
                imagesData: state.imagesData.map((item: ImageData) =>
                    item.id === imageId ? applySnapshot(item, previousSnapshot) : item
                ),
                undoStack: {
                    ...state.undoStack,
                    [imageId]: undoStack.slice(0, undoStack.length - 1)
                },
                redoStack: {
                    ...state.redoStack,
                    [imageId]: (state.redoStack[imageId] || []).concat(makeSnapshot(imageData))
                }
            }
        }
        case Action.REDO_LABEL_HISTORY: {
            const imageId = action.payload.imageId;
            const redoStack = state.redoStack[imageId] || [];
            if (redoStack.length === 0) return state;
            const imageData = state.imagesData.find((item: ImageData) => item.id === imageId);
            if (!imageData) return state;
            const nextSnapshot = redoStack[redoStack.length - 1];
            return {
                ...state,
                imagesData: state.imagesData.map((item: ImageData) =>
                    item.id === imageId ? applySnapshot(item, nextSnapshot) : item
                ),
                undoStack: {
                    ...state.undoStack,
                    [imageId]: (state.undoStack[imageId] || []).concat(makeSnapshot(imageData))
                },
                redoStack: {
                    ...state.redoStack,
                    [imageId]: redoStack.slice(0, redoStack.length - 1)
                }
            }
        }
        default:
            return state;
    }
}
