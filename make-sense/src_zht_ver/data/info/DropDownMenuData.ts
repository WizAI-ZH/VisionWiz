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
                name: '導入圖片',
                description: '導入新圖片到項目中',
                imageSrc: './ico/camera.png',
                imageAlt: 'images',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.IMPORT_IMAGES))
            },
            {
                name: '導入標註文件',
                description: '從文件中導入標註文件信息並更新到對應圖片中',
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
                name: 'AI標註',
                description: '通過本地運行模型推理來協助標注',
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
                name: '使用教程',
                description: '閱讀「慧標(Make-Sense)」的使用教學課程',
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

