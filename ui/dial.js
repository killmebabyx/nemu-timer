const face=$('face');
let hours=0, minutes=0, stage='hour', tracked=null;

function point(turn,radius){
 const angle=turn*2*Math.PI;
 return [110+Math.sin(angle)*radius,110-Math.cos(angle)*radius];
}
const ticks=Array.from({length:60},(_,i)=>
 'M'+point(i/60,103).join(' ')+'L'+point(i/60,i%5?100:96).join(' ')
).join('');
const labels=Array.from({length:12},(_,i)=>{
 const [x,y]=point(i/12,84);
 return '<text x="'+x+'" y="'+y+'" text-anchor="middle" dominant-baseline="central"></text>';
}).join('');
face.innerHTML='<circle class="rim" cx="110" cy="110" r="108"/>'+
 '<path class="ticks" d="'+ticks+'"/>'+
 '<g id="needle"><line class="hand" x1="110" y1="110" x2="110" y2="26"/>'+
 '<circle class="selected" cx="110" cy="26" r="14"/><circle id="halo" cx="110" cy="26" r="13"/></g>'+
 '<circle cx="110" cy="110" r="4" fill="currentColor"/><g id="numbers">'+labels+'</g>';
let lastStage=null, angle=0;
function draw(){
 const isHour=stage==='hour', count=isHour?12:60, value=isHour?hours%12:minutes;
 $('hour').textContent=pad(hours);
 $('minute').textContent=pad(minutes);
 for(const id of ['hour','minute','am','pm']){
   $(id).setAttribute('aria-pressed',String(id===stage || id===(hours<12?'am':'pm')));
 }
 const destination=value*360/count;
 // Keep 59 -> 00 and 12 -> 1 on the short arc, even during repeated clicks.
 angle=lastStage===null?destination:angle+((destination-angle)%360+540)%360-180;
 $('needle').style.transform='rotate('+angle+'deg)';
 face.dataset.stage=stage;
 face.querySelector('.selected').setAttribute('r',isHour||value%5===0?14:6);
 [...$('numbers').children].forEach((label,i)=>{
   label.textContent=isHour?(i||12):pad(i*5);
   label.classList.toggle('on',value===(isHour?i:i*5));
 });
 if(lastStage!==null && lastStage!==stage){
   const numbers=$('numbers');
   numbers.getAnimations().forEach(a=>a.cancel());
   numbers.animate([{transform:'scale(.955)',opacity:.35},{transform:'scale(1)',opacity:1}],
      {duration:190,easing:'ease-out'});
 }
 lastStage=stage;
 face.setAttribute('aria-label',t(isHour?'hours':'mins'));
 face.setAttribute('aria-valuemin',0);face.setAttribute('aria-valuemax',isHour?23:59);
 face.setAttribute('aria-valuenow',isHour?hours:minutes);
}
const card=document.querySelector('.dial-card');
let panelMotion, open=false;
function animatePanel(show){
 const from=getComputedStyle(card);
 const start={opacity:from.opacity,transform:from.transform};
 panelMotion?.cancel();
 const shift=document.documentElement.dataset.side==='left'?12:-12;
 const folded={opacity:0,transform:'translateX('+shift+'px) scale(.89,.94)'};
 const frames=[show && Number(start.opacity)===0?folded:start,show?{opacity:1,transform:'none'}:folded];
 panelMotion=card.animate(frames,{duration:show?245:165,easing:show?'cubic-bezier(.16,.86,.24,1)':'cubic-bezier(.4,0,.7,.35)',fill:'forwards'});
 return panelMotion.finished;
}
window.addEventListener('dialopen',({detail})=>{
 hours=Math.floor(detail/60);minutes=detail%60;
 stage='hour';tracked=null;face.classList.remove('dragging');lastStage=null;draw();
 open=true;card.inert=false;
 animatePanel(true).catch(()=>{});
});
function choose(event){
 const box=face.getBoundingClientRect();
 const dx=event.clientX-box.left-box.width/2,dy=event.clientY-box.top-box.height/2;
 if(Math.hypot(dx,dy)<box.width*.13)return false;
 const count=stage==='hour'?12:60;
 const mark=(Math.round(Math.atan2(dx,-dy)*count/(2*Math.PI))+count)%count;
 if(stage==='hour')hours=mark+(hours>=12?12:0);else minutes=mark;
 draw();return true;
}
face.onpointerdown=e=>{
 if(e.button!==0||!choose(e))return;
 tracked=e.pointerId;face.setPointerCapture(tracked);face.focus();
};
face.onpointermove=e=>{if(e.pointerId===tracked){face.classList.add('dragging');choose(e)}};
face.onpointercancel=()=>{tracked=null;face.classList.remove('dragging')};
face.onpointerup=e=>{
 if(e.pointerId!==tracked)return;
 tracked=null;
 face.classList.remove('dragging');
 if(choose(e)){
   const halo=$('halo');
   halo.getAnimations().forEach(a=>a.cancel());
   halo.animate([{opacity:.6,r:'9px'},{opacity:0,r:'19px'}],{duration:310,easing:'ease-out'});
 }
};
for(const id of ['hour','minute'])$(id).onclick=()=>{stage=id;draw();face.focus()};
for(const id of ['am','pm'])$(id).onclick=()=>{hours=hours%12+(id==='pm'?12:0);draw()};
async function closeDial(confirm,restoreFocus=true){
 if(!open)return;
 open=false;card.inert=true;
 const value=confirm?hours*60+minutes:null;
 try{await animatePanel(false)}catch{return}
 if(!open)await invoke('close_dial',{minutes:value,restoreFocus});
}
window.addEventListener('dialdismiss',()=>closeDial(false,false));
$('dismiss').onclick=()=>closeDial(false);$('apply').onclick=()=>closeDial(true);
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();closeDial(false);return}
 if(e.target!==face)return;
 if(e.key==='Enter'){
   e.preventDefault();
   closeDial(true);
 }else if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){
   e.preventDefault();
   const step=e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1;
   if(stage==='hour')hours=(hours+step+24)%24;else minutes=(minutes+step+60)%60;
   draw();
 }
});
document.addEventListener('appearancechange',draw);
draw();
