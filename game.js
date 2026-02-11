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
    { id: 'cursor', name: 'Nanobot', type: 'click', baseCost: 15, basePower: 1, desc: '+1 click base' },
    { id: 'grandma', name: 'Servidor', type: 'auto', baseCost: 100, basePower: 1, desc: '+1/s base' },
    { id: 'farm', name: 'Panel Solar', type: 'auto', baseCost: 1100, basePower: 8, desc: '+8/s base' },
    { id: 'mine', name: 'Mina Cuántica', type: 'auto', baseCost: 12000, basePower: 47, desc: '+47/s base' },
    { id: 'factory', name: 'Sincrotrón', type: 'auto', baseCost: 130000, basePower: 260, desc: '+260/s base' },
    { id: 'bank', name: 'Materia Oscura', type: 'auto', baseCost: 1400000, basePower: 1400, desc: '+1.4k/s base' },
    { id: 'temple', name: 'Esfera Dyson', type: 'auto', baseCost: 20000000, basePower: 7800, desc: '+7.8k/s base' },
    { id: 'portal', name: 'Portal Dimensional', type: 'auto', baseCost: 330000000, basePower: 44000, desc: '+44k/s base' }
];

const milestones = [10, 25, 50, 100, 200];
for (let i = 400; i <= 10000; i *= 2) milestones.push(i);
const upgradeIcons = ["⚡", "🔋", "💾", "📡", "🧪", "☢️", "🌌", "🪐", "⚛️"];

let game = {
    cookies: 0,
    totalCookiesEarned: 0,
    clickCount: 0,
    prestigeMult: 1,
    antimatter: 0,
    buildings: {},
    achievements: [], 
    upgrades: [],
    heavenlyUpgrades: [],
    prestigeLevel: 0,   // Nivel TOTAL (Determina el multiplicador) <-- NUEVO
    helpers: [] // IDs de ayudantes activos
};

// Variables temporales (no se guardan)
let buffMultiplier = 1; // Multiplicador global de producción
let clickBuffMultiplier = 1; // Multiplicador de clicks
let isApocalypse = false;

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
    // TIER 1 (PRINCIPIANTE)
    { 
        id: 'h_clicker', 
        name: '👽 Graxion el Potenciador', 
        desc: 'Tus clicks son un +300% más potentes.', 
        cost: 15, icon: '👽', 
        reqLevel: 5, // ~125 Energía total
        effect: 'clickPower', value: 3 
    },
    { 
        id: 'h_miner', 
        name: '🤖 Unit-734', 
        desc: 'Producción automática +50%.', 
        cost: 50, icon: '🤖', 
        reqLevel: 10, // ~1,000 Energía
        effect: 'cpsMultiplier', value: 1.5 
    },
    
    // TIER 2 (INTERMEDIO)
    { 
        id: 'h_discount', 
        name: '🛒 Mercader Ferengi', 
        desc: 'Los edificios cuestan un 10% menos.', 
        cost: 100, icon: '🛒', 
        reqLevel: 15, // ~3,375 Energía
        effect: 'costReduction', value: 0.9 
    },
    { 
        id: 'h_combo', 
        name: '⭐ Nebula Táctica', 
        desc: 'El combo dura el doble (x2 tiempo).', 
        cost: 200, icon: '⭐', 
        reqLevel: 20, // ~8,000 Energía
        effect: 'comboTime', value: 2 
    },

    // TIER 3 (AVANZADO)
    { 
        id: 'h_anomaly', 
        name: '🔮 Oráculo del Vacío', 
        desc: 'Las anomalías aparecen el doble de rápido.', 
        cost: 500, icon: '🔮', 
        reqLevel: 30, // ~27,000 Energía
        effect: 'anomalyRate', value: 2 
    },
    { 
        id: 'h_crit', 
        name: '🎯 Francotirador Cuántico', 
        desc: '10% de probabilidad de Click Crítico (x10 daño).', 
        cost: 800, icon: '🎯', 
        reqLevel: 40, // ~64,000 Energía
        effect: 'critChance', value: 0.1 
    },

    // TIER 4 (EXPERTO)
    { 
        id: 'h_overcharge', 
        name: '⚡ Ingeniero de Plasma', 
        desc: 'Sobrecarga se enfría en la mitad de tiempo.', 
        cost: 1200, icon: '⚡', 
        reqLevel: 50, // ~125,000 Energía
        effect: 'overchargeCooldown', value: 0.5 
    },
    { 
        id: 'h_banker', 
        name: '💰 Inversor Galáctico', 
        desc: 'Las anomalías de dinero dan +50% extra.', 
        cost: 2000, icon: '💰', 
        reqLevel: 65, // ~274,000 Energía
        effect: 'goldenCookieBuff', value: 1.5 
    },

    // TIER 5 (MAESTRO)
    { 
        id: 'h_synergy', 
        name: '🔗 Mente Colmena', 
        desc: 'Ganas +1% CPS por cada edificio que poseas.', 
        cost: 5000, icon: '🔗', 
        reqLevel: 80, // ~512,000 Energía
        effect: 'buildingSynergy', value: 0.01 
    },
    { 
        id: 'h_master', 
        name: '👑 Emperador del Tiempo', 
        desc: 'Aumenta TODO (Click y Prod) un x2.0.', 
        cost: 10000, icon: '👑', 
        reqLevel: 100, // 1,000,000 Energía
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
let overchargeCooldown = false;

const particleGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const particleMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

function initThree() {
    const canvas = document.getElementById('three-canvas');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.03);

    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 8;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? 1.5 : 1);

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
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (raycaster.intersectObject(mainObject).length > 0) {
        doClickLogic(e.clientX, e.clientY);
        
        // Shake
        camera.position.x = (Math.random() - 0.5) * 0.2; 
        camera.position.y = (Math.random() - 0.5) * 0.2;
        
        mainObject.scale.setScalar(0.9);
        glowMesh.scale.setScalar(0.95);
        setTimeout(() => {
            mainObject.scale.setScalar(1);
            glowMesh.scale.setScalar(1);
        }, 80);

        spawnParticles(raycaster.intersectObject(mainObject)[0].point);
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
    const cps = getCPS();
    
    // Vibración: más fuerte si hay apocalipsis
    const shakeBase = isApocalypse ? 0.005 : 0.001; 
    
    const rotSpeed = 0.005 + Math.min(0.1, cps * 0.00001);
    mainObject.rotation.y += rotSpeed;
    mainObject.rotation.x += rotSpeed * 0.5;
    glowMesh.rotation.y -= rotSpeed;
    
    // --- LÓGICA DE COLORES (NUEVO) ---
    const time = Date.now() * 0.002;
    if (isApocalypse) {
        // MODO APOCALIPSIS (ROJO)
        mainObject.material.color.setHex(0xff0000); 
        mainObject.material.emissive.setHex(0x550000);
        glowMesh.material.color.setHex(0xff3300);   
        scene.fog.color.setHex(0x220000);           
        mainObject.scale.setScalar(1 + Math.sin(time * 5) * 0.05); // Latido rápido
    } else {
        // MODO NORMAL (VERDE/AZUL)
        mainObject.material.color.setHex(0x00ff88);
        mainObject.material.emissive.setHex(0x004422);
        glowMesh.material.color.setHex(0x7c4dff);
        scene.fog.color.setHex(0x000000);
        mainObject.scale.setScalar(1); 
    }
    // ---------------------------------
    
    const positions = starMesh.geometry.attributes.position.array;
    const starSpeed = 0.05 + Math.min(2.0, cps * 0.0005); 
    
    for(let i=2; i<positions.length; i+=3) {
        positions[i] += starSpeed;
        if(positions[i] > 20) positions[i] = -40; 
    }
    starMesh.geometry.attributes.position.needsUpdate = true;

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.userData.vel);
        p.scale.multiplyScalar(0.92);
        if(p.scale.x < 0.01) { scene.remove(p); particles.splice(i, 1); }
    }

    camera.position.lerp(new THREE.Vector3(0,0,8), 0.1);
    mainObject.material.emissiveIntensity = 0.5 + Math.sin(time) * 0.2;

    composer.render();
}

function onResize() {
    const canvas = document.getElementById('three-canvas');
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    camera.aspect = w/h; camera.updateProjectionMatrix();
    renderer.setSize(w, h); composer.setSize(w, h);
}






// ==========================================
// 4. LÓGICA DE JUEGO
// ==========================================
// ANOMALIAS RANDOM (FRENZY GOLDEN COOKIES)

function spawnAnomaly() {
    // Probabilidad de corrupción (30% si hay Apocalipsis)
    const isCorrupt = isApocalypse && Math.random() < 0.3;
    
    const types = ['money', 'money', 'production', 'click']; 
    const type = types[Math.floor(Math.random() * types.length)];
    
    const orb = document.createElement('div');
    let icon = '⚛️';
    let color = 'gold';
    
    // VISUALES

    
    if (isCorrupt) {
        icon = '🤬'; 
        color = '#ff0000'; // Rojo sangre
    } else {
        if (type === 'production') { icon = '🔥'; color = '#ff5252'; } 
        if (type === 'click') { icon = '⚡'; color = '#00e5ff'; }
    }

    orb.innerHTML = icon;
    orb.style.cssText = `
        position: absolute; font-size: 4rem; cursor: pointer; z-index: 999;
        filter: drop-shadow(0 0 15px ${color}); 
        animation: floatAnomaly ${isCorrupt ? '0.5s' : '3s'} infinite ease-in-out;
        left: ${Math.random() * 80 + 10}%; top: ${Math.random() * 80 + 10}%;
    `;

    orb.onclick = () => {
        sfxAnomaly();
        
        if (isCorrupt) {
            // --- LÓGICA DE CORRUPCIÓN ---
            const roll = Math.random();
            if (roll < 0.4) { 
                // 40% Malo: Ruptura
                activateBuff('production', 0.5, 30);
                showAnomalyPopup("⚠️ FALLO DE SISTEMA<br><span style='font-size:0.9em; color:#fff'>Producción -50% (30s)</span>", "evil");
            } else if (roll < 0.8) { 
                // 40% Malo: Pérdida
                const loss = game.cookies * 0.05;
                game.cookies -= loss;
                createFloatingText(parseInt(orb.style.left), parseInt(orb.style.top), `-${formatNumber(loss)}`, "#ff0000");
                showAnomalyPopup(`📉 FUGA DE ENERGÍA<br><span style='font-size:0.9em; color:#fff'>Perdiste ${formatNumber(loss)}</span>`, "evil");
            } else { 
                // 20% Épico: Elder Frenzy
                activateBuff('production', 666, 6); 
                showAnomalyPopup("👹 ¡PODER ABSOLUTO!<br><span style='font-size:0.9em; color:#fff'>Producción x666 (6s)</span>", "evil");
            }
        } else {
            // --- EFECTOS NORMALES ---
            if (type === 'money') {
                const percentage = 0.15; // 15% (Puedes cambiarlo a 0.10 o 0.20)
                let bonus = game.cookies * percentage;
                game.cookies += bonus;
                game.totalCookiesEarned += bonus;
                createFloatingText(parseInt(orb.style.left), parseInt(orb.style.top), `+${formatNumber(bonus)}`);
                // Notificación verde
                showAnomalyPopup(
                    `⚛️ IMPULSO DE MATERIA<br>
                    <span style='font-size:0.9em; color:#fff'>
                        Ganancia: +${formatNumber(bonus)} 
                        <span style="font-size:0.7em; color:#aaa">(+${percentage*100}% de energía)</span>
                    </span>`, 
                    "good"
                );

            } else if (type === 'production') {
                // Notificación fuego
                showAnomalyPopup("🔥 FRENESÍ<br><span style='font-size:0.9em; color:#fff'>Producción x7 (30s)</span>", "fire");
            } else if (type === 'click') {
                activateBuff('click', 777, 10);
                // Notificación eléctrica
                showAnomalyPopup("⚡ SOBRECARGA CÓSMICA<br><span style='font-size:0.9em; color:#fff'>Producción x777 (10s)</span>", "shock");
            }
        }
        orb.remove();
    };


    

    document.getElementById('game-area').appendChild(orb);
    
    // TIEMPOS
    let lifeTime = isCorrupt ? 10000 : 6000; // Las malas duran más
    if (game.upgrades.includes('quantum-lens')) lifeTime += 2000;
    setTimeout(() => { if(orb.parentNode) orb.remove(); }, lifeTime); 

    const anomalyHelper = helpersConfig.find(h => h.effect === 'anomalyRate');
    let baseTime = 30000 + Math.random() * 60000; 
    if (anomalyHelper && game.helpers.includes(anomalyHelper.id)) baseTime /= anomalyHelper.value;
    if (game.upgrades.includes('entropy-antenna')) baseTime *= 0.8; 
    
    setTimeout(spawnAnomaly, baseTime);
}


function showAnomalyPopup(text, type = 'good') {
    const container = document.getElementById('anomaly-notifications');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `anomaly-popup ${type}`;
    div.innerHTML = text;
    
    container.appendChild(div);

    // Borramos el elemento del DOM después de que termine la animación (5s)
    setTimeout(() => {
        if (div.parentNode) div.remove();
    }, 5000);
}



window.spawnAnomaly = spawnAnomaly;

// Función auxiliar para gestionar los tiempos de los buffs
function activateBuff(type, amount, seconds) {
    if (type === 'production') {
        buffMultiplier = amount;
        document.getElementById('game-area').style.border = "2px solid #ff5252"; // Efecto visual
    } else {
        clickBuffMultiplier = amount;
        document.getElementById('game-area').style.border = "2px solid #00e5ff"; // Efecto visual
    }
    
    updateUI(); // Para reflejar el cambio en CPS inmediatamente

    setTimeout(() => {
        // Resetear buff
        if (type === 'production') buffMultiplier = 1;
        else clickBuffMultiplier = 1;
        
        document.getElementById('game-area').style.border = "none";
        updateUI();
        showNotification("SISTEMA", "Los niveles de energía se han normalizado.");
    }, seconds * 1000);
}





function getClickPower() {
    const cursorData = buildingsConfig.find(u => u.id === 'cursor');
    const count = game.buildings[cursorData.id] || 0;
    
    // Poder base + mejoras MK
    let power = (1 + (count * cursorData.currentPower)) * game.prestigeMult;
    
    // MEJORA ESPECIAL: Sinergia Sincrotrón (Cada uno da +5 poder base al click)
    if (game.upgrades.includes('factory-click-synergy')) {
        const factoryCount = game.buildings['factory'] || 0;
        power += (factoryCount * 5);
    }

    // Efecto de ayudante de clicks
    const clickHelper = helpersConfig.find(h => h.effect === 'clickPower');
    if (clickHelper && game.helpers.includes(clickHelper.id)) {
        power *= clickHelper.value;
    }
        // Lógica de "Dedo Divino" (1% CPS añadido al click)
    if (game.heavenlyUpgrades.includes('click_god')) {
        power += (getCPS() * 0.01);
    }
    return Math.floor(power * comboMultiplier * clickBuffMultiplier);
}


function getCPS() {
    let cps = 0;
    buildingsConfig.forEach(u => {
        if (u.type === 'auto') {
            let bPower = (game.buildings[u.id] || 0) * u.currentPower;
            
            // Sinergia: Red Neuronal
            if (u.id === 'mine' && game.upgrades.includes('grandma-mine-synergy')) {
                const grandmaCount = game.buildings['grandma'] || 0;
                bPower *= (1 + (grandmaCount * 0.01));
            }
            cps += bPower;
        }
    });

    let total = cps * game.prestigeMult;
    
    // Ayudante de producción
    const prodHelper = helpersConfig.find(h => h.effect === 'cpsMultiplier');
    if (prodHelper && game.helpers.includes(prodHelper.id)) {
        total *= prodHelper.value;
    }

    // --- CADENA OMEGA (MULTIPLICADORES DE LORE) ---
    // Fase 1: Protocolo Omega (x1.2)
    if (game.upgrades.includes('protocol-omega')) total *= 1.2;
    // Fase 2: Resonancia (x1.5)
    if (game.upgrades.includes('omega-phase-2')) total *= 1.5;
    // Fase 3: Fisura (x2.0)
    if (game.upgrades.includes('omega-phase-3')) total *= 2.0;
    // Fase 4: Contención Fallida (x3.0)
    if (game.upgrades.includes('omega-phase-4')) total *= 3.0;
    // Fase 5: EL DESPERTAR (x5.0 + Apocalipsis visual)
    if (game.upgrades.includes('omega-final')) total *= 5.0;

    // Sobrecarga y Frenesí
    if (isOvercharged) total *= 5;
    if (game.heavenlyUpgrades.includes('perm_prod')) total *= 1.10; // +10% permanente
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
    return totalCost;
}

function getCost(id) {
    const item = buildingsConfig.find(u => u.id === id);
    return Math.floor(item.baseCost * Math.pow(1.15, game.buildings[id] || 0));
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


window.toggleHelper = function(helperId) {
    const helper = helpersConfig.find(h => h.id === helperId);
    if (!helper) return;
    
    // Calcular nivel actual del jugador (Raíz Cúbica del Total)
    const playerLevel = Math.floor(Math.cbrt(game.totalCookiesEarned));
    
    // Seguridad: No puedes fichar si no tienes nivel (anti-hackers)
    if (playerLevel < helper.reqLevel) return;

    const isActive = game.helpers.includes(helperId);
    
    if (isActive) {
        // DESACTIVAR (Siempre se puede)
        game.helpers = game.helpers.filter(id => id !== helperId);
        showNotification("❌ Ayudante Despedido", `${helper.name} ha vuelto a su planeta.`);
    } else {
        // ACTIVAR (Hay restricciones)
        
        // 1. ¿Hay hueco en la nave?
        if (game.helpers.length >= MAX_HELPERS) {
            showSystemModal(
                "NAVE LLENA", 
                `Solo tienes ${MAX_HELPERS} asientos disponibles.\nDebes despedir a alguien antes de contratar a ${helper.name}.`, 
                false
            );
            return;
        }

        // 2. ¿Puedes pagar su sueldo?
        const currentCPS = getCPS();
        const currentHelperCost = getHelpersCost(); 
        
        if (currentCPS - currentHelperCost < helper.cost) {
            showSystemModal(
                "SIN FONDOS",
                `Tu imperio no genera suficiente energía para pagar a ${helper.name}.\nCoste: ${helper.cost}/seg`,
                false
            );
            return;
        }
        
        // ¡Contratado!
        game.helpers.push(helperId);
        sfxPrestige(); 
        showNotification("✅ Ayudante Equipado", `${helper.name} se ha unido al equipo.`);
    }
    
    renderHelpers();
    updateUI();
};



function renderHelpers() {
    const container = document.getElementById('helpers-list');
    if (!container) return;
    
    container.innerHTML = '';

    // CABECERA (Igual que antes)
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
    
    // CÁLCULOS
    const currentCPS = getCPS();
    const currentHelperCost = getHelpersCost();
    const playerLevel = Math.floor(Math.cbrt(game.totalCookiesEarned)); 
    
    // LISTA
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

        // --- CAMBIO CLAVE: AHORA EL CLICK VA EN TODA LA CAJA ---
        if (!isLocked) {
            div.onclick = function() { toggleHelper(helper.id); };
        }

        // Textos y Contenido
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

        div.innerHTML = `
            <div class="helper-icon" style="${isLocked ? 'filter:grayscale(1); opacity:0.5' : ''}">${helper.icon}</div>
            <div class="helper-info">
                <h4 style="${isLocked ? 'color:#666' : ''}">${isLocked ? '???' : helper.name}</h4>
                <p>${isLocked ? 'Sigue acumulando energía.' : helper.desc}</p>
                <div class="${statusClass}">${statusText}</div>
            </div>
            <button class="helper-toggle ${isActive ? 'active' : ''}" style="pointer-events: none;">
                ${btnContent}
            </button>
        `;
        
        container.appendChild(div);
    });
}

// --- BUCLE PRINCIPAL ---
let lastTime = Date.now();

function gameLoop() {
    checkAchievements();
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
    scoreEl.innerText = formatNumber(Math.floor(game.cookies));
    const grossCPS = getCPS();
    const helperCost = getHelpersCost();
    const netCPS = getNetCPS();
    
    if (helperCost > 0) {
        cpsEl.innerText = `${formatNumber(netCPS.toFixed(1))} / seg (bruto: ${formatNumber(grossCPS.toFixed(1))} - ${formatNumber(helperCost)} ayudantes)`;
    } else {
        cpsEl.innerText = `${formatNumber(grossCPS.toFixed(1))} / seg`;
    }
    document.title = `${formatNumber(Math.floor(game.cookies))} Energía`;
    
    const pBtn = document.getElementById('btn-prestige');
    if(game.totalCookiesEarned > 1000000) {
        pBtn.style.display = 'block';
        const potentialMult = Math.floor(Math.cbrt(game.totalCookiesEarned / 1000000)) + 1;
        pBtn.innerText = `ASCENDER (x${potentialMult})`;
    }
    
    if(game.prestigeMult > 1) {
        document.getElementById('prestige-hud').style.display = 'block';
        document.getElementById('prestige-display').innerText = `x${game.prestigeMult}`;
    }
}



function renderStore() {
    upgradesEl.innerHTML = '';
    let anyUp = false;

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
    // 2. MEJORAS ESPECIALES (UTILIDAD Y CADENA OMEGA)
    // ===============================================
    const specials = [
        // --- UTILIDAD BÁSICA ---
        { id: 'entropy-antenna', name: 'Antena de Entropía', icon: '📡', cost: 50000, desc: 'Anomalías aparecen un 20% más rápido.', req: () => game.totalCookiesEarned > 100000 },
        { id: 'quantum-lens', name: 'Lente Cuántica', icon: '🔍', cost: 150000, desc: 'Las anomalías duran +2s en pantalla.', req: () => game.clickCount > 500 },
        { id: 'grandma-mine-synergy', name: 'Red Neuronal', icon: '🧠', cost: 500000, desc: 'Servidores potencian Minas (+1%/cad uno).', req: () => game.buildings['grandma'] >= 50 && game.buildings['mine'] >= 10 },
        { id: 'factory-click-synergy', name: 'Sobrecarga de Pulsos', icon: '🌀', cost: 1000000, desc: 'Cada Sincrotrón da +5 de poder de click base.', req: () => game.buildings['factory'] >= 15 },
        { id: 'overcharge-plus', name: 'Batería de Helio', icon: '🔋', cost: 250000, desc: 'Sobrecarga dura 5 segundos más.', req: () => game.totalCookiesEarned > 750000 },

        // --- LA CADENA OMEGA (CRESCENDO DE TERROR) ---
        // 1. INICIO
        { 
            id: 'protocol-omega', name: 'Protocolo Omega', icon: '⚠️', cost: 5000000, 
            desc: 'Inicia el experimento prohibido.\nProducción Global x1.2', 
            req: () => game.totalCookiesEarned > 2000000 
        },
        // 2. ADVERTENCIA
        { 
            id: 'omega-phase-2', name: 'Resonancia Oscura', icon: '🔉', cost: 25000000, 
            desc: 'Se oyen susurros en los servidores.\nProducción Global x1.5', 
            req: () => game.upgrades.includes('protocol-omega') 
        },
        // 3. PELIGRO
        { 
            id: 'omega-phase-3', name: 'Fisura Dimensional', icon: '🌀', cost: 150000000, 
            desc: 'La realidad comienza a agrietarse.\nProducción Global x2.0', 
            req: () => game.upgrades.includes('omega-phase-2') 
        },
        // 4. PUNTO DE NO RETORNO
        { 
            id: 'omega-phase-4', name: 'Fallo de Contención', icon: '🚨', cost: 1000000000, // 1 Billón
            desc: '¡LOS NIVELES DE ENTROPÍA SON CRÍTICOS!\nProducción Global x3.0', 
            req: () => game.upgrades.includes('omega-phase-3') 
        },
        // 5. EL FINAL (ACTIVADOR DEL APOCALIPSIS)
        { 
            id: 'omega-final', name: 'EL DESPERTAR', icon: '👁️', cost: 5000000000, // 5 Billones
            desc: 'LIBERA AL VACÍO.\nProducción x5.0 + ???', 
            req: () => game.upgrades.includes('omega-phase-4') && !isApocalypse
        }
    ];

    specials.forEach(s => {
        // Si cumples los requisitos (req) y NO la has comprado
        if (s.req() && !game.upgrades.includes(s.id)) {
            anyUp = true;
            
            const btn = document.createElement('div');
            // Detectar si es Omega para darle estilo especial si quieres
            const isOmega = s.id.startsWith('omega') || s.id === 'protocol-omega';
            
            btn.className = isOmega ? 'upgrade-crate omega' : 'upgrade-crate special';
            btn.innerHTML = s.icon;
            btn.dataset.cost = s.cost;
            btn.setAttribute('data-tooltip', `${s.name}\n${s.desc}\nCoste: ${formatNumber(s.cost)}`);
            
            btn.onclick = () => window.buyUpgrade(s.id, s.cost);
            upgradesEl.appendChild(btn);
        }
    });

    // MENSAJE SI NO HAY MEJORAS DISPONIBLES
    if(!anyUp) upgradesEl.innerHTML = '<div style="color:#444; font-size:0.8rem; width:100%; text-align:center;">Juega más para desbloquear tecnología...</div>';

    // ===============================================
    // 3. RENDERIZAR LISTA DE EDIFICIOS (STORE)
    // ===============================================
    buildingsEl.innerHTML = '';
    buildingsConfig.forEach(b => {
        const count = game.buildings[b.id] || 0;
        const cost = getCost(b.id);
        
        const div = document.createElement('div');
        div.className = 'building-item';
        div.dataset.cost = cost;
        
        const mult = b.currentPower / b.basePower;
        const multTxt = mult > 1 ? `<span style="color:var(--accent); font-size:0.8em">x${mult}</span>` : '';
        
        div.innerHTML = `
            <div class="item-info">
                <h4>${b.name} ${multTxt}</h4>
                <p>${b.desc}</p>
                <div class="item-cost">⚡ ${formatNumber(cost)}</div>
            </div>
            <div class="item-count">${count}</div>
        `;
        
        div.onclick = () => window.buyBuilding(b.id);
        buildingsEl.appendChild(div);
    });
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
    comboMultiplier += 0.05; 
    if(comboMultiplier > 5.0) comboMultiplier = 5.0; 
    comboTimer = 2.0; 
    const comboEl = document.getElementById('combo-display');
    comboEl.style.opacity = 1;
    comboEl.innerText = `COMBO x${comboMultiplier.toFixed(2)}`;

    const val = getClickPower();
    game.cookies += val;
    game.totalCookiesEarned += val;
    game.clickCount++;
    createFloatingText(cx, cy, `+${formatNumber(val)}`);
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
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return Math.floor(n);
}

window.saveGame = function() {
    game.isApocalypse = isApocalypse;
    game.lastSaveTime = Date.now();
    localStorage.setItem('quantumClickerUlt', JSON.stringify(game));
    const btn = document.querySelector('button[onclick="saveGame()"]');
    if(btn) {
        const old = btn.innerText; btn.innerText = "OK!"; setTimeout(()=>btn.innerText=old, 1000);
    }
}

function loadGame() {
    const d = JSON.parse(localStorage.getItem('quantumClickerUlt'));
    if(d) {
        game = { ...game, ...d };
        if (typeof d.isApocalypse !== 'undefined') isApocalypse = d.isApocalypse;
        if(!game.upgrades) game.upgrades = [];
        if(!game.prestigeMult) game.prestigeMult = 1;
        if(!game.antimatter) game.antimatter = 0;
        if(!game.achievements) game.achievements = [];
        if(!game.helpers) game.helpers = [];

        // Offline progress
        if (game.lastSaveTime) {
            const now = Date.now();
            const secondsOffline = (now - game.lastSaveTime) / 1000;
            if (secondsOffline > 60) {
                const offlineProduction = (getCPS() * secondsOffline) * 0.5;
                if (offlineProduction > 0) {
                    game.cookies += offlineProduction;
                    game.totalCookiesEarned += offlineProduction;
                    alert(`¡Bienvenido de nuevo!\nHas generado: +${formatNumber(offlineProduction)} Energía offline.`);
                }
            }
        }
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
    // Clicks Manuales
    { id: 'click100', name: 'Dedo Caliente', desc: '100 clicks manuales.', req: g => g.clickCount >= 100 },
    { id: 'click1k', name: 'Dedo Biónico', desc: '1,000 clicks manuales.', req: g => g.clickCount >= 1000 },
    { id: 'click10k', name: 'Dedo Cuántico', desc: '10,000 clicks manuales.', req: g => g.clickCount >= 10000 },
    
    // Mejoras Compradas
    { id: 'upg5', name: 'Innovador', desc: 'Compra 5 mejoras de tecnología.', req: g => g.upgrades.length >= 5 },
    { id: 'upg20', name: 'Científico Loco', desc: 'Compra 20 mejoras de tecnología.', req: g => g.upgrades.length >= 20 },
    
    // Progreso General
    { id: 'build10', name: 'Arquitecto', desc: 'Ten 10 edificios en total.', req: g => Object.values(g.buildings).reduce((a,b)=>a+b,0) >= 10 },
    { id: 'cps100', name: 'Generador', desc: 'Alcanza 100 energía/seg.', req: () => getCPS() >= 100 },
    { id: 'million', name: 'Millonario', desc: 'Acumula 1 Millón de energía total.', req: g => g.totalCookiesEarned >= 1000000 },
    { id: 'hacker', name: 'Hacker', desc: 'Haz un combo x3.0.', req: () => comboMultiplier >= 3.0 },
    
    // Ayudantes
    { id: 'helper1', name: 'Primer Contacto', desc: 'Contrata tu primer ayudante alienígena.', req: g => g.helpers && g.helpers.length >= 1 },
    { id: 'helper3', name: 'Equipo Galáctico', desc: 'Ten 3 ayudantes activos simultáneamente.', req: g => g.helpers && g.helpers.length >= 3 }
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

function renderCollection() {
    const upgradesGrid = document.getElementById('collection-upgrades');
    const helpersGrid = document.getElementById('collection-helpers');
    
    upgradesGrid.innerHTML = '';
    helpersGrid.innerHTML = '';

    // --- 1. RENDERIZAR MEJORAS (TECNOLOGÍA) ---
    // A) Generamos la lista de TODAS las mejoras posibles de edificios
    let allPossibleUpgrades = [];
    
    // Mejoras de Edificios (MK-1, MK-2...)
    buildingsConfig.forEach(b => {
        milestones.forEach((th, i) => {
            allPossibleUpgrades.push({
                id: `${b.id}-${th}`,
                name: `${b.name} MK-${i+1}`,
                icon: upgradeIcons[i % upgradeIcons.length]
            });
        });
    });

    // B) Añadimos las Mejoras Especiales (Hardcoded)
    const specials = [
        { id: 'entropy-antenna', name: 'Antena de Entropía', icon: '📡' },
        { id: 'quantum-lens', name: 'Lente Cuántica', icon: '🔍' },
        { id: 'grandma-mine-synergy', name: 'Red Neuronal', icon: '🧠' },
        { id: 'factory-click-synergy', name: 'Sobrecarga de Pulsos', icon: '🌀' },
        { id: 'overcharge-plus', name: 'Batería de Helio', icon: '🔋' },
        { id: 'protocol-omega', name: 'Protocolo Omega', icon: '💀' }
    ];
    specials.forEach(s => allPossibleUpgrades.push(s));

    // C) Pintamos la rejilla
    allPossibleUpgrades.forEach(upg => {
        const hasIt = game.upgrades.includes(upg.id);
        const div = document.createElement('div');
        div.className = `collection-item ${hasIt ? 'unlocked' : 'locked'}`;
        div.innerHTML = upg.icon;
        div.setAttribute('data-title', hasIt ? upg.name : '??? (Tecnología desconocida)');
        upgradesGrid.appendChild(div);
    });

    // --- 2. RENDERIZAR AYUDANTES (ALIENS) ---
    // Calculamos nivel actual para saber si están desbloqueados
    const playerLevel = Math.floor(Math.cbrt(game.totalCookiesEarned));

    helpersConfig.forEach(helper => {
        // ¿Está desbloqueado por nivel? (Visible en la tienda)
        const isUnlocked = playerLevel >= helper.reqLevel;
        // ¿Lo tenemos contratado ahora mismo?
        const isHired = game.helpers.includes(helper.id);
        
        const div = document.createElement('div');
        // Si no tienes nivel suficiente, sale gris (locked). Si tienes nivel, sale color.
        div.className = `collection-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        // Si está contratado, le ponemos un borde dorado o algo extra
        if (isHired) {
            div.style.borderColor = 'gold';
            div.style.boxShadow = '0 0 10px gold';
        }

        // Icono: Si está bloqueado, mostramos candado o interrogación
        div.innerHTML = isUnlocked ? helper.icon : '🔒';
        
        // Tooltip
        let tooltipText = "???";
        if (isUnlocked) tooltipText = helper.name + (isHired ? " (CONTRATADO)" : "");
        else tooltipText = `Desbloquea al Nivel ${helper.reqLevel}`;
        
        div.setAttribute('data-title', tooltipText);
        
        helpersGrid.appendChild(div);
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
const heavenlyConfig = [
    // RAÍZ (Arriba centro)
    { id: 'genesis', name: 'Génesis', icon: '👶', cost: 1, x: 350, y: 30, desc: 'Comienza con 100 galletas tras ascender.', parents: [] },
    
    // RAMA IZQUIERDA (Producción Pasiva)
    { id: 'starter_kit', name: 'Kit Inicial', icon: '📦', cost: 2, x: 200, y: 120, desc: 'Empiezas con 10 Nanobots gratis.', parents: ['genesis'] },
    { id: 'perm_prod', name: 'Aura Eterna', icon: '⏳', cost: 10, x: 120, y: 220, desc: '+10% Producción Pasiva PERMANENTE.', parents: ['starter_kit'] },
    { id: 'offline_god', name: 'Cronos', icon: '💤', cost: 50, x: 200, y: 320, desc: 'Gana el 100% de producción offline (antes 50%).', parents: ['perm_prod'] },

    // RAMA DERECHA (Activa / Clicks)
    { id: 'lucky_strike', name: 'Suerte Cósmica', icon: '🍀', cost: 3, x: 500, y: 120, desc: 'Las anomalías doradas aparecen un 10% más.', parents: ['genesis'] },
    { id: 'click_god', name: 'Dedo Divino', icon: '👆', cost: 15, x: 580, y: 220, desc: '+1% de tu CPS se añade a tu click base.', parents: ['lucky_strike'] },
    { id: 'wrath_control', name: 'Diplomacia', icon: '🤝', cost: 100, x: 500, y: 320, desc: 'Las anomalías rojas tienen 50% menos chance de efecto negativo.', parents: ['click_god'] },

    // RAMA CENTRAL (Poder Puro - Abajo del todo)
    { id: 'synergy_master', name: 'Maestro de Sinergia', icon: '🔗', cost: 500, x: 350, y: 450, desc: 'Todas las mejoras de sinergia son un 50% más efectivas.', parents: ['offline_god', 'wrath_control'] }
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
    // Usamos prompt nativo aquí porque necesitamos input de texto (más complejo de hacer custom)
    const userCode = prompt("Pega aquí tu código de guardado:");
    if (!userCode) return;

    try {
        const decodedSave = atob(userCode);
        const loadedGame = JSON.parse(decodedSave);
        
        if (typeof loadedGame.cookies !== 'undefined') {
            game = loadedGame;
            game.prestigeMult = 1 + (game.antimatter * 0.1);
            saveGame();
            location.reload(); 
        } else {
            throw new Error("Formato inválido");
        }
    } catch (e) {
        showSystemModal("ERROR DE NÚCLEO", "El código introducido no es válido o está corrupto.", false, null);
        console.error(e);
    }
};

