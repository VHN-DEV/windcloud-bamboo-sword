class Enemy {
    static targetCapCache = {
        key: null,
        id: 1,
        index: 0
    };
    static rankIndexCache = {
        ranksRef: null,
        byId: new Map()
    };

    constructor() {
        this.particles = [];
        this.angle = Math.random() * Math.PI * 2; // Hướng di chuyển hiện tại
        this.velocity = { x: 0, y: 0 };
        this.floatOffset = Math.random() * 1000; // Độ lệch thời gian để các con quái không chuyển động giống hệt nhau
        this.wanderSpeed = this.isElite ? 0.8 : 0.4; // Tinh anh di chuyển nhanh hơn
        this.respawn();
    }

    getTargetRankCapId() {
        const realms = CONFIG.CULTIVATION?.MAJOR_REALMS || [];
        const ranks = CONFIG.CULTIVATION?.RANKS || [];
        const maxSpawnId = CONFIG.ENEMY?.SPAWN_RANK_RANGE?.MAX_ID || '';
        const daiLaRealm = realms.find(realm => realm.key === 'DAI_LA');
        const daoToRealm = realms.find(realm => realm.key === 'DAO_TO');
        const cacheKey = [
            ranks.length,
            maxSpawnId,
            daiLaRealm?.endId || '',
            daoToRealm?.startId || ''
        ].join('|');

        if (Enemy.targetCapCache.key === cacheKey) {
            return Enemy.targetCapCache.id;
        }

        let capId = daiLaRealm?.endId;

        if (!capId) {
            capId = daoToRealm?.startId ? Math.max(1, daoToRealm.startId - 1) : null;
        }

        if (!capId) {
            capId = maxSpawnId || ranks[ranks.length - 1]?.id || 1;
        }

        const capIndex = ranks.findIndex(rank => rank.id === capId);
        Enemy.targetCapCache.key = cacheKey;
        Enemy.targetCapCache.id = capId;
        Enemy.targetCapCache.index = capIndex >= 0 ? capIndex : Math.max(0, ranks.length - 1);

        return Enemy.targetCapCache.id;
    }

    getTargetRankCapIndex() {
        this.getTargetRankCapId();
        return Enemy.targetCapCache.index;
    }

    getRankIndexById(rankId) {
        const ranks = CONFIG.CULTIVATION?.RANKS || [];
        const cache = Enemy.rankIndexCache;
        if (cache.ranksRef !== ranks) {
            cache.ranksRef = ranks;
            cache.byId.clear();
            for (let i = 0; i < ranks.length; i++) {
                cache.byId.set(ranks[i].id, i);
            }
        }

        return cache.byId.has(rankId) ? cache.byId.get(rankId) : -1;
    }

    getMajorRealmScaleByRankId(rankId) {
        const realms = Array.isArray(CONFIG.CULTIVATION?.MAJOR_REALMS)
            ? CONFIG.CULTIVATION.MAJOR_REALMS
            : [];
        const safeRankId = Math.max(1, Number(rankId) || 1);
        const realmIndex = realms.findIndex(realm => safeRankId >= realm.startId && safeRankId <= realm.endId);
        if (realmIndex < 0) return 1;

        const realm = realms[realmIndex];
        const span = Math.max(1, (Number(realm.endId) || safeRankId) - (Number(realm.startId) || safeRankId) + 1);
        const localProgress = Math.max(0, Math.min(1, (safeRankId - realm.startId) / span));
        const realmBase = 1 + (realmIndex * 0.2);
        const localBonus = localProgress * 0.16;
        return Math.max(1, realmBase + localBonus);
    }

    respawn() {
        this.spawnVersion = (this.spawnVersion || 0) + 1;

        const zoom = Math.max(0.001, Number(Camera.currentZoom) || 1);
        const visibleHalfWidth = window.innerWidth / (2 * zoom);
        const visibleHalfHeight = window.innerHeight / (2 * zoom);
        const anchorX = Number.isFinite(Camera.centerX) ? Camera.centerX : (window.innerWidth / 2);
        const anchorY = Number.isFinite(Camera.centerY) ? Camera.centerY : (window.innerHeight / 2);
        const padding = Math.max(20, Number(CONFIG.ENEMY.SPAWN_PADDING) || 20);
        const minSpawnDistance = Math.max(visibleHalfWidth, visibleHalfHeight) + padding;
        const maxSpawnDistance = minSpawnDistance + Math.max(240, Math.min(window.innerWidth, window.innerHeight) * 0.9);
        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnDistance = random(minSpawnDistance, maxSpawnDistance);
        
        this.lastHitTime = 0;
        this.lastNotifyTime = 0;
        this.x = anchorX + Math.cos(spawnAngle) * spawnDistance;
        this.y = anchorY + Math.sin(spawnAngle) * spawnDistance;
        this.particles = [];
        this.cracks = [];
        this.shieldLevel = 0;
        this.controlEffects = {
            movementLockedUntil: 0,
            slowUntil: 0,
            slowFactor: 1,
            dodgeDisabledUntil: 0,
            shieldRecoveryBlockedUntil: 0
        };
        this.canLamFreezeUntil = 0;
        this.canLamBurnUntil = 0;
        this.attackPattern = null;
        this.lastAttackAt = 0;
        this.proactiveAggroUntil = 0;
        this.nextProactiveAggroRollAt = 0;
        this.combatMode = 'CALM';
        this.hostileUntil = 0;
        this.leftCombatAt = 0;
        this.enragedAt = 0;
        this.enragedPattern = null;
        this.nextEnragedPatternRollAt = 0;

        // 1. KIỂM TRA SỐ LƯỢNG QUÁI VỪA SỨC HIỆN CÓ
        const playerRank = Input.rankIndex || 0;
        const targetCapIndex = this.getTargetRankCapIndex();
        const diffLimit = CONFIG.ENEMY.DIFF_LIMIT || 3;

        // Đếm xem trong mảng enemies hiện tại có bao nhiêu con quái mà người chơi đánh được
        // Lưu ý: Loại trừ chính bản thân con quái đang respawn này ra khỏi danh sách đếm
        let killableCount = 0;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e === this || !e.rankData) continue;

            const eRankIndex = Number.isInteger(e.rankIndex)
                ? e.rankIndex
                : this.getRankIndexById(e.rankData.id);

            if (eRankIndex >= 0 && (eRankIndex - playerRank) < diffLimit) {
                killableCount++;
                if (killableCount >= 2) break;
            }
        }

        // Nếu số lượng quái đánh được ít hơn 2, con này BẮT BUỘC phải là quái vừa sức
        const forceEasy = killableCount < 2;

        this.isElite = Math.random() < CONFIG.ENEMY.ELITE_CHANCE;
        let enemyRankIndex;

        if (forceEasy) {
            // 🟢 CHẾ ĐỘ CÂN BẰNG: Đảm bảo người chơi luôn có mục tiêu
            // Chọn rank từ [Player - 1] đến [Player + DiffLimit - 1]
            const maxOffset = diffLimit - 1;
            const minOffset = -1;
            const randomOffset = Math.floor(Math.random() * (maxOffset - minOffset + 1)) + minOffset;
            
            enemyRankIndex = Math.max(0, Math.min(targetCapIndex, playerRank + randomOffset));
            this.isElite = false; // Quái "cứu trợ" không nên là Tinh Anh để người chơi dễ thở
        } else if (this.isElite) {
            // 🔴 TINH ANH
            enemyRankIndex = Math.min(targetCapIndex, playerRank + 2);
        } else {
            // 🔵 NGẪU NHIÊN THEO KHU VỰC
            const { MIN_ID, MAX_ID } = CONFIG.ENEMY.SPAWN_RANK_RANGE;
            const rank = this.getRandomRankById(MIN_ID, MAX_ID);
            enemyRankIndex = this.getRankIndexById(rank ? rank.id : 1);
            if (enemyRankIndex === -1) enemyRankIndex = 0;
            enemyRankIndex = Math.min(targetCapIndex, enemyRankIndex);
        }

        // 2. CẬP NHẬT DỮ LIỆU RANK
        this.rankData = CONFIG.CULTIVATION.RANKS[enemyRankIndex];
        this.rankIndex = enemyRankIndex;
        this.rankName = (this.isElite ? "★ TINH ANH ★ " : "") + this.rankData.name;
        this.colors = [this.rankData.lightColor, this.rankData.color];

        // 3. THIẾT LẬP CHỈ SỐ SINH TỒN
        const realmScale = this.getMajorRealmScaleByRankId(this.rankData?.id);
        const runtimeMultipliers = CONFIG.ENEMY.RUNTIME_MULTIPLIERS || {};
        const hpMultiplier = Math.max(0.2, Number(runtimeMultipliers.hp) || 1);
        const damageMultiplier = Math.max(0.2, Number(runtimeMultipliers.damage) || 1);
        const baseRankHp = this.rankData.hp || 1000;
        this.damage = Math.max(1, Math.round((Number(this.rankData.damage) || 1) * realmScale * damageMultiplier));
        const eliteMult = this.isElite ? 4.0 : 1.0;
        this.maxHp = Math.floor(baseRankHp * realmScale * hpMultiplier * (1 + Math.random() * 0.05) * eliteMult);
        this.hp = this.maxHp;
        const vitality = Math.max(1, Math.round((this.maxHp / 18) * (this.isElite ? 1.28 : 1) * realmScale));
        const agility = Math.max(1, Math.round((this.rankData.speedMult || 1) * (this.isElite ? 30 : 22) * (0.9 + (realmScale * 0.18))));
        const dexterity = Math.max(1, Math.round((this.damage * 2.6 * realmScale) + (this.isElite ? 8 : 2)));
        const wisdom = Math.max(1, Math.round(((this.rankData.id || 1) * 1.6 * realmScale) + (this.isElite ? 8 : 0)));
        const luck = Math.max(1, Math.round((this.isElite ? 20 : 8) + ((this.rankData.id || 1) * 0.9)));
        this.attributeStats = {
            STR: Math.max(1, Math.round(this.damage * (this.isElite ? 2.4 : 1.8))),
            AGI: agility,
            DEX: dexterity,
            VIT: vitality,
            INT: wisdom,
            WIS: wisdom,
            LUK: luck
        };
        this.combatStats = {
            ATK: Math.max(1, Math.round(this.damage * (this.isElite ? 1.55 : 1.2))),
            DEF: Math.max(1, Math.round(vitality * 0.65)),
            MATK: Math.max(1, Math.round(wisdom * 1.1)),
            MDEF: Math.max(1, Math.round((wisdom * 0.55) + (vitality * 0.24))),
            CRIT: Math.max(0, Math.min(0.68, 0.03 + (luck * 0.0022))),
            CRIT_DMG: Math.max(1.35, Math.min(3, 1.45 + (luck * 0.011))),
            EVA: Math.max(0, Math.min(0.76, 0.03 + (agility * 0.0016) + (luck * 0.0006))),
            ACC: Math.max(0.25, Math.min(0.97, 0.72 + (dexterity * 0.0011))),
            SPD: Math.max(1, Math.round(agility * (this.isElite ? 1.2 : 1)))
        };
        this.baseCombatStats = { ...this.combatStats };
        this.baseDamage = this.damage;
        this.basicStats = {
            HP: this.hp,
            MAX_HP: this.maxHp,
            MP: Math.max(0, Math.round(this.rankData?.maxMana || 0)),
            MAX_MP: Math.max(0, Math.round(this.rankData?.maxMana || 0)),
            SP: Math.max(10, Math.round(this.combatStats.SPD * 1.2)),
            MAX_SP: Math.max(10, Math.round(this.combatStats.SPD * 1.2)),
            EXP: Math.max(1, Math.round(this.rankData?.expGive || 1)),
            LV: Number(this.rankData?.id) || 1
        };

        const eliteSizeMult = this.isElite ? 1.8 : 1.0;
        this.r = (CONFIG.ENEMY.BASE_SIZE.MIN + Math.random() * CONFIG.ENEMY.BASE_SIZE.VAR) * eliteSizeMult;

        this.hasShield = Math.random() < (CONFIG.ENEMY.SHIELD_CHANCE + (this.isElite ? 0.4 : 0));
        if (this.hasShield) {
            this.shieldHp = Math.floor(this.hp * (CONFIG.ENEMY.SHIELD_HP_RATIO || 0.5));
            this.maxShieldHp = this.shieldHp;
        }

        // 4. KHỞI TẠO DI CHUYỂN
        this.wanderSpeed = (this.isElite ? 0.8 : 0.4) * (this.rankData.speedMult || 1);
        this.baseWanderSpeed = this.wanderSpeed;
        
        // Cập nhật Icon
        if (CONFIG.ENEMY.ANIMALS) {
            const randomPath = CONFIG.ENEMY.ANIMALS[Math.floor(Math.random() * CONFIG.ENEMY.ANIMALS.length)];
            const iconKey = randomPath.split('/').pop().split('.')[0];
            this.animalKey = iconKey;
            this.icon = enemyIcons[iconKey];
        }

        this.dodgeChance = CONFIG.ENEMY.BASE_DODGE_CHANCE + (this.isElite ? CONFIG.ENEMY.ELITE_DODGE_BONUS : 0);
        // Có thể cộng thêm tỉ lệ dựa trên chênh lệch cảnh giới nếu muốn
        this.applyCombatModeStats();
    }

    getRandomRankById(minId, maxId) {
        const ranks = CONFIG.CULTIVATION.RANKS;
        const cappedMaxId = Math.min(maxId, this.getTargetRankCapId());

        let chosenRank = null;
        let candidateCount = 0;

        for (let i = 0; i < ranks.length; i++) {
            const rank = ranks[i];
            if (rank.id < minId || rank.id > cappedMaxId) continue;

            candidateCount++;
            if (Math.random() < (1 / candidateCount)) {
                chosenRank = rank;
            }
        }

        if (!chosenRank) {
            console.warn("Không tìm thấy cảnh giới trong khoảng id:", minId, cappedMaxId);
            return null;
        }

        return chosenRank;
    }

    updateMovement(scaleFactor) {
        const now = Date.now() * 0.001;
        
        // 1. Hiệu ứng trôi bồng bềnh (Floating)
        // Sử dụng nhiễu lượng giác để quái vật tự di chuyển nhẹ xung quanh vị trí gốc
        this.angle += Math.sin(now + this.floatOffset) * 0.02;
        
        const speed = this.wanderSpeed * scaleFactor;
        this.velocity.x = Math.cos(this.angle) * speed;
        this.velocity.y = Math.sin(this.angle) * speed;

        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // 2. Giới hạn vùng di chuyển (Boundary Check)
        // Nếu quái vật đi ra khỏi màn hình thì quay đầu lại
        const anchorX = Number.isFinite(Input?.x) ? Input.x : Camera.centerX;
        const anchorY = Number.isFinite(Input?.y) ? Input.y : Camera.centerY;
        const roamRadius = Math.max(window.innerWidth, window.innerHeight) * 2.4;
        const distanceToPlayer = Math.hypot(this.x - anchorX, this.y - anchorY);
        if (distanceToPlayer > roamRadius) {
            const targetAngle = Math.atan2(anchorY - this.y, anchorX - this.x);
            this.angle = targetAngle + random(-0.35, 0.35);
        }
    }

    generateCracks(level) {
        // Đảm bảo bán kính vết nứt khớp với bán kính vòng tròn khiên sẽ vẽ
        const shieldPadding = 12; // Tăng nhẹ padding để bao quát hơn
        const shieldR = this.r + shieldPadding; 
        const maxCrackLines = Math.max(12, parseInt(CONFIG.ENEMY.MAX_SHIELD_CRACK_LINES, 10) || 48);
        const maxRingCount = Math.max(1, parseInt(CONFIG.ENEMY.MAX_SHIELD_CRACK_RINGS, 10) || 4);
        const baseAngle = Math.random() * Math.PI * 2;
        const numRadial = Math.min(5 + level * 2, Math.max(6, Math.floor(maxCrackLines / 2)));
        const radialPoints = [];
        let crackCount = 0;

        this.cracks = []; // Đảm bảo mảng sạch

        for (let i = 0; i < numRadial; i++) {
            const angle = baseAngle + (i * Math.PI * 2) / numRadial;
            const points = [];
            const steps = 4;

            for (let j = 0; j <= steps; j++) {
                // Tính toán khoảng cách dựa trên shieldR đã định nghĩa
                const dist = (shieldR * j) / steps;
                const jitter = j === 0 ? 0 : (Math.random() - 0.5) * 0.2;
                points.push({
                    x: Math.cos(angle + jitter) * dist,
                    y: Math.sin(angle + jitter) * dist
                });
            }
            this.cracks.push(points);
            radialPoints.push(points);
            crackCount++;
        }

        const numRings = Math.min(2 + level, maxRingCount);
        for (let r = 1; r <= numRings; r++) {
            if (crackCount >= maxCrackLines) break;
            const ringDistIdx = Math.floor((radialPoints[0].length - 1) * (r / (numRings + 1)));

            for (let i = 0; i < radialPoints.length; i++) {
                if (crackCount >= maxCrackLines) break;
                const nextIdx = (i + 1) % radialPoints.length;
                const p1 = radialPoints[i][ringDistIdx];
                const p2 = radialPoints[nextIdx][ringDistIdx];

                if (Math.random() > 0.35) {
                    this.cracks.push([p1, p2]);
                    crackCount++;
                }
            }
        }
    }

    hit(sword) {
        if (this.hp <= 0) {
            this.respawn();
            return "killed";
        }

        const playerRankIndex = Input.rankIndex || 0;
        const enemyRankIndex = Number.isInteger(this.rankIndex)
            ? this.rankIndex
            : this.getRankIndexById(this.rankData?.id);
        const rankDiff = enemyRankIndex - playerRankIndex;
        const now = Date.now();
        const effectNow = performance.now();
        const dodgeSuppressed = effectNow < (this.controlEffects?.dodgeDisabledUntil || 0) || Boolean(sword?.ignoreDodge);
        const blindMissChance = Input?.getBlindMissChance ? Input.getBlindMissChance() : 0;

        if (blindMissChance > 0 && Math.random() < blindMissChance) {
            if (now - (this.lastNotifyTime || 0) > CONFIG.ENEMY.NOTIFY_COOLDOWN_MS) {
                showNotify("Mù loà: kiếm chiêu lệch hướng!", "#6ec5ff");
                this.lastNotifyTime = now;
            }
            return "missed";
        }

        // --- 1. LOGIC NÉ TRÁNH THEO % VÀ CHÊNH LỆCH CẢNH GIỚI ---
        // Tỉ lệ cơ bản (ví dụ 10%) + Tinh anh (15%) + Mỗi cấp chênh lệch (5%)
        let finalDodgeChance = (CONFIG.ENEMY.BASE_DODGE_CHANCE || 0.1) + (this.isElite ? (CONFIG.ENEMY.ELITE_DODGE_BONUS || 0.15) : 0);
        const enemyEva = Math.max(0, Math.min(0.76, Number(this.combatStats?.EVA) || 0));
        const playerAcc = Math.max(0.15, Math.min(0.98, Number(Input?.getPlayerCombatStats?.().ACC) || 0.8));
        finalDodgeChance += Math.max(0, enemyEva - (playerAcc * 0.82));
        
        // Cộng thêm né tránh nếu quái vật có cảnh giới cao hơn người chơi
        if (rankDiff > 0) {
            finalDodgeChance += rankDiff * (CONFIG.ENEMY.DODGE_PER_RANK_DIFF || 0.05);
        }

        // Giới hạn né tránh tối đa (ví dụ 80%) để không bị bất tử hoàn toàn theo kiểu né
        finalDodgeChance = Math.min(finalDodgeChance, CONFIG.ENEMY.MAX_DODGE_CHANCE || 0.8);

        if (!dodgeSuppressed && Math.random() < finalDodgeChance) {
            if (now - (this.lastNotifyTime || 0) > CONFIG.ENEMY.NOTIFY_COOLDOWN_MS) {
                showNotify("NÉ TRÁNH: Đối phương quá linh hoạt!", "#ffffff");
                this.lastNotifyTime = now;
            }
            // Hiệu ứng quái vật giật nhẹ khi né thành công
            this.x += (Math.random() - 0.5) * 20;
            this.y += (Math.random() - 0.5) * 20;
            
            return "missed"; // Trả về trạng thái hụt cho class Sword xử lý
        }

        // --- 2. TÍNH SÁT THƯƠNG CƠ BẢN (Nếu không né được) ---
        const playerStats = Input?.getPlayerCombatStats ? Input.getPlayerCombatStats() : null;
        const baseDamage = playerStats?.ATK || (CONFIG.CULTIVATION.RANKS[playerRankIndex]?.damage || 1);
        const swordMultiplier = sword?.getDamageMultiplier ? sword.getDamageMultiplier() : (sword?.powerPenalty || 1);
        const playerAttackMultiplier = Input?.getAttackMultiplier ? Input.getAttackMultiplier() : 1;
        const rawDamage = Math.ceil(baseDamage * swordMultiplier * playerAttackMultiplier);
        const enemyDef = Math.max(0, Number(this.combatStats?.DEF) || 0);
        let damage = Math.max(1, Math.ceil(rawDamage * (100 / (100 + enemyDef))));
        if (playerStats) {
            const critRate = Math.max(0, Math.min(0.75, Number(playerStats.CRIT) || 0));
            const critDmg = Math.max(1.2, Number(playerStats.CRIT_DMG) || 1.5);
            if (Math.random() < critRate) {
                damage = Math.max(1, Math.ceil(damage * critDmg));
            }
        }

        // --- 3. ÁP DỤNG LOGIC BẤT TỬ / GIẢM SÁT THƯƠNG ---
        if (rankDiff >= CONFIG.ENEMY.MAJOR_RANK_DIFF) {
            damage = 0; 
            if (now - (this.lastNotifyTime || 0) > CONFIG.ENEMY.NOTIFY_COOLDOWN_MS) {
                showNotify("BẤT TỬ: Tu vi quá chênh lệch!", "#ff0000");
                this.lastNotifyTime = now;
            }
        } else if (rankDiff >= CONFIG.ENEMY.DIFF_LIMIT) {
            damage = 1; 
            if (now - (this.lastNotifyTime || 0) > CONFIG.ENEMY.NOTIFY_COOLDOWN_MS) {
                showNotify("GIẢM SÁT THƯƠNG: Cấp bậc áp chế!", "#ffcc00");
                this.lastNotifyTime = now;
            }
        }

        this.lastHitTime = Date.now();
        this.hostileUntil = Math.max(
            this.hostileUntil || 0,
            performance.now() + Math.max(1200, Number(CONFIG.ENEMY?.BEHAVIOR?.AGGRO_DURATION_MS) || 3200)
        );
        this.setCombatMode('AGGRESSIVE');
        this.retaliateUntil = performance.now() + 4000;
        this.proactiveAggroUntil = Math.max(
            Number(this.proactiveAggroUntil) || 0,
            performance.now() + 4000
        );
        this.lastRetaliateAt = performance.now();

        // --- 4. XỬ LÝ KHIÊN ---
        if (this.hasShield && this.shieldHp > 0) {
            const playerShieldBreakMultiplier = Input?.getShieldBreakMultiplier ? Input.getShieldBreakMultiplier() : 1;
            const sourceShieldBreakMultiplier = Math.max(1, Number(sword?.shieldBreakMultiplier) || 1);
            const shieldBreakMultiplier = playerShieldBreakMultiplier * sourceShieldBreakMultiplier;
            const shieldDamage = damage > 0 ? Math.max(1, Math.ceil(damage * shieldBreakMultiplier)) : 0;
            this.shieldHp -= shieldDamage;
            
            let currentLevel = Math.floor(((this.maxShieldHp - this.shieldHp) / this.maxShieldHp) * 5);
            if (currentLevel > this.shieldLevel) {
                this.shieldLevel = currentLevel;
                this.cracks = []; 
                this.generateCracks(this.shieldLevel);
            }

            if (this.shieldHp <= 0) {
                this.hasShield = false;
                this.createShieldDebris();
            }

            if (Input?.triggerNguLoiThuatHitEffect) {
                Input.triggerNguLoiThuatHitEffect(this, 'shielded');
            }
            return "shielded"; 
        }

        // --- 5. TRỪ MÁU QUÁI ---
        this.hp -= damage;
        if (Input?.triggerNguLoiThuatHitEffect) {
            Input.triggerNguLoiThuatHitEffect(this, this.hp <= 0 ? 'kill' : 'hit');
        }
        if (this.basicStats) {
            this.basicStats.HP = Math.max(0, Math.round(this.hp));
        }

        if (this.hp <= 0) {
            const rewardMult = this.isElite ? CONFIG.ENEMY.ELITE_MULT : 1;
            const expGainMultiplier = Input?.getExpGainMultiplier ? Input.getExpGainMultiplier() : 1;
            const dropRateMultiplier = Input?.getDropRateMultiplier ? Input.getDropRateMultiplier() : 1;
            let expGain = Math.max(1, Math.round((this.rankData.expGive || 1) * rewardMult * expGainMultiplier));
            let manaGain = CONFIG.MANA.GAIN_KILL * rewardMult;

            if (this.isElite) showNotify("DIỆT TINH ANH: THU HOẠCH LỚN!", "#ffcc00");

            Input.updateCombo();
            Input.updateExp(expGain);
            Input.updateMana(manaGain);

            const pillDropChance = Math.min(1, (this.isElite ? CONFIG.PILL.ELITE_CHANCE : CONFIG.PILL.CHANCE) * dropRateMultiplier);
            const pillDropCount = this.isElite ? CONFIG.PILL.DROP_COUNT.ELITE : CONFIG.PILL.DROP_COUNT.NORMAL;

            if (Math.random() < pillDropChance) {
                for (let i = 0; i < pillDropCount; i++) {
                    pills.push(new Pill(this.x, this.y, Input.createRandomPillDropSpec(this.isElite, this)));
                }
            }

            const stoneDropChance = Math.min(1, (this.isElite ? CONFIG.SPIRIT_STONE.ELITE_CHANCE : CONFIG.SPIRIT_STONE.CHANCE) * dropRateMultiplier);
            const stoneDropCount = this.isElite ? CONFIG.SPIRIT_STONE.DROP_COUNT.ELITE : CONFIG.SPIRIT_STONE.DROP_COUNT.NORMAL;

            if (Math.random() < stoneDropChance) {
                for (let i = 0; i < stoneDropCount; i++) {
                    pills.push(new Pill(this.x, this.y, Input.createRandomSpiritStoneDropSpec(this.isElite, this)));
                }
            }

            if (CONFIG.INSECT && typeof Input?.createRandomInsectEggDropSpec === 'function') {
                const eggCfg = CONFIG.INSECT.EGG_DROP || {};
                const eggDropChance = Math.min(1, ((this.isElite ? eggCfg.ELITE_CHANCE : eggCfg.NORMAL_CHANCE) || 0) * dropRateMultiplier);
                const eggDropCount = this.isElite ? (eggCfg.ELITE_COUNT || 1) : (eggCfg.NORMAL_COUNT || 1);

                if (Math.random() < eggDropChance) {
                    for (let i = 0; i < eggDropCount; i++) {
                        pills.push(new Pill(this.x, this.y, Input.createRandomInsectEggDropSpec(this.isElite, this)));
                    }
                }
            }

            if (CONFIG.ITEMS?.MATERIALS && typeof Input?.createEnemyMaterialDropSpec === 'function') {
                const materialCfg = CONFIG.ITEMS.MATERIAL_DROP || {};
                const materialDropChance = Math.min(1, ((this.isElite ? materialCfg.ELITE_CHANCE : materialCfg.NORMAL_CHANCE) || 0) * dropRateMultiplier);
                const materialCountCfg = this.isElite ? materialCfg.ELITE_COUNT : materialCfg.NORMAL_COUNT;
                const minCount = Math.max(1, Math.floor(materialCountCfg?.MIN || 1));
                const maxCount = Math.max(minCount, Math.floor(materialCountCfg?.MAX || minCount));
                const materialDropCount = minCount + Math.floor(Math.random() * ((maxCount - minCount) + 1));

                if (Math.random() < materialDropChance) {
                    for (let i = 0; i < materialDropCount; i++) {
                        pills.push(new Pill(this.x, this.y, Input.createEnemyMaterialDropSpec(this, this.isElite)));
                    }
                }
            }

            if (typeof Input?.createGuaranteedMajorRealmDrops === 'function') {
                Input.createGuaranteedMajorRealmDrops(this).forEach(dropSpec => {
                    pills.push(new Pill(this.x, this.y, dropSpec));
                });
            }

            this.respawn();
            return "killed";

            // XỬ LÝ RƠI LINH ĐAN
            const pillCfg = CONFIG.PILL;
            const dropChance = this.isElite ? pillCfg.ELITE_CHANCE : pillCfg.CHANCE;

            if (Math.random() < dropChance) {
                const rates = this.isElite ? pillCfg.DROP_RATES.ELITE : pillCfg.DROP_RATES.NORMAL;
                const count = this.isElite ? pillCfg.DROP_COUNT.ELITE : pillCfg.DROP_COUNT.NORMAL;

                for (let i = 0; i < count; i++) {
                    let typeKey = 'LOW';
                    const rand = Math.random();
                    if (rand < rates.HIGH) typeKey = 'HIGH';
                    else if (rand < rates.HIGH + rates.MEDIUM) typeKey = 'MEDIUM';
                    else typeKey = 'LOW';
                    pills.push(new Pill(this.x, this.y, typeKey));
                }
                showNotify(this.isElite ? "Đại cơ duyên! Linh Đan xuất thế!" : "Thu hoạch Linh Đan",
                    this.isElite ? "#ffcc00" : "#00ffcc");
            }

            this.respawn();
            return "killed";
        }

        if (damage === 0) return "immune";
        return "hit";
    }

    drawShield(ctx, scaleFactor) {
        // Phải khớp hoàn toàn với số cộng thêm ở generateCracks (ví dụ +12)
        const shieldPadding = 12; 
        const shieldR = (this.r + shieldPadding) * scaleFactor;
        const pulse = Math.sin(Date.now() * 0.006) * 0.05 + 1.0; // Pulse nhẹ nhàng hơn

        ctx.save();
        
        // Vẽ quầng sáng nền cho khiên (giúp quái không bị "lòi" ra ngoài mắt thường)
        const shieldGlow = ctx.createRadialGradient(0, 0, this.r * scaleFactor, 0, 0, shieldR);
        shieldGlow.addColorStop(0, "rgba(140, 245, 255, 0)");
        shieldGlow.addColorStop(1, "rgba(140, 245, 255, 0.2)");
        ctx.fillStyle = shieldGlow;
        ctx.beginPath();
        ctx.arc(0, 0, shieldR * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Vẽ vòng ngoài
        ctx.beginPath();
        ctx.arc(0, 0, shieldR * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(140, 245, 255, ${0.6 * (2 - pulse)})`;
        ctx.lineWidth = 2 * scaleFactor;
        ctx.stroke();

        // Vẽ cracks
        if (this.cracks.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
            ctx.lineWidth = 1 * scaleFactor;
            this.cracks.forEach(pts => {
                if (pts.length < 2) return;
                // Tọa độ crack đã có sẵn r, chỉ cần nhân scaleFactor
                ctx.moveTo(pts[0].x * scaleFactor * pulse, pts[0].y * scaleFactor * pulse);
                for (let i = 1; i < pts.length; i++) {
                    ctx.lineTo(pts[i].x * scaleFactor * pulse, pts[i].y * scaleFactor * pulse);
                }
            });
            ctx.stroke();
        }
        ctx.restore();
    }

    createShieldDebris() {
        const conf = CONFIG.ENEMY.DEBRIS;
        for (let i = 0; i < conf.COUNT; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = random(conf.SPEED.MIN, conf.SPEED.MAX);

            // Đẩy thẳng vào mảng global để class Enemy không phải xử lý drawParticles nữa
            visualParticles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: random(conf.SIZE.MIN, conf.SIZE.MAX),
                life: 1.0,
                color: CONFIG.COLORS.ENEMY_PARTICLE,
                type: 'square' // Thêm flag để hàm animate biết cách vẽ hình vuông
            });
        }
    }

    updateShieldRecovery() {
        if (!this.hasShield || this.shieldHp <= 0) return;
        if (this.shieldHp >= this.maxShieldHp) return;
        if (performance.now() < (this.controlEffects?.shieldRecoveryBlockedUntil || 0)) return;

        const now = Date.now();
        const idleTime = now - this.lastHitTime;

        if (idleTime > CONFIG.ENEMY.RECOVERY_DELAY_MS) {
            this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp + this.maxShieldHp * CONFIG.ENEMY.RECOVERY_SPEED_PER_SEC);

            // Cập nhật lại vết nứt dựa trên máu khiên đã hồi phục
            let currentLevel = Math.floor(((this.maxShieldHp - this.shieldHp) / this.maxShieldHp) * 5);
            
            // Nếu máu khiên hồi đủ để giảm cấp độ nứt (ví dụ từ nứt độ 4 về độ 3)
            if (currentLevel < this.shieldLevel) {
                this.shieldLevel = currentLevel;
                this.cracks = [];
                if (this.shieldLevel > 0) {
                    this.generateCracks(this.shieldLevel);
                }
            }
        }
    }

    applyMovementLock(durationMs = 0) {
        const lockDuration = Math.max(0, Number(durationMs) || 0);
        this.controlEffects.movementLockedUntil = Math.max(this.controlEffects?.movementLockedUntil || 0, performance.now() + lockDuration);
    }

    applySlow(durationMs = 0, slowFactor = 1) {
        const slowDuration = Math.max(0, Number(durationMs) || 0);
        this.controlEffects.slowUntil = Math.max(this.controlEffects?.slowUntil || 0, performance.now() + slowDuration);
        this.controlEffects.slowFactor = Math.min(this.controlEffects?.slowFactor || 1, Math.max(0.08, Math.min(1, Number(slowFactor) || 1)));
    }

    suppressDodge(durationMs = 0) {
        const suppressDuration = Math.max(0, Number(durationMs) || 0);
        this.controlEffects.dodgeDisabledUntil = Math.max(this.controlEffects?.dodgeDisabledUntil || 0, performance.now() + suppressDuration);
    }

    blockShieldRecovery(durationMs = 0) {
        const blockDuration = Math.max(0, Number(durationMs) || 0);
        this.controlEffects.shieldRecoveryBlockedUntil = Math.max(this.controlEffects?.shieldRecoveryBlockedUntil || 0, performance.now() + blockDuration);
    }

    setCombatMode(mode) {
        const nextMode = mode === 'ENRAGED'
            ? 'ENRAGED'
            : mode === 'AGGRESSIVE'
                ? 'AGGRESSIVE'
                : 'CALM';
        if (this.combatMode === nextMode) return;
        this.combatMode = nextMode;
        this.applyCombatModeStats();
    }

    applyCombatModeStats() {
        const baseCombatStats = this.baseCombatStats || this.combatStats || {};
        const baseDamage = Math.max(1, Number(this.baseDamage) || Number(this.damage) || 1);
        const behaviorCfg = CONFIG.ENEMY?.BEHAVIOR || {};
        const enrageBuff = behaviorCfg.ENRAGE_BUFF || {};
        const isEnraged = this.combatMode === 'ENRAGED';
        const damageMult = isEnraged ? Math.max(1, Number(enrageBuff.DAMAGE_MULT) || 1) : 1;
        const defenseMult = isEnraged ? Math.max(1, Number(enrageBuff.DEFENSE_MULT) || 1) : 1;
        const speedMult = isEnraged ? Math.max(1, Number(enrageBuff.SPEED_MULT) || 1) : 1;

        this.damage = Math.max(1, Math.round(baseDamage * damageMult));
        this.wanderSpeed = Math.max(0.05, (this.baseWanderSpeed || this.wanderSpeed || 0.4) * speedMult);
        this.combatStats = {
            ...baseCombatStats,
            ATK: Math.max(1, Math.round((Number(baseCombatStats.ATK) || baseDamage) * damageMult)),
            DEF: Math.max(1, Math.round((Number(baseCombatStats.DEF) || 1) * defenseMult)),
            MDEF: Math.max(1, Math.round((Number(baseCombatStats.MDEF) || 1) * defenseMult)),
            SPD: Math.max(1, Math.round((Number(baseCombatStats.SPD) || 1) * speedMult))
        };
    }

    updateCombatMode(playerX, playerY, dt = 0.016) {
        const now = performance.now();
        const behaviorCfg = CONFIG.ENEMY?.BEHAVIOR || {};
        const enrageCfg = behaviorCfg.ENRAGE || {};
        const enrageThreshold = Math.max(0.05, Math.min(0.95, Number(enrageCfg.HP_THRESHOLD) || 0.35));
        const aggroDurationMs = Math.max(500, Number(behaviorCfg.AGGRO_DURATION_MS) || 3200);
        const calmHealPerSec = Math.max(0, Number(behaviorCfg.CALM_HEAL_PER_SEC) || 0.035);
        const hpRatio = this.maxHp > 0 ? this.hp / this.maxHp : 1;

        if (hpRatio <= enrageThreshold) {
            if (this.combatMode !== 'ENRAGED') {
                this.enragedAt = now;
            }
            this.hostileUntil = Math.max(this.hostileUntil || 0, now + aggroDurationMs);
            this.setCombatMode('ENRAGED');
            return;
        }

        if ((this.hostileUntil || 0) > now) {
            this.setCombatMode('AGGRESSIVE');
            return;
        }

        if (this.combatMode !== 'CALM') this.leftCombatAt = now;
        this.setCombatMode('CALM');
        if (this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + (this.maxHp * calmHealPerSec * Math.max(0.001, dt)));
            if (this.basicStats) this.basicStats.HP = Math.max(0, Math.round(this.hp));
        }
    }

    updateMovement(scaleFactor) {
        const now = Date.now() * 0.001;
        const effectNow = performance.now();
        const isMovementLocked = effectNow < (this.controlEffects?.movementLockedUntil || 0);
        const slowFactor = effectNow < (this.controlEffects?.slowUntil || 0)
            ? Math.max(0.08, Math.min(1, this.controlEffects?.slowFactor || 1))
            : 1;

        if (isMovementLocked) {
            this.velocity.x *= 0.72;
            this.velocity.y *= 0.72;
            return;
        }

        this.angle += Math.sin(now + this.floatOffset) * 0.02;

        const speed = this.wanderSpeed * slowFactor * scaleFactor;
        this.velocity.x = Math.cos(this.angle) * speed;
        this.velocity.y = Math.sin(this.angle) * speed;

        this.x += this.velocity.x;
        this.y += this.velocity.y;

        const anchorX = Number.isFinite(Input?.x) ? Input.x : Camera.centerX;
        const anchorY = Number.isFinite(Input?.y) ? Input.y : Camera.centerY;
        const roamRadius = Math.max(window.innerWidth, window.innerHeight) * 2.4;
        const distanceToPlayer = Math.hypot(this.x - anchorX, this.y - anchorY);
        if (distanceToPlayer > roamRadius) {
            const targetAngle = Math.atan2(anchorY - this.y, anchorX - this.x);
            this.angle = targetAngle + random(-0.35, 0.35);
        }
    }

    draw(ctx, scaleFactor) {
        // 1. CẬP NHẬT LOGIC: Chuyển động và Hồi khiên
        this.updateMovement(scaleFactor);
        this.updateShieldRecovery();

        const zoom = Math.max(0.001, Camera.currentZoom || 1);
        const visibleHalfWidth = window.innerWidth / (2 * zoom);
        const visibleHalfHeight = window.innerHeight / (2 * zoom);
        const visibleLeft = Camera.centerX - visibleHalfWidth;
        const visibleRight = Camera.centerX + visibleHalfWidth;
        const visibleTop = Camera.centerY - visibleHalfHeight;
        const visibleBottom = Camera.centerY + visibleHalfHeight;
        const margin = Math.max(140, this.r * 5);

        // Chỉ vẽ các quái trong vùng nhìn thấy để giảm lag khi zoom.
        if (
            this.x + margin < visibleLeft ||
            this.x - margin > visibleRight ||
            this.y + margin < visibleTop ||
            this.y - margin > visibleBottom
        ) {
            return;
        }
        
        // 2. TÍNH TOÁN HIỆU ỨNG SINH ĐỘNG
        const now = Date.now();
        // Nhịp thở: Co giãn nhẹ từ 0.95 đến 1.05
        const breathScale = 1 + Math.sin(now * 0.002 + this.floatOffset) * 0.05;
        const rankColor = this.rankData.color;

        ctx.save();
        
        // Di chuyển canvas đến vị trí của quái
        ctx.translate(this.x, this.y);

        // --- PHẦN 1: VẼ THÂN QUÁI (Có hiệu ứng co giãn nhịp thở) ---
        ctx.save();
        ctx.scale(breathScale, breathScale);

        this.drawParticles(ctx, scaleFactor);
        if (this.hasShield) this.drawShield(ctx, scaleFactor);
        this.drawBody(ctx, scaleFactor);
        this.drawCanLamStatus(ctx, scaleFactor);
        
        ctx.restore(); // Kết thúc scale cho phần thân

        // --- PHẦN 2: VẼ UI (Tên và Thanh máu - Không bị scale để tránh khó đọc) ---
        
        // 1. VẼ TÊN CẢNH GIỚI
        ctx.fillStyle = rankColor;
        ctx.font = `bold ${11 * scaleFactor}px "Segoe UI", Arial`;
        ctx.textAlign = "center";

        if (this.isElite) {
            ctx.shadowColor = rankColor;
            ctx.shadowBlur = 8 * scaleFactor;
        }

        const labelOffset = Math.min(this.r * 0.72, 42 * scaleFactor);
        const textY = -labelOffset - (this.hasShield ? 15 : 10) * scaleFactor;
        const combatSuffix = this.combatMode === 'ENRAGED' ? ' [CUỒNG NỘ]' : this.combatMode === 'AGGRESSIVE' ? ' [TẤN CÔNG]' : '';
        ctx.fillText(`${this.rankName}${combatSuffix}`, 0, textY);
        ctx.shadowBlur = 0; 

        // 2. VẼ THANH MÁU
        const barWidth = Math.max(26 * scaleFactor, Math.min(this.r * 1.15, 96 * scaleFactor));
        const barHeight = 4 * scaleFactor;
        const barY = textY + 5 * scaleFactor;

        // Nền thanh máu
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

        // Máu hiện tại
        const hpRatio = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = rankColor;
        ctx.fillRect(-barWidth / 2, barY, barWidth * hpRatio, barHeight);

        // Viền thanh máu
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 0.5 * scaleFactor;
        ctx.strokeRect(-barWidth / 2, barY, barWidth, barHeight);

        ctx.restore(); // Kết thúc toàn bộ hàm vẽ Enemy
    }

    drawCanLamStatus(ctx, scaleFactor) {
        const now = performance.now();
        const freezeUntil = Number(this.canLamFreezeUntil) || 0;
        const burnUntil = Number(this.canLamBurnUntil) || 0;
        if (now >= freezeUntil && now >= burnUntil) return;

        if (now < freezeUntil) {
            const freezeProgress = Math.max(0, Math.min(1, (freezeUntil - now) / 1300));
            const rx = this.r * 1.42 * scaleFactor;
            const ry = this.r * 1.88 * scaleFactor;
            const wobble = Math.sin((now * 0.0018) + this.floatOffset) * 0.06;
            const layerDepth = this.r * 0.22 * scaleFactor;
            const sealSpin = (now * 0.0009) + this.floatOffset;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.shadowBlur = 20 * scaleFactor;
            ctx.shadowColor = `rgba(76, 178, 255, ${(0.32 + (freezeProgress * 0.2)).toFixed(3)})`;

            // Vỏ chính: ellipsoid méo, không đối xứng
            ctx.beginPath();
            const points = 32;
            for (let i = 0; i <= points; i++) {
                const t = (i / points) * Math.PI * 2;
                const asym = 1
                    + (Math.sin((t * 3.1) + this.floatOffset) * 0.08)
                    + (Math.cos((t * 5.2) - this.floatOffset) * 0.05)
                    + wobble;
                const dent = 1 - (Math.max(0, Math.sin((t * 2.4) + 1.3)) * 0.06);
                const px = Math.cos(t) * rx * asym * dent;
                const py = Math.sin(t) * ry * (1 + (Math.sin((t * 1.7) - 0.8) * 0.05));
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();

            const shellGrad = ctx.createRadialGradient(
                -rx * 0.18,
                -ry * 0.24,
                ry * 0.08,
                0,
                0,
                ry * 1.15
            );
            shellGrad.addColorStop(0, `rgba(227, 250, 255, ${(0.18 + (freezeProgress * 0.14)).toFixed(3)})`);
            shellGrad.addColorStop(0.34, `rgba(120, 213, 255, ${(0.24 + (freezeProgress * 0.2)).toFixed(3)})`);
            shellGrad.addColorStop(0.72, `rgba(48, 124, 201, ${(0.28 + (freezeProgress * 0.24)).toFixed(3)})`);
            shellGrad.addColorStop(1, `rgba(18, 62, 122, ${(0.46 + (freezeProgress * 0.2)).toFixed(3)})`);
            ctx.fillStyle = shellGrad;
            ctx.fill();

            // "Niêm phong thời gian": vòng sáng mờ bên trong, vẫn thấy mục tiêu phía trong
            ctx.save();
            ctx.clip();
            for (let i = 0; i < 2; i++) {
                const ringRx = rx * (0.72 + (i * 0.18));
                const ringRy = ry * (0.68 + (i * 0.16));
                ctx.beginPath();
                ctx.ellipse(
                    Math.cos(sealSpin + i) * 2.5 * scaleFactor,
                    Math.sin(sealSpin + (i * 1.6)) * 2.2 * scaleFactor,
                    ringRx,
                    ringRy,
                    sealSpin * (i % 2 === 0 ? 1 : -1),
                    0,
                    Math.PI * 2
                );
                ctx.strokeStyle = `rgba(196, 244, 255, ${(0.08 + (freezeProgress * 0.09)).toFixed(3)})`;
                ctx.lineWidth = Math.max(0.8, 1.1 * scaleFactor);
                ctx.stroke();
            }

            const deepMist = ctx.createLinearGradient(0, -ry, 0, ry);
            deepMist.addColorStop(0, 'rgba(165, 235, 255, 0.02)');
            deepMist.addColorStop(0.52, `rgba(63, 141, 219, ${(0.12 + (freezeProgress * 0.08)).toFixed(3)})`);
            deepMist.addColorStop(1, `rgba(15, 52, 106, ${(0.22 + (freezeProgress * 0.1)).toFixed(3)})`);
            ctx.fillStyle = deepMist;
            ctx.fillRect(-rx * 1.3, -ry * 1.3, rx * 2.6, ry * 2.6);
            ctx.restore();

            // Lớp chiều sâu phía sau
            ctx.beginPath();
            ctx.ellipse(layerDepth * 0.45, -layerDepth * 0.35, rx * 0.92, ry * 0.95, 0.08, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(176, 234, 255, ${(0.2 + (freezeProgress * 0.16)).toFixed(3)})`;
            ctx.lineWidth = Math.max(0.8, 1.2 * scaleFactor);
            ctx.stroke();

            // Mép ngoài với gờ tinh thể nhô ra
            const spikeCount = 9;
            for (let i = 0; i < spikeCount; i++) {
                const t = (i / spikeCount) * Math.PI * 2 + (this.floatOffset * 0.08);
                const baseX = Math.cos(t) * rx * (0.96 + ((i % 2) * 0.05));
                const baseY = Math.sin(t) * ry * (0.94 + (((i + 1) % 2) * 0.06));
                const tipX = Math.cos(t) * rx * (1.14 + ((i % 3) * 0.05));
                const tipY = Math.sin(t) * ry * (1.16 + (((i + 1) % 3) * 0.04));
                const sideAngle = t + Math.PI / 2;
                const sideX = Math.cos(sideAngle) * this.r * 0.12 * scaleFactor;
                const sideY = Math.sin(sideAngle) * this.r * 0.12 * scaleFactor;

                ctx.beginPath();
                ctx.moveTo(baseX - sideX * 0.4, baseY - sideY * 0.4);
                ctx.lineTo(tipX, tipY);
                ctx.lineTo(baseX + sideX * 0.42, baseY + sideY * 0.42);
                ctx.closePath();
                ctx.fillStyle = `rgba(208, 246, 255, ${(0.22 + (freezeProgress * 0.18)).toFixed(3)})`;
                ctx.fill();
            }

            ctx.strokeStyle = `rgba(230, 252, 255, ${(0.34 + (freezeProgress * 0.24)).toFixed(3)})`;
            ctx.lineWidth = Math.max(1, 1.45 * scaleFactor);
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (now < burnUntil) {
            const burnProgress = Math.max(0, Math.min(1, (burnUntil - now) / 3000));
            const pulse = 0.74 + (Math.sin((now * 0.02) + this.floatOffset) * 0.16);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            const coreRadius = this.r * 1.12 * scaleFactor * pulse;
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 1.9);
            grad.addColorStop(0, `rgba(255, 247, 225, ${(0.6 + (burnProgress * 0.2)).toFixed(3)})`);
            grad.addColorStop(0.28, `rgba(255, 189, 120, ${(0.45 + (burnProgress * 0.2)).toFixed(3)})`);
            grad.addColorStop(0.6, `rgba(98, 211, 255, ${(0.35 + (burnProgress * 0.2)).toFixed(3)})`);
            grad.addColorStop(1, 'rgba(98, 211, 255, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, coreRadius * 1.9, 0, Math.PI * 2);
            ctx.fill();

            // Lưỡi lửa xanh-cam
            const flameCount = 5;
            for (let i = 0; i < flameCount; i++) {
                const angle = (-Math.PI * 0.55) + ((Math.PI * 1.1) * (i / Math.max(1, flameCount - 1)));
                const flicker = 0.88 + (Math.sin((now * 0.024) + (i * 1.8) + this.floatOffset) * 0.22);
                const flameLen = this.r * (0.92 + (i % 2 ? 0.24 : 0.12)) * scaleFactor * flicker;
                const flameWidth = this.r * 0.42 * scaleFactor;
                const baseX = Math.cos(angle) * this.r * 0.52 * scaleFactor;
                const baseY = Math.sin(angle) * this.r * 0.52 * scaleFactor;
                const tipX = Math.cos(angle) * (this.r * 0.52 * scaleFactor + flameLen);
                const tipY = Math.sin(angle) * (this.r * 0.52 * scaleFactor + flameLen) - (this.r * 0.22 * scaleFactor);

                ctx.beginPath();
                ctx.moveTo(baseX - (flameWidth * 0.32), baseY + (flameWidth * 0.22));
                ctx.quadraticCurveTo(baseX, baseY - flameWidth, tipX, tipY);
                ctx.quadraticCurveTo(baseX + (flameWidth * 0.38), baseY - (flameWidth * 0.12), baseX + (flameWidth * 0.26), baseY + (flameWidth * 0.2));
                ctx.closePath();
                ctx.fillStyle = i % 2 === 0
                    ? `rgba(101, 225, 255, ${(0.3 + (burnProgress * 0.26)).toFixed(3)})`
                    : `rgba(255, 173, 96, ${(0.28 + (burnProgress * 0.22)).toFixed(3)})`;
                ctx.fill();
            }
            ctx.restore();
        }
    }

    drawParticles(ctx, scaleFactor) {
        const decay = CONFIG.ENEMY.DEBRIS.LIFE_DECAY;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.life -= decay;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            ctx.save();
            ctx.translate(p.x * scaleFactor, p.y * scaleFactor);
            ctx.rotate(p.rotation += p.spin);
            ctx.globalAlpha = p.life;
            ctx.fillStyle = CONFIG.COLORS.ENEMY_PARTICLE;
            const s = p.size * scaleFactor;
            ctx.fillRect(-s / 2, -s / 2, s, s);
            ctx.restore();
        }
    }

    drawBody(ctx, scaleFactor) {
        if (!this.r || isNaN(this.r)) return; // Dòng bảo vệ: Nếu r lỗi thì không vẽ để tránh crash

        ctx.save();

        // --- HIỆU ỨNG PHÁT SÁNG CHO TINH ANH ---
        if (this.isElite) {
            ctx.shadowColor = "#ff3300";
            ctx.shadowBlur = 20 * scaleFactor;
            // Làm quái hơi rung rinh một chút
            ctx.translate((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
        }

        // 1. Vẽ hào quang (glow) quanh quái vật (Dùng màu Cảnh giới)
        const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * 1.3);
        glowGrad.addColorStop(0, this.colors[1] + "55"); // Màu rank mờ
        glowGrad.addColorStop(1, "transparent");

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, this.r * 1.3, 0, Math.PI * 2);
        ctx.fill();

        // 2. Vẽ Icon SVG
        if (this.icon && this.icon.complete && this.icon.naturalWidth > 0) {
            const drawSize = (this.r * 1.5) * scaleFactor;

            // Thêm hiệu ứng phát sáng nhẹ cho icon trắng
            ctx.shadowColor = this.colors[1];
            ctx.shadowBlur = 10 * scaleFactor;

            ctx.drawImage(
                this.icon,
                -drawSize / 2,
                -drawSize / 2,
                drawSize,
                drawSize
            );
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.r * scaleFactor, 0, Math.PI * 2);
            ctx.fillStyle = this.colors[1];
            ctx.fill();
        }

        ctx.restore();
    }
}
