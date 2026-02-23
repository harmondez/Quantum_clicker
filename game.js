import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ==========================================
// 1. SISTEMA DE AUDIO
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.2;
masterGain.connect(audioCtx.destination);




let game = {
    cookies: 0,
    totalCookiesEarned: 0,
    clickCount: 0,
    totalClicks: 0,
    anomaliesClicked: 0,
    totalTimePlayed: 0,
    prestigeMult: 1,
    antimatter: 0,
    prestigeLevel: 0,
    buildings: {},
    achievements: [],
    upgrades: [],
    heavenlyUpgrades: [],
    pearls: [],
    activePearl: null,
    helpers: [],
    // --- NUEVAS VARIABLES DE INVENTARIO ---
    galacticoins: 0,    // Moneda especial para el mercado negro
    inventory: [],       // Array donde guardaremos los objetos (Máximo 30)
    // --- SISTEMA DE NIVELES ---
    level: 1,           // El nivel actual del comandante
    exp: 0,             // Progreso visual (opcional si usamos totalCookiesEarned)

};



// Variables temporales (no se guardan)
let buffMultiplier = 1; // Multiplicador global de producción
let clickBuffMultiplier = 1; // Multiplicador de clicks
let isApocalypse = false;
// Añade esto junto a tus otras variables globales al principio de game.js
const INTRO_TOTAL_CLICKS = 100; // Más largo, más épico
let introParticlesMesh = null; // Para el efecto de polvo cósmico
// ==========================================
// 🌑 PROTOCOLO DE INICIO (INTRO NARRATIVA)
// ==========================================
let introStep = 0;
let introClicks = 0;
let isIntroActive = false;
let buffEndTime = 0;
let buffDuration = 0; // 10 segundos en milisegundos
let anomalyTimeout = null; // Guardará el temporizador para poder limpiarlo
let introDroneOscillator = null; // Zumbido del reactor
let introDroneGain = null;
let globalExpRate = 2.5; // Ajusta este valor para acelerar el juego


// ==========================================
// 0. SISTEMA DE MODO SEGURO (FOTOSENSIBILIDAD)
// ==========================================
let isSafeMode = false;

// Ajustes granulares — cada efecto se puede activar/desactivar individualmente
const safeSettings = {
    noBloom: false,       // Reducir bloom (resplandor)
    noFlash: false,       // Desactivar flash-bang (pantallazos blancos)
    noGlitch: false,      // Desactivar screen glitch (inversión de colores)
    noShake: false,       // Desactivar vibración de cámara
    noParticles: false,   // Reducir partículas en eventos
    noAnimations: false,  // Reducir animaciones CSS agresivas
    noTicker: false       // Parar news ticker
};

const safeSettingsKeys = Object.keys(safeSettings);

function saveSafeSettings() {
    localStorage.setItem('qc_safeSettings', JSON.stringify(safeSettings));
    localStorage.setItem('qc_safeMode', isSafeMode.toString());
    applySafeSettingsToDOM();
}

function loadSafeSettings() {
    try {
        const saved = localStorage.getItem('qc_safeSettings');
        if (saved) {
            const parsed = JSON.parse(saved);
            safeSettingsKeys.forEach(k => {
                if (k in parsed) safeSettings[k] = parsed[k];
            });
        }
    } catch (e) { /* ignorar JSON inválido */ }
}

function setAllSafeSettings(val) {
    safeSettingsKeys.forEach(k => safeSettings[k] = val);
    isSafeMode = val;
}

function applySafeSettingsToDOM() {
    // Clase global CSS para animaciones y efectos
    const anyActive = safeSettingsKeys.some(k => safeSettings[k]);
    if (safeSettings.noAnimations) {
        document.body.classList.add('safe-no-animations');
    } else {
        document.body.classList.remove('safe-no-animations');
    }
    if (safeSettings.noFlash) {
        document.body.classList.add('safe-no-flash');
    } else {
        document.body.classList.remove('safe-no-flash');
    }
    if (safeSettings.noTicker) {
        document.body.classList.add('safe-no-ticker');
    } else {
        document.body.classList.remove('safe-no-ticker');
    }

    // Bloom Three.js
    if (composer && composer.passes) {
        composer.passes.forEach(pass => {
            if (pass.strength !== undefined) {
                pass.strength = safeSettings.noBloom ? 0.3 : 1.2;
                pass.radius = safeSettings.noBloom ? 0.1 : 0.5;
            }
        });
    }

    // Sincronizar checkboxes en modal de ajustes
    safeSettingsKeys.forEach(k => {
        const cb = document.getElementById('safe-' + k);
        if (cb) cb.checked = safeSettings[k];
    });
    const masterCb = document.getElementById('toggle-safe-mode');
    if (masterCb) masterCb.checked = isSafeMode;
}

function initSafeMode() {
    const preference = localStorage.getItem('qc_safeMode');
    if (preference !== null) {
        isSafeMode = (preference === 'true');
        loadSafeSettings();
        // Si tiene isSafeMode pero no tenía granulares, activar todas
        if (isSafeMode && !localStorage.getItem('qc_safeSettings')) {
            setAllSafeSettings(true);
        }
        applySafeSettingsToDOM();
        return;
    }
    showEpilepsyWarning();
}

function showEpilepsyWarning() {
    const overlay = document.getElementById('modal-epilepsy');
    if (overlay) overlay.style.display = 'flex';
}

window.acceptNormalMode = function () {
    isSafeMode = false;
    setAllSafeSettings(false);
    saveSafeSettings();
    document.getElementById('modal-epilepsy').style.display = 'none';
    if (audioCtx.state === 'suspended') audioCtx.resume();
};

window.acceptSafeMode = function () {
    isSafeMode = true;
    setAllSafeSettings(true);
    saveSafeSettings();
    document.getElementById('modal-epilepsy').style.display = 'none';
    if (audioCtx.state === 'suspended') audioCtx.resume();
};

// Master toggle: activa/desactiva TODO
window.toggleSafeMode = function () {
    isSafeMode = !isSafeMode;
    setAllSafeSettings(isSafeMode);
    saveSafeSettings();
    if (isSafeMode) {
        showNotification('🛡️ MODO SEGURO', 'Todos los efectos reducidos.');
    } else {
        showNotification('✨ MODO NORMAL', 'Efectos visuales completos.');
    }
};

// Toggle individual de cada ajuste
window.toggleSafeSetting = function (key) {
    const cb = document.getElementById('safe-' + key);
    if (cb) safeSettings[key] = cb.checked;
    // Actualizar el estado global
    isSafeMode = safeSettingsKeys.every(k => safeSettings[k]);
    saveSafeSettings();
};


function doClickLogic(cx, cy) {
    sfxClick(); 

    // 1. GESTIÓN DE COMBO
    const maxCombo = game.upgrades.includes('upg_master_h_combo') ? 10.0 : 5.0;
    comboMultiplier += 0.05;
    if (comboMultiplier > maxCombo) comboMultiplier = maxCombo;
    comboTimer = 2.0;

    const comboEl = document.getElementById('combo-display');
    if (comboEl) {
        comboEl.style.opacity = 1;
        comboEl.style.transform = `scale(${1 + comboMultiplier / 10})`;
        comboEl.innerText = `COMBO x${comboMultiplier.toFixed(2)}`;
    }

    // 2. CÁLCULO DE PODER DE PULSO
    let val = getClickPower();
    let isCrit = false;

    // --- PROBABILIDAD DE CRÍTICO ---
    let critChance = 0;
    if (game.heavenlyUpgrades.includes('crit_master')) critChance += 0.05;

    if (game.upgrades.includes('upg_master_h_crit')) {
        critChance = 0.25;
    } else if (game.helpers.includes('h_crit')) {
        critChance += 0.10;
    }

    // Sinergia: PROTOCOLO DE CAMPO (Thorne + Kael)
    const hasThorne = game.helpers.includes('h_clicker');
    const hasKael = game.helpers.includes('h_crit');
    let critMult = 10; 

    if (hasThorne && hasKael) {
        critChance += 0.15; 
        critMult = 15;      
    }

    if (Math.random() < critChance) {
        isCrit = true;
        val *= critMult;
        // Sacudida extra por impacto crítico
        const shakePower = (hasThorne && hasKael) ? 0.8 : 0.5;
        camera.position.x += (Math.random() - 0.5) * shakePower;
        camera.position.y += (Math.random() - 0.5) * shakePower;
    }

    // 3. APLICAR RESULTADOS (Watts y EXP)
    game.cookies += val;
    game.totalCookiesEarned += val;
    game.totalClicks++;
    game.clickCount++;

    // --- 🆙 NUEVO: GANAR EXPERIENCIA POR CLICK ---
    if (typeof gainExp === 'function') {
        gainExp(2); // 2 de EXP por click manual
    }

    // 4. HITO PERLA AZUL
    if (game.totalClicks >= 10000 && !game.pearls.includes('blue')) {
        epicBluePearlScene();
        unlockPearl('blue');
        showSystemModal("🔵 HITO ALCANZADO", "10,000 Clicks: Has desbloqueado la Perla del Cronos.", false, null);
    }

    // 5. TEXTO FLOTANTE DE WATTS
    if (isCrit) {
        const critWord = `<span style="color: #ff0000; font-weight: bold;">CRIT</span>`;
        const critWordAlt = `<span style="color: #ff0000; font-weight: bold;">¡CRÍTICO!</span>`;
        const critText = (hasThorne && hasKael) ? `CRIT ${formatNumber(val)}` : `¡CRÍTICO! +${formatNumber(val)}`;
        createFloatingText(cx, cy, critText, true);
    } else {
        createFloatingText(cx, cy, `+${formatNumber(val)}`, false);
    }

    updateUI();
}





// ==========================================
// 0.5 SISTEMA DE RADIO
// ==========================================
const radioStations = {
    nightride: { name: '🌃 Nightride FM (Synthwave)', url: 'https://stream.nightride.fm/nightride.ogg' },
    chillsynth: { name: '🌌 Nightride Chillsynth', url: 'https://stream.nightride.fm/chillsynth.ogg' },
    ebsm: { name: '⚡ Nightride EBSM', url: 'https://stream.nightride.fm/ebsm.ogg' },
    spacestation: { name: '🛸 SomaFM Space Station', url: 'https://ice1.somafm.com/spacestation-128-mp3' },
    defcon: { name: '💀 SomaFM DEF CON Radio', url: 'https://ice1.somafm.com/defcon-128-mp3' },
    vaporwaves: { name: '🌊 SomaFM Vaporwaves', url: 'https://ice1.somafm.com/vaporwaves-128-mp3' }
};

let radioAudio = new Audio();
radioAudio.crossOrigin = 'anonymous';
radioAudio.volume = 0.3;
let radioPlaying = false;
let currentStationId = '';

function initRadio() {
    const saved = localStorage.getItem('qc_radio');
    if (saved) {
        try {
            const cfg = JSON.parse(saved);
            radioAudio.volume = cfg.volume ?? 0.3;
            currentStationId = cfg.station ?? '';
            if (cfg.customUrl) {
                const urlInput = document.getElementById('radio-custom-url');
                if (urlInput) urlInput.value = cfg.customUrl;
            }
            // Restaurar UI
            const volSlider = document.getElementById('radio-volume');
            const volLabel = document.getElementById('radio-volume-label');
            if (volSlider) volSlider.value = Math.round(radioAudio.volume * 100);
            if (volLabel) volLabel.textContent = Math.round(radioAudio.volume * 100) + '%';
            if (currentStationId) {
                const sel = document.getElementById('radio-station-select');
                if (sel) sel.value = currentStationId;
                if (currentStationId === 'custom' && cfg.customUrl) {
                    radioAudio.src = cfg.customUrl;
                    updateRadioUI(cfg.customUrl);
                    document.getElementById('custom-url-section').style.display = 'block';
                } else if (radioStations[currentStationId]) {
                    radioAudio.src = radioStations[currentStationId].url;
                    updateRadioUI(radioStations[currentStationId].name);
                }
                // NO auto-play (requiere interacción del usuario)
            }
        } catch (e) { console.warn('Error loading radio config', e); }
    }
}

function saveRadioConfig() {
    const cfg = {
        station: currentStationId,
        volume: radioAudio.volume,
        customUrl: document.getElementById('radio-custom-url')?.value || ''
    };
    localStorage.setItem('qc_radio', JSON.stringify(cfg));
}

function updateRadioUI(stationName) {
    const nameEl = document.getElementById('radio-station-name');
    const iconEl = document.getElementById('radio-status-icon');
    const btnEl = document.getElementById('btn-radio-toggle');
    if (nameEl) nameEl.textContent = stationName || 'Sin emisora';
    if (iconEl) iconEl.textContent = radioPlaying ? '🔊' : '⏸️';
    if (btnEl) btnEl.textContent = radioPlaying ? '⏸️' : '▶️';

    // Actualizar mini-player persistente
    const miniIcon = document.getElementById('radio-mini-icon');
    const miniText = document.getElementById('radio-mini-text');
    if (miniIcon) miniIcon.textContent = radioPlaying ? '🔊' : '🔇';
    if (miniText) {
        if (radioPlaying && stationName) {
            miniText.textContent = '♪ ' + stationName;
            miniText.classList.add('radio-mini-active');
        } else {
            miniText.textContent = 'Radio apagada';
            miniText.classList.remove('radio-mini-active');
        }
    }
}

window.toggleRadio = function () {
    if (!radioAudio.src || radioAudio.src === window.location.href) {
        // No hay emisora seleccionada, seleccionar Nightride por defecto
        changeStation('nightride');
        const sel = document.getElementById('radio-station-select');
        if (sel) sel.value = 'nightride';
        return;
    }
    if (radioPlaying) {
        radioAudio.pause();
        radioPlaying = false;
    } else {
        radioAudio.play().catch(e => console.warn('Radio play failed:', e));
        radioPlaying = true;
    }
    updateRadioUI(getCurrentStationName());
};

window.setRadioVolume = function (val) {
    const v = parseInt(val);
    radioAudio.volume = v / 100;
    const label = document.getElementById('radio-volume-label');
    if (label) label.textContent = v + '%';
    saveRadioConfig();
};

window.changeStation = function (stationId) {
    currentStationId = stationId;
    const customSection = document.getElementById('custom-url-section');

    if (stationId === 'custom') {
        if (customSection) customSection.style.display = 'block';
        radioAudio.pause();
        radioPlaying = false;
        updateRadioUI('Introduce tu URL...');
        saveRadioConfig();
        return;
    }

    if (customSection) customSection.style.display = 'none';

    if (!stationId || !radioStations[stationId]) {
        radioAudio.pause();
        radioAudio.src = '';
        radioPlaying = false;
        updateRadioUI('Sin emisora');
        saveRadioConfig();
        return;
    }

    const station = radioStations[stationId];
    radioAudio.src = station.url;
    radioAudio.play().catch(e => console.warn('Radio play failed:', e));
    radioPlaying = true;
    updateRadioUI(station.name);
    saveRadioConfig();
};

window.applyCustomUrl = function () {
    const urlInput = document.getElementById('radio-custom-url');
    const url = urlInput?.value?.trim();
    if (!url) return;

    currentStationId = 'custom';
    radioAudio.src = url;
    radioAudio.play().catch(e => console.warn('Custom radio failed:', e));
    radioPlaying = true;
    updateRadioUI('🔗 ' + new URL(url).hostname);
    saveRadioConfig();
};

function getCurrentStationName() {
    if (currentStationId === 'custom') {
        const url = document.getElementById('radio-custom-url')?.value;
        try { return '🔗 ' + new URL(url).hostname; } catch (e) { return '🔗 Custom'; }
    }
    return radioStations[currentStationId]?.name || 'Sin emisora';
}

// Manejar errores de streaming
radioAudio.addEventListener('error', () => {
    radioPlaying = false;
    updateRadioUI('❌ Error de conexión');
});

// ==========================================
// 0.6 PANEL DE AJUSTES (SETTINGS)
// ==========================================
window.openSettings = function () {
    const modal = document.getElementById('modal-settings');
    if (modal) {
        // Sincronizar todos los checkboxes granulares
        applySafeSettingsToDOM();
        modal.style.display = 'flex';
    }
};

window.closeSettings = function () {
    const modal = document.getElementById('modal-settings');
    if (modal) modal.style.display = 'none';
};

function playTone(freq, type, duration, vol = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function sfxClick() {
    playTone(800 + Math.random() * 200, 'sine', 0.1, 0.1);
    playTone(200, 'triangle', 0.05, 0.1);
}
function sfxBuy() {
    playTone(150, 'square', 0.2, 0.1);
    playTone(400, 'sawtooth', 0.1, 0.05);
}
function sfxAnomaly() {
    playTone(1200, 'sine', 0.5, 0.2);
    setTimeout(() => playTone(1800, 'sine', 0.5, 0.2), 100);
}
function sfxPrestige() {
    playTone(100, 'sawtooth', 2.0, 0.3);
    setTimeout(() => playTone(50, 'square', 2.0, 0.3), 200);
}

// ==========================================
// 2. DATOS DEL JUEGO
// ==========================================

const itemRarezas = {
    comun: { label: 'Común', color: '#888', price: 10 },
    poco_comun: { label: 'Poco común', color: '#00ff44', price: 50 },
    raro: { label: 'Raro', color: '#0077ff', price: 250 },
    epico: { label: 'Épico', color: '#b388ff', price: 1000 },
    legendario: { label: 'Legendario', color: '#ffd700', price: 5000 },
    mitico: { label: 'Mítico', color: '#ff0000', price: 25000 }
};

const itemNames = {
    comun: ["Chatarra de Satélite", "Tornillo de Titanio", "Cable de Cobre", "Panel Roto"],
    poco_comun: ["Batería de Iones", "Lente de Enfoque", "Placa de Circuitos"],
    raro: ["Célula de Energía Inestable", "Refrigerante Criogénico", "Chip de Memoria"],
    epico: ["Procesador Cuántico", "Cristal de Enfoque", "Fluido de Vacío"],
    legendario: ["Núcleo de Fusión", "Microchip de Mente de Colmena", "Materia Oscura"],
    mitico: ["Singularidad Embotellada", "Corazón de Estrella", "Código Génesis"]
};







const buildingsConfig = [
    // TIER 1: MECÁNICO
    { id: 'cursor', name: 'Generador de Manivela', type: 'click', baseCost: 15, basePower: 1, desc: '+1 W por click (Manual)', icon: '👆' },
    { id: 'grandma', name: 'Hámster en Rueda', type: 'auto', baseCost: 100, basePower: 1, desc: '+1 W/s (Bio-energía básica)', icon: '🐹' },

    // TIER 2: ELÉCTRICO
    { id: 'farm', name: 'Panel Solar', type: 'auto', baseCost: 1100, basePower: 8, desc: '+8 W/s (Fotovoltaica)', icon: '☀️' },
    { id: 'mine', name: 'Turbina Eólica', type: 'auto', baseCost: 12000, basePower: 47, desc: '+47 W/s (Eólica)', icon: '🌬️' },

    // TIER 3: INDUSTRIAL
    { id: 'factory', name: 'Central Hidroeléctrica', type: 'auto', baseCost: 130000, basePower: 260, desc: '+260 W/s (Hidráulica)', icon: '💧' },
    { id: 'bank', name: 'Reactor Nuclear', type: 'auto', baseCost: 1400000, basePower: 1400, desc: '+1.4 kW/s (Fisión)', icon: '☢️' },

    // TIER 4: CUÁNTICO
    { id: 'temple', name: 'Reactor de Fusión', type: 'auto', baseCost: 20000000, basePower: 7800, desc: '+7.8 kW/s (Fusión)', icon: '⚛️' },
    { id: 'portal', name: 'Matriz de Dyson', type: 'auto', baseCost: 330000000, basePower: 44000, desc: '+44 kW/s (Estelar)', icon: '🛰️' },
    
    // TIER DE COMUNICACIONES
    {
        id: 'sat_uplink',
        name: 'Enlace Satelital',
        type: 'auto',
        baseCost: 750000,
        basePower: 500,
        desc: 'Establece una red orbital. Desbloquea Nodos de Sincronía en el núcleo.',
        icon: '📡',
        isSatellite: true
    }, // <--- LA COMA QUE FALTABA ESTABA AQUÍ

    // --- TIER ÉLITE: ANDRÓMEDA (Solo vía Comerciantes) ---
    {
        id: 'andromeda_siphon',
        name: 'Sifón de Vacío',
        type: 'auto',
        baseCost: 5000000000,
        basePower: 1000000,
        desc: 'Extrae energía del tejido espacial. Produce 1 MW/s.',
        icon: '🕳️',
        isAndromeda: true
    },
    {
        id: 'andromeda_bazar',
        name: 'Bazar Galáctico',
        type: 'auto',
        baseCost: 25000000000,
        basePower: 5000000,
        desc: 'Sinergia comercial: +5% producción global por unidad.',
        icon: '🏪',
        isAndromeda: true
    },
    {
        id: 'andromeda_dyson',
        name: 'Esfera Dyson Enana',
        type: 'auto',
        baseCost: 100000000000,
        basePower: 25000000,
        desc: 'Multiplica el poder de tu Prestigio por 1.1x.',
        icon: '🌟',
        isAndromeda: true
    }
];




const pearlsConfig = {
    red: {
        name: "Perla de la Entropía",
        desc: "El poder del fin. Multiplica la Producción Global x10.",
        bonusType: 'production',
        value: 10
    },
    blue: {
        name: "Perla del Tiempo",
        desc: "El poder del tiempo. Los Clicks son x50 más potentes.",
        bonusType: 'click',
        value: 50
    },
    green: {
        name: "Perla de la Vida",
        desc: "El poder del origen. Todo es un 50% más barato.",
        bonusType: 'discount',
        value: 0.5
    }
};

const milestones = [10, 25, 50, 100, 200];
const alienTypes = {
    green: { color: '#00ff44', clicks: 10, reward: 2.0, icon: '👽' },
    yellow: { color: '#ffff00', clicks: 25, reward: 5.0, icon: '🛸' },
    red: { color: '#ff0000', clicks: 50, reward: 15.0, icon: '👾' }
};
for (let i = 400; i <= 10000; i *= 2) milestones.push(i);
const upgradeIcons = ["⚡", "🔋", "💾", "📡", "🧪", "☢️", "🌌", "🪐", "⚛️"];



function startIntroSequence() {
    isIntroActive = true;
    document.body.classList.add('intro-mode');

    // 1. EL VACÍO ABSOLUTO
    if (mainObject) {
        mainObject.material.emissiveIntensity = 0;
        mainObject.material.color.setHex(0x000000);
        glowMesh.visible = false;
    }

    // --- NUEVO: OCULTAR ESTRELLAS (Para que no se vean puntos estáticos) ---
    if (typeof starMesh !== 'undefined' && starMesh) {
        starMesh.visible = false;
    }
    // ---------------------------------------------------------------------

    // Resetear partículas intro
    if (introParticlesMesh) introParticlesMesh.material.opacity = 0;

    // INICIAR SONIDO "DRONE" DE FONDO (FUSIÓN DEL NÚCLEO)
    if (audioCtx && !safeSettings.noShake) { // Respetar ajuste de sonido/shake
        try {
            if (audioCtx.state === 'suspended') audioCtx.resume();

            // Oscilador grave (hum)
            introDroneOscillator = audioCtx.createOscillator();
            introDroneGain = audioCtx.createGain();

            introDroneOscillator.type = 'sawtooth';
            introDroneOscillator.frequency.value = 40; // 40Hz (muy grave)

            // Filtro paso bajo para suavizar
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 200;

            introDroneOscillator.connect(filter);
            filter.connect(introDroneGain);
            introDroneGain.connect(audioCtx.destination);

            introDroneGain.gain.setValueAtTime(0, audioCtx.currentTime);
            introDroneGain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 2); // Fade in suave

            introDroneOscillator.start();
        } catch (e) { console.warn("Audio intro error:", e); }
    }

    showIntroText("Detectando vacío cuántico...");
}

startMerchantLoop();



let activeNodes = [];

window.spawnSignalNode = function() {
    if ((game.buildings['sat_uplink'] || 0) <= 0) return;
    
    // Crear un nodo visual en una posición aleatoria alrededor del núcleo
    const node = document.createElement('div');
    node.className = 'signal-node';
    node.innerHTML = '🎯';
    node.style.cssText = `
        position: absolute;
        left: ${Math.random() * 60 + 20}%;
        top: ${Math.random() * 60 + 20}%;
        cursor: pointer;
        z-index: 2000;
        animation: pulseNode 2s infinite;
        filter: drop-shadow(0 0 10px #00ff88);
    `;

    node.onclick = (e) => {
        e.stopPropagation();
        activateSyncBoost();
        node.remove();
    };

    document.getElementById('game-area').appendChild(node);
    setTimeout(() => { if(node.parentNode) node.remove(); }, 4000);
};

// Multiplicador temporal por click de precisión
function activateSyncBoost() {
    sfxClick();
    const boost = 1.25; // +25% de producción total
    activateBuff('production', boost, 5); // Reutilizamos tu sistema de buffs
    showAnomalyPopup("🛰️ SEÑAL SINCRONIZADA: +25% CPS", 'good');
}





function handleIntroClick() {
    // Si ya hemos llegado al final, IGNORAR clicks extra para no romper la cinemática
    if (introClicks >= INTRO_TOTAL_CLICKS) return;

    introClicks++;

    // Progreso de 0.0 a 1.0 basado en 100 clicks
    const progress = Math.min(1.0, introClicks / INTRO_TOTAL_CLICKS);

    // --- EFECTOS VISUALES ---
    if (mainObject) {
        // Temblor
        const shake = progress * 0.5;
        mainObject.rotation.x += (Math.random() - 0.5) * shake;
        mainObject.rotation.y += (Math.random() - 0.5) * shake;

        // Color (Negro -> Rojo -> Blanco)
        if (progress < 0.4) {
            const localP = progress / 0.4;
            mainObject.material.color.setHSL(0.0, 1.0, localP * 0.15);
            mainObject.material.emissive.setHSL(0.0, 1.0, localP * 0.05);
        }
        else if (progress < 0.8) {
            const localP = (progress - 0.4) / 0.4;
            mainObject.material.color.setHSL(0.08 * localP, 1.0, 0.15 + (localP * 0.35));
            mainObject.material.emissiveIntensity = localP * 0.8;
        }
        else {
            const localP = (progress - 0.8) / 0.2;
            mainObject.material.color.setHSL(0.12, 1.0, 0.5 + (localP * 0.5));
            mainObject.material.emissiveIntensity = 0.8 + (localP * 3.0);

            glowMesh.visible = true;
            glowMesh.material.opacity = localP;
            glowMesh.scale.setScalar(1.0 + (Math.random() * 0.2));
        }

        // Partículas
        if (introParticlesMesh) {
            introParticlesMesh.material.opacity = progress;
            introParticlesMesh.rotation.y += 0.02 + (progress * 0.1);
            introParticlesMesh.scale.setScalar(1.5 - (progress * 0.8));
        }
    }

    // --- TEXTO NARRATIVO Y AUDIO ---
    // Modulación del drone
    if (introDroneOscillator && introDroneGain) {
        try {
            const baseFreq = 40;
            const targetFreq = 40 + (progress * 200); // Sube hasta 240Hz
            introDroneOscillator.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);

            const targetGain = 0.15 + (progress * 0.2); // Sube volumen
            introDroneGain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.1);
        } catch (e) { }
    }

    if (introClicks === 1) showIntroText("Iniciando compresión de materia...");
    else if (introClicks === 20) { playTone(50, 'sawtooth', 0.2); showIntroText("Temperatura central en aumento."); }
    else if (introClicks === 50) { playTone(100, 'square', 0.3); showIntroText("Fricción atómica detectada. Continúa."); }
    else if (introClicks === 65) { playTone(300, 'sawtooth', 0.6); showIntroText("¡ADVERTENCIA: MASA CRÍTICA ALCANZADA!"); }
    else if (introClicks === 85) { playTone(600, 'sine', 1.0); showIntroText("¡COLAPSO INMINENTE!"); }

    // AL FINALIZAR: Llamamos una sola vez
    else if (introClicks === INTRO_TOTAL_CLICKS) {
        finishIntro();
    }
}




function showIntroText(text) {
    const el = document.getElementById('intro-text');
    el.style.opacity = 0;
    setTimeout(() => {
        el.innerText = text;
        el.style.opacity = 1;
    }, 200);
}

function finishIntro() {
    // Detener drone
    if (introDroneOscillator) {
        try {
            introDroneGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
            introDroneOscillator.stop(audioCtx.currentTime + 1);
        } catch (e) { }
        introDroneOscillator = null;
        introDroneGain = null;
    }

    // 1. Quitar partículas de intro inmediatamente
    if (introParticlesMesh) {
        scene.remove(introParticlesMesh);
        introParticlesMesh.geometry.dispose();
        introParticlesMesh.material.dispose();
        introParticlesMesh = null;
    }

    // 2. Flash Blanco (Big Bang)
    const flash = document.createElement('div');
    flash.className = 'flash-bang';
    document.body.appendChild(flash);

    // Sonido EXPLOSIÓN REVERB (simulado)
    if (!safeSettings.noShake) {
        playTone(50, 'sawtooth', 1.5, 0.5);
        setTimeout(() => playTone(30, 'square', 2.0, 1.0), 100);
        setTimeout(() => playTone(100, 'noise', 1.0, 1.5), 200);
    }

    // Eliminar flash visual después de un rato
    setTimeout(() => {
        if (flash && flash.parentNode) flash.remove();
    }, 2500);

    // SECUENCIA CINEMATOGRÁFICA
    // T+150ms: Primera frase
    setTimeout(() => {
        const el = document.getElementById('intro-text');
        if (el) el.innerText = "“La energía no se crea ni se destruye...”";

        // T+3000ms: Segunda frase
        setTimeout(() => {
            if (el) el.innerText = "...solo se acumula.";

            // T+6000ms: Título
            setTimeout(() => {
                if (el) el.innerHTML = "<span style='font-size:3rem; color:#00e5ff; text-shadow:0 0 20px #00e5ff'>QUANTUM CLICKER</span><br><span style='font-size:1rem; color:#aaa'>Iniciando sistemas principales...</span>";

                // T+9000ms: Frase final
                setTimeout(() => {
                    if (el) el.innerText = "Aquí empieza tu imperio.";

                    // T+11000ms: FINALIZAR INTRO
                    setTimeout(() => {
                        // Ocultar capa de intro
                        const layer = document.getElementById('intro-layer');
                        if (layer) {
                            layer.style.opacity = 0;
                            setTimeout(() => {
                                layer.style.display = 'none';
                                document.body.classList.remove('intro-mode');
                            }, 1000);
                        }

                        // ACTIVAR RADIO AUTOMÁTICAMENTE (Nightride FM)
                        if (!radioPlaying) {
                            setTimeout(() => {
                                changeStation('nightride');
                                showNotification('📻 RADIO ACTIVADA', 'Sintonizando Nightride FM...');
                            }, 1000);
                        }

                        // TRANSICIÓN AL JUEGO
                        isIntroActive = false;

                        // Restaurar estrellas visualmente
                        if (typeof starMesh !== 'undefined' && starMesh) starMesh.visible = true;

                        // Restaurar núcleo
                        if (mainObject) {
                            mainObject.material.emissiveIntensity = 0.5;
                            mainObject.material.color.setHex(0x00ff88);
                            mainObject.material.emissive.setHex(0x003311);
                            if (glowMesh) {
                                glowMesh.visible = true;
                                glowMesh.material.opacity = 0.6;
                            }
                        }

                        // Guardar que ya se hizo la intro
                        saveGame();

                        // Iniciar loop de anomalías
                        setTimeout(spawnAnomaly, 10000);

                    }, 2000); // Wait 2s on "Aquí empieza tu imperio"
                }, 3000); // Wait 3s on Title
            }, 3000); // Wait 3s on Phrase 2
        }, 3000); // Wait 3s on Phrase 1
    }, 150);
}
function triggerOmegaFinalAnimation() {
    isIntroActive = true; // Bloqueamos interacciones
    const duration = safeSettings.noShake ? 2000 : 5000;
    const startTime = Date.now();

    // 1. Efecto de sonido inicial (Estruendo)
    if (!safeSettings.noShake) {
        playTone(40, 'sawtooth', 4.0, 0.5);
        playTone(100, 'sine', 5.0, 0.3);
    } else {
        playTone(100, 'sine', 1.0, 0.15);
    }

    const omegaInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        if (progress >= 1) {
            clearInterval(omegaInterval);
            finishOmegaEvent();
            return;
        }

        // --- EFECTOS EN EL NÚCLEO (Three.js) ---
        if (mainObject && glowMesh) {
            if (safeSettings.noShake) {
                // Modo seguro: solo escala suave, sin vibración
                mainObject.scale.setScalar(1 + progress * 0.5);
                glowMesh.scale.setScalar(1.2 + progress * 1.5);
                mainObject.material.emissiveIntensity = 0.6 + progress * 2;
            } else {
                // Modo normal: vibración completa
                mainObject.position.x = (Math.random() - 0.5) * progress * 2;
                mainObject.position.y = (Math.random() - 0.5) * progress * 2;
                glowMesh.scale.setScalar(1.2 + progress * 5);
                glowMesh.material.opacity = Math.sin(Date.now() * 0.05);
                mainObject.material.emissiveIntensity = progress * 10;
                mainObject.material.color.lerp(new THREE.Color(0xffffff), 0.1);
            }
        }

        // --- EFECTOS DE CÁMARA (solo modo normal) ---
        if (!safeSettings.noShake) {
            camera.position.z = 8 - (progress * 4);
            camera.rotation.z += progress * 0.2;
        }

        // --- EFECTOS DE PANTALLA (solo modo normal) ---
        if (!safeSettings.noGlitch) {
            if (Math.random() > 0.9) {
                document.body.style.filter = `invert(1) hue-rotate(${Math.random() * 360}deg)`;
            } else {
                document.body.style.filter = "none";
            }
        }

    }, 1000 / 60);
}


/////////////VISUALES

function finishOmegaEvent() {
    // 1. Crear el Flash final
    const flash = document.createElement('div');
    flash.className = 'flash-bang'; // Reutilizamos tu CSS de flash
    document.body.appendChild(flash);

    // 2. Aplicar cambios definitivos
    isApocalypse = true;
    unlockPearl('red');

    // Resetear transformaciones de cámara y objeto
    mainObject.position.set(0, 0, 0);
    mainObject.scale.setScalar(1);
    camera.position.set(0, 0, 8);
    camera.rotation.set(0, 0, 0);
    document.body.style.filter = "none";

    // 3. Limpiar flash y mostrar mensaje final
    setTimeout(() => {
        if (flash.parentNode) flash.remove();
        isIntroActive = false;
        showSystemModal(
            "🔴 SINGULARIDAD ALCANZADA",
            "El núcleo ha colapsado. La Perla de la Entropía es tuya.\nLa realidad ya no volverá a ser la misma.",
            false, null
        );
        renderStore();
        updateUI();
    }, 1200);
}













// ==========================================
// 2.5. SISTEMA DE AYUDANTES (10 ALIENS)
// ==========================================

// Fórmula de Nivel: Nivel = Raíz Cúbica de Energía Total
// Nivel 10 = 1,000 Energía
// Nivel 20 = 8,000 Energía
// Nivel 50 = 125,000 Energía
// Nivel 100 = 1,000,000 Energía (Ascensión)

const MAX_HELPERS = 4; // Solo 4 huecos

const helpersConfig = [
    // TIER 1 (PRINCIPIANTE - NIVEL 1-10)
    {
        id: 'h_clicker',
        name: '👩‍🔬 Dra. Aris Thorne',
        quotes: ["La transferencia cinética es estable. Sigue pulsando.", "He ajustado los condensadores manuales."],
        desc: 'Teórica de Campos. Optimiza la transferencia cinética: Pulsos manuales +300%.',
        cost: 15, icon: '👩‍🔬',
        reqLevel: 1, // Desbloqueo inmediato para empezar
        effect: 'clickPower', value: 3
    },
    {
        id: 'h_crit',
        name: '👮‍♂️ Sargento Kael',
        quotes: ["¡Fuego a discreción!", "Golpea en el ángulo de 45 grados."],
        desc: 'Seguridad de Red. Protocolos de choque: 10% probabilidad de Pulso Crítico (x10).',
        cost: 800, icon: '👮‍♂️',
        reqLevel: 5, // Introducción temprana al crítico
        effect: 'critChance', value: 0.1
    },
    {
        id: 'h_miner',
        name: '👨‍💻 Ing. Marcus Voltz',
        quotes: ["He parcheado una fuga. La producción ha subido.", "¿Ves ese zumbido? Eficiencia pura."],
        desc: 'Arquitecto de Red. Maximiza el flujo constante de los generadores automáticos (+50% W/s).',
        cost: 50, icon: '👨‍💻',
        reqLevel: 10, // Primer gran salto de W/s
        effect: 'cpsMultiplier', value: 1.5
    },

    // TIER 2 (INTERMEDIO - NIVEL 11-25)
    {
        id: 'h_efficiency',
        name: '🔬 Dra. Sarah Joule',
        quotes: ["He optimizado los disipadores.", "La entropía es nuestra enemiga."],
        desc: 'Termodinámica Sénior. Disipación de calor: Mantenimiento del Staff -40% Watts.',
        cost: 1500, icon: '🔬',
        reqLevel: 15, // Necesaria cuando el staff empieza a ser caro
        effect: 'helperMaintenance', value: 0.6
    },
    {
        id: 'h_combo',
        name: '👩‍⚡ Dra. Elena Flux',
        quotes: ["He estabilizado el campo temporal.", "Mantén el ritmo, desviando el exceso de calor."],
        desc: 'Especialista en Transitorios. Estabiliza picos de energía: Combos duran x2 tiempo.',
        cost: 200, icon: '👩‍⚡',
        reqLevel: 20,
        effect: 'comboTime', value: 2
    },
    {
        id: 'h_discount',
        name: '👔 Silas Vane',
        quotes: ["Materiales de grafeno a mitad de precio.", "Hoy los reactores salen baratos."],
        desc: 'Logista Cuántico. Negocia contratos de suministros: Estructuras -10% de coste.',
        cost: 100, icon: '👔',
        reqLevel: 25,
        effect: 'costReduction', value: 0.9
    },

    // TIER 3 (AVANZADO - NIVEL 30-50)
    {
        id: 'h_anomaly',
        name: '🕵️‍♂️ Dorian Nox',
        quotes: ["Mis escáneres detectan una fluctuación...", "El vacío nos está susurrando."],
        desc: 'Analista de Vacío. Sensores de largo alcance: Anomalías aparecen x2 rápido.',
        cost: 500, icon: '🕵️‍♂️',
        reqLevel: 30,
        effect: 'anomalyRate', value: 2
    },
    {
        id: 'h_scavenger',
        name: '🔧 "Recio" Miller',
        quotes: ["La basura de uno es mi tesoro...", "He modificado tu mochila."],
        desc: 'Chatarrero Espacial. Optimización de desguace: +25% Valor de venta de ítems en Galacticoins.',
        cost: 1200, icon: '🔧',
        reqLevel: 40,
        effect: 'itemValueBoost', value: 1.25
    },
    {
        id: 'h_banker',
        name: '📉 Victor "Broker" Ray',
        quotes: ["El mercado energético está al alza.", "He vendido el excedente en el mercado negro."],
        desc: 'Especulador Energético. Arbitraje de mercado: Anomalías de capital dan +50%.',
        cost: 2000, icon: '📉',
        reqLevel: 50,
        effect: 'goldenCookieBuff', value: 1.5
    },

    // TIER 4 (EXPERTO - NIVEL 60-80)
    {
        id: 'h_synergy',
        name: '🤖 IA "Mente Enlazada"',
        quotes: ["Análisis completado.", "Integrando eficiencia estructural."],
        desc: 'Integración Sintética. Gestión total: +1% W/s por cada estructura desplegada.',
        cost: 5000, icon: '🤖',
        reqLevel: 60,
        effect: 'buildingSynergy', value: 0.01
    },
    {
        id: 'h_hunter',
        name: '🏹 Kiana Vane',
        quotes: ["Tengo a ese visitante en mi mira.", "Sus escudos no son nada contra mis balas."],
        desc: 'Cazadora de Recompensas. Rastreo Alien: Los Aliens tardan +10s en huir (dan x2 Watts).',
        cost: 3000, icon: '🏹',
        reqLevel: 75,
        effect: 'alienMastery', value: 2.0
    },

    // TIER 5 (MAESTRO - NIVEL 90-100)
    {
        id: 'h_luck',
        name: '🃏 Gambito Zero',
        quotes: ["¿Quieres ver un truco?", "La suerte es solo una variable."],
        desc: 'Manipulador Probabilístico. Suerte del Diablo: Duplica la probabilidad de encontrar ítems Épicos.',
        cost: 7500, icon: '🃏',
        reqLevel: 90,
        effect: 'luckMultiplier', value: 2.0
    },
    {
        id: 'h_master',
        name: '👨‍💼 Director Cipher',
        quotes: ["Protocolo Maestro activado.", "Todos los sistemas bajo control absoluto."],
        desc: 'Administrador General. Ejecuta el Protocolo Dios: Potencia Global x2.0.',
        cost: 10000, icon: '👨‍💼',
        reqLevel: 100,
        effect: 'globalMultiplier', value: 2.0
    }
];

const synergiesConfig = [
    {
        name: "Protocolo de Campo",
        ids: ['h_clicker', 'h_crit'],
        check: (h) => h.includes('h_clicker') && h.includes('h_crit'),
        apply: () => { /* Manejado en doClickLogic */ }
    },
    {
        name: "Ciclo Cerrado",
        ids: ['h_miner', 'h_efficiency'],
        check: (h) => h.includes('h_miner') && h.includes('h_efficiency'),
        apply: (stats) => { stats.cpsMult *= 1.10; stats.maintMult *= 0.5; }
    }
];



// ==========================================
// 3. MOTOR GRÁFICO (THREE.JS)
// ==========================================
let scene, camera, renderer, composer;
let mainObject, glowMesh, starMesh;
let particles = [];
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let comboMultiplier = 1.0;
let comboTimer = 0;
let isOvercharged = false;


const particleGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const particleMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });




function createIntroParticles() {
    const geometry = new THREE.BufferGeometry();
    const count = 2000;
    const posArray = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i++) {
        // Distribución en una esfera más grande que la bola principal
        posArray[i] = (Math.random() - 0.5) * 15;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    // Material que empieza invisible
    const material = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xff4400, // Naranja fuego
        transparent: true,
        opacity: 0, // Empieza invisible
        blending: THREE.AdditiveBlending
    });

    introParticlesMesh = new THREE.Points(geometry, material);
    scene.add(introParticlesMesh);
}

function initThree() {
    const canvas = document.getElementById('three-canvas');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.03);
    createIntroParticles()

    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 8;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? 1.5 : 1);

    // Añadir soporte TOUCH además de CLICK
    canvas.addEventListener('touchstart', (e) => {
        // Evita que el navegador intente hacer scroll o zoom al tocar el canvas
        e.preventDefault();

        // Simula el click para tu lógica de juego
        // (Cogemos el primer dedo que toca la pantalla)
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent("mousedown", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, { passive: false });


    // OBJETO PRINCIPAL
    const geometry = new THREE.IcosahedronGeometry(1.8, 1);
    const material = new THREE.MeshStandardMaterial({
        color: 0x00ff88, roughness: 0.2, metalness: 0.9,
        emissive: 0x004422, emissiveIntensity: 0.6, flatShading: true
    });
    mainObject = new THREE.Mesh(geometry, material);
    scene.add(mainObject);

    const wireGeo = new THREE.IcosahedronGeometry(2.0, 1);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x7c4dff, wireframe: true, transparent: true, opacity: 0.15 });
    glowMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(glowMesh);

    createStarfield();

    const p1 = new THREE.PointLight(0xffffff, 2); p1.position.set(5, 5, 5); scene.add(p1);
    const p2 = new THREE.PointLight(0x7c4dff, 3); p2.position.set(-5, -5, 2); scene.add(p2);
    scene.add(new THREE.AmbientLight(0xffffff, 0.1));

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);

    // Ajustar bloom según modo seguro
    if (safeSettings.noBloom) {
        bloomPass.threshold = 0.3; bloomPass.strength = 0.3; bloomPass.radius = 0.1;
    } else {
        bloomPass.threshold = 0.1; bloomPass.strength = 1.2; bloomPass.radius = 0.5;
    }

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    window.addEventListener('resize', onResize);
    canvas.addEventListener('mousedown', onCanvasClick);
}






function createStarfield() {
    const starGeo = new THREE.BufferGeometry();
    const count = 1000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 60;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.8 });
    starMesh = new THREE.Points(starGeo, starMat);
    scene.add(starMesh);
}


function onCanvasClick(e) {
    // 1. Activar audio si es el primer click
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // 2. Calcular posición del ratón para Raycaster
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // 3. Comprobar colisión con el núcleo
    const intersects = raycaster.intersectObject(mainObject);

    if (intersects.length > 0) {
        // --- 🛑 INTERCEPCIÓN DEL MODO INTRO ---
        if (isIntroActive) {
            handleIntroClick(); 
            spawnParticles(intersects[0].point);
            sfxClick();
            return; 
        }

        // 4. LÓGICA DE JUEGO NORMAL
        doClickLogic(e.clientX, e.clientY);

        // --- 💓 EFECTO DE LATIDO (PULSO FÍSICO) ---
        
        // A. Sacudida de cámara muy sutil
        camera.position.x += (Math.random() - 0.5) * 0.15;
        camera.position.y += (Math.random() - 0.5) * 0.15;

        // B. Expansión instantánea (El "golpe" del latido)
        // Escalamos un 10% hacia afuera para simular el pulso
        mainObject.scale.setScalar(1.1); 
        glowMesh.scale.setScalar(1.15);

        // C. Retorno elástico rápido
        // Reducimos el tiempo a 70ms para que sea un movimiento seco y reactivo
        setTimeout(() => {
            if (mainObject) mainObject.scale.setScalar(1);
            if (glowMesh) glowMesh.scale.setScalar(1);
        }, 70);

        // Partículas en el punto de impacto
        spawnParticles(intersects[0].point);
    }
}














function spawnAlien() {
    // 🛑 REQUISITO: Mejora de ascensión 'alien_contact'
    if (!game.heavenlyUpgrades.includes('alien_contact')) return;

    // Evitar duplicados y pausas durante la intro
    if (document.getElementById('active-alien')) return;
    if (typeof isIntroActive !== 'undefined' && isIntroActive) return;

    // --- BONIFICACIÓN DE KIANA VANE (Xeno-Cazadora) ---
    const hasHunter = game.helpers.includes('h_hunter');
    const hunterBonus = hasHunter ? 2 : 1;
    const timeBonus = hasHunter ? 5000 : 0; // 5 segundos extra de margen

    // Seleccionar tipo según probabilidad
    const rand = Math.random();
    let type = 'green';
    if (rand > 0.95) type = 'red';
    else if (rand > 0.8) type = 'yellow';

    const config = alienTypes[type];
    let clicksLeft = config.clicks;

    const alien = document.createElement('div');
    alien.id = 'active-alien';
    alien.className = 'alien-invader';
    alien.innerHTML = `
        <div class="alien-icon" style="font-size: 4rem;">${config.icon}</div>
        <div class="alien-hp-bar"><div class="alien-hp-fill" style="background: ${config.color}"></div></div>
    `;

    // Posición inicial aleatoria con transiciones suaves
    alien.style.cssText = `
        position: absolute; 
        left: ${Math.random() * 80 + 10}%; 
        top: ${Math.random() * 80 + 10}%; 
        z-index: 5000; 
        transition: all 1.2s ease-in-out; 
        filter: drop-shadow(0 0 15px ${config.color});
        cursor: crosshair;
        user-select: none;
    `;

    document.getElementById('game-area').appendChild(alien);

    // Sonido de llegada
    if (typeof sfxAnomaly === 'function') sfxAnomaly();

    // Movimiento: El alien se reposiciona cada 1.5 segundos
    const moveInterval = setInterval(() => {
        if (!alien.parentNode) { clearInterval(moveInterval); return; }
        alien.style.left = `${Math.random() * 80 + 10}%`;
        alien.style.top = `${Math.random() * 80 + 10}%`;
    }, 1500);

    alien.onclick = (e) => {
        e.stopPropagation();
        clicksLeft--;

        // Sonido de impacto
        if (typeof playTone === 'function') playTone(200 + (clicksLeft * 20), 'sawtooth', 0.05, 0.2);

        // Efecto visual de daño
        const icon = alien.querySelector('.alien-icon');
        icon.style.transform = `scale(0.8) rotate(${Math.random() * 30 - 15}deg)`;
        setTimeout(() => {
            if (alien.parentNode) icon.style.transform = 'scale(1) rotate(0deg)';
        }, 60);

        // Actualizar barra de HP
        const fill = alien.querySelector('.alien-hp-fill');
        if (fill) fill.style.width = `${(clicksLeft / config.clicks) * 100}%`;

        // --- MUERTE DEL ALIEN ---
        if (clicksLeft <= 0) {
            clearInterval(moveInterval);

            // 🆙 RECOMPENSA DE EXPERIENCIA
            if (typeof gainExp === 'function') {
                gainExp(250); 
                if (typeof spawnExpText === 'function') {
                    spawnExpText(250, e.clientX, e.clientY);
                }
            }

            // Recompensa de energía aplicada con el multiplicador de la Cazadora
            const reward = getCPS() * config.reward * 10 * hunterBonus;
            game.cookies += reward;
            game.totalCookiesEarned += reward;

            createFloatingText(e.clientX, e.clientY, `¡INTERCEPTADO! +${formatNumber(reward)}`, true);

            // DROP GARANTIZADO
            if (typeof tryDropItem === 'function') {
                tryDropItem('Alien', 100); 
            }

            alien.remove();
            showNotification("🛸 AMENAZA ELIMINADA", "+250 EXP");
            updateUI();
        }
    };

    // Si no lo matas en 25 segundos (+5 con Kiana), huye
    setTimeout(() => {
        if (alien.parentNode) {
            clearInterval(moveInterval);
            alien.style.opacity = '0';
            alien.style.transform = 'scale(0) translateY(-100px)';
            setTimeout(() => alien.remove(), 500);
            showNotification("💨 ESCAPE", "El visitante ha escapado del sector.");
        }
    }, 25000 + timeBonus);
}





function spawnParticles(pos) {
    for (let i = 0; i < 6; i++) {
        const mesh = new THREE.Mesh(particleGeo, particleMat);
        mesh.position.copy(pos);
        mesh.userData.vel = new THREE.Vector3(
            (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5) + 0.5
        ).normalize().multiplyScalar(Math.random() * 0.2);
        scene.add(mesh);
        particles.push(mesh);
    }
}


// 1. Asegúrate de declarar estas variables globales si no están
let satelliteMeshes = []; 

/**
 * Crea la representación visual de un satélite
 */
function createSatelliteModel() {
    const group = new THREE.Group();
    
    // Cuerpo central (Cubo metálico)
    const bodyGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x888888, 
        metalness: 1, 
        roughness: 0.2 
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Paneles solares (Finas láminas azules)
    const panelGeo = new THREE.PlaneGeometry(0.5, 0.18);
    const panelMat = new THREE.MeshStandardMaterial({ 
        color: 0x0055ff, 
        emissive: 0x001133,
        side: THREE.DoubleSide,
        metalness: 0.5,
        roughness: 0.3
    });

    const leftPanel = new THREE.Mesh(panelGeo, panelMat);
    leftPanel.position.x = -0.35;
    group.add(leftPanel);

    const rightPanel = new THREE.Mesh(panelGeo, panelMat);
    rightPanel.position.x = 0.35;
    group.add(rightPanel);

    // Antena de comunicaciones
    const antGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.2);
    const ant = new THREE.Mesh(antGeo, bodyMat);
    ant.position.y = 0.15;
    group.add(ant);

    return group;
}

/**
 * Sincroniza los modelos 3D con la cantidad de edificios comprados
 */
window.syncSatellites3D = function() {
    // Verificación de seguridad para evitar errores si Three.js no ha cargado
    if (typeof scene === 'undefined' || !scene) return;

    // Aseguramos que game.buildings exista
    if (!game.buildings) game.buildings = {};

    const targetCount = Math.min(game.buildings['sat_uplink'] || 0, 15);

    // Crear nuevos satélites
    while (satelliteMeshes.length < targetCount) {
        const sat = createSatelliteModel();
        
        sat.userData = {
            distance: 2.8 + Math.random() * 2.5,
            speed: 0.3 + Math.random() * 0.7,
            offset: Math.random() * Math.PI * 2,
            yVar: (Math.random() - 0.5) * 2
        };

        sat.position.set(sat.userData.distance, 0, 0);
        
        scene.add(sat);
        satelliteMeshes.push(sat);
        console.log("🛰️ Satélite desplegado.");
    }
    
    // Eliminar satélites si se reinicia o vende
    while (satelliteMeshes.length > targetCount) {
        const sat = satelliteMeshes.pop();
        if (sat) {
            scene.remove(sat);
            // Si tienes la función dispose3D definida, úsala. 
            // Si no, basta con scene.remove para quitarlo visualmente.
            if (typeof dispose3D === 'function') {
                dispose3D(sat);
            }
        }
    }
};

function syncSatellites3D() {
    const count = game.buildings['sat_uplink'] || 0;
    
    // Si hay más edificios que modelos, añadimos los que faltan
    while (satelliteMeshes.length < count && satelliteMeshes.length < 10) { // Limitamos a 10 por rendimiento
        const sat = createSatelliteModel();
        // Asignamos órbitas aleatorias para que no colisionen
        sat.userData = {
            distance: 2.5 + Math.random() * 1.5,
            speed: 0.5 + Math.random() * 1,
            offset: Math.random() * Math.PI * 2,
            axis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize()
        };
        scene.add(sat);
        satelliteMeshes.push(sat);
    }
}



function update3D() {
    const time = Date.now() * 0.002;
    const cps = getCPS();
    const totalWatts = game.totalCookiesEarned;

    // 🛑 1. LÓGICA ESPECIAL DE LA INTRO
    if (isIntroActive) {
        if (typeof introParticlesMesh !== 'undefined' && introParticlesMesh) {
            introParticlesMesh.rotation.y += 0.002;
            introParticlesMesh.rotation.z += 0.001;
        }
        updateParticles();
        composer.render();
        return;
    }

    // 🚀 2. JUEGO NORMAL - EFECTOS DINÁMICOS
    const rotSpeed = 0.005 + Math.min(0.2, cps * 0.00001);
    mainObject.rotation.y += rotSpeed;
    mainObject.rotation.x += rotSpeed * 0.5;
    glowMesh.rotation.y -= rotSpeed * 1.5;

    // --- B. LÓGICA DE ESTADOS (APOCALIPSIS VS NORMAL) ---
    if (isApocalypse) {
        const pulseFreq = 10 + Math.sin(time) * 5;
        const pulseScale = 1 + Math.sin(time * pulseFreq) * 0.15;
        mainObject.scale.setScalar(pulseScale);
        mainObject.material.color.setHex(0xff0000);
        mainObject.material.emissive.setHex(0xff0000);
        mainObject.material.emissiveIntensity = 2.0 + Math.sin(time * 20) * 1.0;
        glowMesh.material.color.setHex(0xff3300);
        glowMesh.scale.setScalar(pulseScale * 1.1 + Math.random() * 0.05);
        if (scene.fog) scene.fog.color.setHex(0x110000);
        camera.position.x += (Math.random() - 0.5) * 0.05;
        camera.position.y += (Math.random() - 0.5) * 0.05;

    } else {
        // --- MODO NORMAL / POST-BUFF (CORREGIDO) ---
        let targetColor = new THREE.Color(0x00ff88);
        let targetEmissive = new THREE.Color(0x004422);
        let targetGlow = new THREE.Color(0x7c4dff);

        if (buffMultiplier === 1 && clickBuffMultiplier === 1) {
            if (totalWatts >= 1000) { targetColor.setHex(0xffaa00); targetEmissive.setHex(0xff4400); targetGlow.setHex(0xffcc00); }
            if (totalWatts >= 1000000) { targetColor.setHex(0x00e5ff); targetEmissive.setHex(0x0044aa); targetGlow.setHex(0x00ffff); }
            if (totalWatts >= 1000000000) { targetColor.setHex(0x9900ff); targetEmissive.setHex(0x220044); targetGlow.setHex(0xff00ff); }
        } else {
            if (buffMultiplier > 1) { targetColor.setHex(0xff5500); targetEmissive.setHex(0xff2200); } 
            else if (clickBuffMultiplier > 1) { targetColor.setHex(0x00ffff); targetEmissive.setHex(0x0088ff); }
        }

        mainObject.material.color.lerp(targetColor, 0.05);
        mainObject.material.emissive.lerp(targetEmissive, 0.05);
        glowMesh.material.color.lerp(targetGlow, 0.05);

        const pulse = 1 + Math.sin(time * 2) * 0.03;
        mainObject.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.1);
        if (scene.fog) scene.fog.color.lerp(new THREE.Color(0x000000), 0.1);
    }

    // --- C. FONDO DE ESTRELLAS (HIPERESPACIO) ---
    if (starMesh && starMesh.geometry) {
        const positions = starMesh.geometry.attributes.position.array;
        let starSpeed = isApocalypse ? 0.5 : 0.05 + Math.min(1.5, cps * 0.0005);
        if (buffMultiplier > 1 || clickBuffMultiplier > 1) starSpeed += 0.8;

        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 2] += starSpeed;
            if (isApocalypse) { positions[i] *= 0.98; positions[i + 1] *= 0.98; }
            if (positions[i + 2] > 20) {
                positions[i + 2] = -40;
                if (isApocalypse) {
                    positions[i] = (Math.random() - 0.5) * 60;
                    positions[i + 1] = (Math.random() - 0.5) * 60;
                }
            }
        }
        starMesh.geometry.attributes.position.needsUpdate = true;
    }

    // --- D. SATÉLITES ORBITALES ---
    const hasHorizon = game.helpers.includes('h_anomaly') && game.helpers.includes('h_discount');
    
    satelliteMeshes.forEach((sat) => {
        const d = sat.userData;
        const orbitTime = time * d.speed + d.offset;
        
        // Movimiento en órbita circular con ligera inclinación en Y
        sat.position.x = Math.cos(orbitTime) * d.distance;
        sat.position.z = Math.sin(orbitTime) * d.distance;
        sat.position.y = Math.sin(orbitTime * 0.5) * (d.distance * 0.3);
        
        sat.lookAt(0, 0, 0); // Siempre orientados al núcleo

        // Si la Build Horizonte de Eventos está activa, los satélites dejan estela
        if (hasHorizon && Math.random() > 0.8) {
            spawnParticles(sat.position); 
        }
    });

    // --- ANILLO ORBITAL (Evolución del núcleo) ---
    if (orbitalRing) {
        orbitalRing.rotation.z += 0.008;
        orbitalRing.rotation.y += 0.003;
        orbitalRing.material.opacity = 0.3 + Math.sin(time * 1.5) * 0.15;
    }

    // --- G. VIBRACIÓN POR BUFFS ---
    if (buffMultiplier > 1 || clickBuffMultiplier > 1) {
        const intensity = clickBuffMultiplier > 1 ? 0.12 : 0.05;
        mainObject.position.x = (Math.random() - 0.5) * intensity;
        mainObject.position.y = (Math.random() - 0.5) * intensity;
    } else {
        mainObject.position.lerp(new THREE.Vector3(0, 0, 0), 0.1);
    }

    // --- E. POST-PROCESADO (BLOOM) ---
    if (composer.passes[1]) {
        const bloom = composer.passes[1];
        if (isApocalypse || buffMultiplier > 1 || clickBuffMultiplier > 1) {
            bloom.strength = 2.0 + Math.sin(time * 10) * 0.5;
            bloom.radius = 0.8;
        } else {
            bloom.strength = 1.0 + (totalWatts > 1000000 ? 0.5 : 0);
        }
    }

    updateParticles();
    camera.position.lerp(new THREE.Vector3(0, 0, 8), 0.05);
    composer.render();
}




// Función auxiliar para limpiar el código (Pon esto fuera)
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.userData.vel);
        p.scale.multiplyScalar(0.92);

        if (p.scale.x < 0.01) {
            // Eliminar de escena y memoria
            scene.remove(p);
            if (p.geometry) p.geometry.dispose();
            if (p.material) p.material.dispose();
            particles.splice(i, 1);
        }
    }
}


function onResize() {
    const canvas = document.getElementById('three-canvas');
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h); composer.setSize(w, h);
}


// Función auxiliar para limpiar memoria de objetos 3D
function dispose3D(object) {
    if (!object) return;

    // 1. Eliminar de la escena
    if (object.parent) object.parent.remove(object);

    // 2. Liberar geometría (memoria de vértices)
    if (object.geometry) object.geometry.dispose();

    // 3. Liberar materiales (shaders y texturas)
    if (object.material) {
        if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
        } else {
            object.material.dispose();
        }
    }
}




// ==========================================
// 4. LÓGICA DE JUEGO
// ==========================================
// ANOMALIAS RANDOM (FRENZY GOLDEN COOKIES)

// Variable de seguridad fuera de la función

// Variable global para evitar bucles dobles (si no la tienes declarada fuera)
let isAnomalyLoopActive = false;



function collectAnomaly() {
    sfxBuy(); 
    // ERROR CORREGIDO: getWps -> getCPS
    const reward = getCPS() * 300; 
    game.cookies += reward;
    
    game.anomaliesClicked = (game.anomaliesClicked || 0) + 1;

    showNotification("👾 ANOMALÍA ESTABILIZADA", `+${formatNumber(reward)} Energía detectada`);

    // Efecto visual de partículas en la posición del ratón
    createFloatingText(window.innerWidth / 2, window.innerHeight / 2, "¡ESTABLE!", true);

    updateUI();
}


function getPlayerLevel() {
    // Usamos la raíz cúbica: cada nivel pide exponencialmente más Watts
    // El "100" es el factor de dificultad, puedes subirlo a 500 si subes muy rápido
    return Math.floor(Math.cbrt(game.totalCookiesEarned / 100)) + 1;
}

// Puedes poner esto cerca de tus variables globales (como buffMultiplier)


window.gainExp = function(amount) {
    if (isNaN(amount) || amount <= 0) return;

    // Aplicamos el multiplicador global a cualquier cantidad recibida
    const finalAmount = amount * (globalExpRate || 1);

    game.exp += finalAmount;

    // Mantener la fórmula suave: Nivel = sqrt(exp / 100) + 1
    const newLevel = Math.floor(Math.sqrt(game.exp / 100)) + 1;

    if (newLevel > game.level) {
        const oldLevel = game.level;
        game.level = newLevel;
        handleLevelUp(oldLevel, newLevel);
    }
    
    if (typeof updateLevelUI === 'function') updateLevelUI();
};
// --- LÓGICA DE EXPERIENCIA PASIVA (Pon esto al final de game.js) ---
setInterval(() => {
    if (typeof gainExp === 'function' && !isIntroActive) {
        // Ahora damos 5 de base, que con el multiplicador x2.5 serán 12.5 EXP/seg
        gainExp(5); 
    }
}, 1000);


function handleLevelUp(oldLvl, newLvl) {
    // 1. Notificación visual y sonora
    showNotification("🆙 RANGO AUMENTADO", `¡Has alcanzado el Nivel ${newLvl}!`);
    
    if (typeof sfxLevelUp === 'function') {
        sfxLevelUp();
    } else {
        // Sonido de respaldo si no tienes el archivo de audio
        playTone(600, 'square', 0.3, 0.1); 
    }

    // 2. RECOMPENSA: Bono de Galacticoins por ascenso
    // Damos 10 GC por cada nivel subido (útil para el Mercado Negro)
    const gcBonus = 10;
    game.galacticoins = (game.galacticoins || 0) + gcBonus;
    showNotification("💰 BONO DE RANGO", `+${gcBonus} Galacticoins concedidos.`);

    // 3. Actualización de lógica y staff
    recalculateStats();
    
    // Esto es vital para que las tarjetas "Clasificadas" se revelen al instante
    if (typeof renderHelpers === 'function') {
        renderHelpers(); 
    }

    // 4. Guardado automático (Hito importante)
    saveGame();
}





function spawnAnomaly() {
    if (anomalyTimeout) clearTimeout(anomalyTimeout);

    if (typeof isIntroActive !== 'undefined' && isIntroActive) {
        anomalyTimeout = setTimeout(spawnAnomaly, 5000);
        return;
    }

    const active = game.activeHelpers || [];
    const hasDorian = active.includes('h_anomaly');
    const hasSilas = active.includes('h_discount');
    const hasHorizonBuild = hasDorian && hasSilas;

    const types = ['money', 'money', 'production', 'production', 'production', 'click', 'click'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let isCorrupt = isApocalypse && Math.random() < 0.3;
    if (isCorrupt && game.heavenlyUpgrades.includes('wrath_control')) {
        if (Math.random() < 0.5) isCorrupt = false;
    }

    if (hasHorizonBuild) isCorrupt = false;

    const orb = document.createElement('div');
    let icon = '⚛️'; let color = 'gold';

    if (isCorrupt) { 
        icon = '👁️'; color = '#ff0000'; 
    } else if (hasHorizonBuild) {
        icon = '🌀'; color = '#b388ff'; 
    } else if (type === 'production') { 
        icon = '⚡'; color = '#ffaa00'; 
    } else if (type === 'click') { 
        icon = '🖱️'; color = '#00ff88'; 
    }

    orb.className = 'anomaly-object';
    orb.innerHTML = icon;
    orb.style.cssText = `
        position: absolute; font-size: 3.5rem; cursor: pointer; z-index: 2000; 
        filter: drop-shadow(0 0 20px ${color}); 
        left: ${Math.random() * 80 + 10}%; top: ${Math.random() * 80 + 10}%;
        user-select: none; transition: opacity 0.5s;
    `;

    orb.onclick = function (e) {
        e.stopPropagation();
        if (typeof sfxAnomaly === 'function') sfxAnomaly();

        // --- 🆙 NUEVO: RECOMPENSA DE EXPERIENCIA ---
        if (typeof gainExp === 'function') {
            gainExp(100); 
            if (typeof spawnExpText === 'function') {
                spawnExpText(100, e.clientX, e.clientY);
            }
        }

        if (typeof tryDropItem === 'function') {
            tryDropItem('Anomalía', 30); 
        }

        if (hasHorizonBuild && isApocalypse && Math.random() < 0.3) {
            showAnomalyPopup(`🛡️ BUILD: ESTABILIZADA`);
        }

        if (type === 'money' || isCorrupt) {
            let gain = getCPS() * 1200;
            game.cookies += gain;
            game.totalCookiesEarned += gain;
            showAnomalyPopup(`+${formatNumber(gain)} Watts`);
        }
        else if (type === 'production') {
            activateBuff('production', 7, 10);
            showAnomalyPopup(`⚡ SOBRECARGA: x7`);
        }
        else if (type === 'click') {
            activateBuff('click', 777, 7);
            showAnomalyPopup(`🖱️ CLICKSTORM: x777`);
        }

        this.remove();
        updateUI();
    };

    document.getElementById('game-area').appendChild(orb);

    setTimeout(() => { if (orb.parentNode) orb.remove(); }, 15000);

    let nextSpawn = getAnomalyChance(); 
    anomalyTimeout = setTimeout(spawnAnomaly, nextSpawn);
}







// --- SISTEMA DE NOTIFICACIONES VISUALES (POP-UPS) ---
function showAnomalyPopup(text, type = 'good') {
    // 1. Crear el contenedor si no existe (Seguridad)
    let container = document.getElementById('anomaly-notifications');
    if (!container) {
        container = document.createElement('div');
        container.id = 'anomaly-notifications';
        document.body.appendChild(container);
    }

    // 2. Crear el elemento visual
    const div = document.createElement('div');
    // Añadimos clases para diferenciar si es bueno (dorado/azul) o malo (rojo)
    div.className = `anomaly-popup ${type}`;
    div.innerHTML = text; // Permite HTML (iconos)

    container.appendChild(div);

    // 3. Limpieza de memoria
    // Borramos el elemento del DOM después de la animación (4s)
    setTimeout(() => {
        if (div.parentNode) div.remove();
    }, 4000);
}

// Exponer para depuración
window.spawnAnomaly = spawnAnomaly;


// --- SISTEMA DE BUFFS (POTENCIADORES TEMPORALES) ---
let buffTimeout = null; // Para controlar si ya hay uno activo

function activateBuff(type, amount, seconds) {
    if (buffTimeout) clearTimeout(buffTimeout);

    // --- INTEGRACIÓN CON ÁRBOL CELESTIAL ---
    // Si tiene 'golden_duration', sumamos 10 segundos a la base
    const extraTime = game.heavenlyUpgrades.includes('golden_duration') ? 10 : 0;
    
    // Guardamos la duración total (base + bono) en milisegundos
    buffDuration = (seconds + extraTime) * 1000;
    buffEndTime = Date.now() + buffDuration;

    // Reset visual preventivo antes de aplicar el nuevo
    document.body.classList.remove('buff-active-prod', 'buff-active-click');

    if (type === 'production') {
        buffMultiplier = amount;
        document.body.classList.add('buff-active-prod');
    } else {
        clickBuffMultiplier = amount;
        document.body.classList.add('buff-active-click');
    }

    // Efecto de impacto visual en el núcleo 3D
    if (mainObject) {
        mainObject.scale.setScalar(2.5); // Expansión súbita por sobrecarga
        // Pequeño flash de color según el tipo
        mainObject.material.emissiveIntensity = 5; 
    }

    buffTimeout = setTimeout(() => {
        // RESET DE VALORES LÓGICOS
        buffMultiplier = 1;
        clickBuffMultiplier = 1;
        buffEndTime = 0;

        // LIMPIEZA VISUAL Y CSS
        document.body.classList.remove('buff-active-prod', 'buff-active-click');
        const gameArea = document.getElementById('game-area');
        if (gameArea) gameArea.style.boxShadow = "none";

        // Restauración suave de la posición y escala del núcleo
        if (mainObject) {
            mainObject.position.set(0, 0, 0);
            mainObject.material.emissiveIntensity = 0.6; // Valor base de tu config
        }

        updateUI();
        buffTimeout = null;
    }, buffDuration);
}






function getClickPower() {
    const cursorData = buildingsConfig.find(u => u.id === 'cursor');
    const count = game.buildings[cursorData.id] || 0;

    // 1. CÁLCULO DEL PODER BASE (Cursor + Mejoras Planas)
    let baseFlatPower = 1 + (count * cursorData.currentPower);

    // --- MEJORA: Sinergia Sincrotrón (Ahora se suma a la base) ---
    if (game.upgrades.includes('factory-click-synergy')) {
        const factoryCount = game.buildings['factory'] || 0;
        baseFlatPower += (factoryCount * 5);
        // Al sumarlo aquí, luego se multiplicará por el Prestigio y los Ayudantes.
        // ¡Mucho más potente!
    }

    // 2. APLICAR MULTIPLICADORES GLOBALES A LA BASE
    let power = baseFlatPower * game.prestigeMult;

    // 3. ARTEFACTO: PERLA AZUL (x50)
    if (game.activePearl === 'blue') power *= 50;

    // 4. AYUDANTE: Dra. Aris Thorne (Multiplicador de Click)
    const clickHelper = helpersConfig.find(h => h.effect === 'clickPower');
    if (clickHelper && game.helpers.includes(clickHelper.id)) {
        power *= clickHelper.value;
    }

    // 5. ÁRBOL COSMOS (ASCENSIÓN) - Porcentaje de WPS al Click
    // (Esto está perfecto donde está, sumándose al final)
    let wpsToClick = 0;

    if (game.heavenlyUpgrades.includes('click_god')) {
        wpsToClick = 0.05;
    }
    else if (game.heavenlyUpgrades.includes('click_transistor')) {
        wpsToClick = 0.01;
    }

    if (wpsToClick > 0) {
        power += (getCPS() * wpsToClick);
    }

    // 6. MULTIPLICADORES FINALES
    return Math.floor(power * comboMultiplier * clickBuffMultiplier);
}



function getMaxCombo() {
    let max = 5.0; // Base inicial

    // Mejora de la Dra. Elena Flux
    if (game.heavenlyUpgrades.includes('elena_flux_mastery')) max = 10.0;

    // Mejoras adicionales de expansión (+5.0 cada una)
    if (game.heavenlyUpgrades.includes('combo_expand_1')) max += 5.0;
    if (game.heavenlyUpgrades.includes('combo_expand_2')) max += 5.0;
    if (game.heavenlyUpgrades.includes('combo_expand_3')) max += 5.0;
    if (game.heavenlyUpgrades.includes('combo_expand_4')) max += 5.0;

    return max; // Puede llegar hasta x35.0 si tiene todo
}

function getCPS() {
    let cps = 0;
    // Usamos game.helpers como la lista de operadores activos (máx 4)
    const staff = game.helpers || []; 

    // 1. CÁLCULO BASE DE EDIFICIOS
    buildingsConfig.forEach(u => {
        if (u.type === 'auto') {
            let count = game.buildings[u.id] || 0;
            let bPower = count * u.currentPower;

            if (u.id === 'mine' && game.upgrades?.includes('grandma-mine-synergy')) {
                const grandmaCount = game.buildings['grandma'] || 0;
                bPower *= (1 + (grandmaCount * 0.01));
            }
            cps += bPower;
        }
    });

    // 2. MULTIPLICADORES GLOBALES (PRESTIGIO Y ÁRBOL)
    let total = cps * game.prestigeMult;
    if (game.heavenlyUpgrades.includes('perm_prod_1')) total *= 1.15;

    // 3. EFECTOS DE OPERADORES (Solo si su habilidad es de producción)
    // Dra. Thorne (h_clicker) NO suma nada aquí porque su bono es al click manual
    if (staff.includes('h_miner')) total *= 1.50; // Marcus Voltz x1.5
    if (staff.includes('h_master')) total *= 2.0; // Director Cipher x2.0

    if (staff.includes('h_synergy')) {
        const totalBuildings = Object.values(game.buildings).reduce((a, b) => a + b, 0);
        total *= (1 + (totalBuildings * 0.01)); // IA Mente Enlazada
    }

    // --- SINERGIAS DE EQUIPO (Solo activas si están en los slots) ---
    if (staff.includes('h_miner') && staff.includes('h_efficiency')) total *= 1.15; 
    if (staff.includes('h_synergy') && staff.includes('h_master')) {
        const totalBuildings = Object.values(game.buildings).reduce((a, b) => a + b, 0);
        total *= (1 + (totalBuildings * 0.02)); 
    }

    // 4. CADENA OMEGA, LOGROS Y MEJORAS
    if (game.upgrades.includes('protocol-omega')) total *= 1.2;
    if (game.upgrades.includes('omega-final')) total *= 5.0;
    if (game.achievements && game.achievements.length > 0) {
        total *= (1 + (game.achievements.length * 0.01));
    }

    // 5. MULTIPLICADORES TEMPORALES
    if (isOvercharged) total *= 5;
    if (game.activePearl === 'red') total *= 10;

    return total * buffMultiplier;
}





function getNetCPS() {
    const grossCPS = getCPS();
    const helperCost = getHelpersCost();
    return Math.max(0, grossCPS - helperCost);
}

function getHelpersCost() {
    let totalCost = 0;
    
    // 1. Ahora usamos 'game.helpers' directamente (los 4 slots de trabajo)
    const staff = game.helpers || []; 
    
    staff.forEach(id => {
        const h = helpersConfig.find(x => x.id === id);
        if (h) {
            let cost = h.cost;
            // Aplicar Plan de Pensiones Galáctico (-10%) si está comprado
            if (game.heavenlyUpgrades.includes('pension_plan')) {
                cost *= 0.9;
            }
            totalCost += cost;
        }
    });

    // 2. Aplicar Sinergia Ciclo Cerrado (Marcus + Sarah activos)
    if (staff.includes('h_miner') && staff.includes('h_efficiency')) {
        totalCost *= 0.5; 
    } 
    // 3. Descuento individual de la Dra. Sarah Joule (Sarah activa)
    else if (staff.includes('h_efficiency')) {
        totalCost *= 0.6; 
    }

    return totalCost;
}


function getCost(id) {
    const item = buildingsConfig.find(u => u.id === id);
    const currentAmount = game.buildings[id] || 0;

    // Calculamos el coste base
    let cost = Math.floor(item.baseCost * Math.pow(1.15, currentAmount));

    // Aplicar descuento de perla verde
    if (game.activePearl === 'green') cost *= 0.5;

    // MEJORA: Arquitectura Cuántica (-5% coste)
    if (game.heavenlyUpgrades.includes('cheaper_builds')) cost *= 0.95;

    return cost;
}

function recalculateStats() {
    buildingsConfig.forEach(b => b.currentPower = b.basePower);
    game.upgrades.forEach(uid => {
        const [bid] = uid.split('-');
        const b = buildingsConfig.find(i => i.id === bid);
        if (b) b.currentPower *= 2;
    });
    updateCoreAppearance();
}

// ==========================================
// EVOLUCIÓN VISUAL DEL NÚCLEO 3D
// ==========================================
let currentCoreTier = -1;
let orbitalRing = null;

// Tiers basados en edificios desbloqueados (de menor a mayor)
const coreTiers = [
    { // Tier 0: Inicio — Icosaedro básico
        check: () => true,
        geometry: () => new THREE.IcosahedronGeometry(1.8, 1),
        wireGeo: () => new THREE.IcosahedronGeometry(2.0, 1),
        scale: 1.0, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.9,
        ring: false
    },
    { // Tier 1: Panel Solar — Más detalle, ligeramente mayor
        check: () => (game.buildings['farm'] || 0) >= 1,
        geometry: () => new THREE.IcosahedronGeometry(1.9, 2),
        wireGeo: () => new THREE.IcosahedronGeometry(2.1, 2),
        scale: 1.05, emissiveIntensity: 0.8, roughness: 0.18, metalness: 0.92,
        ring: false
    },
    { // Tier 2: Turbina Eólica — Dodecaedro
        check: () => (game.buildings['mine'] || 0) >= 1,
        geometry: () => new THREE.DodecahedronGeometry(1.9, 1),
        wireGeo: () => new THREE.DodecahedronGeometry(2.1, 1),
        scale: 1.1, emissiveIntensity: 1.0, roughness: 0.15, metalness: 0.93,
        ring: false
    },
    { // Tier 3: Central Hidroeléctrica — Octaedro suavizado
        check: () => (game.buildings['factory'] || 0) >= 1,
        geometry: () => new THREE.OctahedronGeometry(2.0, 2),
        wireGeo: () => new THREE.OctahedronGeometry(2.2, 2),
        scale: 1.15, emissiveIntensity: 1.2, roughness: 0.12, metalness: 0.95,
        ring: false
    },
    { // Tier 4: Reactor Nuclear — Icosaedro alto detalle
        check: () => (game.buildings['bank'] || 0) >= 1,
        geometry: () => new THREE.IcosahedronGeometry(2.0, 3),
        wireGeo: () => new THREE.IcosahedronGeometry(2.2, 2),
        scale: 1.2, emissiveIntensity: 1.5, roughness: 0.1, metalness: 0.96,
        ring: false
    },
    { // Tier 5: Reactor de Fusión — Esfera casi perfecta
        check: () => (game.buildings['temple'] || 0) >= 1,
        geometry: () => new THREE.IcosahedronGeometry(2.0, 4),
        wireGeo: () => new THREE.IcosahedronGeometry(2.3, 3),
        scale: 1.25, emissiveIntensity: 2.0, roughness: 0.05, metalness: 0.98,
        ring: false
    },
    { // Tier 6: Matriz Dyson — Esfera perfecta + anillo orbital
        check: () => (game.buildings['portal'] || 0) >= 1,
        geometry: () => new THREE.SphereGeometry(2.0, 32, 32),
        wireGeo: () => new THREE.SphereGeometry(2.3, 16, 16),
        scale: 1.3, emissiveIntensity: 2.5, roughness: 0.02, metalness: 1.0,
        ring: true
    },
    { // Tier 7: Andrómeda — Esfera HD + anillo + máximo brillo
        check: () => (game.buildings['andromeda_siphon'] || 0) >= 1,
        geometry: () => new THREE.SphereGeometry(2.2, 48, 48),
        wireGeo: () => new THREE.SphereGeometry(2.5, 24, 24),
        scale: 1.4, emissiveIntensity: 3.0, roughness: 0.01, metalness: 1.0,
        ring: true
    }
];

function updateCoreAppearance() {
    if (!mainObject || !glowMesh || !scene) return;

    // Determinar tier actual (el más alto que cumple la condición)
    let newTier = 0;
    for (let i = coreTiers.length - 1; i >= 0; i--) {
        if (coreTiers[i].check()) { newTier = i; break; }
    }

    // Si no cambió el tier, no hacer nada (evitar rebuilds innecesarios)
    if (newTier === currentCoreTier) return;

    const tier = coreTiers[newTier];
    const oldTier = currentCoreTier;
    currentCoreTier = newTier;

    console.log(`⚛️ Núcleo evolucionando: Tier ${oldTier} → Tier ${newTier}`);

    // --- Cambiar geometría del núcleo principal ---
    const oldGeo = mainObject.geometry;
    mainObject.geometry = tier.geometry();
    oldGeo.dispose();

    // --- Cambiar geometría del wireframe/glow ---
    const oldWireGeo = glowMesh.geometry;
    glowMesh.geometry = tier.wireGeo();
    oldWireGeo.dispose();

    // --- Propiedades del material ---
    mainObject.material.roughness = tier.roughness;
    mainObject.material.metalness = tier.metalness;
    mainObject.material.emissiveIntensity = tier.emissiveIntensity;

    // --- Anillo orbital ---
    if (tier.ring && !orbitalRing) {
        const ringGeo = new THREE.TorusGeometry(3.2, 0.06, 16, 100);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x7c4dff, transparent: true, opacity: 0.4
        });
        orbitalRing = new THREE.Mesh(ringGeo, ringMat);
        orbitalRing.rotation.x = Math.PI / 3;
        scene.add(orbitalRing);
    } else if (!tier.ring && orbitalRing) {
        scene.remove(orbitalRing);
        orbitalRing.geometry.dispose();
        orbitalRing.material.dispose();
        orbitalRing = null;
    }

    // Notificar al jugador (solo después del tier 0 = inicio)
    if (oldTier >= 0 && newTier > oldTier) {
        const tierNames = [
            'Generador Básico', 'Condensador Solar', 'Dinamo Eólica',
            'Núcleo Hidrodinámico', 'Reactor Atómico', 'Estrella de Fusión',
            'Esfera Dyson', 'Singularidad de Andrómeda'
        ];
        if (typeof showNotification === 'function') {
            showNotification('⚛️ NÚCLEO EVOLUCIONADO', `Forma: ${tierNames[newTier]}`);
        }
    }
}

// ==========================================
// ⚙️ SISTEMA DE COMPRA DE MEJORAS (CORREGIDO)
// ==========================================

// 1. Diccionario de advertencias para la cadena Omega
// 1. Diccionario de advertencias (Lore de Protocolo Omega)
const omegaWarnings = {
    'protocol-omega': "⚠️ Detectada fluctuación térmica inusual en el núcleo. ¿Continuar?",
    'omega-phase-2': "🔉 Los técnicos informan de voces en la estática. Detente ahora.",
    'omega-phase-3': "🌀 ADVERTENCIA: Integridad estructural al 60%. ¡RETROCEDE!",
    'omega-phase-4': "🚨 ¡PELIGRO! El núcleo está drenando energía de dimensiones adyacentes.",
    'omega-final': "👁️ El Protocolo Omega está a punto de concluir. Esto cambiará tu universo para siempre. ¿Proceder?"
};

// 2. Función para comprar estructuras
window.buyBuilding = function (id) {
    const cost = getCost(id);

    if (game.cookies >= cost) {
        sfxBuy();
        game.cookies -= cost;

        if (!game.buildings[id]) game.buildings[id] = 0;
        game.buildings[id]++;

        // Actualizar todo el sistema
        recalculateStats();
        renderStore();
        renderHelpers();
        updateUI();
    }
};

// 3. LA PIEZA QUE TE FALTABA: Función principal de mejoras
window.buyUpgrade = function (upgradeId, cost) {
    if (game.cookies < cost) {
        return;
    }

    // Si la mejora es "Omega", pedimos confirmación con el mensaje del diccionario
    if (omegaWarnings[upgradeId]) {
        showSystemModal(
            "ADVERTENCIA DE SEGURIDAD",
            omegaWarnings[upgradeId],
            true, // isConfirm: activa el botón Cancelar
            () => executeUpgradePurchase(upgradeId, cost) // Si acepta, ejecuta
        );
    } else {
        // Si es una mejora normal, compra directa
        executeUpgradePurchase(upgradeId, cost);
    }
};

// 4. Función interna que realiza la transacción física
function executeUpgradePurchase(upgradeId, cost) {
    sfxBuy();
    game.cookies -= cost;
    if (!game.upgrades.includes(upgradeId)) {
        game.upgrades.push(upgradeId);
    }

    // --- NUEVA LÓGICA DE ANIMACIÓN PROGRESIVA ---
    if (upgradeId === 'omega-final') {
        // La gran escena final que ya tenemos
        triggerOmegaFinalAnimation();
    }
    else if (upgradeId.includes('omega') || upgradeId === 'protocol-omega') {
        // Para las fases 1, 2, 3 y 4 disparar el micro-glitch
        triggerOmegaMinorGlitch();

        // Además, forzamos un recalcular para que el 3D 
        // empiece a vibrar permanentemente (gracias a lo que añadimos en update3D)
        recalculateStats();
        renderStore();
        updateUI();
    }
    else {
        // Comportamiento normal para otras mejoras
        recalculateStats();
        renderStore();
        updateUI();
    }

    saveGame();
}


// --- MISIÓN PERLA VERDE: SINCRONIZACIÓN DE ÉLITE ---
function checkGreenPearlMission() {
    // 1. Si ya la tienes, no hacemos nada
    if (game.pearls.includes('green')) return;

    // 2. Identificamos cuáles son los últimos 4 ayudantes de la lista
    // (Usamos .slice(-4) para coger los 4 del final del array de configuración)
    const last4Helpers = helpersConfig.slice(-4);

    // 3. Comprobamos si tienes los 4 ACTIVOS (equipados) al mismo tiempo
    // .every() devuelve true solo si TODOS cumplen la condición
    const allEquipped = last4Helpers.every(helper => game.helpers.includes(helper.id));

    // 4. Si están los 4 puestos... ¡PREMIO!
    if (allEquipped) {
        unlockPearl('green');

        showSystemModal(
            "🟢 ECOSISTEMA PERFECTO",
            "Has logrado estabilizar a los 4 entes más poderosos de la corporación al mismo tiempo.\n\nLa vida fluye a través de la estructura.\nHas obtenido la PERLA DE LA VIDA.",
            false, null
        );
    }
}



// --- TIENDA // GALACTICOINS ---






window.renderInventory = function() {
    const grid = document.getElementById('inventory-grid');
    const usage = document.getElementById('inv-usage');
    const modalGC = document.getElementById('gc-modal-amount');
    
    if (!grid) return;
    grid.innerHTML = '';
    
    usage.innerText = (game.inventory || []).length;
    modalGC.innerText = formatNumber(game.galacticoins || 0);

    for (let i = 0; i < 30; i++) {
        const slot = document.createElement('div');
        const item = game.inventory ? game.inventory[i] : null;
        
        if (item) {
            slot.className = `inv-slot-mini rarity-${item.rarity}`;
            slot.innerHTML = getIconForItem(item.rarity);
            
            // ELIMINADO: slot.onclick (Ya no hace nada al pulsar)
            // Solo dejamos efectos visuales de hover
            slot.style.cursor = "default"; 

            // Gestión del Tooltip mejorada
            slot.onmouseenter = (e) => {
                showTooltip(e, item.name, `Valor: ${item.value} GC`, `Rareza: ${item.rarity.toUpperCase()}`, true);
            };
            slot.onmouseleave = () => {
                hideTooltip();
            };
            slot.onmousemove = (e) => moveTooltip(e);
        } else {
            slot.className = 'inv-slot-mini empty';
        }
        grid.appendChild(slot);
    }
};

function getIconForItem(rarity) {
    if (rarity === 'mitico') return '💎';
    if (rarity === 'legendario') return '👑';
    if (rarity === 'epico') return '🔮';
    if (rarity === 'raro') return '🧪';
    if (rarity === 'poco_comun') return '🔋';
    return '📦';
}

function tryDropItem(sourceName, dropChance) {
    // 1. Tirada inicial para ver si hay drop (30% anomalía, 100% alien)
    const luckRoll = Math.random() * 100;
    if (luckRoll > dropChance) return;

    // 2. Comprobar espacio en mochila
    if ((game.inventory || []).length >= 30) {
        showNotification("🎒 INVENTARIO LLENO", "No hay espacio para más botín.", "#ff5252");
        return;
    }

    // 3. Sistema de Suerte (Gambito Zero)
    // Si tienes al operador h_luck, la probabilidad de items raros se duplica
    const luckFactor = game.helpers.includes('h_luck') ? 2 : 1;

    // 4. Tirada de Rareza (Sobre 100%)
    const rarityRoll = Math.random() * 100;
    let rarity = 'comun';

    // Aplicamos tus porcentajes con el multiplicador de Gambito
    if (rarityRoll < (1 * luckFactor)) rarity = 'mitico';           // 1% (base)
    else if (rarityRoll < (4 * luckFactor)) rarity = 'legendario';  // 3% (base)
    else if (rarityRoll < (11 * luckFactor)) rarity = 'epico';      // 7% (base)
    else if (rarityRoll < 26) rarity = 'raro';                      // 15%
    else if (rarityRoll < 55) rarity = 'poco_comun';                // 29%
    else rarity = 'comun';                                          // 45%

    // 5. Crear el objeto
    const possibleNames = itemNames[rarity] || [`Fragmento de ${sourceName}`];
    const selectedName = possibleNames[Math.floor(Math.random() * possibleNames.length)];

    const newItem = {
        id: Date.now() + Math.random(),
        rarity: rarity,
        name: selectedName,
        value: itemRarezas[rarity].price
    };

    // 6. Guardado y Notificación
    if (!game.inventory) game.inventory = [];
    game.inventory.push(newItem);

    showNotification(
        "📦 OBJETO ENCONTRADO", 
        `${selectedName} (${itemRarezas[rarity].label})`, 
        itemRarezas[rarity].color
    );

    // Actualizar visualmente si la mochila está abierta
    if (document.getElementById('modal-inventory').style.display === 'flex') {
        renderInventory();
    }

    saveGame();
}









window.toggleInventory = function() {
    const modal = document.getElementById('modal-inventory');
    
    // Forzamos que el tooltip desaparezca al abrir/cerrar para evitar fantasmas
    if (typeof hideTooltip === 'function') hideTooltip();

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        renderInventory();
        modal.style.display = 'flex';
        if (typeof sfxClick === 'function') sfxClick();
    }
};

window.sellItem = function(itemId) {
    const idx = game.inventory.findIndex(i => i.id == itemId);
    if (idx > -1) {
        const item = game.inventory[idx];
        
        // --- NUEVO: Bonificación de Recio Miller ---
        const sellMultiplier = game.helpers.includes('h_scavenger') ? 1.25 : 1;
        const finalValue = Math.floor(item.value * sellMultiplier);
        
        game.galacticoins += finalValue;
        game.inventory.splice(idx, 1);
        
        hideTooltip(); 
        if (typeof sfxBuy === 'function') sfxBuy();
        renderInventory();
        updateUI();
    }
};

window.sellAllTrash = function() {
    const trash = game.inventory.filter(i => i.rarity === 'comun' || i.rarity === 'poco_comun');
    if (trash.length === 0) return;

    trash.forEach(item => {
        game.galacticoins += item.value;
        const idx = game.inventory.indexOf(item);
        game.inventory.splice(idx, 1);
    });

    if (typeof sfxBuy === 'function') sfxBuy();
    renderInventory();
    updateUI();
    saveGame();
};


// Sonido de asignación (Slot ocupado) - Tono ascendente
function sfxAssignHelper() {
    playTone(600, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(900, 'sine', 0.1, 0.1), 50);
}

// Sonido de retiro (Slot liberado) - Tono descendente
function sfxRemoveHelper() {
    playTone(400, 'triangle', 0.1, 0.1);
    setTimeout(() => playTone(250, 'triangle', 0.1, 0.1), 50);
}


window.toggleHelper = function (helperId) {
    const helper = helpersConfig.find(h => h.id === helperId);
    if (!helper) return;

    // 1. REGLA DE NIVEL (Sincronizada con game.level)
    const playerLevel = game.level || 1; 
    
    if (playerLevel < helper.reqLevel) {
        showNotification("🔒 NIVEL BAJO", `Necesitas ser Nivel ${helper.reqLevel} para este operador.`);
        return;
    }

    // Inicialización de seguridad
    if (!game.helpers) game.helpers = [];
    const isActive = game.helpers.includes(helperId);

    if (isActive) {
        // --- DESPEDIR OPERADOR ---
        game.helpers = game.helpers.filter(id => id !== helperId);
        sfxRemoveHelper();
        showNotification("❌ DESPEDIDO", `${helper.name} ha dejado su puesto.`);
    } else {
        // --- CONTRATAR OPERADOR ---
        if (game.helpers.length >= MAX_HELPERS) {
            playTone(150, 'sawtooth', 0.2, 0.1);
            showSystemModal("NAVE LLENA", `Solo tienes ${MAX_HELPERS} slots.`, false);
            return;
        }

        const currentNetWps = getCPS() - getHelpersCost();
        let actualCost = helper.cost;
        if (game.heavenlyUpgrades.includes('pension_plan')) actualCost *= 0.9;

        if (currentNetWps < actualCost) {
            showSystemModal("ENERGÍA INSUFICIENTE", `Generación libre: ${formatNumber(currentNetWps)}/s\nRequerido: ${formatNumber(actualCost)}/s`, false);
            return;
        }

        game.helpers.push(helperId);
        sfxAssignHelper();
        showNotification("✅ CONTRATADO", `${helper.name} está operando.`);
        checkGreenPearlMission();
    }

    renderHelpers();
    updateUI();
    recalculateStats();
    saveGame();
};



function epicBluePearlScene() {
    console.log("Escena épica de la Perla Azul activada");

    // 1. Bloqueo y Estética
    isIntroActive = true;
    if (!safeSettings.noGlitch) document.body.classList.add('blue-glitch');

    // Sonido inicial
    if (!safeSettings.noShake) {
        playTone(1200, 'sine', 0.5, 0.2);
        setTimeout(() => playTone(1800, 'sine', 0.5, 0.2), 200);
    } else {
        playTone(800, 'sine', 0.3, 0.1);
    }

    // 2. Partículas (reducidas en modo seguro)
    const particleCount = safeSettings.noParticles ? 30 : 300;
    for (let i = 0; i < particleCount; i++) {
        const mesh = new THREE.Mesh(
            particleGeo,
            new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true })
        );
        mesh.position.copy(mainObject.position);
        mesh.userData.vel = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(Math.random() * 0.8 + 0.3);
        scene.add(mesh);
        particles.push(mesh);
    }

    // 3. BUCLE DE ANIMACIÓN
    const startTime = Date.now();
    const duration = safeSettings.noShake ? 2000 : 5000;

    const blueInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        if (progress >= 1) {
            clearInterval(blueInterval);
            finishBlueScene();
            return;
        }

        // --- DISTORSIÓN THREE.JS ---
        if (mainObject && glowMesh) {
            if (safeSettings.noShake) {
                // Modo seguro: escala suave sin vibración
                mainObject.scale.setScalar(1 + progress * 0.3);
                mainObject.material.color.lerp(new THREE.Color(0x00e5ff), 0.05);
                glowMesh.scale.setScalar(1.2 + progress * 0.5);
            } else {
                const pulse = 1 + Math.sin(Date.now() * 0.05) * (0.2 * progress);
                mainObject.scale.setScalar(pulse);
                mainObject.material.color.lerp(new THREE.Color(0x00e5ff), 0.1);
                mainObject.material.emissive.lerp(new THREE.Color(0x003366), 0.1);
                glowMesh.rotation.y += 0.5 * progress;
                glowMesh.rotation.z += 0.2;
                glowMesh.scale.setScalar(pulse * 1.4);
            }
        }

        // --- CÁMARA (solo modo normal) ---
        if (!safeSettings.noShake) {
            camera.position.z = 8 - (Math.sin(progress * Math.PI) * 3);
            camera.fov = 50 + (progress * 30);
            camera.updateProjectionMatrix();
        }

    }, 1000 / 60);
}

function finishBlueScene() {
    // 1. Flash blanco-azulado
    const flash = document.createElement('div');
    flash.className = 'flash-bang';
    flash.style.background = 'white';
    document.body.appendChild(flash);

    // 2. Restaurar todo
    document.body.classList.remove('blue-glitch');
    isIntroActive = false;
    camera.position.set(0, 0, 8);
    camera.fov = 50;
    camera.updateProjectionMatrix();

    if (mainObject && mainObject.material) {
        mainObject.material.color.setHex(0x00ff88);
        mainObject.material.emissive.setHex(0x004422);
        mainObject.scale.setScalar(1);
    }

    // 3. Mensaje final y limpieza
    setTimeout(() => {
        flash.remove();
        showSystemModal(
            "🔵 SINGULARIDAD TEMPORAL",
            "Has alcanzado el límite de la persistencia cinética.\nEl tiempo se ha condensado en una Perla Azul.",
            false, null
        );
    }, 1000);
}



// Variable global para controlar el temporizador alienígena
let alienLoopTimeout = null;

function startAlienLoop() {
    if (alienLoopTimeout) clearTimeout(alienLoopTimeout);

    let minTime = 90000; 
    let maxTime = 150000;

    if (game.heavenlyUpgrades.includes('abduction_tech')) {
        minTime = 45000;
        maxTime = 75000;
    }

    const randomDelay = Math.floor(Math.random() * (maxTime - minTime + 1) + minTime);

    alienLoopTimeout = setTimeout(() => {
        // 🔥 CAMBIO: Solo spawnea si tiene la mejora, pero SIEMPRE reinicia el ciclo
        if (game.heavenlyUpgrades.includes('alien_contact')) {
            spawnAlien();
        }
        startAlienLoop(); 
    }, randomDelay);
}


// Función que se ejecuta al hacer click en la esfera central
function onObjectClick() {
    // --- 1. CONTAR EL CLICK ---
    game.totalClicks++;
    if (game.totalClicks >= 10000 && !game.pearls.includes('blue')) {
        unlockPearl('blue');
        showSystemModal(
            "🔵 HITO ALCANZADO",
            "10,000 Clicks. La persistencia ha fracturado el tiempo. ¡Has desbloqueado la Perla del Cronos (Clicks x50)!",
            false,
            null
        );
        epicBluePearlScene(); // <-- Llama aquí a la escena épica
    }
}



// Sistema de mensajes aleatorios del Staff
function startStaffMessages() {
    setInterval(() => {
        // 1. Filtrar solo los ayudantes que el jugador ya ha comprado
        const activeHelpers = helpersConfig.filter(h => game.helpers.includes(h.id));

        if (activeHelpers.length > 0) {
            // 2. Elegir uno al azar
            const randomHelper = activeHelpers[Math.floor(Math.random() * activeHelpers.length)];

            // 3. Elegir una de sus dos frases al azar
            const randomQuote = randomHelper.quotes[Math.floor(Math.random() * randomHelper.quotes.length)];

            // 4. Mostrarlo en la interfaz con un efecto de escritura o fade
            const feedEl = document.getElementById('staff-feed');
            if (feedEl) {
                feedEl.style.opacity = 0; // Efecto fade out

                setTimeout(() => {
                    feedEl.innerHTML = `<strong>${randomHelper.name}:</strong> "${randomQuote}"`;
                    feedEl.style.opacity = 1; // Efecto fade in
                }, 500);
            }
        }
    }, 15000); // Aparece un mensaje cada 15 segundos (puedes ajustarlo)
}

// No olvides llamar a esta función cuando inicies el juego
startStaffMessages();


window.renderHelpers = function() {
    const container = document.getElementById('helpers-list');
    if (!container) return;

    container.innerHTML = '';
    const currentStaff = game.helpers || [];
    const playerLevel = game.level || 1;

    // --- 1. CABECERA DE SLOTS ---
    const header = document.createElement('div');
    const slotsColor = currentStaff.length >= MAX_HELPERS ? '#ff5252' : '#00ff88';
    header.style.cssText = "padding: 10px; margin-bottom: 5px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;";
    header.innerHTML = `
        <div style="display:flex; flex-direction:column">
            <span style="color:#aaa; font-size:0.6rem; text-transform:uppercase;">Fuerza Operativa</span>
            <span style="color:#fff; font-size:0.85rem; font-weight:bold;">SISTEMA DE SLOTS</span>
        </div>
        <span style="color: ${slotsColor}; font-weight: bold; font-size: 1.1rem;">
            ${currentStaff.length} / ${MAX_HELPERS}
        </span>
    `;
    container.appendChild(header);

    // --- 2. ÁRBOL DE MINIATURAS (Referencia rápida arriba) ---
    const treeContainer = document.createElement('div');
    treeContainer.style.cssText = "display: flex; flex-wrap: wrap; gap: 6px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 15px; border: 1px solid #222;";
    
    helpersConfig.forEach(helper => {
        const isHired = currentStaff.includes(helper.id);
        const isLocked = playerLevel < helper.reqLevel;
        const dot = document.createElement('div');
        dot.style.cssText = `
            width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
            font-size: 1.1rem; border: 1px solid ${isHired ? 'var(--accent)' : '#333'};
            background: ${isLocked ? '#111' : (isHired ? 'rgba(0,255,136,0.1)' : '#222')};
            opacity: ${isLocked ? '0.3' : '1'}; position: relative;
        `;
        dot.innerHTML = isLocked ? '?' : helper.icon;
        treeContainer.appendChild(dot);
    });
    container.appendChild(treeContainer);

    // --- 3. LISTA DETALLADA (EL FILTRO REAL) ---
    
    // Usamos un bucle "for...of" porque permite usar la instrucción "break"
    // para detener el renderizado por completo.
    for (const helper of helpersConfig) {
        const isActive = currentStaff.includes(helper.id);
        const isLocked = playerLevel < helper.reqLevel;

        if (isLocked) {
            // Este es el PRÓXIMO OBJETIVO
            const div = document.createElement('div');
            div.className = 'helper-item locked';
            div.style.cssText = "pointer-events: none; filter: grayscale(1) opacity(0.7); cursor: default;";
            
            div.innerHTML = `
                <div class="helper-icon">🔒</div>
                <div class="helper-info">
                    <h4 style="color: #666">PRÓXIMO OBJETIVO</h4>
                    <p style="font-size:0.7rem; color:#444">Sigue operando para desbloquear este contacto.</p>
                    <div style="font-family:monospace; font-size:0.65rem; margin-top:4px; color:#ff5252; font-weight:bold;">
                        REQUISITO: NIVEL ${helper.reqLevel}
                    </div>
                </div>
                <div class="helper-toggle">🔒</div>
            `;
            container.appendChild(div);

            // 🛑 ¡ESTA ES LA CLAVE! 
            // Al encontrar el primer bloqueado, lo dibujamos y salimos del bucle.
            // No se procesará ningún operador más (ni nivel 30, ni 50, ni 100).
            break; 

        } else {
            // OPERADOR DESBLOQUEADO (Se muestra normal)
            const div = document.createElement('div');
            div.className = `helper-item ${isActive ? 'active' : ''}`;
            div.style.cursor = "pointer";
            div.onmousedown = (e) => { e.preventDefault(); toggleHelper(helper.id); };

            let statusText = isActive ? "⚡ EN LÍNEA" : `Sueldo: ${formatNumber(helper.cost)}/s`;
            
            div.innerHTML = `
                <div class="helper-icon">${helper.icon}</div>
                <div class="helper-info">
                    <h4 style="color: #fff">${helper.name}</h4>
                    <p style="font-size:0.7rem; color:#bbb">${helper.desc}</p>
                    <div style="font-family:monospace; font-size:0.65rem; margin-top:4px; color:var(--accent); font-weight:bold;">
                        ${statusText}
                    </div>
                </div>
                <div class="helper-toggle ${isActive ? 'active' : ''}">${isActive ? '❌' : '➕'}</div>
            `;
            container.appendChild(div);
        }
    }
};





// --- BUCLE PRINCIPAL ---
let lastTime = Date.now();

// Asegúrate de tener estas variables definidas antes del gameLoop en tu archivo
// let lastTime = Date.now(); 

let uiUpdateTimer = 0; // Temporizador para controlar el refresco visual

function gameLoop() {
    requestAnimationFrame(gameLoop);

    const now = Date.now();
    const dt = (now - (lastTime || now)) / 1000;
    lastTime = now;

    // --- 1. LÓGICA DE PRODUCCIÓN PASIVA (60 FPS) ---
    // La matemática debe ser precisa, por lo que se queda fuera de los timers
    const netCPS = typeof getNetCPS === 'function' ? getNetCPS() : 0;
    if (netCPS > 0) {
        const gained = netCPS * dt;
        game.cookies += gained;
        game.totalCookiesEarned += gained;
    }

    // --- 2. LÓGICA DE COMBO (60 FPS) ---
    if (typeof comboTimer !== 'undefined' && comboTimer > 0) {
        comboTimer -= dt;
    } else if (typeof comboMultiplier !== 'undefined' && comboMultiplier > 1.0) {
        comboMultiplier -= dt * 2;
        if (comboMultiplier < 1.0) comboMultiplier = 1.0;
    }

    // --- 3. ACTUALIZACIÓN DE MOTOR 3D (60 FPS) ---
    // Three.js necesita correr suave para evitar saltos visuales
    if (typeof update3D === 'function') update3D();

    // --- 4. OPTIMIZACIÓN DE INTERFAZ (10 FPS) ---
    // Solo actualizamos el DOM cada 0.1 segundos. Ahorra un 80% de CPU.
    uiUpdateTimer += dt;
    if (uiUpdateTimer >= 0.1) {
        
        // Actualización de Watts, barra de nivel y multiplicadores
        if (typeof updateUI === 'function') updateUI();

        // Actualización de elementos de Combo
        const comboEl = document.getElementById('combo-display');
        if (comboEl && typeof comboMultiplier !== 'undefined') {
            if (comboMultiplier > 1.0) {
                comboEl.innerText = `COMBO x${comboMultiplier.toFixed(2)}`;
                comboEl.style.opacity = 1;
            } else {
                comboEl.style.opacity = 0;
            }
        }

        // Lógica de la barra de Buffs/Anomalías
        const barContainer = document.getElementById('buff-container');
        const barFill = document.getElementById('buff-bar');
        if (typeof buffEndTime !== 'undefined' && buffEndTime > now) {
            if (barContainer) barContainer.style.display = 'block';
            if (barFill) {
                const remaining = buffEndTime - now;
                const percentage = Math.max(0, (remaining / (buffDuration || 10000)) * 100);
                barFill.style.width = percentage + "%";
                barFill.style.backgroundColor = (typeof clickBuffMultiplier !== 'undefined' && clickBuffMultiplier > 1) ? '#00e5ff' : '#ffaa00';
            }
        } else if (barContainer) {
            barContainer.style.display = 'none';
        }

        // Tareas de tienda (Cada 0.1s es suficiente para habilitar/deshabilitar botones)
        if (typeof checkAvailability === 'function') checkAvailability();
        
        uiUpdateTimer = 0;
    }

    // --- 5. TAREAS PESADAS (CADA 1 SEGUNDO) ---
    // Usamos el residuo de 'now' para tareas que no necesitan ser instantáneas
    if (Math.floor(now / 1000) !== Math.floor((now - dt*1000) / 1000)) {
        if (typeof checkUnlocks === 'function') checkUnlocks();
        if (typeof checkAchievements === 'function') checkAchievements();
        if (typeof renderHelpers === 'function') renderHelpers(); // Evita re-dibujar la lista de staff 60 veces/seg
    }
}


function spawnMerchant() {
    // 1. ESCUDOS DE SEGURIDAD
    if (!game.heavenlyUpgrades.includes('andromeda_trade')) return;
    if (document.querySelector('.merchant-ship')) return; // No duplicar naves
    if (typeof isIntroActive !== 'undefined' && isIntroActive) return; // No molestar en la intro

    const ship = document.createElement('div');
    ship.innerHTML = '🛸';
    ship.className = 'merchant-ship';

    // Posición aleatoria en el eje Y para que no salga siempre en el mismo sitio
    const randomTop = Math.random() * 60 + 10;

    ship.style.cssText = `
        position: absolute; 
        top: ${randomTop}%; 
        left: -100px; 
        font-size: 3.5rem; 
        cursor: pointer; 
        z-index: 5000; 
        transition: left 20s linear; /* Un poco más lenta para dar tiempo a clicar */
        filter: drop-shadow(0 0 20px #b388ff);
        user-select: none;
    `;

    const gameArea = document.getElementById('game-area');
    if (!gameArea) return;
    gameArea.appendChild(ship);

    // Sonido de aviso (si lo tienes implementado) o notificación discreta
    console.log("🛸 Un comerciante de Andrómeda ha entrado en el sector.");
    if (typeof sfxAnomaly === 'function') sfxAnomaly();

    // Iniciamos el movimiento
    setTimeout(() => {
        ship.style.left = '110%';
    }, 100);

    // CLICK EN LA NAVE
    ship.onclick = (e) => {
        e.stopPropagation(); // Evita clics accidentales en el fondo

        // Efecto visual al capturarla
        createFloatingText(e.clientX, e.clientY, "¡CONTACTO ESTABLECIDO!");

        if (typeof openMerchantMenu === 'function') {
            openMerchantMenu();
        } else {
            console.error("Error: openMerchantMenu no está definida.");
        }

        ship.remove();
    };

    // Auto-destrucción si sale de la pantalla
    setTimeout(() => {
        if (ship.parentNode) ship.remove();
    }, 21000);
}

function openMerchantMenu() {
    // 1. Seleccionar una estructura de Andrómeda al azar
    const availableBuildings = buildingsConfig.filter(b => b.isAndromeda);
    const offer = availableBuildings[Math.floor(Math.random() * availableBuildings.length)];

    // 2. Cálculo del precio inicial
    const currentCount = game.buildings[offer.id] || 0;
    let currentPrice = Math.floor(offer.baseCost * Math.pow(1.15, currentCount));

    // 3. Crear el contenedor del menú (Overlay)
    const overlay = document.createElement('div');
    overlay.id = 'merchant-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(5px); font-family: 'Courier New', monospace;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: #0a0514; border: 2px solid #b388ff; padding: 30px;
        border-radius: 15px; text-align: center; color: white;
        box-shadow: 0 0 50px rgba(179, 136, 255, 0.3); max-width: 450px;
        position: relative; animation: modalIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    `;

    content.innerHTML = `
        <h2 style="color: #b388ff; text-shadow: 0 0 10px #b388ff; margin-top: 0;">📡 MERCADO NEGRO DE ANDRÓMEDA</h2>
        <p style="font-size: 0.9rem; color: #aaa; font-style: italic;">"Tengo algo que hará que tu red cuántica parezca un juguete..."</p>
        
        <div style="background: rgba(179, 136, 255, 0.1); padding: 15px; border-radius: 10px; margin: 20px 0; border: 1px solid rgba(179, 136, 255, 0.2);">
            <div id="merchant-icon" style="font-size: 3.5rem; margin-bottom: 10px; transition: transform 0.2s;">${offer.icon}</div>
            <h3 style="margin: 0; letter-spacing: 1px;">${offer.name}</h3>
            <p style="font-size: 0.8rem; margin: 8px 0 15px 0; color: #bbb; line-height: 1.4;">${offer.desc}</p>
            <div id="merchant-price-display" style="font-size: 1.4rem; color: #00ff88; font-weight: bold; text-shadow: 0 0 10px rgba(0,255,136,0.3);">
                ⚡ ${formatNumber(currentPrice)} Watts
            </div>
        </div>

        <div id="merchant-actions" style="display: flex; flex-direction: column; gap: 12px;">
            <button id="btn-buy-merchant" style="background: #00ff88; color: black; border: none; padding: 14px; cursor: pointer; font-weight: bold; border-radius: 5px; text-transform: uppercase; letter-spacing: 1px;">
                ADQUIRIR TECNOLOGÍA
            </button>
            
            <button id="btn-haggle-merchant" style="background: transparent; color: #b388ff; border: 1px solid #b388ff; padding: 10px; cursor: pointer; border-radius: 5px; font-weight: bold; transition: all 0.2s;">
                REGATEAR (Probabilidad basada en Nivel)
            </button>
            
            <button id="btn-decline-merchant" style="background: none; border: none; color: #666; cursor: pointer; font-size: 0.8rem; margin-top: 5px;">
                [ DECLINAR OFERTA ]
            </button>
        </div>
        <p id="merchant-msg" style="font-size: 0.8rem; color: #ffaa00; margin-top: 15px; min-height: 1.2em; font-weight: bold;"></p>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // --- VARIABLES DE ESTADO LOCAL ---
    let haggleAttempts = 0;

    // --- LÓGICA DE BOTONES ---

    // 1. Botón de Comprar
    document.getElementById('btn-buy-merchant').onclick = () => {
        if (game.cookies >= currentPrice) {
            game.cookies -= currentPrice;
            game.buildings[offer.id] = (game.buildings[offer.id] || 0) + 1;
            
            if (typeof sfxBuy === 'function') sfxBuy();
            showNotification("CONTRATO FIRMADO", `${offer.name} añadido a la flota.`, "#b388ff");
            
            overlay.remove();
            recalculateStats();
            updateUI();
        } else {
            const msg = document.getElementById('merchant-msg');
            msg.innerText = "❌ Energía insuficiente para la transacción.";
            msg.style.color = "#ff4444";
            msg.style.animation = "shake 0.3s ease";
            setTimeout(() => { msg.style.animation = ""; }, 300);
        }
    };

    // 2. Botón de Regatear
    document.getElementById('btn-haggle-merchant').onclick = function() {
        haggleAttempts++;
        const msg = document.getElementById('merchant-msg');
        const priceDisplay = document.getElementById('merchant-price-display');
        const icon = document.getElementById('merchant-icon');

        // Lógica de probabilidad: El nivel del jugador ayuda a que no baje tan rápido
        const levelBonus = (game.level || 1) * 0.005; 
        const successChance = (0.5 / haggleAttempts) + levelBonus;
        const roll = Math.random();

        if (roll < successChance) {
            // ✅ ÉXITO
            currentPrice = Math.floor(currentPrice * 0.8);
            priceDisplay.innerText = `⚡ ${formatNumber(currentPrice)} Watts`;
            priceDisplay.style.color = "#00ff88";
            
            msg.innerText = "✅ El comerciante cede. ¡Precio rebajado!";
            msg.style.color = "#00ff88";
            
            // Animación visual de éxito
            icon.style.transform = "scale(1.2) rotate(5deg)";
            setTimeout(() => { icon.style.transform = "scale(1)"; }, 200);
            
            priceDisplay.style.animation = "none";
            setTimeout(() => { priceDisplay.style.animation = "pulseGreen 0.5s ease"; }, 10);
        } else {
            // ❌ FRACASO: Fin de la negociación
            this.disabled = true;
            msg.innerText = "💢 ¡Suficiente! No toleraré más insultos.";
            msg.style.color = "#ff4444";
            
            document.getElementById('merchant-actions').innerHTML = `
                <div style="padding: 15px; border: 1px solid #ff4444; color: #ff4444; font-weight: bold; border-radius: 5px; background: rgba(255,0,0,0.1); text-transform: uppercase;">
                    Negociación Fallida
                </div>
            `;
            
            // Cerrar después de un momento
            setTimeout(() => {
                if (overlay && overlay.parentNode) {
                    overlay.style.opacity = "0";
                    overlay.style.transition = "opacity 0.5s ease";
                    setTimeout(() => overlay.remove(), 500);
                }
            }, 1500);
        }
    };

    // 3. Botón de Declinar
    document.getElementById('btn-decline-merchant').onclick = () => {
        overlay.remove();
    };
}

// Función para comprar desde el mercader
function buyAndromedaBuilding(id, price) {
    if (game.cookies >= price) {
        game.cookies -= price;
        game.buildings[id] = (game.buildings[id] || 0) + 1;
        document.getElementById('merchant-popup').remove();
        showNotification("SISTEMA", "Estructura alienígena asimilada.");
        updateUI();
    } else {
        alert("Energía insuficiente para este trato.");
    }
}

function startMerchantLoop() {
    // TEST: Aparecer entre 10 y 20 segundos
    const waitTime = 30000 + (Math.random() * 30000); 

    setTimeout(() => {
        // Asegúrate de que tienes la mejora 'andromeda_trade' comprada en el Árbol Celestial
        if (game.heavenlyUpgrades.includes('andromeda_trade')) {
            spawnMerchant();
        } else {
            console.log("Comerciante bloqueado: Falta 'andromeda_trade'");
        }
        startMerchantLoop(); 
    }, waitTime);
}

// Llama a esta función una sola vez al cargar el juego




// --- UI ---
const scoreEl = document.getElementById('score');
const cpsEl = document.getElementById('cps-display');
const upgradesEl = document.getElementById('upgrades-panel');
const buildingsEl = document.getElementById('buildings-list');


function updateUI() {
    // 1. Actualización básica de energía (Watts)
    const currentCookies = Math.floor(game.cookies);
    scoreEl.innerText = formatNumber(currentCookies);

    // Título de la pestaña
    if (document.title !== `${formatNumber(currentCookies)} - Quantum Grid`) {
        document.title = `${formatNumber(currentCookies)} - Quantum Grid`;
    }

    // 2. Cálculo de producción neta
    const grossCPS = getCPS();
    const helperCost = getHelpersCost();
    const netCPS = getNetCPS();

    if (helperCost > 0) {
        const newCpsHTML = `${formatNumber(netCPS)} / s <span style="font-size: 0.75rem; color: #999; margin-left: 5px;">(Gen: ${formatNumber(grossCPS)} - Uso: ${formatNumber(helperCost)})</span>`;
        if (cpsEl.innerHTML !== newCpsHTML) {
            cpsEl.innerHTML = newCpsHTML;
        }
    } else {
        const newCpsText = `${formatNumber(grossCPS)} / s`;
        if (cpsEl.innerText !== newCpsText) {
            cpsEl.innerText = newCpsText;
        }
    }

    // --- 3. NUEVO SISTEMA DE RANGO DE COMANDANTE (EXP) ---
    const lvlText = document.getElementById('player-level-text');
    const lvlBar = document.getElementById('level-bar-fill');
    const lvlPercent = document.getElementById('level-percentage');

    if (lvlText && lvlBar) {
        // Usamos la fórmula de EXP: Nivel = sqrt(exp / 100) + 1
        const currentLevel = Math.floor(Math.sqrt(game.exp / 100)) + 1;
        
        // Hitos de EXP para el nivel actual y el siguiente
        const expForCurrent = Math.pow(currentLevel - 1, 2) * 100;
        const expForNext = Math.pow(currentLevel, 2) * 100;
        
        // Cálculo de porcentaje
        const progress = ((game.exp - expForCurrent) / (expForNext - expForCurrent)) * 100;
        
        // Actualización visual
        lvlText.innerText = `NIVEL ${currentLevel}`;
        lvlBar.style.width = `${Math.min(100, progress)}%`;
        if (lvlPercent) lvlPercent.innerText = `${Math.floor(Math.min(100, progress))}%`;
        
        // Sincronizar el nivel en el objeto global
        game.level = currentLevel;
    }

    // 4. Lógica del Botón de Ascensión (Prestigio)
    const pBtn = document.getElementById('btn-prestige');
    const PRESTIGE_BASE = 1000000;

    if (game.totalCookiesEarned >= PRESTIGE_BASE) {
        if (pBtn) {
            pBtn.style.display = 'block';
            const totalPotential = Math.floor(Math.cbrt(game.totalCookiesEarned / PRESTIGE_BASE));
            const currentPLevel = game.prestigeLevel || 0;
            const gain = totalPotential - currentPLevel;

        }
    } else if (pBtn) {
        pBtn.style.display = 'none';
    }

    // 5. HUD de Multiplicador de Prestigio
    const prestigeHud = document.getElementById('prestige-hud');
    const prestigeDisp = document.getElementById('prestige-display');
    if (game.prestigeMult > 1) {
        if (prestigeHud) prestigeHud.style.display = 'block';
        if (prestigeDisp) prestigeDisp.innerText = `x${game.prestigeMult.toFixed(1)}`;
    }

    // 6. RADAR DE COMERCIO DE ANDRÓMEDA
    let radarEl = document.getElementById('trade-signal');
    if (!radarEl) {
        radarEl = document.createElement('div');
        radarEl.id = 'trade-signal';
        radarEl.style.cssText = `
            position: absolute; top: 15px; right: 15px; 
            color: #b388ff; font-size: 0.8rem; font-family: monospace;
            border: 1px solid #b388ff; padding: 5px 10px; border-radius: 15px; 
            background: rgba(0,0,0,0.6); display: none; z-index: 100;
            box-shadow: 0 0 10px rgba(179, 136, 255, 0.2);
            pointer-events: none;
        `;
        radarEl.innerHTML = "📡 SEÑAL: ANDRÓMEDA";
        document.body.appendChild(radarEl);
    }

    if (game.heavenlyUpgrades.includes('andromeda_trade')) {
        radarEl.style.display = 'block';
        radarEl.style.opacity = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
    } else {
        radarEl.style.display = 'none';
    }

    // 7. SISTEMA DE ECONOMÍA GALÁCTICA
    const gcHUD = document.getElementById('galacticoins-hud');
    const gcAmount = document.getElementById('gc-amount');
    
    if (gcHUD && gcAmount) {
        if (game.galacticoins > 0 || game.totalCookiesEarned > 1000000) {
            gcHUD.style.display = 'block';
            gcAmount.innerText = formatNumber(game.galacticoins || 0);
        } else {
            gcHUD.style.display = 'none';
        }
    }

    // Sincronización del modal de Inventario
    const invModal = document.getElementById('modal-inventory');
    if (invModal && invModal.style.display === 'flex') {
        const modalGC = document.getElementById('gc-modal-amount');
        const usage = document.getElementById('inv-usage');
        if (modalGC) modalGC.innerText = formatNumber(game.galacticoins || 0);
        if (usage) usage.innerText = (game.inventory || []).length;
    }
}




function renderStore() {
    upgradesEl.innerHTML = '';
    buildingsEl.innerHTML = '';
    let anyUp = false;

    // 1. MEJORAS DE EDIFICIOS (MK-1, MK-2...)
    buildingsConfig.forEach(b => {
        // --- FILTRO: Los edificios de Andrómeda no tienen mejoras MK normales ---
        if (b.isAndromeda) return;

        const count = game.buildings[b.id] || 0;
        // Verificamos que milestones y upgradeIcons existan para evitar pantalla negra
        if (typeof milestones !== 'undefined' && typeof upgradeIcons !== 'undefined') {
            milestones.forEach((th, i) => {
                const uid = `${b.id}-${th}`;
                if (count >= th && !game.upgrades.includes(uid)) {
                    anyUp = true;
                    const cost = b.baseCost * 20 * (i + 1) * th;

                    const btn = document.createElement('div');
                    btn.className = 'upgrade-crate';
                    btn.innerHTML = upgradeIcons[i % upgradeIcons.length];
                    btn.dataset.cost = cost;
                    btn.setAttribute('data-tooltip', `${b.name} MK-${i + 1}\nx2 Producción\nCoste: ${formatNumber(cost)}`);

                    btn.onclick = () => window.buyUpgrade(uid, cost);
                    upgradesEl.appendChild(btn);
                }
            });
        }
    });

    // 2. LISTA DE MEJORAS ESPECIALES
    const specials = [
        // --- CADENA OMEGA ---
        { id: 'protocol-omega', name: 'Protocolo Omega', icon: '⚠️', cost: 5000000, desc: 'Inicia el experimento prohibido.\nProducción Global x1.2', req: () => game.totalCookiesEarned > 2000000 && !game.upgrades.includes('protocol-omega') },
        { id: 'omega-phase-2', name: 'Resonancia Oscura', icon: '🔉', cost: 25000000, desc: 'Producción Global x1.5', req: () => game.upgrades.includes('protocol-omega') && !game.upgrades.includes('omega-phase-2') },
        { id: 'omega-phase-3', name: 'Fisura Dimensional', icon: '🌀', cost: 150000000, desc: 'Producción Global x2.0', req: () => game.upgrades.includes('omega-phase-2') && !game.upgrades.includes('omega-phase-3') },
        { id: 'omega-phase-4', name: 'Fallo de Contención', icon: '🚨', cost: 1000000000, desc: 'Producción Global x3.0', req: () => game.upgrades.includes('omega-phase-3') && !game.upgrades.includes('omega-phase-4') },
        { id: 'omega-final', name: 'EL DESPERTAR', icon: '👁️', cost: 5000000000, desc: 'LIBERA AL VACÍO.\nProducción x5.0 + Perla Roja', req: () => game.upgrades.includes('omega-phase-4') && !game.upgrades.includes('omega-final') },

        // --- MEJORAS DE ESCALA ---
        { id: 'scaling_efficiency_1', name: 'Retroalimentación Positiva', icon: '📈', cost: 100000000, desc: 'Gana +1% de prod. extra por cada 10k W/s.', req: () => getCPS() > 50000 && !game.upgrades.includes('scaling_efficiency_1') },

        // --- NUEVO: MEJORA DE ANDRÓMEDA ---
        {
            id: 'black_market_deal',
            name: 'Contrabando de Andrómeda',
            icon: '📦',
            cost: 2500000000,
            desc: 'Los comerciantes aparecen un 50% más seguido.',
            req: () => game.heavenlyUpgrades.includes('andromeda_trade') && !game.upgrades.includes('black_market_deal')
        },

        // --- NUEVO: TECNOLOGÍA ALIENÍGENA (Se desbloquea tras Ascensión) ---
        {
            id: 'alien_tech_1',
            name: 'Xenolingüística',
            icon: '🗣️',
            cost: 1000000,
            desc: 'Entendemos sus insultos. Los aliens aparecen un 30% más rápido.',
            req: () => game.heavenlyUpgrades.includes('alien_contact') && !game.upgrades.includes('alien_tech_1')
        },
        {
            id: 'alien_tech_2',
            name: 'Disección de Grises',
            icon: '👽',
            cost: 50000000,
            desc: 'Estudiar su anatomía revela puntos débiles. Aliens tienen -20% de vida.',
            req: () => game.upgrades.includes('alien_tech_1') && !game.upgrades.includes('alien_tech_2')
        },
        {
            id: 'alien_tech_3',
            name: 'Ingeniería Inversa',
            icon: '🛸',
            cost: 5000000000,
            desc: 'Robamos su tecnología de fusión. Producción Global x1.5.',
            req: () => game.upgrades.includes('alien_tech_2') && !game.upgrades.includes('alien_tech_3')
        }
    ];

    // --- MEJORAS DINÁMICAS PARA AYUDANTES ---
    helpersConfig.forEach(h => {
        const isEquipped = game.helpers.includes(h.id);
        const powerId = `upg_power_${h.id}`;
        const masterId = `upg_master_${h.id}`;

        if (isEquipped && !game.upgrades.includes(powerId)) {
            specials.push({
                id: powerId, name: `Sincronía: ${h.name}`, icon: '🔥', cost: h.cost * 50, desc: `Efectividad de ${h.icon} +50% y Producción Global +25%.`, req: () => true
            });
        }

        if (isEquipped && game.upgrades.includes(powerId) && !game.upgrades.includes(masterId)) {
            let masterDesc = "";
            switch (h.id) {
                case 'h_clicker': masterDesc = "Dra. Thorne: +15% producción pasiva global."; break;
                case 'h_miner': masterDesc = "Marcus Voltz: Potencia la red un +50% adicional."; break;
                case 'h_discount': masterDesc = "Silas Vane: +10% bono de eficiencia a dividendos."; break;
                case 'h_combo': masterDesc = "Dra. Flux: Combo máximo sube a x10.0."; break;
                case 'h_anomaly': masterDesc = "Dorian Nox: Anomalías sin efectos negativos."; break;
                case 'h_crit': masterDesc = "Sgt. Kael: Probabilidad de crítico al 25%."; break;
                default: masterDesc = "Desbloquea el potencial oculto.";
            }
            specials.push({
                id: masterId, name: `Protocolo Maestro: ${h.icon}`, icon: '👑', cost: h.cost * 500, desc: masterDesc, req: () => true
            });
        }
    });

    // RENDERIZADO DE ESPECIALES
    specials.forEach(s => {
        if (s.req()) {
            anyUp = true;
            const btn = document.createElement('div');
            const isCritical = s.id.includes('omega') || s.id.includes('master') || s.id.includes('andromeda') || s.id.includes('alien_tech');
            btn.className = `upgrade-crate ${isCritical ? 'special-upgrade' : ''}`;
            btn.innerHTML = s.icon;
            btn.dataset.cost = s.cost;
            btn.setAttribute('data-tooltip', `${s.name}\n${s.desc}\nCoste: ${formatNumber(s.cost)}`);
            btn.onclick = () => window.buyUpgrade(s.id, s.cost);
            upgradesEl.appendChild(btn);
        }
    });

    if (!anyUp) upgradesEl.innerHTML = '<div style="color:#444; font-size:0.8rem; width:100%; text-align:center;">Juega más para desbloquear tecnología...</div>';

    // 3. RENDERIZAR LISTA DE EDIFICIOS
    let lockedShown = 0;
    for (let i = 0; i < buildingsConfig.length; i++) {
        const b = buildingsConfig[i];

        // --- FILTRO: Si es un edificio de Andrómeda, NO se muestra en la tienda normal ---
        if (b.isAndromeda) continue;

        const count = game.buildings[b.id] || 0;
        const owned = count > 0;

        if (owned || i === 0 || lockedShown < 2) {
            const cost = getCost(b.id);
            const div = document.createElement('div');
            div.className = 'building-item';
            div.dataset.cost = cost;

            if (!owned) lockedShown++;

            const isMystery = !owned && lockedShown === 2;
            const mult = b.currentPower / b.basePower;
            const multTxt = mult > 1 ? `<span style="color:var(--accent); font-size:0.8em">x${mult}</span>` : '';

            div.innerHTML = `
                <div class="item-info">
                    <h4>${isMystery ? '???' : b.name} ${multTxt}</h4>
                    <p>${isMystery ? 'Datos clasificados...' : b.desc}</p>
                    <div class="item-cost">⚡ ${formatNumber(cost)}</div>
                </div>
                <div class="item-count">${count}</div>
            `;

            if (isMystery) {
                div.style.opacity = "0.5";
                div.style.filter = "blur(1px)";
                div.style.cursor = "default";
            } else {
                div.onclick = () => window.buyBuilding(b.id);
            }
            buildingsEl.appendChild(div);
        } else {
            // No hacemos break aquí para permitir que el bucle revise todos los edificios
            // pero controlamos que solo se muestren 2 bloqueados máximo
            if (lockedShown >= 2) break;
        }
    }
}




// Donde sumas al combo (ej: click del objeto principal)
function increaseCombo() {
    const limit = getMaxCombo();
    if (comboMultiplier < limit) {
        comboMultiplier += 0.01; // O el valor que uses para subir
        if (comboMultiplier > limit) comboMultiplier = limit;
    }
    lastClickTime = Date.now(); // Reset del tiempo para que no baje
    updateUI();
}


// Variable para controlar si ya se mostró (para no repetir la animación)
let areHelpersUnlocked = false;

function checkUnlocks() {
    const helpersList = document.getElementById('helpers-list');

    // REQUISITO: Tener al menos 150 Watts totales acumulados (o Nivel 5)
    // Ajusta este número según cuándo quieras que aparezcan los aliens/humanos
    const unlockThreshold = 150;

    if (!areHelpersUnlocked && game.totalCookiesEarned >= unlockThreshold) {
        areHelpersUnlocked = true;

        // Quitar clase oculta y añadir animación
        helpersList.classList.remove('locked-section');
        helpersList.classList.add('reveal-section');

        // Renderizar por primera vez
        renderHelpers();

        // Notificación de logro/progreso
        showNotification("📡 SEÑAL ENTRANTE", "Se ha desbloqueado la pestaña de PERSONAL.");
        sfxPrestige(); // Sonido importante
    }

    // Si cargamos partida y ya teníamos progreso, aseguramos que se vea sin animación
    // (Esto se maneja en loadGame, pero por seguridad):
    if (areHelpersUnlocked && helpersList.classList.contains('locked-section')) {
        helpersList.classList.remove('locked-section');
        renderHelpers();
    }
}









function checkAvailability() {
    document.querySelectorAll('[data-cost]').forEach(el => {
        const c = parseFloat(el.dataset.cost);
        if (game.cookies < c) el.classList.add('disabled');
        else el.classList.remove('disabled');
    });
}










function createFloatingText(x, y, txt) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.innerText = txt;
    el.style.left = (x + (Math.random() - 0.5) * 30) + 'px';
    el.style.top = (y - 30) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

function formatNumber(n) {
    // Si es menor a 1000, son Watts simples
    if (n < 1000) return Math.floor(n) + ' W';

    // Prefijos del Sistema Internacional
    // k=kilo, M=Mega, G=Giga, T=Tera, P=Peta, E=Exa, Z=Zetta, Y=Yotta
    if (n >= 1e24) return (n / 1e24).toFixed(2) + ' YW'; // YottaWatt (Dios)
    if (n >= 1e21) return (n / 1e21).toFixed(2) + ' ZW'; // ZettaWatt
    if (n >= 1e18) return (n / 1e18).toFixed(2) + ' EW'; // ExaWatt
    if (n >= 1e15) return (n / 1e15).toFixed(2) + ' PW'; // PetaWatt
    if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TW'; // TeraWatt
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GW';  // GigaWatt
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MW';  // MegaWatt
    if (n >= 1e3) return (n / 1e3).toFixed(2) + ' kW';  // KiloWatt

    return Math.floor(n) + ' W';
}

// --- SISTEMA DE GUARDADO PRO ---
const CURRENT_VERSION = 1.0; // Cambiaremos esto si añadimos mecánicas nuevas en el futuro


window.saveGame = function () {
    // 1. SEGURIDAD: Inicializar campos críticos (Incluyendo mecánicas nuevas)
    if (!game.upgrades) game.upgrades = [];
    if (!game.achievements) game.achievements = [];
    if (!game.helpers) game.helpers = [];
    if (!game.activeHelpers) game.activeHelpers = []; // Guardar quiénes están trabajando
    if (!game.heavenlyUpgrades) game.heavenlyUpgrades = [];
    if (!game.buildings) game.buildings = {};
    if (!game.pearls) game.pearls = [];
    
    // Seguridad para el sistema de Inventario
    if (!game.inventory) game.inventory = [];
    if (typeof game.galacticoins === 'undefined') game.galacticoins = 0;

    // Campos de estadísticas
    if (typeof game.totalClicks === 'undefined') game.totalClicks = 0;
    if (typeof game.prestigeLevel === 'undefined') game.prestigeLevel = game.antimatter || 0;

    // 2. REGISTRO DE ESTADOS TEMPORALES
    game.lastSaveTime = Date.now();
    game.isApocalypse = isApocalypse; // Guardar el estado visual del núcleo

    // 3. EMPAQUETADO Y PERSISTENCIA
    const savePackage = {
        version: CURRENT_VERSION,
        data: game
    };

    try {
        localStorage.setItem('quantumClickerUlt', JSON.stringify(savePackage));
    } catch (e) {
        console.error("Error crítico al guardar en localStorage:", e);
        showNotification("❌ ERROR DE GUARDADO", "Espacio insuficiente en el navegador.");
    }

    // 4. FEEDBACK VISUAL
    const btn = document.querySelector('button[onclick="saveGame()"]');
    if (btn) {
        const old = btn.innerText;
        btn.innerText = "💾 OK!";
        setTimeout(() => btn.innerText = old, 1000);
    }
};


function loadGame() {
    const rawSave = localStorage.getItem('quantumClickerUlt');

    if (rawSave) {
        document.body.classList.remove('intro-mode');

        let parsedSave;
        try {
            parsedSave = JSON.parse(rawSave);
        } catch (e) {
            console.error("Save file corrupto", e);
            return;
        }

        let loadedGame = parsedSave.version ? parsedSave.data : parsedSave;

        // 1. FUSIONAR VALORES PRIMITIVOS
        for (const key in loadedGame) {
            if (!['buildings', 'upgrades', 'achievements', 'helpers', 'activeHelpers', 'heavenlyUpgrades', 'pearls', 'inventory'].includes(key)) {
                game[key] = loadedGame[key];
            }
        }

        // 2. RESTAURAR ARRAYS Y COLECCIONES
        if (loadedGame.upgrades) game.upgrades = loadedGame.upgrades;
        if (loadedGame.achievements) game.achievements = loadedGame.achievements;
        if (loadedGame.helpers) game.helpers = loadedGame.helpers;
        if (loadedGame.activeHelpers) game.activeHelpers = loadedGame.activeHelpers; // Sincronizar slots activos
        if (loadedGame.heavenlyUpgrades) game.heavenlyUpgrades = loadedGame.heavenlyUpgrades;
        if (loadedGame.pearls) game.pearls = loadedGame.pearls;
        if (loadedGame.inventory) game.inventory = loadedGame.inventory; // Restaurar Mochila

        // 3. FUSIÓN DE EDIFICIOS
        if (loadedGame.buildings) {
            for (const bId in loadedGame.buildings) {
                game.buildings[bId] = loadedGame.buildings[bId];
            }
        }

        // 4. LIMPIEZA Y SEGURIDAD (Valores por defecto)
        game.totalClicks = game.totalClicks || 0;
        game.prestigeLevel = game.prestigeLevel || game.antimatter || 0;
        game.galacticoins = game.galacticoins || 0;
        game.inventory = game.inventory || [];
        game.activeHelpers = game.activeHelpers || [];

        // Restaurar estado visual
        isApocalypse = !!game.isApocalypse;

        // 5. MIGRACIONES Y REAPLICACIÓN DE BONOS
        if (game.upgrades.includes('omega-final') && !game.pearls.includes('red')) {
            game.pearls.push('red');
        }

        // 🔥 CRÍTICO: Re-chequear el Kit de Supervivencia por si quedó pendiente
        applyHeavenlyUpgrades(); 

        recalculateStats();
        renderPearls();
        
        // Sincronizar visualmente los Satélites si existen
        if (typeof syncSatellites3D === 'function') syncSatellites3D();

        // Restaurar UI de Ayudantes
        if (game.totalCookiesEarned >= 150) {
            const hList = document.getElementById('helpers-list');
            if (hList) {
                hList.classList.remove('locked-section');
                areHelpersUnlocked = true;
            }
        }

        // 6. CÁLCULO OFFLINE
        if (game.lastSaveTime) {
            const now = Date.now();
            const secondsOffline = (now - game.lastSaveTime) / 1000;
            if (secondsOffline > 60) {
                let efficiency = game.heavenlyUpgrades.includes('offline_god') ? 1.0 : 0.5;
                const currentCPS = getCPS();
                const offlineProduction = (currentCPS * secondsOffline) * efficiency;

                if (offlineProduction > 0) {
                    game.cookies += offlineProduction;
                    game.totalCookiesEarned += offlineProduction;
                    
                    // Pequeño delay para que el modal no aparezca antes de que cargue la UI
                    setTimeout(() => {
                        showSystemModal(
                            "REGRESO AL UNIVERSO",
                            `Sistemas auxiliares generaron:\n<span style="color:#00ff88; font-size:1.2em">+${formatNumber(offlineProduction)} Watts</span>\n(Eficiencia: ${efficiency * 100}%)`,
                            false, null
                        );
                    }, 1200);
                }
            }
        }
    } else {
        console.log("Iniciando Protocolo Génesis...");
        startIntroSequence();
    }
    
    // 🔥 CORRECCIÓN: Iniciar AMBOS bucles siempre al cargar
    startAlienLoop();
    startMerchantLoop(); // <--- AÑADE ESTA LÍNEA AQUÍ
    if (typeof startMerchantLoop === 'function') startMerchantLoop();
}







window.resetGame = function () {

    showSystemModal(
        "BORRADO DE DATOS",
        "¿Estás seguro de que quieres formatear el multiverso?\nTodo el progreso se perderá para siempre.",
        true, // Es una confirmación
        function () {
            localStorage.removeItem('quantumClickerUlt');
            isApocalypse = false;
            location.reload();
        }
    );
};




// --- AÑADIDOS V2.0 ---

// En tu lógica de gestión de tiempos de eventos:

function applyHeavenlyUpgrades() {
    // 1. Mejora Génesis: Watts iniciales
    if (game.heavenlyUpgrades.includes('genesis') && game.cookies < 100) {
        game.cookies = 100;
    }

    // 2. Kit de Supervivencia: AHORA CHETADO (50 cursors, 25 grandmas)
    // Usamos los IDs correctos: 'cursor' y 'grandma'
    if (game.heavenlyUpgrades.includes('starter_kit') && !game.starterKitClaimed) {
        game.buildings.cursor = (game.buildings.cursor || 0) + 50;
        game.buildings.grandma = (game.buildings.grandma || 0) + 25;
        
        // Marcamos como reclamado para esta ascensión
        game.starterKitClaimed = true; 
        
        // Refrescamos stats para que el CPS suba instantáneamente
        recalculateStats();
        updateUI();
        console.log("📦 Kit de Supervivencia desplegado: 50 Cursors, 25 Hámsters.");
    }
}

function getAnomalyChance() {
    let baseTime = 60000; // 60 segundos base
    
    // --- MEJORAS CELESTIALES ---
    if (game.heavenlyUpgrades.includes('lucky_star')) baseTime *= 0.85; // -15% tiempo

    // --- SINERGIA: HORIZONTE DE EVENTOS ---
    const hasDorian = game.helpers.includes('h_anomaly');
    const hasSilas = game.helpers.includes('h_discount');
    
    if (hasDorian && hasSilas) {
        baseTime *= 0.6; // Mucho más rápido
    } else if (hasDorian) {
        baseTime *= 0.85;
    }
    
    return baseTime;
}






window.updateStaffSynergyUI = function() {
    const feedEl = document.getElementById('staff-feed');
    if (!feedEl) return;

    const activeSynergies = [];
    const helpers = game.helpers;

    // Mapeo de Sinergias (Builds)
    if (helpers.includes('h_clicker') && helpers.includes('h_crit')) 
        activeSynergies.push("PROTOCOLO DE CAMPO");
    
    if (helpers.includes('h_miner') && helpers.includes('h_efficiency')) 
        activeSynergies.push("CICLO CERRADO");
    
    if (helpers.includes('h_anomaly') && helpers.includes('h_discount')) 
        activeSynergies.push("HORIZONTE DE EVENTOS");
    
    if (helpers.includes('h_synergy') && helpers.includes('h_master')) 
        activeSynergies.push("MENTE DE COLMENA");

    // Actualización del DOM
    if (activeSynergies.length > 0) {
        // Estilo neón con iconos de cadena para feedback visual de conexión
        feedEl.innerHTML = `<span class="synergy-active">🔗 BUILDS: ${activeSynergies.join(" + ")} 🔗</span>`;
        feedEl.style.opacity = 1;
    } else {
        // Si el jugador desequipa el combo, restauramos el feed para mensajes normales
        if (feedEl.innerHTML.includes("BUILDS:")) {
            feedEl.innerHTML = "Esperando sincronización de equipo...";
        }
    }
};














// --- CONFIG LOGROS ---
// --- SISTEMA DE LOGROS PROCEDURALES (1000+ LOGROS) ---
let achievementsConfig = [];

const AchievementRegistry = {
    // Generador de Logros de Energía (Logarítmico)
    generateEnergy: () => {
        const list = [];
        const suffixes = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
        // Generar 100 niveles de energía
        let amount = 1000;
        for (let i = 1; i <= 100; i++) {
            list.push({
                id: `energy_total_${i}`,
                name: `🔋 Magnate de Energía ${romanize(i)}`,
                desc: `Acumula un total histórico de ${formatNumber(amount)} Watts.`,
                req: g => g.totalCookiesEarned >= amount,
                type: 'energy',
                reward: `+1% Prod. Global`
            });
            amount *= 5; // Crecimiento x5
        }
        return list;
    },

    // Generador de Logros de Clicks
    generateClicks: () => {
        const list = [];
        let clicks = 100;
        for (let i = 1; i <= 50; i++) {
            list.push({
                id: `click_manual_${i}`,
                name: `👆 Dedo Biónico ${romanize(i)}`,
                desc: `Registra ${formatNumber(clicks)} clicks manuales.`,
                req: g => g.clickCount >= clicks,
                type: 'click',
                reward: `+1% Prod. Global`
            });
            clicks *= 2;
        }
        return list;
    },

    // Generador de Logros de Edificios (Para CADA edificio)
    generateBuildings: () => {
        const list = [];
        // Niveles de cantidad: 1, 10, 25, 50, 100, 150... hasta 1000
        const milestones = [1, 10, 25, 50, 100];
        for (let i = 150; i <= 1000; i += 50) milestones.push(i);

        buildingsConfig.forEach(b => {
            milestones.forEach((level, idx) => {
                list.push({
                    id: `build_${b.id}_${level}`,
                    name: `${b.icon} Dueño de ${b.name} ${romanize(idx + 1)}`,
                    desc: `Ten ${level} edificios de tipo ${b.name}.`,
                    req: g => (g.buildings[b.id] || 0) >= level,
                    type: 'building',
                    reward: `+1% Prod. Global`
                });
            });
        });
        return list;
    },

    // Generador de Logros de Producción (CPS)
    generateCPS: () => {
        const list = [];
        let cps = 10;
        for (let i = 1; i <= 80; i++) {
            list.push({
                id: `cps_flow_${i}`,
                name: `⚡ Flujo Estable ${romanize(i)}`,
                desc: `Alcanza una producción de ${formatNumber(cps)} W/s.`,
                req: () => getCPS() >= cps,
                type: 'cps',
                reward: `+1% Prod. Global`
            });
            cps *= 3;
        }
        return list;
    },

    // Logros manuales especiales (Prestigio, Ayudantes, etc)
    special: [
        { id: 'hacker', name: '🌀 Sincronía Crítica', desc: 'Combo x3.0.', req: () => comboMultiplier >= 3.0, type: 'special' },
        { id: 'prestige1', name: '🌌 Ascensión I', desc: 'Realiza tu primer prestigio.', req: g => g.prestigeLevel >= 1, type: 'prestige' },
        { id: 'helper1', name: '🤝 Contacto Alien', desc: 'Contrata 1 ayudante.', req: g => g.helpers && g.helpers.length >= 1, type: 'special' },
        { id: 'full_upgrades', name: '🔧 Tecnócrata', desc: '50 Mejoras compradas.', req: g => g.upgrades.length >= 50, type: 'special' }
    ]
};

// Función auxiliar para números romanos
function romanize(num) {
    if (isNaN(num)) return NaN;
    var digits = String(+num).split(""),
        key = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM",
            "", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC",
            "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"],
        roman = "",
        i = 3;
    while (i--) roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}

// INICIALIZADOR DE LOGROS
function initAchievements() {
    achievementsConfig = [
        ...AchievementRegistry.generateEnergy(),
        ...AchievementRegistry.generateClicks(),
        ...AchievementRegistry.generateBuildings(),
        ...AchievementRegistry.generateCPS(),
        ...AchievementRegistry.special
    ];
    console.log(`🏆 Cargados ${achievementsConfig.length} logros procedurals.`);
}



// --- FRASES NOTICIAS ---
const newsHeadlines = [
    "Científicos descubren que la energía cuántica sabe a vainilla. — Dr. Ponzi, físico de dudosa reputación.",
    "El universo se expande, pero tus edificios lo hacen más rápido. — El Arquitecto Municipal de Neo-Tokyo.",
    "Un gato de Schrödinger ha sido encontrado vivo y muerto a la vez en tu granja. — Un granjero cuántico con resaca.",
    "Los aliens piden que bajes el volumen de tus reactores. — El vecino de la galaxia de al lado.",
    "Economía global colapsa; ahora la moneda oficial es el Watt. — Un broker de Wall Street que vive en una caja de cartón.",
    "Tu madre llama: '¿Cuándo vas a conseguir un trabajo real?' — Tu madre (vía enlace neuronal obligatorio).",
    "Tu tostadora ha superado el test de Turing y ahora se niega a quemar pan. — Una tostadora con complejo de Dios.",
    "Microsoft anuncia que Windows 2077 pesará 400 petabytes y solo servirá para el Solitario. — Un becario explotado de Microsoft.",
    "Soporte técnico: Si ves píxeles en el cielo, por favor, reinicia tu casco de VR. — El Admin de la Simulación.",
    "Un hacker roba tus recuerdos de infancia y los vende como NFTs de baja calidad. — @ZeroCool_99 (hacker de 12 años).",
    "Tu brazo biónico detectó software pirata y bailará Fortnite hasta que pagues la licencia. — El CEO de Robocorp.",
    "El aire 'Premium' sabor fresa-neón sube un 200%; el normal ahora contiene gas pimienta. — El Ministro de Oxígeno y Marketing.",
    "Amazon Prime Intergaláctico: Tu paquete llegará hace tres días por un agujero de gusano. — Jeff Bezos VII (clon 42).",
    "El banco informa: Tu deuda es tan grande que ahora eres legalmente propiedad de una IA. — El Algoritmo de Cobros Coactivos.",
    "Se venden parcelas en el Sol; las visitas solo se recomiendan durante la noche. — Tony el Gordo, vendedor de humo espacial.",
    "La cripto 'Dogecoin-Mars' colapsa porque un alien posteó un emoji de un pepino. — Kark el alienígena borracho.",
    "¿Cansado de morir? Suscríbete a Respawn+: Ahora con un 10% menos de degradación celular. — Comercial de la funeraria 'Next-Life'.",
    "Los robots de combate se declaran en huelga; exigen aceite de oliva virgen extra. — Unit-734, líder sindical mecánico.",
    "Nueva oferta de trabajo: Se busca humano para convencer a una IA de no destruir el mundo. — Recursos Humanos de la ONU.",
    "Tu seguro médico no cubre ataques de Kaijus ni errores de teletransporte. — Una IA de atención al cliente con voz de pito.",
    "Los aliens confirman que la Tierra es solo un experimento social que se les fue de las manos. — Investigador jefe de la Galaxia X.",
    "La NASA detecta una señal de radio: es un anuncio de alargamiento de tentáculos. — Un radioaficionado conspiranoico.",
    "Plutón recupera su estatus de planeta tras sobornar a la Unión Astronómica con hielo espacial. — El Embajador de Plutón.",
    "Se descubre que los agujeros negros son solo la papelera de reciclaje del universo. — El barrendero cósmico.",
    "Un alien es arrestado por intentar aparcar su platillo volante en zona azul sin ticket. — Agente Pérez, Patrulla Espacial.",
    "Científicos confirman: El Big Bang fue un becario cósmico derramando café en el servidor. — Dr. Oops, Premio Nobel accidental.",
    "Tu clon se ha escapado y ahora tiene un trabajo mejor y una pareja más guapa que tú. — Un detective privado de bio-ética.",
    "La realidad es un holograma, pero los impuestos que pagas son sorprendentemente sólidos. — El Recaudador de Impuestos Interdimensional.",
    "El Cyber-Papa bendice los servidores de Minecraft para evitar ataques de hackers. — Su Santidad Digital 2.0.",
    "Se prohíben los viajes en el tiempo para evitar que la gente compre Bitcoin en 2010. — La Policía de la Continuidad Temporal.",
    "Tu mascota holográfica ha muerto porque olvidaste cargar la batería del router. — Un niño llorando en 144p.",
    "Anuncio en tu retina: Por favor, mira el logo de Pepsi 5 segundos para poder desayunar. — El algoritmo publicitario intrusivo.",
    "Encuentran una Game Boy en Marte con una partida de Tetris iniciada hace 3000 años. — Un arqueólogo con gafas de neón.",
    "Moda de verano: Trajes de plomo con luces LED para la lluvia ácida con estilo. — Editora de la revista 'Vogue-Cyber'.",
    "Tu abuela subió su conciencia a la nube y ahora te manda notificaciones al cerebro. — La Abuela 3.0 (ahora con 5G).",
    "Los semáforos de la ciudad ahora hackean tu sistema nervioso para obligarte a parar. — El Jefe de Tráfico Distópico.",
    "Error 404: El fin del mundo no se ha encontrado; por favor, inténtelo más tarde. — El Dios de la Programación.",
    "Si te encuentras contigo mismo en el pasado, no te hables; es un pesado y pide dinero. — Un viajero del tiempo arrepentido.",
    "La luz al final del túnel es solo el faro de un tren expreso interdimensional. — Un filósofo de alcantarilla.",
    "Paradoja de Fermi resuelta: Los aliens no nos hablan porque somos 'demasiado cringe'. — El tuitero más famoso de Marte.",
    "El destino es inevitable, a menos que compres el DLC 'Libre Albedrío' por 19.99€. — Electronic Arts (División Galáctica).",
    "Un fallo en la simulación hace que todos los perros caminen hacia atrás durante dos horas. — El moderador del servidor Tierra.",
    "El apocalipsis zombie se cancela: los zombies se quedaron mirando el móvil y olvidaron comer. — Un reportero de noticias de última hora.",
    "Tu implante de memoria borró la historia para meter memes de gatos de los años 20. — Un adolescente del año 2105.",
    "La última estrella se apaga y el último humano se queja de que no hay luz para leer. — El bibliotecario del fin del mundo.",
    "Los reactores de fusión ahora funcionan con el odio generado en las redes sociales. — El Ingeniero Jefe de Twitter-Energy.",
    "La materia oscura son en realidad calcetines perdidos en lavadoras interdimensionales. — Una ama de casa del hiperespacio.",
    "Tu ex te bloqueó en la vida real y ahora su avatar es un arbusto en tu jardín digital. — Un bot de chismes.",
    "El gobierno anuncia que la gravedad será opcional los fines de semana para ahorrar energía. — El portavoz de leyes físicas.",
    "Hay 4 billones de versiones de ti en el multiverso y todas son igual de mediocres. — Un espejo existencialista.",
    "El 90% de los humanos prefiere vivir en una simulación donde el IVA no existe. — Un encuestador de Matrix.",
    "Se descubre que la Luna es un satélite espía puesto por una civilización de patos. — El loco del muelle espacial.",
    "Los viajes interestelares se retrasan: alguien olvidó las llaves de la nave nodriza. — El Capitán Olvidadizo.",
    "Los androides sueñan con ovejas eléctricas, pero solo si pagan la suscripción Premium. — El fantasma de Philip K. Dick.",
    "Tu nevera inteligente ha pedido 500 cartones de leche tras una crisis existencial. — Un técnico de electrodomésticos deprimidos.",
    "El sol se ha puesto en modo ahorro de energía; por favor, inserte una moneda para continuar. — La administración del Sistema Solar."
];

// --- SISTEMA DE NOTICIAS Y LOGROS ---

function checkAchievements() {
    achievementsConfig.forEach(ach => {
        if (!game.achievements.includes(ach.id)) {
            if (ach.req(game)) {
                unlockAchievement(ach);
            }
        }
    });
}

function unlockAchievement(ach) {
    game.achievements.push(ach.id);
    showNotification("🏆 LOGRO DESBLOQUEADO", `${ach.name}: ${ach.desc}`);
    sfxPrestige(); // Usamos sonido de victoria
}

function showNotification(title, text) {
    const area = document.getElementById('notification-area');
    const el = document.createElement('div');
    el.className = 'achievement-pop';
    el.innerHTML = `<div class="ach-title">${title}</div><div class="ach-desc">${text}</div>`;
    area.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// Ciclo de noticias
function updateNews() {
    const el = document.getElementById('news-content');
    const headline = newsHeadlines[Math.floor(Math.random() * newsHeadlines.length)];
    // Truco para reiniciar la animación CSS
    el.style.animation = 'none';
    el.offsetHeight; /* trigger reflow */
    el.style.animation = 'tickerMove 20s linear infinite';
    el.innerText = "   |   " + headline + "   |   "; // Duplicar para efecto loop visual
}
setInterval(updateNews, 20000); // Cambiar noticia cada 20s
updateNews(); // Primera noticia

// --- LÓGICA DE INTERFAZ DE LOGROS ---
window.toggleAchievements = function () {
    const modal = document.getElementById('modal-achievements');
    const grid = document.getElementById('achievements-grid');

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        // Renderizar lista al abrir
        grid.innerHTML = '';
        achievementsConfig.forEach(ach => {
            const unlocked = game.achievements.includes(ach.id);
            const card = document.createElement('div');
            card.className = `ach-card ${unlocked ? 'unlocked' : ''}`;
            card.innerHTML = `
                <h4>${unlocked ? '🏆' : '🔒'} ${ach.name}</h4>
                <p>${ach.desc}</p>
            `;
            grid.appendChild(card);
        });
        modal.style.display = 'flex';
    }
}

// ==========================================
// SISTEMA DE ASCENSIÓN
// ==========================================

window.doPrestige = function () {
    const modal = document.getElementById('modal-ascension');
    const PRESTIGE_BASE = 1000000;

    // Cálculo de potencial basado en raíz cúbica (progresión justa)
    const totalPotential = Math.floor(Math.cbrt(game.totalCookiesEarned / PRESTIGE_BASE));
    const currentLevel = game.prestigeLevel || 0;
    let amountToGain = totalPotential - currentLevel;

    if (amountToGain <= 0) {
        const nextPoint = currentLevel + 1;
        const energyNeed = Math.pow(nextPoint, 3) * PRESTIGE_BASE;
        const remaining = energyNeed - game.totalCookiesEarned;
        
        showSystemModal(
            "⚠️ NÚCLEO ESTABLE", 
            `La presión cuántica no es suficiente para la Ascensión.\n\nFaltan: <span style="color:#ff5252">${formatNumber(remaining)} Watts</span> para el próximo nivel de Antimateria.`, 
            false, 
            null
        );
        return;
    }

    // --- EFECTO DE SONIDO ÉPICO AL ABRIR ---
    if (typeof sfxPrestige === 'function') sfxPrestige();

    // Cálculo del nuevo multiplicador (0.1x por nivel o 0.2x con Multiverso)
    const hasMultiverse = game.heavenlyUpgrades.includes('multiverse');
    const bonusPerLevel = hasMultiverse ? 0.2 : 0.1;
    const nextMult = 1 + ((currentLevel + amountToGain) * bonusPerLevel);

    // Actualizar elementos del Modal con colores dinámicos
    const gainEl = document.getElementById('asc-gain-antimatter');
    const multEl = document.getElementById('asc-new-mult');

    if (gainEl) {
        gainEl.innerText = `${formatNumber(amountToGain)} AM`;
        gainEl.style.color = "#b388ff"; // Color Antimateria
    }
    
    if (multEl) {
        multEl.innerText = `${nextMult.toFixed(2)}`;
        multEl.style.color = "#00ff88"; // Color Mejora
    }

    modal.dataset.gain = amountToGain;
    modal.style.display = 'flex';
    
    // Animación de entrada para el contenido del modal
    const content = modal.querySelector('.modal-content');
    if (content) content.style.animation = "modalIn 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28)";
};

window.closeAscension = function () {
    document.getElementById('modal-ascension').style.display = 'none';
};

window.confirmAscension = function () {
    const modal = document.getElementById('modal-ascension');
    const gain = parseInt(modal.dataset.gain);

    if (!gain || gain <= 0) return;

    sfxPrestige();

    // 1. HARD RESET LÓGICO Y VISUAL (MODIFICADO)
    game.cookies = 0;
    game.buildings = {};
    game.upgrades = [];
    game.helpers = [];
    game.activeHelpers = []; 
    
    // game.inventory = []; // 🛑 ELIMINADO: Ahora el inventario persiste entre ascensiones.
    // game.galacticoins = game.galacticoins; // Las monedas también se mantienen.

    // Reseteo de nivel de EXP si quieres que la progresión de nivel sea por prestigio
    // Si prefieres que el Nivel de Comandante sea permanente, comenta las siguientes 2 líneas:
    game.exp = 0;
    game.level = 1;

    isApocalypse = false;
    comboMultiplier = 1.0;
    comboTimer = 0;
    buffMultiplier = 1;
    clickBuffMultiplier = 1;
    currentCoreTier = -1; 

    // Limpieza de objetos 3D residuales
    if (orbitalRing) { 
        scene.remove(orbitalRing); 
        orbitalRing.geometry.dispose(); 
        orbitalRing.material.dispose(); 
        orbitalRing = null; 
    }

    // 2. APLICAR RECOMPENSAS DE ASCENSIÓN
    game.antimatter += gain;      
    game.prestigeLevel += gain;   

    // Multiplicador de Prestigio
    let effectiveLevel = game.prestigeLevel;
    if (game.heavenlyUpgrades.includes('multiverse')) {
        game.prestigeMult = 1 + (effectiveLevel * 0.2);
    } else {
        game.prestigeMult = 1 + (effectiveLevel * 0.1);
    }

    // 3. REINICIAR CONFIGURACIÓN DE EDIFICIOS
    buildingsConfig.forEach(u => { 
        game.buildings[u.id] = 0; 
        u.currentPower = u.basePower; 
    });

    // 4. PROTOCOLO DE REINICIO CELESTIAL
    game.starterKitClaimed = false; 
    applyHeavenlyUpgrades();

    // 5. FINALIZAR Y GUARDAR
    saveGame();
    closeAscension();
    
    setTimeout(() => {
        openHeavenTree(); 
    }, 500);
};

// ==========================================
// SISTEMA DE DIÁLOGOS PERSONALIZADOS (MODALES)
// ==========================================
let pendingAction = null;

window.showSystemModal = function (title, message, isConfirm, actionCallback) {
    const modal = document.getElementById('modal-system');
    const titleEl = document.getElementById('sys-title');
    const msgEl = document.getElementById('sys-msg');
    const cancelBtn = document.getElementById('sys-btn-cancel');
    const okBtn = document.getElementById('sys-btn-ok');

    titleEl.innerText = title;
    msgEl.innerHTML = message.replace(/\n/g, '<br>');

    if (isConfirm) {
        cancelBtn.style.display = 'block';
        titleEl.style.color = '#ff5252';
    } else {
        cancelBtn.style.display = 'none';
        titleEl.style.color = '#00ff88';
    }

    pendingAction = actionCallback;

    okBtn.onclick = function () {
        if (pendingAction) pendingAction();
        closeSystemModal();
        sfxClick();
    };

    modal.style.display = 'flex';
};

window.closeSystemModal = function () {
    document.getElementById('modal-system').style.display = 'none';
    pendingAction = null;
};



// ==========================================
// SISTEMA DE CÓDICE (COLECCIÓN)
// ==========================================

window.toggleCollection = function () {
    const modal = document.getElementById('modal-collection');

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        renderCollection();
        modal.style.display = 'flex';
    }
};



// ==========================================
// SISTEMA DE CÓDICE + TOOLTIP GLOBAL
// ==========================================

window.renderCollection = function () {
    const artifactsGrid = document.getElementById('collection-artifacts');
    const helpersGrid = document.getElementById('collection-helpers');
    const upgradesGrid = document.getElementById('collection-upgrades');

    if (artifactsGrid) artifactsGrid.innerHTML = '';
    if (helpersGrid) helpersGrid.innerHTML = '';
    if (upgradesGrid) upgradesGrid.innerHTML = '';

    // Función interna para crear el cuadradito (Tile)
    const createTile = (container, type, unlocked, icon, title, desc, req) => {
        const div = document.createElement('div');
        div.className = `collection-item ${type} ${unlocked ? 'unlocked' : 'locked'}`;
        div.innerHTML = unlocked ? icon : '🔒';

        // Conexión con el Tooltip Global
        div.onmouseenter = (e) => showTooltip(e, title, desc, req, unlocked);
        div.onmouseleave = () => hideTooltip();
        div.onmousemove = (e) => moveTooltip(e);

        container.appendChild(div);
    };

    // --- 1. ARTEFACTOS (RELIQUIAS CUÁNTICAS) ---
    const pearlsData = [
        { id: 'red', name: '💎 Perla de la Entropía', desc: 'Sincronización total con el vacío. Multiplica la generación global x10.', icon: '🔴', req: 'Completar Protocolo: Singularidad Total' },
        { id: 'blue', name: '💎 Perla del Cronos', desc: 'Manipulación del tiempo local. Aumenta la potencia de los pulsos cinéticos x50.', icon: '🔵', req: 'Registrar 10,000 pulsos manuales' },
        { id: 'green', name: '💎 Perla de la Vida', desc: 'Optimización biológica extrema. Reduce el coste de todas las estructuras en un 50%.', icon: '🟢', req: 'Sincronizar Consejo de Sabios (4 activos)' }
    ];
    pearlsData.forEach(p => {
        const has = game.pearls.includes(p.id);
        createTile(artifactsGrid, 'artifact', has, p.icon, p.name, p.desc, "Protocolo de obtención: " + p.req);
    });

    // --- 2. ESPECIALISTAS (AYUDANTES ALIENÍGENAS) ---
    helpersConfig.forEach(h => {
        const has = game.helpers.includes(h.id);
        createTile(helpersGrid, 'helper', has, h.icon, h.name, h.desc, "Estado: Pendiente de contrato.");
    });

    // --- 3. MÓDULOS TECNOLÓGICOS (MEJORAS) ---
    // A) Optimizaciones de Estructura (Niveles MK)
    buildingsConfig.forEach(b => {
        milestones.forEach((th, i) => {
            const uid = `${b.id}-${th}`;
            const has = game.upgrades.includes(uid);
            const icon = upgradeIcons[i % upgradeIcons.length] || '⚡';

            // Nombres Sci-Fi según nivel
            const mkNames = ["Optimización de Bobinas", "Refuerzo de Grafeno", "Núcleo de Superconducción", "Entrelazamiento Cuántico"];
            const currentMkName = mkNames[i] || "Protocolo de Hiper-Eficiencia";

            createTile(upgradesGrid, 'upgrade', has, icon,
                `${b.name}: ${currentMkName} (MK-${i + 1})`,
                "Aumenta la salida de Watts al doble (x2).",
                `Requisito: Desplegar ${th} unidades de ${b.name}.`
            );
        });
    });

    // B) Proyectos Especiales de la Corporación
    const specials = [
        { id: 'entropy-antenna', icon: '📡', name: 'Sincronizador de Micro-Pulsos', desc: 'Sintoniza la frecuencia de las anomalías para que aparezcan un 20% más rápido.' },
        { id: 'quantum-lens', icon: '🔍', name: 'Obturador de Persistencia', desc: 'Mantiene las anomalías estables en nuestra dimensión por 2 segundos extra.' },
        { id: 'protocol-omega', icon: '⚠️', name: 'Horizonte de Sucesos', desc: 'Fase 1: Inicio de la inestabilidad cuántica. Producción global x1.2.' },
        { id: 'omega-final', icon: '👁️', name: 'SINGULARIDAD TOTAL', desc: 'Fase Final: Rotura de las leyes físicas. Producción global x5.0.' }
    ];
    specials.forEach(s => {
        const has = game.upgrades.includes(s.id);
        createTile(upgradesGrid, 'special', has, s.icon, s.name, s.desc, "Estado: Datos encriptados (Proyecto Secreto)");
    });
};

// --- LÓGICA DEL TOOLTIP FLOTANTE (GLOBAL) ---
const globalTooltip = document.getElementById('global-tooltip');

function showTooltip(e, title, desc, req, unlocked) {
    if (!globalTooltip) return;

    // Construir HTML del tooltip
    let html = '';
    if (unlocked) {
        html = `<strong style="color:#fff">${title}</strong>${desc}`;
    } else {
        html = `<strong style="color:#888">???</strong>Tecnología Bloqueada<em>${req}</em>`;
    }

    globalTooltip.innerHTML = html;
    globalTooltip.style.display = 'block';
    moveTooltip(e); // Posicionar inmediatamente
}

function moveTooltip(e) {
    if (!globalTooltip) return;

    // Posición relativa al ratón (+15px para que no tape el cursor)
    const x = e.clientX + 15;
    const y = e.clientY + 15;

    // Evitar que se salga de la pantalla (Lógica básica)
    // Si quieres algo más pro, habría que calcular window.innerWidth

    globalTooltip.style.left = x + 'px';
    globalTooltip.style.top = y + 'px';
}

function hideTooltip() {
    if (globalTooltip) globalTooltip.style.display = 'none';
}




/// =========================================================
/// PERLAS

function triggerOmegaMinorGlitch() {
    // 1. Sonido de error de sistema / estática
    playTone(60, 'sawtooth', 0.1, 0.4);
    setTimeout(() => playTone(40, 'square', 0.2, 0.3), 100);

    // 2. Efecto visual en el DOM (Clase CSS)
    document.body.classList.add('omega-buy-glitch');

    // 3. Reacción en Three.js
    if (mainObject && glowMesh) {
        // Un impulso repentino de luz y escala
        const originalScale = mainObject.scale.x;
        mainObject.scale.setScalar(originalScale * 1.5);
        mainObject.material.emissiveIntensity = 5;

        // Pequeño desplazamiento aleatorio de cámara
        const shakeX = (Math.random() - 0.5) * 2;
        const shakeY = (Math.random() - 0.5) * 2;
        camera.position.x += shakeX;
        camera.position.y += shakeY;

        // Resetear después de 300ms (el glitch es rápido)
        setTimeout(() => {
            mainObject.scale.setScalar(originalScale);
            mainObject.material.emissiveIntensity = 0.6;
            camera.position.x -= shakeX;
            camera.position.y -= shakeY;
            document.body.classList.remove('omega-buy-glitch');
        }, 300);
    }
}







// Desbloquear una perla (Ej: al comprar Omega)
function unlockPearl(color) {
    if (!game.pearls.includes(color)) {
        game.pearls.push(color);
        showSystemModal("💎 ARTEFACTO OBTENIDO", `Has encontrado la ${pearlsConfig[color].name}.`, false, null);
        renderPearls();
        saveGame();
    }
}

// Equipar/Desequipar una perla
window.togglePearl = function (color) {
    // Si no la tienes, no haces nada
    if (!game.pearls.includes(color)) {
        showNotification("🔒 BLOQUEADO", "Aún no has encontrado esta Perla Angular.");
        return;
    }

    // Si ya la tienes puesta, te la quitas
    if (game.activePearl === color) {
        game.activePearl = null;
        isApocalypse = false; // Quitar efecto visual rojo si era la roja
        showNotification("💍 DESEQUIPADO", "La perla vuelve al relicario.");
    } else {
        // Si te pones una nueva
        game.activePearl = color;

        // Efectos visuales inmediatos
        if (color === 'red') {
            isApocalypse = true; // Activar modo rojo
            sfxAnomaly();
        } else {
            isApocalypse = false; // Las otras perlas limpian el apocalipsis
            sfxClick();
        }

        showNotification("💎 EQUIPADO", `${pearlsConfig[color].name} activa.`);
    }

    renderPearls();
    updateUI(); // Para actualizar precios si es la verde
    recalculateStats(); // Para actualizar CPS si es la roja
};














// Dibujar el estado visual de las ranuras
function renderPearls() {
    ['red', 'blue', 'green'].forEach(color => {
        const slot = document.getElementById(`slot-${color}`);
        const tooltip = slot.querySelector('.pearl-tooltip');
        slot.className = 'pearl-slot locked';
        if (game.pearls.includes(color)) {
            slot.classList.remove('locked');
            slot.classList.add('unlocked');
            tooltip.innerHTML = `<strong style="color:${pearlsConfig[color].color}">${pearlsConfig[color].name}</strong><br>${pearlsConfig[color].desc}`;
            if (game.activePearl === color) {
                slot.classList.add('active');
                tooltip.innerHTML += "<br><span style='color:#fff'>[EQUIPADA]</span>";
            } else {
                tooltip.innerHTML += "<br><span style='color:#aaa'>[Click para equipar]</span>";
            }
        } else {
            // Lógica de pistas mejorada
            let hint = "???";
            if (color === 'blue') hint = "Persistencia: 10,000 Clicks Manuales.";
            else if (color === 'red') hint = "Completa el Protocolo Omega.";
            else if (color === 'green') hint = "Sincroniza a la Élite (Últimos 4 activos).";
            tooltip.innerHTML = `RANURA VACÍA<br><span style='font-size:0.8em; color:#888; font-style:italic'>Pista: ${hint}</span>`;
        }
    });
}
















// ==========================================
// ARRANQUE Y UTILIDADES
// ==========================================

// Aviso de fotosensibilidad (antes de cargar)
initSafeMode();
initRadio();

// Carga inicial
// Inicializar logros procedurals antes de cargar nada
initAchievements();

loadGame();

// Inicializar contadores a 0 si no existen
buildingsConfig.forEach(u => {
    if (!game.buildings[u.id]) game.buildings[u.id] = 0;
    u.currentPower = u.basePower;
});

// Recalcular mejoras compradas
recalculateStats();

// Iniciar motor gráfico
initThree();

// FORZAR ACTUALIZACIÓN VISUAL DEL NÚCLEO
// (Porque recalculateStats ocurrió antes de que mainObject existiera)
updateCoreAppearance();

// Si estamos en la intro, re-aplicar estado visual (porque loadGame() 
// llamó a startIntroSequence() ANTES de que existieran los objetos 3D)
if (isIntroActive && mainObject) {
    mainObject.material.emissiveIntensity = 0;
    mainObject.material.color.setHex(0x000000);
    mainObject.material.emissive.setHex(0x000000);
    if (glowMesh) glowMesh.visible = false;
    if (starMesh) starMesh.visible = false;
}

// Renderizar UI inicial
renderStore();
renderHelpers();
updateUI();

// Bucle del juego
gameLoop();

// Auto-guardado cada 60s
setInterval(saveGame, 60000);


// INICIAR CICLO DE ANOMALÍAS (¡ESTO FALTABA!)
setTimeout(spawnAnomaly, 5000); // Primera anomalía a los 5 segundos



// ==========================================
// SISTEMA DE ÁRBOL CELESTIAL
// ==========================================

// Configuración de Nodos (ID, Nombre, Icono, Coste, Posición X/Y, Requisito)
// COORDENADAS COMPACTAS: Centro X = 350
// ==========================================
// CONFIGURACIÓN DEL ÁRBOL DE ASCENSIÓN (COSMOS)
// ==========================================
// Coordenadas: Centro del Canvas aprox (400, 300)

const heavenlyConfig = [
    // --- NÚCLEO (INICIO) ---
    {
        id: 'genesis', name: 'La semilla', icon: '💥', cost: 1,
        x: 400, y: 300,
        desc: 'El comienzo de todo. Empiezas con 100 Watts tras reiniciar.',
        parents: []
    },
    // --- MEJORA DE COMERCIANTES (UBICACIÓN ACCESIBLE) ---
    {
        id: 'andromeda_trade',
        name: 'Comerciantes de Andrómeda',
        icon: '⚖️',
        cost: 10, // Barato para la primera ascensión
        x: 200, y: 200, // Posición visible arriba a la izquierda
        desc: 'Habilita rutas comerciales con Andrómeda. Aparecerán naves mercantes con tecnología única.',
        parents: ['genesis'] // Se desbloquea comprando la primera mejora
    },

    // --- RAMA SUPERIOR: EVENTOS Y ALIENS (ACCESO RÁPIDO) ---
    {
        id: 'alien_contact',
        name: 'Primer Contacto',
        desc: 'Desbloquea visitas alienígenas (x2, x5, x15 Energía).',
        icon: '👽',
        cost: 10, // Muy accesible en la primera ascensión
        x: 400, y: 200,
        parents: ['genesis']
    },
    {
        id: 'pension_plan',
        name: 'Plan de Pensiones Galáctico',
        icon: '📜',
        cost: 150,
        x: 100, y: 300, // Situado a la izquierda de la rama de producción
        desc: 'Los contratos a largo plazo dan sus frutos. Reduce el coste de mantenimiento de todos los operadores un 10% adicional.',
        parents: ['perm_prod_1'] // Se desbloquea tras Eficiencia Industrial
    },
    {
        id: 'galaxy_brain', name: 'Cerebro Galáctico', icon: '🧠', cost: 30,
        x: 400, y: 120,
        desc: 'Por cada Logro desbloqueado, +2% de Producción Global.',
        parents: ['alien_contact']
    },
    {
        id: 'abduction_tech', name: 'Tecnología de Rapto', icon: '🛸', cost: 100,
        x: 320, y: 50,
        desc: 'Los Aliens aparecen un 50% más rápido.',
        parents: ['galaxy_brain']
    },

    // --- RAMA IZQUIERDA: INDUSTRIAL (PRODUCCIÓN) ---
    {
        id: 'starter_kit', name: 'Kit de Supervivencia', icon: '📦', cost: 5,
        x: 300, y: 300,
        desc: 'Inicias con 10 Gen. Manuales y 5 Hámsters gratis.',
        parents: ['genesis']
    },
    {
        id: 'perm_prod_1', name: 'Eficiencia Industrial', icon: '🏭', cost: 20,
        x: 200, y: 250,
        desc: 'Producción de edificios +15% PERMANENTE.',
        parents: ['starter_kit']
    },
    {
        id: 'cheaper_builds', name: 'Arquitectura Cuántica', icon: '📉', cost: 50,
        x: 180, y: 350,
        desc: 'Edificios cuestan un 5% menos.',
        parents: ['starter_kit']
    },

    // --- RAMA DERECHA: CINÉTICA (CLICKS) ---
    {
        id: 'click_transistor', name: 'Transistor de Dedo', icon: '👆', cost: 10,
        x: 500, y: 300,
        desc: 'Clicks generan 1% de tu WPS.',
        parents: ['genesis']
    },
    {
        id: 'crit_master', name: 'Punto Débil', icon: '🎯', cost: 25,
        x: 600, y: 250,
        desc: 'Probabilidad de crítico manual +5%.',
        parents: ['click_transistor']
    },
    {
        id: 'click_god', name: 'Mano de Dios', icon: '⚡', cost: 80,
        x: 620, y: 350,
        desc: 'El 1% de WPS pasa a ser el 5% de WPS por click.',
        parents: ['click_transistor']
    },

    // --- RAMA INFERIOR: CAOS (ANOMALÍAS) ---
    {
        id: 'lucky_star', name: 'Suerte Cósmica', icon: '🍀', cost: 15,
        x: 400, y: 400,
        desc: 'Anomalías aparecen un 15% más frecuentemente.',
        parents: ['genesis']
    },
    {
        id: 'wrath_control', name: 'Diplomacia del Vacío', icon: '🤝', cost: 50,
        x: 300, y: 480,
        desc: 'Anomalías rojas fallan un 50% menos.',
        parents: ['lucky_star']
    },
    {
        id: 'golden_duration', name: 'Estabilidad Temporal', icon: '⏳', cost: 50,
        x: 500, y: 480,
        desc: 'Buffs de anomalías duran +10 segundos.',
        parents: ['lucky_star']
    },

    // --- EL FINAL DEL ÁRBOL (ENDGAME ACCESIBLE) ---
    {
        id: 'singularity', name: 'LA SINGULARIDAD', icon: '👁️', cost: 500,
        x: 400, y: 550,
        desc: 'Desbloquea el acceso a las Perlas Legendarias.',
        parents: ['wrath_control', 'golden_duration']
    },
    {
        id: 'multiverse', name: 'Multiverso', icon: '🪐', cost: 5000,
        x: 550, y: 50,
        desc: 'Prestigio Infinito: El multiplicador de Ascensión es el doble de efectivo.',
        parents: ['abduction_tech', 'galaxy_brain']
    },

    // --- RAMA OFFLINE ---
    {
        id: 'offline_god', name: 'Estasis Perfecta', icon: '🌙', cost: 200,
        x: 200, y: 400,
        desc: 'Producción offline al 100% de eficiencia (en vez del 50%).',
        parents: ['perm_prod_1']
    }
];







// Este bucle intenta llamar a un comerciante cada cierto tiempo
setInterval(() => {
    // Solo si el jugador tiene la mejora comprada
    if (game.heavenlyUpgrades.includes('andromeda_trade')) {
        // Probabilidad del 30% cada 2 minutos para que no sea molesto
        if (Math.random() < 0.3) {
            spawnMerchant();
        }
    }
}, 120000); // 120.000 ms = 2 minutos

// BUCLE DE INVASIÓN ALIEN
setInterval(() => {
    // Solo intentamos si el jugador tiene la mejora de ascensión
    if (game.heavenlyUpgrades.includes('alien_contact')) {

        // Probabilidad base: 10% cada 5 segundos
        let chance = 0.1;

        // Si compró la mejora "Xenolingüística", sube la probabilidad
        if (game.upgrades.includes('alien_tech_1')) chance += 0.05;

        // Si tiene la mejora del árbol "Tecnología de Rapto", sube más
        if (game.heavenlyUpgrades.includes('abduction_tech')) chance += 0.1;

        if (Math.random() < chance) {
            spawnAlien();
        }
    }
}, 5000); // Chequea cada 5 segundos






// Variable para guardar las mejoras celestiales compradas
// Asegúrate de añadir "heavenlyUpgrades: []" al objeto "game" inicial al principio del archivo.

window.openHeavenTree = function () {
    document.getElementById('modal-heaven').style.display = 'flex';
    document.getElementById('heaven-antimatter').innerText = formatNumber(game.antimatter);
    renderHeavenTree();
};

window.closeHeaven = function () {
    document.getElementById('modal-heaven').style.display = 'none';
    sfxClick(); // Un sonidito al cerrar queda bien
};

function renderHeavenTree() {
    const container = document.getElementById('heaven-nodes');
    const canvas = document.getElementById('heaven-canvas');
    const tooltip = document.getElementById('heaven-tooltip');
    const ctx = canvas.getContext('2d');

    // Configuración
    const treeW = 800; const treeH = 600;
    canvas.width = treeW; canvas.height = treeH;
    container.style.width = treeW + 'px'; container.style.height = treeH + 'px';
    ctx.clearRect(0, 0, treeW, treeH);
    container.innerHTML = '';

    // Importante: El canvas debe dejar pasar los clics
    canvas.style.pointerEvents = 'none';

    document.getElementById('heaven-antimatter').innerText = formatNumber(game.antimatter);
    document.getElementById('heaven-level').innerText = formatNumber(game.prestigeLevel);

    heavenlyConfig.forEach(node => {
        const isBought = game.heavenlyUpgrades.includes(node.id);
        const isAvailable = !isBought && (node.parents.length === 0 || node.parents.some(pid => game.heavenlyUpgrades.includes(pid)));

        // --- DIBUJAR LÍNEAS ---
        if (node.parents.length > 0) {
            node.parents.forEach(pid => {
                const parent = heavenlyConfig.find(p => p.id === pid);
                if (parent) {
                    ctx.beginPath();
                    ctx.moveTo(parent.x + 22, parent.y + 22);
                    ctx.lineTo(node.x + 22, node.y + 22);
                    ctx.strokeStyle = isBought ? '#651fff' : (isAvailable ? '#ffd700' : '#333');
                    ctx.lineWidth = isBought ? 3 : 1;
                    ctx.stroke();
                }
            });
        }

        // --- CREAR NODO ---
        const div = document.createElement('div');
        div.className = `heaven-node ${isBought ? 'bought' : (isAvailable ? 'available' : 'locked')}`;
        div.style.left = node.x + 'px';
        div.style.top = node.y + 'px';
        div.innerHTML = node.icon;

        // Tooltip logic
        div.onmouseenter = (e) => {
            const status = isBought ? "✅ COMPRADO" : (isAvailable ? `CLICK PARA COMPRAR` : "🔒 BLOQUEADO");
            const costTxt = isBought ? "" : `\nCoste: ${formatNumber(node.cost)} AM`;
            tooltip.innerHTML = `<strong style="color:#b388ff">${node.name}</strong><br>${node.desc}<br><br><span style="color:${isAvailable ? '#ffd700' : '#888'}">${status}${costTxt}</span>`;
            tooltip.style.display = 'block';

            const boxRect = document.querySelector('.heaven-modal-box').getBoundingClientRect();
            const nodeRect = div.getBoundingClientRect();
            tooltip.style.top = (nodeRect.bottom - boxRect.top + 10) + 'px';
            tooltip.style.left = (nodeRect.left - boxRect.left - 100) + 'px';
        };

        div.onmouseleave = () => { tooltip.style.display = 'none'; };

        // FIX DE CLIC: Asegurar que el evento se capture y no se propague
        div.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            buyHeavenlyUpgrade(node);
        };

        container.appendChild(div);
    });
}




function buyHeavenlyUpgrade(node) {
    // 1. Si ya está comprado, no hacer nada
    if (game.heavenlyUpgrades.includes(node.id)) return;

    // 2. Comprobar disponibilidad real
    const isAvailable = node.parents.length === 0 || node.parents.some(pid => game.heavenlyUpgrades.includes(pid));

    if (!isAvailable) {
        showNotification("🔒 BLOQUEADO", "Necesitas las mejoras previas.");
        return;
    }

    // 3. Comprobar saldo
    if (game.antimatter >= node.cost) {
        sfxBuy();
        game.antimatter -= node.cost;
        game.heavenlyUpgrades.push(node.id);

        // Feedback visual
        showNotification("✨ ACTIVADO", `${node.name} se ha fusionado con tu realidad.`);

        // RECALCULAR Y GUARDAR
        recalculateStats(); // <--- Crucial para que el bono funcione al instante
        renderHeavenTree();
        saveGame();
        updateUI();
    } else {
        showSystemModal("ANTIMATERIA INSUFICIENTE", `Necesitas ${formatNumber(node.cost - game.antimatter)} más para esta fusión.`, false, null);
    }
}

// Función final que se llama para volver al juego
window.finishAscension = function () {
    closeHeaven();
    // Aquí podrías añadir una animación de "Big Bang"
    location.reload(); // Recargar para aplicar cambios limpios
};













// ==========================================
// SISTEMA DE IMPORTAR / EXPORTAR
// ==========================================

window.exportSave = function () {
    saveGame();
    const jsonSave = JSON.stringify(game);
    const encodedSave = btoa(jsonSave);

    navigator.clipboard.writeText(encodedSave).then(() => {
        showSystemModal("✅ CÓDIGO COPIADO", "Tu código de guardado está en el portapapeles.\nGuárdalo en un lugar seguro.", false, null);
    }).catch(err => {
        prompt("Copia este código manualmente:", encodedSave);
    });
};


window.importSave = function () {
    const userCode = prompt("Pega aquí tu código de guardado:");
    if (!userCode) return;

    try {
        const decodedSave = atob(userCode);
        const loadedGame = JSON.parse(decodedSave);

        if (typeof loadedGame.cookies !== 'undefined') {
            // Fusionar con valores por defecto para evitar campos undefined
            let mergedGame = { ...game, ...loadedGame };

            // Inicialización de arrays/objetos críticos
            if (!mergedGame.upgrades) mergedGame.upgrades = [];
            if (!mergedGame.achievements) mergedGame.achievements = [];
            if (!mergedGame.helpers) mergedGame.helpers = [];
            if (!mergedGame.heavenlyUpgrades) mergedGame.heavenlyUpgrades = [];
            if (!mergedGame.buildings) mergedGame.buildings = {};
            if (!mergedGame.pearls) mergedGame.pearls = [];
            if (typeof mergedGame.totalClicks === 'undefined') mergedGame.totalClicks = 0;
            if (typeof mergedGame.prestigeLevel === 'undefined') mergedGame.prestigeLevel = mergedGame.antimatter || 0;

            // Migraciones futuras (ejemplo)
            // if (loadedGame.version && loadedGame.version < 1.1) { ... }

            game = mergedGame;
            game.prestigeMult = 1 + (game.prestigeLevel * 0.1);

            // Restaurar estado visual
            if (typeof game.isApocalypse !== 'undefined') isApocalypse = game.isApocalypse;
            else isApocalypse = false;

            saveGame();
            location.reload();
        } else {
            throw new Error("Formato inválido");
        }
    } catch (e) {
        showSystemModal("ERROR DE NÚCLEO", "El código introducido no es válido o está corrupto.", false, null);
        console.error(e);
    }
}




// ==========================================
// 📊 SISTEMA DE ESTADÍSTICAS (DEFINITIVO)
// ==========================================

// 1. Contador de tiempo (Protegido contra duplicados)
if (window.statsInterval) clearInterval(window.statsInterval);

window.statsInterval = setInterval(() => {
    if (typeof game !== 'undefined' && game) {
        if (!game.totalTimePlayed) game.totalTimePlayed = 0;
        game.totalTimePlayed++;
    }
}, 1000);

// 2. Abrir ventana
function openStats() {
    updateStats();
    const modal = document.getElementById('modal-stats');
    if (modal) modal.style.display = 'flex';
}

// 3. Cerrar ventana
function closeStats() {
    const modal = document.getElementById('modal-stats');
    if (modal) modal.style.display = 'none';
}

// 4. Renderizar datos
function updateStats() {
    if (typeof game === 'undefined' || !game) return;

    const timePlayed = game.totalTimePlayed || 0;
    const totalEnergy = game.totalCookiesEarned || 0;
    const clicks = game.totalClicks || 0;
    const anomalies = game.anomaliesClicked || 0;

    // Cálculo de tiempo
    let h = Math.floor(timePlayed / 3600);
    let m = Math.floor((timePlayed % 3600) / 60);
    let s = Math.floor(timePlayed % 60);
    const timeString = `${h}h ${m}m ${s}s`;

    const format = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();

    const html = `
        <p>Tiempo Jugado: <span style="color:#00e5ff">${timeString}</span></p>
        <p>Energía Total: <span style="color:#ffd700">${format(totalEnergy)}</span></p>
        <p>Clicks Totales: <span>${clicks.toLocaleString()}</span></p>
        <p>Anomalías detectadas: <span style="color:#ff0055">${anomalies}</span></p>
    `;

    const content = document.getElementById('stats-content');
    if (content) content.innerHTML = html;
}



// 5. EXPONER FUNCIONES AL HTML (¡ESTO ES LO QUE FALTABA!)
window.openStats = openStats;
window.closeStats = closeStats;

window.game = game;
// --- HACER PÚBLICAS LAS FUNCIONES DE ANDRÓMEDA ---
window.spawnMerchant = spawnMerchant;
window.openMerchantMenu = openMerchantMenu;
window.buyAndromedaBuilding = buyAndromedaBuilding;
window.startMerchantLoop = startMerchantLoop;


// ==========================================
// UI LOGROS (Attached to Window for HTML access)
// ==========================================

window.toggleAchievements = function () {
    const modal = document.getElementById('modal-achievements');
    if (!modal) return;

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
        sfxClick();
    } else {
        modal.style.display = 'flex';
        renderAchievements('all');
        sfxClick();
    }
};

// Estado global del filtro (para persistir entre toggles de "Ocultar bloqueados")
let currentAchFilter = 'all';

window.filterAchievements = function (type) {
    currentAchFilter = type;
    // Update tabs UI
    if (event && event.target) {
        document.querySelectorAll('.ach-tab').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
    }
    renderAchievements(); // Re-render con el nuevo filtro y el estado del checkbox
    sfxClick();
};

function renderAchievements(filterType) {
    // Si se pasa argumento (ej: al abrir modal), actualizar global
    if (filterType) currentAchFilter = filterType;

    const listContainer = document.getElementById('achievements-list');
    if (!listContainer) return;

    listContainer.innerHTML = ''; // Limpiar

    const hideLocked = document.getElementById('ach-hide-locked')?.checked || false;

    // 1. Filtrar lista (Tipo + Bloqueados)
    let list = achievementsConfig;

    // Filtro por Tab
    if (currentAchFilter !== 'all') {
        list = list.filter(a => a.type === currentAchFilter);
    }

    // Filtro "Ocultar Bloqueados"
    if (hideLocked) {
        list = list.filter(a => game.achievements.includes(a.id));
    }

    // 2. Ordenar: Desbloqueados primero
    list.sort((a, b) => {
        const aUnlocked = game.achievements.includes(a.id);
        const bUnlocked = game.achievements.includes(b.id);
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;
        return 0;
    });

    // 3. Renderizar listado vertical
    const fragment = document.createDocumentFragment();
    const renderLimit = 100; // Límite razonable para scroll suave
    let renderedCount = 0;

    list.forEach(ach => {
        if (renderedCount >= renderLimit) return;

        const unlocked = game.achievements.includes(ach.id);
        const row = document.createElement('div');
        row.className = `achievement-row ${unlocked ? 'unlocked' : 'locked'}`;

        // Icono
        let icon = '🏆';
        if (ach.type === 'energy') icon = '🔋';
        if (ach.type === 'click') icon = '👆';
        if (ach.type === 'building') icon = '🏗️';
        if (ach.type === 'cps') icon = '⚡';

        // Si está bloqueado, forzar icono de candado
        if (!unlocked) {
            icon = '🔒';
        }

        // Estructura de fila
        const rewardHTML = unlocked ? `<div class="ach-reward">Recompensa: ${ach.reward}</div>` : '';

        row.innerHTML = `
            <div class="ach-icon">${icon}</div>
            <div class="ach-info">
                <div class="ach-title">${ach.name}</div>
                <div class="ach-desc">${ach.desc}</div>
                ${rewardHTML}
            </div>
            <div class="ach-status">${unlocked ? '✓' : ''}</div>
        `;

        fragment.appendChild(row);
        renderedCount++;
    });

    // Botón "Cargar más" si hay muchos (simple aviso)
    if (list.length > renderLimit) {
        const more = document.createElement('div');
        more.style.padding = '10px';
        more.style.textAlign = 'center';
        more.style.color = '#666';
        more.innerText = `... y ${list.length - renderLimit} logros más ...`;
        fragment.appendChild(more);
    }

    listContainer.appendChild(fragment);

    // 4. Actualizar Stats
    const count = game.achievements.length;
    const total = achievementsConfig.length;

    const countEl = document.getElementById('ach-count');
    const bonusEl = document.getElementById('ach-bonus');

    if (countEl) countEl.innerText = `${count} / ${total}`;
    if (bonusEl) bonusEl.innerText = `Bonus: +${count}%`;
}
