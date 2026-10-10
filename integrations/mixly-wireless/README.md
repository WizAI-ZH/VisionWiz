# VisionWiz 无线图片同传 · Mixly 积木集成

本目录只维护**新增**无线图传积木。现有有线 UARTHS 的 `visionwiz_sync_*` 积木、代码生成器及 `visionwiz_image_sync.mpy` 均保持原样。

## 接口对应关系

| Mixly 积木 | 自动生成的 MicroPython |
| --- | --- |
| 启动无线图片同传 | `visionwiz_wireless_agent.wireless_preview_start(width, height, quality, fps, show_lcd)` |
| 设置无线图片同传 | `visionwiz_wireless_agent.wireless_preview_configure(width, height, quality, fps, show_lcd)` |
| 停止无线图片同传 | `visionwiz_wireless_agent.wireless_preview_stop()` |
| 无线图传是否运行 | `visionwiz_wireless_agent.wireless_preview_active()` |
| 读取无线图传状态 | `visionwiz_wireless_agent.wireless_preview_status()` |

生成器使用别名 `_visionwiz_wireless`，共用同一导入，只依赖 K210 的 `/flash/visionwiz_wireless_agent.py` 和原有 ESP32-S3 网络桥。**先在 VisionWiz 的无线初始化第二步安装更新后的 K210 代理，再烧录 Mixly 程序**。代理独占 UART1（P13 RX/P14 TX）；不要在同一个程序中再为无线代理手动初始化 UART1，也不要同时启动旧 UARTHS 图传积木。

如果之前已经完成 ESP32-S3 刷写、当前无线连接可正常使用，通常只需在无线初始化窗口选择正确的威智板 CH340，点击**「修复威智板无线验证程序」**更新 K210 代理，无须为了新 Mixly 指令重新刷写 ESP32-S3。更新 K210 时会暂时中断连接。

无线积木并不要求修改原有 Mixly 指令库中的 `micropython_k210_vesibit/build/lib/visionwiz_image_sync.py`，因为原库的图传机制使用 UARTHS/USB，直接增加无线桥 UART 初始化会与代理冲突。因此**本轮无需运行** `mpy批量转换器.py`，也不替换用户已经部署的 `visionwiz_image_sync.mpy`。如果以后修改原有有线图传库，再使用现有 MPY 批量转换器。

## 安装进本机 Mixly

源目录（脚本默认）：与 VisionWiz 项目同级的 `mixly2.0-win32-x64_rc4/resources/app/src/boards/extend/micropython_k210_vesibit`。安装位置不同可通过 `--mixly-root` 指定。

在 VisionWiz 仓库目录使用：

如果希望用双击安装，可以在**完全退出 Mixly 后**直接运行 `scripts/安装Mixly无线图传积木.cmd`。它先执行只读检查，提示确认后才会备份并执行安装；完成后提示重新启动 Mixly。

```powershell
py39\python.exe scripts\sync-mixly-wireless-blocks.py --check
```

只读检查原文件内容、编码和需要插入的代码，不执行任何改写。检查通过后，由本机用户显式执行：

```powershell
py39\python.exe scripts\sync-mixly-wireless-blocks.py --apply
```

同步工具自动检测 UTF-8 BOM（`index.xml` 与语言包使用 BOM）、只在原有图传分类内追加无线积木，同时备份所有将修改的原始文件至 Mixly 扩展根目录的 `.visionwiz-wireless-backups/<时间>/`。重复执行会检测已有积木并跳过。

共涉及 6 个外部文件：`blocks/visionwiz_sync.js`、`generators/visionwiz_sync.js`、`index.xml` 和 `language/en.js`、`zh-hans.js`、`zh-hant.js`。本工作区中的 `*.fragment.*` 是可维护的源片段。

## 测试

```powershell
node scripts\test-mixly-wireless-generators.js
py39\python.exe scripts\test-mixly-wireless-patch.py
py39\python.exe scripts\test-wireless-vision-runtime.py
node scripts\test-wireless-setup-ui.js
```

这些均为本地静态/模拟测试，**不代表已在 Mixly 图形编辑器内或真实 K210/ESP32-S3 硬件完成传图验收**。上线前仍需在 K210 安装新代理、在 Mixly 拖拽积木生成代码，并观察电脑真实 JPEG 画面。
