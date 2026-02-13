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
    { id: 'cursor', name: 'Generador de Manivela', type: 'click', baseCost: 15, basePower: 1, desc: '+1 W por click (Manual)' },
    { id: 'grandma', name: 'Hámster en Rueda', type: 'auto', baseCost: 100, basePower: 1, desc: '+1 W/s (Bio-energía básica)' },
    
    // TIER 2: ELÉCTRICO
    { id: 'farm', name: 'Panel Solar', type: 'auto', baseCost: 1100, basePower: 8, desc: '+8 W/s (Fotovoltaica)' },
    { id: 'mine', name: 'Turbina Eólica', type: 'auto', baseCost: 12000, basePower: 47, desc: '+47 W/s (Eólica)' },
    
    // TIER 3: INDUSTRIAL
    { id: 'factory', name: 'Central Hidroeléctrica', type: 'auto', baseCost: 130000, basePower: 260, desc: '+260 W/s (Hidráulica)' },
    { id: 'bank', name: 'Reactor Nuclear', type: 'auto', baseCost: 1400000, basePower: 1400, desc: '+1.4 kW/s (Fisión)' },
    
    // TIER 4: CUÁNTICO
    { id: 'temple', name: 'Reactor de Fusión', type: 'auto', baseCost: 20000000, basePower: 7800, desc: '+7.8 kW/s (Fusión)' },
    { id: 'portal', name: 'Matriz de Dyson', type: 'auto', baseCost: 330000000, basePower: 44000, desc: '+44 kW/s (Estelar)' }
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
    else if (introClicks === 80) { playTone(300, 'sawtooth', 0.6); showIntroText("¡ADVERTENCIA: MASA CRÍTICA ALCANZADA!"); }
    else if (introClicks === 95) { playTone(600, 'sine', 1.0); showIntroText("¡COLAPSO INMINENTE!"); }
    
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

    // ===============================================
    // 🛑 1. LÓGICA ESPECIAL DE LA INTRO
    // ===============================================
    if (isIntroActive) {
        // Si hay polvo estelar (intro), que gire suavemente
        if (typeof introParticlesMesh !== 'undefined' && introParticlesMesh) {
            introParticlesMesh.rotation.y += 0.002;
            introParticlesMesh.rotation.z += 0.001;
        }

        // Actualizamos las partículas de click (chispas)
        updateParticles(); 
        
        // Renderizamos y SALIMOS. No queremos que el código de abajo
        // cambie los colores de la bola ni mueva las estrellas.
        composer.render();
        return; 
    }

    // ===============================================
    // 🚀 2. JUEGO NORMAL (SOLO SI NO HAY INTRO)
    // ===============================================

    // A. ROTACIÓN DINÁMICA
    const rotSpeed = 0.005 + Math.min(0.1, cps * 0.00001);
    mainObject.rotation.y += rotSpeed;
    mainObject.rotation.x += rotSpeed * 0.5;
    glowMesh.rotation.y -= rotSpeed;
    
    // B. LÓGICA DE COLORES Y EVOLUCIÓN
    if (isApocalypse) {
        // MODO APOCALIPSIS
        mainObject.material.color.setHex(0xff0000); 
        mainObject.material.emissive.setHex(0x550000);
        glowMesh.material.color.setHex(0xff3300);   
        if(scene.fog) scene.fog.color.setHex(0x220000);           
        mainObject.scale.setScalar(1 + Math.sin(time * 5) * 0.05); 
    } else {
        // MODO NORMAL: EVOLUCIÓN
        let targetColor = new THREE.Color(0x00ff88); // Base: Verde
        let targetEmissive = new THREE.Color(0x004422);
        let targetGlow = new THREE.Color(0x7c4dff);

        // FASE KILOWATT (1,000 W) -> Naranja
        if (game.totalCookiesEarned >= 1000) {
            targetColor.setHex(0xffaa00);
            targetEmissive.setHex(0xff4400);
            targetGlow.setHex(0xffcc00);
        }
        // FASE MEGAWATT (1M W) -> Azul Cyan
        if (game.totalCookiesEarned >= 1000000) {
            targetColor.setHex(0x00e5ff);
            targetEmissive.setHex(0x0044aa);
            targetGlow.setHex(0x00ffff);
        }
        // FASE GIGAWATT (1B W) -> Violeta Singularidad
        if (game.totalCookiesEarned >= 1000000000) {
            targetColor.setHex(0x9900ff);
            targetEmissive.setHex(0x220044);
            targetGlow.setHex(0xff00ff);
        }

        // Transición suave (Lerp)
        mainObject.material.color.lerp(targetColor, 0.05);
        mainObject.material.emissive.lerp(targetEmissive, 0.05);
        glowMesh.material.color.lerp(targetGlow, 0.05);
        
        // El fog vuelve a negro si salimos del apocalipsis
        if(scene.fog) scene.fog.color.lerp(new THREE.Color(0x000000), 0.1);

        // Latido suave
        const pulse = 1 + Math.sin(time * 2) * 0.02;
        mainObject.scale.setScalar(pulse);
    }
    
    // C. FONDO DE ESTRELLAS (Solo se mueven si el juego ha empezado)
    if (starMesh && starMesh.geometry) {
        const positions = starMesh.geometry.attributes.position.array;
        const starSpeed = 0.05 + Math.min(2.0, cps * 0.0005); 
        
        for(let i=2; i<positions.length; i+=3) {
            positions[i] += starSpeed;
            if(positions[i] > 20) positions[i] = -40; 
        }
        starMesh.geometry.attributes.position.needsUpdate = true;
    }

    // D. PARTÍCULAS
    updateParticles();

    // E. RENDERIZADO FINAL
    camera.position.lerp(new THREE.Vector3(0,0,8), 0.1);
    
    // Variación suave de emisión
    if (!isApocalypse) {
        mainObject.material.emissiveIntensity = 0.5 + Math.sin(time) * 0.2;
    }
    
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

function spawnAnomaly() {
    isAnomalyLoopActive = true;

    // ----------------------------------------------------
    // 1. ESCUDO DE INTRO (Protegemos el misterio)
    // ----------------------------------------------------
    // Si la intro está activa, cancelamos inmediatamente.
    if (typeof isIntroActive !== 'undefined' && isIntroActive) return;

    // ----------------------------------------------------
    // 2. ESCUDO DE TECNOLOGÍA (El Sensor)
    // ----------------------------------------------------
    // Si NO tienes la mejora 'unlock-anomalies' comprada, entramos en modo espera.
    // Volvemos a comprobar en 5 segundos.
    if (!game.upgrades.includes('unlock-anomalies')) {
        setTimeout(spawnAnomaly, 5000);
        return;
    }

    // ----------------------------------------------------
    // 3. GENERACIÓN DE LA BOLA (Tu lógica original de recompensas)
    // ----------------------------------------------------
    const isCorrupt = isApocalypse && Math.random() < 0.3;
    const isTemporalEvent = !game.pearls.includes('blue') && (game.totalClicks >= 10000) && Math.random() < 0.3;
    
    // Probabilidades ajustadas (Menos dinero directo, más buffs para compensar la rareza)
    const types = ['money', 'money', 'production', 'production', 'production', 'click', 'click']; 
    const type = types[Math.floor(Math.random() * types.length)];
    
    const orb = document.createElement('div');
    let icon = '⚛️'; let color = 'gold'; let size = '3.5rem';
     
    // --- VISUALES ---
    if (isTemporalEvent) {
        icon = '⏳'; color = '#00e5ff'; orb.style.animation = 'pulseBlue 0.5s infinite alternate';
    } else if (isCorrupt) {
        icon = '👁️'; color = '#ff0000'; size = '4.5rem';
    } else if (type === 'production') {
        icon = '⚡'; color = '#ffaa00';
    } else if (type === 'click') {
        icon = '🖱️'; color = '#00ff88';
    }

    orb.innerHTML = icon;
    orb.style.cssText = `
        position: absolute; font-size: ${size}; cursor: pointer; z-index: 2000; 
        filter: drop-shadow(0 0 15px ${color}); 
        left: ${Math.random() * 80 + 10}%; top: ${Math.random() * 80 + 10}%;
        user-select: none; transition: transform 0.1s;
    `;
    orb.onmouseover = () => orb.style.transform = "scale(1.2)";
    orb.onmouseout = () => orb.style.transform = "scale(1.0)";

    // --- CLICK ---
    orb.onclick = function(e) {
        e.stopPropagation(); 
        sfxAnomaly();
        game.anomaliesClicked++;
        createFloatingText(e.clientX, e.clientY, "ANOMALÍA CAPTURADA");

        if (isTemporalEvent) { unlockPearl('blue'); } 
        else if (isCorrupt) {
            let riskThreshold = 0.5;
            if (game.heavenlyUpgrades.includes('wrath_control')) riskThreshold = 0.25;
            if (Math.random() < riskThreshold) {
                let loss = game.cookies * 0.05; game.cookies -= loss;
                showAnomalyPopup(`📉 ENTROPÍA: -${formatNumber(loss)} Watts`, 'bad');
            } else {
                let gain = getCPS() * 2000; // Premio GORDO por rareza
                game.cookies += gain; game.totalCookiesEarned += gain;
                showAnomalyPopup(`😈 CAOS: +${formatNumber(gain)} Watts`, 'good');
            }
        } 
        else if (type === 'money') {
            let bonusMult = 1;
            if (game.helpers.includes('h_banker')) bonusMult *= 1.5;
            if (game.heavenlyUpgrades.includes('anomaly_nuke')) bonusMult *= 3.0;
            
            let seconds = 600 + Math.random() * 1800; 
            let gain = (getCPS() * seconds) * bonusMult;
            
            let bankCap = game.cookies * 0.50; // Cap subido al 50%
            if (gain > bankCap && bankCap > 0) gain = bankCap; 
            if (gain < 15) gain = 15;

            game.cookies += gain; game.totalCookiesEarned += gain;
            showAnomalyPopup(`💰 SURGE: +${formatNumber(gain)} Watts`);
        } 
        else if (type === 'production') {
            let duration = 77;
            if (game.heavenlyUpgrades.includes('golden_duration')) duration += 10;
            activateBuff('production', 7, duration);
            showAnomalyPopup(`⚡ SOBRECARGA: x7 Prod (${duration}s)`);
        } 
        else if (type === 'click') {
            let duration = 13;
            if (game.heavenlyUpgrades.includes('click_frenzy_boost')) duration *= 2;
            if (game.heavenlyUpgrades.includes('golden_duration')) duration += 10;
            activateBuff('click', 777, duration);
            showAnomalyPopup(`🖱️ CLICKSTORM: x777 Power (${duration}s)`);
        }
        this.remove(); updateUI();
    };

    document.getElementById('game-area').appendChild(orb);
    
    // Tiempo de vida en pantalla (ligeramente aumentado por rareza)
    let lifeTime = isCorrupt ? 8000 : 15000; 
    if (game.upgrades.includes('quantum-lens')) lifeTime += 4000;
    if (game.heavenlyUpgrades.includes('golden_duration')) lifeTime += 3000;

    setTimeout(() => { 
        if(orb.parentNode) {
            orb.style.opacity = 0; orb.style.transition = "opacity 1s";
            setTimeout(() => { if(orb.parentNode) orb.remove(); }, 1000);
        } 
    }, lifeTime); 

    // ----------------------------------------------------
    // 4. CÁLCULO DE TIEMPO (LENTO: 2 MINUTOS MÍNIMO)
    // ----------------------------------------------------
    const anomalyHelper = helpersConfig.find(h => h.effect === 'anomalyRate');
    
    // TIEMPO BASE: 120 segundos (120,000 ms) + Variación de 0 a 60s
    let baseTime = 120000 + Math.random() * 60000; 
    
    // Modificadores de reducción
    if (anomalyHelper && game.helpers.includes(anomalyHelper.id)) baseTime /= anomalyHelper.value;
    if (game.upgrades.includes('entropy-antenna')) baseTime *= 0.8; 
    if (game.heavenlyUpgrades.includes('lucky_star')) baseTime *= 0.85; 

    if (comboMultiplier > 3.0) baseTime *= 0.8;

    // console.log(`Próxima anomalía en: ${Math.round(baseTime/1000)}s`); // Debug opcional
    setTimeout(spawnAnomaly, baseTime);
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
    // 1. Limpiar temporizador anterior si existía (para que no se corten entre sí)
    if (buffTimeout) clearTimeout(buffTimeout);

    const gameArea = document.getElementById('game-area');
    
    // 2. Aplicar la lógica y el efecto visual Sci-Fi
    if (type === 'production') {
        buffMultiplier = amount; // Multiplica x7 la producción
        // Efecto: Resplandor Naranja/Rojo de Sobrecarga (Inset Glow)
        gameArea.style.boxShadow = "inset 0 0 100px rgba(255, 82, 82, 0.5)";
        gameArea.style.border = "1px solid rgba(255, 82, 82, 0.8)";
    } else {
        clickBuffMultiplier = amount; // Multiplica x777 los clicks
        // Efecto: Resplandor Cyan Eléctrico
        gameArea.style.boxShadow = "inset 0 0 100px rgba(0, 229, 255, 0.5)";
        gameArea.style.border = "1px solid rgba(0, 229, 255, 0.8)";
    }
    
    // 3. Actualizar números inmediatamente
    updateUI(); 

    // 4. Programar el fin del efecto
    buffTimeout = setTimeout(() => {
        // Resetear multiplicadores a 1 (Normal)
        if (type === 'production') buffMultiplier = 1;
        else clickBuffMultiplier = 1;
        
        // Quitar efectos visuales
        gameArea.style.boxShadow = "none";
        gameArea.style.border = "none";
        
        updateUI();
        
        // Mensaje técnico de finalización
        showNotification("SISTEMA", "Niveles de energía estabilizados.");
        
        buffTimeout = null;
    }, seconds * 1000);
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


function getCPS() {
    let cps = 0;

    // 1. CÁLCULO BASE DE EDIFICIOS
    buildingsConfig.forEach(u => {
        if (u.type === 'auto') {
            let count = game.buildings[u.id] || 0; 
            let bPower = count * u.currentPower;
            
            // Sinergia: Red Neuronal (Mina potencia por cada Abuela)
            if (u.id === 'mine' && game.upgrades?.includes('grandma-mine-synergy')) { 
                const grandmaCount = game.buildings['grandma'] || 0; 
                bPower *= (1 + (grandmaCount * 0.01));
            }
            cps += bPower;
        }
    });

    // 2. MULTIPLICADORES GLOBALES (PRESTIGIO)
    let total = cps * game.prestigeMult;
    
    // 3. AYUDANTES (STAFF)
    // Ing. Marcus Voltz (Multiplicador simple)
    const prodHelper = helpersConfig.find(h => h.effect === 'cpsMultiplier');
    if (prodHelper && game.helpers.includes(prodHelper.id)) {
        total *= prodHelper.value;
    }

    // IA "Mente Enlazada" (Sinergia por número de edificios)
    const synergyHelper = helpersConfig.find(h => h.effect === 'buildingSynergy');
    if (synergyHelper && game.helpers.includes(synergyHelper.id)) {
        const totalBuildings = Object.values(game.buildings).reduce((a, b) => a + b, 0);
        // Ejemplo: 100 edificios * 0.01 = +100% (x2.0)
        total *= (1 + (totalBuildings * synergyHelper.value));
    }

    // 4. CADENA OMEGA (LORE)
    if (game.upgrades.includes('protocol-omega')) total *= 1.2;
    if (game.upgrades.includes('omega-phase-2')) total *= 1.5;
    if (game.upgrades.includes('omega-phase-3')) total *= 2.0;
    if (game.upgrades.includes('omega-phase-4')) total *= 3.0;
    if (game.upgrades.includes('omega-final')) total *= 5.0;

    // 5. ÁRBOL DE ASCENSIÓN (COSMOS - NUEVO)
    
    // Eficiencia Industrial I (+15%)
    if (game.heavenlyUpgrades.includes('perm_prod_1')) total *= 1.15;
    
    // (Compatibilidad con save antiguo 'perm_prod')
    if (game.heavenlyUpgrades.includes('perm_prod')) total *= 1.10; 

    // Cerebro Galáctico (+2% por cada logro desbloqueado)
    if (game.heavenlyUpgrades.includes('galaxy_brain')) {
        const achievementBonus = 1 + (game.achievements.length * 0.02);
        total *= achievementBonus;
    }
    
    // Sinergia Estructural (+10% por cada 50 edificios totales)
    if (game.heavenlyUpgrades.includes('synergy_passive')) {
        const totalBuildings = Object.values(game.buildings).reduce((a, b) => a + b, 0);
        const stacks = Math.floor(totalBuildings / 50);
        if (stacks > 0) total *= (1 + (stacks * 0.10));
    }

    // Motor de Materia Oscura (Multiplicador puro x2)
    if (game.heavenlyUpgrades.includes('dark_matter_engine')) total *= 2.0;
    
    // Multiverso (Dobla la eficiencia del prestigio)
    if (game.heavenlyUpgrades.includes('multiverse')) total *= 2.0;

    // 6. MULTIPLICADORES TEMPORALES Y ESPECIALES
    if (isOvercharged) total *= 5; // Sobrecarga manual
    if (game.activePearl === 'red') total *= 10; // Perla Roja (Apocalipsis)
    
    return total * buffMultiplier; // Buffs de Anomalías
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

// FUNCIONES EXPUESTAS PARA BOTONES HTML
window.buyBuilding = function(id) {
    const cost = getCost(id);
    if (game.cookies >= cost) {
        sfxBuy();
        game.cookies -= cost;
        game.buildings[id]++;
        renderStore(); 
        renderHelpers(); // Actualizar helpers disponibles
        updateUI();
    }
};

window.buyUpgrade = function(upgradeId, cost) {
    if (upgradeId === 'omega-final') {
    // En vez de isApocalypse = true, ahora desbloqueamos la perla
    unlockPearl('red');

    showSystemModal(
        "🔴 PERLA ANGULAR OBTENIDA", 
        "El Protocolo Omega ha condensado toda la entropía en una joya física.\n\nEquípala en el Relicario para desatar su poder (y el Apocalipsis).", 
        false, null
    );
    // (Borra el isApocalypse = true de aquí si lo tenías)
}

    if (game.cookies >= cost) {
        sfxBuy();
        game.cookies -= cost;
        game.upgrades.push(upgradeId);
        
        // --- LÓGICA DE ACTIVACIÓN DEL APOCALIPSIS ---
        // Solo se activa cuando compras LA ÚLTIMA mejora de la cadena
        if (upgradeId === 'omega-final') {
            isApocalypse = true;
            
            // Sonido dramático (Doble tono grave)
            playTone(100, 'sawtooth', 1.0, 0.5);
            setTimeout(() => playTone(80, 'sawtooth', 2.0, 0.5), 500);
            
            showSystemModal(
                "👁️ LA REALIDAD HA CAÍDO", 
                "Has roto los sellos de contención.\nEl Vacío te observa.\n\n(Las anomalías ahora pueden ser peligrosas... o inmensamente poderosas)", 
                false, null
            );
        }

        recalculateStats();
        renderStore();
        updateUI();
    }
};


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



// Función que se ejecuta al hacer click en la esfera central
function onObjectClick() {
    // --- 1. CONTAR EL CLICK ---
    game.totalClicks++;
    if (game.totalClicks === 10000 && !game.pearls.includes('blue')) {
        unlockPearl('blue');
        showSystemModal("🔵 HITO ALCANZADO", "10,000 Clicks. La persistencia es la clave del tiempo.", false, null);
    }

    
    const amount = getClickPower();
    game.cookies += amount;
    // ...
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

function gameLoop() {
    checkAchievements();
    checkUnlocks();
    requestAnimationFrame(gameLoop);
    update3D();

    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // Combo Decay (modificado por ayudante)
    const comboHelper = helpersConfig.find(h => h.effect === 'comboTime');
    const comboDecayModifier = (comboHelper && game.helpers.includes(comboHelper.id)) ? comboHelper.value : 1;
    
    if (comboTimer > 0) {
        comboTimer -= (dt / comboDecayModifier);
    } else {
        if (comboMultiplier > 1.0) {
            comboMultiplier -= dt * 2; 
            if (comboMultiplier < 1.0) comboMultiplier = 1.0;
            const comboEl = document.getElementById('combo-display');
            comboEl.innerText = `COMBO x${comboMultiplier.toFixed(2)}`;
            if(comboMultiplier === 1.0) comboEl.style.opacity = 0;
        }
    }

    const netCPS = getNetCPS();
    if (netCPS > 0) {
        const gained = netCPS * dt;
        game.cookies += gained;
        game.totalCookiesEarned += gained;
    }

    updateUI();
    checkAvailability();
    
    // Actualizar helpers disponibles cuando cambia el CPS
    if (Math.random() < 0.1) { // ~10% del tiempo para no sobrecargar
        renderHelpers();
    }
}

// --- UI ---
const scoreEl = document.getElementById('score');
const cpsEl = document.getElementById('cps-display');
const upgradesEl = document.getElementById('upgrades-panel');
const buildingsEl = document.getElementById('buildings-list');


function updateUI() {
    scoreEl.innerText = formatNumber(Math.floor(game.cookies)); // Ahora saldrá "150 W"
    
    const grossCPS = getCPS();
    const helperCost = getHelpersCost();
    const netCPS = getNetCPS();
    
    if (helperCost > 0) {
        // Cambiamos "/seg" por "Watts/s" para que quede más técnico
        cpsEl.innerHTML = `
            ${formatNumber(netCPS)} / s 
            <span style="font-size: 0.75rem; color: #999; margin-left: 5px;">
                (Gen: ${formatNumber(grossCPS)} - Uso: ${formatNumber(helperCost)})
            </span>
        `;
    } else {
        cpsEl.innerText = `${formatNumber(grossCPS)} / s`;
    }

    // Título de la pestaña
    document.title = `${formatNumber(Math.floor(game.cookies))} - Quantum Grid`;
    
    // ... resto del código del botón de ascensión ...
    
    
    // Botón de Ascensión
    const pBtn = document.getElementById('btn-prestige');
    if(game.totalCookiesEarned > 1000000) {
        pBtn.style.display = 'block';
        const potentialMult = Math.floor(Math.cbrt(game.totalCookiesEarned / 1000000)) + 1;
        pBtn.innerText = `ASCENDER (x${potentialMult})`;
    }
    
    // HUD de Multiplicador
    if(game.prestigeMult > 1) {
        document.getElementById('prestige-hud').style.display = 'block';
        document.getElementById('prestige-display').innerText = `x${game.prestigeMult.toFixed(1)}`;
    }
}




function renderStore() {
    upgradesEl.innerHTML = '';
    buildingsEl.innerHTML = ''; // Limpiamos la lista de edificios
    let anyUp = false; // Variable para saber si hay mejoras disponibles

    // ===============================================
    // 1. MEJORAS DE EDIFICIOS (MK-1, MK-2...)
    // ===============================================
    buildingsConfig.forEach(b => {
        const count = game.buildings[b.id] || 0;
        milestones.forEach((th, i) => {
            const uid = `${b.id}-${th}`;
            // Si tienes los edificios necesarios y NO has comprado la mejora
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
    });

    // ===============================================
    // 2. MEJORAS ESPECIALES (CÓDIGO ACTUALIZADO)
    // ===============================================
    const specials = [
        // --- NUEVO: EL ACTIVADOR DE ANOMALÍAS ---
        { 
            id: 'unlock-anomalies', 
            name: 'Sensor de Anomalías', 
            icon: '🧿', // Ojo místico / Sensor
            cost: 10000000000, // 10 Billones (Coste Post-Omega)
            desc: 'Permite detectar inestabilidades en la realidad.\nDesbloquea la aparición de Anomalías.', 
            req: () => game.pearls.includes('red') // REQUISITO: Haber completado el Protocolo Omega (Perla Roja)
        },

        // --- UTILIDAD BÁSICA (Modificadas para requerir el Sensor) ---
        { 
            id: 'entropy-antenna', 
            name: 'Antena de Entropía', 
            icon: '📡', 
            cost: 50000, 
            desc: 'Anomalías aparecen un 20% más rápido.', 
            // Ahora requiere tener el Sensor comprado:
            req: () => game.upgrades.includes('unlock-anomalies') 
        },
        { 
            id: 'quantum-lens', 
            name: 'Lente Cuántica', 
            icon: '🔍', 
            cost: 150000, 
            desc: 'Las anomalías duran +2s en pantalla.', 
            req: () => game.upgrades.includes('unlock-anomalies')
        },
        
        // ... (Tus otras mejoras de sinergia: Red Neuronal, etc. déjalas igual) ...
        { id: 'grandma-mine-synergy', name: 'Red Neuronal', icon: '🧠', cost: 500000, desc: 'Servidores potencian Minas (+1%/cad uno).', req: () => game.buildings['grandma'] >= 50 && game.buildings['mine'] >= 10 },
        { id: 'factory-click-synergy', name: 'Sobrecarga de Pulsos', icon: '🌀', cost: 1000000, desc: 'Cada Sincrotrón da +5 de poder de click base.', req: () => game.buildings['factory'] >= 15 },
        { id: 'overcharge-plus', name: 'Batería de Helio', icon: '🔋', cost: 250000, desc: 'Sobrecarga dura 5 segundos más.', req: () => game.totalCookiesEarned > 750000 },

        // ... (La Cadena Omega se queda igual) ...
        { id: 'protocol-omega', name: 'Protocolo Omega', icon: '⚠️', cost: 5000000, desc: 'Inicia el experimento prohibido.\nProducción Global x1.2', req: () => game.totalCookiesEarned > 2000000 },
        { id: 'omega-phase-2', name: 'Resonancia Oscura', icon: '🔉', cost: 25000000, desc: 'Se oyen susurros en los servidores.\nProducción Global x1.5', req: () => game.upgrades.includes('protocol-omega') },
        { id: 'omega-phase-3', name: 'Fisura Dimensional', icon: '🌀', cost: 150000000, desc: 'La realidad comienza a agrietarse.\nProducción Global x2.0', req: () => game.upgrades.includes('omega-phase-2') },
        { id: 'omega-phase-4', name: 'Fallo de Contención', icon: '🚨', cost: 1000000000, desc: '¡LOS NIVELES DE ENTROPÍA SON CRÍTICOS!\nProducción Global x3.0', req: () => game.upgrades.includes('omega-phase-3') },
        
        // EL FINAL (Si ya tienes la perla roja, esta mejora ya no necesita salir, o puedes dejarla como "comprada")
        { id: 'omega-final', name: 'EL DESPERTAR', icon: '👁️', cost: 5000000000, desc: 'LIBERA AL VACÍO.\nProducción x5.0 + ???', req: () => game.upgrades.includes('omega-phase-4') && !isApocalypse }
    ];

    // MENSAJE SI NO HAY MEJORAS DISPONIBLES
    if(!anyUp) upgradesEl.innerHTML = '<div style="color:#444; font-size:0.8rem; width:100%; text-align:center;">Juega más para desbloquear tecnología...</div>';

    // ===============================================
    // 3. RENDERIZAR LISTA DE EDIFICIOS (CON REVELACIÓN PROGRESIVA)
    // ===============================================
    let lockedShown = 0; // Contador de edificios bloqueados visibles

    for (let i = 0; i < buildingsConfig.length; i++) {
        const b = buildingsConfig[i];
        const count = game.buildings[b.id] || 0;
        const owned = count > 0;

        // CRITERIO DE VISIBILIDAD:
        // 1. Si ya tienes uno comprado -> SE VE.
        // 2. Si es el primer edificio (Cursor) -> SE VE.
        // 3. Si no lo tienes, pero es uno de los siguientes 2 -> SE VE.
        
        if (owned || i === 0 || lockedShown < 2) {
            
            const cost = getCost(b.id);
            const div = document.createElement('div');
            div.className = 'building-item';
            div.dataset.cost = cost; 
            
            // Si no lo tienes, sumamos al contador de "bloqueados visibles"
            if (!owned) lockedShown++;

            // Visual: Si está bloqueado y es el "segundo" bloqueado, lo mostramos con misterio
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
            }

            // IMPORTANTE: Si es misterioso, el click no hace nada
            if (!isMystery) {
                div.onclick = () => window.buyBuilding(b.id);
            } else {
                div.style.cursor = "default";
            }

            buildingsEl.appendChild(div);

        } else {
            // Si ya hemos mostrado 2 bloqueados, no dibujamos más y SALIMOS del bucle
            break; 
        }
    }
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
    sfxClick();
    
    // 1. AUMENTAR COMBO
    comboMultiplier += 0.05; 
    if(comboMultiplier > 5.0) comboMultiplier = 5.0; 
    comboTimer = 2.0; 
    
    // Actualizar UI del combo (Visual)
    const comboEl = document.getElementById('combo-display');
    if (comboEl) { // Protección por si no existe aún
        comboEl.style.opacity = 1;
        comboEl.style.transform = `scale(${1 + comboMultiplier/10})`; // Pequeño efecto de latido visual
        comboEl.innerText = `COMBO x${comboMultiplier.toFixed(2)}`;
    }

    // 2. CALCULAR DAÑO BASE
    // Nota: getClickPower() ya incluye el multiplicador de combo actual
    let val = getClickPower();
    let isCrit = false;

    // --- CÁLCULO DE CRÍTICO ---
    let critChance = 0;
    
    // Mejora Cosmos: Punto Débil
    if (game.heavenlyUpgrades.includes('crit_master')) critChance += 0.05;
    
    // Ayudante: Sargento Kael (ID: h_crit)
    // Comprobamos directamente si tenemos el ID en el array de helpers comprados
    if (game.helpers.includes('h_crit')) critChance += 0.10;

    // Tirada de dados
    if (Math.random() < critChance) {
        isCrit = true;
        val *= 10; // ¡Daño masivo!
        
        // Sonido especial (Agudo y rápido)
        playTone(600, 'square', 0.1, 0.2); 
        
        // Efecto visual extra: Shake de cámara manual
        camera.position.x += (Math.random() - 0.5) * 0.5;
        camera.position.y += (Math.random() - 0.5) * 0.5;
    }

    // 3. APLICAR RESULTADO
    game.cookies += val;
    game.totalCookiesEarned += val;
    
    // --- AQUÍ ESTABA EL ERROR DE LAS ESTADÍSTICAS ---
    if (!game.totalClicks) game.totalClicks = 0; // Protección inicial
    game.totalClicks++; // Esto actualiza la estadística del menú
    game.clickCount++;  // Esto mantiene la lógica interna de logros
    // -----------------------------------------------
    
    // 4. TEXTO FLOTANTE
    // Pasamos el 4º argumento 'isCrit' a la función de texto
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
        id: 'genesis', name: 'Big Bang', icon: '💥', cost: 1, 
        x: 400, y: 300, 
        desc: 'El comienzo de todo. Empiezas con 100 Watts tras reiniciar.', 
        parents: [] 
    },

    // --- RAMA IZQUIERDA: INDUSTRIAL (PRODUCCIÓN PASIVA) ---
    { 
        id: 'starter_kit', name: 'Kit de Supervivencia', icon: '📦', cost: 5, 
        x: 300, y: 300, 
        desc: 'Inicias con 10 Generadores Manuales y 5 Hámsters gratis.', 
        parents: ['genesis'] 
    },
    { 
        id: 'perm_prod_1', name: 'Eficiencia Industrial I', icon: '🏭', cost: 25, 
        x: 220, y: 250, 
        desc: 'Toda la producción de edificios +15% PERMANENTE.', 
        parents: ['starter_kit'] 
    },
    { 
        id: 'cheaper_builds', name: 'Arquitectura Cuántica', icon: '📉', cost: 100, 
        x: 150, y: 300, 
        desc: 'Todos los edificios cuestan un 5% menos (acumulable con otros descuentos).', 
        parents: ['starter_kit'] 
    },
    { 
        id: 'offline_god', name: 'Cronos', icon: '💤', cost: 250, 
        x: 80, y: 250, 
        desc: 'Gana el 100% de producción offline (antes 50%) durante 24h.', 
        parents: ['perm_prod_1'] 
    },
    { 
        id: 'synergy_passive', name: 'Sinergia Estructural', icon: '🏗️', cost: 1000, 
        x: 80, y: 350, 
        desc: 'Por cada 50 edificios que tengas en total, ganas +10% de Producción Global.', 
        parents: ['cheaper_builds'] 
    },

    // --- RAMA DERECHA: CINÉTICA (CLICKS Y CRÍTICOS) ---
    { 
        id: 'click_transistor', name: 'Transistor de Dedo', icon: '👆', cost: 10, 
        x: 500, y: 300, 
        desc: 'Tus clicks ahora generan el 1% de tu Producción por Segundo (WPS).', 
        parents: ['genesis'] 
    },
    { 
        id: 'crit_master', name: 'Punto Débil', icon: '🎯', cost: 50, 
        x: 580, y: 250, 
        desc: 'Probabilidad base de crítico manual +5%.', 
        parents: ['click_transistor'] 
    },
    { 
        id: 'click_god', name: 'Mano de Dios', icon: '⚡', cost: 300, 
        x: 650, y: 300, 
        desc: 'El 1% de WPS pasa a ser el 5% de WPS por click.', 
        parents: ['click_transistor'] 
    },
    { 
        id: 'click_frenzy_boost', name: 'Condensador de Flujo', icon: '🖱️', cost: 1500, 
        x: 720, y: 250, 
        desc: 'Los buffs de "Clickstorm" (x777) duran el doble de tiempo.', 
        parents: ['crit_master', 'click_god'] 
    },

    // --- RAMA INFERIOR: CAOS (ANOMALÍAS Y SUERTE) ---
    { 
        id: 'lucky_star', name: 'Suerte Cósmica', icon: '🍀', cost: 50, 
        x: 400, y: 400, 
        desc: 'Las anomalías aparecen un 15% más frecuentemente.', 
        parents: ['genesis'] 
    },
    { 
        id: 'wrath_control', name: 'Diplomacia del Vacío', icon: '🤝', cost: 200, 
        x: 350, y: 480, 
        desc: 'Las anomalías rojas (malas) tienen un 50% menos de probabilidad de efecto negativo.', 
        parents: ['lucky_star'] 
    },
    { 
        id: 'golden_duration', name: 'Estabilidad Temporal', icon: '⏳', cost: 500, 
        x: 450, y: 480, 
        desc: 'Los efectos de las anomalías (x7, x777) duran +10 segundos.', 
        parents: ['lucky_star'] 
    },
    { 
        id: 'anomaly_nuke', name: 'Colapso de Probabilidad', icon: '🎲', cost: 5000, 
        x: 400, y: 550, 
        desc: 'Las anomalías de "Dinero Instantáneo" dan el triple de recompensa.', 
        parents: ['wrath_control', 'golden_duration'] 
    },

    // --- RAMA SUPERIOR: DIVINA (ENDGAME / MULTIPLICADORES PUROS) ---
    { 
        id: 'galaxy_brain', name: 'Cerebro Galáctico', icon: '🧠', cost: 1000, 
        x: 400, y: 200, 
        desc: 'Por cada Logro desbloqueado, ganas +2% de Producción Global.', 
        parents: ['genesis'] 
    },
    { 
        id: 'dark_matter_engine', name: 'Motor de Materia Oscura', icon: '🌌', cost: 10000, 
        x: 320, y: 120, 
        desc: 'Aumenta la producción base de TODO un x2.0 (Se multiplica con todo).', 
        parents: ['galaxy_brain'] 
    },
    { 
        id: 'singularity', name: 'LA SINGULARIDAD', icon: '👁️', cost: 100000, 
        x: 480, y: 120, 
        desc: 'Rompe el juego. Comienzas con todas las mejoras tecnológicas de Tier 1 y 2 desbloqueadas.', 
        parents: ['galaxy_brain'] 
    },
    { 
        id: 'multiverse', name: 'Multiverso', icon: '🪐', cost: 1000000, // 1 Millón
        x: 400, y: 50, 
        desc: 'Prestigio Infinito: Tu multiplicador de Ascensión es el doble de efectivo.', 
        parents: ['dark_matter_engine', 'singularity'] 
    }
];

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
    
    
    // Configuración compacta
    const treeW = 800; const treeH = 600;
    canvas.width = treeW; canvas.height = treeH;
    container.style.width = treeW + 'px'; container.style.height = treeH + 'px';
    ctx.clearRect(0, 0, treeW, treeH);
    container.innerHTML = '';

    // Actualizar cabecera con Nivel y Moneda
    document.getElementById('heaven-antimatter').innerText = formatNumber(game.antimatter);
    document.getElementById('heaven-level').innerText = formatNumber(game.prestigeLevel);

    heavenlyConfig.forEach(node => {
        const isBought = game.heavenlyUpgrades.includes(node.id);
        const isAvailable = !isBought && (node.parents.length === 0 || node.parents.some(pid => game.heavenlyUpgrades.includes(pid)));
        
        // DIBUJAR LÍNEAS
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

        // NODO
        const div = document.createElement('div');
        div.className = `heaven-node ${isBought ? 'bought' : (isAvailable ? 'available' : 'locked')}`;
        div.style.left = node.x + 'px'; div.style.top = node.y + 'px';
        div.innerHTML = node.icon;
        
        // --- EVENTOS DEL TOOLTIP (SIN CSS) ---
        div.onmouseenter = (e) => {
            const status = isBought ? "✅ COMPRADO" : (isAvailable ? `CLICK PARA COMPRAR` : "🔒 BLOQUEADO");
            const costTxt = isBought ? "" : `\nCoste: ${formatNumber(node.cost)} AM`;
            
            tooltip.innerHTML = `<strong style="color:#b388ff">${node.name}</strong><br>${node.desc}<br><br><span style="color:${isAvailable?'#ffd700':'#888'}">${status}${costTxt}</span>`;
            tooltip.style.display = 'block';
            
            // Posicionar tooltip cerca del ratón o del nodo (ajustado al contenedor padre modal-box)
            const boxRect = document.querySelector('.heaven-modal-box').getBoundingClientRect();
            const nodeRect = div.getBoundingClientRect();
            
            // Calculamos posición relativa a la caja modal
            let top = nodeRect.bottom - boxRect.top + 10;
            let left = nodeRect.left - boxRect.left - 100; // Centrado
            
            tooltip.style.top = top + 'px';
            tooltip.style.left = left + 'px';
        };

        div.onmouseleave = () => { tooltip.style.display = 'none'; };
        
        div.onclick = () => buyHeavenlyUpgrade(node);
        container.appendChild(div);
    });
}




function buyHeavenlyUpgrade(node) {
    if (game.heavenlyUpgrades.includes(node.id)) return; // Ya comprado
    
    // Chequear requisitos
    const isAvailable = node.parents.length === 0 || node.parents.some(pid => game.heavenlyUpgrades.includes(pid));
    if (!isAvailable) return;

    if (game.antimatter >= node.cost) {
        sfxBuy();
        game.antimatter -= node.cost;
        game.heavenlyUpgrades.push(node.id);
        
        document.getElementById('heaven-antimatter').innerText = formatNumber(game.antimatter);
        renderHeavenTree();
        saveGame(); // Guardar progreso importante
    } else {
        showSystemModal("ENERGÍA CÓSMICA INSUFICIENTE", "Necesitas más Antimateria para fusionar esta realidad.", false, null);
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
    const prestige = game.prestigeLevel || 0;

    // Cálculo de tiempo
    let h = Math.floor(timePlayed / 3600);
    let m = Math.floor((timePlayed % 3600) / 60);
    let s = Math.floor(timePlayed % 60);
    const timeString = `${h}h ${m}m ${s}s`;

    // Formateo de números (usa tu formatNumber si existe, o local)
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

