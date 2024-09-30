import React from 'react';
import './TopNavigationBar.scss';
import StateBar from '../StateBar/StateBar';
import {PopupWindowType} from '../../../data/enums/PopupWindowType';
import {AppState} from '../../../store';
import {connect} from 'react-redux';
import {updateActivePopupType, updateProjectData} from '../../../store/general/actionCreators';
import {ProjectData} from '../../../store/general/types';
import DropDownMenu from './DropDownMenu/DropDownMenu';

interface IProps {
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
    updateProjectDataAction: (projectData: ProjectData) => any;
    projectData: ProjectData;
}

const TopNavigationBar: React.FC<IProps> = (props) => {
    const onFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        event.target.setSelectionRange(0, event.target.value.length);
    };

    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value
            .toLowerCase()
            .replace(' ', '-');

        props.updateProjectDataAction({
            ...props.projectData,
            name: value
        })
    };

    const closePopup = () => props.updateActivePopupTypeAction(PopupWindowType.EXIT_PROJECT)

    return (
        <div className='TopNavigationBar'>
            <StateBar/>
            <div className='TopNavigationBarWrapper'>
                <div className='NavigationBarGroupWrapper'>
                    <div
                        className='Header'
                        onClick={closePopup}
                    >
                        <img
                            draggable={false}
                            alt={'make-sense'}
                            src={'./make-sense-ico-transparent.png'}
                        />
                        慧标(Make Sense)
                    </div>
                </div>
                <div className='NavigationBarGroupWrapper'>
                    <DropDownMenu/>
                </div>
                <div className='NavigationBarGroupWrapper middle'>
                    <div className='ProjectName'>在这里开始你的标注</div>
                </div>
            </div>
        </div>
    );
};

const mapDispatchToProps = {
    updateActivePopupTypeAction: updateActivePopupType,
    updateProjectDataAction: updateProjectData
};

const mapStateToProps = (state: AppState) => ({
    projectData: state.general.projectData
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(TopNavigationBar);
