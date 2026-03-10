# GIF 转视频

将 GIF 动图转换为 MP4 视频，支持自定义导出帧率。支持 Web 和 Android APK。

## 功能

- 点击选择 GIF 文件
- 自定义导出帧率（1–120 fps）
- 输出 MP4 格式，兼容性良好
- 本地转换，保护隐私
- 支持 Android APK 安装

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（Web）
npm run dev

# 构建生产版本
npm run build
```

## 构建 APK

### 前置要求

- Node.js 18+
- Java JDK 17 或更高版本（需正确配置 JAVA_HOME）
- Android SDK（可通过 Android Studio 安装）

如遇到 `JAVA_HOME is set to an invalid directory`，请：
- 将 JAVA_HOME 指向有效的 JDK 目录（如 `C:\Program Files\Java\jdk-17`）
- 或临时删除 JAVA_HOME 环境变量：`Remove-Item Env:JAVA_HOME -ErrorAction SilentlyContinue`

### 构建步骤

```bash
# 1. 构建 Web 并同步到 Android
npm run apk

# 2. 构建 Debug APK（首次会下载 Gradle，需等待）
cd android
gradlew.bat assembleDebug

# 或使用 npm 脚本（Windows）
npm run apk:build
```

生成的 APK 位于：`android/app/build/outputs/apk/debug/app-debug.apk`

### 发布版 APK（需签名）

如需构建可上架的应用，需配置签名并运行：
```bash
npx cap build android --keystorepath <路径> --keystorepass <密码> --keystorealias <别名> --keystorealiaspass <别名密码> --androidreleasetype APK
```

## 使用说明

1. 打开应用后，点击选择 GIF 文件
2. 使用滑块或输入框设置导出帧率（如 24、30、60 fps）
3. 点击「转换为 MP4」开始转换
4. 转换完成后：Web 端自动下载；Android 端弹出分享/保存选项

## Android 转换失败排查

若在手机上出现「转换失败」：

1. **首次使用**：需联网加载 FFmpeg（约 32MB），或使用已内置 FFmpeg 的 APK
2. **低内存设备**：部分 32 位或内存不足的手机可能无法运行 WebAssembly，可尝试换用其他设备
3. **GIF 过大**：建议先用小于 5MB 的 GIF 测试

## 技术栈

- React + TypeScript
- Vite
- Capacitor（Android）
- FFmpeg.wasm
