// Consolidated from input-methods-part5.js and input-methods-part6.js
// Purpose: item, artifact and inventory utility methods

Object.assign(Input, {
    isNguCucSonComposite(uniqueKey) {
        return uniqueKey === 'NGUYEN_HOP_NGU_CUC_SON';
    },

    isNguCucSonComponent(uniqueKey) {
        return this.getNguCucSonComponentKeys().includes(uniqueKey);
    },

    isNguCucSonCombined() {
        return Boolean(this.nguCucSonCombined) && this.hasAllNguCucSonUnlocked();
    },

    setNguCucSonCombined(nextCombined, { silent = false, skipRefresh = false } = {}) {
        if (!this.hasAllNguCucSonUnlocked()) {
            if (!silent) showNotify('Cần luyện hóa đủ cả năm cực sơn mới có thể kết hợp.', '#ffd76a');
            return false;
        }
        if (!this.activeArtifacts) this.activeArtifacts = {};

        const normalized = Boolean(nextCombined);
        if (this.isNguCucSonCombined() === normalized) return false;

        this.nguCucSonCombined = normalized;
        if (normalized) {
            this.getNguCucSonComponentKeys().forEach(componentKey => {
                this.activeArtifacts[componentKey] = false;
            });
        } else {
            this.activeArtifacts.NGUYEN_HOP_NGU_CUC_SON = false;
        }

        if (!silent) {
            showNotify(
                normalized
                    ? 'Ngũ cực sơn đã kết hợp thành Nguyên Hợp Ngũ Cực Sơn.'
                    : 'Nguyên Hợp Ngũ Cực Sơn đã tách rời về năm cực sơn.',
                this.getArtifactConfig('NGUYEN_HOP_NGU_CUC_SON')?.color || '#ffd76a'
            );
        }

        if (skipRefresh) {
            this.renderAttackModeUI();
        } else {
            this.refreshResourceUI();
        }
        return true;
    },

    toggleNguCucSonCombined() {
        return this.setNguCucSonCombined(!this.isNguCucSonCombined());
    },

    getNguCucSonComponentKeys() {
        const componentKeys = this.getArtifactConfig('NGUYEN_HOP_NGU_CUC_SON')?.componentKeys;
        return Array.isArray(componentKeys) ? componentKeys : [];
    },

    hasAllNguCucSonPurchased() {
        const componentKeys = this.getNguCucSonComponentKeys();
        return componentKeys.length > 0 && componentKeys.every(key => this.hasUniquePurchase(key));
    },

    hasAllNguCucSonUnlocked() {
        const componentKeys = this.getNguCucSonComponentKeys();
        return componentKeys.length > 0 && componentKeys.every(key => this.hasCultivationArt(key));
    },

    getActiveNguCucSonKeys() {
        const componentKeys = this.getNguCucSonComponentKeys();
        if (!componentKeys.length) return [];
        if (this.isArtifactDeployed('NGUYEN_HOP_NGU_CUC_SON')) {
            return componentKeys;
        }
        return componentKeys.filter(key => this.isArtifactDeployed(key));
    },

    isNguCucSonBarrierActive() {
        return this.getActiveNguCucSonKeys().length > 0;
    },

    ensureNguCucSonGuardState() {
        if (!this.nguCucSonGuard) {
            this.nguCucSonGuard = {
                blockCount: 0,
                lastBlockedAt: 0,
                lastNotifyAt: 0
            };
        }
        return this.nguCucSonGuard;
    },

    isNguCucSonCompositeShieldActive() {
        return this.isArtifactDeployed('NGUYEN_HOP_NGU_CUC_SON');
    },

    getNguCucSonCompositeShieldConfig() {
        const shieldConfig = this.getArtifactConfig('NGUYEN_HOP_NGU_CUC_SON')?.shield || {};
        return {
            maxCapacity: Math.max(1, Math.floor(Number(shieldConfig.MAX_CAPACITY) || 360)),
            damageReductionPct: clampNumber(Number(shieldConfig.DAMAGE_REDUCTION_PCT) || 0.9, 0, 1),
            crackRecoverPerSec: clampNumber(Number(shieldConfig.CRACK_RECOVER_PER_SEC) || 0.13, 0, 1)
        };
    },

    ensureNguCucSonCompositeShieldState() {
        if (!this.nguCucSonCompositeShield) {
            const maxCapacity = this.getNguCucSonCompositeShieldConfig().maxCapacity;
            this.nguCucSonCompositeShield = {
                maxCapacity,
                currentCapacity: maxCapacity,
                crackIntensity: 0,
                lastHitAt: 0,
                lastRecoverAt: performance.now()
            };
        }
        return this.nguCucSonCompositeShield;
    },

    resetNguCucSonCompositeShieldCapacity() {
        const state = this.ensureNguCucSonCompositeShieldState();
        const cfg = this.getNguCucSonCompositeShieldConfig();
        state.maxCapacity = cfg.maxCapacity;
        state.currentCapacity = cfg.maxCapacity;
        state.crackIntensity = 0;
        state.lastRecoverAt = performance.now();
        return state;
    },

    tickNguCucSonCompositeShieldRecovery(now = performance.now()) {
        if (!this.isNguCucSonCompositeShieldActive()) return;
        const state = this.ensureNguCucSonCompositeShieldState();
        const cfg = this.getNguCucSonCompositeShieldConfig();
        const elapsedSec = Math.max(0, (now - (state.lastRecoverAt || now)) / 1000);
        if (elapsedSec <= 0) return;

        if (state.crackIntensity > 0) {
            state.crackIntensity = clampNumber(state.crackIntensity - (cfg.crackRecoverPerSec * elapsedSec), 0, 1);
        }

        state.lastRecoverAt = now;
    },

    absorbDamageWithNguCucSonComposite(rawDamage) {
        const incomingDamage = Math.max(0, Number(rawDamage) || 0);
        if (incomingDamage <= 0 || !this.isNguCucSonCompositeShieldActive()) return null;

        const state = this.ensureNguCucSonCompositeShieldState();
        const cfg = this.getNguCucSonCompositeShieldConfig();
        if (state.currentCapacity <= 0) return null;

        const mitigated = incomingDamage * cfg.damageReductionPct;
        const absorbed = Math.min(state.currentCapacity, mitigated);
        if (absorbed <= 0) return null;

        state.currentCapacity = Math.max(0, state.currentCapacity - absorbed);
        const damageRatio = absorbed / Math.max(1, state.maxCapacity);
        state.crackIntensity = clampNumber(state.crackIntensity + (damageRatio * 1.7), 0, 1);
        state.lastHitAt = performance.now();
        state.lastRecoverAt = state.lastHitAt;

        return {
            absorbed,
            remainingDamage: Math.max(0, incomingDamage - absorbed),
            depleted: state.currentCapacity <= 0
        };
    },

    getNguCucSonOrbitNodes(scaleFactor = 1, now = performance.now()) {
        if (this.isNguCucSonCompositeShieldActive()) return [];
        const activeKeys = this.getActiveNguCucSonKeys();
        if (!activeKeys.length) return [];

        const count = activeKeys.length;
        const ringRadius = (22 + (count * 3.4)) * scaleFactor;
        const spinDirection = this.isArtifactDeployed('NGUYEN_HOP_NGU_CUC_SON') ? 1 : -1;
        const spinSpeed = this.isArtifactDeployed('NGUYEN_HOP_NGU_CUC_SON') ? 0.0019 : 0.00135;
        const baseAngle = now * spinSpeed * spinDirection;

        return activeKeys.map((key, index) => {
            const cfg = this.getArtifactConfig(key) || {};
            const angle = baseAngle + ((Math.PI * 2 * index) / count);
            const bob = Math.sin((now * 0.0038) + (index * 0.8)) * 1.4 * scaleFactor;
            const x = this.x + (Math.cos(angle) * (ringRadius + bob));
            const y = this.y + (Math.sin(angle) * (ringRadius + bob));
            return {
                key,
                x,
                y,
                angle,
                orbitRadius: ringRadius,
                bodyRadius: Math.max(5, 7.6 * scaleFactor),
                color: cfg.color || '#ffd76a',
                secondaryColor: cfg.secondaryColor || '#fff2c7',
                auraColor: cfg.auraColor || '#b78b1d'
            };
        });
    },

    tryBlockWithNguCucSon(impactX, impactY, threatRadius = 6, source = 'đòn đánh') {
        if (this.isNguCucSonCompositeShieldActive()) return false;
        if (!this.isNguCucSonBarrierActive()) return false;
        const now = performance.now();
        const nodes = this.getNguCucSonOrbitNodes(1, now);
        if (!nodes.length) return false;

        const safeThreatRadius = Math.max(2, Number(threatRadius) || 6);
        const blockingNode = nodes.find(node => Math.hypot((impactX || 0) - node.x, (impactY || 0) - node.y) <= (node.bodyRadius + safeThreatRadius));
        if (!blockingNode) return false;

        const state = this.ensureNguCucSonGuardState();
        state.blockCount += 1;
        state.lastBlockedAt = now;

        trimVisualParticles(320);
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6 + random(-0.22, 0.22);
            const speed = random(0.5, 1.8);
            visualParticles.push({
                type: 'spark',
                x: blockingNode.x,
                y: blockingNode.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: random(1.1, 2.1),
                life: 0.45,
                decay: random(0.06, 0.085),
                color: blockingNode.secondaryColor,
                glow: blockingNode.color
            });
        }

        if (now - (state.lastNotifyAt || 0) > 520) {
            showNotify(`Ngũ Cực Sơn cản lại ${source}.`, blockingNode.color, 650);
            state.lastNotifyAt = now;
        }

        return true;
    },

    hasKnownThanhLinhKiemQuyet() {
        return this.hasUniquePurchase('THANH_LINH_KIEM_QUYET')
            || this.hasThanhLinhKiemQuyetUnlocked()
            || this.hasSecretArtInInventory('THANH_LINH_KIEM_QUYET');
    },

    getArtifactConfig(uniqueKey) {
        return CONFIG.ARTIFACTS?.[uniqueKey]
            || (uniqueKey === 'CAN_LAM_BANG_DIEM' ? CONFIG.SECRET_ARTS?.CAN_LAM_BANG_DIEM : null)
            || null;
    },

    getArtifactAttunementNote(uniqueKey) {
        const artifactConfig = this.getArtifactConfig(uniqueKey) || {};
        if (uniqueKey === 'PHONG_LOI_SI') {
            return 'phong lôi linh dực đã hiện bên tâm ấn.';
        }
        if (uniqueKey === 'HUYET_SAC_PHI_PHONG') {
            const speedBonus = Math.round((Number(artifactConfig.speedBonusPct) || 0) * 100);
            return `huyết ảnh đã quấn quanh thân pháp, tốc độ di chuyển tăng ${formatNumber(speedBonus)}% và sẽ lưu huyết quang phía sau.`;
        }
        if (uniqueKey === 'HU_THIEN_DINH') {
            const maxShield = Math.max(1, Math.floor(Number(artifactConfig.shield?.MAX_CAPACITY) || 280));
            return `đỉnh ảnh đã kết thành hộ thuẫn, có thể hấp thụ tối đa ${formatNumber(maxShield)} sát thương trước khi nứt vỡ.`;
        }
        return 'pháp bảo đã hiện bên tâm ấn.';
    },

    getArtifactStatusNote(uniqueKey, { active = false, unlocked = false, purchased = false } = {}) {
        const artifactConfig = this.getArtifactConfig(uniqueKey) || {};

        if (uniqueKey === 'PHONG_LOI_SI') {
            if (active) {
                return this.isPhongLoiBlinkEnabled()
                    ? 'Linh dực phong lôi đang hộ tại hai bên con trỏ, thân pháp dịch chuyển đã bật.'
                    : 'Linh dực phong lôi đang hộ tại hai bên con trỏ, thân pháp dịch chuyển đang tắt.';
            }
        } else if (uniqueKey === 'HUYET_SAC_PHI_PHONG') {
            const speedBonus = Math.round((Number(artifactConfig.speedBonusPct) || 0) * 100);
            if (active) {
                return `Huyết ảnh đang kéo dài sau thân pháp, tốc độ di chuyển tăng ${formatNumber(speedBonus)}% và để lại một đạo hồng tuyến.`;
            }
            if (unlocked) {
                return `Đã luyện hóa, có thể triển khai để tăng ${formatNumber(speedBonus)}% tốc độ di chuyển.`;
            }
        } else if (uniqueKey === 'HU_THIEN_DINH') {
            const shieldState = this.ensureHuThienDinhShieldState();
            if (active) {
                return `Đỉnh ảnh đang hộ thể (${formatNumber(Math.max(0, shieldState.currentCapacity))}/${formatNumber(Math.max(1, shieldState.maxCapacity))}), hấp thụ sát thương và nứt dần theo từng đợt công kích.`;
            }
            if (unlocked) {
                return 'Đã luyện hóa, có thể triển khai Đỉnh ảnh để tạo lá chắn hộ thể cực mạnh.';
            }
        } else if (this.isNguCucSonComposite(uniqueKey)) {
            const shieldState = this.ensureNguCucSonCompositeShieldState();
            if (active) {
                return `Ngũ sắc cực sơn đang hộ thể (${formatNumber(Math.max(0, shieldState.currentCapacity))}/${formatNumber(Math.max(1, shieldState.maxCapacity))}), có thể nứt vỡ khi chịu quá nhiều sát thương.`;
            }
            if (unlocked) {
                return this.isNguCucSonCombined()
                    ? 'Đã kết hợp thành công, có thể triển khai hoặc thu hồi như một pháp bảo hoàn chỉnh.'
                    : 'Đã luyện hóa đủ năm cực sơn, nhấn Kết hợp để hợp thành pháp bảo hoàn chỉnh.';
            }
            if (purchased) {
                return 'Đã mua đủ ngũ cực sơn, hãy luyện hóa đủ cả năm để mở nút Kết hợp.';
            }
        }

        if (unlocked) {
            const consciousnessCost = this.getArtifactConsciousnessCost(uniqueKey);
            if (consciousnessCost > 0) {
                return `Đã luyện hóa, triển khai sẽ tiêu hao ${formatNumber(consciousnessCost)} thần thức.`;
            }
            return 'Đã luyện hóa, có thể triển khai hoặc thu hồi bất kỳ lúc nào.';
        }

        if (purchased) {
            return 'Đã mua nhưng còn chờ luyện hóa trong túi trữ vật.';
        }

        return 'Chưa từng kết duyên với pháp bảo này.';
    },

    getArtifactDeploymentMessage(uniqueKey, nextActive) {
        const artifactConfig = this.getArtifactConfig(uniqueKey) || {};

        if (uniqueKey === 'PHONG_LOI_SI') {
            return nextActive
                ? `${artifactConfig.fullName} đã khai triển bên tâm ấn.`
                : `${artifactConfig.fullName} đã thu vào thần hải.`;
        }

        if (uniqueKey === 'HUYET_SAC_PHI_PHONG') {
            return nextActive
                ? `${artifactConfig.fullName} đã triển khai sau lưng thân pháp.`
                : `${artifactConfig.fullName} đã thu vào thần hải.`;
        }
        if (uniqueKey === 'HU_THIEN_DINH') {
            return nextActive
                ? `${artifactConfig.fullName} đã dựng Đỉnh ảnh hộ thể.`
                : `${artifactConfig.fullName} đã thu vào thần hải.`;
        }
        if (this.isNguCucSonComposite(uniqueKey)) {
            return nextActive
                ? `${artifactConfig.fullName} đã triển khai ngũ sắc sơn ảnh hộ thể.`
                : `${artifactConfig.fullName} đã thu vào thần hải.`;
        }

        return nextActive
            ? `${artifactConfig.fullName || uniqueKey} đã khai triển bên tâm ấn.`
            : `${artifactConfig.fullName || uniqueKey} đã thu vào thần hải.`;
    },

    getArtifactConsciousnessCost(uniqueKey) {
        const artifactConfig = this.getArtifactConfig(uniqueKey) || {};
        if (!artifactConfig.deployLabel && !artifactConfig.stowLabel) return 0;

        const configuredCost = Number(artifactConfig.consciousnessCost);
        if (Number.isFinite(configuredCost)) {
            return Math.max(0, Math.floor(configuredCost));
        }

        return 1;
    },

    getDeployedArtifactConsciousnessUsage({ excludeKey = null } = {}) {
        if (!this.activeArtifacts) return 0;

        return Object.entries(this.activeArtifacts).reduce((total, [artifactKey, isActive]) => {
            if (!isActive || artifactKey === excludeKey) return total;
            return total + this.getArtifactConsciousnessCost(artifactKey);
        }, 0);
    },

    getAvailableConsciousnessForArtifacts({ excludeKey = null } = {}) {
        const baseConsciousness = Math.max(0, Math.floor(Number(this.getSwordConsciousnessStat?.()) || 0));
        const usedConsciousness = this.getDeployedArtifactConsciousnessUsage({ excludeKey });
        return Math.max(0, baseConsciousness - usedConsciousness);
    },

    hasArtifactPurchased(uniqueKey) {
        if (this.isNguCucSonComposite(uniqueKey)) {
            return this.hasAllNguCucSonPurchased();
        }
        return Boolean(uniqueKey && this.hasUniquePurchase(uniqueKey));
    },

    hasArtifactUnlocked(uniqueKey) {
        if (this.isNguCucSonComposite(uniqueKey)) {
            return this.hasAllNguCucSonUnlocked();
        }
        return Boolean(uniqueKey && this.hasCultivationArt(uniqueKey));
    },

    isArtifactDeployed(uniqueKey) {
        return Boolean(uniqueKey && this.activeArtifacts?.[uniqueKey] && this.hasArtifactUnlocked(uniqueKey));
    },

    hasKnownArtifact() {
        const artifactKeys = new Set([...Object.keys(CONFIG.ARTIFACTS || {}), 'CAN_LAM_BANG_DIEM']);
        return Array.from(artifactKeys).some(uniqueKey => this.hasArtifactPurchased(uniqueKey) || this.hasArtifactUnlocked(uniqueKey));
    },

    hasActiveArtifact() {
        const artifactKeys = new Set([...Object.keys(CONFIG.ARTIFACTS || {}), 'CAN_LAM_BANG_DIEM']);
        return Array.from(artifactKeys).some(uniqueKey => this.isArtifactDeployed(uniqueKey));
    },

    getActiveArtifactNames() {
        const artifactKeys = new Set([...Object.keys(CONFIG.ARTIFACTS || {}), 'CAN_LAM_BANG_DIEM']);
        return Array.from(artifactKeys)
            .filter(uniqueKey => this.isArtifactDeployed(uniqueKey))
            .map(uniqueKey => this.getArtifactConfig(uniqueKey)?.fullName || uniqueKey);
    },

    getThanhTrucSwordThunderConfig() {
        return this.getThanhTrucSwordArtifactConfig()?.thunderStrike || {};
    },

    triggerThanhTrucSwordThunder(target, { shielded = false, scaleFactor = 1 } = {}) {
        const progress = this.getSwordFormationProgress();
        if (!target || progress.bonded <= 0) return false;

        const cfg = this.getThanhTrucSwordThunderConfig();
        const triggerChance = this.attackMode === 'SWORD'
            ? Math.max(0, Math.min(1, Number(cfg.FORMATION_TRIGGER_CHANCE) || 0.32))
            : Math.max(0, Math.min(1, Number(cfg.TRIGGER_CHANCE) || 0.18));

        if (Math.random() > triggerChance) return false;

        const x = Number(target.x) || this.x;
        const y = Number(target.y) || this.y;
        const primaryColor = this.getThanhTrucSwordArtifactConfig()?.color || '#66f0c2';
        const secondaryColor = this.getThanhTrucSwordArtifactConfig()?.secondaryColor || '#dffef2';
        const lightningLight = CONFIG.COLORS?.SWORD_GOLD_LIGHT || '#FFF2C2';
        const lightningMid = CONFIG.COLORS?.SWORD_GOLD_MID || '#E6C87A';
        const intensity = Math.max(0.24, progress.formationBonded / Math.max(1, progress.required));

        trimVisualParticles(280);
        visualParticles.push({
            type: 'ring',
            x,
            y,
            radius: 12 * scaleFactor,
            radialVelocity: (20 + (intensity * 18)) * scaleFactor,
            lineWidth: 2.2 + (intensity * 1.2),
            color: secondaryColor,
            glow: 18,
            life: 0.9,
            decay: 0.08
        });

        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 / 4) * i + (Math.random() * 0.5);
            visualParticles.push({
                type: 'ray',
                x,
                y,
                angle,
                radius: 4 * scaleFactor,
                length: (16 + (intensity * 14)) * scaleFactor,
                lengthVelocity: 1.2 * scaleFactor,
                lineWidth: 1.6 + (intensity * 0.8),
                color: i % 2 === 0 ? lightningLight : lightningMid,
                glow: 16,
                life: 0.82,
                decay: 0.09
            });
        }

        if (typeof target.applyMovementLock === 'function') {
            target.applyMovementLock(Math.max(40, Math.floor((Number(cfg.MOVEMENT_LOCK_MS) || 180) * (shielded ? 1.15 : 1))));
        }
        if (typeof target.applySlow === 'function') {
            target.applySlow(
                Math.max(120, Math.floor((Number(cfg.SLOW_MS) || 1000) * (shielded ? 1.15 : 1))),
                Math.max(0.2, Math.min(1, Number(cfg.SLOW_FACTOR) || 0.72))
            );
        }
        if (typeof target.suppressDodge === 'function') {
            target.suppressDodge(Math.max(120, Math.floor((Number(cfg.DODGE_SUPPRESS_MS) || 1200) * (shielded ? 1.2 : 1))));
        }
        if (typeof target.blockShieldRecovery === 'function') {
            target.blockShieldRecovery(Math.max(120, Math.floor((Number(cfg.SHIELD_BLOCK_MS) || 1600) * (shielded ? 1.2 : 1))));
        }

        return true;
    },

    ensurePhongLoiBlinkState() {
        if (!this.phongLoiBlink) {
            this.phongLoiBlink = {
                enabled: false,
                accumulatedDistance: 0,
                lastBlinkAt: 0,
                lastFailAt: 0,
                lastMoveVectorX: 0,
                lastMoveVectorY: 0,
                charging: null,
                transiting: null,
                trails: [],
                afterimages: []
            };
        }

        return this.phongLoiBlink;
    },

    getPhongLoiBlinkConfig() {
        const blinkConfig = this.getArtifactConfig('PHONG_LOI_SI')?.teleportSkill || {};

        return {
            name: blinkConfig.NAME || 'Phong Lôi Độn',
            chargeMs: Math.max(0, parseInt(blinkConfig.CHARGE_MS, 10) || 90),
            cooldownMs: Math.max(0, parseInt(blinkConfig.COOLDOWN_MS, 10) || 320),
            manaCost: Math.max(0, Number(blinkConfig.MANA_COST) || 18),
            triggerTravelDistance: Math.max(24, Number(blinkConfig.TRIGGER_TRAVEL_DISTANCE) || 140),
            blinkDistance: Math.max(32, Number(blinkConfig.BLINK_DISTANCE) || 220),
            minBlinkDistance: Math.max(24, Number(blinkConfig.MIN_BLINK_DISTANCE) || 88),
            minMoveSpeed: Math.max(0.05, Number(blinkConfig.MIN_MOVE_SPEED) || 0.8),
            afterimageMs: Math.max(120, parseInt(blinkConfig.AFTERIMAGE_MS, 10) || 280),
            trailMs: Math.max(120, parseInt(blinkConfig.TRAIL_MS, 10) || 260),
            flashMs: Math.max(40, parseInt(blinkConfig.FLASH_MS, 10) || 80),
            transitionMs: Math.max(20, parseInt(blinkConfig.TRANSITION_MS, 10) || 48),
            impactRadius: Math.max(10, Number(blinkConfig.IMPACT_RADIUS) || 26)
        };
    },

    ensureHuThienDinhShieldState() {
        if (!this.huThienDinhShield) {
            const maxCapacity = this.getHuThienDinhShieldConfig().maxCapacity;
            this.huThienDinhShield = {
                maxCapacity,
                currentCapacity: maxCapacity,
                crackIntensity: 0,
                lastHitAt: 0,
                lastRecoverAt: performance.now()
            };
        }

        return this.huThienDinhShield;
    },

    getHuThienDinhShieldConfig() {
        const shieldConfig = this.getArtifactConfig('HU_THIEN_DINH')?.shield || {};
        return {
            maxCapacity: Math.max(1, Math.floor(Number(shieldConfig.MAX_CAPACITY) || 280)),
            damageReductionPct: clampNumber(Number(shieldConfig.DAMAGE_REDUCTION_PCT) || 0.92, 0, 1),
            crackRecoverPerSec: clampNumber(Number(shieldConfig.CRACK_RECOVER_PER_SEC) || 0.16, 0, 1)
        };
    },

    resetHuThienDinhShieldCapacity() {
        const state = this.ensureHuThienDinhShieldState();
        const cfg = this.getHuThienDinhShieldConfig();
        state.maxCapacity = cfg.maxCapacity;
        state.currentCapacity = cfg.maxCapacity;
        state.crackIntensity = 0;
        state.lastRecoverAt = performance.now();
        return state;
    },

    absorbDamageWithHuThienDinh(rawDamage) {
        const incomingDamage = Math.max(0, Number(rawDamage) || 0);
        if (incomingDamage <= 0 || !this.isArtifactDeployed('HU_THIEN_DINH')) return null;

        const state = this.ensureHuThienDinhShieldState();
        const cfg = this.getHuThienDinhShieldConfig();
        if (state.currentCapacity <= 0) return null;

        const mitigated = incomingDamage * cfg.damageReductionPct;
        const absorbed = Math.min(state.currentCapacity, mitigated);
        if (absorbed <= 0) return null;

        state.currentCapacity = Math.max(0, state.currentCapacity - absorbed);
        const damageRatio = absorbed / Math.max(1, state.maxCapacity);
        state.crackIntensity = clampNumber(state.crackIntensity + (damageRatio * 1.65), 0, 1);
        state.lastHitAt = performance.now();
        state.lastRecoverAt = state.lastHitAt;

        const remainingDamage = Math.max(0, incomingDamage - absorbed);
        const depleted = state.currentCapacity <= 0;
        return { absorbed, remainingDamage, depleted };
    },

    tickHuThienDinhShieldRecovery(now = performance.now()) {
        if (!this.isArtifactDeployed('HU_THIEN_DINH')) return;
        const state = this.ensureHuThienDinhShieldState();
        const cfg = this.getHuThienDinhShieldConfig();
        const elapsedSec = Math.max(0, (now - (state.lastRecoverAt || now)) / 1000);
        if (elapsedSec <= 0) return;

        if (state.crackIntensity > 0) {
            state.crackIntensity = clampNumber(state.crackIntensity - (cfg.crackRecoverPerSec * elapsedSec), 0, 1);
        }

        state.lastRecoverAt = now;
    },

    hasPhongLoiBlinkSkill() {
        return this.isArtifactDeployed('PHONG_LOI_SI');
    },

    isPhongLoiBlinkEnabled() {
        return this.hasPhongLoiBlinkSkill() && Boolean(this.ensurePhongLoiBlinkState().enabled);
    },

    isPhongLoiBlinkCharging() {
        return Boolean(this.ensurePhongLoiBlinkState().charging);
    },

    isPhongLoiBlinkTransiting() {
        return Boolean(this.ensurePhongLoiBlinkState().transiting);
    },

    isPhongLoiBlinkBusy() {
        const state = this.ensurePhongLoiBlinkState();
        return Boolean(state.charging || state.transiting);
    },

    resetPhongLoiBlinkState({ clearEffects = false } = {}) {
        const state = this.ensurePhongLoiBlinkState();
        state.enabled = false;
        state.accumulatedDistance = 0;
        state.lastMoveVectorX = 0;
        state.lastMoveVectorY = 0;
        state.charging = null;
        state.transiting = null;

        if (clearEffects) {
            state.trails = [];
            state.afterimages = [];
        }

        return state;
    },

    renderPhongLoiBlinkButton() {
        const button = document.getElementById('btn-phong-loi-blink');
        if (!button) return;

        const label = button.querySelector('.phong-loi-toggle__state');
        const state = this.ensurePhongLoiBlinkState();
        const cfg = this.getPhongLoiBlinkConfig();
        const available = this.hasPhongLoiBlinkSkill();
        const enabled = available && Boolean(state.enabled);
        const charging = available && Boolean(state.charging);
        const costText = formatNumber(cfg.manaCost);

        button.classList.toggle('is-hidden', !available);
        button.classList.toggle('is-active', enabled);
        button.classList.toggle('is-charging', charging);
        button.style.display = available ? 'flex' : 'none';
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');

        if (label) {
            label.textContent = charging
                ? UI_TEXT.PHONG_LOI_SI_STATES.CHARGING
                : (enabled ? UI_TEXT.PHONG_LOI_SI_STATES.ACTIVE : UI_TEXT.PHONG_LOI_SI_STATES.INACTIVE);
        }

        const title = !available
            ? 'Phong Lôi Sí chưa triển khai'
            : charging
                ? `Phong Lôi Sí đang tụ lôi - hao ${costText} linh lực`
                : enabled
                    ? `Phong Lôi Sí đang khai mở - ${cfg.name}, hao ${costText} linh lực mỗi lần dịch chuyển`
                    : `Phong Lôi Sí đang thu liễm - khai mở để kích hoạt ${cfg.name}`;

        button.title = title;
        button.setAttribute('aria-label', title);
    },

    renderCanLamCastButton() {
        const button = document.getElementById('btn-can-lam-cast');
        if (!button) return;

        const label = button.querySelector('.can-lam-toggle__state');
        const available = this.isArtifactDeployed('CAN_LAM_BANG_DIEM');

        button.classList.toggle('is-hidden', !available);
        button.classList.toggle('is-active', available);
        button.style.display = available ? 'flex' : 'none';
        button.setAttribute('aria-pressed', available ? 'true' : 'false');

        if (label) {
            label.textContent = available ? 'KHAI' : 'THU';
        }

        const castManaCost = Math.max(0, Number(this.getArtifactConfig('CAN_LAM_BANG_DIEM')?.castSkill?.MANA_COST) || 22);
        const title = available
            ? `Thi triển Càn Lam Băng Diễm vào mục tiêu gần nhất (hao ${formatNumber(castManaCost)} linh lực)`
            : 'Càn Lam Băng Diễm chưa triển khai';

        button.title = title;
        button.setAttribute('aria-label', title);
    },

    renderAlchemyLabButton() {
        const button = document.getElementById('btn-alchemy-lab');
        if (!button) return;

        const hasHuThienRefined = this.hasArtifactUnlocked('HU_THIEN_DINH');
        const hasPurchasedFurnace = Object.values(this.alchemyFurnaces || {}).some(Boolean);
        const ready = hasHuThienRefined && this.isArtifactDeployed('HU_THIEN_DINH');
        const title = !hasHuThienRefined && !hasPurchasedFurnace
            ? 'Cần mua đan lư hoặc mua rồi luyện hóa Hư Thiên Đỉnh để mở luyện đan'
            : ready
                ? 'Đan Lô đã sẵn sàng, có thể mở popup luyện đan'
                : 'Đã có đan lư nhưng chưa triển khai Hư Thiên Đỉnh, vẫn có thể luyện với hiệu quả thấp hơn';

        button.classList.toggle('is-hidden', !hasHuThienRefined && !hasPurchasedFurnace);
        button.classList.toggle('is-active', ready);
        button.style.display = (hasHuThienRefined || hasPurchasedFurnace) ? 'flex' : 'none';
        button.setAttribute('aria-label', title);
        button.setAttribute('title', title);
    },

    setPhongLoiBlinkEnabled(nextEnabled, { silent = false, force = false } = {}) {
        const state = this.ensurePhongLoiBlinkState();
        const available = this.hasPhongLoiBlinkSkill();
        const normalized = available && Boolean(nextEnabled);

        if (!force && !available) {
            this.renderPhongLoiBlinkButton();
            return false;
        }

        if (state.enabled === normalized && !(force && !normalized)) {
            this.renderPhongLoiBlinkButton();
            return false;
        }

        state.enabled = normalized;
        state.accumulatedDistance = 0;
        state.lastMoveVectorX = 0;
        state.lastMoveVectorY = 0;

        if (!normalized) {
            state.charging = null;
        }

        if (!silent) {
            const artifactColor = this.getArtifactConfig('PHONG_LOI_SI')?.color || '#9fe8ff';
            const blinkName = this.getPhongLoiBlinkConfig().name;
            showNotify(
                normalized
                    ? `${blinkName} đã khai mở theo Phong Lôi Sí.`
                    : `${blinkName} đã thu liễm về tâm ấn.`,
                artifactColor
            );
        }

        this.renderPhongLoiBlinkButton();
        if (SkillsUI && typeof SkillsUI.isOpen === 'function' && SkillsUI.isOpen()) {
            SkillsUI.render();
        }
        return true;
    },

    togglePhongLoiBlink() {
        return this.setPhongLoiBlinkEnabled(!this.isPhongLoiBlinkEnabled());
    },

    setArtifactDeployment(uniqueKey, nextActive, { silent = false, skipRefresh = false } = {}) {
        const artifactConfig = this.getArtifactConfig(uniqueKey);
        if (!artifactConfig || !this.hasArtifactUnlocked(uniqueKey)) return false;
        if (!this.activeArtifacts) this.activeArtifacts = {};

        const normalized = Boolean(nextActive);
        if (Boolean(this.activeArtifacts[uniqueKey]) === normalized) return false;
        if (uniqueKey === 'PHONG_LOI_SI' && normalized) {
            const equippedSwordCount = Array.isArray(this.getEquippedSwordArtifacts?.())
                ? this.getEquippedSwordArtifacts().length
                : 0;
            if (equippedSwordCount < 1) {
                showNotify('Cần trang bị ít nhất 1 Thanh Trúc Phong Vân Kiếm mới có thể triển khai Phong Lôi Sí.', artifactConfig.color || '#9fe8ff');
                return false;
            }
        }

        if (this.isNguCucSonComponent(uniqueKey) && normalized && this.isNguCucSonCombined()) {
            showNotify('Ngũ cực sơn đang ở trạng thái kết hợp, hãy tách rời trước khi triển khai từng núi con.', artifactConfig.color || '#ffd76a');
            return false;
        }
        if (this.isNguCucSonComposite(uniqueKey) && normalized && !this.isNguCucSonCombined()) {
            showNotify('Hãy kết hợp đủ ngũ cực sơn trước khi triển khai pháp bảo hợp thể.', artifactConfig.color || '#ffd76a');
            return false;
        }
        if (normalized) {
            const consciousnessCost = this.getArtifactConsciousnessCost(uniqueKey);
            if (consciousnessCost > 0) {
                const availableConsciousness = this.getAvailableConsciousnessForArtifacts({ excludeKey: uniqueKey });
                if (availableConsciousness < consciousnessCost) {
                    showNotify(
                        `Thần thức còn ${formatNumber(availableConsciousness)} không đủ để triển khai ${artifactConfig.fullName || uniqueKey} (cần ${formatNumber(consciousnessCost)}).`,
                        artifactConfig.color || '#9fe8ff'
                    );
                    return false;
                }
            }
        }

        if (this.isNguCucSonComposite(uniqueKey) && normalized) {
            this.getNguCucSonComponentKeys().forEach(componentKey => {
                this.activeArtifacts[componentKey] = false;
            });
        }
        if (!this.isNguCucSonComposite(uniqueKey) && normalized && this.isArtifactDeployed('NGUYEN_HOP_NGU_CUC_SON')) {
            this.activeArtifacts.NGUYEN_HOP_NGU_CUC_SON = false;
        }

        this.activeArtifacts[uniqueKey] = normalized;

        if (uniqueKey === 'PHONG_LOI_SI') {
            this.resetPhongLoiBlinkState({ clearEffects: !normalized });
        }
        if (uniqueKey === 'HUYET_SAC_PHI_PHONG') {
            this.clearHuyetSacPhiPhongTrail();
        }
        if (uniqueKey === 'CAN_LAM_BANG_DIEM') {
            this.renderCanLamCastButton();
        }
        if (uniqueKey === 'HU_THIEN_DINH') {
            if (normalized) {
                this.resetHuThienDinhShieldCapacity();
            }
        }
        if (uniqueKey === 'NGUYEN_HOP_NGU_CUC_SON' && normalized) {
            this.resetNguCucSonCompositeShieldCapacity();
        }

        if (!silent) {
            showNotify(this.getArtifactDeploymentMessage(uniqueKey, normalized), artifactConfig.color || '#9fe8ff');
        }

        if (skipRefresh) {
            this.renderAttackModeUI();
        } else {
            this.refreshResourceUI();
        }

        return true;
    },

    toggleArtifactDeployment(uniqueKey) {
        return this.setArtifactDeployment(uniqueKey, !this.isArtifactDeployed(uniqueKey));
    },

    enforcePhongLoiSiSwordRequirement({ silent = false } = {}) {
        if (!this.isArtifactDeployed('PHONG_LOI_SI')) return false;
        const equippedSwordCount = Array.isArray(this.getEquippedSwordArtifacts?.())
            ? this.getEquippedSwordArtifacts().length
            : 0;
        if (equippedSwordCount > 0) return false;

        this.setArtifactDeployment('PHONG_LOI_SI', false, { silent: true, skipRefresh: true });
        if (!silent) {
            showNotify('Đã thu hồi Phong Lôi Sí vì không còn Thanh Trúc Phong Vân Kiếm để dẫn lôi vận hành.', this.getArtifactConfig('PHONG_LOI_SI')?.color || '#9fe8ff');
        }
        return true;
    },

    getArtifactSkillList() {
        return Object.entries(CONFIG.ARTIFACTS || {}).map(([uniqueKey, artifactConfig]) => {
            const isComposite = this.isNguCucSonComposite(uniqueKey);
            if (isComposite && !this.hasAllNguCucSonUnlocked() && !this.isArtifactDeployed(uniqueKey)) {
                return null;
            }
            const purchased = this.hasArtifactPurchased(uniqueKey);
            const unlocked = this.hasArtifactUnlocked(uniqueKey);
            const active = this.isArtifactDeployed(uniqueKey);

            return {
                key: uniqueKey,
                uniqueKey,
                name: artifactConfig.fullName || uniqueKey,
                description: artifactConfig.description || 'Pháp bảo hộ thân có thể triển khai quanh tâm ấn.',
                purchased,
                unlocked,
                active,
                ready: unlocked,
                combined: isComposite ? this.isNguCucSonCombined() : false,
                accent: artifactConfig.color || '#9fe8ff',
                note: this.getArtifactStatusNote(uniqueKey, { active, unlocked, purchased })
            };
        }).filter(Boolean);
    },

    hasKyTrungBang() {
        return this.hasUniquePurchase('KY_TRUNG_BANG');
    },

    hasSpiritBeastBag() {
        return this.hasUniquePurchase('LINH_THU_DAI');
    },

    markDiscoveredInsect(speciesKey) {
        if (!this.getInsectSpecies(speciesKey)) return false;
        this.discoveredInsects[speciesKey] = true;
        return true;
    },

    hasUnlockedAttackSkill(mode) {
        if (mode === 'SWORD') return this.canDeployDaiCanhKiemTran();
        if (mode === 'INSECT') return this.hasKhuTrungThuatUnlocked();
        return mode === 'BASE';
    },

    hasActiveAttackSkill() {
        return this.attackMode === 'SWORD' || this.attackMode === 'INSECT';
    },

    getAttackModeDisplayName(mode = this.attackMode) {
        if (mode === 'SWORD') return ATTACK_MODE_LABELS.SWORD;
        if (mode === 'INSECT') return ATTACK_MODE_LABELS.INSECT;
        return ATTACK_MODE_LABELS.BASE;
    },

    canUseInsectAttackMode() {
        return this.hasKhuTrungThuatUnlocked() && this.getCombatReadyInsectCount() > 0;
    },

    isInsectSwarmActive() {
        return this.attackMode === 'INSECT' && this.canUseInsectAttackMode() && !this.isUltMode && !this.isUltimateBusy();
    },

    getAttackSkillList() {
        const formationLearned = this.hasDaiCanhKiemTranUnlocked();
        const formationReady = this.canDeployDaiCanhKiemTran();
        const swordStats = this.getAliveSwordStats();
        const swordProgress = this.getSwordFormationProgress();
        const hasSwordArtInInventory = Boolean(this.getInventoryEntryByUniqueKey('DAI_CANH_KIEM_TRAN', ['SWORD_ART']));
        const totalInsects = this.getTotalTamedInsectCount();
        const combatReadyCount = this.getCombatReadyInsectCount();
        const reservedCount = Math.max(0, totalInsects - combatReadyCount);

        return [
            {
                key: 'SWORD',
                name: SWORD_UI_TEXT.SKILL_NAME,
                description: SWORD_UI_TEXT.SKILL_DESCRIPTION,
                unlocked: formationLearned,
                active: this.attackMode === 'SWORD',
                ready: formationReady,
                accent: CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.color || '#ffd36b',
                note: formationReady
                    ? this.attackMode === 'SWORD'
                        ? SWORD_UI_TEXT.noteActive(formatNumber(swordStats.alive))
                        : SWORD_UI_TEXT.noteReady(formatNumber(swordProgress.bonded), formatNumber(swordProgress.required))
                    : formationLearned
                        ? SWORD_UI_TEXT.noteLearnedPending(formatNumber(swordProgress.bonded), formatNumber(swordProgress.required))
                        : hasSwordArtInInventory
                            ? SWORD_UI_TEXT.noteInInventory(formatNumber(swordProgress.required))
                            : this.hasUniquePurchase('DAI_CANH_KIEM_TRAN')
                                ? SWORD_UI_TEXT.noteRecovering(formatNumber(swordProgress.bonded), formatNumber(swordProgress.required))
                                : swordProgress.bonded > 0 || swordProgress.stocked > 0
                                    ? SWORD_UI_TEXT.noteCollecting(
                                        formatNumber(swordProgress.bonded),
                                        formatNumber(swordProgress.required),
                                        swordProgress.stocked > 0 ? ` | ${formatNumber(swordProgress.stocked)} thanh còn trong túi` : ''
                                    )
                                    : SWORD_UI_TEXT.noteUnknown(formatNumber(swordProgress.required))
            },
            {
                key: 'INSECT',
                name: 'Khu Trùng Thuật',
                description: 'Điểm linh trùng nhập trận, bám sát mục tiêu và công phạt theo bản mệnh từng loài.',
                unlocked: this.hasKhuTrungThuatUnlocked(),
                active: this.attackMode === 'INSECT',
                ready: this.canUseInsectAttackMode(),
                accent: CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.color || '#ff92c2',
                note: this.hasKhuTrungThuatUnlocked()
                    ? combatReadyCount > 0
                        ? `${formatNumber(combatReadyCount)} linh trùng xuất trận${reservedCount > 0 ? ` | ${formatNumber(reservedCount)} đang dưỡng đàn` : ''}`
                        : totalInsects > 0
                            ? 'Toàn bộ kỳ trùng đang lưu lại dưỡng đàn'
                            : 'Chưa có linh trùng nào phá noãn'
                    : 'Chưa lĩnh ngộ bí pháp ngự trùng',
                roster: this.hasKhuTrungThuatUnlocked() ? this.getInsectCombatRoster() : [],
                rosterSummary: this.hasKhuTrungThuatUnlocked()
                    ? `${formatNumber(combatReadyCount)} xuất trận / ${formatNumber(totalInsects)} trong đàn`
                    : ''
            }
        ];
    },

    renderAttackModeUI() {
        const skillBtn = document.getElementById('btn-skill-list');
        const swordProgress = this.getSwordFormationProgress();
        if (skillBtn) {
            skillBtn.classList.toggle('is-active', this.hasActiveAttackSkill() || this.hasActiveArtifact());
            skillBtn.classList.toggle('is-disabled', !this.hasDaiCanhKiemTranUnlocked() && !this.hasKhuTrungThuatUnlocked() && !this.hasKnownArtifact() && !this.hasKnownSwordArtifact());

            if (this.attackMode === 'INSECT') {
                skillBtn.title = `Khu Trùng Thuật - ${formatNumber(this.getCombatReadyInsectCount())} linh trùng xuất trận`;
            } else if (this.attackMode === 'SWORD') {
                skillBtn.title = `Đại Canh Kiếm Trận - ${formatNumber(this.getAliveSwordStats().alive)} kiếm hộ trận`;
            } else if (this.hasDaiCanhKiemTranUnlocked()) {
                skillBtn.title = SWORD_UI_TEXT.titleLearned(formatNumber(swordProgress.bonded), formatNumber(swordProgress.required));
            } else if (swordProgress.bonded > 0 || swordProgress.stocked > 0) {
                skillBtn.title = `Thanh Trúc Phong Vân Kiếm - ${formatNumber(swordProgress.bonded)} thanh đã triển khai, Đại Canh dùng ${formatNumber(swordProgress.required)} thanh`;
            } else if (this.hasActiveArtifact()) {
                skillBtn.title = `Pháp bảo hộ thể - ${this.getActiveArtifactNames().join(', ')}`;
            } else {
                skillBtn.title = 'Bảng bí pháp';
            }
        }

        const swordCounter = document.getElementById('sword-counter');
        if (swordCounter) {
            swordCounter.classList.toggle('is-hidden', this.isInsectSwarmActive() || this.isInsectUltimateActive());
        }

        this.renderPhongLoiBlinkButton();
        this.renderAlchemyLabButton();

        GameProgress.requestSave();
    },

    ensureValidAttackMode() {
        const previousMode = this.attackMode;

        if (this.attackMode === 'SWORD' && !this.canDeployDaiCanhKiemTran()) {
            this.attackMode = 'BASE';
        }

        if (this.attackMode === 'INSECT' && !this.canUseInsectAttackMode()) {
            this.attackMode = 'BASE';
        }

        if (previousMode !== this.attackMode) {
            syncSwordFormation();
            return;
        }

        this.renderAttackModeUI();
    },

    clearAttackSkill() {
        if (this.isUltimateBusy()) {
            showNotify('Không thể thu hồi bí pháp khi tuyệt kỹ đang vận chuyển.', '#ffd36b');
            return false;
        }

        if (!this.hasActiveAttackSkill()) {
            this.renderAttackModeUI();
            return true;
        }

        const previousMode = this.attackMode;
        this.attackMode = 'BASE';
        syncSwordFormation();
        showNotify(
            `Thu hồi bí pháp, trở về ${formatNumber(getBaseSwordCountBeforeFormation())} thanh bản mệnh kiếm.`,
            previousMode === 'INSECT'
                ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.color || '#ff92c2')
                : (CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.color || '#ffd36b')
        );
        return true;
    },

    setAttackMode(mode) {
        const nextMode = mode === 'INSECT' ? 'INSECT' : 'SWORD';

        if (this.isUltimateBusy()) {
            showNotify('Không thể đổi bí pháp khi tuyệt kỹ đang vận chuyển.', '#ffd36b');
            return false;
        }

        if (!this.hasUnlockedAttackSkill(nextMode)) {
            if (nextMode === 'SWORD') {
                const progress = this.getSwordFormationProgress();
                showNotify(
                    this.hasDaiCanhKiemTranUnlocked()
                        ? SWORD_UI_TEXT.needCount(formatNumber(progress.bonded), formatNumber(progress.required))
                        : SWORD_UI_TEXT.NEED_ART,
                    '#ffd36b'
                );
            } else {
                showNotify('Chưa lĩnh ngộ bí pháp này.', '#ffd36b');
            }
            return false;
        }

        if (nextMode === 'INSECT' && !this.canUseInsectAttackMode()) {
            const totalInsects = this.getTotalTamedInsectCount();
            showNotify(
                totalInsects > 0
                    ? 'Đàn trùng đều đang lưu lại dưỡng đàn, hãy điểm danh ít nhất một loài xuất trận.'
                    : 'Chưa có linh trùng nào đủ duyên nhập trận.',
                '#ffb26b'
            );
            return false;
        }

        if (this.attackMode === nextMode) {
            return this.clearAttackSkill();
        }

        this.attackMode = nextMode;
        syncSwordFormation();
        showNotify(
            nextMode === 'INSECT' ? 'Chuyển sang Khu Trùng Thuật.' : 'Khai triển Đại Canh Kiếm Trận.',
            nextMode === 'INSECT'
                ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.color || '#ff92c2')
                : (CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.color || '#ffd36b')
        );
        return true;
    },

    hasBeastCapacity(amount = 1, speciesKey = null) {
        const safeAmount = Math.max(0, Math.floor(amount || 0));
        if (speciesKey) {
            const capacity = this.getBeastBagCapacity(speciesKey);
            if (!Number.isFinite(capacity)) return true;
            return (this.getInsectHabitatOccupancy(speciesKey) + safeAmount) <= capacity;
        }

        const capacity = this.getBeastBagCapacity();
        if (!Number.isFinite(capacity)) return true;
        return (this.getTotalTamedInsectCount() + safeAmount) <= capacity;
    },

    addInsectEgg(speciesKey, count = 1) {
        const species = this.getInsectSpecies(speciesKey);
        const safeCount = Math.max(0, Math.floor(count || 0));
        if (!species || safeCount <= 0) return 0;

        this.insectEggs[speciesKey] = Math.max(0, Math.floor(this.insectEggs[speciesKey] || 0)) + safeCount;
        this.markDiscoveredInsect(speciesKey);
        return safeCount;
    },

    changeTamedInsects(speciesKey, delta = 0, options = {}) {
        const species = this.getInsectSpecies(speciesKey);
        const safeDelta = Math.trunc(delta || 0);
        if (!species || safeDelta === 0) return 0;

        const currentCount = Math.max(0, Math.floor(this.tamedInsects[speciesKey] || 0));
        const nextCount = Math.max(0, currentCount + safeDelta);

        if (nextCount <= 0) {
            delete this.tamedInsects[speciesKey];
        } else {
            this.tamedInsects[speciesKey] = nextCount;
            this.markDiscoveredInsect(speciesKey);
        }

        this.updateInsectColonyPopulation(speciesKey, currentCount, nextCount, options);

        this.ensureValidAttackMode();
        return nextCount - currentCount;
    },

    hatchInsectEgg(speciesKey, count = 1) {
        const species = this.getInsectSpecies(speciesKey);
        const safeCount = Math.max(1, Math.floor(count || 1));
        const hatchPreview = this.getHatchPreview(speciesKey, safeCount);
        const hatchCount = Math.max(0, Math.floor(hatchPreview.hatchCount || 0));
        const requirements = this.getSpeciesHatchRequirements(speciesKey);

        if (!species || hatchPreview.availableEggs <= 0) {
            return { success: false, reason: 'no-egg', count: 0 };
        }

        if (hatchPreview.reason === 'materials') {
            showNotify(`Thiêu nguyên liệu để ấp nở ${species.name}.`, CONFIG.INSECT?.HATCH?.NOTIFY_COLOR || species.color);
            return { success: false, reason: 'materials', count: 0 };
        }

        if (hatchPreview.reason === 'book') {
            showNotify('Cần Kỳ Trùng Bảng để định huyết mạch và ấp nở trùng noãn.', '#ffd871');
            return { success: false, reason: 'book', count: 0 };
        }

        if (hatchCount <= 0) {
            return { success: false, reason: 'full', count: 0 };
        }

        if (!this.consumeRequiredMaterials(requirements, hatchCount)) {
            showNotify(`Thiêu nguyên liệu để ấp nở ${species.name}.`, CONFIG.INSECT?.HATCH?.NOTIFY_COLOR || species.color);
            return { success: false, reason: 'materials', count: 0 };
        }

        this.insectEggs[speciesKey] = hatchPreview.availableEggs - hatchCount;
        if (this.insectEggs[speciesKey] <= 0) delete this.insectEggs[speciesKey];

        this.startInsectIncubation(speciesKey, hatchCount);
        const hatchDurationMs = this.getInsectHatchDurationMs(speciesKey);
        const hatchSeconds = Math.max(1, Math.ceil(hatchDurationMs / 1000));
        showNotify(
            `Đặt ấp ${formatNumber(hatchCount)} trứng ${species.name} (${formatNumber(hatchSeconds)} giây)`,
            CONFIG.INSECT?.HATCH?.NOTIFY_COLOR || species.color
        );
        this.refreshResourceUI();
        return { success: true, reason: 'incubating', count: hatchCount };
    },

    loseRandomTamedInsect(baseChance = 0, speciesPool = null) {
        const chance = Math.max(0, Math.min(1, baseChance || 0));
        const candidates = (speciesPool || this.getCombatReadyInsectSpeciesKeys())
            .filter(speciesKey => (this.tamedInsects?.[speciesKey] || 0) > 0);

        if (!candidates.length || Math.random() >= chance) return null;

        const weighted = {};
        candidates.forEach(speciesKey => {
            const species = this.getInsectSpecies(speciesKey);
            const count = this.tamedInsects[speciesKey] || 0;
            weighted[speciesKey] = Math.max(0.05, count / Math.max(0.2, species?.vitality || 1));
        });

        const chosenKey = pickWeightedKey(weighted, candidates[0]);
        this.changeTamedInsects(chosenKey, -1);
        return chosenKey;
    },

    reproduceRandomInsect(baseChance = 0, speciesPool = null) {
        const chance = Math.max(0, Math.min(1, baseChance || 0));
        const pool = Array.isArray(speciesPool) && speciesPool.length
            ? speciesPool
            : this.getActiveInsectSpeciesKeys();
        const candidates = pool.filter(speciesKey => this.getSpeciesCareStatus(speciesKey).canReproduce);

        if (!candidates.length || Math.random() >= chance) return null;

        const weighted = {};
        candidates.forEach(speciesKey => {
            const species = this.getInsectSpecies(speciesKey);
            const count = this.tamedInsects[speciesKey] || 0;
            weighted[speciesKey] = Math.max(0.05, count * Math.max(0.15, species?.fertility || 1));
        });

        const chosenKey = pickWeightedKey(weighted, candidates[0]);
        this.changeTamedInsects(chosenKey, 1, { source: 'breed' });
        return chosenKey;
    },

    createRandomInsectEggDropSpec() {
        const speciesRates = this.getInsectSpeciesEntries().reduce((rates, [speciesKey, species]) => {
            rates[speciesKey] = Math.max(0.01, species.weight || 1);
            return rates;
        }, {});
        const speciesKey = pickWeightedKey(speciesRates, this.getInsectSpeciesEntries()[0]?.[0]);

        return {
            kind: 'INSECT_EGG',
            category: 'INSECT_EGG',
            quality: 'LOW',
            speciesKey
        };
    },

    createRandomMaterialDropSpec(isElite = false) {
        const materialEntries = Object.entries(CONFIG.ITEMS?.MATERIALS || {});
        const materialRates = materialEntries.reduce((rates, [materialKey, materialConfig]) => {
            rates[materialKey] = Math.max(0.01, Number(materialConfig?.dropWeight) || 1);
            return rates;
        }, {});
        const fallbackKey = materialEntries[0]?.[0] || null;
        const materialKey = pickWeightedKey(materialRates, fallbackKey);
        const materialConfig = this.getMaterialConfig(materialKey);

        return {
            kind: 'MATERIAL',
            category: 'MATERIAL',
            quality: materialConfig?.quality || (isElite ? 'MEDIUM' : 'LOW'),
            materialKey
        };
    },

    getEnemyMaterialDropRates(enemy = null) {
        const animalKey = enemy?.animalKey || null;
        const configuredRates = animalKey ? ANIMAL_MATERIAL_DROP_TABLES[animalKey] : null;

        if (configuredRates) {
            return { ...configuredRates };
        }

        return {
            TINH_THIT: 2.2,
            YEU_HUYET: 1.6,
            YEU_GIAC: 1.2,
            DOC_NANG: 0.8,
            LINH_TY: 0.8
        };
    },

    createEnemyMaterialDropSpec(enemy = null, isElite = false) {
        const materialRates = this.getEnemyMaterialDropRates(enemy);
        const fallbackKey = Object.keys(materialRates)[0] || 'TINH_THIT';
        const materialKey = pickWeightedKey(materialRates, fallbackKey);
        const materialConfig = this.getMaterialConfig(materialKey);

        return {
            kind: 'MATERIAL',
            category: 'MATERIAL',
            quality: materialConfig?.quality || (isElite ? 'MEDIUM' : 'LOW'),
            materialKey
        };
    },

    createGuaranteedMajorRealmDrops(enemy = null) {
        if ((enemy?.rankData?.id || 0) < KET_DAN_REALM_START_ID) return [];

        const demonCore = this.getMaterialConfig('YEU_DAN');
        const dropCount = enemy?.isElite ? 2 : 1;

        return Array.from({ length: dropCount }, () => ({
            kind: 'MATERIAL',
            category: 'MATERIAL',
            quality: demonCore?.quality || 'HIGH',
            materialKey: 'YEU_DAN'
        }));
    },

    getSpiritStoneType(quality) {
        return CONFIG.SPIRIT_STONE.TYPES[quality] || CONFIG.SPIRIT_STONE.TYPES.LOW;
    },

    getSpiritStoneCompactLabel(quality) {
        return {
            LOW: 'HP',
            MEDIUM: 'TrP',
            HIGH: 'ThP',
            SUPREME: 'CP'
        }[quality] || 'HP';
    },

    getSpiritStoneTotalValue() {
        return Object.entries(this.spiritStones).reduce((total, [quality, count]) => {
            return total + (count * this.getSpiritStoneType(quality).value);
        }, 0);
    },

    setSpiritStoneTotalValue(totalLowValue) {
        let remaining = Math.max(0, Math.floor(totalLowValue));
        const nextWallet = { LOW: 0, MEDIUM: 0, HIGH: 0, SUPREME: 0 };

        STONE_ORDER.forEach(quality => {
            const type = this.getSpiritStoneType(quality);
            nextWallet[quality] = Math.floor(remaining / type.value);
            remaining %= type.value;
        });

        this.spiritStones = nextWallet;
    },

    addSpiritStone(quality, count = 1) {
        const type = this.getSpiritStoneType(quality);
        this.setSpiritStoneTotalValue(this.getSpiritStoneTotalValue() + (type.value * count));
    },

    canAffordLowStoneCost(costLowStone) {
        return this.getSpiritStoneTotalValue() >= Math.max(0, costLowStone);
    },

    spendSpiritStones(costLowStone) {
        const safeCost = Math.max(0, Math.floor(costLowStone));
        if (!this.canAffordLowStoneCost(safeCost)) return false;

        this.setSpiritStoneTotalValue(this.getSpiritStoneTotalValue() - safeCost);
        return true;
    },

    getSpiritStoneBreakdown(totalLowValue) {
        let remaining = Math.max(0, Math.floor(totalLowValue));

        return STONE_ORDER.map(quality => {
            const type = this.getSpiritStoneType(quality);
            const count = Math.floor(remaining / type.value);
            remaining %= type.value;

            return {
                quality,
                count,
                type
            };
        });
    },

    renderSpiritStoneCostMarkup(totalLowValue) {
        const entries = this.getSpiritStoneBreakdown(totalLowValue)
            .filter(entry => entry.count > 0);

        if (!entries.length) {
            const fallback = this.getSpiritStoneType('LOW');
            entries.push({
                quality: 'LOW',
                count: 0,
                type: fallback
            });
        }

        return `
            <span class="stone-cost-list">
                ${entries.map(entry => `
                    <span class="stone-cost-chip" style="--stone-accent:${entry.type.color}" title="${escapeHtml(entry.type.label)}">
                        ${formatNumber(entry.count)} ${escapeHtml(this.getSpiritStoneCompactLabel(entry.quality))}
                    </span>
                `).join('')}
            </span>
        `;
    },

});

Object.assign(Input, {
    buildInventoryKey(spec) {
        const parts = [
            spec.kind || 'PILL',
            spec.category || 'EXP',
            spec.quality || 'LOW'
        ];

        if (spec.specialKey) parts.push(spec.specialKey);
        if (spec.realmKey) parts.push(spec.realmKey);
        if (spec.uniqueKey) parts.push(spec.uniqueKey);
        if (spec.speciesKey) parts.push(spec.speciesKey);
        if (spec.materialKey) parts.push(spec.materialKey);
        if (spec.source) parts.push(spec.source);
        return parts.join('|');
    },

    getUniqueItemConfig(uniqueKey) {
        return CONFIG.SECRET_ARTS?.[uniqueKey]
            || (CONFIG.SWORD?.ARTIFACT_ITEM?.uniqueKey === uniqueKey ? CONFIG.SWORD.ARTIFACT_ITEM : null)
            || CONFIG.ARTIFACTS?.[uniqueKey]
            || CONFIG.INSECT?.UNIQUE_ITEMS?.[uniqueKey]
            || null;
    },

    getAlchemyRecipeDefinitions() {
        const recipes = {};
        const formulaLabels = CONFIG.ALCHEMY?.FORMULA_QUALITY_LABELS || {};
        const materialsByQuality = {
            LOW: ['LINH_TY', 'YEU_HUYET', 'TINH_THIT'],
            MEDIUM: ['NGAN_NAM_HOANG_TINH', 'TUYET_NGOC_THAO', 'YEU_DAN', 'NGUYET_HOA_LO'],
            HIGH: ['DIA_TAM_HOA_TINH', 'THANH_HOANG_MOC_TUY', 'HUYEN_BANG_TAM_TUY', 'PHONG_VAN_HON_TINH'],
            SUPREME: ['HUYEN_HOA_LIEN', 'VAN_MOC_CHI', 'THIEN_LINH_QUA', 'THIEN_LOI_NGOC_TUY']
        };
        const formulaQualityByPillQuality = {
            LOW: 'LOW',
            MEDIUM: 'MEDIUM',
            HIGH: 'HIGH',
            SUPREME: 'SUPREME'
        };
        const potionCategories = ['EXP', 'INSIGHT', 'ATTACK', 'SHIELD_BREAK', 'BERSERK', 'RAGE', 'MANA', 'MAX_MANA', 'REGEN', 'SPEED', 'FORTUNE'];

        potionCategories.forEach(category => {
            QUALITY_ORDER.forEach(quality => {
                const formulaQuality = formulaQualityByPillQuality[quality] || 'LOW';
                const formulaLabel = formulaLabels[formulaQuality] || 'Đan phương';
                const qualityConfig = this.getItemQualityConfig({ category, quality });
                const recipeKey = `AUTO:${category}:${quality}`;
                const primaryMaterials = materialsByQuality[quality] || materialsByQuality.LOW;
                recipes[recipeKey] = {
                    key: recipeKey,
                    name: `${formulaLabel} ${qualityConfig.fullName}`,
                    formulaQuality,
                    realmTier: 'Đan phương thường',
                    buyPriceLowStone: Math.max(40, Math.floor((qualityConfig.buyPriceLowStone || 0) * 0.35)),
                    brewTimeMs: 12000 + (QUALITY_ORDER.indexOf(quality) * 9000),
                    output: { category, quality, count: 1 },
                    ingredients: [
                        { materialKey: primaryMaterials[0], count: 1 + (quality === 'HIGH' ? 1 : 0) + (quality === 'SUPREME' ? 2 : 0) },
                        { materialKey: primaryMaterials[1], count: 1 + (quality === 'MEDIUM' ? 1 : 0) + (quality === 'SUPREME' ? 1 : 0) },
                        { materialKey: primaryMaterials[2], count: 1 + (quality === 'HIGH' ? 1 : 0) + (quality === 'SUPREME' ? 2 : 0) },
                        ...(primaryMaterials[3] ? [{ materialKey: primaryMaterials[3], count: quality === 'SUPREME' ? 2 : 1 }] : [])
                    ]
                };
            });
        });

        const nextRealm = this.getNextMajorRealmInfo();
        if (nextRealm) {
            QUALITY_ORDER.forEach(quality => {
                const formulaQuality = formulaQualityByPillQuality[quality] || 'LOW';
                const formulaLabel = formulaLabels[formulaQuality] || 'Đan phương';
                const qualityConfig = this.getItemQualityConfig({ category: 'BREAKTHROUGH', quality });
                const recipeKey = `AUTO:BREAKTHROUGH:${quality}:${nextRealm.key}`;
                recipes[recipeKey] = {
                    key: recipeKey,
                    name: `${formulaLabel} ${qualityConfig.label} ${nextRealm.name} đan`,
                    formulaQuality,
                    realmTier: 'Đột phá đan',
                    buyPriceLowStone: Math.max(120, Math.floor((qualityConfig.buyPriceLowStone || 0) * 0.38)),
                    brewTimeMs: 22000 + (QUALITY_ORDER.indexOf(quality) * 10000),
                    output: { category: 'BREAKTHROUGH', quality, realmKey: nextRealm.key, realmName: nextRealm.name, count: 1 },
                    ingredients: [
                        { materialKey: 'NGAN_NAM_HOANG_TINH', count: 1 + QUALITY_ORDER.indexOf(quality) },
                        { materialKey: 'TUYET_NGOC_THAO', count: 1 + (quality === 'SUPREME' ? 1 : 0) },
                        { materialKey: 'THIEN_LINH_QUA', count: 1 }
                    ]
                };
            });
        }

        Object.entries(CONFIG.PILL.SPECIAL_ITEMS || {}).forEach(([specialKey, specialConfig]) => {
            const quality = specialConfig.quality || 'SUPREME';
            const formulaQuality = formulaQualityByPillQuality[quality] || 'SUPREME';
            const formulaLabel = formulaLabels[formulaQuality] || 'Đan phương';
            const recipeKey = `AUTO:SPECIAL:${specialKey}`;
            const specialIngredients = specialKey === 'CHUNG_CUC_DAO_NGUYEN_DAN'
                ? [
                    { materialKey: 'THIEN_LINH_QUA', count: 6 },
                    { materialKey: 'THIEN_LOI_NGOC_TUY', count: 4 },
                    { materialKey: 'HONG_MONG_TINH_SA', count: 3 },
                    { materialKey: 'CUU_U_HON_THAO', count: 2 },
                    { materialKey: 'THAI_CO_HUYET_CHI', count: 2 },
                    { materialKey: 'KIM_LOI_TRUC_ROOT', count: 1 }
                ]
                : [
                    { materialKey: 'HUYEN_HOA_LIEN', count: 4 },
                    { materialKey: 'VAN_MOC_CHI', count: 3 },
                    { materialKey: 'CUU_U_HON_THAO', count: 3 },
                    { materialKey: 'HONG_MONG_TINH_SA', count: 2 },
                    { materialKey: 'THAI_CO_HUYET_CHI', count: 2 },
                    { materialKey: 'KIM_LOI_TRUC_ROOT', count: 1 }
                ];

            recipes[recipeKey] = {
                key: recipeKey,
                name: `${formulaLabel} ${specialConfig.fullName || specialKey}`,
                formulaQuality,
                realmTier: 'Cấm kỵ đan',
                buyPriceLowStone: Math.max(12000, Math.floor((specialConfig.buyPriceLowStone || 0) * 0.72)),
                brewTimeMs: 98000,
                output: { category: 'SPECIAL', quality, specialKey, count: 1 },
                ingredients: specialIngredients
            };
        });

        return recipes;
    },

    getAlchemyRecipeByKey(recipeKey) {
        return this.getAlchemyRecipeDefinitions()?.[recipeKey] || null;
    },

    getItemQualityConfig(item) {
        const categoryMap = {
            EXP: CONFIG.PILL.EXP_QUALITIES,
            INSIGHT: CONFIG.PILL.INSIGHT_QUALITIES,
            BREAKTHROUGH: CONFIG.PILL.BREAKTHROUGH_QUALITIES,
            ATTACK: CONFIG.PILL.ATTACK_QUALITIES,
            SHIELD_BREAK: CONFIG.PILL.SHIELD_BREAK_QUALITIES,
            BATTLE_AURA: CONFIG.PILL.BATTLE_AURA_QUALITIES,
            BODY_TECHNIQUE: CONFIG.PILL.BODY_TECHNIQUE_QUALITIES,
            SENSE: CONFIG.PILL.SENSE_QUALITIES,
            BERSERK: CONFIG.PILL.BERSERK_QUALITIES,
            RAGE: CONFIG.PILL.RAGE_QUALITIES,
            MANA: CONFIG.PILL.MANA_QUALITIES,
            MAX_MANA: CONFIG.PILL.MAX_MANA_QUALITIES,
            REGEN: CONFIG.PILL.REGEN_QUALITIES,
            SPEED: CONFIG.PILL.SPEED_QUALITIES,
            FORTUNE: CONFIG.PILL.FORTUNE_QUALITIES,
            BAG: CONFIG.ITEMS.STORAGE_BAGS,
            RAINBOW_BAG: { SUPREME: CONFIG.ITEMS.SEVEN_COLOR_BAG },
            SWORD_ART: CONFIG.SECRET_ARTS,
            FLAME_ART: CONFIG.SECRET_ARTS,
            ARTIFACT: CONFIG.ARTIFACTS,
            INSECT_SKILL: CONFIG.INSECT.UNIQUE_ITEMS,
            INSECT_ARTIFACT: CONFIG.INSECT.UNIQUE_ITEMS,
            SPIRIT_BAG: { HIGH: CONFIG.INSECT.BEAST_BAG },
            RAINBOW_SPIRIT_BAG: { SUPREME: CONFIG.INSECT.SEVEN_COLOR_BEAST_BAG },
            ALCHEMY_FURNACE: CONFIG.ALCHEMY?.FURNACES || {}
        };

        if (item.specialKey) {
            return CONFIG.PILL.SPECIAL_ITEMS[item.specialKey] || CONFIG.PILL.EXP_QUALITIES.LOW;
        }

        if (item.category === 'MATERIAL' || item.kind === 'MATERIAL') {
            return this.getMaterialConfig(item.materialKey) || CONFIG.PILL.EXP_QUALITIES.LOW;
        }

        if (item.uniqueKey) {
            const uniqueConfig = this.getUniqueItemConfig(item.uniqueKey);
            if (uniqueConfig) return uniqueConfig;
        }

        if (item.category === 'ALCHEMY_RECIPE') {
            const recipeConfig = this.getAlchemyRecipeByKey(item.recipeKey);
            if (!recipeConfig) return CONFIG.PILL.EXP_QUALITIES.LOW;
            const outputConfig = this.getItemQualityConfig({
                category: recipeConfig.output?.category || 'EXP',
                quality: recipeConfig.output?.quality || 'LOW'
            });
            return {
                ...recipeConfig,
                color: recipeConfig.color || outputConfig?.color || CONFIG.PILL.EXP_QUALITIES.LOW.color
            };
        }

        if (item.category === 'ALCHEMY_FURNACE') {
            return CONFIG.ALCHEMY?.FURNACES?.[item.furnaceKey] || CONFIG.PILL.EXP_QUALITIES.LOW;
        }

        if (item.category === 'INSECT_EGG') {
            return this.getInsectEggShopConfig(item.speciesKey);
        }

        if (item.category === 'SPIRIT_HABITAT') {
            return this.getInsectHabitatConfig(item.speciesKey);
        }

        if (item.category === 'SPIRIT_BAG') {
            return CONFIG.INSECT.BEAST_BAG;
        }

        if (item.category === 'SWORD_ARTIFACT') {
            return this.getThanhTrucSwordArtifactConfig() || CONFIG.PILL.EXP_QUALITIES.LOW;
        }

        if (item.category === 'RAINBOW_BAG') {
            return CONFIG.ITEMS.SEVEN_COLOR_BAG;
        }

        if (item.category === 'RAINBOW_SPIRIT_BAG') {
            return CONFIG.INSECT.SEVEN_COLOR_BEAST_BAG;
        }

        const defs = categoryMap[item.category] || CONFIG.PILL.EXP_QUALITIES;
        return defs[item.quality] || defs.LOW;
    },

    getItemDisplayName(item) {
        const qualityConfig = this.getItemQualityConfig(item);
        if (item.specialKey) {
            return qualityConfig.fullName;
        }

        if (item.category === 'MATERIAL' || item.kind === 'MATERIAL') {
            return qualityConfig.fullName || 'Nguyên liệu';
        }

        if (item.category === 'ALCHEMY_RECIPE') {
            return qualityConfig.name || 'Đan phương';
        }

        if (item.category === 'ALCHEMY_FURNACE') {
            return qualityConfig.name || 'Đan lư';
        }

        if (item.kind === 'INSECT_EGG' || item.category === 'INSECT_EGG') {
            const species = this.getInsectSpecies(item.speciesKey);
            return species ? `Trứng ${species.name}` : 'Trứng kỳ trùng';
        }

        if (item.category === 'SWORD_ARTIFACT') {
            return qualityConfig.fullName || 'Thanh Truc Phong Van Kiem';
        }

        if (item.uniqueKey && qualityConfig.fullName) {
            return qualityConfig.fullName;
        }

        if (item.category === 'BREAKTHROUGH') {
            const realmName = item.realmName || this.getNextMajorRealmInfo()?.name || 'đột phá';
            return `${qualityConfig.label} ${realmName} đan`;
        }

        if (['BAG', 'RAINBOW_BAG', 'SPIRIT_BAG', 'RAINBOW_SPIRIT_BAG', 'SPIRIT_HABITAT'].includes(item.category)) {
            return qualityConfig.fullName;
        }

        return qualityConfig.fullName;
    },

    _getItemCategoryLabelLegacy(item) {
        const staticLabels = {
            MATERIAL: 'Nguyên liệu',
            SPIRIT_HABITAT: 'Linh thú Đại',
            BAG: 'Túi trữ vật',
            SPIRIT_BAG: 'Linh thú Đại',
            ARTIFACT: 'Pháp bảo',
            INSECT_SKILL: 'Trùng đạo bí pháp',
            INSECT_ARTIFACT: 'Kỳ trùng bảo vật',
            INSECT_EGG: 'Trứng noãn'
        };
        if (staticLabels[item.category]) return staticLabels[item.category];
        if (item.category === 'BAG') return 'Túi trữ vật';

        const labels = {
            EXP: 'Tu vi',
            INSIGHT: 'Ngộ đạo',
            BREAKTHROUGH: 'Đột phá',
            ATTACK: 'Công phạt',
            SHIELD_BREAK: 'Phá khiên',
            BATTLE_AURA: 'Chiến ý',
            BODY_TECHNIQUE: 'Luyện thể',
            SENSE: 'Thần niệm',
            BERSERK: 'Cuồng bạo',
            RAGE: 'Nộ',
            MANA: 'Hồi linh',
            MAX_MANA: 'Khai hải',
            REGEN: 'Hồi nguyên',
            SPEED: 'Thân pháp',
            FORTUNE: 'Vận khí',
            SPECIAL: 'Cấm kị'
        };

        return labels[item.category] || 'Đan dược';
    },

    getItemDescription(item) {
        const qualityConfig = this.getItemQualityConfig(item);
        if (item.specialKey === 'CHUNG_CUC_DAO_NGUYEN_DAN') {
            return 'Cực phẩm đạo đan bảy sắc, lập tức đưa tu vi lên Đạo Tổ đỉnh phong, mở thất sắc đạo quang và để lại trạng thái vô hạn.';
        }

        if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
            return 'Cấm kỵ hắc đan, cưỡng ép bước vào Đạo Tổ đỉnh phong trong 1 phút rồi tan vào hư vô. Chỉ có thể hồi phục khi tải lại giới vực.';
        }

        if (item.category === 'SPIRIT_HABITAT') {
            const species = this.getInsectSpecies(item.speciesKey);
            const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
            return species
                ? `Linh Thú Đại riêng dành cho ${species.name}. Lần mua đầu tiên sẽ khai mở tab riêng, mỗi lần mua sau mở rộng thêm ${formatNumber(extraSlots)} ô sức chứa cho chính loài này.`
                : `Linh Thú Đại riêng giúp kỳ trùng sinh nở an toàn và mỗi lần mua tăng thêm ${formatNumber(extraSlots)} ô sức chứa.`;
        }

        if (item.category === 'MATERIAL') {
            const usageSummary = this.getMaterialUsageSummary(item.materialKey);
            return [qualityConfig.description, usageSummary].filter(Boolean).join(' ');
        }

        if (item.category === 'ALCHEMY_RECIPE') {
            const formulaLabel = CONFIG.ALCHEMY?.FORMULA_QUALITY_LABELS?.[qualityConfig.formulaQuality || item.quality] || 'Đan phương';
            const ingredientsText = Array.isArray(qualityConfig.ingredients)
                ? qualityConfig.ingredients.map(ingredient => {
                    const cfg = this.getMaterialConfig(ingredient.materialKey);
                    return `${cfg?.fullName || ingredient.materialKey} x${formatNumber(Math.max(1, Math.floor(Number(ingredient.count) || 0)))}`;
                }).join(', ')
                : 'Chưa rõ';
            return `${formulaLabel} ${qualityConfig.realmTier || 'đan'} dùng để luyện ${this.getItemDisplayName({ category: qualityConfig.output?.category || 'EXP', quality: qualityConfig.output?.quality || 'LOW' })}. Nguyên liệu: ${ingredientsText}.`;
        }

        if (item.category === 'ALCHEMY_FURNACE') {
            return `${qualityConfig.name || 'Đan lư'} tăng tỉ lệ thành đan ${Math.round((qualityConfig.successRate || 0) * 100)}%, hệ số thời gian ${Math.round((qualityConfig.brewTimeMultiplier || 1) * 100)}%, hệ số sản lượng ${qualityConfig.outputMultiplier || 1}.`;
        }

        if (item.category === 'SWORD_ARTIFACT') {
            const progress = this.getSwordFormationProgress();
            const storedText = progress.stocked > 0
                ? ` Trong túi còn ${formatNumber(progress.stocked)} thanh chờ triển khai.`
                : '';

            return `${qualityConfig.description || 'Kiếm khí trúc xanh có thể hợp tan tùy niệm.'} Hiện đã triển khai ${formatNumber(progress.bonded)} thanh; Đại Canh Kiếm Trận cần ${formatNumber(progress.required)} thanh.${storedText}`;
        }

        if (item.category === 'INSECT_EGG') {
            const species = this.getInsectSpecies(item.speciesKey);
            const tier = this.getInsectTierInfo(species?.tier);
            if (!this.hasKyTrungBang()) {
                return species
                    ? `${tier.label}: ${species.description} Cần Kỳ Trùng Bảng để xem chi tiết nguyên liệu ấp nở và Linh Thú Đại phù hợp.`
                    : 'Trứng kỳ trùng chứa huyết mạch dị chủng. Cần Kỳ Trùng Bảng để xem chi tiết ấp nở.';
            }
            const requirements = this.getSpeciesHatchRequirements(item.speciesKey)
                .map(requirement => {
                    const materialConfig = this.getMaterialConfig(requirement.materialKey);
                    return `${materialConfig?.fullName || requirement.materialKey} x${formatNumber(requirement.count)}`;
                })
                .join(', ');
            const habitatConfig = this.getInsectHabitatConfig(item.speciesKey);
            return species
                ? `${tier.label}: ${species.description} Nguyên liệu ấp nở: ${requirements || 'không cần'}. Muốn ấp nở ổn định cần ${habitatConfig.fullName}.`
                : 'Trứng kỳ trùng có thể ấp nở trong tab Linh thú.';
        }

        switch (item.category) {
            case 'RAINBOW_BAG':
                return 'Thất sắc trữ vật nang mở ra không gian vô hạn, có thể dung nạp mọi loại vật phẩm. Chỉ có thể mua một lần nhưng giá cực cao.';
            case 'RAINBOW_SPIRIT_BAG':
                return 'Thất sắc Linh thú Đại có thể chứa mọi loài kỳ trùng với dung lượng vô hạn. Sau khi sở hữu, mọi loài đều được xem như có chỗ an trí phù hợp.';
            case 'BAG': {
                const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
                return `Mở rộng túi trữ vật thêm ${formatNumber(extraSlots)} ô. Có thể mua nhiều lần để cộng dồn dung lượng.`;
            }
            case 'SPIRIT_BAG': {
                const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
                return `Mở rộng Linh Thú Đại thêm ${formatNumber(extraSlots)} ô, tăng chỗ cho linh trùng đã nở. Có thể mua nhiều lần để cộng dồn dung lượng.`;
            }
            case 'SWORD_ART':
                if (item.uniqueKey === 'DAI_CANH_KIEM_TRAN') {
                    return `Trận đạo bí pháp chuyên dùng ${formatNumber(getConfiguredSwordCount())} thanh Thanh Trúc Phong Vân Kiếm để lập đại trận hộ thân và công phạt. Chỉ khi gom đủ kiếm và lĩnh ngộ bí pháp mới có thể khai triển trận đồ hoàn chỉnh.`;
                }
                return SWORD_UI_TEXT.secretArtDescription(formatNumber(getConfiguredSwordCount()));
            case 'FLAME_ART':
                return 'Pháp bảo Càn Lam Băng Diễm. Sau khi luyện hóa, con trỏ tâm niệm mới hiện hóa thành lam diễm.';
            case 'ARTIFACT':
                return qualityConfig.description || 'Pháp bảo hộ thân sau khi luyện hóa có thể khai triển quanh tâm ấn trong Bảng Bí Pháp.';
            case 'INSECT_SKILL':
                return 'Bí pháp điều động bầy linh trùng, cho phép thay kiếm trận bằng trùng vân công sát quanh con trỏ.';
            case 'INSECT_ARTIFACT':
                return 'Dị bảo ghi chép huyết mạch và năng lực các kỳ trùng. Thu được loài nào thì mục tương ứng sẽ sáng lên.';
            case 'INSECT_EGG': {
                const species = this.getInsectSpecies(item.speciesKey);
                const tier = this.getInsectTierInfo(species?.tier);
                return species
                    ? `${tier.label}: ${species.description}`
                    : 'Trứng kỳ trùng có thể ấp nở trong tab Linh thú.';
            }
            case 'INSIGHT':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.expGainPct || 0) * 100)}% tu vi nhận từ chiến đấu và đan tu vi.`;
            case 'BREAKTHROUGH': {
                const realmName = item.realmName || 'cảnh giới kế tiếp';
                return `Tăng ${Math.round(qualityConfig.breakthroughBoost * 100)}% tỷ lệ đột phá tới ${realmName}.`;
            }
            case 'ATTACK':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.attackPct || 0) * 100)}% lực công kích.`;
            case 'SHIELD_BREAK':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.shieldBreakPct || 0) * 100)}% sát lực lên khiên địch.`;
            case 'BERSERK': {
                const sideEffects = [];
                if (qualityConfig.sideManaLoss) sideEffects.push(`hao ${qualityConfig.sideManaLoss} linh lực`);
                if (qualityConfig.sideMaxManaFlat) sideEffects.push(`giảm ${Math.abs(qualityConfig.sideMaxManaFlat)} giới hạn linh lực`);
                if (qualityConfig.sideSpeedPct) sideEffects.push(`giảm ${Math.round(Math.abs(qualityConfig.sideSpeedPct) * 100)}% tốc độ`);
                if (qualityConfig.sideExpLossRatio) sideEffects.push(`tổn ${Math.round(qualityConfig.sideExpLossRatio * 100)}% tu vi hiện có`);

                const sideText = sideEffects.length ? ` Tác dụng phụ: ${sideEffects.join(', ')}.` : '';
                return `Cuồng hóa ${Math.round((qualityConfig.attackPct || 0) * 100)}% lực công kích trong ${Math.round((qualityConfig.durationMs || 0) / 1000)} giây.${sideText}`;
            }
            case 'RAGE':
                return `Tăng ngay ${Math.round(qualityConfig.rageGain || 0)} nộ tuyệt kỹ.`;
            case 'MANA':
                return `Hồi ngay ${Math.round(qualityConfig.manaRestore || 0)} linh lực, đồng thời tịnh hóa một phần trạng thái xấu (phẩm càng cao tịnh hóa càng mạnh).`;
            case 'MAX_MANA':
                return `Tăng vĩnh viễn ${Math.round(qualityConfig.maxManaFlat || 0)} giới hạn linh lực.`;
            case 'REGEN':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.manaRegenPct || 0) * 100)}% tốc độ hồi linh lực và kích hoạt Thanh Tâm Hộ Thể tạm thời (cường hóa thân pháp, có thể xóa trạng thái xấu).`;
            case 'SPEED':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.speedPct || 0) * 100)}% tốc độ vận chuyển kiếm trận.`;
            case 'FORTUNE':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.dropRatePct || 0) * 100)}% tỷ lệ rơi đan dược và linh thạch.`;
            case 'EXP':
            default:
                return `Tăng ${Math.round(qualityConfig.expFactor * 100)}% tu vi của cảnh giới hiện tại.`;
        }
    },

    getItemDescriptionMarkup(item) {
        const description = repairLegacyText(this.getItemDescription(item)).trim();
        const contentMarkup = buildItemDescriptionContentMarkup(description);
        const isMobileViewport = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(max-width: 768px)').matches;
        const collapseThreshold = isMobileViewport
            ? Math.max(80, Math.floor(ITEM_DESCRIPTION_COLLAPSE_THRESHOLD * 0.7))
            : ITEM_DESCRIPTION_COLLAPSE_THRESHOLD;
        const shouldCollapse = description.length > collapseThreshold || description.includes('Tác dụng phụ:');

        if (!shouldCollapse) {
            return `<div class="item-description__body">${contentMarkup}</div>`;
        }

        return `
            <div class="item-description__preview">${contentMarkup}</div>
            <button
                type="button"
                class="item-description__toggle"
                data-description-toggle
                aria-expanded="false"
                aria-label="Xem thêm mô tả"
            >Xem thêm</button>
            <div class="item-description__full">${contentMarkup}</div>
        `.trim();
    },

    getItemCategoryLabel(item) {
        if (item.category === 'RAINBOW_BAG') return 'Túi trữ vật';
        if (item.category === 'RAINBOW_SPIRIT_BAG') return 'Linh thú Đại';
        const staticLabels = {
            MATERIAL: 'Nguyên liệu',
            SPIRIT_HABITAT: 'Linh thú Đại',
            BAG: 'Túi trữ vật',
            SPIRIT_BAG: 'Linh thú Đại',
            ARTIFACT: 'Pháp bảo',
            SWORD_ART: 'Kiếm đạo bí pháp',
            FLAME_ART: 'Pháp bảo',
            INSECT_SKILL: 'Trùng đạo bí pháp',
            INSECT_ARTIFACT: 'Kỳ trùng bảo vật',
            INSECT_EGG: 'Trứng noãn',
            ALCHEMY_RECIPE: 'Đan phương',
            ALCHEMY_FURNACE: 'Đan lư'
        };

        if (staticLabels[item.category]) return staticLabels[item.category];

        const labels = {
            EXP: 'Tu vi',
            INSIGHT: 'Ngộ đạo',
            BREAKTHROUGH: 'Đột phá',
            ATTACK: 'Công phạt',
            SHIELD_BREAK: 'Phá khiên',
            BATTLE_AURA: 'Chiến ý',
            BODY_TECHNIQUE: 'Luyện thể',
            SENSE: 'Thần niệm',
            BERSERK: 'Cuồng bạo',
            RAGE: 'Nộ',
            MANA: 'Hồi linh',
            MAX_MANA: 'Khai hải',
            REGEN: 'Hồi nguyên',
            SPEED: 'Thân pháp',
            FORTUNE: 'Vận khí',
            SPECIAL: 'Cấm kỵ'
        };

        return labels[item.category] || 'Đan dược';
    },

    _getItemDescriptionLegacy(item) {
        const qualityConfig = this.getItemQualityConfig(item);
        if (item.specialKey === 'CHUNG_CUC_DAO_NGUYEN_DAN') {
            return 'Cực phẩm đạo đan bảy sắc, lập tức đưa tu vi lên Đạo tổ đỉnh phong, mở thất sắc đạo quang và để lại trạng thái vô hạn.';
        }

        if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
            return 'Cấm kỵ hắc đan, cưỡng ép bước vào Đạo tổ đỉnh phong trong 1 phút rồi tan vào hư vô. Chỉ có thể hồi phục khi tải lại giới vực.';
        }

        switch (item.category) {
            case 'BAG': {
                const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
                return `Mở rộng túi trữ vật thêm ${formatNumber(extraSlots)} ô. Có thể mua nhiều lần để cộng dồn dung lượng.`;
            }
            case 'SPIRIT_BAG': {
                const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
                return `Mở rộng Linh Thú Đại thêm ${formatNumber(extraSlots)} ô, tăng chỗ cho linh trùng đã nở. Có thể mua nhiều lần để cộng dồn dung lượng.`;
            }
            case 'SWORD_ART':
                return 'Kiếm đạo bí pháp chỉ truyền một lần. Sau khi lĩnh ngộ mới từ một thanh bản mệnh kiếm hóa thành Đại Canh Kiếm Trận như hiện tại.';
            case 'FLAME_ART':
                return 'Pháp bảo Càn Lam Băng Diễm. Sau khi luyện hóa, con trỏ tâm niệm mới hiển hóa thành lam diễm, trước đó chỉ là một điểm sáng nhỏ.';
            case 'ARTIFACT':
                return qualityConfig.description || 'Pháp bảo hộ thân sau khi luyện hóa có thể khai triển quanh tâm ấn trong Bảng Bí Pháp.';
            case 'INSECT_SKILL':
                return 'Bí pháp điều động bầy linh trùng, cho phép thay kiếm trận bằng trùng vân công sát quanh con trỏ.';
            case 'INSECT_ARTIFACT':
                return 'Dị bảo ghi chép huyết mạch và năng lực các kỳ trùng. Thu được loài nào thì mục tương ứng sẽ sáng lên.';
            case 'INSECT_EGG': {
                const species = this.getInsectSpecies(item.speciesKey);
                const tier = this.getInsectTierInfo(species?.tier);
                return species
                    ? `${tier.label}: ${species.description}`
                    : 'Trứng kỳ trùng có thể ấp nở trong tab Linh thú.';
            }
            case 'INSIGHT':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.expGainPct || 0) * 100)}% tu vi nhận từ chiến đấu và đan tu vi.`;
            case 'BREAKTHROUGH': {
                const realmName = item.realmName || 'cảnh giới kế tiếp';
                return `Tăng ${Math.round(qualityConfig.breakthroughBoost * 100)}% tỉ lệ đột phá tới ${realmName}.`;
            }
            case 'ATTACK':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.attackPct || 0) * 100)}% lực công kích.`;
            case 'SHIELD_BREAK':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.shieldBreakPct || 0) * 100)}% sát lực lên khiên địch.`;
            case 'BERSERK': {
                const sideEffects = [];
                if (qualityConfig.sideManaLoss) sideEffects.push(`hao ${qualityConfig.sideManaLoss} linh lực`);
                if (qualityConfig.sideMaxManaFlat) sideEffects.push(`giảm ${Math.abs(qualityConfig.sideMaxManaFlat)} giới hạn linh lực`);
                if (qualityConfig.sideSpeedPct) sideEffects.push(`giảm ${Math.round(Math.abs(qualityConfig.sideSpeedPct) * 100)}% tốc độ`);
                if (qualityConfig.sideExpLossRatio) sideEffects.push(`tổn ${Math.round(qualityConfig.sideExpLossRatio * 100)}% tu vi hiện có`);

                const sideText = sideEffects.length ? ` Tác dụng phụ: ${sideEffects.join(', ')}.` : '';
                return `Cuồng hóa ${Math.round((qualityConfig.attackPct || 0) * 100)}% lực công kích trong ${Math.round((qualityConfig.durationMs || 0) / 1000)} giây.${sideText}`;
            }
            case 'RAGE':
                return `Tăng ngay ${Math.round(qualityConfig.rageGain || 0)} nộ tuyệt kỹ.`;
            case 'MANA':
                return `Hồi ngay ${Math.round(qualityConfig.manaRestore || 0)} linh lực, đồng thời tịnh hóa một phần trạng thái xấu (phẩm càng cao tịnh hóa càng mạnh).`;
            case 'MAX_MANA':
                return `Tăng vĩnh viễn ${Math.round(qualityConfig.maxManaFlat || 0)} giới hạn linh lực.`;
            case 'REGEN':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.manaRegenPct || 0) * 100)}% tốc độ hồi linh lực và kích hoạt Thanh Tâm Hộ Thể tạm thời (cường hóa thân pháp, có thể xóa trạng thái xấu).`;
            case 'SPEED':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.speedPct || 0) * 100)}% tốc độ vận chuyển kiếm trận.`;
            case 'FORTUNE':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.dropRatePct || 0) * 100)}% tỉ lệ rơi đan dược và linh thạch.`;
            case 'EXP':
            default:
                return `Tăng ${Math.round(qualityConfig.expFactor * 100)}% tu vi của cảnh giới hiện tại.`;
        }
    },

    addInventoryItem(spec, count = 1) {
        const itemKey = this.buildInventoryKey(spec);
        if (!this.inventory[itemKey] && !this.hasInventorySpaceForSpec(spec)) {
            return null;
        }

        if (!this.inventory[itemKey]) {
            this.inventory[itemKey] = {
                key: itemKey,
                kind: spec.kind || 'PILL',
                category: spec.category || 'EXP',
                quality: spec.quality || 'LOW',
                specialKey: spec.specialKey || null,
                realmKey: spec.realmKey || null,
                realmName: spec.realmName || null,
                uniqueKey: spec.uniqueKey || null,
                speciesKey: spec.speciesKey || null,
                materialKey: spec.materialKey || null,
                count: 0
            };
        }

        this.inventory[itemKey].count += count;
        return this.inventory[itemKey];
    },

    getInventoryEntries() {
        const categoryOrder = CONFIG.PILL.CATEGORY_SORT || {};

        return Object.values(this.inventory)
            .filter(item => item.count > 0)
            .sort((a, b) => {
                const categoryDiff = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
                if (categoryDiff !== 0) return categoryDiff;

                const qualityDiff = QUALITY_ORDER.indexOf(b.quality) - QUALITY_ORDER.indexOf(a.quality);
                if (qualityDiff !== 0) return qualityDiff;

                return (a.realmName || '').localeCompare(b.realmName || '', 'vi');
            });
    },

    isInventoryItemUsable(item) {
        if (this.isVoidCollapsed) return false;
        if (item.category === 'MATERIAL') return false;
        if (item.category === 'SWORD_ARTIFACT') return true;
        if (item.category === 'EXP') return true;
        if (item.category !== 'BREAKTHROUGH') return true;

        const nextRealm = this.getNextMajorRealmInfo();
        return Boolean(nextRealm && item.realmKey === nextRealm.key);
    },

    createRandomPillDropSpec(isElite = false) {
        const categoryRates = CONFIG.PILL.CATEGORY_RATES[isElite ? 'ELITE' : 'NORMAL'];
        const qualityRates = CONFIG.PILL.QUALITY_RATES[isElite ? 'ELITE' : 'NORMAL'];
        let category = pickWeightedKey(categoryRates, 'EXP');
        const quality = pickWeightedKey(qualityRates, 'LOW');

        if (category === 'BREAKTHROUGH') {
            const nextRealm = this.getNextMajorRealmInfo();
            if (!nextRealm) category = 'EXP';
            else {
                return {
                    kind: 'PILL',
                    category,
                    quality,
                    realmKey: nextRealm.key,
                    realmName: nextRealm.name
                };
            }
        }

        return {
            kind: 'PILL',
            category,
            quality
        };
    },

    createRandomSpiritStoneDropSpec(isElite = false) {
        const qualityRates = CONFIG.SPIRIT_STONE.QUALITY_RATES[isElite ? 'ELITE' : 'NORMAL'];
        return {
            kind: 'STONE',
            quality: pickWeightedKey(qualityRates, 'LOW')
        };
    },

    getShopRestockIntervalMs() {
        const restockMinutes = Math.max(1, Math.floor(Number(CONFIG?.SHOP?.RESTOCK_INTERVAL_MINUTES) || 60));
        return restockMinutes * 60 * 1000;
    },

    isShopLimitedStockItem(item) {
        return ['EXP', 'INSIGHT', 'ATTACK', 'SHIELD_BREAK', 'BATTLE_AURA', 'BODY_TECHNIQUE', 'SENSE', 'BERSERK', 'RAGE', 'MANA', 'MAX_MANA', 'REGEN', 'SPEED', 'FORTUNE', 'BREAKTHROUGH', 'SPECIAL', 'MATERIAL'].includes(item?.category);
    },

    getShopStockKey(item) {
        return item?.id || '';
    },

    ensureShopConsumableStockState() {
        if (!this.shopConsumableStock || typeof this.shopConsumableStock !== 'object') {
            this.shopConsumableStock = {};
        }
        if (!this.shopConsumableRestockAt || typeof this.shopConsumableRestockAt !== 'object') {
            this.shopConsumableRestockAt = {};
        }
    },

    getShopItemMaxStock(item) {
        if (!item) return 0;

        if (item.category === 'SPECIAL') return 4;
        if (item.category === 'MATERIAL') {
            const materialConfig = this.getMaterialConfig(item.materialKey) || {};
            const quality = materialConfig.quality || item.quality || 'LOW';
            const rarityBase = { LOW: 24, MEDIUM: 16, HIGH: 10, SUPREME: 5 };
            const dropWeight = Number(materialConfig.dropWeight);
            const scarcityPenalty = Number.isFinite(dropWeight)
                ? Math.max(0, Math.ceil((0.8 - dropWeight) * 6))
                : 0;
            return Math.max(1, (rarityBase[quality] || 12) - scarcityPenalty);
        }

        const qualityStockMap = {
            LOW: 30,
            MEDIUM: 20,
            HIGH: 12,
            SUPREME: 6
        };

        return qualityStockMap[item.quality] || 10;
    },

    restockLimitedShopItem(item, now = Date.now()) {
        if (!this.isShopLimitedStockItem(item)) return;
        this.ensureShopConsumableStockState();

        const stockKey = this.getShopStockKey(item);
        if (!stockKey) return;

        const maxStock = this.getShopItemMaxStock(item);
        const intervalMs = this.getShopRestockIntervalMs();
        const hasTrackedStock = Object.prototype.hasOwnProperty.call(this.shopConsumableStock, stockKey);
        const nextRestockAt = Math.max(0, Number(this.shopConsumableRestockAt?.[stockKey]) || 0);
        const currentStock = Math.max(0, Math.floor(Number(this.shopConsumableStock?.[stockKey]) || 0));

        if (!hasTrackedStock) {
            this.shopConsumableStock[stockKey] = maxStock;
            this.shopConsumableRestockAt[stockKey] = 0;
            return;
        }

        if (currentStock > 0) {
            this.shopConsumableRestockAt[stockKey] = 0;
            return;
        }

        if (nextRestockAt <= 0) {
            this.shopConsumableRestockAt[stockKey] = now + intervalMs;
            return;
        }

        if (now < nextRestockAt) return;

        this.shopConsumableStock[stockKey] = maxStock;
        this.shopConsumableRestockAt[stockKey] = 0;
    },

    getLimitedShopItemStock(item) {
        if (!this.isShopLimitedStockItem(item)) {
            return { limited: false, remaining: Number.POSITIVE_INFINITY, max: Number.POSITIVE_INFINITY, restockAt: 0 };
        }

        this.restockLimitedShopItem(item);
        const stockKey = this.getShopStockKey(item);
        const max = this.getShopItemMaxStock(item);
        const remaining = Math.max(0, Math.floor(Number(this.shopConsumableStock?.[stockKey]) || 0));
        const restockAt = Math.max(0, Number(this.shopConsumableRestockAt?.[stockKey]) || 0);
        return { limited: true, remaining, max, restockAt };
    },

    consumeLimitedShopItemStock(item, amount = 1) {
        if (!this.isShopLimitedStockItem(item)) return true;
        this.restockLimitedShopItem(item);
        const stockInfo = this.getLimitedShopItemStock(item);
        if (!stockInfo.limited) return true;
        if (stockInfo.remaining < amount) return false;

        const stockKey = this.getShopStockKey(item);
        const updatedStock = Math.max(0, stockInfo.remaining - amount);
        this.shopConsumableStock[stockKey] = updatedStock;
        this.shopConsumableRestockAt[stockKey] = updatedStock <= 0 ? Date.now() + this.getShopRestockIntervalMs() : 0;
        GameProgress.requestSave();
        return true;
    },

    getShopItems() {
        const shopCategories = ['EXP', 'INSIGHT', 'ATTACK', 'SHIELD_BREAK', 'BATTLE_AURA', 'BODY_TECHNIQUE', 'SENSE', 'BERSERK', 'RAGE', 'MANA', 'MAX_MANA', 'REGEN', 'SPEED', 'FORTUNE'];
        const items = [];
        const craftablePillBuyMultiplier = 1.35;
        const swordArtifactBuyMultiplier = 1.6;

        shopCategories.forEach(category => {
            QUALITY_ORDER.forEach(quality => {
                const qualityConfig = this.getItemQualityConfig({ category, quality });
                items.push({
                    id: `${category}:${quality}`,
                    kind: 'PILL',
                    category,
                    quality,
                    priceLowStone: Math.floor((qualityConfig.buyPriceLowStone || 0) * craftablePillBuyMultiplier)
                });
            });
        });

        const nextRealm = this.getNextMajorRealmInfo();
        if (nextRealm) {
            QUALITY_ORDER.forEach(quality => {
                items.push({
                    id: `BREAKTHROUGH:${quality}:${nextRealm.key}`,
                    kind: 'PILL',
                    category: 'BREAKTHROUGH',
                    quality,
                    realmKey: nextRealm.key,
                    realmName: nextRealm.name,
                    priceLowStone: Math.floor((CONFIG.PILL.BREAKTHROUGH_QUALITIES[quality].buyPriceLowStone || 0) * craftablePillBuyMultiplier)
                });
            });
        }

        Object.entries(CONFIG.PILL.SPECIAL_ITEMS || {}).forEach(([specialKey, specialConfig]) => {
            items.push({
                id: `SPECIAL:${specialKey}`,
                kind: 'PILL',
                category: 'SPECIAL',
                quality: specialConfig.quality || 'SUPREME',
                specialKey,
                priceLowStone: Math.floor((specialConfig.buyPriceLowStone || 0) * craftablePillBuyMultiplier)
            });
        });

        Object.entries(CONFIG.SECRET_ARTS || {}).forEach(([uniqueKey, artConfig]) => {
            if (uniqueKey === 'CAN_LAM_BANG_DIEM') return;
            items.push({
                id: `SECRET_ART:${uniqueKey}`,
                kind: 'UNIQUE',
                category: SWORD_SECRET_ART_KEYS.includes(uniqueKey) ? 'SWORD_ART' : 'FLAME_ART',
                quality: artConfig.quality || 'SUPREME',
                uniqueKey,
                priceLowStone: artConfig.buyPriceLowStone || 0,
                isOneTime: true
            });
        });

        if (CONFIG.SWORD?.ARTIFACT_ITEM) {
            items.push({
                id: `SWORD_ARTIFACT:${CONFIG.SWORD.ARTIFACT_ITEM.uniqueKey || 'THANH_TRUC_PHONG_VAN_KIEM'}`,
                kind: 'UNIQUE',
                category: 'SWORD_ARTIFACT',
                quality: CONFIG.SWORD.ARTIFACT_ITEM.quality || 'HIGH',
                uniqueKey: CONFIG.SWORD.ARTIFACT_ITEM.uniqueKey || 'THANH_TRUC_PHONG_VAN_KIEM',
                priceLowStone: Math.floor((CONFIG.SWORD.ARTIFACT_ITEM.buyPriceLowStone || 0) * swordArtifactBuyMultiplier)
            });
        }

        Object.entries(CONFIG.ARTIFACTS || {}).forEach(([uniqueKey, artifactConfig]) => {
            if (artifactConfig?.shopHidden) return;
            items.push({
                id: `ARTIFACT:${uniqueKey}`,
                kind: 'UNIQUE',
                category: 'ARTIFACT',
                quality: artifactConfig.quality || 'SUPREME',
                uniqueKey,
                priceLowStone: artifactConfig.buyPriceLowStone || 0,
                isOneTime: true
            });
        });

        QUALITY_ORDER.forEach(quality => {
            const bagConfig = CONFIG.ITEMS.STORAGE_BAGS?.[quality];
            if (!bagConfig) return;

            items.push({
                id: `BAG:${quality}`,
                kind: 'UPGRADE',
                category: 'BAG',
                quality,
                priceLowStone: bagConfig.buyPriceLowStone || 0
            });
        });

        if (CONFIG.ITEMS?.SEVEN_COLOR_BAG) {
            items.push({
                id: 'RAINBOW_BAG:SUPREME',
                kind: 'UPGRADE',
                category: 'RAINBOW_BAG',
                quality: CONFIG.ITEMS.SEVEN_COLOR_BAG.quality || 'SUPREME',
                uniqueKey: 'THAT_SAC_TRU_VAT_NANG',
                priceLowStone: CONFIG.ITEMS.SEVEN_COLOR_BAG.buyPriceLowStone || 0,
                isOneTime: true
            });
        }

        Object.entries(CONFIG.INSECT?.UNIQUE_ITEMS || {}).forEach(([uniqueKey, uniqueConfig]) => {
            items.push({
                id: `UNIQUE:${uniqueKey}`,
                kind: 'UNIQUE',
                category: uniqueKey === 'KHU_TRUNG_THUAT' ? 'INSECT_SKILL' : 'INSECT_ARTIFACT',
                quality: uniqueConfig.quality || 'HIGH',
                uniqueKey,
                priceLowStone: uniqueConfig.buyPriceLowStone || 0,
                isOneTime: true
            });
        });

        this.getInsectSpeciesEntries().forEach(([speciesKey, species]) => {
            const eggConfig = this.getInsectEggShopConfig(speciesKey);
            const habitatConfig = this.getInsectHabitatConfig(speciesKey);

            items.push({
                id: `INSECT_EGG:${speciesKey}`,
                kind: 'INSECT_EGG',
                category: 'INSECT_EGG',
                quality: eggConfig.quality || 'LOW',
                speciesKey,
                priceLowStone: eggConfig.buyPriceLowStone || 0
            });

            items.push({
                id: `SPIRIT_HABITAT:${speciesKey}`,
                kind: 'HABITAT',
                category: 'SPIRIT_HABITAT',
                quality: habitatConfig.quality || 'LOW',
                speciesKey,
                priceLowStone: habitatConfig.buyPriceLowStone || 0,
                habitatTier: species?.tier || 'PHAM'
            });
        });

        Object.entries(CONFIG.ITEMS?.MATERIALS || {}).forEach(([materialKey, materialConfig]) => {
            items.push({
                id: `MATERIAL:${materialKey}`,
                kind: 'MATERIAL',
                category: 'MATERIAL',
                quality: materialConfig.quality || 'LOW',
                materialKey,
                priceLowStone: materialConfig.buyPriceLowStone || 0
            });
        });

        Object.entries(this.getAlchemyRecipeDefinitions() || {}).forEach(([recipeKey, recipeConfig]) => {
            items.push({
                id: `ALCHEMY_RECIPE:${recipeKey}`,
                kind: 'ALCHEMY_RECIPE',
                category: 'ALCHEMY_RECIPE',
                quality: recipeConfig.formulaQuality || recipeConfig.output?.quality || 'LOW',
                recipeKey,
                priceLowStone: recipeConfig.buyPriceLowStone || 0,
                isOneTime: true,
                uniqueKey: `ALCHEMY_RECIPE:${recipeKey}`
            });
        });

        Object.entries(CONFIG.ALCHEMY?.FURNACES || {}).forEach(([furnaceKey, furnaceConfig]) => {
            items.push({
                id: `ALCHEMY_FURNACE:${furnaceKey}`,
                kind: 'ALCHEMY_FURNACE',
                category: 'ALCHEMY_FURNACE',
                quality: furnaceConfig.quality || 'LOW',
                furnaceKey,
                priceLowStone: furnaceConfig.buyPriceLowStone || 0,
                isOneTime: true,
                uniqueKey: `ALCHEMY_FURNACE:${furnaceKey}`
            });
        });

        if (CONFIG.INSECT?.SEVEN_COLOR_BEAST_BAG) {
            items.push({
                id: 'RAINBOW_SPIRIT_BAG:SUPREME',
                kind: 'UPGRADE',
                category: 'RAINBOW_SPIRIT_BAG',
                quality: CONFIG.INSECT.SEVEN_COLOR_BEAST_BAG.quality || 'SUPREME',
                uniqueKey: 'THAT_SAC_LINH_THU_DAI',
                priceLowStone: CONFIG.INSECT.SEVEN_COLOR_BEAST_BAG.buyPriceLowStone || 0,
                isOneTime: true
            });
        }

        const shopOrder = {
            SWORD_ART: -5,
            FLAME_ART: -4,
            SWORD_ARTIFACT: -3.75,
            ARTIFACT: -3.5,
            INSECT_SKILL: -3,
            INSECT_ARTIFACT: -2,
            RAINBOW_SPIRIT_BAG: -1.6,
            SPIRIT_HABITAT: -1.25,
            INSECT_EGG: -1.1,
            RAINBOW_BAG: -1.05,
            BAG: -1,
            ALCHEMY_RECIPE: -0.9,
            ALCHEMY_FURNACE: -0.8,
            MATERIAL: -0.5,
            EXP: 0,
            INSIGHT: 1,
            ATTACK: 2,
            SHIELD_BREAK: 3,
            BERSERK: 4,
            RAGE: 5,
            MANA: 6,
            MAX_MANA: 7,
            REGEN: 8,
            SPEED: 9,
            FORTUNE: 10,
            BREAKTHROUGH: 11,
            SPECIAL: 12
        };

        return items.sort((a, b) => {
            const categoryDiff = (shopOrder[a.category] ?? 99) - (shopOrder[b.category] ?? 99);
            if (categoryDiff !== 0) return categoryDiff;

            return QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality);
        }).map(item => {
            const stockInfo = this.getLimitedShopItemStock(item);
            return stockInfo.limited
                ? { ...item, shopStockRemaining: stockInfo.remaining, shopStockMax: stockInfo.max, shopRestockAt: stockInfo.restockAt }
                : item;
        });
    },

    collectDrop(dropSpec) {
        if (!dropSpec) return;

        if (dropSpec.kind === 'STONE') {
            const stoneType = this.getSpiritStoneType(dropSpec.quality);
            this.addSpiritStone(dropSpec.quality, 1);
            showNotify(`+1 ${stoneType.label}`, stoneType.color);
        } else if (dropSpec.kind === 'INSECT_EGG') {
            const species = this.getInsectSpecies(dropSpec.speciesKey);
            this.addInsectEgg(dropSpec.speciesKey, 1);
            showNotify(`+1 Trứng ${species?.name || 'kỳ trùng'}`, species?.eggColor || species?.color || '#79ffd4');
        } else {
            if (!this.hasInventorySpaceForSpec(dropSpec)) {
                const qualityConfig = this.getItemQualityConfig(dropSpec);
                showNotify('Túi trữ vật đã đầy, hãy mở rộng thêm dung tích.', qualityConfig.color || '#ff8a80');
                return;
            }

            const item = this.addInventoryItem(dropSpec, 1);
            const qualityConfig = this.getItemQualityConfig(item);
            showNotify(`+1 ${this.getItemDisplayName(item)}`, qualityConfig.color);
        }

        this.refreshResourceUI();
    },

    refreshResourceUI() {
        this.enforcePhongLoiSiSwordRequirement({ silent: true });
        this.renderExpUI();

        if (BeastBagUI && typeof BeastBagUI.syncAvailability === 'function') {
            BeastBagUI.syncAvailability();
        }

        if (ShopUI && typeof ShopUI.render === 'function') {
            ShopUI.render();
        }

        if (InventoryUI && typeof InventoryUI.render === 'function') {
            InventoryUI.render();
        }

        if (BeastBagUI && typeof BeastBagUI.isOpen === 'function' && BeastBagUI.isOpen()) {
            BeastBagUI.render();
        }

        if (ProfileUI && typeof ProfileUI.render === 'function') {
            ProfileUI.render();
        }

        if (AlchemyUI && typeof AlchemyUI.isOpen === 'function' && AlchemyUI.isOpen() && typeof AlchemyUI.render === 'function') {
            AlchemyUI.render();
        }

        // Không render SkillsUI liên tục trong refresh tổng để tránh giật danh sách kiếm khi người dùng đang cuộn.
        // SkillsUI sẽ tự render khi mở popup hoặc khi người dùng tương tác trực tiếp trong popup.

        if (InsectBookUI && typeof InsectBookUI.isOpen === 'function' && InsectBookUI.isOpen()) {
            InsectBookUI.render();
        }

        this.renderAttackModeUI();
        GameProgress.requestSave();
    },

    buyShopItem(itemId) {
        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return false;
        }

        const item = this.getShopItems().find(entry => entry.id === itemId);
        if (!item) return false;

        if (item.category === 'ARTIFACT' && item.uniqueKey === 'HU_THIEN_DINH' && this.hasArtifactUnlocked('HU_THIEN_DINH')) {
            if (AlchemyUI && typeof AlchemyUI.open === 'function') {
                AlchemyUI.open();
                showNotify('Hư Thiên Đỉnh đã luyện hóa, mở Đan Lô để khai đỉnh luyện đan.', this.getArtifactConfig('HU_THIEN_DINH')?.color || '#93c8d8');
                return true;
            }
        }

        const qualityConfig = this.getItemQualityConfig(item);
        const stockInfo = this.getLimitedShopItemStock(item);

        if (stockInfo.limited && stockInfo.remaining <= 0) {
            const remainingMs = Math.max(0, stockInfo.restockAt - Date.now());
            const waitSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
            showNotify(`Món này đã hết hàng, xin chờ ${formatNumber(waitSeconds)} giây để làm mới.`, qualityConfig.color || '#ffd36b');
            return false;
        }

        if (item.isOneTime && item.uniqueKey && this.hasUniquePurchase(item.uniqueKey)) {
            showNotify('Vật phẩm này chỉ có thể mua một lần.', qualityConfig.color || '#ffd36b');
            return false;
        }

        if (false && item.category === 'SWORD_ARTIFACT') {
            const progress = this.getSwordFormationProgress();
            if (progress.owned >= progress.required) {
                showNotify(
                    `Đã mua đủ ${formatNumber(progress.required)} thanh Thanh Trúc Phong Vân Kiếm, không cần mua thêm.`,
                    qualityConfig.color || '#66f0c2'
                );
                return false;
            }
        }

        if (item.category === 'BAG' && !this.canUpgradeInventoryCapacity(item)) {
            showNotify('Túi trữ vật này chưa thể gia tăng dung lượng.', '#ffd36b');
            return false;
        }

        if (item.category === 'RAINBOW_BAG' && !this.canUpgradeInventoryCapacity(item)) {
            showNotify('Thất Sắc Trữ Vật Nang đã được khai mở.', qualityConfig.color || '#ffd36b');
            return false;
        }

        if (item.category === 'SPIRIT_BAG' && !this.canUpgradeBeastBagCapacity(item)) {
            showNotify('Linh Thú Đại này chưa thể gia tăng dung lượng.', qualityConfig.color || '#ffd36b');
            return false;
        }

        if (item.category === 'RAINBOW_SPIRIT_BAG' && !this.canUpgradeBeastBagCapacity(item)) {
            showNotify('Thất Sắc Linh Thú Đại đã được khai mở.', qualityConfig.color || '#ffd36b');
            return false;
        }

        if (item.category === 'SPIRIT_HABITAT' && !this.canUpgradeBeastBagCapacity(item)) {
            showNotify(
                this.hasSevenColorSpiritBag()
                    ? 'Thất Sắc Linh Thú Đại đã khai mở, không cần mua thêm Linh Thú Đại riêng.'
                    : 'Linh Thú Đại này chưa thể khai mở.',
                qualityConfig.color || '#8ebfff'
            );
            return false;
        }

        const requiresInventorySpace = !['BAG', 'RAINBOW_BAG', 'SPIRIT_BAG', 'RAINBOW_SPIRIT_BAG', 'SPIRIT_HABITAT', 'INSECT_EGG', 'ALCHEMY_RECIPE', 'ALCHEMY_FURNACE'].includes(item.category);
        if (requiresInventorySpace && !this.hasInventorySpaceForSpec(item)) {
            showNotify('Túi trữ vật đã đầy, không thể mua thêm vật phẩm mới.', '#ff8a80');
            return false;
        }

        if (!this.spendSpiritStones(item.priceLowStone)) {
            showNotify('Linh thạch không đủ để giao dịch', '#ff8a80');
            return false;
        }

        if (item.category === 'BAG') {
            const previousCapacity = this.getInventoryCapacity();
            const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
            this.upgradeInventoryCapacity(previousCapacity + extraSlots);

            showNotify(
                `Túi trữ vật mở rộng lên ${formatNumber(this.getInventoryCapacity())} ô (+${formatNumber(extraSlots)} ô)`,
                qualityConfig.color
            );
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'SPIRIT_BAG') {
            const previousCapacity = this.getBeastBagCapacity();
            const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
            this.beastBagCapacity = previousCapacity + extraSlots;

            showNotify(
                `Linh Thú Đại mở rộng lên ${formatNumber(this.getBeastBagCapacity())} ô (+${formatNumber(extraSlots)} ô)`,
                qualityConfig.color
            );
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'RAINBOW_BAG') {
            this.markUniquePurchase(item.uniqueKey);
            showNotify(
                'Thất Sắc Trữ Vật Nang đã khai mở, túi trữ vật đạt dung lượng vô hạn.',
                qualityConfig.color || '#fff1a8'
            );
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'RAINBOW_SPIRIT_BAG') {
            this.markUniquePurchase(item.uniqueKey);
            showNotify(
                'Thất Sắc Linh Thú Đại đã khai mở, mọi kỳ trùng đều có thể an trí trong không gian vô hạn.',
                qualityConfig.color || '#ffe38b'
            );
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'SPIRIT_HABITAT') {
            const hadDedicatedHabitat = Boolean(this.insectHabitats?.[item.speciesKey]);
            const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
            const nextCapacity = this.upgradeInsectHabitatCapacity(item.speciesKey, extraSlots, { unlock: true });
            const actionText = hadDedicatedHabitat ? 'mở rộng lên' : 'đã khai mở với sức chứa';
            const deltaText = hadDedicatedHabitat ? ` (+${formatNumber(extraSlots)} ô)` : '';

            showNotify(
                `${this.getItemDisplayName(item)} ${actionText} ${formatNumber(nextCapacity)} ô${deltaText}`,
                qualityConfig.color || '#8ebfff'
            );
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'INSECT_EGG') {
            this.addInsectEgg(item.speciesKey, 1);
            this.consumeLimitedShopItemStock(item);
            showNotify(`Đã mua ${this.getItemDisplayName(item)}`, qualityConfig.color || '#79ffd4');
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'ALCHEMY_RECIPE') {
            this.alchemyUnlockedRecipes = this.alchemyUnlockedRecipes || {};
            this.alchemyUnlockedRecipes[item.recipeKey] = true;
            this.markUniquePurchase(item.uniqueKey);
            this.consumeLimitedShopItemStock(item);
            showNotify(`Đã lĩnh ${this.getItemDisplayName(item)}. Có thể mở Đan Lô để luyện.`, qualityConfig.color || '#93c8d8');
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'ALCHEMY_FURNACE') {
            this.alchemyFurnaces = this.alchemyFurnaces || {};
            this.alchemyFurnaces[item.furnaceKey] = true;
            this.alchemySelectedFurnace = item.furnaceKey;
            this.markUniquePurchase(item.uniqueKey);
            this.consumeLimitedShopItemStock(item);
            showNotify(`Đã mua ${this.getItemDisplayName(item)}. Đan lư này đã sẵn sàng để luyện đan.`, qualityConfig.color || '#93c8d8');
            if (AlchemyUI && typeof AlchemyUI.open === 'function') {
                AlchemyUI.open();
            }
            this.refreshResourceUI();
            return true;
        }

        const addedItem = this.addInventoryItem(item, 1);
        if (item.isOneTime && item.uniqueKey) {
            this.markUniquePurchase(item.uniqueKey);
        }
        this.consumeLimitedShopItemStock(item);
        showNotify(`Đã mua ${this.getItemDisplayName(addedItem)}`, this.getItemQualityConfig(addedItem).color);
        this.refreshResourceUI();
        return true;
    },

    getInventorySellPrice(item) {
        if (!item) return 0;
        if (item.category === 'SWORD_ARTIFACT' && item.source === 'REFINED') {
            return Math.max(1, Math.floor(Number(item.sellPriceLowStone) || 0));
        }
        if (['ARTIFACT', 'SWORD_ARTIFACT', 'INSECT_ARTIFACT', 'INSECT_SKILL', 'SWORD_ART', 'FLAME_ART'].includes(item.category)) return 0;

        const qualityConfig = this.getItemQualityConfig(item);
        const buyPrice = Math.max(0, qualityConfig.buyPriceLowStone || 0);
        const ratio = Math.max(0, parseFloat(CONFIG.ITEMS.SELLBACK_RATIO) || 0);
        const craftedBonusMultiplier = item.source === 'ALCHEMY' ? 2.2 : 1;
        const computedPrice = Math.floor(buyPrice * ratio * craftedBonusMultiplier);

        return Math.max(1, computedPrice);
    },

    sellInventoryItem(itemKey) {
        const item = this.inventory[itemKey];
        if (!item || item.count <= 0) return false;

        const sellPrice = this.getInventorySellPrice(item);
        if (sellPrice <= 0) return false;

        item.count--;
        if (item.count <= 0) delete this.inventory[itemKey];

        this.setSpiritStoneTotalValue(this.getSpiritStoneTotalValue() + sellPrice);
        showNotify(`Bán ${this.getItemDisplayName(item)}: +${formatNumber(sellPrice)} hạ phẩm linh thạch`, this.getItemQualityConfig(item).color);
        this.refreshResourceUI();
        return true;
    },

    useInventoryItem(itemKey) {
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
            showNotify(`Đan này chỉ hợp để đột phá ${item.realmName}`, "#ffd36b");
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
                showNotify("Dược lực đã chạm giới hạn đột phá", "#ffd36b");
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
            case 'BATTLE_AURA': {
                const critBonus = qualityConfig.critPct || 0;
                const critDmgBonus = qualityConfig.critDmgPct || 0;
                this.bonusStats.critPct += critBonus;
                this.bonusStats.critDmgPct += critDmgBonus;
                showNotify(
                    `Dùng ${this.getItemDisplayName(item)}: +${Math.round(critBonus * 100)}% bạo kích, +${Math.round(critDmgBonus * 100)}% bạo thương`,
                    qualityConfig.color
                );
                break;
            }
            case 'BODY_TECHNIQUE': {
                const evaBonus = qualityConfig.evaPct || 0;
                const defBonus = qualityConfig.defensePct || 0;
                this.bonusStats.evaPct += evaBonus;
                this.bonusStats.defensePct += defBonus;
                showNotify(
                    `Dùng ${this.getItemDisplayName(item)}: +${Math.round(evaBonus * 100)}% thân pháp, +${Math.round(defBonus * 100)}% phòng ngự`,
                    qualityConfig.color
                );
                break;
            }
            case 'SENSE': {
                const accBonus = qualityConfig.accPct || 0;
                const matkBonus = qualityConfig.matkPct || 0;
                const mdefBonus = qualityConfig.mdefPct || 0;
                this.bonusStats.accPct += accBonus;
                this.bonusStats.matkPct += matkBonus;
                this.bonusStats.mdefPct += mdefBonus;
                showNotify(
                    `Dùng ${this.getItemDisplayName(item)}: +${Math.round(accBonus * 100)}% chính xác, +${Math.round(matkBonus * 100)}% pháp công, +${Math.round(mdefBonus * 100)}% pháp phòng`,
                    qualityConfig.color
                );
                break;
            }
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

    getTribulationSteps() {
        const tribulationCfg = CONFIG.CULTIVATION?.TRIBULATION || {};
        const configuredSteps = Array.isArray(tribulationCfg.STEPS) ? tribulationCfg.STEPS : [];

        const normalizedSteps = configuredSteps
            .map(step => {
                const sourceRankId = Number(step?.sourceRankId ?? step?.SOURCE_RANK_ID);
                const targetRankId = Number(step?.targetRankId ?? step?.TARGET_RANK_ID);
                if (!Number.isFinite(sourceRankId) || !Number.isFinite(targetRankId)) return null;
                return { sourceRankId, targetRankId };
            })
            .filter(Boolean);

        if (normalizedSteps.length > 0) return normalizedSteps;

        // Fallback tương thích ngược với cấu hình cũ chỉ có 1 mốc độ kiếp.
        const sourceRankId = Number(tribulationCfg.SOURCE_RANK_ID) || 41;
        const targetRankId = Number(tribulationCfg.TARGET_RANK_ID) || 42;
        return [{ sourceRankId, targetRankId }];
    },

    getTribulationStepForRank(rankId) {
        const targetRankId = Number(rankId);
        if (!Number.isFinite(targetRankId)) return null;
        return this.getTribulationSteps().find(step => step.sourceRankId === targetRankId) || null;
    },

    isAtTribulationThreshold() {
        const currentRank = this.getCurrentRank();
        return Boolean(this.getTribulationStepForRank(currentRank?.id));
    },

    getTribulationTargetRankIndex() {
        const currentRank = this.getCurrentRank();
        const currentStep = this.getTribulationStepForRank(currentRank?.id);
        const targetRankId = Number(currentStep?.targetRankId) || Number(CONFIG.CULTIVATION?.TRIBULATION?.TARGET_RANK_ID) || 42;
        return getRankIndexById(targetRankId);
    },

    getTribulationConfig() {
        const cfg = CONFIG.CULTIVATION?.TRIBULATION || {};
        return {
            strikeCount: Math.max(1, Math.floor(Number(cfg.STRIKE_COUNT) || 9)),
            baseHp: Math.max(1, Math.floor(Number(cfg.BASE_HP) || 1000)),
            strikeIntervalMs: Math.max(250, Math.floor(Number(cfg.STRIKE_INTERVAL_MS) || 700)),
            prepareDelayMs: Math.max(0, Math.floor(Number(cfg.PREPARE_DELAY_MS) || 450)),
            damageRatioMin: Math.max(0.01, Number(cfg.DAMAGE_RATIO_MIN) || 0.08),
            damageRatioMax: Math.max(0.01, Number(cfg.DAMAGE_RATIO_MAX) || 0.18)
        };
    },

    getBreakthroughChanceDetails(rank = this.getCurrentRank()) {
        if (!rank) {
            return {
                pillBoost: 0,
                maxAllowed: CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99,
                totalChance: 0,
                basePercent: 0,
                bonusPercent: 0,
                totalPercent: 0
            };
        }

        const pillBoost = this.calculateTotalPillBoost();
        const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
        const totalChance = Math.max(0, Math.min(maxAllowed, rank.chance + pillBoost));

        return {
            pillBoost,
            maxAllowed,
            totalChance,
            basePercent: Math.round(rank.chance * 100),
            bonusPercent: Math.round(pillBoost * 100),
            totalPercent: Math.round(totalChance * 100)
        };
    },

    updateTribulationPopupUI() {
        const strikeTextEl = document.getElementById('tribulation-strike-text');
        const hpBarEl = document.getElementById('tribulation-hp-bar');
        const hpTextEl = document.getElementById('tribulation-hp-text');
        const state = this.tribulation || {};
        const maxHp = Math.max(1, Number(state.maxHp) || 1);
        const hp = Math.max(0, Math.round(Number(state.hp) || 0));
        const percent = Math.max(0, Math.min(100, (hp / maxHp) * 100));

        if (strikeTextEl) {
            const chancePercent = Math.max(0, Math.round((Number(state.successChance) || 0) * 100));
            strikeTextEl.innerText = `Lôi kiếp: ${Math.min(state.currentStrike || 0, state.totalStrikes || 0)}/${state.totalStrikes || 0} | Thiên cơ: ${chancePercent}%`;
        }
        if (hpBarEl) {
            hpBarEl.style.width = `${percent}%`;
        }
        if (hpTextEl) {
            hpTextEl.innerText = `Sinh cơ: ${formatNumber(hp)}/${formatNumber(maxHp)}`;
        }
    },

    closeTribulationPopup() {
        const popup = document.getElementById('tribulation-popup');
        if (popup) popup.classList.remove('show');
    },

    openTribulationPopup() {
        const popup = document.getElementById('tribulation-popup');
        if (!popup) return false;
        popup.classList.add('show');
        return true;
    },

    finishTribulation({ success }) {
        this.tribulation.active = false;
        this.closeTribulationPopup();

        if (success) {
            const targetIndex = this.getTribulationTargetRankIndex();
            const nextRank = CONFIG.CULTIVATION.RANKS[targetIndex];
            if (targetIndex < 0 || !nextRank) {
                showNotify('Độ kiếp hoàn tất nhưng thiên cơ mục tiêu không tồn tại trong cấu hình', '#ff9f9f');
                return;
            }

            this.rankIndex = targetIndex;
            this.exp = 0;
            this.isReadyToBreak = false;
            this.breakthroughBonus = 0;
            this.syncDerivedStats();
            this.mana = this.maxMana;
            this.refreshResourceUI();
            this.renderManaUI();
            this.createLevelUpExplosion(this.x, this.y, nextRank.color || '#ffe08f');
            showNotify(`ĐỘ KIẾP THÀNH CÔNG: ${nextRank.name.toUpperCase()}`, '#ffd36b');
            return;
        }

        this.tribulation.hp = 0;
        this.updateTribulationPopupUI();
        this.refreshResourceUI();
        showNotify('ĐỘ KIẾP THẤT BẠI: thân tử đạo tiêu', '#ff5757');
        this.updateHealth(-this.maxHp, 'lôi kiếp');
    },

    runTribulationSequence() {
        const config = this.getTribulationConfig();
        const rank = this.getCurrentRank();
        const chanceDetails = this.getBreakthroughChanceDetails(rank);
        const popupOpened = this.openTribulationPopup();
        if (!popupOpened) {
            showNotify('Không thể mở pháp đàn độ kiếp', '#ff7777');
            return;
        }

        const damageMin = Math.min(config.damageRatioMin, config.damageRatioMax);
        const damageMax = Math.max(config.damageRatioMin, config.damageRatioMax);

        this.tribulation.active = true;
        this.tribulation.startedAt = performance.now();
        this.tribulation.currentStrike = 0;
        this.tribulation.totalStrikes = config.strikeCount;
        this.tribulation.maxHp = config.baseHp;
        this.tribulation.hp = config.baseHp;
        this.tribulation.successChance = chanceDetails.totalChance;
        this.updateTribulationPopupUI();

        const cloudEl = document.getElementById('tribulation-cloud');
        const contentEl = document.querySelector('#tribulation-popup .tribulation-content');
        const cloudLightningEl = document.getElementById('tribulation-cloud-lightning');

        const ensureTribulationLightningCanvas = () => {
            if (!cloudLightningEl) return null;
            let canvas = cloudLightningEl.querySelector('canvas');
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.className = 'tribulation-cloud-lightning-canvas';
                cloudLightningEl.appendChild(canvas);
            }
            const rect = cloudLightningEl.getBoundingClientRect();
            const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            const targetWidth = Math.max(1, Math.round(rect.width));
            const targetHeight = Math.max(1, Math.round(rect.height));

            if (canvas.width !== Math.round(targetWidth * pixelRatio) || canvas.height !== Math.round(targetHeight * pixelRatio)) {
                canvas.width = Math.round(targetWidth * pixelRatio);
                canvas.height = Math.round(targetHeight * pixelRatio);
                canvas.style.width = `${targetWidth}px`;
                canvas.style.height = `${targetHeight}px`;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            return { canvas, ctx, width: targetWidth, height: targetHeight };
        };

        const drawTribulationLightning = (strikePower) => {
            const renderContext = ensureTribulationLightningCanvas();
            if (!renderContext || !cloudEl) return;
            const { canvas, ctx, width, height } = renderContext;
            const cloudRect = cloudEl.getBoundingClientRect();
            const wrapRect = cloudLightningEl.getBoundingClientRect();
            if (!cloudRect.width || !wrapRect.width) return;

            const cloudLeft = cloudRect.left - wrapRect.left;
            const cloudCenterX = cloudLeft + (cloudRect.width / 2);
            const topAnchor = Math.max(10, (cloudRect.top - wrapRect.top) + (cloudRect.height * 0.35));
            const strikeDistance = Math.max(120, height - topAnchor - 18);
            const depthRatio = Math.max(0, Math.min(1, strikePower / 7));
            const spreadDeg = 10 + Math.round(depthRatio * 18);
            const speedPx = 18 + Math.round(depthRatio * 14);

            const rand = (min, max) => Math.random() * (max - min) + min;
            const toRadians = (deg) => (deg * Math.PI) / 180;
            let totalBranches = 0;
            const maxSegmentsPerBolt = 120;
            const drawBolt = ({ startX, startY, angle, length, depth, maxDepth, branchChance, maxTotalBranches, spreadOverride, speedOverride }) => {
                let x = startX;
                let y = startY;
                let lastAngle = angle;
                let remaining = Math.max(0, length);
                let segmentCount = 0;
                const localSpreadDeg = Math.max(2, spreadOverride ?? spreadDeg);
                const localSpeedPx = Math.max(4, speedOverride ?? speedPx);

                while (remaining > 0 && segmentCount < maxSegmentsPerBolt) {
                    const segmentLength = Math.min(remaining, rand(localSpeedPx * 0.7, localSpeedPx * 1.2));
                    const angleChange = rand(1, localSpreadDeg);
                    lastAngle += (Math.random() > 0.5 ? 1 : -1) * angleChange;
                    const radians = toRadians(lastAngle);
                    const nextX = x + (Math.cos(radians) * segmentLength);
                    const nextY = y + (Math.sin(radians) * segmentLength);

                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(nextX, nextY);
                    ctx.stroke();

                    x = nextX;
                    y = nextY;
                    remaining -= segmentLength;
                    segmentCount += 1;

                    const canBranch = depth < maxDepth && totalBranches < maxTotalBranches && remaining > localSpeedPx * 0.5;
                    if (canBranch && Math.random() < branchChance) {
                        totalBranches += 1;
                        drawBolt({
                            startX: x,
                            startY: y,
                            angle: lastAngle + rand(-68, 68),
                            length: remaining * rand(0.32, 0.72),
                            depth: depth + 1,
                            maxDepth,
                            branchChance: branchChance * 0.92,
                            maxTotalBranches,
                            spreadOverride: localSpreadDeg * 1.08,
                            speedOverride: localSpeedPx * 0.94
                        });
                    }
                }
            };

            ctx.clearRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'screen';
            ctx.lineCap = 'round';
            ctx.shadowColor = 'rgba(236, 252, 255, 0.96)';

            const drawLightningPass = ({ lineWidth, shadowBlur, strokeStyle, offsetX, startX, startY, angle, length, branchChance, maxDepth, maxTotalBranches, spreadOverride, speedOverride }) => {
                ctx.shadowBlur = shadowBlur;
                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = strokeStyle;
                drawBolt({
                    startX: startX ?? (cloudCenterX + offsetX),
                    startY: startY ?? topAnchor,
                    length,
                    angle,
                    depth: 0,
                    maxDepth,
                    branchChance,
                    maxTotalBranches,
                    spreadOverride,
                    speedOverride
                });
            };

            // Trục sét lớn ở giữa (dày + gần như thẳng).
            drawLightningPass({
                lineWidth: Math.max(5.2, 6.8 + (depthRatio * 2.1)),
                shadowBlur: 18 + (strikePower * 2),
                strokeStyle: 'rgba(252, 255, 255, 0.99)',
                offsetX: rand(-4, 4),
                angle: 90 + rand(-1.8, 1.8),
                length: strikeDistance * rand(1, 1.08),
                branchChance: 0.06,
                maxDepth: 1,
                maxTotalBranches: 5,
                spreadOverride: 3.5,
                speedOverride: speedPx * 1.06
            });

            // Lớp glow quanh trục sét chính.
            drawLightningPass({
                lineWidth: Math.max(3.2, 4.4 + (depthRatio * 2.4)),
                shadowBlur: 15 + (strikePower * 1.8),
                strokeStyle: 'rgba(244, 254, 255, 0.98)',
                offsetX: rand(-10, 10),
                angle: 90 + rand(-4, 4),
                length: strikeDistance * rand(0.94, 1.08),
                branchChance: 0.32,
                maxDepth: 4 + Math.floor(depthRatio * 2),
                maxTotalBranches: 24 + Math.floor(depthRatio * 10)
            });

            // Tia sét nhỏ tản đều ngang đám mây + lệch nhịp.
            const sideBoltCount = 6 + Math.floor(rand(0, 3));
            for (let i = 0; i < sideBoltCount; i += 1) {
                const ratio = (i + 1) / (sideBoltCount + 1);
                const anchorX = cloudLeft + (cloudRect.width * ratio);
                const delayMs = 28 + (i * 52) + Math.round(rand(0, 44));
                setTimeout(() => {
                    if (canvas.parentElement !== cloudLightningEl || !this.tribulation?.active) return;
                    drawLightningPass({
                        lineWidth: Math.max(1.3, 1.8 + (depthRatio * 0.9)),
                        shadowBlur: 8 + (strikePower * 0.9),
                        strokeStyle: 'rgba(204, 241, 255, 0.92)',
                        startX: anchorX + rand(-18, 18),
                        angle: 90 + rand(-14, 14),
                        length: strikeDistance * rand(0.42, 0.78),
                        branchChance: 0.12 + (depthRatio * 0.08),
                        maxDepth: 1 + Math.floor(depthRatio * 2),
                        maxTotalBranches: 8 + Math.floor(depthRatio * 4)
                    });
                }, delayMs);
            }

            // Một vài tia sét nhỏ nằm ngang trong mây.
            const horizontalBoltCount = 2 + Math.floor(rand(0, 2));
            for (let i = 0; i < horizontalBoltCount; i += 1) {
                const ratio = (i + 1) / (horizontalBoltCount + 1);
                const delayMs = 60 + (i * 96) + Math.round(rand(0, 64));
                setTimeout(() => {
                    if (canvas.parentElement !== cloudLightningEl || !this.tribulation?.active) return;
                    const fromLeft = Math.random() > 0.5;
                    drawLightningPass({
                        lineWidth: Math.max(1.1, 1.5 + (depthRatio * 0.55)),
                        shadowBlur: 6 + (strikePower * 0.65),
                        strokeStyle: 'rgba(193, 235, 255, 0.84)',
                        startX: cloudLeft + (cloudRect.width * ratio) + rand(-26, 26),
                        startY: (cloudRect.top - wrapRect.top) + (cloudRect.height * rand(0.28, 0.62)),
                        angle: fromLeft ? rand(-16, 16) : rand(164, 196),
                        length: cloudRect.width * rand(0.18, 0.32),
                        branchChance: 0.05,
                        maxDepth: 1,
                        maxTotalBranches: 4,
                        spreadOverride: 4.2,
                        speedOverride: speedPx * 0.78
                    });
                }, delayMs);
            }

            const fadeStartMs = 180;
            const fadeDurationMs = 360;
            setTimeout(() => {
                const fadeStartedAt = performance.now();
                const fadeStep = () => {
                    const elapsed = performance.now() - fadeStartedAt;
                    const progress = Math.min(1, elapsed / fadeDurationMs);
                    ctx.fillStyle = `rgba(0, 0, 0, ${0.08 + (progress * 0.24)})`;
                    ctx.fillRect(0, 0, width, height);
                    if (progress < 1) {
                        requestAnimationFrame(fadeStep);
                    } else {
                        ctx.clearRect(0, 0, width, height);
                    }
                };
                requestAnimationFrame(fadeStep);
            }, fadeStartMs);

            setTimeout(() => {
                if (canvas.parentElement === cloudLightningEl) {
                    cloudLightningEl.removeChild(canvas);
                }
            }, 720);
        };

        const performStrike = () => {
            if (!this.tribulation.active) return;

            this.tribulation.currentStrike += 1;
            const progress = this.tribulation.totalStrikes > 0
                ? this.tribulation.currentStrike / this.tribulation.totalStrikes
                : 1;
            const strikePower = 1 + (progress * 6);
            cloudEl?.classList.remove('is-striking');
            contentEl?.classList.remove('is-striking');
            void cloudEl?.offsetWidth;
            void contentEl?.offsetWidth;
            if (contentEl) {
                contentEl.style.setProperty('--tribulation-strike-power', strikePower.toFixed(2));
            }
            cloudEl?.classList.add('is-striking');
            drawTribulationLightning(strikePower);

            const mainStrikeDelay = Math.round(130 + Math.min(140, strikePower * 13));
            setTimeout(() => {
                if (!this.tribulation.active) return;

                contentEl?.classList.add('is-striking');

                const damageRatio = damageMin + (Math.random() * (damageMax - damageMin));
                const damage = Math.max(1, Math.round(this.tribulation.maxHp * damageRatio));
                this.tribulation.hp = Math.max(0, this.tribulation.hp - damage);
                this.updateTribulationPopupUI();

                if (this.tribulation.currentStrike >= this.tribulation.totalStrikes) {
                    let success = this.tribulation.hp > 0;
                    if (!success) {
                        const heavenlyChance = Math.max(0, Math.min(1, Number(this.tribulation.successChance) || 0));
                        if (Math.random() <= heavenlyChance) {
                            success = true;
                            this.tribulation.hp = Math.max(1, Math.round(this.tribulation.maxHp * 0.12));
                            this.updateTribulationPopupUI();
                            showNotify(`Thiên cơ gia hộ: cưỡng chuyển bại thành thắng (${Math.round(heavenlyChance * 100)}%)`, '#ffdf8f');
                        }
                    }
                    setTimeout(() => this.finishTribulation({ success }), 380);
                    return;
                }

                setTimeout(performStrike, config.strikeIntervalMs);
            }, mainStrikeDelay);
        };

        setTimeout(performStrike, config.prepareDelayMs);
        showNotify(
            `Thiên lôi tụ vân: bắt đầu độ kiếp Cửu Cửu | Cơ sở ${chanceDetails.basePercent}% + Đan ${chanceDetails.bonusPercent}% = ${chanceDetails.totalPercent}%`,
            '#91d6ff'
        );
    },

    executeBreakthrough(isForced = false) {
        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return;
        }

        if (this.tribulation?.active) {
            showNotify('Độ kiếp đang diễn ra, không thể cưỡng hành đột phá', '#8fc7ff');
            return;
        }

        const currentRank = this.getCurrentRank();
        if (!currentRank) return;
        if (this.rankIndex >= this.getMaxRankIndex() || currentRank.infiniteStats) {
            this.isReadyToBreak = false;
            showNotify(`Đã chạm ${currentRank.name}, thiên đạo không còn cửa ải cao hơn`, getRankAccentColor(currentRank));
            this.refreshResourceUI();
            return;
        }

        // Ở ngưỡng độ kiếp thì không dùng roll tỉ lệ đột phá thông thường.
        // Bấm đột phá sẽ vào thẳng popup/lộ trình độ kiếp.
        if (this.isAtTribulationThreshold()) {
            this.runTribulationSequence();
            return;
        }

        const chanceDetails = this.getBreakthroughChanceDetails(currentRank);
        const totalChance = chanceDetails.totalChance;

        if (Math.random() <= totalChance) {
            this.exp = 0;
            this.rankIndex++;
            this.isReadyToBreak = false;
            this.breakthroughBonus = 0;

            const nextRank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
            if (nextRank) {
                this.syncDerivedStats();

                if (isForced) {
                    showNotify(`CƯỠNG ÉP ĐỘT PHÁ THÀNH CÔNG: ${nextRank.name.toUpperCase()}`, "#ff8800");
                } else {
                    this.mana = this.maxMana;
                    showNotify(`ĐỘT PHÁ THÀNH CÔNG: ${nextRank.name.toUpperCase()}`, "#ffcc00");
                }
            }
            this.createLevelUpExplosion(this.x, this.y, nextRank?.color || currentRank.color);
        } else {
            const penaltyFactor = CONFIG.CULTIVATION.BREAKTHROUGH_PENALTY_FACTOR;
            const penalty = Math.floor(this.exp * penaltyFactor);

            this.exp -= penalty;
            this.isReadyToBreak = false;
            this.breakthroughBonus *= 0.5;

            const penaltyPercent = Math.round(penaltyFactor * 100);
            showNotify(`ĐỘT PHÁ THẤT BẠI! Tâm ma phản phệ (-${penaltyPercent}% tu vi)`, "#ff4444");
            this.triggerExpError();
        }

        this.refreshResourceUI();
        this.renderManaUI();
    },

    renderExpUI() {
        const rank = this.getCurrentRank();
        if (!rank) return;

        this.syncDerivedStats();
        const rankAccent = getRankAccentColor(rank);
        const rankLight = getRankLightColor(rank);

        const barExp = document.getElementById('exp-bar');
        const textExp = document.getElementById('exp-text');
        const rankText = document.getElementById('cultivation-rank');
        const breakthroughGroup = document.querySelector('.breakthrough-group');

        const chanceDetails = this.getBreakthroughChanceDetails(rank);
        const basePercent = chanceDetails.basePercent;
        const bonusPercent = chanceDetails.bonusPercent;
        const totalPercent = chanceDetails.totalPercent;

        if (textExp) {
            const isTribulationStep = this.isAtTribulationThreshold();
            const statusText = this.isVoidCollapsed
                ? `<span style="color:#b48cff; font-weight:bold;">${UI_TEXT.VOID_COLLAPSED}</span>`
                : this.isReadyToBreak ?
                `<span style="color:#ffcc00; font-weight:bold;">${isTribulationStep ? 'SẴN SÀNG ĐỘ KIẾP' : 'SẴN SÀNG ĐỘT PHÁ'}</span>` :
                `Tu vi: ${formatNumber(this.exp)}/${formatNumber(rank.exp)}`;

            textExp.innerHTML = `${statusText} | ` +
                `<span style="color:#86fff0">Cơ sở: ${basePercent}%</span> | ` +
                `<span style="color:#ffd36b">Đan trợ lực: +${bonusPercent}%</span> | ` +
                `<span style="color:#ff9ef7">Tổng TL: ${totalPercent}%</span>`;
        }

        if (breakthroughGroup) {
            if (this.isReadyToBreak && this.rankIndex < this.getMaxRankIndex() && !rank.infiniteStats) breakthroughGroup.classList.add('is-active');
            else breakthroughGroup.classList.remove('is-active');
        }

        const percentage = getSafeProgressPercent(this.exp, rank.exp);
        if (barExp) {
            barExp.style.width = `${percentage}%`;
            barExp.style.background = getRankBarBackground(rank);

            if (this.isReadyToBreak) {
                barExp.style.boxShadow = `0 0 15px #fff, 0 0 5px ${rankAccent}`;
                barExp.classList.add('exp-full-glow');
            } else {
                barExp.style.boxShadow = `0 0 10px ${rankLight}`;
                barExp.classList.remove('exp-full-glow');
            }
        }

        if (rankText) {
            rankText.innerText = this.isAtTribulationThreshold()
                ? `Cảnh giới: ${rank.name} • Bước Độ kiếp`
                : `Cảnh giới: ${rank.name}`;
            applyRankTextVisual(rankText, rank);
        }
        if (ProfileUI && typeof ProfileUI.isOpen === 'function' && ProfileUI.isOpen()) {
            ProfileUI.render();
        }

        GameProgress.requestSave();
    },

    triggerExpError() {
        const el = document.getElementById('exp-container');
        el.classList.add('shake-red');
        setTimeout(() => el.classList.remove('shake-red'), 500);
    },

    update(dt) { // Nhận thêm tham số dt
        this.updateUltimateState();
        this.updateActiveEffects();
        this.updateSingleSwordUltimateChargeState();
        if (typeof this.tickAlchemyBatch === 'function') {
            this.tickAlchemyBatch();
        }

        if (this.isGameOver) {
            this.resetAttackState();
            this.stopMoveJoystick();
            this.stopTouchCursor();
            return;
        }

        if (this.isVoidCollapsed) {
            this.resetAttackState();
            this.clearSingleSwordUltimateState();
            this.stopMoveJoystick();
            this.stopTouchCursor();
            this.pinchZoomActive = false;
            return;
        }

        this.updateBeastCare();

        const joystickTarget = this.getMoveJoystickTarget();
        if (joystickTarget) {
            this.x = joystickTarget.x;
            this.y = joystickTarget.y;
        } else if (this.isTouchDevice && this.hasActiveTouchCursor()) {
            const worldPos = Camera.screenToWorld(this.screenX, this.screenY);
            this.x = worldPos.x;
            this.y = worldPos.y;
        } else if (this.isTouchDevice) {
            this.x = guardCenter.x;
            this.y = guardCenter.y;
        } else {
            const worldPos = Camera.screenToWorld(this.screenX, this.screenY);
            this.x = worldPos.x;
            this.y = worldPos.y;
        }

        // Tính tốc độ di chuyển của con trỏ/ngón tay
        this.screenSpeed = Math.hypot(this.screenX - this.prevScreenX, this.screenY - this.prevScreenY);
        this.prevScreenX = this.screenX;
        this.prevScreenY = this.screenY;
        this.speed = Math.hypot(this.x - this.px, this.y - this.py);
        this.px = this.x; this.py = this.y;

        this.ensureValidAttackMode();

        // Gọi hàm xử lý tiêu hao mana
        this.processActiveConsumption(dt);
        this.updateNegativeStatuses(dt);
    },

    handleMove(e) {
        if (this.isVoidCollapsed) return;
        const isTouchPointer = this.isTouchDevice && e.pointerType && e.pointerType !== 'mouse';
        if (isTouchPointer) {
            if (!this.touchCursor.active || this.touchCursor.pointerId !== e.pointerId || this.pinchZoomActive) return;
            this.updateTouchCursor(e.clientX, e.clientY);
            return;
        }

        if (this.isTouchDevice) return;
        const hitTarget = typeof this.getTouchHitTarget === 'function'
            ? this.getTouchHitTarget(e.target, e.clientX, e.clientY)
            : e.target;
        if (typeof this.isUiInteractionTarget === 'function' && this.isUiInteractionTarget(hitTarget)) return;

        // Pointermove hoạt động cho cả chuột và touch di chuyển
        const p = e.touches ? e.touches[0] : e;
        this.screenX = p.clientX;
        this.screenY = p.clientY;
    },

    handleDown(e) {
        if (this.isVoidCollapsed) return;
        const isTouchPointer = this.isTouchDevice && e.pointerType && e.pointerType !== 'mouse';

        if (isTouchPointer) {
            this.startTouchCursor(e.pointerId, e.target, e.clientX, e.clientY);
            return;
        }

        const hitTarget = typeof this.getTouchHitTarget === 'function'
            ? this.getTouchHitTarget(e.target, e.clientX, e.clientY)
            : e.target;
        if (typeof this.isUiInteractionTarget === 'function' && this.isUiInteractionTarget(hitTarget)) return;

        // LOGIC MỚI: Nếu là mobile, chạm màn hình KHÔNG kích hoạt tấn công
        if (this.isTouchDevice) return;

        this.screenX = e.clientX;
        this.screenY = e.clientY;

        if (this.isUnarmedAttackMode()) {
            e.preventDefault();
            this.triggerUnarmedTapAttack(260, Camera.screenToWorld(e.clientX, e.clientY));
            return;
        }

        if (this.isSingleSwordTapAttackMode()) {
            e.preventDefault();
            if (this.beginSingleSwordUltimateCharge()) return;
            this.triggerSingleSwordTapAttack();
            return;
        }

        // Nếu là Desktop (chuột), vẫn giữ logic nhấn giữ để tấn công
        e.preventDefault();
        if (this.attackTimer) {
            clearTimeout(this.attackTimer);
        }
        this.attackTimer = setTimeout(() => {
            this.attackTimer = null;
            if (this.isVoidCollapsed) return;
            this.isAttacking = true;
        }, CONFIG.SWORD.ATTACK_DELAY_MS);
    },

    handleUp(e) {
        if (this.isVoidCollapsed) return;
        const isTouchPointer = this.isTouchDevice && e.pointerType && e.pointerType !== 'mouse';
        if (isTouchPointer) {
            this.stopTouchCursor(e.pointerId);
            return;
        }
        // Chỉ xử lý handleUp cho chuột trên desktop
        if (!this.isTouchDevice) {
            if (this.isUnarmedAttackMode()) {
                return;
            }
            if (this.isSingleSwordTapAttackMode()) {
                if (this.isSingleSwordUltimateReady()) {
                    this.releaseSingleSwordUltimateShot();
                }
                return;
            }
            this.resetAttackState();
        }
    },

    handleWheel(e) {
        const delta = -e.deltaY * CONFIG.ZOOM.SENSITIVITY;
        Camera.adjustZoom(delta);
    },

    getSwarmVisualCount() {
        return Math.max(0, Math.min(Math.floor(CONFIG.INSECT?.ATTACK?.VISUAL_LIMIT || 0), this.getTotalTamedInsectCount()));
    },

    pickOwnedInsectSpeciesKey() {
        const weighted = this.getActiveInsectSpeciesKeys().reduce((rates, speciesKey) => {
            rates[speciesKey] = Math.max(0.05, this.tamedInsects[speciesKey] || 0);
            return rates;
        }, {});

        return pickWeightedKey(weighted, this.getActiveInsectSpeciesKeys()[0] || null);
    },

    updateInsectSwarm(dt, enemies, scaleFactor) {
        const cfg = CONFIG.INSECT?.ATTACK || {};
        const shouldRender = this.attackMode === 'INSECT' && this.canUseInsectAttackMode() && !this.isUltMode && !this.isUltimateBusy();

        if (!shouldRender) {
            this.insectCombat.visuals = [];
            return;
        }

        const visualCount = this.getSwarmVisualCount();
        const centerX = this.x;
        const centerY = this.y;
        const visuals = this.insectCombat.visuals || [];
        const minRadius = Math.max(8, cfg.VISUAL_MIN_RADIUS || 18) * scaleFactor;
        const maxRadius = Math.max(minRadius + 4, cfg.VISUAL_MAX_RADIUS || 70) * scaleFactor;
        const jitter = Math.max(2, cfg.VISUAL_JITTER || 10) * scaleFactor;

        while (visuals.length < visualCount) {
            const speciesKey = this.pickOwnedInsectSpeciesKey();
            const species = this.getInsectSpecies(speciesKey);

            visuals.push({
                speciesKey,
                angle: Math.random() * Math.PI * 2,
                radius: random(minRadius, maxRadius),
                targetRadius: random(minRadius, maxRadius),
                speed: random(1.4, 3.2),
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: random(1.2, 2.8),
                size: random(2, 3.8) * (species?.tier === 'DE' ? 1.18 : 1),
                x: centerX,
                y: centerY
            });
        }

        if (visuals.length > visualCount) {
            visuals.length = visualCount;
        }

        visuals.forEach(node => {
            if (!this.tamedInsects[node.speciesKey]) {
                node.speciesKey = this.pickOwnedInsectSpeciesKey() || node.speciesKey;
            }

            node.angle += dt * node.speed * (this.isAttacking ? 2.6 : 1.6);
            node.wobble += dt * node.wobbleSpeed;
            node.targetRadius += random(-8, 8) * dt * 10;
            node.targetRadius = Math.max(minRadius, Math.min(maxRadius, node.targetRadius));
            node.radius += (node.targetRadius - node.radius) * 0.08;

            const swirlX = Math.cos(node.angle) * node.radius;
            const swirlY = Math.sin(node.angle * 1.18 + node.wobble) * (node.radius * 0.72);
            const chaosX = Math.cos(node.wobble * 1.7 + node.angle * 0.45) * jitter;
            const chaosY = Math.sin(node.wobble * 1.35 - node.angle * 0.4) * jitter;

            node.x = centerX + swirlX + chaosX;
            node.y = centerY + swirlY + chaosY;
        });

        markLeaderInsectVisuals(visuals);
        this.insectCombat.visuals = visuals;

        if (!this.isAttacking) return;

        const now = performance.now();
        const hitInterval = Math.max(60, cfg.HIT_INTERVAL_MS || 220);
        if (now - (this.insectCombat.lastHitAt || 0) < hitInterval) return;

        this.insectCombat.lastHitAt = now;

        const totalInsects = Math.max(1, this.getTotalTamedInsectCount());
        const targetRange = Math.max(60, cfg.TARGET_RANGE || 220);
        const damageFactor = Math.max(
            0.18,
            (cfg.BASE_DAMAGE_FACTOR || 0.45) + (Math.floor(totalInsects / 5) * (cfg.BONUS_DAMAGE_PER_5 || 0.08))
        );
        const targetCount = Math.max(1, Math.min(4, Math.ceil(totalInsects / 10)));
        const targets = enemies
            .filter(enemy => Math.hypot(enemy.x - centerX, enemy.y - centerY) <= targetRange)
            .sort((a, b) => Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY))
            .slice(0, targetCount);

        if (!targets.length) return;

        const pseudoSwarm = {
            getDamageMultiplier: () => damageFactor,
            powerPenalty: damageFactor
        };

        let shieldHits = 0;
        let killCount = 0;

        targets.forEach(target => {
            const result = target.hit(pseudoSwarm);

            if (result === 'shielded') shieldHits++;
            if (result === 'killed') killCount++;

            if (result === 'hit' || result === 'killed' || result === 'shielded') {
                this.createAttackBurst?.(target.x, target.y, result === 'shielded' ? '#ffb26b' : '#79ffd4');
            }
        });

        const casualtyKey = shieldHits > 0
            ? this.loseRandomTamedInsect(1 - Math.pow(1 - Math.max(0, Math.min(1, cfg.DEATH_ON_SHIELD_CHANCE || 0)), shieldHits))
            : this.loseRandomTamedInsect(cfg.DEATH_ON_HIT_CHANCE || 0);

        if (casualtyKey) {
            const species = this.getInsectSpecies(casualtyKey);
            showNotify(`1 ${species?.name || 'linh trùng'} tan lạc trong giao tranh`, species?.color || '#ff8a80');
            this.refreshResourceUI();
        }

        if (killCount > 0) {
            let bornCount = 0;
            for (let i = 0; i < killCount; i++) {
                if (this.reproduceRandomInsect(cfg.REPRODUCE_ON_KILL_CHANCE || 0)) {
                    bornCount++;
                }
            }

            if (bornCount > 0) {
                showNotify(`Đàn trùng sinh sôi thêm ${formatNumber(bornCount)} con`, '#79ffd4');
                this.refreshResourceUI();
            }
        }
    },

    drawInsectSwarm(ctx, scaleFactor) {
        if (!this.insectCombat.visuals?.length) return;

        ctx.save();
        ctx.lineWidth = 1;

        this.insectCombat.visuals.forEach((node, index) => {
            const species = this.getInsectSpecies(node.speciesKey);
            const color = species?.color || '#79ffd4';
            const secondaryColor = species?.secondaryColor || color;
            const auraColor = species?.auraColor || secondaryColor;
            const trailColor = species?.auraColor || secondaryColor;
            const size = Math.max(1.8, node.size * scaleFactor * (node.isLeader ? 1.8 : 1));

            if (index > 0) {
                const prev = this.insectCombat.visuals[index - 1];
                ctx.beginPath();
                ctx.strokeStyle = `${trailColor}26`;
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(node.x, node.y);
                ctx.stroke();
            }

            const gradient = ctx.createRadialGradient(
                node.x - size * 0.35,
                node.y - size * 0.35,
                Math.max(0.2, size * 0.15),
                node.x,
                node.y,
                size * 1.2
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.25, secondaryColor);
            gradient.addColorStop(0.7, color);
            gradient.addColorStop(1, `${auraColor}12`);

            ctx.beginPath();
            ctx.shadowBlur = 14;
            ctx.shadowColor = auraColor;
            ctx.fillStyle = gradient;
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    },

    // Hàm tạo hiệu ứng hạt bùng nổ
    getSwarmVisualCount() {
        return Math.max(0, Math.min(Math.floor(CONFIG.INSECT?.ATTACK?.VISUAL_LIMIT || 0), this.getCombatReadyInsectCount()));
    },

    pickOwnedInsectSpeciesKey(speciesPool = null) {
        const candidateKeys = (speciesPool || this.getCombatReadyInsectSpeciesKeys())
            .filter(speciesKey => (this.tamedInsects?.[speciesKey] || 0) > 0);
        const weighted = candidateKeys.reduce((rates, speciesKey) => {
            rates[speciesKey] = Math.max(0.05, this.tamedInsects?.[speciesKey] || 0);
            return rates;
        }, {});

        return pickWeightedKey(weighted, candidateKeys[0] || null);
    },

    getInsectAttackCandidates(centerX, centerY, enemies, targetRange) {
        return enemies
            .filter(enemy => Math.hypot(enemy.x - centerX, enemy.y - centerY) <= targetRange)
            .sort((a, b) => Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY));
    },

    chooseInsectTargetForSpecies(speciesKey, candidates, centerX, centerY, excludedTargets = new Set()) {
        const profile = this.getInsectCombatProfile(speciesKey);
        const rankedTargets = [...(candidates || [])]
            .filter(enemy => enemy && !excludedTargets.has(enemy))
            .sort((left, right) => {
                const scoreEnemy = (enemy) => {
                    const distanceScore = Math.hypot(enemy.x - centerX, enemy.y - centerY);
                    const hpRatio = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) : 1;
                    const isShielded = Boolean(enemy.hasShield && enemy.shieldHp > 0);
                    let score = distanceScore;

                    if (profile.focus === 'shielded') {
                        score += isShielded ? -180 : 28;
                    } else if (profile.focus === 'lowestHp') {
                        score += hpRatio * 160;
                    } else if (profile.focus === 'cluster') {
                        const nearbyCount = (candidates || []).filter(other => {
                            return other !== enemy && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= 110;
                        }).length;
                        score -= nearbyCount * 34;
                    } else if (profile.focus === 'elite') {
                        score += enemy.isElite ? -130 : 16;
                        score += isShielded ? -42 : 0;
                    } else if (profile.focus === 'swift') {
                        score -= ((enemy.wanderSpeed || 0) * 110) + ((enemy.dodgeChance || 0) * 140);
                    }

                    return score;
                };

                return scoreEnemy(left) - scoreEnemy(right);
            });

        return rankedTargets[0] || null;
    },

    getInsectSpeciesStrikeFactor(speciesKey, count, totalReadyCount) {
        const cfg = CONFIG.INSECT?.ATTACK || {};
        const species = this.getInsectSpecies(speciesKey);
        const profile = this.getInsectCombatProfile(speciesKey);
        const totalReady = Math.max(1, totalReadyCount || 1);
        const shareRatio = Math.max(0.05, count / totalReady);
        const focusFactor = Math.max(0.5, Math.min(1.35, shareRatio * 1.65));
        const densityFactor = 1 + Math.min(0.24, Math.max(0, count - 1) * 0.018);
        const baseDamageFactor = Math.max(
            0.18,
            (cfg.BASE_DAMAGE_FACTOR || 0.45) + (Math.floor(totalReady / 5) * (cfg.BONUS_DAMAGE_PER_5 || 0.08))
        );

        return Math.max(
            0.12,
            baseDamageFactor
                * (species?.attackFactor || 1)
                * focusFactor
                * densityFactor
                * (profile.damageScale || 1)
        );
    },

    createInsectStrikeSource(damageFactor, speciesKey, options = {}) {
        return {
            getDamageMultiplier: () => damageFactor,
            powerPenalty: damageFactor,
            sourceType: 'INSECT',
            speciesKey,
            shieldBreakMultiplier: Math.max(1, Number(options.shieldBreakMultiplier) || 1),
            ignoreDodge: Boolean(options.ignoreDodge)
        };
    },

    addInsectStrikeResult(summary, outcome) {
        if (!outcome?.result) return;
        if (outcome.landed) summary.landedHits += 1;
        if (outcome.result === 'shielded') summary.shieldHits += 1;
        if (outcome.result === 'killed') summary.killCount += 1;
    },

    strikeEnemyWithInsects(target, speciesKey, damageFactor, options = {}) {
        if (!target) {
            return { result: null, landed: false, shieldHits: 0, killCount: 0 };
        }

        const species = this.getInsectSpecies(speciesKey);
        const strikeColor = options.color || species?.color || '#79ffd4';

        if (options.dodgeDisabledMs) target.suppressDodge?.(options.dodgeDisabledMs);
        if (options.rootMs) target.applyMovementLock?.(options.rootMs);
        if (options.slowMs) target.applySlow?.(options.slowMs, options.slowFactor || 0.5);
        if (options.shieldRecoveryBlockMs) target.blockShieldRecovery?.(options.shieldRecoveryBlockMs);

        const result = target.hit(this.createInsectStrikeSource(damageFactor, speciesKey, options));
        const landed = result === 'hit' || result === 'killed' || result === 'shielded';

        if (landed) {
            this.createAttackBurst?.(target.x, target.y, result === 'shielded' ? '#ffb26b' : strikeColor);
        }

        if (landed && options.lockAfterHitMs) {
            target.applyMovementLock?.(options.lockAfterHitMs);
        }

        return {
            result,
            landed,
            shieldHits: result === 'shielded' ? 1 : 0,
            killCount: result === 'killed' ? 1 : 0
        };
    },

    resolveInsectSpeciesStrike({ speciesKey, count, totalReadyCount, primaryTarget, candidates, damageMultiplier = 1 }) {
        const summary = { shieldHits: 0, killCount: 0, landedHits: 0 };
        if (!primaryTarget || count <= 0) return summary;

        const species = this.getInsectSpecies(speciesKey);
        const profile = this.getInsectCombatProfile(speciesKey);
        const color = species?.secondaryColor || species?.color || '#79ffd4';
        const sortedOthers = [...(candidates || [])]
            .filter(enemy => enemy !== primaryTarget)
            .sort((a, b) => Math.hypot(a.x - primaryTarget.x, a.y - primaryTarget.y) - Math.hypot(b.x - primaryTarget.x, b.y - primaryTarget.y));

        const strike = (target, damageFactor, options = {}) => {
            const outcome = this.strikeEnemyWithInsects(target, speciesKey, damageFactor, { ...options, color });
            this.addInsectStrikeResult(summary, outcome);
            return outcome;
        };

        let baseFactor = this.getInsectSpeciesStrikeFactor(speciesKey, count, totalReadyCount) * Math.max(0.1, Number(damageMultiplier) || 1);
        let primaryOutcome = null;

        switch (speciesKey) {
            case 'KIEN_THIEN_TINH': {
                primaryOutcome = strike(primaryTarget, baseFactor, { ignoreDodge: count >= 16 });
                const chainCount = Math.max(1, Math.min(3, 1 + Math.floor(count / 12)));
                sortedOthers.slice(0, chainCount).forEach(target => {
                    strike(target, baseFactor * 0.72, { ignoreDodge: count >= 16 });
                });
                break;
            }
            case 'PHE_KIM_TRUNG': {
                const shielded = Boolean(primaryTarget.hasShield && primaryTarget.shieldHp > 0);
                primaryOutcome = strike(primaryTarget, baseFactor * (shielded ? 1.08 : 1), {
                    shieldBreakMultiplier: shielded ? 3.4 : 1.7
                });
                if (shielded && primaryOutcome.result !== 'killed') {
                    strike(primaryTarget, baseFactor * 0.56, {
                        shieldBreakMultiplier: 2.2,
                        ignoreDodge: true
                    });
                }
                break;
            }
            case 'PHI_THIEN_TU_VAN_HAT': {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    dodgeDisabledMs: 650,
                    ignoreDodge: count >= 6
                });
                if (primaryOutcome.result !== 'killed') {
                    strike(primaryTarget, baseFactor * 0.44, {
                        ignoreDodge: true,
                        slowMs: 900,
                        slowFactor: 0.74
                    });
                }
                break;
            }
            case 'HUYET_NGOC_TRI_CHU': {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    rootMs: 950 + Math.min(700, count * 40),
                    dodgeDisabledMs: 480
                });
                const hpRatio = primaryTarget.maxHp > 0 ? (primaryTarget.hp / primaryTarget.maxHp) : 1;
                if (primaryOutcome.result !== 'killed' && hpRatio <= 0.72) {
                    strike(primaryTarget, baseFactor * 0.58, { ignoreDodge: true });
                }
                break;
            }
            case 'HUYEN_DIEM_NGA': {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    ignoreDodge: true,
                    rootMs: 1400 + Math.min(800, count * 35),
                    slowMs: 1800,
                    slowFactor: 0.08,
                    dodgeDisabledMs: 1600
                });
                break;
            }
            case 'KIM_TAM': {
                const hpRatio = primaryTarget.maxHp > 0 ? (primaryTarget.hp / primaryTarget.maxHp) : 1;
                if (hpRatio <= 0.28) {
                    baseFactor *= 1.8;
                }
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    shieldRecoveryBlockMs: 2400,
                    dodgeDisabledMs: 800
                });
                if (primaryOutcome.result === 'shielded') {
                    strike(primaryTarget, baseFactor * 0.48, {
                        ignoreDodge: true,
                        shieldBreakMultiplier: 1.6,
                        shieldRecoveryBlockMs: 2400
                    });
                }
                break;
            }
            case 'THIET_HOA_NGHI': {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    rootMs: 420,
                    dodgeDisabledMs: 320
                });
                sortedOthers
                    .filter(enemy => Math.hypot(enemy.x - primaryTarget.x, enemy.y - primaryTarget.y) <= 96)
                    .slice(0, 2)
                    .forEach(target => {
                        strike(target, baseFactor * 0.52, {
                            slowMs: 720,
                            slowFactor: 0.66,
                            ignoreDodge: count >= 10
                        });
                    });
                break;
            }
            case 'KIM_GIAP_HAT': {
                const fortifiedTarget = primaryTarget.isElite || Boolean(primaryTarget.hasShield && primaryTarget.shieldHp > 0);
                primaryOutcome = strike(primaryTarget, baseFactor * (fortifiedTarget ? 1.28 : 1.05), {
                    shieldBreakMultiplier: 1.9,
                    rootMs: 820,
                    ignoreDodge: count >= 10
                });
                break;
            }
            case 'HUYET_THUC_NGHI': {
                const frenzyFactor = 1 + Math.min(0.55, this.combo * 0.015);
                primaryOutcome = strike(primaryTarget, baseFactor * frenzyFactor, {
                    ignoreDodge: count >= 14
                });
                if ((primaryOutcome.result === 'killed' || this.combo >= 10) && sortedOthers.length) {
                    strike(sortedOthers[0], baseFactor * 0.5 * frenzyFactor, { ignoreDodge: true });
                }
                break;
            }
            case 'BANG_TAM': {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    slowMs: 2600,
                    slowFactor: 0.26,
                    dodgeDisabledMs: 900
                });
                if (primaryOutcome.landed && count >= 8) {
                    primaryTarget.applyMovementLock?.(650 + Math.min(500, count * 20));
                }
                break;
            }
            case 'LUC_DUC_SUONG_CONG': {
                primaryOutcome = strike(primaryTarget, baseFactor * 1.04, {
                    slowMs: 2200,
                    slowFactor: 0.18,
                    dodgeDisabledMs: 1200,
                    rootMs: 480 + Math.min(520, count * 18)
                });
                if (primaryOutcome.landed && sortedOthers.length) {
                    strike(sortedOthers[0], baseFactor * 0.42, {
                        slowMs: 1200,
                        slowFactor: 0.42,
                        ignoreDodge: true
                    });
                }
                break;
            }
            case 'THON_LINH_TRUNG': {
                const shielded = Boolean(primaryTarget.hasShield && primaryTarget.shieldHp > 0);
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    shieldRecoveryBlockMs: 3200,
                    dodgeDisabledMs: 1100,
                    shieldBreakMultiplier: shielded ? 1.85 : 1.25
                });
                if (primaryOutcome.result !== 'killed' && (shielded || count >= 12)) {
                    strike(primaryTarget, baseFactor * 0.46, {
                        ignoreDodge: true,
                        shieldRecoveryBlockMs: 3200,
                        shieldBreakMultiplier: 1.55
                    });
                }
                break;
            }
            default: {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    ignoreDodge: profile.focus === 'swift'
                });
                break;
            }
        }

        return summary;
    },

    updateInsectSwarm(dt, enemies, scaleFactor) {
        const cfg = CONFIG.INSECT?.ATTACK || {};
        const shouldRender = this.attackMode === 'INSECT' && this.canUseInsectAttackMode() && !this.isUltMode && !this.isUltimateBusy();

        if (!shouldRender) {
            this.insectCombat.visuals = [];
            this.insectCombat.focusTargets = [];
            return;
        }

        const centerX = this.x;
        const centerY = this.y;
        const combatSpeciesKeys = this.getCombatReadyInsectSpeciesKeys();
        const visualCount = this.getSwarmVisualCount();
        const visuals = this.insectCombat.visuals || [];
        const minRadius = Math.max(8, cfg.VISUAL_MIN_RADIUS || 18) * scaleFactor;
        const maxRadius = Math.max(minRadius + 4, cfg.VISUAL_MAX_RADIUS || 70) * scaleFactor;
        const jitter = Math.max(2, cfg.VISUAL_JITTER || 10) * scaleFactor;
        const visualSpeedMin = Math.max(0.2, Number(cfg.VISUAL_SPEED_MIN) || 0.72);
        const visualSpeedMax = Math.max(visualSpeedMin, Number(cfg.VISUAL_SPEED_MAX) || 1.6);
        const wobbleSpeedMin = Math.max(0.2, Number(cfg.VISUAL_WOBBLE_SPEED_MIN) || 0.6);
        const wobbleSpeedMax = Math.max(wobbleSpeedMin, Number(cfg.VISUAL_WOBBLE_SPEED_MAX) || 1.35);
        const idleOrbitSpeed = Math.max(0.2, Number(cfg.VISUAL_IDLE_ORBIT_SPEED) || 1.05);
        const attackOrbitSpeed = Math.max(0.2, Number(cfg.VISUAL_ATTACK_ORBIT_SPEED) || 1.45);
        const targetOrbitSpeed = Math.max(0.2, Number(cfg.VISUAL_TARGET_ORBIT_SPEED) || 1.7);
        const idleFollowSpeed = Math.max(1, Number(cfg.VISUAL_IDLE_FOLLOW_SPEED) || 6.2);
        const targetFollowSpeed = Math.max(1, Number(cfg.VISUAL_TARGET_FOLLOW_SPEED) || 6.8);
        const focusTargets = this.getInsectAttackCandidates(
            centerX,
            centerY,
            enemies,
            Math.max(80, (cfg.TARGET_RANGE || 220) * 1.1)
        ).slice(0, 5);

        while (visuals.length < visualCount) {
            const speciesKey = this.pickOwnedInsectSpeciesKey(combatSpeciesKeys);
            const species = this.getInsectSpecies(speciesKey);

            visuals.push({
                speciesKey,
                angle: Math.random() * Math.PI * 2,
                radius: random(minRadius, maxRadius),
                targetRadius: random(minRadius, maxRadius),
                speed: random(visualSpeedMin, visualSpeedMax),
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: random(wobbleSpeedMin, wobbleSpeedMax),
                size: random(2, 3.8) * (species?.tier === 'DE' ? 1.18 : 1),
                targetRef: null,
                trail: [],
                x: centerX,
                y: centerY
            });
        }

        if (visuals.length > visualCount) {
            visuals.length = visualCount;
        }

        visuals.forEach(node => {
            if (!combatSpeciesKeys.includes(node.speciesKey)) {
                node.speciesKey = this.pickOwnedInsectSpeciesKey(combatSpeciesKeys) || node.speciesKey;
            }

            const previousTargetRef = node.targetRef || null;
            const profile = this.getInsectCombatProfile(node.speciesKey);
            const hasTargetFocus = this.isAttacking && focusTargets.length > 0;

            if (hasTargetFocus) {
                if (!focusTargets.includes(node.targetRef)) {
                    node.targetRef = this.chooseInsectTargetForSpecies(node.speciesKey, focusTargets, centerX, centerY);
                }
            } else {
                node.targetRef = null;
            }

            if (previousTargetRef !== node.targetRef) {
                node.trail = [];
            }

            const orbitMin = node.targetRef ? Math.max(8, (profile.latchRadius || 16) * 0.7) * scaleFactor : minRadius;
            const orbitMax = node.targetRef ? Math.max(orbitMin + 4, (profile.latchRadius || 16) * 1.35) * scaleFactor : maxRadius;
            const anchorX = node.targetRef ? node.targetRef.x : centerX;
            const anchorY = node.targetRef ? node.targetRef.y : centerY;
            const chaosJitter = node.targetRef ? jitter * 0.22 : jitter * 0.74;

            node.angle += dt * node.speed * (node.targetRef ? targetOrbitSpeed : (this.isAttacking ? attackOrbitSpeed : idleOrbitSpeed));
            node.wobble += dt * node.wobbleSpeed;
            node.targetRadius += random(node.targetRef ? -3.5 : -7, node.targetRef ? 3.5 : 7) * dt * 10;
            node.targetRadius = Math.max(orbitMin, Math.min(orbitMax, node.targetRadius));
            node.radius += (node.targetRadius - node.radius) * (node.targetRef ? 0.09 : 0.06);

            const swirlX = Math.cos(node.angle) * node.radius;
            const swirlY = Math.sin(node.angle * 1.18 + node.wobble) * (node.radius * (node.targetRef ? 0.54 : 0.72));
            const chaosX = Math.cos(node.wobble * 1.7 + node.angle * 0.45) * chaosJitter;
            const chaosY = Math.sin(node.wobble * 1.35 - node.angle * 0.4) * chaosJitter;

            syncInsectVisualMotion(
                node,
                anchorX + swirlX + chaosX,
                anchorY + swirlY + chaosY,
                dt,
                node.targetRef ? targetFollowSpeed : idleFollowSpeed,
                node.targetRef ? 5 : 4
            );
        });

        this.insectCombat.visuals = visuals;
        this.insectCombat.focusTargets = focusTargets;

        if (!this.isAttacking || !combatSpeciesKeys.length) return;

        const now = performance.now();
        const hitInterval = Math.max(60, cfg.HIT_INTERVAL_MS || 220);
        if (now - (this.insectCombat.lastHitAt || 0) < hitInterval) return;

        this.insectCombat.lastHitAt = now;

        const candidates = this.getInsectAttackCandidates(centerX, centerY, enemies, Math.max(60, cfg.TARGET_RANGE || 220));
        if (!candidates.length) return;

        const totalReadyCount = Math.max(1, this.getCombatReadyInsectCount());
        const attackSummary = { shieldHits: 0, killCount: 0, landedHits: 0 };
        const reservedTargets = new Set();

        combatSpeciesKeys.forEach(speciesKey => {
            const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
            if (count <= 0) return;

            const primaryTarget = this.chooseInsectTargetForSpecies(speciesKey, candidates, centerX, centerY, reservedTargets);
            if (primaryTarget) {
                reservedTargets.add(primaryTarget);
            }

            const result = this.resolveInsectSpeciesStrike({
                speciesKey,
                count,
                totalReadyCount,
                primaryTarget,
                candidates
            });

            attackSummary.shieldHits += result.shieldHits;
            attackSummary.killCount += result.killCount;
            attackSummary.landedHits += result.landedHits;
        });

        const regularHits = Math.max(0, attackSummary.landedHits - attackSummary.shieldHits);
        const hitLossChance = 1 - Math.pow(1 - Math.max(0, Math.min(1, cfg.DEATH_ON_HIT_CHANCE || 0)), regularHits);
        const shieldLossChance = 1 - Math.pow(1 - Math.max(0, Math.min(1, cfg.DEATH_ON_SHIELD_CHANCE || 0)), attackSummary.shieldHits);
        const casualtyChance = 1 - ((1 - hitLossChance) * (1 - shieldLossChance));
        const casualtyKey = this.loseRandomTamedInsect(casualtyChance, combatSpeciesKeys);

        let shouldRefresh = false;

        if (casualtyKey) {
            const species = this.getInsectSpecies(casualtyKey);
            showNotify(`1 ${species?.name || 'linh trùng'} tan lạc trong giao tranh`, species?.color || '#ff8a80');
            shouldRefresh = true;
        }

        if (attackSummary.killCount > 0) {
            let bornCount = 0;
            for (let i = 0; i < attackSummary.killCount; i++) {
                if (this.reproduceRandomInsect(cfg.REPRODUCE_ON_KILL_CHANCE || 0)) {
                    bornCount++;
                }
            }

            if (bornCount > 0) {
                showNotify(`Đàn trùng sinh sôi thêm ${formatNumber(bornCount)} con`, '#79ffd4');
                shouldRefresh = true;
            }
        }

        if (shouldRefresh) {
            this.refreshResourceUI();
        }
    },

    drawInsectSwarm(ctx, scaleFactor) {
        if (!this.insectCombat.visuals?.length) return;

        ctx.save();
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const highlightedTargets = new Set();

        this.insectCombat.visuals.forEach(node => {
            const species = this.getInsectSpecies(node.speciesKey);
            const palette = getInsectCombatPalette(species);
            const size = Math.max(1.8, node.size * scaleFactor * (node.isLeader ? 1.8 : 1));

            drawInsectTrail(
                ctx,
                node,
                node.targetRef ? palette.aura : palette.primary,
                size * (node.targetRef ? 0.62 : 0.46),
                node.targetRef ? 0.36 : 0.22
            );

            if (node.targetRef && !highlightedTargets.has(node.targetRef)) {
                highlightedTargets.add(node.targetRef);
                ctx.beginPath();
                ctx.strokeStyle = withAlpha(palette.aura, 0.2);
                ctx.lineWidth = Math.max(0.7, 0.85 * scaleFactor);
                ctx.arc(node.targetRef.x, node.targetRef.y, Math.max(5 * scaleFactor, size * 1.55), 0, Math.PI * 2);
                ctx.stroke();
            }

            const gradient = ctx.createRadialGradient(
                node.x - size * 0.35,
                node.y - size * 0.35,
                Math.max(0.2, size * 0.15),
                node.x,
                node.y,
                size * 1.2
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.18, palette.secondary);
            gradient.addColorStop(0.58, palette.primary);
            gradient.addColorStop(1, withAlpha(palette.aura, 0.08));

            ctx.beginPath();
            ctx.shadowBlur = node.targetRef ? 16 : 12;
            ctx.shadowColor = withAlpha(palette.aura, node.targetRef ? 0.92 : 0.78);
            ctx.fillStyle = gradient;
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    },

    updateInsectUltimate(dt, enemies, scaleFactor) {
        const cfg = CONFIG.INSECT?.ULTIMATE || {};

        if (!this.isInsectUltimateActive()) {
            this.clearInsectUltimateState();
            return;
        }

        const combatSpeciesKeys = this.getCombatReadyInsectSpeciesKeys();
        if (!combatSpeciesKeys.length) {
            this.endInsectUltimate();
            return;
        }

        const centerX = this.x;
        const centerY = this.y;
        const targetRange = Math.max(120, Number(cfg.TARGET_RANGE) || 320);
        const maxTargets = Math.max(1, Math.floor(cfg.MAX_TARGETS || 7));
        const focusTargets = this.getInsectAttackCandidates(centerX, centerY, enemies, targetRange).slice(0, maxTargets);
        const visuals = this.insectUltimate.visuals || [];
        const visualCount = Math.max(
            18,
            Math.min(
                Math.floor(cfg.VISUAL_LIMIT || 54),
                Math.max(18, this.getCombatReadyInsectCount() + 18)
            )
        );
        const orbitRadius = Math.max(44, Number(cfg.VISUAL_RADIUS) || 118) * scaleFactor;
        const targetRadius = Math.max(12, orbitRadius * 0.18);
        const jitter = Math.max(6, Number(cfg.VISUAL_JITTER) || 24) * scaleFactor;

        while (visuals.length < visualCount) {
            const speciesKey = this.pickOwnedInsectSpeciesKey(combatSpeciesKeys);
            const species = this.getInsectSpecies(speciesKey);
            visuals.push({
                speciesKey,
                angle: Math.random() * Math.PI * 2,
                radius: random(targetRadius, orbitRadius),
                targetRadius: random(targetRadius, orbitRadius),
                speed: random(2.0, 4.2),
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: random(1.4, 3.2),
                size: random(2.6, 5.4) * (species?.tier === 'DE' ? 1.2 : 1),
                targetRef: null,
                trail: [],
                x: centerX,
                y: centerY
            });
        }

        if (visuals.length > visualCount) {
            visuals.length = visualCount;
        }

        visuals.forEach((node, index) => {
            if (!combatSpeciesKeys.includes(node.speciesKey)) {
                node.speciesKey = this.pickOwnedInsectSpeciesKey(combatSpeciesKeys) || node.speciesKey;
            }

            const previousTargetRef = node.targetRef || null;
            node.targetRef = focusTargets.length ? focusTargets[index % focusTargets.length] : null;
            if (previousTargetRef !== node.targetRef) {
                node.trail = [];
            }

            const profile = this.getInsectCombatProfile(node.speciesKey);
            const latchRadius = Math.max(10, (profile.latchRadius || 16) * scaleFactor);
            const anchorX = node.targetRef ? node.targetRef.x : centerX;
            const anchorY = node.targetRef ? node.targetRef.y : centerY;
            const minRadius = node.targetRef ? latchRadius * 0.55 : targetRadius;
            const maxRadius = node.targetRef ? latchRadius * 1.45 : orbitRadius;
            const nodeJitter = node.targetRef ? jitter * 0.26 : jitter * 0.68;

            node.angle += dt * node.speed * (node.targetRef ? 4.2 : 2.6);
            node.wobble += dt * node.wobbleSpeed;
            node.targetRadius += random(node.targetRef ? -2.5 : -6, node.targetRef ? 2.5 : 6) * dt * 10;
            node.targetRadius = Math.max(minRadius, Math.min(maxRadius, node.targetRadius));
            node.radius += (node.targetRadius - node.radius) * (node.targetRef ? 0.13 : 0.08);

            const swirlX = Math.cos(node.angle) * node.radius;
            const swirlY = Math.sin(node.angle * 1.35 + node.wobble) * (node.radius * (node.targetRef ? 0.48 : 0.76));
            const chaosX = Math.cos(node.wobble * 1.8 + node.angle * 0.52) * nodeJitter;
            const chaosY = Math.sin(node.wobble * 1.55 - node.angle * 0.46) * nodeJitter;

            syncInsectVisualMotion(
                node,
                anchorX + swirlX + chaosX,
                anchorY + swirlY + chaosY,
                dt,
                node.targetRef ? 13 : 9.5,
                node.targetRef ? 6 : 5
            );
        });

        markLeaderInsectVisuals(visuals);
        this.insectUltimate.visuals = visuals;
        this.insectUltimate.focusTargets = focusTargets;

        const now = performance.now();
        const hitInterval = Math.max(45, Number(cfg.HIT_INTERVAL_MS) || 120);
        if ((now - (this.insectUltimate.lastHitAt || 0)) < hitInterval) return;

        this.insectUltimate.lastHitAt = now;
        if (!focusTargets.length) return;

        const candidates = this.getInsectAttackCandidates(centerX, centerY, enemies, targetRange);
        if (!candidates.length) return;

        const totalReadyCount = Math.max(1, this.getCombatReadyInsectCount());
        const strikeSummary = { shieldHits: 0, killCount: 0, landedHits: 0 };
        const reservedTargets = new Set();
        const strikesPerSpecies = Math.max(1, Math.floor(cfg.STRIKES_PER_SPECIES || 2));
        const damageMultiplier = Math.max(1.1, Number(cfg.DAMAGE_MULTIPLIER) || 1.72);

        combatSpeciesKeys.forEach(speciesKey => {
            const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
            if (count <= 0) return;

            for (let volley = 0; volley < strikesPerSpecies; volley++) {
                if (reservedTargets.size >= candidates.length) {
                    reservedTargets.clear();
                }

                const primaryTarget = this.chooseInsectTargetForSpecies(speciesKey, candidates, centerX, centerY, reservedTargets);
                if (!primaryTarget) break;

                reservedTargets.add(primaryTarget);
                const result = this.resolveInsectSpeciesStrike({
                    speciesKey,
                    count,
                    totalReadyCount,
                    primaryTarget,
                    candidates,
                    damageMultiplier: damageMultiplier * (volley === 0 ? 1 : 0.72)
                });

                strikeSummary.shieldHits += result.shieldHits;
                strikeSummary.killCount += result.killCount;
                strikeSummary.landedHits += result.landedHits;
            }
        });

        const regularHits = Math.max(0, strikeSummary.landedHits - strikeSummary.shieldHits);
        const hitLossChance = 1 - Math.pow(1 - Math.max(0, Math.min(1, cfg.DEATH_ON_HIT_CHANCE || 0)), regularHits);
        const shieldLossChance = 1 - Math.pow(1 - Math.max(0, Math.min(1, cfg.DEATH_ON_SHIELD_CHANCE || 0)), strikeSummary.shieldHits);
        const casualtyChance = 1 - ((1 - hitLossChance) * (1 - shieldLossChance));
        const casualtyKey = this.loseRandomTamedInsect(casualtyChance, combatSpeciesKeys);

        let shouldRefresh = false;

        if (casualtyKey) {
            const species = this.getInsectSpecies(casualtyKey);
            showNotify(`1 ${species?.name || 'linh trùng'} tan lạc trong trùng triều`, species?.color || '#ff8a80');
            shouldRefresh = true;
        }

        if (strikeSummary.killCount > 0) {
            let bornCount = 0;
            for (let i = 0; i < strikeSummary.killCount; i++) {
                if (this.reproduceRandomInsect(cfg.REPRODUCE_ON_KILL_CHANCE || 0.38, combatSpeciesKeys)) {
                    bornCount++;
                }
            }

            if (bornCount > 0) {
                showNotify(`Trùng triều sinh thêm ${formatNumber(bornCount)} linh trùng`, '#ff9fda');
                shouldRefresh = true;
            }
        }

        if (shouldRefresh) {
            this.refreshResourceUI();
        }
    },

    drawInsectUltimate(ctx, scaleFactor) {
        if (!this.insectUltimate.visuals?.length) return;

        const cfg = CONFIG.INSECT?.ULTIMATE || {};
        const time = performance.now() * 0.0035;
        const pulse = 1 + Math.sin(time * 2.4) * 0.08;
        const baseRadius = Math.max(44, Number(cfg.VISUAL_RADIUS) || 118) * scaleFactor;

        ctx.save();
        ctx.translate(this.x, this.y);

        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * 1.35);
        halo.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
        halo.addColorStop(0.3, 'rgba(255, 123, 195, 0.18)');
        halo.addColorStop(0.68, 'rgba(121, 255, 212, 0.12)');
        halo.addColorStop(1, 'rgba(121, 255, 212, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius * 1.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 176, 226, 0.46)';
        ctx.lineWidth = 2.2 * scaleFactor;
        ctx.arc(0, 0, baseRadius * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(121, 255, 212, 0.34)';
        ctx.lineWidth = 1.4 * scaleFactor;
        ctx.arc(0, 0, baseRadius * 0.74 * (2 - pulse), 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this.insectUltimate.focusTargets.forEach(target => {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 161, 224, 0.22)';
            ctx.lineWidth = 1.6 * scaleFactor;
            ctx.moveTo(this.x, this.y);
            ctx.quadraticCurveTo(
                (this.x + target.x) / 2 + Math.sin(time + target.x * 0.01) * 18 * scaleFactor,
                (this.y + target.y) / 2 + Math.cos(time + target.y * 0.01) * 18 * scaleFactor,
                target.x,
                target.y
            );
            ctx.stroke();

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(121, 255, 212, 0.16)';
            ctx.lineWidth = 1 * scaleFactor;
            ctx.arc(target.x, target.y, (target.r + 10) * scaleFactor, 0, Math.PI * 2);
            ctx.stroke();
        });

        const highlightedTargets = new Set();
        this.insectUltimate.visuals.forEach(node => {
            const species = this.getInsectSpecies(node.speciesKey);
            const palette = getInsectCombatPalette(species);
            const size = Math.max(2.2, node.size * scaleFactor * 1.14);

            drawInsectTrail(
                ctx,
                node,
                node.targetRef ? palette.aura : palette.primary,
                size * (node.targetRef ? 0.72 : 0.56),
                node.targetRef ? 0.4 : 0.24
            );

            if (node.targetRef && !highlightedTargets.has(node.targetRef)) {
                highlightedTargets.add(node.targetRef);
                ctx.beginPath();
                ctx.strokeStyle = withAlpha(palette.aura, 0.24);
                ctx.lineWidth = Math.max(0.8, 1.1 * scaleFactor);
                ctx.arc(node.targetRef.x, node.targetRef.y, Math.max((node.targetRef.r + 7) * scaleFactor, size * 1.8), 0, Math.PI * 2);
                ctx.stroke();
            }

            const gradient = ctx.createRadialGradient(
                node.x - size * 0.4,
                node.y - size * 0.4,
                Math.max(0.3, size * 0.18),
                node.x,
                node.y,
                size * 1.4
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.16, palette.secondary);
            gradient.addColorStop(0.62, palette.primary);
            gradient.addColorStop(1, withAlpha(palette.aura, 0.08));

            ctx.beginPath();
            ctx.shadowBlur = node.targetRef ? 18 : 14;
            ctx.shadowColor = withAlpha(palette.aura, node.targetRef ? 1 : 0.82);
            ctx.fillStyle = gradient;
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    },

    createInsectUltimateBurst(x, y, color = '#ff7bc3') {
        const palette = [color, '#79ffd4', '#fff0c8', '#ffb7e7'];

        visualParticles.push(
            {
                type: 'ring',
                x,
                y,
                radius: 18,
                radialVelocity: 5.2,
                lineWidth: 3,
                life: 1,
                decay: 0.034,
                opacity: 0.92,
                color,
                glow: 18
            },
            {
                type: 'ring',
                x,
                y,
                radius: 42,
                radialVelocity: 7.6,
                lineWidth: 2.2,
                life: 0.92,
                decay: 0.03,
                opacity: 0.72,
                color: '#79ffd4',
                glow: 16
            }
        );

        for (let i = 0; i < 18; i++) {
            const angle = (Math.PI * 2 * i) / 18;
            visualParticles.push({
                type: 'ray',
                x,
                y,
                angle,
                radius: random(6, 16),
                radialVelocity: random(3.2, 5.6),
                length: random(22, 42),
                lengthVelocity: random(0.16, 0.42),
                lineWidth: random(1.5, 2.8),
                life: 0.92,
                decay: random(0.04, 0.055),
                opacity: 0.9,
                color: palette[i % palette.length],
                glow: 14
            });
        }

        for (let i = 0; i < 28; i++) {
            const angle = random(0, Math.PI * 2);
            const speed = random(2.8, 7.6);
            visualParticles.push({
                type: i % 5 === 0 ? 'square' : 'spark',
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - random(0.2, 1.2),
                gravity: 0.04,
                friction: 0.96,
                size: random(2.4, 5.4),
                sizeVelocity: -0.035,
                life: 0.96,
                decay: random(0.02, 0.034),
                opacity: 0.9,
                color: palette[i % palette.length],
                glow: 12,
                rotation: angle,
                rotationSpeed: random(-0.18, 0.18)
            });
        }
    },

    createPhongLoiBlinkBurst(x, y, directionX = 1, directionY = 0, { arrival = true } = {}) {
        trimVisualParticles(280);
        const artifactConfig = this.getArtifactConfig('PHONG_LOI_SI') || {};
        const cfg = this.getPhongLoiBlinkConfig();
        const primaryColor = artifactConfig.color || '#9fe8ff';
        const secondaryColor = artifactConfig.secondaryColor || '#dffeff';
        const auraColor = artifactConfig.auraColor || '#89a6ff';
        const flashLife = Math.max(0.05, cfg.flashMs / 1000);
        const rayPalette = arrival
            ? ['#ffffff', primaryColor, '#d5d8ff', '#b48cff']
            : [secondaryColor, primaryColor, auraColor, '#ffffff'];
        const rayCount = arrival ? 12 : 8;
        const sparkCount = arrival ? 16 : 10;
        const directionAngle = Math.atan2(directionY, directionX || 0.0001);

        visualParticles.push(
            {
                type: 'glow',
                x,
                y,
                size: arrival ? 20 : 14,
                sizeVelocity: arrival ? 2.1 : 1.2,
                life: flashLife,
                decay: flashLife > 0 ? (1 / flashLife) : 1,
                opacity: arrival ? 0.9 : 0.38,
                color: '#ffffff',
                glow: arrival ? 28 : 18
            },
            {
                type: 'ring',
                x,
                y,
                radius: arrival ? 14 : 8,
                radialVelocity: arrival ? 5.8 : 4.2,
                lineWidth: arrival ? 3.2 : 2.2,
                life: 0.96,
                decay: arrival ? 0.046 : 0.062,
                opacity: 0.9,
                color: arrival ? primaryColor : secondaryColor,
                glow: arrival ? 20 : 14
            },
            {
                type: 'ring',
                x,
                y,
                radius: arrival ? cfg.impactRadius : 18,
                radialVelocity: arrival ? 6.2 : 4.4,
                lineWidth: arrival ? 2.4 : 1.8,
                life: 0.9,
                decay: arrival ? 0.038 : 0.05,
                opacity: 0.64,
                color: auraColor,
                glow: 16
            }
        );

        for (let i = 0; i < rayCount; i++) {
            const angle = arrival
                ? ((Math.PI * 2 * i) / rayCount) + random(-0.08, 0.08)
                : directionAngle + random(-0.55, 0.55);
            visualParticles.push({
                type: 'ray',
                x,
                y,
                angle,
                radius: random(arrival ? 4 : 2, arrival ? 14 : 8),
                radialVelocity: random(arrival ? 3.8 : 2.8, arrival ? 6.4 : 4.8),
                length: random(arrival ? 20 : 16, arrival ? 40 : 30),
                lengthVelocity: random(0.18, 0.46),
                lineWidth: random(arrival ? 1.6 : 1.2, arrival ? 3.2 : 2.4),
                life: 0.9,
                decay: random(0.04, 0.058),
                opacity: arrival ? 0.92 : 0.82,
                color: rayPalette[i % rayPalette.length],
                glow: arrival ? 16 : 12
            });
        }

        for (let i = 0; i < sparkCount; i++) {
            const angle = arrival
                ? random(0, Math.PI * 2)
                : directionAngle + random(-0.72, 0.72);
            const speed = random(arrival ? 2.6 : 1.8, arrival ? 7.8 : 5.6);
            visualParticles.push({
                type: i % 5 === 0 ? 'square' : 'spark',
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - random(0.1, arrival ? 1.3 : 0.8),
                gravity: arrival ? 0.045 : 0.02,
                friction: 0.95,
                size: random(arrival ? 2.2 : 1.6, arrival ? 5.2 : 4.2),
                sizeVelocity: -0.04,
                life: 0.92,
                decay: random(0.024, 0.04),
                opacity: arrival ? 0.92 : 0.72,
                color: rayPalette[i % rayPalette.length],
                glow: arrival ? 14 : 10,
                rotation: angle,
                rotationSpeed: random(-0.18, 0.18)
            });
        }
    },

    createLevelUpExplosion(x, y, color) {
        const accent = color || "#78f2ff";
        const palette = [accent, "#ffffff", "#8df6ff", "#ffe39b", "#7ad7ff"];

        visualParticles.push(
            {
                type: 'ring',
                x,
                y,
                radius: 14,
                radialVelocity: 4.4,
                lineWidth: 3.4,
                life: 1,
                decay: 0.038,
                opacity: 0.9,
                color: accent,
                glow: 18
            },
            {
                type: 'ring',
                x,
                y,
                radius: 28,
                radialVelocity: 5.9,
                lineWidth: 2.4,
                life: 0.92,
                decay: 0.034,
                opacity: 0.72,
                color: "#ffe39b",
                glow: 16
            },
            {
                type: 'glow',
                x,
                y,
                size: 20,
                sizeVelocity: 0.9,
                life: 0.72,
                decay: 0.06,
                opacity: 0.3,
                color: accent,
                glow: 24
            }
        );

        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            visualParticles.push({
                type: 'ray',
                x,
                y,
                angle,
                radius: random(4, 12),
                radialVelocity: random(2.8, 4.6),
                length: random(14, 30),
                lengthVelocity: random(0.1, 0.4),
                lineWidth: random(1.5, 2.8),
                life: 0.86,
                decay: random(0.045, 0.06),
                opacity: 0.88,
                color: palette[i % palette.length],
                glow: 14
            });
        }

        for (let i = 0; i < 30; i++) {
            const angle = random(0, Math.PI * 2);
            const speed = random(2.5, 8.4);
            visualParticles.push({
                type: i % 5 === 0 ? 'square' : 'spark',
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - random(0.4, 1.6),
                gravity: 0.05,
                friction: 0.97,
                size: random(2.4, 5.6),
                sizeVelocity: -0.03,
                life: 1,
                decay: random(0.018, 0.032),
                opacity: 0.94,
                color: palette[i % palette.length],
                glow: 12,
                rotation: angle,
                rotationSpeed: random(-0.16, 0.16)
            });
        }

        return;
    },

    createAttackBurst(x, y, color = "#ffcc00") {
        const now = performance.now();
        const burstInterval = this.isUltMode
            ? Math.max(0, Math.floor(CONFIG.ULTIMATE?.ATTACK_BURST_INTERVAL_MS || 0))
            : 0;

        if (burstInterval > 0 && (now - (this.lastAttackBurstAt || 0)) < burstInterval) {
            return;
        }

        const maxActiveBurstParticles = Math.max(
            40,
            Math.floor(CONFIG.ULTIMATE?.MAX_ACTIVE_BURST_PARTICLES || 220)
        );

        if (visualParticles.length > maxActiveBurstParticles) {
            visualParticles.splice(0, visualParticles.length - maxActiveBurstParticles);
        }

        this.lastAttackBurstAt = now;
        const palette = [color, "#fff1a8", "#ffd36b", "#ff9d4d"];
        const particleSlotsLeft = Math.max(0, maxActiveBurstParticles - visualParticles.length);

        if (particleSlotsLeft <= 0) return;

        visualParticles.push({
            type: 'ring',
            x,
            y,
            radius: 8,
            radialVelocity: 3.8,
            lineWidth: 2.2,
            life: 0.9,
            decay: 0.1,
            opacity: 0.82,
            color,
            glow: 12
        });

        const desiredParticleCount = this.isUltMode
            ? Math.max(4, Math.floor(CONFIG.ULTIMATE?.ATTACK_BURST_PARTICLE_COUNT || 8))
            : 14;
        const burstParticleCount = Math.max(0, Math.min(desiredParticleCount, particleSlotsLeft - 1));

        for (let i = 0; i < burstParticleCount; i++) {
            const angle = (Math.PI * 2 * i) / Math.max(1, burstParticleCount) + random(-0.12, 0.12);
            const speed = random(2.4, 5.8);
            visualParticles.push({
                type: i % 4 === 0 ? 'square' : 'spark',
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: random(2, 4.8),
                sizeVelocity: -0.04,
                friction: 0.95,
                life: 0.85,
                decay: random(0.055, 0.085),
                color: palette[i % palette.length],
                glow: 10,
                rotation: angle,
                rotationSpeed: random(-0.14, 0.14)
            });
        }
    },

    drawCursorSeed(ctx, scaleFactor) {
        const cursorConfig = CONFIG.CURSOR || {};
        const dotRadius = Math.max(1, (cursorConfig.BASE_DOT_RADIUS || 3.2) * scaleFactor);
        const ringRadius = Math.max(dotRadius + (2 * scaleFactor), (cursorConfig.BASE_RING_RADIUS || 7.5) * scaleFactor);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = (cursorConfig.BASE_GLOW_BLUR || 10) * scaleFactor;
        ctx.shadowColor = cursorConfig.BASE_GLOW_COLOR || 'rgba(143, 255, 224, 0.42)';

        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = cursorConfig.BASE_RING_COLOR || 'rgba(143, 255, 224, 0.32)';
        ctx.lineWidth = Math.max(1, scaleFactor);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = cursorConfig.BASE_DOT_COLOR || '#f3fffd';
        ctx.arc(0, 0, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    getPhongLoiWingSpread() {
        const motionSpeed = this.isTouchDevice ? this.speed : this.screenSpeed;
        const targetSpread = this.isTouchDevice
            ? clampNumber((motionSpeed - 0.08) / 1.15, 0, 1)
            : clampNumber((motionSpeed - 1.25) / 13, 0, 1);
        const currentSpread = Number(this.phongLoiWingSpread) || 0;
        const smoothing = 0.16 + (targetSpread * 0.08);

        this.phongLoiWingSpread = clampNumber(currentSpread + ((targetSpread - currentSpread) * smoothing), 0, 1);

        return this.phongLoiWingSpread;
    },

    drawPhongLoiWingAura(ctx, options) {
        const {
            wingWidth,
            wingHeight,
            glowBlur,
            scaleFactor,
            spread,
            time,
            lightningLight,
            lightningMid,
            lightningDark
        } = options;
        const pulse = 0.58 + (Math.abs(Math.sin((time * 1.65) + (spread * 1.1))) * 0.42);
        const auraCount = Math.max(2, Math.floor(random(2, 4.2 + (spread * 1.8))));

        ctx.save();
        ctx.shadowBlur = glowBlur * (0.22 + (pulse * 0.24));
        ctx.shadowColor = withAlpha(lightningLight, 0.66);

        for (let i = 0; i < auraCount; i++) {
            const zoneRoll = Math.random();
            const spanRatio = random(0.08, 0.94);
            let px = 0;
            let py = 0;
            let driftX = 0;
            let driftY = 0;

            if (zoneRoll < 0.42) {
                px = wingWidth * (0.08 + (spanRatio * (0.68 + (spread * 0.18)))) + random(-1.3, 1.3) * scaleFactor;
                py = -wingHeight * (0.06 + (spanRatio * (0.62 + (spread * 0.18)))) + random(-2.4, -0.25) * scaleFactor;
                driftX = random(-1.6, 2.8) * scaleFactor;
                driftY = random(-2.2, 1.4) * scaleFactor;
            } else if (zoneRoll < 0.8) {
                px = wingWidth * (0.06 + (spanRatio * (0.58 + (spread * 0.12)))) + random(-1.2, 1.2) * scaleFactor;
                py = wingHeight * (0.02 + (spanRatio * (0.18 + (spread * 0.08)))) + random(0.25, 2.6) * scaleFactor;
                driftX = random(-1.8, 2.6) * scaleFactor;
                driftY = random(-1.6, 2.2) * scaleFactor;
            } else {
                px = wingWidth * (0.58 + (spanRatio * (0.24 + (spread * 0.16)))) + random(-1.1, 1.6) * scaleFactor;
                py = random(-wingHeight * (0.46 + (spread * 0.16)), wingHeight * (0.12 + (spread * 0.08)));
                driftX = random(-2.2, 2.8) * scaleFactor;
                driftY = random(-2.2, 2.2) * scaleFactor;
            }

            ctx.beginPath();
            ctx.moveTo(px, py);

            for (let step = 0; step < 3; step++) {
                px += driftX + random(-1.8, 1.8) * scaleFactor;
                py += driftY + random(-1.6, 1.6) * scaleFactor;
                ctx.lineTo(px, py);
            }

            const alpha = random(0.22, 0.46) * pulse;
            ctx.strokeStyle = withAlpha(i % 2 === 0 ? lightningLight : lightningMid, alpha);
            ctx.lineWidth = Math.max(0.45, random(0.65, 1.02) * scaleFactor);
            ctx.stroke();

            if (Math.random() < 0.36) {
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(
                    px + random(-1.8, 1.8) * scaleFactor,
                    py + random(-1.6, 1.6) * scaleFactor
                );
                ctx.strokeStyle = withAlpha(lightningDark, random(0.18, 0.34) * pulse);
                ctx.lineWidth = Math.max(0.3, random(0.38, 0.62) * scaleFactor);
                ctx.stroke();
            }
        }

        ctx.restore();
    },

    drawPhongLoiWing(ctx, options) {
        const {
            side,
            wingOffsetX,
            wingOffsetY,
            wingWidth,
            wingHeight,
            glowBlur,
            flapAmplitude,
            scaleFactor,
            spread,
            time,
            primaryColor,
            secondaryColor,
            auraColor,
            lightningLight,
            lightningMid,
            lightningDark
        } = options;
        const upperTipX = wingWidth * (0.88 + (spread * 0.28));
        const upperTipY = -wingHeight * (0.7 + (spread * 0.18));
        const lowerTailX = wingWidth * (0.52 + (spread * 0.08));
        const lowerTailY = wingHeight * (0.16 + (spread * 0.12));
        const flap = Math.sin((time * (1.02 + (spread * 0.32))) + (side < 0 ? 0.3 : 0.92))
            * ((flapAmplitude * 0.22) + (spread * flapAmplitude * 0.78));
        const rootSway = Math.sin(time + (side < 0 ? 0.45 : 1.08)) * wingHeight * (0.02 + (spread * 0.08));
        const poseOffsetX = wingOffsetX * (0.7 + (spread * 0.42));
        const poseOffsetY = wingOffsetY + (wingHeight * ((1 - spread) * 0.1)) + rootSway;
        const wingTilt = 0.54 - (spread * 0.34) + flap;
        const featherStrokes = [
            {
                startX: wingWidth * 0.06,
                startY: wingHeight * 0.01,
                controlX: wingWidth * 0.12,
                controlY: -wingHeight * 0.08,
                tipX: wingWidth * (0.24 + (spread * 0.04)),
                tipY: -wingHeight * (0.18 + (spread * 0.08)),
                color: secondaryColor,
                alpha: 0.52
            },
            {
                startX: wingWidth * 0.1,
                startY: wingHeight * 0.02,
                controlX: wingWidth * 0.22,
                controlY: -wingHeight * 0.16,
                tipX: wingWidth * (0.44 + (spread * 0.08)),
                tipY: -wingHeight * (0.4 + (spread * 0.12)),
                color: primaryColor,
                alpha: 0.5
            },
            {
                startX: wingWidth * 0.14,
                startY: wingHeight * 0.03,
                controlX: wingWidth * 0.3,
                controlY: -wingHeight * 0.2,
                tipX: wingWidth * (0.68 + (spread * 0.16)),
                tipY: -wingHeight * (0.64 + (spread * 0.18)),
                color: auraColor,
                alpha: 0.6
            },
            {
                startX: wingWidth * 0.1,
                startY: wingHeight * 0.07,
                controlX: wingWidth * 0.28,
                controlY: wingHeight * 0.03,
                tipX: wingWidth * (0.52 + (spread * 0.08)),
                tipY: wingHeight * (0.04 + (spread * 0.04)),
                color: primaryColor,
                alpha: 0.44
            },
            {
                startX: wingWidth * 0.08,
                startY: wingHeight * 0.09,
                controlX: wingWidth * 0.22,
                controlY: wingHeight * 0.16,
                tipX: wingWidth * (0.42 + (spread * 0.06)),
                tipY: wingHeight * (0.16 + (spread * 0.08)),
                color: auraColor,
                alpha: 0.38
            }
        ];

        ctx.save();
        ctx.scale(side, 1);
        ctx.translate(poseOffsetX, poseOffsetY);
        ctx.rotate(wingTilt);
        ctx.shadowBlur = glowBlur * (0.74 + (spread * 0.32));
        ctx.shadowColor = withAlpha(auraColor, 0.72);

        const wingGradient = ctx.createLinearGradient(0, -wingHeight * 0.9, upperTipX, lowerTailY);
        wingGradient.addColorStop(0, withAlpha(secondaryColor, 0.98));
        wingGradient.addColorStop(0.52, withAlpha(primaryColor, 0.94));
        wingGradient.addColorStop(1, withAlpha(auraColor, 0.24));

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(
            wingWidth * (0.18 + (spread * 0.03)),
            -wingHeight * (0.12 + (spread * 0.06)),
            wingWidth * (0.42 + (spread * 0.12)),
            -wingHeight * (0.56 + (spread * 0.14)),
            upperTipX,
            upperTipY
        );
        ctx.quadraticCurveTo(
            wingWidth * (0.78 + (spread * 0.12)),
            -wingHeight * (0.36 + (spread * 0.08)),
            wingWidth * (0.6 + (spread * 0.08)),
            -wingHeight * (0.06 + (spread * 0.04))
        );
        ctx.quadraticCurveTo(
            wingWidth * (0.72 + (spread * 0.1)),
            wingHeight * (0.08 + (spread * 0.04)),
            lowerTailX,
            lowerTailY
        );
        ctx.quadraticCurveTo(
            wingWidth * (0.28 + (spread * 0.05)),
            wingHeight * (0.24 + (spread * 0.08)),
            wingWidth * 0.1,
            wingHeight * (0.12 + (spread * 0.05))
        );
        ctx.quadraticCurveTo(wingWidth * 0.02, wingHeight * 0.05, 0, 0);
        ctx.closePath();
        ctx.fillStyle = wingGradient;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(wingWidth * 0.02, wingHeight * 0.01);
        ctx.quadraticCurveTo(
            wingWidth * (0.2 + (spread * 0.04)),
            -wingHeight * (0.16 + (spread * 0.04)),
            wingWidth * (0.64 + (spread * 0.12)),
            -wingHeight * (0.58 + (spread * 0.18))
        );
        ctx.quadraticCurveTo(
            wingWidth * (0.54 + (spread * 0.06)),
            -wingHeight * (0.28 + (spread * 0.08)),
            wingWidth * (0.44 + (spread * 0.02)),
            -wingHeight * 0.02
        );
        ctx.quadraticCurveTo(
            wingWidth * (0.48 + (spread * 0.04)),
            wingHeight * (0.04 + (spread * 0.03)),
            wingWidth * 0.16,
            wingHeight * (0.08 + (spread * 0.04))
        );
        ctx.closePath();
        ctx.fillStyle = withAlpha('#ffffff', 0.16 + (spread * 0.12));
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(
            wingWidth * 0.18,
            -wingHeight * 0.1,
            wingWidth * (0.36 + (spread * 0.12)),
            -wingHeight * (0.34 + (spread * 0.14)),
            wingWidth * (0.68 + (spread * 0.16)),
            -wingHeight * (0.62 + (spread * 0.2))
        );
        ctx.strokeStyle = withAlpha('#ffffff', 0.78);
        ctx.lineWidth = Math.max(0.7, 1.02 * scaleFactor);
        ctx.stroke();

        featherStrokes.forEach((feather, index) => {
            ctx.beginPath();
            ctx.moveTo(feather.startX, feather.startY);
            ctx.quadraticCurveTo(feather.controlX, feather.controlY, feather.tipX, feather.tipY);
            ctx.strokeStyle = withAlpha(feather.color, feather.alpha);
            ctx.lineWidth = Math.max(0.45, (0.9 - (index * 0.08)) * Math.max(scaleFactor, 0.9));
            ctx.stroke();
        });

        this.drawPhongLoiWingAura(ctx, {
            wingWidth,
            wingHeight,
            glowBlur,
            scaleFactor,
            spread,
            time,
            lightningLight,
            lightningMid,
            lightningDark
        });

        ctx.restore();
    },

    drawPhongLoiArtifact(ctx, scaleFactor) {
        if (!this.isArtifactDeployed('PHONG_LOI_SI')) return;

        const artifactConfig = this.getArtifactConfig('PHONG_LOI_SI');
        const cursorStyle = artifactConfig?.cursorStyle || {};
        const wingOffsetX = Math.max(9, (cursorStyle.WING_OFFSET_X || 15) * scaleFactor);
        const wingOffsetY = (cursorStyle.WING_OFFSET_Y || -1.5) * scaleFactor;
        const wingWidth = Math.max(8, (cursorStyle.WING_WIDTH || 15) * scaleFactor);
        const wingHeight = Math.max(10, (cursorStyle.WING_HEIGHT || 20) * scaleFactor);
        const glowBlur = Math.max(8, (cursorStyle.GLOW_BLUR || 16) * scaleFactor);
        const flapAmplitude = Number(cursorStyle.FLAP_AMPLITUDE) || 0.12;
        const time = performance.now() * (Number(cursorStyle.FLAP_SPEED) || 0.0052);
        const spread = this.getPhongLoiWingSpread();
        const secondaryColor = artifactConfig?.secondaryColor || '#dffeff';
        const primaryColor = artifactConfig?.color || '#9fe8ff';
        const auraColor = artifactConfig?.auraColor || '#89a6ff';
        const lightningLight = CONFIG.COLORS?.SWORD_GOLD_LIGHT || '#FFF2C2';
        const lightningMid = CONFIG.COLORS?.SWORD_GOLD_MID || '#E6C87A';
        const lightningDark = CONFIG.COLORS?.SWORD_GOLD_DARK || '#B8944E';

        ctx.save();
        ctx.translate(this.x, this.y);

        [-1, 1].forEach(side => {
            this.drawPhongLoiWing(ctx, {
                side,
                wingOffsetX,
                wingOffsetY,
                wingWidth,
                wingHeight,
                glowBlur,
                flapAmplitude,
                scaleFactor,
                spread,
                time,
                primaryColor,
                secondaryColor,
                auraColor,
                lightningLight,
                lightningMid,
                lightningDark
            });
        });

        ctx.restore();
    },

    drawPhongLoiBlinkGhost(ctx, effect, scaleFactor, artifactConfig) {
        const now = performance.now();
        const progress = (now - effect.startedAt) / Math.max(1, effect.durationMs || 1);
        if (progress >= 1) return;

        const cursorStyle = artifactConfig?.cursorStyle || {};
        const alpha = (1 - progress);
        const wingOffsetX = Math.max(8, (cursorStyle.WING_OFFSET_X || 15) * scaleFactor * 0.92);
        const wingOffsetY = (cursorStyle.WING_OFFSET_Y || -1.5) * scaleFactor;
        const wingWidth = Math.max(7, (cursorStyle.WING_WIDTH || 15) * scaleFactor * 0.92);
        const wingHeight = Math.max(9, (cursorStyle.WING_HEIGHT || 20) * scaleFactor * 0.92);
        const glowBlur = Math.max(6, (cursorStyle.GLOW_BLUR || 16) * scaleFactor * 0.72);
        const flapAmplitude = (Number(cursorStyle.FLAP_AMPLITUDE) || 0.12) * 0.7;
        const time = (effect.startedAt + (progress * 120)) * (Number(cursorStyle.FLAP_SPEED) || 0.0052);
        const spread = clampNumber(0.28 + (alpha * 0.42), 0.18, 0.92);
        const secondaryColor = artifactConfig?.secondaryColor || '#dffeff';
        const primaryColor = artifactConfig?.color || '#9fe8ff';
        const auraColor = artifactConfig?.auraColor || '#89a6ff';
        const lightningLight = CONFIG.COLORS?.SWORD_GOLD_LIGHT || '#FFF2C2';
        const lightningMid = CONFIG.COLORS?.SWORD_GOLD_MID || '#E6C87A';
        const lightningDark = CONFIG.COLORS?.SWORD_GOLD_DARK || '#B8944E';

        ctx.save();
        ctx.translate(effect.x, effect.y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.2 + (alpha * 0.32);
        ctx.shadowBlur = 18 * scaleFactor;
        ctx.shadowColor = withAlpha(auraColor, 0.65);

        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 28 * scaleFactor);
        halo.addColorStop(0, withAlpha('#ffffff', 0.26 * alpha));
        halo.addColorStop(0.34, withAlpha(primaryColor, 0.18 * alpha));
        halo.addColorStop(1, withAlpha(auraColor, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, 28 * scaleFactor, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.16 + (alpha * 0.26);
        [-1, 1].forEach(side => {
            this.drawPhongLoiWing(ctx, {
                side,
                wingOffsetX,
                wingOffsetY,
                wingWidth,
                wingHeight,
                glowBlur,
                flapAmplitude,
                scaleFactor,
                spread,
                time,
                primaryColor,
                secondaryColor,
                auraColor,
                lightningLight,
                lightningMid,
                lightningDark
            });
        });

        ctx.globalAlpha = 0.24 + (alpha * 0.24);
        ctx.strokeStyle = withAlpha('#ffffff', 0.46 * alpha);
        ctx.lineWidth = Math.max(1, 1.35 * scaleFactor);
        ctx.beginPath();
        ctx.arc(0, 0, (14 + (progress * 10)) * scaleFactor, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    },

    drawPhongLoiBlinkTrail(ctx, effect, scaleFactor, artifactConfig) {
        const now = performance.now();
        const progress = (now - effect.startedAt) / Math.max(1, effect.durationMs || 1);
        if (progress >= 1) return;

        const alpha = 1 - progress;
        const primaryColor = artifactConfig?.color || '#9fe8ff';
        const auraColor = artifactConfig?.auraColor || '#89a6ff';
        const highlightColor = artifactConfig?.secondaryColor || '#dffeff';
        const dx = effect.toX - effect.fromX;
        const dy = effect.toY - effect.fromY;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const normalX = -dy / distance;
        const normalY = dx / distance;
        const segmentCount = Math.max(4, Math.min(8, Math.round(distance / 34)));
        const jitter = Math.max(5, 12 * scaleFactor) * alpha;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let lane = 0; lane < 3; lane++) {
            ctx.beginPath();
            ctx.moveTo(effect.fromX, effect.fromY);

            for (let step = 1; step < segmentCount; step++) {
                const ratio = step / segmentCount;
                const baseX = effect.fromX + (dx * ratio);
                const baseY = effect.fromY + (dy * ratio);
                const laneDrift = (lane - 1) * jitter * 0.22;
                const wander = Math.sin((ratio * Math.PI * 4) + (lane * 1.4) + progress * 18) * jitter;
                const pointX = baseX + (normalX * (wander + laneDrift));
                const pointY = baseY + (normalY * (wander + laneDrift));
                ctx.lineTo(pointX, pointY);
            }

            ctx.lineTo(effect.toX, effect.toY);
            ctx.strokeStyle = lane === 1
                ? withAlpha(highlightColor, 0.84 * alpha)
                : withAlpha(lane === 0 ? auraColor : primaryColor, (0.26 + (lane * 0.08)) * alpha);
            ctx.lineWidth = Math.max(0.9, (lane === 1 ? 2.6 : 4.8) * scaleFactor * (0.8 + (alpha * 0.35)));
            ctx.shadowBlur = lane === 1 ? 18 * scaleFactor : 10 * scaleFactor;
            ctx.shadowColor = lane === 1 ? withAlpha(highlightColor, 0.9 * alpha) : withAlpha(primaryColor, 0.4 * alpha);
            ctx.stroke();
        }

        ctx.restore();
    },

    drawPhongLoiBlinkCharge(ctx, charge, scaleFactor, artifactConfig) {
        const cfg = this.getPhongLoiBlinkConfig();
        const elapsed = performance.now() - charge.startedAt;
        const progress = clampNumber(elapsed / Math.max(1, cfg.chargeMs), 0, 1);
        const primaryColor = artifactConfig?.color || '#9fe8ff';
        const auraColor = artifactConfig?.auraColor || '#89a6ff';
        const secondaryColor = artifactConfig?.secondaryColor || '#dffeff';
        const directionX = this.ensurePhongLoiBlinkState().lastMoveVectorX || 1;
        const directionY = this.ensurePhongLoiBlinkState().lastMoveVectorY || 0;
        const angle = Math.atan2(directionY, directionX || 0.0001);
        const pulse = 0.82 + (Math.sin(performance.now() * 0.05) * 0.18);
        const radius = (18 + (progress * 10)) * scaleFactor;
        const anchorX = Number.isFinite(charge.anchorX) ? charge.anchorX : this.x;
        const anchorY = Number.isFinite(charge.anchorY) ? charge.anchorY : this.y;

        ctx.save();
        ctx.translate(anchorX, anchorY);
        ctx.globalCompositeOperation = 'lighter';

        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 2.6);
        halo.addColorStop(0, withAlpha('#ffffff', 0.18 + (progress * 0.16)));
        halo.addColorStop(0.28, withAlpha(primaryColor, 0.22 + (progress * 0.18)));
        halo.addColorStop(0.62, withAlpha(auraColor, 0.16));
        halo.addColorStop(1, withAlpha(auraColor, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 2.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.rotate(performance.now() * 0.0042);
        ctx.strokeStyle = withAlpha(primaryColor, 0.52 + (progress * 0.16));
        ctx.lineWidth = Math.max(1.2, 2.1 * scaleFactor);
        ctx.setLineDash([6 * scaleFactor, 8 * scaleFactor]);
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * (1.2 + (progress * 0.16)), radius * (0.76 + (progress * 0.08)), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-4 * scaleFactor, 0);
        ctx.lineTo((28 + (progress * 18)) * scaleFactor, 0);
        ctx.strokeStyle = withAlpha('#ffffff', 0.84);
        ctx.lineWidth = Math.max(1.2, 2 * scaleFactor);
        ctx.shadowBlur = 16 * scaleFactor;
        ctx.shadowColor = withAlpha(secondaryColor, 0.92);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo((10 + (progress * 4)) * scaleFactor, (-5 - (progress * 6)) * scaleFactor);
        ctx.lineTo((20 + (progress * 10)) * scaleFactor, (-1 + (progress * 3)) * scaleFactor);
        ctx.lineTo((16 + (progress * 8)) * scaleFactor, (7 + (progress * 6)) * scaleFactor);
        ctx.strokeStyle = withAlpha(auraColor, 0.66);
        ctx.lineWidth = Math.max(0.9, 1.5 * scaleFactor);
        ctx.stroke();
        ctx.restore();

        for (let i = 0; i < 4; i++) {
            const sparkAngle = angle + ((i - 1.5) * 0.58) + (Math.sin((elapsed * 0.022) + i) * 0.12);
            const sparkDistance = radius * (0.58 + (i * 0.18) + (Math.sin((elapsed * 0.016) + (i * 1.4)) * 0.08)) * pulse;
            const px = Math.cos(sparkAngle) * sparkDistance;
            const py = Math.sin(sparkAngle) * sparkDistance;
            ctx.beginPath();
            ctx.fillStyle = withAlpha(i % 2 === 0 ? primaryColor : '#ffffff', 0.42 + (progress * 0.22));
            ctx.shadowBlur = 10 * scaleFactor;
            ctx.shadowColor = withAlpha(primaryColor, 0.72);
            ctx.arc(px, py, Math.max(0.8, (1.6 + (progress * 1.2)) * scaleFactor), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    drawPhongLoiBlinkEffects(ctx, scaleFactor) {
        const state = this.prunePhongLoiBlinkEffects();
        if (!state.charging && !state.trails.length && !state.afterimages.length) return;

        const artifactConfig = this.getArtifactConfig('PHONG_LOI_SI') || {};

        state.afterimages.forEach(effect => {
            this.drawPhongLoiBlinkGhost(ctx, effect, scaleFactor, artifactConfig);
        });

        state.trails.forEach(effect => {
            this.drawPhongLoiBlinkTrail(ctx, effect, scaleFactor, artifactConfig);
        });

        if (state.charging) {
            this.drawPhongLoiBlinkCharge(ctx, state.charging, scaleFactor, artifactConfig);
        }
    },

    drawCursor(ctx, scaleFactor) {
        this.drawHuyetSacPhiPhongCloak(ctx, scaleFactor);
        this.drawNguCucSonOrbit(ctx, scaleFactor);
        this.drawNguCucSonCompositeShield(ctx, scaleFactor);
        this.drawHuThienDinhShield(ctx, scaleFactor);
        if (this.isArtifactDeployed('CAN_LAM_BANG_DIEM')) {
            this.drawFlame(ctx, scaleFactor);
        } else {
            this.drawCursorSeed(ctx, scaleFactor);
        }

        this.drawPhongLoiArtifact(ctx, scaleFactor);
        this.drawHuThienDinhShield(ctx, scaleFactor);
        this.drawCursorDamageFeedback(ctx, scaleFactor);
    },

    drawNguCucSonOrbit(ctx, scaleFactor) {
        if (!this.isNguCucSonBarrierActive()) return;
        const now = performance.now();
        const nodes = this.getNguCucSonOrbitNodes(scaleFactor, now);
        if (!nodes.length) return;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        const orbitPulse = 0.84 + (Math.sin(now * 0.0032) * 0.12);
        const orbitRadius = nodes[0].orbitRadius;
        ctx.beginPath();
        ctx.strokeStyle = withAlpha(nodes[0].color, 0.16 + (orbitPulse * 0.08));
        ctx.lineWidth = Math.max(1, 1.5 * scaleFactor);
        ctx.arc(this.x, this.y, orbitRadius, 0, Math.PI * 2);
        ctx.stroke();

        nodes.forEach((node, index) => {
            const glow = 0.22 + (Math.sin((now * 0.005) + index) * 0.08);
            ctx.save();
            ctx.translate(node.x, node.y);
            ctx.rotate(node.angle + (Math.PI / 2));

            const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, node.bodyRadius * 2.2);
            halo.addColorStop(0, withAlpha(node.secondaryColor, 0.26 + glow));
            halo.addColorStop(0.52, withAlpha(node.color, 0.16 + glow));
            halo.addColorStop(1, withAlpha(node.auraColor, 0));
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(0, 0, node.bodyRadius * 2.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.fillStyle = withAlpha(node.color, 0.86);
            ctx.strokeStyle = withAlpha(node.secondaryColor, 0.8);
            ctx.lineWidth = Math.max(1, 1.1 * scaleFactor);
            ctx.moveTo(0, -node.bodyRadius * 1.05);
            ctx.lineTo(node.bodyRadius * 0.92, node.bodyRadius * 0.95);
            ctx.lineTo(-node.bodyRadius * 0.92, node.bodyRadius * 0.95);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.fillStyle = withAlpha('#ffffff', 0.35);
            ctx.moveTo(0, -node.bodyRadius * 0.76);
            ctx.lineTo(node.bodyRadius * 0.32, node.bodyRadius * 0.1);
            ctx.lineTo(-node.bodyRadius * 0.32, node.bodyRadius * 0.1);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        });

        ctx.restore();
    },

    drawNguCucSonCompositeShield(ctx, scaleFactor) {
        if (!this.isNguCucSonCompositeShieldActive()) return;
        this.tickNguCucSonCompositeShieldRecovery();
        const state = this.ensureNguCucSonCompositeShieldState();
        const ratio = clampNumber(state.currentCapacity / Math.max(1, state.maxCapacity), 0, 1);
        if (ratio <= 0) return;

        const cfg = this.getArtifactConfig('NGUYEN_HOP_NGU_CUC_SON') || {};
        const primaryColor = cfg.color || '#ffd76a';
        const secondaryColor = cfg.secondaryColor || '#fff2c7';
        const auraColor = cfg.auraColor || '#b78b1d';
        const crackLevel = clampNumber(1 - ratio + (state.crackIntensity * 0.24), 0, 1);
        const height = (26 + (ratio * 6)) * scaleFactor;
        const width = height * 1.15;

        ctx.save();
        ctx.translate(this.x, this.y);

        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 2.2);
        halo.addColorStop(0, withAlpha('#ffffff', 0.05 + (ratio * 0.05)));
        halo.addColorStop(0.42, withAlpha(primaryColor, 0.12 + (ratio * 0.1)));
        halo.addColorStop(1, withAlpha(auraColor, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, width * 2.2, 0, Math.PI * 2);
        ctx.fill();

        const layeredColors = [
            secondaryColor,
            '#ffd36b',
            '#2ecc71',
            '#3498db',
            '#8e44ad'
        ];
        const layeredTriangles = [
            { xOffset: 0, yOffset: 0, heightScale: 1, widthScale: 1 },
            { xOffset: width * 0.16, yOffset: height * 0.12, heightScale: 0.9, widthScale: 0.92 },
            { xOffset: -width * 0.18, yOffset: height * 0.24, heightScale: 0.82, widthScale: 0.86 },
            { xOffset: width * 0.2, yOffset: height * 0.35, heightScale: 0.74, widthScale: 0.8 },
            { xOffset: -width * 0.22, yOffset: height * 0.45, heightScale: 0.66, widthScale: 0.74 }
        ];

        ctx.lineWidth = Math.max(1.1, 1.5 * scaleFactor);
        ctx.shadowBlur = 16 * scaleFactor;
        ctx.shadowColor = withAlpha(primaryColor, 0.46);
        layeredTriangles.forEach((layer, index) => {
            const layerWidth = width * layer.widthScale;
            const layerHeight = height * layer.heightScale;
            const fillAlpha = 0.76 + ((4 - index) * 0.03);
            ctx.fillStyle = withAlpha(layeredColors[index], fillAlpha);
            ctx.strokeStyle = withAlpha(secondaryColor, 0.4 + ((4 - index) * 0.07));
            ctx.beginPath();
            ctx.moveTo(layer.xOffset, (-height * 1.16 * layer.heightScale) + layer.yOffset);
            ctx.lineTo(layer.xOffset + (layerWidth * 0.92), (height * 0.95) + layer.yOffset);
            ctx.lineTo(layer.xOffset - (layerWidth * 0.92), (height * 0.95) + layer.yOffset);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        if (crackLevel > 0.08) {
            ctx.strokeStyle = withAlpha('#2f2132', 0.2 + (crackLevel * 0.48));
            ctx.lineWidth = Math.max(0.8, 1.2 * scaleFactor);
            ctx.beginPath();
            ctx.moveTo(-width * 0.1, -height * 0.4);
            ctx.lineTo(width * 0.04, -height * 0.04);
            ctx.lineTo(-width * 0.14, height * 0.3);
            ctx.moveTo(width * 0.22, -height * 0.62);
            ctx.lineTo(width * 0.1, -height * 0.2);
            ctx.lineTo(width * 0.24, height * 0.24);
            if (crackLevel > 0.46) {
                ctx.moveTo(-width * 0.45, -height * 0.1);
                ctx.lineTo(-width * 0.2, height * 0.2);
                ctx.lineTo(-width * 0.4, height * 0.52);
            }
            ctx.stroke();
        }

        ctx.restore();
    },

    drawHuThienDinhShield(ctx, scaleFactor) {
        if (!this.isArtifactDeployed('HU_THIEN_DINH')) return;
        this.tickHuThienDinhShieldRecovery();
        const artifactConfig = this.getArtifactConfig('HU_THIEN_DINH') || {};
        const shieldState = this.ensureHuThienDinhShieldState();
        const ratio = clampNumber(shieldState.currentCapacity / Math.max(1, shieldState.maxCapacity), 0, 1);
        if (ratio <= 0) return;

        const primaryColor = artifactConfig.color || '#93c8d8';
        const secondaryColor = artifactConfig.secondaryColor || '#d9ecf3';
        const auraColor = artifactConfig.auraColor || '#5f8595';
        const crackLevel = clampNumber(1 - ratio + (shieldState.crackIntensity * 0.25), 0, 1);
        const pulse = 0.82 + (Math.sin(performance.now() * 0.0042) * 0.18);
        const radius = (30 + (ratio * 6)) * scaleFactor;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = 'source-over';

        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.95);
        halo.addColorStop(0, withAlpha('#ffffff', 0.02 + (ratio * 0.03)));
        halo.addColorStop(0.34, withAlpha(secondaryColor, 0.04 + (ratio * 0.05)));
        halo.addColorStop(0.76, withAlpha(primaryColor, 0.07));
        halo.addColorStop(1, withAlpha(auraColor, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.95, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.scale(scaleFactor, scaleFactor);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const bodyGradient = ctx.createLinearGradient(0, -30, 0, 30);
        bodyGradient.addColorStop(0, withAlpha(secondaryColor, 0.22 + (ratio * 0.06)));
        bodyGradient.addColorStop(0.45, withAlpha(primaryColor, 0.16 + (ratio * 0.04)));
        bodyGradient.addColorStop(1, withAlpha(auraColor, 0.08 + (ratio * 0.03)));

        // Thân đỉnh (lư đỉnh cổ 3 chân)
        ctx.fillStyle = bodyGradient;
        ctx.strokeStyle = withAlpha(secondaryColor, 0.5);
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = withAlpha(auraColor, 0.34);
        ctx.beginPath();
        ctx.moveTo(-16.8, -12.5);
        ctx.bezierCurveTo(-23.4, -9.6, -25.8, 1.4, -22.8, 12.2);
        ctx.bezierCurveTo(-20.8, 19.4, -13.4, 25.6, 0, 26.6);
        ctx.bezierCurveTo(13.4, 25.6, 20.8, 19.4, 22.8, 12.2);
        ctx.bezierCurveTo(25.8, 1.4, 23.4, -9.6, 16.8, -12.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Nắp đỉnh
        ctx.fillStyle = withAlpha(secondaryColor, 0.18 + (ratio * 0.05));
        ctx.strokeStyle = withAlpha('#ffffff', 0.36);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, -14.6, 12.8, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Quai đỉnh hai bên
        ctx.strokeStyle = withAlpha(secondaryColor, 0.42);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-16.5, -7.6);
        ctx.quadraticCurveTo(-24.8, -6.8, -21.8, 1.8);
        ctx.moveTo(16.5, -7.6);
        ctx.quadraticCurveTo(24.8, -6.8, 21.8, 1.8);
        ctx.stroke();

        // Núm trên nắp
        ctx.fillStyle = withAlpha('#ffffff', 0.38);
        ctx.beginPath();
        ctx.arc(0, -19.8, 1.9, 0, Math.PI * 2);
        ctx.fill();

        // Ba chân đỉnh
        const legLight = withAlpha(secondaryColor, 0.44);
        const legShade = withAlpha(primaryColor, 0.22);
        const drawLeg = (x, spread = 1) => {
            ctx.fillStyle = legShade;
            ctx.strokeStyle = legLight;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(x - (1.4 * spread), 23.3);
            ctx.quadraticCurveTo(x - (2.3 * spread), 29, x - (0.8 * spread), 31.8);
            ctx.lineTo(x + (0.8 * spread), 31.8);
            ctx.quadraticCurveTo(x + (2.3 * spread), 29, x + (1.4 * spread), 23.3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };
        drawLeg(-8.8, 1);
        drawLeg(0, 1.14);
        drawLeg(8.8, 1);

        // Đai thân đỉnh
        ctx.strokeStyle = withAlpha('#ffffff', 0.28);
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.ellipse(0, -2.6, 15.8, 6.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 8.8, 14.8, 5.4, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Hiệu ứng nứt vỡ - tập trung từ thân ra ngoài, có nhánh phụ mềm hơn
        const crackCount = Math.min(12, 3 + Math.floor(crackLevel * 11));
        ctx.strokeStyle = withAlpha('#f7fdff', 0.06 + (crackLevel * 0.3));
        for (let i = 0; i < crackCount; i++) {
            const t = (i + 1) / (crackCount + 1);
            const angle = (-Math.PI * 0.82) + (t * Math.PI * 1.64) + (Math.sin((pulse * 2.2) + i) * 0.05);
            const startR = 3.4 + (Math.sin((i * 0.93) + pulse) * 1.4);
            const midR = 10.6 + (Math.cos((i * 1.11) + pulse) * 2.2);
            const endR = 19.2 + (Math.sin((i * 1.49) + pulse) * 2.8);

            const sx = Math.cos(angle) * startR;
            const sy = Math.sin(angle) * startR * 0.88;
            const mx = Math.cos(angle + 0.08) * midR;
            const my = Math.sin(angle + 0.08) * midR * 0.9;
            const ex = Math.cos(angle + 0.16) * endR;
            const ey = Math.sin(angle + 0.16) * endR * 0.92;

            ctx.lineWidth = 0.34 + (crackLevel * 0.34);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(mx, my);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            if (crackLevel > 0.24 && i % 2 === 0) {
                const branchLen = 2.5 + (crackLevel * 5.2);
                const branchAngle = angle + ((i % 4 === 0) ? -0.62 : 0.58);
                ctx.lineWidth = 0.28 + (crackLevel * 0.22);
                ctx.beginPath();
                ctx.moveTo(mx, my);
                ctx.lineTo(
                    mx + (Math.cos(branchAngle) * branchLen),
                    my + (Math.sin(branchAngle) * branchLen)
                );
                ctx.stroke();
            }
        }

        // Ánh nhịp theo mức khiên giúp đỉnh "sống" hơn
        if (ratio > 0.08) {
            ctx.strokeStyle = withAlpha('#ffffff', 0.09 + (ratio * 0.12));
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.ellipse(0, -6.2, 10.8 + (pulse * 1.1), 3 + (pulse * 0.3), 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
        ctx.restore();
    },

    drawCursorDamageFeedback(ctx, scaleFactor) {
        const elapsed = performance.now() - (this.lastEnemyDamageAt || 0);
        if (elapsed > 340) return;
        const t = clampNumber(elapsed / 340, 0, 1);
        const pulse = 1 - t;
        const radius = (14 + (12 * t)) * scaleFactor;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255, 118, 118, ${0.82 * pulse})`;
        ctx.lineWidth = Math.max(1.2, 2.8 * scaleFactor * pulse);
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 * i) / 5 + (t * 0.45);
            const innerR = (4 + (2 * i * 0.2)) * scaleFactor;
            const outerR = (9 + (12 * pulse)) * scaleFactor;
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(angle) * innerR, this.y + Math.sin(angle) * innerR);
            ctx.lineTo(this.x + Math.cos(angle) * outerR, this.y + Math.sin(angle) * outerR);
            ctx.strokeStyle = `rgba(255, 208, 208, ${0.68 * pulse})`;
            ctx.lineWidth = Math.max(0.8, 1.4 * scaleFactor * pulse);
            ctx.stroke();
        }
        ctx.restore();
    },

    drawHuyetSacPhiPhongCloak(ctx, scaleFactor) {
        if (!this.isArtifactDeployed('HUYET_SAC_PHI_PHONG')) return;

        const artifactConfig = this.getArtifactConfig('HUYET_SAC_PHI_PHONG') || {};
        const primaryColor = artifactConfig.color || '#ff5d73';
        const secondaryColor = artifactConfig.secondaryColor || '#ffd0d6';
        const auraColor = artifactConfig.auraColor || '#b81531';
        const dx = Number.isFinite(this.x - this.px) ? this.x - this.px : 0;
        const dy = Number.isFinite(this.y - this.py) ? this.y - this.py : 1;
        const moveLen = Math.max(0.001, Math.hypot(dx, dy));
        const nx = dx / moveLen;
        const ny = dy / moveLen;
        const backX = -nx;
        const backY = -ny;
        const sideX = -backY;
        const sideY = backX;
        const base = 18 * scaleFactor;
        const length = (42 + Math.min(18, moveLen * 0.6)) * scaleFactor;

        const leftX = this.x + sideX * base * 0.65;
        const leftY = this.y + sideY * base * 0.65;
        const rightX = this.x - sideX * base * 0.65;
        const rightY = this.y - sideY * base * 0.65;
        const tailX = this.x + backX * length;
        const tailY = this.y + backY * length;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        grad.addColorStop(0, withAlpha(secondaryColor, 0.72));
        grad.addColorStop(0.45, withAlpha(primaryColor, 0.58));
        grad.addColorStop(1, withAlpha(auraColor, 0.08));
        ctx.fillStyle = grad;
        ctx.shadowBlur = 18 * scaleFactor;
        ctx.shadowColor = withAlpha(primaryColor, 0.74);
        ctx.beginPath();
        ctx.moveTo(leftX, leftY);
        ctx.quadraticCurveTo(this.x + backX * (length * 0.35), this.y + backY * (length * 0.35), tailX, tailY);
        ctx.quadraticCurveTo(this.x + sideX * 2, this.y + sideY * 2, rightX, rightY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    },

    drawFlame(ctx, scaleFactor) {
        const time = performance.now() * 0.003;
        const aura = this.getAuraPalette();
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. Quầng sáng lạnh (Aura Băng Diễm)
        // Càng Lam Băng Diễm có đặc điểm tỏa ra hàn khí màu xanh lam nhạt
        ctx.shadowBlur = 20 * scaleFactor;
        ctx.shadowColor = aura.shadowColor;

        // 2. Định nghĩa các lớp màu "Càng Lam"
        // Lớp 1: Lam đậm (viền ngoài)
        // Lớp 2: Lam băng (thân lửa)
        // Lớp 3: Thiên lam trắng (lõi hỏa rực cháy)
        const layers = aura.layers;

        layers.forEach((layer, i) => {
            const flicker = Math.sin(time * layer.f + i) * 3;
            const w = (layer.w + flicker/2) * scaleFactor;
            const h = (layer.h + flicker) * scaleFactor;

            ctx.beginPath();
            ctx.fillStyle = layer.color;
            
            // Vẽ dáng lửa hơi nhọn và mảnh hơn (nhìn sắc lạnh hơn)
            ctx.moveTo(0, 0); 
            ctx.bezierCurveTo(-w, 0, -w/2, -h * 0.6, 0, -h); 
            ctx.bezierCurveTo(w/2, -h * 0.6, w, 0, 0, 0);    
            ctx.fill();
        });

        // 3. Hàn khí (Các đốm sáng nhỏ li ti bay lên)
        for (let j = 0; j < 4; j++) {
            const pOffset = (time * 0.8 + j * 0.4) % 1.2;
            const px = Math.sin(time * 1.5 + j) * 8 * scaleFactor;
            const py = -pOffset * 25 * scaleFactor;
            const pr = (1.8 * (1.2 - pOffset)) * scaleFactor;

            ctx.beginPath();
            ctx.arc(px, py, Math.max(0, pr), 0, Math.PI * 2);
            ctx.fillStyle = aura.particleColor;
            ctx.fill();
        }

        ctx.restore();
    },
});
