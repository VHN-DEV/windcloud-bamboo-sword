const GameProgress = {
    storageKey: 'thanh_truc_progress',
    schemaVersion: 3,
    saveTimer: null,
    visibilityFlushTimer: null,
    visibilityFlushDelayMs: 80,
    isRestoring: false,
    isResetting: false,
    lifecycleBound: false,
    isDirty: false,

    getDefaultUniquePurchases() {
        return {
            THANH_LINH_KIEM_QUYET: false,
            DAI_CANH_KIEM_TRAN: false,
            CAN_LAM_BANG_DIEM: false,
            CHUONG_THIEN_BINH: false,
            KHU_TRUNG_THUAT: false,
            PHONG_LOI_SI: false,
            HUYET_SAC_PHI_PHONG: false,
            HU_THIEN_DINH: false,
            KY_TRUNG_BANG: false,
            LINH_THU_DAI: false,
            THAT_SAC_TRU_VAT_NANG: false,
            THAT_SAC_LINH_THU_DAI: false
        };
    },

    getDefaultCultivationArts() {
        return {
            THANH_LINH_KIEM_QUYET: false,
            DAI_CANH_KIEM_TRAN: false,
            CAN_LAM_BANG_DIEM: false,
            KHU_TRUNG_THUAT: false,
            PHONG_LOI_SI: false,
            HUYET_SAC_PHI_PHONG: false,
            HU_THIEN_DINH: false
        };
    },

    getDefaultActiveArtifacts() {
        return {
            CAN_LAM_BANG_DIEM: false,
            PHONG_LOI_SI: false,
            HUYET_SAC_PHI_PHONG: false,
            HU_THIEN_DINH: false
        };
    },

    getDefaultBonusStats() {
        return {
            attackPct: 0,
            maxManaFlat: 0,
            speedPct: 0,
            expGainPct: 0,
            manaRegenPct: 0,
            shieldBreakPct: 0,
            dropRatePct: 0
        };
    },

    getDefaultPhongLoiBlinkState() {
        return {
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
    },

    getDefaultBeastCare() {
        return {
            lastTickAt: performance.now(),
            lastAlertAt: 0
        };
    },

    getDefaultInventoryCapacity() {
        return Math.max(
            parseInt(CONFIG.ITEMS.INVENTORY_BASE_CAPACITY, 10) || 0,
            parseInt(CONFIG.ITEMS.INVENTORY_MIN_SLOTS, 10) || 16
        );
    },

    getDefaultBeastBagCapacity() {
        return Math.max(1, parseInt(CONFIG.INSECT?.STARTING_BEAST_BAG_CAPACITY, 10) || 6);
    },

    init() {
        this.bindLifecycle();
        const restored = this.load();

        if (!restored) {
            this.applyFreshStart();
        }

        return restored;
    },

    bindLifecycle() {
        if (this.lifecycleBound) return;

        const flush = () => {
            if (!this.isDirty) return;
            this.flushSave();
        };

        window.addEventListener('beforeunload', flush);
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.scheduleVisibilityFlush();
            }
        });

        this.lifecycleBound = true;
    },

    sanitizeBooleanMap(source, defaults = {}) {
        const safeSource = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
        const result = { ...defaults };

        Object.keys(safeSource).forEach(key => {
            result[key] = Boolean(safeSource[key]);
        });

        return result;
    },

    sanitizeNumberMap(source, { min = 0, max = Number.POSITIVE_INFINITY, integer = true } = {}) {
        const safeSource = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
        const result = {};

        Object.entries(safeSource).forEach(([key, value]) => {
            const rawValue = Number(value);
            if (!Number.isFinite(rawValue)) return;

            const normalizedValue = integer ? Math.floor(rawValue) : rawValue;
            const clampedValue = Math.max(min, Math.min(max, normalizedValue));
            if (clampedValue > 0 || min < 0) {
                result[key] = clampedValue;
            }
        });

        return result;
    },

    sanitizeInventory(source) {
        const safeSource = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
        const inventory = {};

        Object.entries(safeSource).forEach(([itemKey, entry]) => {
            if (!entry || typeof entry !== 'object') return;

            const count = Math.max(0, Math.floor(Number(entry.count) || 0));
            if (!count) return;

            inventory[itemKey] = {
                key: String(entry.key || itemKey),
                kind: entry.kind || 'PILL',
                category: entry.category || 'EXP',
                quality: entry.quality || 'LOW',
                specialKey: entry.specialKey || null,
                realmKey: entry.realmKey || null,
                realmName: entry.realmName || null,
                uniqueKey: entry.uniqueKey || null,
                speciesKey: entry.speciesKey || null,
                materialKey: entry.materialKey || null,
                instanceKey: entry.instanceKey || null,
                source: typeof entry.source === 'string' ? entry.source : null,
                nurtureYears: Math.max(0, Math.floor(Number(entry.nurtureYears) || 0)),
                nurtureProgressMs: Math.max(0, Math.floor(Number(entry.nurtureProgressMs) || 0)),
                isNurturing: Boolean(entry.isNurturing),
                refineYears: Math.max(0, Math.floor(Number(entry.refineYears) || 0)),
                powerRating: Math.max(0, Math.floor(Number(entry.powerRating) || 0)),
                sellPriceLowStone: Math.max(0, Math.floor(Number(entry.sellPriceLowStone) || 0)),
                maxDurability: Math.max(0, Math.floor(Number(entry.maxDurability) || 0)),
                durability: Math.max(0, Math.floor(Number(entry.durability) || 0)),
                breakWear: Math.max(0, Math.floor(Number(entry.breakWear) || 0)),
                breakCount: Math.max(0, Math.floor(Number(entry.breakCount) || 0)),
                equippedAt: Math.max(0, Math.floor(Number(entry.equippedAt) || 0)),
                count
            };
        });

        return inventory;
    },

    sanitizeSwordArtifacts(source) {
        const safeSource = Array.isArray(source) ? source : [];

        return safeSource
            .filter(entry => entry && typeof entry === 'object')
            .map(entry => {
                const instanceKey = String(entry.instanceKey || entry.id || '').trim();
                if (!instanceKey) return null;

                return {
                    instanceKey,
                    source: typeof entry.source === 'string' ? entry.source : 'SHOP',
                    refineYears: Math.max(0, Math.floor(Number(entry.refineYears) || 0)),
                    powerRating: Math.max(0, Math.floor(Number(entry.powerRating) || 0)),
                    sellPriceLowStone: Math.max(0, Math.floor(Number(entry.sellPriceLowStone) || 0)),
                    maxDurability: Math.max(0, Math.floor(Number(entry.maxDurability) || 0)),
                    durability: Math.max(0, Math.floor(Number(entry.durability) || 0)),
                    breakWear: Math.max(0, Math.floor(Number(entry.breakWear) || 0)),
                    breakCount: Math.max(0, Math.floor(Number(entry.breakCount) || 0)),
                    equippedAt: Math.max(0, Math.floor(Number(entry.equippedAt) || 0))
                };
            })
            .filter(Boolean);
    },

    sanitizeInsectColonies(source) {
        const safeSource = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
        const colonies = {};

        Object.entries(safeSource).forEach(([speciesKey, colony]) => {
            if (!colony || typeof colony !== 'object') return;

            colonies[speciesKey] = {
                male: Math.max(0, Math.floor(Number(colony.male) || 0)),
                female: Math.max(0, Math.floor(Number(colony.female) || 0)),
                leaderGender: colony.leaderGender === 'FEMALE' ? 'FEMALE' : 'MALE',
                leaderPower: Math.max(0, Number(colony.leaderPower) || 0)
            };
        });

        return colonies;
    },

    sanitizeNestedNumberMap(source) {
        const safeSource = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
        const result = {};

        Object.entries(safeSource).forEach(([bucketKey, bucketValue]) => {
            if (!bucketValue || typeof bucketValue !== 'object' || Array.isArray(bucketValue)) return;

            const normalizedBucket = this.sanitizeNumberMap(bucketValue);
            if (Object.keys(normalizedBucket).length) {
                result[bucketKey] = normalizedBucket;
            }
        });

        return result;
    },

    createSnapshot() {
        return {
            version: this.schemaVersion,
            savedAt: new Date().toISOString(),
            rankIndex: Input.rankIndex,
            exp: Input.exp,
            mana: Input.mana,
            hp: Input.hp,
            rage: Input.rage,
            inventory: Input.inventory,
            inventoryCapacity: Input.inventoryCapacity,
            spiritStones: Input.spiritStones,
            playerName: Input.playerName,
            playerAvatarInitials: Input.playerAvatarInitials,
            bondedSwordCount: Input.getBondedSwordCount(),
            equippedSwordArtifacts: typeof Input.getEquippedSwordArtifactSnapshot === 'function'
                ? Input.getEquippedSwordArtifactSnapshot()
                : [],
            attackMode: Input.attackMode,
            selectedInventoryTab: Input.selectedInventoryTab,
            selectedBeastBagTab: Input.selectedBeastBagTab,
            uniquePurchases: Input.uniquePurchases,
            cultivationArts: Input.cultivationArts,
            activeArtifacts: Input.activeArtifacts,
            phongLoiBlinkEnabled: Boolean(Input.phongLoiBlink?.enabled),
            specialAuraMode: Input.specialAuraExpiresAt === Number.POSITIVE_INFINITY ? Input.specialAuraMode : null,
            insectEggs: Input.insectEggs,
            tamedInsects: Input.tamedInsects,
            insectColonies: Input.insectColonies,
            insectSatiety: Input.insectSatiety,
            discoveredInsects: Input.discoveredInsects,
            insectCombatRoster: Input.insectCombatRoster,
            insectHabitats: Input.insectHabitats,
            insectHabitatCapacities: Input.insectHabitatCapacities,
            beastFoodStorage: Input.beastFoodStorage,
            beastBagCapacity: Input.beastBagCapacity,
            beastBagCapacityMigrated: Input.beastBagCapacityMigrated,
            bonusStats: Input.bonusStats,
            breakthroughBonus: Input.breakthroughBonus,
            isReadyToBreak: Input.isReadyToBreak,
            chuongThienBinhCooldownEndsAt: Math.max(0, Math.floor(Number(Input.chuongThienBinhCooldownEndsAt) || 0))
        };
    },

    saveNow() {
        if (this.isRestoring || this.isResetting) return false;
        if (!this.isDirty) return true;

        try {
            localStorage.setItem(this.storageKey, serializeForStorage(this.createSnapshot()));
            this.isDirty = false;
            return true;
        } catch (error) {
            console.error('Không thể lưu tiến trình tu luyện:', error);
            return false;
        }
    },

    requestSave({ immediate = false } = {}) {
        if (this.isRestoring || this.isResetting) return false;
        this.isDirty = true;

        if (immediate) {
            return this.flushSave();
        }

        if (this.saveTimer) {
            return true;
        }

        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this.saveNow();
        }, 1200);

        return true;
    },

    scheduleVisibilityFlush() {
        if (this.isRestoring || this.isResetting || !this.isDirty || this.visibilityFlushTimer) return false;

        this.visibilityFlushTimer = setTimeout(() => {
            this.visibilityFlushTimer = null;
            this.flushSave();
        }, this.visibilityFlushDelayMs);

        return true;
    },

    flushSave() {
        if (this.visibilityFlushTimer) {
            clearTimeout(this.visibilityFlushTimer);
            this.visibilityFlushTimer = null;
        }
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }

        return this.saveNow();
    },

    clearStored() {
        if (this.visibilityFlushTimer) {
            clearTimeout(this.visibilityFlushTimer);
            this.visibilityFlushTimer = null;
        }
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }

        localStorage.removeItem(this.storageKey);
        this.isDirty = false;
    },

    applyFreshStart() {
        this.isRestoring = true;

        try {
            Input.rankIndex = 0;
            Input.exp = 0;
            Input.inventory = {};
            Input.inventoryCapacity = this.getDefaultInventoryCapacity();
            Input.spiritStones = getStartingSpiritStoneCounts();
            Input.playerName = 'Thanh Trúc Kiếm Chủ';
            Input.playerAvatarInitials = 'TT';
            Input.bondedSwordCount = 0;
            Input.equippedSwordArtifacts = [];
            Input.attackMode = 'BASE';
            Input.selectedInventoryTab = 'items';
            Input.selectedBeastBagTab = 'all';
            Input.uniquePurchases = this.getDefaultUniquePurchases();
            Input.cultivationArts = this.getDefaultCultivationArts();
            Input.activeArtifacts = this.getDefaultActiveArtifacts();
            Input.phongLoiBlink = this.getDefaultPhongLoiBlinkState();
            if (typeof Input.ensureHuThienDinhShieldState === 'function') {
                Input.ensureHuThienDinhShieldState();
                Input.refreshHuThienDinhShield({ refill: true });
            }
            Input.insectEggs = {};
            Input.tamedInsects = {};
            Input.insectColonies = {};
            Input.insectSatiety = {};
            Input.discoveredInsects = {};
            Input.insectCombatRoster = {};
            Input.insectHabitats = {};
            Input.insectHabitatCapacities = {};
            Input.beastFoodStorage = {};
            Input.beastBagCapacity = this.getDefaultBeastBagCapacity();
            Input.beastBagCapacityMigrated = false;
            Input.beastCare = this.getDefaultBeastCare();
            Input.bonusStats = this.getDefaultBonusStats();
            Input.breakthroughBonus = 0;
            Input.isReadyToBreak = false;
            Input.chuongThienBinhCooldownEndsAt = 0;
            Input.combo = 0;
            Input.rage = 0;
            Input.maxRage = Math.max(1, parseInt(CONFIG.ULTIMATE.MAX_RAGE, 10) || 100);
            Input.lastManaRegenTick = performance.now();
            Input.syncVitalStats();
            Input.hp = Input.maxHp;
            Input.clearNegativeStatuses();
            Input.clearSpecialPillState();
            Input.activeEffects = [];
            Input.isUltMode = false;
            Input.ultTimeoutId = null;
            Input.ultimatePhase = 'idle';
            Input.ultimatePhaseStartedAt = 0;
            Input.ultimateCoreIndex = -1;
            Input.ultimateMode = null;
            Input.clearInsectUltimateState();
            Input.resetAttackState();
            Input.stopMoveJoystick();
            Input.stopTouchCursor();
            Input.syncDerivedStats();
            Input.mana = Input.maxMana;
            Input.ensureBeastFoodStorageShape();
            Input.ensureInsectHabitatCapacities();
        } finally {
            this.isRestoring = false;
        }
    },

    load() {
        const savedData = localStorage.getItem(this.storageKey);
        if (!savedData) return false;

        this.isRestoring = true;

        try {
            const parsed = parseStoredJson(savedData);
            const rankCount = Math.max(1, CONFIG.CULTIVATION.RANKS.length);

            Input.rankIndex = clampNumber(Math.floor(Number(parsed.rankIndex) || 0), 0, rankCount - 1);
            Input.inventory = this.sanitizeInventory(parsed.inventory);
            Input.inventoryCapacity = Math.max(this.getDefaultInventoryCapacity(), Math.floor(Number(parsed.inventoryCapacity) || 0));

            const defaultStones = getStartingSpiritStoneCounts();
            const savedStones = this.sanitizeNumberMap(parsed.spiritStones);
            Input.spiritStones = {
                LOW: Math.max(0, Math.floor(savedStones.LOW ?? defaultStones.LOW ?? 0)),
                MEDIUM: Math.max(0, Math.floor(savedStones.MEDIUM ?? defaultStones.MEDIUM ?? 0)),
                HIGH: Math.max(0, Math.floor(savedStones.HIGH ?? defaultStones.HIGH ?? 0)),
                SUPREME: Math.max(0, Math.floor(savedStones.SUPREME ?? defaultStones.SUPREME ?? 0))
            };

            Input.playerName = typeof parsed.playerName === 'string' && parsed.playerName.trim()
                ? parsed.playerName.trim()
                : 'Thanh Trúc Kiếm Chủ';
            Input.playerAvatarInitials = typeof parsed.playerAvatarInitials === 'string' && parsed.playerAvatarInitials.trim()
                ? parsed.playerAvatarInitials.trim().slice(0, 2).toUpperCase()
                : 'TT';
            const hasExplicitBondedSwordCount = Object.prototype.hasOwnProperty.call(parsed || {}, 'bondedSwordCount');
            Input.bondedSwordCount = Math.max(
                0,
                Math.floor(
                    hasExplicitBondedSwordCount
                        ? (Number(parsed.bondedSwordCount) || 0)
                        : (parsed?.cultivationArts?.DAI_CANH_KIEM_TRAN ? getConfiguredSwordCount() : 0)
                )
            );
            Input.equippedSwordArtifacts = this.sanitizeSwordArtifacts(parsed.equippedSwordArtifacts);
            Input.attackMode = parsed.attackMode === 'INSECT' || parsed.attackMode === 'SWORD' ? parsed.attackMode : 'BASE';
            Input.selectedInventoryTab = ['items', 'stones', 'beasts'].includes(parsed.selectedInventoryTab) ? parsed.selectedInventoryTab : 'items';
            Input.selectedBeastBagTab = typeof parsed.selectedBeastBagTab === 'string' && parsed.selectedBeastBagTab.trim()
                ? parsed.selectedBeastBagTab
                : 'all';
            Input.uniquePurchases = this.sanitizeBooleanMap(parsed.uniquePurchases, this.getDefaultUniquePurchases());
            Input.cultivationArts = this.sanitizeBooleanMap(parsed.cultivationArts, this.getDefaultCultivationArts());
            Input.restorePendingSecretArts();
            Input.activeArtifacts = this.sanitizeBooleanMap(parsed.activeArtifacts, this.getDefaultActiveArtifacts());
            Input.phongLoiBlink = this.getDefaultPhongLoiBlinkState();
            Input.insectEggs = this.sanitizeNumberMap(parsed.insectEggs);
            Input.tamedInsects = this.sanitizeNumberMap(parsed.tamedInsects);
            Input.insectColonies = this.sanitizeInsectColonies(parsed.insectColonies);
            Input.insectSatiety = this.sanitizeNumberMap(parsed.insectSatiety);
            Input.discoveredInsects = this.sanitizeBooleanMap(parsed.discoveredInsects);
            Input.insectCombatRoster = this.sanitizeBooleanMap(parsed.insectCombatRoster);
            Input.insectHabitats = this.sanitizeBooleanMap(parsed.insectHabitats);
            Input.insectHabitatCapacities = this.sanitizeNumberMap(parsed.insectHabitatCapacities);
            Input.beastFoodStorage = this.sanitizeNestedNumberMap(parsed.beastFoodStorage);
            Input.beastBagCapacity = Math.max(this.getDefaultBeastBagCapacity(), Math.floor(Number(parsed.beastBagCapacity) || 0));
            Input.beastBagCapacityMigrated = Boolean(parsed.beastBagCapacityMigrated);
            Input.beastCare = this.getDefaultBeastCare();
            Input.bonusStats = {
                ...this.getDefaultBonusStats(),
                ...this.sanitizeNumberMap(parsed.bonusStats, { min: 0, integer: false })
            };
            Input.breakthroughBonus = Math.max(0, Number(parsed.breakthroughBonus) || 0);
            Input.chuongThienBinhCooldownEndsAt = Math.max(0, Math.floor(Number(parsed.chuongThienBinhCooldownEndsAt) || 0));
            Input.combo = 0;
            Input.rage = Math.max(0, Number(parsed.rage) || 0);
            Input.maxRage = Math.max(1, parseInt(CONFIG.ULTIMATE.MAX_RAGE, 10) || 100);
            Input.lastManaRegenTick = performance.now();
            Input.syncVitalStats();
            Input.hp = Math.max(1, Math.min(Input.maxHp, Number(parsed.hp) || Input.maxHp));
            Input.clearNegativeStatuses();
            Input.clearSpecialPillState();
            if (typeof parsed.specialAuraMode === 'string' && parsed.specialAuraMode) {
                Input.setSpecialAura(parsed.specialAuraMode);
            }
            Input.activeEffects = [];
            Input.isUltMode = false;
            Input.ultTimeoutId = null;
            Input.ultimatePhase = 'idle';
            Input.ultimatePhaseStartedAt = 0;
            Input.ultimateCoreIndex = -1;
            Input.ultimateMode = null;
            Input.clearInsectUltimateState();
            Input.resetAttackState();
            Input.stopMoveJoystick();
            Input.stopTouchCursor();
            Input.syncDerivedStats();

            const currentRank = Input.getCurrentRank();
            if (currentRank?.infiniteStats || Input.rankIndex >= Input.getMaxRankIndex()) {
                Input.exp = currentRank?.exp || 0;
                Input.isReadyToBreak = false;
            } else {
                const overflowLimit = Math.max(0, (currentRank?.exp || 0) * (CONFIG.CULTIVATION.OVERFLOW_LIMIT || 1.2));
                Input.exp = Math.max(0, Math.min(overflowLimit, Number(parsed.exp) || 0));
                Input.isReadyToBreak = Boolean(parsed.isReadyToBreak) || Input.exp >= Math.max(0, Number(currentRank?.exp) || 0);
            }

            Input.mana = currentRank?.infiniteStats
                ? Input.maxMana
                : clampNumber(
                    typeof parsed.mana === 'number' ? parsed.mana : Input.maxMana,
                    0,
                    Input.maxMana
                );
            Input.rage = clampNumber(Input.rage, 0, Input.maxRage);
            Input.ensureBeastFoodStorageShape();
            Input.ensureInsectHabitatCapacities();
            if (typeof Input.ensureSwordArtifactState === 'function') {
                Input.ensureSwordArtifactState();
            }
            Input.syncDaiCanhKiemTranProgress();
            Object.keys(Input.tamedInsects || {}).forEach(speciesKey => {
                Input.ensureInsectColony(speciesKey);
            });

            if (Input.attackMode === 'SWORD' && !Input.canDeployDaiCanhKiemTran()) {
                Input.attackMode = 'BASE';
            }
            if (Input.attackMode === 'INSECT' && !Input.canUseInsectAttackMode()) {
                Input.attackMode = 'BASE';
            }

            Object.keys(Input.activeArtifacts || {}).forEach(uniqueKey => {
                if (!Input.hasArtifactUnlocked(uniqueKey)) {
                    Input.activeArtifacts[uniqueKey] = false;
                }
            });
            if (typeof Input.refreshHuThienDinhShield === 'function') {
                Input.refreshHuThienDinhShield({ refill: true });
            }

            Input.phongLoiBlink.enabled = Boolean(parsed.phongLoiBlinkEnabled) && Input.isArtifactDeployed('PHONG_LOI_SI');
            Input.ensureValidBeastBagTab();
            return true;
        } catch (error) {
            console.error('Không thể khôi phục tiến trình tu luyện:', error);
            this.clearStored();
            return false;
        } finally {
            this.isRestoring = false;
        }
    },

    reset() {
        this.isResetting = true;
        this.clearStored();
        showNotify('Tiến trình tu luyện đã được xóa, giới vực sẽ tải lại.', '#ff8a80');
        location.reload();
    }
};
