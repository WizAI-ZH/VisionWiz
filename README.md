# VisionWiz

VisionWiz is a desktop AI tool focused on K210 and lightweight vision model workflows. It combines image collection, annotation, image classification training, object detection training, model testing, and result inspection in one application.

VisionWiz 是一款面向 K210 与轻量视觉模型工作流的桌面 AI 工具，集成图像采集、数据标注、图像分类训练、目标检测训练、模型测试与结果查看等能力。

## 1.4.5 Update

### English

- Added search and clear-screen tools to the image classification and object detection training consoles.
- Improved training record logs so historical runs can show a complete, readable terminal transcript, including failures and conversion errors.
- Improved object detection XML compatibility for annotations without `size` or `difficult` fields while keeping standard Pascal VOC XML support.
- Added retry handling for occasional NCC KModel conversion crashes.

### 中文

- 为图像分类和目标检测训练控制台新增搜索和清屏工具。
- 优化训练记录日志，历史训练可以显示更完整、更易读的终端输出，包括失败信息和转换错误。
- 优化目标检测 XML 兼容性，支持缺少 `size` 或 `difficult` 字段的标注文件，同时保留标准 Pascal VOC XML 支持。
- 为偶发的 NCC KModel 转换崩溃增加自动重试。

## 1.4.3 Update

### English

- Added more data augmentation modes for image classification and object detection training.
- Added class-level dataset counts to the initial training logs so users can spot classes with too few samples.
- Improved object detection dataset loading so unrelated files, folders, broken XML files, and unsupported images are skipped with warnings instead of stopping training immediately.
- Fixed packaged language switching by resolving protected language loaders from their actual script path, and improved long training-folder guidance layout in English.

### 中文

- 为图像分类和目标检测训练新增更多数据增强模式。
- 在训练初始化日志中加入按类别统计的数据量，方便用户发现样本过少的类别。
- 增强目标检测数据集读取鲁棒性，无关文件、文件夹、损坏 XML 和不支持的图片会被跳过并记录警告，不再直接中断训练。
- 修复打包后语言切换加载保护脚本路径错误的问题，并优化英文训练集说明文字换行布局。

## 1.4.2 Update

### English

- Improved the capture history dialog layout so footer actions remain fully visible even when many images are listed.
- Added a board-LCD display toggle to the VisionWiz image sync library and Mixly blocks, enabled by default.

### 中文

- 优化拍摄记录弹窗布局，图片较多时底部操作按钮仍能完整显示。
- 为 VisionWiz 图传同步库和 Mixly 积木新增主板 LCD 显示开关，默认开启。

## 1.4.1 Update

### English

- Improved controller serial disconnect invalidation so quick unplug/replug cycles are far less likely to bypass re-authentication.
- Added faster presence monitoring for the currently authenticated serial port.
- Cleared preview and authentication state immediately when the serial connection closes or errors out.

### 中文

- 优化主控串口物理断开后的认证失效速度，降低短时间拔插后绕过重新验证的概率。
- 为当前已认证串口增加更高频的存在性巡检。
- 在串口关闭或异常时立即清空预览与认证状态。

## Features

- Image Collection: supports PC camera capture, K210 preview capture, burst capture, and capture history management.
- Data Annotation: integrates the HuiBiao (Make-Sense) annotation workflow.
- Image Classification: includes dataset setup, training progress views, log inspection, and export tools.
- Object Detection: supports input-size selection, training history review, test result inspection, and model export.
- Auto Update: checks GitHub Releases on startup and supports installer-based updates.

## 功能概览

- 图像采集：支持电脑摄像头采集、K210 主控预览采集、连拍保存与拍摄记录管理。
- 数据标注：集成慧标（Make-Sense）标注流程。
- 图像分类：提供数据集配置、训练进度查看、日志分析与结果导出。
- 目标检测：支持输入尺寸选择、训练历史查看、测试结果展示与模型导出。
- 自动更新：启动后检查 GitHub Releases 更新，并支持安装包更新流程。

## Installation

Please visit the following page for the latest installer and update guidance:

- https://vesibit.yuque.com/ednd8n/visionwiz/intro

## 安装

最新安装包与更新说明请访问：

- https://vesibit.yuque.com/ednd8n/visionwiz/intro

## License

This project is licensed under GPL-3.0-or-later. See [LICENSE](./LICENSE) for details.

## 许可证

本项目遵循 GPL-3.0-or-later，详情请参阅 [LICENSE](./LICENSE)。
