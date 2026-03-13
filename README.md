# GIF 转视频

将 GIF 动图转换为 MP4 视频，支持自定义导出帧率。

## Android 版本（Kotlin + 原生 FFmpeg）

Android 端已改为原生实现：
- Kotlin 原生页面（不再依赖 WebView/WASM）
- FFmpegKit 原生转码
- 导出到系统 `Movies/GIF转视频` 目录
- 同一个 GIF 可连续导出不同帧率

## 功能

- 选择 GIF 文件
- 自定义导出帧率（1-120 fps）
- 输出 MP4（H.264 / yuv420p）
- 导出完成显示“保存成功”（不弹分享）

## 构建 APK

### 前置要求

- Java JDK 17+（`gradle` 使用）
- Android SDK

> 如果系统变量是 JDK 11，可临时清除再编译：
> `Remove-Item Env:JAVA_HOME -ErrorAction SilentlyContinue`

### 构建命令

```bash
cd android
gradlew.bat assembleDebug
```

生成路径：
`android/app/build/outputs/apk/debug/app-debug.apk`

## 说明

- 当前 Android `minSdkVersion` 为 24（FFmpegKit 要求）
- 项目保留了原有 Web 代码，但 Android APK 使用的是 Kotlin 原生实现
