function buildWalletMarkup() {
    const totalLowValue = Input.getSpiritStoneTotalValue();
    const rows = STONE_ORDER.map(quality => {
        const stoneType = Input.getSpiritStoneType(quality);
        const count = Input.spiritStones[quality] || 0;

        return `
            <div class="wallet-chip" style="--wallet-accent:${stoneType.color}">
                <span>${escapeHtml(stoneType.label)}</span>
                <strong>${formatNumber(count)}</strong>
            </div>
        `;
    }).join('');

    return `
        <div class="resource-wallet">
            <div class="wallet-total">
                <span>Tổng quy đổi</span>
                <strong>${formatNumber(totalLowValue)} hạ phẩm linh thạch</strong>
            </div>
            <div class="wallet-grid">${rows}</div>
        </div>
    `;
}

function buildInventoryCapacityMarkup() {
    const summary = Input.getInventorySummary();
    const isInfinite = !Number.isFinite(summary.capacity);
    const usagePct = isInfinite ? 100 : Math.max(0, Math.min(100, Math.round((summary.usageRatio || 0) * 100)));
    const capacityLabel = isInfinite
        ? `${formatNumber(summary.uniqueCount)}/&infin; ô`
        : `${formatNumber(summary.uniqueCount)}/${formatNumber(summary.capacity)} ô`;
    const freeSlotText = isInfinite
        ? 'Sức chứa không giới hạn'
        : `Còn trống ${formatNumber(summary.freeSlots)} ô`;
    const stateText = isInfinite
        ? 'Đã khai mở Thất Sắc Trữ Vật Nang'
        : (summary.freeSlots > 0 ? 'Có thể nhận thêm vật phẩm mới' : 'Túi đã đầy');

    return `
        <div class="inventory-capacity-card">
            <div class="inventory-capacity-card__row">
                <span class="inventory-capacity-card__label">Túi trữ vật</span>
                <strong class="inventory-capacity-card__value">${capacityLabel}</strong>
            </div>
            <div class="inventory-capacity-card__track ${isInfinite ? 'is-infinite' : ''}">
                <span style="width:${usagePct}%"></span>
            </div>
            <div class="inventory-capacity-card__meta">
                <span>${freeSlotText}</span>
                <span>${stateText}</span>
            </div>
        </div>
    `;
}

function buildBeastWalletMarkup() {
    const summary = Input.getBeastSummary();
    const isInfinite = !Number.isFinite(summary.capacity);
    const usagePct = isInfinite ? 100 : Math.max(0, Math.min(100, Math.round((summary.usageRatio || 0) * 100)));
    const capacityLabel = isInfinite
        ? `${formatNumber(summary.totalBeasts)}/&infin; linh trùng đã nở`
        : `${formatNumber(summary.totalBeasts)}/${formatNumber(summary.capacity)} linh trùng đã nở`;
    const freeSlotText = isInfinite
        ? 'Thất Sắc Linh Thú Đại chứa mọi loài không giới hạn'
        : (summary.freeSlots > 0 ? `Còn ${formatNumber(summary.freeSlots)} ô cho linh trùng mới` : 'Linh Thú Đại đã đầy');
    const masteryText = Input.hasKhuTrungThuatUnlocked()
        ? 'Đã lĩnh ngộ Khu Trùng Thuật'
        : 'Chưa lĩnh ngộ Khu Trùng Thuật';
    const foodCycleText = summary.foodDemand > 0
        ? (Number.isFinite(summary.foodCycles)
            ? `Kho thức ăn duy trì ${formatNumber(summary.foodCycles)} chu kỳ`
            : 'Kho thức ăn dư dả cho cả đàn')
        : (summary.totalBeasts > 0 && summary.manualCareSpeciesCount <= 0
            ? 'Bầy trong Thất Sắc đang được dưỡng đàn, không cần cho ăn'
            : 'Chưa có linh trùng cần chăm');
    const breedingText = summary.reproductiveSpeciesCount > 0
        ? `${formatNumber(summary.reproductiveSpeciesCount)} bầy có thể sinh nở`
        : 'Chưa có bầy sẵn sàng sinh nở';
    const habitatModeText = Input.hasSevenColorSpiritBag()
        ? 'Không gian Thất Sắc hợp nhất cho mọi loài'
        : 'Mỗi Linh Thú Đại vẫn được quản theo từng đàn riêng';

    return `
        <div class="beast-wallet">
            <div class="beast-wallet__header">
                <div>
                    <span class="beast-wallet__eyebrow">Linh Thú Đại</span>
                    <strong>${capacityLabel}</strong>
                </div>
                <div class="beast-wallet__state">${freeSlotText}</div>
            </div>
            <div class="inventory-capacity-card__track beast-wallet__track ${isInfinite ? 'is-infinite' : ''}">
                <span style="width:${usagePct}%"></span>
            </div>
            <div class="beast-wallet__stats">
                <article class="beast-wallet__stat">
                    <span>Trứng noãn</span>
                    <strong>${formatNumber(summary.totalEggs)}</strong>
                </article>
                <article class="beast-wallet__stat">
                    <span>Loài đã mở</span>
                    <strong>${formatNumber(summary.discoveredCount)}/${formatNumber(summary.speciesTotal)}</strong>
                </article>
                <article class="beast-wallet__stat">
                    <span>Sinh nở</span>
                    <strong>${breedingText}</strong>
                </article>
                <article class="beast-wallet__stat">
                    <span>Dưỡng đàn</span>
                    <strong>${foodCycleText}</strong>
                </article>
            </div>
            <div class="beast-wallet__footer">
                <span>${masteryText}</span>
                <span>${habitatModeText}</span>
            </div>
        </div>
    `;
}
