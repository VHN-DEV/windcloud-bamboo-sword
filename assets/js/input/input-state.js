const INPUT_INITIAL_STATE = {
    screenX: width / 2, screenY: height / 2,
    prevScreenX: width / 2, prevScreenY: height / 2,
    x: width / 2, y: height / 2,
    px: 0, py: 0,
    speed: 0,
    screenSpeed: 0,
    phongLoiWingSpread: 0,
    isAttacking: false,
    guardForm: 1,
    attackTimer: null,
    // Kiểm tra xem thiết bị có hỗ trợ cảm ứng không
    isTouchDevice: IS_TOUCH_ENVIRONMENT,
    mana: CONFIG.MANA.START || 100,
    maxMana: CONFIG.MANA.MAX || 100,
    hp: 100,
    maxHp: 100,
    isGameOver: false,
    lastEnemyDamageAt: 0,
    lastAilmentTickAt: performance.now(),
    negativeStatuses: {
        bleeding: { stacks: 0, until: 0 },
        brokenBone: { stacks: 0, until: 0 },
        blind: { stacks: 0, until: 0 },
        poison: { stacks: 0, until: 0 },
        qiBurn: { stacks: 0, until: 0 }
    },
    lastManaRegenTick: performance.now(),
    initialPinchDist: 0,
    lastFrameTime: performance.now(),
    exp: 0,
    rankIndex: 0, // Vị trí hiện tại trong mảng RANKS
    inventory: {},
    inventoryCapacity: Math.max(
        parseInt(CONFIG.ITEMS.INVENTORY_BASE_CAPACITY, 10) || 0,
        parseInt(CONFIG.ITEMS.INVENTORY_MIN_SLOTS, 10) || 16
    ),
    spiritStones: getStartingSpiritStoneCounts(),
    playerName: 'Thanh Trúc Kiếm Chủ',
    playerAvatarInitials: 'TT',
    bondedSwordCount: 0,
    equippedSwordArtifacts: [],
    attackMode: 'BASE',
    selectedInventoryTab: 'items',
    selectedBeastBagTab: 'all',
    uniquePurchases: {
        THANH_LINH_KIEM_QUYET: false,
        DAI_CANH_KIEM_TRAN: false,
        CAN_LAM_BANG_DIEM: false,
        CHUONG_THIEN_BINH: false,
        KHU_TRUNG_THUAT: false,
        PHONG_LOI_SI: false,
        HUYET_SAC_PHI_PHONG: false,
        KY_TRUNG_BANG: false,
        LINH_THU_DAI: false,
        THAT_SAC_TRU_VAT_NANG: false,
        THAT_SAC_LINH_THU_DAI: false
    },
    cultivationArts: {
        THANH_LINH_KIEM_QUYET: false,
        DAI_CANH_KIEM_TRAN: false,
        CAN_LAM_BANG_DIEM: false,
        KHU_TRUNG_THUAT: false,
        PHONG_LOI_SI: false,
        HUYET_SAC_PHI_PHONG: false
    },
    activeArtifacts: {
        CAN_LAM_BANG_DIEM: false,
        PHONG_LOI_SI: false,
        HUYET_SAC_PHI_PHONG: false
    },
    enemyMeleeStrikes: [],
    canLamProjectiles: [],
    singleSwordUltimateProjectiles: [],
    singleSwordUltimateState: {
        active: false,
        charging: false,
        awaitingAttackInput: false,
        activatedAt: 0,
        chargeStartedAt: 0,
        chargeRatio: 0,
        maxChargeMs: 1200
    },
    phongLoiBlink: {
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
    },
    insectEggs: {},
    tamedInsects: {},
    insectColonies: {},
    insectSatiety: {},
    discoveredInsects: {},
    insectCombatRoster: {},
    insectHabitats: {},
    insectHabitatCapacities: {},
    beastFoodStorage: {},
    beastBagCapacity: Math.max(1, parseInt(CONFIG.INSECT?.STARTING_BEAST_BAG_CAPACITY, 10) || 6),
    beastBagCapacityMigrated: false,
    beastCare: {
        lastTickAt: performance.now(),
        lastAlertAt: 0
    },
    insectCombat: {
        lastHitAt: 0,
        visuals: [],
        focusTargets: []
    },
    moveJoystick: {
        active: false,
        pointerId: null,
        centerX: 0,
        centerY: 0,
        offsetX: 0,
        offsetY: 0,
        maxRadius: 32,
        deadZone: 10,
        aimDistance: 180,
        button: null
    },
    touchCursor: {
        active: false,
        pointerId: null
    },
    pinchZoomActive: false,
    landscapeMode: {
        lastRequestAt: 0
    },
    bonusStats: {
        attackPct: 0,
        maxManaFlat: 0,
        speedPct: 0,
        expGainPct: 0,
        manaRegenPct: 0,
        shieldBreakPct: 0,
        dropRatePct: 0
    },
    activeEffects: [],
    breakthroughBonus: 0,
    isReadyToBreak: false, // Thêm biến trạng thái này
    specialAuraMode: null,
    specialAuraExpiresAt: 0,
    temporaryAscensionOrigin: null,
    voidCollapseTimeoutId: null,
    isVoidCollapsed: false,
    combo: 0,
    rage: 0,
    maxRage: CONFIG.ULTIMATE.MAX_RAGE || 100,
    isUltMode: false, // Trạng thái tuyệt kỹ tối thượng
    ultTimeoutId: null,
    ultimatePhase: 'idle',
    ultimatePhaseStartedAt: 0,
    ultimateCoreIndex: -1,
    ultimateMode: null,
    insectUltimate: {
        endsAt: 0,
        activatedAt: 0,
        lastHitAt: 0,
        visuals: [],
        focusTargets: []
    },
    lastAttackBurstAt: 0,
};
