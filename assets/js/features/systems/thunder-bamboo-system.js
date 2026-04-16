(function () {
    const ROOT_MATERIAL_KEY = CONFIG.SWORD?.NURTURE_SYSTEM?.ROOT_MATERIAL_KEY || 'KIM_LOI_TRUC_ROOT';
    const CHUONG_THIEN_BINH_KEY = 'CHUONG_THIEN_BINH';
    const THANH_TRUC_SWORD_KEY = CONFIG.SWORD?.ARTIFACT_ITEM?.uniqueKey || 'THANH_TRUC_PHONG_VAN_KIEM';
    let sortedNurtureThresholds = null;
    const VOID_COLLAPSE_NOTIFY = 'Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục';

    function getNurtureConfig() {
        return CONFIG.SWORD?.NURTURE_SYSTEM || {};
    }

    function getChuongThienBinhConfig() {
        return CONFIG.ARTIFACTS?.[CHUONG_THIEN_BINH_KEY] || null;
    }

    function getSortedNurtureThresholds() {
        if (sortedNurtureThresholds) return sortedNurtureThresholds;

        const thresholds = getNurtureConfig().STAGE_THRESHOLDS;
        sortedNurtureThresholds = Array.isArray(thresholds)
            ? [...thresholds].sort((a, b) => clampFloor(a?.years || 0) - clampFloor(b?.years || 0))
            : [];

        return sortedNurtureThresholds;
    }

    function clampFloor(value, min = 0, max = Number.POSITIVE_INFINITY) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return min;
        return Math.max(min, Math.min(max, Math.floor(numericValue)));
    }

    function createItemInstanceKey(prefix = 'ITEM') {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function getCountdownLabel(ms) {
        const seconds = Math.max(1, Math.ceil(Math.max(0, ms) / 1000));
        return `${formatNumber(seconds)}s`;
    }

    function getShopSwordSellPrice() {
        const swordConfig = CONFIG.SWORD?.ARTIFACT_ITEM || {};
        const explicitPrice = clampFloor(swordConfig.sellPriceLowStone || 0);
        if (explicitPrice > 0) return explicitPrice;

        const buyPrice = clampFloor(swordConfig.buyPriceLowStone || 0);
        const sellbackRatio = Math.max(0, Number(swordConfig.sellbackRatio ?? CONFIG.ITEMS?.SELLBACK_RATIO ?? 0.5) || 0);
        return Math.max(1, Math.floor(buyPrice * sellbackRatio));
    }

    function getKimLoiTrucBaseName() {
        return CONFIG.ITEMS?.MATERIALS?.[ROOT_MATERIAL_KEY]?.fullName || 'Kim Lôi Trúc Mẫu';
    }

    const baseBuildInventoryKey = Input.buildInventoryKey;
    Input.buildInventoryKey = function (spec) {
        const baseKey = baseBuildInventoryKey.call(this, spec);
        return spec?.instanceKey ? `${baseKey}|${spec.instanceKey}` : baseKey;
    };

    const baseAddInventoryItem = Input.addInventoryItem;
    Input.addInventoryItem = function (spec, count = 1) {
        const item = baseAddInventoryItem.call(this, spec, count);
        if (!item || !spec) return item;

        if (spec.instanceKey) item.instanceKey = spec.instanceKey;
        if (Object.prototype.hasOwnProperty.call(spec, 'source')) item.source = spec.source || null;
        if (Object.prototype.hasOwnProperty.call(spec, 'nurtureYears')) item.nurtureYears = clampFloor(spec.nurtureYears || 0);
        if (Object.prototype.hasOwnProperty.call(spec, 'nurtureProgressMs')) item.nurtureProgressMs = clampFloor(spec.nurtureProgressMs || 0);
        if (Object.prototype.hasOwnProperty.call(spec, 'isNurturing')) item.isNurturing = Boolean(spec.isNurturing);
        if (Object.prototype.hasOwnProperty.call(spec, 'refineYears')) item.refineYears = clampFloor(spec.refineYears || 0);
        if (Object.prototype.hasOwnProperty.call(spec, 'powerRating')) item.powerRating = clampFloor(spec.powerRating || 0);
        if (Object.prototype.hasOwnProperty.call(spec, 'sellPriceLowStone')) item.sellPriceLowStone = clampFloor(spec.sellPriceLowStone || 0);
        if (Object.prototype.hasOwnProperty.call(spec, 'maxDurability')) item.maxDurability = clampFloor(spec.maxDurability || 0);
        if (Object.prototype.hasOwnProperty.call(spec, 'durability')) item.durability = clampFloor(spec.durability || 0);
        if (Object.prototype.hasOwnProperty.call(spec, 'breakWear')) item.breakWear = clampFloor(spec.breakWear || 0);
        if (Object.prototype.hasOwnProperty.call(spec, 'breakCount')) item.breakCount = clampFloor(spec.breakCount || 0);
        if (Object.prototype.hasOwnProperty.call(spec, 'equippedAt')) item.equippedAt = clampFloor(spec.equippedAt || 0);

        return item;
    };

    Input.isKimLoiTrucRootItem = function (item) {
        return Boolean(item && item.category === 'MATERIAL' && item.materialKey === ROOT_MATERIAL_KEY);
    };

    Input.isChuongThienBinhItem = function (item) {
        return Boolean(item && item.category === 'ARTIFACT' && item.uniqueKey === CHUONG_THIEN_BINH_KEY);
    };

    Input.isRefinedThanhTrucSword = function (item) {
        return Boolean(item && item.category === 'SWORD_ARTIFACT' && (item.source === 'REFINED' || clampFloor(item.refineYears || 0) > 0));
    };

    Input.getKimLoiTrucNurtureYears = function (item) {
        return clampFloor(item?.nurtureYears || 0, 0, clampFloor(getNurtureConfig().MAX_NURTURE_YEARS || 50000, 1));
    };

    Input.getKimLoiTrucStageMeta = function (yearsOrItem) {
        const years = typeof yearsOrItem === 'number'
            ? clampFloor(yearsOrItem)
            : this.getKimLoiTrucNurtureYears(yearsOrItem);
        const thresholds = getSortedNurtureThresholds();
        const baseName = getKimLoiTrucBaseName();
        let currentMeta = {
            years: 0,
            label: 'Kim Lôi Trúc Mẫu',
            displayName: baseName,
            visualStage: 'seed-core'
        };

        thresholds.forEach(entry => {
            if (years < clampFloor(entry?.years || 0)) return;

            const nextLabel = entry?.label || currentMeta.label;
            currentMeta = {
                years: clampFloor(entry?.years || 0),
                label: nextLabel,
                displayName: entry?.displayName || `${baseName} - ${nextLabel}`,
                visualStage: entry?.visualStage || currentMeta.visualStage
            };
        });

        return currentMeta;
    };

    Input.getKimLoiTrucStageLabel = function (yearsOrItem) {
        return this.getKimLoiTrucStageMeta(yearsOrItem).label;
    };

    Input.getKimLoiTrucDisplayName = function (yearsOrItem) {
        return this.getKimLoiTrucStageMeta(yearsOrItem).displayName;
    };

    Input.canRefineKimLoiTrucRoot = function (item) {
        return this.isKimLoiTrucRootItem(item) && this.getKimLoiTrucNurtureYears(item) >= clampFloor(getNurtureConfig().MIN_REFINE_YEARS || 10000, 1);
    };

    Input.getRefinedThanhTrucSwordPower = function (years) {
        const nurtureConfig = getNurtureConfig();
        const safeYears = clampFloor(years || 0);
        const basePower = clampFloor(nurtureConfig.REFINED_POWER_BASE || 100, 1);
        const powerPerYear = Math.max(0, Number(nurtureConfig.REFINED_POWER_PER_YEAR || 1) || 0);
        return Math.max(basePower, Math.round(basePower + (safeYears * powerPerYear)));
    };

    Input.getRefinedThanhTrucSwordSellPrice = function (years) {
        const nurtureConfig = getNurtureConfig();
        const powerRating = this.getRefinedThanhTrucSwordPower(years);
        const saleBase = clampFloor(nurtureConfig.REFINED_SELL_BASE || 800, 0);
        const sellPerPower = Math.max(0, Number(nurtureConfig.REFINED_SELL_PER_POWER || 10) || 0);
        return Math.max(1, Math.floor(saleBase + (powerRating * sellPerPower)));
    };

    Input.getKimLoiTrucRootEntries = function () {
        return Object.values(this.inventory || {})
            .filter(item => this.isKimLoiTrucRootItem(item) && item.count > 0)
            .sort((a, b) => {
                const yearDiff = this.getKimLoiTrucNurtureYears(b) - this.getKimLoiTrucNurtureYears(a);
                if (yearDiff !== 0) return yearDiff;
                return (a.key || '').localeCompare(b.key || '', 'vi');
            });
    };

    Input.getActiveKimLoiTrucRootItems = function () {
        const activeRoots = [];
        const inventory = this.inventory || {};

        for (const itemKey in inventory) {
            const item = inventory[itemKey];
            if (this.isKimLoiTrucRootItem(item) && item.count > 0 && item.isNurturing) {
                activeRoots.push(item);
            }
        }

        return activeRoots;
    };

    Input.findBestKimLoiTrucRootItem = function () {
        let bestItem = null;
        const inventory = this.inventory || {};

        for (const itemKey in inventory) {
            const item = inventory[itemKey];
            if (!this.isKimLoiTrucRootItem(item) || item.count <= 0) continue;

            if (!bestItem) {
                bestItem = item;
                continue;
            }

            const currentYears = this.getKimLoiTrucNurtureYears(item);
            const bestYears = this.getKimLoiTrucNurtureYears(bestItem);
            if (currentYears > bestYears) {
                bestItem = item;
                continue;
            }

            if (currentYears === bestYears && (item.key || '').localeCompare(bestItem.key || '', 'vi') < 0) {
                bestItem = item;
            }
        }

        return bestItem;
    };

    Input.getChuongThienBinhCooldownRemainingMs = function () {
        return Math.max(0, clampFloor(this.chuongThienBinhCooldownEndsAt || 0) - Date.now());
    };

    Input.hasChuongThienBinh = function () {
        if (this.hasUniquePurchase?.(CHUONG_THIEN_BINH_KEY)) {
            return true;
        }

        const inventory = this.inventory || {};
        for (const itemKey in inventory) {
            const item = inventory[itemKey];
            if (this.isChuongThienBinhItem(item) && item.count > 0) {
                return true;
            }
        }

        return false;
    };

    Input.isKimLoiTrucRootNurturing = function (item) {
        return this.isKimLoiTrucRootItem(item) && Boolean(item?.isNurturing);
    };

    Input.getKimLoiTrucAutoYearsPerSecond = function () {
        return Math.max(1, clampFloor(getNurtureConfig().AUTO_YEARS_PER_SECOND || 1, 1));
    };

    Input.getKimLoiTrucNurtureRateLabel = function () {
        return `${formatNumber(this.getKimLoiTrucAutoYearsPerSecond())} năm/giây`;
    };

    Input.ensureKimLoiTrucRuntimeState = function () {
        if (!this.kimLoiTrucRuntime || typeof this.kimLoiTrucRuntime !== 'object') {
            this.kimLoiTrucRuntime = {
                nextSaveAt: 0,
                uiRefreshScheduled: false
            };
        }

        return this.kimLoiTrucRuntime;
    };

    Input.isOverlayVisible = function (overlay) {
        return Boolean(overlay && overlay.style.display !== 'none' && overlay.classList.contains('show'));
    };

    Input.scheduleKimLoiTrucUiRefresh = function () {
        const runtime = this.ensureKimLoiTrucRuntimeState();
        if (runtime.uiRefreshScheduled) return false;

        const shouldRenderInventory = typeof InventoryUI !== 'undefined'
            && InventoryUI
            && typeof InventoryUI.render === 'function'
            && this.isOverlayVisible(InventoryUI.overlay);
        if (!shouldRenderInventory) return false;

        runtime.uiRefreshScheduled = true;
        setTimeout(() => {
            runtime.uiRefreshScheduled = false;
            if (typeof InventoryUI !== 'undefined'
                && InventoryUI
                && typeof InventoryUI.render === 'function'
                && this.isOverlayVisible(InventoryUI.overlay)) {
                InventoryUI.render();
            }
        }, 0);

        return true;
    };

    Input.nurtureKimLoiTrucRoot = function (item, yearsToAdd, { source = 'manual' } = {}) {
        if (!this.isKimLoiTrucRootItem(item)) return false;

        const nurtureConfig = getNurtureConfig();
        const addedYears = clampFloor(yearsToAdd || 0, 1);
        const maxYears = clampFloor(nurtureConfig.MAX_NURTURE_YEARS || 50000, 1);
        const beforeYears = this.getKimLoiTrucNurtureYears(item);
        const nextYears = Math.min(maxYears, beforeYears + addedYears);
        const gainedYears = Math.max(0, nextYears - beforeYears);

        if (gainedYears <= 0) {
            showNotify(
                `${this.getItemDisplayName(item)} đã đạt cực hạn ôn dưỡng ${formatNumber(maxYears)} năm.`,
                this.getItemQualityConfig(item).color || '#8ff7bf'
            );
            return false;
        }

        item.nurtureYears = nextYears;
        const stageLabel = this.getKimLoiTrucStageLabel(nextYears);
        const qualityColor = this.getItemQualityConfig(item).color || '#8ff7bf';
        const justUnlockedRefine = !this.canRefineKimLoiTrucRoot({ ...item, nurtureYears: beforeYears }) && this.canRefineKimLoiTrucRoot(item);
        const sourceText = source === 'artifact' ? 'Chưởng Thiên Bình quán chú' : 'Ôn dưỡng';
        const unlockText = justUnlockedRefine ? ' Đã đủ hỏa hầu để luyện kiếm.' : '';

        showNotify(
            `${sourceText} ${this.getItemDisplayName(item)}: +${formatNumber(gainedYears)} năm, hiện đạt ${formatNumber(nextYears)} năm (${stageLabel}).${unlockText}`,
            qualityColor
        );
        this.refreshResourceUI();
        return true;
    };

    function applyKimLoiTrucNurtureDelta(input, item, yearsToAdd) {
        if (!input.isKimLoiTrucRootItem(item)) {
            return { changed: false, gainedYears: 0 };
        }

        const nurtureConfig = getNurtureConfig();
        const addedYears = clampFloor(yearsToAdd || 0, 1);
        const maxYears = clampFloor(nurtureConfig.MAX_NURTURE_YEARS || 50000, 1);
        const beforeYears = input.getKimLoiTrucNurtureYears(item);
        const beforeStage = input.getKimLoiTrucStageLabel(beforeYears);
        const wasRefineReady = input.canRefineKimLoiTrucRoot(item);
        const nextYears = Math.min(maxYears, beforeYears + addedYears);
        const gainedYears = Math.max(0, nextYears - beforeYears);

        if (gainedYears <= 0) {
            return {
                changed: false,
                gainedYears: 0,
                maxYears,
                beforeYears,
                nextYears: beforeYears,
                beforeStage,
                afterStage: beforeStage,
                becameRefineReady: false,
                hitMax: beforeYears >= maxYears
            };
        }

        item.nurtureYears = nextYears;

        return {
            changed: true,
            gainedYears,
            maxYears,
            beforeYears,
            nextYears,
            beforeStage,
            afterStage: input.getKimLoiTrucStageLabel(nextYears),
            becameRefineReady: !wasRefineReady && input.canRefineKimLoiTrucRoot(item),
            hitMax: nextYears >= maxYears
        };
    }

    Input.nurtureKimLoiTrucRoot = function (item, yearsToAdd, { source = 'manual', silent = false, skipRefresh = false } = {}) {
        const result = applyKimLoiTrucNurtureDelta(this, item, yearsToAdd);
        const qualityColor = this.getItemQualityConfig(item).color || '#8ff7bf';

        if (!result.changed) {
            if (!silent && result.hitMax) {
                showNotify(
                    `${this.getItemDisplayName(item)} đã đạt cực hạn ôn dưỡng ${formatNumber(result.maxYears || 0)} năm.`,
                    qualityColor
                );
            }
            return false;
        }

        if (!silent) {
            const sourceText = source === 'artifact' ? 'Chưởng Thiên Bình quán chú' : 'Ôn dưỡng';
            const unlockText = result.becameRefineReady ? ' Đã đủ hỏa hầu để luyện kiếm.' : '';
            showNotify(
                `${sourceText} ${this.getItemDisplayName(item)}: +${formatNumber(result.gainedYears)} năm, hiện đạt ${formatNumber(result.nextYears)} năm (${result.afterStage}).${unlockText}`,
                qualityColor
            );
        }

        if (!skipRefresh) {
            this.scheduleKimLoiTrucUiRefresh();
            GameProgress.requestSave();
        }

        return true;
    };

    Input.useInventoryItemSpecial = function (itemKey) {
        const item = this.inventory?.[itemKey];
        if (!item || item.count <= 0) return false;

        if (!this.isKimLoiTrucRootItem(item) || !this.canRefineKimLoiTrucRoot(item)) {
            return false;
        }

        const nurtureYears = this.getKimLoiTrucNurtureYears(item);
        const powerRating = this.getRefinedThanhTrucSwordPower(nurtureYears);
        const sellPriceLowStone = this.getRefinedThanhTrucSwordSellPrice(nurtureYears);
        const refinedSwordSpec = {
            kind: 'UNIQUE',
            category: 'SWORD_ARTIFACT',
            quality: nurtureYears >= 720 ? 'SUPREME' : 'HIGH',
            uniqueKey: THANH_TRUC_SWORD_KEY,
            instanceKey: createItemInstanceKey(getNurtureConfig().REFINED_INSTANCE_PREFIX || 'THANH_TRUC_REFINED'),
            source: 'REFINED',
            refineYears: nurtureYears,
            powerRating,
            sellPriceLowStone,
            maxDurability: typeof this.getRefinedThanhTrucSwordDurability === 'function'
                ? this.getRefinedThanhTrucSwordDurability(nurtureYears)
                : 0,
            durability: typeof this.getRefinedThanhTrucSwordDurability === 'function'
                ? this.getRefinedThanhTrucSwordDurability(nurtureYears)
                : 0,
            breakWear: 0,
            breakCount: 0
        };

        delete this.inventory[itemKey];
        const addedItem = this.addInventoryItem(refinedSwordSpec, 1);
        if (!addedItem) {
            this.inventory[itemKey] = item;
            showNotify('Túi trữ vật đã đầy, không thể luyện kiếm lúc này.', '#ff8a80');
            return false;
        }

        showNotify(
            `Luyện thành ${this.getItemDisplayName(addedItem)}: ${formatNumber(nurtureYears)} năm ôn dưỡng hóa thành kiếm, uy năng ${formatNumber(powerRating)}.`,
            this.getItemQualityConfig(addedItem).color || '#66f0c2'
        );
        this.refreshResourceUI();
        return true;
    };

    Input.getAlchemyConfig = function () {
        return CONFIG.ALCHEMY || {};
    };

    Input.ensureAlchemyState = function () {
        if (!this.alchemyUnlockedRecipes || typeof this.alchemyUnlockedRecipes !== 'object') {
            this.alchemyUnlockedRecipes = {};
        }
        if (!this.alchemyFurnaces || typeof this.alchemyFurnaces !== 'object') {
            this.alchemyFurnaces = {};
        }
        if (typeof this.alchemySelectedFurnace !== 'string' || !this.alchemySelectedFurnace) {
            const firstOwned = Object.keys(this.alchemyFurnaces).find(key => this.alchemyFurnaces[key]);
            this.alchemySelectedFurnace = firstOwned || null;
        }
    };

    Input.getOwnedAlchemyFurnaceKeys = function () {
        this.ensureAlchemyState();
        return Object.entries(this.alchemyFurnaces || {})
            .filter(([, owned]) => Boolean(owned))
            .map(([furnaceKey]) => furnaceKey);
    };

    Input.getOwnedAlchemyRecipeKeys = function () {
        this.ensureAlchemyState();
        return Object.entries(this.alchemyUnlockedRecipes || {})
            .filter(([, owned]) => Boolean(owned))
            .map(([recipeKey]) => recipeKey);
    };

    Input.getAlchemyFurnaceConfig = function (furnaceKey) {
        return this.getAlchemyConfig().FURNACES?.[furnaceKey] || null;
    };

    Input.getSelectedAlchemyFurnaceKey = function () {
        this.ensureAlchemyState();
        const ownedKeys = this.getOwnedAlchemyFurnaceKeys();
        if (this.alchemySelectedFurnace && ownedKeys.includes(this.alchemySelectedFurnace)) {
            return this.alchemySelectedFurnace;
        }
        const fallback = ownedKeys[0] || null;
        this.alchemySelectedFurnace = fallback;
        return fallback;
    };

    Input.selectAlchemyFurnace = function (furnaceKey) {
        this.ensureAlchemyState();
        if (!furnaceKey || !this.alchemyFurnaces[furnaceKey]) return false;
        this.alchemySelectedFurnace = furnaceKey;
        return true;
    };

    Input.getCurrentAlchemyFurnaceConfig = function () {
        const selectedKey = this.getSelectedAlchemyFurnaceKey();
        if (selectedKey) return this.getAlchemyFurnaceConfig(selectedKey);
        return null;
    };

    Input.getAlchemyRecipesForMaterial = function (materialKey) {
        const alchemyConfig = this.getAlchemyConfig();
        const recipeMap = alchemyConfig.MATERIAL_RECIPE_MAP || {};
        const recipeKeys = Array.isArray(recipeMap[materialKey]) ? recipeMap[materialKey] : [];
        const recipeDefs = typeof this.getAlchemyRecipeDefinitions === 'function'
            ? this.getAlchemyRecipeDefinitions()
            : (alchemyConfig.RECIPES || {});

        return recipeKeys
            .map(recipeKey => ({
                key: recipeKey,
                ...(recipeDefs[recipeKey] || {})
            }))
            .filter(recipe => recipe && recipe.name && recipe.output && Array.isArray(recipe.ingredients));
    };

    Input.getRecipeOwnedIngredientCount = function (materialKey) {
        return Object.values(this.inventory || {}).reduce((total, entry) => {
            if (!entry || entry.category !== 'MATERIAL' || entry.materialKey !== materialKey) return total;
            return total + Math.max(0, Math.floor(Number(entry.count) || 0));
        }, 0);
    };

    Input.canUseHuThienDinhForAlchemy = function () {
        const alchemyConfig = this.getAlchemyConfig();
        if (!alchemyConfig.ENABLED) return false;
        const hasFurnace = this.getOwnedAlchemyFurnaceKeys().length > 0;
        const hasHuThien = this.hasArtifactUnlocked('HU_THIEN_DINH') && this.isArtifactDeployed('HU_THIEN_DINH');
        if (!alchemyConfig.REQUIRES_HU_THIEN_DINH) return hasFurnace || hasHuThien;
        return hasHuThien || hasFurnace;
    };

    Input.canUseAlchemyRecipe = function (recipeKey) {
        this.ensureAlchemyState();
        return Boolean(this.alchemyUnlockedRecipes?.[recipeKey]);
    };

    Input.getAlchemyBatchRemainingMs = function () {
        const completeAt = Number(this.alchemyBatch?.completeAt) || 0;
        if (!completeAt) return 0;
        return Math.max(0, completeAt - Date.now());
    };

    Input.isAlchemyBatchActive = function () {
        return Boolean(this.alchemyBatch && !this.alchemyBatch.resolved && this.getAlchemyBatchRemainingMs() > 0);
    };

    Input.resolveAlchemyBatch = function () {
        const batch = this.alchemyBatch;
        if (!batch || batch.resolved) return false;
        if (this.getAlchemyBatchRemainingMs() > 0) return false;

        const recipe = typeof this.getAlchemyRecipeByKey === 'function'
            ? this.getAlchemyRecipeByKey(batch.recipeKey)
            : this.getAlchemyConfig().RECIPES?.[batch.recipeKey];
        const outputName = this.getItemDisplayName({ category: batch.outputCategory, quality: batch.outputQuality });
        const count = Math.max(0, Math.floor(Number(batch.outputCount) || 0));
        for (let i = 0; i < count; i++) {
            this.addInventoryItem({
                kind: 'PILL',
                category: batch.outputCategory,
                quality: batch.outputQuality,
                realmKey: batch.outputRealmKey || null,
                realmName: batch.outputRealmName || null,
                specialKey: batch.outputSpecialKey || null,
                source: 'ALCHEMY'
            }, 1);
        }

        const furnaceName = this.getAlchemyFurnaceConfig(batch.furnaceKey)?.name || 'Hư Thiên Đỉnh';
        if (count > 0) {
            showNotify(
                `${furnaceName} đã luyện xong ${formatNumber(count)} ${outputName}${recipe?.name ? ` từ ${recipe.name}` : ''}.`,
                this.getAlchemyConfig().NOTIFY_COLOR || '#93c8d8'
            );
        } else {
            showNotify(`${furnaceName} luyện đan thất bại, mẻ đan hóa tro.`, '#ff8a80');
        }
        this.alchemyBatch = null;
        this.refreshResourceUI();
        return true;
    };

    Input.tickAlchemyBatch = function () {
        if (!this.alchemyBatch) return;
        this.resolveAlchemyBatch();
    };

    Input.canCraftAlchemyRecipe = function (recipe) {
        if (!recipe || !Array.isArray(recipe.ingredients)) return false;
        if (!this.canUseHuThienDinhForAlchemy()) return false;
        if (!this.canUseAlchemyRecipe(recipe.key)) return false;
        if (this.isAlchemyBatchActive()) return false;

        return recipe.ingredients.every(ingredient => {
            const need = Math.max(1, Math.floor(Number(ingredient.count) || 0));
            const owned = this.getRecipeOwnedIngredientCount(ingredient.materialKey);
            return owned >= need;
        });
    };

    Input.getBestAvailableAlchemyRecipe = function (materialKey) {
        const recipes = this.getAlchemyRecipesForMaterial(materialKey);
        if (!recipes.length) return null;
        return recipes.find(recipe => this.canCraftAlchemyRecipe(recipe)) || recipes[0];
    };

    Input.craftAlchemyRecipe = function (recipeKey) {
        const alchemyConfig = this.getAlchemyConfig();
        const recipe = typeof this.getAlchemyRecipeByKey === 'function'
            ? this.getAlchemyRecipeByKey(recipeKey)
            : alchemyConfig.RECIPES?.[recipeKey];
        if (!recipe || !recipe.output || !Array.isArray(recipe.ingredients)) return false;

        const huThienColor = this.getArtifactConfig('HU_THIEN_DINH')?.color || alchemyConfig.NOTIFY_COLOR || '#93c8d8';
        if (!this.canUseHuThienDinhForAlchemy()) {
            showNotify('Cần luyện hóa và triển khai Hư Thiên Đỉnh mới có thể khai đỉnh luyện đan.', huThienColor);
            return false;
        }
        if (!this.canUseAlchemyRecipe(recipeKey)) {
            showNotify('Chưa sở hữu đan phương này. Hãy mua ở Thiên Bảo Các.', '#ffd36b');
            return false;
        }
        if (this.isAlchemyBatchActive()) {
            showNotify('Đan lô đang bận luyện mẻ trước, hãy chờ hoàn thành.', '#ffd36b');
            return false;
        }

        const missing = recipe.ingredients.find(ingredient => {
            const need = Math.max(1, Math.floor(Number(ingredient.count) || 0));
            return this.getRecipeOwnedIngredientCount(ingredient.materialKey) < need;
        });
        if (missing) {
            const materialCfg = this.getMaterialConfig(missing.materialKey);
            showNotify(
                `Thiếu ${materialCfg?.fullName || missing.materialKey} để luyện ${recipe.name}.`,
                '#ff8a80'
            );
            return false;
        }

        recipe.ingredients.forEach(ingredient => {
            const need = Math.max(1, Math.floor(Number(ingredient.count) || 0));
            this.consumeMaterial(ingredient.materialKey, need);
        });

        const output = recipe.output || {};
        const baseCount = Math.max(1, Math.floor(Number(output.count) || 1));
        const hasHuThien = this.hasArtifactUnlocked('HU_THIEN_DINH') && this.isArtifactDeployed('HU_THIEN_DINH');
        const selectedFurnaceKey = hasHuThien ? 'HU_THIEN_DINH' : this.getSelectedAlchemyFurnaceKey();
        const selectedFurnace = hasHuThien
            ? { name: 'Hư Thiên Đỉnh', brewTimeMultiplier: 0.58, successRate: 0.98, outputMultiplier: 2.1 }
            : (this.getAlchemyFurnaceConfig(selectedFurnaceKey) || { name: 'Đan lư', brewTimeMultiplier: 1, successRate: 0.75, outputMultiplier: 1 });

        const recipeTimeMs = Math.max(1000, Math.floor(Number(recipe.brewTimeMs) || Number(alchemyConfig.DEFAULT_BREW_MS) || 30000));
        const brewTimeMs = Math.max(1000, Math.floor(recipeTimeMs * (selectedFurnace.brewTimeMultiplier || 1)));
        const successRoll = Math.random();
        const successRate = Math.max(0, Math.min(1, Number(selectedFurnace.successRate) || 0));
        const success = successRoll <= successRate;
        const outputCount = success
            ? Math.max(1, Math.floor(baseCount * (Number(selectedFurnace.outputMultiplier) || 1)))
            : 0;

        this.alchemyBatch = {
            recipeKey,
            furnaceKey: selectedFurnaceKey || 'HU_THIEN_DINH',
            startedAt: Date.now(),
            completeAt: Date.now() + brewTimeMs,
            outputCount,
            outputCategory: output.category || 'EXP',
            outputQuality: output.quality || 'LOW',
            outputRealmKey: output.realmKey || null,
            outputRealmName: output.realmName || null,
            outputSpecialKey: output.specialKey || null,
            resolved: false
        };
        showNotify(
            `${selectedFurnace.name} bắt đầu luyện ${recipe.name}. Thời gian: ${getCountdownLabel(brewTimeMs)}.`,
            huThienColor
        );
        this.refreshResourceUI();
        return true;
    };

    Input.craftAlchemyFromMaterialItem = function (item) {
        if (!item || item.category !== 'MATERIAL') return false;

        const recipe = this.getBestAvailableAlchemyRecipe(item.materialKey);
        if (!recipe?.key) return false;
        return this.craftAlchemyRecipe(recipe.key);
    };

    Input.useChuongThienBinh = function (item) {
        const qualityConfig = this.getItemQualityConfig(item);
        const cooldownRemainingMs = this.getChuongThienBinhCooldownRemainingMs();
        if (cooldownRemainingMs > 0) {
            showNotify(
                `${this.getItemDisplayName(item)} đang hồi phục, còn ${getCountdownLabel(cooldownRemainingMs)}.`,
                qualityConfig.color || '#8fffe0'
            );
            return false;
        }

        const targetRoot = this.findBestKimLoiTrucRootItem();
        if (!targetRoot) {
            showNotify('Chưa có Kim Lôi Trúc Mẫu trong túi để gia tốc ôn dưỡng.', qualityConfig.color || '#ffd36b');
            return false;
        }

        const chuongConfig = getChuongThienBinhConfig() || {};
        const bonusYears = clampFloor(chuongConfig.nurtureBoostYears || getNurtureConfig().CHUONG_ACCELERATION_YEARS || 180, 1);
        const cooldownMs = clampFloor(chuongConfig.cooldownMs || 60000, 0);
        const nurtured = this.nurtureKimLoiTrucRoot(targetRoot, bonusYears, { source: 'artifact' });

        if (!nurtured) return false;

        this.chuongThienBinhCooldownEndsAt = Date.now() + cooldownMs;
        this.refreshResourceUI();
        return true;
    };

    Input.canUseChuongThienBinhOnTarget = function (target) {
        if (this.isVoidCollapsed || !this.hasChuongThienBinh()) return false;
        if (this.getChuongThienBinhCooldownRemainingMs() > 0) return false;

        if (this.isKimLoiTrucRootItem(target)) {
            return true;
        }

        if (target?.category === 'SWORD_ARTIFACT') {
            const maxDurability = clampFloor(target.maxDurability || 0, 0);
            const durability = clampFloor(target.durability || 0, 0);
            return maxDurability > 0 && durability < maxDurability;
        }

        const swordState = typeof target === 'string'
            ? this.getEquippedSwordArtifactByKey?.(target)
            : (target?.instanceKey ? this.getEquippedSwordArtifactByKey?.(target.instanceKey) || target : null);
        if (!swordState) return false;

        return this.isSwordArtifactDamaged?.(swordState) || false;
    };

    Input.useChuongThienBinhOnTarget = function (target) {
        if (!this.hasChuongThienBinh()) {
            showNotify('Chưa có Chưởng Thiên Bình để quán chú mục tiêu này.', '#ffd36b');
            return false;
        }

        const cooldownRemainingMs = this.getChuongThienBinhCooldownRemainingMs();
        if (cooldownRemainingMs > 0) {
            showNotify(
                `Chưởng Thiên Bình đang hồi phục, còn ${getCountdownLabel(cooldownRemainingMs)}.`,
                getChuongThienBinhConfig()?.color || '#8fffe0'
            );
            return false;
        }

        const chuongConfig = getChuongThienBinhConfig() || {};
        const cooldownMs = clampFloor(chuongConfig.cooldownMs || 60000, 0);

        if (this.isKimLoiTrucRootItem(target)) {
            const bonusYears = clampFloor(chuongConfig.nurtureBoostYears || getNurtureConfig().CHUONG_ACCELERATION_YEARS || 180, 1);
            const nurtured = this.nurtureKimLoiTrucRoot(target, bonusYears, { source: 'artifact' });
            if (!nurtured) return false;

            this.chuongThienBinhCooldownEndsAt = Date.now() + cooldownMs;
            this.refreshResourceUI();
            return true;
        }

        if (target?.category === 'SWORD_ARTIFACT') {
            const maxDurability = clampFloor(target.maxDurability || 0, 0);
            const durability = clampFloor(target.durability || 0, 0);
            if (maxDurability <= 0 || durability >= maxDurability) {
                return false;
            }

            target.durability = maxDurability;
            target.breakWear = 0;
            this.chuongThienBinhCooldownEndsAt = Date.now() + cooldownMs;
            showNotify(
                `${this.getItemDisplayName(target)} đã được Chưởng Thiên Bình phục hồi ${formatNumber(maxDurability)}/${formatNumber(maxDurability)} độ bền.`,
                this.getItemQualityConfig(target).color || '#66f0c2'
            );
            this.refreshResourceUI();
            GameProgress.requestSave();
            return true;
        }

        const swordState = typeof target === 'string'
            ? this.getEquippedSwordArtifactByKey?.(target)
            : (target?.instanceKey ? this.getEquippedSwordArtifactByKey?.(target.instanceKey) || target : null);
        if (!swordState || !this.isSwordArtifactDamaged?.(swordState)) {
            return false;
        }

        const repaired = this.repairSwordArtifactDurability?.(swordState, { silent: true });
        if (!repaired) return false;

        this.chuongThienBinhCooldownEndsAt = Date.now() + cooldownMs;
        showNotify(
            `${this.getItemDisplayName({ category: 'SWORD_ARTIFACT', quality: 'HIGH' })} đã được Chưởng Thiên Bình quán chú, độ bền trở lại viên mãn.`,
            (this.getThanhTrucSwordArtifactConfig?.() || {}).color || '#66f0c2'
        );
        this.refreshResourceUI();
        return true;
    };

    Input.toggleKimLoiTrucAutoNurture = function (item) {
        if (!this.isKimLoiTrucRootItem(item)) return false;

        const qualityColor = this.getItemQualityConfig(item).color || '#8ff7bf';
        item.isNurturing = !item.isNurturing;
        item.nurtureProgressMs = clampFloor(item.nurtureProgressMs || 0);

        showNotify(
            item.isNurturing
                ? `${this.getItemDisplayName(item)} bắt đầu ôn dưỡng tự động với tốc độ ${this.getKimLoiTrucNurtureRateLabel()}.`
                : `${this.getItemDisplayName(item)} tạm dừng ôn dưỡng ở mốc ${formatNumber(this.getKimLoiTrucNurtureYears(item))} năm.`,
            qualityColor
        );

        this.scheduleKimLoiTrucUiRefresh();
        GameProgress.requestSave();
        return true;
    };

    Input.updateKimLoiTrucAutoNurture = function (dt) {
        if (document.visibilityState !== 'visible') return;

        const runtime = this.ensureKimLoiTrucRuntimeState();
        const nurtureConfig = getNurtureConfig();
        const yearsPerSecond = this.getKimLoiTrucAutoYearsPerSecond();
        const msPerYear = Math.max(1, Math.round(1000 / yearsPerSecond));
        const safeDtMs = Math.max(0, Math.min(250, Math.round((Number(dt) || 0) * 1000)));
        const now = Date.now();
        const activeRoots = this.getActiveKimLoiTrucRootItems();

        if (!activeRoots.length) {
            return;
        }

        let shouldSave = false;

        activeRoots.forEach(item => {
            item.nurtureProgressMs = clampFloor(item.nurtureProgressMs || 0) + safeDtMs;
            const gainedYears = Math.floor(item.nurtureProgressMs / msPerYear);
            if (gainedYears <= 0) return;

            item.nurtureProgressMs %= msPerYear;
            const result = applyKimLoiTrucNurtureDelta(this, item, gainedYears);
            if (!result.changed) {
                item.isNurturing = false;
                item.nurtureProgressMs = 0;
                return;
            }

            shouldSave = true;

            if (result.beforeStage !== result.afterStage) {
                showNotify(
                    `${this.getItemDisplayName(item)} tiến vào tầng ôn dưỡng ${result.afterStage}.`,
                    this.getItemQualityConfig(item).color || '#8ff7bf'
                );
            }

            if (result.becameRefineReady) {
                showNotify(
                    `${this.getItemDisplayName(item)} đã đủ hỏa hầu, có thể luyện thành Thanh Trúc Phong Vân Kiếm.`,
                    this.getItemQualityConfig(item).color || '#8ff7bf'
                );
            }

            if (result.hitMax) {
                item.isNurturing = false;
                item.nurtureProgressMs = 0;
                showNotify(
                    `${this.getItemDisplayName(item)} đã đạt cực hạn ôn dưỡng ${formatNumber(result.maxYears)} năm.`,
                    this.getItemQualityConfig(item).color || '#8ff7bf'
                );
            }
        });

        if (shouldSave && now >= (runtime.nextSaveAt || 0)) {
            runtime.nextSaveAt = now + clampFloor(nurtureConfig.AUTO_SAVE_INTERVAL_MS || 5000, 1000);
            GameProgress.requestSave();
        }
    };

    const baseGetItemDisplayName = Input.getItemDisplayName;
    Input.getItemDisplayName = function (item) {
        if (this.isKimLoiTrucRootItem(item)) {
            return this.getKimLoiTrucDisplayName(item);
        }

        return baseGetItemDisplayName.call(this, item);
    };

    const baseGetItemDescription = Input.getItemDescription;
    Input.getItemDescription = function (item) {
        if (this.isKimLoiTrucRootItem(item)) {
            const qualityConfig = this.getItemQualityConfig(item);
            const nurtureConfig = getNurtureConfig();
            const chuongConfig = getChuongThienBinhConfig() || {};
            const nurtureYears = this.getKimLoiTrucNurtureYears(item);
            const minRefineYears = clampFloor(nurtureConfig.MIN_REFINE_YEARS || 10000, 1);
            const remainingYears = Math.max(0, minRefineYears - nurtureYears);
            const canRefine = this.canRefineKimLoiTrucRoot(item);
            const cooldownRemainingMs = this.getChuongThienBinhCooldownRemainingMs();
            const hasChuongThienBinh = this.hasChuongThienBinh();

            return [
                qualityConfig.description || 'Kim Lôi Trúc Mẫu ẩn chứa lôi mộc linh cơ.',
                `Trạng thái hiện tại: ${this.getKimLoiTrucStageLabel(nurtureYears)} sau ${formatNumber(nurtureYears)} năm ôn dưỡng.`,
                `Tốc độ ôn dưỡng tự động: ${this.getKimLoiTrucNurtureRateLabel()}. Chỉ cần khởi động một lần, linh mộc sẽ tự tăng trưởng theo thời gian.`,
                this.isKimLoiTrucRootNurturing(item)
                    ? 'Trạng thái: đang ôn dưỡng.'
                    : 'Trạng thái: tạm ngừng ôn dưỡng.',
                canRefine
                    ? 'Đã đủ hỏa hầu để luyện thành Thanh Trúc Phong Vân Kiếm; tiếp tục ôn dưỡng sẽ khiến kiếm thành phẩm mạnh hơn và bán lại đắt hơn.'
                    : `Còn thiếu ${formatNumber(remainingYears)} năm ôn dưỡng để luyện kiếm.`,
                `Chưởng Thiên Bình có thể gia tốc thêm ${formatNumber(clampFloor(chuongConfig.nurtureBoostYears || nurtureConfig.CHUONG_ACCELERATION_YEARS || 180, 1))} năm mỗi ${formatNumber(Math.max(1, Math.round((chuongConfig.cooldownMs || 60000) / 1000)))} giây cho Kim Lôi Trúc Mẫu.`,
                hasChuongThienBinh
                    ? (cooldownRemainingMs > 0
                        ? `Chưởng Thiên Bình đang hồi phục, còn ${getCountdownLabel(cooldownRemainingMs)}.`
                        : 'Chưởng Thiên Bình hiện có thể dùng ngay.')
                    : 'Nếu sở hữu Chưởng Thiên Bình, có thể thúc chín Kim Lôi Trúc Mẫu cực nhanh.'
            ].join(' ');
        }

        if (this.isChuongThienBinhItem(item)) {
            const qualityConfig = this.getItemQualityConfig(item);
            const chuongConfig = getChuongThienBinhConfig() || {};
            const cooldownRemainingMs = this.getChuongThienBinhCooldownRemainingMs();
            const targetRoot = this.findBestKimLoiTrucRootItem();

            return [
                qualityConfig.description || 'Huyền thiên chi bảo liên quan đến pháp tắc thời gian.',
                `Mỗi lần thúc động gia tốc ${formatNumber(clampFloor(chuongConfig.nurtureBoostYears || getNurtureConfig().CHUONG_ACCELERATION_YEARS || 180, 1))} năm ôn dưỡng cho Kim Lôi Trúc Mẫu có tiến độ cao nhất.`,
                `Thời gian hồi: ${formatNumber(Math.max(1, Math.round((chuongConfig.cooldownMs || 60000) / 1000)))} giây.`,
                targetRoot
                    ? `Mục tiêu hiện tại đã có ${formatNumber(this.getKimLoiTrucNurtureYears(targetRoot))} năm ôn dưỡng.`
                    : 'Hiện chưa có Kim Lôi Trúc Mẫu nào trong túi để gia tốc.',
                cooldownRemainingMs > 0
                    ? `Bình đang hồi phục, còn ${getCountdownLabel(cooldownRemainingMs)}.`
                    : 'Bình đang rảnh, có thể thúc động ngay.'
            ].join(' ');
        }

        if (item?.category === 'MATERIAL') {
            const baseDescription = baseGetItemDescription.call(this, item);
            const recipes = this.getAlchemyRecipesForMaterial(item.materialKey);
            if (!recipes.length) return baseDescription;

            const recipeText = recipes.map(recipe => {
                const canCraft = this.canCraftAlchemyRecipe(recipe);
                return `${recipe.name} (${recipe.realmTier || 'Đan'}): ${canCraft ? 'đủ linh dược' : 'chưa đủ linh dược'}`;
            }).join(' • ');

            return `${baseDescription} Đan phương liên quan: ${recipeText}.`;
        }

        if (item?.category === 'SWORD_ARTIFACT') {
            const baseDescription = baseGetItemDescription.call(this, item);
            const sellPrice = this.getInventorySellPrice(item);

            if (this.isRefinedThanhTrucSword(item)) {
                const refineYears = clampFloor(item.refineYears || 0);
                const powerRating = clampFloor(item.powerRating || this.getRefinedThanhTrucSwordPower(refineYears), 1);
                return `${baseDescription} Kiếm này được tự luyện từ Kim Lôi Trúc Mẫu đã ôn dưỡng ${formatNumber(refineYears)} năm, uy năng ${formatNumber(powerRating)} (${this.getKimLoiTrucStageLabel(refineYears)}). Giá bán lại hiện tại: ${formatNumber(sellPrice)} hạ phẩm linh thạch.`;
            }

            return `${baseDescription} Giá bán lại tại cửa hàng: ${formatNumber(sellPrice)} hạ phẩm linh thạch mỗi thanh.`;
        }

        return baseGetItemDescription.call(this, item);
    };

    const baseGetInventorySellPrice = Input.getInventorySellPrice;
    Input.getInventorySellPrice = function (item) {
        if (!item) return 0;

        if (this.isKimLoiTrucRootItem(item) && clampFloor(item.sellPriceLowStone || 0) > 0) {
            return clampFloor(item.sellPriceLowStone || 0, 1);
        }

        if (item.category === 'SWORD_ARTIFACT') {
            if (this.isRefinedThanhTrucSword(item)) {
                return clampFloor(item.sellPriceLowStone || this.getRefinedThanhTrucSwordSellPrice(item.refineYears || 0), 1);
            }
            return clampFloor(item.sellPriceLowStone || getShopSwordSellPrice(), 1);
        }

        return baseGetInventorySellPrice.call(this, item);
    };

    const baseIsInventoryItemUsable = Input.isInventoryItemUsable;
    Input.isInventoryItemUsable = function (item) {
        if (this.isKimLoiTrucRootItem(item)) {
            return !this.isVoidCollapsed;
        }

        if (this.isChuongThienBinhItem(item)) {
            return !this.isVoidCollapsed
                && Boolean(this.findBestKimLoiTrucRootItem())
                && this.getChuongThienBinhCooldownRemainingMs() <= 0;
        }

        return baseIsInventoryItemUsable.call(this, item);
    };

    Input.getInventoryItemActionLabel = function (item) {
        if (this.isKimLoiTrucRootItem(item)) {
            const nurtureYears = this.getKimLoiTrucNurtureYears(item);
            return nurtureYears > 0 || this.isKimLoiTrucRootNurturing(item)
                ? `${formatNumber(nurtureYears)} năm`
                : 'Ôn dưỡng';
        }

        if (this.isChuongThienBinhItem(item)) {
            const cooldownRemainingMs = this.getChuongThienBinhCooldownRemainingMs();
            if (!this.findBestKimLoiTrucRootItem()) {
                return 'Chưa có trúc';
            }
            if (cooldownRemainingMs > 0) {
                return `Hồi ${getCountdownLabel(cooldownRemainingMs)}`;
            }
            return getChuongThienBinhConfig()?.inventoryActionLabel || 'Gia tốc';
        }

        if (item.category === 'SWORD_ARTIFACT') {
            return CONFIG.SWORD?.ARTIFACT_ITEM?.inventoryActionLabel || 'Triển khai';
        }
        if (item.category === 'SWORD_ART') {
            return CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.inventoryActionLabel || 'Lĩnh ngộ';
        }
        if (item.category === 'FLAME_ART') {
            return CONFIG.SECRET_ARTS?.CAN_LAM_BANG_DIEM?.inventoryActionLabel || 'Luyện hóa';
        }
        if (item.category === 'ARTIFACT') {
            return CONFIG.ARTIFACTS?.[item.uniqueKey]?.inventoryActionLabel || 'Luyện hóa';
        }
        if (item.category === 'INSECT_SKILL') {
            return CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.inventoryActionLabel || 'Lĩnh ngộ';
        }
        if (item.category === 'BREAKTHROUGH' && !this.isInventoryItemUsable(item)) {
            return `Chờ ${item.realmName}`;
        }

        return 'Dùng';
    };

    Input.getInventoryItemSecondaryAction = function (item) {
        if (this.isKimLoiTrucRootItem(item) && this.canRefineKimLoiTrucRoot(item)) {
            return {
                type: 'special',
                label: 'Luyện kiếm',
                disabled: false
            };
        }

        return null;
    };

    const baseUseInventoryItem = Input.useInventoryItem;
    Input.useInventoryItem = function (itemKey) {
        const item = this.inventory?.[itemKey];
        if (!item || item.count <= 0) return false;

        if (this.isVoidCollapsed) {
            showNotify(VOID_COLLAPSE_NOTIFY, '#a778ff');
            return false;
        }

        if (this.isKimLoiTrucRootItem(item)) {
            return this.toggleKimLoiTrucAutoNurture(item);
        }

        if (this.isChuongThienBinhItem(item)) {
            return this.useChuongThienBinh(item);
        }

        return baseUseInventoryItem.call(this, itemKey);
    };

    const baseUpdate = Input.update;
    Input.update = function (dt) {
        baseUpdate.call(this, dt);
        if (!this.isVoidCollapsed) {
            this.updateKimLoiTrucAutoNurture(dt);
        }
    };

    const baseBuyShopItem = Input.buyShopItem;
    Input.buyShopItem = function (itemId) {
        const item = this.getShopItems().find(entry => entry.id === itemId);
        if (!item) return false;

        if (item.category === 'MATERIAL' && item.materialKey === ROOT_MATERIAL_KEY) {
            if (this.isVoidCollapsed) {
                showNotify(VOID_COLLAPSE_NOTIFY, '#a778ff');
                return false;
            }

            const qualityConfig = this.getItemQualityConfig(item);
            const rootSellPrice = Math.max(
                1,
                Math.floor(clampFloor(item.priceLowStone || 0) * Math.max(0, Number(getNurtureConfig().ROOT_SELLBACK_RATIO || 0.5) || 0))
            );
            const instanceSpec = {
                ...item,
                instanceKey: createItemInstanceKey(getNurtureConfig().ROOT_INSTANCE_PREFIX || 'KIM_LOI_TRUC_ROOT'),
                source: 'ROOT',
                nurtureYears: 0,
                nurtureProgressMs: 0,
                isNurturing: false,
                sellPriceLowStone: rootSellPrice
            };

            if (!this.hasInventorySpaceForSpec(instanceSpec)) {
                showNotify('Túi trữ vật đã đầy, không thể mua thêm vật phẩm mới.', '#ff8a80');
                return false;
            }

            if (!this.spendSpiritStones(item.priceLowStone)) {
                showNotify('Linh thạch không đủ để giao dịch', '#ff8a80');
                return false;
            }

            const addedItem = this.addInventoryItem(instanceSpec, 1);
            if (!addedItem) {
                this.setSpiritStoneTotalValue(this.getSpiritStoneTotalValue() + clampFloor(item.priceLowStone || 0));
                showNotify('Túi trữ vật đã đầy, không thể cất Kim Lôi Trúc Mẫu.', '#ff8a80');
                return false;
            }

            showNotify(`Đã mua ${this.getItemDisplayName(addedItem)}`, qualityConfig.color || '#8ff7bf');
            this.refreshResourceUI();
            return true;
        }

        const purchased = baseBuyShopItem.call(this, itemId);
        if (!purchased) return false;

        if (item.category === 'SWORD_ARTIFACT') {
            const swordItemKey = this.buildInventoryKey(item);
            const swordItem = this.inventory?.[swordItemKey];
            if (swordItem) {
                swordItem.source = swordItem.source || 'SHOP';
                swordItem.sellPriceLowStone = clampFloor(swordItem.sellPriceLowStone || getShopSwordSellPrice(), 1);
                GameProgress.requestSave();
            }
        }

        return true;
    };

    const baseGetItemDescriptionFinal = Input.getItemDescription;
    Input.getItemDescription = function (item) {
        if (!item) return baseGetItemDescriptionFinal.call(this, item);

        if (this.isChuongThienBinhItem(item)) {
            const cooldownRemainingMs = this.getChuongThienBinhCooldownRemainingMs();
            const repairableInventorySwords = Object.values(this.inventory || {}).filter(entry => {
                if (!entry || entry.key === item.key || entry.category !== 'SWORD_ARTIFACT') return false;
                return clampFloor(entry.maxDurability || 0, 0) > clampFloor(entry.durability || 0, 0);
            }).length;
            const repairableEquippedSwords = (this.getEquippedSwordArtifacts?.() || []).filter(entry => {
                return clampFloor(entry.maxDurability || 0, 0) > clampFloor(entry.durability || 0, 0);
            }).length;

            return [
                'Chưởng Thiên Bình không còn dùng trực tiếp trên chính pháp bảo này.',
                'Hãy bấm nút Gia tốc hoặc Phục bền ngay trên Kim Lôi Trúc Mẫu hay Thanh Trúc Phong Vân Kiếm bị hao tổn.',
                `Mục tiêu hiện có: ${formatNumber(this.getActiveKimLoiTrucRootItems().length)} linh trúc, ${formatNumber(repairableInventorySwords + repairableEquippedSwords)} thanh kiếm cần khôi phục.`,
                cooldownRemainingMs > 0
                    ? `Chưởng Thiên Bình đang hồi phục, còn ${getCountdownLabel(cooldownRemainingMs)}.`
                    : 'Chưởng Thiên Bình đang sẵn sàng.'
            ].join(' ');
        }

        if (item.category === 'SWORD_ART' && item.uniqueKey === 'THANH_LINH_KIEM_QUYET') {
            const progress = this.getSwordFormationProgress?.() || {};
            const controlLimit = this.getSwordControlLimit?.() || 0;
            return [
                'Kiếm quyết giúp thần thức điều khiển nhiều Thanh Trúc Phong Vân Kiếm cùng lúc.',
                `Chưa lĩnh ngộ chỉ có thể điều động ${formatNumber(Math.max(1, Math.floor(Number(CONFIG.SWORD?.CONTROL?.WITHOUT_SECRET_ART) || 1)))} thanh kiếm đứng hộ thân và chỉ chém khi bấm tấn công.`,
                `Sau khi lĩnh ngộ, số kiếm điều khiển phụ thuộc thần thức hiện tại (${formatNumber(progress.consciousness || this.getSwordConsciousnessStat?.() || 0)}), hiện có thể dùng tối đa ${formatNumber(controlLimit)} thanh.`
            ].join(' ');
        }

        if (item.category === 'SWORD_ARTIFACT') {
            const baseDescription = baseGetItemDescriptionFinal.call(this, item);
            const isRefined = this.isRefinedThanhTrucSword?.(item);
            const refineYears = clampFloor(item.refineYears || 0);
            const powerRating = clampFloor(
                item.powerRating || (isRefined
                    ? this.getRefinedThanhTrucSwordPower?.(refineYears)
                    : this.getSwordBasePowerRating?.()),
                1
            );
            const maxDurability = clampFloor(
                item.maxDurability || (isRefined
                    ? this.getRefinedThanhTrucSwordDurability?.(refineYears)
                    : this.getSwordDurabilityBaseline?.()),
                1
            );
            const durability = clampFloor(item.durability ?? maxDurability, 0);
            const breakCount = clampFloor(item.breakCount || 0, 0);
            const breakWear = clampFloor(item.breakWear || 0, 0);

            return [
                baseDescription,
                `Uy năng hiện tại: ${formatNumber(powerRating)}.`,
                `Độ bền: ${formatNumber(durability)}/${formatNumber(maxDurability)}.`,
                `Số lần vỡ: ${formatNumber(breakCount)} lần, hao mòn hiện tại ${formatNumber(breakWear)} tầng.`,
                durability < maxDurability
                    ? 'Có thể dùng Chưởng Thiên Bình để phục hồi độ bền.'
                    : 'Kiếm vẫn đang ở trạng thái tốt.'
            ].join(' ');
        }

        return baseGetItemDescriptionFinal.call(this, item);
    };

    const baseIsInventoryItemUsableFinal = Input.isInventoryItemUsable;
    Input.isInventoryItemUsable = function (item) {
        if (this.isChuongThienBinhItem(item)) {
            return false;
        }

        return baseIsInventoryItemUsableFinal.call(this, item);
    };

    const baseGetInventoryItemActionLabelFinal = Input.getInventoryItemActionLabel;
    Input.getInventoryItemActionLabel = function (item) {
        if (this.isChuongThienBinhItem(item)) {
            return 'Chọn mục tiêu';
        }

        if (item?.category === 'SWORD_ARTIFACT') {
            return 'Trang bị';
        }

        if (item?.category === 'SWORD_ART') {
            return CONFIG.SECRET_ARTS?.[item.uniqueKey]?.inventoryActionLabel || 'Lĩnh ngộ';
        }

        return baseGetInventoryItemActionLabelFinal.call(this, item);
    };

    Input.getInventoryItemActions = function (item, defaultActions = []) {
        if (!item) return defaultActions;

        const cooldownRemainingMs = this.getChuongThienBinhCooldownRemainingMs?.() || 0;
        const hasChuongThienBinh = this.hasChuongThienBinh?.() || false;
        const sellPrice = this.getInventorySellPrice?.(item) || 0;
        const actions = [];
        const pushSellAction = () => {
            if (sellPrice > 0) {
                actions.push({
                    type: 'sell',
                    label: 'Bán',
                    disabled: false,
                    variant: 'secondary'
                });
            }
        };

        if (this.isChuongThienBinhItem(item)) {
            return [{
                type: 'noop',
                label: cooldownRemainingMs > 0 ? `Hồi ${getCountdownLabel(cooldownRemainingMs)}` : 'Chọn mục tiêu',
                disabled: true,
                variant: 'primary'
            }];
        }

        if (this.isKimLoiTrucRootItem(item)) {
            actions.push({
                type: 'use',
                label: this.getInventoryItemActionLabel(item),
                disabled: !this.isInventoryItemUsable(item),
                variant: 'primary'
            });

            if (this.canRefineKimLoiTrucRoot(item)) {
                actions.push({
                    type: 'special',
                    label: 'Luyện kiếm',
                    disabled: false,
                    variant: 'secondary'
                });
            }

            if (hasChuongThienBinh) {
                actions.push({
                    type: 'chuong',
                    label: cooldownRemainingMs > 0 ? `Hồi ${getCountdownLabel(cooldownRemainingMs)}` : 'Gia tốc',
                    disabled: this.isVoidCollapsed || cooldownRemainingMs > 0,
                    variant: 'secondary'
                });
            }

            pushSellAction();
            return actions;
        }

        if (item.category === 'SWORD_ARTIFACT') {
            const maxDurability = clampFloor(item.maxDurability || 0, 0);
            const durability = clampFloor(item.durability ?? maxDurability, 0);

            actions.push({
                type: 'use',
                label: this.getInventoryItemActionLabel(item),
                disabled: !this.isInventoryItemUsable(item),
                variant: 'primary'
            });

            if (hasChuongThienBinh && maxDurability > 0 && durability < maxDurability) {
                actions.push({
                    type: 'chuong',
                    label: cooldownRemainingMs > 0 ? `Hồi ${getCountdownLabel(cooldownRemainingMs)}` : 'Phục bền',
                    disabled: this.isVoidCollapsed || cooldownRemainingMs > 0,
                    variant: 'secondary'
                });
            }

            pushSellAction();
            return actions;
        }

        if (item.category === 'MATERIAL') {
            const recipe = this.getBestAvailableAlchemyRecipe(item.materialKey);
            const hasRecipe = Boolean(recipe?.key);
            const canUseDing = this.canUseHuThienDinhForAlchemy();

            if (hasRecipe) {
                actions.push({
                    type: 'alchemy',
                    label: canUseDing ? `Luyện ${recipe.realmTier || 'đan'}` : 'Dùng Hư Thiên Đỉnh',
                    disabled: !canUseDing,
                    variant: 'primary'
                });
            }

            pushSellAction();
            return actions.length ? actions : defaultActions;
        }

        return defaultActions;
    };

    Input.handleInventoryItemAction = function (itemKey, action = 'use') {
        const item = this.inventory?.[itemKey];
        if (!item || item.count <= 0) return false;

        if (action === 'sell') {
            return this.sellInventoryItem(itemKey);
        }

        if (action === 'special') {
            return typeof this.useInventoryItemSpecial === 'function'
                ? this.useInventoryItemSpecial(itemKey)
                : false;
        }

        if (action === 'chuong') {
            return this.useChuongThienBinhOnTarget(item);
        }

        if (action === 'alchemy') {
            return this.craftAlchemyFromMaterialItem(item);
        }

        if (action === 'noop') {
            return false;
        }

        return this.useInventoryItem(itemKey);
    };

    const baseBuyShopItemFinal = Input.buyShopItem;
    Input.buyShopItem = function (itemId) {
        const item = this.getShopItems().find(entry => entry.id === itemId);
        if (!item || item.category !== 'SWORD_ARTIFACT') {
            return baseBuyShopItemFinal.call(this, itemId);
        }

        if (this.isVoidCollapsed) {
            showNotify(VOID_COLLAPSE_NOTIFY, '#a778ff');
            return false;
        }

        const qualityConfig = this.getItemQualityConfig(item);
        const instanceSpec = {
            ...item,
            instanceKey: this.createSwordArtifactInstanceKey?.('SHOP_THANH_TRUC') || createItemInstanceKey('SHOP_THANH_TRUC'),
            source: 'SHOP',
            powerRating: this.getSwordBasePowerRating?.() || 100,
            sellPriceLowStone: getShopSwordSellPrice(),
            maxDurability: this.getSwordDurabilityBaseline?.() || 1,
            durability: this.getSwordDurabilityBaseline?.() || 1,
            breakWear: 0,
            breakCount: 0
        };

        if (!this.hasInventorySpaceForSpec(instanceSpec)) {
            showNotify('Túi trữ vật đã đầy, không thể mua thêm vật phẩm mới.', '#ff8a80');
            return false;
        }

        if (!this.spendSpiritStones(item.priceLowStone)) {
            showNotify('Linh thạch không đủ để giao dịch', '#ff8a80');
            return false;
        }

        const addedItem = this.addInventoryItem(instanceSpec, 1);
        if (!addedItem) {
            this.setSpiritStoneTotalValue(this.getSpiritStoneTotalValue() + clampFloor(item.priceLowStone || 0));
            showNotify('Không thể cất Thanh Trúc Phong Vân Kiếm vào túi trữ vật.', '#ff8a80');
            return false;
        }

        showNotify(`Đã mua ${this.getItemDisplayName(addedItem)}`, qualityConfig.color || '#66f0c2');
        this.refreshResourceUI();
        return true;
    };

    if (typeof Input.refreshResourceUI === 'function') {
        Input.refreshResourceUI();
    }
})();
