// ui-knob.js
export function createKnob({
  label = '',
  min = 0,
  max = 1,
  value = 0,
  step = 0.01,
  fineMultiplier = 0.15,
  format = (v) => String(v),
  onChange = () => {}
}) {
  let v = value;
  let dragging = false;
  let startY = 0;
  let startV = 0;

  const el = document.createElement('div');
  el.className = 'knob';

  const cap = document.createElement('div');
  cap.className = 'knob-cap';

  const txt = document.createElement('div');
  txt.className = 'knob-txt';

  el.appendChild(cap);
  el.appendChild(txt);

  function setVal(nv) {
    nv = Math.round(nv / step) * step;
    nv = Math.min(max, Math.max(min, nv));
    v = nv;

    const norm = (v - min) / (max - min);
    const deg = -135 + norm * 270;
    cap.style.transform = `rotate(${deg}deg)`;
    txt.textContent = `${label}: ${format(v)}`;

    onChange(v);
  }

  setVal(v);

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = e.clientY;
    startV = v;
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = startY - e.clientY;
    const range = (max - min);
    const base = (dy / 10) * (range * 0.008);
    const mul = e.shiftKey ? fineMultiplier : 1;
    setVal(startV + base * mul);
  });

  el.addEventListener('pointerup', (e) => {
    dragging = false;
    try { el.releasePointerCapture(e.pointerId); } catch {}
  });

  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = Math.sign(e.deltaY);
    const mul = e.shiftKey ? 0.2 : 1;
    setVal(v - dir * step * mul);
  }, { passive: false });

  return { el, setVal, getVal: () => v };
}
