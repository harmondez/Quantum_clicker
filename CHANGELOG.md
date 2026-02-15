# 📋 CHANGELOG — Quantum Clicker
**Autor de los cambios:** Oriol Ràfols  
**Fecha:** 15 de Febrero de 2026  
**Sesión de desarrollo:** Corrección de bugs, mejoras de accesibilidad y nuevas features

---

## 🚀 v0.9.8 — The "Completionist" Update
*(Fecha: 15 de Febrero de 2026)*

### 🏆 Feature: Sistema de Logros 2.0 (Procedural)
*   **1000+ Logros**: Generados automáticamente (Energía, Clicks, Edificios, CPS).
*   **Recompensas**: +1% Producción Global por logro (acumulativo).
*   **UI Renovada**: Galería en formato de **Lista Vertical** (Icono, Título, Descripción, Recompensa) para mayor legibilidad.
*   **Mejoras Visuales**: Ventana más grande y clara distinción de logros bloqueados (Icono 🔒, Texto Gris).
*   **Filtros Avanzados**: Ahora puedes ocultar los logros bloqueados con un checkbox.
*   **Mejor UX**: Cierra el modal de logros haciendo click fuera de la ventana.
*   **Optimización**: Lógica de chequeo optimizada para no impactar el rendimiento.

### 🛡️ Feature: Modo Seguro Granular
*   **7 Ajustes Individuales**: `noBloom`, `noFlash`, `noGlitch`, `noShake`, `noParticles`, `noAnimations`, `noTicker` activables por separado.
*   **Master Toggle**: Activa/Desactiva todo de golpe.
*   **CSS**: Clases específicas para cada efecto (`body.safe-no-bloom`, etc.).

### 📻 Feature: Mejoras de Radio
*   **Mini-Player**: Widget persistente en la barra inferior (siempre visible).
*   **Auto-Start**: La radio se enciende sola tras la intro con Nightride FM.
*   **Feedback Visual**: Marquee con el nombre de la canción y brillo al sonar.

### 🌑 Feature: Intro Narrativa
*   **Audio**: Zumbido (drone) sintetizado que sube de tono con los clicks (40Hz -> 240Hz).
*   **Instrucciones**: Texto explícito "Haz click 100 veces" en el aviso inicial.
*   **Pacing**: Tiempos ajustados para lectura óptima y sincronización con efectos.

---

## 🔴 5 Bugs Corregidos

### 1. Perla Verde — descuento duplicado
- **Archivo:** `game.js` → función `getCost()`
- **Problema:** La línea `if (game.activePearl === 'green') cost *= 0.5` aparecía dos veces, aplicando un 75% de descuento en vez del 50% intencionado.
- **Fix:** Eliminada la línea duplicada.

### 2. SERVIDOR.bat — referencia incorrecta
- **Archivo:** `SERVIDOR.bat`
- **Problema:** El comando de inicio apuntaba a `base_idle.html` (nombre antiguo).
- **Fix:** Corregido a `index.html`.

### 3. h_master — crash por falta de quotes
- **Archivo:** `game.js` → `helpersConfig`
- **Problema:** El helper "Director Cipher" (`h_master`) no tenía la propiedad `quotes`, lo que causaba un crash en `startStaffMessages`.
- **Fix:** Añadidas 2 frases temáticas.

### 4. comboMultiplier — no se reseteaba al ascender
- **Archivo:** `game.js` → función `confirmAscension()`
- **Problema:** `comboMultiplier`, `comboTimer`, `buffMultiplier` y `clickBuffMultiplier` no se reseteaban al ascender, arrastrando buffs temporales entre runs.
- **Fix:** Reseteo de las 4 variables a sus valores por defecto.

### 5. offline_god — nodo faltante en el Árbol Celestial
- **Archivo:** `game.js` → `heavenlyConfig`
- **Problema:** El nodo `offline_god` estaba referenciado en `loadGame()` pero no existía en la configuración, causando errores.
- **Fix:** Añadido el nodo "Estasis Perfecta" 🌙 (coste: 200 AM, padre: `perm_prod_1`). Producción offline al 100%.

---

## 🛡️ Feature: Aviso de Fotosensibilidad + Modo Seguro

### Descripción
Sistema de protección para usuarios con fotosensibilidad o epilepsia. Modal de aviso al primer inicio con opción de activar un modo seguro que reduce la intensidad de los efectos visuales.

### Archivos modificados
- **`index.html`** — Modal `#modal-epilepsy` con dos opciones (🛡️ Modo Seguro / Continuar normal)
- **`game.js`** — Funciones: `initSafeMode()`, `showEpilepsyWarning()`, `acceptSafeMode()`, `acceptNormalMode()`, `toggleSafeMode()`
- **`styles.css`** — ~85 líneas de overrides CSS bajo `body.safe-mode`

### Qué reduce el Modo Seguro
- ✅ Bloom de Three.js (de 1.2 a 0.3)
- ✅ Flash-bang (pantallazos blancos) — desactivado completamente
- ✅ Screen glitch (`body.filter invert/hue-rotate`) — desactivado
- ✅ Vibración de cámara y deformación FOV
- ✅ Partículas en animaciones épicas (300 → 30)
- ✅ Animaciones CSS agresivas (duration: 0.01ms)
- ✅ Hover transforms y text-shadows intensos
- ✅ News ticker (movimiento detenido)
- ✅ Preferencia persistente en `localStorage` (clave: `qc_safeMode`)

### Funciones con guards de Modo Seguro
- `triggerOmegaFinalAnimation()` — duración reducida (5s → 2s), sin vibración ni screen filter
- `epicBluePearlScene()` — partículas reducidas, sin glitch, sin vértigo de cámara
- `initThree()` — BloomPass con valores reducidos

---

## 📻 Feature: Sistema de Radio

### Descripción
Radio integrada en el juego con 6 emisoras de streaming gratuitas (estilo synthwave por defecto) y soporte para URLs personalizadas.

### Emisoras predeterminadas
| Emisora | Estilo | URL del stream |
|---------|--------|----------------|
| 🌃 Nightride FM | Synthwave | `stream.nightride.fm/nightride.ogg` |
| 🌌 Nightride Chillsynth | Chillsynth | `stream.nightride.fm/chillsynth.ogg` |
| ⚡ Nightride EBSM | Dark Synth | `stream.nightride.fm/ebsm.ogg` |
| 🛸 SomaFM Space Station | Ambient Space | `ice1.somafm.com/spacestation-128-mp3` |
| 💀 SomaFM DEF CON | Hacker Music | `ice1.somafm.com/defcon-128-mp3` |
| 🌊 SomaFM Vaporwaves | Vaporwave | `ice1.somafm.com/vaporwaves-128-mp3` |

### Controles
- ▶️/⏸️ Play/Pause
- 🔊 Slider de volumen (0–100%)
- 🔗 Input para URL personalizada (cualquier stream MP3/OGG)

### Persistencia
- Emisora seleccionada, volumen y URL custom se guardan en `localStorage` (clave: `qc_radio`)
- No auto-play al cargar (requiere interacción del usuario por políticas del navegador)

### Archivos modificados
- **`game.js`** — ~170 líneas: `initRadio()`, `toggleRadio()`, `changeStation()`, `applyCustomUrl()`, `setRadioVolume()`, `saveRadioConfig()`, `updateRadioUI()`

---

## ⚙️ Feature: Panel de Ajustes

### Descripción
Panel centralizado de configuración que reemplaza el botón 🛡️ suelto con un botón ⚙️ que abre un modal con todas las opciones.

### Secciones
1. **📻 RADIO** — Reproductor con indicador de emisora, controles play/pause y volumen, selector de emisora, input de URL personalizada
2. **🛡️ ACCESIBILIDAD** — Toggle switch para el Modo Seguro con descripción

### Archivos modificados
- **`index.html`** — Modal `#modal-settings` (~65 líneas), botón ⚙️ en barra inferior
- **`game.js`** — `openSettings()`, `closeSettings()`
- **`styles.css`** — ~190 líneas: `.settings-section`, `.settings-title`, `.settings-select`, `.settings-input`, `.radio-player`, `.radio-controls`, `.radio-btn`, `.radio-slider`, `.toggle-switch`

---

## ⚛️ Feature: Evolución Visual del Núcleo 3D

### Descripción
El núcleo 3D central del juego ahora cambia de forma geométrica según los edificios desbloqueados, dando feedback visual del progreso del jugador.

### Tiers de evolución

| Tier | Edificio desbloqueado | Geometría | Escala | Emisión |
|------|-----------------------|-----------|--------|---------|
| 0 | (Inicio) | Icosaedro (detalle 1) | 1.0x | 0.6 |
| 1 | 🔆 Panel Solar | Icosaedro (detalle 2) | 1.05x | 0.8 |
| 2 | 🌀 Turbina Eólica | **Dodecaedro** | 1.1x | 1.0 |
| 3 | 🌊 Central Hidro | **Octaedro suavizado** | 1.15x | 1.2 |
| 4 | ☢️ Reactor Nuclear | Icosaedro (detalle 3) | 1.2x | 1.5 |
| 5 | ⚡ Reactor de Fusión | Icosaedro (detalle 4) | 1.25x | 2.0 |
| 6 | 🌐 Matriz Dyson | **Esfera perfecta** + anillo orbital 💜 | 1.3x | 2.5 |
| 7 | 🌌 Andrómeda | **Esfera HD** + anillo orbital | 1.4x | 3.0 |

### Detalles técnicos
- Cada tier aumenta `emissiveIntensity`, `metalness` y reduce `roughness`
- Anillo orbital (`TorusGeometry`, color púrpura `#7c4dff`) aparece en tiers 6–7 con rotación animada y pulso de opacidad
- Notificación "⚛️ NÚCLEO EVOLUCIONADO: Forma: [nombre]" al subir de tier
- Se resetea al ascender (progresión visual reinicia desde tier 0)
- Las geometrías antiguas se liberan con `.dispose()` para evitar memory leaks
- Función `updateCoreAppearance()` llamada desde `recalculateStats()`, evaluada solo cuando cambia el tier

### Archivos modificados
- **`game.js`** — ~130 líneas: `coreTiers[]`, `updateCoreAppearance()`, animación del anillo orbital en `update3D()`, reset en `confirmAscension()`

---

## 📊 Resumen de cambios por archivo

| Archivo | Líneas añadidas (aprox.) | Cambios principales |
|---------|--------------------------|---------------------|
| `game.js` | ~500 | Radio, safe mode, core evolution, 5 bug fixes |
| `index.html` | ~70 | Modal epilepsia, modal ajustes, botón ⚙️ |
| `styles.css` | ~275 | Safe-mode overrides, settings panel, radio player, toggle switch |
| `SERVIDOR.bat` | 1 línea corregida | `base_idle.html` → `index.html` |

---

*Todos los cambios pasan `node --check game.js` sin errores de sintaxis.* ✅
