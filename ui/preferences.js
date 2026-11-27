const languages = ['th','en','ja','zh-CN'];
const catalog = {"ok":["ตกลง","OK","決定","确定"],"heading":["ตั้งเวลาปิดคอม","Shutdown timer","シャットダウンタイマー","定时关机"],
  "duration":["ปิดในอีก","After","あと","倒计时"],
  "clock":["ปิดตอน","At time","時刻指定","指定时间"],
  "hours":["ชั่วโมง","hours","時間","小时"],
  "mins":["นาที","min","分","分钟"],
  "time":["เวลา","Time","時刻","时间"],
  "selectTime":["กรุณาเลือกเวลาที่ต้องการ","Choose a time","時間を設定してください","请选择时间"],
  "summary":["ปิด{day} เวลา {time} น.","Shut down {day} at {time}","{day} {time} に終了","{day} {time} 关机"],
  "today":["วันนี้","today","今日","今天"],
  "tomorrow":["พรุ่งนี้","tomorrow","明日","明天"],
  "start":["เริ่มนับถอยหลัง","Start countdown","カウントダウン開始","开始倒计时"],
  "remaining":["เวลาที่เหลือ","Time remaining","残り時間","剩余时间"],
  "extend":["เพิ่ม 10 นาที","+10 min","10分延長","延长10分钟"],
  "cancel":["ยกเลิก","Cancel","取消","取消"],
  "preview":["ทดสอบ","Preview","プレビュー","预览"],
  "warning":["อีก {s} วินาทีจะปิดคอม","Shutdown in {s}s","あと{s}秒で終了","{s}秒后关机"],
  "previewWarning":["อีก {s} วินาทีจะจบการทดสอบ","Preview ends in {s}s","あと{s}秒でプレビュー終了","预览将在{s}秒后结束"],
  "left":["เหลือ {time}","{time} left","残り{time}","剩余{time}"],
  "shortHour":["{n} ชม.","{n}h","{n}時間","{n}小时"],
  "shortMin":["{n} นาที","{n}m","{n}分","{n}分钟"],
  "language":["ภาษา","Language","言語","语言"],
  "dark":["โหมดมืด","Dark mode","ダークモード","深色模式"],
  "light":["โหมดสว่าง","Light mode","ライトモード","浅色模式"],
  "minimize":["ย่อหน้าต่าง","Minimize","最小化","最小化"],
  "close":["ปิดหน้าต่าง","Close","閉じる","关闭"],
  "pet":["คลิกน้องเนมุเพื่อดูตัวเลือก ลากเพื่อย้าย","Click Nemu for options, drag to move","クリックでメニュー、ドラッグで移動","点击查看选项，拖动以移动"],
  "finished":["ทดสอบครบเวลาแล้ว","Preview complete","プレビューが終了しました","预览已结束"],
  "sent":["ส่งคำสั่งปิดเครื่องแล้ว","Shutdown requested","終了要求を送信しました","已发送关机请求"],
  "failed":["ปิดเครื่องไม่สำเร็จ","Shutdown failed","終了できませんでした","关机失败"],
  "expired":["หมดเวลาแล้ว","Timer expired","時間切れです","倒计时已结束"],
  "invalid":["เลือกเวลาปิดเครื่องใหม่อีกครั้ง","Choose another shutdown time","終了時刻を設定し直してください","请重新选择关机时间"],
  "active":["กำลังนับถอยหลังอยู่","Countdown already running","カウントダウン中です","倒计时已开始"],
  "monitor":["ไม่พบจอภาพ","No display found","画面が見つかりません","未找到显示器"],
  "systemRoot":["ไม่พบโฟลเดอร์ Windows","Windows folder not found","Windows フォルダーが見つかりません","未找到 Windows 文件夹"],
  "refused":["Windows ปฏิเสธคำสั่ง","Windows rejected the request","Windows が要求を拒否しました","Windows 拒绝了请求"]};
const settingsKey = 'nemu.appearance.v1';
function readAppearance() {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(settingsKey)) || {}; } catch {}
  return {language:languages.includes(data.language) ? data.language : 'en', theme:data.theme==='dark'?'dark':'light'};
}
let appearance = readAppearance();
function t(key, values={}) {
  const message = catalog[key]?.[languages.indexOf(appearance.language)] ?? key;
  return message.replace(/\{(\w+)\}/g, (match,k)=>values[k]??match);
}
function localizedNotice(raw) {
  return String(raw).split(' | ').map(part=>t(part)).join(' · ');
}
function renderAppearance() {
  document.documentElement.lang=appearance.language;
  document.documentElement.dataset.theme=appearance.theme;
  document.querySelectorAll('[data-text]').forEach(el=>el.textContent=t(el.dataset.text));
  document.querySelectorAll('[data-label]').forEach(el=>{
    el.setAttribute('aria-label',t(el.dataset.label));
    el.title=t(el.dataset.label);
  });
  document.dispatchEvent(new Event('appearancechange'));
}
function saveAppearance(update) {
  appearance={...readAppearance(),...update};
  localStorage.setItem(settingsKey,JSON.stringify(appearance));
  renderAppearance();
}
window.addEventListener('storage',event=>{
  if(event.key===settingsKey || !event.key){appearance=readAppearance(); renderAppearance();}
});
renderAppearance();
