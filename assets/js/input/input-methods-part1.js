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
        }

        this.updateSingleSwordUltimateChargeUI(
            state.chargeRatio || 0,
            state.charging,
            state.active
        );
    },

    updateSingleSwordUltimateChargeUI(chargeRatio = 0, isCharging = false, isReady = false) {
        const attackBtn = document.getElementById('btn-attack');
        if (!attackBtn) return;
        const safeRatio = Math.max(0, Math.min(1, Number(chargeRatio) || 0));
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
                size: 1 + (chargeRatio * 0.9),
                damageScale: 0.4 + (chargeRatio * 1.2),
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
        this.updateSingleSwordUltimateChargeUI(0, false, false);
    },

    isSingleSwordTapAttackMode() {
        if (this.isInsectSwarmActive()) return false;

        const swordStats = this.getAliveSwordStats();
        return swordStats.alive <= 1;
    },

    isSingleSwordPreThanhLinhState() {
        if (this.isInsectSwarmActive()) return false;
        if (this.hasThanhLinhKiemQuyetUnlocked()) return false;

        const swordStats = this.getAliveSwordStats();
        return swordStats.alive <= 1;
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

    performSingleSwordTapStrike() {
        if (!Array.isArray(enemies) || !enemies.length) return false;
        const attackRange = 140 * scaleFactor;
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
            const arcRadius = (28 + (Math.sin(now * 0.024) * 4)) * scaleFactor * (projectile.size || 1);

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

        // 1. Tính toán chi phí di chuyển
        // Nếu tốc độ > 1 (tránh nhiễu khi chuột rung nhẹ)
        if (!isBlinkTransiting && this.speed > 1) {
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
        this.lastEnemyDamageAt = performance.now();
        this.updateHealth(-safeDamage, source);
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
