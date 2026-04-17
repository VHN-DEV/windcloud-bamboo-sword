// Consolidated from input-methods-part1.js and input-methods-part2.js
// Purpose: player input + combat handling methods

Object.assign(Input, {
    updateCombo(isReset = false) {
        if (isReset) {
            this.combo = 0;
            this.rage = 0;
        } else {
            this.combo++;
            // Tăng nộ: diệt càng nhanh nộ càng tăng mạnh
            const rageGain = Math.max(0, parseFloat(CONFIG.ULTIMATE.GAIN_PER_KILL) || 0);
            this.rage = Math.min(this.maxRage, this.rage + rageGain); 
        }
        this.renderRageUI();
    },

    renderRageUI() {
        const ultBtn = document.getElementById('btn-ultimate');
        const isUltimateBusy = this.isUltimateBusy();
        const isReady = this.rage >= this.maxRage && !isUltimateBusy;
        const selectedUltimateMode = this.getSelectedUltimateMode();
        const rageLabel = this.getUltimateResourceLabel();
        const ultimateName = this.getUltimateDisplayName(selectedUltimateMode);
        const safeMaxRage = Math.max(1, this.maxRage || 1);
        const percent = Math.max(0, Math.min(100, (this.rage / safeMaxRage) * 100));
        const chargeSteps = Math.max(1, parseInt(CONFIG.ULTIMATE.CHARGE_STEPS, 10) || 1);
        const snappedPercent = isUltimateBusy || isReady
            ? 100
            : Math.floor((percent / 100) * chargeSteps) * (100 / chargeSteps);
        const chargePercent = isUltimateBusy ? 100 : snappedPercent;
        const chargeRatio = Math.max(0, Math.min(1, chargePercent / 100));
        if (ultBtn) {
            ultBtn.style.display = 'flex';
            ultBtn.style.setProperty('--ult-charge', `${chargePercent}%`);
            ultBtn.style.setProperty('--ult-charge-ratio', chargeRatio.toFixed(2));
            ultBtn.classList.toggle('ready', isReady);
            ultBtn.classList.toggle('is-active', isUltimateBusy);
            ultBtn.classList.toggle('is-disabled', !isReady && !isUltimateBusy);
            ultBtn.classList.toggle('is-insect-ultimate', selectedUltimateMode === 'INSECT');
        }

        if (ultBtn) {
            if (this.ultimatePhase === 'merging') {
                ultBtn.title = `${this.getUltimateDisplayName('SWORD')} đang hợp nhất`;
            } else if (this.ultimatePhase === 'splitting') {
                ultBtn.title = `${this.getUltimateDisplayName('SWORD')} đang tách trận`;
            } else if (this.isSwordUltimateActive()) {
                ultBtn.title = `${this.getUltimateDisplayName('SWORD')} đang kích hoạt`;
            } else if (this.isInsectUltimateActive()) {
                ultBtn.title = `${this.getUltimateDisplayName('INSECT')} đang bộc phát`;
            } else if (isReady) {
                ultBtn.title = `${rageLabel} đầy ${Math.round(this.rage)}/${this.maxRage} - ${ultimateName}`;
            } else {
                ultBtn.title = `${rageLabel} ${Math.round(this.rage)}/${this.maxRage}`;
            }
            ultBtn.setAttribute('aria-label', ultBtn.title);
        }

        if (ProfileUI && typeof ProfileUI.isOpen === 'function' && ProfileUI.isOpen()) {
            ProfileUI.render();
        }

        GameProgress.requestSave();
    },

    // Hàm mới để tính tổng % tỉ lệ đột phá từ đan dược
    getSelectedUltimateMode() {
        if (this.isInsectUltimateActive()) return 'INSECT';
        return this.attackMode === 'INSECT' && this.hasKhuTrungThuatUnlocked() ? 'INSECT' : 'SWORD';
    },

    getUltimateDisplayName(mode = this.getSelectedUltimateMode()) {
        if (mode === 'INSECT') {
            return CONFIG.INSECT?.ULTIMATE?.NAME || 'Vạn Trùng Phệ Giới';
        }

        return 'Vạn Kiếm Quy Tông';
    },

    getUltimateResourceLabel() {
        return this.getSelectedUltimateMode() === 'INSECT' ? 'Nộ trùng' : 'Nộ kiếm';
    },

    isSwordUltimateActive() {
        return this.isUltMode && this.ultimateMode === 'SWORD';
    },

    isInsectUltimateActive() {
        return this.isUltMode && this.ultimateMode === 'INSECT';
    },

    clearInsectUltimateState() {
        this.insectUltimate.endsAt = 0;
        this.insectUltimate.activatedAt = 0;
        this.insectUltimate.lastHitAt = 0;
        this.insectUltimate.visuals = [];
        this.insectUltimate.focusTargets = [];
    },

    isUltimateBusy() {
        return this.isUltMode || this.ultimatePhase !== 'idle';
    },

    resetAttackState() {
        this.isAttacking = false;

        if (this.attackTimer) {
            clearTimeout(this.attackTimer);
            this.attackTimer = null;
        }

        if (this.singleSwordAttackTapTimeoutId) {
            clearTimeout(this.singleSwordAttackTapTimeoutId);
            this.singleSwordAttackTapTimeoutId = null;
        }
    },

    isSingleSwordUltimateReady() {
        return Boolean(this.singleSwordUltimateState?.active);
    },

    beginSingleSwordUltimateCharge() {
        if (!this.isSingleSwordUltimateReady()) return false;
        const state = this.singleSwordUltimateState;
        state.awaitingAttackInput = false;
        state.charging = true;
        state.chargeStartedAt = performance.now();
        state.chargeRatio = 0;
        state.lastParticleEmitAt = 0;
        this.isAttacking = false;
        return true;
    },

    updateSingleSwordUltimateChargeState(now = performance.now()) {
        const state = this.singleSwordUltimateState;
        if (!state || !state.active) {
            this.updateSingleSwordUltimateChargeUI(0, false, false);
            return;
        }

        if (state.charging) {
            const elapsed = Math.max(0, now - state.chargeStartedAt);
            state.chargeRatio = Math.max(0, Math.min(1, elapsed / Math.max(1, state.maxChargeMs || 1200)));
            this.emitSingleSwordUltimateChargeParticles(now, state.chargeRatio);
        }

        this.updateSingleSwordUltimateChargeUI(
            state.chargeRatio || 0,
            state.charging,
            state.active
        );
    },

    getSingleSwordUltimateChargeAnchor() {
        const aliveSword = Array.isArray(swords)
            ? swords.find(sword => sword && !sword.isDead)
            : null;
        const fallbackX = Number.isFinite(this.x) ? this.x : guardCenter.x;
        const fallbackY = Number.isFinite(this.y) ? this.y : guardCenter.y;
        return {
            x: Number.isFinite(aliveSword?.x) ? aliveSword.x : fallbackX,
            y: Number.isFinite(aliveSword?.y) ? aliveSword.y : fallbackY,
            r: Math.max(16, Number(aliveSword?.r) || 22)
        };
    },

    updateSingleSwordUltimateChargeUI(chargeRatio = 0, isCharging = false, isReady = false) {
        const attackBtn = document.getElementById('btn-attack');
        if (!attackBtn) return;
        const safeRatio = Math.max(0, Math.min(1, Number(chargeRatio) || 0));
        const uiCache = this.singleSwordUltimateState || {};
        const roundedRatio = Number(safeRatio.toFixed(2));
        const unchanged = uiCache.lastUiRatio === roundedRatio
            && uiCache.lastUiCharging === Boolean(isCharging)
            && uiCache.lastUiReady === Boolean(isReady);
        if (unchanged) return;

        uiCache.lastUiRatio = roundedRatio;
        uiCache.lastUiCharging = Boolean(isCharging);
        uiCache.lastUiReady = Boolean(isReady);
        attackBtn.style.setProperty('--single-ult-charge', `${safeRatio * 100}%`);
        attackBtn.style.setProperty('--single-ult-charge-ratio', safeRatio.toFixed(2));
        attackBtn.classList.toggle('is-single-ult-charging', Boolean(isCharging));
        attackBtn.classList.toggle('is-single-ult-ready', Boolean(isReady));
    },

    getSingleSwordUltimateGlowRatio() {
        const state = this.singleSwordUltimateState;
        if (!state?.active) return 0;
        if (state.charging) return Math.max(0.16, Math.min(1, Number(state.chargeRatio) || 0));
        return state.awaitingAttackInput ? 0.38 : 0.18;
    },

    emitSingleSwordUltimateChargeParticles(now = performance.now(), chargeRatio = 0) {
        const state = this.singleSwordUltimateState;
        if (!state?.active || !state.charging) return;

        const normalizedCharge = Math.max(0, Math.min(1, chargeRatio));
        const frameDeltaMs = Math.max(0, Number(this.lastFrameDeltaMs) || 16.7);
        const perfPressure = Math.max(0, Math.min(1, (frameDeltaMs - 16.7) / 18));
        const particleSoftCap = Math.round(220 * (1 - perfPressure * 0.35));
        if (visualParticles.length >= particleSoftCap) return;
        const emitIntervalMs = Math.max(
            26,
            (56 - (normalizedCharge * 26)) + (perfPressure * 34)
        );
        if ((now - (state.lastParticleEmitAt || 0)) < emitIntervalMs) return;
        state.lastParticleEmitAt = now;

        const anchor = this.getSingleSwordUltimateChargeAnchor();
        const centerX = anchor.x;
        const centerY = anchor.y;
        const pullRadius = 34 + (chargeRatio * 82);
        const spawnScale = 1 - (perfPressure * 0.75);
        const spawnCount = Math.max(1, Math.round((3 + (chargeRatio * 6)) * spawnScale));

        trimVisualParticles(Math.round(280 * (1 - perfPressure * 0.5)));
        for (let i = 0; i < spawnCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = random(pullRadius * 0.65, pullRadius);
            const spawnX = centerX + (Math.cos(angle) * radius);
            const spawnY = centerY + (Math.sin(angle) * radius);
            const toCenterX = centerX - spawnX;
            const toCenterY = centerY - spawnY;
            const dist = Math.max(1, Math.hypot(toCenterX, toCenterY));
            const pullSpeed = random(0.38, 0.88) + (chargeRatio * 0.55);

            visualParticles.push({
                type: 'spark',
                x: spawnX,
                y: spawnY,
                vx: (toCenterX / dist) * pullSpeed,
                vy: (toCenterY / dist) * pullSpeed,
                size: random(1.0, 1.9) * (0.8 + (chargeRatio * 0.45)),
                life: 0.32 + (chargeRatio * 0.14),
                decay: random(0.058, 0.082),
                color: i % 2 === 0 ? '#c8f6ff' : '#ffffff',
                glow: '#7ee7ff'
            });

            const rayChance = ((0.18 + (chargeRatio * 0.34)) * (1 - perfPressure * 0.8));
            if (perfPressure < 0.55 && Math.random() < rayChance) {
                const trailLen = random(6, 16) * (1 + (chargeRatio * 0.9));
                visualParticles.push({
                    type: 'ray',
                    x: spawnX,
                    y: spawnY,
                    angle: Math.atan2(toCenterY, toCenterX),
                    radius: 0,
                    length: trailLen,
                    lineWidth: random(1.2, 2.1),
                    life: 0.26 + (chargeRatio * 0.16),
                    decay: random(0.065, 0.1),
                    color: '#b8f8ff',
                    glow: '#7ee7ff'
                });
            }
        }
    },

    drawSingleSwordUltimateChargeIndicator(ctx, scaleFactor) {
        const state = this.singleSwordUltimateState;
        if (!state?.active) return;
        const anchor = this.getSingleSwordUltimateChargeAnchor();
        const ratio = Math.max(0, Math.min(1, Number(state.chargeRatio) || 0));
        const barWidth = Math.max(70, (anchor.r * 4.2) * scaleFactor);
        const barHeight = Math.max(5, 7 * scaleFactor);
        const barX = anchor.x - (barWidth / 2);
        const barY = anchor.y - ((anchor.r + 26) * scaleFactor);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(8, 18, 26, 0.62)';
        ctx.strokeStyle = 'rgba(175, 241, 255, 0.45)';
        ctx.lineWidth = Math.max(1, 1.2 * scaleFactor);
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        const innerWidth = Math.max(0, (barWidth - 2) * ratio);
        if (innerWidth > 0.5) {
            const grad = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
            grad.addColorStop(0, '#7aefff');
            grad.addColorStop(0.6, '#d8feff');
            grad.addColorStop(1, '#ffffff');
            ctx.fillStyle = grad;
            ctx.fillRect(barX + 1, barY + 1, innerWidth, Math.max(1, barHeight - 2));
        }

        const auraR = (anchor.r + 10 + (ratio * 16)) * scaleFactor;
        ctx.strokeStyle = `rgba(140, 240, 255, ${0.3 + (ratio * 0.42)})`;
        ctx.lineWidth = Math.max(1, (1.1 + (ratio * 1.2)) * scaleFactor);
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, auraR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    },

    releaseSingleSwordUltimateShot() {
        const state = this.singleSwordUltimateState;
        if (!state?.active) return false;
        if (state.awaitingAttackInput) return false;

        const startX = Number.isFinite(this.x) ? this.x : guardCenter.x;
        const startY = Number.isFinite(this.y) ? this.y : guardCenter.y;
        const livingEnemies = (Array.isArray(enemies) ? enemies : []).filter(enemy => enemy && enemy.hp > 0);
        const target = livingEnemies.reduce((closest, enemy) => {
            if (!closest) return enemy;
            const currentDist = Math.hypot((enemy.x || 0) - startX, (enemy.y || 0) - startY);
            const bestDist = Math.hypot((closest.x || 0) - startX, (closest.y || 0) - startY);
            return currentDist < bestDist ? enemy : closest;
        }, null);

        const chargeRatio = Math.max(0, Math.min(1, Number(state.chargeRatio) || 0));
        if (target) {
            this.singleSwordUltimateProjectiles.push({
                fromX: startX,
                fromY: startY,
                targetRef: target,
                x: startX,
                y: startY,
                startAt: performance.now(),
                travelMs: Math.round(260 - (chargeRatio * 80)),
                size: 1 + (chargeRatio * 1.15),
                slashLengthScale: 1 + (chargeRatio * 1.25),
                damageScale: 0.55 + (chargeRatio * 1.65),
                chargeRatio
            });
            showNotify(`Kiếm quang xuất khiếu (${Math.round(chargeRatio * 100)}%)!`, '#7ee7ff');
        } else {
            showNotify('Kiếm quang tản mác vì không có mục tiêu gần.', '#9beeff');
        }

        state.active = false;
        state.charging = false;
        state.activatedAt = 0;
        state.chargeStartedAt = 0;
        state.chargeRatio = 0;
        state.lastParticleEmitAt = 0;
        this.updateSingleSwordUltimateChargeUI(0, false, false);
        return true;
    },

    clearSingleSwordUltimateState() {
        const state = this.singleSwordUltimateState;
        state.active = false;
        state.charging = false;
        state.awaitingAttackInput = false;
        state.activatedAt = 0;
        state.chargeStartedAt = 0;
        state.chargeRatio = 0;
        state.lastParticleEmitAt = 0;
        this.updateSingleSwordUltimateChargeUI(0, false, false);
    },

    isSingleSwordTapAttackMode() {
        if (this.isInsectSwarmActive()) return false;

        const swordStats = this.getAliveSwordStats();
        return swordStats.alive === 1;
    },

    isUnarmedAttackMode() {
        if (this.isInsectSwarmActive()) return false;

        const swordStats = this.getAliveSwordStats();
        return swordStats.alive === 0;
    },

    isSingleSwordPreThanhLinhState() {
        if (this.isInsectSwarmActive()) return false;
        if (this.hasThanhLinhKiemQuyetUnlocked()) return false;

        const swordStats = this.getAliveSwordStats();
        return swordStats.alive === 1;
    },

    triggerSingleSwordTapAttack(windowMs = 320) {
        this.performSingleSwordTapStrike();
        this.isAttacking = true;
        if (this.singleSwordAttackTapTimeoutId) {
            clearTimeout(this.singleSwordAttackTapTimeoutId);
        }

        this.singleSwordAttackTapTimeoutId = setTimeout(() => {
            this.singleSwordAttackTapTimeoutId = null;
            this.isAttacking = false;
        }, Math.max(120, Number(windowMs) || 320));
    },

    triggerUnarmedTapAttack(windowMs = 260) {
        this.performUnarmedTapStrike();
        this.isAttacking = true;
        if (this.singleSwordAttackTapTimeoutId) {
            clearTimeout(this.singleSwordAttackTapTimeoutId);
        }

        this.singleSwordAttackTapTimeoutId = setTimeout(() => {
            this.singleSwordAttackTapTimeoutId = null;
            this.isAttacking = false;
        }, Math.max(100, Number(windowMs) || 260));
    },

    performSingleSwordTapStrike() {
        if (!Array.isArray(enemies) || !enemies.length) return false;
        if (!this.getAliveSwordStats || this.getAliveSwordStats().alive < 1) return false;
        const attackRange = 96 * scaleFactor;
        const sourceX = Number.isFinite(this.x) ? this.x : guardCenter.x;
        const sourceY = Number.isFinite(this.y) ? this.y : guardCenter.y;
        let nearestEnemy = null;
        let nearestDistance = Infinity;

        for (const enemy of enemies) {
            if (!enemy || enemy.hp <= 0) continue;
            const distance = Math.hypot((enemy.x || 0) - sourceX, (enemy.y || 0) - sourceY);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        }

        if (!nearestEnemy || nearestDistance > attackRange + (nearestEnemy.r || 0)) return false;

        const slashSource = {
            powerPenalty: 1,
            ignoreDodge: false,
            shieldBreakMultiplier: 1
        };
        const result = nearestEnemy.hit(slashSource);
        this.createAttackBurst(nearestEnemy.x, nearestEnemy.y, result === 'shielded' ? '#ffb26b' : '#9beeff');
        return result !== 'missed';
    },

    performUnarmedTapStrike() {
        if (!Array.isArray(enemies) || !enemies.length) return false;
        if (!this.getAliveSwordStats || this.getAliveSwordStats().alive > 0) return false;
        const attackRange = 82 * scaleFactor;
        const sourceX = Number.isFinite(this.x) ? this.x : guardCenter.x;
        const sourceY = Number.isFinite(this.y) ? this.y : guardCenter.y;
        let nearestEnemy = null;
        let nearestDistance = Infinity;

        for (const enemy of enemies) {
            if (!enemy || enemy.hp <= 0) continue;
            const distance = Math.hypot((enemy.x || 0) - sourceX, (enemy.y || 0) - sourceY);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        }

        if (!nearestEnemy || nearestDistance > attackRange + (nearestEnemy.r || 0)) return false;

        const punchSource = {
            powerPenalty: 0.5,
            ignoreDodge: false,
            shieldBreakMultiplier: 0.8
        };
        const result = nearestEnemy.hit(punchSource);
        this.createAttackBurst(nearestEnemy.x, nearestEnemy.y, result === 'shielded' ? '#ffb26b' : '#ffd8a8');
        return result !== 'missed';
    },

    getMaxRankIndex() {
        return Math.max(0, CONFIG.CULTIVATION.RANKS.length - 1);
    },

    reformSwordFormationState({ rebuildAll = false } = {}) {
        if (typeof syncSwordFormation !== 'function' || typeof swords === 'undefined' || !Array.isArray(swords)) {
            return false;
        }

        syncSwordFormation({ rebuildAll });

        const anchorX = typeof guardCenter !== 'undefined' ? guardCenter.x : this.x;
        const anchorY = typeof guardCenter !== 'undefined' ? guardCenter.y : this.y;
        const activeStates = this.getActiveSwordArtifactStates({
            mode: this.attackMode === 'SWORD' ? 'SWORD' : 'BASE'
        });

        swords.forEach((sword, index) => {
            if (!sword) return;

            sword.index = index;
            sword.layer = Math.floor(index / 24);
            if (typeof sword.bindArtifactState === 'function') {
                sword.bindArtifactState(activeStates[index] || null);
            }
            sword.maxHp = Math.max(1, sword.getArtifactDurabilityValue ? sword.getArtifactDurabilityValue() : (sword.maxHp || 1));
            sword.hp = sword.maxHp;
            sword.isDead = false;
            sword.fragments = [];
            sword.x = anchorX;
            sword.y = anchorY;
            sword.vx = 0;
            sword.vy = 0;
            sword.drawAngle = 0;
            sword.trail = [];
            sword.attackFrame = 0;
            sword.pierceCount = 0;
            sword.isReturning = false;
            sword.isStunned = false;
            sword.stunTimer = 0;
            sword.isEnlarged = false;
            sword.currentVisualScale = 1;
            sword.targetVisualScale = 1;
            sword.lastUltimateHitAt = 0;
        });

        if (typeof updateSwordCounter === 'function') {
            updateSwordCounter(swords);
        }

        return true;
    },

    setSpecialAura(mode, durationMs = null) {
        this.specialAuraMode = mode || null;
        if (!mode) {
            this.specialAuraExpiresAt = 0;
            return;
        }

        this.specialAuraExpiresAt = durationMs == null
            ? Number.POSITIVE_INFINITY
            : performance.now() + Math.max(0, durationMs);
    },

    clearSpecialPillState({ keepAura = false } = {}) {
        if (this.voidCollapseTimeoutId) {
            clearTimeout(this.voidCollapseTimeoutId);
            this.voidCollapseTimeoutId = null;
        }

        this.temporaryAscensionOrigin = null;
        this.isVoidCollapsed = false;

        if (!keepAura) {
            this.setSpecialAura(null);
        }
    },

    ascendToUltimateRank() {
        const maxRankIndex = this.getMaxRankIndex();
        const maxRank = CONFIG.CULTIVATION.RANKS[maxRankIndex];
        if (!maxRank) return null;

        this.resetAttackState();
        this.rankIndex = maxRankIndex;
        this.exp = maxRank.exp;
        this.isReadyToBreak = false;
        this.breakthroughBonus = 0;
        this.syncDerivedStats();
        this.mana = this.maxMana;
        this.reformSwordFormationState({ rebuildAll: true });
        this.renderManaUI();
        this.renderExpUI();
        return maxRank;
    },

    applyChungCucDaoNguyenDan(item, qualityConfig) {
        this.clearSpecialPillState();
        const maxRank = this.ascendToUltimateRank();
        if (!maxRank) return false;

        this.setSpecialAura(qualityConfig.auraMode || 'rainbow');
        showNotify(`Dùng ${this.getItemDisplayName(item)}: trực tiếp bước vào ${maxRank.name}`, qualityConfig.color);
        return true;
    },

    enterVoidCollapse() {
        if (this.voidCollapseTimeoutId) {
            clearTimeout(this.voidCollapseTimeoutId);
            this.voidCollapseTimeoutId = null;
        }

        if (this.ultTimeoutId) {
            clearTimeout(this.ultTimeoutId);
            this.ultTimeoutId = null;
        }

        const origin = this.temporaryAscensionOrigin;
        if (origin) {
            this.rankIndex = origin.rankIndex;
            this.exp = origin.exp;
            this.isReadyToBreak = origin.isReadyToBreak;
            this.breakthroughBonus = origin.breakthroughBonus;
        }

        this.temporaryAscensionOrigin = null;
        this.isVoidCollapsed = true;
        this.resetAttackState();
        this.stopMoveJoystick();
        this.activeEffects = [];
        this.isUltMode = false;
        this.ultimatePhase = 'idle';
        this.ultimatePhaseStartedAt = 0;
        this.ultimateCoreIndex = -1;
        this.ultimateMode = null;
        this.clearInsectUltimateState();
        this.rage = 0;
        this.mana = 0;
        this.setSpecialAura('void');
        this.syncDerivedStats();
        this.refreshResourceUI();
        this.renderManaUI();
        this.renderRageUI();
        showNotify('Tẫn Đạo Diệt Nguyên Đan phản phệ: thân thể tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');

        this.isGameOver = true;
        if (typeof window !== 'undefined' && typeof window.__onPlayerGameOver === 'function') {
            window.__onPlayerGameOver('Tẫn Đạo Diệt Nguyên Đan phản phệ');
        }
    },

    applyTanDaoDietNguyenDan(item, qualityConfig) {
        this.clearSpecialPillState();
        this.temporaryAscensionOrigin = {
            rankIndex: this.rankIndex,
            exp: this.exp,
            isReadyToBreak: this.isReadyToBreak,
            breakthroughBonus: this.breakthroughBonus
        };

        const maxRank = this.ascendToUltimateRank();
        if (!maxRank) return false;

        this.setSpecialAura(qualityConfig.auraMode || 'void', qualityConfig.durationMs || 1000);
        showNotify(`Dùng ${this.getItemDisplayName(item)}: cưỡng mở ${maxRank.name} trong ${Math.max(1, Math.round((qualityConfig.durationMs || 1000) / 1000))} giây`, qualityConfig.color);

        this.voidCollapseTimeoutId = setTimeout(() => {
            this.enterVoidCollapse();
        }, qualityConfig.durationMs || 1000);

        return true;
    },

    getUltimateTransitionDuration() {
        return Math.max(100, parseInt(CONFIG.ULTIMATE.TRANSITION_MS, 10) || 100);
    },

    getUltimateTransitionProgress() {
        if (this.ultimatePhase !== 'merging' && this.ultimatePhase !== 'splitting') {
            return this.isUltMode ? 1 : 0;
        }

        const elapsed = performance.now() - this.ultimatePhaseStartedAt;
        return Math.max(0, Math.min(1, elapsed / this.getUltimateTransitionDuration()));
    },

    getUltimateTransitionEase() {
        const t = this.getUltimateTransitionProgress();
        return (t < 0.5)
            ? 2 * t * t
            : 1 - Math.pow(-2 * t + 2, 2) / 2;
    },

    startUltimate() {
        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, hãy tải lại giới vực để hồi phục', '#a778ff');
            return false;
        }

        if (this.isUltimateBusy() || this.rage < this.maxRage) return false;

        this.clearSingleSwordUltimateState();

        if (this.attackMode === 'INSECT' && this.canUseInsectAttackMode()) {
            return this.startInsectUltimate();
        }

        if (this.isSingleSwordPreThanhLinhState()) {
            return this.castSingleSwordUltimate();
        }

        if (this.ultTimeoutId) {
            clearTimeout(this.ultTimeoutId);
            this.ultTimeoutId = null;
        }

        this.resetAttackState();
        this.clearInsectUltimateState();

        const coreIndex = swords.findIndex(sword => !sword.isDead);
        if (coreIndex === -1) return false;

        this.ultimateCoreIndex = coreIndex;
        this.ultimatePhase = 'merging';
        this.ultimatePhaseStartedAt = performance.now();
        this.ultimateMode = 'SWORD';
        this.isUltMode = false;
        this.rage = 0;

        swords.forEach(sword => {
            if (!sword.isDead) {
                sword.isStunned = false;
                sword.stunTimer = 0;
                sword.trail = [];
                sword.attackFrame = 0;
            }
        });

        showNotify("VẠN KIẾM QUY TÔNG!", "#00ffff");
        this.renderRageUI();
        return true;
    },

    castSingleSwordUltimate() {
        const state = this.singleSwordUltimateState;
        state.active = true;
        state.charging = false;
        state.awaitingAttackInput = true;
        state.activatedAt = performance.now();
        state.chargeStartedAt = 0;
        state.chargeRatio = 0;
        state.lastParticleEmitAt = 0;

        this.rage = 0;
        this.renderRageUI();
        this.updateSingleSwordUltimateChargeUI(0, false, true);
        showNotify('Nhất Kiếm Tuyệt Ảnh: giữ nút công kích để tụ lực kiếm quang!', '#7ee7ff');
        return true;
    },

    drawSingleSwordUltimateProjectiles(ctx, scaleFactor) {
        const state = this.singleSwordUltimateState;
        if (!Array.isArray(this.singleSwordUltimateProjectiles) || !this.singleSwordUltimateProjectiles.length) return;
        const now = performance.now();
        const alive = [];

        this.singleSwordUltimateProjectiles.forEach(projectile => {
            const target = projectile.targetRef;
            const duration = Math.max(80, projectile.travelMs || 240);
            const progress = Math.min(1, (now - projectile.startAt) / duration);
            const targetX = Number.isFinite(target?.x) ? target.x : projectile.x;
            const targetY = Number.isFinite(target?.y) ? target.y : projectile.y;
            projectile.x = projectile.fromX + ((targetX - projectile.fromX) * progress);
            projectile.y = projectile.fromY + ((targetY - projectile.fromY) * progress);

            const heading = Math.atan2(targetY - projectile.fromY, targetX - projectile.fromX);
            const slashLengthScale = Math.max(1, Number(projectile.slashLengthScale) || 1);
            const arcRadius = (28 + (Math.sin(now * 0.024) * 4)) * scaleFactor * (projectile.size || 1) * slashLengthScale;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(projectile.x, projectile.y);
            ctx.rotate(heading);
            ctx.lineWidth = 4 * scaleFactor;
            ctx.strokeStyle = 'rgba(194, 248, 255, 0.95)';
            ctx.shadowBlur = 16 * scaleFactor;
            ctx.shadowColor = '#89eeff';
            ctx.beginPath();
            ctx.arc(-arcRadius * 0.15, 0, arcRadius, -0.75, 0.75);
            ctx.stroke();

            ctx.lineWidth = 2 * scaleFactor;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.beginPath();
            ctx.arc(-arcRadius * 0.24, 0, arcRadius * 0.74, -0.7, 0.7);
            ctx.stroke();
            ctx.restore();

            if (progress >= 1) {
                this.createAttackBurst(targetX, targetY, '#9beeff');
                if (target && target.hp > 0) {
                    target.hit({
                        powerPenalty: Math.max(0.3, projectile.damageScale || 0.4),
                        ignoreDodge: true,
                        shieldBreakMultiplier: 1.35 + ((projectile.chargeRatio || 0) * 0.9)
                    });
                }
                return;
            }

            alive.push(projectile);
        });

        this.singleSwordUltimateProjectiles = alive;
    },

    startInsectUltimate() {
        const cfg = CONFIG.INSECT?.ULTIMATE || {};
        const durationMs = Math.max(1200, Number(cfg.DURATION_MS) || 9000);
        const combatSpeciesKeys = this.getCombatReadyInsectSpeciesKeys();

        if (!combatSpeciesKeys.length) {
            showNotify('Chưa có kỳ trùng xuất chiến để thi triển tuyệt kỹ.', '#ffb26b');
            return false;
        }

        if (this.ultTimeoutId) {
            clearTimeout(this.ultTimeoutId);
            this.ultTimeoutId = null;
        }

        this.resetAttackState();
        this.clearSingleSwordUltimateState();
        this.insectCombat.visuals = [];
        this.insectCombat.focusTargets = [];
        this.ultimatePhase = 'idle';
        this.ultimatePhaseStartedAt = 0;
        this.ultimateCoreIndex = -1;
        this.ultimateMode = 'INSECT';
        this.isUltMode = true;
        this.rage = 0;
        this.clearInsectUltimateState();
        this.insectUltimate.activatedAt = performance.now();
        this.insectUltimate.endsAt = this.insectUltimate.activatedAt + durationMs;
        this.createInsectUltimateBurst?.(this.x, this.y, cfg.NOTIFY_COLOR || '#ff7bc3');

        this.ultTimeoutId = setTimeout(() => {
            this.endInsectUltimate();
        }, durationMs);

        showNotify(`${this.getUltimateDisplayName('INSECT')}!`, cfg.NOTIFY_COLOR || '#ff7bc3');
        this.renderRageUI();
        return true;
    },

    endInsectUltimate() {
        if (!this.isInsectUltimateActive()) {
            this.clearInsectUltimateState();
            return;
        }

        if (this.ultTimeoutId) {
            clearTimeout(this.ultTimeoutId);
            this.ultTimeoutId = null;
        }

        this.isUltMode = false;
        this.ultimateMode = null;
        this.ultimatePhase = 'idle';
        this.ultimatePhaseStartedAt = 0;
        this.ultimateCoreIndex = -1;
        this.clearInsectUltimateState();
        this.ensureValidAttackMode();
        this.renderRageUI();
    },

    startUltimateSplit() {
        if (this.ultTimeoutId) {
            clearTimeout(this.ultTimeoutId);
            this.ultTimeoutId = null;
        }

        this.resetAttackState();
        this.clearSingleSwordUltimateState();
        this.isUltMode = false;
        this.ultimatePhase = 'splitting';
        this.ultimatePhaseStartedAt = performance.now();
        this.renderRageUI();
    },

    updateUltimateState() {
        if (this.isInsectUltimateActive()) {
            if (!this.canUseInsectAttackMode() || performance.now() >= (this.insectUltimate?.endsAt || 0)) {
                this.endInsectUltimate();
            }
            return;
        }

        if (this.ultimatePhase !== 'merging' && this.ultimatePhase !== 'splitting') return;
        if (this.getUltimateTransitionProgress() < 1) return;

        if (this.ultimatePhase === 'merging') {
            this.ultimatePhase = 'active';
            this.ultimatePhaseStartedAt = performance.now();
            this.isUltMode = true;
            this.ultimateMode = 'SWORD';
            this.renderRageUI();

            this.ultTimeoutId = setTimeout(() => {
                this.startUltimateSplit();
            }, CONFIG.ULTIMATE.DURATION_MS || 10000);
            return;
        }

        this.ultimatePhase = 'idle';
        this.ultimatePhaseStartedAt = 0;
        this.ultimateCoreIndex = -1;
        this.ultimateMode = null;
        this.resetAttackState();
        this.clearSingleSwordUltimateState();
        this.renderRageUI();
    },

    calculateTotalPillBoost() {
        const cfg = CONFIG.PILL.TYPES;
        // Tính tổng: (Số lượng x % cộng thêm) của từng loại
        const boost = (this.pills.LOW * cfg.LOW.boost) +
            (this.pills.MEDIUM * cfg.MEDIUM.boost) +
            (this.pills.HIGH * cfg.HIGH.boost);
        return boost;
    },

    processActiveConsumption(dt) {
        // dt là thời gian trôi qua tính bằng giây (seconds)

        let costTick = 0;
        const isBlinkTransiting = this.isPhongLoiBlinkTransiting();
        const hasUsableSword = typeof this.getUsableEquippedSwordArtifacts === 'function'
            ? this.getUsableEquippedSwordArtifacts().length > 0
            : (typeof this.getAliveSwordStats === 'function' && this.getAliveSwordStats().alive > 0);

        // 1. Tính toán chi phí di chuyển
        // Nếu tốc độ > 1 (tránh nhiễu khi chuột rung nhẹ)
        if (hasUsableSword && !isBlinkTransiting && this.speed > 1) {
            costTick += CONFIG.MANA.COST_MOVE_PER_SEC * dt;
        }

        // 2. Tính toán chi phí tấn công
        if (this.isAttacking) {
            costTick += CONFIG.MANA.COST_ATTACK_PER_SEC * dt;
        }

        // 3. THỰC HIỆN TRỪ MANA
        if (costTick > 0) {
            if (this.mana > 0) {
                // Trừ mana (dùng số thực để mượt, nhưng UI sẽ làm tròn)
                this.updateMana(-costTick);
            } else {
                // HẾT MANA:
                // Ngắt trạng thái tấn công ngay lập tức
                if (this.isAttacking) {
                    this.resetAttackState();
                    this.triggerManaShake();
                }

                // (Tùy chọn) Ngắt di chuyển? 
                // Thường game sẽ cho di chuyển chậm lại hoặc không cho dash, 
                // nhưng ở đây ta chỉ cần báo hiệu hết mana.
            }
        }
    },

    updateMana(amount) {
        const currentRank = this.getCurrentRank?.();
        if (currentRank?.infiniteStats || this.rankIndex >= this.getMaxRankIndex()) {
            this.maxMana = Number.POSITIVE_INFINITY;
            this.mana = Number.POSITIVE_INFINITY;
            this.renderManaUI();
            return;
        }
        this.mana = Math.max(0, Math.min(this.maxMana, this.mana + amount));
        this.renderManaUI();
    },

    regenMana() {
        if (this.isVoidCollapsed) return;

        const now = performance.now();
        const elapsed = now - this.lastManaRegenTick;

        if (elapsed >= CONFIG.MANA.REGEN_INTERVAL_MS) {
            // Tính toán số mana hồi dựa trên giây (hoặc chu kỳ MS)
            const ticks = Math.floor(elapsed / CONFIG.MANA.REGEN_INTERVAL_MS);

            if (ticks > 0) {
                // Sử dụng REGEN_PER_SEC thay vì REGEN_PER_MIN
                this.updateMana(ticks * CONFIG.MANA.REGEN_PER_SEC * this.getManaRegenMultiplier());
                this.lastManaRegenTick = now - (elapsed % CONFIG.MANA.REGEN_INTERVAL_MS);
            }
        }
    },

    renderManaUI() {
        const bar = document.getElementById('mana-bar');
        const text = document.getElementById('mana-text');
        if (bar && text) {
            const percentage = getSafeProgressPercent(this.mana, this.maxMana);
            bar.style.width = percentage + '%';
            text.innerText = `Linh lực: ${formatNumber(this.mana)}/${formatNumber(this.maxMana)}`;

            // Logic đổi màu khi mana thấp (đã khai báo trong SCSS)
            if (Number.isFinite(percentage) && percentage < 20) {
                bar.classList.add('low-mana');
            } else {
                bar.classList.remove('low-mana');
            }
        }

        if (ProfileUI && typeof ProfileUI.isOpen === 'function' && ProfileUI.isOpen()) {
            ProfileUI.render();
        }

        GameProgress.requestSave();
    },

    syncVitalStats() {
        const rank = this.getCurrentRank();
        if (rank?.infiniteStats) {
            this.maxHp = Number.POSITIVE_INFINITY;
            this.hp = Number.POSITIVE_INFINITY;
            this.renderHealthUI();
            return;
        }
        const nextMaxHp = Math.max(1, Math.round(rank?.hp || 100));
        const prevMaxHp = this.maxHp;
        this.maxHp = nextMaxHp;
        if (!Number.isFinite(this.hp) || this.hp <= 0) {
            this.hp = this.maxHp;
        } else if (this.hp > this.maxHp || prevMaxHp !== this.maxHp) {
            this.hp = Math.min(this.hp, this.maxHp);
        }
        this.renderHealthUI();
    },

    renderHealthUI() {
        const bar = document.getElementById('health-bar');
        const text = document.getElementById('health-text');
        if (bar && text) {
            const percentage = getSafeProgressPercent(this.hp, this.maxHp);
            bar.style.width = `${percentage}%`;
            text.innerText = `Sinh lực: ${formatNumber(this.hp)}/${formatNumber(this.maxHp)}`;
        }
    },

    renderNegativeStatusUI() {
        const wrap = document.getElementById('negative-status-list');
        if (!wrap) return;
        const statusCfg = this.getNegativeStatusConfig();
        const now = performance.now();
        const active = Object.entries(this.negativeStatuses || {}).filter(([key, state]) => {
            return state && state.stacks > 0 && now < (state.until || 0) && statusCfg[key];
        });

        if (!active.length) {
            wrap.innerHTML = '<span class="status-chip is-empty">Trạng thái: ổn định</span>';
            return;
        }

        wrap.innerHTML = active.map(([key, state]) => {
            const cfg = statusCfg[key];
            const remain = Math.max(0, (state.until - now) / 1000);
            return `<span class="status-chip" style="--status-color:${cfg.color}" title="${cfg.description}">${cfg.label} x${state.stacks} (${remain.toFixed(1)}s)</span>`;
        }).join('');
    },

    updateHealth(amount, source = '') {
        if (this.isVoidCollapsed || this.isGameOver) return;
        const currentRank = this.getCurrentRank?.();
        if (currentRank?.infiniteStats || this.rankIndex >= this.getMaxRankIndex()) {
            this.maxHp = Number.POSITIVE_INFINITY;
            this.hp = Number.POSITIVE_INFINITY;
            this.renderHealthUI();
            return;
        }
        this.hp = Math.max(0, Math.min(this.maxHp, this.hp + amount));
        this.renderHealthUI();
        if (this.hp <= 0) {
            this.hp = 0;
            this.isGameOver = true;
            this.resetAttackState();
            this.clearSingleSwordUltimateState?.();
            this.clearNegativeStatuses();
            this.renderHealthUI();
            if (typeof window !== 'undefined' && typeof window.__onPlayerGameOver === 'function') {
                window.__onPlayerGameOver(source || 'tà lực');
            }
            this.renderNegativeStatusUI();
        }
    },

    clearNegativeStatuses() {
        const now = performance.now();
        Object.keys(this.negativeStatuses || {}).forEach(key => {
            this.negativeStatuses[key] = { stacks: 0, until: now };
        });
    },

    cleanseNegativeStatusStacks(stackBudget = 1) {
        let remaining = Math.max(0, Math.floor(stackBudget || 0));
        if (remaining <= 0) return 0;
        let removed = 0;
        const order = ['bleeding', 'poison', 'qiBurn', 'brokenBone', 'blind'];

        order.forEach(key => {
            if (remaining <= 0) return;
            const state = this.negativeStatuses?.[key];
            if (!state || state.stacks <= 0) return;
            const reduce = Math.min(state.stacks, remaining);
            state.stacks -= reduce;
            if (state.stacks <= 0) state.until = performance.now();
            remaining -= reduce;
            removed += reduce;
        });

        this.renderNegativeStatusUI();
        return removed;
    },

    consumePurificationPill(item, qualityConfig) {
        const manaRestore = qualityConfig.manaRestore || 0;
        const quality = String(item?.quality || '').toUpperCase();
        const cleanseByQuality = {
            LOW: 1,
            MEDIUM: 2,
            HIGH: 4,
            SUPREME: 99
        };

        this.updateMana(manaRestore);
        const removed = quality === 'SUPREME'
            ? (this.clearNegativeStatuses(), 99)
            : this.cleanseNegativeStatusStacks(cleanseByQuality[quality] || 1);

        showNotify(
            `Dùng ${this.getItemDisplayName(item)}: hồi ${Math.round(manaRestore)} linh lực${removed > 0 ? `, tịnh hóa ${removed >= 99 ? 'toàn bộ' : removed} trạng thái xấu` : ''}`,
            qualityConfig.color
        );
    },

    consumeRegenPill(item, qualityConfig) {
        this.bonusStats.manaRegenPct += qualityConfig.manaRegenPct || 0;
        const quality = String(item?.quality || '').toUpperCase();
        const buffScaleByQuality = { LOW: 0.04, MEDIUM: 0.07, HIGH: 0.1, SUPREME: 0.14 };
        const durationByQuality = { LOW: 6500, MEDIUM: 9000, HIGH: 12000, SUPREME: 15000 };
        const cleanseByQuality = { LOW: 0, MEDIUM: 1, HIGH: 2, SUPREME: 4 };
        const buffScale = buffScaleByQuality[quality] || 0.05;

        this.activeEffects.push({
            key: `REGEN_AEGIS_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            group: 'REGEN_AEGIS',
            name: 'Thanh Tâm Hộ Thể',
            expiresAt: performance.now() + (durationByQuality[quality] || 7000),
            attackPct: buffScale * 0.55,
            speedPct: buffScale,
            maxManaFlat: 0,
            auraMode: 'calm',
            endColor: qualityConfig.color
        });

        const removed = this.cleanseNegativeStatusStacks(cleanseByQuality[quality] || 0);
        showNotify(
            `Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.manaRegenPct || 0) * 100)}% hồi linh, nhận Thanh Tâm Hộ Thể${removed > 0 ? `, xóa ${removed} trạng thái xấu` : ''}`,
            qualityConfig.color
        );
        this.syncDerivedStats();
    },

    getNegativeStatusConfig() {
        return {
            bleeding: { label: 'Xuất huyết', color: '#ff4d57', description: 'Mất máu theo thời gian', chance: 0.2, durationMs: 7800, maxStacks: 4 },
            brokenBone: { label: 'Gãy xương', color: '#ff9f5d', description: 'Thân pháp bị chậm mạnh', chance: 0.16, durationMs: 6500, maxStacks: 3 },
            blind: { label: 'Mù', color: '#4fb4ff', description: 'Đòn đánh dễ trượt hơn', chance: 0.14, durationMs: 5200, maxStacks: 3 },
            poison: { label: 'Kịch độc', color: '#53d676', description: 'Ăn mòn máu và linh lực', chance: 0.12, durationMs: 7200, maxStacks: 4 },
            qiBurn: { label: 'Nhiễu linh', color: '#58e0ff', description: 'Thiêu đốt linh lực', chance: 0.1, durationMs: 6000, maxStacks: 3 }
        };
    },

    tryApplyRandomNegativeStatus(baseChance = 0.2) {
        const cfg = this.getNegativeStatusConfig();
        const keys = Object.keys(cfg);
        if (!keys.length || Math.random() > baseChance) return false;
        const totalWeight = keys.reduce((acc, key) => acc + Math.max(0.01, cfg[key].chance || 0.1), 0);
        let cursor = Math.random() * totalWeight;
        let chosen = keys[0];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            cursor -= Math.max(0.01, cfg[key].chance || 0.1);
            if (cursor <= 0) {
                chosen = key;
                break;
            }
        }

        const state = this.negativeStatuses[chosen] || { stacks: 0, until: 0 };
        const status = cfg[chosen];
        state.stacks = Math.min(status.maxStacks || 3, (state.stacks || 0) + 1);
        state.until = performance.now() + (status.durationMs || 5000);
        this.negativeStatuses[chosen] = state;
        this.renderNegativeStatusUI();
        return true;
    },

    updateNegativeStatuses(dt) {
        const now = performance.now();
        if (now - (this.lastAilmentTickAt || 0) < 180) return;
        this.lastAilmentTickAt = now;
        const elapsed = Math.max(0.08, dt || 0.1);
        const status = this.negativeStatuses || {};

        const bleedingStacks = (status.bleeding?.until > now) ? (status.bleeding.stacks || 0) : 0;
        const poisonStacks = (status.poison?.until > now) ? (status.poison.stacks || 0) : 0;
        const qiBurnStacks = (status.qiBurn?.until > now) ? (status.qiBurn.stacks || 0) : 0;

        if (bleedingStacks > 0) {
            this.updateHealth(-(this.maxHp * 0.0024 * bleedingStacks * elapsed), 'xuất huyết');
        }
        if (poisonStacks > 0) {
            this.updateHealth(-(this.maxHp * 0.0018 * poisonStacks * elapsed), 'kịch độc');
            this.updateMana(-(this.maxMana * 0.001 * poisonStacks * elapsed));
        }
        if (qiBurnStacks > 0) {
            this.updateMana(-(this.maxMana * 0.0023 * qiBurnStacks * elapsed));
        }

        Object.keys(status).forEach(key => {
            if ((status[key]?.until || 0) <= now && (status[key]?.stacks || 0) > 0) {
                status[key].stacks = 0;
            }
        });
        this.renderNegativeStatusUI();
    },

    getBlindMissChance() {
        const state = this.negativeStatuses?.blind;
        if (!state || state.stacks <= 0 || performance.now() >= (state.until || 0)) return 0;
        return Math.min(0.75, 0.2 * state.stacks);
    },

    ensureEnemyHostileProjectiles() {
        if (!Array.isArray(this.enemyHostileProjectiles)) {
            this.enemyHostileProjectiles = [];
        }
        return this.enemyHostileProjectiles;
    },

    ensureEnemyMeleeStrikes() {
        if (!Array.isArray(this.enemyMeleeStrikes)) {
            this.enemyMeleeStrikes = [];
        }
        return this.enemyMeleeStrikes;
    },

    getCursorCoreHitRadius() {
        const cursorConfig = CONFIG.CURSOR || {};
        return Math.max(3, (cursorConfig.BASE_DOT_RADIUS || 3.2) + 1.1);
    },

    getEnemyAttackPattern(enemy) {
        if (enemy?.attackPattern) return enemy.attackPattern;
        const patterns = ['CHARGE', 'BITE', 'CLAW', 'ORB', 'BEAM', 'ARC_MISSILE', 'SPIKE_RING'];
        const rankId = Number(enemy?.rankData?.id) || 1;
        enemy.attackPattern = patterns[(rankId + Math.floor((enemy?.floatOffset || 0) * 0.01)) % patterns.length];
        return enemy.attackPattern;
    },

    inflictEnemyAttackDamage(amount, ailmentChance = 0.2, source = 'đòn đánh của yêu thú') {
        const safeDamage = Math.max(0, Number(amount) || 0);
        if (safeDamage <= 0) return;

        const nguCucShieldResult = typeof this.absorbDamageWithNguCucSonComposite === 'function'
            ? this.absorbDamageWithNguCucSonComposite(safeDamage)
            : null;
        const afterNguCucDamage = nguCucShieldResult ? Math.max(0, nguCucShieldResult.remainingDamage) : safeDamage;
        if (nguCucShieldResult) {
            const artifactColor = this.getArtifactConfig('NGUYEN_HOP_NGU_CUC_SON')?.color || '#ffd76a';
            if (nguCucShieldResult.absorbed > 0) {
                showNotify(`Nguyên Hợp Ngũ Cực Sơn hấp thụ ${formatNumber(Math.round(nguCucShieldResult.absorbed))} sát thương.`, artifactColor, 1100);
            }
            if (nguCucShieldResult.depleted) {
                showNotify('Ngũ sắc sơn ảnh đã nứt vỡ, tạm thời không thể hấp thụ thêm sát thương.', '#ffd2a1', 1300);
            }
        }

        const shieldResult = this.absorbDamageWithHuThienDinh(afterNguCucDamage);
        const finalDamage = shieldResult ? Math.max(0, shieldResult.remainingDamage) : afterNguCucDamage;
        if (shieldResult) {
            const artifactColor = this.getArtifactConfig('HU_THIEN_DINH')?.color || '#93c8d8';
            if (shieldResult.absorbed > 0) {
                showNotify(`Hư Thiên Đỉnh hấp thụ ${formatNumber(Math.round(shieldResult.absorbed))} sát thương.`, artifactColor, 1100);
            }
            if (shieldResult.depleted) {
                showNotify('Đỉnh ảnh đã vỡ, tạm thời không thể hấp thụ thêm sát thương.', '#ffd2a1', 1300);
            }
        }
        if (finalDamage <= 0) return;

        this.lastEnemyDamageAt = performance.now();
        this.updateHealth(-finalDamage, source);
        this.tryApplyRandomNegativeStatus(ailmentChance);

        const burstCount = 6;
        for (let i = 0; i < burstCount; i++) {
            const angle = (Math.PI * 2 * i) / burstCount + random(-0.2, 0.2);
            const speed = random(1.2, 3.2);
            visualParticles.push({
                type: 'spark',
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: random(1.4, 2.6),
                life: 0.52,
                decay: random(0.045, 0.07),
                color: '#ff8e8e',
                glow: 8
            });
        }
    },

    queueEnemyMeleeStrike(enemy, pattern, centerX, centerY, options = {}) {
        if (!enemy) return;
        const strikes = this.ensureEnemyMeleeStrikes();
        const maxMeleeStrikes = Math.max(20, Number(CONFIG.ENEMY?.MAX_MELEE_STRIKES) || 0);
        if (strikes.length >= maxMeleeStrikes) {
            strikes.shift();
        }
        const fromX = Number(enemy.x) || centerX;
        const fromY = Number(enemy.y) || centerY;
        const toX = centerX;
        const toY = centerY;
        strikes.push({
            type: pattern,
            enemyRef: enemy,
            startedAt: performance.now(),
            durationMs: Math.max(120, Number(options.durationMs) || (pattern === 'CHARGE' ? 220 : 180)),
            fromX,
            fromY,
            toX,
            toY,
            x: fromX,
            y: fromY,
            damage: Math.max(1, Number(options.damage) || 1),
            ailmentChance: Math.max(0, Number(options.ailmentChance) || 0.2),
            source: options.source || 'cận chiến yêu thú',
            hasDamaged: false,
            canMultiTickDamage: pattern === 'BITE',
            damageTickEveryMs: Math.max(180, Number(options.damageTickEveryMs) || 420),
            nextDamageTickAt: 0,
            latchUntil: 0,
            latchDurationMs: Math.max(600, Number(options.latchDurationMs) || 1800),
            latchOffsetX: random(-4, 4),
            latchOffsetY: random(-4, 4)
        });
    },

});

Object.assign(Input, {
    updateEnemyMeleeStrikes(centerX, centerY) {
        const strikes = this.ensureEnemyMeleeStrikes();
        if (!strikes.length) return;
        const now = performance.now();
        const coreRadius = this.getCursorCoreHitRadius();
        let writeIndex = 0;

        for (let i = 0; i < strikes.length; i++) {
            const strike = strikes[i];
            if (strike.type === 'BITE' && strike.latchUntil <= now) {
                strike.toX = centerX;
                strike.toY = centerY;
            }
            const progress = clampNumber((now - strike.startedAt) / Math.max(1, strike.durationMs), 0, 1);
            const jumpArc = strike.type === 'BITE' ? (Math.sin(progress * Math.PI) * 34) : 0;
            const dx = strike.toX - strike.fromX;
            const dy = strike.toY - strike.fromY;
            const dist = Math.max(1, Math.hypot(dx, dy));
            const nx = dx / dist;
            const ny = dy / dist;

            const biteReleaseDistance = Math.max(coreRadius * 1.6, 42);
            if (strike.type === 'BITE' && strike.latchUntil > now) {
                const leashDistance = Math.hypot((centerX || 0) - strike.fromX, (centerY || 0) - strike.fromY);
                if (leashDistance > biteReleaseDistance) {
                    strike.latchUntil = now;
                }
            }

            if (strike.type === 'BITE' && strike.latchUntil > now) {
                strike.x = centerX + strike.latchOffsetX;
                strike.y = centerY + strike.latchOffsetY;
            } else {
                strike.x = strike.fromX + (dx * progress) - (ny * jumpArc);
                strike.y = strike.fromY + (dy * progress) + (nx * jumpArc);
            }

            if (strike.enemyRef?.hp > 0) {
                strike.enemyRef.x = strike.x;
                strike.enemyRef.y = strike.y;
            }

            if (!strike.hasDamaged) {
                const touchDistance = Math.hypot((centerX || 0) - strike.x, (centerY || 0) - strike.y);
                if (touchDistance <= coreRadius) {
                    const blocked = typeof this.tryBlockWithNguCucSon === 'function'
                        ? this.tryBlockWithNguCucSon(strike.x, strike.y, coreRadius * 0.36, strike.source || 'cận chiến')
                        : false;
                    if (blocked) {
                        strike.hasDamaged = true;
                        strike.latchUntil = now;
                        continue;
                    }
                    this.inflictEnemyAttackDamage(strike.damage, strike.ailmentChance, strike.source);
                    strike.hasDamaged = true;
                    if (strike.type === 'BITE') {
                        strike.latchUntil = now + strike.latchDurationMs;
                        strike.nextDamageTickAt = now + strike.damageTickEveryMs;
                    }
                }
            }

            if (strike.type === 'BITE' && strike.latchUntil > now && strike.canMultiTickDamage && strike.hasDamaged) {
                if (now >= (strike.nextDamageTickAt || 0)) {
                    const blocked = typeof this.tryBlockWithNguCucSon === 'function'
                        ? this.tryBlockWithNguCucSon(centerX, centerY, coreRadius * 0.28, 'cắn bám')
                        : false;
                    if (blocked) {
                        strike.latchUntil = now;
                        strike.nextDamageTickAt = now + strike.damageTickEveryMs;
                        continue;
                    }
                    this.inflictEnemyAttackDamage(strike.damage * 0.28, Math.max(0.1, strike.ailmentChance * 0.45), 'cắn bám');
                    strike.nextDamageTickAt = now + strike.damageTickEveryMs;
                }
            }

            const keepBiteLatch = strike.type === 'BITE' && strike.latchUntil > now;
            if (progress < 1 || keepBiteLatch) {
                strikes[writeIndex++] = strike;
            }
        }

        strikes.length = writeIndex;
    },

    castEnemyProjectile(enemy, targetX, targetY, options = {}) {
        const projectiles = this.ensureEnemyHostileProjectiles();
        const maxProjectiles = Math.max(40, Number(CONFIG.ENEMY?.MAX_HOSTILE_PROJECTILES) || 0);
        if (projectiles.length >= maxProjectiles) {
            projectiles.shift();
        }
        const startX = enemy.x || targetX;
        const startY = enemy.y || targetY;
        const angle = Math.atan2(targetY - startY, targetX - startX);
        const speed = Math.max(120, Number(options.speed) || 220);
        const shotType = options.type || 'orb';
        const trailTimingByType = {
            orb: 40,
            arc: 52,
            needle: 62
        };
        const trailEveryMs = Math.max(
            30,
            Number(options.trailEveryMs) || trailTimingByType[shotType] || 48
        );
        projectiles.push({
            type: shotType,
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: Math.max(0.4, Number(options.life) || 2.4),
            radius: Math.max(3, Number(options.radius) || 8),
            color: options.color || enemy.rankData?.lightColor || '#8ee7ff',
            damage: Math.max(1, Number(options.damage) || Math.max(1, (enemy.damage || 1) * 0.85)),
            homing: Boolean(options.homing),
            arc: Number(options.arc) || 0,
            ownerId: enemy.floatOffset || 0,
            trailEveryMs,
            trailSizeMult: Math.max(0.7, Number(options.trailSizeMult) || 1),
            nextTrailAt: performance.now()
        });
    },

    updateEnemyHostileProjectiles(dt, centerX, centerY) {
        const projectiles = this.ensureEnemyHostileProjectiles();
        if (!projectiles.length) return;
        const elapsed = Math.max(0.016, dt || 0.016);
        let writeIndex = 0;

        for (let i = 0; i < projectiles.length; i++) {
            const shot = projectiles[i];
            shot.life -= elapsed;
            if (shot.life <= 0) continue;

            if (shot.homing) {
                const homingAngle = Math.atan2(centerY - shot.y, centerX - shot.x);
                const targetVx = Math.cos(homingAngle) * Math.hypot(shot.vx, shot.vy);
                const targetVy = Math.sin(homingAngle) * Math.hypot(shot.vx, shot.vy);
                shot.vx += (targetVx - shot.vx) * Math.min(0.12, elapsed * 0.6);
                shot.vy += (targetVy - shot.vy) * Math.min(0.12, elapsed * 0.6);
            }

            if (shot.arc !== 0) {
                const turn = Math.sin((performance.now() * 0.002) + shot.ownerId) * shot.arc;
                const cos = Math.cos(turn * elapsed);
                const sin = Math.sin(turn * elapsed);
                const nextVx = shot.vx * cos - shot.vy * sin;
                const nextVy = shot.vx * sin + shot.vy * cos;
                shot.vx = nextVx;
                shot.vy = nextVy;
            }

            shot.x += shot.vx * elapsed;
            shot.y += shot.vy * elapsed;

            const blockedByNguCucSon = typeof this.tryBlockWithNguCucSon === 'function'
                ? this.tryBlockWithNguCucSon(shot.x, shot.y, Math.max(3, shot.radius), 'phi đạn tà lực')
                : false;
            if (blockedByNguCucSon) {
                continue;
            }

            const hitDistance = Math.hypot(shot.x - centerX, shot.y - centerY);
            if (hitDistance <= this.getCursorCoreHitRadius()) {
                this.inflictEnemyAttackDamage(shot.damage, 0.28, 'phi đạn tà lực');
                continue;
            }

            const trailNow = performance.now();
            if (trailNow >= (shot.nextTrailAt || 0)) {
                trimVisualParticles(360);
                const baseSize = Math.max(1.9, shot.radius * 0.34 * (shot.trailSizeMult || 1));
                visualParticles.push({
                    x: shot.x,
                    y: shot.y,
                    vx: (shot.vx || 0) * 0.02,
                    vy: (shot.vy || 0) * 0.02,
                    life: 0.42,
                    decay: 0.064,
                    size: baseSize,
                    color: shot.color,
                    glow: shot.color
                });
                if (Math.random() < 0.48) {
                    const offsetAngle = Math.atan2(shot.vy || 0, shot.vx || 0) + random(-0.8, 0.8);
                    const sparkSpeed = random(0.22, 0.62);
                    visualParticles.push({
                        x: shot.x,
                        y: shot.y,
                        vx: Math.cos(offsetAngle) * sparkSpeed,
                        vy: Math.sin(offsetAngle) * sparkSpeed,
                        life: 0.28,
                        decay: 0.082,
                        size: baseSize * random(0.45, 0.7),
                        color: '#f8fdff',
                        glow: shot.color
                    });
                }
                shot.nextTrailAt = trailNow + (shot.trailEveryMs || 70);
            }

            projectiles[writeIndex++] = shot;
        }

        projectiles.length = writeIndex;
    },

    updateIncomingEnemyAttacks(enemies, centerX, centerY, dt = 0.016) {
        if (!Array.isArray(enemies) || this.isVoidCollapsed) return;
        const now = performance.now();
        const contactRadius = Math.max(20, Number(CONFIG.ENEMY?.CONTACT_RADIUS || 0) * (Camera.currentZoom || 1));
        const proactiveCfg = CONFIG.ENEMY?.PROACTIVE_ATTACK || {};

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy || enemy.hp <= 0) continue;
            const baseDamage = Math.max(1, Number(enemy.damage) || Number(enemy.rankData?.damage) || 1);
            const dist = Math.hypot((enemy.x || 0) - centerX, (enemy.y || 0) - centerY);
            const retaliating = now < (enemy.retaliateUntil || 0);
            const triggerRange = contactRadius * (retaliating ? 4.2 : 2.9);
            if (dist > triggerRange) continue;

            let hostile = retaliating;
            if (!hostile) {
                const proactiveAggroUntil = Number(enemy.proactiveAggroUntil) || 0;
                if (now < proactiveAggroUntil) {
                    hostile = true;
                } else {
                    const rollIntervalMs = Math.max(250, Number(proactiveCfg.ROLL_INTERVAL_MS) || 900);
                    const nextRollAt = Number(enemy.nextProactiveAggroRollAt) || 0;
                    if (now >= nextRollAt) {
                        const enemyRankIndex = CONFIG.CULTIVATION.RANKS.indexOf(enemy.rankData);
                        const playerRankIndex = this.rankIndex || 0;
                        const rankDiff = enemyRankIndex - playerRankIndex;
                        const baseChance = Number(proactiveCfg.BASE_CHANCE) || 0.16;
                        const lowerOrEqualBonus = Math.max(0, Number(proactiveCfg.LOWER_OR_EQUAL_BONUS_PER_LEVEL) || 0.04);
                        const higherPenalty = Math.max(0, Number(proactiveCfg.HIGHER_RANK_PENALTY_PER_LEVEL) || 0.06);
                        const eliteBonus = enemy.isElite ? Math.max(0, Number(proactiveCfg.ELITE_BONUS) || 0.05) : 0;
                        const adjustedChance = rankDiff > 0
                            ? baseChance - (rankDiff * higherPenalty) + eliteBonus
                            : baseChance + (Math.abs(rankDiff) * lowerOrEqualBonus) + eliteBonus;
                        const proactiveChance = Math.max(
                            Number(proactiveCfg.MIN_CHANCE) || 0.02,
                            Math.min(Number(proactiveCfg.MAX_CHANCE) || 0.42, adjustedChance)
                        );

                        enemy.nextProactiveAggroRollAt = now + rollIntervalMs + random(0, 200);
                        if (Math.random() < proactiveChance) {
                            enemy.proactiveAggroUntil = now + Math.max(1200, Number(proactiveCfg.AGGRO_WINDOW_MS) || 2800);
                            hostile = true;
                        }
                    }
                }
            }

            if (!hostile) continue;

            const attackPattern = this.getEnemyAttackPattern(enemy);
            const attackCooldown = enemy.isElite ? 820 : 1050;
            if (now - (enemy.lastAttackAt || 0) < attackCooldown) continue;
            enemy.lastAttackAt = now;

            switch (attackPattern) {
                case 'CHARGE':
                    if (dist <= contactRadius * 1.8) {
                        this.queueEnemyMeleeStrike(enemy, 'CHARGE', centerX, centerY, {
                            durationMs: enemy.isElite ? 180 : 240,
                            damage: baseDamage * 1.2,
                            ailmentChance: 0.24,
                            source: 'lao húc'
                        });
                    }
                    break;
                case 'BITE':
                    if (dist <= contactRadius * 1.6) {
                        this.queueEnemyMeleeStrike(enemy, 'BITE', centerX, centerY, {
                            durationMs: enemy.isElite ? 130 : 170,
                            damage: baseDamage * 1.35,
                            ailmentChance: 0.34,
                            source: 'cắn xé',
                            latchDurationMs: enemy.isElite ? 1700 : 1200,
                            damageTickEveryMs: enemy.isElite ? 300 : 360
                        });
                    }
                    break;
                case 'CLAW':
                    if (dist <= contactRadius * 1.45) {
                        this.queueEnemyMeleeStrike(enemy, 'CLAW', centerX, centerY, {
                            durationMs: enemy.isElite ? 160 : 210,
                            damage: baseDamage,
                            ailmentChance: 0.3,
                            source: 'cào cấu'
                        });
                        if (Math.random() < 0.55) {
                            this.queueEnemyMeleeStrike(enemy, 'CLAW', centerX, centerY, {
                                durationMs: enemy.isElite ? 190 : 250,
                                damage: baseDamage * 0.48,
                                ailmentChance: 0.2,
                                source: 'liên trảo'
                            });
                        }
                    }
                    break;
                case 'ORB':
                    this.castEnemyProjectile(enemy, centerX, centerY, { type: 'orb', speed: 240, radius: 9, damage: baseDamage * 0.95, color: '#8fd8ff' });
                    break;
                case 'BEAM': {
                    const beamRange = contactRadius * 4.8;
                    if (dist <= beamRange) {
                        this.castEnemyProjectile(enemy, centerX, centerY, {
                            type: 'orb',
                            speed: 320,
                            radius: 10,
                            life: 1.9,
                            damage: baseDamage * 1.12,
                            color: '#b8f3ff',
                            trailEveryMs: 32,
                            trailSizeMult: 1.28
                        });
                    }
                    break;
                }
                case 'ARC_MISSILE':
                    this.castEnemyProjectile(enemy, centerX, centerY, { type: 'arc', speed: 210, radius: 7, damage: baseDamage * 0.82, arc: 2.4, homing: true, color: '#ffc670' });
                    break;
                case 'SPIKE_RING': {
                    const burstCount = enemy.isElite ? 8 : 6;
                    for (let spike = 0; spike < burstCount; spike++) {
                        const angle = (Math.PI * 2 * spike) / burstCount;
                        this.castEnemyProjectile(enemy, centerX + Math.cos(angle) * 110, centerY + Math.sin(angle) * 110, {
                            type: 'needle',
                            speed: 265,
                            radius: 5,
                            damage: baseDamage * 0.68,
                            arc: 1.2,
                            color: '#ff9fb2'
                        });
                    }
                    break;
                }
                default:
                    if (dist <= contactRadius * 1.2) {
                        this.queueEnemyMeleeStrike(enemy, 'CLAW', centerX, centerY, {
                            durationMs: enemy.isElite ? 140 : 180,
                            damage: baseDamage,
                            ailmentChance: 0.2,
                            source: 'công kích trực diện'
                        });
                    }
                    break;
            }
        }

        this.updateEnemyHostileProjectiles(dt, centerX, centerY);
        this.updateEnemyMeleeStrikes(centerX, centerY);
    },

    triggerManaShake() {
        const el = document.getElementById('mana-container');
        el.classList.remove('mana-shake', 'mana-empty-error');

        void el.offsetWidth; // Trigger reflow để restart animation

        el.classList.add('mana-shake', 'mana-empty-error');

        // Xóa màu đỏ sau 500ms (hoặc giữ nguyên tùy bạn, ở đây tôi xóa sau khi rung xong)
        setTimeout(() => {
            el.classList.remove('mana-shake', 'mana-empty-error');
        }, 500);
    },

    updateExp(amount) {
        const currentRank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
        if (!currentRank) return;

        if (this.rankIndex >= this.getMaxRankIndex() || currentRank.infiniteStats) {
            this.exp = currentRank.exp;
            this.isReadyToBreak = false;
            this.renderExpUI();
            return;
        }

        // NGƯỠNG TRÀN: Ví dụ 120% của 5 exp là 6 exp
        const overflowLimit = currentRank.exp * (CONFIG.CULTIVATION.OVERFLOW_LIMIT || 1.2);

        if (!this.isReadyToBreak) {
            // Giai đoạn tích lũy bình thường
            this.exp += amount;
            
            // Chỉ khi EXP vượt ngưỡng mới xử lý thăng cấp/chờ đột phá
            if (this.exp >= currentRank.exp) {
                this.exp = currentRank.exp; // Chốt chặn để không vượt quá mức 100% khi chưa đột phá
                this.isReadyToBreak = true;
                showNotify("Linh khí tràn đầy, sẵn sàng đột phá!", "#00ffcc");
            }
        } else {
            // Giai đoạn đã đầy nhưng chưa đột phá (Tu vi tràn ra ngoài)
            if (this.exp < overflowLimit) {
                // Khi đã đầy, hấp thụ linh khí khó hơn (chỉ nhận 20% lượng exp từ quái)
                this.exp += amount * 0.2; 

                if (this.exp >= overflowLimit) {
                    this.exp = overflowLimit;
                    // Chỉ thông báo một lần duy nhất hoặc dùng setTimeout tránh lag
                    if(!this.forcedBreaking) { 
                        this.forcedBreaking = true;
                        showNotify("Linh lực quá tải, thiên đạo cưỡng ép đột phá!", "#ff4444");
                        setTimeout(() => {
                            this.executeBreakthrough(true);
                            this.forcedBreaking = false;
                        }, 1000);
                    }
                }
            }
        }
        this.renderExpUI(); // Cập nhật giao diện
    },
    
    checkLevelUp() {
        const currentRank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
        if (!currentRank) return;

        if (this.exp >= currentRank.exp && !this.isReadyToBreak) {
            this.isReadyToBreak = true;
            showNotify("Linh khí tràn đầy, sẵn sàng đột phá!", "#00ffcc");
            // Không tự động đột phá nữa, chỉ bật cờ isReadyToBreak
        }
    },

    _useInventoryItemLegacyPhase1(itemKey) {
        const item = this.inventory[itemKey];
        if (!item || item.count <= 0) return false;

        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return false;
        }

        const qualityConfig = this.getItemQualityConfig(item);

        if (item.category === 'MATERIAL') {
            return false;
        }

        if (item.category === 'INSECT_ARTIFACT') {
            if (InsectBookUI && typeof InsectBookUI.open === 'function') {
                InsectBookUI.open();
                showNotify(`Mở ${this.getItemDisplayName(item)}`, qualityConfig.color || '#ffd871');
                return true;
            }
            return false;
        }

        if (false && item.category === 'SWORD_ARTIFACT' && this.getBondedSwordCount() >= getConfiguredSwordCount()) {
            showNotify(
                `Đã triển khai đủ ${formatNumber(getConfiguredSwordCount())} thanh Thanh Trúc Phong Vân Kiếm.`,
                qualityConfig.color || '#66f0c2'
            );
            return false;
        }

        if (item.category === 'SWORD_ART' && this.hasDaiCanhKiemTranUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã nhập tâm, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#8fffe0');
            return false;
        }

        if (item.category === 'FLAME_ART' && this.hasCanLamBangDiemUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã được luyện hóa vào thần thức.`, qualityConfig.color || '#79d9ff');
            return false;
        }

        if (item.category === 'ARTIFACT' && this.hasArtifactUnlocked(item.uniqueKey)) {
            showNotify(`${this.getItemDisplayName(item)} đã được luyện hóa, chỉ cần vào Bảng Bí Pháp để triển khai.`, qualityConfig.color || '#9fe8ff');
            return false;
        }

        if (item.category === 'INSECT_SKILL' && this.hasKhuTrungThuatUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã lĩnh ngộ xong, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#79ffd4');
            return false;
        }

        if (item.category === 'BREAKTHROUGH' && !this.isInventoryItemUsable(item)) {
            showNotify(`Đan này chỉ hợp để đột phá ${item.realmName}`, '#ffd36b');
            return false;
        }

        item.count--;
        if (item.count <= 0) delete this.inventory[itemKey];

        if (item.category === 'EXP') {
            const rank = this.getCurrentRank();
            if (!rank) return false;

            const expGain = Math.max(1, Math.round(rank.exp * qualityConfig.expFactor * this.getExpGainMultiplier()));
            this.updateExp(expGain);
            showNotify(`Dùng ${this.getItemDisplayName(item)}: +${formatNumber(expGain)} tu vi`, qualityConfig.color);
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'BREAKTHROUGH') {
            const rank = this.getCurrentRank();
            if (!rank) return false;

            const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
            const currentTotal = Math.min(maxAllowed, rank.chance + this.breakthroughBonus);
            const maxBonus = Math.max(0, maxAllowed - rank.chance);
            const nextBonus = Math.min(maxBonus, this.breakthroughBonus + qualityConfig.breakthroughBoost);
            const appliedBoost = Math.min(maxAllowed, rank.chance + nextBonus) - currentTotal;

            if (appliedBoost <= 0) {
                this.addInventoryItem(item, 1);
                showNotify('Dược lực đã chạm giới hạn đột phá', '#ffd36b');
                return false;
            }

            this.breakthroughBonus = nextBonus;
            showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(appliedBoost * 100)}% tỉ lệ đột phá`, qualityConfig.color);
            this.refreshResourceUI();
            return true;
        }

        switch (item.category) {
            case 'SWORD_ARTIFACT': {
                const wasUnlocked = this.hasDaiCanhKiemTranUnlocked();
                this.bondedSwordCount = this.getBondedSwordCount() + 1;
                const unlocked = this.syncDaiCanhKiemTranProgress();
                const progress = this.getSwordFormationProgress();
                syncSwordFormation();
                showNotify(
                    unlocked && !wasUnlocked
                        ? `Triển khai ${this.getItemDisplayName(item)}: đã đủ ${formatNumber(progress.required)}/${formatNumber(progress.required)} thanh, có thể khai triển Đại Canh Kiếm Trận.`
                        : `Triển khai ${this.getItemDisplayName(item)}: ${formatNumber(progress.bonded)}/${formatNumber(progress.required)} thanh đang hộ thân.`,
                    qualityConfig.color || '#66f0c2'
                );
                this.refreshResourceUI();
                return true;
            }
            case 'SWORD_ART':
                this.bondedSwordCount = Math.max(this.getBondedSwordCount(), getConfiguredSwordCount());
                this.unlockCultivationArt('DAI_CANH_KIEM_TRAN');
                this.attackMode = 'SWORD';
                syncSwordFormation();
                showNotify(`Lĩnh ngộ ${this.getItemDisplayName(item)}: kiếm trận đã triển khai ${formatNumber(this.getUnlockedSwordTargetCount())} kiếm.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'FLAME_ART':
                this.unlockCultivationArt('CAN_LAM_BANG_DIEM');
                showNotify(`Luyện hóa ${this.getItemDisplayName(item)}: lam diễm đã hiện nơi đầu niệm.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'ARTIFACT':
                this.unlockCultivationArt(item.uniqueKey);
                this.setArtifactDeployment(item.uniqueKey, true, { silent: true, skipRefresh: true });
                showNotify(
                    `Luyện hóa ${this.getItemDisplayName(item)}: ${this.getArtifactAttunementNote(item.uniqueKey)}`,
                    qualityConfig.color || '#9fe8ff'
                );
                this.refreshResourceUI();
                return true;
            case 'INSECT_SKILL':
                this.unlockCultivationArt('KHU_TRUNG_THUAT');
                this.renderAttackModeUI();
                showNotify(`Lĩnh ngộ ${this.getItemDisplayName(item)}: đã có thể điều linh trùng nhập trận.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'INSIGHT':
                this.bonusStats.expGainPct += qualityConfig.expGainPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.expGainPct || 0) * 100)}% tu vi thu hoạch`, qualityConfig.color);
                break;
            case 'ATTACK':
                this.bonusStats.attackPct += qualityConfig.attackPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.attackPct || 0) * 100)}% công kích`, qualityConfig.color);
                break;
            case 'SHIELD_BREAK':
                this.bonusStats.shieldBreakPct += qualityConfig.shieldBreakPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.shieldBreakPct || 0) * 100)}% phá khiên`, qualityConfig.color);
                break;
            case 'BERSERK':
                this.consumeBerserkPill(item, qualityConfig);
                break;
            case 'RAGE':
                this.addRage(qualityConfig.rageGain || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(qualityConfig.rageGain || 0)} nộ`, qualityConfig.color);
                break;
            case 'MANA':
                this.consumePurificationPill(item, qualityConfig);
                break;
            case 'MAX_MANA':
                this.bonusStats.maxManaFlat += qualityConfig.maxManaFlat || 0;
                this.syncDerivedStats();
                this.updateMana(qualityConfig.maxManaFlat || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(qualityConfig.maxManaFlat || 0)} giới hạn linh lực`, qualityConfig.color);
                break;
            case 'REGEN':
                this.consumeRegenPill(item, qualityConfig);
                break;
            case 'SPEED':
                this.bonusStats.speedPct += qualityConfig.speedPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.speedPct || 0) * 100)}% tốc độ`, qualityConfig.color);
                break;
            case 'FORTUNE':
                this.bonusStats.dropRatePct += qualityConfig.dropRatePct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.dropRatePct || 0) * 100)}% vận khí`, qualityConfig.color);
                break;
            case 'SPECIAL':
                if (item.specialKey === 'CHUNG_CUC_DAO_NGUYEN_DAN') {
                    if (!this.applyChungCucDaoNguyenDan(item, qualityConfig)) {
                        this.addInventoryItem(item, 1);
                        return false;
                    }
                } else if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
                    if (!this.applyTanDaoDietNguyenDan(item, qualityConfig)) {
                        this.addInventoryItem(item, 1);
                        return false;
                    }
                } else {
                    this.addInventoryItem(item, 1);
                    return false;
                }
                break;
            default:
                this.addInventoryItem(item, 1);
                return false;
        }

        this.refreshResourceUI();
        return true;
    },

    _useInventoryItemLegacyPhase2(itemKey) {
        const item = this.inventory[itemKey];
        if (!item || item.count <= 0) return false;

        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return false;
        }

        const qualityConfig = this.getItemQualityConfig(item);

        if (item.category === 'INSECT_ARTIFACT') {
            if (InsectBookUI && typeof InsectBookUI.open === 'function') {
                InsectBookUI.open();
                showNotify(`Mở ${this.getItemDisplayName(item)}`, qualityConfig.color || '#ffd871');
                return true;
            }
            return false;
        }

        if (item.category === 'SWORD_ART' && this.hasDaiCanhKiemTranUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã nhập tâm, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#8fffe0');
            return false;
        }

        if (item.category === 'FLAME_ART' && this.hasCanLamBangDiemUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã được luyện hóa vào thần thức.`, qualityConfig.color || '#79d9ff');
            return false;
        }

        if (item.category === 'ARTIFACT' && this.hasArtifactUnlocked(item.uniqueKey)) {
            showNotify(`${this.getItemDisplayName(item)} đã được luyện hóa, chỉ cần vào Bảng Bí Pháp để triển khai.`, qualityConfig.color || '#9fe8ff');
            return false;
        }

        if (item.category === 'INSECT_SKILL' && this.hasKhuTrungThuatUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã lĩnh ngộ xong, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#79ffd4');
            return false;
        }

        if (item.category === 'BREAKTHROUGH' && !this.isInventoryItemUsable(item)) {
            showNotify(`Đan này chỉ hợp để đột phá ${item.realmName}`, '#ffd36b');
            return false;
        }

        item.count--;
        if (item.count <= 0) delete this.inventory[itemKey];

        if (item.category === 'EXP') {
            const rank = this.getCurrentRank();
            if (!rank) return false;

            const expGain = Math.max(1, Math.round(rank.exp * qualityConfig.expFactor * this.getExpGainMultiplier()));
            this.updateExp(expGain);
            showNotify(`Dùng ${this.getItemDisplayName(item)}: +${formatNumber(expGain)} tu vi`, qualityConfig.color);
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'BREAKTHROUGH') {
            const rank = this.getCurrentRank();
            if (!rank) return false;

            const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
            const currentTotal = Math.min(maxAllowed, rank.chance + this.breakthroughBonus);
            const maxBonus = Math.max(0, maxAllowed - rank.chance);
            const nextBonus = Math.min(maxBonus, this.breakthroughBonus + qualityConfig.breakthroughBoost);
            const appliedBoost = Math.min(maxAllowed, rank.chance + nextBonus) - currentTotal;

            if (appliedBoost <= 0) {
                this.addInventoryItem(item, 1);
                showNotify('Dược lực đã chạm giới hạn đột phá', '#ffd36b');
                return false;
            }

            this.breakthroughBonus = nextBonus;
            showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(appliedBoost * 100)}% tỉ lệ đột phá`, qualityConfig.color);
            this.refreshResourceUI();
            return true;
        }

        switch (item.category) {
            case 'SWORD_ART':
                this.unlockCultivationArt('DAI_CANH_KIEM_TRAN');
                this.attackMode = 'SWORD';
                syncSwordFormation();
                showNotify(`Lĩnh ngộ ${this.getItemDisplayName(item)}: kiếm trận đã triển khai ${formatNumber(this.getUnlockedSwordTargetCount())} kiếm.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'FLAME_ART':
                this.unlockCultivationArt('CAN_LAM_BANG_DIEM');
                showNotify(`Luyện hóa ${this.getItemDisplayName(item)}: lam diễm đã hiện nơi đầu niệm.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'ARTIFACT':
                this.unlockCultivationArt(item.uniqueKey);
                this.setArtifactDeployment(item.uniqueKey, true, { silent: true, skipRefresh: true });
                showNotify(
                    `Luyện hóa ${this.getItemDisplayName(item)}: ${this.getArtifactAttunementNote(item.uniqueKey)}`,
                    qualityConfig.color || '#9fe8ff'
                );
                this.refreshResourceUI();
                return true;
            case 'INSECT_SKILL':
                this.unlockCultivationArt('KHU_TRUNG_THUAT');
                this.renderAttackModeUI();
                showNotify(`Lĩnh ngộ ${this.getItemDisplayName(item)}: đã có thể điều linh trùng nhập trận.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'INSIGHT':
                this.bonusStats.expGainPct += qualityConfig.expGainPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.expGainPct || 0) * 100)}% tu vi thu hoạch`, qualityConfig.color);
                break;
            case 'ATTACK':
                this.bonusStats.attackPct += qualityConfig.attackPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.attackPct || 0) * 100)}% công kích`, qualityConfig.color);
                break;
            case 'SHIELD_BREAK':
                this.bonusStats.shieldBreakPct += qualityConfig.shieldBreakPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.shieldBreakPct || 0) * 100)}% phá khiên`, qualityConfig.color);
                break;
            case 'BERSERK':
                this.consumeBerserkPill(item, qualityConfig);
                break;
            case 'RAGE':
                this.addRage(qualityConfig.rageGain || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(qualityConfig.rageGain || 0)} nộ`, qualityConfig.color);
                break;
            case 'MANA':
                this.consumePurificationPill(item, qualityConfig);
                break;
            case 'MAX_MANA':
                this.bonusStats.maxManaFlat += qualityConfig.maxManaFlat || 0;
                this.syncDerivedStats();
                this.updateMana(qualityConfig.maxManaFlat || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(qualityConfig.maxManaFlat || 0)} giới hạn linh lực`, qualityConfig.color);
                break;
            case 'REGEN':
                this.consumeRegenPill(item, qualityConfig);
                break;
            case 'SPEED':
                this.bonusStats.speedPct += qualityConfig.speedPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.speedPct || 0) * 100)}% tốc độ`, qualityConfig.color);
                break;
            case 'FORTUNE':
                this.bonusStats.dropRatePct += qualityConfig.dropRatePct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.dropRatePct || 0) * 100)}% vận khí`, qualityConfig.color);
                break;
            case 'SPECIAL':
                if (item.specialKey === 'CHUNG_CUC_DAO_NGUYEN_DAN') {
                    if (!this.applyChungCucDaoNguyenDan(item, qualityConfig)) {
                        this.addInventoryItem(item, 1);
                        return false;
                    }
                } else if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
                    if (!this.applyTanDaoDietNguyenDan(item, qualityConfig)) {
                        this.addInventoryItem(item, 1);
                        return false;
                    }
                } else {
                    this.addInventoryItem(item, 1);
                    return false;
                }
                break;
            default:
                this.addInventoryItem(item, 1);
                return false;
        }

        this.refreshResourceUI();
        return true;
    },

    executeBreakthrough(isForced = false) {
        const currentRank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
        if (!currentRank) return;

        // 1. Tính tổng tỉ lệ
        const pillBoost = this.calculateTotalPillBoost();
        let totalChance = currentRank.chance + pillBoost;

        const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.95;
        totalChance = Math.min(maxAllowed, totalChance);

        if (Math.random() <= totalChance) {
            // --- THÀNH CÔNG ---
            this.exp = 0;
            this.rankIndex++;
            this.isReadyToBreak = false;

            this.pills = { LOW: 0, MEDIUM: 0, HIGH: 0 };

            const nextRank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
            if (nextRank) {
                if (nextRank.maxMana) this.maxMana = nextRank.maxMana;
                
                // --- LOGIC THAY ĐỔI Ở ĐÂY ---
                if (isForced) {
                    // Nếu bị cưỡng ép: Không hồi mana (giữ nguyên lượng mana hiện tại)
                    showNotify(`CƯỠNG ÉP ĐỘT PHÁ THÀNH CÔNG: ${nextRank.name.toUpperCase()}`, "#ff8800");
                } else {
                    // Nếu chủ động: Hồi đầy mana
                    this.mana = this.maxMana; 
                    showNotify(`ĐỘT PHÁ THÀNH CÔNG: ${nextRank.name.toUpperCase()}`, "#ffcc00");
                }
            }
            this.createLevelUpExplosion(this.x, this.y, nextRank?.color || currentRank.color);
        } else {
            // --- THẤT BẠI ---
            const penaltyFactor = CONFIG.CULTIVATION.BREAKTHROUGH_PENALTY_FACTOR; // Ví dụ: 0.4
            const penalty = Math.floor(this.exp * penaltyFactor);

            this.exp -= penalty;
            this.isReadyToBreak = false;

            // 2. Tính toán con số hiển thị (0.4 -> 40)
            const penaltyPercent = Math.round(penaltyFactor * 100);

            this.pills.LOW = Math.floor(this.pills.LOW / 2);
            this.pills.MEDIUM = Math.floor(this.pills.MEDIUM / 2);
            this.pills.HIGH = Math.floor(this.pills.HIGH / 2);

            // 3. Sử dụng Template Literals (dấu huyền ` `) để đưa biến vào chuỗi
            showNotify(`ĐỘT PHÁ THẤT BẠI! Tâm ma phản phệ (-${penaltyPercent}% tu vi)`, "#ff4444");

            this.triggerExpError();
        }

        this.renderExpUI();
        this.renderManaUI();
    },

    renderExpUI() {
        const rank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
        if (!rank) return;

        if (rank.maxMana) this.maxMana = rank.maxMana;

        const barExp = document.getElementById('exp-bar');
        const textExp = document.getElementById('exp-text');
        const rankText = document.getElementById('cultivation-rank');
        const breakthroughGroup = document.querySelector('.breakthrough-group');

        // 1. Tính toán tỉ lệ hiển thị dựa trên 3 loại đan
        const pillBoost = this.calculateTotalPillBoost();
        const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
        const totalChance = Math.min(maxAllowed, rank.chance + pillBoost);

        const totalPercent = (totalChance * 100).toFixed(0);

        // Tổng số lượng đan dược để hiển thị
        const totalPills = this.pills.LOW + this.pills.MEDIUM + this.pills.HIGH;

        // 2. Cập nhật văn bản giao diện
        if (textExp) {
            let statusText = this.isReadyToBreak ?
                `<span style="color:#ffcc00; font-weight:bold;">SẴN SÀNG ĐỘT PHÁ</span>` :
                `Tu vi: ${Math.floor(this.exp)}/${rank.exp}`;

            textExp.innerHTML = `${statusText} | ` +
                `<span style="color:#00ffcc">Linh Đan: ${totalPills}</span> ` +
                `(<span style="color:#ffcc00">TL: ${totalPercent}%</span>)`;
        }

        // 3. Ẩn/Hiện nút đột phá
        if (breakthroughGroup) {
            if (this.isReadyToBreak && !this.isVoidCollapsed) breakthroughGroup.classList.add('is-active');
            else breakthroughGroup.classList.remove('is-active');
        }

        // 4. Cập nhật thanh EXP (màu sắc và hiệu ứng)
        const percentage = (this.exp / rank.exp) * 100;
        if (barExp) {
            barExp.style.width = Math.min(100, percentage) + '%';
            barExp.style.background = `linear-gradient(90deg, ${rank.lightColor}, ${rank.color})`;

            if (this.isReadyToBreak) {
                barExp.style.boxShadow = `0 0 15px #fff, 0 0 5px ${rank.color}`;
                barExp.classList.add('exp-full-glow');
            } else {
                barExp.style.boxShadow = `0 0 10px ${rank.lightColor}`;
                barExp.classList.remove('exp-full-glow');
            }
        }

        if (rankText) {
            rankText.innerText = `Cảnh giới: ${rank.name}`;
            rankText.style.color = rank.color;
        }
    },

    calculateTotalPillBoost() {
        return this.breakthroughBonus;
    },

    getCurrentRank() {
        return CONFIG.CULTIVATION.RANKS[this.rankIndex] || null;
    },

    getPlayerDisplayName() {
        return this.playerName || 'Thanh Trúc Kiếm Chủ';
    },

    getPlayerMonogram() {
        const custom = String(this.playerAvatarInitials || '').trim().slice(0, 2).toUpperCase();
        if (custom) return custom;

        const initials = this.getPlayerDisplayName()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join('');

        return initials || 'TT';
    },

    getCurrentMajorRealmInfo() {
        const rank = this.getCurrentRank();
        if (!rank) return null;

        return CONFIG.CULTIVATION.MAJOR_REALMS.find(realm =>
            rank.id >= realm.startId && rank.id <= realm.endId
        ) || null;
    },

    getNextMajorRealmInfo() {
        const currentRealm = this.getCurrentMajorRealmInfo();
        if (!currentRealm || !currentRealm.nextKey || !currentRealm.nextName) return null;

        return {
            key: currentRealm.nextKey,
            name: currentRealm.nextName
        };
    },

    getCurrentBreakthroughChance() {
        const rank = this.getCurrentRank();
        if (!rank) return 0;
        if (this.rankIndex >= this.getMaxRankIndex() || rank.infiniteStats) return 0;

        const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
        return Math.max(0, Math.min(maxAllowed, rank.chance + this.calculateTotalPillBoost()));
    },

    getEffectiveAttackDamage() {
        const rank = this.getCurrentRank();
        const baseDamage = rank?.damage || 0;
        return Math.max(1, Math.ceil(baseDamage * this.getAttackMultiplier()));
    },

    getAliveSwordStats() {
        const total = Array.isArray(swords) ? swords.length : 0;
        const alive = Array.isArray(swords) ? swords.filter(sword => !sword.isDead).length : 0;

        return {
            alive,
            total,
            broken: Math.max(0, total - alive)
        };
    },

    getInventoryCapacity() {
        if (this.hasSevenColorInventoryBag()) {
            return Number.POSITIVE_INFINITY;
        }

        const baseCapacity = Math.max(
            parseInt(CONFIG.ITEMS.INVENTORY_BASE_CAPACITY, 10) || 0,
            parseInt(CONFIG.ITEMS.INVENTORY_MIN_SLOTS, 10) || 16
        );

        return Math.max(baseCapacity, Math.floor(this.inventoryCapacity || 0));
    },

    hasSevenColorInventoryBag() {
        return this.hasUniquePurchase('THAT_SAC_TRU_VAT_NANG');
    },

    hasSevenColorSpiritBag() {
        return this.hasUniquePurchase('THAT_SAC_LINH_THU_DAI');
    },

    hasInventorySpaceForSpec(spec) {
        if (this.hasSevenColorInventoryBag()) {
            return true;
        }

        const itemKey = this.buildInventoryKey(spec);
        const existingItem = this.inventory[itemKey];

        if (existingItem && existingItem.count > 0) {
            return true;
        }

        return this.getInventoryEntries().length < this.getInventoryCapacity();
    },

    canUpgradeInventoryCapacity(item) {
        if (!item) return false;

        if (item.category === 'RAINBOW_BAG') {
            return !this.hasSevenColorInventoryBag();
        }

        if (this.hasSevenColorInventoryBag() || item.category !== 'BAG') return false;

        const qualityConfig = this.getItemQualityConfig(item);
        return Math.max(0, Math.floor(qualityConfig.capacity || 0)) > 0;
    },

    canUpgradeBeastBagCapacity(item) {
        if (!item) return false;

        if (item.category === 'RAINBOW_SPIRIT_BAG') {
            return !this.hasSevenColorSpiritBag();
        }

        if (item.category === 'SPIRIT_HABITAT') {
            return !this.hasSevenColorSpiritBag() && Boolean(item.speciesKey && this.getInsectSpecies(item.speciesKey));
        }

        if (this.hasSevenColorSpiritBag() || item.category !== 'SPIRIT_BAG') return false;

        const qualityConfig = this.getItemQualityConfig(item);
        return Math.max(0, Math.floor(qualityConfig.capacity || 0)) > 0;
    },

    upgradeInventoryCapacity(nextCapacity) {
        const safeCapacity = Math.max(this.getInventoryCapacity(), Math.floor(nextCapacity || 0));
        if (safeCapacity <= this.getInventoryCapacity()) return false;

        this.inventoryCapacity = safeCapacity;
        return true;
    },

    getInventorySummary() {
        const entries = this.getInventoryEntries();
        const categories = entries.reduce((summary, item) => {
            summary[item.category] = (summary[item.category] || 0) + item.count;
            return summary;
        }, {});
        const uniqueCount = entries.length;
        const capacity = this.getInventoryCapacity();

        return {
            entries,
            totalCount: entries.reduce((total, item) => total + item.count, 0),
            uniqueCount,
            categories,
            capacity,
            freeSlots: Math.max(0, capacity - uniqueCount),
            usageRatio: Number.isFinite(capacity) && capacity > 0 ? (uniqueCount / capacity) : 0
        };
    },

    getActiveEffectModifiers() {
        return this.activeEffects.reduce((acc, effect) => {
            acc.attackPct += effect.attackPct || 0;
            acc.speedPct += effect.speedPct || 0;
            acc.maxManaFlat += effect.maxManaFlat || 0;
            return acc;
        }, { attackPct: 0, speedPct: 0, maxManaFlat: 0 });
    },

    syncDerivedStats() {
        const rank = this.getCurrentRank();
        if (rank?.infiniteStats) {
            this.maxMana = Number.POSITIVE_INFINITY;
            this.mana = Number.POSITIVE_INFINITY;
            this.syncVitalStats();
            if (typeof document !== 'undefined') {
                this.renderManaUI();
            }
            return;
        }
        const baseMaxMana = rank?.maxMana || CONFIG.MANA.MAX || 100;
        const active = this.getActiveEffectModifiers();
        const prevMaxMana = this.maxMana;
        const prevMana = this.mana;
        const nextMaxMana = Math.max(1, Math.round(baseMaxMana + this.bonusStats.maxManaFlat + active.maxManaFlat));

        this.maxMana = nextMaxMana;
        this.mana = Math.max(0, Math.min(this.mana, this.maxMana));

        if ((prevMaxMana !== this.maxMana || prevMana !== this.mana) && typeof document !== 'undefined') {
            this.renderManaUI();
        }
        this.syncVitalStats();
    },

    updateActiveEffects() {
        if (!this.activeEffects.length) {
            this.syncDerivedStats();
            return;
        }

        const now = performance.now();
        const expired = [];
        this.activeEffects = this.activeEffects.filter(effect => {
            const isAlive = effect.expiresAt > now;
            if (!isAlive) expired.push(effect);
            return isAlive;
        });

        this.syncDerivedStats();

        expired.forEach(effect => {
            showNotify(`${effect.name} đã tan hết dược lực`, effect.endColor || "#ffd36b");
        });
    },

    getExpGainMultiplier() {
        if (this.isVoidCollapsed) return 0;
        return Math.max(0, 1 + this.bonusStats.expGainPct);
    },

    getManaRegenMultiplier() {
        if (this.isVoidCollapsed) return 0;
        return Math.max(0, 1 + this.bonusStats.manaRegenPct);
    },

    getShieldBreakMultiplier() {
        if (this.isVoidCollapsed) return 0;
        return Math.max(0, 1 + this.bonusStats.shieldBreakPct);
    },

    getDropRateMultiplier() {
        return Math.max(0, 1 + this.bonusStats.dropRatePct);
    },

    getAttackMultiplier() {
        if (this.isVoidCollapsed) return 0;
        const active = this.getActiveEffectModifiers();
        return Math.max(0.2, 1 + this.bonusStats.attackPct + active.attackPct);
    },

    getSpeedMultiplier() {
        if (this.isVoidCollapsed) return 0;
        const active = this.getActiveEffectModifiers();
        return Math.max(0.35, 1 + this.bonusStats.speedPct + active.speedPct);
    },

    getArtifactMovementSpeedBonusPct() {
        if (this.isVoidCollapsed) return 0;

        return Object.keys(CONFIG.ARTIFACTS || {}).reduce((total, uniqueKey) => {
            if (!this.isArtifactDeployed(uniqueKey)) return total;
            return total + Math.max(0, Number(this.getArtifactConfig(uniqueKey)?.speedBonusPct) || 0);
        }, 0);
    },

    getMovementSpeedMultiplier() {
        const base = this.getSpeedMultiplier() + this.getArtifactMovementSpeedBonusPct();
        const broken = this.negativeStatuses?.brokenBone;
        if (broken && broken.stacks > 0 && performance.now() < (broken.until || 0)) {
            const penalty = Math.min(0.72, broken.stacks * 0.2);
            return Math.max(0.12, base * (1 - penalty));
        }
        return Math.max(0.35, base);
    },

    ensureHuyetSacPhiPhongTrail() {
        if (!Array.isArray(this.huyetSacPhiPhongTrail)) {
            this.huyetSacPhiPhongTrail = [];
        }
        return this.huyetSacPhiPhongTrail;
    },

    clearHuyetSacPhiPhongTrail() {
        const trail = this.ensureHuyetSacPhiPhongTrail();
        trail.length = 0;
        return trail;
    },

    updateHuyetSacPhiPhongTrail(anchor, deltaX = 0, deltaY = 0) {
        const trail = this.ensureHuyetSacPhiPhongTrail();
        const active = this.isArtifactDeployed('HUYET_SAC_PHI_PHONG');
        if (!active || !anchor) {
            trail.length = 0;
            return trail;
        }

        const now = performance.now();
        const artifactConfig = this.getArtifactConfig('HUYET_SAC_PHI_PHONG') || {};
        const trailLifetimeMs = Math.max(180, Math.floor(Number(artifactConfig.trailLifetimeMs) || 360));
        const maxTrailPoints = Math.max(6, Math.floor(Number(artifactConfig.maxTrailPoints) || 16));
        const moveDistance = Math.hypot(deltaX, deltaY);
        const restOffset = Math.max(10, Number(artifactConfig.trailOffsetStanding) || Number(artifactConfig.trailOffset) || 18);
        const movingOffset = Math.max(6, Math.min(restOffset, Number(artifactConfig.trailOffsetMoving) || 9));
        const movingFollow = clampNumber(Number(artifactConfig.movingAnchorFollow) || 0.78, 0, 1);

        for (let index = trail.length - 1; index >= 0; index--) {
            if ((now - (trail[index]?.startedAt || 0)) > trailLifetimeMs) {
                trail.splice(index, 1);
            }
        }

        if (moveDistance <= 0.3) {
            return trail;
        }

        const directionX = deltaX / moveDistance;
        const directionY = deltaY / moveDistance;
        const motionRatio = clampNumber(moveDistance / 18, 0, 1);
        const anchorTargetX = Number.isFinite(this.x) ? this.x : anchor.x;
        const anchorTargetY = Number.isFinite(this.y) ? this.y : anchor.y;
        const trailAnchorX = anchor.x + ((anchorTargetX - anchor.x) * motionRatio * movingFollow);
        const trailAnchorY = anchor.y + ((anchorTargetY - anchor.y) * motionRatio * movingFollow);
        const offsetDistance = restOffset + ((movingOffset - restOffset) * motionRatio);

        trail.unshift({
            x: trailAnchorX - (directionX * offsetDistance),
            y: trailAnchorY - (directionY * offsetDistance),
            startedAt: now,
            width: Math.max(14, Math.min(28, 14 + (moveDistance * 1.8)))
        });

        if (trail.length > maxTrailPoints) {
            trail.length = maxTrailPoints;
        }

        return trail;
    },

    drawHuyetSacPhiPhongTrail(ctx, scaleFactor) {
        const trail = this.ensureHuyetSacPhiPhongTrail();
        if (!trail.length || !this.isArtifactDeployed('HUYET_SAC_PHI_PHONG')) return;

        const artifactConfig = this.getArtifactConfig('HUYET_SAC_PHI_PHONG') || {};
        const primaryColor = artifactConfig.color || '#ff5d73';
        const secondaryColor = artifactConfig.secondaryColor || '#ffd0d6';
        const auraColor = artifactConfig.auraColor || '#b81531';
        const now = performance.now();
        const trailLifetimeMs = Math.max(180, Math.floor(Number(artifactConfig.trailLifetimeMs) || 360));

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();

            let started = false;
            for (let index = 0; index < trail.length; index++) {
                const point = trail[index];
                if (!point) continue;

                const ageRatio = clampNumber((now - point.startedAt) / trailLifetimeMs, 0, 1);
                if (ageRatio >= 1) continue;

                if (!started) {
                    ctx.moveTo(point.x, point.y);
                    started = true;
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }

            if (!started) {
                continue;
            }

            ctx.strokeStyle = pass === 0
                ? withAlpha(auraColor, 0.3)
                : withAlpha(primaryColor, 0.78);
            ctx.lineWidth = (pass === 0 ? 18 : 8) * scaleFactor;
            ctx.shadowBlur = (pass === 0 ? 20 : 12) * scaleFactor;
            ctx.shadowColor = pass === 0 ? withAlpha(auraColor, 0.56) : withAlpha(primaryColor, 0.88);
            ctx.stroke();
        }

        trail.forEach((point, index) => {
            const ageRatio = clampNumber((now - point.startedAt) / trailLifetimeMs, 0, 1);
            if (ageRatio >= 1) return;

            const alpha = 1 - ageRatio;
            const radius = Math.max(2.2, ((point.width || 16) * 0.24) * (1 - (index / Math.max(1, trail.length * 1.25)))) * scaleFactor;
            const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.4);
            gradient.addColorStop(0, withAlpha('#ffffff', 0.34 * alpha));
            gradient.addColorStop(0.22, withAlpha(secondaryColor, 0.48 * alpha));
            gradient.addColorStop(0.68, withAlpha(primaryColor, 0.3 * alpha));
            gradient.addColorStop(1, withAlpha(auraColor, 0));

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius * 2.4, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    },

    prunePhongLoiBlinkEffects(now = performance.now()) {
        const state = this.ensurePhongLoiBlinkState();
        state.trails = (state.trails || []).filter(effect => (now - effect.startedAt) < effect.durationMs);
        state.afterimages = (state.afterimages || []).filter(effect => (now - effect.startedAt) < effect.durationMs);
        return state;
    },

    beginPhongLoiBlinkCharge(guardCenter) {
        const state = this.ensurePhongLoiBlinkState();
        const cfg = this.getPhongLoiBlinkConfig();
        const now = performance.now();

        trimVisualParticles(260);
        this.updateMana(-cfg.manaCost);
        state.accumulatedDistance = 0;
        state.charging = {
            startedAt: now,
            anchorX: guardCenter.x,
            anchorY: guardCenter.y
        };

        for (let i = 0; i < 6; i++) {
            const angle = random(0, Math.PI * 2);
            const speed = random(1.2, 3.2);
            visualParticles.push({
                type: i % 3 === 0 ? 'square' : 'spark',
                x: guardCenter.x,
                y: guardCenter.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - random(0.2, 1.1),
                size: random(1.8, 3.6),
                sizeVelocity: -0.035,
                friction: 0.93,
                gravity: -0.01,
                life: 0.7,
                decay: random(0.045, 0.07),
                opacity: 0.86,
                color: i % 2 === 0 ? '#9fe8ff' : '#b48cff',
                glow: 10,
                rotation: angle,
                rotationSpeed: random(-0.2, 0.2)
            });
        }

        this.renderPhongLoiBlinkButton();
    },

    startPhongLoiBlinkTransit(guardCenter, destinationX, destinationY, directionX, directionY) {
        const state = this.ensurePhongLoiBlinkState();
        const cfg = this.getPhongLoiBlinkConfig();
        const now = performance.now();
        const originX = guardCenter.x;
        const originY = guardCenter.y;

        trimVisualParticles(280);

        guardCenter.vx = 0;
        guardCenter.vy = 0;

        state.trails.unshift({
            fromX: originX,
            fromY: originY,
            toX: destinationX,
            toY: destinationY,
            directionX,
            directionY,
            startedAt: now,
            durationMs: cfg.trailMs
        });
        state.afterimages.unshift({
            x: originX,
            y: originY,
            directionX,
            directionY,
            startedAt: now,
            durationMs: cfg.afterimageMs
        });

        if (state.trails.length > 6) state.trails.length = 6;
        if (state.afterimages.length > 5) state.afterimages.length = 5;

        state.charging = null;
        state.transiting = {
            startedAt: now,
            durationMs: cfg.transitionMs,
            originX,
            originY,
            destinationX,
            destinationY
        };
        state.lastBlinkAt = now;

        this.createPhongLoiBlinkBurst(originX, originY, directionX, directionY, { arrival: false });
        this.createPhongLoiBlinkBurst(destinationX, destinationY, directionX, directionY, { arrival: true });
        this.renderPhongLoiBlinkButton();
        return true;
    },

    updatePhongLoiBlinkMotion(guardCenter, movementDx, movementDy) {
        const now = performance.now();
        const state = this.prunePhongLoiBlinkEffects(now);
        const cfg = this.getPhongLoiBlinkConfig();

        if (!this.hasPhongLoiBlinkSkill()) {
            if (state.enabled || state.charging || state.trails.length || state.afterimages.length) {
                this.resetPhongLoiBlinkState({ clearEffects: true });
                this.renderPhongLoiBlinkButton();
            }
            return;
        }

        if (state.transiting) {
            const transit = state.transiting;
            const progress = clampNumber((now - transit.startedAt) / Math.max(1, transit.durationMs || 1), 0, 1);
            const eased = 1 - Math.pow(1 - progress, 4);

            guardCenter.x = transit.originX + ((transit.destinationX - transit.originX) * eased);
            guardCenter.y = transit.originY + ((transit.destinationY - transit.originY) * eased);
            guardCenter.vx = 0;
            guardCenter.vy = 0;

            if (progress >= 1) {
                guardCenter.x = transit.destinationX;
                guardCenter.y = transit.destinationY;
                state.transiting = null;
            }
            return;
        }

        if (state.charging) {
            state.charging.anchorX = guardCenter.x;
            state.charging.anchorY = guardCenter.y;

            if ((now - state.charging.startedAt) >= cfg.chargeMs) {
                const directionLength = Math.hypot(state.lastMoveVectorX, state.lastMoveVectorY);
                if (directionLength < 0.5) {
                    state.charging = null;
                    return;
                }

                const safeMargin = Math.max(18, 26 * scaleFactor);
                const minVisible = Camera.screenToWorld(safeMargin, safeMargin);
                const maxVisible = Camera.screenToWorld(window.innerWidth - safeMargin, window.innerHeight - safeMargin);
                const targetDx = this.x - guardCenter.x;
                const targetDy = this.y - guardCenter.y;
                const targetDistance = Math.hypot(targetDx, targetDy);
                const desiredBlinkDistance = (!this.isTouchDevice && !this.moveJoystick.active && targetDistance > cfg.minMoveSpeed)
                    ? Math.min(cfg.blinkDistance, Math.max(cfg.minBlinkDistance, targetDistance))
                    : cfg.blinkDistance;
                const destinationX = clampNumber(guardCenter.x + (state.lastMoveVectorX * desiredBlinkDistance), minVisible.x, maxVisible.x);
                const destinationY = clampNumber(guardCenter.y + (state.lastMoveVectorY * desiredBlinkDistance), minVisible.y, maxVisible.y);
                const actualDistance = Math.hypot(destinationX - guardCenter.x, destinationY - guardCenter.y);

                if (actualDistance < Math.max(16, cfg.minBlinkDistance * 0.45)) {
                    state.charging = null;
                    state.accumulatedDistance = 0;
                    return;
                }

                const directionX = (destinationX - guardCenter.x) / actualDistance;
                const directionY = (destinationY - guardCenter.y) / actualDistance;
                this.startPhongLoiBlinkTransit(guardCenter, destinationX, destinationY, directionX, directionY);
            }
            return;
        }

        if (!state.enabled) {
            state.accumulatedDistance = 0;
            return;
        }

        const movementDistance = Math.hypot(movementDx, movementDy);
        if (movementDistance < cfg.minMoveSpeed) {
            state.accumulatedDistance = 0;
            return;
        }

        const targetDx = this.x - guardCenter.x;
        const targetDy = this.y - guardCenter.y;
        const targetDistance = Math.hypot(targetDx, targetDy);

        if (targetDistance >= cfg.minMoveSpeed) {
            state.lastMoveVectorX = targetDx / targetDistance;
            state.lastMoveVectorY = targetDy / targetDistance;
        } else {
            state.lastMoveVectorX = movementDx / movementDistance;
            state.lastMoveVectorY = movementDy / movementDistance;
        }

        state.accumulatedDistance += movementDistance;

        if (state.accumulatedDistance < cfg.triggerTravelDistance) return;
        if ((now - (state.lastBlinkAt || 0)) < cfg.cooldownMs) return;

        const directionLength = Math.hypot(state.lastMoveVectorX, state.lastMoveVectorY);
        if (directionLength < 0.5) {
            state.accumulatedDistance = 0;
            return;
        }

        if (this.mana < cfg.manaCost) {
            state.accumulatedDistance = 0;

            if ((now - (state.lastFailAt || 0)) > 900) {
                state.lastFailAt = now;
                showNotify('Phong Lôi Sí thiếu linh lực để xé không gian.', this.getArtifactConfig('PHONG_LOI_SI')?.color || '#9fe8ff');
                this.triggerManaShake();
            }
            return;
        }

        this.beginPhongLoiBlinkCharge(guardCenter);
    },

    syncLandscapeMode() {
        const isLandscape = this.isTouchDevice && window.innerWidth > window.innerHeight;

        if (document.body) {
            document.body.classList.toggle('is-mobile-landscape', isLandscape);
        }

        if (!isLandscape && screen.orientation?.unlock) {
            try {
                screen.orientation.unlock();
            } catch (error) {
                // Trình duyệt có thể từ chối unlock ngoài fullscreen.
            }
        }

        return isLandscape;
    },

    requestLandscapeMode() {
        if (!this.isTouchDevice || !this.syncLandscapeMode()) return;

        const now = performance.now();
        if (now - (this.landscapeMode.lastRequestAt || 0) < 600) return;
        this.landscapeMode.lastRequestAt = now;

        const root = document.documentElement;
        let fullscreenTask = Promise.resolve(null);

        if (!document.fullscreenElement) {
            try {
                if (typeof root.requestFullscreen === 'function') {
                    fullscreenTask = Promise.resolve(root.requestFullscreen({ navigationUI: 'hide' })).catch(() => null);
                } else if (typeof root.webkitRequestFullscreen === 'function') {
                    root.webkitRequestFullscreen();
                }
            } catch (error) {
                fullscreenTask = Promise.resolve(null);
            }
        }

        Promise.resolve(fullscreenTask).finally(() => {
            if (screen.orientation?.lock) {
                screen.orientation.lock('landscape').catch(() => null);
            }
        });
    },

    updateMoveJoystickVisual() {
        const button = this.moveJoystick.button || document.getElementById('btn-move');
        if (!button) return;

        const distance = Math.hypot(this.moveJoystick.offsetX, this.moveJoystick.offsetY);
        const maxRadius = Math.max(1, this.moveJoystick.maxRadius || 1);
        const dragRatio = Math.max(0, Math.min(1, distance / maxRadius));

        button.style.setProperty('--move-stick-x', `${this.moveJoystick.offsetX}px`);
        button.style.setProperty('--move-stick-y', `${this.moveJoystick.offsetY}px`);
        button.style.setProperty('--move-drag-ratio', dragRatio.toFixed(3));
        button.classList.toggle('is-joystick-active', this.moveJoystick.active);
    },

    startMoveJoystick(pointerId, button, clientX, clientY) {
        if (!this.isTouchDevice || !button) return false;

        const rect = button.getBoundingClientRect();
        this.moveJoystick.active = true;
        this.moveJoystick.pointerId = pointerId;
        this.moveJoystick.centerX = rect.left + (rect.width / 2);
        this.moveJoystick.centerY = rect.top + (rect.height / 2);
        this.moveJoystick.maxRadius = Math.max(28, rect.width * 0.34);
        this.moveJoystick.button = button;

        this.updateMoveJoystick(clientX, clientY);
        return true;
    },

    updateMoveJoystick(clientX, clientY) {
        if (!this.moveJoystick.active) return;

        let offsetX = clientX - this.moveJoystick.centerX;
        let offsetY = clientY - this.moveJoystick.centerY;
        const distance = Math.hypot(offsetX, offsetY);
        const maxRadius = Math.max(1, this.moveJoystick.maxRadius || 1);

        if (distance > maxRadius) {
            const clampRatio = maxRadius / distance;
            offsetX *= clampRatio;
            offsetY *= clampRatio;
        }

        this.moveJoystick.offsetX = offsetX;
        this.moveJoystick.offsetY = offsetY;
        this.updateMoveJoystickVisual();
    },

    stopMoveJoystick(pointerId = null) {
        if (!this.moveJoystick.active) return;
        if (pointerId !== null && this.moveJoystick.pointerId !== pointerId) return;

        this.moveJoystick.active = false;
        this.moveJoystick.pointerId = null;
        this.moveJoystick.centerX = 0;
        this.moveJoystick.centerY = 0;
        this.moveJoystick.offsetX = 0;
        this.moveJoystick.offsetY = 0;
        this.moveJoystick.button = null;
        this.updateMoveJoystickVisual();
    },

    getMoveJoystickTarget() {
        if (!this.moveJoystick.active) return null;

        const distance = Math.hypot(this.moveJoystick.offsetX, this.moveJoystick.offsetY);
        const maxRadius = Math.max(1, this.moveJoystick.maxRadius || 1);
        const deadZone = Math.max(0, this.moveJoystick.deadZone || 0);
        const effectiveRatio = Math.max(0, Math.min(1, (distance - deadZone) / Math.max(1, maxRadius - deadZone)));

        if (effectiveRatio <= 0) {
            return { x: guardCenter.x, y: guardCenter.y };
        }

        const normX = this.moveJoystick.offsetX / distance;
        const normY = this.moveJoystick.offsetY / distance;
        const cursorSpeed = Math.max(0.2, parseFloat(CONFIG.INPUT.JOYSTICK_CURSOR_SPEED) || 1);
        const worldDistance = (this.moveJoystick.aimDistance * effectiveRatio * cursorSpeed) / Math.max(0.001, Camera.currentZoom || 1);
        const nextX = guardCenter.x + (normX * worldDistance);
        const nextY = guardCenter.y + (normY * worldDistance);
        const safeMargin = Math.max(8, 16 * scaleFactor);
        const minVisible = Camera.screenToWorld(safeMargin, safeMargin);
        const maxVisible = Camera.screenToWorld(window.innerWidth - safeMargin, window.innerHeight - safeMargin);

        return {
            x: Math.max(minVisible.x, Math.min(maxVisible.x, nextX)),
            y: Math.max(minVisible.y, Math.min(maxVisible.y, nextY))
        };
    },

    getTouchHitTarget(target = null, clientX = null, clientY = null) {
        if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
            const pointTarget = document.elementFromPoint(clientX, clientY);
            if (pointTarget instanceof Element) return pointTarget;
        }

        return target instanceof Element ? target : null;
    },

    isUiInteractionTarget(target) {
        if (!(target instanceof Element)) return false;

        return Boolean(
            target.closest('.controls-layer') ||
            target.closest('.popup-overlay') ||
            target.closest('#mana-container') ||
            target.closest('#exp-container') ||
            target.closest('#sword-counter') ||
            target.closest('button, input, select, textarea, label, a, summary')
        );
    },

    updateTouchCursor(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
        this.screenX = clientX;
        this.screenY = clientY;
    },

    startTouchCursor(pointerId, target, clientX, clientY) {
        if (!this.isTouchDevice || pointerId == null) return false;
        if (hasVisiblePopupOverlay()) return false;

        const hitTarget = this.getTouchHitTarget(target, clientX, clientY);
        if (this.isUiInteractionTarget(hitTarget)) return false;

        this.touchCursor.active = true;
        this.touchCursor.pointerId = pointerId;
        this.updateTouchCursor(clientX, clientY);
        return true;
    },

    stopTouchCursor(pointerId = null) {
        if (!this.touchCursor.active) return;
        if (pointerId !== null && this.touchCursor.pointerId !== pointerId) return;

        this.touchCursor.active = false;
        this.touchCursor.pointerId = null;
    },

    hasActiveTouchCursor() {
        return this.touchCursor.active && !this.pinchZoomActive;
    },

    getAuraPalette() {
        const now = performance.now();
        if (this.specialAuraMode && this.specialAuraExpiresAt !== Number.POSITIVE_INFINITY && this.specialAuraExpiresAt <= now) {
            this.setSpecialAura(null);
        }

        if (this.isVoidCollapsed || this.specialAuraMode === 'void') {
            return {
                shadowColor: "#2f103f",
                particleColor: "rgba(140, 92, 255, 0.42)",
                layers: [
                    { w: 15, h: 28, color: "rgba(8, 4, 16, 0.82)", f: 0.75 },
                    { w: 10, h: 19, color: "rgba(56, 17, 83, 0.92)", f: 1.1 },
                    { w: 6, h: 12, color: "rgba(26, 3, 35, 0.98)", f: 1.65 }
                ]
            };
        }

        if (this.specialAuraMode === 'rainbow') {
            const hue = (now * 0.06) % 360;
            return {
                shadowColor: hslaColor(hue, 100, 68, 1),
                particleColor: hslaColor((hue + 60) % 360, 100, 76, 0.56),
                layers: [
                    { w: 15, h: 28, color: hslaColor(hue, 100, 60, 0.30), f: 0.8 },
                    { w: 10, h: 20, color: hslaColor((hue + 120) % 360, 100, 64, 0.86), f: 1.2 },
                    { w: 6, h: 12, color: hslaColor((hue + 240) % 360, 100, 82, 0.96), f: 1.75 }
                ]
            };
        }

        const berserkEffect = this.activeEffects.find(effect => effect.auraMode === 'berserk');
        if (!berserkEffect) {
            return {
                shadowColor: "#00ffff",
                particleColor: "rgba(150, 255, 255, 0.5)",
                layers: [
                    { w: 12, h: 22, color: "rgba(0, 102, 255, 0.3)", f: 0.8 },
                    { w: 8, h: 16, color: "#00d9ff", f: 1.2 },
                    { w: 5, h: 10, color: "#e0ffff", f: 1.8 }
                ]
            };
        }

        return {
            shadowColor: "#ff4d4f",
            particleColor: "rgba(255, 180, 120, 0.65)",
            layers: [
                { w: 14, h: 26, color: "rgba(120, 0, 0, 0.28)", f: 0.8 },
                { w: 10, h: 19, color: "#ff5b47", f: 1.25 },
                { w: 6, h: 12, color: "#ffe5b4", f: 1.85 }
            ]
        };
    },

    addRage(amount) {
        const safeAmount = Math.max(0, Math.round(amount || 0));
        this.rage = Math.min(this.maxRage, this.rage + safeAmount);
        this.renderRageUI();
    },

});
