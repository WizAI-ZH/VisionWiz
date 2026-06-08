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
                name: '编辑标签列表',
                description: '编辑标签列表',
                imageSrc: './ico/tags.png',
                imageAlt: 'labels',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.UPDATE_LABEL))
            },
            {
                name: '导入图片',
                description: '导入新图片到项目中',
                imageSrc: './ico/camera.png',
                imageAlt: 'images',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.IMPORT_IMAGES))
            },
            {
                name: '导入标注文件',
                description: '从文件中导入标注文件信息并更新到对应图片中',
                imageSrc: './ico/import-labels.png',
                imageAlt: 'import-labels',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.IMPORT_ANNOTATIONS))
            },
            {
                name: '导出标注文件',
                description: '导出标注文件',
                imageSrc: './ico/export-labels.png',
                imageAlt: 'export-labels',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.EXPORT_ANNOTATIONS))
            },
            {
                name: 'AI 标注',
                description: '通过本地运行模型推理来协助标注，可能需要网络下载模型',
                imageSrc: './ico/ai.png',
                imageAlt: 'load-ai-model-in-browser',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.LOAD_AI_MODEL))
            }
        ]
    },
    {
        name: '帮助',
        imageSrc: './ico/help.png',
        imageAlt: 'community',
        disabled: false,
        children: [
            {
                name: '快捷键与提示',
                description: '查看快捷键和标注使用提示',
                imageSrc: './ico/help.png',
                imageAlt: 'shortcuts-and-tips',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.HELP_TIPS))
            },
            {
                name: '使用教程',
                description: '阅读“慧标(Make-Sense)”的使用教程',
                imageSrc: './ico/documentation.png',
                imageAlt: 'documentation',
                disabled: false,
                onClick: () => window.open('https://vesibit.yuque.com/ednd8n/rp34u1/zufv1ucsunzkrh0p', '_blank')
            },
            {
                name: '联系我们',
                description: '通过微信二维码、地址、电话方式联系我们',
                imageSrc: './ico/contact_us.png',
                imageAlt: 'contact-us',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.CONTACT_US))
            }
        ]
    }
]
