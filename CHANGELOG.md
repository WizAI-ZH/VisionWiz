# Changelog

All notable changes to VisionWiz are documented in this file.

## 1.4.0 - 2026-05-08

### 中文
- 在图像采集页集成 K210 实时预览能力，认证成功后可直接复用同一串口查看主控画面。
- 优化主控预览与图像采集联动，支持连拍、按帧保存，以及从拍摄记录中一键打开对应路径。
- 修复串口认证与预览切换过程中的主进程通信问题，补齐预览状态同步链路。
- 调整启动阶段窗口顺序，强化加载页优先显示和主窗口延后显示逻辑。
- 统一一批核心脚本、页面与语言文件为 UTF-8 编码，减少中文乱码问题。

### English
- Added integrated K210 live preview in the data collection page after device authentication on the same serial connection.
- Improved the preview and capture workflow with burst capture, frame-based saving, and a quick action to open the saved image folder.
- Fixed main-process IPC issues during serial authentication and preview switching, and completed the preview status synchronization flow.
- Refined the startup window sequence so the loading screen appears first and the main window is revealed later.
- Normalized a batch of core scripts, pages, and locale files to UTF-8 to reduce Chinese text encoding issues.
