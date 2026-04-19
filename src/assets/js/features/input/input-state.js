const INITIAL_RANK_INDEX = getConfiguredStartingRankIndex();
const INITIAL_RANK = CONFIG.CULTIVATION?.RANKS?.[INITIAL_RANK_INDEX] || CONFIG.CULTIVATION?.RANKS?.[0] || null;

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
    hp: Math.max(1, Math.round(INITIAL_RANK?.hp || 100)),
    maxHp: Math.max(1, Math.round(INITIAL_RANK?.hp || 100)),
    isGameOver: false,
    lastEnemyDamageAt: 0,
    lastAilmentTickAt: performance.now(),
    negativeStatuses: {
        bleeding: { stacks: 0, until: 0 },
        brokenBone: { stacks: 0, until: 0 },
        blind: { stacks: 0, until: 0 },
        poison: { stacks: 0, until: 0 },
        qiBurn: { stacks: 0, until: 0 },
        rooted: { stacks: 0, until: 0 },
        frozen: { stacks: 0, until: 0 },
        sluggish: { stacks: 0, until: 0 }
    },
    lastManaRegenTick: performance.now(),
    initialPinchDist: 0,
    lastFrameTime: performance.now(),
    exp: 0,
    rankIndex: INITIAL_RANK_INDEX, // Vị trí hiện tại trong mảng RANKS
    inventory: {},
    inventoryCapacity: getDefaultInventoryCapacity(),
    spiritStones: getStartingSpiritStoneCounts(),
    playerName: 'Thanh Trúc Kiếm Chủ',
    playerAvatarInitials: 'TT',
    bondedSwordCount: 0,
    equippedSwordArtifacts: [],
    attackMode: 'BASE',
    selectedInventoryTab: 'items',
    selectedBeastBagTab: 'all',
    alchemyUnlockedRecipes: getDefaultAlchemyUnlockedRecipes(),
    alchemyFurnaces: getDefaultAlchemyFurnaces(),
    alchemySelectedFurnace: null,
    alchemyBatch: null,
    shopConsumableStock: {},
    shopConsumableRestockAt: {},
    uniquePurchases: getDefaultUniquePurchases(),
    cultivationArts: getDefaultCultivationArts(),
    activeArtifacts: {
        CAN_LAM_BANG_DIEM: false,
        ...getDefaultActiveArtifacts()
    },
    nguCucSonCombined: false,
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
        lastParticleEmitAt: 0,
        maxChargeMs: 1200
    },
    phongLoiBlink: getDefaultPhongLoiBlinkState(),
    nguLoiThuatEnabled: false,
    nguLoiThuatEffects: [],
    nguLongThuatEnabled: false,
    nguLongThuatTrail: [],
    nguLongThuatVisual: null,
    insectEggs: {},
    tamedInsects: {},
    insectColonies: {},
    insectSatiety: {},
    discoveredInsects: {},
    insectCombatRoster: {},
    insectHabitats: {},
    insectHabitatCapacities: {},
    beastFoodStorage: {},
    beastBagCapacity: getDefaultBeastBagCapacity(),
    beastBagCapacityMigrated: false,
    beastCare: getDefaultBeastCareState(),
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
    moveJoystickVisualCache: {
        x: Number.NaN,
        y: Number.NaN,
        dragRatio: Number.NaN,
        active: false
    },
    touchCursor: {
        active: false,
        pointerId: null
    },
    pinchZoomActive: false,
    landscapeMode: {
        lastRequestAt: 0
    },
    bonusStats: getDefaultBonusStats(),
    activeEffects: [],
    breakthroughBonus: 0,
    isReadyToBreak: false, // Thêm biến trạng thái này
    specialAuraMode: null,
    specialAuraExpiresAt: 0,
    temporaryAscensionOrigin: null,
    voidCollapseTimeoutId: null,
    isVoidCollapsed: false,
    tribulation: {
        active: false,
        startedAt: 0,
        currentStrike: 0,
        totalStrikes: 0,
        hp: 0,
        maxHp: 0
    },
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

const Input = {
    ...INPUT_INITIAL_STATE
};
