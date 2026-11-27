let mode='duration', busy=false, message='';
const initial=new Date(Date.now()+3600000);
$('time').value=clockText(initial);
$('timeValue').textContent=$('time').value;
const timeButton=$('time');
let pressedWhileOpen=false;
timeButton.setAttribute('aria-expanded','false');
timeButton.onpointerdown=()=>{pressedWhileOpen=timeButton.getAttribute('aria-expanded')==='true'};
timeButton.onpointercancel=()=>{pressedWhileOpen=false};
timeButton.onclick=async event=>{
 const dismiss=event.detail>0 && pressedWhileOpen;
 pressedWhileOpen=false;
 // Blur starts folding before Windows delivers the click to this window.
 // Remember the state at press time, including for a long press.
 if(dismiss && timeButton.getAttribute('aria-expanded')==='false')return;
 const rect=timeButton.getBoundingClientRect();
 const [h,m]=timeButton.value.split(':').map(Number);
 timeButton.setAttribute('aria-expanded','true');
 try {await invoke('open_dial',{left:rect.left,right:rect.right,center:rect.top+rect.height/2,minutes:h*60+m})}
 catch(e){timeButton.setAttribute('aria-expanded','false');message=String(e);refresh()}
};
window.addEventListener('dialvalue',event=>{
 const minutes=event.detail;
 $('time').value=pad(Math.floor(minutes/60))+':'+pad(minutes%60);
 $('timeValue').textContent=$('time').value;
 preview();
 $('time').focus();
});
function target(now){
 if(mode==='clock')return nextClock($('time').value,now);
 const fields=[$('hours'),$('mins')];
 if(fields.some(f=>!f.validity.valid))return null;
 const minutes=fields[0].valueAsNumber*60+fields[1].valueAsNumber;
 return minutes>0?new Date(now+minutes*60000):null;
}
function preview(){
 const now=new Date(), date=target(+now);
 let text=t('selectTime');
 if(date){
  const tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);
  const day=date.toDateString()===now.toDateString()?t('today'):date.toDateString()===tomorrow.toDateString()?t('tomorrow'):date.toLocaleDateString(appearance.language);
  text=t('summary',{day,time:clockText(date)});
 }
 $('summary').textContent=text;$('start').disabled=!date||busy;
}
for(const name of ['duration','clock'])$(name).onclick=()=>{
 mode=name;for(const n of ['duration','clock'])$(n).setAttribute('aria-pressed',String(n===mode));
 $('relative').hidden=mode!=='duration';$('absolute').hidden=mode!=='clock';preview();
};
for(const id of ['hours','mins','time'])$(id).oninput=preview;
$('bar').onpointerdown=e=>{if(e.button===0&&!e.target.closest('button'))invoke('drag')};
$('min').onclick=()=>invoke('minimize');$('close').onclick=()=>invoke('close_main');
$('start').onclick=async()=>{
 const end=target(Date.now());if(!end||busy)return;
 busy=true;preview();message='';
 try{await invoke('start',{deadline:+end})}catch(e){message=String(e)}
 finally{busy=false;await refresh()}
};
$('extend').onclick=()=>invoke('extend').catch(e=>message=String(e));$('cancel').onclick=()=>invoke('cancel');
async function refresh(){try{
 const [end,note]=await invoke('status');
 $('running').hidden=!end;$('setup').hidden=!!end;$('notice').textContent=localizedNotice(message||note);
 if(end){const s=Math.max(0,Math.ceil((end-Date.now())/1000));$('remaining').textContent=[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(pad).join(':')}
 else preview();
}catch(e){$('notice').textContent=localizedNotice(e)}}
refresh();setInterval(()=>{if(!document.hidden)refresh()},400);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)return;
 refresh();
 document.querySelector('main').animate([
   {opacity:.74,translate:'0 4px'}, {opacity:1,translate:'0 0'}
 ],{duration:190,easing:'ease-out'});
});



let isPreview=false;
function renderControls(){
 $('previewTag').textContent=isPreview?t('preview'):'';
 $('theme').setAttribute('aria-pressed',String(appearance.theme==='dark'));
 $('theme').title=$('theme').ariaLabel=t(appearance.theme==='dark'?'light':'dark');
 document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===appearance.language)));
 invoke('tray_language',{language:appearance.language}).catch(console.error);
 preview();
 refresh();
}
document.addEventListener('appearancechange',renderControls);
$('theme').onclick=()=>saveAppearance({theme:appearance.theme==='dark'?'light':'dark'});
document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{
 saveAppearance({language:b.dataset.lang});
 $('languages').hidePopover();
 $('language').focus();
});
invoke('preview_mode').then(value=>{isPreview=value;renderControls()});
