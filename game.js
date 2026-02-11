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

// ==========================================
// 2.5. SISTEMA DE AYUDANTES
// ==========================================
const helpersConfig = [
    { 
        id: 'helper-click', 
        name: '👽 Graxion el Potenciador', 
        desc: 'Triplica el poder de tus clicks', 
        cost: 5, 
        icon: '👽',
        unlockAt: 10, // CPS mínimo para desbloquear
        effect: 'clickPower',
        value: 3
    },
    { 
        id: 'helper-prod', 
        name: '🛸 Zyx Multiplicador', 
        desc: 'Aumenta producción x1.5', 
        cost: 20, 
        icon: '🛸',
        unlockAt: 50,
        effect: 'cpsMultiplier',
        value: 1.5
    },
    { 
        id: 'helper-combo', 
        name: '⭐ Nebula Mantenedora', 
        desc: 'El combo dura el doble de tiempo', 
        cost: 15, 
        icon: '⭐',
        unlockAt: 100,
        effect: 'comboTime',
        value: 2
    },
    { 
        id: 'helper-overcharge', 
        name: '🌠 Quantum Acelerador', 
        desc: 'Sobrecarga se enfría 50% más rápido', 
        cost: 50, 
        icon: '🌠',
        unlockAt: 500,
        effect: 'overchargeCooldown',
        value: 0.5
    },
    { 
        id: 'helper-anomaly', 
        name: '🔮 Vidente Cósmico', 
        desc: 'Anomalías aparecen 2x más seguido', 
        cost: 30, 
        icon: '🔮',
        unlockAt: 200,
        effect: 'anomalyRate',
        value: 2
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

function spawnAnomaly() {
    const orb = document.createElement('div');
    orb.innerHTML = '⚛️';
    orb.style.cssText = `
        position: absolute; font-size: 4rem; cursor: pointer; z-index: 999;
        filter: drop-shadow(0 0 15px gold); animation: floatAnomaly 3s infinite ease-in-out;
        left: ${Math.random() * 80 + 10}%; top: ${Math.random() * 80 + 10}%;
    `;
    orb.onclick = () => {
        sfxAnomaly();
        const bonus = Math.max(game.cookies * 0.25, getCPS() * 120); 
        game.cookies += bonus;
        game.totalCookiesEarned += bonus;
        createFloatingText(parseInt(orb.style.left), parseInt(orb.style.top), `¡ANOMALÍA! +${formatNumber(bonus)}`);
        orb.remove();
    };
    document.getElementById('game-area').appendChild(orb);
    setTimeout(() => orb.remove(), 8000); 
    
    // Tasa de anomalías modificada por ayudante
    const anomalyHelper = helpersConfig.find(h => h.effect === 'anomalyRate');
    const baseTime = 30000 + Math.random() * 60000;
    const nextTime = (anomalyHelper && game.helpers.includes(anomalyHelper.id)) 
        ? baseTime / anomalyHelper.value 
        : baseTime;
    
    setTimeout(spawnAnomaly, nextTime);
}
setTimeout(spawnAnomaly, 60000); 

function getClickPower() {
    const cursorData = buildingsConfig.find(u => u.type === 'click');
    const count = game.buildings[cursorData.id] || 0;
    let power = (1 + (count * cursorData.currentPower)) * game.prestigeMult;
    
    // Aplicar efecto de ayudante de clicks
    const clickHelper = helpersConfig.find(h => h.effect === 'clickPower');
    if (clickHelper && game.helpers.includes(clickHelper.id)) {
        power *= clickHelper.value;
    }
    
    return Math.floor(power * comboMultiplier); 
}

function getCPS() {
    let cps = 0;
    buildingsConfig.forEach(u => {
        if (u.type === 'auto') cps += (game.buildings[u.id] || 0) * u.currentPower;
    });
    let total = cps * game.prestigeMult;
    
    // Aplicar multiplicador de ayudante de producción
    const prodHelper = helpersConfig.find(h => h.effect === 'cpsMultiplier');
    if (prodHelper && game.helpers.includes(prodHelper.id)) {
        total *= prodHelper.value;
    }
    
    if (isOvercharged) total *= 5;
    return total;
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
    
    const isActive = game.helpers.includes(helperId);
    
    if (isActive) {
        // Desactivar ayudante
        game.helpers = game.helpers.filter(id => id !== helperId);
        showNotification("❌ Ayudante Despedido", `${helper.name} ha dejado el equipo`);
    } else {
        // Verificar si puede permitirse el costo
        const currentCPS = getCPS();
        const currentHelperCost = getHelpersCost();
        
        if (currentCPS - currentHelperCost < helper.cost) {
            alert(`No tienes suficiente CPS para contratar a ${helper.name}.\nNecesitas al menos ${helper.cost}/seg disponible.`);
            return;
        }
        
        // Activar ayudante
        game.helpers.push(helperId);
        sfxPrestige();
        showNotification("✅ Ayudante Contratado", `${helper.name} se ha unido al equipo`);
    }
    
    renderHelpers();
    updateUI();
};

function renderHelpers() {
    const container = document.getElementById('helpers-list');
    if (!container) return;
    
    container.innerHTML = '';
    const currentCPS = getCPS();
    const currentHelperCost = getHelpersCost();
    
    helpersConfig.forEach(helper => {
        const isActive = game.helpers.includes(helper.id);
        const isUnlocked = currentCPS >= helper.unlockAt;
        const canAfford = (currentCPS - currentHelperCost) >= helper.cost;
        
        if (!isUnlocked) return; // No mostrar ayudantes bloqueados
        
        const div = document.createElement('div');
        div.className = `helper-item ${isActive ? 'active' : ''} ${!canAfford && !isActive ? 'disabled' : ''}`;
        
        const statusText = isActive ? '✓ ACTIVO' : `${helper.cost}/seg`;
        const statusClass = isActive ? 'helper-active' : 'helper-cost';
        
        div.innerHTML = `
            <div class="helper-icon">${helper.icon}</div>
            <div class="helper-info">
                <h4>${helper.name}</h4>
                <p>${helper.desc}</p>
                <div class="${statusClass}">${statusText}</div>
            </div>
            <button class="helper-toggle ${isActive ? 'active' : ''}" onclick="toggleHelper('${helper.id}')">
                ${isActive ? '❌' : '✓'}
            </button>
        `;
        
        container.appendChild(div);
    });
    
    if (container.children.length === 0) {
        container.innerHTML = '<div style="color:#666; padding:20px; text-align:center;">Genera más energía/seg para desbloquear ayudantes...</div>';
    }
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
    buildingsConfig.forEach(b => {
        const count = game.buildings[b.id];
        milestones.forEach((th, i) => {
            const uid = `${b.id}-${th}`;
            if (count >= th && !game.upgrades.includes(uid)) {
                anyUp = true;
                const cost = b.baseCost * 10 * th;
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
    if(!anyUp) upgradesEl.innerHTML = '<div style="color:#444; font-size:0.8rem; width:100%; text-align:center;">Juega más para desbloquear tecnología...</div>';

    buildingsEl.innerHTML = '';
    buildingsConfig.forEach(b => {
        const count = game.buildings[b.id];
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
    if(confirm("¿BORRAR TODO EL PROGRESO?")) {
        localStorage.removeItem('quantumClickerUlt');
        location.reload();
    }
}


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

// --- LÓGICA DE ASCENSIÓN MEJORADA ---

// 1. Mostrar la ventana y calcular datos


// ==========================================
// SISTEMA DE ASCENSIÓN (CORREGIDO)
// ==========================================

window.doPrestige = function() {
    const modal = document.getElementById('modal-ascension');
    const PRESTIGE_BASE = 1000000;
    
    // 1. Calcular cuánta antimateria DEBERÍAS tener en total por tu historia
    const totalPotentialAntimatter = Math.floor(Math.cbrt(game.totalCookiesEarned / PRESTIGE_BASE));
    
    // 2. Restar la que YA tienes para saber la GANANCIA REAL
    let amountToGain = totalPotentialAntimatter - game.antimatter;
    if (amountToGain < 0) amountToGain = 0;

    // Si no hay ganancia, avisar y salir
    if (amountToGain <= 0) {
        // Cálculo de cuánto falta (Opcional, pero útil)
        const nextPoint = game.antimatter + 1;
        const energyNeed = Math.pow(nextPoint, 3) * PRESTIGE_BASE;
        const remaining = energyNeed - game.totalCookiesEarned;
        
        alert(`Aún no has generado suficiente entropía.\nNecesitas acumular: ${formatNumber(remaining)} energía más.`);
        return;
    }

    // 3. Calcular Multiplicadores (Actual vs Futuro)
    // Aquí usamos la lógica simple: 1 Antimateria = +1 al multiplicador (x2, x3...)
    // Si prefieres +10%, cambia a: 1 + (game.antimatter * 0.1)
    const currentMult = 1 + game.antimatter; 
    const futureMult = 1 + (game.antimatter + amountToGain);

    // 4. Actualizar textos del modal (¡Ahora las variables SÍ existen!)
    document.getElementById('asc-total-cookies').innerText = formatNumber(game.totalCookiesEarned);
    document.getElementById('asc-current-mult').innerText = `x${currentMult.toFixed(1)}`;
    document.getElementById('asc-gain-antimatter').innerText = `+${formatNumber(amountToGain)}`;
    document.getElementById('asc-new-mult').innerText = `x${futureMult.toFixed(1)}`;

    // Guardar datos en el botón para confirmar después
    modal.dataset.futureMult = futureMult;
    modal.dataset.gain = amountToGain; // Guardamos la ganancia exacta

    modal.style.display = 'flex';
}


////ASCENSION CODE




window.closeAscension = function() {
    document.getElementById('modal-ascension').style.display = 'none';
}

window.confirmAscension = function() {
    const modal = document.getElementById('modal-ascension');
    const gain = parseInt(modal.dataset.gain);
    const newMult = parseFloat(modal.dataset.futureMult);

    if (!gain || gain <= 0) return;

    sfxPrestige();

    // 1. HARD RESET
    game.cookies = 0;
    game.buildings = {};
    game.upgrades = [];
    game.helpers = []; // ¡Importante! Tu amigo añadió esto, hay que mantenerlo
    
    // 2. APLICAR RECOMPENSAS
    game.antimatter += gain;     // Sumamos la ganancia
    game.prestigeMult = newMult; // Aplicamos el nuevo multi

    // 3. REINICIAR CONFIGURACIÓN
    buildingsConfig.forEach(u => {
        game.buildings[u.id] = 0;
        u.currentPower = u.basePower; 
    });

    // 4. GUARDAR Y REINICIAR UI
    saveGame();
    renderStore();
    renderHelpers(); // ¡Importante! Actualizar la lista de ayudantes vacía
    updateUI();
    closeAscension();
    
    // Notificación
    showNotification("🌀 UNIVERSO REINICIADO", `Has obtenido +${gain} Antimateria.`);
}









window.closeAscension = function() {
    document.getElementById('modal-ascension').style.display = 'none';
}

// 2. Ejecutar el reset







// --- BOOT ---
loadGame();
// Inicializar contadores a 0 si no existen
buildingsConfig.forEach(u => {
    if (!game.buildings[u.id]) game.buildings[u.id] = 0;
    u.currentPower = u.basePower; 
});
recalculateStats();
initThree();
renderStore();
renderHelpers();
gameLoop();
setInterval(saveGame, 60000);


// --- IMPORT EXPORT ---

// --- SISTEMA DE IMPORTAR / EXPORTAR ---

window.exportSave = function() {
    // 1. Guardamos primero para asegurar tener lo último
    saveGame();
    
    // 2. Convertimos el objeto game a texto JSON
    const jsonSave = JSON.stringify(game);
    
    // 3. Convertimos ese texto a Base64 (El "código raro")
    // btoa() es una función nativa de JS: "Binary to ASCII"
    const encodedSave = btoa(jsonSave);
    
    // 4. Lo copiamos al portapapeles automáticamente
    navigator.clipboard.writeText(encodedSave).then(() => {
        alert("✅ ¡CÓDIGO COPIADO AL PORTAPAPELES!\n\nGuárdalo en un archivo de texto seguro.\nSi borras las cookies, podrás recuperarlo usando el botón de Importar (📥).");
    }).catch(err => {
        // Fallback por si falla el copiado automático
        prompt("Copia este código manualmente:", encodedSave);
    });
};

window.importSave = function() {
    // 1. Pedimos el código al usuario
    const userCode = prompt("Pega aquí tu código de guardado (el texto largo):");
    
    if (!userCode) return; // Si cancela, no hacemos nada

    try {
        // 2. Intentamos descifrar el código
        // atob() es lo contrario: "ASCII to Binary"
        const decodedSave = atob(userCode);
        
        // 3. Convertimos el texto descifrado a objeto JS
        const loadedGame = JSON.parse(decodedSave);
        
        // 4. Verificación básica de seguridad (¿Tiene cookies?)
        if (typeof loadedGame.cookies !== 'undefined') {
            game = loadedGame;
            saveGame(); // Guardamos inmediatamente
            location.reload(); // Recargamos para aplicar cambios visuales
        } else {
            throw new Error("Formato inválido");
        }
    } catch (e) {
        alert("❌ ERROR: El código no es válido o está corrupto.");
        console.error(e);
    }
};

