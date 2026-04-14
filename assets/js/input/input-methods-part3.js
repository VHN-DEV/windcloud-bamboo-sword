Object.assign(Input, {
    applyExpPenalty(ratio) {
        const safeRatio = Math.max(0, Math.min(1, ratio || 0));
        if (safeRatio <= 0) return 0;

        const loss = Math.floor(this.exp * safeRatio);
        this.exp = Math.max(0, this.exp - loss);
        if (this.getCurrentRank() && this.exp < this.getCurrentRank().exp) {
            this.isReadyToBreak = false;
        }
        return loss;
    },

    consumeBerserkPill(item, qualityConfig) {
        this.activeEffects = this.activeEffects.filter(effect => effect.group !== 'BERSERK');

        this.activeEffects.push({
            id: item.key,
            name: this.getItemDisplayName(item),
            group: 'BERSERK',
            expiresAt: performance.now() + (qualityConfig.durationMs || 10000),
            attackPct: qualityConfig.attackPct || 0,
            speedPct: qualityConfig.sideSpeedPct || 0,
            maxManaFlat: qualityConfig.sideMaxManaFlat || 0,
            auraMode: qualityConfig.auraMode || null,
            endColor: qualityConfig.color
        });

        const sideEffects = [];

        if (qualityConfig.sideManaLoss) {
            const manaLoss = Math.min(this.mana, qualityConfig.sideManaLoss);
            this.updateMana(-manaLoss);
            sideEffects.push(`hao ${formatNumber(manaLoss)} linh lực`);
        }

        if (qualityConfig.sideExpLossRatio) {
            const expLoss = this.applyExpPenalty(qualityConfig.sideExpLossRatio);
            if (expLoss > 0) sideEffects.push(`tổn ${formatNumber(expLoss)} tu vi`);
        }

        if (qualityConfig.sideMaxManaFlat) {
            sideEffects.push(`tạm giảm ${Math.abs(qualityConfig.sideMaxManaFlat)} giới hạn linh lực`);
        }

        if (qualityConfig.sideSpeedPct) {
            sideEffects.push(`tạm giảm ${Math.round(Math.abs(qualityConfig.sideSpeedPct) * 100)}% tốc độ`);
        }

        this.syncDerivedStats();

        const sideText = sideEffects.length ? `, đổi lại ${sideEffects.join(', ')}` : '';
        showNotify(`Dùng ${this.getItemDisplayName(item)}: cuồng hóa ${Math.round((qualityConfig.attackPct || 0) * 100)}%${sideText}`, qualityConfig.color);
    },

    getInsectSpeciesEntries() {
        return Object.entries(CONFIG.INSECT?.SPECIES || {});
    },

    getInsectSpecies(speciesKey) {
        return CONFIG.INSECT?.SPECIES?.[speciesKey] || null;
    },

    getInsectCombatProfile(speciesKey) {
        return INSECT_COMBAT_PROFILES[speciesKey] || INSECT_COMBAT_PROFILES.DEFAULT;
    },

    getInsectTierInfo(tierKey) {
        return CONFIG.INSECT?.TIERS?.[tierKey] || CONFIG.INSECT?.TIERS?.PHAM || { label: 'Kỳ trùng', color: '#79ffd4', shortLabel: 'Trùng' };
    },

    getInsectTierShopInfo(tierKey) {
        return INSECT_TIER_SHOP_INFO[tierKey] || INSECT_TIER_SHOP_INFO.PHAM;
    },

    getInsectEggShopConfig(speciesKey) {
        const species = this.getInsectSpecies(speciesKey);
        const tierInfo = this.getInsectTierInfo(species?.tier);
        const shopInfo = this.getInsectTierShopInfo(species?.tier);

        return {
            fullName: species ? `Trứng ${species.name}` : 'Trứng kỳ trùng',
            quality: shopInfo.quality || 'LOW',
            color: species?.eggColor || species?.color || tierInfo.color || '#d7fff1',
            radius: 5.4,
            buyPriceLowStone: Math.max(0, Math.floor(shopInfo.eggBuyPriceLowStone || 0))
        };
    },

    getInsectHabitatConfig(speciesKey) {
        const species = this.getInsectSpecies(speciesKey);
        const tierInfo = this.getInsectTierInfo(species?.tier);
        const shopInfo = this.getInsectTierShopInfo(species?.tier);

        return {
            fullName: species ? `Linh Thú Đại ${species.name}` : 'Linh Thú Đại',
            quality: shopInfo.quality || 'LOW',
            color: species?.color || tierInfo.color || '#8ebfff',
            capacity: this.getBeastBagUpgradeCapacity(),
            buyPriceLowStone: Math.max(0, Math.floor(shopInfo.habitatBuyPriceLowStone || 0)),
            buttonLabel: 'Mua'
        };
    },

    getBeastBagUpgradeCapacity() {
        return Math.max(
            1,
            Math.floor(
                CONFIG.INSECT?.BEAST_BAG?.capacity
                || CONFIG.INSECT?.STARTING_BEAST_BAG_CAPACITY
                || 1
            )
        );
    },

    ensureInsectHabitatCapacities() {
        if (!this.insectHabitatCapacities || typeof this.insectHabitatCapacities !== 'object' || Array.isArray(this.insectHabitatCapacities)) {
            this.insectHabitatCapacities = {};
        }

        if (this.beastBagCapacityMigrated) {
            return this.insectHabitatCapacities;
        }

        const purchasedSpeciesKeys = Object.keys(this.insectHabitats || {})
            .filter(speciesKey => this.insectHabitats[speciesKey] && this.getInsectSpecies(speciesKey));
        const migratedBaseCapacity = (() => {
            const legacyCapacity = Math.max(0, Math.floor(this.beastBagCapacity || 0));
            if (!purchasedSpeciesKeys.length || legacyCapacity <= 0) {
                return this.getBeastBagUpgradeCapacity();
            }

            return Math.max(
                this.getBeastBagUpgradeCapacity(),
                Math.ceil(legacyCapacity / purchasedSpeciesKeys.length)
            );
        })();

        purchasedSpeciesKeys.forEach(speciesKey => {
            const currentCapacity = Math.max(0, Math.floor(this.insectHabitatCapacities[speciesKey] || 0));
            if (currentCapacity <= 0) {
                this.insectHabitatCapacities[speciesKey] = migratedBaseCapacity;
            }
        });

        this.beastBagCapacityMigrated = true;
        return this.insectHabitatCapacities;
    },

    getInsectHabitatCapacity(speciesKey) {
        if (!speciesKey) return 0;

        const habitatKey = this.getSpeciesHabitatKey(speciesKey);
        if (habitatKey === 'RAINBOW') {
            return Number.POSITIVE_INFINITY;
        }

        if (!this.insectHabitats?.[speciesKey]) {
            return 0;
        }

        const capacities = this.ensureInsectHabitatCapacities();
        return Math.max(0, Math.floor(capacities[speciesKey] || 0));
    },

    upgradeInsectHabitatCapacity(speciesKey, extraCapacity = this.getBeastBagUpgradeCapacity(), { unlock = true } = {}) {
        if (!this.getInsectSpecies(speciesKey)) return 0;

        const safeExtraCapacity = Math.max(0, Math.floor(extraCapacity || 0));
        if (!this.insectHabitats) this.insectHabitats = {};
        if (unlock) this.insectHabitats[speciesKey] = true;

        const capacities = this.ensureInsectHabitatCapacities();
        const currentCapacity = Math.max(0, Math.floor(capacities[speciesKey] || 0));
        const nextCapacity = currentCapacity + safeExtraCapacity;
        capacities[speciesKey] = nextCapacity;
        this.markDiscoveredInsect(speciesKey);
        return nextCapacity;
    },

    getInsectHabitatOccupancy(speciesKey) {
        return Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
    },

    getInsectHabitatFreeSlots(speciesKey) {
        const capacity = this.getInsectHabitatCapacity(speciesKey);
        if (!Number.isFinite(capacity)) return Number.POSITIVE_INFINITY;
        return Math.max(0, capacity - this.getInsectHabitatOccupancy(speciesKey));
    },

    getSpeciesHabitatKey(speciesKey) {
        if (this.insectHabitats?.[speciesKey]) return speciesKey;
        if (this.hasSevenColorSpiritBag()) return 'RAINBOW';
        return null;
    },

    isSpeciesInRainbowHabitat(speciesKey) {
        return this.getSpeciesHabitatKey(speciesKey) === 'RAINBOW';
    },

    needsSpeciesManualFeeding(speciesKey) {
        const habitatKey = this.getSpeciesHabitatKey(speciesKey);
        return Boolean(habitatKey && habitatKey !== 'RAINBOW');
    },

    hasInsectHabitat(speciesKey) {
        return Boolean(this.getSpeciesHabitatKey(speciesKey));
    },

    unlockInsectHabitat(speciesKey) {
        if (!this.getInsectSpecies(speciesKey)) return false;
        if (!this.insectHabitats) this.insectHabitats = {};
        this.insectHabitats[speciesKey] = true;
        this.ensureInsectHabitatCapacities();
        if (Math.max(0, Math.floor(this.insectHabitatCapacities?.[speciesKey] || 0)) <= 0) {
            this.insectHabitatCapacities[speciesKey] = this.getBeastBagUpgradeCapacity();
        }
        this.markDiscoveredInsect(speciesKey);
        return true;
    },

    getMaterialConfig(materialKey) {
        return CONFIG.ITEMS?.MATERIALS?.[materialKey] || null;
    },

    getMaterialInventoryCount(materialKey) {
        const materialConfig = this.getMaterialConfig(materialKey);
        if (!materialConfig) return 0;

        const itemKey = this.buildInventoryKey({
            kind: 'MATERIAL',
            category: 'MATERIAL',
            quality: materialConfig.quality || 'LOW',
            materialKey
        });

        return Math.max(0, Math.floor(this.inventory[itemKey]?.count || 0));
    },

    consumeMaterial(materialKey, count = 1) {
        const materialConfig = this.getMaterialConfig(materialKey);
        const safeCount = Math.max(0, Math.floor(count || 0));
        if (!materialConfig || safeCount <= 0) return 0;

        const itemKey = this.buildInventoryKey({
            kind: 'MATERIAL',
            category: 'MATERIAL',
            quality: materialConfig.quality || 'LOW',
            materialKey
        });

        const item = this.inventory[itemKey];
        if (!item || item.count <= 0) return 0;

        const consumed = Math.min(safeCount, Math.max(0, Math.floor(item.count || 0)));
        item.count -= consumed;
        if (item.count <= 0) delete this.inventory[itemKey];
        return consumed;
    },

    hasRequiredMaterials(requirements, multiplier = 1) {
        const safeMultiplier = Math.max(1, Math.floor(multiplier || 1));
        return (requirements || []).every(requirement => {
            const needed = Math.max(0, Math.floor((requirement?.count || 0) * safeMultiplier));
            return this.getMaterialInventoryCount(requirement?.materialKey) >= needed;
        });
    },

    consumeRequiredMaterials(requirements, multiplier = 1) {
        const safeMultiplier = Math.max(1, Math.floor(multiplier || 1));
        if (!this.hasRequiredMaterials(requirements, safeMultiplier)) return false;

        (requirements || []).forEach(requirement => {
            const needed = Math.max(0, Math.floor((requirement?.count || 0) * safeMultiplier));
            if (needed > 0) {
                this.consumeMaterial(requirement.materialKey, needed);
            }
        });

        return true;
    },

    ensureBeastFoodStorageShape() {
        if (!this.beastFoodStorage || typeof this.beastFoodStorage !== 'object' || Array.isArray(this.beastFoodStorage)) {
            this.beastFoodStorage = {};
            return this.beastFoodStorage;
        }

        const values = Object.values(this.beastFoodStorage);
        const hasNestedBuckets = values.some(value => value && typeof value === 'object' && !Array.isArray(value));
        if (!hasNestedBuckets && values.length > 0) {
            const sharedBucket = {};
            Object.entries(this.beastFoodStorage).forEach(([materialKey, count]) => {
                const safeCount = Math.max(0, Math.floor(count || 0));
                if (safeCount > 0) sharedBucket[materialKey] = safeCount;
            });
            this.beastFoodStorage = Object.keys(sharedBucket).length ? { _SHARED: sharedBucket } : {};
        }

        return this.beastFoodStorage;
    },

    getFoodStorageBucket(habitatKey = '_SHARED', { create = false } = {}) {
        const storage = this.ensureBeastFoodStorageShape();
        const safeHabitatKey = habitatKey || '_SHARED';
        const existing = storage[safeHabitatKey];

        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
            return existing;
        }

        if (!create) return null;
        storage[safeHabitatKey] = {};
        return storage[safeHabitatKey];
    },

    getFoodStorageCount(materialKey, habitatKey = '_SHARED', { includeShared = true } = {}) {
        const readCount = (bucketKey) => {
            const bucket = this.getFoodStorageBucket(bucketKey);
            return Math.max(0, Math.floor(bucket?.[materialKey] || 0));
        };

        const safeHabitatKey = habitatKey || '_SHARED';
        let total = readCount(safeHabitatKey);
        if (includeShared && safeHabitatKey !== '_SHARED') {
            total += readCount('_SHARED');
        }

        return total;
    },

    getFoodStorageEntries(habitatKey = null, { includeShared = true } = {}) {
        const storage = this.ensureBeastFoodStorageShape();
        const mergedCounts = {};

        const mergeBucket = (bucketKey) => {
            const bucket = storage[bucketKey];
            if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return;

            Object.entries(bucket).forEach(([materialKey, count]) => {
                const safeCount = Math.max(0, Math.floor(count || 0));
                if (safeCount <= 0) return;
                mergedCounts[materialKey] = (mergedCounts[materialKey] || 0) + safeCount;
            });
        };

        if (habitatKey) {
            mergeBucket(habitatKey);
            if (includeShared && habitatKey !== '_SHARED') mergeBucket('_SHARED');
        } else {
            Object.keys(storage).forEach(mergeBucket);
        }

        return Object.entries(mergedCounts)
            .map(([materialKey, count]) => ({
                materialKey,
                count,
                materialConfig: this.getMaterialConfig(materialKey)
            }))
            .filter(entry => entry.materialConfig && entry.count > 0)
            .sort((a, b) => {
                const qualityDiff = QUALITY_ORDER.indexOf(b.materialConfig.quality || 'LOW') - QUALITY_ORDER.indexOf(a.materialConfig.quality || 'LOW');
                if (qualityDiff !== 0) return qualityDiff;
                return (a.materialConfig.fullName || a.materialKey).localeCompare(b.materialConfig.fullName || b.materialKey, 'vi');
            });
    },

    getHabitatFoodNutritionAvailable(habitatKey = null, { includeShared = true } = {}) {
        return this.getFoodStorageEntries(habitatKey, { includeShared }).reduce((total, entry) => {
            const nutrition = Math.max(0, Number(entry.materialConfig?.nutrition) || 0);
            return total + (entry.count * nutrition);
        }, 0);
    },

    storeMaterialAsFood(materialKey, count = 1, habitatKey = '_SHARED') {
        const safeCount = Math.max(0, Math.floor(count || 0));
        if (safeCount <= 0) return 0;

        const materialConfig = this.getMaterialConfig(materialKey);
        if (!materialConfig || Math.max(0, Number(materialConfig.nutrition) || 0) <= 0) return 0;

        const transferred = this.consumeMaterial(materialKey, safeCount);
        if (transferred <= 0) return 0;

        const bucket = this.getFoodStorageBucket(habitatKey, { create: true });
        bucket[materialKey] = Math.max(0, Math.floor(bucket[materialKey] || 0)) + transferred;
        return transferred;
    },

    consumeStoredFood(materialKey, count = 1, habitatKey = '_SHARED', { allowSharedFallback = true } = {}) {
        const safeCount = Math.max(0, Math.floor(count || 0));
        if (safeCount <= 0) return 0;

        const consumeFromBucket = (bucketKey, neededCount) => {
            if (neededCount <= 0) return 0;
            const bucket = this.getFoodStorageBucket(bucketKey);
            const currentCount = Math.max(0, Math.floor(bucket?.[materialKey] || 0));
            if (currentCount <= 0) return 0;

            const consumed = Math.min(currentCount, neededCount);
            const nextCount = currentCount - consumed;

            if (nextCount <= 0) delete bucket[materialKey];
            else bucket[materialKey] = nextCount;

            return consumed;
        };

        const safeHabitatKey = habitatKey || '_SHARED';
        let consumed = consumeFromBucket(safeHabitatKey, safeCount);

        if (allowSharedFallback && safeHabitatKey !== '_SHARED' && consumed < safeCount) {
            consumed += consumeFromBucket('_SHARED', safeCount - consumed);
        }

        return consumed;
    },

    createDefaultInsectColony(speciesKey, count = 0) {
        const safeCount = Math.max(0, Math.floor(count || 0));
        if (safeCount <= 0) return null;

        const species = this.getInsectSpecies(speciesKey);
        let male = 0;
        let female = 0;

        if (safeCount === 1) {
            const preferFemale = (species?.fertility || 1) >= (species?.attackFactor || 1);
            male = preferFemale ? 0 : 1;
            female = preferFemale ? 1 : 0;
        } else {
            male = Math.max(1, Math.floor(safeCount / 2));
            female = safeCount - male;
            if (female <= 0) {
                female = 1;
                male = Math.max(1, safeCount - female);
            }
        }

        const leaderGender = female > male ? 'FEMALE' : 'MALE';

        return {
            male,
            female,
            leaderGender,
            leaderPower: this.rollInsectPower(speciesKey, 'leader')
        };
    },

    rollInsectPower(speciesKey, source = 'wild') {
        const species = this.getInsectSpecies(speciesKey);
        const attack = Number(species?.attackFactor) || 1;
        const vitality = Number(species?.vitality) || 1;
        const fertility = Number(species?.fertility) || 1;
        const sourceBonus = source === 'breed' ? 0.08 : (source === 'leader' ? 0.12 : 0);
        const variance = 0.82 + (Math.random() * 0.58);
        return Number((((attack * 1.4) + (vitality * 0.95) + (fertility * 0.7)) * variance + sourceBonus).toFixed(3));
    },

    ensureInsectColony(speciesKey, targetCount = null) {
        const safeTargetCount = Math.max(0, Math.floor(
            targetCount === null
                ? (this.tamedInsects?.[speciesKey] || 0)
                : targetCount
        ));

        if (safeTargetCount <= 0) {
            if (this.insectColonies?.[speciesKey]) delete this.insectColonies[speciesKey];
            if (this.insectSatiety?.[speciesKey]) delete this.insectSatiety[speciesKey];
            return null;
        }

        if (!this.insectColonies) this.insectColonies = {};
        const existing = this.insectColonies[speciesKey];

        if (!existing) {
            const colony = this.createDefaultInsectColony(speciesKey, safeTargetCount);
            this.insectColonies[speciesKey] = colony;
            return colony;
        }

        existing.male = Math.max(0, Math.floor(existing.male || 0));
        existing.female = Math.max(0, Math.floor(existing.female || 0));

        let total = existing.male + existing.female;
        while (total < safeTargetCount) {
            if (existing.male <= existing.female) existing.male += 1;
            else existing.female += 1;
            total++;
        }

        while (total > safeTargetCount) {
            if (existing.leaderGender === 'MALE' && existing.male <= 1 && existing.female > 0) {
                existing.female -= 1;
            } else if (existing.leaderGender === 'FEMALE' && existing.female <= 1 && existing.male > 0) {
                existing.male -= 1;
            } else if (existing.male >= existing.female && existing.male > 0) {
                existing.male -= 1;
            } else if (existing.female > 0) {
                existing.female -= 1;
            }
            total--;
        }

        if (!existing.leaderGender || (existing.leaderGender === 'MALE' && existing.male <= 0) || (existing.leaderGender === 'FEMALE' && existing.female <= 0)) {
            existing.leaderGender = existing.female > existing.male ? 'FEMALE' : 'MALE';
            existing.leaderPower = this.rollInsectPower(speciesKey, 'leader');
        }

        return existing;
    },

    updateInsectColonyPopulation(speciesKey, previousCount, nextCount, options = {}) {
        const safePreviousCount = Math.max(0, Math.floor(previousCount || 0));
        const safeNextCount = Math.max(0, Math.floor(nextCount || 0));
        const delta = safeNextCount - safePreviousCount;

        if (safeNextCount <= 0) {
            if (this.insectColonies?.[speciesKey]) delete this.insectColonies[speciesKey];
            if (this.insectSatiety?.[speciesKey]) delete this.insectSatiety[speciesKey];
            return null;
        }

        if (!this.insectColonies) this.insectColonies = {};
        const colony = this.ensureInsectColony(speciesKey, safePreviousCount) || {
            male: 0,
            female: 0,
            leaderGender: null,
            leaderPower: 0
        };
        this.insectColonies[speciesKey] = colony;

        if (delta > 0) {
            const source = options.source || 'hatch';
            for (let i = 0; i < delta; i++) {
                const sex = Math.random() < 0.5 ? 'MALE' : 'FEMALE';
                if (sex === 'MALE') colony.male += 1;
                else colony.female += 1;

                const power = this.rollInsectPower(speciesKey, source);
                if (!colony.leaderGender || power >= Math.max(0, Number(colony.leaderPower) || 0)) {
                    colony.leaderGender = sex;
                    colony.leaderPower = power;
                }
            }
        } else if (delta < 0) {
            for (let i = 0; i < Math.abs(delta); i++) {
                const removeGender = (() => {
                    if (colony.male <= 0) return 'FEMALE';
                    if (colony.female <= 0) return 'MALE';
                    if (colony.leaderGender === 'MALE' && colony.male <= 1) return 'FEMALE';
                    if (colony.leaderGender === 'FEMALE' && colony.female <= 1) return 'MALE';
                    return colony.male >= colony.female ? 'MALE' : 'FEMALE';
                })();

                if (removeGender === 'MALE' && colony.male > 0) colony.male -= 1;
                else if (colony.female > 0) colony.female -= 1;
            }

            if ((colony.leaderGender === 'MALE' && colony.male <= 0) || (colony.leaderGender === 'FEMALE' && colony.female <= 0)) {
                colony.leaderGender = colony.female > colony.male ? 'FEMALE' : 'MALE';
                colony.leaderPower = this.rollInsectPower(speciesKey, 'leader');
            }
        }

        return this.ensureInsectColony(speciesKey, safeNextCount);
    },

    getSpeciesSexSummary(speciesKey) {
        const colony = this.ensureInsectColony(speciesKey);
        return {
            male: Math.max(0, Math.floor(colony?.male || 0)),
            female: Math.max(0, Math.floor(colony?.female || 0))
        };
    },

    getSpeciesLeaderInfo(speciesKey) {
        const colony = this.ensureInsectColony(speciesKey);
        if (!colony) return null;

        const gender = colony.leaderGender === 'FEMALE' ? 'FEMALE' : 'MALE';
        return {
            gender,
            power: Math.max(0, Number(colony.leaderPower) || 0),
            title: gender === 'FEMALE' ? 'Trùng Hậu' : 'Trùng Vương'
        };
    },

    getSpeciesSatiety(speciesKey) {
        return Math.max(0, Math.floor(this.insectSatiety?.[speciesKey] || 0));
    },

    changeSpeciesSatiety(speciesKey, delta = 0) {
        const safeDelta = Math.trunc(delta || 0);
        if (!safeDelta) return this.getSpeciesSatiety(speciesKey);

        if (!this.insectSatiety) this.insectSatiety = {};
        const nextValue = Math.max(0, this.getSpeciesSatiety(speciesKey) + safeDelta);
        if (nextValue <= 0) delete this.insectSatiety[speciesKey];
        else this.insectSatiety[speciesKey] = nextValue;
        return nextValue;
    },

    consumeSpeciesSatiety(speciesKey, nutritionNeeded = 0) {
        const safeNeed = Math.max(0, Math.ceil(nutritionNeeded || 0));
        if (safeNeed <= 0) {
            return { met: true, consumedNutrition: 0, shortage: 0 };
        }

        const availableNutrition = this.getSpeciesSatiety(speciesKey);
        const consumedNutrition = Math.min(availableNutrition, safeNeed);
        this.changeSpeciesSatiety(speciesKey, -consumedNutrition);

        return {
            met: consumedNutrition >= safeNeed,
            consumedNutrition,
            shortage: Math.max(0, safeNeed - consumedNutrition)
        };
    },

    getSpeciesHatchRequirements(speciesKey) {
        return (INSECT_HATCH_REQUIREMENTS[speciesKey] || []).map(requirement => ({
            materialKey: requirement.materialKey,
            count: Math.max(1, Math.floor(requirement.count || 1))
        }));
    },

    getSpeciesPreferredFoodKeys(speciesKey) {
        return [...(INSECT_FOOD_PREFERENCES[speciesKey] || [])];
    },

    getMaterialUsageSummary(materialKey) {
        const hatchUsageCount = this.getInsectSpeciesEntries().reduce((total, [speciesKey]) => {
            return total + (this.getSpeciesHatchRequirements(speciesKey).some(requirement => requirement.materialKey === materialKey) ? 1 : 0);
        }, 0);
        const materialConfig = this.getMaterialConfig(materialKey);
        const usageNotes = [];

        if (hatchUsageCount > 0) {
            usageNotes.push(`Dùng để ấp nở ${formatNumber(hatchUsageCount)} loài kỳ trùng.`);
        }

        if ((materialConfig?.nutrition || 0) > 0) {
            usageNotes.push(`Có thể dùng làm thức ăn, cung cấp ${formatNumber(materialConfig.nutrition || 0)} linh dưỡng.`);
        }

        return usageNotes.join(' ');
    },

    getSpeciesFoodDemand(speciesKey) {
        if (!this.needsSpeciesManualFeeding(speciesKey)) return 0;

        const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
        const careConfig = CONFIG.INSECT?.CARE || {};
        const foodPerInsect = Math.max(1, Math.floor(careConfig.FOOD_PER_INSECT || 1));
        return count * foodPerInsect;
    },

    getTotalFoodNutritionAvailable() {
        return this.getHabitatFoodNutritionAvailable();
    },

    getAvailableFoodNutritionForSpecies(speciesKey) {
        if (!this.needsSpeciesManualFeeding(speciesKey)) {
            return Number.POSITIVE_INFINITY;
        }

        const habitatKey = this.getSpeciesHabitatKey(speciesKey);
        const preferredKeys = this.getSpeciesPreferredFoodKeys(speciesKey);
        const allFoodKeys = Object.entries(CONFIG.ITEMS?.MATERIALS || {})
            .filter(([, materialConfig]) => (Number(materialConfig?.nutrition) || 0) > 0)
            .map(([materialKey]) => materialKey);
        const orderedKeys = [...preferredKeys, ...allFoodKeys.filter(materialKey => !preferredKeys.includes(materialKey))];

        return orderedKeys.reduce((total, materialKey) => {
            const materialConfig = this.getMaterialConfig(materialKey);
            const nutrition = Math.max(0, Number(materialConfig?.nutrition) || 0);
            if (nutrition <= 0) return total;
            return total + (this.getFoodStorageCount(materialKey, habitatKey) * nutrition);
        }, 0);
    },

    consumeFoodForSpecies(speciesKey, nutritionNeeded = 0) {
        if (!this.needsSpeciesManualFeeding(speciesKey)) {
            return { met: true, consumedNutrition: 0, consumedItems: [], shortage: 0 };
        }

        const habitatKey = this.getSpeciesHabitatKey(speciesKey);
        let remainingNutrition = Math.max(0, Math.ceil(nutritionNeeded || 0));
        const consumedItems = [];
        let consumedNutrition = 0;

        if (remainingNutrition <= 0) {
            return { met: true, consumedNutrition: 0, consumedItems, shortage: 0 };
        }

        const preferredKeys = this.getSpeciesPreferredFoodKeys(speciesKey);
        const allFoodKeys = Object.entries(CONFIG.ITEMS?.MATERIALS || {})
            .filter(([, materialConfig]) => (Number(materialConfig?.nutrition) || 0) > 0)
            .map(([materialKey]) => materialKey);
        const orderedKeys = [...preferredKeys, ...allFoodKeys.filter(materialKey => !preferredKeys.includes(materialKey))];

        orderedKeys.forEach(materialKey => {
            if (remainingNutrition <= 0) return;

            const materialConfig = this.getMaterialConfig(materialKey);
            const nutrition = Math.max(0, Number(materialConfig?.nutrition) || 0);
            if (nutrition <= 0) return;

            let availableCount = this.getFoodStorageCount(materialKey, habitatKey);
            while (availableCount > 0 && remainingNutrition > 0) {
                if (this.consumeStoredFood(materialKey, 1, habitatKey) <= 0) break;
                availableCount--;
                remainingNutrition -= nutrition;
                consumedNutrition += nutrition;

                const existing = consumedItems.find(entry => entry.materialKey === materialKey);
                if (existing) existing.count += 1;
                else consumedItems.push({ materialKey, count: 1 });
            }
        });

        return {
            met: remainingNutrition <= 0,
            consumedNutrition,
            consumedItems,
            shortage: Math.max(0, remainingNutrition)
        };
    },

    feedSpeciesNow(speciesKey, cycles = 1) {
        const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
        if (count <= 0) {
            return { success: false, reason: 'empty', consumedNutrition: 0, shortage: 0 };
        }

        if (!this.needsSpeciesManualFeeding(speciesKey)) {
            return { success: false, reason: 'rainbow', consumedNutrition: 0, shortage: 0 };
        }

        const nutritionNeeded = this.getSpeciesFoodDemand(speciesKey) * Math.max(1, Math.floor(cycles || 1));
        const feedResult = this.consumeFoodForSpecies(speciesKey, nutritionNeeded);
        if (feedResult.consumedNutrition > 0) {
            this.changeSpeciesSatiety(speciesKey, feedResult.consumedNutrition);
        }

        return {
            ...feedResult,
            success: feedResult.consumedNutrition > 0,
            reason: feedResult.met ? 'fed' : (feedResult.consumedNutrition > 0 ? 'partial' : 'no-food')
        };
    },

    feedAllSpeciesNow(cycles = 1) {
        const result = {
            fedSpecies: [],
            partialSpecies: [],
            totalNutrition: 0
        };

        this.getActiveInsectSpeciesKeys().forEach(speciesKey => {
            const feedResult = this.feedSpeciesNow(speciesKey, cycles);
            if (!feedResult.success) return;

            result.totalNutrition += feedResult.consumedNutrition || 0;
            if (feedResult.met) result.fedSpecies.push(speciesKey);
            else result.partialSpecies.push(speciesKey);
        });

        return result;
    },

    getSpeciesCareStatus(speciesKey) {
        const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
        const habitatKey = this.getSpeciesHabitatKey(speciesKey);
        const isRainbowHabitat = habitatKey === 'RAINBOW';
        const needsManualFeeding = this.needsSpeciesManualFeeding(speciesKey);
        const habitatCapacity = this.getBeastBagCapacity(speciesKey);
        const habitatFreeSlots = this.getInsectHabitatFreeSlots(speciesKey);
        const foodDemand = this.getSpeciesFoodDemand(speciesKey);
        const availableFood = isRainbowHabitat
            ? Number.POSITIVE_INFINITY
            : (needsManualFeeding ? this.getAvailableFoodNutritionForSpecies(speciesKey) : 0);
        const habitatConfig = this.getInsectHabitatConfig(speciesKey);
        const sexSummary = this.getSpeciesSexSummary(speciesKey);
        const leaderInfo = this.getSpeciesLeaderInfo(speciesKey);
        const storedSatiety = this.getSpeciesSatiety(speciesKey);
        const preferredFoodKeys = this.getSpeciesPreferredFoodKeys(speciesKey);
        const hasBreedingPair = count >= 2 && sexSummary.male > 0 && sexSummary.female > 0;
        const foodStorageNutrition = isRainbowHabitat
            ? Number.POSITIVE_INFINITY
            : (needsManualFeeding ? this.getHabitatFoodNutritionAvailable(habitatKey) : 0);

        return {
            speciesKey,
            count,
            habitatKey,
            hasHabitat: Boolean(habitatKey),
            habitatName: habitatConfig.fullName,
            isRainbowHabitat,
            habitatCapacity,
            habitatFreeSlots,
            foodDemand,
            availableFood,
            foodStorageNutrition,
            storedSatiety,
            sexSummary,
            leaderInfo,
            preferredFoodKeys,
            hasFood: isRainbowHabitat || foodDemand <= 0 || storedSatiety >= foodDemand,
            canFeed: needsManualFeeding && availableFood > 0,
            needsManualFeeding,
            canReproduce: hasBreedingPair
                && Boolean(habitatKey)
                && this.hasBeastCapacity(1, speciesKey)
                && (isRainbowHabitat || storedSatiety >= foodDemand || availableFood >= foodDemand)
        };
    },

    getHatchPreview(speciesKey, count = 1) {
        const species = this.getInsectSpecies(speciesKey);
        const requestedCount = Math.max(1, Math.floor(count || 1));
        const availableEggs = Math.max(0, Math.floor(this.insectEggs?.[speciesKey] || 0));
        const freeSlots = this.hasInsectHabitat(speciesKey)
            ? this.getInsectHabitatFreeSlots(speciesKey)
            : 0;
        const requirements = this.getSpeciesHatchRequirements(speciesKey).map(requirement => {
            const owned = this.getMaterialInventoryCount(requirement.materialKey);
            return {
                ...requirement,
                owned,
                enough: owned >= requirement.count * requestedCount
            };
        });
        const maxByMaterials = requirements.length
            ? requirements.reduce((minCount, requirement) => {
                const perEgg = Math.max(1, Math.floor(requirement.count || 1));
                return Math.min(minCount, Math.floor(requirement.owned / perEgg));
            }, Number.POSITIVE_INFINITY)
            : Number.POSITIVE_INFINITY;
        const hatchCount = species
            ? Math.min(requestedCount, availableEggs, freeSlots, maxByMaterials)
            : 0;
        let reason = 'ready';

        if (!species || availableEggs <= 0) reason = 'no-egg';
        else if (freeSlots <= 0) reason = 'full';
        else if (maxByMaterials <= 0) reason = 'materials';

        return {
            species,
            availableEggs,
            freeSlots,
            hatchCount,
            canHatch: hatchCount > 0,
            reason,
            requirements,
            hasHabitat: this.hasInsectHabitat(speciesKey),
            habitatName: this.getInsectHabitatConfig(speciesKey).fullName
        };
    },

    runBeastCareCycle() {
        const careConfig = CONFIG.INSECT?.CARE || {};
        const starvationDeathChance = Math.max(0, Math.min(1, Number(careConfig.STARVATION_DEATH_CHANCE) || 0));
        const wrongHabitatDeathChance = Math.max(0, Math.min(1, Number(careConfig.WRONG_HABITAT_DEATH_CHANCE) || 0));
        const breedChance = Math.max(0, Math.min(1, Number(careConfig.BREED_CHANCE_PER_CYCLE) || 0));
        const result = {
            consumedNutrition: 0,
            hungerLosses: [],
            habitatLosses: [],
            births: []
        };

        this.getActiveInsectSpeciesKeys().forEach(speciesKey => {
            const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
            if (count <= 0) return;

            const careStatus = this.getSpeciesCareStatus(speciesKey);
            const feedResult = this.consumeSpeciesSatiety(speciesKey, careStatus.foodDemand);
            result.consumedNutrition += feedResult.consumedNutrition || 0;

            if (!feedResult.met && Math.random() < starvationDeathChance) {
                if (this.changeTamedInsects(speciesKey, -1) < 0) {
                    result.hungerLosses.push(speciesKey);
                }
            }

            if (!this.hasInsectHabitat(speciesKey) && Math.random() < wrongHabitatDeathChance) {
                if (this.changeTamedInsects(speciesKey, -1) < 0) {
                    result.habitatLosses.push(speciesKey);
                }
            }

            if (this.getSpeciesCareStatus(speciesKey).canReproduce && Math.random() < breedChance) {
                this.changeTamedInsects(speciesKey, 1, { source: 'breed' });
                result.births.push(speciesKey);
            }
        });

        return result;
    },

    updateBeastCare() {
        if (!this.beastCare) {
            this.beastCare = { lastTickAt: performance.now(), lastAlertAt: 0 };
        }

        const totalBeasts = this.getTotalTamedInsectCount();
        const now = performance.now();
        if (totalBeasts <= 0) {
            this.beastCare.lastTickAt = now;
            return;
        }

        const careConfig = CONFIG.INSECT?.CARE || {};
        const intervalMs = Math.max(1000, Math.floor(careConfig.FEED_INTERVAL_MS || 30000));
        const maxCycles = Math.max(1, Math.floor(careConfig.MAX_CYCLES_PER_UPDATE || 5));
        const elapsed = now - Math.max(0, Number(this.beastCare.lastTickAt) || now);
        const cycleCount = Math.min(maxCycles, Math.floor(elapsed / intervalMs));
        if (cycleCount <= 0) return;

        const aggregate = {
            consumedNutrition: 0,
            hungerLosses: [],
            habitatLosses: [],
            births: []
        };

        for (let cycleIndex = 0; cycleIndex < cycleCount; cycleIndex++) {
            const cycleResult = this.runBeastCareCycle();
            aggregate.consumedNutrition += cycleResult.consumedNutrition || 0;
            aggregate.hungerLosses.push(...(cycleResult.hungerLosses || []));
            aggregate.habitatLosses.push(...(cycleResult.habitatLosses || []));
            aggregate.births.push(...(cycleResult.births || []));
        }

        this.beastCare.lastTickAt += cycleCount * intervalMs;
        if (now - this.beastCare.lastTickAt > intervalMs * maxCycles) {
            this.beastCare.lastTickAt = now;
        }

        if (aggregate.consumedNutrition > 0 || aggregate.hungerLosses.length || aggregate.habitatLosses.length || aggregate.births.length) {
            this.refreshResourceUI();
        }

        const canAlert = (now - Math.max(0, Number(this.beastCare.lastAlertAt) || 0)) >= Math.max(0, Math.floor(careConfig.ALERT_COOLDOWN_MS || 0));
        if (!canAlert || (!aggregate.hungerLosses.length && !aggregate.habitatLosses.length && !aggregate.births.length)) return;

        const formatLossSummary = (speciesKeys) => {
            const counts = speciesKeys.reduce((summary, speciesKey) => {
                summary[speciesKey] = (summary[speciesKey] || 0) + 1;
                return summary;
            }, {});

            return Object.entries(counts)
                .map(([speciesKey, count]) => `${formatNumber(count)} ${this.getInsectSpecies(speciesKey)?.name || speciesKey}`)
                .join(', ');
        };

        const notices = [];
        if (aggregate.hungerLosses.length) {
            notices.push(`Chết đói: ${formatLossSummary(aggregate.hungerLosses)}`);
        }
        if (aggregate.habitatLosses.length) {
            notices.push(`Sai Linh Thú Đại: ${formatLossSummary(aggregate.habitatLosses)}`);
        }
        if (aggregate.births.length) {
            notices.push(`Sinh nở: ${formatLossSummary(aggregate.births)}`);
        }

        showNotify(
            notices.join(' | '),
            aggregate.hungerLosses.length || aggregate.habitatLosses.length ? '#ff8a80' : '#79ffd4'
        );
        this.beastCare.lastAlertAt = now;
    },

    getBeastBagCapacity(speciesKey = null) {
        if (speciesKey) {
            return this.getInsectHabitatCapacity(speciesKey);
        }

        if (this.hasSevenColorSpiritBag()) {
            return Number.POSITIVE_INFINITY;
        }

        return Object.keys(this.insectHabitats || {})
            .filter(key => this.insectHabitats[key] && this.getInsectSpecies(key))
            .reduce((total, key) => total + this.getInsectHabitatCapacity(key), 0);
    },

    getTotalEggCount() {
        return Object.values(this.insectEggs || {}).reduce((total, count) => total + Math.max(0, Math.floor(count || 0)), 0);
    },

    getTotalTamedInsectCount() {
        return Object.values(this.tamedInsects || {}).reduce((total, count) => total + Math.max(0, Math.floor(count || 0)), 0);
    },

    getActiveInsectSpeciesKeys() {
        return Object.keys(this.tamedInsects || {}).filter(speciesKey => (this.tamedInsects[speciesKey] || 0) > 0);
    },

    isInsectSpeciesEnabledForCombat(speciesKey) {
        if (!this.getInsectSpecies(speciesKey)) return false;
        return this.insectCombatRoster?.[speciesKey] !== false;
    },

    setInsectSpeciesCombatEnabled(speciesKey, enabled = true) {
        const species = this.getInsectSpecies(speciesKey);
        const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
        if (!species || count <= 0) return false;

        if (!this.insectCombatRoster) this.insectCombatRoster = {};
        if (enabled) {
            delete this.insectCombatRoster[speciesKey];
        } else {
            this.insectCombatRoster[speciesKey] = false;
        }

        this.ensureValidAttackMode();
        return true;
    },

    toggleInsectSpeciesCombatEnabled(speciesKey) {
        const species = this.getInsectSpecies(speciesKey);
        if (!species) return false;

        const nextEnabled = !this.isInsectSpeciesEnabledForCombat(speciesKey);
        if (!this.setInsectSpeciesCombatEnabled(speciesKey, nextEnabled)) return false;

        showNotify(
            nextEnabled
                ? `${species.name} nhập trận.`
                : `${species.name} lưu lại dưỡng đàn.`,
            species.color || '#79ffd4'
        );

        return true;
    },

    getCombatReadyInsectSpeciesKeys() {
        return this.getActiveInsectSpeciesKeys().filter(speciesKey => this.isInsectSpeciesEnabledForCombat(speciesKey));
    },

});
