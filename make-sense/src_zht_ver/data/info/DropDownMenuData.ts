import {updateActivePopupType} from '../../store/general/actionCreators';
import {PopupWindowType} from '../enums/PopupWindowType';
import {store} from '../../index';

export type DropDownMenuNode = {
    name: string
    description?: string
    imageSrc: string
    imageAlt: string
    disabled: boolean
    onClick?: () => void
    children?: DropDownMenuNode[]
}

export const DropDownMenuData: DropDownMenuNode[] = [
    {
        name: '操作',
        imageSrc: './ico/actions.png',
        imageAlt: 'actions',
        disabled: false,
        children: [
            {
                name: '編輯標籤清單',
                description: '編輯標籤清單',
                imageSrc: './ico/tags.png',
                imageAlt: 'labels',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.UPDATE_LABEL))
            },
            {
                name: '匯入圖片',
                description: '匯入新圖片到專案中',
                imageSrc: './ico/camera.png',
                imageAlt: 'images',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.IMPORT_IMAGES))
            },
            {
                name: '匯入標註檔案',
                description: '從檔案中匯入標註資訊並更新到對應圖片中',
                imageSrc: './ico/import-labels.png',
                imageAlt: 'import-labels',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.IMPORT_ANNOTATIONS))
            },
            {
                name: '匯出標註檔案',
                description: '匯出標註檔案',
                imageSrc: './ico/export-labels.png',
                imageAlt: 'export-labels',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.EXPORT_ANNOTATIONS))
            },
            {
                name: 'AI 標註',
                description: '透過本地執行模型推理來協助標註，可能需要網路下載模型',
                imageSrc: './ico/ai.png',
                imageAlt: 'load-ai-model-in-browser',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.LOAD_AI_MODEL))
            }
        ]
    },
    {
        name: '幫助',
        imageSrc: './ico/help.png',
        imageAlt: 'community',
        disabled: false,
        children: [
            {
                name: '快捷鍵與提示',
                description: '查看快捷鍵和標註使用提示',
                imageSrc: './ico/help.png',
                imageAlt: 'shortcuts-and-tips',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.HELP_TIPS))
            },
            {
                name: '使用教學',
                description: '閱讀「慧標(Make-Sense)」的使用教學',
                imageSrc: './ico/documentation.png',
                imageAlt: 'documentation',
                disabled: false,
                onClick: () => window.open('https://vesibit.yuque.com/ednd8n/rp34u1/zufv1ucsunzkrh0p', '_blank')
            },
            {
                name: '聯絡我們',
                description: '透過微信二維碼、地址、電話方式聯絡我們',
                imageSrc: './ico/contact_us.png',
                imageAlt: 'contact-us',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.CONTACT_US))
            }
        ]
    }
]
