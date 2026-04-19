const hiddenSwordInputState = Object.assign(Object.create(Input), {
    isAttacking: false,
    isUltMode: false,
    ultimatePhase: 'idle',
    attackMode: 'SWORD',
    ultimateMode: null
});

document.getElementById('btn-form').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (Input.isVoidCollapsed) {
        showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
        return;
    }

    // --- LOGIC MỚI: KIỂM TRA MANA ---
    const cost = CONFIG.MANA.COST_CHANGE_FORM;

    if (Input.mana >= cost) {
        // Đủ Mana: Trừ mana và đổi dạng
        Input.updateMana(-cost);

        Input.guardForm = (Input.guardForm === 1) ? 2 : 1;

        const icon = e.currentTarget.querySelector('.icon-form');
        if (icon) {
            icon.style.transform = `rotate(${Input.guardForm === 1 ? -15 : 165}deg)`;
        }
    } else {
        // Không đủ Mana: Rung UI cảnh báo
        Input.triggerManaShake();
    }
});

document.getElementById('btn-breakthrough').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    // Gọi hàm thực hiện đột phá mà chúng ta đã viết ở bước trước
    Input.executeBreakthrough();
});

const closeTribulationBtn = document.getElementById('close-tribulation');
if (closeTribulationBtn) {
    closeTribulationBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (Input.tribulation?.active) {
            showNotify('Lôi kiếp đang giáng, không thể thoát pháp đàn', '#9ecfff');
            return;
        }
        Input.closeTribulationPopup?.();
    });
}

document.getElementById('btn-ultimate').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    Input.startUltimate();
});

const phongLoiBlinkBtn = document.getElementById('btn-phong-loi-blink');
if (phongLoiBlinkBtn) {
    phongLoiBlinkBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (Input.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return;
        }

        Input.togglePhongLoiBlink();
    });
}

const canLamCastBtn = document.getElementById('btn-can-lam-cast');
if (canLamCastBtn) {
    canLamCastBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (Input.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return;
        }

        Input.castCanLamBangDiem();
    });
}

const moveBtn = document.getElementById('btn-move');
const attackBtn = document.getElementById('btn-attack');

const startMoveJoystick = (e) => {
    if (!moveBtn || !Input.isTouchDevice || e.pointerType === 'mouse') return false;

    e.stopPropagation();
    e.preventDefault();

    if (Input.isVoidCollapsed) return false;

    if (moveBtn.setPointerCapture) {
        moveBtn.setPointerCapture(e.pointerId);
    }

    return Input.startMoveJoystick(e.pointerId, moveBtn, e.clientX, e.clientY);
};

const stopMoveJoystick = (e) => {
    if (!moveBtn || !Input.moveJoystick.active || Input.moveJoystick.pointerId !== e.pointerId) return;

    e.stopPropagation();
    e.preventDefault();

    if (moveBtn.hasPointerCapture && moveBtn.hasPointerCapture(e.pointerId)) {
        moveBtn.releasePointerCapture(e.pointerId);
    }

    Input.stopMoveJoystick(e.pointerId);
};

// Xử lý riêng cho nút bấm để không bị ảnh hưởng bởi logic handleDown của hệ thống
const startAttack = (e) => {
    e.stopPropagation();
    e.preventDefault();

    Input.resetAttackState();

    if (Input.isVoidCollapsed) {
        showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
        return false;
    }

    // 1. Kiểm tra xem còn thanh kiếm nào còn sống (hp > 0) không
    const hasAliveSword = swords.some(s => !s.isDead);
    const canUseUnarmedAttack = typeof Input.isUnarmedAttackMode === 'function'
        ? Input.isUnarmedAttackMode()
        : !hasAliveSword;

    // 2. Nếu đang dùng Khu Trùng Thuật thì chỉ cần còn mana
    if (Input.isInsectSwarmActive() && Input.mana <= 0) {
        Input.triggerManaShake();
        return false;
    }

    // 3. Nếu mana = 0 VÀ không còn kiếm nào sống
    if (!Input.isInsectSwarmActive() && Input.mana <= 0 && !hasAliveSword && !canUseUnarmedAttack) {
        Input.triggerManaShake();
        return false;
    }

    if (canUseUnarmedAttack) {
        Input.triggerUnarmedTapAttack();
        return true;
    }

    if (Input.isSingleSwordTapAttackMode()) {
        if (Input.beginSingleSwordUltimateCharge()) {
            return true;
        }
        Input.triggerSingleSwordTapAttack();
    } else {
        Input.isAttacking = true;
    }
    return true;
};

const stopAttack = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (Input.isSingleSwordUltimateReady()) {
        Input.releaseSingleSwordUltimateShot();
        return;
    }
    Input.resetAttackState();
};

if (moveBtn) {
    moveBtn.addEventListener('pointerdown', (e) => {
        startMoveJoystick(e);
    });

    moveBtn.addEventListener('pointermove', (e) => {
        if (!Input.moveJoystick.active || Input.moveJoystick.pointerId !== e.pointerId) return;

        e.stopPropagation();
        e.preventDefault();
        Input.updateMoveJoystick(e.clientX, e.clientY);
    });

    moveBtn.addEventListener('pointerup', stopMoveJoystick);
    moveBtn.addEventListener('pointercancel', stopMoveJoystick);
    moveBtn.addEventListener('lostpointercapture', (e) => Input.stopMoveJoystick(e.pointerId));
}

// Sử dụng pointerdown/up để nhạy nhất trên cả mobile và desktop
attackBtn.addEventListener('pointerdown', (e) => {
    if (Input.isTouchDevice && e.pointerType !== 'mouse') {
        if (!startAttack(e)) return;
        if (Input.isSingleSwordTapAttackMode() && !Input.isSingleSwordUltimateReady()) return;

        if (attackBtn.setPointerCapture) {
            attackBtn.setPointerCapture(e.pointerId);
        }

        return;
    }

    startAttack(e);
});

attackBtn.addEventListener('pointerup', (e) => {
    if (Input.isSingleSwordTapAttackMode() && !Input.isSingleSwordUltimateReady()) return;
    if (attackBtn.hasPointerCapture && attackBtn.hasPointerCapture(e.pointerId)) {
        attackBtn.releasePointerCapture(e.pointerId);
    }

    stopAttack(e);
});

attackBtn.addEventListener('pointercancel', (e) => {
    if (Input.isSingleSwordTapAttackMode() && !Input.isSingleSwordUltimateReady()) return;
    if (attackBtn.hasPointerCapture && attackBtn.hasPointerCapture(e.pointerId)) {
        attackBtn.releasePointerCapture(e.pointerId);
    }

    stopAttack(e);
});

attackBtn.addEventListener('lostpointercapture', () => {
    if (Input.isSingleSwordUltimateReady()) {
        Input.releaseSingleSwordUltimateShot();
        return;
    }
    Input.resetAttackState();
});

attackBtn.addEventListener('pointerleave', (e) => {
    if (Input.isSingleSwordTapAttackMode() && !Input.isSingleSwordUltimateReady()) return;
    if (Input.isTouchDevice && e.pointerType !== 'mouse') return;
    stopAttack(e);
}); // Khi kéo ngón tay ra khỏi nút

/**
 * ====================================================================
 * MAIN MANAGER
 * ====================================================================
 */
const enemies = [];
let pills = [];
const swords = [];
let starField;
window.starField = null;
const guardCenter = { x: width / 2, y: height / 2, vx: 0, vy: 0 };
let gameInitialized = false;
let gameStarted = false;

const startOverlay = document.getElementById('start-overlay');
const startTitle = document.getElementById('start-title');
const startSubtitle = document.getElementById('start-subtitle');
const startButton = document.getElementById('btn-start-game');
const difficultySelect = document.getElementById('difficulty-select');
const difficultyOptions = Array.from(document.querySelectorAll('.difficulty-option'));
const DIFFICULTY_PROFILES = {
    EASY: {
        key: 'EASY',
        label: 'Dễ',
        spawnCount: 8,
        enemyHpMultiplier: 0.85,
        enemyDamageMultiplier: 0.75,
        eliteChanceMultiplier: 0.8
    },
    NORMAL: {
        key: 'NORMAL',
        label: 'Trung bình',
        spawnCount: 10,
        enemyHpMultiplier: 1,
        enemyDamageMultiplier: 1,
        eliteChanceMultiplier: 1
    },
    HARD: {
        key: 'HARD',
        label: 'Khó',
        spawnCount: 14,
        enemyHpMultiplier: 1.22,
        enemyDamageMultiplier: 1.28,
        eliteChanceMultiplier: 1.35
    }
};
let selectedDifficultyKey = 'NORMAL';
const baseEnemyEliteChance = Number(CONFIG.ENEMY.ELITE_CHANCE) || 0;

function showStartOverlay(title, subtitle) {
    if (startTitle && title) startTitle.textContent = title;
    if (startSubtitle && subtitle) startSubtitle.textContent = subtitle;
    document.body.classList.remove('game-native-cursor-hidden');
    startOverlay?.classList.add('is-visible');
}

function hideStartOverlay() {
    startOverlay?.classList.remove('is-visible');
    document.body.classList.add('game-native-cursor-hidden');
}

function getSelectedDifficultyProfile() {
    return DIFFICULTY_PROFILES[selectedDifficultyKey] || DIFFICULTY_PROFILES.NORMAL;
}

function applyDifficultyProfile() {
    const profile = getSelectedDifficultyProfile();
    CONFIG.ENEMY.SPAWN_COUNT = profile.spawnCount;
    CONFIG.ENEMY.ELITE_CHANCE = Math.max(0, Math.min(1, baseEnemyEliteChance * profile.eliteChanceMultiplier));
    CONFIG.ENEMY.RUNTIME_MULTIPLIERS = {
        hp: profile.enemyHpMultiplier,
        damage: profile.enemyDamageMultiplier
    };
    if (Input) {
        Input.selectedDifficulty = profile.key;
    }
}

function syncEnemyCount() {
    const desiredCount = Math.max(1, parseInt(CONFIG.ENEMY.SPAWN_COUNT, 10) || 1);
    while (enemies.length < desiredCount) enemies.push(new Enemy());
    if (enemies.length > desiredCount) enemies.length = desiredCount;
}

function renderDifficultySelection() {
    difficultyOptions.forEach(option => {
        const isSelected = option.dataset.difficulty === selectedDifficultyKey;
        option.classList.toggle('is-selected', isSelected);
        option.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

function getConfiguredSwordCount() {
    return Math.max(1, parseInt(CONFIG.SWORD.COUNT, 10) || 1);
}

function getBaseSwordCountBeforeFormation() {
    const configuredBase = Math.max(0, parseInt(CONFIG.SWORD.STARTING_COUNT_BEFORE_FORMATION, 10) || 0);
    const controlledCount = typeof Input?.getSwordControlLimit === 'function'
        ? Input.getSwordControlLimit()
        : configuredBase;
    return Math.max(configuredBase, controlledCount);
}

function getDesiredSwordCount() {
    return Input.attackMode === 'SWORD' && Input.canDeployDaiCanhKiemTran()
        ? getConfiguredSwordCount()
        : getBaseSwordCountBeforeFormation();
}

function syncSwordFormation(options = {}) {
    const { rebuildAll = false } = options;
    const targetStates = typeof Input?.getActiveSwordArtifactStates === 'function'
        ? Input.getActiveSwordArtifactStates({ mode: Input.attackMode === 'SWORD' ? 'SWORD' : 'BASE' })
        : [];
    const targetCount = Input.attackMode === 'SWORD' && Input.canDeployDaiCanhKiemTran()
        ? Math.min(getConfiguredSwordCount(), targetStates.length)
        : targetStates.length;

    if (rebuildAll) {
        swords.length = 0;
    }

    if (swords.length > targetCount) {
        swords.length = targetCount;
    }

    for (let i = 0; i < targetCount; i++) {
        if (!swords[i]) {
            const sword = new Sword(i, scaleFactor, targetStates[i] || null);
            sword.x = guardCenter.x;
            sword.y = guardCenter.y;
            swords[i] = sword;
        } else if (typeof swords[i].bindArtifactState === 'function') {
            swords[i].bindArtifactState(targetStates[i] || null);
        }
    }

    updateSwordCounter(swords);
    if (typeof Input?.renderAttackModeUI === 'function') {
        Input.renderAttackModeUI();
    }

    return swords.length;
}

function init() {
    // Khởi tạo thông số theo rank đầu tiên
    document.body.classList.add('game-native-cursor-hidden');
    document.body.classList.toggle('is-touch-device', Input.isTouchDevice);
    Input.syncLandscapeMode();
    syncPopupCursorState();
    repairLegacyUiText();

    SettingsUI.init();
    GameProgress.init();
    Input.renderManaUI();
    Input.renderHealthUI();
    Input.renderNegativeStatusUI();
    Input.renderExpUI();
    Input.renderRageUI();
    if (ShopUI) ShopUI.init();
    if (InventoryUI) InventoryUI.init();
    if (AlchemyUI) AlchemyUI.init();
    if (BeastBagUI) BeastBagUI.init();
    if (SkillsUI) SkillsUI.init();
    if (InsectBookUI) InsectBookUI.init();
    if (ProfileUI) ProfileUI.init();
    Input.renderAttackModeUI();
    starField = new StarField(CONFIG.BG.STAR_COUNT, width, height);
    window.starField = starField;
    applyDifficultyProfile();
    syncEnemyCount();
    syncSwordFormation({ rebuildAll: true });
    updateSwordCounter(swords);
    GameProgress.requestSave();
    gameInitialized = true;
}

function resetRunState() {
    applyDifficultyProfile();
    syncEnemyCount();
    Input.isGameOver = false;
    Input.isVoidCollapsed = false;
    if (Input.tribulation) {
        Input.tribulation.active = false;
        Input.closeTribulationPopup?.();
    }
    Input.temporaryAscensionOrigin = null;
    if (Input.voidCollapseTimeoutId) {
        clearTimeout(Input.voidCollapseTimeoutId);
        Input.voidCollapseTimeoutId = null;
    }
    Input.setSpecialAura?.(null);
    Input.syncDerivedStats();
    Input.hp = Input.maxHp;
    Input.renderHealthUI();
    Input.clearNegativeStatuses();
    Input.renderNegativeStatusUI();
    const hostileProjectiles = typeof Input.ensureEnemyHostileProjectiles === 'function'
        ? Input.ensureEnemyHostileProjectiles()
        : null;
    if (hostileProjectiles) hostileProjectiles.length = 0;
    Input.resetAttackState();
    pills = [];
    visualParticles.length = 0;
    enemies.forEach(enemy => enemy.respawn());
    syncSwordFormation({ rebuildAll: true });
}

function startGame() {
    if (!gameInitialized) {
        init();
    } else {
        resetRunState();
    }
    gameStarted = true;
    hideStartOverlay();
}

function clearClientCachesForFreshRun() {
    try {
        GameProgress.clearStored?.();
    } catch (error) {
        console.warn('[game-loop] Không thể xóa tiến trình đã lưu:', error);
    }

    try {
        localStorage.removeItem('thanh_truc_settings');
    } catch (error) {
        console.warn('[game-loop] Không thể xóa thiết lập cục bộ:', error);
    }

    try {
        sessionStorage.clear();
    } catch (error) {
        console.warn('[game-loop] Không thể xóa session storage:', error);
    }

    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
        caches.keys()
            .then(cacheNames => Promise.all(cacheNames.map(cacheName => caches.delete(cacheName))))
            .catch(error => console.warn('[game-loop] Không thể xóa Cache Storage:', error));
    }
}

difficultySelect?.addEventListener('click', (event) => {
    const option = event.target?.closest?.('.difficulty-option');
    if (!option) return;
    const nextKey = option.dataset.difficulty;
    if (!DIFFICULTY_PROFILES[nextKey]) return;
    selectedDifficultyKey = nextKey;
    renderDifficultySelection();
});

window.__onPlayerGameOver = () => {
    clearClientCachesForFreshRun();
    GameProgress.applyFreshStart?.();
    showNotify('Đạo thể tan vỡ, đã thanh tẩy toàn bộ ký ức tu luyện và bắt đầu lại từ đầu.', '#ff9f9f');
    resetRunState();
    gameStarted = true;
};

document.addEventListener('fullscreenchange', () => Input.syncLandscapeMode());
window.addEventListener('orientationchange', () => Input.syncLandscapeMode());

function updateSwordCounter(swords) {
    const aliveSwords = swords.filter(s => !s.isDead).length;
    const totalSwords = swords.length;
    const display = document.getElementById('sword-count-text');

    if (display) {
        display.innerText = `${aliveSwords}/${totalSwords}`;

        // Hiệu ứng đổi màu nếu số lượng kiếm quá thấp (tùy chọn)
        if (aliveSwords < totalSwords * 0.3) {
            display.style.color = "#ff4444";
        } else {
            display.style.color = "#fff";
        }
    }
}

function updatePhysics(dt) {
    Camera.update();
    Input.update(dt);
    Input.regenMana();
    const isBlinkTransiting = Input.isPhongLoiBlinkTransiting();
    const prevGuardX = guardCenter.x;
    const prevGuardY = guardCenter.y;
    const speedMultRaw = Input.getMovementSpeedMultiplier();
    const speedMult = Number.isFinite(speedMultRaw) ? speedMultRaw : 16;

    if (isBlinkTransiting) {
        guardCenter.vx = 0;
        guardCenter.vy = 0;
    } else {
        let dx = Input.x - guardCenter.x;
        let dy = Input.y - guardCenter.y;
        guardCenter.vx += dx * 0.04 * speedMult;
        guardCenter.vy += dy * 0.04 * speedMult;
        guardCenter.vx *= 0.82;
        guardCenter.vy *= 0.82;
        guardCenter.x += guardCenter.vx;
        guardCenter.y += guardCenter.vy;
    }

    Input.updatePhongLoiBlinkMotion(
        guardCenter,
        guardCenter.x - prevGuardX,
        guardCenter.y - prevGuardY
    );
    Input.updateHuyetSacPhiPhongTrail(
        guardCenter,
        guardCenter.x - prevGuardX,
        guardCenter.y - prevGuardY
    );
}

function renderCursor() {
    // Không dùng shadow của canvas cũ để tránh bị đè màu
    ctx.shadowBlur = 0; 
    
    // Gọi trực tiếp Băng Diễm từ Input
    Input.drawCursor(ctx, scaleFactor);
}

function animate() {
    if (!gameStarted) {
        requestAnimationFrame(animate);
        return;
    }

    // 1. Tính Delta Time (dt) tính bằng giây
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    frameNow = now;
    Input.lastFrameDeltaMs = dt * 1000;
    Input.lastFrameTime = now;

    frameCount++;

    ctx.clearRect(0, 0, width, height);

    // 2. Truyền dt vào updatePhysics
    updatePhysics(dt);

    if (frameCount % 10 === 0) {
        updateSwordCounter(swords);
    }

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(Camera.currentZoom, Camera.currentZoom);
    ctx.translate(-Camera.centerX, -Camera.centerY);

    starField.draw(ctx, scaleFactor);

    ctx.save();
    ctx.translate(guardCenter.x, guardCenter.y);
    ctx.rotate(now * 0.0002);
    ctx.strokeStyle = "rgba(120,255,210,0.1)";
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.beginPath();
    ctx.arc(0, 0, 50 * scaleFactor, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    enemies.forEach(e => e.draw(ctx, scaleFactor));
    Input.updateIncomingEnemyAttacks(enemies, Input.x, Input.y, dt);
    let nextPillIndex = 0;
    for (let i = 0; i < pills.length; i++) {
        const pill = pills[i];
        const collected = pill.update(guardCenter.x, guardCenter.y);

        if (collected) {
            Input.collectDrop(collected);
            continue;
            // Cộng vào đúng loại đan trong Input
            Input.pills[pill.typeKey]++;

            const typeName = CONFIG.PILL.TYPES[pill.typeKey].name;
            showNotify(`+1 ${typeName}`, pill.color);

            Input.renderExpUI(); // Cập nhật lại giao diện ngay khi nhặt được
            return false;
        }

        pill.draw(ctx);
        pills[nextPillIndex++] = pill;
    }
    pills.length = nextPillIndex;

    const renderSwarm = Input.isInsectSwarmActive();
    const renderInsectUltimate = Input.isInsectUltimateActive();
    Input.updateInsectSwarm(dt, enemies, scaleFactor);
    Input.updateInsectUltimate(dt, enemies, scaleFactor);

    const hideSwords = renderSwarm || renderInsectUltimate;
    let swordInput = Input;
    if (hideSwords) {
        hiddenSwordInputState.x = Input.x;
        hiddenSwordInputState.y = Input.y;
        hiddenSwordInputState.speed = Input.speed;
        hiddenSwordInputState.mana = Input.mana;
        hiddenSwordInputState.maxMana = Input.maxMana;
        swordInput = hiddenSwordInputState;
    }

    for (let i = 0; i < swords.length; i++) {
        swords[i].update(guardCenter, enemies, swordInput, scaleFactor, now);
    }

    if (!hideSwords) {
        swordRenderBuffer.length = swords.length;
        for (let i = 0; i < swords.length; i++) {
            swordRenderBuffer[i] = swords[i];
        }

        if (swordRenderBuffer.length > 1) {
            swordRenderBuffer.sort((leftSword, rightSword) => (leftSword.renderDepth || 0) - (rightSword.renderDepth || 0));
        }

        for (let i = 0; i < swordRenderBuffer.length; i++) {
            swordRenderBuffer[i].draw(ctx, scaleFactor, now);
        }
    }

    if (renderSwarm) {
        Input.drawInsectSwarm(ctx, scaleFactor);
    }

    if (renderInsectUltimate) {
        Input.drawInsectUltimate(ctx, scaleFactor);
    }

    Input.drawPhongLoiBlinkEffects(ctx, scaleFactor);
    Input.drawHuyetSacPhiPhongTrail(ctx, scaleFactor);
    Input.drawCanLamProjectiles(ctx, scaleFactor);
    Input.drawEnemyMeleeStrikes(ctx, scaleFactor);
    Input.drawSingleSwordUltimateProjectiles(ctx, scaleFactor);
    Input.drawSingleSwordUltimateChargeIndicator(ctx, scaleFactor);
    renderCursor();

    const zoom = Math.max(0.001, Camera.currentZoom || 1);
    const visibleHalfWidth = window.innerWidth / (2 * zoom);
    const visibleHalfHeight = window.innerHeight / (2 * zoom);
    const visibleLeft = Camera.centerX - visibleHalfWidth;
    const visibleRight = Camera.centerX + visibleHalfWidth;
    const visibleTop = Camera.centerY - visibleHalfHeight;
    const visibleBottom = Camera.centerY + visibleHalfHeight;

    // Vẽ và cập nhật hạt hiệu ứng
    let nextParticleIndex = 0;
    for (let i = 0; i < visualParticles.length; i++) {
        const p = visualParticles[i];
        if (!p) {
            continue;
        }
        const friction = p.friction ?? 1;
        const nextVx = (p.vx || 0) * friction;
        const nextVy = ((p.vy || 0) + (p.gravity || 0)) * friction;
        p.vx = nextVx;
        p.vy = nextVy;
        p.x += nextVx;
        p.y += nextVy;

        if (typeof p.radialVelocity === 'number') {
            p.radius = (p.radius || 0) + p.radialVelocity;
        }

        if (typeof p.sizeVelocity === 'number') {
            p.size = Math.max(0, (p.size || 0) + p.sizeVelocity);
        }

        if (typeof p.lengthVelocity === 'number') {
            p.length = Math.max(0, (p.length || 0) + p.lengthVelocity);
        }

        if (typeof p.rotationSpeed === 'number') {
            p.rotation = (p.rotation || 0) + p.rotationSpeed;
        }

        p.life -= p.decay ?? 0.02;
        if (p.life <= 0) {
            continue;
        }

        const particleRadius = Math.max(8, (p.size || 0) + (p.radius || 0) + (p.length || 0));
        if (
            p.x + particleRadius < visibleLeft ||
            p.x - particleRadius > visibleRight ||
            p.y + particleRadius < visibleTop ||
            p.y - particleRadius > visibleBottom
        ) {
            visualParticles[nextParticleIndex++] = p;
            continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life) * (p.opacity ?? 1);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.shadowBlur = p.glow || 0;
        ctx.shadowColor = p.color;

        if (p.type === 'square') {
            const size = p.size || 0;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation || 0);
            ctx.fillRect(-size / 2, -size / 2, size, size);
        } else if (p.type === 'ring') {
            ctx.lineWidth = Math.max(0.6, (p.lineWidth || 2) * Math.max(0.35, p.life));
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0, p.radius || 0), 0, Math.PI * 2);
            ctx.stroke();
        } else if (p.type === 'ray') {
            const angle = p.angle || 0;
            const startRadius = p.radius || 0;
            const endRadius = startRadius + (p.length || 0);
            ctx.lineWidth = Math.max(0.8, (p.lineWidth || 2) * Math.max(0.35, p.life));
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(
                p.x + (Math.cos(angle) * startRadius),
                p.y + (Math.sin(angle) * startRadius)
            );
            ctx.lineTo(
                p.x + (Math.cos(angle) * endRadius),
                p.y + (Math.sin(angle) * endRadius)
            );
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0, p.size || 0), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        visualParticles[nextParticleIndex++] = p;
    }
    visualParticles.length = nextParticleIndex;
    ctx.globalAlpha = 1;

    ctx.restore();

    requestAnimationFrame(animate);
}

let hasBootedGame = false;
async function bootGame() {
    if (hasBootedGame) return;
    hasBootedGame = true;

    await preloadEnemyIcons();

    if (startButton) {
        startButton.addEventListener('click', () => startGame());
    }
    renderDifficultySelection();

    const hasSavedProgress = Boolean(localStorage.getItem(GameProgress.storageKey));
    if (hasSavedProgress) {
        startGame();
    } else {
        showStartOverlay('Đại Canh Kiếm Trận', 'Đạo tâm sơ ngộ, hãy điểm Bắt đầu để nhập giới tu hành.');
    }
    animate();
}
// <!-- Create By: Vũ Hoài Nam -->
