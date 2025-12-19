// pulse2-worklet.js
class Pulse2Osc extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'freqHz',        defaultValue: 440, minValue: 10,   maxValue: 20000, automationRate: 'a-rate' },
      { name: 'osc1PW',        defaultValue: 0.5, minValue: 0.05, maxValue: 0.95,  automationRate: 'a-rate' },
      { name: 'osc2Det',       defaultValue: 0,   minValue: -100, maxValue: 100,   automationRate: 'a-rate' }, // cents
      { name: 'osc1Gain',      defaultValue: 0.7, minValue: 0,    maxValue: 1,     automationRate: 'a-rate' },
      { name: 'osc2Gain',      defaultValue: 0.55,minValue: 0,    maxValue: 1,     automationRate: 'a-rate' },
      { name: 'subGain',       defaultValue: 0.35,minValue: 0,    maxValue: 1,     automationRate: 'a-rate' },
      { name: 'lfoPitchCents', defaultValue: 0,   minValue: -200, maxValue: 200,   automationRate: 'a-rate' },
    ];
  }

  constructor(opts){
    super(opts);
    this.sr = sampleRate;

    // Estado controlado por mensajes (cambia "en vivo" sin recrear la voz)
    this.state = {
      osc1Type: 'saw',
      osc2Type: 'saw',
      osc1Semi: 0,
      osc2Semi: 7,
      sync12: false,
      ring: false
    };

    // fases
    this.p1 = 0;
    this.p2 = 0;
    this.pSub = 0;

    // smoothing (para evitar zipper noise)
    this.smooth = {
      g1: 0.7,
      g2: 0.55,
      gSub: 0.35
    };

    // coef de suavizado por sample (~5ms)
    this.slew = Math.exp(-1 / (this.sr * 0.005));

    this.port.onmessage = (e) => {
      const m = e.data;
      if (m?.type === 'setup') {
        if (typeof m.osc1Type === 'string') this.state.osc1Type = m.osc1Type;
        if (typeof m.osc2Type === 'string') this.state.osc2Type = m.osc2Type;

        if (Number.isFinite(m.osc1Semi)) this.state.osc1Semi = m.osc1Semi | 0;
        if (Number.isFinite(m.osc2Semi)) this.state.osc2Semi = m.osc2Semi | 0;

        if (typeof m.sync12 === 'boolean') this.state.sync12 = m.sync12;
        if (typeof m.ring === 'boolean') this.state.ring = m.ring;
      }
    };
  }

  // polyBLEP: corrección rápida de discontinuidades
  polyBLEP(t, dt){
    if (t < dt) {
      const x = t / dt;
      return x + x - 1 - (x * x);
    } else if (t > 1 - dt) {
      const x = (t - 1) / dt;
      return (x * x) + x + 1;
    }
    return 0;
  }

  oscSample(type, phase, freq){
    const dt = freq / this.sr;
    let y = 0;

    if (type === 'saw') {
      y = 2 * phase - 1;
      y -= this.polyBLEP(phase, dt);
      return y;
    }

    if (type === 'square') {
      // duty 50% (PWM se hace afuera para osc1)
      y = phase < 0.5 ? 1 : -1;
      y += this.polyBLEP(phase, dt) - this.polyBLEP((phase + 0.5) % 1, dt);
      return y;
    }

    // triangle (naive)
    y = 4 * Math.abs(phase - 0.5) - 1;
    return y;
  }

  // helper: lee parámetro por sample o constante
  pAt(p, i){ return (p.length > 1) ? p[i] : p[0]; }

  process(inputs, outputs, parameters){
    const out = outputs[0][0];

    const pFreq = parameters.freqHz;
    const pPW   = parameters.osc1PW;
    const pDet  = parameters.osc2Det;
    const pG1   = parameters.osc1Gain;
    const pG2   = parameters.osc2Gain;
    const pSub  = parameters.subGain;
    const pLfoC = parameters.lfoPitchCents;

    const osc1SemiRatio = Math.pow(2, this.state.osc1Semi / 12);
    const osc2SemiRatio = Math.pow(2, this.state.osc2Semi / 12);

    for (let i = 0; i < out.length; i++) {
      const baseHz = this.pAt(pFreq, i);
      const lfoCents = this.pAt(pLfoC, i);
      const lfoRatio = Math.pow(2, lfoCents / 1200);

      // detune cents OSC2 (LIVE por sample)
      const detCents = this.pAt(pDet, i) || 0;
      const detRatio = Math.pow(2, detCents / 1200);

      // frecuencias finales
      const f1 = Math.max(10, Math.min(20000, baseHz * osc1SemiRatio * lfoRatio));
      const f2 = Math.max(10, Math.min(20000, baseHz * osc2SemiRatio * detRatio * lfoRatio));
      const fSub = Math.max(10, Math.min(20000, baseHz * 0.5));

      // fases actuales
      const ph1 = this.p1;
      const ph2 = this.p2;
      const phS = this.pSub;

      // avanzar fases
      this.p1 += f1 / this.sr;
      if (this.p1 >= 1) {
        this.p1 -= 1;
        if (this.state.sync12) this.p2 = 0;
      }

      this.p2 += f2 / this.sr;
      if (this.p2 >= 1) this.p2 -= 1;

      this.pSub += fSub / this.sr;
      if (this.pSub >= 1) this.pSub -= 1;

      // PWM OSC1 (LIVE)
      let s1 = 0;
      if (this.state.osc1Type === 'square') {
        const pw = this.pAt(pPW, i);
        s1 = (ph1 < pw) ? 1 : -1;
        const dt = f1 / this.sr;
        // BLEP aproximado en ambos flancos
        s1 += this.polyBLEP(ph1, dt) - this.polyBLEP((ph1 + pw) % 1, dt);
      } else {
        s1 = this.oscSample(this.state.osc1Type, ph1, f1);
      }

      // OSC2
      let s2 = 0;
      if (this.state.osc2Type === 'square') {
        const dt2 = f2 / this.sr;
        s2 = (ph2 < 0.5) ? 1 : -1;
        s2 += this.polyBLEP(ph2, dt2) - this.polyBLEP((ph2 + 0.5) % 1, dt2);
      } else {
        s2 = this.oscSample(this.state.osc2Type, ph2, f2);
      }

      // Sub
      const sSub = (phS < 0.5) ? 1 : -1;

      // Gains (LIVE por sample + smoothing)
      const targetG1 = this.pAt(pG1, i);
      const targetG2 = this.pAt(pG2, i);
      const targetSub = this.pAt(pSub, i);

      // slew smoothing (1-pole)
      this.smooth.g1 = this.smooth.g1 * this.slew + targetG1 * (1 - this.slew);
      this.smooth.g2 = this.smooth.g2 * this.slew + targetG2 * (1 - this.slew);
      this.smooth.gSub = this.smooth.gSub * this.slew + targetSub * (1 - this.slew);

      const g1 = this.smooth.g1;
      const g2 = this.smooth.g2;
      const gSub = this.smooth.gSub;

      // Mix / Ring
      let core = this.state.ring ? (s1 * s2) : (g1 * s1 + g2 * s2);
      core += gSub * sSub;

      // headroom
      out[i] = 0.42 * core;
    }

    return true;
  }
}

registerProcessor('pulse2-osc', Pulse2Osc);
