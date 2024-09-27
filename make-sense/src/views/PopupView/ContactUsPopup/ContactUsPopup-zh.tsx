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
                <h2>联系我们</h2>  
                <div className="PhoneNumber">  
                    <strong>电话号码：</strong>13168665808  
                </div>  
                <div className="QRCode"> 
                    <p><strong>微信客服二维码</strong> </p>
                    <img  
                        src={'./ico/contactus_callcenter.png'}  
                        alt={'客服联系二维码'}  
                    />  
                </div>  
                <div className="Address">  
                    <strong>联系地址：</strong>珠海市横琴天河街28号105室-265  
                </div>  
            </div>  
            <div className="CloseButton" onClick={onClose}>  
                退出  
            </div>  
        </div>  
    );  
};  

// const mapStateToProps = (state: AppState) => ({});
// const mapDispatchToProps = {};

// export default connect(
//     mapStateToProps,
//     mapDispatchToProps
// )(ContactUsPopup); 
export default ContactUsPopup