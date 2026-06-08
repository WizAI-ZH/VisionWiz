import React from 'react';
import {connect} from "react-redux";
import {LabelType} from "../../../../data/enums/LabelType";
import {ISize} from "../../../../interfaces/ISize";
import {AppState} from "../../../../store";
import {ImageData, LabelPoint, LabelRect} from "../../../../store/labels/types";
import {VirtualList} from "../../../Common/VirtualList/VirtualList";
import ImagePreview from "../ImagePreview/ImagePreview";
import './ImagesList.scss';
import {ContextManager} from "../../../../logic/context/ContextManager";
import {ContextType} from "../../../../data/enums/ContextType";
import {ImageActions} from "../../../../logic/actions/ImageActions";
import {EventType} from "../../../../data/enums/EventType";
import {LabelStatus} from "../../../../data/enums/LabelStatus";
import {ImageSortMode} from "../../../../data/enums/ImageSortMode";

interface IProps {
    activeImageIndex: number;
    imagesData: ImageData[];
    activeLabelType: LabelType;
    imageSortMode: ImageSortMode;
}

interface IState {
    size: ISize;
}

class ImagesList extends React.Component<IProps, IState> {
    private imagesListRef: HTMLDivElement;

    constructor(props) {
        super(props);

        this.state = {
            size: null,
        }
    }

    public componentDidMount(): void {
        this.updateListSize();
        window.addEventListener(EventType.RESIZE, this.updateListSize);
    }

    public componentWillUnmount(): void {
        window.removeEventListener(EventType.RESIZE, this.updateListSize);
    }

    private updateListSize = () => {
        if (!this.imagesListRef)
            return;

        const listBoundingBox = this.imagesListRef.getBoundingClientRect();
        this.setState({
            size: {
                width: listBoundingBox.width,
                height: listBoundingBox.height
            }
        })
    };

    private isImageChecked = (index:number): boolean => {
        const imageData = this.props.imagesData[index]
        switch (this.props.activeLabelType) {
            case LabelType.LINE:
                return imageData.labelLines.length > 0
            case LabelType.IMAGE_RECOGNITION:
                return imageData.labelNameIds.length > 0
            case LabelType.POINT:
                return imageData.labelPoints
                    .filter((labelPoint: LabelPoint) => labelPoint.status === LabelStatus.ACCEPTED)
                    .length > 0
            case LabelType.POLYGON:
                return imageData.labelPolygons.length > 0
            case LabelType.RECT:
                return imageData.labelRects
                    .filter((labelRect: LabelRect) => labelRect.status === LabelStatus.ACCEPTED)
                    .length > 0
        }
    };

    private onClickHandler = (index: number) => {
        ImageActions.getImageByIndex(index)
    };

    private onSortModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        ImageActions.updateImageSortMode(event.target.value as ImageSortMode);
    };

    private renderImagePreview = (index: number, isScrolling: boolean, isVisible: boolean, style: React.CSSProperties) => {
        return <ImagePreview
            key={index}
            style={style}
            size={{width: 150, height: 150}}
            isScrolling={isScrolling}
            isChecked={this.isImageChecked(index)}
            imageData={this.props.imagesData[index]}
            onClick={() => this.onClickHandler(index)}
            isSelected={this.props.activeImageIndex === index}
        />
    };

    public render() {
        const { size } = this.state;
        return(
            <div
                className="ImagesList"
                ref={ref => this.imagesListRef = ref}
                onClick={() => ContextManager.switchCtx(ContextType.LEFT_NAVBAR)}
            >
                <div className="ImagesSortBar">
                    <span>Sort</span>
                    <select value={this.props.imageSortMode} onChange={this.onSortModeChange} title="Change image sort order">
                        <option value={ImageSortMode.NATURAL_ASC}>Natural A-Z</option>
                        <option value={ImageSortMode.NATURAL_DESC}>Natural Z-A</option>
                        <option value={ImageSortMode.NAME_ASC}>Name A-Z</option>
                        <option value={ImageSortMode.NAME_DESC}>Name Z-A</option>
                        <option value={ImageSortMode.MODIFIED_DESC}>Newest first</option>
                        <option value={ImageSortMode.MODIFIED_ASC}>Oldest first</option>
                    </select>
                </div>
                {!!size && <VirtualList
                    size={{width: size.width, height: size.height - 34}}
                    childSize={{width: 150, height: 150}}
                    childCount={this.props.imagesData.length}
                    childRender={this.renderImagePreview}
                    overScanHeight={200}
                />}
            </div>
        )
    }
}

const mapDispatchToProps = {};

const mapStateToProps = (state: AppState) => ({
    activeImageIndex: state.labels.activeImageIndex,
    imagesData: state.labels.imagesData,
    activeLabelType: state.labels.activeLabelType,
    imageSortMode: state.labels.imageSortMode
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ImagesList);
