let previewMode=false;
invoke('preview_mode').then(value=>{previewMode=value});
let expanded = false, urgent = false, lastEnd = null;
const menu = $('tools');
const triggers = [$('bubble'), $('character')];
let menuMotion;

function showTools(open) {
  if (expanded === open) return;
  expanded = open;
  triggers.forEach(button => button.setAttribute('aria-expanded', String(open)));
  
  if (!open && menu.contains(document.activeElement)) $('character').focus({preventScroll:true});
  menu.inert = !open;
  if (menuMotion && menuMotion.playState === 'running') {
    menuMotion.reverse();
    return;
  }
  menu.hidden = false;
  const folded = {opacity:0,transform:'translate(12px, 4px) scale(.94)'};
  const unfolded = {opacity:1,transform:'translate(0, 0) scale(1)'};
  menuMotion = menu.animate([folded, unfolded], {
    duration:190, easing:'cubic-bezier(.22,.75,.25,1)', fill:'both'
  });
  if (!open) { menuMotion.currentTime = 190; menuMotion.reverse(); }
    function followMenu(){
    scheduleShape();
    if(menuMotion.playState==='running')requestAnimationFrame(followMenu);
  }
  followMenu();
  menuMotion.onfinish = () => {
    scheduleShape();
    menu.hidden = !expanded;
    menuMotion.cancel();
  };
}
function toggle(){ showTools(!expanded); }
$('bubble').onclick=toggle;
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && expanded) showTools(false);
});
let origin=null,moved=false;
$('character').onpointerdown=e=>{if(e.button===0){origin=[e.screenX,e.screenY];moved=false;e.currentTarget.setPointerCapture(e.pointerId)}};
$('character').onpointermove=e=>{if(origin&&Math.hypot(e.screenX-origin[0],e.screenY-origin[1])>4){origin=null;moved=true;invoke('drag')}};
$('character').onpointerup=()=>origin=null;
$('character').onpointercancel=()=>origin=null;
$('character').onclick=()=>{if(!moved)toggle();moved=false};
$('extend').onclick=async()=>{try{await invoke('extend');showTools(false);refresh()}catch(e){$('left').textContent=localizedNotice(e)}};
$('cancel').onclick=()=>invoke('cancel');
async function refresh(){
 const [end]=await invoke('status');
 $('companion').hidden=!end;
 if(!end){setIdleMotion(false);lastEnd=null;showTools(false);return;}
 const secs=Math.max(0,Math.ceil((end-Date.now())/1000)),mins=Math.ceil(secs/60);
 const warning=secs<=60;
 if(lastEnd===null || urgent!==warning){showTools(warning);$('sprite').src=warning?'art/awake.png':'art/sleep.png';document.body.classList.toggle('urgent',warning);}
 lastEnd=end;urgent=warning;setIdleMotion(!warning);
 const units=[];
 if(mins>=60) units.push(t('shortHour',{n:Math.floor(mins/60)}));
 if(mins%60 || mins<60) units.push(t('shortMin',{n:mins%60}));
 $('left').textContent=warning?t(previewMode?'previewWarning':'warning',{s:secs}):t('left',{time:units.join(' ')});

}
refresh();setInterval(()=>{if(!document.hidden)refresh()},250);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){lastEnd=null;showTools(false)}else refresh();
});





document.addEventListener('appearancechange',refresh);

