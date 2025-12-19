import { createKnob } from './ui-knob.js';

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function midiToName(midi){
  const name = NOTE_NAMES[midi % 12];
  const oct  = Math.floor(midi / 12) - 4;
  return `${name}${oct}`;
}

const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));

function isTypingTarget(t){
  if (!t || !t.tagName) return false;
  const tag = t.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input'){
    const type = (t.getAttribute('type') || '').toLowerCase();
    return type !== 'range' && type !== 'checkbox' && type !== 'button';
  }
  return false;
}

export function createStepSequencer({
  mountEl,
  steps = 16,
  arm = async()=>{},
  onStep = ()=>{}
}) {

  const state = {
    bpm: 128,
    running: false,
    step: 0,
    timer: null,
    lastWasSlide: false,
    pattern: Array.from({ length: steps }, () => ({
      on: false,
      note: 48,
      gate: 0.6,
      accent: 105,
      slide: false
    }))
  };

  const wrap = document.createElement('div');
  wrap.className = 'seq';

  const top = document.createElement('div');
  top.className = 'seq-top';

  const playBtn = document.createElement('button');
  playBtn.className = 'btn primary';
  playBtn.textContent = 'PLAY';

  const bpmRead = document.createElement('span');
  bpmRead.className = 'tag';
  bpmRead.textContent = `BPM: ${state.bpm}`;

  const bpmKnob = createKnob({
    label:'BPM',
    min:60, max:350,
    value:state.bpm,
    step:1,
    fineMultiplier:0.2,
    format:v=>`${v}`,
    onChange:(v)=>{
      state.bpm = v;
      bpmRead.textContent = `BPM: ${v}`;
      if (state.running) restartClock();
    }
  });

  top.appendChild(playBtn);
  top.appendChild(bpmRead);
  top.appendChild(bpmKnob.el);

  const grid = document.createElement('div');
  grid.className = 'seq-grid';

  const stepEls = [];

  for (let i=0;i<steps;i++){
    const st = state.pattern[i];

    const cell = document.createElement('div');
    cell.className = 'seq-step';

    const pad = document.createElement('button');
    pad.className = 'seq-pad';
    pad.textContent = i+1;

    pad.addEventListener('click', async()=>{
      await arm();
      st.on = !st.on;
      cell.classList.toggle('on', st.on);
    });

    const noteLine = document.createElement('div');
    noteLine.className = 'seq-note';
    noteLine.textContent = midiToName(st.note);

    const noteKnob = createKnob({
      label:'NOTE',
      min:0, max:71,
      value:st.note,
      step:1,
      fineMultiplier:0.15,
      format:v=>midiToName(v),
      onChange:v=>{
        st.note = v;
        noteLine.textContent = midiToName(v);
      }
    });

    const gateKnob = createKnob({
      label:'GATE',
      min:5, max:95,
      value:Math.round(st.gate*100),
      step:1,
      onChange:v=> st.gate = v/100
    });

    const accKnob = createKnob({
      label:'ACC',
      min:0, max:127,
      value:st.accent,
      step:1,
      onChange:v=> st.accent = v|0
    });

    const slideBtn = document.createElement('button');
    slideBtn.className = 'seq-slide';
    slideBtn.textContent = 'SL';
    slideBtn.addEventListener('click', async(e)=>{
      e.preventDefault();
      await arm();
      st.slide = !st.slide;
      slideBtn.classList.toggle('on', st.slide);
    });

    const row1 = document.createElement('div');
    row1.className = 'seq-row';
    row1.appendChild(noteLine);
    row1.appendChild(slideBtn);

    const row2 = document.createElement('div');
    row2.className = 'seq-row2';
    row2.appendChild(noteKnob.el);
    row2.appendChild(gateKnob.el);
    row2.appendChild(accKnob.el);

    cell.appendChild(pad);
    cell.appendChild(row1);
    cell.appendChild(row2);

    grid.appendChild(cell);
    stepEls.push(cell);
  }

  wrap.appendChild(top);
  wrap.appendChild(grid);
  mountEl.appendChild(wrap);

  function stepMs(){
    return (60000/state.bpm)/4;
  }

  function tick(){
    const s = state.step % steps;
    stepEls.forEach((el,i)=>el.classList.toggle('play', i===s));

    const st = state.pattern[s];
    const dur = stepMs();
    const gateMs = Math.max(20, dur * clamp(st.gate,0.05,0.95));
    const glideSec = st.slide ? gateMs/1000*0.55 : 0;

    if (!st.on){
      onStep({ stepOn:false });
      state.lastWasSlide = false;
    } else {
      const legato = st.slide && state.lastWasSlide;
      onStep({
        stepOn:true,
        midi:st.note,
        velocity:st.accent,
        gateMs,
        glideSec,
        legato,
        isSlide:st.slide
      });
      state.lastWasSlide = st.slide;
    }

    state.step = (state.step+1)%steps;
  }

  function start(){
    state.step = 0;
    state.lastWasSlide = false;
    tick();
    state.timer = setInterval(tick, stepMs());
  }

  function stop(){
    clearInterval(state.timer);
    state.timer = null;
    stepEls.forEach(el=>el.classList.remove('play'));
    onStep({ stepOn:false });
    state.lastWasSlide = false;
  }

  function restartClock(){
    if (!state.running) return;
    clearInterval(state.timer);
    state.timer = setInterval(tick, stepMs());
  }

  function setRunning(v){
    if (state.running === v) return;
    state.running = v;
    playBtn.textContent = v ? 'PAUSE' : 'PLAY';
    v ? start() : stop();
  }

  function togglePlay(){
    setRunning(!state.running);
  }

  playBtn.addEventListener('click', async()=>{
    await arm();
    togglePlay();
  });

  // ✅ SPACEBAR
  window.addEventListener('keydown', async(e)=>{
    if (e.repeat) return;
    if (isTypingTarget(e.target)) return;
    if (e.code === 'Space'){
      e.preventDefault();
      await arm();
      togglePlay();
    }
  }, {capture:true});

  return state;
}
