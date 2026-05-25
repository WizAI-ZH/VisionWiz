# VisionWiz

VisionWiz is a desktop AI tool focused on K210 and lightweight vision model workflows. It combines image collection, annotation, image classification training, object detection training, model testing, and result inspection in one application.

VisionWiz 是一款面向 K210 与轻量视觉模型工作流的桌面 AI 工具，集成图像采集、数据标注、图像分类训练、目标检测训练、模型测试与结果查看等能力。

## 1.5.7 Update

### English

- Fixed the graphical automatic update helper not appearing after the main VisionWiz window closed.
- The helper is now launched through an independent Windows start command, then hides only the PowerShell host console while keeping the graphical progress window visible.
- Added helper-side foreground activation and a startup log entry so update-helper visibility issues are easier to diagnose.
- Improved `npm run update:test` by clearing `ELECTRON_RUN_AS_NODE` before launching Electron, preventing the internal update test from starting in the wrong runtime mode.

### 中文

- 修复主程序关闭后图形化自动更新助手没有显示的问题。
- 更新助手现在通过独立的 Windows start 命令启动，再由助手脚本只隐藏 PowerShell 宿主控制台，保留图形化进度窗口可见。
- 增加更新助手窗口置前逻辑和启动日志，方便排查助手窗口是否已经成功创建。
- 优化 `npm run update:test`，启动 Electron 前会清除 `ELECTRON_RUN_AS_NODE`，避免内测更新流程进入错误的运行模式。

## 1.5.6 Update

### English

- Test release for validating automatic updates from VisionWiz 1.5.5.
- Keeps the graphical update helper, hidden PowerShell host, local update test script, and protected-entry recompilation flow from 1.5.5.
- No additional training workflow changes are included in this test release.

### 中文

- 用于验证从 VisionWiz 1.5.5 自动更新流程的测试版本。
- 保留 1.5.5 引入的图形更新助手、隐藏 PowerShell 宿主、本地更新测试脚本和受保护入口重新编译流程。
- 本测试版本没有额外新增训练工作流变更。

## 1.5.5 Update

### English

- Replaced the console-style automatic update helper with a cleaner graphical Windows helper window.
- The update helper now shows a status label, progress bar, log panel, and close button while keeping helper logs for troubleshooting.
- Added an internal update test script that recompiles the protected entry before testing and can reuse local installer packages without publishing a release.
- Kept the hardware authentication flow intact during update tests.

### 中文

- 将控制台样式的自动更新助手替换为更清晰的 Windows 图形更新助手窗口。
- 更新助手现在会显示状态文字、进度条、日志区域和关闭按钮，同时保留助手日志便于排查。
- 新增内测自动更新脚本，测试前会重新编译受保护入口，并可复用本地安装包，无需每次发布 Release。
- 内测更新流程保留硬件认证流程，不再跳过验证。

## 1.5.4 Update

### English

- Test release for validating automatic updates from VisionWiz 1.5.3.
- Keeps the helper-first update flow introduced in 1.5.3, including helper-side download resume, cached installer reuse, silent install, and automatic restart.
- No additional training workflow changes are included in this test release.

### 中文

- 用于验证从 VisionWiz 1.5.3 自动更新流程的测试版本。
- 保留 1.5.3 引入的“先打开更新助手，再退出主程序”流程，包括助手端断点续传、缓存复用、静默安装和自动重启。
- 本测试版本没有额外新增训练工作流变更。

## 1.5.3 Update

### English

- Reworked automatic updates so clicking Auto Update immediately opens the external update helper before the main VisionWiz window exits.
- The helper now handles download resume, cached installer reuse, silent installation into the current VisionWiz directory, and automatic restart after installation.
- If the helper download fails, users can retry or resume directly from the helper window without reopening VisionWiz.
- The in-app update failure window now keeps resume/restart buttons visible and allows scrolling when error details are long.

### 中文

- 重构自动更新流程，点击“自动更新”后会先打开外部更新助手，再退出 VisionWiz 主窗口。
- 更新助手现在负责断点续传、复用已缓存安装包、静默安装到当前 VisionWiz 目录，并在安装完成后自动重启应用。
- 如果更新助手下载失败，用户可以直接在助手窗口中重试或继续下载，不需要重新打开 VisionWiz。
- 应用内更新失败窗口现在会稳定显示继续下载和重新下载按钮，错误信息较长时也可以滚动查看。

## 1.5.2 Update

### English

- Test release for validating automatic updates from VisionWiz 1.5.1.
- Keeps the PowerShell update helper, silent current-directory installation, and automatic app restart behavior from 1.5.1.
- No additional training workflow changes are included in this test release.

### 中文

- 用于验证从 VisionWiz 1.5.1 自动更新流程的测试版本。
- 保留 1.5.1 引入的 PowerShell 更新助手、当前目录静默安装和安装成功后自动重启应用流程。
- 本测试版本没有额外新增训练工作流变更。

## 1.5.1 Update

### English

- Fixed the automatic update helper window that could get stuck as a `find "PID"` command window when updating from 1.4.8 to 1.5.0.
- Replaced the old command-file update helper with a visible PowerShell helper that uses `Wait-Process` instead of `tasklist | find`.
- The helper now shows clear update status, runs the installer silently into the current VisionWiz install directory, and restarts VisionWiz after a successful update.

### 中文

- 修复从 1.4.8 更新到 1.5.0 时，自动更新助手可能卡成 `find "PID"` 黑窗口的问题。
- 将旧的命令行 `.cmd` 更新助手替换为可见的 PowerShell 更新助手，使用 `Wait-Process` 等待程序退出，不再使用 `tasklist | find`。
- 更新助手现在会显示清晰的更新状态，静默安装到当前 VisionWiz 安装目录，并在更新成功后自动启动 VisionWiz。

## 1.5.0 Update

### English

- Test release for validating the improved automatic update flow from VisionWiz 1.4.8.
- Keeps the visible update helper and silent current-directory installer flow introduced in 1.4.8.
- No training workflow changes were added beyond the 1.4.8 update behavior.

### 中文

- 用于验证从 VisionWiz 1.4.8 自动更新流程的测试版本。
- 保留 1.4.8 引入的可见更新助手窗口和当前目录静默安装流程。
- 除自动更新测试版本号外，没有新增训练工作流变更。

## 1.4.8 Update

### English

- Improved automatic update installation with a visible update helper window that waits for VisionWiz to close before installing.
- Automatic updates now run the installer silently into the current VisionWiz installation directory, so users do not need to click through the installer wizard.
- The update helper waits for the installer to finish and keeps the window open with the cached installer path if installation fails.

### 中文

- 优化自动更新安装流程，新增可见的更新助手窗口，会等待 VisionWiz 完全关闭后再安装。
- 自动更新会静默安装到当前 VisionWiz 所在目录，用户不需要再逐步点击安装向导。
- 更新助手会等待安装器执行完成；如果安装失败，会保留窗口并显示缓存安装包路径，方便排查。

## 1.4.7 Update

### English

- Added search to historical training logs in image classification and object detection training records, including `Ctrl+F`, previous/next navigation, result counts, and highlighted matches.
- Reduced noisy saved training progress output by showing only the completed progress line for each epoch instead of every intermediate batch update.
- Added the selected data augmentation mode to training record model information for both successful and failed runs.
- Added localized labels for the new data augmentation field in Simplified Chinese, Traditional Chinese, and English.

### 中文

- 为图像分类和目标检测的历史训练日志新增搜索功能，支持 `Ctrl+F`、上一个/下一个、结果计数和命中高亮。
- 精简训练记录中的进度条输出，只显示每一轮训练完成后的进度摘要，不再保存大量中间 batch 进度行。
- 在成功和失败训练记录的模型信息中新增“数据增强”字段，显示本次训练实际使用的增强模式。
- 为新的数据增强字段补充简体中文、繁体中文和英文界面文案。

## 1.4.6 Update

### English

- Improved automatic updates so the installer starts only after VisionWiz has fully closed, reducing install failures caused by files still being in use.
- Moved downloaded update installers into a persistent application update cache instead of the system temp folder.
- Added cache reuse and resume checks for update downloads. Complete installers are reused, partial downloads can continue, and abnormal cached files are re-downloaded.
- Kept the manual restart-download action available so users can discard a bad cached installer when needed.

### 中文

- 优化自动更新安装流程，安装程序会在 VisionWiz 完全关闭后再启动，减少程序文件仍被占用导致的安装失败。
- 将自动更新下载的安装包保存到持久化的应用更新缓存目录，不再依赖系统临时目录。
- 增加更新下载的缓存复用和断点续传校验：完整安装包会直接复用，未完成下载可继续下载，异常缓存会重新下载。
- 保留“重新下载”操作，用户在需要时可以丢弃异常缓存并重新获取安装包。

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
