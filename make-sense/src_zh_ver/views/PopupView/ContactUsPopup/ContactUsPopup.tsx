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
                联系我们
            </div>
            <div className="Content">
                
                <div className="PhoneNumber">
                    <strong>电话号码：</strong>13168665808
                </div>
                <div className="QRCode">
                    <strong>微信客服二维码</strong>
                    <img
                        src={'./ico/contactus_callcenter.png'}
                        alt={'客服联系二维码'}
                    />
                </div>
                <div className="Address">
                    <strong>联系地址：</strong>珠海市横琴天河街28号105室-265
                </div>
            </div>
            <div className="Footer">
                <div className="CloseButton" onClick={onClose}>
                    退出
                </div>
            </div>
        </div>
    );
};

export default ContactUsPopup