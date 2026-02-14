import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ==========================================
// 1. SISTEMA DE AUDIO
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.2; 
masterGain.connect(audioCtx.destination);

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
    playTone(800 + Math.random()*200, 'sine', 0.1, 0.1); 
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

    // --- TIER ÉLITE: ANDRÓMEDA (Solo vía Comerciantes) ---
    { 
        id: 'andromeda_siphon', 
        name: 'Sifón de Vacío', 
        type: 'auto', 
        baseCost: 5000000000, // 5 Billones
        basePower: 1000000, 
        desc: 'Extrae energía del tejido espacial. Produce 1 MW/s.', 
        icon: '🕳️', 
        isAndromeda: true 
    },
    { 
        id: 'andromeda_bazar', 
        name: 'Bazar Galáctico', 
        type: 'auto', 
        baseCost: 25000000000, // 25 Billones
        basePower: 5000000, 
        desc: 'Sinergia comercial: +5% producción global por unidad.', 
        icon: '🏪', 
        isAndromeda: true 
    },
    { 
        id: 'andromeda_dyson', 
        name: 'Esfera Dyson Enana', 
        type: 'auto', 
        baseCost: 100000000000, // 100 Billones
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
    helpers: [] 
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

function startIntroSequence() {
    isIntroActive = true;
    document.body.classList.add('intro-mode');
    
    // 1. EL VACÍO ABSOLUTO
    if(mainObject) {
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
    if(introParticlesMesh) introParticlesMesh.material.opacity = 0;

    showIntroText("Detectando vacío cuántico...");
}

startMerchantLoop();

function handleIntroClick() {
    // Si ya hemos llegado al final, IGNORAR clicks extra para no romper la cinemática
    if (introClicks >= INTRO_TOTAL_CLICKS) return; 

    introClicks++;
    
    // Progreso de 0.0 a 1.0 basado en 100 clicks
    const progress = Math.min(1.0, introClicks / INTRO_TOTAL_CLICKS);
    
    // --- EFECTOS VISUALES ---
    if(mainObject) {
        // Temblor
        const shake = progress * 0.5; 
        mainObject.rotation.x += (Math.random()-0.5) * shake;
        mainObject.rotation.y += (Math.random()-0.5) * shake;

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
        if(introParticlesMesh) {
            introParticlesMesh.material.opacity = progress; 
            introParticlesMesh.rotation.y += 0.02 + (progress * 0.1); 
            introParticlesMesh.scale.setScalar(1.5 - (progress * 0.8)); 
        }
    }

    // --- NARRATIVA ---
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
    }, 1000);
}

function finishIntro() {
    // 1. Quitar partículas de intro inmediatamente
    if(typeof introParticlesMesh !== 'undefined' && introParticlesMesh) {
        scene.remove(introParticlesMesh);
        introParticlesMesh = null;
    }

    const el = document.getElementById('intro-text');
    if(el) el.style.opacity = 0;

    // SECUENCIA CINEMATOGRÁFICA
    setTimeout(() => {
        el.innerText = "“La energía no se crea ni se destruye...”";
        el.style.opacity = 1;
        
        setTimeout(() => {
            el.style.opacity = 0;
            setTimeout(() => {
                el.innerText = "“...solo se transforma.”";
                el.style.opacity = 1;
                
                setTimeout(() => {
                    el.style.opacity = 0;
                    setTimeout(() => {
                        el.innerText = "Aquí empieza tu imperio.";
                        el.style.color = "#00ff88"; 
                        el.style.opacity = 1;

                        // --- EL FLASH ---
                        setTimeout(() => {
                            const flash = document.createElement('div');
                            flash.className = 'flash-bang';
                            document.body.appendChild(flash);
                            
                            playTone(50, 'sine', 3.0); 
                            sfxAnomaly(); 

                            // TRANSICIÓN AL JUEGO (Muy rápida tras el flash)
                            setTimeout(() => {
                                isIntroActive = false;
                                document.body.classList.remove('intro-mode');
                                if(el) el.innerText = "";
                                
                                // Restaurar Bola Verde
                                if(mainObject) {
                                    mainObject.material.color.setHex(0x00ff88); 
                                    mainObject.material.emissive.setHex(0x004422);
                                    mainObject.material.emissiveIntensity = 0.5;
                                    mainObject.scale.setScalar(1);
                                    mainObject.rotation.set(0,0,0);
                                }
                                if(glowMesh) {
                                    glowMesh.visible = true;
                                    glowMesh.material.opacity = 1;
                                    glowMesh.scale.setScalar(1.2);
                                }

                                // Mostrar Estrellas ahora
                                if (typeof starMesh !== 'undefined' && starMesh) {
                                    starMesh.visible = true;
                                }

                                saveGame();
                                setTimeout(spawnAnomaly, 10000);

                            }, 150); // 150ms después del flash blanco

                            // Limpiar el flash del DOM
                            setTimeout(() => {
                                if(flash && flash.parentNode) flash.remove();
                            }, 2000);

                        }, 3000); // Leer frase final
                    }, 1500);
                }, 4000); // Leer frase 2
            }, 1500); 
        }, 4000); // Leer frase 1
    }, 1000); 
}


function triggerOmegaFinalAnimation() {
    isIntroActive = true; // Bloqueamos interacciones
    const duration = 5000; // 5 segundos
    const startTime = Date.now();

    // 1. Efecto de sonido inicial (Estruendo)
    playTone(40, 'sawtooth', 4.0, 0.5);
    playTone(100, 'sine', 5.0, 0.3);

    const omegaInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        if (progress >= 1) {
            clearInterval(omegaInterval);
            finishOmegaEvent(); // Función que limpia y da la perla
            return;
        }

        // --- EFECTOS EN EL NÚCLEO (Three.js) ---
        if (mainObject && glowMesh) {
            // Vibración violenta in crescendo
            mainObject.position.x = (Math.random() - 0.5) * progress * 2;
            mainObject.position.y = (Math.random() - 0.5) * progress * 2;
            
            // La malla de brillo se expande descontroladamente
            glowMesh.scale.setScalar(1.2 + progress * 5);
            glowMesh.material.opacity = Math.sin(Date.now() * 0.05); // Parpadeo epiléptico
            
            // Cambio de color a blanco incandescente
            mainObject.material.emissiveIntensity = progress * 10;
            mainObject.material.color.lerp(new THREE.Color(0xffffff), 0.1);
        }

        // --- EFECTOS DE CÁMARA ---
        camera.position.z = 8 - (progress * 4); // La cámara se acerca al colapso
        camera.rotation.z += progress * 0.2; // La realidad se tuerce

        // --- EFECTOS DE PANTALLA (Glitch visual) ---
        if (Math.random() > 0.9) {
            document.body.style.filter = `invert(1) hue-rotate(${Math.random() * 360}deg)`;
        } else {
            document.body.style.filter = "none";
        }

    }, 1000 / 60); // 60 FPS
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
    mainObject.position.set(0,0,0);
    mainObject.scale.setScalar(1);
    camera.position.set(0,0,8);
    camera.rotation.set(0,0,0);
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
    // TIER 1 (PRINCIPIANTE - INFRAESTRUCTURA)
    { 
        id: 'h_clicker',
        quotes: ["La transferencia cinética es estable. Sigue pulsando, cada Watt cuenta.", "He ajustado los condensadores manuales. ¡Siento el flujo!"],
        name: '👩‍🔬 Dra. Aris Thorne', 
        desc: 'Teórica de Campos. Optimiza la transferencia cinética: Pulsos manuales +300%.', 
        cost: 15, icon: '👩‍🔬', 
        reqLevel: 5, 
        effect: 'clickPower', value: 3 
    },
    { 
        id: 'h_miner',
        quotes: ["He parcheado una fuga en el sector 4. La producción automática ha subido.", "¿Ves ese zumbido? Es el sonido de la eficiencia pura."], 
        name: '👨‍💻 Ing. Marcus Voltz', 
        desc: 'Arquitecto de Red. Maximiza el flujo constante de los generadores automáticos (+50% W/s).', 
        cost: 50, icon: '👨‍💻', 
        reqLevel: 10, 
        effect: 'cpsMultiplier', value: 1.5 
    },
    
    // TIER 2 (INTERMEDIO - LOGÍSTICA)
    { 
        id: 'h_discount',
        quotes: ["He conseguido materiales de grafeno a mitad de precio. Es hora de construir.", "La logística galáctica es un arte. Hoy los reactores salen baratos."],
        name: '👔 Silas Vane', 
        desc: 'Logista Cuántico. Negocia contratos de suministros: Estructuras -10% de coste.', 
        cost: 100, icon: '👔', 
        reqLevel: 15, 
        effect: 'costReduction', value: 0.9 
    },
    { 
        id: 'h_combo',
        quotes: ["He estabilizado el campo temporal. El combo no se irá a ninguna parte.", "Mantén el ritmo, estoy desviando el exceso de calor para alargar el pico."],
        name: '👩‍⚡ Dra. Elena Flux', 
        desc: 'Especialista en Transitorios. Estabiliza picos de energía: Combos duran x2 tiempo.', 
        cost: 200, icon: '👩‍⚡', 
        reqLevel: 20, 
        effect: 'comboTime', value: 2 
    },

    // TIER 3 (AVANZADO - INVESTIGACIÓN)
    { 
        id: 'h_anomaly',
        quotes: ["Mis escáneres detectan una fluctuación cuántica inminente... ¡atento!", "El vacío nos está susurrando. Una anomalía está a punto de cruzar."],
        name: '🕵️‍♂️ Dorian Nox', 
        desc: 'Analista de Vacío. Sensores de largo alcance: Anomalías aparecen x2 rápido.', 
        cost: 500, icon: '🕵️‍♂️', 
        reqLevel: 30, 
        effect: 'anomalyRate', value: 2 
    },
    { 
        id: 'h_crit',
        quotes: ["¡Fuego a discreción! He cargado el núcleo con munición de alto impacto.", "Si golpeas en el ángulo de 45 grados, la energía se multiplica por diez."],
        name: '👮‍♂️ Sargento Kael', 
        desc: 'Seguridad de Red. Protocolos de choque: 10% probabilidad de Pulso Crítico (x10).', 
        cost: 800, icon: '👮‍♂️', 
        reqLevel: 40, 
        effect: 'critChance', value: 0.1 
    },

    // TIER 4 (EXPERTO - GESTIÓN)
    { 
        id: 'h_efficiency',
        quotes: ["He optimizado los disipadores. El equipo puede trabajar más por menos.", "La entropía es nuestra enemiga, pero mis cálculos la mantienen a raya."],
        name: '🔬 Dra. Sarah Joule', 
        desc: 'Termodinámica Sénior. Disipación de calor: Mantenimiento del Staff -40% Watts.', 
        cost: 1500, 
        icon: '🔬', 
        reqLevel: 60, 
        effect: 'helperMaintenance', 
        value: 0.6 
    },
    { 
        id: 'h_banker',
        quotes: ["El mercado energético está al alza. Es el momento de captar anomalías.", "He vendido el excedente de Watts en el mercado negro. ¡Más capital para ti!"],
        name: '📉 Victor "Broker" Ray', 
        desc: 'Especulador Energético. Arbitraje de mercado: Anomalías de capital dan +50%.', 
        cost: 2000, icon: '📉', 
        reqLevel: 65, 
        effect: 'goldenCookieBuff', value: 1.5 
    },

    // TIER 5 (MAESTRO - INTELIGENCIA ARTIFICIAL)
    { 
        id: 'h_synergy',
        quotes: ["Análisis completado: Cada estructura añadida mejora mi capacidad de cálculo.", "Unidad detectada. Integrando eficiencia estructural en el sistema central."], 
        name: '🤖 IA "Mente Enlazada"', 
        desc: 'Integración Sintética. Gestión total: +1% W/s por cada estructura desplegada.', 
        cost: 5000, icon: '🤖', 
        reqLevel: 80, 
        effect: 'buildingSynergy', value: 0.01 
    },
    { 
        id: 'h_master', 
        name: '👨‍💼 Director Cipher', 
        desc: 'Administrador General. Ejecuta el Protocolo Dios: Potencia Global x2.0.', 
        cost: 10000, icon: '👨‍💼', 
        reqLevel: 100, 
        effect: 'globalMultiplier', value: 2.0 
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
    
    for(let i = 0; i < count * 3; i++) {
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
    bloomPass.threshold = 0.1; bloomPass.strength = 1.2; bloomPass.radius = 0.5;
    
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
    for(let i=0; i<count*3; i++) {
        positions[i] = (Math.random() - 0.5) * 60;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({color: 0xffffff, size: 0.05, transparent: true, opacity: 0.8});
    starMesh = new THREE.Points(starGeo, starMat);
    scene.add(starMesh);
}


function onCanvasClick(e) {
    // 1. Activar audio si es el primer click
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // 2. Calcular posición del ratón para Raycaster (3D)
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // 3. Comprobar si ha tocado la esfera
    const intersects = raycaster.intersectObject(mainObject);

    if (intersects.length > 0) {
        
        // --- 🛑 INTERCEPCIÓN DEL MODO INTRO ---
        if (isIntroActive) {
            handleIntroClick(); // Avanza la historia
            
            // Efecto visual sutil (solo partículas, sin sacudida fuerte)
            spawnParticles(intersects[0].point);
            sfxClick(); 
            
            // IMPORTANTE: 'return' para que NO ejecute la lógica normal de dinero
            return; 
        }
        // ---------------------------------------

        // 4. LÓGICA DE JUEGO NORMAL
        doClickLogic(e.clientX, e.clientY);
        
        // Efecto Shake (Temblor de cámara)
        camera.position.x = (Math.random() - 0.5) * 0.2; 
        camera.position.y = (Math.random() - 0.5) * 0.2;
        
        // Efecto Latido (La bola se encoge)
        mainObject.scale.setScalar(0.9);
        glowMesh.scale.setScalar(0.95);
        
        setTimeout(() => {
            mainObject.scale.setScalar(1);
            glowMesh.scale.setScalar(1);
        }, 80);

        // Partículas
        spawnParticles(intersects[0].point);
    }
}




function applyHeavenlyUpgrades() {
    // 1. Mejora Génesis: Watts iniciales
    if (game.heavenlyUpgrades.includes('genesis') && game.cookies < 100) {
        game.cookies = 100;
    }

    // 2. Kit de Supervivencia: Edificios gratis al empezar
    if (game.heavenlyUpgrades.includes('starter_kit') && !game.starterKitClaimed) {
        game.buildings.h_hamster = (game.buildings.h_hamster || 0) + 5;
        game.buildings.b_manual_gen = (game.buildings.b_manual_gen || 0) + 10;
        game.starterKitClaimed = true; // Variable para que no se repita cada segundo
    }

    // 3. Eficiencia Industrial: Multiplicador permanente
    // Esta se usa dentro de getCPS(), asegúrate de multiplicar el resultado por 1.15
}









function spawnAlien() {
    // 🛑 CORRECCIÓN CRÍTICA: Miramos 'heavenlyUpgrades', no 'upgrades' normales
    // Y usamos el ID correcto: 'alien_contact'
    if (!game.heavenlyUpgrades.includes('alien_contact')) return;
    
    // Evitar duplicados
    if (document.getElementById('active-alien')) return;
    if (typeof isIntroActive !== 'undefined' && isIntroActive) return;

    // Seleccionar tipo según probabilidad
    const rand = Math.random();
    let type = 'green';
    
    // Solo salen los fuertes si tienes ciertas mejoras de tecnología alienígena (que crearemos luego)
    // O si tienes mucha suerte base
    if (rand > 0.95) type = 'red';
    else if (rand > 0.8) type = 'yellow';

    const config = alienTypes[type];
    let clicksLeft = config.clicks;

    const alien = document.createElement('div');
    alien.id = 'active-alien';
    alien.className = 'alien-invader';
    alien.innerHTML = `
        <div class="alien-icon" style="font-size: 4rem;">${config.icon}</div>
        <div class="alien-hp-bar"><div class="alien-hp-fill"></div></div>
    `;

    // Posición inicial aleatoria
    alien.style.cssText = `
        position: absolute; 
        left: ${Math.random() * 80 + 10}%; 
        top: ${Math.random() * 80 + 10}%; 
        z-index: 5000; 
        transition: top 1s, left 1s; /* Movimiento suave */
        filter: drop-shadow(0 0 10px ${config.color});
        cursor: crosshair;
        user-select: none;
    `;

    document.getElementById('game-area').appendChild(alien);

    // Sonido de llegada
    if(typeof sfxAnomaly === 'function') sfxAnomaly();

    // Movimiento: El alien se mueve cada segundo
    const moveInterval = setInterval(() => {
        if(!alien.parentNode) { clearInterval(moveInterval); return; }
        alien.style.left = `${Math.random() * 80 + 10}%`;
        alien.style.top = `${Math.random() * 80 + 10}%`;
    }, 1000);

    alien.onclick = (e) => {
        e.stopPropagation();
        clicksLeft--;
        
        // Sonido de impacto diferente al click normal
        if(typeof playTone === 'function') playTone(200 + (clicksLeft*20), 'sawtooth', 0.05, 0.2);
        
        // Efecto visual de daño
        alien.querySelector('.alien-icon').style.transform = `scale(0.9) rotate(${Math.random()*20-10}deg)`;
        setTimeout(() => {
             if(alien.parentNode) alien.querySelector('.alien-icon').style.transform = 'scale(1) rotate(0deg)'; 
        }, 50);
        
        // Actualizar barra de HP
        const fill = alien.querySelector('.alien-hp-fill');
        if(fill) fill.style.width = `${(clicksLeft / config.clicks) * 100}%`;

        // MUERTE DEL ALIEN
        if (clicksLeft <= 0) {
            clearInterval(moveInterval);
            
            // Recompensa basada en tu producción actual (CPS)
            const reward = getCPS() * config.reward * 10; // x10 para que valga la pena
            game.cookies += reward;
            game.totalCookiesEarned += reward;
            
            createFloatingText(e.clientX, e.clientY, `¡AMENAZA NEUTRALIZADA! +${formatNumber(reward)}`, true);
            
            // Posibilidad de soltar "Tecnología Alien" (Mejora gratis o descuento)
            if (Math.random() < 0.3) {
                 showNotification("📦 DROP", "El alien dejó caer chatarra útil.");
                 // Aquí podrías dar un bono extra
            }

            alien.remove();
            updateUI();
        }
    };

    // Si no lo matas en 25 segundos, huye
    setTimeout(() => {
        if (alien.parentNode) {
            clearInterval(moveInterval);
            alien.style.opacity = '0';
            setTimeout(() => alien.remove(), 500);
            showNotification("💨 ESCAPE", "El visitante ha escapado.");
        }
    }, 25000);
}




function spawnParticles(pos) {
    for(let i=0; i<6; i++) {
        const mesh = new THREE.Mesh(particleGeo, particleMat);
        mesh.position.copy(pos);
        mesh.userData.vel = new THREE.Vector3(
            (Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)+0.5
        ).normalize().multiplyScalar(Math.random() * 0.2);
        scene.add(mesh);
        particles.push(mesh);
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
        if(scene.fog) scene.fog.color.setHex(0x110000);
        camera.position.x += (Math.random() - 0.5) * 0.05;
        camera.position.y += (Math.random() - 0.5) * 0.05;

    } else {
        // --- MODO NORMAL / POST-BUFF (CORREGIDO) ---
        let targetColor = new THREE.Color(0x00ff88); 
        let targetEmissive = new THREE.Color(0x004422);
        let targetGlow = new THREE.Color(0x7c4dff);

        // Si NO hay buff activo, evolucionamos color por Watts
        if (buffMultiplier === 1 && clickBuffMultiplier === 1) {
            if (totalWatts >= 1000) { // Kilowatt
                targetColor.setHex(0xffaa00); targetEmissive.setHex(0xff4400); targetGlow.setHex(0xffcc00);
            }
            if (totalWatts >= 1000000) { // Megawatt
                targetColor.setHex(0x00e5ff); targetEmissive.setHex(0x0044aa); targetGlow.setHex(0x00ffff);
            }
            if (totalWatts >= 1000000000) { // Gigawatt
                targetColor.setHex(0x9900ff); targetEmissive.setHex(0x220044); targetGlow.setHex(0xff00ff);
            }
        } else {
            // MIENTRAS EL BUFF ESTÁ ACTIVO: Colores temáticos
            if (buffMultiplier > 1) { // Producción (Naranja/Fuego)
                targetColor.setHex(0xff5500); targetEmissive.setHex(0xff2200);
            } else if (clickBuffMultiplier > 1) { // Clicks (Cian Eléctrico)
                targetColor.setHex(0x00ffff); targetEmissive.setHex(0x0088ff);
            }
        }

        // Aplicamos los colores suavemente con LERP
        mainObject.material.color.lerp(targetColor, 0.05);
        mainObject.material.emissive.lerp(targetEmissive, 0.05);
        glowMesh.material.color.lerp(targetGlow, 0.05);
        
        // Suavizar escala de vuelta a la normalidad (Latido)
        const pulse = 1 + Math.sin(time * 2) * 0.03;
        mainObject.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.1);
        
        if(scene.fog) scene.fog.color.lerp(new THREE.Color(0x000000), 0.1);
    } // <-- Aquí se cierra correctamente el bloque Else de Apocalipsis
    
    // --- C. FONDO DE ESTRELLAS (HIPERESPACIO) ---
    if (starMesh && starMesh.geometry) {
        const positions = starMesh.geometry.attributes.position.array;
        let starSpeed = isApocalypse ? 0.5 : 0.05 + Math.min(1.5, cps * 0.0005); 
        
        // Aceleración por Buff
        if (buffMultiplier > 1 || clickBuffMultiplier > 1) starSpeed += 0.8;

        for(let i=0; i < positions.length; i+=3) {
            positions[i+2] += starSpeed;
            if (isApocalypse) { positions[i] *= 0.98; positions[i+1] *= 0.98; }
            if(positions[i+2] > 20) {
                positions[i+2] = -40;
                if (isApocalypse) {
                    positions[i] = (Math.random() - 0.5) * 60;
                    positions[i+1] = (Math.random() - 0.5) * 60;
                }
            }
        }
        starMesh.geometry.attributes.position.needsUpdate = true;
    }

    // --- G. VIBRACIÓN POR BUFFS ---
    if (buffMultiplier > 1 || clickBuffMultiplier > 1) {
        const intensity = clickBuffMultiplier > 1 ? 0.12 : 0.05;
        mainObject.position.x = (Math.random() - 0.5) * intensity;
        mainObject.position.y = (Math.random() - 0.5) * intensity;
    } else {
        mainObject.position.lerp(new THREE.Vector3(0,0,0), 0.1); 
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
    // Suavizado de cámara general
    camera.position.lerp(new THREE.Vector3(0,0,8), 0.05);
    composer.render();
}


// Función auxiliar para limpiar el código (Pon esto fuera)
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.userData.vel);
        p.scale.multiplyScalar(0.92); 
        
        if(p.scale.x < 0.01) { 
            // Eliminar de escena y memoria
            scene.remove(p);
            if(p.geometry) p.geometry.dispose();
            if(p.material) p.material.dispose();
            particles.splice(i, 1); 
        }
    }
}


function onResize() {
    const canvas = document.getElementById('three-canvas');
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    camera.aspect = w/h; camera.updateProjectionMatrix();
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
    sfxBuy(); // Reutilizamos sonido de compra o uno especial
    
    // Premio: 5 minutos de producción actual (por ejemplo)
    const reward = getWps() * 300; 
    game.cookies += reward;
    game.anomaliesClicked = (game.anomaliesClicked || 0) + 1;

    showNotification("👾 ANOMALÍA ESTABILIZADA", `+${formatNumber(reward)} Energía detectada`);
    
    // Efecto visual de partículas en la posición del ratón
    createFloatingText(window.innerWidth/2, window.innerHeight/2, "¡ESTABLE!", true);
    
    updateUI();
}










function spawnAnomaly() {
    // 1. Limpiar cualquier temporizador anterior para evitar que se acumulen
    if (anomalyTimeout) clearTimeout(anomalyTimeout);

    // 2. Escudo de Intro (Si está en la intro, espera 5s y reintenta)
    if (typeof isIntroActive !== 'undefined' && isIntroActive) {
        anomalyTimeout = setTimeout(spawnAnomaly, 5000);
        return;
    }

    // 3. Lógica de selección de tipo
    const types = ['money', 'money', 'production', 'production', 'production', 'click', 'click']; 
    const type = types[Math.floor(Math.random() * types.length)];
    const isCorrupt = isApocalypse && Math.random() < 0.3;
    
    // 4. Crear el Orbe
    const orb = document.createElement('div');
    let icon = '⚛️'; let color = 'gold';
    
    if (isCorrupt) { icon = '👁️'; color = '#ff0000'; }
    else if (type === 'production') { icon = '⚡'; color = '#ffaa00'; }
    else if (type === 'click') { icon = '🖱️'; color = '#00ff88'; }

    orb.className = 'anomaly-object'; 
    orb.innerHTML = icon;
    orb.style.cssText = `
        position: absolute; font-size: 3.5rem; cursor: pointer; z-index: 2000; 
        filter: drop-shadow(0 0 15px ${color}); 
        left: ${Math.random() * 80 + 10}%; top: ${Math.random() * 80 + 10}%;
        user-select: none; transition: opacity 0.5s;
    `;

    // --- CLICK EN LA ANOMALÍA ---
    orb.onclick = function(e) {
        e.stopPropagation(); 
        sfxAnomaly();
        
        if (type === 'money' || isCorrupt) {
            // Lógica de dinero normal o corrupto (se mantiene igual)
            let gain = getCPS() * 1200;
            game.cookies += gain;
            showAnomalyPopup(`+${formatNumber(gain)} Watts`);
        } 
        else if (type === 'production') {
            // X7 DURANTE 10 SEGUNDOS
            activateBuff('production', 7, 10);
            showAnomalyPopup(`⚡ SOBRECARGA: x7 (10s)`);
        } 
        else if (type === 'click') {
            // X777 DURANTE 7 SEGUNDOS
            activateBuff('click', 777, 7);
            showAnomalyPopup(`🖱️ CLICKSTORM: x777 (7s)`);
        }

        this.remove(); 
        updateUI();
    };

    document.getElementById('game-area').appendChild(orb);
    
    // Desaparecer si no se clica en 15 segundos
    setTimeout(() => { if(orb.parentNode) orb.remove(); }, 15000);

    // 5. PROGRAMAR SIGUIENTE APARICIÓN: EXACTAMENTE 60 SEGUNDOS
    // Usamos la variable global para que no se dupliquen hilos
    anomalyTimeout = setTimeout(spawnAnomaly, 60000);
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

    // Guardamos cuándo terminará para la barra de progreso
    buffDuration = seconds * 1000;
    buffEndTime = Date.now() + buffDuration;

    if (type === 'production') {
        buffMultiplier = amount;
        document.body.classList.add('buff-active-prod');
    } else {
        clickBuffMultiplier = amount;
        document.body.classList.add('buff-active-click');
    }
    
    // Efecto de impacto en la bola
    if(mainObject) mainObject.scale.setScalar(2.5);

    buffTimeout = setTimeout(() => {
        // RESET TOTAL
        buffMultiplier = 1;
        clickBuffMultiplier = 1;
        buffEndTime = 0;
        
        // Quitar clases visuales
        document.body.classList.remove('buff-active-prod', 'buff-active-click');
        const gameArea = document.getElementById('game-area');
        if(gameArea) gameArea.style.boxShadow = "none";
        
        // Forzar a la bola a volver al centro
        if(mainObject) mainObject.position.set(0,0,0);

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

    // 1. CÁLCULO BASE DE EDIFICIOS
    buildingsConfig.forEach(u => {
        if (u.type === 'auto') {
            let count = game.buildings[u.id] || 0; 
            let bPower = count * u.currentPower;
            
            // Sinergia: Red Neuronal
            if (u.id === 'mine' && game.upgrades?.includes('grandma-mine-synergy')) { 
                const grandmaCount = game.buildings['grandma'] || 0; 
                bPower *= (1 + (grandmaCount * 0.01));
            }
            cps += bPower;
        }
    });

    // 2. MULTIPLICADORES GLOBALES (PRESTIGIO)
    let total = cps * game.prestigeMult;
    
    // 3. AYUDANTES Y ÉLITE
    const prodHelper = helpersConfig.find(h => h.effect === 'cpsMultiplier');
    if (prodHelper && game.helpers.includes(prodHelper.id)) total *= prodHelper.value;

    const synergyHelper = helpersConfig.find(h => h.effect === 'buildingSynergy');
    if (synergyHelper && game.helpers.includes(synergyHelper.id)) {
        const totalBuildings = Object.values(game.buildings).reduce((a, b) => a + b, 0);
        total *= (1 + (totalBuildings * synergyHelper.value));
    }

    // Mejoras de Sincronía y Protocolo Maestro
    game.helpers.forEach(helperId => {
        if (game.upgrades.includes(`upg_power_${helperId}`)) total *= 1.25; 
        if (game.upgrades.includes(`upg_master_${helperId}`)) {
            if (helperId === 'h_clicker') total *= 1.15;
            if (helperId === 'h_miner') total *= 1.50;
            if (helperId === 'h_discount') total *= 1.10;
        }
    });

    // 4. CADENA OMEGA
    if (game.upgrades.includes('protocol-omega')) total *= 1.2;
    if (game.upgrades.includes('omega-phase-2')) total *= 1.5;
    if (game.upgrades.includes('omega-phase-3')) total *= 2.0;
    if (game.upgrades.includes('omega-phase-4')) total *= 3.0;
    if (game.upgrades.includes('omega-final')) total *= 5.0;

    // 5. ÁRBOL DE ASCENSIÓN (MEJORADO)
    if (game.heavenlyUpgrades.includes('perm_prod_1')) total *= 1.15;
    
    // Cerebro Galáctico: +2% por logro
    if (game.heavenlyUpgrades.includes('galaxy_brain')) {
        const achievementBonus = 1 + (game.achievements.length * 0.02);
        total *= achievementBonus;
    }
    
    // Sinergia Estructural
    if (game.heavenlyUpgrades.includes('synergy_passive')) {
        const totalBuildings = Object.values(game.buildings).reduce((a, b) => a + b, 0);
        const stacks = Math.floor(totalBuildings / 50);
        if (stacks > 0) total *= (1 + (stacks * 0.10));
    }

    // NUEVO: Bonus de Singularidad (Multiplicador por Aliens capturados)
    if (game.heavenlyUpgrades.includes('singularity')) {
        total *= 1.5; // Bonus fijo por alcanzar el fin del árbol
    }

    if (game.heavenlyUpgrades.includes('dark_matter_engine')) total *= 2.0;
    if (game.heavenlyUpgrades.includes('multiverse')) total *= 2.0;

    // 6. MULTIPLICADORES TEMPORALES
    if (isOvercharged) total *= 5; 
    if (game.activePearl === 'red') total *= 10; 
        // Añade esto al final de getCPS antes del return
    if (game.buildings.andromeda_dyson > 0) {
        total *= Math.pow(1.1, game.buildings.andromeda_dyson);
    }
    if (game.buildings.andromeda_bazar > 0) {
        total *= (1 + (game.buildings.andromeda_bazar * 0.05));
    }
    
    return total * buffMultiplier; 
}





function getNetCPS() {
    const grossCPS = getCPS();
    const helperCost = getHelpersCost();
    return Math.max(0, grossCPS - helperCost);
}

function getHelpersCost() {
    let totalCost = 0;
    game.helpers.forEach(helperId => {
        const helper = helpersConfig.find(h => h.id === helperId);
        if (helper) totalCost += helper.cost;
    });

    // --- NUEVA LÓGICA DE DESCUENTO ---
    const efficiencyHelper = helpersConfig.find(h => h.effect === 'helperMaintenance');
    if (efficiencyHelper && game.helpers.includes(efficiencyHelper.id)) {
        totalCost *= efficiencyHelper.value; // Multiplica por 0.6 (descuento del 40%)
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
    
    if (game.activePearl === 'green') cost *= 0.5;
    return cost;
}

function recalculateStats() {
    buildingsConfig.forEach(b => b.currentPower = b.basePower);
    game.upgrades.forEach(uid => {
        const [bid] = uid.split('-');
        const b = buildingsConfig.find(i => i.id === bid);
        if(b) b.currentPower *= 2;
    });
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
window.buyBuilding = function(id) {
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
window.buyUpgrade = function(upgradeId, cost) {
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





window.toggleHelper = function(helperId) {
    const helper = helpersConfig.find(h => h.id === helperId);
    if (!helper) return;
    
    // Calcular nivel actual del jugador
    const playerLevel = Math.floor(Math.cbrt(game.totalCookiesEarned));
    
    if (playerLevel < helper.reqLevel) return;

    const isActive = game.helpers.includes(helperId);
    
    if (isActive) {
        // --- DESACTIVAR ---
        // Usamos filter para quitarlo de la lista
        game.helpers = game.helpers.filter(id => id !== helperId);
        showNotification("❌ Ayudante Despedido", `${helper.name} ha vuelto a su planeta.`);
    } else {
        // --- ACTIVAR ---
        
        // 1. ¿Hay hueco?
        if (game.helpers.length >= MAX_HELPERS) {
            showSystemModal(
                "NAVE LLENA", 
                `Solo tienes ${MAX_HELPERS} asientos disponibles.\nDebes despedir a alguien antes.`, 
                false
            );
            return;
        }

        // 2. ¿Puedes pagar su sueldo?
        // (Asumimos que los ayudantes restan CPS o requieren un flujo positivo)
        const currentCPS = getCPS();
        const currentHelperCost = getHelpersCost(); 
        
        if (currentCPS - currentHelperCost < helper.cost) {
            showSystemModal(
                "SIN FONDOS",
                `Tu imperio no genera suficiente energía.\nCoste: ${helper.cost}/seg`,
                false
            );
            return;
        }
        
        // ¡Contratado!
        game.helpers.push(helperId);
        
        // --- AQUÍ COMPROBAMOS LA MISIÓN DE LA PERLA VERDE ---
        checkGreenPearlMission(); // <--- IMPORTANTE: Chequear si ya tienes los 4 últimos
        // ----------------------------------------------------

        sfxPrestige(); 
        showNotification("✅ Ayudante Equipado", `${helper.name} se ha unido al equipo.`);
    }
    
    // --- FINALIZAR ---
    renderHelpers();
    updateUI();
    
    // --- IMPORTANTE: RECALCULAR ESTADÍSTICAS ---
    // Si no pones esto, el CPS no cambiará hasta que compres un edificio o hagas click.
    recalculateStats(); // <--- IMPRESCINDIBLE
};




function epicBluePearlScene() {
    console.log("Escena épica de la Perla Azul activada");
    
    // 1. Bloqueo y Estética
    isIntroActive = true; // Usamos tu variable global para bloquear clicks
    document.body.classList.add('blue-glitch');
    
    // Sonido inicial: Impacto temporal
    playTone(1200, 'sine', 0.5, 0.2);
    setTimeout(() => playTone(1800, 'sine', 0.5, 0.2), 200);
    
    // 2. Explosión masiva de partículas (Tu código mejorado)
    for(let i=0; i<300; i++) { // Aumentamos a 300
        const mesh = new THREE.Mesh(
            particleGeo,
            new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true })
        );
        mesh.position.copy(mainObject.position);
        mesh.userData.vel = new THREE.Vector3(
            (Math.random()-0.5)*2,
            (Math.random()-0.5)*2,
            (Math.random()-0.5)*2
        ).normalize().multiplyScalar(Math.random()*0.8 + 0.3); // Más rápidas
        scene.add(mesh);
        particles.push(mesh);
    }

    // 3. BUCLE DE ANIMACIÓN (Los 5 segundos de locura)
    const startTime = Date.now();
    const duration = 5000;

    const blueInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        if (progress >= 1) {
            clearInterval(blueInterval);
            finishBlueScene(); // Limpieza final
            return;
        }

        // --- DISTORSIÓN THREE.JS ---
        if (mainObject && glowMesh) {
            // El núcleo vibra y crece
            const pulse = 1 + Math.sin(Date.now() * 0.05) * (0.2 * progress);
            mainObject.scale.setScalar(pulse);
            
            // Colores cian eléctricos
            mainObject.material.color.lerp(new THREE.Color(0x00e5ff), 0.1);
            mainObject.material.emissive.lerp(new THREE.Color(0x003366), 0.1);
            
            // La malla gira como un ventilador descontrolado
            glowMesh.rotation.y += 0.5 * progress;
            glowMesh.rotation.z += 0.2;
            glowMesh.scale.setScalar(pulse * 1.4);
        }

        // --- CÁMARA (Efecto Vértigo) ---
        camera.position.z = 8 - (Math.sin(progress * Math.PI) * 3); // Se acerca y aleja
        camera.fov = 50 + (progress * 30); // Deformación de lente
        camera.updateProjectionMatrix();

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
    camera.position.set(0,0,8);
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
    // 1. Limpiamos cualquier temporizador anterior para evitar duplicados
    if (alienLoopTimeout) clearTimeout(alienLoopTimeout);

    // 2. Definimos el rango de tiempo (en milisegundos)
    // Por defecto: Entre 1.5 y 2.5 minutos (Promedio: 2 minutos)
    let minTime = 90000;  // 90 segundos
    let maxTime = 150000; // 150 segundos

    // 3. Si tienes la mejora 'Tecnología de Rapto', aparecen más seguido (Promedio: 1 min)
    if (game.heavenlyUpgrades.includes('abduction_tech')) {
        minTime = 45000; // 45 segundos
        maxTime = 75000; // 75 segundos
    }

    // 4. Calculamos el tiempo aleatorio para ESTA aparición
    const randomDelay = Math.floor(Math.random() * (maxTime - minTime + 1) + minTime);
    
    // console.log(`👽 Próximo alien en: ${Math.round(randomDelay/1000)}s`); 

    // 5. Programamos la aparición
    alienLoopTimeout = setTimeout(() => {
        // Solo si tenemos la mejora de Primer Contacto comprada
        if (game.heavenlyUpgrades.includes('alien_contact')) {
            spawnAlien();
        }
        
        // Reiniciamos el ciclo para el siguiente alien
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




function renderHelpers() {
    const container = document.getElementById('helpers-list');
    if (!container) return;
    
    container.innerHTML = '';

    // CABECERA
    const header = document.createElement('div');
    const slotsColor = game.helpers.length >= MAX_HELPERS ? '#ff5252' : '#00ff88';
    header.style.cssText = "padding: 10px; margin-bottom: 10px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;";
    header.innerHTML = `
        <span style="color:#aaa; font-size:0.9rem;">EQUIPO ACTIVO</span>
        <span style="color: ${slotsColor}; font-weight: bold; font-size: 1.1rem;">
            ${game.helpers.length} / ${MAX_HELPERS}
        </span>
    `;
    container.appendChild(header);
    
    const currentCPS = getCPS();
    const currentHelperCost = getHelpersCost();
    const playerLevel = Math.floor(Math.cbrt(game.totalCookiesEarned)); 
    
    helpersConfig.forEach(helper => {
        const isActive = game.helpers.includes(helper.id);
        const isLocked = playerLevel < helper.reqLevel;
        
        const div = document.createElement('div');
        let classes = `helper-item ${isActive ? 'active' : ''}`;
        
        if (isLocked) classes += ' locked';
        else if (!isActive && (game.helpers.length >= MAX_HELPERS || currentCPS - currentHelperCost < helper.cost)) {
            classes += ' disabled';
        }
        
        div.className = classes;

        // --- CORRECCIÓN DEL CLICK ---
        if (!isLocked) {
            // Usamos onmousedown para que la respuesta sea INMEDIATA al pulsar, no al soltar
            div.onmousedown = function(e) { 
                e.preventDefault(); // Evita selecciones de texto raras
                toggleHelper(helper.id); 
            };
        }

        let btnContent = '';
        let statusText = '';
        let statusClass = '';

        if (isLocked) {
            statusText = `Nivel ${helper.reqLevel} Req.`;
            statusClass = 'helper-locked-text';
            btnContent = '🔒';
        } else if (isActive) {
            statusText = '✓ EN EQUIPO';
            statusClass = 'helper-active';
            btnContent = '❌';
        } else {
            statusText = `Coste: ${helper.cost}/s`;
            statusClass = 'helper-cost';
            btnContent = game.helpers.length >= MAX_HELPERS ? '⛔' : '➕';
        }

        // --- CAMBIO IMPORTANTE: Usamos DIV en vez de BUTTON para evitar doble click ---
        div.innerHTML = `
            <div class="helper-icon" style="${isLocked ? 'filter:grayscale(1); opacity:0.5' : ''}">${helper.icon}</div>
            <div class="helper-info">
                <h4 style="${isLocked ? 'color:#666' : ''}">${isLocked ? '???' : helper.name}</h4>
                <p>${isLocked ? 'Sigue acumulando energía.' : helper.desc}</p>
                <div class="${statusClass}">${statusText}</div>
            </div>
            <div class="helper-toggle ${isActive ? 'active' : ''}">
                ${btnContent}
            </div>
        `;
        
        container.appendChild(div);
    });
}

// --- BUCLE PRINCIPAL ---
let lastTime = Date.now();

// Asegúrate de tener estas variables definidas antes del gameLoop en tu archivo
// let lastTime = Date.now(); 

function gameLoop() {
    requestAnimationFrame(gameLoop);
    
    const now = Date.now();
    // Si por algún motivo lastTime falla, usamos 'now' para evitar que dt sea NaN
    const dt = (now - (lastTime || now)) / 1000;
    lastTime = now;

    // --- 1. LÓGICA DE PRODUCCIÓN PASIVA (WPS) ---
    const netCPS = typeof getNetCPS === 'function' ? getNetCPS() : 0;
    if (netCPS > 0) {
        const gained = netCPS * dt;
        game.cookies += gained;
        game.totalCookiesEarned += gained;
    }

    // --- 2. LÓGICA DE COMBO (DINÁMICA) ---
    // Si no tienes la función getMaxCombo aún, usamos 5.0 por defecto
    const maxComboLimit = typeof getMaxCombo === 'function' ? getMaxCombo() : 5.0;
    const comboEl = document.getElementById('combo-display');
    
    if (typeof comboTimer !== 'undefined' && comboTimer > 0) {
        comboTimer -= dt;
    } else if (typeof comboMultiplier !== 'undefined' && comboMultiplier > 1.0) {
         comboMultiplier -= dt * 2; 
        if (comboMultiplier < 1.0) comboMultiplier = 1.0;
        
        if(comboEl) {
            comboEl.innerText = `COMBO x${comboMultiplier.toFixed(2)}`;
            if(comboMultiplier <= 1.0) comboEl.style.opacity = 0;
            else comboEl.style.opacity = 1;
        }
    }

    // --- 3. LÓGICA DE LA BARRA DE PROGRESO DE ANOMALÍAS ---
    const barContainer = document.getElementById('buff-container');
    const barFill = document.getElementById('buff-bar');

    if (typeof buffEndTime !== 'undefined' && buffEndTime > now) {
        if (barContainer) barContainer.style.display = 'block';
        if (barFill) {
            const remaining = buffEndTime - now;
            const percentage = Math.max(0, (remaining / (buffDuration || 10000)) * 100);
            barFill.style.width = percentage + "%";
            
            // Color según el buff activo
            const color = (typeof clickBuffMultiplier !== 'undefined' && clickBuffMultiplier > 1) ? '#00e5ff' : '#ffaa00';
            barFill.style.backgroundColor = color;
        }
    } else if (barContainer) {
        barContainer.style.display = 'none';
    }

    // --- 4. ACTUALIZACIÓN DE MOTORES Y UI ---
    // Es vital que estas funciones existan para que no se quede en negro
    if (typeof update3D === 'function') update3D();
    if (typeof updateUI === 'function') updateUI();
    
    // --- 5. OPTIMIZACIONES (CADA 1 SEGUNDO aprox) ---
    // Usamos el residuo de 'now' para ejecutar tareas pesadas solo a veces
    if (Math.floor(now / 200) % 5 === 0) { 
        if (typeof checkAvailability === 'function') checkAvailability();
        if (typeof checkUnlocks === 'function') checkUnlocks();
        if (typeof checkAchievements === 'function') checkAchievements();
        if (typeof renderHelpers === 'function') renderHelpers();
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
        if(ship.parentNode) ship.remove(); 
    }, 21000);
}

function openMerchantMenu() {
    // 1. Seleccionar una estructura de Andrómeda al azar
    const availableBuildings = buildingsConfig.filter(b => b.isAndromeda);
    const offer = availableBuildings[Math.floor(Math.random() * availableBuildings.length)];
    
    // Precio inicial (Precio base con el escalado de cuántos tienes)
    const currentCount = game.buildings[offer.id] || 0;
    let currentPrice = Math.floor(offer.baseCost * Math.pow(1.15, currentCount));
    
    // Crear el contenedor del menú
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
    `;

    content.innerHTML = `
        <h2 style="color: #b388ff; text-shadow: 0 0 10px #b388ff;">📡 MERCADO NEGRO DE ANDRÓMEDA</h2>
        <p style="font-size: 0.9rem; color: #aaa;">"Tengo algo que hará que tu red cuántica parezca un juguete..."</p>
        
        <div style="background: rgba(179, 136, 255, 0.1); padding: 15px; border-radius: 10px; margin: 20px 0;">
            <div style="font-size: 3rem; margin-bottom: 10px;">${offer.icon}</div>
            <h3 style="margin: 0;">${offer.name}</h3>
            <p style="font-size: 0.8rem; margin: 5px 0 15px 0;">${offer.desc}</p>
            <div id="merchant-price-display" style="font-size: 1.2rem; color: #00ff88; font-weight: bold;">
                ⚡ ${formatNumber(currentPrice)} Watts
            </div>
        </div>

        <div id="merchant-actions" style="display: flex; flex-direction: column; gap: 10px;">
            <button id="btn-buy-merchant" style="background: #00ff88; color: black; border: none; padding: 12px; cursor: pointer; font-weight: bold; border-radius: 5px;">
                ADQUIRIR TECNOLOGÍA
            </button>
            
            <button id="btn-haggle-merchant" style="background: transparent; color: #b388ff; border: 1px solid #b388ff; padding: 10px; cursor: pointer; border-radius: 5px;">
                REGATEAR (-20% precio)
            </button>
            
            <button onclick="document.getElementById('merchant-overlay').remove()" style="background: none; border: none; color: #666; cursor: pointer; font-size: 0.8rem; margin-top: 10px;">
                [ DECLINAR OFERTA ]
            </button>
        </div>
        <p id="merchant-msg" style="font-size: 0.75rem; color: #ffaa00; margin-top: 15px; min-height: 1em;"></p>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // --- LÓGICA DE LOS BOTONES ---

    // Botón de Comprar
    document.getElementById('btn-buy-merchant').onclick = () => {
        if (game.cookies >= currentPrice) {
            game.cookies -= currentPrice;
            game.buildings[offer.id] = (game.buildings[offer.id] || 0) + 1;
            showNotification("CONTRATO FIRMADO", `${offer.name} añadido a la flota.`);
            overlay.remove();
            updateUI();
        } else {
            document.getElementById('merchant-msg').innerText = "❌ No tienes suficiente energía.";
        }
    };

    // Botón de Regatear
    let haggleCount = 0;
    document.getElementById('btn-haggle-merchant').onclick = () => {
        haggleCount++;
        const msg = document.getElementById('merchant-msg');
        const priceDisplay = document.getElementById('merchant-price-display');
        
        // Probabilidad de éxito (50% el primer intento, 25% el segundo...)
        const successChance = 0.5 / haggleCount;

        if (Math.random() < successChance) {
            currentPrice = Math.floor(currentPrice * 0.8);
            priceDisplay.innerText = `⚡ ${formatNumber(currentPrice)} Watts`;
            priceDisplay.style.color = "#00ff88";
            msg.innerText = "✅ El comerciante acepta... de mala gana.";
            msg.style.color = "#00ff88";
            // Animación de brillo verde
            priceDisplay.style.animation = "pulseGreen 0.5s ease";
        } else {
            // FRACASO: El comerciante se ofende
            msg.innerText = "💢 ¡INSULTANTE! El comerciante se retira.";
            document.getElementById('merchant-actions').innerHTML = `
                <p style="color: #ff4444; font-weight: bold;">NEGOCIACIÓN FALLIDA</p>
            `;
            setTimeout(() => overlay.remove(), 2000);
        }
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
    // Intentar aparecer cada 5-10 minutos
    const waitTime = 300000 + (Math.random() * 300000); 
    
    setTimeout(() => {
        if (game.heavenlyUpgrades.includes('andromeda_trade')) {
            spawnMerchant();
        }
        startMerchantLoop(); // Re-programar siguiente visita
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

    // 2. Cálculo de producción con optimización de DOM
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

    // 3. Sistema de Nivel de Energía
    const playerLevel = Math.floor(Math.cbrt(game.totalCookiesEarned));
    const levelEl = document.getElementById('player-level-display');
    if (levelEl) {
        levelEl.innerText = `NIVEL: ${playerLevel}`;
    }

    // 4. Lógica del Botón de Ascensión
    const pBtn = document.getElementById('btn-prestige');
    const PRESTIGE_BASE = 1000000;
    
    if(game.totalCookiesEarned >= PRESTIGE_BASE) {
        if (pBtn) {
            pBtn.style.display = 'block';
            
            const totalPotential = Math.floor(Math.cbrt(game.totalCookiesEarned / PRESTIGE_BASE));
            const currentLevel = game.prestigeLevel || 0;
            const gain = totalPotential - currentLevel;

            if (gain > 0) {
                pBtn.innerText = `ASCENDER (+${gain} Nivel)`;
                pBtn.classList.add('available'); 
            } else {
                const nextPointEnergy = Math.pow(currentLevel + 1, 3) * PRESTIGE_BASE;
                const remaining = nextPointEnergy - game.totalCookiesEarned;
                pBtn.innerText = `ASCENDER`;
                pBtn.classList.remove('available');
            }
        }
    } else if (pBtn) {
        pBtn.style.display = 'none';
    }
    
    // 5. HUD de Multiplicador de Prestigio
    const prestigeHud = document.getElementById('prestige-hud');
    const prestigeDisp = document.getElementById('prestige-display');
    if(game.prestigeMult > 1) {
        if (prestigeHud) prestigeHud.style.display = 'block';
        if (prestigeDisp) prestigeDisp.innerText = `x${game.prestigeMult.toFixed(1)}`;
    }

    // --- 6. NUEVO: RADAR DE COMERCIO DE ANDRÓMEDA ---
    // Esto crea un indicador visual si tienes la mejora comprada
    let radarEl = document.getElementById('trade-signal');
    
    // Si no existe, lo creamos dinámicamente (Lazy creation)
    if (!radarEl) {
        radarEl = document.createElement('div');
        radarEl.id = 'trade-signal';
        // Estilo: Arriba a la derecha, color violeta neón
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

    // Control de visibilidad
    if (game.heavenlyUpgrades.includes('andromeda_trade')) {
        radarEl.style.display = 'block';
        // Efecto de parpadeo suave
        radarEl.style.opacity = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
    } else {
        radarEl.style.display = 'none';
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
                    btn.setAttribute('data-tooltip', `${b.name} MK-${i+1}\nx2 Producción\nCoste: ${formatNumber(cost)}`);
                    
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
            switch(h.id) {
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

    if(!anyUp) upgradesEl.innerHTML = '<div style="color:#444; font-size:0.8rem; width:100%; text-align:center;">Juega más para desbloquear tecnología...</div>';

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
        if(game.cookies < c) el.classList.add('disabled');
        else el.classList.remove('disabled');
    });
}





function doClickLogic(cx, cy) {
    sfxClick(); // Sonido estándar agradable
    
    // 1. AUMENTAR COMBO
    const maxCombo = game.upgrades.includes('upg_master_h_combo') ? 10.0 : 5.0;
    
    comboMultiplier += 0.05; 
    if(comboMultiplier > maxCombo) comboMultiplier = maxCombo; 
    comboTimer = 2.0; 
    
    const comboEl = document.getElementById('combo-display');
    if (comboEl) {
        comboEl.style.opacity = 1;
        comboEl.style.transform = `scale(${1 + comboMultiplier/10})`;
        comboEl.innerText = `COMBO x${comboMultiplier.toFixed(2)}`;
    }

    // 2. CALCULAR DAÑO BASE
    let val = getClickPower();
    let isCrit = false;

    // --- CÁLCULO DE CRÍTICO ---
    let critChance = 0;
    if (game.heavenlyUpgrades.includes('crit_master')) critChance += 0.05;
    
    if (game.upgrades.includes('upg_master_h_crit')) {
        critChance = 0.25; 
    } else if (game.helpers.includes('h_crit')) {
        critChance += 0.10;
    }

    if (Math.random() < critChance) {
        isCrit = true;
        val *= 10; 
        
        // --- 🔇 SONIDO ELIMINADO ---
        // playTone(600, 'square', 0.1, 0.2); // <--- ESTA LÍNEA CAUSABA EL RUIDO MOLESTO
        
        // Mantenemos el temblor de cámara para que se sienta el impacto
        camera.position.x += (Math.random() - 0.5) * 0.5;
        camera.position.y += (Math.random() - 0.5) * 0.5;
    }

    // 3. APLICAR RESULTADO
    game.cookies += val;
    game.totalCookiesEarned += val;
    
    if (!game.totalClicks) game.totalClicks = 0;
    game.totalClicks++; 
    game.clickCount++;  

    // EVENTO PERLA AZUL
    if (game.totalClicks >= 10000 && !game.pearls.includes('blue')) {
        epicBluePearlScene();
        unlockPearl('blue');
        showSystemModal(
            "🔵 HITO ALCANZADO",
            "10,000 Clicks. La persistencia ha fracturado el tiempo. ¡Has desbloqueado la Perla del Cronos (Clicks x50)!",
            false,
            null
        );
    }

    // 4. TEXTO FLOTANTE
    if (isCrit) {
        createFloatingText(cx, cy, `¡CRÍTICO! +${formatNumber(val)}`, true); 
    } else {
        createFloatingText(cx, cy, `+${formatNumber(val)}`, false);
    }
    
    updateUI();
}




function createFloatingText(x, y, txt) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.innerText = txt;
    el.style.left = (x + (Math.random()-0.5)*30) + 'px';
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


window.saveGame = function() {
    // Seguridad: inicializa campos críticos antes de guardar
    if (!game.upgrades) game.upgrades = [];
    if (!game.achievements) game.achievements = [];
    if (!game.helpers) game.helpers = [];
    if (!game.heavenlyUpgrades) game.heavenlyUpgrades = [];
    if (!game.buildings) game.buildings = {};
    if (!game.pearls) game.pearls = [];
    if (typeof game.totalClicks === 'undefined') game.totalClicks = 0;
    if (typeof game.prestigeLevel === 'undefined') game.prestigeLevel = game.antimatter || 0;

    game.lastSaveTime = Date.now();
    game.isApocalypse = isApocalypse; // Guardar estado visual

    // Empaquetamos el juego con su versión
    const savePackage = {
        version: CURRENT_VERSION,
        data: game
    };

    localStorage.setItem('quantumClickerUlt', JSON.stringify(savePackage));
    
    // Feedback visual en el botón
    const btn = document.querySelector('button[onclick="saveGame()"]');
    if(btn) {
        const old = btn.innerText; 
        btn.innerText = "💾 OK!"; 
        setTimeout(() => btn.innerText = old, 1000);
    }
}


function loadGame() {
    // 1. Cargar el string del almacenamiento
    const rawSave = localStorage.getItem('quantumClickerUlt');
    
    // CASO A: SI EXISTE PARTIDA GUARDADA (Jugador que regresa)
    if (rawSave) {
        // Aseguramos que NO se vea la intro, sino la interfaz completa
        document.body.classList.remove('intro-mode');
        
        let parsedSave;
        try {
            parsedSave = JSON.parse(rawSave);
        } catch (e) {
            console.error("Save file corrupto", e);
            return;
        }

        // 2. DETECTAR VERSIÓN Y EXTRAER DATOS
        let loadedGame = {};
        if (parsedSave.version) {
            console.log(`Cargando versión ${parsedSave.version}...`);
            loadedGame = parsedSave.data;
        } else {
            // OJO: Aquí NO ponemos startIntroSequence(). 
            // Si es legacy, simplemente cargamos sus datos antiguos y le dejamos jugar.
            console.log("Cargando versión Legacy...");
            loadedGame = parsedSave;
        }

        // 3. FUSIONAR DATOS (MERGE INTELIGENTE / DEEP MERGE)
        // (Copiamos el bloque seguro que hicimos antes)
        
        // A. Valores primitivos
        for (const key in loadedGame) {
            if (key !== 'buildings' && key !== 'upgrades' && key !== 'achievements' && key !== 'helpers' && key !== 'heavenlyUpgrades' && key !== 'pearls') {
                game[key] = loadedGame[key];
            }
        }

        // B. Arrays (Reemplazo directo)
        if (loadedGame.upgrades) game.upgrades = loadedGame.upgrades;
        if (loadedGame.achievements) game.achievements = loadedGame.achievements;
        if (loadedGame.helpers) game.helpers = loadedGame.helpers;
        if (loadedGame.heavenlyUpgrades) game.heavenlyUpgrades = loadedGame.heavenlyUpgrades;
        if (loadedGame.pearls) game.pearls = loadedGame.pearls;

        // C. Objetos complejos (Edificios - FUSIÓN PROFUNDA)
        if (loadedGame.buildings) {
            for (const bId in loadedGame.buildings) {
                if (game.buildings.hasOwnProperty(bId)) {
                    game.buildings[bId] = loadedGame.buildings[bId];
                }
            }
        }

        // 4. LIMPIEZA Y SEGURIDAD (Valores por defecto)
        if (typeof game.totalClicks === 'undefined') game.totalClicks = 0;
        if (typeof game.prestigeLevel === 'undefined') game.prestigeLevel = game.antimatter || 0;
        if (typeof game.anomaliesClicked === 'undefined') game.anomaliesClicked = 0;
        if (typeof game.totalTimePlayed === 'undefined') game.totalTimePlayed = 0;
        
        // Restaurar estado visual
        if (typeof game.isApocalypse !== 'undefined') isApocalypse = game.isApocalypse;
        else isApocalypse = false;

        // 5. MIGRACIONES Y ACTUALIZACIONES
        if (game.upgrades.includes('omega-final') && !game.pearls.includes('red')) {
            game.pearls.push('red');
        }

        recalculateStats();
        renderPearls();
        
        // Restaurar sección de Ayudantes si corresponde
        if (game.totalCookiesEarned >= 150) {
            const hList = document.getElementById('helpers-list');
            if(hList) {
                hList.classList.remove('locked-section');
                areHelpersUnlocked = true;
            }
        }

        // 6. CÁLCULO OFFLINE (Igual que tenías)
        if (game.lastSaveTime) {
            const now = Date.now();
            const secondsOffline = (now - game.lastSaveTime) / 1000;
            if (secondsOffline > 60) {
                let efficiency = 0.5;
                if (game.heavenlyUpgrades.includes('offline_god')) efficiency = 1.0;
                
                const currentCPS = getCPS();
                const offlineProduction = (currentCPS * secondsOffline) * efficiency;
                
                if (offlineProduction > 0) {
                    game.cookies += offlineProduction;
                    game.totalCookiesEarned += offlineProduction;
                    setTimeout(() => {
                        showSystemModal(
                            "REGRESO AL UNIVERSO", 
                            `Has estado en estasis durante ${formatTime(secondsOffline)}.\n\nSistemas auxiliares generaron:\n<span style="color:#00ff88; font-size:1.2em">+${formatNumber(offlineProduction)} Watts</span>\n(Eficiencia: ${efficiency*100}%)`, 
                            false, null
                        );
                    }, 1000);
                }
            }
        }

    } 
    // CASO B: NO EXISTE PARTIDA (JUGADOR NUEVO)
    else {
        console.log("Iniciando Protocolo Génesis...");
        startIntroSequence(); // <--- AQUÍ ES DONDE DEBE IR
        // ... al final de loadGame o del archivo ...
        startAlienLoop();
    }
}







window.resetGame = function() {
    
    showSystemModal(
        "BORRADO DE DATOS", 
        "¿Estás seguro de que quieres formatear el multiverso?\nTodo el progreso se perderá para siempre.", 
        true, // Es una confirmación
        function() {
            localStorage.removeItem('quantumClickerUlt');
            isApocalypse = false;
            location.reload();
        }
    );
};


// --- CONFIG LOGROS ---
const achievementsConfig = [
    // --- PULSOS MANUALES (CLICKS) ---
    { 
        id: 'click100', 
        name: '⚙️ Operador de Manivela', 
        desc: 'Registra 100 pulsos cinéticos manuales en el núcleo.', 
        req: g => g.clickCount >= 100 
    },
    { 
        id: 'click1k', 
        name: '🧠 Interfaz Neuronal', 
        desc: 'Sincroniza 1,000 pulsos directos con la red.', 
        req: g => g.clickCount >= 1000 
    },
    { 
        id: 'click10k', 
        name: '⚡ Maestro de la Cinética', 
        desc: 'Alcanza el límite físico de 10,000 pulsos manuales.', 
        req: g => g.clickCount >= 10000 
    },
    
    // --- MÓDULOS TECNOLÓGICOS (MEJORAS) ---
    { 
        id: 'upg5', 
        name: '🔧 Ingeniero Junior', 
        desc: 'Instala 5 módulos tecnológicos de optimización de red.', 
        req: g => g.upgrades.length >= 5 
    },
    { 
        id: 'upg20', 
        name: '🏛️ Arquitecto de Sistemas', 
        desc: 'Implementa 20 protocolos de tecnología avanzada.', 
        req: g => g.upgrades.length >= 20 
    },
    
    // --- INFRAESTRUCTURA Y POTENCIA ---
    { 
        id: 'build10', 
        name: '🏗️ Capataz Energético', 
        desc: 'Despliega 10 estructuras de generación en el sector.', 
        req: g => Object.values(g.buildings).reduce((a,b)=>a+b,0) >= 10 
    },
    { 
        id: 'cps100', 
        name: '📈 Pico de Tensión', 
        desc: 'Logra una salida estable de 100 W/s.', 
        req: () => getCPS() >= 100 
    },
    { 
        id: 'million', 
        name: '🔋 Reserva de Megavatios', 
        desc: 'Genera un acumulado histórico de 1 MW (MegaWatt).', 
        req: g => g.totalCookiesEarned >= 1000000 
    },
    { 
        id: 'hacker', 
        name: '🌀 Sincronía Crítica', 
        desc: 'Estabiliza el flujo cuántico en un combo x3.0.', 
        req: () => comboMultiplier >= 3.0 
    },
    
    // --- DIVISIÓN ALIENÍGENA (AYUDANTES) ---
    { 
        id: 'helper1', 
        name: '🤝 Asesoría Extraterrestre', 
        desc: 'Firma tu primer contrato con un especialista alienígena.', 
        req: g => g.helpers && g.helpers.length >= 1 
    },
    { 
        id: 'helper3', 
        name: '🌌 Consejo de Sabios', 
        desc: 'Coordina a 3 especialistas de élite simultáneamente.', 
        req: g => g.helpers && g.helpers.length >= 3 
    }
];

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
window.toggleAchievements = function() {
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

window.doPrestige = function() {
    const modal = document.getElementById('modal-ascension');
    const PRESTIGE_BASE = 1000000;
    
    // Tu potencial total histórico
    const totalPotential = Math.floor(Math.cbrt(game.totalCookiesEarned / PRESTIGE_BASE));
    
    // Lo que ganas es: Potencial - Lo que ya has ganado en total (Nivel)
    // Usamos prestigeLevel (o antimatter si es partida antigua, ver loadGame)
    const currentLevel = game.prestigeLevel || game.antimatter;
    let amountToGain = totalPotential - currentLevel;
    
    if (amountToGain <= 0) {
        // ... lógica de aviso de error (igual que tenías) ...
        const nextPoint = currentLevel + 1;
        const energyNeed = Math.pow(nextPoint, 3) * PRESTIGE_BASE;
        const remaining = energyNeed - game.totalCookiesEarned;
        showSystemModal("ENERGÍA INSUFICIENTE", `Necesitas ${formatNumber(remaining)} más de energía.`, false, null);
        return;
    }

    // Actualizar UI del modal
    const nextMult = 1 + ((currentLevel + amountToGain) * 0.1);
    document.getElementById('asc-gain-antimatter').innerText = `+${formatNumber(amountToGain)}`;
    document.getElementById('asc-new-mult').innerText = `x${nextMult.toFixed(1)}`;
    
    modal.dataset.gain = amountToGain;
    modal.style.display = 'flex';
};

window.closeAscension = function() {
    document.getElementById('modal-ascension').style.display = 'none';
};

window.confirmAscension = function() {
    const modal = document.getElementById('modal-ascension');
    const gain = parseInt(modal.dataset.gain);
    
    if (!gain || gain <= 0) return;

    sfxPrestige();

    // 1. HARD RESET
    game.cookies = 0;
    game.buildings = {};
    game.upgrades = [];
    game.helpers = [];
    isApocalypse = false;
    
    // 2. APLICAR RECOMPENSAS (ARREGLADO)
    game.antimatter += gain;      // Moneda (+1)
    game.prestigeLevel += gain;   // Nivel (+1) -> NUNCA BAJA
    
    // El multi se basa en el NIVEL, no en la moneda gastable
    game.prestigeMult = 1 + (game.prestigeLevel * 0.1); 

    // 3. Reiniciar configs
    buildingsConfig.forEach(u => { game.buildings[u.id] = 0; u.currentPower = u.basePower; });

    // 4. Aplicar mejoras celestiales iniciales (Génesis, etc)
    if (game.heavenlyUpgrades.includes('genesis')) game.cookies = 100;
    if (game.heavenlyUpgrades.includes('starter_kit')) game.buildings['cursor'] = 10;

    saveGame();
    closeAscension();
    openHeavenTree(); // Abrimos el árbol
};

// ==========================================
// SISTEMA DE DIÁLOGOS PERSONALIZADOS (MODALES)
// ==========================================
let pendingAction = null;

window.showSystemModal = function(title, message, isConfirm, actionCallback) {
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
    
    okBtn.onclick = function() {
        if (pendingAction) pendingAction();
        closeSystemModal();
        sfxClick(); 
    };

    modal.style.display = 'flex';
};

window.closeSystemModal = function() {
    document.getElementById('modal-system').style.display = 'none';
    pendingAction = null;
};



// ==========================================
// SISTEMA DE CÓDICE (COLECCIÓN)
// ==========================================

window.toggleCollection = function() {
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

window.renderCollection = function() {
    const artifactsGrid = document.getElementById('collection-artifacts');
    const helpersGrid = document.getElementById('collection-helpers');
    const upgradesGrid = document.getElementById('collection-upgrades');

    if(artifactsGrid) artifactsGrid.innerHTML = '';
    if(helpersGrid) helpersGrid.innerHTML = '';
    if(upgradesGrid) upgradesGrid.innerHTML = '';

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
                `${b.name}: ${currentMkName} (MK-${i+1})`, 
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
    if(!globalTooltip) return;

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
    if(!globalTooltip) return;
    
    // Posición relativa al ratón (+15px para que no tape el cursor)
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    
    // Evitar que se salga de la pantalla (Lógica básica)
    // Si quieres algo más pro, habría que calcular window.innerWidth
    
    globalTooltip.style.left = x + 'px';
    globalTooltip.style.top = y + 'px';
}

function hideTooltip() {
    if(globalTooltip) globalTooltip.style.display = 'none';
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
window.togglePearl = function(color) {
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

// Carga inicial
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

window.openHeavenTree = function() {
    document.getElementById('modal-heaven').style.display = 'flex';
    document.getElementById('heaven-antimatter').innerText = formatNumber(game.antimatter);
    renderHeavenTree();
};

window.closeHeaven = function() {
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
            tooltip.innerHTML = `<strong style="color:#b388ff">${node.name}</strong><br>${node.desc}<br><br><span style="color:${isAvailable?'#ffd700':'#888'}">${status}${costTxt}</span>`;
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
window.finishAscension = function() {
    closeHeaven();
    // Aquí podrías añadir una animación de "Big Bang"
    location.reload(); // Recargar para aplicar cambios limpios
};













// ==========================================
// SISTEMA DE IMPORTAR / EXPORTAR
// ==========================================

window.exportSave = function() {
    saveGame();
    const jsonSave = JSON.stringify(game);
    const encodedSave = btoa(jsonSave);
    
    navigator.clipboard.writeText(encodedSave).then(() => {
        showSystemModal("✅ CÓDIGO COPIADO", "Tu código de guardado está en el portapapeles.\nGuárdalo en un lugar seguro.", false, null);
    }).catch(err => {
        prompt("Copia este código manualmente:", encodedSave);
    });
};


window.importSave = function() {
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

