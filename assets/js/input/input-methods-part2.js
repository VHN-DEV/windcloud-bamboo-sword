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
        const startX = enemy.x || targetX;
        const startY = enemy.y || targetY;
        const angle = Math.atan2(targetY - startY, targetX - startX);
        const speed = Math.max(120, Number(options.speed) || 220);
        projectiles.push({
            type: options.type || 'orb',
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
            ownerId: enemy.floatOffset || 0
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

            const hitDistance = Math.hypot(shot.x - centerX, shot.y - centerY);
            if (hitDistance <= this.getCursorCoreHitRadius()) {
                this.inflictEnemyAttackDamage(shot.damage, 0.28, 'phi đạn tà lực');
                continue;
            }

            visualParticles.push({
                x: shot.x,
                y: shot.y,
                vx: 0,
                vy: 0,
                life: 0.35,
                decay: 0.07,
                size: Math.max(1.8, shot.radius * 0.35),
                color: shot.color,
                glow: shot.color
            });

            projectiles[writeIndex++] = shot;
        }

        projectiles.length = writeIndex;
    },

    updateIncomingEnemyAttacks(enemies, centerX, centerY, dt = 0.016) {
        if (!Array.isArray(enemies) || this.isVoidCollapsed) return;
        const now = performance.now();
        const contactRadius = Math.max(20, (CONFIG.ENEMY?.CONTACT_RADIUS || 44) * (Camera.currentZoom || 1));

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy || enemy.hp <= 0) continue;
            const baseDamage = Math.max(1, Number(enemy.damage) || Number(enemy.rankData?.damage) || 1);
            const dist = Math.hypot((enemy.x || 0) - centerX, (enemy.y || 0) - centerY);
            const retaliating = now < (enemy.retaliateUntil || 0);
            const triggerRange = contactRadius * (retaliating ? 4.2 : 2.8);
            if (dist > triggerRange) continue;

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
                        this.inflictEnemyAttackDamage(baseDamage * 1.12, 0.22, 'tia năng lượng');
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
                        this.inflictEnemyAttackDamage(baseDamage, 0.2, 'công kích trực diện');
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
