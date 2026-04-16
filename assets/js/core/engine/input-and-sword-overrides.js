// Sword and inventory specific overrides
const baseGetItemCategoryLabel = Input.getItemCategoryLabel;
Input.getItemCategoryLabel = function (item) {
    if (item?.category === 'SWORD_ART' && item?.uniqueKey === 'DAI_CANH_KIEM_TRAN') {
        return 'Trận đạo bí pháp';
    }

    if (item?.category === 'SWORD_ARTIFACT') {
        return SWORD_UI_TEXT.CATEGORY_LABEL;
    }

    return baseGetItemCategoryLabel.call(this, item);
};

const baseUseInventoryItem = Input.useInventoryItem;
Input.useInventoryItem = function (itemKey) {
    const item = this.inventory?.[itemKey];
    if (!item || item.count <= 0) return false;

    if (item.category !== 'SWORD_ARTIFACT' && item.category !== 'SWORD_ART') {
        return baseUseInventoryItem.call(this, itemKey);
    }

    if (this.isVoidCollapsed) {
        showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
        return false;
    }

    const qualityConfig = this.getItemQualityConfig(item);

    if (item.category === 'SWORD_ARTIFACT') {
        return this.equipSwordArtifactFromInventoryItem(itemKey);
    }

    if (item.uniqueKey === 'THANH_LINH_KIEM_QUYET') {
        if (this.hasThanhLinhKiemQuyetUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã nhập tâm, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#72f7d0');
            return false;
        }

        item.count--;
        if (item.count <= 0) delete this.inventory[itemKey];

        this.unlockCultivationArt('THANH_LINH_KIEM_QUYET');
        if (typeof syncSwordFormation === 'function') {
            syncSwordFormation({ rebuildAll: true });
        }

        showNotify(
            `Lĩnh ngộ ${this.getItemDisplayName(item)}: thần thức hiện có thể điều tối đa ${formatNumber(this.getSwordEquipCapacity())} thanh kiếm hộ thân.`,
            qualityConfig.color || '#72f7d0'
        );
        this.refreshResourceUI();
        return true;
    }

    if (item.uniqueKey !== 'DAI_CANH_KIEM_TRAN') {
        return baseUseInventoryItem.call(this, itemKey);
    }

    if (this.hasDaiCanhKiemTranUnlocked()) {
        showNotify(`${this.getItemDisplayName(item)} đã nhập tâm, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#8fffe0');
        return false;
    }

    item.count--;
    if (item.count <= 0) delete this.inventory[itemKey];

    this.unlockCultivationArt('DAI_CANH_KIEM_TRAN');
    const progress = this.getSwordFormationProgress();
    if (this.canDeployDaiCanhKiemTran()) {
        this.attackMode = 'SWORD';
    }
    if (typeof syncSwordFormation === 'function') {
        syncSwordFormation({ rebuildAll: true });
    }
    showNotify(
        this.canDeployDaiCanhKiemTran()
            ? SWORD_UI_TEXT.learnReady(
                this.getItemDisplayName(item),
                formatNumber(this.getUnlockedSwordTargetCount())
            )
            : SWORD_UI_TEXT.learnPending(
                this.getItemDisplayName(item),
                formatNumber(progress.bonded),
                formatNumber(progress.required)
            ),
        qualityConfig.color || '#8fffe0'
    );
    this.refreshResourceUI();
    return true;
};

const baseRenderAttackModeUIWithThanhLinh = Input.renderAttackModeUI;
Input.renderAttackModeUI = function () {
    baseRenderAttackModeUIWithThanhLinh.call(this);

    const skillBtn = document.getElementById('btn-skill-list');
    const formBtn = document.getElementById('btn-form');
    if (!skillBtn) return;

    const swordProgress = this.getSwordFormationProgress();
    const canShowFormButton = this.attackMode === 'SWORD' && this.canDeployDaiCanhKiemTran();
    if (formBtn) {
        formBtn.classList.toggle('is-hidden', !canShowFormButton);
    }
    this.renderCanLamCastButton();
    skillBtn.classList.toggle(
        'is-disabled',
        !this.hasDaiCanhKiemTranUnlocked()
        && !this.hasKhuTrungThuatUnlocked()
        && !this.hasKnownArtifact()
        && !this.hasKnownSwordArtifact()
        && !this.hasKnownThanhLinhKiemQuyet()
    );

    if (this.attackMode === 'INSECT') {
        skillBtn.title = `Khu Trùng Thuật - ${formatNumber(this.getCombatReadyInsectCount())} linh trùng xuất trận`;
        return;
    }

    if (this.attackMode === 'SWORD') {
        skillBtn.title = `Đại Canh Kiếm Trận - ${formatNumber(this.getAliveSwordStats().alive)} kiếm hộ trận`;
        return;
    }

    if (this.hasActiveArtifact()) {
        skillBtn.title = `Pháp bảo hộ thể - ${this.getActiveArtifactNames().join(', ')}`;
        return;
    }

    if (this.hasThanhLinhKiemQuyetUnlocked()) {
        skillBtn.title = `Thanh Linh Kiếm Quyết - thần thức ${formatNumber(swordProgress.consciousness)}, giữ tối đa ${formatNumber(swordProgress.capacity)} kiếm hộ thân, hiện điều động ${formatNumber(swordProgress.controlled)}/${formatNumber(swordProgress.usableBonded)} thanh`;
        return;
    }

    if (this.hasKnownThanhLinhKiemQuyet()) {
        skillBtn.title = 'Thanh Linh Kiếm Quyết - chưa lĩnh ngộ, hiện chỉ có thể giữ một thanh kiếm hộ thân';
        return;
    }

    if (this.hasDaiCanhKiemTranUnlocked()) {
        skillBtn.title = SWORD_UI_TEXT.titleLearned(formatNumber(swordProgress.bonded), formatNumber(swordProgress.required));
        return;
    }

    if (swordProgress.bonded > 0 || swordProgress.stocked > 0) {
        skillBtn.title = `Thanh Trúc Phong Vân Kiếm - ${formatNumber(swordProgress.bonded)} thanh đang trang bị, ${formatNumber(swordProgress.stocked)} thanh còn trong túi`;
        return;
    }

    skillBtn.title = 'Bảng bí pháp';
};
