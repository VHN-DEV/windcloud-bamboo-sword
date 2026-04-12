function getSwordFrameNow(now = null) {
    if (Number.isFinite(now)) return now;
    if (typeof getFrameNow === 'function') return getFrameNow();
    return performance.now();
}

class Sword {
    constructor(index, scaleFactor, artifactState = null) {
        this.index = index;
        this.layer = Math.floor(index / 24);
        // this.baseAngle = (Math.PI * 2 / 24) * (index % 24);
        // Tính góc cơ bản của mỗi thanh trong vòng 24 thanh
        let angleStep = (Math.PI * 2) / 24;
        let angleInLayer = angleStep * (index % 24);

        // XẾP XEN KẼ: Nếu là lớp lẻ (1, 3, 5...), cộng thêm một nửa bước góc
        // Điều này giúp thanh kiếm lớp ngoài nằm giữa khe hở của lớp trong
        if (this.layer % 2 !== 0) {
            angleInLayer += angleStep / 2;
        }

        this.baseAngle = angleInLayer;
        this.spinAngle = 0;
        this.spinSpeed = (CONFIG.SWORD.SPIN_SPEED_BASE / (this.layer + 1)) * (this.layer % 2 ? -1 : 1);
        this.radius = (CONFIG.SWORD.BASE_RADIUS + this.layer * CONFIG.SWORD.LAYER_SPACING) * scaleFactor;
        this.x = window.innerWidth / 2;
        this.y = window.innerHeight / 2;
        this.vx = 0; this.vy = 0;
        this.drawAngle = 0;
        this.trail = [];
        this.breath = random(0, Math.PI * 2);
        this.breathSpeed = random(CONFIG.SWORD.BREATH_SPEED.MIN, CONFIG.SWORD.BREATH_SPEED.MAX);
        this.attackDelay = this.layer * CONFIG.SWORD.ATTACK_DELAY_VAR.BASE + random(0, CONFIG.SWORD.ATTACK_DELAY_VAR.RAND);
        this.attackFrame = 0;
        this.flowNoise = Math.random() * Math.PI * 2;
        this.flowOffsetAngle = (Math.PI * 2 / Math.max(1, CONFIG.SWORD.COUNT || 72)) * index;
        this.flowOffsetRadius = (CONFIG.SWORD.FLOW_OFFSET.MIN + Math.random() * (CONFIG.SWORD.FLOW_OFFSET.MAX - CONFIG.SWORD.FLOW_OFFSET.MIN)) * scaleFactor;
        this.isStunned = false;
        this.stunTimer = 0;
        const rankData = CONFIG.CULTIVATION.RANKS[Input.rankIndex] || CONFIG.CULTIVATION.RANKS[0];
        this.artifactState = null;
        this.artifactInstanceKey = null;
        this.maxHp = rankData.swordDurability;
        this.hp = this.maxHp;
        this.isDead = false;
        this.respawnTimer = 0;
        this.fragments = [];
        this.deathTime = 0;
        this.lastUltimateHitAt = 0;
        this.lastCloseSlashCycle = -1;
        this.committedCloseSlashCycle = -1;
        this.powerPenalty = 1; // hệ số sát thương theo độ bền
        this.isEnlarged = false;      // Đang trong trạng thái cường hóa phóng to
        this.currentVisualScale = 1;  // Tỉ lệ hiển thị thực tế (để animation mượt)
        this.targetVisualScale = 1;   // Tỉ lệ đích muốn hướng tới
        this.renderDepth = 0;
        this.renderOpacity = 1;
        this.pierceCount = 0;      // Đếm số lần đâm xuyên mục tiêu
        this.maxPierce = 3;        // Tối đa 3 lần đâm xuyên
        this.dragonPhase = index * 0.15; // Độ lệch pha để tạo hiệu ứng uốn lượn dải lụa
        this.isReturning = false;  // Trạng thái đang quay về sau khi đâm đủ 3 lần
        this.bindArtifactState(artifactState);
    }

    bindArtifactState(artifactState) {
        this.artifactState = artifactState || null;
        this.artifactInstanceKey = artifactState?.instanceKey || null;

        const durability = this.getArtifactDurabilityValue();
        if (durability > 0) {
            this.maxHp = durability;
            this.hp = Math.min(Math.max(1, this.hp || durability), durability);
        }
    }

    getArtifactState() {
        if (this.artifactState) return this.artifactState;
        if (this.artifactInstanceKey && typeof Input?.getEquippedSwordArtifactByKey === 'function') {
            this.artifactState = Input.getEquippedSwordArtifactByKey(this.artifactInstanceKey) || null;
        }
        return this.artifactState;
    }

    getArtifactDurabilityValue() {
        const state = this.getArtifactState();
        if (state) {
            return Math.max(0, Math.floor(Number(state.durability) || 0));
        }

        const rankData = CONFIG.CULTIVATION.RANKS[Input.rankIndex] || CONFIG.CULTIVATION.RANKS[0];
        return Math.max(1, Math.floor(Number(rankData?.swordDurability) || 1));
    }

    getArtifactPowerMultiplier() {
        const state = this.getArtifactState();
        if (!state || typeof Input?.getSwordArtifactPowerMultiplier !== 'function') {
            return 1;
        }

        return Input.getSwordArtifactPowerMultiplier(state);
    }

    getUltimateCoreSword() {
        if (typeof swords !== 'undefined' && Array.isArray(swords) && swords.length > 0) {
            const pinnedCore = swords[Input?.ultimateCoreIndex];
            if (pinnedCore && !pinnedCore.isDead) {
                return pinnedCore;
            }
            return swords.find(s => !s.isDead && !s.isStunned) || swords.find(s => !s.isDead) || swords[0];
        }

        return this;
    }

    isUltimateCore() {
        return this === this.getUltimateCoreSword();
    }

    getDamageMultiplier() {
        const artifactPowerMultiplier = this.getArtifactPowerMultiplier();
        if (Input.isUltMode && this.isUltimateCore()) {
            const activeSwordCount = (typeof swords !== 'undefined' && Array.isArray(swords) && swords.length)
                ? swords.length
                : Math.max(1, CONFIG.SWORD.COUNT || 1);
            return Math.max(this.powerPenalty, Math.max(1, Math.floor(activeSwordCount / 3))) * artifactPowerMultiplier;
        }

        return this.powerPenalty * artifactPowerMultiplier;
    }

    getMergedGuardTarget(guardCenter, scaleFactor) {
        return {
            tx: guardCenter.x,
            ty: guardCenter.y - 20 * scaleFactor,
            finalAngle: 0
        };
    }

    getCurrentGuardTarget(guardCenter, r, Input, scaleFactor, now = null) {
        if (Input.isUltMode && this.isUltimateCore()) {
            return this.getMergedGuardTarget(guardCenter, scaleFactor);
        }

        return this.getNormalGuardTarget(guardCenter, r, Input, scaleFactor, now);
    }

    getSafeSpeedMultiplier(Input) {
        const rawSpeedMult = Input?.getMovementSpeedMultiplier
            ? Input.getMovementSpeedMultiplier()
            : (Input?.getSpeedMultiplier ? Input.getSpeedMultiplier() : 1);
        if (!Number.isFinite(rawSpeedMult)) {
            return 16;
        }

        return Math.max(0.35, rawSpeedMult);
    }

    usesCloseRangeSlash(Input) {
        return !Input.isUltMode
            && Input.attackMode !== 'SWORD'
            && !Boolean(Input?.hasThanhLinhKiemQuyetUnlocked?.());
    }

    getCloseRangeSlashAnchor(Input, scaleFactor) {
        if (typeof guardCenter !== 'undefined'
            && guardCenter
            && Number.isFinite(guardCenter.x)
            && Number.isFinite(guardCenter.y)) {
            return {
                x: guardCenter.x,
                y: guardCenter.y
            };
        }

        const safeX = Number.isFinite(Input?.x) ? Input.x : this.x;
        const safeY = Number.isFinite(Input?.y) ? Input.y : this.y;

        return {
            x: safeX,
            y: safeY
        };
    }

    shouldContinueCloseRangeSlash(Input, now = null) {
        if (!this.usesCloseRangeSlash(Input)) return false;
        if (Input.isAttacking) return true;

        const slashCycleMs = 260;
        const slashCycle = Math.floor((getSwordFrameNow(now) + this.index * 37) / slashCycleMs);
        return this.committedCloseSlashCycle >= 0 && slashCycle <= this.committedCloseSlashCycle;
    }

    startReturnToGuard() {
        this.isReturning = true;
        this.attackFrame = 0;
        this.pierceCount = 0;
    }

    useSphereGuardOrbit(Input) {
        return !Input.isUltMode
            && Input.attackMode !== 'SWORD'
            && Boolean(Input?.hasThanhLinhKiemQuyetUnlocked?.());
    }

    getCursorGuardAnchor(guardCenter, Input) {
        const cursorX = Number(Input?.x);
        const cursorY = Number(Input?.y);

        return Number.isFinite(cursorX) && Number.isFinite(cursorY)
            ? { x: cursorX, y: cursorY }
            : guardCenter;
    }

    sampleSphereGuardPoint(anchor, scaleFactor, timeOffset = 0, now = null) {
        const sphereConfig = CONFIG.SWORD.IDLE_SPHERE || {};
        const activeSwordCount = (typeof swords !== 'undefined' && Array.isArray(swords) && swords.length > 0)
            ? swords.length
            : Math.max(1, CONFIG.SWORD.COUNT || 1);
        const densityFactor = Math.min(
            sphereConfig.DENSITY_MAX || 3.8,
            1 + Math.sqrt(activeSwordCount) / (sphereConfig.DENSITY_DIVISOR || 5.2)
        );
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const pointIndex = this.index + 0.5;
        const normalizedY = 1 - ((pointIndex / Math.max(1, activeSwordCount)) * 2);
        const radial = Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY));
        const baseAzimuth = goldenAngle * this.index + this.flowNoise * (sphereConfig.FLOW_NOISE_WEIGHT || 0.45);
        const time = getSwordFrameNow(now) * 0.001 + timeOffset;
        const yaw = time
            * ((sphereConfig.YAW_SPEED_BASE || 0.34) + densityFactor * (sphereConfig.YAW_SPEED_DENSITY_BONUS || 0.03))
            * ((this.layer + this.index) % 2 === 0 ? 1 : -1);
        const pitch = (sphereConfig.PITCH_BASE || 0.88)
            + Math.sin(time * (sphereConfig.PITCH_OSC_SPEED || 0.28) + this.layer * (sphereConfig.PITCH_OSC_LAYER_STEP || 0.42))
            * (sphereConfig.PITCH_OSC_AMPLITUDE || 0.1);
        const roll = time * ((sphereConfig.ROLL_SPEED_BASE || 0.11) + (this.layer % 3) * (sphereConfig.ROLL_SPEED_LAYER_STEP || 0.014));
        const shellRadius = Math.max(
            ((sphereConfig.RADIUS_MIN_BASE || 56) + this.layer * (sphereConfig.RADIUS_MIN_LAYER_STEP || 12)) * scaleFactor,
            ((sphereConfig.RADIUS_MAX_BASE || 74) + densityFactor * (sphereConfig.RADIUS_DENSITY_STEP || 26) + this.layer * (sphereConfig.RADIUS_MAX_LAYER_STEP || 13)) * scaleFactor
        );
        const breathing = 1
            + Math.sin(time * ((sphereConfig.BREATH_SPEED_BASE || 0.9) + (this.index % 5) * (sphereConfig.BREATH_SPEED_INDEX_STEP || 0.06)) + this.breath)
            * (sphereConfig.BREATH_AMPLITUDE || 0.045);

        let x = Math.cos(baseAzimuth) * radial;
        let y = normalizedY;
        let z = Math.sin(baseAzimuth) * radial;

        const cosYaw = Math.cos(yaw);
        const sinYaw = Math.sin(yaw);
        [x, z] = [x * cosYaw - z * sinYaw, x * sinYaw + z * cosYaw];

        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);
        [y, z] = [y * cosPitch - z * sinPitch, y * sinPitch + z * cosPitch];

        const cosRoll = Math.cos(roll);
        const sinRoll = Math.sin(roll);
        [x, y] = [x * cosRoll - y * sinRoll, x * sinRoll + y * cosRoll];

        const xRadius = shellRadius * ((sphereConfig.X_RADIUS_BASE || 1.08) + (this.layer % 2) * (sphereConfig.X_RADIUS_LAYER_BONUS || 0.04)) * breathing;
        const yRadius = shellRadius * (sphereConfig.Y_RADIUS_SCALE || 0.88) * breathing;
        const depthLift = shellRadius * (sphereConfig.DEPTH_LIFT_SCALE || 0.3);
        const projectedX = anchor.x
            + x * xRadius
            + Math.cos(time * (sphereConfig.DRIFT_X_SPEED || 0.42) + this.flowNoise) * (sphereConfig.DRIFT_X_AMPLITUDE || 3.5) * scaleFactor;
        const projectedY = anchor.y
            + y * yRadius
            + z * depthLift
            + Math.sin(time * (sphereConfig.DRIFT_Y_SPEED || 0.36) + this.flowNoise * (sphereConfig.DRIFT_Y_NOISE_SCALE || 0.8)) * (sphereConfig.DRIFT_Y_AMPLITUDE || 2.5) * scaleFactor;
        const depth = z;
        const visualScale = (sphereConfig.VISUAL_SCALE_BASE || 0.72) + (depth + 1) * (sphereConfig.VISUAL_SCALE_DEPTH_MULT || 0.24);
        const opacity = (sphereConfig.OPACITY_BASE || 0.42) + (depth + 1) * (sphereConfig.OPACITY_DEPTH_MULT || 0.27);

        return { x: projectedX, y: projectedY, depth, visualScale, opacity };
    }

    getSphereGuardTarget(guardCenter, Input, scaleFactor, now = null) {
        const sphereConfig = CONFIG.SWORD.IDLE_SPHERE || {};
        const anchor = this.getCursorGuardAnchor(guardCenter, Input);
        const currentPoint = this.sampleSphereGuardPoint(anchor, scaleFactor, 0, now);
        const futurePoint = this.sampleSphereGuardPoint(anchor, scaleFactor, sphereConfig.LOOKAHEAD_TIME || 0.08, now);
        const finalAngle = Math.atan2(futurePoint.y - currentPoint.y, futurePoint.x - currentPoint.x) + Math.PI / 2;

        return {
            tx: currentPoint.x,
            ty: currentPoint.y,
            finalAngle,
            renderDepth: currentPoint.depth,
            visualScale: currentPoint.visualScale,
            opacity: currentPoint.opacity
        };
    }

    getNormalGuardTarget(guardCenter, r, Input, scaleFactor, now = null) {
        if (this.useSphereGuardOrbit(Input)) {
            return this.getSphereGuardTarget(guardCenter, Input, scaleFactor, now);
        }

        const canMultiControl = Boolean(Input?.hasThanhLinhKiemQuyetUnlocked?.());
        if (!Input.isUltMode && Input.attackMode !== 'SWORD' && !canMultiControl) {
            return {
                tx: guardCenter.x,
                ty: guardCenter.y - Math.max(42 * scaleFactor, r * 0.45),
                finalAngle: 0
            };
        }

        const globalRotation = !CONFIG.SWORD.IS_PAUSED
            ? (getSwordFrameNow(now) / 1000) * this.spinSpeed * (CONFIG.SWORD.SPEED_MULT || 100)
            : 0;

        const a = this.baseAngle + globalRotation;
        const tx = guardCenter.x + Math.cos(a) * r;
        const ty = guardCenter.y + Math.sin(a) * r;
        const finalAngle = (Input.guardForm === 1)
            ? a + Math.PI / 2
            : Math.atan2(ty - this.y, tx - this.x) + Math.PI / 2;

        return { tx, ty, finalAngle };
    }

    updateUltimateTransition(guardCenter, r, Input, scaleFactor, now = null) {
        const phase = Input.ultimatePhase;
        const eased = Input.getUltimateTransitionEase();
        const mergedTarget = this.getMergedGuardTarget(guardCenter, scaleFactor);
        const normalTarget = this.getNormalGuardTarget(guardCenter, r, Input, scaleFactor, now);
        const isCore = this.isUltimateCore();
        const coreSword = this.getUltimateCoreSword();
        const transitionOrigin = (phase === 'splitting' && coreSword)
            ? {
                tx: coreSword.x,
                ty: coreSword.y,
                finalAngle: coreSword.drawAngle
            }
            : mergedTarget;

        const tx = (phase === 'splitting')
            ? transitionOrigin.tx + (normalTarget.tx - transitionOrigin.tx) * eased
            : mergedTarget.tx;
        const ty = (phase === 'splitting')
            ? transitionOrigin.ty + (normalTarget.ty - transitionOrigin.ty) * eased
            : mergedTarget.ty;
        let finalAngle = mergedTarget.finalAngle;
        if (phase === 'splitting') {
            let angleDiff = normalTarget.finalAngle - transitionOrigin.finalAngle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            finalAngle = transitionOrigin.finalAngle + angleDiff * eased;
        }

        this.isStunned = false;
        this.stunTimer = 0;
        this.isEnlarged = false;
        this.isReturning = false;
        this.powerPenalty = 1;

        if (phase === 'merging') {
            this.targetVisualScale = isCore
                ? 1 + (4.8 - 1) * eased
                : Math.max(0.12, 1 - eased * 0.9);
        } else {
            this.targetVisualScale = isCore
                ? 4.8 - (4.8 - 1) * eased
                : Math.max(0.12, 0.12 + eased * 0.88);
        }

        this.currentVisualScale += (this.targetVisualScale - this.currentVisualScale) * (phase === 'merging' ? 0.2 : 0.16);

        const dx = tx - this.x;
        const dy = ty - this.y;
        const followStiffness = (phase === 'merging')
            ? (isCore ? 0.24 : 0.18 + eased * 0.14)
            : 0.12 + eased * 0.18;

        this.x += dx * followStiffness;
        this.y += dy * followStiffness;
        this.vx *= 0.45;
        this.vy *= 0.45;

        let diff = finalAngle - this.drawAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.drawAngle += diff * (phase === 'merging' ? 0.24 : 0.16 + eased * 0.12);

        this.attackFrame = 0;
        this.pierceCount = 0;
        this.trail = [];
    }

    updateReturnMode(guardCenter, r, Input, scaleFactor, now = null) {
        const speedMult = this.getSafeSpeedMultiplier(Input);
        const target = this.getCurrentGuardTarget(guardCenter, r, Input, scaleFactor, now);
        const followStiffness = (Input.isUltMode && this.isUltimateCore()) ? 0.22 : 0.18;
        const returnBoost = (Input.isUltMode && this.isUltimateCore()) ? 16 : 10;

        if (Input.isUltMode && this.isUltimateCore()) {
            this.targetVisualScale = 4.8;
        } else if (!this.isEnlarged) {
            this.targetVisualScale = Number.isFinite(target.visualScale) ? target.visualScale : 1;
        }

        if (!Input.isUltMode) {
            this.renderDepth += ((Number(target.renderDepth) || 0) - this.renderDepth) * 0.2;
            this.renderOpacity += ((Number(target.opacity) || 1) - this.renderOpacity) * 0.2;
        } else {
            this.renderDepth *= 0.8;
            this.renderOpacity += (1 - this.renderOpacity) * 0.2;
        }

        this.currentVisualScale += (this.targetVisualScale - this.currentVisualScale) * 0.14;

        const dx = target.tx - this.x;
        const dy = target.ty - this.y;
        const distance = Math.hypot(dx, dy) || 1;
        const pullForce = Math.min(distance * followStiffness, returnBoost * scaleFactor * speedMult);

        this.vx += (dx / distance) * pullForce;
        this.vy += (dy / distance) * pullForce;
        this.vx *= 0.8;
        this.vy *= 0.8;
        this.x += this.vx;
        this.y += this.vy;

        let finalAngle = target.finalAngle;
        if (Math.hypot(this.vx, this.vy) > 0.6) {
            finalAngle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
        }

        let diff = finalAngle - this.drawAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.drawAngle += diff * 0.24;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > CONFIG.SWORD.TRAIL_LENGTH) this.trail.shift();

        const snapDistance = (Input.isUltMode && this.isUltimateCore()) ? 18 : 10;
        if (distance <= snapDistance * scaleFactor && Math.hypot(this.vx, this.vy) <= 2.2 * scaleFactor * speedMult) {
            this.x = target.tx;
            this.y = target.ty;
            this.vx *= 0.2;
            this.vy *= 0.2;
            this.isReturning = false;
            this.trail = [];
        }
    }

    update(guardCenter, enemies, Input, scaleFactor, now = null) {
        if (this.isDead) {
            if (this.getArtifactDurabilityValue() <= 0) {
                return;
            }
            const frameNow = getSwordFrameNow(now);
            if (frameNow > this.respawnTimer) {
                // KIỂM TRA MANA TRƯỚC KHI HỒI SINH
                if (Input.mana >= Math.abs(CONFIG.MANA.COST_RESPAWN)) {
                    Input.updateMana(CONFIG.MANA.COST_RESPAWN); // TRỪ 1 MANA KHI TÁI SINH
                    this.respawn(Input);
                } else {
                    // Nếu không đủ mana, trì hoãn việc hồi sinh thêm 1 giây để kiểm tra lại sau
                    this.respawnTimer = frameNow + 1000;
                }
            }
            return;
        }

        this.breath += this.breathSpeed;
        this.breathSpeed = random(CONFIG.SWORD.BREATH_SPEED.MIN, CONFIG.SWORD.BREATH_SPEED.MAX);
        const currentRadius = this.radius + Math.sin(this.breath) * 8 * scaleFactor;

        if (Input.ultimatePhase === 'merging' || Input.ultimatePhase === 'splitting') {
            this.updateUltimateTransition(guardCenter, currentRadius, Input, scaleFactor, now);
            return;
        }

        if (Input.isUltMode && !this.isUltimateCore()) {
            const coreSword = this.getUltimateCoreSword();
            const anchorX = coreSword ? coreSword.x : guardCenter.x;
            const anchorY = coreSword ? coreSword.y : guardCenter.y - 20 * scaleFactor;
            this.isStunned = false;
            this.stunTimer = 0;
            this.isEnlarged = false;
            this.isReturning = false;
            this.powerPenalty = 1;
            this.targetVisualScale = 0;
            this.currentVisualScale += (this.targetVisualScale - this.currentVisualScale) * 0.25;
            this.x += (anchorX - this.x) * 0.24;
            this.y += (anchorY - this.y) * 0.24;
            this.vx *= 0.7;
            this.vy *= 0.7;
            this.trail = [];
            this.attackFrame = 0;
            return;
        }

        if (this.isStunned) {
            this.handleStun(scaleFactor, now);
            return;
        }

        if (this.isReturning) {
            this.updateReturnMode(guardCenter, currentRadius, Input, scaleFactor, now);
            return;
        }

        if (!Input.isAttacking) {
            if (this.shouldContinueCloseRangeSlash(Input, now)) {
                this.updateAttackMode(enemies, Input, scaleFactor, now);
            } else {
                this.updateGuardMode(guardCenter, currentRadius, Input, scaleFactor, now);
            }
        } else {
            this.updateAttackMode(enemies, Input, scaleFactor, now);
        }
    }

    handleStun(scaleFactor, now = null) {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.drawAngle += 0.2;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > CONFIG.SWORD.TRAIL_LENGTH) this.trail.shift();

        if (getSwordFrameNow(now) > this.stunTimer) {
            this.isStunned = false;
            this.vx *= 0.2;
            this.vy *= 0.2;
        }
    }

    respawn(Input) {
        const durability = this.getArtifactDurabilityValue();
        if (durability <= 0) {
            this.maxHp = 0;
            this.hp = 0;
            return;
        }

        this.maxHp = durability;
        this.hp = this.maxHp;
        this.isDead = false;
        this.x = Input.x;
        this.y = Input.y;
        this.vx = 0;
        this.vy = 0;
        this.isStunned = false;
        this.powerPenalty = 1;
        this.isEnlarged = false;
        this.isReturning = false;
        this.currentVisualScale = 1;
        this.targetVisualScale = 1;
        this.renderDepth = 0;
        this.renderOpacity = 1;
        this.lastUltimateHitAt = 0;
        this.lastCloseSlashCycle = -1;
        this.committedCloseSlashCycle = -1;
        this.trail = [];
        this.fragments = [];
    }

    updateGuardMode(guardCenter, r, Input, scaleFactor, now = null) {
        const speedMult = this.getSafeSpeedMultiplier(Input);
        this.isReturning = false;
        // Thu nhỏ lại nếu trước đó đang phóng to
        if (this.isEnlarged) {
            this.isEnlarged = false;
            this.targetVisualScale = 1;
        }
        this.powerPenalty = 1;
        this.currentVisualScale += (this.targetVisualScale - this.currentVisualScale) * 0.1;

        let tx, ty, finalAngle;
        
        if (Input.isUltMode) {
            // --- CHẾ ĐỘ VẠN KIẾM QUY TÔNG (Hợp nhất) ---
            
            // 1. Tất cả kiếm đều hướng về cùng 1 vị trí (tâm của guardCenter)
            // Bạn có thể cộng thêm một khoảng offset nếu muốn thanh kiếm khổng lồ nằm trước mặt nhân vật
            tx = guardCenter.x; 
            ty = guardCenter.y - 20 * scaleFactor;

            // 2. Tất cả kiếm đều có cùng một góc quay (ví dụ: xoay theo thời gian hoặc hướng lên trên)
            // Ở đây tôi để xoay vòng đều để tạo hiệu ứng thanh kiếm thần đang vận công
            finalAngle = 0;

            // 3. (Tùy chọn) Tăng kích thước khi hợp nhất để trông quyền năng hơn
            this.targetVisualScale = 4.8; // Phóng to thanh kiếm lên khi hợp nhất
            this.renderDepth *= 0.8;
            this.renderOpacity += (1 - this.renderOpacity) * 0.2;

        } else {
            // --- QUỸ ĐẠO HỘ THÂN / KIẾM TRẬN ---
            const guardTarget = this.getNormalGuardTarget(guardCenter, r, Input, scaleFactor, now);
            tx = guardTarget.tx;
            ty = guardTarget.ty;
            finalAngle = guardTarget.finalAngle;
            this.renderDepth += ((Number(guardTarget.renderDepth) || 0) - this.renderDepth) * 0.22;
            this.renderOpacity += ((Number(guardTarget.opacity) || 1) - this.renderOpacity) * 0.22;
            this.targetVisualScale = Number.isFinite(guardTarget.visualScale) ? guardTarget.visualScale : 1;
        }

        // DI CHUYỂN VẬT LÝ (Dùng nội suy để mượt hơn khi nhập thể)
        // Tăng followStiffness khi Ulti để kiếm "nhập" vào nhau nhanh hơn
        const followStiffness = (Input.isUltMode ? 0.3 : 0.35) * speedMult;

        const dx = tx - this.x;
        const dy = ty - this.y;
        const distance = Math.hypot(dx, dy);

        if (Input.speed > 1.5 || (distance > 100 && !Input.isUltMode)) {
            this.vx += (dx / (distance || 1)) * Math.min(distance * 0.05, 6 * scaleFactor * speedMult);
            this.vy += (dy / (distance || 1)) * Math.min(distance * 0.05, 6 * scaleFactor * speedMult);
            this.vx *= 0.9; 
            this.vy *= 0.9;
            this.x += this.vx; this.y += this.vy;
            this.drawAngle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
        } else {
            this.x += dx * followStiffness;
            this.y += dy * followStiffness;
            this.vx *= 0.5; this.vy *= 0.5;

            let diff = finalAngle - this.drawAngle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.drawAngle += diff * 0.2;
        }

        this.attackFrame = 0;
        this.lastCloseSlashCycle = -1;
        this.committedCloseSlashCycle = -1;
        this.pierceCount = 0; 
        // Giữ trail ngắn lại một chút khi ở mode rồng để không bị rối mắt
        if (this.trail.length > 10) this.trail.shift();
        this.trail = [];
    }

    updateAttackMode(enemies, Input, scaleFactor, now = null) {
        const speedMult = this.getSafeSpeedMultiplier(Input);
        const isUltimateCore = Input.isUltMode && this.isUltimateCore();
        const ultimateHitInterval = Math.max(16, Number(CONFIG.ULTIMATE?.CORE_HIT_INTERVAL_MS) || 42);
        const frameNow = getSwordFrameNow(now);
        this.attackFrame++;
        const requiredAttackDelay = isUltimateCore ? 1 : this.attackDelay;
        if (this.attackFrame < requiredAttackDelay) return;
        const closeRangeSlashMode = this.usesCloseRangeSlash(Input);

        // Cập nhật kích thước (Enlarge logic)
        if (!Input.isUltMode && !closeRangeSlashMode && !this.isEnlarged && Math.random() < 0.01 && Input.mana >= 1) {
            Input.updateMana(-1);
            this.isEnlarged = true;
            this.targetVisualScale = 2.5;
        }
        if (isUltimateCore) {
            this.targetVisualScale = 4.8;
        }
        if (closeRangeSlashMode) {
            this.isEnlarged = false;
            this.targetVisualScale = 1;
        }
        this.currentVisualScale += (this.targetVisualScale - this.currentVisualScale) * 0.1;

        if (closeRangeSlashMode) {
            const slashCycleMs = 260;
            const slashCycle = Math.floor((frameNow + this.index * 37) / slashCycleMs);
            if (Input.isAttacking) {
                this.committedCloseSlashCycle = slashCycle;
            }
            const anchor = this.getCloseRangeSlashAnchor(Input, scaleFactor);
            let target = null;
            let minTargetDistance = Infinity;

            for (const enemy of enemies) {
                const distance = Math.hypot(enemy.x - anchor.x, enemy.y - anchor.y);
                if (distance < minTargetDistance) {
                    minTargetDistance = distance;
                    target = enemy;
                }
            }

            const slashReach = 110 * scaleFactor;
            const canSlashTarget = Boolean(target) && minTargetDistance <= slashReach + (target?.r || 0);
            const slashProgress = ((frameNow + this.index * 37) % slashCycleMs) / slashCycleMs;
            const attackWindowRatio = 0.72;
            const downstrokeProgress = slashProgress <= attackWindowRatio
                ? (slashProgress / attackWindowRatio)
                : 1;
            const recoveryProgress = slashProgress > attackWindowRatio
                ? ((slashProgress - attackWindowRatio) / Math.max(0.001, 1 - attackWindowRatio))
                : 0;
            const startAngle = -Math.PI / 2;
            let targetAngle = canSlashTarget
                ? Math.atan2(target.y - anchor.y, target.x - anchor.x)
                : startAngle;
            let angleDelta = targetAngle - startAngle;

            while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
            while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;

            if (Math.abs(angleDelta) < 0.16) {
                angleDelta = (canSlashTarget && target.x < anchor.x ? -1 : 1) * 0.42;
                targetAngle = startAngle + angleDelta;
            }

            const orbitRadius = canSlashTarget
                ? clampNumber(minTargetDistance * 0.92, 42 * scaleFactor, slashReach)
                : 42 * scaleFactor;
            const attackEase = 1 - Math.pow(1 - downstrokeProgress, 3);
            const recoveryEase = 1 - Math.pow(recoveryProgress, 2);
            const orbitAngle = slashProgress <= attackWindowRatio
                ? startAngle + (angleDelta * attackEase)
                : targetAngle + ((startAngle - targetAngle) * recoveryEase);
            const desiredX = anchor.x + (Math.cos(orbitAngle) * orbitRadius);
            const desiredY = anchor.y + (Math.sin(orbitAngle) * orbitRadius);
            const toDesiredX = desiredX - this.x;
            const toDesiredY = desiredY - this.y;

            this.vx = this.vx * 0.42 + toDesiredX * 0.22 * speedMult;
            this.vy = this.vy * 0.42 + toDesiredY * 0.22 * speedMult;
            this.x += this.vx;
            this.y += this.vy;
            const desiredDrawAngle = Math.atan2(this.vy || toDesiredY, this.vx || toDesiredX) + Math.PI / 2;
            let drawDiff = desiredDrawAngle - this.drawAngle;
            while (drawDiff < -Math.PI) drawDiff += Math.PI * 2;
            while (drawDiff > Math.PI) drawDiff -= Math.PI * 2;
            this.drawAngle += drawDiff * 0.32;
            this.pierceCount = 0;

            if (!canSlashTarget) {
                this.lastCloseSlashCycle = -1;
            } else {
                const tipOffset = CONFIG.SWORD.SIZE * scaleFactor;
                const tipX = this.x + Math.sin(this.drawAngle) * tipOffset;
                const tipY = this.y - Math.cos(this.drawAngle) * tipOffset;
                const hitDistance = (target.r || 0) + (target.hasShield ? 12 : 0) + 6 * scaleFactor;
                const impactWindow = slashProgress <= attackWindowRatio && downstrokeProgress >= 0.78 && downstrokeProgress <= 0.96;
                const landedHit = impactWindow && Math.hypot(tipX - target.x, tipY - target.y) <= hitDistance;

                if (landedHit && this.lastCloseSlashCycle !== slashCycle) {
                    this.lastCloseSlashCycle = slashCycle;

                    if (this.isEnlarged) {
                        this.powerPenalty *= 1.5;
                        if (typeof Input.createAttackBurst === 'function') {
                            Input.createAttackBurst(target.x, target.y, '#ffcc00');
                        }
                        this.isEnlarged = false;
                        this.targetVisualScale = 1;
                    }

                    const result = target.hit(this);
                    if (result === 'shielded') {
                        this.hp -= target.isElite ? 3 : 1;
                        if (this.hp <= 0) {
                            this.breakSword(scaleFactor, frameNow);
                            return;
                        }

                        this.isStunned = true;
                        this.stunTimer = frameNow + Math.max(120, Math.floor(CONFIG.SWORD.STUN_DURATION_MS * 0.72));
                        this.vx = (anchor.x - this.x) * 0.08;
                        this.vy = -Math.max(1.2 * scaleFactor, Math.abs(this.vy) * 0.55);
                    } else if (result !== 'missed') {
                        this.vx *= 0.36;
                        this.vy *= 0.22;
                    }
                }
            }

            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > 8) this.trail.shift();
            return;
        }
        this.committedCloseSlashCycle = -1;

        // Tìm mục tiêu gần nhất
        let target = null, minStartDist = Infinity;
        for (const e of enemies) {
            const d = Math.hypot(e.x - Input.x, e.y - Input.y);
            if (d < minStartDist) { minStartDist = d; target = e; }
        }

        if (!target) {
            if (isUltimateCore) {
                this.startReturnToGuard();
            }
            return;
        }

        const dx = target.x - this.x, dy = target.y - this.y;
        const d = Math.hypot(dx, dy) || 1;

        // Tốc độ bay (nhanh hơn khi đang Ult)
        const flySpeed = (Input.isUltMode ? 22 : 10) * scaleFactor * speedMult;
        this.vx += (dx / d) * flySpeed;
        this.vy += (dy / d) * flySpeed;
        this.vx *= 0.92; this.vy *= 0.92;
        this.x += this.vx; this.y += this.vy;
        
        this.drawAngle = Math.atan2(this.vy, this.vx) + Math.PI / 2;

        // KIỂM TRA VA CHẠM (HIT TEST)
        const hitDistance = target.r + (target.hasShield ? 15 : 0) + (Input.isUltMode ? 26 * scaleFactor : 0);
        if (Math.hypot(this.x - target.x, this.y - target.y) < hitDistance) {
            
            // Tính toán sát thương và Enlarge
            if (this.isEnlarged) {
                this.powerPenalty *= 1.5;
                if (typeof Input.createAttackBurst === 'function') {
                    Input.createAttackBurst(target.x, target.y, "#ffcc00");
                }
                this.isEnlarged = false;
                this.targetVisualScale = 1;
            }

            if (isUltimateCore && (frameNow - (this.lastUltimateHitAt || 0)) < ultimateHitInterval) {
                this.trail.push({ x: this.x, y: this.y });
                if (this.trail.length > CONFIG.SWORD.TRAIL_LENGTH) this.trail.shift();
                return;
            }

            const result = target.hit(this);
            if (isUltimateCore) {
                this.lastUltimateHitAt = frameNow;
            }

            // CƠ CHẾ ĐÂM XUYÊN (PIERCE)
            if (result !== "missed" && result !== "shielded") {
                if (isUltimateCore) {
                    this.pierceCount = 0;
                } else {
                    this.pierceCount = (this.pierceCount || 0) + 1;
                
                // Nếu đâm xuyên đủ 3 lần thì mới bị khựng nhẹ
                if (this.pierceCount >= 3) {
                    this.isStunned = true;
                    this.stunTimer = frameNow + 150; // Khựng ngắn hơn bình thường
                    this.vx *= -0.5; this.vy *= -0.5;
                    this.pierceCount = 0;
                }
                }
                // Nếu chưa đủ 3 lần, kiếm tiếp tục bay xuyên qua mục tiêu (không bị Stun)
            } 
            else if (result === "shielded") {
                // Đập trúng khiên thì gãy/văng ngay lập tức
                if (isUltimateCore) {
                    this.vx *= -0.18;
                    this.vy *= -0.18;
                    this.startReturnToGuard();
                } else {
                    this.hp -= target.isElite ? 3 : 1;
                    if (this.hp <= 0) {
                        this.breakSword(scaleFactor, frameNow);
                    } else {
                        this.isStunned = true;
                        this.stunTimer = frameNow + CONFIG.SWORD.STUN_DURATION_MS;
                        this.vx = -this.vx * 1.2; this.vy = -this.vy * 1.2;
                    }
                }
            }
        }

        // Vẽ vệt kiếm
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > CONFIG.SWORD.TRAIL_LENGTH) this.trail.shift();
    }

    breakSword(scaleFactor, now = null) {
        this.isDead = true;
        this.deathTime = getSwordFrameNow(now);
        this.respawnTimer = this.deathTime + CONFIG.SWORD.DEATH_WAIT_MS + CONFIG.SWORD.RESPAWN_DELAY_MS;

        const sLen = CONFIG.SWORD.SIZE * scaleFactor;
        const cos = Math.cos(this.drawAngle);
        const sin = Math.sin(this.drawAngle);

        this.fragments.push({
            type: 'handle',
            x: this.x,
            y: this.y,
            vx: -this.vx * 0.2 + random(-1, 1),
            vy: -this.vy * 0.2 + random(-1, 1),
            angle: this.drawAngle,
            va: random(-0.1, 0.1)
        });

        this.fragments.push({
            type: 'mid',
            x: this.x + cos * (sLen * 0.4) + sin * (sLen * 0.4),
            y: this.y + sin * (sLen * 0.4) - cos * (sLen * 0.4),
            vx: -this.vx * 0.4 + random(-2, 2),
            vy: -this.vy * 0.4 + random(-2, 2),
            angle: this.drawAngle + random(-0.2, 0.2),
            va: random(-0.2, 0.2)
        });

        this.fragments.push({
            type: 'tip',
            x: this.x + cos * (sLen * 0.8) + sin * (sLen * 0.8),
            y: this.y + sin * (sLen * 0.8) - cos * (sLen * 0.8),
            vx: -this.vx * 0.6 + random(-3, 3),
            vy: -this.vy * 0.6 + random(-3, 3),
            angle: this.drawAngle + random(-0.5, 0.5),
            va: random(-0.4, 0.4)
        });

        const updatedState = this.artifactInstanceKey && typeof Input?.recordSwordArtifactBreak === 'function'
            ? Input.recordSwordArtifactBreak(this.artifactInstanceKey)
            : null;
        if (updatedState && updatedState.durability <= 0 && typeof Input?.reformSwordFormationState === 'function') {
            setTimeout(() => {
                Input.reformSwordFormationState({ rebuildAll: true });
            }, 0);
        }
    }

    draw(ctx, scaleFactor, now = null) {
        if (this.isDead) {
            if (this.fragments.length > 0) {
                const age = getSwordFrameNow(now) - this.deathTime;
                const lifeTime = CONFIG.SWORD.FRAGMENTS.LIFE_TIME;
                const fadeTime = CONFIG.SWORD.FRAGMENTS.FADE_TIME;

                const alpha = age > lifeTime ? 1 - ((age - lifeTime) / fadeTime) : 1;

                ctx.save();
                ctx.globalAlpha = alpha;
                this.drawFragments(ctx, scaleFactor);
                ctx.restore();
            }
            return;
        }

        if (Input.isUltMode && !this.isUltimateCore()) {
            return;
        }

        if (this.trail.length > 1) {
            ctx.save();
            ctx.globalAlpha = Math.max(0.2, this.renderOpacity * 0.72);
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.strokeStyle = CONFIG.COLORS.SWORD_TRAIL;
            ctx.lineWidth = 2 * scaleFactor;
            ctx.stroke();
            ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = this.renderOpacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.drawAngle);
        ctx.scale(this.currentVisualScale, this.currentVisualScale);
        this.drawAura(ctx, scaleFactor);
        this.drawBlade(ctx, scaleFactor);
        ctx.restore();
    }

    drawFragments(ctx, scaleFactor) {
        const sLen = CONFIG.SWORD.SIZE * scaleFactor;
        const sWid = 4 * scaleFactor;

        this.fragments.forEach(f => {
            f.x += f.vx;
            f.y += f.vy;
            f.angle += f.va;

            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.angle);

            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";

            ctx.beginPath();
            if (f.type === 'handle') {
                ctx.fillStyle = CONFIG.COLORS.SWORD_HANDLE;
                ctx.fillRect(-3 * scaleFactor, 0, 6 * scaleFactor, 14 * scaleFactor);

                ctx.fillStyle = CONFIG.COLORS.SWORD_BLADE[2];
                ctx.moveTo(-sWid / 2, 0);
                ctx.lineTo(sWid / 2, 0);
                ctx.lineTo(sWid / 2, -sLen * 0.3);
                ctx.lineTo(0, -sLen * 0.2);
                ctx.lineTo(-sWid / 2, -sLen * 0.35);
                ctx.fill();
            }
            else if (f.type === 'mid') {
                ctx.fillStyle = CONFIG.COLORS.SWORD_BLADE[1];
                ctx.moveTo(-sWid / 2, 0);
                ctx.lineTo(sWid / 2, 0);
                ctx.lineTo(sWid / 2, -sLen * 0.3);
                ctx.lineTo(-sWid / 2, -sLen * 0.25);
                ctx.fill();
            }
            else if (f.type === 'tip') {
                ctx.fillStyle = CONFIG.COLORS.SWORD_BLADE[0];
                ctx.moveTo(-sWid / 2, 0);
                ctx.lineTo(sWid / 2, 0);
                ctx.lineTo(0, -sLen * 0.4);
                ctx.fill();
            }
            ctx.restore();
        });
    }

    drawAura(ctx, scaleFactor) {
        const auraCount = Math.floor(random(2, 8));
        ctx.shadowColor = CONFIG.COLORS.SWORD_AURA_SHADOW;
        ctx.shadowBlur = 8 * scaleFactor;
        for (let i = 0; i < auraCount; i++) {
            ctx.beginPath();
            let py = -random(0, CONFIG.SWORD.SIZE * scaleFactor);
            let px = random(-3, 3) * scaleFactor;
            ctx.moveTo(px, py);
            for (let s = 0; s < 3; s++) {
                px += random(-4, 4) * scaleFactor;
                py += random(-3, 3) * scaleFactor;
                ctx.lineTo(px, py);
            }
            ctx.strokeStyle = `rgba(255,255,180,${random(0.3, 0.6)})`;
            ctx.lineWidth = 2 * scaleFactor;
            ctx.stroke();
        }
    }

    drawBlade(ctx, scaleFactor) {
        const sLen = CONFIG.SWORD.SIZE * scaleFactor;
        
        // THÂN KIẾM: Điều chỉnh tỷ lệ để mũi kiếm chiếm khoảng 15-20% tổng chiều dài
        const baseWid = 9 * scaleFactor; 
        const tipWid = 5 * scaleFactor;  // Độ rộng tại điểm bắt đầu vát mũi
        const bladeBodyLen = sLen * 0.85; // Thân chiếm 85% chiều dài
        const swordTipLen = sLen;         // Mũi nhọn kết thúc tại 100% chiều dài

        // 1. VẼ LƯỠI KIẾM (Gồm thân và mũi nhọn)
        const bladeGrd = ctx.createLinearGradient(-baseWid/2, 0, baseWid/2, 0);
        bladeGrd.addColorStop(0, CONFIG.COLORS.SWORD_GOLD_MID);
        bladeGrd.addColorStop(0.3, CONFIG.COLORS.SWORD_BAMBOO_DARK);
        bladeGrd.addColorStop(0.5, CONFIG.COLORS.SWORD_BAMBOO_GREEN);
        bladeGrd.addColorStop(0.7, CONFIG.COLORS.SWORD_BAMBOO_DARK);
        bladeGrd.addColorStop(1, CONFIG.COLORS.SWORD_GOLD_MID);

        ctx.save();
        ctx.shadowColor = CONFIG.COLORS.SWORD_BAMBOO_GREEN;
        ctx.shadowBlur = 10 * scaleFactor;
        ctx.fillStyle = bladeGrd;
        
        ctx.beginPath();
        ctx.moveTo(-baseWid / 2, 0);                // Gốc trái
        ctx.lineTo(baseWid / 2, 0);                 // Gốc phải
        ctx.lineTo(tipWid / 2, -bladeBodyLen);      // Điểm bắt đầu vát bên phải
        ctx.lineTo(0, -swordTipLen);                // Đỉnh mũi kiếm nhọn (hội tụ tại tâm)
        ctx.lineTo(-tipWid / 2, -bladeBodyLen);     // Điểm bắt đầu vát bên trái
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 2. VẼ 10 ĐỐT TRÚC (Nằm gọn bên trong phần THÂN lưỡi)
        ctx.save();
        ctx.strokeStyle = CONFIG.COLORS.SWORD_NODE;
        ctx.lineWidth = 1.2 * scaleFactor;
        ctx.globalAlpha = 0.4;
        const nodeCount = 10;
        // Chỉ vẽ đốt trong phạm vi thân kiếm để không bị lòi ra ngoài mũi nhọn
        const nodeSpacing = bladeBodyLen / (nodeCount + 1); 
        
        for (let i = 1; i <= nodeCount; i++) {
            const y = -i * nodeSpacing;
            // Tính toán độ rộng tại vị trí y để đốt trúc không tràn ra khỏi cạnh kiếm
            const currentHalfWidth = (baseWid / 2) - (Math.abs(y) / bladeBodyLen) * ((baseWid - tipWid) / 2);
            const nodeMargin = 2 * scaleFactor; 
            
            ctx.beginPath();
            ctx.moveTo(-currentHalfWidth + nodeMargin, y);
            ctx.lineTo(currentHalfWidth - nodeMargin, y);
            ctx.stroke();
        }
        ctx.restore();

        // 3. THANH CHẮN TAY (Giữ nguyên logic của bạn)
        ctx.save();
        const gWidthTop = 13 * scaleFactor;    
        const gWidthBottom = 16 * scaleFactor; 
        const layerHeight = 1.5 * scaleFactor;
        const drawTrapezoid = (y, widthTop, widthBottom, height) => {
            ctx.beginPath();
            ctx.moveTo(-widthTop / 2, y);
            ctx.lineTo(widthTop / 2, y);
            ctx.lineTo(widthBottom / 2, y + height);
            ctx.lineTo(-widthBottom / 2, y + height);
            ctx.closePath();
            ctx.fill();
        };
        ctx.fillStyle = CONFIG.COLORS.SWORD_BAMBOO_DARK;
        drawTrapezoid(-2.5 * scaleFactor, gWidthTop, gWidthTop + 0.8, layerHeight);
        
        const goldGrd = ctx.createLinearGradient(-gWidthBottom/2, 0, gWidthBottom/2, 0);
        goldGrd.addColorStop(0.5, CONFIG.COLORS.SWORD_GOLD_LIGHT);
        ctx.fillStyle = goldGrd;
        drawTrapezoid(-2.5 * scaleFactor + layerHeight, gWidthTop + 0.8, gWidthBottom - 0.8, layerHeight);
        
        ctx.fillStyle = CONFIG.COLORS.SWORD_BAMBOO_DARK;
        drawTrapezoid(-2.5 * scaleFactor + (layerHeight * 2), gWidthBottom - 0.8, gWidthBottom, layerHeight);
        ctx.restore();

        // 4. CHUÔI KIẾM (Giữ nguyên logic của bạn)
        const hiltLen = 20 * scaleFactor;
        const hiltWidTop = 4 * scaleFactor;
        const hiltWidBottom = 6.5 * scaleFactor;
        
        const hiltGrd = ctx.createLinearGradient(0, layerHeight, 0, hiltLen);
        hiltGrd.addColorStop(0, CONFIG.COLORS.SWORD_BAMBOO_DARK);
        hiltGrd.addColorStop(0.8, CONFIG.COLORS.SWORD_BAMBOO_GREEN);
        hiltGrd.addColorStop(1, "#90EE90");

        ctx.save();
        ctx.fillStyle = hiltGrd;
        ctx.beginPath();
        ctx.moveTo(-hiltWidTop / 2, layerHeight);
        ctx.lineTo(hiltWidTop / 2, layerHeight);
        ctx.quadraticCurveTo(hiltWidTop / 2, hiltLen * 0.7, hiltWidBottom / 2, hiltLen);
        ctx.lineTo(-hiltWidBottom / 2, hiltLen);
        ctx.quadraticCurveTo(-hiltWidTop / 2, hiltLen * 0.7, -hiltWidTop / 2, layerHeight);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = CONFIG.COLORS.SWORD_BAMBOO_DARK;
        ctx.fillRect(-hiltWidBottom / 2, hiltLen, hiltWidBottom, 1.5 * scaleFactor);
        ctx.restore();
    }
}
