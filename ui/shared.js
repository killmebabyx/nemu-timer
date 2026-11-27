const $ = id => document.getElementById(id);
const invoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args);
const icons = {
 globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
 sun:'<circle cx="12" cy="12" r="4" fill="#ffdc93"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
 minimize:'<path d="M4 12h16"/>',
 close:'<path d="m5 5 14 14M19 5 5 19"/>',
 moon:'<path fill="#ffdc93" d="M19.8 15.7A9.4 9.4 0 0 1 8.4 3a9.6 9.6 0 1 0 11.4 12.7Z"/>',
 timer:'<circle cx="12" cy="14" r="8"/><path d="M10 2h4m-2 0v4m6 1 2-2m-8 5v4l3 1"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
 power:'<path d="M12 2v10m-5-7a9 9 0 1 0 10 0"/>'};
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+icons[el.dataset.icon]+'</svg>';});
const pad=n=>String(n).padStart(2,'0');
function nextClock(value, now) {
 if(!/^\d{2}:\d{2}$/.test(value)) return null;
 const [hours,minutes]=value.split(':').map(Number);
 if(hours>23 || minutes>59) return null;
 const date=new Date(now);date.setHours(hours,minutes,0,0);
 if(date.getTime()<=now){date.setDate(date.getDate()+1);date.setHours(hours,minutes,0,0);}
 return date;
}
function clockText(date){return pad(date.getHours())+':'+pad(date.getMinutes());}

