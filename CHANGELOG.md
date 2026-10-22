# Changelog

All notable changes to VisionWiz are documented in this file.

VisionWiz 的重要变更都会记录在此文件中。

## 1.8.2 - 2026-10-22

### 中文

- 优化模型测试上传：按板上 SD 卡模型内容校验，重复模型无需再次传输；同内容异名模型可安全复用，并同步更新测试程序引用路径。
- 增强上传完成后的内容确认，优化程序上传稳定性及部分上传失败、中断后的恢复处理。
- 图像采集预览增加实时 FPS，新增 JPEG 85 极清画质档位，改进 224×224 等尺寸的摄像头硬件取景及图传状态。
- 改善摄像头重新连接后的预览启动等待，减少初始化期间的错误提示。
- 更新助手增加直接可点击的重试、文件夹、取消与确定按钮，并改善下载中断后的安装包释放和续传。
- 已完成本机及实体威智板 USB 模型复用测试；其他连接方式和硬件配置的表现仍以实际测试为准。

### English

- Improved model-test uploads with SD-card content verification. Identical models are reused without retransmission, including when filenames differ; the test program's model path follows the reused file.
- Strengthened post-upload content checks and improved program-upload reliability and recovery from interrupted transfers.
- Added live FPS to the camera preview, a JPEG 85 highest-quality setting, and improved native camera framing and stream state for resolutions such as 224×224.
- Improved camera preview startup after reconnection to reduce false initialization errors.
- Added clickable Retry, Open Folder, Cancel, and OK buttons to the update helper, with better installer-file release and resumable downloads on cancellation.
- Verified USB model reuse on a real controller and completed local regression tests; results on other devices and connections may vary.

## 1.8.1 - 2026-10-19

### 中文

- 修复设备验证通过后因 GitHub 匿名 API 403 限流、超时或临时不可用而不显示更新提示的问题：失败时改查 GitHub 官方公开 Release 页面，识别最新版和安装包。
- 更新检查在首次失败后不再永久停止；增加 15、45、120 秒有限重试，验证成功后仅显示一次更新弹窗。
- 备用检查限定官方仓库、稳定版本 Tag、匹配版本的 Windows Setup 安装包，避免错误更新链接。
- 已通过 API 限流模拟、备用页面在线查询、重试和链接校验；真实安装版与设备验证的完整联调仍需复验。

### English

- Fixed silent update-prompt failures after device authentication when GitHub's anonymous API is rate-limited (HTTP 403), times out, or is temporarily unavailable; the updater now falls back to the official public GitHub Release page.
- Added bounded retries after 15, 45, and 120 seconds instead of treating a failed update check as permanently complete; the update prompt still appears only once.
- Validated official repository URLs, stable version tags, and matching Windows Setup installers to avoid incorrect update links.
- Passed API rate-limit simulations, live Release-page lookup, retry, and URL checks; the installed-app and real-device authentication flow still needs end-to-end verification.

## 1.8.0 - 2026-10-16

### 中文

- 修复图像采集页面连接威智板后摄像头选择按钮仍显示未连接的问题；在 USB/无线实际图传时显示绿色 VESIBIT 同传状态，停止或断线自动恢复。
- 统一 USB/无线图传 JPEG 35/50 画质选项，无线保留自动质量和速度档位；修复所选图传分辨率与保存 JPG 像素不一致的问题。
- 有线图传重新启用摄像头自动增益和自动白平衡，改善偏暗/偏色风险；高画质可能降低帧率，需实机按需选择。
- 图像分类和目标检测混合分辨率数据预处理：统一训练/量化输入大小，转换检测框坐标且不改写原图及标注。
- 增强旧版 USB AUTH 回复的换行、串口混合输出兼容性，继续严格验证签名；实机恢复情况待复测。
- 图像分类和目标检测测试前新增模型命名弹窗，按训练记录记住名称；模型名限 24 个 ASCII 字符，以字母开头，支持数字、下划线及连字符，并禁止保留文件名。
- 上传测试程序时，SD 卡中的 KModel 文件名与 main.py 加载路径同步使用用户名称，自定义名称继续使用高速上传和自动降级。
- 修复图像分类选择 320x224 等输入尺寸后仍使用默认 224x224 建模的问题，导出 boot.py 的摄像头窗口同步使用所选尺寸；旧模型需重新训练。
- 加入 GPT-6.1 开发入口、项目交接和发布流程文档，记录构建方式、设备身份和验证边界。
- 包含实验性 VESIBIT 无线连接与初始化入口、独立 ESP32-S3 兼容固件及 K210 代理；保留旧协议，使用用户 Wi-Fi 配置或设备唯一热点。完整无线真机链路仍需验收。

### English

- Fixed the camera-selection button remaining disconnected while VESIBIT USB/wireless JPEG frames were streaming. It now shows the active VESIBIT source in green and resets on stop/disconnect.
- Unified JPEG 35/50 image quality controls for USB and wireless capture, retained wireless Auto/FPS presets, and fixed incorrect physical image sizes in saved JPG files.
- Re-enabled automatic gain and white balance for wired camera initialization to reduce dark/color-shifted captures; higher image quality may lower real FPS.
- Aligned mixed-resolution classification/detection training and calibration data; detection boxes are scaled consistently without modifying original images or XML annotations.
- Improved legacy USB AUTH framing in the presence of mixed serial output while retaining mandatory signature verification. On-device revalidation is still pending.
- Added model naming before classification and detection tests, with names remembered per training record. Names use up to 24 ASCII characters, start with a letter, allow digits, underscores and hyphens, and reject reserved filenames.
- Model-test uploads use the selected name for both the SD-card KModel file and the main.py loading path. Named models retain fast uploads and automatic fallback.
- Fixed classification training falling back to 224x224 despite selecting an input size such as 320x224, and aligned the exported boot.py camera window with the selected dimensions. Previously generated models need retraining.
- Added GPT-6.1 development entry points, handoff notes and release instructions covering builds, device identity and verification limits.
- Includes experimental VESIBIT wireless connection and initialization, isolated compatible ESP32-S3 firmware and a K210 agent. Legacy protocols are retained; Wi-Fi uses user settings or a unique device access point. Full wireless hardware acceptance is still pending.


## 1.7.6 - 2026-07-13

### 中文

- 自动更新安装成功后会清理 `AppData/Roaming/VisionWiz/updates` 中缓存的旧安装包、更新助手脚本和日志，避免长期占用大量磁盘空间。
- 自动更新失败或用户选择重试时仍会保留当前安装包缓存，继续支持断点续传和失败后重试。
- 优化上传测试程序时的进度显示，KModel 会按实际文件大小占据主要上传进度区间，避免大模型上传时进度误导。
- 上传图传同步程序和模型测试程序时，进入主板上传模式失败后会自动复位并重试一次，同时提供更清晰的错误提示。

### English

- Automatic updates now clean cached installers, update-helper scripts, and helper logs from `AppData/Roaming/VisionWiz/updates` after a successful installation to avoid long-term disk usage growth.
- Failed updates and retry flows still keep the current installer cache so resume download and retry remain available.
- Improved model-test upload progress so KModel transfer uses a progress range based on real file size instead of being underrepresented.
- Image-sync and model-test uploads now retry raw REPL entry once after an automatic board reset and show clearer failure guidance.

## 1.7.5 - 2026-06-24

### 中文

- 新增 VESIBIT 模型测试程序上传到主板功能，训练记录的模型测试结果页可将测试脚本、依赖库和当前 `.kmodel` 写入 VESIBIT SD 卡。
- 大幅优化 KModel 上传速度，`.kmodel` 使用高速转义二进制串流传输，小文件继续使用兼容 Base64 写入。
- 上传速度参数改为自适应：默认尝试最快档位，失败时自动降级，并按主板/串口记忆成功档位，后续上传优先复用。
- 上传完成后保持 VESIBIT 连接状态，用户可直接切换训练记录继续上传测试程序。
- 数据采集新增一键上传图传同步程序、图传分辨率选择/运行时切换、输出分辨率提示和外接摄像头自定义分辨率。
- 拍摄记录窗口支持双击打开、删除、重命名、批量重命名、多选/全选、Shift 连选、撤销/重做、右键菜单和排序，便于清洗采集数据。
- 训练记录支持显示名重命名并持久保存，便于区分不同训练结果。

### English

- Added VESIBIT model-test program upload from training result pages, writing the test script, support libraries, and current `.kmodel` to the VESIBIT SD card.
- Significantly improved KModel upload speed by using an escaped binary streaming path for `.kmodel` while keeping Base64 writes for small compatibility files.
- Made upload tuning adaptive: VisionWiz tries the fastest profile first, falls back to safer profiles on failure, and remembers the successful profile per board/serial device.
- Kept the VESIBIT upload state available after a successful upload so users can switch training records and upload another test program without reconnecting.
- Added one-click image-sync program upload, preview resolution selection/runtime switching, output-resolution status, and custom external-camera resolution controls in data collection.
- Enhanced capture records with double-click open, delete, rename, batch rename, multi-select/select-all, Shift range selection, undo/redo, context menu, and sorting for dataset cleanup.
- Training records can now be renamed with persistent display names for easier result management.

## 1.7.0 - 2026-06-08

### 中文

- 大幅增强 Make Sense 标注工具：支持复制上一张图片的矩形框、右键按鼠标位置快速粘贴、撤销/重做、自然排序和多种图片排序模式。
- 优化矩形框交互体验，粘贴后的框可以直接拖拽调整，拖框时会锁定画布交互，避免误选页面文本。
- 新增 VOC XML 直接导出到指定文件夹功能，并在 VOC/YOLO ZIP 和 XML 文件夹导出完成后自动打开输出位置。
- 增加 Make Sense 快捷键与使用提示弹窗、轮播提示条，并明确 AI 协助功能可能需要网络。
- 修复 Make Sense 简体/繁体文案混用与乱码问题，确保窗口标题、侧栏、导入导出和帮助提示跟随当前语言。
- 修正 Make Sense 图片排序下拉框中的简体/繁体文案错位，简体显示“名称/优先”，繁体显示“名稱/優先”。
- 将 Make Sense 三语言构建接入 `dev:protectfull`，开发保护编译时会自动刷新标注工具产物。
- 优化工具集页面布局并修复工具集脚本重复声明导致页面无法打开的问题。

### English

- Significantly enhanced the Make Sense annotation tool with previous-image rectangle copy, right-click paste centered on the mouse position, undo/redo, natural sorting, and multiple image sorting modes.
- Improved rectangle interaction so pasted boxes can be dragged directly and canvas dragging locks interaction to prevent accidental text selection.
- Added direct VOC XML export to a selected folder, and automatically opens the output location after VOC/YOLO ZIP and XML-folder exports.
- Added Make Sense shortcut/help tips, rotating tips, and clearer AI-assistance network requirement guidance.
- Fixed Simplified/Traditional Chinese text mix-ups and garbled Make Sense strings so titles, sidebars, import/export UI, and help text follow the selected language.
- Corrected Simplified/Traditional Chinese text in the Make Sense image sort dropdown, including the Name and priority labels.
- Integrated Make Sense three-language builds into `dev:protectfull` so protected development runs refresh annotation-tool output automatically.
- Improved the toolset page layout and fixed the duplicate script declaration that could prevent tools from opening.

## 1.6.5 - 2026-05-27

### English

- Prevented duplicate training result dialogs by deduplicating training success, failure, and test-success IPC notifications per run.
- Added renderer-side guards so stale or repeated training result messages do not reopen success/failure dialogs after the user closes them or opens training history.
- Made object detection anchor generation deterministic and more stable by using seeded multi-attempt k-means and sorted anchors.
- Made train/validation split deterministic and fixed 320x224 object detection resizing so validation loss is consistent for the same data and parameters.
- Improved training console layout, resizing, search accuracy, history-log search visibility, and remembered input-size selection.

### 中文

- 为每轮训练的成功、失败和测试成功 IPC 通知增加去重，避免训练结果弹窗连续出现多次。
- 前端增加训练状态保护，关闭弹窗后或打开训练记录时收到旧消息不会再次弹出成功/失败提示。
- 目标检测 anchors 生成改为固定随机种子、多次聚类取最佳结果并排序，让同一数据和参数的训练更稳定。
- 训练/验证集拆分改为确定性流程，并修正 320x224 目标检测缩放逻辑，让同一数据和参数下的验证损失更一致。
- 优化训练控制台布局、窗口缩放、搜索选中准确性、历史日志搜索栏固定显示和输入分辨率选择记忆。

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
