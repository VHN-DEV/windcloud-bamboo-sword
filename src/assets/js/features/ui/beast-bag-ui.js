function buildInsectEggCardMarkup(speciesKey, count) {
    const species = Input.getInsectSpecies(speciesKey);
    if (!species) return '';
    const tier = Input.getInsectTierInfo(species.tier);
    const hasInsectBook = Input.hasKyTrungBang();
    const styleLabel = hasInsectBook ? getInsectStyleLabel(species) : '';
    const styleHint = hasInsectBook
        ? getInsectStyleHint(species)
        : 'Cần Kỳ Trùng Bảng để xem mô tả, phân loại và thông tin huyết mạch.';
    const hatchPreview = Input.getHatchPreview(speciesKey, 1);
    const requirementText = hasInsectBook
        ? (hatchPreview.requirements.length
            ? hatchPreview.requirements.map(requirement => {
                const materialConfig = Input.getMaterialConfig(requirement.materialKey);
                return `${materialConfig?.fullName || requirement.materialKey} ${formatNumber(requirement.owned)}/${formatNumber(requirement.count)}`;
            }).join(' • ')
            : 'Không cần nguyên liệu')
        : 'Cần Kỳ Trùng Bảng để xem';
    const habitatText = hasInsectBook
        ? (hatchPreview.hasHabitat ? `Đã có ${hatchPreview.habitatName}` : `Cần ${hatchPreview.habitatName} để ấp nở`)
        : 'Cần Kỳ Trùng Bảng để xem';
    const hatchStatus = hatchPreview.reason === 'book'
        ? 'Cần Kỳ Trùng Bảng để ấp nở'
        : hatchPreview.reason === 'materials'
            ? 'Thiếu nguyên liệu để ấp'
            : hatchPreview.reason === 'full'
                ? 'Linh Thú Đại đã đầy'
                : 'Sẵn sàng ấp nở';
    const incubation = hatchPreview.incubation || { total: 0, readyCount: 0, incubatingCount: 0, nextReadyInMs: 0 };
    const incubationText = incubation.total > 0
        ? (incubation.readyCount > 0
            ? `${formatNumber(incubation.readyCount)} trứng đã chín, chờ ô trống`
            : `${formatNumber(incubation.incubatingCount)} trứng đang ấp • ${formatNumber(Math.max(1, Math.ceil((incubation.nextReadyInMs || 0) / 1000)))} giây`)
        : 'Chưa có trứng trong lò ấp';

    return `
        <article class="inventory-slot beast-slot beast-slot--egg" style="--slot-accent:${species.eggColor || species.color};${buildInsectVisualVars(species, { egg: true })}">
            <div class="beast-slot__head">
                <div class="beast-card-visual beast-card-visual--egg" style="${buildInsectVisualVars(species, { egg: true })}">
                    ${buildInsectArtMarkup(speciesKey, { egg: true })}
                </div>
                <div class="beast-slot__info">
                    <div class="beast-slot__title-row">
                        <div class="beast-slot__title-block">
                            <div class="slot-badge">${escapeHtml(hasInsectBook ? tier.label : 'Ẩn thông tin')}</div>
                            <h4>Trứng ${escapeHtml(species.name)}</h4>
                        </div>
                        <div class="beast-slot__count">
                            <span>Số lượng</span>
                            <strong>${formatNumber(count)}</strong>
                        </div>
                    </div>
                    ${styleLabel ? `<div class="beast-slot__tags"><div class="beast-slot__style">${escapeHtml(styleLabel)}</div></div>` : ''}
                    <p class="beast-slot__summary">${escapeHtml(styleHint)}</p>
                </div>
            </div>
            <div class="beast-slot__details">
                <div class="beast-slot__detail">
                    <span>Không gian</span>
                    <strong>${escapeHtml(habitatText)}</strong>
                </div>
                <div class="beast-slot__detail beast-slot__detail--wide">
                    <span>Nguyên liệu</span>
                    <strong>${escapeHtml(requirementText)}</strong>
                </div>
                <div class="beast-slot__detail beast-slot__detail--wide">
                    <span>Trạng thái ấp nở</span>
                    <strong>${escapeHtml(hatchStatus)}</strong>
                </div>
                <div class="beast-slot__detail beast-slot__detail--wide">
                    <span>Lò ấp</span>
                    <strong>${escapeHtml(incubationText)}</strong>
                </div>
            </div>
            <div class="beast-slot__actions">
                <button class="btn-slot-action" data-beast-action="hatch" data-species-key="${escapeHtml(speciesKey)}" ${hatchPreview.canHatch ? '' : 'disabled'}>Ấp nở</button>
            </div>
        </article>
    `;
}

function buildTamedInsectCardMarkup(speciesKey, count) {
    const species = Input.getInsectSpecies(speciesKey);
    if (!species) return '';
    const tier = Input.getInsectTierInfo(species.tier);
    const attackPct = Math.round((species.attackFactor || 1) * 100);
    const hasInsectBook = Input.hasKyTrungBang();
    const styleLabel = hasInsectBook ? getInsectStyleLabel(species) : '';
    const styleHint = hasInsectBook
        ? getInsectStyleHint(species)
        : 'Cần Kỳ Trùng Bảng để xem mô tả, phân loại, thức ăn và tập tính kỳ trùng.';
    const careStatus = Input.getSpeciesCareStatus(speciesKey);
    const leaderLabel = careStatus.leaderInfo?.title || 'Thủ lĩnh';
    const sexStatusText = hasInsectBook
        ? `Đực ${formatNumber(careStatus.sexSummary.male)} | Cái ${formatNumber(careStatus.sexSummary.female)}`
        : 'Cần Kỳ Trùng Bảng để xem';
    const satietyText = careStatus.isRainbowHabitat
        ? 'Thất Sắc dưỡng đàn, không bị đói'
        : careStatus.hasFood
            ? `No bụng sẵn sàng ${formatNumber(careStatus.storedSatiety)}/${formatNumber(careStatus.foodDemand)}`
            : `Dự trữ no bụng ${formatNumber(careStatus.storedSatiety)}/${formatNumber(careStatus.foodDemand)}`;
    const preferredFoodText = hasInsectBook
        ? (careStatus.preferredFoodKeys.length
            ? careStatus.preferredFoodKeys.map(materialKey => Input.getMaterialConfig(materialKey)?.fullName || materialKey).join(', ')
            : 'Mọi loại thức ăn có linh dưỡng')
        : 'Cần Kỳ Trùng Bảng để xem';
    const foodStatusText = careStatus.isRainbowHabitat
        ? 'Không cần ô thức ăn riêng'
        : careStatus.foodStorageNutrition > 0
            ? `${formatNumber(careStatus.foodStorageNutrition)} linh dưỡng`
            : 'Ô thức ăn đang trống';
    const breedingText = careStatus.canReproduce
        ? 'Có thể sinh nở'
        : careStatus.count < 2
            ? 'Cần ít nhất 2 linh trùng'
            : careStatus.sexSummary.male <= 0 || careStatus.sexSummary.female <= 0
                ? 'Chưa đủ cặp âm dương'
                : !careStatus.hasHabitat
                    ? `Cần ${careStatus.habitatName}`
                    : !Input.hasBeastCapacity(1, speciesKey)
                        ? 'Linh Thú Đại đã đầy'
                        : 'Chưa đủ thức ăn để sinh nở';
    const habitatText = careStatus.isRainbowHabitat
        ? 'Thất Sắc Linh Thú Đại'
        : (careStatus.habitatName || 'Linh Thú Đại');
    const habitatCapacityText = Number.isFinite(careStatus.habitatCapacity)
        ? `${formatNumber(careStatus.count)}/${formatNumber(careStatus.habitatCapacity)}`
        : `${formatNumber(careStatus.count)}/∞`;

    return `
        <article class="inventory-slot beast-slot" style="--slot-accent:${species.color};${buildInsectVisualVars(species)}">
            <div class="beast-slot__head">
                <div class="beast-card-visual" style="${buildInsectVisualVars(species)}">
                    ${buildInsectArtMarkup(speciesKey)}
                </div>
                <div class="beast-slot__info">
                    <div class="beast-slot__title-row">
                        <div class="beast-slot__title-block">
                            <div class="slot-badge">${escapeHtml(hasInsectBook ? tier.label : 'Ẩn thông tin')}</div>
                            <h4>${escapeHtml(species.name)}</h4>
                        </div>
                        <div class="beast-slot__count">
                            <span>Đàn trùng</span>
                            <strong>${formatNumber(count)}</strong>
                        </div>
                    </div>
                    <div class="beast-slot__tags">
                        <div class="beast-slot__style">${escapeHtml(leaderLabel)}</div>
                        ${styleLabel ? `<div class="beast-slot__style">${escapeHtml(styleLabel)}</div>` : ''}
                    </div>
                    <p class="beast-slot__summary">${escapeHtml(styleHint)}</p>
                </div>
            </div>
            <div class="beast-slot__metrics">
                <div class="beast-slot__metric">
                    <span>Công sát</span>
                    <strong>${hasInsectBook ? `${attackPct}%` : 'Cần Kỳ Trùng Bảng'}</strong>
                </div>
                <div class="beast-slot__metric">
                    <span>Giới tính</span>
                    <strong>${escapeHtml(sexStatusText)}</strong>
                </div>
                <div class="beast-slot__metric">
                    <span>Không gian</span>
                    <strong>${escapeHtml(`${habitatText} • ${habitatCapacityText}`)}</strong>
                </div>
                <div class="beast-slot__metric">
                    <span>Sinh nở</span>
                    <strong>${escapeHtml(breedingText)}</strong>
                </div>
            </div>
            <div class="beast-slot__details">
                <div class="beast-slot__detail">
                    <span>No bụng</span>
                    <strong>${escapeHtml(satietyText)}</strong>
                </div>
                <div class="beast-slot__detail">
                    <span>Ô thức ăn</span>
                    <strong>${escapeHtml(foodStatusText)}</strong>
                </div>
                <div class="beast-slot__detail beast-slot__detail--wide">
                    <span>Mồi ưa thích</span>
                    <strong>${escapeHtml(preferredFoodText)}</strong>
                </div>
            </div>
        </article>
    `;
}

function buildInsectIncubatorCardMarkup(speciesKey) {
    const species = Input.getInsectSpecies(speciesKey);
    if (!species) return '';

    const hasInsectBook = Input.hasKyTrungBang();
    const tier = Input.getInsectTierInfo(species.tier);
    const incubation = Input.getSpeciesIncubationStatus(speciesKey);
    if (!incubation.total) return '';

    const durationSeconds = Math.max(1, Math.ceil((incubation.hatchDurationMs || 0) / 1000));
    const nextReadySeconds = Math.max(1, Math.ceil((incubation.nextReadyInMs || 0) / 1000));
    const statusText = incubation.readyCount > 0
        ? `${formatNumber(incubation.readyCount)} trứng đã chín, chờ ô trống`
        : `${formatNumber(incubation.incubatingCount)} trứng đang ấp, dự kiến ${formatNumber(nextReadySeconds)} giây nữa`;

    return `
        <article class="inventory-slot beast-slot beast-slot--egg" style="--slot-accent:${species.eggColor || species.color};${buildInsectVisualVars(species, { egg: true })}">
            <div class="beast-slot__head">
                <div class="beast-card-visual beast-card-visual--egg" style="${buildInsectVisualVars(species, { egg: true })}">
                    ${buildInsectArtMarkup(speciesKey, { egg: true })}
                </div>
                <div class="beast-slot__info">
                    <div class="beast-slot__title-row">
                        <div class="beast-slot__title-block">
                            <div class="slot-badge">${escapeHtml(hasInsectBook ? tier.label : 'Ẩn thông tin')}</div>
                            <h4>Lồng ấp ${escapeHtml(species.name)}</h4>
                        </div>
                        <div class="beast-slot__count">
                            <span>Đang ấp</span>
                            <strong>${formatNumber(incubation.total)}</strong>
                        </div>
                    </div>
                    <p class="beast-slot__summary">${escapeHtml(hasInsectBook ? (getInsectStyleHint(species) || 'Ổ trứng đang ổn định nhiệt độ linh dưỡng.') : 'Cần Kỳ Trùng Bảng để xem chi tiết loài kỳ trùng.')}</p>
                </div>
            </div>
            <div class="beast-slot__details">
                <div class="beast-slot__detail">
                    <span>Chu kỳ ấp</span>
                    <strong>${formatNumber(durationSeconds)} giây / trứng</strong>
                </div>
                <div class="beast-slot__detail beast-slot__detail--wide">
                    <span>Trạng thái lồng</span>
                    <strong>${escapeHtml(statusText)}</strong>
                </div>
            </div>
        </article>
    `;
}

function buildBeastTabsMarkup(currentTab = 'all') {
    return Input.getBeastBagTabs().map(tab => `
        <button
            class="panel-tab ${tab.key === currentTab ? 'is-active' : ''}"
            type="button"
            data-beast-tab="${escapeHtml(tab.key)}"
            title="${escapeHtml(tab.note || tab.label)}"
        >${escapeHtml(tab.label)}</button>
    `).join('');
}

function getInsectBreedingStatusText(careStatus) {
    const hasBreedingPair = careStatus.count >= 2 && careStatus.sexSummary.male > 0 && careStatus.sexSummary.female > 0;
    if (careStatus.canReproduce) return 'Có thể sinh nở';
    if (!hasBreedingPair) return 'Cần ít nhất 1 cặp đực - cái';
    if (!careStatus.hasHabitat) return `Cần ${careStatus.habitatName}`;
    if (!Input.hasBeastCapacity(1, careStatus.speciesKey)) return 'Linh Thú Đại đã đầy';
    return 'Chưa đủ thức ăn để sinh nở';
}

function getInsectPreferredFoodText(careStatus) {
    if (!Input.hasKyTrungBang()) return 'Cần Kỳ Trùng Bảng để xem';
    return careStatus.preferredFoodKeys.length
        ? careStatus.preferredFoodKeys.map(materialKey => Input.getMaterialConfig(materialKey)?.fullName || materialKey).join(', ')
        : 'Mọi loại thức ăn có linh dưỡng';
}

function getBeastFoodMaterialEntries(speciesKey) {
    const preferredSet = new Set(Input.getSpeciesPreferredFoodKeys(speciesKey));
    return Object.entries(CONFIG.ITEMS?.MATERIALS || {})
        .filter(([, materialConfig]) => (Number(materialConfig?.nutrition) || 0) > 0)
        .map(([materialKey, materialConfig]) => ({
            materialKey,
            materialConfig,
            inventoryCount: Input.getMaterialInventoryCount(materialKey),
            nutrition: Math.max(0, Number(materialConfig?.nutrition) || 0),
            preferred: preferredSet.has(materialKey)
        }))
        .sort((a, b) => {
            if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
            const qualityDiff = QUALITY_ORDER.indexOf(b.materialConfig.quality || 'LOW') - QUALITY_ORDER.indexOf(a.materialConfig.quality || 'LOW');
            if (qualityDiff !== 0) return qualityDiff;
            return (a.materialConfig.fullName || a.materialKey).localeCompare(b.materialConfig.fullName || b.materialKey, 'vi');
        });
}

function buildSpeciesBeastFoodPanelMarkup(speciesKey) {
    const species = Input.getInsectSpecies(speciesKey);
    if (!species) return '';

    const careStatus = Input.getSpeciesCareStatus(speciesKey);
    const habitatKey = careStatus.habitatKey || speciesKey;
    const preferredFoodText = getInsectPreferredFoodText(careStatus);
    const breedingText = getInsectBreedingStatusText(careStatus);
    const feedButtonLabel = careStatus.hasFood ? 'Bồi thực đàn này' : 'Cho ăn đàn này';
    const satietySummaryText = careStatus.count > 0
        ? `No bụng dự trữ: ${formatNumber(careStatus.storedSatiety)}/${formatNumber(careStatus.foodDemand)}`
        : 'Ô này chưa có linh trùng đang dưỡng';
    const colonySummaryText = careStatus.count > 0
        ? `Đực ${formatNumber(careStatus.sexSummary.male)} | Cái ${formatNumber(careStatus.sexSummary.female)}`
        : 'Đã sẵn sàng nuôi bầy mới';
    const habitatCapacityText = Number.isFinite(careStatus.habitatCapacity)
        ? `${formatNumber(careStatus.count)}/${formatNumber(careStatus.habitatCapacity)} ô`
        : `${formatNumber(careStatus.count)}/∞ ô`;
    const foodMaterials = getBeastFoodMaterialEntries(speciesKey);
    const selectableFoods = foodMaterials.filter(entry => entry.inventoryCount > 0);
    const storedEntries = Input.getFoodStorageEntries(habitatKey, { includeShared: false });
    const storedSummaryText = storedEntries.length
        ? storedEntries.map(entry => `${entry.materialConfig?.fullName || entry.materialKey} x${formatNumber(entry.count)}`).join(', ')
        : 'Ô thức ăn đang trống';
    const foodOptionsMarkup = foodMaterials.length
        ? foodMaterials.map((entry, index) => `
            <option
                value="${escapeHtml(entry.materialKey)}"
                ${index === 0 ? 'selected' : ''}
            >${escapeHtml(`${entry.materialConfig.fullName} | trong túi ${formatNumber(entry.inventoryCount)} | +${formatNumber(entry.nutrition)} linh dưỡng${entry.preferred ? ' | mồi ưa thích' : ''}`)}</option>
        `).join('')
        : '<option value="">Chưa có thức ăn phù hợp</option>';
    const accentColor = selectableFoods[0]?.materialConfig?.color || species.color;

    return `
        <div class="beast-food-panel">
            <div class="beast-food-summary">
                <div class="inventory-capacity-card">
                    <div class="inventory-capacity-card__row">
                        <span class="inventory-capacity-card__label">Ô thức ăn ${escapeHtml(species.name)}</span>
                        <strong class="inventory-capacity-card__value">${formatNumber(careStatus.foodStorageNutrition)} linh dưỡng</strong>
                    </div>
                    <div class="inventory-capacity-card__meta">
                        <span>${escapeHtml(satietySummaryText)}</span>
                        <span>${escapeHtml(`${colonySummaryText} | Sức chứa ${habitatCapacityText}`)}</span>
                    </div>
                    <div class="inventory-capacity-card__meta">
                        <span>${escapeHtml(`Mồi ưa thích: ${preferredFoodText}`)}</span>
                        <span>${escapeHtml(`Sinh nở: ${breedingText}`)}</span>
                    </div>
                </div>
                <div class="slot-actions beast-food-summary__actions">
                    <button class="btn-slot-action" data-beast-action="feed-tab" data-species-key="${escapeHtml(speciesKey)}" ${(careStatus.count > 0 && careStatus.canFeed) ? '' : 'disabled'}>${feedButtonLabel}</button>
                </div>
            </div>
            <article class="inventory-slot stone-slot beast-food-slot" style="--slot-accent:${accentColor}">
                <div class="slot-badge">Ô cho ăn</div>
                <h4>Nạp thức ăn</h4>
                <p>Chọn một loại mồi, nhập số lượng rồi nạp vào ô của ${escapeHtml(species.name)}.</p>
                <div class="slot-meta">${escapeHtml(`Mồi ưa thích: ${preferredFoodText}`)}</div>
                <div class="slot-meta">${escapeHtml(`Thức ăn đang dự trữ: ${storedSummaryText}`)}</div>
                <div class="beast-food-slot__controls">
                    <select class="shop-control-input beast-food-slot__select" data-food-select ${foodMaterials.length ? '' : 'disabled'}>
                        ${foodOptionsMarkup}
                    </select>
                    <input
                        class="shop-control-input beast-food-slot__input"
                        type="number"
                        min="1"
                        step="1"
                        value="${selectableFoods.length ? 1 : 0}"
                        ${selectableFoods.length ? '' : 'disabled'}
                        data-food-amount
                    >
                    <button
                        class="btn-slot-action"
                        data-food-action="store-selected"
                        data-species-key="${escapeHtml(speciesKey)}"
                        ${selectableFoods.length ? '' : 'disabled'}
                    >Nạp vào ô</button>
                </div>
            </article>
        </div>
    `;
}

function buildRainbowBeastFoodPanelMarkup() {
    const rainbowSpeciesKeys = Input.getBeastTabSpeciesKeys('rainbow');
    const rainbowBeastCount = rainbowSpeciesKeys.reduce((total, speciesKey) => total + Math.max(0, Math.floor(Input.tamedInsects?.[speciesKey] || 0)), 0);
    const rainbowEggCount = rainbowSpeciesKeys.reduce((total, speciesKey) => total + Math.max(0, Math.floor(Input.insectEggs?.[speciesKey] || 0)), 0);
    const reproductiveCount = rainbowSpeciesKeys.filter(speciesKey => Input.getSpeciesCareStatus(speciesKey).canReproduce).length;

    return `
        <div class="beast-food-panel">
            <div class="inventory-capacity-card">
                <div class="inventory-capacity-card__row">
                    <span class="inventory-capacity-card__label">Thất Sắc Linh Thú Đại</span>
                    <strong class="inventory-capacity-card__value">Miễn đói</strong>
                </div>
                <div class="inventory-capacity-card__meta">
                    <span>Không cần nạp thức ăn thủ công</span>
                    <span>Sức chứa không giới hạn cho mọi loài</span>
                </div>
                <div class="inventory-capacity-card__meta">
                    <span>${formatNumber(rainbowBeastCount)} linh trùng | ${formatNumber(rainbowEggCount)} trứng</span>
                    <span>${reproductiveCount > 0 ? `${formatNumber(reproductiveCount)} bầy có thể sinh nở` : 'Bầy trong Thất Sắc đang ổn định'}</span>
                </div>
            </div>
        </div>
    `;
}

function buildBeastFoodPanelMarkup(currentTab = 'all') {
    if (Input.hasSevenColorSpiritBag()) {
        return buildRainbowBeastFoodPanelMarkup();
    }

    if (currentTab === 'rainbow') {
        return buildRainbowBeastFoodPanelMarkup();
    }

    if (String(currentTab || '').startsWith('species:')) {
        return buildSpeciesBeastFoodPanelMarkup(currentTab.split(':')[1] || '');
    }

    return '';
}

function markLeaderInsectVisuals(visuals = []) {
    const assignedSpecies = new Set();
    visuals.forEach(node => {
        node.isLeader = false;
        if (!node?.speciesKey || assignedSpecies.has(node.speciesKey)) return;
        if (!Input.getSpeciesLeaderInfo(node.speciesKey)) return;
        node.isLeader = true;
        assignedSpecies.add(node.speciesKey);
    });
}

BeastBagUI = {
    overlay: null,
    btnOpen: document.getElementById('btn-beast-bag'),
    btnClose: null,
    panel: null,
    beastWallet: null,
    beastTabs: null,
    beastFeedPanel: null,
    eggSection: null,
    beastSection: null,
    eggGrid: null,
    beastGrid: null,
    initialized: false,

    hasAccess() {
        const totalCapacity = typeof Input.getBeastBagCapacity === 'function'
            ? Number(Input.getBeastBagCapacity() || 0)
            : 0;

        return Boolean(
            totalCapacity > 0
            || 
            (typeof Input.hasSpiritBeastBag === 'function' && Input.hasSpiritBeastBag())
            || (typeof Input.hasSevenColorSpiritBag === 'function' && Input.hasSevenColorSpiritBag())
        );
    },

    syncAvailability() {
        this.btnOpen = document.getElementById('btn-beast-bag') || this.btnOpen;
        if (!this.btnOpen) return;

        const unlocked = this.hasAccess();
        const lockedTitle = 'Chưa khai mở Linh Thú Đại, chưa thể mở giới vực dưỡng trùng.';
        const activeTitle = 'Mở Linh Thú Đại';

        this.btnOpen.classList.toggle('is-hidden', !unlocked);
        this.btnOpen.classList.remove('is-disabled');
        this.btnOpen.style.display = unlocked ? 'flex' : 'none';
        this.btnOpen.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
        this.btnOpen.setAttribute('title', unlocked ? activeTitle : lockedTitle);
    },

    ensureStructure() {
        this.btnOpen = document.getElementById('btn-beast-bag');
        if (!this.btnOpen) return false;
        this.syncAvailability();

        let overlay = document.getElementById('beast-popup');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'beast-popup';
            overlay.className = 'popup-overlay';
            overlay.innerHTML = `
                <div class="popup-content popup-content-wide">
                    <div class="popup-header">
                        <h3>LINH THÚ ĐẠI</h3>
                        <span id="close-beast-bag" class="close-btn">&times;</span>
                    </div>
                    <div id="beast-popup-body" class="popup-body popup-panel-body"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        const body = overlay.querySelector('#beast-popup-body') || overlay.querySelector('.popup-body');
        const content = overlay.querySelector('.popup-content');
        const inventoryBeastTab = document.querySelector('#inventory-tabs [data-inventory-tab="beasts"]');
        const sourcePanel = document.getElementById('inventory-panel-beasts');

        const wallet = document.getElementById('inventory-beast-wallet');
        const tabs = document.getElementById('inventory-beast-tabs');
        const feedPanel = document.getElementById('inventory-beast-feed-panel');
        const eggSection = document.getElementById('inventory-beast-egg-section');
        const beastSection = document.getElementById('inventory-beast-grid-section');
        const eggGrid = document.getElementById('inventory-egg-grid');
        const beastGrid = document.getElementById('inventory-beast-grid');

        [wallet, tabs, feedPanel, eggSection, beastSection].forEach(node => {
            if (node && body && node.parentElement !== body) {
                body.appendChild(node);
            }
        });

        if (content) content.classList.add('popup-content-beast');
        if (body) body.classList.add('beast-popup-body');
        if (tabs) tabs.classList.add('beast-tab-strip');
        if (feedPanel) feedPanel.classList.add('beast-feed-panel-host');
        if (eggSection) eggSection.classList.add('beast-panel-section', 'beast-panel-section--eggs');
        if (beastSection) beastSection.classList.add('beast-panel-section', 'beast-panel-section--tamed');
        if (eggGrid) eggGrid.classList.add('beast-collection-grid', 'beast-collection-grid--eggs');
        if (beastGrid) beastGrid.classList.add('beast-collection-grid', 'beast-collection-grid--tamed');

        if (inventoryBeastTab) inventoryBeastTab.remove();
        if (sourcePanel) sourcePanel.remove();

        setTextIfPresent('#beast-popup .popup-header h3', 'LINH THÚ ĐẠI');
        setTextIfPresent('#inventory-beast-egg-section h4', 'Trùng noãn');
        setTextIfPresent('#inventory-beast-grid-section h4', 'Linh trùng đã ấp');

        this.overlay = overlay;
        this.btnClose = document.getElementById('close-beast-bag');
        this.panel = body;
        this.beastWallet = wallet;
        this.beastTabs = tabs;
        this.beastFeedPanel = feedPanel;
        this.eggSection = eggSection;
        this.beastSection = beastSection;
        this.eggGrid = eggGrid;
        this.beastGrid = beastGrid;

        return Boolean(this.overlay && this.panel && this.beastWallet && this.eggGrid && this.beastGrid);
    },

    isOpen() {
        return Boolean(this.overlay && this.overlay.classList.contains('show'));
    },

    init() {
        if (!this.ensureStructure() || this.initialized) return;

        const content = this.overlay.querySelector('.popup-content');
        if (content) {
            content.addEventListener('pointerdown', (e) => e.stopPropagation());
        }

        this.btnOpen.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            if (!this.hasAccess()) {
                showNotify('Chưa khai mở Linh Thú Đại, chưa thể mở giới vực dưỡng trùng.', '#ffd36b');
                this.syncAvailability();
                return;
            }
            this.open();
        });

        if (this.btnClose) {
            this.btnClose.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        if (this.panel) {
            this.panel.addEventListener('pointerdown', (e) => {
                const tabBtn = e.target.closest('[data-beast-tab]');
                if (tabBtn) {
                    e.stopPropagation();
                    Input.selectedBeastBagTab = tabBtn.getAttribute('data-beast-tab') || 'all';
                    this.render();
                    return;
                }

                const foodBtn = e.target.closest('[data-food-action]');
                if (foodBtn) {
                    e.stopPropagation();
                    const speciesKey = foodBtn.getAttribute('data-species-key');
                    const action = foodBtn.getAttribute('data-food-action');
                    const habitatKey = speciesKey ? Input.getSpeciesHabitatKey(speciesKey) : '_SHARED';
                    if (action !== 'store-selected' || !speciesKey || !habitatKey) return;

                    const foodSlot = foodBtn.closest('.beast-food-slot, .beast-food-card');
                    const foodSelect = foodSlot?.querySelector('[data-food-select]');
                    const amountInput = foodSlot?.querySelector('[data-food-amount]');
                    const materialKey = foodBtn.getAttribute('data-material-key') || foodSelect?.value || '';
                    const requestedCount = Math.max(0, Math.floor(Number(amountInput?.value) || 0));

                    if (!materialKey) {
                        showNotify(UI_TEXT.BEAST_FOOD_SELECT_HINT, '#ffb86c');
                        return;
                    }

                    if (requestedCount <= 0) {
                        showNotify(UI_TEXT.BEAST_FOOD_AMOUNT_HINT, '#ffb86c');
                        return;
                    }

                    const movedCount = Input.storeMaterialAsFood(materialKey, requestedCount, habitatKey);
                    const materialConfig = Input.getMaterialConfig(materialKey);

                    if (movedCount > 0) {
                        const habitatName = Input.getInsectHabitatConfig(speciesKey)?.fullName || Input.getInsectSpecies(speciesKey)?.name || 'Linh Thú Đại';
                        showNotify(
                            `Đã nạp ${formatNumber(movedCount)} ${materialConfig?.fullName || materialKey} vào ${habitatName}.`,
                            materialConfig?.color || '#79ffd4'
                        );
                        Input.refreshResourceUI();
                    } else {
                        showNotify(UI_TEXT.BEAST_FOOD_NOT_ENOUGH_INVENTORY, '#ffb86c');
                    }
                    return;
                }

                const actionBtn = e.target.closest('[data-beast-action]');
                if (!actionBtn) return;

                e.stopPropagation();
                const speciesKey = actionBtn.getAttribute('data-species-key');
                const action = actionBtn.getAttribute('data-beast-action');

                if (action === 'hatch' && speciesKey) {
                    Input.hatchInsectEgg(speciesKey, 1);
                    return;
                }

                if (action === 'feed-tab' && speciesKey) {
                    const feedResult = Input.feedSpeciesNow(speciesKey, 1);
                    if (feedResult.success) {
                        const species = Input.getInsectSpecies(speciesKey);
                        showNotify(
                            `Đã nạp linh liệu cho ${species?.name || 'kỳ trùng'} (${formatNumber(feedResult.consumedNutrition)} linh dưỡng).`,
                            species?.color || '#79ffd4'
                        );
                        Input.refreshResourceUI();
                    } else if (feedResult.reason === 'rainbow') {
                        showNotify(UI_TEXT.BEAST_FOOD_RAINBOW_NOT_NEEDED, '#79ffd4');
                    } else {
                        showNotify(UI_TEXT.BEAST_FOOD_SLOT_NOT_ENOUGH, '#ffb86c');
                    }
                }
            });
        }

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });

        this.initialized = true;
        this.syncAvailability();
    },

    getScopeLabel(currentBeastTab = 'all') {
        if (currentBeastTab === 'incubator') {
            return 'Lồng ấp kỳ trùng';
        }

        if (Input.hasSevenColorSpiritBag()) {
            return 'Không gian chung Thất Sắc';
        }

        const activeTab = Input.getBeastBagTabs().find(tab => tab.key === currentBeastTab);
        return activeTab?.label || 'Tổng đàn';
    },

    ensureSectionMeta(section) {
        if (!section) return null;

        let meta = section.querySelector('.beast-section-meta');
        if (meta) return meta;

        const heading = section.querySelector('h4');
        if (!heading) return null;

        meta = document.createElement('div');
        meta.className = 'beast-section-meta';
        heading.insertAdjacentElement('afterend', meta);
        return meta;
    },

    renderSectionMeta(section, chips = []) {
        const meta = this.ensureSectionMeta(section);
        if (!meta) return;

        meta.innerHTML = chips
            .filter(Boolean)
            .map(chip => `<span>${escapeHtml(chip)}</span>`)
            .join('');
    },

    render() {
        if (!this.ensureStructure()) return;
        if (!this.hasAccess()) {
            this.syncAvailability();
            if (this.isOpen()) this.close();
            return;
        }

        const currentBeastTab = Input.ensureValidBeastBagTab();
        const tabSpeciesKeys = new Set(Input.getBeastTabSpeciesKeys(currentBeastTab));
        const showFoodPanel = Input.shouldShowBeastFeedPanel(currentBeastTab);
        const isIncubatorTab = currentBeastTab === 'incubator';
        const isFilteredBeastTab = currentBeastTab !== 'all';
        const useSharedRainbowHabitat = Input.hasSevenColorSpiritBag();
        const scopeLabel = this.getScopeLabel(currentBeastTab);

        this.beastWallet.innerHTML = buildBeastWalletMarkup();

        if (this.beastTabs) {
            this.beastTabs.style.display = useSharedRainbowHabitat ? 'none' : '';
            this.beastTabs.innerHTML = useSharedRainbowHabitat ? '' : buildBeastTabsMarkup(currentBeastTab);
        }

        if (this.beastFeedPanel) {
            this.beastFeedPanel.style.display = showFoodPanel ? '' : 'none';
            this.beastFeedPanel.innerHTML = showFoodPanel ? buildBeastFoodPanelMarkup(currentBeastTab) : '';
        }

        if (this.eggSection) this.eggSection.style.display = '';
        if (this.beastSection) this.beastSection.style.display = isIncubatorTab ? 'none' : '';
        const eggHeading = this.eggSection?.querySelector('h4');
        if (eggHeading) eggHeading.textContent = isIncubatorTab ? 'Lồng ấp kỳ trùng' : 'Trùng noãn';

        const filteredEggEntries = isIncubatorTab
            ? Input.getInsectSpeciesEntries()
                .filter(([speciesKey]) => (Input.getSpeciesIncubationStatus(speciesKey).total || 0) > 0)
            : Input.getInsectSpeciesEntries()
                .filter(([speciesKey]) => (Input.insectEggs[speciesKey] || 0) > 0)
                .filter(([speciesKey]) => !isFilteredBeastTab || tabSpeciesKeys.has(speciesKey));
        const filteredEggCards = isIncubatorTab
            ? filteredEggEntries.map(([speciesKey]) => buildInsectIncubatorCardMarkup(speciesKey))
            : filteredEggEntries.map(([speciesKey]) => buildInsectEggCardMarkup(speciesKey, Input.insectEggs[speciesKey]));
        const totalEggCount = isIncubatorTab
            ? filteredEggEntries.reduce((total, [speciesKey]) => total + (Input.getSpeciesIncubationStatus(speciesKey).total || 0), 0)
            : filteredEggEntries.reduce((total, [speciesKey]) => total + Math.max(0, Math.floor(Input.insectEggs?.[speciesKey] || 0)), 0);
        this.renderSectionMeta(this.eggSection, [
            `${formatNumber(filteredEggEntries.length)} loài`,
            `${formatNumber(totalEggCount)} ${isIncubatorTab ? 'trứng đang ấp' : 'trứng'}`,
            scopeLabel
        ]);
        this.eggGrid.innerHTML = filteredEggCards.length
            ? filteredEggCards.join('')
            : `<article class="inventory-slot is-empty"><span>${isIncubatorTab ? 'Chưa có trứng nào trong lồng ấp.' : (isFilteredBeastTab ? 'Chưa có trứng trong Linh Thú Đại này.' : 'Chưa có trứng kỳ trùng.')}</span></article>`;
        this.eggGrid.classList.toggle('is-rainbow-layout', useSharedRainbowHabitat);

        if (isIncubatorTab) {
            this.renderSectionMeta(this.beastSection, []);
            this.beastGrid.innerHTML = '';
            this.beastGrid.classList.toggle('is-rainbow-layout', useSharedRainbowHabitat);
            return;
        }

        const filteredBeastEntries = Input.getInsectSpeciesEntries()
            .filter(([speciesKey]) => (Input.tamedInsects[speciesKey] || 0) > 0)
            .filter(([speciesKey]) => !isFilteredBeastTab || tabSpeciesKeys.has(speciesKey));
        const filteredBeastCards = filteredBeastEntries
            .map(([speciesKey]) => buildTamedInsectCardMarkup(speciesKey, Input.tamedInsects[speciesKey]));
        const totalBeastCount = filteredBeastEntries.reduce((total, [speciesKey]) => {
            return total + Math.max(0, Math.floor(Input.tamedInsects?.[speciesKey] || 0));
        }, 0);
        const breedingReadyCount = filteredBeastEntries.reduce((total, [speciesKey]) => {
            return total + (Input.getSpeciesCareStatus(speciesKey).canReproduce ? 1 : 0);
        }, 0);
        this.renderSectionMeta(this.beastSection, [
            `${formatNumber(filteredBeastEntries.length)} loài`,
            `${formatNumber(totalBeastCount)} linh trùng`,
            breedingReadyCount > 0 ? `${formatNumber(breedingReadyCount)} bầy sinh nở` : scopeLabel
        ]);
        this.beastGrid.innerHTML = filteredBeastCards.length
            ? filteredBeastCards.join('')
            : `<article class="inventory-slot is-empty"><span>${isFilteredBeastTab ? 'Chưa có linh trùng trong Linh Thú Đại này.' : 'Chưa có linh trùng đã nở.'}</span></article>`;
        this.beastGrid.classList.toggle('is-rainbow-layout', useSharedRainbowHabitat);
    },

    open() {
        if (!this.ensureStructure()) return;
        if (!this.hasAccess()) {
            this.syncAvailability();
            return;
        }
        this.render();
        openPopup(this.overlay);
    },

    close() {
        if (!this.overlay) return;
        closePopup(this.overlay);
    }
};
