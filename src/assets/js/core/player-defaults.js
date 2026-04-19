function getDefaultUniquePurchases() {
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
}

function getDefaultCultivationArts() {
    return {
        THANH_LINH_KIEM_QUYET: false,
        DAI_CANH_KIEM_TRAN: false,
        CAN_LAM_BANG_DIEM: false,
        KHU_TRUNG_THUAT: false,
        PHONG_LOI_SI: false,
        HUYET_SAC_PHI_PHONG: false,
        HU_THIEN_DINH: false
    };
}

function getDefaultActiveArtifacts() {
    return {
        PHONG_LOI_SI: false,
        HUYET_SAC_PHI_PHONG: false,
        HU_THIEN_DINH: false
    };
}

function getDefaultBonusStats() {
    return {
        attackPct: 0,
        defensePct: 0,
        matkPct: 0,
        mdefPct: 0,
        critPct: 0,
        critDmgPct: 0,
        evaPct: 0,
        accPct: 0,
        maxManaFlat: 0,
        speedPct: 0,
        expGainPct: 0,
        manaRegenPct: 0,
        shieldBreakPct: 0,
        dropRatePct: 0
    };
}

function getDefaultPhongLoiBlinkState() {
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
}

function getDefaultBeastCareState() {
    return {
        lastTickAt: performance.now(),
        lastAlertAt: 0
    };
}

function getDefaultInventoryCapacity() {
    return Math.max(
        parseInt(CONFIG.ITEMS.INVENTORY_BASE_CAPACITY, 10) || 0,
        parseInt(CONFIG.ITEMS.INVENTORY_MIN_SLOTS, 10) || 16
    );
}

function getDefaultBeastBagCapacity() {
    return Math.max(1, parseInt(CONFIG.INSECT?.STARTING_BEAST_BAG_CAPACITY, 10) || 6);
}

function getDefaultAlchemyUnlockedRecipes() {
    return {};
}

function getDefaultAlchemyFurnaces() {
    return {};
}

function getRankIndexById(rankId) {
    const targetId = Math.floor(Number(rankId) || 0);
    if (targetId <= 0) return -1;
    return CONFIG.CULTIVATION.RANKS.findIndex(rank => Number(rank?.id) === targetId);
}

function getConfiguredStartingRankIndex() {
    const configuredRankId = Math.floor(Number(CONFIG.CULTIVATION?.STARTING_RANK_ID) || 1);
    const index = getRankIndexById(configuredRankId);
    return index >= 0 ? index : 0;
}
