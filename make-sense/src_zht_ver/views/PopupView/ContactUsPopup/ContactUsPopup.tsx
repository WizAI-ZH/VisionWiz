import React from 'react';
import './ContactUsPopup.scss';
import { PopupActions } from '../../../logic/actions/PopupActions';

const ContactUsPopup: React.FC = () => {
    const onClose = () => {
        PopupActions.close();
    };

    return (
        <div className="ContactUsPopup">
            <div className='Header'>
                聯繫我們
            </div>
            <div className="Content">
                <div className="PhoneNumber">
                    <strong>電話號碼：</strong>13168665808
                </div>
                <div className="QRCode">
                    <strong>微信客服二維碼</strong>
                    <img
                        src={'./ico/contactus_callcenter.png'}
                        alt={'客戶聯絡二維碼'}
                    />
                </div>
                <div className="Address">
                    <strong>聯繫地址：</strong>珠海市橫琴天河街28號105室-265
                </div>
            </div>
            <div className='Footer'>
                <div className="CloseButton" onClick={onClose}>
                    退出
                </div>
            </div>
        </div>
    );
};
export default ContactUsPopup