Object.assign(Input, {
    getCombatReadyInsectCount() {
        return this.getCombatReadyInsectSpeciesKeys().reduce((total, speciesKey) => {
            return total + Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
        }, 0);
    },

    getReservedInsectCount() {
        return Math.max(0, this.getTotalTamedInsectCount() - this.getCombatReadyInsectCount());
    },

    getInsectCombatRoster() {
        return this.getInsectSpeciesEntries()
            .filter(([speciesKey]) => (this.tamedInsects?.[speciesKey] || 0) > 0)
            .map(([speciesKey, species]) => {
                const profile = this.getInsectCombatProfile(speciesKey);
                const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
                const enabled = this.isInsectSpeciesEnabledForCombat(speciesKey);

                return {
                    speciesKey,
                    name: species?.name || speciesKey,
                    count,
                    enabled,
                    accent: species?.color || '#79ffd4',
                    note: profile.summary,
                    modeLabel: enabled ? 'Xuất trận' : 'Dưỡng đàn'
                };
            });
    },

    getBeastSummary() {
        const totalEggs = this.getTotalEggCount();
        const totalBeasts = this.getTotalTamedInsectCount();
        const capacity = this.getBeastBagCapacity();
        const discoveredCount = Object.keys(this.discoveredInsects || {}).filter(key => this.discoveredInsects[key]).length;
        const speciesTotal = this.getInsectSpeciesEntries().length;
        const activeSpeciesKeys = this.getActiveInsectSpeciesKeys();
        const manualCareSpeciesKeys = activeSpeciesKeys.filter(speciesKey => this.needsSpeciesManualFeeding(speciesKey));
        const safeSpeciesCount = activeSpeciesKeys.filter(speciesKey => this.hasInsectHabitat(speciesKey)).length;
        const foodStock = this.getTotalFoodNutritionAvailable();
        const foodDemand = manualCareSpeciesKeys.reduce((total, speciesKey) => total + this.getSpeciesFoodDemand(speciesKey), 0);
        const foodCycles = foodDemand > 0 ? Math.floor(foodStock / foodDemand) : Number.POSITIVE_INFINITY;
        const reproductiveSpeciesCount = activeSpeciesKeys.filter(speciesKey => this.getSpeciesCareStatus(speciesKey).canReproduce).length;

        return {
            totalEggs,
            totalBeasts,
            capacity,
            freeSlots: Math.max(0, capacity - totalBeasts),
            discoveredCount,
            speciesTotal,
            usageRatio: Number.isFinite(capacity) && capacity > 0 ? (totalBeasts / capacity) : 0,
            foodStock,
            foodDemand,
            foodCycles,
            safeSpeciesCount,
            reproductiveSpeciesCount,
            manualCareSpeciesCount: manualCareSpeciesKeys.length,
            rainbowSpeciesCount: Math.max(0, activeSpeciesKeys.length - manualCareSpeciesKeys.length)
        };
    },

    getBeastBagTabs() {
        const tabs = [
            {
                key: 'all',
                label: 'Tổng đàn',
                note: `${formatNumber(this.getTotalTamedInsectCount())} linh trùng`
            }
        ];

        if (this.hasSevenColorSpiritBag()) {
            return tabs;
        }

        const dedicatedSpeciesKeys = Object.keys(this.insectHabitats || {})
            .filter(speciesKey => this.insectHabitats[speciesKey] && this.getInsectSpecies(speciesKey));

        dedicatedSpeciesKeys
            .sort((a, b) => {
                const speciesA = this.getInsectSpecies(a);
                const speciesB = this.getInsectSpecies(b);
                return (speciesA?.name || a).localeCompare(speciesB?.name || b, 'vi');
            })
            .forEach(speciesKey => {
                const species = this.getInsectSpecies(speciesKey);
                const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
                const eggCount = Math.max(0, Math.floor(this.insectEggs?.[speciesKey] || 0));
                const capacity = this.getBeastBagCapacity(speciesKey);
                const capacityText = Number.isFinite(capacity)
                    ? `${formatNumber(count)}/${formatNumber(capacity)} ô`
                    : `${formatNumber(count)}/&infin; ô`;
                const noteParts = [capacityText, 'Ô thức ăn riêng'];
                if (eggCount > 0) noteParts.push(`${formatNumber(eggCount)} trứng`);
                tabs.push({
                    key: `species:${speciesKey}`,
                    label: species?.name || speciesKey,
                    note: noteParts.join(' | ')
                });
            });

        return tabs;
    },

    getBeastTabSpeciesKeys(tabKey = this.selectedBeastBagTab || 'all') {
        const safeTabKey = tabKey || 'all';
        if (safeTabKey === 'all') {
            return this.getInsectSpeciesEntries().map(([speciesKey]) => speciesKey);
        }

        if (safeTabKey === 'rainbow') {
            return this.getInsectSpeciesEntries()
                .map(([speciesKey]) => speciesKey)
                .filter(speciesKey => this.getSpeciesHabitatKey(speciesKey) === 'RAINBOW');
        }

        if (safeTabKey.startsWith('species:')) {
            const speciesKey = safeTabKey.split(':')[1] || '';
            return speciesKey && this.getInsectSpecies(speciesKey) ? [speciesKey] : [];
        }

        return [];
    },

    shouldShowBeastFeedPanel(tabKey = this.selectedBeastBagTab || 'all') {
        if (this.hasSevenColorSpiritBag()) return true;
        return tabKey === 'rainbow' || String(tabKey || '').startsWith('species:');
    },

    ensureValidBeastBagTab() {
        if (this.hasSevenColorSpiritBag()) {
            this.selectedBeastBagTab = 'all';
            return this.selectedBeastBagTab;
        }

        const tabs = this.getBeastBagTabs();
        if (!tabs.some(tab => tab.key === this.selectedBeastBagTab)) {
            this.selectedBeastBagTab = 'all';
        }

        return this.selectedBeastBagTab;
    },

    hasUniquePurchase(key) {
        return Boolean(this.uniquePurchases?.[key]);
    },

    markUniquePurchase(key) {
        if (!key) return false;
        if (!this.uniquePurchases) this.uniquePurchases = {};
        this.uniquePurchases[key] = true;
        return true;
    },

    hasCultivationArt(key) {
        return Boolean(this.cultivationArts?.[key]);
    },

    unlockCultivationArt(key) {
        if (!key) return false;
        if (!this.cultivationArts) this.cultivationArts = {};
        this.cultivationArts[key] = true;
        return true;
    },

    getInventoryEntryByUniqueKey(uniqueKey, categories = null) {
        if (!uniqueKey) return null;

        const allowedCategories = Array.isArray(categories) && categories.length
            ? new Set(categories)
            : null;

        return Object.values(this.inventory || {}).find(item => {
            if (!item || item.uniqueKey !== uniqueKey || item.count <= 0) return false;
            return !allowedCategories || allowedCategories.has(item.category);
        }) || null;
    },

    ensureUniqueInventoryEntry(spec, count = 1) {
        const safeCount = Math.max(1, Math.floor(Number(count) || 0));
        const itemKey = this.buildInventoryKey(spec);

        if (!this.inventory[itemKey]) {
            this.inventory[itemKey] = {
                key: itemKey,
                kind: spec.kind || 'UNIQUE',
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

        this.inventory[itemKey].count = Math.max(
            safeCount,
            Math.floor(Number(this.inventory[itemKey].count) || 0)
        );

        return this.inventory[itemKey];
    },

    restorePendingSecretArts() {
        Object.entries(CONFIG.SECRET_ARTS || {}).forEach(([uniqueKey, artConfig]) => {
            if (!this.hasUniquePurchase(uniqueKey) || this.hasCultivationArt(uniqueKey)) return;

            const category = SWORD_SECRET_ART_KEYS.includes(uniqueKey) ? 'SWORD_ART' : 'FLAME_ART';
            const existingEntry = this.getInventoryEntryByUniqueKey(uniqueKey, [category]);
            if (existingEntry) return;

            this.ensureUniqueInventoryEntry({
                kind: 'UNIQUE',
                category,
                quality: artConfig.quality || 'SUPREME',
                uniqueKey
            }, 1);
        });
    },

    getThanhTrucSwordArtifactConfig() {
        return CONFIG.SWORD?.ARTIFACT_ITEM || null;
    },

    isThanhTrucSwordArtifactItem(item) {
        return Boolean(item && item.category === 'SWORD_ARTIFACT');
    },

    getSwordInstanceSystemConfig() {
        return CONFIG.SWORD?.INSTANCE_SYSTEM || {};
    },

    getSwordControlConfig() {
        return CONFIG.SWORD?.CONTROL || {};
    },

    createSwordArtifactInstanceKey(prefix = 'THANH_TRUC_SWORD') {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    },

    getSwordBasePowerRating() {
        return Math.max(1, Math.floor(Number(this.getSwordInstanceSystemConfig().BASE_POWER_RATING) || 100));
    },

    getSwordDurabilityBaseline(rank = null) {
        const rankData = rank || this.getCurrentRank();
        const minDurability = Math.max(1, Math.floor(Number(this.getSwordInstanceSystemConfig().MIN_DURABILITY) || 1));
        return Math.max(minDurability, Math.floor(Number(rankData?.swordDurability) || 0));
    },

    getRefinedThanhTrucSwordDurability(years = 0) {
        const cfg = this.getSwordInstanceSystemConfig();
        const steps = Math.max(0, Math.floor(Number(years) || 0) / 120);
        const refinedBase = Math.max(1, Math.floor(Number(cfg.REFINED_DURABILITY_BASE) || 8));
        const stepValue = Math.max(1, Math.floor(Number(cfg.REFINED_DURABILITY_PER_120_YEARS) || 2));
        return Math.max(this.getSwordDurabilityBaseline(), refinedBase + Math.floor(steps) * stepValue);
    },

    normalizeSwordArtifactState(state, fallbackItem = null) {
        const safeSource = state && typeof state === 'object' ? state : {};
        const sourceItem = fallbackItem && typeof fallbackItem === 'object' ? fallbackItem : {};
        const instanceKey = String(safeSource.instanceKey || safeSource.id || sourceItem.instanceKey || '').trim()
            || this.createSwordArtifactInstanceKey();
        const source = typeof safeSource.source === 'string'
            ? safeSource.source
            : (typeof sourceItem.source === 'string' ? sourceItem.source : 'SHOP');
        const refineYears = Math.max(0, Math.floor(Number(safeSource.refineYears ?? sourceItem.refineYears) || 0));
        const isRefined = source === 'REFINED' || refineYears > 0;
        const powerRating = Math.max(
            1,
            Math.floor(
                Number(safeSource.powerRating ?? sourceItem.powerRating)
                || (isRefined ? this.getRefinedThanhTrucSwordPower(refineYears) : this.getSwordBasePowerRating())
            )
        );
        const derivedMaxDurability = isRefined
            ? this.getRefinedThanhTrucSwordDurability(refineYears)
            : this.getSwordDurabilityBaseline();
        const maxDurability = Math.max(
            1,
            Math.floor(Number(safeSource.maxDurability ?? sourceItem.maxDurability) || derivedMaxDurability)
        );
        const durability = Math.max(
            0,
            Math.min(
                maxDurability,
                Math.floor(Number(safeSource.durability ?? sourceItem.durability) || maxDurability)
            )
        );

        return {
            instanceKey,
            source,
            refineYears,
            powerRating,
            sellPriceLowStone: Math.max(
                0,
                Math.floor(Number(safeSource.sellPriceLowStone ?? sourceItem.sellPriceLowStone) || 0)
            ),
            maxDurability,
            durability,
            breakWear: Math.max(0, Math.floor(Number(safeSource.breakWear ?? sourceItem.breakWear) || 0)),
            breakCount: Math.max(0, Math.floor(Number(safeSource.breakCount ?? sourceItem.breakCount) || 0)),
            equippedAt: Math.max(0, Math.floor(Number(safeSource.equippedAt ?? sourceItem.equippedAt) || Date.now()))
        };
    },

    createSwordArtifactStateFromItem(item) {
        return this.normalizeSwordArtifactState({}, item);
    },

    ensureSwordArtifactState() {
        const sourceStates = Array.isArray(this.equippedSwordArtifacts) ? this.equippedSwordArtifacts : [];
        const seenKeys = new Set();
        const normalizedStates = sourceStates
            .map(entry => this.normalizeSwordArtifactState(entry))
            .filter(entry => {
                if (!entry || seenKeys.has(entry.instanceKey)) return false;
                seenKeys.add(entry.instanceKey);
                return true;
            });

        if (!normalizedStates.length && Math.max(0, Math.floor(Number(this.bondedSwordCount) || 0)) > 0) {
            const legacyCount = Math.max(0, Math.floor(Number(this.bondedSwordCount) || 0));
            for (let index = 0; index < legacyCount; index++) {
                normalizedStates.push(this.normalizeSwordArtifactState({
                    instanceKey: this.createSwordArtifactInstanceKey('LEGACY_THANH_TRUC'),
                    source: 'LEGACY',
                    equippedAt: Date.now() + index
                }));
            }
        }

        this.equippedSwordArtifacts = normalizedStates;
        this.bondedSwordCount = normalizedStates.length;
        return this.equippedSwordArtifacts;
    },

    getEquippedSwordArtifacts() {
        return this.ensureSwordArtifactState();
    },

    getEquippedSwordArtifactSnapshot() {
        return this.getEquippedSwordArtifacts().map(state => ({ ...state }));
    },

    getEquippedSwordArtifactByKey(instanceKey) {
        return this.getEquippedSwordArtifacts().find(state => state.instanceKey === instanceKey) || null;
    },

    getUsableEquippedSwordArtifacts() {
        return this.getEquippedSwordArtifacts().filter(state => Math.max(0, Math.floor(Number(state?.durability) || 0)) > 0);
    },

    getBrokenEquippedSwordArtifacts() {
        return this.getEquippedSwordArtifacts().filter(state => Math.max(0, Math.floor(Number(state?.durability) || 0)) <= 0);
    },

    sortSwordArtifactsForControl(states) {
        return [...states].sort((a, b) => {
            const powerDiff = (Math.floor(Number(b?.powerRating) || 0)) - (Math.floor(Number(a?.powerRating) || 0));
            if (powerDiff !== 0) return powerDiff;

            const durabilityDiff = (Math.floor(Number(b?.durability) || 0)) - (Math.floor(Number(a?.durability) || 0));
            if (durabilityDiff !== 0) return durabilityDiff;

            return (Math.floor(Number(a?.equippedAt) || 0)) - (Math.floor(Number(b?.equippedAt) || 0));
        });
    },

    getSwordConsciousnessStat() {
        return Math.max(1, this.rankIndex + 1);
    },

    getSwordConsciousnessLabel() {
        return formatNumber(this.getSwordConsciousnessStat());
    },

    hasThanhLinhKiemQuyetUnlocked() {
        return this.hasCultivationArt('THANH_LINH_KIEM_QUYET');
    },

    getSwordEquipCapacity() {
        if (!this.hasThanhLinhKiemQuyetUnlocked()) {
            return Math.min(
                getConfiguredSwordCount(),
                Math.max(1, Math.floor(Number(this.getSwordControlConfig().WITHOUT_SECRET_ART) || 1))
            );
        }

        return Math.max(1, Math.min(
            getConfiguredSwordCount(),
            Math.max(1, Math.floor(Number(this.getSwordControlConfig().MAX_CONSCIOUSNESS_CONTROL) || getConfiguredSwordCount())),
            this.getSwordConsciousnessStat()
        ));
    },

    getSwordControlLimit() {
        const usableCount = this.getUsableEquippedSwordArtifacts().length;
        if (usableCount <= 0) return 0;

        return Math.min(usableCount, this.getSwordEquipCapacity());
    },

    getActiveSwordArtifactStates({ mode = this.attackMode } = {}) {
        const usableStates = this.sortSwordArtifactsForControl(this.getUsableEquippedSwordArtifacts());
        if (mode === 'SWORD' && this.canDeployDaiCanhKiemTran()) {
            return usableStates.slice(0, getConfiguredSwordCount());
        }

        return usableStates.slice(0, this.getSwordControlLimit());
    },

    getBondedSwordCount() {
        return this.getEquippedSwordArtifacts().length;
    },

    getFormationSwordCount() {
        return Math.min(this.getUsableEquippedSwordArtifacts().length, getConfiguredSwordCount());
    },

    getSwordArtifactInventoryCount() {
        return Object.values(this.inventory || {}).reduce((total, item) => {
            return total + (this.isThanhTrucSwordArtifactItem(item) ? Math.max(0, Math.floor(item.count || 0)) : 0);
        }, 0);
    },

    getSwordFormationProgress() {
        const required = getConfiguredSwordCount();
        const bonded = this.getBondedSwordCount();
        const usableBonded = this.getUsableEquippedSwordArtifacts().length;
        const formationBonded = this.getFormationSwordCount();
        const stocked = this.getSwordArtifactInventoryCount();
        const owned = Math.max(0, bonded + stocked);
        const capacity = this.getSwordEquipCapacity();
        const controlled = this.getSwordControlLimit();

        return {
            bonded,
            usableBonded,
            formationBonded,
            capacity,
            controlled,
            stocked,
            owned,
            required,
            remaining: Math.max(0, required - usableBonded),
            ready: usableBonded >= required,
            overflow: Math.max(0, bonded - required),
            broken: Math.max(0, bonded - usableBonded),
            inactive: Math.max(0, usableBonded - controlled),
            freeSlots: Math.max(0, capacity - bonded),
            consciousness: this.getSwordConsciousnessStat(),
            thanhLinhUnlocked: this.hasThanhLinhKiemQuyetUnlocked()
        };
    },

    hasKnownSwordArtifact() {
        const progress = this.getSwordFormationProgress();
        return progress.bonded > 0 || progress.stocked > 0 || progress.ready;
    },

    getSwordArtifactPowerMultiplier(state) {
        const powerRating = Math.max(1, Math.floor(Number(state?.powerRating) || this.getSwordBasePowerRating()));
        return Math.max(0.35, powerRating / this.getSwordBasePowerRating());
    },

    isSwordArtifactDamaged(target) {
        const state = typeof target === 'string' ? this.getEquippedSwordArtifactByKey(target) : target;
        if (!state) return false;
        return Math.floor(Number(state.durability) || 0) < Math.floor(Number(state.maxDurability) || 0);
    },

    recordSwordArtifactBreak(instanceKey) {
        const state = this.getEquippedSwordArtifactByKey(instanceKey);
        if (!state) return null;

        state.breakCount = Math.max(0, Math.floor(Number(state.breakCount) || 0)) + 1;
        state.breakWear = Math.max(0, Math.floor(Number(state.breakWear) || 0)) + 1;

        const breakThreshold = Math.max(1, Math.floor(Number(this.getSwordInstanceSystemConfig().BREAKS_PER_DURABILITY_LOSS) || 4));
        let durabilityReduced = false;

        if (state.breakWear >= breakThreshold && state.durability > 0) {
            state.breakWear = 0;
            state.durability = Math.max(0, Math.floor(Number(state.durability) || 0) - 1);
            durabilityReduced = true;
        }

        this.bondedSwordCount = this.getEquippedSwordArtifacts().length;

        if (durabilityReduced) {
            const swordName = this.getItemDisplayName({ category: 'SWORD_ARTIFACT', quality: 'HIGH' });
            showNotify(
                state.durability > 0
                    ? `${swordName} hao tổn độ bền, còn ${formatNumber(state.durability)}/${formatNumber(state.maxDurability)}.`
                    : `${swordName} đã cạn độ bền, cần Chưởng Thiên Bình phục hồi trước khi tiếp tục xuất trận.`,
                this.getThanhTrucSwordArtifactConfig()?.color || '#66f0c2'
            );
        }

        GameProgress.requestSave();
        return state;
    },

    repairSwordArtifactDurability(target, { silent = false } = {}) {
        const state = typeof target === 'string' ? this.getEquippedSwordArtifactByKey(target) : target;
        if (!state) return false;

        const maxDurability = Math.max(1, Math.floor(Number(state.maxDurability) || 0));
        const currentDurability = Math.max(0, Math.floor(Number(state.durability) || 0));
        if (currentDurability >= maxDurability) return false;

        state.durability = maxDurability;
        state.breakWear = 0;

        if (typeof syncSwordFormation === 'function') {
            syncSwordFormation({ rebuildAll: true });
        }

        if (!silent) {
            showNotify(
                `${this.getItemDisplayName({ category: 'SWORD_ARTIFACT', quality: 'HIGH' })} đã được phục hồi ${formatNumber(maxDurability)}/${formatNumber(maxDurability)} độ bền.`,
                this.getThanhTrucSwordArtifactConfig()?.color || '#66f0c2'
            );
        }

        GameProgress.requestSave();
        return true;
    },

    equipSwordArtifactFromInventoryItem(itemKey) {
        const item = this.inventory?.[itemKey];
        if (!item || item.count <= 0 || item.category !== 'SWORD_ARTIFACT') return false;

        const qualityConfig = this.getItemQualityConfig(item);
        const progress = this.getSwordFormationProgress();
        const capacity = Math.max(1, Math.floor(Number(progress.capacity) || this.getSwordEquipCapacity() || 1));

        if (progress.bonded >= capacity) {
            const notifyText = progress.thanhLinhUnlocked
                ? `Thần thức hiện tại chỉ đủ điều khiển tối đa ${formatNumber(capacity)} thanh kiếm hộ thân. Đang trang bị ${formatNumber(progress.bonded)}/${formatNumber(capacity)} thanh, chưa thể triển khai thêm.`
                : `Chưa lĩnh ngộ Thanh Linh Kiếm Quyết nên thần thức hiện chỉ giữ được ${formatNumber(capacity)} thanh kiếm hộ thân.`;

            showNotify(notifyText, qualityConfig.color || '#66f0c2');
            return false;
        }

        const state = this.createSwordArtifactStateFromItem(item);

        item.count--;
        if (item.count <= 0) {
            delete this.inventory[itemKey];
        }

        this.getEquippedSwordArtifacts().push(state);
        this.bondedSwordCount = this.getEquippedSwordArtifacts().length;
        const wasDeployable = this.canDeployDaiCanhKiemTran();
        const nextProgress = this.getSwordFormationProgress();
        const deployable = this.syncDaiCanhKiemTranProgress();

        if (typeof syncSwordFormation === 'function') {
            syncSwordFormation({ rebuildAll: true });
        }

        showNotify(
            deployable && !wasDeployable
                ? SWORD_UI_TEXT.deployReady(this.getItemDisplayName(item), formatNumber(nextProgress.bonded), formatNumber(nextProgress.required))
                : nextProgress.ready && !this.hasDaiCanhKiemTranUnlocked()
                    ? SWORD_UI_TEXT.deployNeedArt(this.getItemDisplayName(item), formatNumber(nextProgress.bonded), formatNumber(nextProgress.required))
                    : SWORD_UI_TEXT.deployCount(this.getItemDisplayName(item), formatNumber(nextProgress.bonded)),
            qualityConfig.color || '#66f0c2'
        );

        this.refreshResourceUI();
        return true;
    },

    unequipSwordArtifactToInventory(instanceKey) {
        const state = this.getEquippedSwordArtifactByKey(instanceKey);
        if (!state) return false;

        const spec = {
            kind: 'UNIQUE',
            category: 'SWORD_ARTIFACT',
            quality: state.source === 'REFINED' ? (state.refineYears >= 720 ? 'SUPREME' : 'HIGH') : (this.getThanhTrucSwordArtifactConfig()?.quality || 'HIGH'),
            uniqueKey: this.getThanhTrucSwordArtifactConfig()?.uniqueKey || 'THANH_TRUC_PHONG_VAN_KIEM',
            instanceKey: state.instanceKey,
            source: state.source,
            refineYears: state.refineYears,
            powerRating: state.powerRating,
            sellPriceLowStone: state.sellPriceLowStone,
            maxDurability: state.maxDurability,
            durability: state.durability,
            breakWear: state.breakWear,
            breakCount: state.breakCount
        };

        if (!this.hasInventorySpaceForSpec(spec)) {
            showNotify('Túi trữ vật đã đầy, chưa thể gỡ thanh kiếm này vào túi.', '#ff8a80');
            return false;
        }

        const nextStates = this.getEquippedSwordArtifacts().filter(entry => entry.instanceKey !== instanceKey);
        this.equippedSwordArtifacts = nextStates;
        this.bondedSwordCount = nextStates.length;
        this.addInventoryItem(spec, 1);

        if (typeof syncSwordFormation === 'function') {
            syncSwordFormation({ rebuildAll: true });
        }

        this.enforcePhongLoiSiSwordRequirement();
        this.ensureValidAttackMode();
        showNotify(
            `${this.getItemDisplayName({ category: 'SWORD_ARTIFACT', quality: spec.quality })} đã được gỡ trang bị và đưa về túi trữ vật.`,
            this.getThanhTrucSwordArtifactConfig()?.color || '#66f0c2'
        );
        this.refreshResourceUI();
        return true;
    },

    syncDaiCanhKiemTranProgress({ notifyUnlock = false } = {}) {
        const progress = this.getSwordFormationProgress();
        const deployable = this.canDeployDaiCanhKiemTran();

        if (notifyUnlock && progress.ready) {
            showNotify(
                this.hasDaiCanhKiemTranUnlocked()
                    ? SWORD_UI_TEXT.readyNotifyLearned(formatNumber(progress.required))
                    : SWORD_UI_TEXT.readyNotifyNeedArt(formatNumber(progress.required)),
                this.getThanhTrucSwordArtifactConfig()?.color || '#66f0c2'
            );
        }

        return deployable;
    },

    hasDaiCanhKiemTranUnlocked() {
        return this.hasCultivationArt('DAI_CANH_KIEM_TRAN');
    },

    canDeployDaiCanhKiemTran() {
        return this.hasDaiCanhKiemTranUnlocked() && this.getSwordFormationProgress().ready;
    },

    hasCanLamBangDiemUnlocked() {
        return this.hasCultivationArt('CAN_LAM_BANG_DIEM');
    },

    castCanLamBangDiem() {
        if (this.isVoidCollapsed || !this.hasCanLamBangDiemUnlocked()) return false;
        if (!this.isArtifactDeployed('CAN_LAM_BANG_DIEM')) {
            showNotify('Càn Lam Băng Diễm chưa triển khai, hãy khai triển tại mục Pháp bảo trước.', '#69d9ff');
            return false;
        }
        const castManaCost = Math.max(0, Number(this.getArtifactConfig('CAN_LAM_BANG_DIEM')?.castSkill?.MANA_COST) || 22);
        if (this.mana < castManaCost) {
            showNotify(`Linh lực không đủ để thi triển Càn Lam Băng Diễm (cần ${formatNumber(castManaCost)}).`, '#69d9ff');
            this.triggerManaShake();
            return false;
        }
        const livingEnemies = (Array.isArray(enemies) ? enemies : []).filter(enemy => enemy && enemy.hp > 0);
        if (!livingEnemies.length) {
            showNotify('Không có mục tiêu để thi triển Càn Lam Băng Diễm.', '#69d9ff');
            return false;
        }

        const startX = Number.isFinite(this.x) ? this.x : guardCenter.x;
        const startY = Number.isFinite(this.y) ? this.y : guardCenter.y;
        const target = livingEnemies.reduce((closest, enemy) => {
            if (!closest) return enemy;
            const currentDist = Math.hypot((enemy.x || 0) - startX, (enemy.y || 0) - startY);
            const bestDist = Math.hypot((closest.x || 0) - startX, (closest.y || 0) - startY);
            return currentDist < bestDist ? enemy : closest;
        }, null);
        if (!target) return false;

        this.canLamProjectiles.push({
            fromX: startX,
            fromY: startY,
            targetRef: target,
            x: startX,
            y: startY,
            startAt: performance.now(),
            travelMs: 260
        });

        this.updateMana(-castManaCost);
        showNotify('Càn Lam Băng Diễm: tách một nhúm lam hỏa truy kích mục tiêu gần nhất.', '#69d9ff');
        this.refreshResourceUI();
        return true;
    },

    applyCanLamImpact(target) {
        if (!target || target.hp <= 0) return false;

        const effectSpawnVersion = Number(target.spawnVersion) || 0;

        target.applyMovementLock?.(1200);
        target.applySlow?.(3000, 0.08);
        target.suppressDodge?.(3000);
        target.canLamFreezeUntil = Math.max(target.canLamFreezeUntil || 0, performance.now() + 1300);
        target.canLamBurnUntil = Math.max(target.canLamBurnUntil || 0, performance.now() + 3000);

        const dotSword = { powerPenalty: 0.36, ignoreDodge: true, shieldBreakMultiplier: 1.2 };
        for (let tick = 1; tick <= 3; tick++) {
            setTimeout(() => {
                if (!target || target.hp <= 0) return;
                if ((Number(target.spawnVersion) || 0) !== effectSpawnVersion) return;
                const hpBefore = target.hp;
                target.hit(dotSword);
                if (hpBefore > 0 && target.hp <= 0) {
                    this.createCanLamDissolveBurst(target.x, target.y);
                }
            }, tick * 1000);
        }
        return true;
    },

    createCanLamImpactBurst(x, y) {
        trimVisualParticles(260);
        visualParticles.push({
            type: 'ring',
            x,
            y,
            radius: 8,
            radialVelocity: 12,
            lineWidth: 2.2,
            color: '#b9f2ff',
            glow: 14,
            life: 0.9,
            decay: 0.08
        });
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            visualParticles.push({
                type: 'ray',
                x,
                y,
                angle,
                radius: 2,
                length: 14,
                lengthVelocity: 1.1,
                lineWidth: 1.5,
                color: i % 2 === 0 ? '#7fe8ff' : '#ffb16e',
                glow: 12,
                life: 0.84,
                decay: 0.08
            });
        }
    },

    drawCanLamProjectiles(ctx, scaleFactor) {
        if (!Array.isArray(this.canLamProjectiles) || !this.canLamProjectiles.length) return;
        const now = performance.now();
        const alive = [];

        this.canLamProjectiles.forEach(projectile => {
            const target = projectile.targetRef;
            const duration = Math.max(80, projectile.travelMs || 260);
            const progress = Math.min(1, (now - projectile.startAt) / duration);
            const targetX = Number.isFinite(target?.x) ? target.x : projectile.x;
            const targetY = Number.isFinite(target?.y) ? target.y : projectile.y;
            projectile.x = projectile.fromX + ((targetX - projectile.fromX) * progress);
            projectile.y = projectile.fromY + ((targetY - projectile.fromY) * progress);

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(projectile.x, projectile.y);
            const radius = (3.2 + (Math.sin(now * 0.018) * 0.6)) * scaleFactor;
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 3.4);
            grad.addColorStop(0, 'rgba(237,252,255,0.96)');
            grad.addColorStop(0.42, 'rgba(122,221,255,0.86)');
            grad.addColorStop(0.82, 'rgba(255,159,102,0.5)');
            grad.addColorStop(1, 'rgba(255,159,102,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 3.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#f2feff';
            ctx.shadowBlur = 14 * scaleFactor;
            ctx.shadowColor = '#8ee7ff';
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (progress >= 1) {
                this.createCanLamImpactBurst(targetX, targetY);
                this.applyCanLamImpact(target);
                return;
            }
            alive.push(projectile);
        });

        this.canLamProjectiles = alive;
    },

    drawEnemyMeleeStrikes(ctx, scaleFactor) {
        const strikes = this.ensureEnemyMeleeStrikes();
        if (!strikes.length) return;
        const now = performance.now();

        strikes.forEach(strike => {
            const progress = clampNumber((now - strike.startedAt) / Math.max(1, strike.durationMs), 0, 1);
            const latchProgress = strike.latchUntil > now
                ? clampNumber((strike.latchUntil - now) / Math.max(1, strike.latchDurationMs || 1), 0, 1)
                : 0;
            const alpha = strike.latchUntil > now
                ? Math.max(0.35, 0.45 + (latchProgress * 0.55))
                : Math.max(0, 1 - (progress * 0.82));
            const dx = strike.toX - strike.fromX;
            const dy = strike.toY - strike.fromY;
            const angle = Math.atan2(dy, dx || 0.0001);

            if (strike.type === 'CHARGE') {
                const length = Math.max(24, Math.hypot(dx, dy) * 0.46) * (1 - (progress * 0.35));
                const trailGradient = ctx.createLinearGradient(
                    strike.x - Math.cos(angle) * length,
                    strike.y - Math.sin(angle) * length,
                    strike.x,
                    strike.y
                );
                trailGradient.addColorStop(0, `rgba(126, 231, 255, ${0})`);
                trailGradient.addColorStop(0.4, `rgba(126, 231, 255, ${0.24 * alpha})`);
                trailGradient.addColorStop(1, `rgba(255, 255, 255, ${0.86 * alpha})`);

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.lineCap = 'round';
                ctx.strokeStyle = trailGradient;
                ctx.lineWidth = Math.max(1.3, 5.8 * scaleFactor);
                ctx.beginPath();
                ctx.moveTo(strike.x - Math.cos(angle) * length, strike.y - Math.sin(angle) * length);
                ctx.lineTo(strike.x, strike.y);
                ctx.stroke();
                ctx.restore();
            }

            if (strike.type === 'BITE') {
                const jawSpread = strike.latchUntil > now
                    ? (0.18 + (Math.sin(now * 0.018) * 0.04)) * Math.PI
                    : (0.46 - (progress * 0.26)) * Math.PI;
                const jawRadius = Math.max(8, 16 * scaleFactor);
                const jawAlpha = 0.18 + (0.55 * alpha);

                ctx.save();
                ctx.translate(strike.x, strike.y);
                ctx.rotate(angle);
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(255, 244, 244, ${jawAlpha})`;
                ctx.shadowBlur = 10 * scaleFactor;
                ctx.shadowColor = 'rgba(255, 227, 227, 0.72)';

                ctx.beginPath();
                ctx.arc(0, 0, jawRadius, -jawSpread, -0.08, false);
                ctx.lineTo(0, 0);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.arc(0, 0, jawRadius, 0.08, jawSpread, false);
                ctx.lineTo(0, 0);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        });
    },

    createCanLamDissolveBurst(x, y) {
        trimVisualParticles(260);
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = random(1.8, 5.8);
            visualParticles.push({
                type: 'spark',
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - random(0.1, 1),
                gravity: 0.04,
                friction: 0.95,
                size: random(2, 4.5),
                sizeVelocity: -0.03,
                life: 0.9,
                decay: random(0.03, 0.05),
                opacity: 0.86,
                color: i % 2 === 0 ? '#78e6ff' : '#9fd6ff',
                glow: 12
            });
        }
    },

    getUnlockedSwordTargetCount() {
        return getConfiguredSwordCount();
    },

    hasKhuTrungThuatUnlocked() {
        return this.hasCultivationArt('KHU_TRUNG_THUAT');
    },

    hasSecretArtInInventory(uniqueKey) {
        if (!uniqueKey) return false;
        const category = SWORD_SECRET_ART_KEYS.includes(uniqueKey) ? 'SWORD_ART' : 'FLAME_ART';
        return Boolean(this.getInventoryEntryByUniqueKey(uniqueKey, [category]));
    },

});
