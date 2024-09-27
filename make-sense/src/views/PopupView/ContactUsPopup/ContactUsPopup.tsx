import React from 'react';  
import { connect } from 'react-redux'
import { AppState } from '../../../store';;
import './ContactUsPopup.scss';  
import { PopupActions } from '../../../logic/actions/PopupActions';  
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';

const ContactUsPopup: React.FC = () => {  
    const onClose = () => {  
        PopupActions.close();  
    };  

    return (  
        <div className="ContactUsPopup">  
            <div className="Content">  
                <h2>Contact Us</h2>  
                <div className="PhoneNumber">  
                    <strong>Phone Number:</strong> 13168665808  
                </div>  
                <div className="QRCode">   
                    <p><strong>WeChat Support QR Code</strong></p>  
                    <img  
                        src={'./ico/contactus_callcenter.png'}  
                        alt={'Customer Support QR Code'}  
                    />  
                </div>  
                <div className="Address">  
                    <strong>Contact Address:</strong> Room 105-265, No. 28 Tianhe Street, Hengqin, Zhuhai  
                </div>  
            </div>  
            <div className="CloseButton" onClick={onClose}>  
                Close  
            </div>  
        </div>
    );  
};  

export default ContactUsPopup