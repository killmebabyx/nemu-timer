# Nemu Timer

[English](README.md) · [ไทย](README.th.md) · [日本語](README.ja.md) · **简体中文**

一款 Windows 定时关机工具。设好时间后，Nemu 会坐在桌面一角，提醒你还剩多久。

**[下载 Windows x64 版](https://github.com/killmebabyx/nemu-timer/releases/latest/download/Nemu.Timer.exe)**

<p>
  <img src="docs/images/timer-zh-CN.png" width="300" alt="设置在1小时30分钟后关机">
  <img src="docs/images/desktop-pet-zh-CN.png" width="245" alt="Nemu 在预览结束前一分钟提醒用户">
</p>

1. 选择**倒计时**设置时长，或选择**指定时间**设置关机时刻。确认后点击**开始倒计时**。
2. 点击 Nemu 可以延长 10 分钟或取消关机，拖动她可以调整位置。剩余一分钟时，操作按钮会自动出现。
3. 点击地球图标切换语言，点击月亮或太阳图标切换主题。应用会在本机记住这两项设置。

需要 Windows x64 和 Microsoft Edge WebView2 Runtime。

<details>
<summary>试用倒计时，保持电脑开机</summary>

先关闭已运行的 Nemu Timer，在下载目录打开 PowerShell 并执行以下命令。倒计时结束后，电脑会保持开机。

```powershell
.\Nemu.Timer.exe --preview
```
</details>
