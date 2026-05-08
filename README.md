# 威智慧眼 / VisionWiz

威智慧眼（VisionWiz）是一款面向 K210 与轻量视觉模型工作流的桌面 AI 工具，集成图像采集、数据标注、图像分类训练、目标检测训练、模型测试与结果查看等能力。

VisionWiz is a desktop AI tool focused on K210 and lightweight vision model workflows. It combines image collection, annotation, image classification training, object detection training, model testing, and result inspection in one application.

## 功能概览 / Features

- 图像采集 / Image Collection  
  支持电脑摄像头采集、K210 主控预览采集、连拍保存与拍摄记录管理。  
  Supports PC camera capture, K210 controller preview capture, burst capture, and capture history management.

- 数据标注 / Data Annotation  
  集成慧标（Make-Sense）标注工具，便于整理训练数据。  
  Includes the HuiBiao (Make-Sense) annotation tool for dataset preparation.

- 图像分类 / Image Classification  
  提供数据集配置、训练过程查看、日志分析与结果导出。  
  Includes dataset setup, training progress views, log inspection, and export tools.

- 目标检测 / Object Detection  
  支持输入尺寸选择、训练历史查看、测试结果展示与模型导出。  
  Supports input-size selection, training history review, test result inspection, and model export.

- 自动更新 / Auto Update  
  软件启动后可检查 GitHub Releases 更新，并支持自动下载安装包。  
  The app can check GitHub Releases on startup and download the installer automatically.

## 1.4.0 更新亮点 / Highlights

- 新增 K210 实时预览接入图像采集页。  
  Added K210 live preview inside the data collection page.

- 新增连拍模式与拍摄记录打开路径按钮。  
  Added burst capture mode and a quick action to open capture folders.

- 修复串口认证与预览状态同步问题。  
  Fixed serial authentication and preview status synchronization issues.

- 优化启动加载流程与一批 UTF-8 编码问题。  
  Improved startup loading flow and cleaned up a batch of UTF-8 encoding issues.

## 安装 / Installation

请访问以下页面获取最新安装包与更新说明：  
Please visit the following page for the latest installer and release guidance:

- https://vesibit.yuque.com/ednd8n/visionwiz/intro

## 开源许可 / License

本项目遵循 GPL-3.0-or-later 许可证，详细信息请参阅 [LICENSE](./LICENSE)。  
This project is licensed under GPL-3.0-or-later. See [LICENSE](./LICENSE) for details.
