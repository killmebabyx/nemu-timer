// Build the native window shape in CSS pixels. A few pixels around the painted
// edges accommodate the breathing, ear twitch, antialiasing and bubble shadow.
const petMask = document.createElement('canvas');
const mask = petMask.getContext('2d', {willReadFrequently:true});
const spriteMasks = new Map();
let shapeFrame = 0, previousLayout = '', pendingShape = Promise.resolve();

function rounded(element, radius, margin) {
  const {left,top,width,height} = element.getBoundingClientRect();
  mask.beginPath();
  mask.roundRect(left-margin, top-margin, width+2*margin, height+2*margin, radius+margin);
  mask.fill();
}
function paintCharacter() {
  const image = $('sprite'), button = $('character');
  if (!image.complete || !image.naturalWidth) return;
  const width = button.offsetWidth, height = button.offsetHeight;
  const key = [image.currentSrc,width,height].join(':');
  let silhouette = spriteMasks.get(key);
  if (!silhouette) {
    silhouette = document.createElement('canvas');
    silhouette.width=width; silhouette.height=height;
    const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight);
    const w=image.naturalWidth*scale, h=image.naturalHeight*scale;
    silhouette.getContext('2d').drawImage(image,(width-w)/2,height-h,w,h);
    spriteMasks.set(key,silhouette);
  }
  const x=button.offsetLeft, y=button.offsetTop;
  for(const [dx,dy] of [[0,0],[-4,0],[4,0],[0,-5],[0,3],[-3,-4],[3,-4]]) {
    mask.drawImage(silhouette,x+dx,y+dy);
  }
}
function updateShape() {
  shapeFrame=0;
  const visible=!$('companion').hidden;
  const bubble=$('bubble'), menu=$('tools'), buttons=[...menu.querySelectorAll('button')];
  const bounds=el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
  const layout=JSON.stringify([visible,innerWidth,innerHeight,devicePixelRatio,
    $('sprite').src,$('sprite').naturalWidth,bounds($('character')),bounds(bubble),
    menu.hidden?null:buttons.map(bounds)]);
  if(layout===previousLayout)return;
  previousLayout=layout;
  petMask.width=innerWidth;petMask.height=innerHeight;
  if(visible){
    paintCharacter();
    rounded(bubble,22,2);
    const b=bubble.getBoundingClientRect();
    mask.fillRect(b.right-49,b.bottom-3,17,12);
    if(!menu.hidden)buttons.forEach(el=>rounded(el,13,1));
  }
  const {width,height}=petMask, pixels=mask.getImageData(0,0,width,height).data;
  const rects=[],scale=devicePixelRatio;
  for(let y=0;y<height;y++){
    let start=-1;
    for(let x=0;x<=width;x++){
      const painted=x<width && pixels[(y*width+x)*4+3]>12;
      if(painted && start<0) start=x;
      if(!painted && start>=0){
        rects.push([Math.floor(start*scale),Math.floor(y*scale),Math.ceil(x*scale),Math.ceil((y+1)*scale)]);
        start=-1;
      }
    }
  }
  pendingShape=pendingShape.then(()=>invoke('shape_pet',{rects})).catch(e=>{previousLayout='';console.error(e)});
}
function scheduleShape(){if(!shapeFrame)shapeFrame=requestAnimationFrame(updateShape);}
$('sprite').addEventListener('load',scheduleShape);
new ResizeObserver(scheduleShape).observe($('bubble'));
window.addEventListener('resize',scheduleShape);
document.addEventListener('visibilitychange',scheduleShape);
scheduleShape();
