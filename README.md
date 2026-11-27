# Nemu Timer

A Windows shutdown timer with Nemu, a little animated companion who keeps an eye on the countdown from the corner of your desktop.

**[Download for Windows x64 · ดาวน์โหลดสำหรับ Windows](https://github.com/killmebabyx/nemu-timer/releases/latest/download/Nemu.Timer.exe)**

<p>
  <img src="docs/images/timer.png" width="300" alt="Nemu Timer showing a shutdown delay of one hour and thirty minutes">
  <img src="docs/images/desktop-pet.png" width="245" alt="Nemu hugging a moon pillow beside the remaining time">
</p>

1. Open the app. Choose **After** for a delay or **At time** for a specific time.
2. Check the shutdown time and click **Start countdown**.
3. Click Nemu to add 10 minutes or cancel. Drag her to move her out of the way.

**ภาษาไทย** เลือก **ปิดในอีก** หรือ **ปิดตอน** แล้วกด **เริ่มนับถอยหลัง** คลิกน้องเนมุที่มุมจอเพื่อเพิ่มเวลาหรือยกเลิก เปลี่ยนภาษาที่ปุ่มรูปลูกโลก และสลับธีมที่ปุ่มพระจันทร์

Supports English, ไทย, 日本語 and 简体中文. Requires Windows x64 and Microsoft Edge WebView2 Runtime.

<details>
<summary>Try the countdown in preview mode</summary>

From PowerShell in the download folder, run the command below. When the timer ends, Nemu shows a message and your PC stays on.

```powershell
.\Nemu.Timer.exe --preview
```
</details>
