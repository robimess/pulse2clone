# Pulse2 Web Synth — AudioWorklet

Sintetizador Web basado en **Web Audio API + AudioWorklet**, inspirado en el flujo y carácter del **Waldorf Pulse 2** (proyecto no oficial, educativo/experimental).

Incluye:
- Osciladores con PWM, Sync y Ring Mod
- Sub-oscilador
- Filtro LP 24 dB (biquad en cascada)
- Envolventes AMP / FILTER
- LFO a pitch y cutoff
- Arpegiador
- Presets (LocalStorage)
- Teclado del PC (Z–M) y soporte MIDI
- Parámetros **LIVE** (cambios audibles mientras suena)

---

## ⚠️ Importante (CORS / AudioWorklet)

❌ **NO** abras `index.html` con doble click (`file://`).  
Los **AudioWorklet requieren HTTP**.

✅ **Siempre** ejecuta el proyecto desde un servidor local.

---

## Requisitos

- **Python 3.x**
- Navegador moderno:
  - ✅ Chrome / Edge (recomendado)
  - ⚠️ Firefox puede funcionar, pero Chrome es más estable para AudioWorklet

---

## Estructura del proyecto

```text
pulse2-wev_v2/
├─ index.html
├─ pulse2-worklet.js
└─ README.md
```

---

## 🚀 Ejecutar con Python (servidor HTTP)

### 1️⃣ Abrir terminal en la carpeta del proyecto

#### Windows (PowerShell)

```powershell
cd "C:\su_ruta_al_directorio\pulse2-wev_v2"
```

### 2️⃣ Levantar servidor HTTP

Puerto recomendado: 8000

```powershell
python -m http.server 8000
```

### Si python no funciona en Windows:

```powershell
py -m http.server 8000
```
### 3️⃣ Abrir en el navegador

```url
http://localhost:8000/
```

## Notas rápidas

- Si el audio no parte, presiona **START AUDIO** o haz click en la página  
  (restricción estándar del navegador).
- Si no suenan las teclas, verifica que no tengas foco en un `input` o `textarea`.
- Para mejor latencia y estabilidad, usa **Chrome o Edge**.

---
