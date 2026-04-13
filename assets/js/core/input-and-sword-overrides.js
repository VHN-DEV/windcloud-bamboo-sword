function isTouchOverUiControl(touch) {
    const hitTarget = Input.getTouchHitTarget(touch?.target, touch?.clientX, touch?.clientY);
    return Input.isUiInteractionTarget(hitTarget);
}

function canUseTouchPinchZoom(touches) {
    if (!Input.isTouchDevice || !touches || touches.length !== 2) return false;
    if (Input.isVoidCollapsed || hasVisiblePopupOverlay()) return false;
    if (Input.moveJoystick.active || Input.isAttacking) return false;

    return Array.from(touches).every(touch => !isTouchOverUiControl(touch));
}

window.addEventListener('pointerdown', e => {
    if (Input.isTouchDevice && e.pointerType && e.pointerType !== 'mouse') {
        Input.requestLandscapeMode();
    }
}, { capture: true });
window.addEventListener('pointermove', e => Input.handleMove(e));
window.addEventListener('pointerdown', e => Input.handleDown(e));
window.addEventListener('pointerup', e => Input.handleUp(e));
window.addEventListener('pointercancel', e => Input.handleUp(e));
window.addEventListener('wheel', e => {
    Camera.adjustZoom(-e.deltaY * CONFIG.ZOOM.SENSITIVITY);
}, { passive: false });

window.addEventListener('keydown', e => {
    if (e.key === '+' || e.key === '=') Camera.adjustZoom(CONFIG.ZOOM.STEP);
    if (e.key === '-' || e.key === '_') Camera.adjustZoom(-CONFIG.ZOOM.STEP);

    if (e.key.toLowerCase() === 'p') {
        CONFIG.SWORD.IS_PAUSED = !CONFIG.SWORD.IS_PAUSED;
        console.log("Trạng thái tạm dừng xoay:", CONFIG.SWORD.IS_PAUSED);
    }
});

// 2. Touch Events (Mobile - Pinch to Zoom)
window.addEventListener('touchstart', e => {
    if (canUseTouchPinchZoom(e.touches)) {
        Input.pinchZoomActive = true;
        Input.initialPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        return;
    }

    Input.initialPinchDist = 0;
    Input.pinchZoomActive = false;

    if (e.touches.length >= 2 && (Input.moveJoystick.active || Input.isAttacking || Array.from(e.touches).some(isTouchOverUiControl))) {
        e.preventDefault();
    }
}, { passive: false });

window.addEventListener('touchmove', e => {
    if (canUseTouchPinchZoom(e.touches)) {
        e.preventDefault();
        Input.pinchZoomActive = true;
        const currentDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (currentDist - Input.initialPinchDist) * 0.01;
        Camera.adjustZoom(delta);
        Input.initialPinchDist = currentDist;
        return;
    }

    Input.initialPinchDist = 0;
    Input.pinchZoomActive = false;

    if (e.touches.length >= 2 && (Input.moveJoystick.active || Input.isAttacking || Array.from(e.touches).some(isTouchOverUiControl))) {
        e.preventDefault();
    }
}, { passive: false });

window.addEventListener('touchend', e => {
    if (e.touches.length < 2) {
        Input.initialPinchDist = 0;
        Input.pinchZoomActive = false;
    }
}, { passive: false });

window.addEventListener('touchcancel', () => {
    Input.initialPinchDist = 0;
    Input.pinchZoomActive = false;
}, { passive: false });


// 2. Nút Đổi Hình Thái (Change Form)



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
        if (false && this.getBondedSwordCount() >= getConfiguredSwordCount()) {
            showNotify(
                `Đã triển khai đủ ${formatNumber(getConfiguredSwordCount())} thanh Thanh Trúc Phong Vân Kiếm.`,
                qualityConfig.color || '#66f0c2'
            );
            return false;
        }

        item.count--;
        if (item.count <= 0) delete this.inventory[itemKey];

        const wasDeployable = this.canDeployDaiCanhKiemTran();
        this.bondedSwordCount = this.getBondedSwordCount() + 1;
        const deployable = this.syncDaiCanhKiemTranProgress();
        const progress = this.getSwordFormationProgress();
        syncSwordFormation();
        showNotify(
            deployable && !wasDeployable
                ? SWORD_UI_TEXT.deployReady(
                    this.getItemDisplayName(item),
                    formatNumber(progress.bonded),
                    formatNumber(progress.required)
                )
                : progress.ready && !this.hasDaiCanhKiemTranUnlocked()
                    ? SWORD_UI_TEXT.deployNeedArt(
                        this.getItemDisplayName(item),
                        formatNumber(progress.bonded),
                        formatNumber(progress.required)
                    )
                    : SWORD_UI_TEXT.deployCount(
                        this.getItemDisplayName(item),
                        formatNumber(progress.bonded)
                    ),
            qualityConfig.color || '#66f0c2'
        );
        this.refreshResourceUI();
        return true;
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
    syncSwordFormation();
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

const baseUseInventoryItemWithSwordInstances = Input.useInventoryItem;
Input.useInventoryItem = function (itemKey) {
    const item = this.inventory?.[itemKey];
    if (!item || item.count <= 0) return false;

    if (item.category !== 'SWORD_ARTIFACT' && item.category !== 'SWORD_ART') {
        return baseUseInventoryItemWithSwordInstances.call(this, itemKey);
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
        return baseUseInventoryItemWithSwordInstances.call(this, itemKey);
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

