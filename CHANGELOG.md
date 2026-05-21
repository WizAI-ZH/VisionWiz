# Changelog

All notable changes to VisionWiz are documented in this file.

VisionWiz 的重要变更都会记录在此文件中。

## 1.4.7 - 2026-05-21

### English

- Added searchable historical training logs for both image classification and object detection training records.
- Added `Ctrl+F`, previous/next navigation, result counts, and highlighted current matches in training record log views.
- Compact saved and displayed training progress logs by keeping only the completed progress line for each epoch.
- Added the selected data augmentation mode to training record model information, including failed training detail views.
- Added Simplified Chinese, Traditional Chinese, and English labels for the training-record data augmentation field.

### 中文

- 为图像分类和目标检测训练记录新增历史训练日志搜索功能。
- 在训练记录日志视图中支持 `Ctrl+F`、上一个/下一个、结果计数和当前命中高亮。
- 精简保存和展示的训练进度日志，每一轮只保留完成后的进度行，减少中间 batch 进度刷屏。
- 在训练记录模型信息中新增本次训练选择的数据增强模式，失败训练详情也同步显示。
- 为训练记录中的数据增强字段补充简体中文、繁体中文和英文文案。

## 1.4.6 - 2026-05-21

### English

- Improved the automatic update install flow so VisionWiz quits first and launches the installer only after the running app process has exited.
- Changed update installer storage from the system temp directory to a persistent application update cache.
- Added installer cache validation using the GitHub release asset size so completed downloads can be reused and partial downloads can resume.
- Added safer handling for abnormal cached installer files and preserved the restart-download path for forcing a clean download.

### 中文

- 优化自动更新安装流程，VisionWiz 会先退出，并在当前应用进程结束后再启动安装程序。
- 将更新安装包从系统临时目录改为保存到持久化的应用更新缓存目录。
- 增加基于 GitHub Release 资源大小的安装包缓存校验，完整下载可复用，未完成下载可断点续传。
- 增强异常缓存安装包的处理，并保留“重新下载”路径，方便用户强制重新获取干净安装包。

## 1.4.5 - 2026-05-21

### English

- Added searchable training consoles for image classification and object detection, with `Ctrl+F`, next/previous result navigation, and a right-click search entry.
- Added a right-click clear-screen action for training consoles that clears only the visible terminal output without affecting the running process or saved logs.
- Added complete terminal transcript capture for training records and cleaned saved logs by removing terminal control codes and formatting progress updates as readable lines.
- Improved object detection XML parsing for annotation files that omit `size` or `difficult`, while preserving standard Pascal VOC compatibility.
- Added NCC KModel conversion retries so occasional converter process crashes do not immediately fail an otherwise completed training run.

### 中文

- 为图像分类和目标检测训练控制台新增搜索能力，支持 `Ctrl+F`、上一个/下一个结果和右键菜单搜索入口。
- 为训练控制台新增右键清屏操作，只清空可见终端内容，不影响正在运行的进程和已保存日志。
- 为训练记录新增完整终端输出保存，并清理日志中的终端控制码，将训练进度输出整理为更易读的多行文本。
- 优化目标检测 XML 解析，兼容缺少 `size` 或 `difficult` 字段的标注文件，同时保持标准 Pascal VOC 格式兼容。
- 为 NCC KModel 转换增加自动重试，降低转换器进程偶发崩溃导致整次训练失败的概率。

## 1.4.3 - 2026-05-11

### English

- Added selectable data augmentation modes for image classification and object detection: auto, off, geometry, color, and blur/noise.
- Added class-level dataset count summaries at training startup. Classification reports valid image counts per class; object detection reports both image counts and bounding-box counts.
- Improved object detection dataset robustness by skipping unrelated files, subfolders, invalid XML files, missing images, unsupported image files, and invalid boxes with warnings.
- Fixed packaged language switching when protected language loader scripts were resolved relative to the feature page instead of `utils_protected`.
- Improved the training-folder guidance layout so long English descriptions no longer overlap the folder input fields.

### 中文

- 为图像分类和目标检测新增可选择的数据增强模式：自动、关闭、几何变换、颜色/亮度、模糊/噪声。
- 在训练启动阶段加入类别级数据量汇总。图像分类显示每类有效图片数；目标检测同时显示每类图片数和标注框数。
- 增强目标检测数据集读取鲁棒性，无关文件、子文件夹、无效 XML、缺失图片、不支持图片和无效标注框会被跳过并记录警告。
- 修复打包后语言切换时保护版语言 loader 相对页面目录解析，导致找不到 `language-html.jsc` 的问题。
- 优化训练集说明区域布局，避免英文长说明换行后遮挡文件夹选择输入框。

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
