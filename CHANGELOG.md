# Changelog

All notable changes to VisionWiz are documented in this file.

VisionWiz 的重要变更都会记录在此文件中。

## 1.6.2 - 2026-05-26

### English

- Improved image classification and object detection training consoles by syncing xterm dimensions to the backend pty process and moving side action buttons away from the terminal scrollbar.
- Made capture-record image loading more robust by skipping unrelated folders, non-image files, unreadable images, and missing directories with warnings instead of crashing the main process.
- Added CVAT native XML support for object detection annotations using `image` and `box` entries with `label`, `xtl`, `ytl`, `xbr`, and `ybr`.
- Kept compatibility with Pascal VOC, LabelImg, and existing relaxed VOC XML files, including XML files without explicit size metadata.

### 中文

- 优化图像分类和目标检测训练控制台，将 xterm 尺寸同步给后台 pty 进程，并将右侧悬浮操作按钮左移，避免遮挡控制台滚动条。
- 增强图片拍摄记录读取鲁棒性，遇到无关文件夹、非图片文件、坏图片或不存在的目录时会跳过并记录警告，不再导致主进程崩溃。
- 新增目标检测 CVAT 原生 XML 标注兼容，支持 `image` 和 `box` 结构中的 `label`、`xtl`、`ytl`、`xbr`、`ybr` 字段。
- 保留 Pascal VOC、LabelImg 和已有宽松 VOC XML 文件兼容能力，包括缺少显式尺寸信息的 XML。

## 1.6.1 - 2026-05-25

### English

- Fixed the capture record modal so many captured images no longer push the Open Folder and Close buttons below the visible window area.
- Limited the capture image grid to a dedicated middle scroll region and added safer bottom spacing for Windows taskbar layouts.
- Reduced capture thumbnails slightly to improve browsing density.
- Applied the same safe modal layout to image classification and object detection training detail windows.

### 中文

- 修复拍摄记录弹窗中图片过多时，“打开文件夹”和“退出”按钮被挤到可视区域外的问题。
- 将拍摄图片网格限制在中间滚动区域，并为 Windows 任务栏场景增加更安全的底部间距。
- 适当缩小拍摄记录缩略图，提高大量图片浏览时的信息密度。
- 同步将相同的安全弹窗布局应用到图像分类和目标检测训练详情窗口。

## 1.6.0 - 2026-05-25

### English

- Localized the graphical automatic update helper according to the current VisionWiz language setting.
- Added Simplified Chinese, Traditional Chinese, and English helper text for status, download, cache, install, failure, and log messages.
- Passed localized helper text into PowerShell through UTF-8 Base64 decoding to keep Chinese text readable on Windows.
- Verified the internal update test flow with localized helper output.

### 中文

- 图形化自动更新助手现在会根据 VisionWiz 当前语言设置显示对应语言。
- 为助手窗口的状态、下载、缓存、安装、失败处理和日志信息增加简体中文、繁体中文和英文文案。
- 本地化文案通过 UTF-8 Base64 解码传入 PowerShell，确保 Windows 下中文显示正常。
- 已通过内测自动更新流程验证本地化助手输出。

## 1.5.8 - 2026-05-25

### English

- Published a test target release for validating automatic updates from VisionWiz 1.5.7.
- Retained the independent graphical update-helper launch flow, helper-side PowerShell console hiding, foreground activation, and helper startup logging.
- No additional training workflow changes were introduced in this test release.

### 中文

- 发布用于验证从 VisionWiz 1.5.7 自动更新的测试目标版本。
- 保留独立图形化更新助手启动流程、助手侧隐藏 PowerShell 控制台、窗口置前和助手启动日志。
- 本测试版本没有额外新增训练工作流变更。

## 1.5.7 - 2026-05-25

### English

- Fixed the automatic update helper launch path so the graphical helper appears reliably after VisionWiz exits.
- Changed helper startup to use an independent Windows start command and hide only the PowerShell host console from inside the helper script.
- Added foreground activation and a `Update helper UI shown.` helper log entry for easier update troubleshooting.
- Fixed internal update testing by clearing `ELECTRON_RUN_AS_NODE` before launching Electron.

### 中文

- 修复自动更新助手启动链路，让 VisionWiz 退出后图形化更新助手能够稳定显示。
- 将助手启动方式改为独立的 Windows start 命令，并在助手脚本内部只隐藏 PowerShell 宿主控制台。
- 增加窗口置前逻辑和 `Update helper UI shown.` 助手日志，方便排查更新助手显示问题。
- 修复内测自动更新脚本，启动 Electron 前会清除 `ELECTRON_RUN_AS_NODE`。

## 1.5.6 - 2026-05-22

### English

- Published a test target release for validating automatic updates from VisionWiz 1.5.5.
- Retained the graphical update helper, hidden PowerShell host, local update test script, and protected-entry recompilation flow.
- No additional training workflow changes were introduced in this test release.

### 中文

- 发布用于验证从 VisionWiz 1.5.5 自动更新的测试目标版本。
- 保留图形更新助手、隐藏 PowerShell 宿主、本地更新测试脚本和受保护入口重新编译流程。
- 本测试版本没有额外新增训练工作流变更。

## 1.5.5 - 2026-05-22

### English

- Replaced the console-style automatic update helper with a graphical Windows helper window.
- Added status, progress, visible helper logs, and a controlled close action to the update helper.
- Added `npm run update:test` and `npm run update:test:install` for internal automatic update validation using local installers.
- Internal update tests now recompile the protected entry before launch and preserve the hardware authentication flow.

### 中文

- 将控制台样式的自动更新助手替换为 Windows 图形更新助手窗口。
- 为更新助手增加状态文字、进度条、可见日志和受控关闭操作。
- 新增 `npm run update:test` 和 `npm run update:test:install`，用于通过本地安装包验证自动更新流程。
- 内测更新测试会在启动前重新编译受保护入口，并保留硬件认证流程。

## 1.5.4 - 2026-05-22

### English

- Published a test target release for validating automatic updates from VisionWiz 1.5.3.
- Retained the helper-first update flow, helper-side download resume, cached installer reuse, silent install, and automatic restart behavior.
- No additional training workflow changes were introduced in this test release.

### 中文

- 发布用于验证从 VisionWiz 1.5.3 自动更新的测试目标版本。
- 保留先打开更新助手的更新流程，以及助手端断点续传、缓存复用、静默安装和自动重启行为。
- 本测试版本没有额外新增训练工作流变更。

## 1.5.3 - 2026-05-22

### English

- Reworked automatic updates so the external update helper opens immediately after Auto Update is clicked, before the main app exits.
- Moved update download, resume, cache reuse, silent install, and app restart into the helper process so installation no longer depends on the main app staying alive.
- Added helper-side retry and resume prompts for failed downloads.
- Kept in-app failed-download controls visible and made the update progress window scrollable for long error messages.

### 中文

- 重构自动更新流程，点击“自动更新”后会立即打开外部更新助手，然后再退出主程序。
- 将更新下载、断点续传、缓存复用、静默安装和应用重启交给更新助手处理，安装流程不再依赖主程序继续运行。
- 为更新助手增加下载失败后的重试和继续下载提示。
- 保持应用内下载失败后的操作按钮可见，并让更新进度窗口在错误信息较长时可以滚动查看。

## 1.5.2 - 2026-05-22

### English

- Published a test target release for validating automatic updates from VisionWiz 1.5.1.
- Retained the PowerShell update helper, silent current-directory installation, and automatic app restart behavior.
- No additional training workflow changes were introduced in this test release.

### 中文

- 发布用于验证从 VisionWiz 1.5.1 自动更新的测试目标版本。
- 保留 PowerShell 更新助手、当前目录静默安装和安装成功后自动重启应用的流程。
- 本测试版本没有额外新增训练工作流变更。

## 1.5.1 - 2026-05-22

### English

- Fixed the automatic update helper getting stuck as a `find "PID"` command window after closing VisionWiz.
- Replaced the command-file update helper with a visible PowerShell helper that waits for VisionWiz through `Wait-Process`.
- Kept silent installation into the current VisionWiz install directory and added automatic app restart after successful installation.
- Kept failure diagnostics visible by showing the installer exit code and cached installer path when installation fails.

### 中文

- 修复关闭 VisionWiz 后自动更新助手卡成 `find "PID"` 命令窗口的问题。
- 将 `.cmd` 更新助手替换为可见的 PowerShell 更新助手，通过 `Wait-Process` 等待 VisionWiz 退出。
- 保留静默安装到当前 VisionWiz 安装目录的流程，并在安装成功后自动重新启动应用。
- 安装失败时继续保留诊断信息，显示安装器退出码和缓存安装包路径。

## 1.5.0 - 2026-05-21

### English

- Published a test target release for validating automatic updates from VisionWiz 1.4.8.
- Retained the visible update helper and silent installation into the current VisionWiz directory.
- No additional training workflow changes were introduced in this test release.

### 中文

- 发布用于验证从 VisionWiz 1.4.8 自动更新的测试目标版本。
- 保留可见更新助手窗口，以及静默安装到当前 VisionWiz 目录的更新流程。
- 本测试版本没有额外新增训练工作流变更。

## 1.4.8 - 2026-05-21

### English

- Reworked automatic update installation to launch a visible update helper window after the installer download completes.
- The update helper waits for the running VisionWiz process to exit before starting installation.
- Automatic updates now run the NSIS installer silently with the current VisionWiz installation directory, avoiding manual next-step clicks.
- If installation fails, the helper window stays open with the installer exit code and cached installer path for troubleshooting.

### 中文

- 重构自动更新安装流程，安装包下载完成后会启动可见的更新助手窗口。
- 更新助手会等待当前 VisionWiz 进程完全退出后再开始安装。
- 自动更新现在会使用当前 VisionWiz 安装目录执行 NSIS 静默安装，避免用户手动点击下一步。
- 如果安装失败，助手窗口会保留安装器退出码和缓存安装包路径，方便排查。

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
