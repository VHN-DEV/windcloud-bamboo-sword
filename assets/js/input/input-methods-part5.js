Object.assign(Input, {
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
        }

        if (unlocked) {
            return 'Đã luyện hóa, có thể triển khai hoặc thu hồi bất kỳ lúc nào.';
        }

        if (purchased) {
            return 'Đã kết duyên nhưng còn chờ luyện hóa trong túi trữ vật.';
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

        return nextActive
            ? `${artifactConfig.fullName || uniqueKey} đã khai triển bên tâm ấn.`
            : `${artifactConfig.fullName || uniqueKey} đã thu vào thần hải.`;
    },

    hasArtifactPurchased(uniqueKey) {
        return Boolean(uniqueKey && this.hasUniquePurchase(uniqueKey));
    },

    hasArtifactUnlocked(uniqueKey) {
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
                accent: artifactConfig.color || '#9fe8ff',
                note: this.getArtifactStatusNote(uniqueKey, { active, unlocked, purchased })
            };
        });
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

        if (hatchCount <= 0) {
            return { success: false, reason: 'full', count: 0 };
        }

        if (!this.consumeRequiredMaterials(requirements, hatchCount)) {
            showNotify(`Thiêu nguyên liệu để ấp nở ${species.name}.`, CONFIG.INSECT?.HATCH?.NOTIFY_COLOR || species.color);
            return { success: false, reason: 'materials', count: 0 };
        }

        this.insectEggs[speciesKey] = hatchPreview.availableEggs - hatchCount;
        if (this.insectEggs[speciesKey] <= 0) delete this.insectEggs[speciesKey];

        this.changeTamedInsects(speciesKey, hatchCount, { source: 'hatch' });
        showNotify(`Ấp nở ${formatNumber(hatchCount)} ${species.name}`, CONFIG.INSECT?.HATCH?.NOTIFY_COLOR || species.color);
        this.refreshResourceUI();
        return { success: true, reason: 'hatched', count: hatchCount };
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
