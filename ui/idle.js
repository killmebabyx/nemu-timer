/* Coordinates are in the original 425 x 450 illustration. Each patch deforms
   just the painted feature, leaving hair, paws and pillow anchored. */
const idleCanvas = document.getElementById('idle-motion');
const idleContext = idleCanvas.getContext('2d');
const idleArt = new Image();
idleArt.src = 'art/sleep.png';

function smooth(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function eyelid(cx, cy, halfWidth, slope) {
  return (x, y, amount) => {
    const horizontal = (x - cx) / halfWidth;
    const weight = smooth((1 - Math.abs(horizontal)) / 0.24);
    const line = cy + slope * (x - cx);
    const local = y - line;
    if (local < -8 || local > 21 || !weight) return [x, y];
    // Move the painted upper lash down over the iris, keeping its thickness.
    const lowerLash = 2 + 12 * amount * weight * (1 - 0.28 * horizontal * horizontal);
    let sy;
    if (local < lowerLash - 3) {
      sy = -8 + (local + 8) * 7 / (lowerLash + 5);
    } else if (local < lowerLash) {
      sy = local - lowerLash + 2;
    } else {
      const revealed = 2 + 14 * amount * weight;
      sy = revealed + (local - lowerLash) * (21 - revealed) / (21 - lowerLash);
    }
    return [x, line + sy];
  };
}

function ear(base, tip, center, radius, swing) {
  return (x, y, amount) => {
    const weight = smooth((base - y) / (base - tip)) *
      smooth((radius - Math.abs(x - center)) / 16);
    return [x - swing * amount * weight, y - 5 * amount * weight];
  };
}

function makeFrames(bounds, deform) {
  const [left, top, width, height] = bounds;
  const source = idleContext.getImageData(left, top, width, height);
  const frames = [source];
  for (let step = 1; step <= 6; step++) {
    const frame = idleContext.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [sx, sy] = deform(left + x, top + y, step / 6);
        const ix = Math.max(0, Math.min(width - 1, Math.round(sx - left)));
        const iy = Math.max(0, Math.min(height - 1, Math.round(sy - top)));
        const index = (iy * width + ix) * 4;
        const dest = (y * width + x) * 4;
        for (let c = 0; c < 4; c++) frame.data[dest + c] = source.data[index + c];
      }
    }
    frames.push(frame);
  }
  return { left, top, frames, last: 0 };
}

function pulse(t, start, down, hold, up) {
  const elapsed = t - start;
  if (elapsed < 0 || elapsed >= down + hold + up) return 0;
  if (elapsed < down) return smooth(elapsed / down);
  return 1 - smooth((elapsed - down - hold) / up);
}

let patches, active = false, request = 0, started = 0;
function animateIdle(time) {
  const t = (time - started) % 6100;
  const blink = Math.max(pulse(t, 750, 100, 85, 140), pulse(t, 4240, 100, 60, 140));
  const left = Math.max(pulse(t, 1830, 140, 30, 195), 0.65 * pulse(t, 2230, 100, 20, 135));
  const right = pulse(t, 2050, 180, 35, 195);
  [blink, blink, left, right].forEach((amount, index) => {
    const patch = patches[index];
    const frame = Math.round(amount * 6);
    if (frame !== patch.last) {
      idleContext.putImageData(patch.frames[frame], patch.left, patch.top);
      patch.last = frame;
    }
  });
  request = requestAnimationFrame(animateIdle);
}

function setIdleMotion(enabled) {
  active = enabled;
  const visible = enabled && patches && !document.hidden;
  idleCanvas.hidden = !visible;
  if (!visible) { cancelAnimationFrame(request); request = 0; }
  else if (!request) { started = performance.now(); request = requestAnimationFrame(animateIdle); }
}
idleArt.decode().then(() => {
  idleContext.drawImage(idleArt, 0, 0);
  patches = [
    makeFrames([133, 237, 60, 55], eyelid(161, 259, 23, -0.36)),
    makeFrames([210, 200, 66, 57], eyelid(242, 225, 25, -0.34)),
    makeFrames([20, 77, 121, 129], ear(204, 109, 81, 58, -17)),
    makeFrames([188, 25, 128, 105], ear(129, 49, 255, 60, 17))
  ];
  setIdleMotion(active);
});
document.addEventListener('visibilitychange', () => setIdleMotion(active));

