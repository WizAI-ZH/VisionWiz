# Changelog

All notable changes to VisionWiz are documented in this file.

VisionWiz 的重要变更都会记录在此文件中。

## 1.4.3 - 2026-05-11

### English

- Added selectable data augmentation modes for image classification and object detection: auto, off, geometry, color, and blur/noise.
- Added class-level dataset count summaries at training startup. Classification reports valid image counts per class; object detection reports both image counts and bounding-box counts.
- Improved object detection dataset robustness by skipping unrelated files, subfolders, invalid XML files, missing images, unsupported image files, and invalid boxes with warnings.

### 中文

- 为图像分类和目标检测新增可选择的数据增强模式：自动、关闭、几何变换、颜色/亮度、模糊/噪声。
- 在训练启动阶段加入类别级数据量汇总。图像分类显示每类有效图片数；目标检测同时显示每类图片数和标注框数。
- 增强目标检测数据集读取鲁棒性，无关文件、子文件夹、无效 XML、缺失图片、不支持图片和无效标注框会被跳过并记录警告。

## 1.4.2 - 2026-05-09

### English

- Improved the capture history dialog layout on the data collection page so footer actions remain fully visible even with many images.
- Added a new "show image on board LCD" parameter to the VisionWiz image sync library, enabled by default, and wired it into the Mixly blocks and sample library.

### 中文

- 优化数据采集页拍摄记录弹窗布局，在图片较多时也能完整显示底部“打开文件夹”“退出”按钮。
- 为 VisionWiz 图传同步库新增“主板屏幕是否显示图像”参数，默认开启，并同步接入 Mixly 积木与示例库。

## 1.4.1 - 2026-05-09

### English

- Improved how quickly physical serial disconnects are invalidated, so the authentication dialog returns sooner.
- Added higher-frequency presence monitoring for the currently authenticated serial port to reduce quick replug bypass cases.
- Cleared preview and authentication state immediately on serial `close/error` events to avoid stale session carry-over.

### 中文

- 优化串口物理断开后的失效判定速度，缩短认证弹窗重新出现的等待时间。
- 为当前已认证串口增加更高频的存在性巡检，降低“短时间断开后快速重连绕过重新验证”的概率。
- 在串口 `close/error` 回调中立即清空预览与认证状态，避免旧连接残留。

## 1.4.0 - 2026-05-08

### English

- Added integrated K210 live preview in the data collection page after device authentication on the same serial connection.
- Improved the preview and capture workflow with burst capture, frame-based saving, and a quick action to open the saved image folder.
- Fixed main-process IPC issues during serial authentication and preview switching, and completed the preview status synchronization flow.
- Refined the startup window sequence so the loading screen appears first and the main window is revealed later.
- Normalized a batch of core scripts, pages, and locale files to UTF-8 to reduce Chinese text encoding issues.

### 中文

- 在图像采集页集成 K210 实时预览能力，认证成功后可直接复用同一串口查看主控画面。
- 优化主控预览与图像采集联动，支持连拍、按帧保存，以及从拍摄记录中一键打开对应路径。
- 修复串口认证与预览切换过程中的主进程通信问题，补齐预览状态同步链路。
- 调整启动阶段窗口顺序，强化加载页优先显示和主窗口延后显示逻辑。
- 统一一批核心脚本、页面与语言文件为 UTF-8 编码，减少中文乱码问题。
