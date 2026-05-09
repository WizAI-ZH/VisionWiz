# VisionWiz

VisionWiz is a desktop AI tool focused on K210 and lightweight vision model workflows. It combines image collection, annotation, image classification training, object detection training, model testing, and result inspection in one application.

VisionWiz 是一款面向 K210 与轻量视觉模型工作流的桌面 AI 工具，集成图像采集、数据标注、图像分类训练、目标检测训练、模型测试与结果查看等能力。

## 1.4.1 Update

- Improved controller serial disconnect invalidation so quick unplug/replug cycles are far less likely to bypass re-authentication.
- Added faster presence monitoring for the currently authenticated serial port.
- Cleared preview and authentication state immediately when the serial connection closes or errors out.

## 1.4.1 更新

- 优化主控串口物理断开后的认证失效速度，降低短时间拔插后绕过重新验证的情况。
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
- 自动更新：启动后可检查 GitHub Releases 更新，并支持安装包更新流程。

## Installation

Please visit the following page for the latest installer and update guidance:

- https://vesibit.yuque.com/ednd8n/visionwiz/intro

## 安装

最新版安装包与更新说明请访问：

- https://vesibit.yuque.com/ednd8n/visionwiz/intro

## License

This project is licensed under GPL-3.0-or-later. See [LICENSE](./LICENSE) for details.

## 许可协议

本项目遵循 GPL-3.0-or-later，详情请参阅 [LICENSE](./LICENSE)。
