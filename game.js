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
    helpers: [] // IDs de ayudantes activos
};

// Variables temporales (no se guardan)
let buffMultiplier = 1; // Multiplicador global de producción
let clickBuffMultiplier = 1; // Multiplicador de clicks

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
    
    const rotSpeed = 0.005 + Math.min(0.1, cps * 0.00001);
    mainObject.rotation.y += rotSpeed;
    mainObject.rotation.x += rotSpeed * 0.5;
    glowMesh.rotation.y -= rotSpeed;
    
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
    const time = Date.now() * 0.002;
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
    const types = ['money', 'money', 'production', 'click']; 
    const type = types[Math.floor(Math.random() * types.length)];
    
    const orb = document.createElement('div');
    let icon = '⚛️';
    let color = 'gold';
    
    if (type === 'production') { icon = '🔥'; color = '#ff5252'; } 
    if (type === 'click') { icon = '⚡'; color = '#00e5ff'; }

    orb.innerHTML = icon;
    orb.style.cssText = `
        position: absolute; font-size: 4rem; cursor: pointer; z-index: 999;
        filter: drop-shadow(0 0 15px ${color}); animation: floatAnomaly 3s infinite ease-in-out;
        left: ${Math.random() * 80 + 10}%; top: ${Math.random() * 80 + 10}%;
    `;

    orb.onclick = () => {
        sfxAnomaly();
        if (type === 'money') {
            const bonus = Math.max(game.cookies * 0.15, getCPS() * 900); 
            game.cookies += bonus;
            game.totalCookiesEarned += bonus;
            createFloatingText(parseInt(orb.style.left), parseInt(orb.style.top), `+${formatNumber(bonus)}`);
        } else if (type === 'production') {
            activateBuff('production', 7, 30);
        } else if (type === 'click') {
            activateBuff('click', 777, 10);
        }
        orb.remove();
    };

    document.getElementById('game-area').appendChild(orb);
    
    // MEJORA: Lente Cuántica (+2s de duración en pantalla)
    let lifeTime = 6000;
    if (game.upgrades.includes('quantum-lens')) lifeTime += 2000;
    setTimeout(() => { if(orb.parentNode) orb.remove(); }, lifeTime); 

    // MEJORA: Antena de Entropía (Aparición más frecuente)
    const anomalyHelper = helpersConfig.find(h => h.effect === 'anomalyRate');
    let baseTime = 30000 + Math.random() * 60000; 
    if (anomalyHelper && game.helpers.includes(anomalyHelper.id)) baseTime /= anomalyHelper.value;
    
    // Bonus de mejora de utilidad
    if (game.upgrades.includes('entropy-antenna')) baseTime *= 0.8; 
    
    setTimeout(spawnAnomaly, baseTime);
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
    
    return Math.floor(power * comboMultiplier * clickBuffMultiplier);
}


function getCPS() {
    let cps = 0;
    buildingsConfig.forEach(u => {
        if (u.type === 'auto') {
            let bPower = (game.buildings[u.id] || 0) * u.currentPower;
            
            // MEJORA ESPECIAL: Red Neuronal (Servidores potencian Minas un 1% cada uno)
            if (u.id === 'mine' && game.upgrades.includes('grandma-mine-synergy')) {
                const grandmaCount = game.buildings['grandma'] || 0;
                bPower *= (1 + (grandmaCount * 0.01));
            }
            
            cps += bPower;
        }
    });

    let total = cps * game.prestigeMult;
    
    // Multiplicador de ayudante de producción
    const prodHelper = helpersConfig.find(h => h.effect === 'cpsMultiplier');
    if (prodHelper && game.helpers.includes(prodHelper.id)) {
        total *= prodHelper.value;
    }
    
    if (isOvercharged) total *= 5;

    // Frenesí de Anomalía (buffMultiplier)
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

    // 1. CABECERA CON HUECOS
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
    
    // 2. CÁLCULOS
    const currentCPS = getCPS();
    const currentHelperCost = getHelpersCost();
    // TU FÓRMULA MATEMÁTICA: Nivel = Raíz Cúbica de Total Ganado
    const playerLevel = Math.floor(Math.cbrt(game.totalCookiesEarned)); 
    
    // 3. LISTA DE AYUDANTES
    helpersConfig.forEach(helper => {
        const isActive = game.helpers.includes(helper.id);
        const isLocked = playerLevel < helper.reqLevel;
        
        const div = document.createElement('div');
        let classes = `helper-item ${isActive ? 'active' : ''}`;
        
        // Estilos para bloqueados o sin dinero
        if (isLocked) classes += ' locked';
        else if (!isActive && (game.helpers.length >= MAX_HELPERS || currentCPS - currentHelperCost < helper.cost)) {
            classes += ' disabled';
        }
        
        div.className = classes;

        // CONTENIDO DEL BOTÓN
        let btnContent = '';
        let statusText = '';
        let statusClass = '';

        if (isLocked) {
            // Caso: Bloqueado por Nivel
            statusText = `Nivel ${helper.reqLevel} Req.`;
            statusClass = 'helper-locked-text'; // Necesitaremos este estilo
            btnContent = '🔒';
        } else if (isActive) {
            // Caso: Equipado
            statusText = '✓ EN EQUIPO';
            statusClass = 'helper-active';
            btnContent = '❌';
        } else {
            // Caso: Disponible
            statusText = `Coste: ${helper.cost}/s`;
            statusClass = 'helper-cost';
            btnContent = game.helpers.length >= MAX_HELPERS ? '⛔' : '➕';
        }

        // HTML INTERNO
        div.innerHTML = `
            <div class="helper-icon" style="${isLocked ? 'filter:grayscale(1); opacity:0.5' : ''}">${helper.icon}</div>
            <div class="helper-info">
                <h4 style="${isLocked ? 'color:#666' : ''}">${isLocked ? '???' : helper.name}</h4>
                <p>${isLocked ? 'Sigue acumulando energía para descubrirlo.' : helper.desc}</p>
                <div class="${statusClass}">${statusText}</div>
            </div>
            <button class="helper-toggle ${isActive ? 'active' : ''}" 
                    onclick="toggleHelper('${helper.id}')" 
                    ${isLocked ? 'disabled' : ''}>
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

    // 1. MEJORAS DE EDIFICIOS (MK-1, MK-2...)
    buildingsConfig.forEach(b => {
        const count = game.buildings[b.id] || 0;
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
    });

    // 2. MEJORAS ESPECIALES (UTILIDAD Y SINERGIA)
    const specials = [
        { id: 'entropy-antenna', name: 'Antena de Entropía', icon: '📡', cost: 50000, desc: 'Anomalías aparecen un 20% más rápido.', req: () => game.totalCookiesEarned > 100000 },
        { id: 'quantum-lens', name: 'Lente Cuántica', icon: '🔍', cost: 150000, desc: 'Las anomalías duran +2s en pantalla.', req: () => game.clickCount > 500 },
        { id: 'grandma-mine-synergy', name: 'Red Neuronal', icon: '🧠', cost: 500000, desc: 'Servidores potencian Minas (+1%/cad uno).', req: () => game.buildings['grandma'] >= 50 && game.buildings['mine'] >= 10 },
        { id: 'factory-click-synergy', name: 'Sobrecarga de Pulsos', icon: '🌀', cost: 1000000, desc: 'Cada Sincrotrón da +5 de poder de click base.', req: () => game.buildings['factory'] >= 15 },
        { id: 'overcharge-plus', name: 'Batería de Helio', icon: '🔋', cost: 250000, desc: 'Sobrecarga dura 5 segundos más.', req: () => game.totalCookiesEarned > 750000 }
    ];

    specials.forEach(s => {
        if (s.req() && !game.upgrades.includes(s.id)) {
            anyUp = true;
            const btn = document.createElement('div');
            btn.className = 'upgrade-crate special'; // Puedes añadir color morado en CSS
            btn.innerHTML = s.icon;
            btn.dataset.cost = s.cost;
            btn.setAttribute('data-tooltip', `${s.name}\n${s.desc}\nCoste: ${formatNumber(s.cost)}`);
            btn.onclick = () => window.buyUpgrade(s.id, s.cost);
            upgradesEl.appendChild(btn);
        }
    });

    if(!anyUp) upgradesEl.innerHTML = '<div style="color:#444; font-size:0.8rem; width:100%; text-align:center;">Juega más para desbloquear tecnología...</div>';

    // 3. RENDERIZAR EDIFICIOS (Sin cambios necesarios aquí)
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



window.activateOvercharge = function() {
    if (isOvercharged || overchargeCooldown) return;
    isOvercharged = true;
    overchargeCooldown = true;
    const btn = document.getElementById('btn-overcharge');
    btn.style.filter = "grayscale(1)";
    btn.innerText = "⚡ ACTIVO ⚡";
    document.getElementById('three-canvas').style.filter = "hue-rotate(90deg)";
    sfxPrestige();

    setTimeout(() => {
        isOvercharged = false;
        btn.innerText = "⏳ ENFRIANDO...";
        document.getElementById('three-canvas').style.filter = "none";
        setTimeout(() => {
            overchargeCooldown = false;
            btn.style.filter = "none";
            btn.innerText = "🔥 SOBRECARGA";
        }, 30000);
    }, 10000);
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
    "Científicos descubren que la energía cuántica sabe a vainilla.",
    "El universo se expande, pero tus edificios lo hacen más rápido.",
    "Un gato de Schrödinger ha sido encontrado vivo y muerto a la vez en tu granja.",
    "Los aliens piden que bajes el volumen de tus reactores.",
    "Economía global colapsa; ahora la moneda oficial es el Watt.",
    "Tu madre llama: '¿Cuándo vas a conseguir un trabajo real?'"
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
    el.innerText = headline + "   |   " + headline; // Duplicar para efecto loop visual
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
    
    // 1. Calcular cuánta antimateria DEBERÍAS tener
    const totalPotentialAntimatter = Math.floor(Math.cbrt(game.totalCookiesEarned / PRESTIGE_BASE));
    
    // 2. Restar la que YA tienes
    let amountToGain = totalPotentialAntimatter - game.antimatter;
    if (amountToGain < 0) amountToGain = 0;

    // Si no hay ganancia, avisar con el nuevo modal
    if (amountToGain <= 0) {
        const nextPoint = game.antimatter + 1;
        const energyNeed = Math.pow(nextPoint, 3) * PRESTIGE_BASE;
        const remaining = energyNeed - game.totalCookiesEarned;
        
        showSystemModal(
            "ENERGÍA INSUFICIENTE", 
            `Necesitas acumular ${formatNumber(remaining)} de energía más para generar un nuevo punto de antimateria.`, 
            false, 
            null
        );
        return;
    }

    // 3. Calcular Multiplicadores
    const currentMult = 1 + (game.antimatter * 0.1); 
    const futureMult = 1 + ((game.antimatter + amountToGain) * 0.1);

    // 4. Actualizar textos
    document.getElementById('asc-total-cookies').innerText = formatNumber(game.totalCookiesEarned);
    document.getElementById('asc-current-mult').innerText = `x${currentMult.toFixed(1)}`;
    document.getElementById('asc-gain-antimatter').innerText = `+${formatNumber(amountToGain)}`;
    document.getElementById('asc-new-mult').innerText = `x${futureMult.toFixed(1)}`;

    // Guardar datos en el botón
    modal.dataset.futureMult = futureMult;
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
    
    // 2. APLICAR RECOMPENSAS
    game.antimatter += gain;
    game.prestigeMult = 1 + (game.antimatter * 0.1);

    // 3. REINICIAR CONFIGURACIÓN EDIFICIOS
    buildingsConfig.forEach(u => {
        game.buildings[u.id] = 0;
        u.currentPower = u.basePower; 
    });

    // 4. GUARDAR Y REINICIAR UI
    saveGame();
    renderStore();
    renderHelpers();
    updateUI();
    closeAscension();
    
    showNotification("🌀 UNIVERSO REINICIADO", `Has obtenido +${gain} Antimateria.`);
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

