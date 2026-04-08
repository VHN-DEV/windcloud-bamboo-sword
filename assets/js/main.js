const random = (min, max) => Math.random() * (max - min) + min;
const canvas = document.getElementById("c");
const enemyIcons = {};
const ctx = canvas.getContext("2d", { alpha: false });

let scaleFactor = 1;
let width, height;
let frameCount = 0;
let lastTime = performance.now();
let visualParticles = [];

function preloadEnemyIcons() {
    return Promise.all(
        CONFIG.ENEMY.ANIMALS.map(path => {
            return new Promise(resolve => {
                const img = new Image();
                img.src = path;
                const key = path.split('/').pop().split('.')[0];

                img.onload = () => {
                    enemyIcons[key] = img;
                    resolve();
                };

                img.onerror = () => {
                    console.error("Failed to load icon:", path);
                    resolve(); // Không chặn game
                };
            });
        })
    );
}

function showNotify(text, color) {
    let container = document.getElementById('game-notification');
    if (!container) {
        container = document.createElement('div');
        container.id = 'game-notification';
        document.body.appendChild(container);
    }

    // Giới hạn tối đa 3 thông báo cùng lúc để màn hình gọn gàng
    if (container.children.length > 2) {
        container.removeChild(container.firstChild);
    }

    const item = document.createElement('div');
    item.className = 'notify-item';
    item.innerText = text;
    item.style.color = color;
    item.style.borderLeft = `3px solid ${color}`; // Thêm vạch màu nhỏ bên trái cho tinh tế

    container.appendChild(item);

    // Xóa sau 2.5 giây (khớp với thời gian animation)
    setTimeout(() => {
        item.remove();
    }, 2500);
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    scaleFactor = width / CONFIG.CORE.BASE_WIDTH;
}
window.addEventListener("resize", resize);
resize();

const QUALITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'SUPREME'];
const STONE_ORDER = ['SUPREME', 'HIGH', 'MEDIUM', 'LOW'];
const numberFormatter = new Intl.NumberFormat('vi-VN');
let ShopUI = null;
let InventoryUI = null;
let ProfileUI = null;
let SkillsUI = null;
let InsectBookUI = null;

function pickWeightedKey(rates, fallbackKey = null) {
    const entries = Object.entries(rates || {});
    if (!entries.length) return fallbackKey;

    const normalizedEntries = entries
        .map(([key, weight]) => [key, Math.max(0, Number(weight) || 0)])
        .filter(([, weight]) => weight > 0);

    if (!normalizedEntries.length) {
        return fallbackKey || entries[0][0];
    }

    const totalWeight = normalizedEntries.reduce((sum, [, weight]) => sum + weight, 0);
    const roll = Math.random() * totalWeight;
    let cursor = 0;

    for (const [key, weight] of normalizedEntries) {
        cursor += weight;
        if (roll <= cursor) return key;
    }

    return fallbackKey || normalizedEntries[normalizedEntries.length - 1][0];
}

function formatNumber(value) {
    return numberFormatter.format(Math.floor(value));
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function hslaColor(h, s, l, a = 1) {
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;
}

function normalizeSearchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function getQualityLabel(quality) {
    const labels = {
        LOW: 'Hạ phẩm',
        MEDIUM: 'Trung phẩm',
        HIGH: 'Thượng phẩm',
        SUPREME: 'Cực phẩm'
    };

    return labels[quality] || quality;
}

function getStartingSpiritStoneCounts() {
    const source = CONFIG.SPIRIT_STONE?.STARTING_COUNTS || {};

    return {
        LOW: Math.max(0, Math.floor(source.LOW || 0)),
        MEDIUM: Math.max(0, Math.floor(source.MEDIUM || 0)),
        HIGH: Math.max(0, Math.floor(source.HIGH || 0)),
        SUPREME: Math.max(0, Math.floor(source.SUPREME || 0))
    };
}

const ITEM_COLLECTION_TABS = Object.freeze([
    { key: 'DAN_DUOC', label: '\u0110an d\u01b0\u1ee3c' },
    { key: 'TRUNG_NOAN', label: 'Tr\u00f9ng no\u00e3n' },
    { key: 'NGUYEN_LIEU', label: 'Nguy\u00ean li\u1ec7u' },
    { key: 'TUI', label: 'T\u00fai' },
    { key: 'BI_PHAP', label: 'B\u00ed ph\u00e1p' },
    { key: 'KHAC', label: 'Kh\u00e1c' }
]);

function getItemCollectionTabLabel(tabKey) {
    return ITEM_COLLECTION_TABS.find(tab => tab.key === tabKey)?.label || 'Kh\u00e1c';
}

function getItemCollectionTabKey(item) {
    const category = item?.category || 'EXP';

    if (['EXP', 'INSIGHT', 'BREAKTHROUGH', 'ATTACK', 'SHIELD_BREAK', 'BERSERK', 'RAGE', 'MANA', 'MAX_MANA', 'REGEN', 'SPEED', 'FORTUNE'].includes(category)) {
        return 'DAN_DUOC';
    }

    if (category === 'SPECIAL') return 'DAN_DUOC';
    if (category === 'INSECT_EGG') return 'TRUNG_NOAN';
    if (category === 'MATERIAL') return 'NGUYEN_LIEU';
    if (['BAG', 'SPIRIT_BAG', 'SPIRIT_HABITAT'].includes(category)) return 'TUI';
    if (category === 'FLAME_ART' && item?.uniqueKey === 'CAN_LAM_BANG_DIEM') return 'KHAC';
    if (['SWORD_ART', 'FLAME_ART', 'INSECT_SKILL', 'INSECT_ARTIFACT'].includes(category)) return 'BI_PHAP';

    return 'KHAC';
}

function buildMaterialArtMarkup(materialKey) {
    const slug = String(materialKey || 'material')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `
        <div class="material-art material-art--${slug}" aria-hidden="true">
            <span class="material-art__halo"></span>
            <span class="material-art__piece material-art__piece--1"></span>
            <span class="material-art__piece material-art__piece--2"></span>
            <span class="material-art__piece material-art__piece--3"></span>
            <span class="material-art__piece material-art__piece--4"></span>
        </div>
    `;
}

function buildPillVisualMarkup(item, qualityConfig) {
    const visualMap = {
        EXP: { className: 'is-exp', aura: 'rgba(105, 240, 203, 0.32)' },
        INSIGHT: { className: 'is-insight', aura: 'rgba(208, 255, 124, 0.34)' },
        BREAKTHROUGH: { className: 'is-breakthrough', aura: 'rgba(120, 168, 255, 0.32)' },
        ATTACK: { className: 'is-attack', aura: 'rgba(255, 160, 109, 0.34)' },
        SHIELD_BREAK: { className: 'is-shield-break', aura: 'rgba(111, 187, 255, 0.34)' },
        BERSERK: { className: 'is-berserk', aura: 'rgba(255, 75, 93, 0.34)' },
        RAGE: { className: 'is-rage', aura: 'rgba(255, 112, 70, 0.34)' },
        MANA: { className: 'is-mana', aura: 'rgba(87, 200, 255, 0.30)' },
        MAX_MANA: { className: 'is-max-mana', aura: 'rgba(164, 121, 255, 0.30)' },
        REGEN: { className: 'is-regen', aura: 'rgba(89, 226, 219, 0.30)' },
        SPEED: { className: 'is-speed', aura: 'rgba(149, 255, 186, 0.30)' },
        FORTUNE: { className: 'is-fortune', aura: 'rgba(255, 214, 102, 0.32)' },
        BAG: { className: 'is-bag', aura: 'rgba(151, 197, 255, 0.26)' },
        SWORD_ART: { className: 'is-sword-art', aura: 'rgba(121, 255, 212, 0.32)' },
        FLAME_ART: { className: 'is-flame-art', aura: 'rgba(104, 217, 255, 0.34)' },
        INSECT_SKILL: { className: 'is-insect-skill', aura: 'rgba(121, 255, 212, 0.32)' },
        INSECT_ARTIFACT: { className: 'is-insect-artifact', aura: 'rgba(255, 216, 113, 0.34)' },
        SPIRIT_BAG: { className: 'is-spirit-bag', aura: 'rgba(142, 191, 255, 0.30)' },
        SPIRIT_HABITAT: { className: 'is-habitat', aura: 'rgba(142, 191, 255, 0.34)' },
        INSECT_EGG: { className: 'is-insect-egg', aura: 'rgba(255, 240, 195, 0.32)' },
        MATERIAL: { className: 'is-material', aura: 'rgba(255, 176, 130, 0.30)' },
        CHUNG_CUC_DAO_NGUYEN_DAN: { className: 'is-special-rainbow', aura: 'rgba(255, 255, 255, 0.40)' },
        TAN_DAO_DIET_NGUYEN_DAN: { className: 'is-special-void', aura: 'rgba(84, 42, 115, 0.44)' }
    };

    const visualKey = item.specialKey || item.category;
    const visual = visualMap[visualKey] || visualMap.EXP;
    const insectSpecies = item.category === 'INSECT_EGG' ? Input.getInsectSpecies(item.speciesKey) : null;
    const centerMarkup = visual.className === 'is-insect-egg'
        ? `
            <div class="pill-visual__beast" style="${buildInsectVisualVars(insectSpecies, { egg: true })}">
                ${buildInsectArtMarkup(item.speciesKey, { egg: true })}
            </div>
        `
        : visual.className === 'is-material'
            ? buildMaterialArtMarkup(item.materialKey)
        : (visual.className === 'is-bag' || visual.className === 'is-spirit-bag' || visual.className === 'is-habitat')
        ? `
            <span class="pill-visual__core pill-visual__core--bag"></span>
            <img src="./assets/images/bag.svg" class="pill-visual__item-icon" alt="">
        `
        : visual.className === 'is-insect-skill'
            ? `
                <span class="pill-visual__core pill-visual__core--book"></span>
                <span class="pill-visual__cover-seal pill-visual__cover-seal--insect"></span>
            `
            : visual.className === 'is-sword-art'
                ? `
                    <span class="pill-visual__core pill-visual__core--book"></span>
                    <span class="pill-visual__cover-seal pill-visual__cover-seal--sword"></span>
                `
            : visual.className === 'is-flame-art'
                ? `
                    <span class="pill-visual__core pill-visual__core--flame"></span>
                    <span class="pill-visual__flame-mark"></span>
                `
            : visual.className === 'is-insect-artifact'
                ? `
                    <span class="pill-visual__core pill-visual__core--book"></span>
                `
        : `
            <span class="pill-visual__core"></span>
            <span class="pill-visual__sigil"></span>
        `;

    return `
        <div class="pill-visual ${visual.className}" style="--pill-accent:${qualityConfig.color};--pill-aura:${visual.aura}" aria-hidden="true">
            <span class="pill-visual__backdrop"></span>
            <span class="pill-visual__orbit pill-visual__orbit--outer"></span>
            <span class="pill-visual__orbit pill-visual__orbit--inner"></span>
            <span class="pill-visual__spark pill-visual__spark--1"></span>
            <span class="pill-visual__spark pill-visual__spark--2"></span>
            <span class="pill-visual__spark pill-visual__spark--3"></span>
            ${centerMarkup}
        </div>
    `;
}

const INSECT_TIER_SHOP_INFO = {
    PHAM: { quality: 'LOW', eggBuyPriceLowStone: 180, habitatBuyPriceLowStone: 420 },
    LINH: { quality: 'MEDIUM', eggBuyPriceLowStone: 360, habitatBuyPriceLowStone: 760 },
    HUYEN: { quality: 'HIGH', eggBuyPriceLowStone: 720, habitatBuyPriceLowStone: 1380 },
    THIEN: { quality: 'HIGH', eggBuyPriceLowStone: 1180, habitatBuyPriceLowStone: 2180 },
    DE: { quality: 'SUPREME', eggBuyPriceLowStone: 1880, habitatBuyPriceLowStone: 3280 }
};

const INSECT_HATCH_REQUIREMENTS = {
    KIEN_THIEN_TINH: [{ materialKey: 'YEU_DAN', count: 1 }, { materialKey: 'YEU_GIAC', count: 2 }],
    PHE_KIM_TRUNG: [{ materialKey: 'YEU_GIAC', count: 2 }, { materialKey: 'TINH_THIT', count: 1 }],
    PHI_THIEN_TU_VAN_HAT: [{ materialKey: 'DOC_NANG', count: 2 }, { materialKey: 'YEU_DAN', count: 1 }],
    HUYET_NGOC_TRI_CHU: [{ materialKey: 'YEU_HUYET', count: 2 }, { materialKey: 'LINH_TY', count: 1 }],
    HUYEN_DIEM_NGA: [{ materialKey: 'LINH_TY', count: 2 }, { materialKey: 'TINH_THIT', count: 1 }],
    KIM_TAM: [{ materialKey: 'LINH_TY', count: 2 }, { materialKey: 'YEU_DAN', count: 1 }],
    THIET_HOA_NGHI: [{ materialKey: 'TINH_THIT', count: 2 }, { materialKey: 'YEU_GIAC', count: 1 }],
    KIM_GIAP_HAT: [{ materialKey: 'YEU_GIAC', count: 2 }, { materialKey: 'DOC_NANG', count: 1 }],
    HUYET_THUC_NGHI: [{ materialKey: 'YEU_HUYET', count: 2 }, { materialKey: 'TINH_THIT', count: 1 }],
    BANG_TAM: [{ materialKey: 'LINH_TY', count: 2 }, { materialKey: 'YEU_DAN', count: 1 }],
    THON_LINH_TRUNG: [{ materialKey: 'YEU_DAN', count: 1 }, { materialKey: 'TINH_THIT', count: 1 }]
};

const INSECT_FOOD_PREFERENCES = {
    KIEN_THIEN_TINH: ['YEU_DAN', 'YEU_HUYET'],
    PHE_KIM_TRUNG: ['TINH_THIT', 'YEU_DAN'],
    PHI_THIEN_TU_VAN_HAT: ['YEU_HUYET', 'YEU_DAN'],
    HUYET_NGOC_TRI_CHU: ['YEU_HUYET', 'TINH_THIT'],
    HUYEN_DIEM_NGA: ['LINH_TY', 'TINH_THIT'],
    KIM_TAM: ['LINH_TY', 'YEU_DAN'],
    THIET_HOA_NGHI: ['TINH_THIT', 'YEU_HUYET'],
    KIM_GIAP_HAT: ['TINH_THIT', 'YEU_DAN'],
    HUYET_THUC_NGHI: ['YEU_HUYET', 'TINH_THIT'],
    BANG_TAM: ['LINH_TY', 'YEU_DAN'],
    THON_LINH_TRUNG: ['YEU_DAN', 'TINH_THIT']
};

const KET_DAN_REALM_START_ID = CONFIG.CULTIVATION?.MAJOR_REALMS?.find(realm => realm.key === 'KET_DAN')?.startId || 18;

const INSECT_COMBAT_PROFILES = Object.freeze({
    DEFAULT: {
        label: 'Trùng trận cận chiến',
        summary: 'Bao vây mục tiêu gần nhất và cắn xé liên tục.',
        focus: 'nearest',
        damageScale: 1,
        latchRadius: 18
    },
    KIEN_THIEN_TINH: {
        label: 'Tinh quang tập kích',
        summary: 'Chia đàn lao vào nhiều mục tiêu gần nhau như mưa sao.',
        focus: 'nearest',
        damageScale: 1.05,
        latchRadius: 20
    },
    PHE_KIM_TRUNG: {
        label: 'Cắn giáp phác khiên',
        summary: 'Ưu tiên địch còn khiên, cắn vỡ giáp rất nhanh.',
        focus: 'shielded',
        damageScale: 1.08,
        latchRadius: 14
    },
    PHI_THIEN_TU_VAN_HAT: {
        label: 'Truy kích độc vân',
        summary: 'Bám sát con mồi, liên tục đâm độc và gây rối loạn.',
        focus: 'nearest',
        damageScale: 0.96,
        latchRadius: 15
    },
    HUYET_NGOC_TRI_CHU: {
        label: 'Huyết võng',
        summary: 'Dệt tơ khóa chân rồi rút sinh cơ từ mục tiêu đang yếu.',
        focus: 'lowestHp',
        damageScale: 1,
        latchRadius: 18
    },
    HUYEN_DIEM_NGA: {
        label: 'Huyễn diệm mê thần',
        summary: 'Vũ hóa mê hoặc, làm đứng im mục tiêu đang di chuyển và cắt né tránh.',
        focus: 'swift',
        damageScale: 0.88,
        latchRadius: 22
    },
    KIM_TAM: {
        label: 'Kim tàm ký sinh',
        summary: 'Bám vào địch yếu, rút linh lực và kết liễu kẻ sắp gục.',
        focus: 'lowestHp',
        damageScale: 0.98,
        latchRadius: 16
    },
    THIET_HOA_NGHI: {
        label: 'Hỏa nghĩ bạo tập',
        summary: 'Lao vào cụm địch rồi nổ tung, đốt lan sang xung quanh.',
        focus: 'cluster',
        damageScale: 0.92,
        latchRadius: 17
    },
    KIM_GIAP_HAT: {
        label: 'Kim giáp công thành',
        summary: 'Đâm trực diện vào mục tiêu lớn, phá thủ và ép đứng lại.',
        focus: 'elite',
        damageScale: 1.14,
        latchRadius: 14
    },
    HUYET_THUC_NGHI: {
        label: 'Huyết thực cuồng tập',
        summary: 'Càng có sát khí trong chiến trường càng đánh hung hãn.',
        focus: 'nearest',
        damageScale: 0.96,
        latchRadius: 16
    },
    BANG_TAM: {
        label: 'Băng tơ phong tỏa',
        summary: 'Nhả băng ty lên mục tiêu, làm chậm rồi đông cứng thân pháp.',
        focus: 'nearest',
        damageScale: 0.9,
        latchRadius: 20
    },
    THON_LINH_TRUNG: {
        label: 'Thôn linh thực khí',
        summary: 'Gặm nhấm linh lực, khóa hồi khiên và làm suy yếu thân pháp.',
        focus: 'shielded',
        damageScale: 0.82,
        latchRadius: 13
    }
});

const ANIMAL_MATERIAL_DROP_TABLES = Object.freeze(CONFIG.ENEMY?.MATERIAL_DROPS || {});

const Input = {
    screenX: width / 2, screenY: height / 2,
    x: width / 2, y: height / 2,
    px: 0, py: 0,
    speed: 0,
    isAttacking: false,
    guardForm: 1,
    attackTimer: null,
    // Kiểm tra xem thiết bị có hỗ trợ cảm ứng không
    isTouchDevice: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
    mana: CONFIG.MANA.START || 100,
    maxMana: CONFIG.MANA.MAX || 100,
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
    attackMode: 'BASE',
    selectedInventoryTab: 'items',
    uniquePurchases: {
        DAI_CANH_KIEM_TRAN: false,
        CAN_LAM_BANG_DIEM: false,
        KHU_TRUNG_THUAT: false,
        KY_TRUNG_BANG: false,
        LINH_THU_DAI: false
    },
    cultivationArts: {
        DAI_CANH_KIEM_TRAN: false,
        CAN_LAM_BANG_DIEM: false,
        KHU_TRUNG_THUAT: false
    },
    insectEggs: {},
    tamedInsects: {},
    discoveredInsects: {},
    insectCombatRoster: {},
    insectHabitats: {},
    beastBagCapacity: Math.max(1, parseInt(CONFIG.INSECT?.STARTING_BEAST_BAG_CAPACITY, 10) || 6),
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

    updateCombo(isReset = false) {
        if (isReset) {
            this.combo = 0;
            this.rage = 0;
        } else {
            this.combo++;
            // Tăng nộ: diệt càng nhanh nộ càng tăng mạnh
            const rageGain = Math.max(0, parseFloat(CONFIG.ULTIMATE.GAIN_PER_KILL) || 0);
            this.rage = Math.min(this.maxRage, this.rage + rageGain); 
        }
        this.renderRageUI();
    },

    renderRageUI() {
        const ultBtn = document.getElementById('btn-ultimate');
        const isUltimateBusy = this.isUltimateBusy();
        const isReady = this.rage >= this.maxRage && !isUltimateBusy;
        const selectedUltimateMode = this.getSelectedUltimateMode();
        const rageLabel = this.getUltimateResourceLabel();
        const ultimateName = this.getUltimateDisplayName(selectedUltimateMode);
        const safeMaxRage = Math.max(1, this.maxRage || 1);
        const percent = Math.max(0, Math.min(100, (this.rage / safeMaxRage) * 100));
        const chargeSteps = Math.max(1, parseInt(CONFIG.ULTIMATE.CHARGE_STEPS, 10) || 1);
        const snappedPercent = isUltimateBusy || isReady
            ? 100
            : Math.floor((percent / 100) * chargeSteps) * (100 / chargeSteps);
        const chargePercent = isUltimateBusy ? 100 : snappedPercent;
        const chargeRatio = Math.max(0, Math.min(1, chargePercent / 100));
        if (ultBtn) {
            ultBtn.style.display = 'flex';
            ultBtn.style.setProperty('--ult-charge', `${chargePercent}%`);
            ultBtn.style.setProperty('--ult-charge-ratio', chargeRatio.toFixed(2));
            ultBtn.classList.toggle('ready', isReady);
            ultBtn.classList.toggle('is-active', isUltimateBusy);
            ultBtn.classList.toggle('is-disabled', !isReady && !isUltimateBusy);
            ultBtn.classList.toggle('is-insect-ultimate', selectedUltimateMode === 'INSECT');
        }

        if (ultBtn) {
            if (this.ultimatePhase === 'merging') {
                ultBtn.title = `${this.getUltimateDisplayName('SWORD')} đang hợp nhất`;
            } else if (this.ultimatePhase === 'splitting') {
                ultBtn.title = `${this.getUltimateDisplayName('SWORD')} đang tách trận`;
            } else if (this.isSwordUltimateActive()) {
                ultBtn.title = `${this.getUltimateDisplayName('SWORD')} đang kích hoạt`;
            } else if (this.isInsectUltimateActive()) {
                ultBtn.title = `${this.getUltimateDisplayName('INSECT')} đang bộc phát`;
            } else if (isReady) {
                ultBtn.title = `${rageLabel} đầy ${Math.round(this.rage)}/${this.maxRage} - ${ultimateName}`;
            } else {
                ultBtn.title = `${rageLabel} ${Math.round(this.rage)}/${this.maxRage}`;
            }
            ultBtn.setAttribute('aria-label', ultBtn.title);
        }

        if (ProfileUI && typeof ProfileUI.isOpen === 'function' && ProfileUI.isOpen()) {
            ProfileUI.render();
        }
    },

    // Hàm mới để tính tổng % tỉ lệ đột phá từ đan dược
    getSelectedUltimateMode() {
        if (this.isInsectUltimateActive()) return 'INSECT';
        return this.attackMode === 'INSECT' && this.hasKhuTrungThuatUnlocked() ? 'INSECT' : 'SWORD';
    },

    getUltimateDisplayName(mode = this.getSelectedUltimateMode()) {
        if (mode === 'INSECT') {
            return CONFIG.INSECT?.ULTIMATE?.NAME || 'Vạn Trùng Phệ Giới';
        }

        return 'Vạn Kiếm Quy Tông';
    },

    getUltimateResourceLabel() {
        return this.getSelectedUltimateMode() === 'INSECT' ? 'Nộ trùng' : 'Nộ kiếm';
    },

    isSwordUltimateActive() {
        return this.isUltMode && this.ultimateMode === 'SWORD';
    },

    isInsectUltimateActive() {
        return this.isUltMode && this.ultimateMode === 'INSECT';
    },

    clearInsectUltimateState() {
        this.insectUltimate.endsAt = 0;
        this.insectUltimate.activatedAt = 0;
        this.insectUltimate.lastHitAt = 0;
        this.insectUltimate.visuals = [];
        this.insectUltimate.focusTargets = [];
    },

    isUltimateBusy() {
        return this.isUltMode || this.ultimatePhase !== 'idle';
    },

    resetAttackState() {
        this.isAttacking = false;

        if (this.attackTimer) {
            clearTimeout(this.attackTimer);
            this.attackTimer = null;
        }
    },

    getMaxRankIndex() {
        return Math.max(0, CONFIG.CULTIVATION.RANKS.length - 1);
    },

    setSpecialAura(mode, durationMs = null) {
        this.specialAuraMode = mode || null;
        if (!mode) {
            this.specialAuraExpiresAt = 0;
            return;
        }

        this.specialAuraExpiresAt = durationMs == null
            ? Number.POSITIVE_INFINITY
            : performance.now() + Math.max(0, durationMs);
    },

    clearSpecialPillState({ keepAura = false } = {}) {
        if (this.voidCollapseTimeoutId) {
            clearTimeout(this.voidCollapseTimeoutId);
            this.voidCollapseTimeoutId = null;
        }

        this.temporaryAscensionOrigin = null;
        this.isVoidCollapsed = false;

        if (!keepAura) {
            this.setSpecialAura(null);
        }
    },

    ascendToUltimateRank() {
        const maxRankIndex = this.getMaxRankIndex();
        const maxRank = CONFIG.CULTIVATION.RANKS[maxRankIndex];
        if (!maxRank) return null;

        this.rankIndex = maxRankIndex;
        this.exp = maxRank.exp;
        this.isReadyToBreak = false;
        this.breakthroughBonus = 0;
        this.syncDerivedStats();
        this.mana = this.maxMana;
        this.renderManaUI();
        this.renderExpUI();
        return maxRank;
    },

    applyChungCucDaoNguyenDan(item, qualityConfig) {
        this.clearSpecialPillState();
        const maxRank = this.ascendToUltimateRank();
        if (!maxRank) return false;

        this.setSpecialAura(qualityConfig.auraMode || 'rainbow');
        showNotify(`Dùng ${this.getItemDisplayName(item)}: trực tiếp bước vào ${maxRank.name}`, qualityConfig.color);
        return true;
    },

    enterVoidCollapse() {
        if (this.voidCollapseTimeoutId) {
            clearTimeout(this.voidCollapseTimeoutId);
            this.voidCollapseTimeoutId = null;
        }

        if (this.ultTimeoutId) {
            clearTimeout(this.ultTimeoutId);
            this.ultTimeoutId = null;
        }

        const origin = this.temporaryAscensionOrigin;
        if (origin) {
            this.rankIndex = origin.rankIndex;
            this.exp = origin.exp;
            this.isReadyToBreak = origin.isReadyToBreak;
            this.breakthroughBonus = origin.breakthroughBonus;
        }

        this.temporaryAscensionOrigin = null;
        this.isVoidCollapsed = true;
        this.resetAttackState();
        this.stopMoveJoystick();
        this.activeEffects = [];
        this.isUltMode = false;
        this.ultimatePhase = 'idle';
        this.ultimatePhaseStartedAt = 0;
        this.ultimateCoreIndex = -1;
        this.ultimateMode = null;
        this.clearInsectUltimateState();
        this.rage = 0;
        this.mana = 0;
        this.setSpecialAura('void');
        this.syncDerivedStats();
        this.refreshResourceUI();
        this.renderManaUI();
        this.renderRageUI();
        showNotify('Tẫn Đạo Diệt Nguyên Đan phản phệ: thân thể tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
    },

    applyTanDaoDietNguyenDan(item, qualityConfig) {
        this.clearSpecialPillState();
        this.temporaryAscensionOrigin = {
            rankIndex: this.rankIndex,
            exp: this.exp,
            isReadyToBreak: this.isReadyToBreak,
            breakthroughBonus: this.breakthroughBonus
        };

        const maxRank = this.ascendToUltimateRank();
        if (!maxRank) return false;

        this.setSpecialAura(qualityConfig.auraMode || 'void', qualityConfig.durationMs || 1000);
        showNotify(`Dùng ${this.getItemDisplayName(item)}: cưỡng mở ${maxRank.name} trong ${Math.max(1, Math.round((qualityConfig.durationMs || 1000) / 1000))} giây`, qualityConfig.color);

        this.voidCollapseTimeoutId = setTimeout(() => {
            this.enterVoidCollapse();
        }, qualityConfig.durationMs || 1000);

        return true;
    },

    getUltimateTransitionDuration() {
        return Math.max(100, parseInt(CONFIG.ULTIMATE.TRANSITION_MS, 10) || 100);
    },

    getUltimateTransitionProgress() {
        if (this.ultimatePhase !== 'merging' && this.ultimatePhase !== 'splitting') {
            return this.isUltMode ? 1 : 0;
        }

        const elapsed = performance.now() - this.ultimatePhaseStartedAt;
        return Math.max(0, Math.min(1, elapsed / this.getUltimateTransitionDuration()));
    },

    getUltimateTransitionEase() {
        const t = this.getUltimateTransitionProgress();
        return (t < 0.5)
            ? 2 * t * t
            : 1 - Math.pow(-2 * t + 2, 2) / 2;
    },

    startUltimate() {
        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, hãy tải lại giới vực để hồi phục', '#a778ff');
            return false;
        }

        if (this.isUltimateBusy() || this.rage < this.maxRage) return false;

        if (this.attackMode === 'INSECT' && this.canUseInsectAttackMode()) {
            return this.startInsectUltimate();
        }

        if (this.ultTimeoutId) {
            clearTimeout(this.ultTimeoutId);
            this.ultTimeoutId = null;
        }

        this.resetAttackState();
        this.clearInsectUltimateState();

        const coreIndex = swords.findIndex(sword => !sword.isDead);
        if (coreIndex === -1) return false;

        this.ultimateCoreIndex = coreIndex;
        this.ultimatePhase = 'merging';
        this.ultimatePhaseStartedAt = performance.now();
        this.ultimateMode = 'SWORD';
        this.isUltMode = false;
        this.rage = 0;

        swords.forEach(sword => {
            if (!sword.isDead) {
                sword.isStunned = false;
                sword.stunTimer = 0;
                sword.trail = [];
                sword.attackFrame = 0;
            }
        });

        showNotify("VẠN KIẾM QUY TÔNG!", "#00ffff");
        this.renderRageUI();
        return true;
    },

    startInsectUltimate() {
        const cfg = CONFIG.INSECT?.ULTIMATE || {};
        const durationMs = Math.max(1200, Number(cfg.DURATION_MS) || 9000);
        const combatSpeciesKeys = this.getCombatReadyInsectSpeciesKeys();

        if (!combatSpeciesKeys.length) {
            showNotify('Chưa có kỳ trùng xuất chiến để thi triển tuyệt kỹ.', '#ffb26b');
            return false;
        }

        if (this.ultTimeoutId) {
            clearTimeout(this.ultTimeoutId);
            this.ultTimeoutId = null;
        }

        this.resetAttackState();
        this.insectCombat.visuals = [];
        this.insectCombat.focusTargets = [];
        this.ultimatePhase = 'idle';
        this.ultimatePhaseStartedAt = 0;
        this.ultimateCoreIndex = -1;
        this.ultimateMode = 'INSECT';
        this.isUltMode = true;
        this.rage = 0;
        this.clearInsectUltimateState();
        this.insectUltimate.activatedAt = performance.now();
        this.insectUltimate.endsAt = this.insectUltimate.activatedAt + durationMs;
        this.createInsectUltimateBurst?.(this.x, this.y, cfg.NOTIFY_COLOR || '#ff7bc3');

        this.ultTimeoutId = setTimeout(() => {
            this.endInsectUltimate();
        }, durationMs);

        showNotify(`${this.getUltimateDisplayName('INSECT')}!`, cfg.NOTIFY_COLOR || '#ff7bc3');
        this.renderRageUI();
        return true;
    },

    endInsectUltimate() {
        if (!this.isInsectUltimateActive()) {
            this.clearInsectUltimateState();
            return;
        }

        if (this.ultTimeoutId) {
            clearTimeout(this.ultTimeoutId);
            this.ultTimeoutId = null;
        }

        this.isUltMode = false;
        this.ultimateMode = null;
        this.ultimatePhase = 'idle';
        this.ultimatePhaseStartedAt = 0;
        this.ultimateCoreIndex = -1;
        this.clearInsectUltimateState();
        this.ensureValidAttackMode();
        this.renderRageUI();
    },

    startUltimateSplit() {
        if (this.ultTimeoutId) {
            clearTimeout(this.ultTimeoutId);
            this.ultTimeoutId = null;
        }

        this.resetAttackState();
        this.isUltMode = false;
        this.ultimatePhase = 'splitting';
        this.ultimatePhaseStartedAt = performance.now();
        this.renderRageUI();
    },

    updateUltimateState() {
        if (this.isInsectUltimateActive()) {
            if (!this.canUseInsectAttackMode() || performance.now() >= (this.insectUltimate?.endsAt || 0)) {
                this.endInsectUltimate();
            }
            return;
        }

        if (this.ultimatePhase !== 'merging' && this.ultimatePhase !== 'splitting') return;
        if (this.getUltimateTransitionProgress() < 1) return;

        if (this.ultimatePhase === 'merging') {
            this.ultimatePhase = 'active';
            this.ultimatePhaseStartedAt = performance.now();
            this.isUltMode = true;
            this.ultimateMode = 'SWORD';
            this.renderRageUI();

            this.ultTimeoutId = setTimeout(() => {
                this.startUltimateSplit();
            }, CONFIG.ULTIMATE.DURATION_MS || 10000);
            return;
        }

        this.ultimatePhase = 'idle';
        this.ultimatePhaseStartedAt = 0;
        this.ultimateCoreIndex = -1;
        this.ultimateMode = null;
        this.resetAttackState();
        this.renderRageUI();
    },

    calculateTotalPillBoost() {
        const cfg = CONFIG.PILL.TYPES;
        // Tính tổng: (Số lượng x % cộng thêm) của từng loại
        const boost = (this.pills.LOW * cfg.LOW.boost) +
            (this.pills.MEDIUM * cfg.MEDIUM.boost) +
            (this.pills.HIGH * cfg.HIGH.boost);
        return boost;
    },

    processActiveConsumption(dt) {
        // dt là thời gian trôi qua tính bằng giây (seconds)

        let costTick = 0;

        // 1. TÍNH TOÁN CHI PHÍ DI CHUYỂN
        // Nếu tốc độ > 1 (tránh nhiễu khi chuột rung nhẹ)
        if (this.speed > 1) {
            costTick += CONFIG.MANA.COST_MOVE_PER_SEC * dt;
        }

        // 2. TÍNH TOÁN CHI PHÍ TẤN CÔNG
        if (this.isAttacking) {
            costTick += CONFIG.MANA.COST_ATTACK_PER_SEC * dt;
        }

        // 3. THỰC HIỆN TRỪ MANA
        if (costTick > 0) {
            if (this.mana > 0) {
                // Trừ mana (dùng số thực để mượt, nhưng UI sẽ làm tròn)
                this.updateMana(-costTick);
            } else {
                // HẾT MANA:
                // Ngắt trạng thái tấn công ngay lập tức
                if (this.isAttacking) {
                    this.resetAttackState();
                    this.triggerManaShake();
                }

                // (Tùy chọn) Ngắt di chuyển? 
                // Thường game sẽ cho di chuyển chậm lại hoặc không cho dash, 
                // nhưng ở đây ta chỉ cần báo hiệu hết mana.
            }
        }
    },

    updateMana(amount) {
        this.mana = Math.max(0, Math.min(this.maxMana, this.mana + amount));
        this.renderManaUI();
    },

    regenMana() {
        if (this.isVoidCollapsed) return;

        const now = performance.now();
        const elapsed = now - this.lastManaRegenTick;

        if (elapsed >= CONFIG.MANA.REGEN_INTERVAL_MS) {
            // Tính toán số mana hồi dựa trên giây (hoặc chu kỳ MS)
            const ticks = Math.floor(elapsed / CONFIG.MANA.REGEN_INTERVAL_MS);

            if (ticks > 0) {
                // Sử dụng REGEN_PER_SEC thay vì REGEN_PER_MIN
                this.updateMana(ticks * CONFIG.MANA.REGEN_PER_SEC * this.getManaRegenMultiplier());
                this.lastManaRegenTick = now - (elapsed % CONFIG.MANA.REGEN_INTERVAL_MS);
            }
        }
    },

    renderManaUI() {
        const bar = document.getElementById('mana-bar');
        const text = document.getElementById('mana-text');
        if (bar && text) {
            const percentage = (this.mana / this.maxMana) * 100;
            bar.style.width = percentage + '%';
            text.innerText = `Linh lực: ${Math.round(this.mana)}/${this.maxMana}`;

            // Logic đổi màu khi mana thấp (đã khai báo trong SCSS)
            if (percentage < 20) {
                bar.classList.add('low-mana');
            } else {
                bar.classList.remove('low-mana');
            }
        }

        if (ProfileUI && typeof ProfileUI.isOpen === 'function' && ProfileUI.isOpen()) {
            ProfileUI.render();
        }
    },

    triggerManaShake() {
        const el = document.getElementById('mana-container');
        el.classList.remove('mana-shake', 'mana-empty-error');

        void el.offsetWidth; // Trigger reflow để restart animation

        el.classList.add('mana-shake', 'mana-empty-error');

        // Xóa màu đỏ sau 500ms (hoặc giữ nguyên tùy bạn, ở đây tôi xóa sau khi rung xong)
        setTimeout(() => {
            el.classList.remove('mana-shake', 'mana-empty-error');
        }, 500);
    },

    updateExp(amount) {
        const currentRank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
        if (!currentRank) return;

        // NGƯỠNG TRÀN: Ví dụ 120% của 5 exp là 6 exp
        const overflowLimit = currentRank.exp * (CONFIG.CULTIVATION.OVERFLOW_LIMIT || 1.2);

        if (!this.isReadyToBreak) {
            // Giai đoạn tích lũy bình thường
            this.exp += amount;
            
            // Chỉ khi EXP vượt ngưỡng mới xử lý thăng cấp/chờ đột phá
            if (this.exp >= currentRank.exp) {
                this.exp = currentRank.exp; // Chốt chặn để không vượt quá mức 100% khi chưa đột phá
                this.isReadyToBreak = true;
                showNotify("Linh khí tràn đầy, sẵn sàng đột phá!", "#00ffcc");
            }
        } else {
            // Giai đoạn đã đầy nhưng chưa đột phá (Tu vi tràn ra ngoài)
            if (this.exp < overflowLimit) {
                // Khi đã đầy, hấp thụ linh khí khó hơn (chỉ nhận 20% lượng exp từ quái)
                this.exp += amount * 0.2; 

                if (this.exp >= overflowLimit) {
                    this.exp = overflowLimit;
                    // Chỉ thông báo một lần duy nhất hoặc dùng setTimeout tránh lag
                    if(!this.forcedBreaking) { 
                        this.forcedBreaking = true;
                        showNotify("Linh lực quá tải, thiên đạo cưỡng ép đột phá!", "#ff4444");
                        setTimeout(() => {
                            this.executeBreakthrough(true);
                            this.forcedBreaking = false;
                        }, 1000);
                    }
                }
            }
        }
        this.renderExpUI(); // Cập nhật giao diện
    },
    
    checkLevelUp() {
        const currentRank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
        if (!currentRank) return;

        if (this.exp >= currentRank.exp && !this.isReadyToBreak) {
            this.isReadyToBreak = true;
            showNotify("Linh khí tràn đầy, sẵn sàng đột phá!", "#00ffcc");
            // Không tự động đột phá nữa, chỉ bật cờ isReadyToBreak
        }
    },

    _useInventoryItemLegacyPhase1(itemKey) {
        const item = this.inventory[itemKey];
        if (!item || item.count <= 0) return false;

        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return false;
        }

        const qualityConfig = this.getItemQualityConfig(item);

        if (item.category === 'MATERIAL') {
            return false;
        }

        if (item.category === 'INSECT_ARTIFACT') {
            if (InsectBookUI && typeof InsectBookUI.open === 'function') {
                InsectBookUI.open();
                showNotify(`Mở ${this.getItemDisplayName(item)}`, qualityConfig.color || '#ffd871');
                return true;
            }
            return false;
        }

        if (item.category === 'SWORD_ART' && this.hasDaiCanhKiemTranUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã nhập tâm, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#8fffe0');
            return false;
        }

        if (item.category === 'FLAME_ART' && this.hasCanLamBangDiemUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã được luyện hóa vào thần thức.`, qualityConfig.color || '#79d9ff');
            return false;
        }

        if (item.category === 'INSECT_SKILL' && this.hasKhuTrungThuatUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã lĩnh ngộ xong, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#79ffd4');
            return false;
        }

        if (item.category === 'BREAKTHROUGH' && !this.isInventoryItemUsable(item)) {
            showNotify(`Đan này chỉ hợp để đột phá ${item.realmName}`, '#ffd36b');
            return false;
        }

        item.count--;
        if (item.count <= 0) delete this.inventory[itemKey];

        if (item.category === 'EXP') {
            const rank = this.getCurrentRank();
            if (!rank) return false;

            const expGain = Math.max(1, Math.round(rank.exp * qualityConfig.expFactor * this.getExpGainMultiplier()));
            this.updateExp(expGain);
            showNotify(`Dùng ${this.getItemDisplayName(item)}: +${formatNumber(expGain)} tu vi`, qualityConfig.color);
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'BREAKTHROUGH') {
            const rank = this.getCurrentRank();
            if (!rank) return false;

            const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
            const currentTotal = Math.min(maxAllowed, rank.chance + this.breakthroughBonus);
            const maxBonus = Math.max(0, maxAllowed - rank.chance);
            const nextBonus = Math.min(maxBonus, this.breakthroughBonus + qualityConfig.breakthroughBoost);
            const appliedBoost = Math.min(maxAllowed, rank.chance + nextBonus) - currentTotal;

            if (appliedBoost <= 0) {
                this.addInventoryItem(item, 1);
                showNotify('Dược lực đã chạm giới hạn đột phá', '#ffd36b');
                return false;
            }

            this.breakthroughBonus = nextBonus;
            showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(appliedBoost * 100)}% tỉ lệ đột phá`, qualityConfig.color);
            this.refreshResourceUI();
            return true;
        }

        switch (item.category) {
            case 'SWORD_ART':
                this.unlockCultivationArt('DAI_CANH_KIEM_TRAN');
                this.attackMode = 'SWORD';
                syncSwordFormation();
                showNotify(`Lĩnh ngộ ${this.getItemDisplayName(item)}: kiếm trận đã triển khai ${formatNumber(this.getUnlockedSwordTargetCount())} kiếm.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'FLAME_ART':
                this.unlockCultivationArt('CAN_LAM_BANG_DIEM');
                showNotify(`Luyện hóa ${this.getItemDisplayName(item)}: lam diễm đã hiện nơi đầu niệm.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'INSECT_SKILL':
                this.unlockCultivationArt('KHU_TRUNG_THUAT');
                this.renderAttackModeUI();
                showNotify(`Lĩnh ngộ ${this.getItemDisplayName(item)}: đã có thể điều linh trùng nhập trận.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'INSIGHT':
                this.bonusStats.expGainPct += qualityConfig.expGainPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.expGainPct || 0) * 100)}% tu vi thu hoạch`, qualityConfig.color);
                break;
            case 'ATTACK':
                this.bonusStats.attackPct += qualityConfig.attackPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.attackPct || 0) * 100)}% công kích`, qualityConfig.color);
                break;
            case 'SHIELD_BREAK':
                this.bonusStats.shieldBreakPct += qualityConfig.shieldBreakPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.shieldBreakPct || 0) * 100)}% phá khiên`, qualityConfig.color);
                break;
            case 'BERSERK':
                this.consumeBerserkPill(item, qualityConfig);
                break;
            case 'RAGE':
                this.addRage(qualityConfig.rageGain || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(qualityConfig.rageGain || 0)} nộ`, qualityConfig.color);
                break;
            case 'MANA':
                this.updateMana(qualityConfig.manaRestore || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: hồi ${Math.round(qualityConfig.manaRestore || 0)} linh lực`, qualityConfig.color);
                break;
            case 'MAX_MANA':
                this.bonusStats.maxManaFlat += qualityConfig.maxManaFlat || 0;
                this.syncDerivedStats();
                this.updateMana(qualityConfig.maxManaFlat || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(qualityConfig.maxManaFlat || 0)} giới hạn linh lực`, qualityConfig.color);
                break;
            case 'REGEN':
                this.bonusStats.manaRegenPct += qualityConfig.manaRegenPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.manaRegenPct || 0) * 100)}% hồi linh`, qualityConfig.color);
                break;
            case 'SPEED':
                this.bonusStats.speedPct += qualityConfig.speedPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.speedPct || 0) * 100)}% tốc độ`, qualityConfig.color);
                break;
            case 'FORTUNE':
                this.bonusStats.dropRatePct += qualityConfig.dropRatePct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.dropRatePct || 0) * 100)}% vận khí`, qualityConfig.color);
                break;
            case 'SPECIAL':
                if (item.specialKey === 'CHUNG_CUC_DAO_NGUYEN_DAN') {
                    if (!this.applyChungCucDaoNguyenDan(item, qualityConfig)) {
                        this.addInventoryItem(item, 1);
                        return false;
                    }
                } else if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
                    if (!this.applyTanDaoDietNguyenDan(item, qualityConfig)) {
                        this.addInventoryItem(item, 1);
                        return false;
                    }
                } else {
                    this.addInventoryItem(item, 1);
                    return false;
                }
                break;
            default:
                this.addInventoryItem(item, 1);
                return false;
        }

        this.refreshResourceUI();
        return true;
    },

    _useInventoryItemLegacyPhase2(itemKey) {
        const item = this.inventory[itemKey];
        if (!item || item.count <= 0) return false;

        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return false;
        }

        const qualityConfig = this.getItemQualityConfig(item);

        if (item.category === 'INSECT_ARTIFACT') {
            if (InsectBookUI && typeof InsectBookUI.open === 'function') {
                InsectBookUI.open();
                showNotify(`Mở ${this.getItemDisplayName(item)}`, qualityConfig.color || '#ffd871');
                return true;
            }
            return false;
        }

        if (item.category === 'SWORD_ART' && this.hasDaiCanhKiemTranUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã nhập tâm, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#8fffe0');
            return false;
        }

        if (item.category === 'FLAME_ART' && this.hasCanLamBangDiemUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã được luyện hóa vào thần thức.`, qualityConfig.color || '#79d9ff');
            return false;
        }

        if (item.category === 'BREAKTHROUGH' && !this.isInventoryItemUsable(item)) {
            showNotify(`Đan này chỉ hợp để đột phá ${item.realmName}`, '#ffd36b');
            return false;
        }

        item.count--;
        if (item.count <= 0) delete this.inventory[itemKey];

        if (item.category === 'EXP') {
            const rank = this.getCurrentRank();
            if (!rank) return false;

            const expGain = Math.max(1, Math.round(rank.exp * qualityConfig.expFactor * this.getExpGainMultiplier()));
            this.updateExp(expGain);
            showNotify(`Dùng ${this.getItemDisplayName(item)}: +${formatNumber(expGain)} tu vi`, qualityConfig.color);
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'BREAKTHROUGH') {
            const rank = this.getCurrentRank();
            if (!rank) return false;

            const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
            const currentTotal = Math.min(maxAllowed, rank.chance + this.breakthroughBonus);
            const maxBonus = Math.max(0, maxAllowed - rank.chance);
            const nextBonus = Math.min(maxBonus, this.breakthroughBonus + qualityConfig.breakthroughBoost);
            const appliedBoost = Math.min(maxAllowed, rank.chance + nextBonus) - currentTotal;

            if (appliedBoost <= 0) {
                this.addInventoryItem(item, 1);
                showNotify('Dược lực đã chạm giới hạn đột phá', '#ffd36b');
                return false;
            }

            this.breakthroughBonus = nextBonus;
            showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(appliedBoost * 100)}% tỉ lệ đột phá`, qualityConfig.color);
            this.refreshResourceUI();
            return true;
        }

        switch (item.category) {
            case 'SWORD_ART':
                this.unlockCultivationArt('DAI_CANH_KIEM_TRAN');
                this.attackMode = 'SWORD';
                syncSwordFormation();
                showNotify(`Lĩnh ngộ ${this.getItemDisplayName(item)}: kiếm trận đã triển khai ${formatNumber(this.getUnlockedSwordTargetCount())} kiếm.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'FLAME_ART':
                this.unlockCultivationArt('CAN_LAM_BANG_DIEM');
                showNotify(`Luyện hóa ${this.getItemDisplayName(item)}: lam diễm đã hiện nơi đầu niệm.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'INSIGHT':
                this.bonusStats.expGainPct += qualityConfig.expGainPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.expGainPct || 0) * 100)}% tu vi thu hoạch`, qualityConfig.color);
                break;
            case 'ATTACK':
                this.bonusStats.attackPct += qualityConfig.attackPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.attackPct || 0) * 100)}% công kích`, qualityConfig.color);
                break;
            case 'SHIELD_BREAK':
                this.bonusStats.shieldBreakPct += qualityConfig.shieldBreakPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.shieldBreakPct || 0) * 100)}% phá khiên`, qualityConfig.color);
                break;
            case 'BERSERK':
                this.consumeBerserkPill(item, qualityConfig);
                break;
            case 'RAGE':
                this.addRage(qualityConfig.rageGain || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(qualityConfig.rageGain || 0)} nộ`, qualityConfig.color);
                break;
            case 'MANA':
                this.updateMana(qualityConfig.manaRestore || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: hồi ${Math.round(qualityConfig.manaRestore || 0)} linh lực`, qualityConfig.color);
                break;
            case 'MAX_MANA':
                this.bonusStats.maxManaFlat += qualityConfig.maxManaFlat || 0;
                this.syncDerivedStats();
                this.updateMana(qualityConfig.maxManaFlat || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(qualityConfig.maxManaFlat || 0)} giới hạn linh lực`, qualityConfig.color);
                break;
            case 'REGEN':
                this.bonusStats.manaRegenPct += qualityConfig.manaRegenPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.manaRegenPct || 0) * 100)}% hồi linh`, qualityConfig.color);
                break;
            case 'SPEED':
                this.bonusStats.speedPct += qualityConfig.speedPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.speedPct || 0) * 100)}% tốc độ`, qualityConfig.color);
                break;
            case 'FORTUNE':
                this.bonusStats.dropRatePct += qualityConfig.dropRatePct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.dropRatePct || 0) * 100)}% vận khí`, qualityConfig.color);
                break;
            case 'SPECIAL':
                if (item.specialKey === 'CHUNG_CUC_DAO_NGUYEN_DAN') {
                    if (!this.applyChungCucDaoNguyenDan(item, qualityConfig)) {
                        this.addInventoryItem(item, 1);
                        return false;
                    }
                } else if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
                    if (!this.applyTanDaoDietNguyenDan(item, qualityConfig)) {
                        this.addInventoryItem(item, 1);
                        return false;
                    }
                } else {
                    this.addInventoryItem(item, 1);
                    return false;
                }
                break;
            default:
                this.addInventoryItem(item, 1);
                return false;
        }

        this.refreshResourceUI();
        return true;
    },

    executeBreakthrough(isForced = false) {
        const currentRank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
        if (!currentRank) return;

        // 1. Tính tổng tỉ lệ
        const pillBoost = this.calculateTotalPillBoost();
        let totalChance = currentRank.chance + pillBoost;

        const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.95;
        totalChance = Math.min(maxAllowed, totalChance);

        if (Math.random() <= totalChance) {
            // --- THÀNH CÔNG ---
            this.exp = 0;
            this.rankIndex++;
            this.isReadyToBreak = false;

            this.pills = { LOW: 0, MEDIUM: 0, HIGH: 0 };

            const nextRank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
            if (nextRank) {
                if (nextRank.maxMana) this.maxMana = nextRank.maxMana;
                
                // --- LOGIC THAY ĐỔI Ở ĐÂY ---
                if (isForced) {
                    // Nếu bị cưỡng ép: Không hồi mana (giữ nguyên lượng mana hiện tại)
                    showNotify(`CƯỠNG ÉP ĐỘT PHÁ THÀNH CÔNG: ${nextRank.name.toUpperCase()}`, "#ff8800");
                } else {
                    // Nếu chủ động: Hồi đầy mana
                    this.mana = this.maxMana; 
                    showNotify(`ĐỘT PHÁ THÀNH CÔNG: ${nextRank.name.toUpperCase()}`, "#ffcc00");
                }
            }
            this.createLevelUpExplosion(this.x, this.y, nextRank?.color || currentRank.color);
        } else {
            // --- THẤT BẠI ---
            const penaltyFactor = CONFIG.CULTIVATION.BREAKTHROUGH_PENALTY_FACTOR; // Ví dụ: 0.4
            const penalty = Math.floor(this.exp * penaltyFactor);

            this.exp -= penalty;
            this.isReadyToBreak = false;

            // 2. Tính toán con số hiển thị (0.4 -> 40)
            const penaltyPercent = Math.round(penaltyFactor * 100);

            this.pills.LOW = Math.floor(this.pills.LOW / 2);
            this.pills.MEDIUM = Math.floor(this.pills.MEDIUM / 2);
            this.pills.HIGH = Math.floor(this.pills.HIGH / 2);

            // 3. Sử dụng Template Literals (dấu huyền ` `) để đưa biến vào chuỗi
            showNotify(`ĐỘT PHÁ THẤT BẠI! Tâm ma phản phệ (-${penaltyPercent}% tu vi)`, "#ff4444");

            this.triggerExpError();
        }

        this.renderExpUI();
        this.renderManaUI();
    },

    renderExpUI() {
        const rank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
        if (!rank) return;

        if (rank.maxMana) this.maxMana = rank.maxMana;

        const barExp = document.getElementById('exp-bar');
        const textExp = document.getElementById('exp-text');
        const rankText = document.getElementById('cultivation-rank');
        const breakthroughGroup = document.querySelector('.breakthrough-group');

        // 1. Tính toán tỉ lệ hiển thị dựa trên 3 loại đan
        const pillBoost = this.calculateTotalPillBoost();
        const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
        const totalChance = Math.min(maxAllowed, rank.chance + pillBoost);

        const totalPercent = (totalChance * 100).toFixed(0);

        // Tổng số lượng đan dược để hiển thị
        const totalPills = this.pills.LOW + this.pills.MEDIUM + this.pills.HIGH;

        // 2. Cập nhật văn bản giao diện
        if (textExp) {
            let statusText = this.isReadyToBreak ?
                `<span style="color:#ffcc00; font-weight:bold;">SẴN SÀNG ĐỘT PHÁ</span>` :
                `Tu vi: ${Math.floor(this.exp)}/${rank.exp}`;

            textExp.innerHTML = `${statusText} | ` +
                `<span style="color:#00ffcc">Linh Đan: ${totalPills}</span> ` +
                `(<span style="color:#ffcc00">TL: ${totalPercent}%</span>)`;
        }

        // 3. Ẩn/Hiện nút đột phá
        if (breakthroughGroup) {
            if (this.isReadyToBreak && !this.isVoidCollapsed) breakthroughGroup.classList.add('is-active');
            else breakthroughGroup.classList.remove('is-active');
        }

        // 4. Cập nhật thanh EXP (màu sắc và hiệu ứng)
        const percentage = (this.exp / rank.exp) * 100;
        if (barExp) {
            barExp.style.width = Math.min(100, percentage) + '%';
            barExp.style.background = `linear-gradient(90deg, ${rank.lightColor}, ${rank.color})`;

            if (this.isReadyToBreak) {
                barExp.style.boxShadow = `0 0 15px #fff, 0 0 5px ${rank.color}`;
                barExp.classList.add('exp-full-glow');
            } else {
                barExp.style.boxShadow = `0 0 10px ${rank.lightColor}`;
                barExp.classList.remove('exp-full-glow');
            }
        }

        if (rankText) {
            rankText.innerText = `Cảnh giới: ${rank.name}`;
            rankText.style.color = rank.color;
        }
    },

    calculateTotalPillBoost() {
        return this.breakthroughBonus;
    },

    getCurrentRank() {
        return CONFIG.CULTIVATION.RANKS[this.rankIndex] || null;
    },

    getPlayerDisplayName() {
        return this.playerName || 'Thanh Trúc Kiếm Chủ';
    },

    getPlayerMonogram() {
        const custom = String(this.playerAvatarInitials || '').trim().slice(0, 2).toUpperCase();
        if (custom) return custom;

        const initials = this.getPlayerDisplayName()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join('');

        return initials || 'TT';
    },

    getCurrentMajorRealmInfo() {
        const rank = this.getCurrentRank();
        if (!rank) return null;

        return CONFIG.CULTIVATION.MAJOR_REALMS.find(realm =>
            rank.id >= realm.startId && rank.id <= realm.endId
        ) || null;
    },

    getNextMajorRealmInfo() {
        const currentRealm = this.getCurrentMajorRealmInfo();
        if (!currentRealm || !currentRealm.nextKey || !currentRealm.nextName) return null;

        return {
            key: currentRealm.nextKey,
            name: currentRealm.nextName
        };
    },

    getCurrentBreakthroughChance() {
        const rank = this.getCurrentRank();
        if (!rank) return 0;

        const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
        return Math.max(0, Math.min(maxAllowed, rank.chance + this.calculateTotalPillBoost()));
    },

    getEffectiveAttackDamage() {
        const rank = this.getCurrentRank();
        const baseDamage = rank?.damage || 0;
        return Math.max(1, Math.ceil(baseDamage * this.getAttackMultiplier()));
    },

    getAliveSwordStats() {
        const total = Array.isArray(swords) ? swords.length : 0;
        const alive = Array.isArray(swords) ? swords.filter(sword => !sword.isDead).length : 0;

        return {
            alive,
            total,
            broken: Math.max(0, total - alive)
        };
    },

    getInventoryCapacity() {
        const baseCapacity = Math.max(
            parseInt(CONFIG.ITEMS.INVENTORY_BASE_CAPACITY, 10) || 0,
            parseInt(CONFIG.ITEMS.INVENTORY_MIN_SLOTS, 10) || 16
        );

        return Math.max(baseCapacity, Math.floor(this.inventoryCapacity || 0));
    },

    hasInventorySpaceForSpec(spec) {
        const itemKey = this.buildInventoryKey(spec);
        const existingItem = this.inventory[itemKey];

        if (existingItem && existingItem.count > 0) {
            return true;
        }

        return this.getInventoryEntries().length < this.getInventoryCapacity();
    },

    canUpgradeInventoryCapacity(item) {
        if (!item || item.category !== 'BAG') return false;

        const qualityConfig = this.getItemQualityConfig(item);
        return Math.max(0, Math.floor(qualityConfig.capacity || 0)) > 0;
    },

    canUpgradeBeastBagCapacity(item) {
        if (!item || item.category !== 'SPIRIT_BAG') return false;

        const qualityConfig = this.getItemQualityConfig(item);
        return Math.max(0, Math.floor(qualityConfig.capacity || 0)) > 0;
    },

    upgradeInventoryCapacity(nextCapacity) {
        const safeCapacity = Math.max(this.getInventoryCapacity(), Math.floor(nextCapacity || 0));
        if (safeCapacity <= this.getInventoryCapacity()) return false;

        this.inventoryCapacity = safeCapacity;
        return true;
    },

    getInventorySummary() {
        const entries = this.getInventoryEntries();
        const categories = entries.reduce((summary, item) => {
            summary[item.category] = (summary[item.category] || 0) + item.count;
            return summary;
        }, {});
        const uniqueCount = entries.length;
        const capacity = this.getInventoryCapacity();

        return {
            entries,
            totalCount: entries.reduce((total, item) => total + item.count, 0),
            uniqueCount,
            categories,
            capacity,
            freeSlots: Math.max(0, capacity - uniqueCount),
            usageRatio: capacity > 0 ? (uniqueCount / capacity) : 0
        };
    },

    getActiveEffectModifiers() {
        return this.activeEffects.reduce((acc, effect) => {
            acc.attackPct += effect.attackPct || 0;
            acc.speedPct += effect.speedPct || 0;
            acc.maxManaFlat += effect.maxManaFlat || 0;
            return acc;
        }, { attackPct: 0, speedPct: 0, maxManaFlat: 0 });
    },

    syncDerivedStats() {
        const rank = this.getCurrentRank();
        const baseMaxMana = rank?.maxMana || CONFIG.MANA.MAX || 100;
        const active = this.getActiveEffectModifiers();
        const prevMaxMana = this.maxMana;
        const prevMana = this.mana;
        const nextMaxMana = Math.max(1, Math.round(baseMaxMana + this.bonusStats.maxManaFlat + active.maxManaFlat));

        this.maxMana = nextMaxMana;
        this.mana = Math.max(0, Math.min(this.mana, this.maxMana));

        if ((prevMaxMana !== this.maxMana || prevMana !== this.mana) && typeof document !== 'undefined') {
            this.renderManaUI();
        }
    },

    updateActiveEffects() {
        if (!this.activeEffects.length) {
            this.syncDerivedStats();
            return;
        }

        const now = performance.now();
        const expired = [];
        this.activeEffects = this.activeEffects.filter(effect => {
            const isAlive = effect.expiresAt > now;
            if (!isAlive) expired.push(effect);
            return isAlive;
        });

        this.syncDerivedStats();

        expired.forEach(effect => {
            showNotify(`${effect.name} đã tan hết dược lực`, effect.endColor || "#ffd36b");
        });
    },

    getExpGainMultiplier() {
        if (this.isVoidCollapsed) return 0;
        return Math.max(0, 1 + this.bonusStats.expGainPct);
    },

    getManaRegenMultiplier() {
        if (this.isVoidCollapsed) return 0;
        return Math.max(0, 1 + this.bonusStats.manaRegenPct);
    },

    getShieldBreakMultiplier() {
        if (this.isVoidCollapsed) return 0;
        return Math.max(0, 1 + this.bonusStats.shieldBreakPct);
    },

    getDropRateMultiplier() {
        return Math.max(0, 1 + this.bonusStats.dropRatePct);
    },

    getAttackMultiplier() {
        if (this.isVoidCollapsed) return 0;
        const active = this.getActiveEffectModifiers();
        return Math.max(0.2, 1 + this.bonusStats.attackPct + active.attackPct);
    },

    getSpeedMultiplier() {
        if (this.isVoidCollapsed) return 0;
        const active = this.getActiveEffectModifiers();
        return Math.max(0.35, 1 + this.bonusStats.speedPct + active.speedPct);
    },

    updateMoveJoystickVisual() {
        const button = this.moveJoystick.button || document.getElementById('btn-move');
        if (!button) return;

        const distance = Math.hypot(this.moveJoystick.offsetX, this.moveJoystick.offsetY);
        const maxRadius = Math.max(1, this.moveJoystick.maxRadius || 1);
        const dragRatio = Math.max(0, Math.min(1, distance / maxRadius));

        button.style.setProperty('--move-stick-x', `${this.moveJoystick.offsetX}px`);
        button.style.setProperty('--move-stick-y', `${this.moveJoystick.offsetY}px`);
        button.style.setProperty('--move-drag-ratio', dragRatio.toFixed(3));
        button.classList.toggle('is-joystick-active', this.moveJoystick.active);
    },

    startMoveJoystick(pointerId, button, clientX, clientY) {
        if (!this.isTouchDevice || !button) return false;

        const rect = button.getBoundingClientRect();
        this.moveJoystick.active = true;
        this.moveJoystick.pointerId = pointerId;
        this.moveJoystick.centerX = rect.left + (rect.width / 2);
        this.moveJoystick.centerY = rect.top + (rect.height / 2);
        this.moveJoystick.maxRadius = Math.max(28, rect.width * 0.34);
        this.moveJoystick.button = button;

        this.updateMoveJoystick(clientX, clientY);
        return true;
    },

    updateMoveJoystick(clientX, clientY) {
        if (!this.moveJoystick.active) return;

        let offsetX = clientX - this.moveJoystick.centerX;
        let offsetY = clientY - this.moveJoystick.centerY;
        const distance = Math.hypot(offsetX, offsetY);
        const maxRadius = Math.max(1, this.moveJoystick.maxRadius || 1);

        if (distance > maxRadius) {
            const clampRatio = maxRadius / distance;
            offsetX *= clampRatio;
            offsetY *= clampRatio;
        }

        this.moveJoystick.offsetX = offsetX;
        this.moveJoystick.offsetY = offsetY;
        this.updateMoveJoystickVisual();
    },

    stopMoveJoystick(pointerId = null) {
        if (!this.moveJoystick.active) return;
        if (pointerId !== null && this.moveJoystick.pointerId !== pointerId) return;

        this.moveJoystick.active = false;
        this.moveJoystick.pointerId = null;
        this.moveJoystick.centerX = 0;
        this.moveJoystick.centerY = 0;
        this.moveJoystick.offsetX = 0;
        this.moveJoystick.offsetY = 0;
        this.moveJoystick.button = null;
        this.updateMoveJoystickVisual();
    },

    getMoveJoystickTarget() {
        if (!this.moveJoystick.active) return null;

        const distance = Math.hypot(this.moveJoystick.offsetX, this.moveJoystick.offsetY);
        const maxRadius = Math.max(1, this.moveJoystick.maxRadius || 1);
        const deadZone = Math.max(0, this.moveJoystick.deadZone || 0);
        const effectiveRatio = Math.max(0, Math.min(1, (distance - deadZone) / Math.max(1, maxRadius - deadZone)));

        if (effectiveRatio <= 0) {
            return { x: guardCenter.x, y: guardCenter.y };
        }

        const normX = this.moveJoystick.offsetX / distance;
        const normY = this.moveJoystick.offsetY / distance;
        const cursorSpeed = Math.max(0.2, parseFloat(CONFIG.INPUT.JOYSTICK_CURSOR_SPEED) || 1);
        const worldDistance = (this.moveJoystick.aimDistance * effectiveRatio * cursorSpeed) / Math.max(0.001, Camera.currentZoom || 1);
        const nextX = guardCenter.x + (normX * worldDistance);
        const nextY = guardCenter.y + (normY * worldDistance);
        const safeMargin = Math.max(8, 16 * scaleFactor);
        const minVisible = Camera.screenToWorld(safeMargin, safeMargin);
        const maxVisible = Camera.screenToWorld(window.innerWidth - safeMargin, window.innerHeight - safeMargin);

        return {
            x: Math.max(minVisible.x, Math.min(maxVisible.x, nextX)),
            y: Math.max(minVisible.y, Math.min(maxVisible.y, nextY))
        };
    },

    getAuraPalette() {
        const now = performance.now();
        if (this.specialAuraMode && this.specialAuraExpiresAt !== Number.POSITIVE_INFINITY && this.specialAuraExpiresAt <= now) {
            this.setSpecialAura(null);
        }

        if (this.isVoidCollapsed || this.specialAuraMode === 'void') {
            return {
                shadowColor: "#2f103f",
                particleColor: "rgba(140, 92, 255, 0.42)",
                layers: [
                    { w: 15, h: 28, color: "rgba(8, 4, 16, 0.82)", f: 0.75 },
                    { w: 10, h: 19, color: "rgba(56, 17, 83, 0.92)", f: 1.1 },
                    { w: 6, h: 12, color: "rgba(26, 3, 35, 0.98)", f: 1.65 }
                ]
            };
        }

        if (this.specialAuraMode === 'rainbow') {
            const hue = (now * 0.06) % 360;
            return {
                shadowColor: hslaColor(hue, 100, 68, 1),
                particleColor: hslaColor((hue + 60) % 360, 100, 76, 0.56),
                layers: [
                    { w: 15, h: 28, color: hslaColor(hue, 100, 60, 0.30), f: 0.8 },
                    { w: 10, h: 20, color: hslaColor((hue + 120) % 360, 100, 64, 0.86), f: 1.2 },
                    { w: 6, h: 12, color: hslaColor((hue + 240) % 360, 100, 82, 0.96), f: 1.75 }
                ]
            };
        }

        const berserkEffect = this.activeEffects.find(effect => effect.auraMode === 'berserk');
        if (!berserkEffect) {
            return {
                shadowColor: "#00ffff",
                particleColor: "rgba(150, 255, 255, 0.5)",
                layers: [
                    { w: 12, h: 22, color: "rgba(0, 102, 255, 0.3)", f: 0.8 },
                    { w: 8, h: 16, color: "#00d9ff", f: 1.2 },
                    { w: 5, h: 10, color: "#e0ffff", f: 1.8 }
                ]
            };
        }

        return {
            shadowColor: "#ff4d4f",
            particleColor: "rgba(255, 180, 120, 0.65)",
            layers: [
                { w: 14, h: 26, color: "rgba(120, 0, 0, 0.28)", f: 0.8 },
                { w: 10, h: 19, color: "#ff5b47", f: 1.25 },
                { w: 6, h: 12, color: "#ffe5b4", f: 1.85 }
            ]
        };
    },

    addRage(amount) {
        const safeAmount = Math.max(0, Math.round(amount || 0));
        this.rage = Math.min(this.maxRage, this.rage + safeAmount);
        this.renderRageUI();
    },

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
            capacity: 0,
            buyPriceLowStone: Math.max(0, Math.floor(shopInfo.habitatBuyPriceLowStone || 0)),
            buttonLabel: 'An trí'
        };
    },

    hasInsectHabitat(speciesKey) {
        return Boolean(this.insectHabitats?.[speciesKey]);
    },

    unlockInsectHabitat(speciesKey) {
        if (!this.getInsectSpecies(speciesKey)) return false;
        if (!this.insectHabitats) this.insectHabitats = {};
        this.insectHabitats[speciesKey] = true;
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
        const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
        const careConfig = CONFIG.INSECT?.CARE || {};
        const foodPerInsect = Math.max(1, Math.floor(careConfig.FOOD_PER_INSECT || 1));
        return count * foodPerInsect;
    },

    getTotalFoodNutritionAvailable() {
        return Object.entries(CONFIG.ITEMS?.MATERIALS || {}).reduce((total, [materialKey, materialConfig]) => {
            const nutrition = Math.max(0, Number(materialConfig?.nutrition) || 0);
            if (nutrition <= 0) return total;
            return total + (this.getMaterialInventoryCount(materialKey) * nutrition);
        }, 0);
    },

    getAvailableFoodNutritionForSpecies(speciesKey) {
        const preferredKeys = this.getSpeciesPreferredFoodKeys(speciesKey);
        const allFoodKeys = Object.entries(CONFIG.ITEMS?.MATERIALS || {})
            .filter(([, materialConfig]) => (Number(materialConfig?.nutrition) || 0) > 0)
            .map(([materialKey]) => materialKey);
        const orderedKeys = [...preferredKeys, ...allFoodKeys.filter(materialKey => !preferredKeys.includes(materialKey))];

        return orderedKeys.reduce((total, materialKey) => {
            const materialConfig = this.getMaterialConfig(materialKey);
            const nutrition = Math.max(0, Number(materialConfig?.nutrition) || 0);
            if (nutrition <= 0) return total;
            return total + (this.getMaterialInventoryCount(materialKey) * nutrition);
        }, 0);
    },

    consumeFoodForSpecies(speciesKey, nutritionNeeded = 0) {
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

            let availableCount = this.getMaterialInventoryCount(materialKey);
            while (availableCount > 0 && remainingNutrition > 0) {
                if (this.consumeMaterial(materialKey, 1) <= 0) break;
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

    getSpeciesCareStatus(speciesKey) {
        const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
        const foodDemand = this.getSpeciesFoodDemand(speciesKey);
        const availableFood = this.getAvailableFoodNutritionForSpecies(speciesKey);
        const habitatConfig = this.getInsectHabitatConfig(speciesKey);

        return {
            count,
            hasHabitat: this.hasInsectHabitat(speciesKey),
            habitatName: habitatConfig.fullName,
            foodDemand,
            availableFood,
            hasFood: availableFood >= foodDemand,
            canReproduce: count > 0 && this.hasInsectHabitat(speciesKey) && this.hasBeastCapacity(1)
        };
    },

    getHatchPreview(speciesKey, count = 1) {
        const species = this.getInsectSpecies(speciesKey);
        const requestedCount = Math.max(1, Math.floor(count || 1));
        const availableEggs = Math.max(0, Math.floor(this.insectEggs?.[speciesKey] || 0));
        const freeSlots = Math.max(0, this.getBeastBagCapacity() - this.getTotalTamedInsectCount());
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
        const result = {
            consumedNutrition: 0,
            hungerLosses: [],
            habitatLosses: []
        };

        this.getActiveInsectSpeciesKeys().forEach(speciesKey => {
            const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
            if (count <= 0) return;

            const feedResult = this.consumeFoodForSpecies(speciesKey, this.getSpeciesFoodDemand(speciesKey));
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
            habitatLosses: []
        };

        for (let cycleIndex = 0; cycleIndex < cycleCount; cycleIndex++) {
            const cycleResult = this.runBeastCareCycle();
            aggregate.consumedNutrition += cycleResult.consumedNutrition || 0;
            aggregate.hungerLosses.push(...(cycleResult.hungerLosses || []));
            aggregate.habitatLosses.push(...(cycleResult.habitatLosses || []));
        }

        this.beastCare.lastTickAt += cycleCount * intervalMs;
        if (now - this.beastCare.lastTickAt > intervalMs * maxCycles) {
            this.beastCare.lastTickAt = now;
        }

        if (aggregate.consumedNutrition > 0 || aggregate.hungerLosses.length || aggregate.habitatLosses.length) {
            this.refreshResourceUI();
        }

        const canAlert = (now - Math.max(0, Number(this.beastCare.lastAlertAt) || 0)) >= Math.max(0, Math.floor(careConfig.ALERT_COOLDOWN_MS || 0));
        if (!canAlert || (!aggregate.hungerLosses.length && !aggregate.habitatLosses.length)) return;

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

        showNotify(notices.join(' | '), '#ff8a80');
        this.beastCare.lastAlertAt = now;
    },

    getBeastBagCapacity() {
        const baseCapacity = Math.max(1, parseInt(CONFIG.INSECT?.STARTING_BEAST_BAG_CAPACITY, 10) || 1);
        return Math.max(baseCapacity, Math.floor(this.beastBagCapacity || 0));
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
        const safeSpeciesCount = activeSpeciesKeys.filter(speciesKey => this.hasInsectHabitat(speciesKey)).length;
        const careConfig = CONFIG.INSECT?.CARE || {};
        const foodStock = this.getTotalFoodNutritionAvailable();
        const foodDemand = totalBeasts * Math.max(1, Math.floor(careConfig.FOOD_PER_INSECT || 1));
        const foodCycles = foodDemand > 0 ? Math.floor(foodStock / foodDemand) : Number.POSITIVE_INFINITY;
        const reproductiveSpeciesCount = activeSpeciesKeys.filter(speciesKey => this.getSpeciesCareStatus(speciesKey).canReproduce).length;

        return {
            totalEggs,
            totalBeasts,
            capacity,
            freeSlots: Math.max(0, capacity - totalBeasts),
            discoveredCount,
            speciesTotal,
            usageRatio: capacity > 0 ? (totalBeasts / capacity) : 0,
            foodStock,
            foodDemand,
            foodCycles,
            safeSpeciesCount,
            reproductiveSpeciesCount
        };
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

    hasDaiCanhKiemTranUnlocked() {
        return this.hasCultivationArt('DAI_CANH_KIEM_TRAN');
    },

    hasCanLamBangDiemUnlocked() {
        return this.hasCultivationArt('CAN_LAM_BANG_DIEM');
    },

    getUnlockedSwordTargetCount() {
        return this.hasDaiCanhKiemTranUnlocked()
            ? getConfiguredSwordCount()
            : getBaseSwordCountBeforeFormation();
    },

    hasKhuTrungThuatUnlocked() {
        return this.hasCultivationArt('KHU_TRUNG_THUAT');
    },

    hasKyTrungBang() {
        return this.hasUniquePurchase('KY_TRUNG_BANG');
    },

    hasSpiritBeastBag() {
        return this.hasUniquePurchase('LINH_THU_DAI');
    },

    markDiscoveredInsect(speciesKey) {
        if (!this.getInsectSpecies(speciesKey)) return false;
        this.discoveredInsects[speciesKey] = true;
        return true;
    },

    hasUnlockedAttackSkill(mode) {
        if (mode === 'SWORD') return this.hasDaiCanhKiemTranUnlocked();
        if (mode === 'INSECT') return this.hasKhuTrungThuatUnlocked();
        return mode === 'BASE';
    },

    hasActiveAttackSkill() {
        return this.attackMode === 'SWORD' || this.attackMode === 'INSECT';
    },

    getAttackModeDisplayName(mode = this.attackMode) {
        if (mode === 'SWORD') return 'Đại Canh Kiếm Trận';
        if (mode === 'INSECT') return 'Khu Trùng Thuật';
        return 'Thanh Trúc Bản Mệnh Kiếm';
    },

    canUseInsectAttackMode() {
        return this.hasKhuTrungThuatUnlocked() && this.getCombatReadyInsectCount() > 0;
    },

    isInsectSwarmActive() {
        return this.attackMode === 'INSECT' && this.canUseInsectAttackMode() && !this.isUltMode && !this.isUltimateBusy();
    },

    getAttackSkillList() {
        const formationUnlocked = this.hasDaiCanhKiemTranUnlocked();
        const swordStats = this.getAliveSwordStats();
        const totalInsects = this.getTotalTamedInsectCount();
        const combatReadyCount = this.getCombatReadyInsectCount();
        const reservedCount = Math.max(0, totalInsects - combatReadyCount);

        return [
            {
                key: 'SWORD',
                name: 'Đại Canh Kiếm Trận',
                description: 'Khai đại trận hộ thân, ngự kiếm quang trấn thủ và công phạt bốn phương.',
                unlocked: formationUnlocked,
                active: this.attackMode === 'SWORD',
                ready: formationUnlocked,
                accent: '#8fffe0',
                note: formationUnlocked
                    ? this.attackMode === 'SWORD'
                        ? `${formatNumber(swordStats.alive)} kiếm đang hộ trận`
                        : `Khai trận sẽ bày ${formatNumber(getConfiguredSwordCount())} thanh`
                    : 'Chưa lĩnh ngộ bí pháp kiếm trận'
            },
            {
                key: 'INSECT',
                name: 'Khu Trùng Thuật',
                description: 'Điểm linh trùng nhập trận, bám sát mục tiêu và công phạt theo bản mệnh từng loài.',
                unlocked: this.hasKhuTrungThuatUnlocked(),
                active: this.attackMode === 'INSECT',
                ready: this.canUseInsectAttackMode(),
                accent: '#79ffd4',
                note: this.hasKhuTrungThuatUnlocked()
                    ? combatReadyCount > 0
                        ? `${formatNumber(combatReadyCount)} linh trùng xuất trận${reservedCount > 0 ? ` | ${formatNumber(reservedCount)} đang dưỡng đàn` : ''}`
                        : totalInsects > 0
                            ? 'Toàn bộ kỳ trùng đang lưu lại dưỡng đàn'
                            : 'Chưa có linh trùng nào phá noãn'
                    : 'Chưa lĩnh ngộ bí pháp ngự trùng',
                roster: this.hasKhuTrungThuatUnlocked() ? this.getInsectCombatRoster() : [],
                rosterSummary: this.hasKhuTrungThuatUnlocked()
                    ? `${formatNumber(combatReadyCount)} xuất trận / ${formatNumber(totalInsects)} trong đàn`
                    : ''
            }
        ];
    },

    renderAttackModeUI() {
        const skillBtn = document.getElementById('btn-skill-list');
        if (skillBtn) {
            skillBtn.classList.toggle('is-active', this.hasActiveAttackSkill());
            skillBtn.classList.toggle('is-disabled', !this.hasDaiCanhKiemTranUnlocked() && !this.hasKhuTrungThuatUnlocked());

            if (this.attackMode === 'INSECT') {
                skillBtn.title = `Khu Trùng Thuật - ${formatNumber(this.getCombatReadyInsectCount())} linh trùng xuất trận`;
            } else if (this.attackMode === 'SWORD') {
                skillBtn.title = `Đại Canh Kiếm Trận - ${formatNumber(this.getAliveSwordStats().alive)} kiếm hộ trận`;
            } else {
                skillBtn.title = 'Bảng bí pháp';
            }
        }

        const swordCounter = document.getElementById('sword-counter');
        if (swordCounter) {
            swordCounter.classList.toggle('is-hidden', this.isInsectSwarmActive() || this.isInsectUltimateActive());
        }

        if (SkillsUI && typeof SkillsUI.render === 'function' && SkillsUI.isOpen()) {
            SkillsUI.render();
        }
    },

    ensureValidAttackMode() {
        const previousMode = this.attackMode;

        if (this.attackMode === 'SWORD' && !this.hasDaiCanhKiemTranUnlocked()) {
            this.attackMode = 'BASE';
        }

        if (this.attackMode === 'INSECT' && !this.canUseInsectAttackMode()) {
            this.attackMode = 'BASE';
        }

        if (previousMode !== this.attackMode) {
            syncSwordFormation();
            return;
        }

        this.renderAttackModeUI();
    },

    clearAttackSkill() {
        if (this.isUltimateBusy()) {
            showNotify('Không thể thu hồi bí pháp khi tuyệt kỹ đang vận chuyển.', '#ffd36b');
            return false;
        }

        if (!this.hasActiveAttackSkill()) {
            this.renderAttackModeUI();
            return true;
        }

        this.attackMode = 'BASE';
        syncSwordFormation();
        showNotify(`Thu hồi bí pháp, trở về ${formatNumber(getBaseSwordCountBeforeFormation())} thanh bản mệnh kiếm.`, '#8fffe0');
        return true;
    },

    setAttackMode(mode) {
        const nextMode = mode === 'INSECT' ? 'INSECT' : 'SWORD';

        if (this.isUltimateBusy()) {
            showNotify('Không thể đổi bí pháp khi tuyệt kỹ đang vận chuyển.', '#ffd36b');
            return false;
        }

        if (!this.hasUnlockedAttackSkill(nextMode)) {
            showNotify('Chưa lĩnh ngộ bí pháp này.', '#ffd36b');
            return false;
        }

        if (nextMode === 'INSECT' && !this.canUseInsectAttackMode()) {
            const totalInsects = this.getTotalTamedInsectCount();
            showNotify(
                totalInsects > 0
                    ? 'Đàn trùng đều đang lưu lại dưỡng đàn, hãy điểm danh ít nhất một loài xuất trận.'
                    : 'Chưa có linh trùng nào đủ duyên nhập trận.',
                '#ffb26b'
            );
            return false;
        }

        if (this.attackMode === nextMode) {
            return this.clearAttackSkill();
        }

        this.attackMode = nextMode;
        syncSwordFormation();
        showNotify(
            nextMode === 'INSECT' ? 'Chuyển sang Khu Trùng Thuật.' : 'Khai triển Đại Canh Kiếm Trận.',
            nextMode === 'INSECT' ? '#79ffd4' : '#8fffe0'
        );
        return true;
    },

    hasBeastCapacity(amount = 1) {
        const safeAmount = Math.max(0, Math.floor(amount || 0));
        return (this.getTotalTamedInsectCount() + safeAmount) <= this.getBeastBagCapacity();
    },

    addInsectEgg(speciesKey, count = 1) {
        const species = this.getInsectSpecies(speciesKey);
        const safeCount = Math.max(0, Math.floor(count || 0));
        if (!species || safeCount <= 0) return 0;

        this.insectEggs[speciesKey] = Math.max(0, Math.floor(this.insectEggs[speciesKey] || 0)) + safeCount;
        this.markDiscoveredInsect(speciesKey);
        return safeCount;
    },

    changeTamedInsects(speciesKey, delta = 0) {
        const species = this.getInsectSpecies(speciesKey);
        const safeDelta = Math.trunc(delta || 0);
        if (!species || safeDelta === 0) return 0;

        const currentCount = Math.max(0, Math.floor(this.tamedInsects[speciesKey] || 0));
        const nextCount = Math.max(0, currentCount + safeDelta);

        if (nextCount <= 0) {
            delete this.tamedInsects[speciesKey];
        } else {
            this.tamedInsects[speciesKey] = nextCount;
            this.markDiscoveredInsect(speciesKey);
        }

        this.ensureValidAttackMode();
        return nextCount - currentCount;
    },

    hatchInsectEgg(speciesKey, count = 1) {
        const species = this.getInsectSpecies(speciesKey);
        const safeCount = Math.max(1, Math.floor(count || 1));
        const hatchPreview = this.getHatchPreview(speciesKey, safeCount);
        const hatchCount = Math.max(0, Math.floor(hatchPreview.hatchCount || 0));
        const requirements = this.getSpeciesHatchRequirements(speciesKey);

        if (!species || hatchPreview.availableEggs <= 0) {
            return { success: false, reason: 'no-egg', count: 0 };
        }

        if (hatchPreview.reason === 'materials') {
            showNotify(`Thiêu nguyên liệu để ấp nở ${species.name}.`, CONFIG.INSECT?.HATCH?.NOTIFY_COLOR || species.color);
            return { success: false, reason: 'materials', count: 0 };
        }

        if (hatchCount <= 0) {
            return { success: false, reason: 'full', count: 0 };
        }

        if (!this.consumeRequiredMaterials(requirements, hatchCount)) {
            showNotify(`Thiêu nguyên liệu để ấp nở ${species.name}.`, CONFIG.INSECT?.HATCH?.NOTIFY_COLOR || species.color);
            return { success: false, reason: 'materials', count: 0 };
        }

        this.insectEggs[speciesKey] = hatchPreview.availableEggs - hatchCount;
        if (this.insectEggs[speciesKey] <= 0) delete this.insectEggs[speciesKey];

        this.changeTamedInsects(speciesKey, hatchCount);
        showNotify(`Ấp nở ${formatNumber(hatchCount)} ${species.name}`, CONFIG.INSECT?.HATCH?.NOTIFY_COLOR || species.color);
        this.refreshResourceUI();
        return { success: true, reason: 'hatched', count: hatchCount };
    },

    loseRandomTamedInsect(baseChance = 0, speciesPool = null) {
        const chance = Math.max(0, Math.min(1, baseChance || 0));
        const candidates = (speciesPool || this.getCombatReadyInsectSpeciesKeys())
            .filter(speciesKey => (this.tamedInsects?.[speciesKey] || 0) > 0);

        if (!candidates.length || Math.random() >= chance) return null;

        const weighted = {};
        candidates.forEach(speciesKey => {
            const species = this.getInsectSpecies(speciesKey);
            const count = this.tamedInsects[speciesKey] || 0;
            weighted[speciesKey] = Math.max(0.05, count / Math.max(0.2, species?.vitality || 1));
        });

        const chosenKey = pickWeightedKey(weighted, candidates[0]);
        this.changeTamedInsects(chosenKey, -1);
        return chosenKey;
    },

    reproduceRandomInsect(baseChance = 0, speciesPool = null) {
        const chance = Math.max(0, Math.min(1, baseChance || 0));
        const pool = Array.isArray(speciesPool) && speciesPool.length
            ? speciesPool
            : this.getActiveInsectSpeciesKeys();
        const candidates = pool.filter(speciesKey => this.hasInsectHabitat(speciesKey));

        if (!candidates.length || !this.hasBeastCapacity(1) || Math.random() >= chance) return null;

        const weighted = {};
        candidates.forEach(speciesKey => {
            const species = this.getInsectSpecies(speciesKey);
            const count = this.tamedInsects[speciesKey] || 0;
            weighted[speciesKey] = Math.max(0.05, count * Math.max(0.15, species?.fertility || 1));
        });

        const chosenKey = pickWeightedKey(weighted, candidates[0]);
        this.changeTamedInsects(chosenKey, 1);
        return chosenKey;
    },

    createRandomInsectEggDropSpec() {
        const speciesRates = this.getInsectSpeciesEntries().reduce((rates, [speciesKey, species]) => {
            rates[speciesKey] = Math.max(0.01, species.weight || 1);
            return rates;
        }, {});
        const speciesKey = pickWeightedKey(speciesRates, this.getInsectSpeciesEntries()[0]?.[0]);

        return {
            kind: 'INSECT_EGG',
            category: 'INSECT_EGG',
            quality: 'LOW',
            speciesKey
        };
    },

    createRandomMaterialDropSpec(isElite = false) {
        const materialEntries = Object.entries(CONFIG.ITEMS?.MATERIALS || {});
        const materialRates = materialEntries.reduce((rates, [materialKey, materialConfig]) => {
            rates[materialKey] = Math.max(0.01, Number(materialConfig?.dropWeight) || 1);
            return rates;
        }, {});
        const fallbackKey = materialEntries[0]?.[0] || null;
        const materialKey = pickWeightedKey(materialRates, fallbackKey);
        const materialConfig = this.getMaterialConfig(materialKey);

        return {
            kind: 'MATERIAL',
            category: 'MATERIAL',
            quality: materialConfig?.quality || (isElite ? 'MEDIUM' : 'LOW'),
            materialKey
        };
    },

    getEnemyMaterialDropRates(enemy = null) {
        const animalKey = enemy?.animalKey || null;
        const configuredRates = animalKey ? ANIMAL_MATERIAL_DROP_TABLES[animalKey] : null;

        if (configuredRates) {
            return { ...configuredRates };
        }

        return {
            TINH_THIT: 2.2,
            YEU_HUYET: 1.6,
            YEU_GIAC: 1.2,
            DOC_NANG: 0.8,
            LINH_TY: 0.8
        };
    },

    createEnemyMaterialDropSpec(enemy = null, isElite = false) {
        const materialRates = this.getEnemyMaterialDropRates(enemy);
        const fallbackKey = Object.keys(materialRates)[0] || 'TINH_THIT';
        const materialKey = pickWeightedKey(materialRates, fallbackKey);
        const materialConfig = this.getMaterialConfig(materialKey);

        return {
            kind: 'MATERIAL',
            category: 'MATERIAL',
            quality: materialConfig?.quality || (isElite ? 'MEDIUM' : 'LOW'),
            materialKey
        };
    },

    createGuaranteedMajorRealmDrops(enemy = null) {
        if ((enemy?.rankData?.id || 0) < KET_DAN_REALM_START_ID) return [];

        const demonCore = this.getMaterialConfig('YEU_DAN');
        const dropCount = enemy?.isElite ? 2 : 1;

        return Array.from({ length: dropCount }, () => ({
            kind: 'MATERIAL',
            category: 'MATERIAL',
            quality: demonCore?.quality || 'HIGH',
            materialKey: 'YEU_DAN'
        }));
    },

    getSpiritStoneType(quality) {
        return CONFIG.SPIRIT_STONE.TYPES[quality] || CONFIG.SPIRIT_STONE.TYPES.LOW;
    },

    getSpiritStoneCompactLabel(quality) {
        return {
            LOW: 'HP',
            MEDIUM: 'TrP',
            HIGH: 'ThP',
            SUPREME: 'CP'
        }[quality] || 'HP';
    },

    getSpiritStoneTotalValue() {
        return Object.entries(this.spiritStones).reduce((total, [quality, count]) => {
            return total + (count * this.getSpiritStoneType(quality).value);
        }, 0);
    },

    setSpiritStoneTotalValue(totalLowValue) {
        let remaining = Math.max(0, Math.floor(totalLowValue));
        const nextWallet = { LOW: 0, MEDIUM: 0, HIGH: 0, SUPREME: 0 };

        STONE_ORDER.forEach(quality => {
            const type = this.getSpiritStoneType(quality);
            nextWallet[quality] = Math.floor(remaining / type.value);
            remaining %= type.value;
        });

        this.spiritStones = nextWallet;
    },

    addSpiritStone(quality, count = 1) {
        const type = this.getSpiritStoneType(quality);
        this.setSpiritStoneTotalValue(this.getSpiritStoneTotalValue() + (type.value * count));
    },

    canAffordLowStoneCost(costLowStone) {
        return this.getSpiritStoneTotalValue() >= Math.max(0, costLowStone);
    },

    spendSpiritStones(costLowStone) {
        const safeCost = Math.max(0, Math.floor(costLowStone));
        if (!this.canAffordLowStoneCost(safeCost)) return false;

        this.setSpiritStoneTotalValue(this.getSpiritStoneTotalValue() - safeCost);
        return true;
    },

    getSpiritStoneBreakdown(totalLowValue) {
        let remaining = Math.max(0, Math.floor(totalLowValue));

        return STONE_ORDER.map(quality => {
            const type = this.getSpiritStoneType(quality);
            const count = Math.floor(remaining / type.value);
            remaining %= type.value;

            return {
                quality,
                count,
                type
            };
        });
    },

    renderSpiritStoneCostMarkup(totalLowValue) {
        const entries = this.getSpiritStoneBreakdown(totalLowValue)
            .filter(entry => entry.count > 0);

        if (!entries.length) {
            const fallback = this.getSpiritStoneType('LOW');
            entries.push({
                quality: 'LOW',
                count: 0,
                type: fallback
            });
        }

        return `
            <span class="stone-cost-list">
                ${entries.map(entry => `
                    <span class="stone-cost-chip" style="--stone-accent:${entry.type.color}" title="${escapeHtml(entry.type.label)}">
                        ${formatNumber(entry.count)} ${escapeHtml(this.getSpiritStoneCompactLabel(entry.quality))}
                    </span>
                `).join('')}
            </span>
        `;
    },

    buildInventoryKey(spec) {
        const parts = [
            spec.kind || 'PILL',
            spec.category || 'EXP',
            spec.quality || 'LOW'
        ];

        if (spec.specialKey) parts.push(spec.specialKey);
        if (spec.realmKey) parts.push(spec.realmKey);
        if (spec.uniqueKey) parts.push(spec.uniqueKey);
        if (spec.speciesKey) parts.push(spec.speciesKey);
        if (spec.materialKey) parts.push(spec.materialKey);
        return parts.join('|');
    },

    getUniqueItemConfig(uniqueKey) {
        return CONFIG.SECRET_ARTS?.[uniqueKey]
            || CONFIG.INSECT?.UNIQUE_ITEMS?.[uniqueKey]
            || null;
    },

    getItemQualityConfig(item) {
        const categoryMap = {
            EXP: CONFIG.PILL.EXP_QUALITIES,
            INSIGHT: CONFIG.PILL.INSIGHT_QUALITIES,
            BREAKTHROUGH: CONFIG.PILL.BREAKTHROUGH_QUALITIES,
            ATTACK: CONFIG.PILL.ATTACK_QUALITIES,
            SHIELD_BREAK: CONFIG.PILL.SHIELD_BREAK_QUALITIES,
            BERSERK: CONFIG.PILL.BERSERK_QUALITIES,
            RAGE: CONFIG.PILL.RAGE_QUALITIES,
            MANA: CONFIG.PILL.MANA_QUALITIES,
            MAX_MANA: CONFIG.PILL.MAX_MANA_QUALITIES,
            REGEN: CONFIG.PILL.REGEN_QUALITIES,
            SPEED: CONFIG.PILL.SPEED_QUALITIES,
            FORTUNE: CONFIG.PILL.FORTUNE_QUALITIES,
            BAG: CONFIG.ITEMS.STORAGE_BAGS,
            SWORD_ART: CONFIG.SECRET_ARTS,
            FLAME_ART: CONFIG.SECRET_ARTS,
            INSECT_SKILL: CONFIG.INSECT.UNIQUE_ITEMS,
            INSECT_ARTIFACT: CONFIG.INSECT.UNIQUE_ITEMS,
            SPIRIT_BAG: { HIGH: CONFIG.INSECT.BEAST_BAG }
        };

        if (item.specialKey) {
            return CONFIG.PILL.SPECIAL_ITEMS[item.specialKey] || CONFIG.PILL.EXP_QUALITIES.LOW;
        }

        if (item.category === 'MATERIAL' || item.kind === 'MATERIAL') {
            return this.getMaterialConfig(item.materialKey) || CONFIG.PILL.EXP_QUALITIES.LOW;
        }

        if (item.uniqueKey) {
            const uniqueConfig = this.getUniqueItemConfig(item.uniqueKey);
            if (uniqueConfig) return uniqueConfig;
        }

        if (item.category === 'INSECT_EGG') {
            return this.getInsectEggShopConfig(item.speciesKey);
        }

        if (item.category === 'SPIRIT_HABITAT') {
            return this.getInsectHabitatConfig(item.speciesKey);
        }

        if (item.category === 'SPIRIT_BAG') {
            return CONFIG.INSECT.BEAST_BAG;
        }

        const defs = categoryMap[item.category] || CONFIG.PILL.EXP_QUALITIES;
        return defs[item.quality] || defs.LOW;
    },

    getItemDisplayName(item) {
        const qualityConfig = this.getItemQualityConfig(item);
        if (item.specialKey) {
            return qualityConfig.fullName;
        }

        if (item.category === 'MATERIAL' || item.kind === 'MATERIAL') {
            return qualityConfig.fullName || 'Nguyên liệu';
        }

        if (item.kind === 'INSECT_EGG' || item.category === 'INSECT_EGG') {
            const species = this.getInsectSpecies(item.speciesKey);
            return species ? `Trứng ${species.name}` : 'Trứng kỳ trùng';
        }

        if (item.uniqueKey && qualityConfig.fullName) {
            return qualityConfig.fullName;
        }

        if (item.category === 'BREAKTHROUGH') {
            const realmName = item.realmName || this.getNextMajorRealmInfo()?.name || "đột phá";
            return `${qualityConfig.label} ${realmName} đan`;
        }

        if (item.category === 'BAG' || item.category === 'SPIRIT_BAG' || item.category === 'SPIRIT_HABITAT') {
            return qualityConfig.fullName;
        }

        return qualityConfig.fullName;
    },

    _getItemCategoryLabelLegacy(item) {
        const staticLabels = {
            MATERIAL: 'Nguyên liệu',
            SPIRIT_HABITAT: 'Linh thú đại',
            BAG: 'Túi trữ vật',
            SPIRIT_BAG: 'Linh thú đại',
            INSECT_SKILL: 'Trùng đạo bí pháp',
            INSECT_ARTIFACT: 'Kỳ trùng bảo vật',
            INSECT_EGG: 'Trùng noãn'
        };
        if (staticLabels[item.category]) return staticLabels[item.category];
        if (item.category === 'BAG') return 'Túi trữ vật';

        const labels = {
            EXP: 'Tu vi',
            INSIGHT: 'Ngộ đạo',
            BREAKTHROUGH: 'Đột phá',
            ATTACK: 'Công phạt',
            SHIELD_BREAK: 'Phá khiên',
            BERSERK: 'Cuồng bạo',
            RAGE: 'Nộ',
            MANA: 'Hồi linh',
            MAX_MANA: 'Khai hải',
            REGEN: 'Hồi nguyên',
            SPEED: 'Thân pháp',
            FORTUNE: 'Vận khí',
            SPECIAL: 'Cấm kị'
        };

        return labels[item.category] || 'Đan dược';
    },

    getItemDescription(item) {
        const qualityConfig = this.getItemQualityConfig(item);
        if (item.specialKey === 'CHUNG_CUC_DAO_NGUYEN_DAN') {
            return 'Cực phẩm đạo đan bảy sắc, lập tức đưa tu vi lên cảnh giới cao nhất Chân tiên đại viên mãn và lưu lại hào quang 7 sắc.';
        }

        if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
            return 'Cấm kị hắc đan, cưỡng ép bước vào Chân tiên đại viên mãn trong 1 giây rồi tan vào hư vô. Chỉ có thể hồi phục khi tải lại giới vực.';
        }

        if (item.category === 'SPIRIT_HABITAT') {
            const species = this.getInsectSpecies(item.speciesKey);
            return species
                ? `Linh Thú Đại riêng dành cho ${species.name}. Có nơi ở đúng mới có thể sinh nở ổn định, nếu nuôi sai sẽ có tỷ lệ tử vong.`
                : 'Linh Thú Đại riêng giúp kỳ trùng sinh nở an toàn.';
        }

        if (item.category === 'MATERIAL') {
            const usageSummary = this.getMaterialUsageSummary(item.materialKey);
            return [qualityConfig.description, usageSummary].filter(Boolean).join(' ');
        }

        if (item.category === 'INSECT_EGG') {
            const species = this.getInsectSpecies(item.speciesKey);
            const tier = this.getInsectTierInfo(species?.tier);
            const requirements = this.getSpeciesHatchRequirements(item.speciesKey)
                .map(requirement => {
                    const materialConfig = this.getMaterialConfig(requirement.materialKey);
                    return `${materialConfig?.fullName || requirement.materialKey} x${formatNumber(requirement.count)}`;
                })
                .join(', ');
            const habitatConfig = this.getInsectHabitatConfig(item.speciesKey);
            return species
                ? `${tier.label}: ${species.description} Nguyên liệu ấp nở: ${requirements || 'không cần'}. Muốn ấp nở ổn định cần ${habitatConfig.fullName}.`
                : 'Trứng kỳ trùng có thể ấp nở trong tab Linh thú.';
        }

        switch (item.category) {
            case 'BAG': {
                const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
                return `Mở rộng túi trữ vật thêm ${formatNumber(extraSlots)} ô. Có thể mua nhiều lần để cộng dồn dung lượng.`;
            }
            case 'SPIRIT_BAG': {
                const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
                return `Mở rộng Linh Thú Đại thêm ${formatNumber(extraSlots)} ô, tăng chỗ cho linh trùng đã nở. Có thể mua nhiều lần để cộng dồn dung lượng.`;
            }
            case 'SWORD_ART':
                return 'Kiếm đạo bí pháp chỉ truyền một lần. Sau khi lĩnh ngộ mới từ một thanh bản mệnh kiếm hóa thành Đại Canh Kiếm Trận hộ thân như hiện tại.';
            case 'FLAME_ART':
                return 'Thiên địa linh hỏa Càn Lam Băng Diễm. Sau khi luyện hóa, con trỏ tâm niệm mới hiển hóa thành lam diễm, trước đó chỉ là một điểm sáng nhỏ.';
            case 'INSECT_SKILL':
                return 'Bí pháp điều động bầy linh trùng, cho phép thay kiếm trận bằng trùng vân công sát quanh con trỏ.';
            case 'INSECT_ARTIFACT':
                return 'Dị bảo ghi chép huyết mạch và năng lực các kỳ trùng. Thu được loài nào thì mục tương ứng sẽ sáng lên.';
            case 'INSECT_EGG': {
                const species = this.getInsectSpecies(item.speciesKey);
                const tier = this.getInsectTierInfo(species?.tier);
                return species
                    ? `${tier.label}: ${species.description}`
                    : 'Trứng kỳ trùng có thể ấp nở trong tab Linh thú.';
            }
            case 'INSIGHT':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.expGainPct || 0) * 100)}% tu vi nhận từ chiến đấu và đan tu vi.`;
            case 'BREAKTHROUGH': {
                const realmName = item.realmName || "cảnh giới kế tiếp";
                return `Tăng ${Math.round(qualityConfig.breakthroughBoost * 100)}% tỉ lệ đột phá tới ${realmName}.`;
            }
            case 'ATTACK':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.attackPct || 0) * 100)}% lực công kích.`;
            case 'SHIELD_BREAK':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.shieldBreakPct || 0) * 100)}% sát lực lên khiên địch.`;
            case 'BERSERK': {
                const sideEffects = [];
                if (qualityConfig.sideManaLoss) sideEffects.push(`hao ${qualityConfig.sideManaLoss} linh lực`);
                if (qualityConfig.sideMaxManaFlat) sideEffects.push(`giảm ${Math.abs(qualityConfig.sideMaxManaFlat)} giới hạn linh lực`);
                if (qualityConfig.sideSpeedPct) sideEffects.push(`giảm ${Math.round(Math.abs(qualityConfig.sideSpeedPct) * 100)}% tốc độ`);
                if (qualityConfig.sideExpLossRatio) sideEffects.push(`tổn ${Math.round(qualityConfig.sideExpLossRatio * 100)}% tu vi hiện có`);

                const sideText = sideEffects.length ? ` Tác dụng phụ: ${sideEffects.join(', ')}.` : '';
                return `Cuồng hóa ${Math.round((qualityConfig.attackPct || 0) * 100)}% lực công kích trong ${Math.round((qualityConfig.durationMs || 0) / 1000)} giây.${sideText}`;
            }
            case 'RAGE':
                return `Tăng ngay ${Math.round(qualityConfig.rageGain || 0)} nộ tuyệt kỹ.`;
            case 'MANA':
                return `Hồi ngay ${Math.round(qualityConfig.manaRestore || 0)} linh lực.`;
            case 'MAX_MANA':
                return `Tăng vĩnh viễn ${Math.round(qualityConfig.maxManaFlat || 0)} giới hạn linh lực.`;
            case 'REGEN':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.manaRegenPct || 0) * 100)}% tốc độ hồi linh lực.`;
            case 'SPEED':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.speedPct || 0) * 100)}% tốc độ vận chuyển kiếm trận.`;
            case 'FORTUNE':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.dropRatePct || 0) * 100)}% tỉ lệ rơi đan dược và linh thạch.`;
            case 'EXP':
            default:
                return `Tăng ${Math.round(qualityConfig.expFactor * 100)}% tu vi của cảnh giới hiện tại.`;
        }
    },

    getItemDescriptionMarkup(item) {
        const description = this.getItemDescription(item);
        const sideEffectMarker = 'Tác dụng phụ:';
        const markerIndex = description.indexOf(sideEffectMarker);

        if (markerIndex === -1) {
            return escapeHtml(description);
        }

        const mainText = description.slice(0, markerIndex).trim();
        const sideText = description.slice(markerIndex + sideEffectMarker.length).trim();

        return `
            ${escapeHtml(mainText)}
            <span class="item-description__side-effect">
                <span class="item-description__side-label">${escapeHtml(sideEffectMarker)}</span>
                ${escapeHtml(sideText)}
            </span>
        `.trim();
    },

    getItemCategoryLabel(item) {
        const staticLabels = {
            MATERIAL: 'Nguyên liệu',
            SPIRIT_HABITAT: 'Linh thú đại',
            BAG: 'Túi trữ vật',
            SPIRIT_BAG: 'Linh thú đại',
            SWORD_ART: 'Kiếm đạo bí pháp',
            FLAME_ART: 'Thiên địa linh hỏa',
            INSECT_SKILL: 'Trùng đạo bí pháp',
            INSECT_ARTIFACT: 'Kỳ trùng bảo vật',
            INSECT_EGG: 'Trùng noãn'
        };

        if (staticLabels[item.category]) return staticLabels[item.category];

        const labels = {
            EXP: 'Tu vi',
            INSIGHT: 'Ngộ đạo',
            BREAKTHROUGH: 'Đột phá',
            ATTACK: 'Công phạt',
            SHIELD_BREAK: 'Phá khiên',
            BERSERK: 'Cuồng bạo',
            RAGE: 'Nộ',
            MANA: 'Hồi linh',
            MAX_MANA: 'Khai hải',
            REGEN: 'Hồi nguyên',
            SPEED: 'Thân pháp',
            FORTUNE: 'Vận khí',
            SPECIAL: 'Cấm kỵ'
        };

        return labels[item.category] || 'Đan dược';
    },

    _getItemDescriptionLegacy(item) {
        const qualityConfig = this.getItemQualityConfig(item);
        if (item.specialKey === 'CHUNG_CUC_DAO_NGUYEN_DAN') {
            return 'Cực phẩm đạo đan bảy sắc, lập tức đưa tu vi lên cảnh giới cao nhất Chân tiên đại viên mãn và lưu lại hào quang 7 sắc.';
        }

        if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
            return 'Cấm kỵ hắc đan, cưỡng ép bước vào Chân tiên đại viên mãn trong 1 giây rồi tan vào hư vô. Chỉ có thể hồi phục khi tải lại giới vực.';
        }

        switch (item.category) {
            case 'BAG': {
                const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
                return `Mở rộng túi trữ vật thêm ${formatNumber(extraSlots)} ô. Có thể mua nhiều lần để cộng dồn dung lượng.`;
            }
            case 'SPIRIT_BAG': {
                const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
                return `Mở rộng Linh Thú Đại thêm ${formatNumber(extraSlots)} ô, tăng chỗ cho linh trùng đã nở. Có thể mua nhiều lần để cộng dồn dung lượng.`;
            }
            case 'SWORD_ART':
                return 'Kiếm đạo bí pháp chỉ truyền một lần. Sau khi lĩnh ngộ mới từ một thanh bản mệnh kiếm hóa thành Đại Canh Kiếm Trận như hiện tại.';
            case 'FLAME_ART':
                return 'Thiên địa linh hỏa Càn Lam Băng Diễm. Sau khi luyện hóa, con trỏ tâm niệm mới hiển hóa thành lam diễm, trước đó chỉ là một điểm sáng nhỏ.';
            case 'INSECT_SKILL':
                return 'Bí pháp điều động bầy linh trùng, cho phép thay kiếm trận bằng trùng vân công sát quanh con trỏ.';
            case 'INSECT_ARTIFACT':
                return 'Dị bảo ghi chép huyết mạch và năng lực các kỳ trùng. Thu được loài nào thì mục tương ứng sẽ sáng lên.';
            case 'INSECT_EGG': {
                const species = this.getInsectSpecies(item.speciesKey);
                const tier = this.getInsectTierInfo(species?.tier);
                return species
                    ? `${tier.label}: ${species.description}`
                    : 'Trứng kỳ trùng có thể ấp nở trong tab Linh thú.';
            }
            case 'INSIGHT':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.expGainPct || 0) * 100)}% tu vi nhận từ chiến đấu và đan tu vi.`;
            case 'BREAKTHROUGH': {
                const realmName = item.realmName || 'cảnh giới kế tiếp';
                return `Tăng ${Math.round(qualityConfig.breakthroughBoost * 100)}% tỉ lệ đột phá tới ${realmName}.`;
            }
            case 'ATTACK':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.attackPct || 0) * 100)}% lực công kích.`;
            case 'SHIELD_BREAK':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.shieldBreakPct || 0) * 100)}% sát lực lên khiên địch.`;
            case 'BERSERK': {
                const sideEffects = [];
                if (qualityConfig.sideManaLoss) sideEffects.push(`hao ${qualityConfig.sideManaLoss} linh lực`);
                if (qualityConfig.sideMaxManaFlat) sideEffects.push(`giảm ${Math.abs(qualityConfig.sideMaxManaFlat)} giới hạn linh lực`);
                if (qualityConfig.sideSpeedPct) sideEffects.push(`giảm ${Math.round(Math.abs(qualityConfig.sideSpeedPct) * 100)}% tốc độ`);
                if (qualityConfig.sideExpLossRatio) sideEffects.push(`tổn ${Math.round(qualityConfig.sideExpLossRatio * 100)}% tu vi hiện có`);

                const sideText = sideEffects.length ? ` Tác dụng phụ: ${sideEffects.join(', ')}.` : '';
                return `Cuồng hóa ${Math.round((qualityConfig.attackPct || 0) * 100)}% lực công kích trong ${Math.round((qualityConfig.durationMs || 0) / 1000)} giây.${sideText}`;
            }
            case 'RAGE':
                return `Tăng ngay ${Math.round(qualityConfig.rageGain || 0)} nộ tuyệt kỹ.`;
            case 'MANA':
                return `Hồi ngay ${Math.round(qualityConfig.manaRestore || 0)} linh lực.`;
            case 'MAX_MANA':
                return `Tăng vĩnh viễn ${Math.round(qualityConfig.maxManaFlat || 0)} giới hạn linh lực.`;
            case 'REGEN':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.manaRegenPct || 0) * 100)}% tốc độ hồi linh lực.`;
            case 'SPEED':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.speedPct || 0) * 100)}% tốc độ vận chuyển kiếm trận.`;
            case 'FORTUNE':
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.dropRatePct || 0) * 100)}% tỉ lệ rơi đan dược và linh thạch.`;
            case 'EXP':
            default:
                return `Tăng ${Math.round(qualityConfig.expFactor * 100)}% tu vi của cảnh giới hiện tại.`;
        }
    },

    addInventoryItem(spec, count = 1) {
        const itemKey = this.buildInventoryKey(spec);
        if (!this.inventory[itemKey] && !this.hasInventorySpaceForSpec(spec)) {
            return null;
        }

        if (!this.inventory[itemKey]) {
            this.inventory[itemKey] = {
                key: itemKey,
                kind: spec.kind || 'PILL',
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

        this.inventory[itemKey].count += count;
        return this.inventory[itemKey];
    },

    getInventoryEntries() {
        const categoryOrder = CONFIG.PILL.CATEGORY_SORT || {};

        return Object.values(this.inventory)
            .filter(item => item.count > 0)
            .sort((a, b) => {
                const categoryDiff = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
                if (categoryDiff !== 0) return categoryDiff;

                const qualityDiff = QUALITY_ORDER.indexOf(b.quality) - QUALITY_ORDER.indexOf(a.quality);
                if (qualityDiff !== 0) return qualityDiff;

                return (a.realmName || '').localeCompare(b.realmName || '', 'vi');
            });
    },

    isInventoryItemUsable(item) {
        if (this.isVoidCollapsed) return false;
        if (item.category === 'MATERIAL') return false;
        if (item.category === 'EXP') return true;
        if (item.category !== 'BREAKTHROUGH') return true;

        const nextRealm = this.getNextMajorRealmInfo();
        return Boolean(nextRealm && item.realmKey === nextRealm.key);
    },

    createRandomPillDropSpec(isElite = false) {
        const categoryRates = CONFIG.PILL.CATEGORY_RATES[isElite ? 'ELITE' : 'NORMAL'];
        const qualityRates = CONFIG.PILL.QUALITY_RATES[isElite ? 'ELITE' : 'NORMAL'];
        let category = pickWeightedKey(categoryRates, 'EXP');
        const quality = pickWeightedKey(qualityRates, 'LOW');

        if (category === 'BREAKTHROUGH') {
            const nextRealm = this.getNextMajorRealmInfo();
            if (!nextRealm) category = 'EXP';
            else {
                return {
                    kind: 'PILL',
                    category,
                    quality,
                    realmKey: nextRealm.key,
                    realmName: nextRealm.name
                };
            }
        }

        return {
            kind: 'PILL',
            category,
            quality
        };
    },

    createRandomSpiritStoneDropSpec(isElite = false) {
        const qualityRates = CONFIG.SPIRIT_STONE.QUALITY_RATES[isElite ? 'ELITE' : 'NORMAL'];
        return {
            kind: 'STONE',
            quality: pickWeightedKey(qualityRates, 'LOW')
        };
    },

    getShopItems() {
        const shopCategories = ['EXP', 'INSIGHT', 'ATTACK', 'SHIELD_BREAK', 'BERSERK', 'RAGE', 'MANA', 'MAX_MANA', 'REGEN', 'SPEED', 'FORTUNE'];
        const items = [];

        shopCategories.forEach(category => {
            QUALITY_ORDER.forEach(quality => {
                const qualityConfig = this.getItemQualityConfig({ category, quality });
                items.push({
                    id: `${category}:${quality}`,
                    kind: 'PILL',
                    category,
                    quality,
                    priceLowStone: qualityConfig.buyPriceLowStone
                });
            });
        });

        const nextRealm = this.getNextMajorRealmInfo();
        if (nextRealm) {
            QUALITY_ORDER.forEach(quality => {
                items.push({
                    id: `BREAKTHROUGH:${quality}:${nextRealm.key}`,
                    kind: 'PILL',
                    category: 'BREAKTHROUGH',
                    quality,
                    realmKey: nextRealm.key,
                    realmName: nextRealm.name,
                    priceLowStone: CONFIG.PILL.BREAKTHROUGH_QUALITIES[quality].buyPriceLowStone
                });
            });
        }

        Object.entries(CONFIG.PILL.SPECIAL_ITEMS || {}).forEach(([specialKey, specialConfig]) => {
            items.push({
                id: `SPECIAL:${specialKey}`,
                kind: 'PILL',
                category: 'SPECIAL',
                quality: specialConfig.quality || 'SUPREME',
                specialKey,
                priceLowStone: specialConfig.buyPriceLowStone || 0
            });
        });

        Object.entries(CONFIG.SECRET_ARTS || {}).forEach(([uniqueKey, artConfig]) => {
            items.push({
                id: `SECRET_ART:${uniqueKey}`,
                kind: 'UNIQUE',
                category: uniqueKey === 'DAI_CANH_KIEM_TRAN' ? 'SWORD_ART' : 'FLAME_ART',
                quality: artConfig.quality || 'SUPREME',
                uniqueKey,
                priceLowStone: artConfig.buyPriceLowStone || 0,
                isOneTime: true
            });
        });

        QUALITY_ORDER.forEach(quality => {
            const bagConfig = CONFIG.ITEMS.STORAGE_BAGS?.[quality];
            if (!bagConfig) return;

            items.push({
                id: `BAG:${quality}`,
                kind: 'UPGRADE',
                category: 'BAG',
                quality,
                priceLowStone: bagConfig.buyPriceLowStone || 0
            });
        });

        Object.entries(CONFIG.INSECT?.UNIQUE_ITEMS || {}).forEach(([uniqueKey, uniqueConfig]) => {
            items.push({
                id: `UNIQUE:${uniqueKey}`,
                kind: 'UNIQUE',
                category: uniqueKey === 'KHU_TRUNG_THUAT' ? 'INSECT_SKILL' : 'INSECT_ARTIFACT',
                quality: uniqueConfig.quality || 'HIGH',
                uniqueKey,
                priceLowStone: uniqueConfig.buyPriceLowStone || 0,
                isOneTime: true
            });
        });

        this.getInsectSpeciesEntries().forEach(([speciesKey, species]) => {
            const eggConfig = this.getInsectEggShopConfig(speciesKey);
            const habitatConfig = this.getInsectHabitatConfig(speciesKey);

            items.push({
                id: `INSECT_EGG:${speciesKey}`,
                kind: 'INSECT_EGG',
                category: 'INSECT_EGG',
                quality: eggConfig.quality || 'LOW',
                speciesKey,
                priceLowStone: eggConfig.buyPriceLowStone || 0
            });

            items.push({
                id: `SPIRIT_HABITAT:${speciesKey}`,
                kind: 'HABITAT',
                category: 'SPIRIT_HABITAT',
                quality: habitatConfig.quality || 'LOW',
                speciesKey,
                priceLowStone: habitatConfig.buyPriceLowStone || 0,
                habitatTier: species?.tier || 'PHAM'
            });
        });

        Object.entries(CONFIG.ITEMS?.MATERIALS || {}).forEach(([materialKey, materialConfig]) => {
            items.push({
                id: `MATERIAL:${materialKey}`,
                kind: 'MATERIAL',
                category: 'MATERIAL',
                quality: materialConfig.quality || 'LOW',
                materialKey,
                priceLowStone: materialConfig.buyPriceLowStone || 0
            });
        });

        if (CONFIG.INSECT?.BEAST_BAG) {
            items.push({
                id: 'SPIRIT_BAG:HIGH',
                kind: 'UPGRADE',
                category: 'SPIRIT_BAG',
                quality: CONFIG.INSECT.BEAST_BAG.quality || 'HIGH',
                priceLowStone: CONFIG.INSECT.BEAST_BAG.buyPriceLowStone || 0
            });
        }

        const shopOrder = {
            SWORD_ART: -5,
            FLAME_ART: -4,
            INSECT_SKILL: -3,
            INSECT_ARTIFACT: -2,
            SPIRIT_BAG: -1.5,
            SPIRIT_HABITAT: -1.25,
            INSECT_EGG: -1.1,
            BAG: -1,
            MATERIAL: -0.5,
            EXP: 0,
            INSIGHT: 1,
            ATTACK: 2,
            SHIELD_BREAK: 3,
            BERSERK: 4,
            RAGE: 5,
            MANA: 6,
            MAX_MANA: 7,
            REGEN: 8,
            SPEED: 9,
            FORTUNE: 10,
            BREAKTHROUGH: 11,
            SPECIAL: 12
        };

        return items.sort((a, b) => {
            const categoryDiff = (shopOrder[a.category] ?? 99) - (shopOrder[b.category] ?? 99);
            if (categoryDiff !== 0) return categoryDiff;

            return QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality);
        });
    },

    collectDrop(dropSpec) {
        if (!dropSpec) return;

        if (dropSpec.kind === 'STONE') {
            const stoneType = this.getSpiritStoneType(dropSpec.quality);
            this.addSpiritStone(dropSpec.quality, 1);
            showNotify(`+1 ${stoneType.label}`, stoneType.color);
        } else if (dropSpec.kind === 'INSECT_EGG') {
            const species = this.getInsectSpecies(dropSpec.speciesKey);
            this.addInsectEgg(dropSpec.speciesKey, 1);
            showNotify(`+1 Trứng ${species?.name || 'kỳ trùng'}`, species?.eggColor || species?.color || '#79ffd4');
        } else {
            if (!this.hasInventorySpaceForSpec(dropSpec)) {
                const qualityConfig = this.getItemQualityConfig(dropSpec);
                showNotify('Túi trữ vật đã đầy, hãy mở rộng thêm dung tích.', qualityConfig.color || '#ff8a80');
                return;
            }

            const item = this.addInventoryItem(dropSpec, 1);
            const qualityConfig = this.getItemQualityConfig(item);
            showNotify(`+1 ${this.getItemDisplayName(item)}`, qualityConfig.color);
        }

        this.refreshResourceUI();
    },

    refreshResourceUI() {
        this.renderExpUI();

        if (ShopUI && typeof ShopUI.render === 'function') {
            ShopUI.render();
        }

        if (InventoryUI && typeof InventoryUI.render === 'function') {
            InventoryUI.render();
        }

        if (ProfileUI && typeof ProfileUI.render === 'function') {
            ProfileUI.render();
        }

        if (SkillsUI && typeof SkillsUI.isOpen === 'function' && SkillsUI.isOpen()) {
            SkillsUI.render();
        }

        if (InsectBookUI && typeof InsectBookUI.isOpen === 'function' && InsectBookUI.isOpen()) {
            InsectBookUI.render();
        }

        this.renderAttackModeUI();
    },

    buyShopItem(itemId) {
        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return false;
        }

        const item = this.getShopItems().find(entry => entry.id === itemId);
        if (!item) return false;
        const qualityConfig = this.getItemQualityConfig(item);

        if (item.isOneTime && item.uniqueKey && this.hasUniquePurchase(item.uniqueKey)) {
            showNotify('Vật phẩm này chỉ có thể mua một lần.', qualityConfig.color || '#ffd36b');
            return false;
        }

        if (item.category === 'SPIRIT_HABITAT' && this.hasInsectHabitat(item.speciesKey)) {
            showNotify('Linh Thú Đại này đã an trí xong.', qualityConfig.color || '#8ebfff');
            return false;
        }

        if (item.category === 'BAG' && !this.canUpgradeInventoryCapacity(item)) {
            showNotify('Túi trữ vật này chưa thể gia tăng dung lượng.', '#ffd36b');
            return false;
        }

        if (item.category === 'SPIRIT_BAG' && !this.canUpgradeBeastBagCapacity(item)) {
            showNotify('Linh Thú Đại này chưa thể gia tăng dung lượng.', qualityConfig.color || '#ffd36b');
            return false;
        }

        const requiresInventorySpace = !['BAG', 'SPIRIT_BAG', 'SPIRIT_HABITAT', 'INSECT_EGG'].includes(item.category);
        if (requiresInventorySpace && !this.hasInventorySpaceForSpec(item)) {
            showNotify('Túi trữ vật đã đầy, không thể mua thêm vật phẩm mới.', '#ff8a80');
            return false;
        }

        if (!this.spendSpiritStones(item.priceLowStone)) {
            showNotify("Linh thạch không đủ để giao dịch", "#ff8a80");
            return false;
        }

        if (item.category === 'BAG') {
            const previousCapacity = this.getInventoryCapacity();
            const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
            this.upgradeInventoryCapacity(previousCapacity + extraSlots);

            showNotify(
                `Túi trữ vật mở rộng lên ${formatNumber(this.getInventoryCapacity())} ô (+${formatNumber(extraSlots)} ô)`,
                qualityConfig.color
            );
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'SPIRIT_BAG') {
            const previousCapacity = this.getBeastBagCapacity();
            const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
            this.beastBagCapacity = previousCapacity + extraSlots;

            showNotify(
                `Linh Thú Đại mở rộng lên ${formatNumber(this.getBeastBagCapacity())} ô (+${formatNumber(extraSlots)} ô)`,
                qualityConfig.color
            );
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'SPIRIT_HABITAT') {
            this.unlockInsectHabitat(item.speciesKey);
            showNotify(`Đã an trí ${this.getItemDisplayName(item)}`, qualityConfig.color || '#8ebfff');
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'INSECT_EGG') {
            this.addInsectEgg(item.speciesKey, 1);
            showNotify(`Đã mua ${this.getItemDisplayName(item)}`, qualityConfig.color || '#79ffd4');
            this.refreshResourceUI();
            return true;
        }

        const addedItem = this.addInventoryItem(item, 1);
        if (item.isOneTime && item.uniqueKey) {
            this.markUniquePurchase(item.uniqueKey);
        }
        showNotify(`Đã mua ${this.getItemDisplayName(addedItem)}`, this.getItemQualityConfig(addedItem).color);
        this.refreshResourceUI();
        return true;
    },

    getInventorySellPrice(item) {
        if (!item) return 0;
        if (['INSECT_ARTIFACT', 'INSECT_SKILL', 'SWORD_ART', 'FLAME_ART'].includes(item.category)) return 0;

        const qualityConfig = this.getItemQualityConfig(item);
        const buyPrice = Math.max(0, qualityConfig.buyPriceLowStone || 0);
        const ratio = Math.max(0, parseFloat(CONFIG.ITEMS.SELLBACK_RATIO) || 0);

        return Math.max(1, Math.floor(buyPrice * ratio));
    },

    sellInventoryItem(itemKey) {
        const item = this.inventory[itemKey];
        if (!item || item.count <= 0) return false;

        const sellPrice = this.getInventorySellPrice(item);
        if (sellPrice <= 0) return false;

        item.count--;
        if (item.count <= 0) delete this.inventory[itemKey];

        this.setSpiritStoneTotalValue(this.getSpiritStoneTotalValue() + sellPrice);
        showNotify(`Bán ${this.getItemDisplayName(item)}: +${formatNumber(sellPrice)} hạ phẩm linh thạch`, this.getItemQualityConfig(item).color);
        this.refreshResourceUI();
        return true;
    },

    useInventoryItem(itemKey) {
        const item = this.inventory[itemKey];
        if (!item || item.count <= 0) return false;

        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return false;
        }

        const qualityConfig = this.getItemQualityConfig(item);

        if (item.category === 'INSECT_ARTIFACT') {
            if (InsectBookUI && typeof InsectBookUI.open === 'function') {
                InsectBookUI.open();
                showNotify(`Mở ${this.getItemDisplayName(item)}`, qualityConfig.color || '#ffd871');
                return true;
            }
            return false;
        }

        if (item.category === 'SWORD_ART' && this.hasDaiCanhKiemTranUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã nhập tâm, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#8fffe0');
            return false;
        }

        if (item.category === 'FLAME_ART' && this.hasCanLamBangDiemUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã được luyện hóa vào thần thức.`, qualityConfig.color || '#79d9ff');
            return false;
        }

        if (item.category === 'INSECT_SKILL' && this.hasKhuTrungThuatUnlocked()) {
            showNotify(`${this.getItemDisplayName(item)} đã lĩnh ngộ xong, không thể lĩnh ngộ thêm.`, qualityConfig.color || '#79ffd4');
            return false;
        }

        if (item.category === 'BREAKTHROUGH' && !this.isInventoryItemUsable(item)) {
            showNotify(`Đan này chỉ hợp để đột phá ${item.realmName}`, "#ffd36b");
            return false;
        }

        item.count--;
        if (item.count <= 0) delete this.inventory[itemKey];

        if (item.category === 'EXP') {
            const rank = this.getCurrentRank();
            if (!rank) return false;

            const expGain = Math.max(1, Math.round(rank.exp * qualityConfig.expFactor * this.getExpGainMultiplier()));
            this.updateExp(expGain);
            showNotify(`Dùng ${this.getItemDisplayName(item)}: +${formatNumber(expGain)} tu vi`, qualityConfig.color);
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'BREAKTHROUGH') {
            const rank = this.getCurrentRank();
            if (!rank) return false;

            const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
            const currentTotal = Math.min(maxAllowed, rank.chance + this.breakthroughBonus);
            const maxBonus = Math.max(0, maxAllowed - rank.chance);
            const nextBonus = Math.min(maxBonus, this.breakthroughBonus + qualityConfig.breakthroughBoost);
            const appliedBoost = Math.min(maxAllowed, rank.chance + nextBonus) - currentTotal;

            if (appliedBoost <= 0) {
                this.addInventoryItem(item, 1);
                showNotify("Dược lực đã chạm giới hạn đột phá", "#ffd36b");
                return false;
            }

            this.breakthroughBonus = nextBonus;
            showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(appliedBoost * 100)}% tỉ lệ đột phá`, qualityConfig.color);
            this.refreshResourceUI();
            return true;
        }

        switch (item.category) {
            case 'SWORD_ART':
                this.unlockCultivationArt('DAI_CANH_KIEM_TRAN');
                this.attackMode = 'SWORD';
                syncSwordFormation();
                showNotify(`Lĩnh ngộ ${this.getItemDisplayName(item)}: kiếm trận đã triển khai ${formatNumber(this.getUnlockedSwordTargetCount())} kiếm.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'FLAME_ART':
                this.unlockCultivationArt('CAN_LAM_BANG_DIEM');
                showNotify(`Luyện hóa ${this.getItemDisplayName(item)}: lam diễm đã hiện nơi đầu niệm.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'INSECT_SKILL':
                this.unlockCultivationArt('KHU_TRUNG_THUAT');
                this.renderAttackModeUI();
                showNotify(`Lĩnh ngộ ${this.getItemDisplayName(item)}: đã có thể điều linh trùng nhập trận.`, qualityConfig.color);
                this.refreshResourceUI();
                return true;
            case 'INSIGHT':
                this.bonusStats.expGainPct += qualityConfig.expGainPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.expGainPct || 0) * 100)}% tu vi thu hoạch`, qualityConfig.color);
                break;
            case 'ATTACK':
                this.bonusStats.attackPct += qualityConfig.attackPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.attackPct || 0) * 100)}% công kích`, qualityConfig.color);
                break;
            case 'SHIELD_BREAK':
                this.bonusStats.shieldBreakPct += qualityConfig.shieldBreakPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.shieldBreakPct || 0) * 100)}% phá khiên`, qualityConfig.color);
                break;
            case 'BERSERK':
                this.consumeBerserkPill(item, qualityConfig);
                break;
            case 'RAGE':
                this.addRage(qualityConfig.rageGain || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(qualityConfig.rageGain || 0)} nộ`, qualityConfig.color);
                break;
            case 'MANA':
                this.updateMana(qualityConfig.manaRestore || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: hồi ${Math.round(qualityConfig.manaRestore || 0)} linh lực`, qualityConfig.color);
                break;
            case 'MAX_MANA':
                this.bonusStats.maxManaFlat += qualityConfig.maxManaFlat || 0;
                this.syncDerivedStats();
                this.updateMana(qualityConfig.maxManaFlat || 0);
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round(qualityConfig.maxManaFlat || 0)} giới hạn linh lực`, qualityConfig.color);
                break;
            case 'REGEN':
                this.bonusStats.manaRegenPct += qualityConfig.manaRegenPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.manaRegenPct || 0) * 100)}% hồi linh`, qualityConfig.color);
                break;
            case 'SPEED':
                this.bonusStats.speedPct += qualityConfig.speedPct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.speedPct || 0) * 100)}% tốc độ`, qualityConfig.color);
                break;
            case 'FORTUNE':
                this.bonusStats.dropRatePct += qualityConfig.dropRatePct || 0;
                showNotify(`Dùng ${this.getItemDisplayName(item)}: +${Math.round((qualityConfig.dropRatePct || 0) * 100)}% vận khí`, qualityConfig.color);
                break;
            case 'SPECIAL':
                if (item.specialKey === 'CHUNG_CUC_DAO_NGUYEN_DAN') {
                    if (!this.applyChungCucDaoNguyenDan(item, qualityConfig)) {
                        this.addInventoryItem(item, 1);
                        return false;
                    }
                } else if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
                    if (!this.applyTanDaoDietNguyenDan(item, qualityConfig)) {
                        this.addInventoryItem(item, 1);
                        return false;
                    }
                } else {
                    this.addInventoryItem(item, 1);
                    return false;
                }
                break;
            default:
                this.addInventoryItem(item, 1);
                return false;
        }

        this.refreshResourceUI();
        return true;
    },

    executeBreakthrough(isForced = false) {
        if (this.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return;
        }

        const currentRank = this.getCurrentRank();
        if (!currentRank) return;

        const pillBoost = this.calculateTotalPillBoost();
        let totalChance = currentRank.chance + pillBoost;

        const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.95;
        totalChance = Math.min(maxAllowed, totalChance);

        if (Math.random() <= totalChance) {
            this.exp = 0;
            this.rankIndex++;
            this.isReadyToBreak = false;
            this.breakthroughBonus = 0;

            const nextRank = CONFIG.CULTIVATION.RANKS[this.rankIndex];
            if (nextRank) {
                this.syncDerivedStats();

                if (isForced) {
                    showNotify(`CƯỜNG ÉP ĐỘT PHÁ THÀNH CÔNG: ${nextRank.name.toUpperCase()}`, "#ff8800");
                } else {
                    this.mana = this.maxMana;
                    showNotify(`ĐỘT PHÁ THÀNH CÔNG: ${nextRank.name.toUpperCase()}`, "#ffcc00");
                }
            }
            this.createLevelUpExplosion(this.x, this.y, nextRank?.color || currentRank.color);
        } else {
            const penaltyFactor = CONFIG.CULTIVATION.BREAKTHROUGH_PENALTY_FACTOR;
            const penalty = Math.floor(this.exp * penaltyFactor);

            this.exp -= penalty;
            this.isReadyToBreak = false;
            this.breakthroughBonus *= 0.5;

            const penaltyPercent = Math.round(penaltyFactor * 100);
            showNotify(`ĐỘT PHÁ THẤT BẠI! Tâm ma phản phệ (-${penaltyPercent}% tu vi)`, "#ff4444");
            this.triggerExpError();
        }

        this.refreshResourceUI();
        this.renderManaUI();
    },

    renderExpUI() {
        const rank = this.getCurrentRank();
        if (!rank) return;

        this.syncDerivedStats();

        const barExp = document.getElementById('exp-bar');
        const textExp = document.getElementById('exp-text');
        const rankText = document.getElementById('cultivation-rank');
        const breakthroughGroup = document.querySelector('.breakthrough-group');

        const pillBoost = this.calculateTotalPillBoost();
        const maxAllowed = CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE || 0.99;
        const totalChance = Math.min(maxAllowed, rank.chance + pillBoost);
        const basePercent = Math.round(rank.chance * 100);
        const bonusPercent = Math.round(pillBoost * 100);
        const totalPercent = Math.round(totalChance * 100);

        if (textExp) {
            const statusText = this.isVoidCollapsed
                ? `<span style="color:#b48cff; font-weight:bold;">THÂN THỂ ĐÃ TAN VÀO HƯ VÔ - RELOAD WEB ĐỂ HỒI PHỤC</span>`
                : this.isReadyToBreak ?
                `<span style="color:#ffcc00; font-weight:bold;">SẴN SÀNG ĐỘT PHÁ</span>` :
                `Tu vi: ${formatNumber(this.exp)}/${formatNumber(rank.exp)}`;

            textExp.innerHTML = `${statusText} | ` +
                `<span style="color:#86fff0">Cơ sở: ${basePercent}%</span> | ` +
                `<span style="color:#ffd36b">Đan trợ lực: +${bonusPercent}%</span> | ` +
                `<span style="color:#ff9ef7">Tổng TL: ${totalPercent}%</span>`;
        }

        if (breakthroughGroup) {
            if (this.isReadyToBreak) breakthroughGroup.classList.add('is-active');
            else breakthroughGroup.classList.remove('is-active');
        }

        const percentage = (this.exp / rank.exp) * 100;
        if (barExp) {
            barExp.style.width = Math.min(100, percentage) + '%';
            barExp.style.background = `linear-gradient(90deg, ${rank.lightColor}, ${rank.color})`;

            if (this.isReadyToBreak) {
                barExp.style.boxShadow = `0 0 15px #fff, 0 0 5px ${rank.color}`;
                barExp.classList.add('exp-full-glow');
            } else {
                barExp.style.boxShadow = `0 0 10px ${rank.lightColor}`;
                barExp.classList.remove('exp-full-glow');
            }
        }

        if (rankText) {
            rankText.innerText = `Cảnh giới: ${rank.name}`;
            rankText.style.color = rank.color;
        }
        if (ProfileUI && typeof ProfileUI.isOpen === 'function' && ProfileUI.isOpen()) {
            ProfileUI.render();
        }
    },

    triggerExpError() {
        const el = document.getElementById('exp-container');
        el.classList.add('shake-red');
        setTimeout(() => el.classList.remove('shake-red'), 500);
    },

    update(dt) { // Nhận thêm tham số dt
        this.updateUltimateState();
        this.updateActiveEffects();

        if (this.isVoidCollapsed) {
            this.resetAttackState();
            this.stopMoveJoystick();
            return;
        }

        this.updateBeastCare();

        const joystickTarget = this.getMoveJoystickTarget();
        if (joystickTarget) {
            this.x = joystickTarget.x;
            this.y = joystickTarget.y;
        } else if (this.isTouchDevice) {
            this.x = guardCenter.x;
            this.y = guardCenter.y;
        } else {
            const worldPos = Camera.screenToWorld(this.screenX, this.screenY);
            this.x = worldPos.x;
            this.y = worldPos.y;
        }

        // Tính tốc độ di chuyển của con trỏ/ngón tay
        this.speed = Math.hypot(this.x - this.px, this.y - this.py);
        this.px = this.x; this.py = this.y;

        this.ensureValidAttackMode();

        // Gọi hàm xử lý tiêu hao mana
        this.processActiveConsumption(dt);
    },

    handleMove(e) {
        if (this.isVoidCollapsed) return;
        if (this.isTouchDevice) return;
        if (e.target.closest('.btn')) return;

        // Pointermove hoạt động cho cả chuột và touch di chuyển
        const p = e.touches ? e.touches[0] : e;
        this.screenX = p.clientX;
        this.screenY = p.clientY;
    },

    handleDown(e) {
        if (this.isVoidCollapsed) return;
        if (e.target.closest('.btn')) return;

        // LOGIC MỚI: Nếu là mobile, chạm màn hình KHÔNG kích hoạt tấn công
        if (this.isTouchDevice) return;

        // Nếu là Desktop (chuột), vẫn giữ logic nhấn giữ để tấn công
        e.preventDefault();
        if (this.attackTimer) {
            clearTimeout(this.attackTimer);
        }
        this.attackTimer = setTimeout(() => {
            this.attackTimer = null;
            if (this.isVoidCollapsed) return;
            this.isAttacking = true;
        }, CONFIG.SWORD.ATTACK_DELAY_MS);
    },

    handleUp(e) {
        if (this.isVoidCollapsed) return;
        // Chỉ xử lý handleUp cho chuột trên desktop
        if (!this.isTouchDevice) {
            this.resetAttackState();
        }
    },

    handleWheel(e) {
        const delta = -e.deltaY * CONFIG.ZOOM.SENSITIVITY;
        Camera.adjustZoom(delta);
    },

    getSwarmVisualCount() {
        return Math.max(0, Math.min(Math.floor(CONFIG.INSECT?.ATTACK?.VISUAL_LIMIT || 0), this.getTotalTamedInsectCount()));
    },

    pickOwnedInsectSpeciesKey() {
        const weighted = this.getActiveInsectSpeciesKeys().reduce((rates, speciesKey) => {
            rates[speciesKey] = Math.max(0.05, this.tamedInsects[speciesKey] || 0);
            return rates;
        }, {});

        return pickWeightedKey(weighted, this.getActiveInsectSpeciesKeys()[0] || null);
    },

    updateInsectSwarm(dt, enemies, scaleFactor) {
        const cfg = CONFIG.INSECT?.ATTACK || {};
        const shouldRender = this.attackMode === 'INSECT' && this.canUseInsectAttackMode() && !this.isUltMode && !this.isUltimateBusy();

        if (!shouldRender) {
            this.insectCombat.visuals = [];
            return;
        }

        const visualCount = this.getSwarmVisualCount();
        const centerX = this.x;
        const centerY = this.y;
        const visuals = this.insectCombat.visuals || [];
        const minRadius = Math.max(8, cfg.VISUAL_MIN_RADIUS || 18) * scaleFactor;
        const maxRadius = Math.max(minRadius + 4, cfg.VISUAL_MAX_RADIUS || 70) * scaleFactor;
        const jitter = Math.max(2, cfg.VISUAL_JITTER || 10) * scaleFactor;

        while (visuals.length < visualCount) {
            const speciesKey = this.pickOwnedInsectSpeciesKey();
            const species = this.getInsectSpecies(speciesKey);

            visuals.push({
                speciesKey,
                angle: Math.random() * Math.PI * 2,
                radius: random(minRadius, maxRadius),
                targetRadius: random(minRadius, maxRadius),
                speed: random(1.4, 3.2),
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: random(1.2, 2.8),
                size: random(2, 3.8) * (species?.tier === 'DE' ? 1.18 : 1),
                x: centerX,
                y: centerY
            });
        }

        if (visuals.length > visualCount) {
            visuals.length = visualCount;
        }

        visuals.forEach(node => {
            if (!this.tamedInsects[node.speciesKey]) {
                node.speciesKey = this.pickOwnedInsectSpeciesKey() || node.speciesKey;
            }

            node.angle += dt * node.speed * (this.isAttacking ? 2.6 : 1.6);
            node.wobble += dt * node.wobbleSpeed;
            node.targetRadius += random(-8, 8) * dt * 10;
            node.targetRadius = Math.max(minRadius, Math.min(maxRadius, node.targetRadius));
            node.radius += (node.targetRadius - node.radius) * 0.08;

            const swirlX = Math.cos(node.angle) * node.radius;
            const swirlY = Math.sin(node.angle * 1.18 + node.wobble) * (node.radius * 0.72);
            const chaosX = Math.cos(node.wobble * 1.7 + node.angle * 0.45) * jitter;
            const chaosY = Math.sin(node.wobble * 1.35 - node.angle * 0.4) * jitter;

            node.x = centerX + swirlX + chaosX;
            node.y = centerY + swirlY + chaosY;
        });

        this.insectCombat.visuals = visuals;

        if (!this.isAttacking) return;

        const now = performance.now();
        const hitInterval = Math.max(60, cfg.HIT_INTERVAL_MS || 220);
        if (now - (this.insectCombat.lastHitAt || 0) < hitInterval) return;

        this.insectCombat.lastHitAt = now;

        const totalInsects = Math.max(1, this.getTotalTamedInsectCount());
        const targetRange = Math.max(60, cfg.TARGET_RANGE || 220);
        const damageFactor = Math.max(
            0.18,
            (cfg.BASE_DAMAGE_FACTOR || 0.45) + (Math.floor(totalInsects / 5) * (cfg.BONUS_DAMAGE_PER_5 || 0.08))
        );
        const targetCount = Math.max(1, Math.min(4, Math.ceil(totalInsects / 10)));
        const targets = enemies
            .filter(enemy => Math.hypot(enemy.x - centerX, enemy.y - centerY) <= targetRange)
            .sort((a, b) => Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY))
            .slice(0, targetCount);

        if (!targets.length) return;

        const pseudoSwarm = {
            getDamageMultiplier: () => damageFactor,
            powerPenalty: damageFactor
        };

        let shieldHits = 0;
        let killCount = 0;

        targets.forEach(target => {
            const result = target.hit(pseudoSwarm);

            if (result === 'shielded') shieldHits++;
            if (result === 'killed') killCount++;

            if (result === 'hit' || result === 'killed' || result === 'shielded') {
                this.createAttackBurst?.(target.x, target.y, result === 'shielded' ? '#ffb26b' : '#79ffd4');
            }
        });

        const casualtyKey = shieldHits > 0
            ? this.loseRandomTamedInsect(1 - Math.pow(1 - Math.max(0, Math.min(1, cfg.DEATH_ON_SHIELD_CHANCE || 0)), shieldHits))
            : this.loseRandomTamedInsect(cfg.DEATH_ON_HIT_CHANCE || 0);

        if (casualtyKey) {
            const species = this.getInsectSpecies(casualtyKey);
            showNotify(`1 ${species?.name || 'linh trùng'} tan lạc trong giao tranh`, species?.color || '#ff8a80');
            this.refreshResourceUI();
        }

        if (killCount > 0) {
            let bornCount = 0;
            for (let i = 0; i < killCount; i++) {
                if (this.reproduceRandomInsect(cfg.REPRODUCE_ON_KILL_CHANCE || 0)) {
                    bornCount++;
                }
            }

            if (bornCount > 0) {
                showNotify(`Đàn trùng sinh sôi thêm ${formatNumber(bornCount)} con`, '#79ffd4');
                this.refreshResourceUI();
            }
        }
    },

    drawInsectSwarm(ctx, scaleFactor) {
        if (!this.insectCombat.visuals?.length) return;

        ctx.save();
        ctx.lineWidth = 1;

        this.insectCombat.visuals.forEach((node, index) => {
            const species = this.getInsectSpecies(node.speciesKey);
            const color = species?.color || '#79ffd4';
            const secondaryColor = species?.secondaryColor || color;
            const auraColor = species?.auraColor || secondaryColor;
            const trailColor = species?.auraColor || secondaryColor;
            const size = Math.max(1.8, node.size * scaleFactor);

            if (index > 0) {
                const prev = this.insectCombat.visuals[index - 1];
                ctx.beginPath();
                ctx.strokeStyle = `${trailColor}26`;
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(node.x, node.y);
                ctx.stroke();
            }

            const gradient = ctx.createRadialGradient(
                node.x - size * 0.35,
                node.y - size * 0.35,
                Math.max(0.2, size * 0.15),
                node.x,
                node.y,
                size * 1.2
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.25, secondaryColor);
            gradient.addColorStop(0.7, color);
            gradient.addColorStop(1, `${auraColor}12`);

            ctx.beginPath();
            ctx.shadowBlur = 14;
            ctx.shadowColor = auraColor;
            ctx.fillStyle = gradient;
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    },

    // Hàm tạo hiệu ứng hạt bùng nổ
    getSwarmVisualCount() {
        return Math.max(0, Math.min(Math.floor(CONFIG.INSECT?.ATTACK?.VISUAL_LIMIT || 0), this.getCombatReadyInsectCount()));
    },

    pickOwnedInsectSpeciesKey(speciesPool = null) {
        const candidateKeys = (speciesPool || this.getCombatReadyInsectSpeciesKeys())
            .filter(speciesKey => (this.tamedInsects?.[speciesKey] || 0) > 0);
        const weighted = candidateKeys.reduce((rates, speciesKey) => {
            rates[speciesKey] = Math.max(0.05, this.tamedInsects?.[speciesKey] || 0);
            return rates;
        }, {});

        return pickWeightedKey(weighted, candidateKeys[0] || null);
    },

    getInsectAttackCandidates(centerX, centerY, enemies, targetRange) {
        return enemies
            .filter(enemy => Math.hypot(enemy.x - centerX, enemy.y - centerY) <= targetRange)
            .sort((a, b) => Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY));
    },

    chooseInsectTargetForSpecies(speciesKey, candidates, centerX, centerY, excludedTargets = new Set()) {
        const profile = this.getInsectCombatProfile(speciesKey);
        const rankedTargets = [...(candidates || [])]
            .filter(enemy => enemy && !excludedTargets.has(enemy))
            .sort((left, right) => {
                const scoreEnemy = (enemy) => {
                    const distanceScore = Math.hypot(enemy.x - centerX, enemy.y - centerY);
                    const hpRatio = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) : 1;
                    const isShielded = Boolean(enemy.hasShield && enemy.shieldHp > 0);
                    let score = distanceScore;

                    if (profile.focus === 'shielded') {
                        score += isShielded ? -180 : 28;
                    } else if (profile.focus === 'lowestHp') {
                        score += hpRatio * 160;
                    } else if (profile.focus === 'cluster') {
                        const nearbyCount = (candidates || []).filter(other => {
                            return other !== enemy && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= 110;
                        }).length;
                        score -= nearbyCount * 34;
                    } else if (profile.focus === 'elite') {
                        score += enemy.isElite ? -130 : 16;
                        score += isShielded ? -42 : 0;
                    } else if (profile.focus === 'swift') {
                        score -= ((enemy.wanderSpeed || 0) * 110) + ((enemy.dodgeChance || 0) * 140);
                    }

                    return score;
                };

                return scoreEnemy(left) - scoreEnemy(right);
            });

        return rankedTargets[0] || null;
    },

    getInsectSpeciesStrikeFactor(speciesKey, count, totalReadyCount) {
        const cfg = CONFIG.INSECT?.ATTACK || {};
        const species = this.getInsectSpecies(speciesKey);
        const profile = this.getInsectCombatProfile(speciesKey);
        const totalReady = Math.max(1, totalReadyCount || 1);
        const shareRatio = Math.max(0.05, count / totalReady);
        const focusFactor = Math.max(0.5, Math.min(1.35, shareRatio * 1.65));
        const densityFactor = 1 + Math.min(0.24, Math.max(0, count - 1) * 0.018);
        const baseDamageFactor = Math.max(
            0.18,
            (cfg.BASE_DAMAGE_FACTOR || 0.45) + (Math.floor(totalReady / 5) * (cfg.BONUS_DAMAGE_PER_5 || 0.08))
        );

        return Math.max(
            0.12,
            baseDamageFactor
                * (species?.attackFactor || 1)
                * focusFactor
                * densityFactor
                * (profile.damageScale || 1)
        );
    },

    createInsectStrikeSource(damageFactor, speciesKey, options = {}) {
        return {
            getDamageMultiplier: () => damageFactor,
            powerPenalty: damageFactor,
            sourceType: 'INSECT',
            speciesKey,
            shieldBreakMultiplier: Math.max(1, Number(options.shieldBreakMultiplier) || 1),
            ignoreDodge: Boolean(options.ignoreDodge)
        };
    },

    addInsectStrikeResult(summary, outcome) {
        if (!outcome?.result) return;
        if (outcome.landed) summary.landedHits += 1;
        if (outcome.result === 'shielded') summary.shieldHits += 1;
        if (outcome.result === 'killed') summary.killCount += 1;
    },

    strikeEnemyWithInsects(target, speciesKey, damageFactor, options = {}) {
        if (!target) {
            return { result: null, landed: false, shieldHits: 0, killCount: 0 };
        }

        const species = this.getInsectSpecies(speciesKey);
        const strikeColor = options.color || species?.color || '#79ffd4';

        if (options.dodgeDisabledMs) target.suppressDodge?.(options.dodgeDisabledMs);
        if (options.rootMs) target.applyMovementLock?.(options.rootMs);
        if (options.slowMs) target.applySlow?.(options.slowMs, options.slowFactor || 0.5);
        if (options.shieldRecoveryBlockMs) target.blockShieldRecovery?.(options.shieldRecoveryBlockMs);

        const result = target.hit(this.createInsectStrikeSource(damageFactor, speciesKey, options));
        const landed = result === 'hit' || result === 'killed' || result === 'shielded';

        if (landed) {
            this.createAttackBurst?.(target.x, target.y, result === 'shielded' ? '#ffb26b' : strikeColor);
        }

        if (landed && options.lockAfterHitMs) {
            target.applyMovementLock?.(options.lockAfterHitMs);
        }

        return {
            result,
            landed,
            shieldHits: result === 'shielded' ? 1 : 0,
            killCount: result === 'killed' ? 1 : 0
        };
    },

    resolveInsectSpeciesStrike({ speciesKey, count, totalReadyCount, primaryTarget, candidates, damageMultiplier = 1 }) {
        const summary = { shieldHits: 0, killCount: 0, landedHits: 0 };
        if (!primaryTarget || count <= 0) return summary;

        const species = this.getInsectSpecies(speciesKey);
        const profile = this.getInsectCombatProfile(speciesKey);
        const color = species?.secondaryColor || species?.color || '#79ffd4';
        const sortedOthers = [...(candidates || [])]
            .filter(enemy => enemy !== primaryTarget)
            .sort((a, b) => Math.hypot(a.x - primaryTarget.x, a.y - primaryTarget.y) - Math.hypot(b.x - primaryTarget.x, b.y - primaryTarget.y));

        const strike = (target, damageFactor, options = {}) => {
            const outcome = this.strikeEnemyWithInsects(target, speciesKey, damageFactor, { ...options, color });
            this.addInsectStrikeResult(summary, outcome);
            return outcome;
        };

        let baseFactor = this.getInsectSpeciesStrikeFactor(speciesKey, count, totalReadyCount) * Math.max(0.1, Number(damageMultiplier) || 1);
        let primaryOutcome = null;

        switch (speciesKey) {
            case 'KIEN_THIEN_TINH': {
                primaryOutcome = strike(primaryTarget, baseFactor, { ignoreDodge: count >= 16 });
                const chainCount = Math.max(1, Math.min(3, 1 + Math.floor(count / 12)));
                sortedOthers.slice(0, chainCount).forEach(target => {
                    strike(target, baseFactor * 0.72, { ignoreDodge: count >= 16 });
                });
                break;
            }
            case 'PHE_KIM_TRUNG': {
                const shielded = Boolean(primaryTarget.hasShield && primaryTarget.shieldHp > 0);
                primaryOutcome = strike(primaryTarget, baseFactor * (shielded ? 1.08 : 1), {
                    shieldBreakMultiplier: shielded ? 3.4 : 1.7
                });
                if (shielded && primaryOutcome.result !== 'killed') {
                    strike(primaryTarget, baseFactor * 0.56, {
                        shieldBreakMultiplier: 2.2,
                        ignoreDodge: true
                    });
                }
                break;
            }
            case 'PHI_THIEN_TU_VAN_HAT': {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    dodgeDisabledMs: 650,
                    ignoreDodge: count >= 6
                });
                if (primaryOutcome.result !== 'killed') {
                    strike(primaryTarget, baseFactor * 0.44, {
                        ignoreDodge: true,
                        slowMs: 900,
                        slowFactor: 0.74
                    });
                }
                break;
            }
            case 'HUYET_NGOC_TRI_CHU': {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    rootMs: 950 + Math.min(700, count * 40),
                    dodgeDisabledMs: 480
                });
                const hpRatio = primaryTarget.maxHp > 0 ? (primaryTarget.hp / primaryTarget.maxHp) : 1;
                if (primaryOutcome.result !== 'killed' && hpRatio <= 0.72) {
                    strike(primaryTarget, baseFactor * 0.58, { ignoreDodge: true });
                }
                break;
            }
            case 'HUYEN_DIEM_NGA': {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    ignoreDodge: true,
                    rootMs: 1400 + Math.min(800, count * 35),
                    slowMs: 1800,
                    slowFactor: 0.08,
                    dodgeDisabledMs: 1600
                });
                break;
            }
            case 'KIM_TAM': {
                const hpRatio = primaryTarget.maxHp > 0 ? (primaryTarget.hp / primaryTarget.maxHp) : 1;
                if (hpRatio <= 0.28) {
                    baseFactor *= 1.8;
                }
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    shieldRecoveryBlockMs: 2400,
                    dodgeDisabledMs: 800
                });
                if (primaryOutcome.result === 'shielded') {
                    strike(primaryTarget, baseFactor * 0.48, {
                        ignoreDodge: true,
                        shieldBreakMultiplier: 1.6,
                        shieldRecoveryBlockMs: 2400
                    });
                }
                break;
            }
            case 'THIET_HOA_NGHI': {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    rootMs: 420,
                    dodgeDisabledMs: 320
                });
                sortedOthers
                    .filter(enemy => Math.hypot(enemy.x - primaryTarget.x, enemy.y - primaryTarget.y) <= 96)
                    .slice(0, 2)
                    .forEach(target => {
                        strike(target, baseFactor * 0.52, {
                            slowMs: 720,
                            slowFactor: 0.66,
                            ignoreDodge: count >= 10
                        });
                    });
                break;
            }
            case 'KIM_GIAP_HAT': {
                const fortifiedTarget = primaryTarget.isElite || Boolean(primaryTarget.hasShield && primaryTarget.shieldHp > 0);
                primaryOutcome = strike(primaryTarget, baseFactor * (fortifiedTarget ? 1.28 : 1.05), {
                    shieldBreakMultiplier: 1.9,
                    rootMs: 820,
                    ignoreDodge: count >= 10
                });
                break;
            }
            case 'HUYET_THUC_NGHI': {
                const frenzyFactor = 1 + Math.min(0.55, this.combo * 0.015);
                primaryOutcome = strike(primaryTarget, baseFactor * frenzyFactor, {
                    ignoreDodge: count >= 14
                });
                if ((primaryOutcome.result === 'killed' || this.combo >= 10) && sortedOthers.length) {
                    strike(sortedOthers[0], baseFactor * 0.5 * frenzyFactor, { ignoreDodge: true });
                }
                break;
            }
            case 'BANG_TAM': {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    slowMs: 2600,
                    slowFactor: 0.26,
                    dodgeDisabledMs: 900
                });
                if (primaryOutcome.landed && count >= 8) {
                    primaryTarget.applyMovementLock?.(650 + Math.min(500, count * 20));
                }
                break;
            }
            case 'THON_LINH_TRUNG': {
                const shielded = Boolean(primaryTarget.hasShield && primaryTarget.shieldHp > 0);
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    shieldRecoveryBlockMs: 3200,
                    dodgeDisabledMs: 1100,
                    shieldBreakMultiplier: shielded ? 1.85 : 1.25
                });
                if (primaryOutcome.result !== 'killed' && (shielded || count >= 12)) {
                    strike(primaryTarget, baseFactor * 0.46, {
                        ignoreDodge: true,
                        shieldRecoveryBlockMs: 3200,
                        shieldBreakMultiplier: 1.55
                    });
                }
                break;
            }
            default: {
                primaryOutcome = strike(primaryTarget, baseFactor, {
                    ignoreDodge: profile.focus === 'swift'
                });
                break;
            }
        }

        return summary;
    },

    updateInsectSwarm(dt, enemies, scaleFactor) {
        const cfg = CONFIG.INSECT?.ATTACK || {};
        const shouldRender = this.attackMode === 'INSECT' && this.canUseInsectAttackMode() && !this.isUltMode && !this.isUltimateBusy();

        if (!shouldRender) {
            this.insectCombat.visuals = [];
            this.insectCombat.focusTargets = [];
            return;
        }

        const centerX = this.x;
        const centerY = this.y;
        const combatSpeciesKeys = this.getCombatReadyInsectSpeciesKeys();
        const visualCount = this.getSwarmVisualCount();
        const visuals = this.insectCombat.visuals || [];
        const minRadius = Math.max(8, cfg.VISUAL_MIN_RADIUS || 18) * scaleFactor;
        const maxRadius = Math.max(minRadius + 4, cfg.VISUAL_MAX_RADIUS || 70) * scaleFactor;
        const jitter = Math.max(2, cfg.VISUAL_JITTER || 10) * scaleFactor;
        const focusTargets = this.getInsectAttackCandidates(
            centerX,
            centerY,
            enemies,
            Math.max(80, (cfg.TARGET_RANGE || 220) * 1.1)
        ).slice(0, 5);

        while (visuals.length < visualCount) {
            const speciesKey = this.pickOwnedInsectSpeciesKey(combatSpeciesKeys);
            const species = this.getInsectSpecies(speciesKey);

            visuals.push({
                speciesKey,
                angle: Math.random() * Math.PI * 2,
                radius: random(minRadius, maxRadius),
                targetRadius: random(minRadius, maxRadius),
                speed: random(1.4, 3.2),
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: random(1.2, 2.8),
                size: random(2, 3.8) * (species?.tier === 'DE' ? 1.18 : 1),
                targetRef: null,
                x: centerX,
                y: centerY
            });
        }

        if (visuals.length > visualCount) {
            visuals.length = visualCount;
        }

        visuals.forEach(node => {
            if (!combatSpeciesKeys.includes(node.speciesKey)) {
                node.speciesKey = this.pickOwnedInsectSpeciesKey(combatSpeciesKeys) || node.speciesKey;
            }

            const profile = this.getInsectCombatProfile(node.speciesKey);
            const hasTargetFocus = this.isAttacking && focusTargets.length > 0;

            if (hasTargetFocus) {
                if (!focusTargets.includes(node.targetRef)) {
                    node.targetRef = this.chooseInsectTargetForSpecies(node.speciesKey, focusTargets, centerX, centerY);
                }
            } else {
                node.targetRef = null;
            }

            const orbitMin = node.targetRef ? Math.max(8, (profile.latchRadius || 16) * 0.7) * scaleFactor : minRadius;
            const orbitMax = node.targetRef ? Math.max(orbitMin + 4, (profile.latchRadius || 16) * 1.35) * scaleFactor : maxRadius;
            const anchorX = node.targetRef ? node.targetRef.x : centerX;
            const anchorY = node.targetRef ? node.targetRef.y : centerY;
            const chaosJitter = node.targetRef ? jitter * 0.35 : jitter;

            node.angle += dt * node.speed * (node.targetRef ? 4.2 : (this.isAttacking ? 2.6 : 1.6));
            node.wobble += dt * node.wobbleSpeed;
            node.targetRadius += random(node.targetRef ? -4 : -8, node.targetRef ? 4 : 8) * dt * 10;
            node.targetRadius = Math.max(orbitMin, Math.min(orbitMax, node.targetRadius));
            node.radius += (node.targetRadius - node.radius) * (node.targetRef ? 0.12 : 0.08);

            const swirlX = Math.cos(node.angle) * node.radius;
            const swirlY = Math.sin(node.angle * 1.18 + node.wobble) * (node.radius * (node.targetRef ? 0.54 : 0.72));
            const chaosX = Math.cos(node.wobble * 1.7 + node.angle * 0.45) * chaosJitter;
            const chaosY = Math.sin(node.wobble * 1.35 - node.angle * 0.4) * chaosJitter;

            node.x = anchorX + swirlX + chaosX;
            node.y = anchorY + swirlY + chaosY;
        });

        this.insectCombat.visuals = visuals;
        this.insectCombat.focusTargets = focusTargets;

        if (!this.isAttacking || !combatSpeciesKeys.length) return;

        const now = performance.now();
        const hitInterval = Math.max(60, cfg.HIT_INTERVAL_MS || 220);
        if (now - (this.insectCombat.lastHitAt || 0) < hitInterval) return;

        this.insectCombat.lastHitAt = now;

        const candidates = this.getInsectAttackCandidates(centerX, centerY, enemies, Math.max(60, cfg.TARGET_RANGE || 220));
        if (!candidates.length) return;

        const totalReadyCount = Math.max(1, this.getCombatReadyInsectCount());
        const attackSummary = { shieldHits: 0, killCount: 0, landedHits: 0 };
        const reservedTargets = new Set();

        combatSpeciesKeys.forEach(speciesKey => {
            const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
            if (count <= 0) return;

            const primaryTarget = this.chooseInsectTargetForSpecies(speciesKey, candidates, centerX, centerY, reservedTargets);
            if (primaryTarget) {
                reservedTargets.add(primaryTarget);
            }

            const result = this.resolveInsectSpeciesStrike({
                speciesKey,
                count,
                totalReadyCount,
                primaryTarget,
                candidates
            });

            attackSummary.shieldHits += result.shieldHits;
            attackSummary.killCount += result.killCount;
            attackSummary.landedHits += result.landedHits;
        });

        const regularHits = Math.max(0, attackSummary.landedHits - attackSummary.shieldHits);
        const hitLossChance = 1 - Math.pow(1 - Math.max(0, Math.min(1, cfg.DEATH_ON_HIT_CHANCE || 0)), regularHits);
        const shieldLossChance = 1 - Math.pow(1 - Math.max(0, Math.min(1, cfg.DEATH_ON_SHIELD_CHANCE || 0)), attackSummary.shieldHits);
        const casualtyChance = 1 - ((1 - hitLossChance) * (1 - shieldLossChance));
        const casualtyKey = this.loseRandomTamedInsect(casualtyChance, combatSpeciesKeys);

        let shouldRefresh = false;

        if (casualtyKey) {
            const species = this.getInsectSpecies(casualtyKey);
            showNotify(`1 ${species?.name || 'linh trùng'} tan lạc trong giao tranh`, species?.color || '#ff8a80');
            shouldRefresh = true;
        }

        if (attackSummary.killCount > 0) {
            let bornCount = 0;
            for (let i = 0; i < attackSummary.killCount; i++) {
                if (this.reproduceRandomInsect(cfg.REPRODUCE_ON_KILL_CHANCE || 0)) {
                    bornCount++;
                }
            }

            if (bornCount > 0) {
                showNotify(`Đàn trùng sinh sôi thêm ${formatNumber(bornCount)} con`, '#79ffd4');
                shouldRefresh = true;
            }
        }

        if (shouldRefresh) {
            this.refreshResourceUI();
        }
    },

    drawInsectSwarm(ctx, scaleFactor) {
        if (!this.insectCombat.visuals?.length) return;

        ctx.save();
        ctx.lineWidth = 1;

        this.insectCombat.visuals.forEach((node, index) => {
            const species = this.getInsectSpecies(node.speciesKey);
            const color = species?.color || '#79ffd4';
            const secondaryColor = species?.secondaryColor || color;
            const auraColor = species?.auraColor || secondaryColor;
            const trailColor = species?.auraColor || secondaryColor;
            const size = Math.max(1.8, node.size * scaleFactor);

            if (node.targetRef) {
                ctx.beginPath();
                ctx.strokeStyle = `${trailColor}33`;
                ctx.moveTo(node.targetRef.x, node.targetRef.y);
                ctx.lineTo(node.x, node.y);
                ctx.stroke();
            } else if (index > 0) {
                const prev = this.insectCombat.visuals[index - 1];
                ctx.beginPath();
                ctx.strokeStyle = `${trailColor}26`;
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(node.x, node.y);
                ctx.stroke();
            }

            const gradient = ctx.createRadialGradient(
                node.x - size * 0.35,
                node.y - size * 0.35,
                Math.max(0.2, size * 0.15),
                node.x,
                node.y,
                size * 1.2
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.25, secondaryColor);
            gradient.addColorStop(0.7, color);
            gradient.addColorStop(1, `${auraColor}12`);

            ctx.beginPath();
            ctx.shadowBlur = node.targetRef ? 18 : 14;
            ctx.shadowColor = auraColor;
            ctx.fillStyle = gradient;
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    },

    updateInsectUltimate(dt, enemies, scaleFactor) {
        const cfg = CONFIG.INSECT?.ULTIMATE || {};

        if (!this.isInsectUltimateActive()) {
            this.clearInsectUltimateState();
            return;
        }

        const combatSpeciesKeys = this.getCombatReadyInsectSpeciesKeys();
        if (!combatSpeciesKeys.length) {
            this.endInsectUltimate();
            return;
        }

        const centerX = this.x;
        const centerY = this.y;
        const targetRange = Math.max(120, Number(cfg.TARGET_RANGE) || 320);
        const maxTargets = Math.max(1, Math.floor(cfg.MAX_TARGETS || 7));
        const focusTargets = this.getInsectAttackCandidates(centerX, centerY, enemies, targetRange).slice(0, maxTargets);
        const visuals = this.insectUltimate.visuals || [];
        const visualCount = Math.max(
            18,
            Math.min(
                Math.floor(cfg.VISUAL_LIMIT || 54),
                Math.max(18, this.getCombatReadyInsectCount() + 18)
            )
        );
        const orbitRadius = Math.max(44, Number(cfg.VISUAL_RADIUS) || 118) * scaleFactor;
        const targetRadius = Math.max(12, orbitRadius * 0.18);
        const jitter = Math.max(6, Number(cfg.VISUAL_JITTER) || 24) * scaleFactor;

        while (visuals.length < visualCount) {
            const speciesKey = this.pickOwnedInsectSpeciesKey(combatSpeciesKeys);
            const species = this.getInsectSpecies(speciesKey);
            visuals.push({
                speciesKey,
                angle: Math.random() * Math.PI * 2,
                radius: random(targetRadius, orbitRadius),
                targetRadius: random(targetRadius, orbitRadius),
                speed: random(2.8, 5.6),
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: random(1.8, 3.8),
                size: random(2.6, 5.4) * (species?.tier === 'DE' ? 1.2 : 1),
                targetRef: null,
                x: centerX,
                y: centerY
            });
        }

        if (visuals.length > visualCount) {
            visuals.length = visualCount;
        }

        visuals.forEach((node, index) => {
            if (!combatSpeciesKeys.includes(node.speciesKey)) {
                node.speciesKey = this.pickOwnedInsectSpeciesKey(combatSpeciesKeys) || node.speciesKey;
            }

            node.targetRef = focusTargets.length ? focusTargets[index % focusTargets.length] : null;
            const profile = this.getInsectCombatProfile(node.speciesKey);
            const latchRadius = Math.max(10, (profile.latchRadius || 16) * scaleFactor);
            const anchorX = node.targetRef ? node.targetRef.x : centerX;
            const anchorY = node.targetRef ? node.targetRef.y : centerY;
            const minRadius = node.targetRef ? latchRadius * 0.55 : targetRadius;
            const maxRadius = node.targetRef ? latchRadius * 1.45 : orbitRadius;
            const nodeJitter = node.targetRef ? jitter * 0.42 : jitter;

            node.angle += dt * node.speed * (node.targetRef ? 5.8 : 3.4);
            node.wobble += dt * node.wobbleSpeed;
            node.targetRadius += random(node.targetRef ? -3 : -8, node.targetRef ? 3 : 8) * dt * 10;
            node.targetRadius = Math.max(minRadius, Math.min(maxRadius, node.targetRadius));
            node.radius += (node.targetRadius - node.radius) * (node.targetRef ? 0.18 : 0.1);

            const swirlX = Math.cos(node.angle) * node.radius;
            const swirlY = Math.sin(node.angle * 1.35 + node.wobble) * (node.radius * (node.targetRef ? 0.48 : 0.76));
            const chaosX = Math.cos(node.wobble * 1.8 + node.angle * 0.52) * nodeJitter;
            const chaosY = Math.sin(node.wobble * 1.55 - node.angle * 0.46) * nodeJitter;

            node.x = anchorX + swirlX + chaosX;
            node.y = anchorY + swirlY + chaosY;
        });

        this.insectUltimate.visuals = visuals;
        this.insectUltimate.focusTargets = focusTargets;

        const now = performance.now();
        const hitInterval = Math.max(45, Number(cfg.HIT_INTERVAL_MS) || 120);
        if ((now - (this.insectUltimate.lastHitAt || 0)) < hitInterval) return;

        this.insectUltimate.lastHitAt = now;
        if (!focusTargets.length) return;

        const candidates = this.getInsectAttackCandidates(centerX, centerY, enemies, targetRange);
        if (!candidates.length) return;

        const totalReadyCount = Math.max(1, this.getCombatReadyInsectCount());
        const strikeSummary = { shieldHits: 0, killCount: 0, landedHits: 0 };
        const reservedTargets = new Set();
        const strikesPerSpecies = Math.max(1, Math.floor(cfg.STRIKES_PER_SPECIES || 2));
        const damageMultiplier = Math.max(1.1, Number(cfg.DAMAGE_MULTIPLIER) || 1.72);

        combatSpeciesKeys.forEach(speciesKey => {
            const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
            if (count <= 0) return;

            for (let volley = 0; volley < strikesPerSpecies; volley++) {
                if (reservedTargets.size >= candidates.length) {
                    reservedTargets.clear();
                }

                const primaryTarget = this.chooseInsectTargetForSpecies(speciesKey, candidates, centerX, centerY, reservedTargets);
                if (!primaryTarget) break;

                reservedTargets.add(primaryTarget);
                const result = this.resolveInsectSpeciesStrike({
                    speciesKey,
                    count,
                    totalReadyCount,
                    primaryTarget,
                    candidates,
                    damageMultiplier: damageMultiplier * (volley === 0 ? 1 : 0.72)
                });

                strikeSummary.shieldHits += result.shieldHits;
                strikeSummary.killCount += result.killCount;
                strikeSummary.landedHits += result.landedHits;
            }
        });

        const regularHits = Math.max(0, strikeSummary.landedHits - strikeSummary.shieldHits);
        const hitLossChance = 1 - Math.pow(1 - Math.max(0, Math.min(1, cfg.DEATH_ON_HIT_CHANCE || 0)), regularHits);
        const shieldLossChance = 1 - Math.pow(1 - Math.max(0, Math.min(1, cfg.DEATH_ON_SHIELD_CHANCE || 0)), strikeSummary.shieldHits);
        const casualtyChance = 1 - ((1 - hitLossChance) * (1 - shieldLossChance));
        const casualtyKey = this.loseRandomTamedInsect(casualtyChance, combatSpeciesKeys);

        let shouldRefresh = false;

        if (casualtyKey) {
            const species = this.getInsectSpecies(casualtyKey);
            showNotify(`1 ${species?.name || 'linh trùng'} tan lạc trong trùng triều`, species?.color || '#ff8a80');
            shouldRefresh = true;
        }

        if (strikeSummary.killCount > 0) {
            let bornCount = 0;
            for (let i = 0; i < strikeSummary.killCount; i++) {
                if (this.reproduceRandomInsect(cfg.REPRODUCE_ON_KILL_CHANCE || 0.38, combatSpeciesKeys)) {
                    bornCount++;
                }
            }

            if (bornCount > 0) {
                showNotify(`Trùng triều sinh thêm ${formatNumber(bornCount)} linh trùng`, '#ff9fda');
                shouldRefresh = true;
            }
        }

        if (shouldRefresh) {
            this.refreshResourceUI();
        }
    },

    drawInsectUltimate(ctx, scaleFactor) {
        if (!this.insectUltimate.visuals?.length) return;

        const cfg = CONFIG.INSECT?.ULTIMATE || {};
        const time = performance.now() * 0.0035;
        const pulse = 1 + Math.sin(time * 2.4) * 0.08;
        const baseRadius = Math.max(44, Number(cfg.VISUAL_RADIUS) || 118) * scaleFactor;

        ctx.save();
        ctx.translate(this.x, this.y);

        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * 1.35);
        halo.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
        halo.addColorStop(0.3, 'rgba(255, 123, 195, 0.18)');
        halo.addColorStop(0.68, 'rgba(121, 255, 212, 0.12)');
        halo.addColorStop(1, 'rgba(121, 255, 212, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius * 1.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 176, 226, 0.46)';
        ctx.lineWidth = 2.2 * scaleFactor;
        ctx.arc(0, 0, baseRadius * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(121, 255, 212, 0.34)';
        ctx.lineWidth = 1.4 * scaleFactor;
        ctx.arc(0, 0, baseRadius * 0.74 * (2 - pulse), 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        ctx.save();
        ctx.lineCap = 'round';
        this.insectUltimate.focusTargets.forEach(target => {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 161, 224, 0.22)';
            ctx.lineWidth = 1.6 * scaleFactor;
            ctx.moveTo(this.x, this.y);
            ctx.quadraticCurveTo(
                (this.x + target.x) / 2 + Math.sin(time + target.x * 0.01) * 18 * scaleFactor,
                (this.y + target.y) / 2 + Math.cos(time + target.y * 0.01) * 18 * scaleFactor,
                target.x,
                target.y
            );
            ctx.stroke();

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(121, 255, 212, 0.16)';
            ctx.lineWidth = 1 * scaleFactor;
            ctx.arc(target.x, target.y, (target.r + 10) * scaleFactor, 0, Math.PI * 2);
            ctx.stroke();
        });

        this.insectUltimate.visuals.forEach((node, index) => {
            const species = this.getInsectSpecies(node.speciesKey);
            const color = species?.color || '#79ffd4';
            const secondaryColor = species?.secondaryColor || '#ffb0e8';
            const auraColor = species?.auraColor || secondaryColor;
            const size = Math.max(2.2, node.size * scaleFactor * 1.14);

            if (node.targetRef) {
                ctx.beginPath();
                ctx.strokeStyle = `${auraColor}28`;
                ctx.lineWidth = 0.9 * scaleFactor;
                ctx.moveTo(node.targetRef.x, node.targetRef.y);
                ctx.lineTo(node.x, node.y);
                ctx.stroke();
            } else if (index > 0) {
                const prev = this.insectUltimate.visuals[index - 1];
                ctx.beginPath();
                ctx.strokeStyle = `${secondaryColor}22`;
                ctx.lineWidth = 0.8 * scaleFactor;
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(node.x, node.y);
                ctx.stroke();
            }

            const gradient = ctx.createRadialGradient(
                node.x - size * 0.4,
                node.y - size * 0.4,
                Math.max(0.3, size * 0.18),
                node.x,
                node.y,
                size * 1.4
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.24, secondaryColor);
            gradient.addColorStop(0.7, color);
            gradient.addColorStop(1, `${auraColor}10`);

            ctx.beginPath();
            ctx.shadowBlur = node.targetRef ? 20 : 16;
            ctx.shadowColor = auraColor;
            ctx.fillStyle = gradient;
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    },

    createInsectUltimateBurst(x, y, color = '#ff7bc3') {
        const palette = [color, '#79ffd4', '#fff0c8', '#ffb7e7'];

        visualParticles.push(
            {
                type: 'ring',
                x,
                y,
                radius: 18,
                radialVelocity: 5.2,
                lineWidth: 3,
                life: 1,
                decay: 0.034,
                opacity: 0.92,
                color,
                glow: 18
            },
            {
                type: 'ring',
                x,
                y,
                radius: 42,
                radialVelocity: 7.6,
                lineWidth: 2.2,
                life: 0.92,
                decay: 0.03,
                opacity: 0.72,
                color: '#79ffd4',
                glow: 16
            }
        );

        for (let i = 0; i < 18; i++) {
            const angle = (Math.PI * 2 * i) / 18;
            visualParticles.push({
                type: 'ray',
                x,
                y,
                angle,
                radius: random(6, 16),
                radialVelocity: random(3.2, 5.6),
                length: random(22, 42),
                lengthVelocity: random(0.16, 0.42),
                lineWidth: random(1.5, 2.8),
                life: 0.92,
                decay: random(0.04, 0.055),
                opacity: 0.9,
                color: palette[i % palette.length],
                glow: 14
            });
        }

        for (let i = 0; i < 28; i++) {
            const angle = random(0, Math.PI * 2);
            const speed = random(2.8, 7.6);
            visualParticles.push({
                type: i % 5 === 0 ? 'square' : 'spark',
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - random(0.2, 1.2),
                gravity: 0.04,
                friction: 0.96,
                size: random(2.4, 5.4),
                sizeVelocity: -0.035,
                life: 0.96,
                decay: random(0.02, 0.034),
                opacity: 0.9,
                color: palette[i % palette.length],
                glow: 12,
                rotation: angle,
                rotationSpeed: random(-0.18, 0.18)
            });
        }
    },

    createLevelUpExplosion(x, y, color) {
        const accent = color || "#78f2ff";
        const palette = [accent, "#ffffff", "#8df6ff", "#ffe39b", "#7ad7ff"];

        visualParticles.push(
            {
                type: 'ring',
                x,
                y,
                radius: 14,
                radialVelocity: 4.4,
                lineWidth: 3.4,
                life: 1,
                decay: 0.038,
                opacity: 0.9,
                color: accent,
                glow: 18
            },
            {
                type: 'ring',
                x,
                y,
                radius: 28,
                radialVelocity: 5.9,
                lineWidth: 2.4,
                life: 0.92,
                decay: 0.034,
                opacity: 0.72,
                color: "#ffe39b",
                glow: 16
            },
            {
                type: 'glow',
                x,
                y,
                size: 20,
                sizeVelocity: 0.9,
                life: 0.72,
                decay: 0.06,
                opacity: 0.3,
                color: accent,
                glow: 24
            }
        );

        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            visualParticles.push({
                type: 'ray',
                x,
                y,
                angle,
                radius: random(4, 12),
                radialVelocity: random(2.8, 4.6),
                length: random(14, 30),
                lengthVelocity: random(0.1, 0.4),
                lineWidth: random(1.5, 2.8),
                life: 0.86,
                decay: random(0.045, 0.06),
                opacity: 0.88,
                color: palette[i % palette.length],
                glow: 14
            });
        }

        for (let i = 0; i < 30; i++) {
            const angle = random(0, Math.PI * 2);
            const speed = random(2.5, 8.4);
            visualParticles.push({
                type: i % 5 === 0 ? 'square' : 'spark',
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - random(0.4, 1.6),
                gravity: 0.05,
                friction: 0.97,
                size: random(2.4, 5.6),
                sizeVelocity: -0.03,
                life: 1,
                decay: random(0.018, 0.032),
                opacity: 0.94,
                color: palette[i % palette.length],
                glow: 12,
                rotation: angle,
                rotationSpeed: random(-0.16, 0.16)
            });
        }

        return;
    },

    createAttackBurst(x, y, color = "#ffcc00") {
        const now = performance.now();
        const burstInterval = this.isUltMode
            ? Math.max(0, Math.floor(CONFIG.ULTIMATE?.ATTACK_BURST_INTERVAL_MS || 0))
            : 0;

        if (burstInterval > 0 && (now - (this.lastAttackBurstAt || 0)) < burstInterval) {
            return;
        }

        const maxActiveBurstParticles = Math.max(
            40,
            Math.floor(CONFIG.ULTIMATE?.MAX_ACTIVE_BURST_PARTICLES || 220)
        );

        if (visualParticles.length > maxActiveBurstParticles) {
            visualParticles.splice(0, visualParticles.length - maxActiveBurstParticles);
        }

        this.lastAttackBurstAt = now;
        const palette = [color, "#fff1a8", "#ffd36b", "#ff9d4d"];
        const particleSlotsLeft = Math.max(0, maxActiveBurstParticles - visualParticles.length);

        if (particleSlotsLeft <= 0) return;

        visualParticles.push({
            type: 'ring',
            x,
            y,
            radius: 8,
            radialVelocity: 3.8,
            lineWidth: 2.2,
            life: 0.9,
            decay: 0.1,
            opacity: 0.82,
            color,
            glow: 12
        });

        const desiredParticleCount = this.isUltMode
            ? Math.max(4, Math.floor(CONFIG.ULTIMATE?.ATTACK_BURST_PARTICLE_COUNT || 8))
            : 14;
        const burstParticleCount = Math.max(0, Math.min(desiredParticleCount, particleSlotsLeft - 1));

        for (let i = 0; i < burstParticleCount; i++) {
            const angle = (Math.PI * 2 * i) / Math.max(1, burstParticleCount) + random(-0.12, 0.12);
            const speed = random(2.4, 5.8);
            visualParticles.push({
                type: i % 4 === 0 ? 'square' : 'spark',
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: random(2, 4.8),
                sizeVelocity: -0.04,
                friction: 0.95,
                life: 0.85,
                decay: random(0.055, 0.085),
                color: palette[i % palette.length],
                glow: 10,
                rotation: angle,
                rotationSpeed: random(-0.14, 0.14)
            });
        }
    },

    drawCursorSeed(ctx, scaleFactor) {
        const cursorConfig = CONFIG.CURSOR || {};
        const dotRadius = Math.max(1, (cursorConfig.BASE_DOT_RADIUS || 3.2) * scaleFactor);
        const ringRadius = Math.max(dotRadius + (2 * scaleFactor), (cursorConfig.BASE_RING_RADIUS || 7.5) * scaleFactor);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = (cursorConfig.BASE_GLOW_BLUR || 10) * scaleFactor;
        ctx.shadowColor = cursorConfig.BASE_GLOW_COLOR || 'rgba(143, 255, 224, 0.42)';

        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = cursorConfig.BASE_RING_COLOR || 'rgba(143, 255, 224, 0.32)';
        ctx.lineWidth = Math.max(1, scaleFactor);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = cursorConfig.BASE_DOT_COLOR || '#f3fffd';
        ctx.arc(0, 0, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawCursor(ctx, scaleFactor) {
        if (this.hasCanLamBangDiemUnlocked()) {
            this.drawFlame(ctx, scaleFactor);
            return;
        }

        this.drawCursorSeed(ctx, scaleFactor);
    },

    drawFlame(ctx, scaleFactor) {
        const time = performance.now() * 0.003;
        const aura = this.getAuraPalette();
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. Quầng sáng lạnh (Aura Băng Diễm)
        // Càng Lam Băng Diễm có đặc điểm tỏa ra hàn khí màu xanh lam nhạt
        ctx.shadowBlur = 20 * scaleFactor;
        ctx.shadowColor = aura.shadowColor;

        // 2. Định nghĩa các lớp màu "Càng Lam"
        // Lớp 1: Lam đậm (viền ngoài)
        // Lớp 2: Lam băng (thân lửa)
        // Lớp 3: Thiên lam trắng (lõi hỏa rực cháy)
        const layers = aura.layers;

        layers.forEach((layer, i) => {
            const flicker = Math.sin(time * layer.f + i) * 3;
            const w = (layer.w + flicker/2) * scaleFactor;
            const h = (layer.h + flicker) * scaleFactor;

            ctx.beginPath();
            ctx.fillStyle = layer.color;
            
            // Vẽ dáng lửa hơi nhọn và mảnh hơn (nhìn sắc lạnh hơn)
            ctx.moveTo(0, 0); 
            ctx.bezierCurveTo(-w, 0, -w/2, -h * 0.6, 0, -h); 
            ctx.bezierCurveTo(w/2, -h * 0.6, w, 0, 0, 0);    
            ctx.fill();
        });

        // 3. Hàn khí (Các đốm sáng nhỏ li ti bay lên)
        for (let j = 0; j < 4; j++) {
            const pOffset = (time * 0.8 + j * 0.4) % 1.2;
            const px = Math.sin(time * 1.5 + j) * 8 * scaleFactor;
            const py = -pOffset * 25 * scaleFactor;
            const pr = (1.8 * (1.2 - pOffset)) * scaleFactor;

            ctx.beginPath();
            ctx.arc(px, py, Math.max(0, pr), 0, Math.PI * 2);
            ctx.fillStyle = aura.particleColor;
            ctx.fill();
        }

        ctx.restore();
    },
};

// Đăng ký sự kiện Hệ thống (Gộp Pointer Events để tối ưu)
window.addEventListener('pointermove', e => { if (!e.touches) Input.handleMove(e); });
window.addEventListener('pointerdown', e => Input.handleDown(e));
window.addEventListener('pointerup', e => Input.handleUp(e));
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
    if (e.touches.length === 2) {
        Input.initialPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
}, { passive: false });

window.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
        e.preventDefault();
        const currentDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (currentDist - Input.initialPinchDist) * 0.01;
        Camera.adjustZoom(delta);
        Input.initialPinchDist = currentDist;
    } else {
        Input.handleMove(e);
    }
}, { passive: false });

function hasVisiblePopupOverlay() {
    return Array.from(document.querySelectorAll('.popup-overlay')).some(overlay =>
        overlay.classList.contains('show') || overlay.style.display === 'flex'
    );
}

function syncPopupCursorState() {
    if (!document?.body) return;

    document.body.style.removeProperty('cursor');
    document.body.classList.toggle('popup-cursor-active', hasVisiblePopupOverlay());
}

const SettingsUI = {
    overlay: document.getElementById('settings-popup'),
    btnOpen: document.getElementById('btn-settings'),
    btnClose: document.getElementById('close-settings'),
    btnSave: document.getElementById('save-settings'),
    btnReset: document.getElementById('reset-settings'),

    init() {
        if (!this.overlay || !this.btnOpen) return;

        // Tải dữ liệu đã lưu từ trước khi khởi tạo UI
        this.load();

        // 1. Mở popup
        this.btnOpen.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.open();
        });

        // 2. Cho phép tương tác với nội dung bên trong popup
        const content = this.overlay.querySelector('.popup-content');
        if (content) {
            content.addEventListener('pointerdown', (e) => {
                e.stopPropagation(); 
            });
        }

        // 3. Nút đóng
        if (this.btnClose) {
            this.btnClose.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        // 4. Nút lưu
        if (this.btnSave) {
            this.btnSave.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.save();
            });
        }
        
        // 5. Đóng khi nhấn ra ngoài vùng trống (overlay)
        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) {
                e.stopPropagation();
                this.close();
            }
        });

        // 6. Sự kiện nút Khôi Phục
        if (this.btnReset) {
            this.btnReset.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                if (confirm("Ngươi chắc chắn muốn khôi phục toàn bộ quy tắc Thiên Đạo về mặc định?")) {
                    this.reset();
                }
            });
        }
    },

    /**
     * Tải cấu hình từ LocalStorage và áp dụng vào object CONFIG toàn cục
     */
    load() {
        const savedData = localStorage.getItem('thanh_truc_settings');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed?.SWORD?.REGEN_INTERVAL_MS !== undefined && parsed?.MANA?.REGEN_INTERVAL_MS === undefined) {
                    parsed.MANA = parsed.MANA || {};
                    parsed.MANA.REGEN_INTERVAL_MS = parsed.SWORD.REGEN_INTERVAL_MS;
                }
                // Sử dụng đệ quy nhẹ hoặc gán tay để đảm bảo không làm mất các reference gốc
                // Ở đây gán trực tiếp các nhánh chính của CONFIG
                if (parsed.BG) Object.assign(CONFIG.BG, parsed.BG);
                if (parsed.ZOOM) Object.assign(CONFIG.ZOOM, parsed.ZOOM);
                if (parsed.COLORS) Object.assign(CONFIG.COLORS, parsed.COLORS);
                if (parsed.SWORD) Object.assign(CONFIG.SWORD, parsed.SWORD);
                if (parsed.ENEMY) Object.assign(CONFIG.ENEMY, parsed.ENEMY);
                if (parsed.MANA) Object.assign(CONFIG.MANA, parsed.MANA);
                if (parsed.ITEMS) Object.assign(CONFIG.ITEMS, parsed.ITEMS);
                if (parsed.PILL) Object.assign(CONFIG.PILL, parsed.PILL);
                if (parsed.SPIRIT_STONE) Object.assign(CONFIG.SPIRIT_STONE, parsed.SPIRIT_STONE);
                if (parsed.ULTIMATE) Object.assign(CONFIG.ULTIMATE, parsed.ULTIMATE);
                if (parsed.CULTIVATION) Object.assign(CONFIG.CULTIVATION, parsed.CULTIVATION);

                Input.maxRage = Math.max(1, parseInt(CONFIG.ULTIMATE.MAX_RAGE, 10) || 100);
                Input.rage = Math.min(Input.rage, Input.maxRage);
                Input.syncDerivedStats();
                Input.renderManaUI();
                Input.renderRageUI();
                
                console.log("Thiên Thư đã được phục hồi từ LocalStorage.");
            } catch (err) {
                console.error("Lỗi đọc Thiên Thư:", err);
            }
        }
    },

    close() {
        this.overlay.classList.remove('show');
        setTimeout(() => {
            if (!this.overlay.classList.contains('show')) {
                this.overlay.style.display = 'none';
                syncPopupCursorState();
            }
        }, 300);
        syncPopupCursorState();
    },

    open() {
        syncPopupCursorState();
        
        // Cập nhật giá trị hiện tại của CONFIG vào các ô input trong HTML
        const mapping = {
            'cfg-bg-star-count': CONFIG.BG.STAR_COUNT,
            'cfg-bg-star-min': CONFIG.BG.STAR_SIZE.MIN,
            'cfg-bg-star-twinkle': CONFIG.BG.STAR_TWINKLE_SPEED,
            'cfg-zoom-smooth': CONFIG.ZOOM.SMOOTH,
            'cfg-zoom-sens': CONFIG.ZOOM.SENSITIVITY,
            'cfg-col-bg-fade': CONFIG.COLORS.BG_FADE,
            
            'cfg-sw-count': CONFIG.SWORD.COUNT,
            'cfg-sw-radius': CONFIG.SWORD.BASE_RADIUS,
            'cfg-sw-spacing': CONFIG.SWORD.LAYER_SPACING,
            'cfg-sw-spin': CONFIG.SWORD.SPIN_SPEED_BASE,
            'cfg-sw-speed-mult': CONFIG.SWORD.SPEED_MULT,
            'cfg-sw-trail': CONFIG.SWORD.TRAIL_LENGTH,
            'cfg-sw-size': CONFIG.SWORD.SIZE,
            'cfg-sw-respawn': CONFIG.SWORD.RESPAWN_DELAY_MS,
            'cfg-sw-death-wait': CONFIG.SWORD.DEATH_WAIT_MS,
            'cfg-sw-breath': CONFIG.SWORD.BREATH_SPEED.MIN,
            'cfg-sw-stun': CONFIG.SWORD.STUN_DURATION_MS,
            'cfg-sw-paused': CONFIG.SWORD.IS_PAUSED ? 1 : 0,

            'cfg-en-spawn': CONFIG.ENEMY.SPAWN_COUNT,
            'cfg-en-elite': CONFIG.ENEMY.ELITE_CHANCE,
            'cfg-en-shield-ch': CONFIG.ENEMY.SHIELD_CHANCE,
            'cfg-en-shield-hp': CONFIG.ENEMY.SHIELD_HP_RATIO,
            'cfg-en-debris': CONFIG.ENEMY.DEBRIS.COUNT,

            'cfg-ma-regen': CONFIG.MANA.REGEN_PER_SEC,
            'cfg-ma-interval': CONFIG.MANA.REGEN_INTERVAL_MS,
            'cfg-ma-atk': CONFIG.MANA.COST_ATTACK_PER_SEC,
            'cfg-ma-move': CONFIG.MANA.COST_MOVE_PER_SEC,
            'cfg-ma-res-cost': Math.abs(CONFIG.MANA.COST_RESPAWN),
            'cfg-sw-change-form': CONFIG.MANA.COST_CHANGE_FORM,
            'cfg-sw-gain-kill': CONFIG.MANA.GAIN_KILL,

            'cfg-pi-chance': CONFIG.PILL.CHANCE,
            'cfg-st-chance': CONFIG.SPIRIT_STONE.CHANCE,
            'cfg-pi-magnet': CONFIG.PILL.MAGNET_SPEED,
            'cfg-pi-trail': CONFIG.PILL.TRAIL_LENGTH,
            'cfg-ul-max-rage': CONFIG.ULTIMATE.MAX_RAGE,
            'cfg-ul-gain-kill': CONFIG.ULTIMATE.GAIN_PER_KILL,
            'cfg-ul-duration': CONFIG.ULTIMATE.DURATION_MS,
            'cfg-ul-transition': CONFIG.ULTIMATE.TRANSITION_MS,
            'cfg-ul-steps': CONFIG.ULTIMATE.CHARGE_STEPS,
            'cfg-cu-penalty': CONFIG.CULTIVATION.BREAKTHROUGH_PENALTY_FACTOR,
            'cfg-cu-max-chance': CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE
        };

        for (let id in mapping) {
            let el = document.getElementById(id);
            if (el) {
                const value = mapping[id];
                if (el.type === 'checkbox') {
                    el.checked = Boolean(value);
                } else {
                    el.value = (value !== undefined) ? value : "";
                }
            }
        }

        this.overlay.style.display = 'flex';
        syncPopupCursorState();
        setTimeout(() => {
            this.overlay.classList.add('show');
            syncPopupCursorState();
        }, 10);
    },

    save() {
        try {
            // 1. Cập nhật các giá trị từ UI vào object CONFIG
            CONFIG.BG.STAR_COUNT = parseInt(document.getElementById('cfg-bg-star-count').value);
            CONFIG.BG.STAR_SIZE.MIN = parseFloat(document.getElementById('cfg-bg-star-min').value);
            CONFIG.BG.STAR_TWINKLE_SPEED = parseFloat(document.getElementById('cfg-bg-star-twinkle').value);
            CONFIG.ZOOM.SMOOTH = parseFloat(document.getElementById('cfg-zoom-smooth').value);
            CONFIG.ZOOM.SENSITIVITY = parseFloat(document.getElementById('cfg-zoom-sens').value);
            CONFIG.COLORS.BG_FADE = document.getElementById('cfg-col-bg-fade').value;

            CONFIG.SWORD.COUNT = parseInt(document.getElementById('cfg-sw-count').value);
            CONFIG.SWORD.BASE_RADIUS = parseInt(document.getElementById('cfg-sw-radius').value);
            CONFIG.SWORD.LAYER_SPACING = parseInt(document.getElementById('cfg-sw-spacing').value);
            CONFIG.SWORD.SPIN_SPEED_BASE = parseFloat(document.getElementById('cfg-sw-spin').value);
            CONFIG.SWORD.SPEED_MULT = parseFloat(document.getElementById('cfg-sw-speed-mult').value);
            CONFIG.SWORD.TRAIL_LENGTH = parseInt(document.getElementById('cfg-sw-trail').value);
            CONFIG.SWORD.SIZE = parseInt(document.getElementById('cfg-sw-size').value);
            CONFIG.SWORD.RESPAWN_DELAY_MS = parseInt(document.getElementById('cfg-sw-respawn').value);
            CONFIG.SWORD.DEATH_WAIT_MS = parseInt(document.getElementById('cfg-sw-death-wait').value);
            CONFIG.SWORD.STUN_DURATION_MS = parseInt(document.getElementById('cfg-sw-stun').value);
            CONFIG.SWORD.IS_PAUSED = document.getElementById('cfg-sw-paused').checked;

            CONFIG.ENEMY.SPAWN_COUNT = parseInt(document.getElementById('cfg-en-spawn').value);
            CONFIG.ENEMY.ELITE_CHANCE = parseFloat(document.getElementById('cfg-en-elite').value);
            CONFIG.ENEMY.SHIELD_CHANCE = parseFloat(document.getElementById('cfg-en-shield-ch').value);
            CONFIG.ENEMY.SHIELD_HP_RATIO = parseFloat(document.getElementById('cfg-en-shield-hp').value);
            CONFIG.ENEMY.DEBRIS.COUNT = parseInt(document.getElementById('cfg-en-debris').value);

            CONFIG.MANA.REGEN_PER_SEC = parseFloat(document.getElementById('cfg-ma-regen').value);
            CONFIG.MANA.REGEN_INTERVAL_MS = parseInt(document.getElementById('cfg-ma-interval').value);
            CONFIG.MANA.COST_ATTACK_PER_SEC = parseFloat(document.getElementById('cfg-ma-atk').value);
            CONFIG.MANA.COST_MOVE_PER_SEC = parseFloat(document.getElementById('cfg-ma-move').value);
            CONFIG.MANA.COST_RESPAWN = -Math.abs(parseFloat(document.getElementById('cfg-ma-res-cost').value));
            CONFIG.MANA.COST_CHANGE_FORM = parseFloat(document.getElementById('cfg-sw-change-form').value);
            CONFIG.MANA.GAIN_KILL = parseFloat(document.getElementById('cfg-sw-gain-kill').value);
            
            CONFIG.PILL.CHANCE = parseFloat(document.getElementById('cfg-pi-chance').value);
            CONFIG.SPIRIT_STONE.CHANCE = parseFloat(document.getElementById('cfg-st-chance').value);
            CONFIG.PILL.MAGNET_SPEED = parseInt(document.getElementById('cfg-pi-magnet').value);
            CONFIG.PILL.TRAIL_LENGTH = parseInt(document.getElementById('cfg-pi-trail').value);
            CONFIG.ULTIMATE.MAX_RAGE = Math.max(1, parseInt(document.getElementById('cfg-ul-max-rage').value, 10) || 1);
            CONFIG.ULTIMATE.GAIN_PER_KILL = Math.max(0, parseFloat(document.getElementById('cfg-ul-gain-kill').value) || 0);
            CONFIG.ULTIMATE.DURATION_MS = Math.max(100, parseInt(document.getElementById('cfg-ul-duration').value, 10) || 100);
            CONFIG.ULTIMATE.TRANSITION_MS = Math.max(100, parseInt(document.getElementById('cfg-ul-transition').value, 10) || 100);
            CONFIG.ULTIMATE.CHARGE_STEPS = Math.max(1, parseInt(document.getElementById('cfg-ul-steps').value, 10) || 1);
            CONFIG.CULTIVATION.BREAKTHROUGH_PENALTY_FACTOR = parseFloat(document.getElementById('cfg-cu-penalty').value);
            CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE = parseFloat(document.getElementById('cfg-cu-max-chance').value);

            Input.maxRage = CONFIG.ULTIMATE.MAX_RAGE;
            Input.rage = Math.min(Input.rage, Input.maxRage);
            Input.renderRageUI();

            // --- 2. Lưu vào LocalStorage để không bị mất khi load lại trang ---
            localStorage.setItem('thanh_truc_settings', JSON.stringify(CONFIG));

            // --- 3. QUAN TRỌNG: KHỞI TẠO LẠI TRẬN PHÁP ---
            // Xóa sạch các mảng hiện tại
            swords.length = 0;
            enemies.length = 0;
            visualParticles.length = 0;

            // Tạo lại các đối tượng theo CONFIG mới
            for (let i = 0; i < CONFIG.SWORD.COUNT; i++) {
                swords.push(new Sword(i, scaleFactor));
            }
            syncSwordFormation({ rebuildAll: true });
            for (let i = 0; i < CONFIG.ENEMY.SPAWN_COUNT; i++) {
                enemies.push(new Enemy());
            }
            // Tạo lại bầu trời sao nếu số lượng sao thay đổi
            starField = new StarField(CONFIG.BG.STAR_COUNT, width, height);

            showNotify("Trận pháp đã được tái thiết!", "#8fffe0");
            this.close();
        } catch (e) {
            console.error("Lỗi khi ghi chép Thiên Thư:", e);
        }
    },

    reset() {
        localStorage.removeItem('thanh_truc_settings');
        showNotify("Thiên đạo đã quy hồi nguyên trạng!", "#ffcc00");
        this.close();
        location.reload();
    }
};

// 2. Nút Đổi Hình Thái (Change Form)
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
    const usagePct = Math.max(0, Math.min(100, Math.round((summary.usageRatio || 0) * 100)));

    return `
        <div class="inventory-capacity-card">
            <div class="inventory-capacity-card__row">
                <span class="inventory-capacity-card__label">Túi trữ vật</span>
                <strong class="inventory-capacity-card__value">${formatNumber(summary.uniqueCount)}/${formatNumber(summary.capacity)} ô</strong>
            </div>
            <div class="inventory-capacity-card__track">
                <span style="width:${usagePct}%"></span>
            </div>
            <div class="inventory-capacity-card__meta">
                <span>Còn trống ${formatNumber(summary.freeSlots)} ô</span>
                <span>${summary.freeSlots > 0 ? 'Có thể nhận thêm vật phẩm mới' : 'Túi đã đầy'}</span>
            </div>
        </div>
    `;
}

function buildBeastWalletMarkup() {
    const summary = Input.getBeastSummary();
    const usagePct = Math.max(0, Math.min(100, Math.round((summary.usageRatio || 0) * 100)));

    return `
        <div class="beast-wallet">
            <div class="beast-wallet__header">
                <div>
                    <span class="beast-wallet__eyebrow">Linh Thú Đại</span>
                    <strong>${formatNumber(summary.totalBeasts)}/${formatNumber(summary.capacity)} linh trùng đã nở</strong>
                </div>
                <div class="beast-wallet__meta">
                    <span>${formatNumber(summary.totalEggs)} trứng noãn</span>
                    <span>${formatNumber(summary.discoveredCount)}/${formatNumber(summary.speciesTotal)} loài đã mở</span>
                </div>
            </div>
            <div class="inventory-capacity-card__track beast-wallet__track">
                <span style="width:${usagePct}%"></span>
            </div>
            <div class="beast-wallet__footer">
                <span>${summary.freeSlots > 0 ? `Còn ${formatNumber(summary.freeSlots)} ô cho linh trùng mới` : 'Linh Thú Đại đã đầy'}</span>
                <span>${Input.hasKhuTrungThuatUnlocked() ? 'Đã lĩnh ngộ Khu Trùng Thuật' : 'Chưa lĩnh ngộ Khu Trùng Thuật'}</span>
            </div>
        </div>
    `;
}

function buildInsectVisualVars(species, { egg = false } = {}) {
    const primary = egg ? (species?.eggColor || species?.color || '#79ffd4') : (species?.color || '#79ffd4');
    const secondary = species?.secondaryColor || primary;
    const aura = species?.auraColor || secondary;

    return `--beast-accent:${primary};--beast-secondary:${secondary};--beast-aura:${aura};--beast-glow:${aura};`;
}

function buildInsectBookStyleVars(species) {
    const accent = species?.color || '#79ffd4';
    const secondary = species?.secondaryColor || accent;
    const aura = species?.auraColor || secondary;

    return `--book-accent:${accent};--book-secondary:${secondary};--book-aura:${aura};`;
}

function getInsectVisualSlug(speciesKey) {
    return String(speciesKey || 'unknown')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

let insectSvgUid = 0;

function getInsectSvgFamily(speciesKey) {
    switch (speciesKey) {
        case 'HUYEN_DIEM_NGA':
            return 'butterfly';
        case 'HUYET_NGOC_TRI_CHU':
            return 'spider';
        case 'PHI_THIEN_TU_VAN_HAT':
        case 'KIM_GIAP_HAT':
            return 'scorpion';
        case 'KIEN_THIEN_TINH':
        case 'THIET_HOA_NGHI':
        case 'HUYET_THUC_NGHI':
            return 'ant';
        case 'PHE_KIM_TRUNG':
            return 'beetle';
        case 'KIM_TAM':
        case 'BANG_TAM':
        case 'THON_LINH_TRUNG':
        default:
            return 'worm';
    }
}

function buildInsectSvgDefs(uid, palette, egg = false) {
    const { primary, secondary, aura } = palette;
    const shellTop = egg ? secondary : '#ffffff';
    const shellBottom = egg ? primary : primary;

    return `
        <defs>
            <linearGradient id="${uid}-body" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="${secondary}"></stop>
                <stop offset="100%" stop-color="${primary}"></stop>
            </linearGradient>
            <linearGradient id="${uid}-accent" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffffff"></stop>
                <stop offset="100%" stop-color="${secondary}"></stop>
            </linearGradient>
            <radialGradient id="${uid}-glow" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stop-color="${aura}" stop-opacity="0.32"></stop>
                <stop offset="100%" stop-color="${aura}" stop-opacity="0"></stop>
            </radialGradient>
            <linearGradient id="${uid}-shell" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="${shellTop}"></stop>
                <stop offset="100%" stop-color="${shellBottom}"></stop>
            </linearGradient>
            <filter id="${uid}-shadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${aura}" flood-opacity="0.32"></feDropShadow>
            </filter>
        </defs>
    `;
}

function buildButterflySvg(uid) {
    return `
        <g filter="url(#${uid}-shadow)" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="80" cy="66" rx="54" ry="34" fill="url(#${uid}-glow)" opacity="0.44"></ellipse>
            <g transform="translate(14 90) scale(0.0115 -0.0115)">
                <path d="M5007 8000 c-56 -44 -78 -193 -53 -357 29 -191 99 -390 181 -513 74 -111 148 -147 208 -100 37 29 77 118 84 184 6 62 15 63 31 1 5 -22 33 -123 61 -225 162 -580 293 -1165 551 -2465 77 -390 145 -721 151 -735 17 -45 0 99 -21 180 -11 41 -33 154 -50 250 -16 96 -52 288 -79 425 -28 138 -82 419 -120 627 -168 892 -246 1220 -485 2023 -128 428 -169 530 -256 627 -50 56 -117 98 -157 98 -11 0 -32 -9 -46 -20z" fill="url(#${uid}-accent)" opacity="0.94"></path>
                <path d="M7658 7971 c-49 -31 -123 -123 -163 -201 -61 -121 -289 -885 -415 -1389 -77 -309 -133 -582 -274 -1331 -36 -190 -79 -412 -96 -495 -17 -82 -44 -231 -61 -330 -16 -99 -41 -224 -55 -279 -14 -55 -24 -119 -22 -144 2 -32 54 208 171 794 279 1394 385 1863 583 2558 27 95 29 98 37 65 23 -95 40 -140 67 -177 52 -72 102 -69 179 9 126 128 241 464 241 706 0 109 -10 154 -43 204 -32 48 -84 51 -149 10z" fill="url(#${uid}-accent)" opacity="0.94"></path>
                <path d="M0 7444 c0 -14 7 -74 16 -131 40 -275 173 -537 432 -852 193 -235 378 -434 967 -1036 620 -634 802 -842 902 -1030 38 -69 38 -71 34 -165 -13 -295 -5 -337 80 -464 101 -151 269 -282 445 -345 149 -54 228 -66 444 -66 203 0 247 5 600 60 298 47 423 59 569 52 254 -11 454 -79 668 -226 380 -261 604 -656 784 -1380 41 -169 54 -209 61 -190 15 41 67 310 82 429 106 816 -50 1698 -434 2455 -190 374 -406 677 -690 969 -285 292 -576 508 -885 657 -254 122 -408 166 -860 244 -115 20 -259 47 -320 60 -60 13 -258 51 -440 85 -638 118 -878 173 -1240 285 -485 150 -669 238 -1030 491 -192 135 -185 131 -185 98z" fill="url(#${uid}-body)"></path>
                <path d="M12705 7403 c-319 -300 -752 -491 -1485 -652 -244 -54 -1178 -239 -1545 -307 -512 -94 -665 -135 -923 -251 -902 -406 -1647 -1394 -1952 -2588 -140 -549 -172 -1060 -95 -1548 27 -171 88 -414 98 -387 3 8 19 83 37 165 75 358 144 568 261 795 84 163 176 287 314 426 264 265 520 393 855 424 176 17 330 4 730 -60 347 -55 431 -63 609 -57 125 4 173 10 244 30 158 45 276 117 400 242 156 158 221 330 197 522 -16 123 -14 169 10 214 11 23 75 112 142 198 284 366 396 489 1028 1126 306 308 601 614 656 680 183 220 299 397 403 616 66 138 98 236 107 326 7 62 -2 153 -14 153 -4 -1 -38 -31 -77 -67z" fill="url(#${uid}-body)"></path>
                <path d="M6315 3707 c-47 -46 -67 -99 -58 -152 5 -29 10 -34 49 -44 103 -26 218 -5 229 42 16 63 -39 149 -117 181 -52 22 -55 21 -103 -27z" fill="url(#${uid}-accent)"></path>
                <path d="M6319 3408 c-67 -91 -74 -119 -74 -278 1 -137 2 -150 33 -240 18 -52 43 -115 56 -139 l23 -45 -33 -70 c-105 -224 -128 -626 -69 -1206 27 -259 126 -931 143 -974 7 -16 12 -10 31 34 17 40 25 85 33 189 5 75 25 260 44 411 50 407 64 570 71 820 9 346 -21 569 -96 719 l-32 62 37 112 c69 214 84 384 43 508 -28 84 -52 116 -97 129 -64 17 -80 13 -113 -32z" fill="url(#${uid}-accent)"></path>
                <path d="M4235 3279 c-38 -4 -151 -27 -250 -49 -509 -117 -706 -146 -935 -136 -210 9 -347 40 -492 112 -37 19 -70 34 -72 34 -9 0 -44 -105 -60 -180 -68 -307 -15 -656 134 -882 60 -91 166 -193 249 -236 110 -59 193 -75 391 -75 155 0 206 5 440 41 384 59 452 65 634 59 185 -6 269 -22 411 -78 217 -84 368 -205 440 -352 32 -64 39 -91 43 -155 10 -185 -90 -370 -225 -416 -128 -44 -267 8 -414 154 -93 93 -127 143 -176 264 -38 96 -48 86 -41 -42 4 -64 12 -105 33 -155 74 -181 227 -350 409 -452 157 -88 341 -122 516 -95 47 7 103 29 200 77 74 37 138 69 143 71 4 2 17 -18 29 -45 55 -120 -1 -382 -112 -529 -68 -90 -187 -152 -331 -172 l-64 -9 30 -13 c17 -8 64 -14 110 -14 142 0 283 63 360 162 175 221 278 635 278 1107 0 322 -36 554 -128 832 -107 324 -265 577 -494 795 -307 292 -672 422 -1056 377z" fill="url(#${uid}-body)" opacity="0.92"></path>
                <path d="M8220 3259 c-228 -49 -292 -68 -385 -113 -284 -138 -533 -398 -698 -731 -248 -499 -323 -1201 -190 -1795 32 -145 91 -315 132 -379 91 -142 254 -221 456 -221 115 0 122 13 18 35 -178 37 -284 119 -363 278 -56 113 -78 225 -62 319 7 38 19 84 27 103 13 32 16 34 40 25 15 -6 57 -28 94 -50 168 -100 348 -123 541 -69 293 81 560 324 634 578 16 56 20 156 7 201 -7 24 -8 23 -20 -15 -7 -22 -31 -74 -53 -115 -137 -258 -395 -413 -566 -340 -151 65 -249 310 -196 491 64 218 265 382 574 470 77 22 103 24 285 23 169 0 225 -4 365 -27 429 -71 500 -80 675 -80 143 -1 184 2 259 21 284 71 477 283 562 617 24 94 28 129 27 240 0 72 -6 162 -12 200 -23 141 -54 293 -61 305 -5 8 -27 2 -80 -25 -99 -50 -258 -101 -360 -116 -187 -27 -512 4 -770 72 -63 17 -173 46 -245 65 -277 73 -417 81 -635 33z" fill="url(#${uid}-body)" opacity="0.92"></path>
            </g>
        </g>
    `;
}

function buildSpiderSvg(uid) {
    return `
        <g filter="url(#${uid}-shadow)" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="82" cy="68" rx="52" ry="36" fill="url(#${uid}-glow)" opacity="0.34"></ellipse>
            <g transform="translate(31 11) scale(0.19)">
                <path d="M255.9 20.45c-54.1 0-98 93.45-98 146.85 0 31 14.9 58.6 37.9 76.3 5.9-6.9 12.2-12.9 19-17.7 13.7-7.9 27.8-13.9 41.1-14.1 14.4 0 28.4 5 41.2 14.1 6.7 4.8 13.1 10.8 19 17.7 23-17.7 37.8-45.3 37.8-76.3 0-53.4-43.9-146.85-98-146.85zm236.9 14.27L419.3 208.1 329.2 262c3.2 5.2 6 10.6 8.6 16.2l96.1-57.4 58.9-139.03V34.72zm-473.72 0v47.05L78.01 220.8 174.1 278c2.6-5.6 5.5-11 8.6-16.2l-90.13-53.7zM255.9 227.8c-10.7 0-21.3 3.6-31.8 11.1-10.8 8.9-19.9 19-26.1 28.6-14.9 23.5-24 54.4-24 81.5 0 26.6 8.4 47.2 24 61 14 12.4 33.8 19.3 57.9 19.3s43.9-6.9 58-19.3c15.5-13.8 24-34.4 24-61 0-27.1-9.1-58-24.1-81.5-7.8-12.3-16.6-21.9-26-28.6-10.5-6.2-21.5-10.9-31.9-11.1zM19.08 238.5v23.4l64.42 51.2 76.6 10.6c1-6 2.3-12 3.9-18l-73-10.1-71.92-57.1zm473.72 0l-71.9 57.1-73.1 10.2c1.7 5.9 3 11.9 4 18l76.6-10.7 64.4-51.2v-23.4zM353.7 355.1c-.3 6.4-1 12.5-2.2 18.3l69 15.1 72.3 58.1v-23.5l-64.1-51.6c-25-5.5-50-10.9-75-16.4zm-195.6.1l-74.92 16.3-64.11 51.6v23.5l72.24-58.1 69.09-15c-1.1-6.4-2-12.8-2.3-18.3zm44.4 6.6c5.6 0 10.1 4.5 10.1 10.1 0 5.5-4.5 10-10.1 10s-10.1-4.5-10.1-10c0-5.6 4.5-10.1 10.1-10.1zm107.1 0c5.6 0 10.1 4.5 10.1 10.1 0 5.5-4.5 10-10.1 10s-10.1-4.5-10.1-10c0-5.6 4.5-10.1 10.1-10.1zm-74.8 11.3c9.3 0 16.9 7.6 16.9 16.8 0 9.3-7.6 16.9-16.9 16.9-9.4 0-16.9-7.6-16.9-16.9 0-9.2 7.5-16.8 16.9-16.8zm42.5 0c9.4 0 16.9 7.6 16.9 16.8 0 9.3-7.5 16.9-16.9 16.9-9.3 0-16.9-7.6-16.9-16.9 0-9.2 7.6-16.8 16.9-16.8zm64.4 27.3c-3 5.4-6.6 10.5-10.7 15.1l51.1 27.1 27.5 51h20.9L395.6 429c-18-9.5-35.9-19.1-53.9-28.6zm-171.5.1l-54 28.5-34.82 64.7h20.82l27.5-51.1 51.2-27c-4.1-5-8-10.3-10.7-15.1zm30.2 25.3c-4.4.1-9.5 2.3-14.9 7.7-3.8 7.8-5.9 16.5-5.9 25.7 0 16.5 6.8 31.4 17.8 42.5v-4c0-20.8 7.7-39.3 19.6-50.8 0-10.8-6.7-21.2-16.5-21.1zm111.1 0c-9.8-.1-16.6 10.3-16.6 21.1 11.9 11.5 19.6 30 19.6 50.8v4c11-11.1 17.8-26 17.8-42.5 0-9.2-2.1-17.9-5.9-25.7-5.4-5.4-10.5-7.6-14.9-7.7zm-70.3 14.1c-1.6.1-3.4.9-5.3 2.8-1.4 2.8-2.1 5.9-2.1 9.2 0 5.9 2.4 11.3 6.4 15.3-.1-.5-.1-1-.1-1.5 0-7.4 2.8-14.1 7.1-18.2-.9-3.9-2.7-7.5-6-7.6zm29.7 0c-3.6 0-6 3.7-6 7.6 4.3 4.1 7.1 10.8 7.1 18.2 0 .5 0 1-.1 1.5 4-4 6.4-9.4 6.4-15.3 0-3.3-.7-6.4-2.1-9.2-1.6-1.3-3.5-2.7-5.3-2.8z" fill="url(#${uid}-body)"></path>
            </g>
        </g>
    `;
}

function buildScorpionSvg(uid, { winged = false, armored = false } = {}) {
    return `
        <g filter="url(#${uid}-shadow)" stroke-linecap="round" stroke-linejoin="round">
            ${winged ? `
                <path d="M66 44 C48 20 28 18 22 34 C28 48 44 54 64 52 Z" fill="url(#${uid}-accent)" opacity="0.18"></path>
                <path d="M98 44 C116 20 136 18 142 34 C136 48 120 54 100 52 Z" fill="url(#${uid}-accent)" opacity="0.18"></path>
            ` : ''}
            <ellipse cx="82" cy="68" rx="52" ry="36" fill="url(#${uid}-glow)" opacity="0.34"></ellipse>
            <g transform="translate(28 4) scale(3.15)">
                <path d="M12.75,15.685c0.036-1.069-0.497-2.093-1.641-2.158c-2.03,0.061-4.005,3.159-4.084,3.827c0.143,0.1,3.164-2.848,3.729-2.839C11.319,14.519,12.278,14.869,12.75,15.685z" fill="url(#${uid}-accent)"></path>
                <path d="M11.202,17.247c0.586,0.013,1.821,1.796,1.727,1.291c-0.096-0.504-0.3-2.52-1.725-2.375c-1.426,0.146-3.228,3.517-3.158,4.121C8.333,20.15,10.616,17.234,11.202,17.247z" fill="url(#${uid}-accent)"></path>
                <path d="M11.247,19.702c-1.178,0.149-2.492,2.61-2.302,3.214c0.329-0.225,1.938-2.293,2.789-2.34s1.851,0.96,1.824,0.602C13.532,20.818,12.424,19.552,11.247,19.702z" fill="url(#${uid}-accent)"></path>
                <path d="M19.254,15.684c0.472-0.815,1.431-1.166,1.994-1.172c0.564-0.006,3.588,2.938,3.729,2.841c-0.079-0.67-2.055-3.768-4.084-3.829C19.75,13.591,19.215,14.614,19.254,15.684z" fill="url(#${uid}-accent)"></path>
                <path d="M20.639,16.162c-1.426-0.145-1.631,1.871-1.725,2.375c-0.097,0.505,1.141-1.278,1.728-1.291c0.586-0.014,2.866,2.904,3.155,3.037C23.867,19.678,22.064,16.308,20.639,16.162z" fill="url(#${uid}-accent)"></path>
                <path d="M20.414,19.701c-1.179-0.15-2.285,1.117-2.312,1.476s0.973-0.646,1.823-0.602c0.852,0.046,2.459,2.114,2.789,2.34C22.906,22.312,21.59,19.852,20.414,19.701z" fill="url(#${uid}-accent)"></path>
                <path d="M12.983,11.261c0,0,0.448-0.92,0.718-1.174c-0.951-0.444-1.47-1.786-1.47-1.786s3.844-3.343,0.892-5.961c0.404,1.863-0.571,3.18-1.446,2.941C10.801,5.044,10.562,0.572,12.278,0C7.514,0,9.394,5.883,9.943,7.011C10.492,8.139,12.983,11.261,12.983,11.261z" fill="url(#${uid}-accent)"></path>
                <path d="M19.496,8.301c0,0-0.52,1.342-1.472,1.786c0.271,0.254,0.719,1.174,0.719,1.174s2.491-3.122,3.04-4.25C22.334,5.883,24.213,0,19.448,0c1.718,0.572,1.478,5.044,0.603,5.281c-0.875,0.238-1.852-1.078-1.445-2.941C15.651,4.958,19.496,8.301,19.496,8.301z" fill="url(#${uid}-accent)"></path>
                <path d="M18.461,30.879c-0.461-0.033-1.269-1.275-1.334-2.693c-0.065-1.42-0.336-5.435,0.317-7.713c0,0,1.155-5.361,1.072-6.418c-1.087-1.216-1.087-1.216-1.087-1.216s1.113,0.285,1.091-0.736s-1.017-2.328-1.897-2.31c0.141-0.224,1.478-1.698,0-2.005c0.391,0.863-0.445,1.727-0.809,1.671s-0.863-0.725-1.03-1.671c-1.114,0.641,0.066,1.579,0.307,1.81c-0.947,0.177-1.925,1.597-1.82,2.357c0.104,0.762,1.288,0.805,1.288,0.805s-0.35,0.405-1.288,1.23c0.057,0.725,0.831,5.217,0.964,6.2c0.001,0.006,0.005,0.012,0.006,0.018c1.38,8.863,2.714,10.791,3.507,11.469c1.094,0.947,4.297-0.226,1.647-2.811C19.77,29.988,19.268,30.925,18.461,30.879z" fill="url(#${uid}-body)"></path>
                ${armored ? `
                    <path d="M17.51,12.95c-0.4,1.85-0.72,4.06-0.98,5.56c-0.28,1.62-0.1,6.12,0.2,8.55" fill="none" stroke="url(#${uid}-accent)" stroke-width="0.85" opacity="0.9"></path>
                    <path d="M15.54,12.98c-0.18,1.46-0.42,3.1-0.6,4.49" fill="none" stroke="url(#${uid}-accent)" stroke-width="0.72" opacity="0.82"></path>
                ` : `
                    <ellipse cx="15.85" cy="20.4" rx="1.55" ry="4.6" fill="#ffffff" opacity="0.12"></ellipse>
                `}
            </g>
        </g>
    `;
}

function buildAntSvg(uid) {
    return `
        <g filter="url(#${uid}-shadow)" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="82" cy="68" rx="52" ry="36" fill="url(#${uid}-glow)" opacity="0.34"></ellipse>
            <g transform="translate(16 96) scale(0.01 -0.01)">
                <path d="M6118 5648 c-25 -18 -54 -46 -64 -63 -9 -16 -43 -66 -74 -110 -32 -44 -138 -195 -237 -335 -99 -140 -197 -279 -218 -308 l-38 -54 -40 49 c-79 95 -180 183 -210 183 -55 0 -147 -66 -147 -105 0 -7 -14 -43 -31 -80 -17 -37 -45 -111 -63 -164 -18 -53 -35 -101 -39 -107 -3 -6 -41 -14 -84 -17 -100 -8 -195 -30 -309 -72 l-90 -34 -80 39 c-235 115 -492 175 -724 169 -112 -4 -123 -6 -140 -27 -10 -12 -29 -22 -44 -22 -40 0 -131 -50 -231 -127 -122 -93 -750 -620 -905 -759 -195 -175 -340 -326 -340 -356 0 -20 -40 -63 -187 -199 -104 -96 -295 -275 -427 -399 l-238 -225 -117 -51 c-65 -28 -144 -65 -176 -82 -32 -18 -69 -32 -82 -32 -31 0 -193 -36 -229 -51 -19 -8 -95 -13 -219 -13 -160 -1 -196 -4 -230 -19 -49 -22 -80 -50 -96 -88 -16 -41 -5 -46 32 -15 45 38 63 31 67 -24 1 -25 5 -51 7 -59 8 -22 32 5 44 52 13 49 20 61 43 70 15 5 187 -11 197 -19 2 -2 -2 -10 -9 -19 -23 -28 -1 -28 34 -1 20 14 48 26 64 26 17 0 86 16 154 36 67 20 131 39 141 41 13 4 16 1 11 -13 -5 -13 4 -9 27 14 19 17 38 32 42 32 4 0 68 27 141 60 74 33 137 60 140 60 3 0 6 -18 6 -41 0 -53 15 -42 35 26 12 42 20 55 35 55 30 0 226 163 682 566 187 166 220 191 243 187 33 -7 59 -57 83 -161 l18 -77 13 69 c7 38 11 101 10 139 l-2 69 610 611 611 612 9 -40 8 -40 92 -7 c143 -11 301 -70 460 -170 35 -22 63 -42 63 -45 0 -4 -27 -30 -59 -60 -143 -129 -322 -385 -335 -479 -2 -16 -20 -65 -40 -109 -75 -170 -143 -458 -131 -560 3 -33 9 -83 11 -111 l6 -50 -41 -12 c-73 -22 -122 -77 -136 -155 -9 -45 8 -50 30 -8 16 31 51 49 66 34 5 -5 13 -33 19 -63 6 -29 13 -56 16 -59 11 -11 23 25 30 86 3 35 10 65 13 68 4 2 15 -28 25 -68 73 -304 322 -604 519 -624 44 -4 64 0 137 32 46 20 90 41 97 47 7 6 13 7 13 2 0 -12 -46 -179 -104 -377 -25 -87 -45 -161 -43 -166 1 -5 -30 -48 -69 -97 -39 -49 -89 -113 -110 -142 -26 -35 -66 -72 -119 -106 -44 -29 -109 -77 -145 -107 -63 -53 -67 -54 -155 -66 -101 -13 -204 -43 -252 -72 -35 -22 -68 -77 -78 -133 -8 -42 10 -62 24 -26 12 32 47 62 65 55 8 -3 20 -31 27 -62 7 -31 16 -58 21 -61 12 -8 30 46 27 86 -5 82 6 90 134 99 l89 6 -6 -27 c-7 -38 9 -35 36 6 12 18 40 43 62 55 23 12 88 62 146 111 58 49 108 90 112 90 4 0 8 -10 10 -22 2 -18 6 -12 18 22 8 27 48 87 97 148 45 57 89 112 97 124 18 25 31 18 46 -27 19 -57 29 -40 15 25 -7 35 -9 63 -4 66 30 18 108 242 180 517 l44 168 83 45 c46 24 87 42 93 39 5 -4 8 -1 7 7 -2 7 5 12 15 12 10 -1 16 1 13 4 -7 7 13 32 26 32 5 0 6 -5 2 -12 -4 -7 -3 -8 5 -4 6 4 9 11 7 15 -7 11 39 52 94 86 57 35 206 153 245 195 17 17 51 41 77 52 26 11 53 26 59 34 14 17 33 19 23 2 -4 -7 -3 -8 5 -4 6 4 9 11 6 16 -3 4 16 25 41 46 26 20 66 64 89 96 24 32 57 70 74 84 88 73 212 307 236 445 l7 36 61 -25 c50 -21 84 -26 177 -30 66 -2 139 1 170 7 70 15 157 55 193 89 64 60 107 188 107 314 0 56 4 78 13 78 9 0 10 -21 1 -102 -13 -121 -16 -131 -65 -225 l-37 -72 36 15 c20 8 44 21 52 29 9 8 19 12 23 9 4 -4 2 8 -3 27 -6 19 -9 50 -9 69 1 30 3 28 9 -15 9 -58 23 -97 49 -134 10 -14 23 -53 30 -86 6 -33 20 -71 30 -85 15 -22 18 -38 13 -98 -4 -66 -7 -72 -27 -72 -30 0 -100 -48 -165 -115 l-55 -56 86 40 c88 42 155 58 176 43 10 -6 7 -30 -12 -106 -47 -186 -85 -510 -85 -732 l0 -121 -35 -24 c-45 -31 -45 -42 0 -23 43 18 41 22 51 -116 8 -117 8 -123 0 -165 -4 -16 -3 -24 0 -17 12 26 21 9 49 -90 15 -57 39 -124 52 -150 12 -26 23 -62 23 -80 1 -31 2 -32 15 -14 14 18 17 17 70 -29 31 -26 63 -58 72 -72 15 -23 14 -26 -16 -64 -45 -55 -38 -78 12 -44 53 36 71 30 77 -25 l5 -45 23 35 c47 74 19 141 -112 273 -82 82 -93 98 -105 147 -8 30 -28 89 -46 131 -28 66 -33 92 -39 200 -5 99 -4 131 8 154 10 21 16 86 21 215 8 218 29 485 50 624 8 55 15 103 15 107 0 4 9 11 20 14 32 10 52 63 60 160 l7 90 56 57 c34 34 60 71 67 95 12 44 39 361 40 473 l0 75 46 24 c25 13 56 37 70 53 21 26 24 27 24 9 0 -11 -7 -46 -15 -78 -33 -128 -11 -244 51 -259 61 -15 189 17 278 71 62 37 71 41 61 26 -10 -17 109 51 165 94 47 36 105 94 180 180 17 20 17 22 -2 60 -12 22 -25 43 -31 46 -5 4 -8 12 -6 18 2 6 35 -41 72 -104 37 -63 91 -148 118 -190 l50 -77 -21 -55 c-11 -31 -19 -57 -17 -60 2 -2 16 15 31 37 14 22 28 40 30 40 2 0 29 -34 61 -75 32 -42 70 -86 85 -98 20 -16 46 -69 95 -192 37 -93 85 -204 106 -246 22 -41 39 -83 39 -92 0 -9 5 -19 11 -23 7 -4 10 3 9 17 -1 13 -2 27 -1 32 2 12 201 -92 208 -108 3 -8 9 -15 15 -15 5 0 6 5 3 10 -9 14 -3 13 77 -19 40 -16 89 -32 108 -36 19 -4 44 -15 54 -24 18 -15 19 -15 13 1 -7 19 3 23 74 33 52 8 59 2 78 -62 16 -56 31 -55 31 2 0 51 18 60 44 23 9 -12 18 -19 21 -16 9 9 -20 71 -42 91 -27 24 -125 38 -198 29 -51 -6 -73 -3 -150 22 -49 16 -144 55 -210 88 l-119 60 -73 207 c-40 113 -72 222 -73 242 0 64 -30 136 -196 471 l-162 326 45 49 c78 82 159 178 194 229 l33 49 7 -30 c9 -43 24 -76 51 -111 100 -136 143 -187 202 -241 212 -198 611 -381 838 -384 l63 -1 68 -74 c81 -87 208 -175 315 -217 104 -40 235 -49 303 -19 48 21 106 83 94 102 -10 16 -57 12 -99 -10 -35 -17 -41 -18 -60 -5 -25 18 -56 19 -56 3 -1 -7 -11 0 -24 15 -13 16 -31 27 -40 25 -10 -2 -22 7 -29 22 -7 14 -21 25 -32 25 -13 0 -21 8 -23 24 -2 13 -11 25 -21 28 -9 2 -22 18 -28 34 -6 16 -19 29 -27 29 -10 0 -19 12 -23 31 -3 17 -11 33 -18 35 -8 4 -11 20 -8 48 3 25 1 46 -5 50 -21 13 24 88 65 110 46 23 149 30 157 9 3 -7 19 -13 36 -13 23 0 30 -4 30 -19 0 -13 9 -21 30 -26 17 -4 30 -13 30 -21 0 -8 13 -17 30 -21 23 -4 29 -10 25 -23 -4 -13 3 -21 25 -30 18 -7 29 -18 26 -25 -2 -7 4 -21 15 -31 11 -10 17 -24 14 -32 -3 -8 2 -26 11 -40 13 -19 14 -30 5 -49 -13 -29 -15 -93 -2 -93 37 0 74 49 85 112 15 84 -54 261 -153 392 -61 80 -76 106 -61 106 5 0 10 -7 10 -15 0 -27 70 -95 98 -95 20 0 23 3 14 12 -7 7 -12 19 -12 27 0 9 -19 24 -46 35 -81 33 -41 26 71 -13 186 -65 397 -163 568 -265 70 -41 77 -43 82 -25 4 10 10 19 14 19 20 0 92 -30 127 -55 23 -14 46 -23 51 -20 9 5 103 -64 115 -84 4 -6 13 -8 20 -5 7 3 29 -15 50 -41 21 -25 46 -45 55 -45 13 0 29 -18 49 -56 20 -35 37 -53 45 -50 14 5 49 -33 59 -65 5 -13 12 -18 24 -14 14 4 25 -7 44 -50 20 -41 32 -53 44 -50 12 4 22 -8 38 -49 15 -35 29 -52 37 -49 14 5 44 -55 44 -88 0 -12 7 -19 19 -19 15 0 22 -12 32 -49 8 -31 19 -51 29 -54 12 -3 19 -19 23 -51 4 -26 14 -54 22 -62 9 -9 15 -33 15 -59 0 -24 5 -45 11 -47 7 -2 13 -47 15 -123 3 -110 5 -120 22 -123 28 -4 47 78 38 167 -6 65 -36 197 -58 256 -53 142 -165 332 -262 445 -30 36 -87 107 -127 158 -39 51 -79 98 -89 105 -9 7 -46 38 -81 71 -35 32 -82 70 -104 84 -22 14 -65 42 -95 62 -31 19 -84 44 -118 54 -34 11 -62 23 -62 27 0 16 -313 157 -433 195 -31 10 -56 19 -54 20 1 2 34 8 72 14 39 6 82 15 96 21 17 7 34 7 54 -1 34 -13 46 -5 20 14 -18 13 -15 17 44 55 35 22 68 41 72 41 5 0 25 -18 45 -40 50 -54 71 -54 44 0 -11 21 -20 44 -20 50 0 13 57 13 65 0 4 -6 11 -8 16 -4 28 17 -65 74 -118 74 -36 -1 -147 -48 -204 -87 -33 -22 -61 -32 -109 -37 -36 -4 -96 -14 -134 -23 -112 -25 -207 -3 -370 85 -66 35 -70 40 -91 97 -12 33 -34 84 -49 112 -14 29 -22 54 -18 56 15 10 202 58 297 76 238 46 492 71 736 71 l166 0 -4 24 c-5 23 -2 24 65 31 39 4 84 4 101 0 21 -4 31 -3 31 5 0 13 84 5 127 -11 13 -5 23 -4 25 2 2 7 26 3 63 -9 35 -12 64 -17 70 -12 11 9 74 -16 110 -43 14 -11 23 -12 36 -4 13 8 26 5 54 -12 27 -15 41 -19 50 -11 14 11 55 -11 84 -46 10 -12 16 -13 26 -4 11 9 24 3 59 -25 25 -21 49 -35 54 -32 5 4 27 -10 48 -31 21 -20 45 -36 55 -34 9 1 28 -14 43 -34 15 -19 33 -35 40 -35 7 0 25 -17 41 -37 15 -21 40 -50 54 -65 48 -50 57 -63 64 -85 4 -13 11 -23 15 -23 4 0 14 -18 21 -40 16 -50 50 -57 50 -11 0 41 -21 86 -78 166 -127 179 -368 350 -637 450 -55 20 -123 48 -152 62 -59 27 -149 53 -273 78 -98 20 -339 18 -377 -2 -15 -9 -23 -10 -23 -4 0 15 -73 14 -236 -4 -275 -29 -572 -89 -864 -175 -154 -46 -141 -46 -175 1 -16 23 -70 80 -120 127 -49 47 -81 80 -69 74 11 -6 69 -61 127 -122 89 -92 111 -110 128 -105 20 7 19 9 -17 47 -38 39 -158 138 -204 168 -12 8 -37 26 -54 40 -28 22 -29 22 -12 2 11 -12 15 -22 9 -22 -16 0 -44 36 -36 45 5 4 3 5 -4 1 -6 -3 -49 18 -95 48 -104 67 -139 85 -258 129 -121 45 -237 67 -355 67 -101 0 -225 -26 -282 -60 -39 -23 -32 -25 -134 52 -54 41 -85 58 -106 58 -36 0 -88 -33 -163 -104 -30 -28 -69 -64 -86 -79 l-30 -27 -85 32 c-81 32 -89 33 -229 32 -128 -1 -156 -4 -235 -28 -109 -33 -232 -90 -311 -143 -132 -90 -245 -245 -260 -357 l-7 -46 -73 0 c-40 0 -79 -3 -87 -6 -11 -4 -19 6 -27 33 -31 95 -168 421 -230 548 -74 152 -124 226 -170 250 -39 20 -39 20 -92 -17z m-23 -333 c24 -67 192 -414 238 -492 l36 -63 -78 -77 c-67 -66 -86 -94 -129 -183 -60 -123 -91 -228 -100 -342 l-7 -81 -42 -12 c-23 -7 -58 -23 -78 -35 -20 -12 -37 -21 -39 -19 -2 2 -18 41 -35 87 -41 109 -126 283 -196 404 l-56 97 84 148 c81 142 283 487 343 585 16 26 31 44 35 40 3 -4 14 -29 24 -57z m2200 -120 c-35 -112 -35 -112 -79 -66 l-38 39 47 59 c26 32 50 64 53 71 4 11 9 9 23 -5 18 -18 18 -20 -6 -98z m-3051 -594 c59 -104 69 -138 39 -127 -148 55 -142 48 -123 136 18 82 20 90 24 90 2 0 29 -45 60 -99z m2492 -499 c-35 -70 -138 -195 -208 -253 -33 -27 -61 -49 -64 -49 -3 0 34 37 81 82 87 83 158 172 191 240 10 21 19 36 21 34 3 -2 -7 -26 -21 -54z"/>
                <path d="M5746 4725 c-16 -9 -35 -14 -42 -11 -8 3 -28 -19 -49 -54 l-36 -59 62 -106 c68 -118 151 -291 193 -401 l27 -72 38 21 c36 20 37 22 25 46 -8 14 -43 87 -78 161 -36 74 -86 173 -111 220 -57 106 -57 149 2 263 6 10 2 9 -31 -8z"/>
                <path d="M8237 5229 c-27 -33 -47 -61 -45 -62 2 -1 17 -15 35 -30 l31 -29 25 83 c37 120 27 128 -46 38z"/>
                <path d="M5243 4563 c4 -3 1 -16 -7 -28 -14 -21 -12 -23 20 -38 19 -9 34 -12 34 -7 0 6 -5 10 -12 10 -6 0 -9 3 -5 6 7 7 -20 64 -30 64 -3 0 -3 -3 0 -7z"/>
                <path d="M6341 5556 c-10 -11 -3 -33 32 -103 60 -118 127 -275 198 -457 l58 -151 38 4 c21 1 39 4 40 5 2 1 -15 47 -36 102 -147 378 -265 614 -309 614 -5 0 -15 -6 -21 -14z"/>
                <path d="M8380 5467 c0 -2 6 -10 14 -16 11 -9 16 -9 22 1 4 7 4 10 -1 6 -4 -4 -14 -3 -22 3 -7 6 -13 9 -13 6z"/>
                <path d="M5438 4849 c44 -55 47 -57 60 -37 13 18 12 23 -20 55 -19 19 -46 36 -60 37 -25 3 -24 1 20 -55z"/>
                <path d="M9829 4888 l-37 -10 38 -81 c21 -45 42 -95 45 -110 5 -20 21 -35 56 -52 58 -30 62 -30 49 -7 -24 43 -69 154 -81 201 -7 29 -18 55 -24 60 -5 4 -26 4 -46 -1z"/>
                <path d="M8147 4661 c-26 -37 -83 -105 -126 -152 l-79 -84 106 -205 c58 -113 110 -208 115 -211 5 -3 8 -9 8 -13 -3 -20 0 -26 11 -20 8 5 9 2 5 -10 -4 -9 -3 -15 2 -12 8 6 42 -41 71 -97 8 -16 26 -41 39 -55 58 -62 28 21 -105 287 -179 356 -178 348 -29 502 l57 59 -14 38 -13 39 -48 -66z"/>
                <path d="M9728 4238 c-30 -12 -48 -27 -48 -37 0 -9 -7 -26 -15 -38 -10 -15 -12 -24 -4 -28 6 -4 9 -24 8 -45 -2 -21 2 -44 8 -52 6 -7 14 -23 17 -35 4 -13 14 -23 22 -23 8 0 19 -12 25 -27 5 -15 19 -33 29 -40 11 -8 20 -20 20 -27 0 -8 11 -17 25 -20 13 -3 29 -15 35 -26 6 -11 18 -20 27 -20 14 0 13 3 -3 18 -11 9 -31 33 -44 52 -13 19 -30 41 -37 48 -25 26 -46 123 -40 191 5 71 24 124 40 114 6 -3 7 -1 3 5 -9 16 -13 15 -68 -10z"/>
                <path d="M3143 4091 c-23 -16 -44 -27 -49 -23 -4 4 -4 1 0 -5 4 -8 2 -13 -6 -13 -7 0 -185 -172 -396 -383 -355 -355 -381 -383 -348 -379 31 4 79 48 415 386 348 350 440 446 428 446 -2 0 -22 -13 -44 -29z"/>
                <path d="M7050 4005 c-7 -9 -33 -28 -57 -42 l-43 -25 0 -66 c0 -37 -7 -153 -15 -259 -15 -198 -24 -238 -68 -295 -24 -30 -24 -31 -9 -92 l16 -61 11 45 c15 58 36 96 80 143 19 22 39 55 44 75 9 32 35 279 33 307 -5 72 1 181 12 225 17 59 16 69 -4 45z"/>
                <path d="M5734 3363 c-31 -137 -127 -324 -212 -412 -35 -37 -73 -79 -85 -96 -12 -16 -46 -56 -76 -88 l-55 -58 50 28 c50 28 127 102 244 233 101 114 155 201 196 320 10 30 23 57 27 59 7 3 -66 41 -79 41 -2 0 -6 -12 -10 -27z"/>
                <path d="M5198 2646 c-26 -13 -69 -44 -95 -69 -65 -62 -167 -142 -228 -179 -27 -16 -58 -41 -69 -55 l-19 -25 29 18 c32 20 102 73 121 90 6 6 49 36 95 67 46 31 103 74 128 95 25 22 56 49 70 61 31 25 27 25 -32 -3z"/>
                <path d="M4610 2216 c-41 -24 -75 -47 -77 -52 -2 -5 17 -10 42 -12 39 -2 47 1 54 21 5 13 21 37 36 55 15 18 25 32 23 31 -1 0 -37 -19 -78 -43z"/>
            </g>
        </g>
    `;
}

function buildBeetleSvg(uid) {
    return `
        <g filter="url(#${uid}-shadow)" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="82" cy="68" rx="52" ry="36" fill="url(#${uid}-glow)" opacity="0.34"></ellipse>
            <g transform="translate(29 114.3) scale(0.0085 -0.0085)">
                <path d="M4660 12495 c-548 -69 -1153 -381 -1736 -896 -738 -652 -1364 -1736 -1623 -2810 -82 -337 -113 -588 -114 -909 0 -321 28 -521 128 -923 189 -756 476 -1360 760 -1601 144 -122 255 -168 410 -168 160 -1 300 42 465 143 l82 49 -75 -83 c-41 -46 -93 -109 -117 -141 -29 -38 -48 -55 -59 -51 -137 42 -296 58 -357 34 -16 -5 -44 -27 -64 -49 l-35 -38 -375 -3 -375 -4 -240 38 c-132 20 -255 39 -273 42 -23 4 -32 11 -32 25 0 70 -108 223 -220 313 -206 164 -412 223 -582 166 -160 -54 -210 -135 -225 -368 -8 -127 3 -130 52 -16 48 111 82 155 143 188 146 79 343 43 475 -88 89 -87 94 -159 18 -228 -30 -27 -52 -37 -103 -46 -36 -6 -81 -11 -101 -11 -20 0 -37 -4 -37 -8 0 -5 17 -36 38 -68 50 -77 94 -114 136 -114 44 0 129 26 198 61 l56 28 7 -27 c11 -48 52 -99 97 -120 75 -37 157 -38 600 -7 25 1 50 5 55 7 4 3 152 2 328 -1 l319 -6 8 -42 c10 -61 42 -115 80 -138 28 -17 50 -20 151 -19 102 0 117 -2 115 -15 -3 -13 -23 -17 -100 -22 -91 -5 -178 -30 -178 -50 0 -4 -16 -16 -35 -25 -82 -38 -261 -276 -326 -432 -39 -94 -73 -227 -96 -374 -26 -167 -24 -587 5 -958 12 -157 27 -346 32 -420 18 -225 68 -424 134 -529 l28 -44 -54 -54 c-29 -30 -73 -66 -98 -80 -154 -88 -178 -116 -256 -293 l-41 -94 -70 -22 c-85 -25 -154 -73 -194 -133 -72 -109 -95 -294 -49 -399 43 -100 120 -135 284 -130 l96 3 -40 60 c-48 71 -80 152 -80 200 0 50 35 136 70 172 24 25 40 31 83 35 38 3 87 21 181 66 118 58 134 70 219 155 155 155 318 412 323 506 1 22 11 55 22 73 60 99 76 213 77 548 0 449 -44 712 -195 1160 -79 235 -105 360 -96 468 10 118 41 171 137 233 l47 30 36 -22 c20 -11 68 -26 108 -33 l71 -12 29 -108 c159 -613 468 -1035 823 -1126 132 -34 212 -25 268 28 l27 26 0 -42 c0 -114 59 -258 143 -346 29 -31 50 -56 47 -56 -28 0 -209 73 -342 138 -180 88 -270 123 -398 154 -148 36 -347 23 -496 -33 -88 -33 -134 -104 -134 -208 0 -97 2 -98 85 -40 l73 52 46 -38 46 -38 69 46 68 45 47 -30 48 -29 33 25 c19 15 37 26 41 26 4 0 29 -18 55 -40 35 -29 60 -42 93 -46 38 -6 50 -12 67 -40 24 -39 24 -39 73 -19 l37 16 57 -49 57 -49 45 19 c50 21 49 22 91 -42 16 -24 16 -24 44 -6 32 21 37 17 60 -52 l17 -52 45 40 c25 22 49 40 53 40 4 0 15 -45 25 -100 9 -55 19 -100 21 -100 3 0 37 22 76 50 39 27 74 50 78 50 4 0 10 -36 13 -79 3 -44 15 -106 27 -138 20 -57 95 -195 131 -242 l19 -24 1 74 c1 41 4 85 8 98 6 21 8 22 20 8 8 -11 13 -50 14 -114 2 -89 5 -105 35 -165 38 -78 70 -104 144 -119 53 -10 218 -3 218 9 0 4 -16 30 -36 57 -33 47 -74 118 -74 129 0 3 24 -4 53 -15 75 -30 207 -69 234 -69 36 0 28 -15 -37 -69 -33 -28 -56 -52 -52 -55 17 -10 140 -26 206 -26 107 0 141 15 221 93 38 38 80 73 93 78 l24 9 -3 -77 c-3 -46 0 -80 6 -83 6 -3 35 45 65 107 49 98 63 118 125 173 39 34 87 80 108 103 23 26 40 38 45 31 4 -6 17 -27 30 -47 13 -20 27 -37 30 -37 4 0 20 16 35 35 32 41 44 44 49 13 3 -24 6 -25 84 -13 l41 7 7 -45 7 -46 47 15 c65 19 72 18 72 -13 0 -54 12 -58 76 -29 l59 27 38 -45 38 -45 36 15 c19 8 37 13 39 11 7 -6 -26 -319 -46 -438 -10 -63 -35 -160 -56 -215 -98 -267 -104 -287 -104 -359 0 -38 5 -88 11 -110 6 -22 10 -47 10 -55 -11 -162 -18 -200 -47 -246 -16 -27 -45 -59 -64 -72 -44 -30 -95 -25 -183 17 -34 16 -63 28 -66 26 -8 -8 41 -143 70 -194 24 -41 40 -57 76 -73 116 -51 300 25 377 156 61 104 94 267 63 310 -11 15 -9 22 19 52 41 43 76 117 110 230 26 89 26 90 20 349 -4 220 3 448 16 460 1 2 20 6 41 10 l37 7 1 -53 c1 -30 4 -67 8 -82 l6 -29 40 32 40 32 7 -77 c4 -43 10 -80 13 -83 3 -3 49 37 101 89 l96 94 -6 55 c-4 30 -18 79 -32 107 -26 55 -56 81 -132 118 l-46 22 60 38 c212 137 301 202 474 351 431 368 555 501 782 834 75 110 146 230 159 269 4 10 28 9 119 -5 89 -13 155 -15 290 -11 96 3 185 9 197 12 20 7 21 4 21 -48 -1 -43 6 -66 26 -101 46 -79 141 -146 206 -146 23 0 65 -20 139 -67 148 -93 263 -146 331 -151 34 -3 58 -10 63 -19 5 -8 49 -41 98 -73 70 -46 105 -62 162 -74 113 -24 239 -38 249 -28 5 5 -23 30 -72 62 -118 78 -156 119 -206 225 -24 51 -44 97 -44 102 0 14 144 56 211 61 104 8 258 -55 328 -134 21 -24 63 -89 94 -146 72 -133 73 -134 82 -126 10 9 -21 181 -52 287 -44 153 -144 291 -245 339 -111 52 -361 67 -439 26 -33 -16 -33 -16 -48 7 -8 13 -35 44 -61 69 -51 51 -115 79 -239 106 -79 17 -83 19 -116 65 -20 28 -53 58 -77 71 -56 29 -147 31 -206 4 l-42 -19 -47 44 c-128 119 -242 181 -480 258 -129 42 -146 51 -163 79 -31 50 -75 72 -148 72 -34 0 -79 -7 -99 -15 -19 -8 -37 -15 -39 -15 -2 0 -4 29 -4 65 0 40 -7 84 -19 115 -11 28 -16 50 -13 48 4 -2 40 -20 81 -42 216 -111 531 -125 951 -40 445 89 842 271 1170 535 433 349 798 877 1274 1844 312 634 426 1069 426 1630 0 1026 -413 2211 -1054 3025 -161 204 -405 452 -670 679 -451 387 -844 571 -1218 571 -234 0 -417 -69 -658 -248 -101 -75 -355 -331 -464 -467 -108 -135 -274 -382 -391 -581 -49 -82 -89 -150 -90 -152 -1 -1 -117 7 -256 18 -273 22 -385 41 -699 120 -336 84 -393 94 -525 95 -96 0 -126 -4 -152 -17 l-32 -18 -5 53 c-3 28 -13 176 -22 327 -24 424 -39 562 -67 623 -77 164 -295 263 -652 297 -140 13 -263 11 -395 -5z m3296 -9182 c22 -3 58 2 83 10 24 9 50 13 57 10 21 -8 17 -77 -6 -122 -36 -72 -95 -110 -335 -216 -104 -46 -209 -102 -283 -150 l-117 -77 130 129 c140 139 234 250 321 380 l56 82 27 -20 c15 -11 45 -23 67 -26z m-1272 -920 c39 2 80 8 91 13 11 4 -7 -22 -40 -58 -92 -100 -161 -231 -195 -365 l-10 -42 -48 15 c-26 8 -81 22 -122 30 -109 22 -109 22 -60 47 108 54 215 199 242 327 l11 57 30 -15 c21 -10 49 -13 101 -9z m-759 -215 c40 -45 71 -88 63 -88 -15 1 -126 47 -127 53 -5 27 1 87 8 87 5 0 30 -23 56 -52z" fill="url(#${uid}-body)"></path>
            </g>
        </g>
    `;
}

function buildIceSilkwormSvg(uid) {
    return `
        <g filter="url(#${uid}-shadow)" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="82" cy="68" rx="52" ry="36" fill="url(#${uid}-glow)" opacity="0.34"></ellipse>
            <g transform="translate(28 8) scale(0.21)">
                <path d="M494.187,281.557c-7.927-31.877-34.879-55.44-67.553-59.021l-198.043-21.712c-26.031-2.856-51.347-10.245-74.81-21.854l-16.063-7.941c-45.907-22.71-101.456-9.492-132.215,31.471c-3.508,4.682-5.26,10.311-5.358,16.035H0v41.043c0,5.859,3.889,10.807,9.228,12.398c1.906,0.568,3.929-0.355,4.755-2.164c2.568-5.622,7.05-10.185,12.696-12.834c6.527-3.069,14.029-3.303,20.739-0.666l14.173,5.585l-4.026,10.037c-1.314,3.281-0.454,7.188,2.388,9.58c3.572,2.999,8.885,2.535,11.868-1.021l9.21-10.936l17.356,6.835l-5.324,13.292c-1.314,3.277-0.454,7.184,2.388,9.58c3.574,2.996,8.881,2.531,11.868-1.024l11.628-13.811c5.439,2.11,10.979,3.972,16.563,5.644l-6.95,17.352c-1.313,3.277-0.453,7.177,2.389,9.58c3.57,2.996,8.881,2.535,11.87-1.024l16.904-20.085c10.926,1.986,22.02,3.029,33.158,3.369l3.262,27.971c0.44,3.768,3.413,6.884,7.341,7.341c4.598,0.534,8.754-2.747,9.291-7.341l3.229-27.638l30.139,0.033l3.229,27.605c0.44,3.768,3.414,6.884,7.342,7.341c4.596,0.534,8.754-2.747,9.288-7.341l3.233-27.583l30.168,0.033l3.219,27.55c0.437,3.768,3.409,6.884,7.337,7.341c4.599,0.534,8.754-2.747,9.291-7.341l3.216-27.524l30.187,0.033l3.215,27.491c0.438,3.768,3.409,6.884,7.337,7.341c4.598,0.534,8.752-2.747,9.291-7.341l3.215-27.47l30.95,0.033l2.437,20.779c0.437,3.767,3.409,6.884,7.337,7.337c4.598,0.538,8.754-2.744,9.291-7.337l2.418-20.761l51.72,0.055c4.546,0,8.833-2.085,11.643-5.666C494.282,290.623,495.275,285.964,494.187,281.557z" fill="url(#${uid}-body)"></path>
            </g>
        </g>
    `;
}

function buildSpiritDevourerSvg(uid) {
    return `
        <g filter="url(#${uid}-shadow)" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="82" cy="68" rx="52" ry="36" fill="url(#${uid}-glow)" opacity="0.34"></ellipse>
            <g transform="translate(35 114.5) scale(0.0082 -0.0082)">
                <path d="M4652 12120 c-43 -27 -52 -54 -52 -166 0 -63 -5 -107 -15 -132 -10 -22 -82 -103 -184 -207 -93 -93 -187 -199 -210 -234 -64 -100 -85 -193 -61 -281 92 -347 222 -625 395 -849 30 -39 55 -76 55 -81 0 -6 -15 -31 -34 -57 -54 -77 -96 -169 -123 -272 -21 -80 -26 -119 -26 -236 -1 -158 16 -266 63 -420 41 -133 44 -144 32 -126 -8 11 -15 6 -35 -25 -30 -49 -110 -138 -242 -274 -56 -58 -133 -139 -170 -180 -147 -165 -390 -482 -377 -494 9 -10 -2 -7 -64 17 -121 48 -201 62 -344 61 -209 0 -361 -38 -560 -140 -127 -65 -214 -129 -307 -227 -82 -87 -120 -139 -168 -236 -20 -39 -38 -71 -40 -71 -2 0 -39 -5 -81 -11 -145 -20 -295 -78 -414 -159 -106 -74 -237 -230 -272 -326 -10 -29 -18 -35 -64 -44 -150 -31 -244 -167 -263 -377 -9 -99 -3 -195 29 -433 35 -260 18 -390 -61 -466 -74 -71 -6 -194 109 -194 66 0 100 19 157 86 65 77 101 136 131 218 13 33 23 56 23 50 1 -6 -6 -31 -14 -54 -18 -52 -16 -58 9 -21 10 15 34 38 52 50 70 48 284 296 284 329 0 7 4 12 10 12 5 0 17 15 25 33 9 17 27 52 41 77 16 28 27 62 28 90 1 43 0 45 -30 48 -19 2 -38 -3 -47 -12 -9 -9 -19 -16 -24 -16 -12 0 -104 -79 -211 -183 -58 -55 -76 -68 -83 -56 -6 9 -9 -8 -10 -51 -2 -57 -3 -53 -9 35 -12 166 -11 453 2 524 12 62 16 70 76 128 86 86 249 191 482 313 107 56 218 119 245 141 392 310 699 470 1005 524 73 13 192 20 135 8 -11 -2 -36 -27 -55 -55 -31 -45 -210 -235 -210 -223 0 9 -114 -86 -182 -152 -96 -92 -128 -144 -128 -205 0 -51 8 -70 52 -128 43 -58 62 -130 55 -213 -12 -131 -94 -366 -165 -469 -17 -25 -70 -93 -118 -150 -88 -106 -153 -199 -195 -278 -13 -25 -37 -63 -54 -85 -16 -21 -24 -36 -17 -32 6 5 12 4 12 -1 0 -19 -438 -452 -546 -540 -182 -149 -257 -240 -339 -415 -95 -201 -155 -503 -155 -788 l0 -75 -67 -49 c-186 -136 -400 -332 -639 -584 -169 -178 -174 -185 -174 -226 0 -122 169 -171 255 -75 11 13 116 94 233 181 340 255 492 394 628 577 137 184 242 454 288 737 49 300 59 353 65 362 3 4 45 16 93 26 185 37 354 134 515 295 53 53 89 85 80 71 -10 -14 -15 -28 -12 -31 3 -3 12 -121 20 -264 27 -468 56 -666 141 -986 74 -274 211 -615 326 -808 51 -85 151 -240 155 -240 2 0 1 5 -2 10 -3 6 -4 10 -2 10 3 0 28 -36 57 -80 29 -45 56 -77 60 -73 4 4 20 45 35 90 14 46 29 83 31 83 3 0 3 -10 -1 -22 -3 -13 14 15 40 62 48 89 116 165 157 175 13 3 35 2 48 -3 14 -5 29 -10 33 -10 4 -1 44 -35 89 -77 254 -239 557 -390 873 -435 92 -13 319 -13 425 0 105 13 277 54 389 91 91 31 114 36 66 14 l-30 -14 28 -2 c15 -1 33 -2 40 -3 23 -2 56 -50 68 -99 7 -30 9 -79 5 -130 -5 -59 -4 -78 4 -67 12 17 12 15 -15 -100 -8 -36 -15 -71 -15 -78 0 -9 44 9 118 47 106 56 120 61 65 23 -10 -6 50 21 133 62 322 159 559 317 994 665 135 108 270 215 301 238 75 57 165 103 200 103 25 0 29 4 29 27 0 54 10 13 25 -102 25 -189 87 -346 180 -452 l45 -52 -55 -62 c-302 -339 -484 -772 -502 -1194 -7 -167 7 -300 47 -463 20 -79 33 -165 40 -264 12 -173 35 -258 82 -311 63 -70 150 -54 197 37 26 50 27 77 17 291 -3 66 -11 230 -17 365 -5 135 -17 316 -25 403 l-15 159 103 107 c225 233 370 501 422 780 21 108 20 275 0 387 -13 68 -17 156 -18 369 -1 311 15 863 24 800 l5 -40 7 35 c6 37 62 168 247 583 193 434 208 452 391 468 115 9 125 16 150 92 l17 52 -41 38 -41 39 41 -31 c42 -31 83 -73 55 -56 -9 5 -12 4 -7 -3 4 -6 13 -9 20 -6 13 5 105 -92 197 -206 48 -59 142 -201 212 -320 35 -61 91 -133 152 -200 155 -166 221 -268 246 -378 12 -49 11 -53 -14 -89 -15 -21 -76 -95 -135 -164 -165 -192 -223 -287 -240 -392 -17 -106 26 -254 85 -293 55 -36 151 -13 192 45 22 31 29 109 11 127 -20 20 53 109 230 284 205 202 239 254 248 380 5 77 2 86 -73 175 -61 72 -67 89 -69 184 -1 73 -5 95 -30 146 -36 73 -112 150 -261 265 l-110 85 -6 95 c-4 52 -14 118 -24 145 -104 301 -385 531 -770 630 -49 13 -77 24 -62 24 16 1 26 4 23 9 -2 4 -12 43 -22 87 -14 68 -17 144 -19 490 -3 410 -7 477 -51 850 -22 185 -16 314 16 358 l23 31 -39 -23 -39 -23 30 24 c238 185 365 330 460 523 73 148 88 212 89 362 l1 122 90 31 c276 95 554 276 782 509 73 75 83 90 99 147 23 85 15 178 -30 359 -49 196 -60 271 -47 338 14 75 32 116 72 162 27 31 34 47 34 81 0 52 -39 98 -95 115 -33 10 -43 8 -94 -17 -101 -49 -177 -152 -213 -287 -22 -81 -22 -294 0 -392 27 -123 41 -275 28 -322 -16 -58 -60 -93 -116 -93 -23 0 -81 -11 -127 -24 -316 -92 -595 -325 -725 -606 -65 -139 -137 -281 -146 -287 -5 -3 6 24 23 59 22 45 25 55 10 35 -31 -39 -118 -94 -163 -102 -20 -4 -57 -4 -81 -1 -65 10 -147 93 -208 211 -64 124 -134 283 -174 391 -29 82 -33 102 -31 184 2 78 5 94 21 106 19 13 18 14 -15 15 -25 0 -17 4 34 15 183 40 301 145 323 290 8 56 -10 146 -46 222 -34 72 -35 76 -18 66 7 -4 8 -3 4 5 -4 6 -11 9 -16 6 -4 -3 -16 8 -26 23 -10 15 -38 50 -63 78 -25 28 -15 19 22 -20 68 -70 69 -70 52 -31 -59 145 -228 317 -391 399 -140 70 -186 77 -514 86 -323 9 -367 16 -520 80 -41 18 -88 37 -105 43 -16 7 -32 15 -35 18 -12 16 -225 111 -308 138 -172 57 -365 77 -474 51 -85 -21 -152 -40 -123 -35 17 3 75 7 130 9 l100 5 -96 -8 c-192 -17 -350 -89 -410 -189 -13 -20 -46 -63 -75 -94 -135 -147 -148 -297 -41 -445 23 -32 43 -68 45 -79 4 -33 -35 -140 -75 -203 -47 -73 -152 -181 -222 -229 -31 -20 -59 -41 -62 -45 -3 -5 -10 -8 -15 -7 -5 1 -28 -4 -51 -11 -54 -15 -128 -8 -179 17 -34 16 -40 25 -44 59 -5 34 -8 25 -17 -55 l-11 -95 4 120 c2 66 11 253 20 416 15 277 15 302 -1 380 -41 205 -161 416 -366 642 -70 77 -71 78 -58 110 21 53 91 157 171 253 133 160 187 234 225 311 31 63 37 87 41 157 9 168 -64 316 -154 316 -21 0 -54 -9 -72 -20z m1491 -1317 c-7 -2 -19 -2 -25 0 -7 3 -2 5 12 5 14 0 19 -2 13 -5z m1370 -340 c-7 -2 -19 -2 -25 0 -7 3 -2 5 12 5 14 0 19 -2 13 -5z m120 0 c-7 -2 -21 -2 -30 0 -10 3 -4 5 12 5 17 0 24 -2 18 -5z m84 -9 c-3 -3 -12 -4 -19 -1 -8 3 -5 6 6 6 11 1 17 -2 13 -5z m334 -141 c13 -16 12 -17 -3 -4 -17 13 -22 21 -14 21 2 0 10 -8 17 -17z m49 -38 c13 -14 21 -25 18 -25 -2 0 -15 11 -28 25 -13 14 -21 25 -18 25 2 0 15 -11 28 -25z m-2544 -277 l19 -21 -27 18 c-29 18 -34 25 -20 25 5 0 17 -10 28 -22z m-106 -245 c-55 -45 -131 -121 -189 -188 l-43 -50 45 60 c56 75 205 216 227 215 3 0 -15 -17 -40 -37z m2750 -1018 c0 -5 -5 -3 -10 5 -5 8 -10 20 -10 25 0 6 5 3 10 -5 5 -8 10 -19 10 -25z m-6703 -2807 c-2 -13 -4 -5 -4 17 -1 22 1 32 4 23 2 -10 2 -28 0 -40z m1043 -58 c-51 -55 -95 -100 -98 -100 -3 0 14 21 38 48 106 112 145 152 148 152 2 0 -37 -45 -88 -100z m-1053 -12 c-3 -7 -5 -2 -5 12 0 14 2 19 5 13 2 -7 2 -19 0 -25z m2283 -2680 c0 -15 -18 0 -41 35 l-22 32 31 -29 c18 -17 32 -34 32 -38z m-480 -198 c6 -11 8 -20 6 -20 -3 0 -10 9 -16 20 -6 11 -8 20 -6 20 3 0 10 -9 16 -20z"/>
                <path d="M1144 4081 c-17 -10 -42 -34 -55 -53 -13 -18 -27 -34 -31 -36 -4 -2 -8 -10 -8 -17 0 -7 -7 -26 -15 -41 -8 -16 -15 -43 -15 -61 0 -26 3 -30 20 -26 22 6 80 58 80 72 0 5 6 16 14 23 25 25 56 96 56 128 0 35 -5 36 -46 11z"/>
                <path d="M7561 1774 c0 -11 3 -14 6 -6 3 7 2 16 -1 19 -3 4 -6 -2 -5 -13z"/>
                <path d="M7571 1694 c0 -11 3 -14 6 -6 3 7 2 16 -1 19 -3 4 -6 -2 -5 -13z"/>
            </g>
        </g>
    `;
}

function buildWormSvg(uid) {
    return `
        <g filter="url(#${uid}-shadow)" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="82" cy="68" rx="52" ry="36" fill="url(#${uid}-glow)" opacity="0.34"></ellipse>
            <g transform="translate(24.5 4.5) scale(0.24)">
                <path d="M295,207.5c0-8.481-4.517-15.927-11.271-20.059c2.075-3.502,3.271-7.583,3.271-11.941v-16c0-8.481-4.517-15.927-11.271-20.059c2.075-3.502,3.271-7.583,3.271-11.941v-16c0-8.479-4.514-15.925-11.266-20.058C269.809,87.941,271,83.858,271,79.5v-8c0-7.023-3.101-13.332-8-17.642V47.5c0-8.056-3.043-15.412-8.036-20.988c-0.196-5.979-1.377-18.392-7.579-24.399c-2.976-2.882-7.724-2.808-10.606,0.167c-2.882,2.976-2.808,7.723,0.167,10.604c0.544,0.551,1.122,1.978,1.629,3.926C236.299,16.287,233.933,16,231.5,16c-2.433,0-4.799,0.287-7.075,0.811c0.488-1.905,1.056-3.345,1.627-3.924c2.975-2.882,3.051-7.63,0.168-10.605c-2.88-2.974-7.629-3.051-10.605-0.168c-6.202,6.007-7.383,18.42-7.579,24.399C203.043,32.088,200,39.445,200,47.5v6.358c-4.899,4.31-8,10.619-8,17.642v8c0,4.357,1.191,8.44,3.266,11.942C188.514,95.576,184,103.021,184,111.5v16c0,4.357,1.196,8.439,3.271,11.941C180.517,143.574,176,151.019,176,159.5v16c0,4.357,1.196,8.439,3.271,11.941C172.517,191.574,168,199.019,168,207.5v16c0,6.177,2.399,11.801,6.31,16c-3.911,4.199-6.31,9.823-6.31,16v16c0,8.481,4.517,15.927,11.271,20.059c-2.075,3.502-3.271,7.583-3.271,11.941v16c0,6.177,2.399,11.801,6.31,16c-3.911,4.199-6.31,9.823-6.31,16v16c0,8.481,4.517,15.927,11.271,20.059c-2.075,3.502-3.271,7.583-3.271,11.941v8c0,8.479,4.514,15.925,11.266,20.058C193.192,431.06,192,435.143,192,439.5c0,12.958,10.542,23.5,23.5,23.5h32c12.958,0,23.5-10.542,23.5-23.5c0-4.357-1.191-8.44-3.266-11.942C274.486,423.425,279,415.98,279,407.5v-8c0-4.357-1.196-8.439-3.271-11.941C282.483,383.427,287,375.982,287,367.5v-16c0-6.177-2.399-11.801-6.31-16c3.911-4.199,6.31-9.823,6.31-16v-16c0-4.357-1.196-8.439-3.271-11.941C290.483,287.427,295,279.982,295,271.5v-16c0-6.177-2.399-11.801-6.31-16c3.911-4.199,6.31-9.823,6.31-16V207.5z M215,47.5c0-9.098,7.402-16.5,16.5-16.5S248,38.403,248,47.5v0.513C247.833,48.01,247.668,48,247.5,48h-32c-0.168,0-0.333,0.009-0.5,0.013V47.5z M264,407.5c0,4.687-3.813,8.5-8.5,8.5h-8c-4.142,0-7.5,3.357-7.5,7.5s3.358,7.5,7.5,7.5c4.687,0,8.5,3.813,8.5,8.5s-3.813,8.5-8.5,8.5h-32c-4.687,0-8.5-3.813-8.5-8.5s3.813-8.5,8.5-8.5c4.142,0,7.5-3.357,7.5-7.5s-3.358-7.5-7.5-7.5h-8c-4.687,0-8.5-3.813-8.5-8.5v-8c0-4.687,3.813-8.5,8.5-8.5h8c4.142,0,7.5-3.357,7.5-7.5s-3.358-7.5-7.5-7.5h-16c-4.687,0-8.5-3.813-8.5-8.5v-16c0-4.687,3.813-8.5,8.5-8.5h16c4.142,0,7.5-3.357,7.5-7.5s-3.358-7.5-7.5-7.5h-16c-4.687,0-8.5-3.813-8.5-8.5v-16c0-4.687,3.813-8.5,8.5-8.5h16c4.142,0,7.5-3.357,7.5-7.5s-3.358-7.5-7.5-7.5h-24c-4.687,0-8.5-3.813-8.5-8.5v-16c0-4.687,3.813-8.5,8.5-8.5h24c4.142,0,7.5-3.357,7.5-7.5s-3.358-7.5-7.5-7.5h-24c-4.687,0-8.5-3.813-8.5-8.5v-16c0-4.687,3.813-8.5,8.5-8.5h24c4.142,0,7.5-3.357,7.5-7.5s-3.358-7.5-7.5-7.5h-16c-4.687,0-8.5-3.813-8.5-8.5v-16c0-4.687,3.813-8.5,8.5-8.5h16c4.142,0,7.5-3.357,7.5-7.5s-3.358-7.5-7.5-7.5h-8c-4.687,0-8.5-3.813-8.5-8.5v-16c0-4.687,3.813-8.5,8.5-8.5h8c4.142,0,7.5-3.357,7.5-7.5s-3.358-7.5-7.5-7.5c-4.687,0-8.5-3.813-8.5-8.5v-8c0-4.687,3.813-8.5,8.5-8.5h32c4.687,0,8.5,3.813,8.5,8.5v8c0,4.687-3.813,8.5-8.5,8.5c-4.142,0-7.5,3.357-7.5,7.5s3.358,7.5,7.5,7.5h8c4.687,0,8.5,3.813,8.5,8.5v16c0,4.687-3.813,8.5-8.5,8.5h-8c-4.142,0-7.5,3.357-7.5,7.5s3.358,7.5,7.5,7.5h16c4.687,0,8.5,3.813,8.5,8.5v16c0,4.687-3.813,8.5-8.5,8.5h-16c-4.142,0-7.5,3.357-7.5,7.5s3.358,7.5,7.5,7.5h24c4.687,0,8.5,3.813,8.5,8.5v16c0,4.687-3.813,8.5-8.5,8.5h-24c-4.142,0-7.5,3.357-7.5,7.5s3.358,7.5,7.5,7.5h24c4.687,0,8.5,3.813,8.5,8.5v16c0,4.687-3.813,8.5-8.5,8.5h-24c-4.142,0-7.5,3.357-7.5,7.5s3.358,7.5,7.5,7.5h16c4.687,0,8.5,3.813,8.5,8.5v16c0,4.687-3.813,8.5-8.5,8.5h-16c-4.142,0-7.5,3.357-7.5,7.5s3.358,7.5,7.5,7.5h16c4.687,0,8.5,3.813,8.5,8.5v16c0,4.687-3.813,8.5-8.5,8.5h-16c-4.142,0-7.5,3.357-7.5,7.5s3.358,7.5,7.5,7.5h8c4.687,0,8.5,3.813,8.5,8.5V407.5z" fill="url(#${uid}-body)"></path>
            </g>
        </g>
    `;
}

function buildEggShellSvg(uid, content) {
    return `
        <g filter="url(#${uid}-shadow)">
            <ellipse cx="80" cy="64" rx="34" ry="42" fill="url(#${uid}-shell)"></ellipse>
            <ellipse cx="70" cy="46" rx="12" ry="18" fill="#ffffff" opacity="0.18"></ellipse>
            <ellipse cx="80" cy="64" rx="34" ry="42" fill="none" stroke="url(#${uid}-accent)" stroke-opacity="0.56" stroke-width="2"></ellipse>
            <g transform="translate(26 18) scale(0.68)" opacity="0.34">
                ${content}
            </g>
        </g>
    `;
}

function buildInsectArtMarkup(speciesKey, { egg = false } = {}) {
    const species = Input.getInsectSpecies(speciesKey) || {};
    const slug = getInsectVisualSlug(speciesKey);
    const family = getInsectSvgFamily(speciesKey);
    const classes = ['insect-art', 'insect-art--svg', `insect-art--${slug}`];
    if (egg) classes.push('is-egg');

    const uid = `insect-svg-${++insectSvgUid}`;
    const palette = {
        primary: egg ? (species.eggColor || species.color || '#79ffd4') : (species.color || '#79ffd4'),
        secondary: species.secondaryColor || species.color || '#79ffd4',
        aura: species.auraColor || species.secondaryColor || species.color || '#79ffd4'
    };

    let glyph = '';

    switch (family) {
        case 'butterfly':
            glyph = buildButterflySvg(uid);
            break;
        case 'spider':
            glyph = buildSpiderSvg(uid);
            break;
        case 'scorpion':
            glyph = buildScorpionSvg(uid, {
                winged: speciesKey === 'PHI_THIEN_TU_VAN_HAT',
                armored: speciesKey === 'KIM_GIAP_HAT'
            });
            break;
        case 'ant':
            glyph = buildAntSvg(uid);
            break;
        case 'beetle':
            glyph = buildBeetleSvg(uid);
            break;
        case 'worm':
            glyph = speciesKey === 'BANG_TAM' || speciesKey === 'KIM_TAM'
                ? buildIceSilkwormSvg(uid)
                : speciesKey === 'THON_LINH_TRUNG'
                    ? buildSpiritDevourerSvg(uid)
                    : buildWormSvg(uid);
            break;
        default:
            glyph = buildWormSvg(uid);
            break;
    }

    const body = egg ? buildEggShellSvg(uid, glyph) : glyph;

    return `
        <svg class="${classes.join(' ')}" viewBox="0 0 160 120" aria-hidden="true" focusable="false">
            ${buildInsectSvgDefs(uid, palette, egg)}
            ${body}
        </svg>
    `;
}

function getInsectStyleLabel(species) {
    return species?.styleLabel || species?.styleHint || '';
}

function getInsectStyleHint(species) {
    return species?.styleHint || species?.description || '';
}

function buildInsectEggCardMarkup(speciesKey, count) {
    const species = Input.getInsectSpecies(speciesKey);
    if (!species) return '';
    const tier = Input.getInsectTierInfo(species.tier);
    const styleLabel = getInsectStyleLabel(species);
    const styleHint = getInsectStyleHint(species);
    const hatchPreview = Input.getHatchPreview(speciesKey, 1);
    const requirementText = hatchPreview.requirements.length
        ? hatchPreview.requirements.map(requirement => {
            const materialConfig = Input.getMaterialConfig(requirement.materialKey);
            return `${materialConfig?.fullName || requirement.materialKey} ${formatNumber(requirement.owned)}/${formatNumber(requirement.count)}`;
        }).join(' • ')
        : 'Không cần nguyên liệu';

    return `
        <article class="inventory-slot beast-slot egg-slot" style="--slot-accent:${species.eggColor || species.color};${buildInsectVisualVars(species, { egg: true })}">
            <div class="slot-badge">${escapeHtml(tier.label)}</div>
            <div class="beast-card-visual beast-card-visual--egg" style="${buildInsectVisualVars(species, { egg: true })}">
                ${buildInsectArtMarkup(speciesKey, { egg: true })}
            </div>
            <h4>Trứng ${escapeHtml(species.name)}</h4>
            ${styleLabel ? `<div class="beast-slot__style">${escapeHtml(styleLabel)}</div>` : ''}
            <p>${escapeHtml(styleHint)}</p>
            <div class="beast-slot__stats">
                <span>${escapeHtml(requirementText)}</span>
                <span>${escapeHtml(hatchPreview.hasHabitat ? `Đã có ${hatchPreview.habitatName}` : `Cần ${hatchPreview.habitatName} để ấp nở`)}</span>
            </div>
            <div class="slot-count">${formatNumber(count)}</div>
            <div class="slot-actions">
                <button class="btn-slot-action" data-beast-action="hatch" data-species-key="${escapeHtml(speciesKey)}">Ấp nở</button>
            </div>
        </article>
    `;
}

function buildTamedInsectCardMarkup(speciesKey, count) {
    const species = Input.getInsectSpecies(speciesKey);
    if (!species) return '';
    const tier = Input.getInsectTierInfo(species.tier);
    const attackPct = Math.round((species.attackFactor || 1) * 100);
    const styleLabel = getInsectStyleLabel(species);
    const styleHint = getInsectStyleHint(species);
    const careStatus = Input.getSpeciesCareStatus(speciesKey);
    const foodStatusText = careStatus.hasFood
        ? `Thức ăn đủ (${formatNumber(careStatus.availableFood)})`
        : `Thiếu thức ăn (${formatNumber(careStatus.availableFood)}/${formatNumber(careStatus.foodDemand)})`;

    return `
        <article class="inventory-slot beast-slot" style="--slot-accent:${species.color};${buildInsectVisualVars(species)}">
            <div class="slot-badge">${escapeHtml(tier.label)}</div>
            <div class="beast-card-visual" style="${buildInsectVisualVars(species)}">
                ${buildInsectArtMarkup(speciesKey)}
            </div>
            <h4>${escapeHtml(species.name)}</h4>
            ${styleLabel ? `<div class="beast-slot__style">${escapeHtml(styleLabel)}</div>` : ''}
            <p>${escapeHtml(styleHint)}</p>
            <div class="beast-slot__stats">
                <span>Công sát ${attackPct}%</span>
                <span>Đàn trùng ${formatNumber(count)}</span>
            </div>
            <div class="slot-count">${formatNumber(count)}</div>
            <div class="beast-slot__stats">
                <span>${escapeHtml(careStatus.hasHabitat ? 'Đúng Linh thú đại' : 'Sai Linh thú đại')}</span>
                <span>${escapeHtml(foodStatusText)}</span>
                <span>${escapeHtml(careStatus.canReproduce ? 'Có thể ấp nở' : 'Chưa thể ấp nở')}</span>
            </div>
        </article>
    `;
}

function openPopup(overlay) {
    if (!overlay) return;
    overlay.style.display = 'flex';
    syncPopupCursorState();
    setTimeout(() => {
        overlay.classList.add('show');
        syncPopupCursorState();
    }, 10);
}

function closePopup(overlay) {
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => {
        if (!overlay.classList.contains('show')) {
            overlay.style.display = 'none';
            syncPopupCursorState();
        }
    }, 300);
    syncPopupCursorState();
}

ShopUI = {
    overlay: document.getElementById('shop-popup'),
    btnOpen: document.getElementById('btn-shop'),
    btnClose: document.getElementById('close-shop'),
    list: document.getElementById('shop-items'),
    wallet: document.getElementById('shop-wallet'),
    toolbar: document.getElementById('shop-toolbar'),
    pagination: document.getElementById('shop-pagination'),
    searchQuery: '',
    categoryFilter: 'DAN_DUOC',
    qualityFilter: 'ALL',
    currentPage: 1,
    lastPageSize: 0,

    init() {
        if (!this.overlay || !this.btnOpen) return;

        const content = this.overlay.querySelector('.popup-content');
        if (content) {
            content.addEventListener('pointerdown', (e) => e.stopPropagation());
        }

        this.btnOpen.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.open();
        });

        if (this.btnClose) {
            this.btnClose.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        if (this.list) {
            this.list.addEventListener('pointerdown', (e) => {
                const actionBtn = e.target.closest('[data-shop-id]');
                if (!actionBtn) return;

                e.stopPropagation();
                Input.buyShopItem(actionBtn.getAttribute('data-shop-id'));
            });
        }

        this.overlay.addEventListener('input', (e) => {
            if (e.target.id !== 'shop-search') return;

            e.stopPropagation();
            this.searchQuery = e.target.value || '';
            this.currentPage = 1;
            this.render();
        });

        this.overlay.addEventListener('change', (e) => {
            if (e.target.id === 'shop-filter-quality') {
                this.qualityFilter = e.target.value || 'ALL';
                this.currentPage = 1;
                this.render();
            }
        });

        if (this.pagination) {
            this.pagination.addEventListener('pointerdown', (e) => {
                const pageBtn = e.target.closest('[data-shop-page-target]');
                if (!pageBtn) return;

                e.stopPropagation();
                const targetPage = parseInt(pageBtn.getAttribute('data-shop-page-target'), 10);
                if (!Number.isNaN(targetPage)) {
                    this.currentPage = targetPage;
                    this.render();
                }
            });
        }

        if (this.toolbar) {
            this.toolbar.addEventListener('pointerdown', (e) => {
                const tabBtn = e.target.closest('[data-shop-tab]');
                if (tabBtn) {
                    e.stopPropagation();
                    const nextTab = tabBtn.getAttribute('data-shop-tab') || 'DAN_DUOC';
                    if (this.categoryFilter !== nextTab) {
                        this.categoryFilter = nextTab;
                        this.currentPage = 1;
                        this.render();
                    }
                    return;
                }

                const resetBtn = e.target.closest('[data-shop-action="reset-filters"]');
                if (!resetBtn) return;

                e.stopPropagation();
                this.searchQuery = '';
                this.categoryFilter = 'DAN_DUOC';
                this.qualityFilter = 'ALL';
                this.currentPage = 1;
                this.render();
            });
        }

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });

        window.addEventListener('resize', () => {
            if (!this.overlay.classList.contains('show')) return;

            const nextPageSize = this.getPageSize();
            if (nextPageSize !== this.lastPageSize) {
                this.render();
            }
        });
    },

    getPageSize() {
        return window.innerWidth <= 720 ? 4 : 8;
    },

    getCategoryOptions() {
        return ['ALL', 'SWORD_ART', 'FLAME_ART', 'INSECT_SKILL', 'INSECT_ARTIFACT', 'SPIRIT_BAG', 'SPIRIT_HABITAT', 'INSECT_EGG', 'MATERIAL', 'EXP', 'INSIGHT', 'ATTACK', 'SHIELD_BREAK', 'BERSERK', 'RAGE', 'MANA', 'MAX_MANA', 'REGEN', 'SPEED', 'FORTUNE', 'BREAKTHROUGH', 'BAG', 'SPECIAL'];
    },

    ensureToolbar() {
        if (!this.toolbar || this.toolbar.dataset.ready === 'true') return;

        const categoryOptions = this.getCategoryOptions().map(category => {
            const label = category === 'ALL' ? 'Tất cả loại' : Input.getItemCategoryLabel({ category });
            return `<option value="${category}">${escapeHtml(label)}</option>`;
        }).join('');

        const qualityOptions = ['ALL', ...QUALITY_ORDER].map(quality => {
            const label = quality === 'ALL' ? 'Tất cả phẩm chất' : getQualityLabel(quality);
            return `<option value="${quality}">${escapeHtml(label)}</option>`;
        }).join('');

        this.toolbar.innerHTML = `
            <div class="shop-tip" id="shop-tip"></div>
            <div class="shop-toolbar-row">
                <label class="shop-field shop-field-search">
                    <span>Tìm kiếm</span>
                    <input id="shop-search" class="shop-control-input" type="search" placeholder="Tên đan, túi, công dụng, phẩm chất...">
                </label>
                <div class="shop-filter-group">
                    <label class="shop-field">
                        <span>Loại</span>
                        <select id="shop-filter-category" class="shop-control-input">${categoryOptions}</select>
                    </label>
                    <label class="shop-field">
                        <span>Phẩm chất</span>
                        <select id="shop-filter-quality" class="shop-control-input">${qualityOptions}</select>
                    </label>
                </div>
            </div>
            <div class="shop-toolbar-meta">
                <div id="shop-summary" class="shop-summary"></div>
                <button type="button" class="btn-shop-reset" data-shop-action="reset-filters">Xóa lọc</button>
            </div>
        `;

        this.toolbar.dataset.ready = 'true';
    },

    syncToolbar(totalCount, filteredCount) {
        if (!this.toolbar) return;

        const nextRealm = Input.getNextMajorRealmInfo();
        const tip = nextRealm
            ? `Đang bày bán đủ loại đan tu vi, cường hóa, vận khí và cả ${escapeHtml(nextRealm.name)} đan cho lần đột phá kế tiếp.`
            : 'Đã ở cảnh giới tối cao, cửa hàng vẫn còn nhiều đan cường hóa và hai viên cấm kị đặc biệt.';

        const tipEl = this.toolbar.querySelector('#shop-tip');
        const searchEl = this.toolbar.querySelector('#shop-search');
        const categoryEl = this.toolbar.querySelector('#shop-filter-category');
        const qualityEl = this.toolbar.querySelector('#shop-filter-quality');
        const summaryEl = this.toolbar.querySelector('#shop-summary');
        const resetBtn = this.toolbar.querySelector('[data-shop-action="reset-filters"]');

        if (tipEl) tipEl.innerHTML = tip;
        if (searchEl && searchEl.value !== this.searchQuery) searchEl.value = this.searchQuery;
        if (categoryEl && categoryEl.value !== this.categoryFilter) categoryEl.value = this.categoryFilter;
        if (qualityEl && qualityEl.value !== this.qualityFilter) qualityEl.value = this.qualityFilter;
        if (summaryEl) {
            summaryEl.innerHTML = `Hiển thị <strong>${formatNumber(filteredCount)}</strong> / ${formatNumber(totalCount)} vật phẩm`;
        }
        if (resetBtn) {
            resetBtn.disabled = !this.searchQuery && this.categoryFilter === 'ALL' && this.qualityFilter === 'ALL';
        }
    },

    filterItems(items) {
        const query = normalizeSearchText(this.searchQuery);

        return items.filter(item => {
            if (this.categoryFilter !== 'ALL' && item.category !== this.categoryFilter) {
                return false;
            }

            if (this.qualityFilter !== 'ALL' && item.quality !== this.qualityFilter) {
                return false;
            }

            if (!query) return true;

            const haystack = normalizeSearchText([
                Input.getItemDisplayName(item),
                Input.getItemDescription(item),
                Input.getItemCategoryLabel(item),
                getQualityLabel(item.quality),
                item.realmName || ''
            ].join(' '));

            return haystack.includes(query);
        });
    },

    buildPaginationTargets(totalPages) {
        const pages = [];

        for (let page = 1; page <= totalPages; page++) {
            const isEdge = page === 1 || page === totalPages;
            const isNearCurrent = Math.abs(page - this.currentPage) <= 1;
            if (totalPages <= 5 || isEdge || isNearCurrent) {
                pages.push(page);
            }
        }

        return pages.filter((page, index) => pages.indexOf(page) === index)
            .sort((a, b) => a - b);
    },

    renderPagination(totalItems, totalPages) {
        if (!this.pagination) return;

        if (!totalItems) {
            this.pagination.innerHTML = '';
            return;
        }

        const pages = this.buildPaginationTargets(totalPages);
        const pageButtons = [];

        pages.forEach((page, index) => {
            const prevPage = pages[index - 1];
            if (index > 0 && page - prevPage > 1) {
                pageButtons.push('<span class="shop-page-gap">...</span>');
            }

            pageButtons.push(`
                <button
                    type="button"
                    class="btn-shop-page ${page === this.currentPage ? 'is-active' : ''}"
                    data-shop-page-target="${page}"
                    ${page === this.currentPage ? 'disabled' : ''}
                >${page}</button>
            `);
        });

        this.pagination.innerHTML = `
            <button
                type="button"
                class="btn-shop-page btn-shop-page-nav"
                data-shop-page-target="${Math.max(1, this.currentPage - 1)}"
                ${this.currentPage === 1 ? 'disabled' : ''}
            >Trước</button>
            <div class="shop-page-list">${pageButtons.join('')}</div>
            <div class="shop-page-status">Trang ${this.currentPage}/${totalPages}</div>
            <button
                type="button"
                class="btn-shop-page btn-shop-page-nav"
                data-shop-page-target="${Math.min(totalPages, this.currentPage + 1)}"
                ${this.currentPage === totalPages ? 'disabled' : ''}
            >Sau</button>
        `;
    },

    renderItems(items) {
        if (!this.list) return;

        if (!items.length) {
            this.list.innerHTML = '<div class="shop-empty">Không tìm thấy vật phẩm phù hợp với bộ lọc hiện tại.</div>';
            return;
        }

        const cards = items.map(item => {
            const qualityConfig = Input.getItemQualityConfig(item);
            const isOwnedUnique = Boolean(item.isOneTime && item.uniqueKey && Input.hasUniquePurchase(item.uniqueKey));
            const isOwnedHabitat = item.category === 'SPIRIT_HABITAT' && Input.hasInsectHabitat(item.speciesKey);
            const canStoreOrUpgrade = item.category === 'BAG'
                ? Input.canUpgradeInventoryCapacity(item)
                : item.category === 'SPIRIT_BAG'
                    ? Input.canUpgradeBeastBagCapacity(item)
                    : item.category === 'SPIRIT_HABITAT'
                        ? !isOwnedHabitat
                        : item.category === 'INSECT_EGG'
                            ? true
                            : (!isOwnedUnique && Input.hasInventorySpaceForSpec(item));
            const canAfford = !Input.isVoidCollapsed && canStoreOrUpgrade && Input.canAffordLowStoneCost(item.priceLowStone);
            const priceMarkup = Input.renderSpiritStoneCostMarkup(item.priceLowStone);
            let actionLabel = item.category === 'BAG'
                ? (canStoreOrUpgrade ? 'Mở rộng' : 'Không hợp lệ')
                : (canStoreOrUpgrade ? 'Mua' : 'Túi đầy');

            if (item.category === 'SWORD_ART' || item.category === 'FLAME_ART') {
                actionLabel = isOwnedUnique ? 'Đã mua' : (canStoreOrUpgrade ? 'Mua' : 'Túi đầy');
            } else if (item.category === 'SPIRIT_BAG') {
                actionLabel = canStoreOrUpgrade ? 'Mở rộng' : 'Không hợp lệ';
            } else if (item.category === 'SPIRIT_HABITAT') {
                actionLabel = isOwnedHabitat ? 'Đã an trí' : 'Mua';
            } else if (item.category === 'INSECT_EGG') {
                actionLabel = 'Mua';
            } else if (item.category === 'INSECT_SKILL') {
                actionLabel = isOwnedUnique ? 'Đã mua' : (canStoreOrUpgrade ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.buttonLabel || 'Mua') : 'Túi đầy');
            } else if (item.category === 'INSECT_ARTIFACT') {
                actionLabel = isOwnedUnique ? 'Đã sở hữu' : (canStoreOrUpgrade ? 'Mua' : 'Túi đầy');
            }

            return `
                <article class="shop-card has-pill-art" style="--slot-accent:${qualityConfig.color}">
                    <div class="slot-badge">${escapeHtml(Input.getItemCategoryLabel(item))}</div>
                    ${buildPillVisualMarkup(item, qualityConfig)}
                    <h4>${escapeHtml(Input.getItemDisplayName(item))}</h4>
                    <p class="item-description">${Input.getItemDescriptionMarkup(item)}</p>
                    <div class="slot-meta">Giá: ${formatNumber(item.priceLowStone)} hạ phẩm linh thạch</div>
                    <div class="slot-meta slot-meta-price">
                        <span class="slot-meta-title">Giá</span>
                        ${priceMarkup}
                    </div>
                    <button class="btn-slot-action" data-shop-id="${escapeHtml(item.id)}" ${canAfford ? '' : 'disabled'}>${escapeHtml(actionLabel)}</button>
                </article>
            `;
        }).join('');

        this.list.innerHTML = cards;
    },

    render() {
        if (!this.wallet || !this.list || !this.toolbar || !this.pagination) return;

        this.wallet.innerHTML = buildWalletMarkup();
        this.ensureToolbar();

        const allItems = Input.getShopItems();
        const filteredItems = this.filterItems(allItems);
        const pageSize = this.getPageSize();
        const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

        this.lastPageSize = pageSize;
        this.currentPage = Math.min(Math.max(1, this.currentPage), totalPages);

        const startIndex = (this.currentPage - 1) * pageSize;
        const pagedItems = filteredItems.slice(startIndex, startIndex + pageSize);

        this.syncToolbar(allItems.length, filteredItems.length);
        this.renderItems(pagedItems);
        this.renderPagination(filteredItems.length, totalPages);
    },

    open() {
        this.render();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    }
};

ShopUI.ensureToolbar = function () {
    if (!this.toolbar || this.toolbar.dataset.ready === 'true') return;

    const qualityOptions = ['ALL', ...QUALITY_ORDER].map(quality => {
        const label = quality === 'ALL' ? 'T\u1ea5t c\u1ea3 ph\u1ea9m ch\u1ea5t' : getQualityLabel(quality);
        return `<option value="${quality}">${escapeHtml(label)}</option>`;
    }).join('');

    this.toolbar.innerHTML = `
        <div class="shop-tip" id="shop-tip"></div>
        <div class="panel-tabs shop-tabs" id="shop-tabs">
            ${ITEM_COLLECTION_TABS.map(tab => `
                <button class="panel-tab" type="button" data-shop-tab="${tab.key}">
                    ${escapeHtml(tab.label)}
                </button>
            `).join('')}
        </div>
        <div class="shop-toolbar-row">
            <label class="shop-field shop-field-search">
                <span>T\u00ecm ki\u1ebfm</span>
                <input id="shop-search" class="shop-control-input" type="search" placeholder="T\u00ean \u0111an, t\u00fai, c\u00f4ng d\u1ee5ng, ph\u1ea9m ch\u1ea5t...">
            </label>
            <div class="shop-filter-group">
                <label class="shop-field">
                    <span>Ph\u1ea9m ch\u1ea5t</span>
                    <select id="shop-filter-quality" class="shop-control-input">${qualityOptions}</select>
                </label>
            </div>
        </div>
        <div class="shop-toolbar-meta">
            <div id="shop-summary" class="shop-summary"></div>
            <button type="button" class="btn-shop-reset" data-shop-action="reset-filters">X\u00f3a l\u1ecdc</button>
        </div>
    `;

    this.toolbar.dataset.ready = 'true';
};

ShopUI.syncToolbar = function (totalCount, filteredCount) {
    if (!this.toolbar) return;

    const nextRealm = Input.getNextMajorRealmInfo();
    const tip = nextRealm
        ? `\u0110ang b\u00e0y b\u00e1n \u0111\u1ee7 lo\u1ea1i \u0111an d\u01b0\u1ee3c, b\u00ed ph\u00e1p v\u00e0 v\u1eadt t\u01b0 cho l\u1ea7n \u0111\u1ed9t ph\u00e1 t\u1edbi ${escapeHtml(nextRealm.name)}.`
        : '\u0110\u00e3 \u1edf c\u1ea3nh gi\u1edbi t\u1ed1i cao, c\u1eeda h\u00e0ng v\u1eabn c\u00f2n \u0111an c\u01b0\u1eddng h\u00f3a v\u00e0 v\u1eadt ph\u1ea9m \u0111\u1eb7c bi\u1ec7t.';

    const tipEl = this.toolbar.querySelector('#shop-tip');
    const searchEl = this.toolbar.querySelector('#shop-search');
    const qualityEl = this.toolbar.querySelector('#shop-filter-quality');
    const summaryEl = this.toolbar.querySelector('#shop-summary');
    const resetBtn = this.toolbar.querySelector('[data-shop-action="reset-filters"]');

    if (tipEl) tipEl.innerHTML = tip;
    if (searchEl && searchEl.value !== this.searchQuery) searchEl.value = this.searchQuery;
    if (qualityEl && qualityEl.value !== this.qualityFilter) qualityEl.value = this.qualityFilter;

    this.toolbar.querySelectorAll('[data-shop-tab]').forEach(tabBtn => {
        tabBtn.classList.toggle('is-active', tabBtn.getAttribute('data-shop-tab') === this.categoryFilter);
    });

    if (summaryEl) {
        summaryEl.innerHTML = `${escapeHtml(getItemCollectionTabLabel(this.categoryFilter))}: <strong>${formatNumber(filteredCount)}</strong> / ${formatNumber(totalCount)} v\u1eadt ph\u1ea9m`;
    }

    if (resetBtn) {
        resetBtn.disabled = !this.searchQuery && this.categoryFilter === 'DAN_DUOC' && this.qualityFilter === 'ALL';
    }
};

ShopUI.filterItems = function (items) {
    const query = normalizeSearchText(this.searchQuery);

    return items.filter(item => {
        if (getItemCollectionTabKey(item) !== this.categoryFilter) {
            return false;
        }

        if (this.qualityFilter !== 'ALL' && item.quality !== this.qualityFilter) {
            return false;
        }

        if (!query) return true;

        const haystack = normalizeSearchText([
            Input.getItemDisplayName(item),
            Input.getItemDescription(item),
            Input.getItemCategoryLabel(item),
            getQualityLabel(item.quality),
            item.realmName || '',
            getItemCollectionTabLabel(getItemCollectionTabKey(item))
        ].join(' '));

        return haystack.includes(query);
    });
};

InventoryUI = {
    overlay: document.getElementById('inventory-popup'),
    btnOpen: document.getElementById('btn-inventory'),
    btnClose: document.getElementById('close-inventory'),
    wallet: document.getElementById('inventory-wallet'),
    tabs: document.getElementById('inventory-tabs'),
    itemPanel: document.getElementById('inventory-panel-items'),
    stonePanel: document.getElementById('inventory-panel-stones'),
    beastPanel: document.getElementById('inventory-panel-beasts'),
    pillGrid: document.getElementById('inventory-pill-grid'),
    stoneGrid: document.getElementById('inventory-stone-grid'),
    beastWallet: document.getElementById('inventory-beast-wallet'),
    eggGrid: document.getElementById('inventory-egg-grid'),
    beastGrid: document.getElementById('inventory-beast-grid'),
    currentTab: 'items',

    init() {
        if (!this.overlay || !this.btnOpen) return;

        const content = this.overlay.querySelector('.popup-content');
        if (content) {
            content.addEventListener('pointerdown', (e) => e.stopPropagation());
        }

        this.btnOpen.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.open();
        });

        if (this.btnClose) {
            this.btnClose.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        if (this.pillGrid) {
            this.pillGrid.addEventListener('pointerdown', (e) => {
                const actionBtn = e.target.closest('[data-item-key]');
                if (!actionBtn) return;

                e.stopPropagation();
                const itemKey = actionBtn.getAttribute('data-item-key');
                const action = actionBtn.getAttribute('data-action') || 'use';

                if (action === 'sell') {
                    Input.sellInventoryItem(itemKey);
                } else {
                    Input.useInventoryItem(itemKey);
                }
            });
        }

        if (this.tabs) {
            this.tabs.addEventListener('pointerdown', (e) => {
                const tabBtn = e.target.closest('[data-inventory-tab]');
                if (!tabBtn) return;

                e.stopPropagation();
                this.currentTab = tabBtn.getAttribute('data-inventory-tab') || 'items';
                Input.selectedInventoryTab = this.currentTab;
                this.render();
            });
        }

        if (this.eggGrid) {
            this.eggGrid.addEventListener('pointerdown', (e) => {
                const hatchBtn = e.target.closest('[data-beast-action="hatch"]');
                if (!hatchBtn) return;

                e.stopPropagation();
                const speciesKey = hatchBtn.getAttribute('data-species-key');
                if (speciesKey) {
                Input.hatchInsectEgg(speciesKey, 1);
            }
        });
        }

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });
    },

    render() {
        if (!this.wallet || !this.pillGrid || !this.stoneGrid || !this.beastWallet || !this.eggGrid || !this.beastGrid) return;

        this.currentTab = Input.selectedInventoryTab || this.currentTab || 'items';
        this.wallet.innerHTML = buildWalletMarkup() + buildInventoryCapacityMarkup();

        if (this.tabs) {
            this.tabs.querySelectorAll('[data-inventory-tab]').forEach(tabBtn => {
                tabBtn.classList.toggle('is-active', tabBtn.getAttribute('data-inventory-tab') === this.currentTab);
            });
        }

        [
            { panel: this.itemPanel, key: 'items' },
            { panel: this.stonePanel, key: 'stones' },
            { panel: this.beastPanel, key: 'beasts' }
        ].forEach(entry => {
            if (!entry.panel) return;
            entry.panel.classList.toggle('is-active', entry.key === this.currentTab);
        });

        const inventorySummary = Input.getInventorySummary();
        const entries = inventorySummary.entries;
        const cards = entries.map(item => {
            const qualityConfig = Input.getItemQualityConfig(item);
            const usable = Input.isInventoryItemUsable(item);
            const sellPrice = Input.getInventorySellPrice(item);
            const sellPriceMarkup = Input.renderSpiritStoneCostMarkup(sellPrice);
            const isArtifactBook = item.category === 'INSECT_ARTIFACT';
            const inventoryActionLabel = item.category === 'SWORD_ART'
                ? (CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.inventoryActionLabel || 'Lĩnh ngộ')
                : item.category === 'FLAME_ART'
                    ? (CONFIG.SECRET_ARTS?.CAN_LAM_BANG_DIEM?.inventoryActionLabel || 'Luyện hóa')
                    : item.category === 'INSECT_SKILL'
                        ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.inventoryActionLabel || 'Lĩnh ngộ')
                    : null;
            const label = item.category === 'BREAKTHROUGH' && !usable
                ? `Chờ ${item.realmName}`
                : 'Dùng';

            return `
                <article class="inventory-slot has-pill-art" style="--slot-accent:${qualityConfig.color}">
                    <div class="slot-badge">${formatNumber(item.count)}x</div>
                    ${buildPillVisualMarkup(item, qualityConfig)}
                    <h4>${escapeHtml(Input.getItemDisplayName(item))}</h4>
                    <p class="item-description">${Input.getItemDescriptionMarkup(item)}</p>
                    <div class="slot-meta">Bán lại: ${formatNumber(sellPrice)} hạ phẩm linh thạch</div>
                    <div class="slot-meta slot-meta-price">
                        <span class="slot-meta-title">Bán lại</span>
                        ${sellPriceMarkup}
                    </div>
                    <div class="slot-actions">
                        <button class="btn-slot-action" data-action="use" data-item-key="${escapeHtml(item.key)}" ${usable ? '' : 'disabled'}>${escapeHtml(isArtifactBook ? 'Xem' : (inventoryActionLabel || label))}</button>
                        <button class="btn-slot-action is-secondary" data-action="sell" data-item-key="${escapeHtml(item.key)}" ${sellPrice > 0 ? '' : 'disabled'}>Bán</button>
                    </div>
                </article>
            `;
        });

        const emptySlotCount = Math.max(0, CONFIG.ITEMS.INVENTORY_MIN_SLOTS - cards.length);
        for (let i = 0; i < emptySlotCount; i++) {
            cards.push(`<article class="inventory-slot is-empty"><span>Ô trống</span></article>`);
        }
        this.pillGrid.innerHTML = cards.join('');

        this.stoneGrid.innerHTML = STONE_ORDER.map(quality => {
            const stoneType = Input.getSpiritStoneType(quality);

            return `
                <article class="inventory-slot stone-slot" style="--slot-accent:${stoneType.color}">
                    <div class="slot-badge">Linh thạch</div>
                    <h4>${escapeHtml(stoneType.label)}</h4>
                    <p>Quy đổi: ${formatNumber(stoneType.value)} hạ phẩm linh thạch.</p>
                    <div class="slot-count">${formatNumber(Input.spiritStones[quality] || 0)}</div>
                </article>
            `;
        }).join('');

        this.beastWallet.innerHTML = buildBeastWalletMarkup();

        const eggCards = Input.getInsectSpeciesEntries()
            .filter(([speciesKey]) => (Input.insectEggs[speciesKey] || 0) > 0)
            .map(([speciesKey]) => buildInsectEggCardMarkup(speciesKey, Input.insectEggs[speciesKey]));
        this.eggGrid.innerHTML = eggCards.length
            ? eggCards.join('')
            : '<article class="inventory-slot is-empty"><span>Chưa có trứng kỳ trùng.</span></article>';

        const beastCards = Input.getInsectSpeciesEntries()
            .filter(([speciesKey]) => (Input.tamedInsects[speciesKey] || 0) > 0)
            .map(([speciesKey]) => buildTamedInsectCardMarkup(speciesKey, Input.tamedInsects[speciesKey]));
        this.beastGrid.innerHTML = beastCards.length
            ? beastCards.join('')
            : '<article class="inventory-slot is-empty"><span>Chưa có linh trùng đã nở.</span></article>';
    },

    open() {
        this.render();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    }
};

SkillsUI = {
    overlay: document.getElementById('skills-popup'),
    btnOpen: document.getElementById('btn-skill-list'),
    btnClose: document.getElementById('close-skills'),
    list: document.getElementById('attack-skill-list'),

    isOpen() {
        return Boolean(this.overlay && this.overlay.classList.contains('show'));
    },

    init() {
        if (!this.overlay || !this.btnOpen || !this.list) return;

        const content = this.overlay.querySelector('.popup-content');
        if (content) {
            content.addEventListener('pointerdown', (e) => e.stopPropagation());
        }

        this.btnOpen.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.open();
        });

        if (this.btnClose) {
            this.btnClose.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        this.list.addEventListener('pointerdown', (e) => {
            const toggleBtn = e.target.closest('[data-insect-toggle]');
            if (toggleBtn) {
                e.stopPropagation();
                e.preventDefault();

                if (Input.toggleInsectSpeciesCombatEnabled(toggleBtn.getAttribute('data-insect-toggle'))) {
                    this.render();
                }
                return;
            }

            const skillBtn = e.target.closest('[data-attack-skill]');
            if (!skillBtn) return;

            e.stopPropagation();
            const skillKey = skillBtn.getAttribute('data-attack-skill');
            const changed = Input.attackMode === skillKey
                ? Input.clearAttackSkill()
                : Input.setAttackMode(skillKey);

            if (changed) {
                this.render();
                this.close();
            }
        });

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });
    },

    renderInsectRosterMarkup(skill) {
        if (skill.key !== 'INSECT' || !skill.unlocked) return '';

        if (!skill.roster?.length) {
            return `
                <div class="attack-skill-card__roster is-empty">
                    <span>Chưa có linh trùng nào đủ duyên nhập trận.</span>
                </div>
            `;
        }

        return `
            <div class="attack-skill-card__roster">
                <div class="attack-skill-card__roster-head">
                    <strong>Trùng trận hiện có</strong>
                    <span>${escapeHtml(skill.rosterSummary || '')}</span>
                </div>
                <div class="insect-toggle-list">
                    ${skill.roster.map(entry => `
                        <button
                            class="insect-toggle-chip ${entry.enabled ? 'is-enabled' : ''}"
                            type="button"
                            data-insect-toggle="${escapeHtml(entry.speciesKey)}"
                            style="--toggle-accent:${entry.accent}"
                            aria-pressed="${entry.enabled ? 'true' : 'false'}"
                        >
                            <span class="insect-toggle-chip__title">${escapeHtml(entry.name)}</span>
                            <span class="insect-toggle-chip__meta">${formatNumber(entry.count)} linh trùng | ${escapeHtml(entry.modeLabel)}</span>
                            <span class="insect-toggle-chip__note">${escapeHtml(entry.note)}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderCurrentStateMarkup() {
        const currentMode = Input.attackMode;
        const title = Input.getAttackModeDisplayName(currentMode);
        const summary = currentMode === 'INSECT'
            ? `${formatNumber(Input.getCombatReadyInsectCount())} linh trùng đang bày trùng trận.`
            : currentMode === 'SWORD'
                ? `${formatNumber(Input.getAliveSwordStats().alive)} kiếm đang hộ trận.`
                : `${formatNumber(getBaseSwordCountBeforeFormation())} thanh bản mệnh kiếm đang hộ thân.`;
        const description = currentMode === 'INSECT'
            ? 'Bí pháp ngự trùng đang vận chuyển, lấy đàn trùng làm công sát chủ đạo.'
            : currentMode === 'SWORD'
                ? 'Kiếm ý đã khai trận, kiếm quang trấn thủ quanh thân.'
                : 'Chưa vận chuyển bí pháp nào, kiếm tu đang trở về kiếm thế sơ khởi.';

        return `
            <article class="attack-skill-state" style="--skill-accent:${currentMode === 'INSECT' ? '#79ffd4' : '#8fffe0'}">
                <span class="attack-skill-state__eyebrow">Đạo trạng hiện tại</span>
                <strong class="attack-skill-state__title">${escapeHtml(title)}</strong>
                <p class="attack-skill-state__description">${escapeHtml(description)}</p>
                <span class="attack-skill-state__summary">${escapeHtml(summary)}</span>
            </article>
        `;
    },

    render() {
        if (!this.list) return;

        this.list.innerHTML = this.renderCurrentStateMarkup() + Input.getAttackSkillList().map(skill => `
            <article class="attack-skill-card ${skill.active ? 'is-active' : ''} ${!skill.unlocked || !skill.ready ? 'is-disabled' : ''}" style="--skill-accent:${skill.accent}">
                <div class="attack-skill-card__head">
                    <div>
                        <h4>${escapeHtml(skill.name)}</h4>
                        <p>${escapeHtml(skill.description)}</p>
                    </div>
                    <span class="attack-skill-card__tag">${skill.active ? 'Đang vận chuyển' : (skill.unlocked ? 'Đã lĩnh ngộ' : 'Chưa lĩnh ngộ')}</span>
                </div>
                <div class="attack-skill-card__foot">
                    <span>${escapeHtml(skill.note)}</span>
                    <button class="btn-slot-action" type="button" data-attack-skill="${escapeHtml(skill.key)}" ${skill.unlocked && skill.ready ? '' : 'disabled'}>
                        ${skill.active ? 'Thu hồi' : 'Khai triển'}
                    </button>
                </div>
                ${this.renderInsectRosterMarkup(skill)}
            </article>
        `).join('');
    },

    open() {
        this.render();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    }
};

SkillsUI.render = function () {
    if (!this.list) return;

    this.list.innerHTML = this.renderCurrentStateMarkup() + Input.getAttackSkillList().map(skill => `
        <article class="attack-skill-card ${skill.active ? 'is-active' : ''} ${!skill.unlocked || !skill.ready ? 'is-disabled' : ''}" style="--skill-accent:${skill.accent}">
            <div class="attack-skill-card__head">
                <div>
                    <h4>${escapeHtml(skill.name)}</h4>
                    <p>${escapeHtml(skill.description)}</p>
                </div>
                <span class="attack-skill-card__tag">${skill.active ? 'Đang vận chuyển' : (skill.unlocked ? 'Đã lĩnh ngộ' : 'Chưa lĩnh ngộ')}</span>
            </div>
            <div class="attack-skill-card__foot">
                <span>${escapeHtml(skill.note)}</span>
                <button class="btn-slot-action" type="button" data-attack-skill="${escapeHtml(skill.key)}" ${skill.unlocked && skill.ready ? '' : 'disabled'}>
                    ${skill.active ? 'Thu hồi' : 'Khai triển'}
                </button>
            </div>
            ${this.renderInsectRosterMarkup(skill)}
        </article>
    `).join('');
};

InsectBookUI = {
    overlay: document.getElementById('insect-book-popup'),
    btnClose: document.getElementById('close-insect-book'),
    summary: document.getElementById('insect-book-summary'),
    grid: document.getElementById('insect-book-grid'),

    isOpen() {
        return Boolean(this.overlay && this.overlay.classList.contains('show'));
    },

    init() {
        if (!this.overlay || !this.grid) return;

        const content = this.overlay.querySelector('.popup-content');
        if (content) {
            content.addEventListener('pointerdown', (e) => e.stopPropagation());
        }

        if (this.btnClose) {
            this.btnClose.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });
    },

    render() {
        if (!this.summary || !this.grid) return;

        const beastSummary = Input.getBeastSummary();
        this.summary.innerHTML = `
            <div class="book-summary">
                <div class="book-summary__card">
                    <span>Đã mở</span>
                    <strong>${formatNumber(beastSummary.discoveredCount)}/${formatNumber(beastSummary.speciesTotal)} mục</strong>
                </div>
                <div class="book-summary__card">
                    <span>Trứng noãn</span>
                    <strong>${formatNumber(beastSummary.totalEggs)}</strong>
                </div>
                <div class="book-summary__card">
                    <span>Linh trùng</span>
                    <strong>${formatNumber(beastSummary.totalBeasts)}/${formatNumber(beastSummary.capacity)}</strong>
                </div>
            </div>
        `;

        this.grid.innerHTML = Input.getInsectSpeciesEntries().map(([speciesKey, species]) => {
            const discovered = Boolean(Input.discoveredInsects[speciesKey]);
            const tier = Input.getInsectTierInfo(species.tier);
            const eggCount = Input.insectEggs[speciesKey] || 0;
            const beastCount = Input.tamedInsects[speciesKey] || 0;

            return `
                <article class="insect-book-card ${discovered ? 'is-discovered' : 'is-locked'}" style="${buildInsectBookStyleVars(species)}">
                    <div class="insect-book-card__image-wrap">
                        ${buildInsectArtMarkup(speciesKey)}
                        <span class="insect-book-card__tier">${escapeHtml(tier.label)}</span>
                        ${discovered ? '' : '<span class="insect-book-card__veil">Chưa thu thập</span>'}
                    </div>
                    <div class="insect-book-card__body">
                        <h4>${escapeHtml(species.name)}</h4>
                        ${getInsectStyleHint(species) ? `<div class="insect-book-card__style">${escapeHtml(getInsectStyleHint(species))}</div>` : ''}
                        <p>${escapeHtml(species.description)}</p>
                        <div class="insect-book-card__meta">
                            ${getInsectStyleLabel(species) ? `<span>${escapeHtml(getInsectStyleLabel(species))}</span>` : ''}
                            <span>Trứng ${formatNumber(eggCount)}</span>
                            <span>Đã nở ${formatNumber(beastCount)}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    },

    open() {
        this.render();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    }
};

ProfileUI = {
    overlay: document.getElementById('profile-popup'),
    btnOpen: document.getElementById('btn-profile'),
    btnClose: document.getElementById('close-profile'),
    overview: document.getElementById('profile-overview'),
    statsGrid: document.getElementById('profile-stats-grid'),
    wallet: document.getElementById('profile-wallet'),
    pills: document.getElementById('profile-pills'),

    isOpen() {
        return Boolean(this.overlay && this.overlay.classList.contains('show'));
    },

    init() {
        if (!this.overlay || !this.btnOpen) return;

        const content = this.overlay.querySelector('.popup-content');
        if (content) {
            content.addEventListener('pointerdown', (e) => e.stopPropagation());
        }

        this.btnOpen.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.open();
        });

        if (this.btnClose) {
            this.btnClose.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });

        this.render();
    },

    render() {
        if (!this.overview || !this.statsGrid || !this.wallet || !this.pills) return;

        const rank = Input.getCurrentRank();
        const majorRealm = Input.getCurrentMajorRealmInfo();
        const breakthroughChance = Input.getCurrentBreakthroughChance();
        const swordStats = Input.getAliveSwordStats();
        const inventorySummary = Input.getInventorySummary();
        const displayName = Input.getPlayerDisplayName();
        const accent = rank?.color || '#8fffe0';
        const accentLight = rank?.lightColor || '#ffffff';
        const rageLabel = Input.getUltimateResourceLabel();
        const attackModeLabel = Input.getAttackModeDisplayName();
        const swordMetricLabel = Input.attackMode === 'SWORD' ? 'Kiếm trận' : 'Bản mệnh kiếm';
        const combatPillCount = (inventorySummary.categories.ATTACK || 0)
            + (inventorySummary.categories.SHIELD_BREAK || 0)
            + (inventorySummary.categories.BERSERK || 0)
            + (inventorySummary.categories.RAGE || 0);
        const supportPillCount = (inventorySummary.categories.MANA || 0)
            + (inventorySummary.categories.MAX_MANA || 0)
            + (inventorySummary.categories.REGEN || 0)
            + (inventorySummary.categories.SPEED || 0)
            + (inventorySummary.categories.FORTUNE || 0)
            + (inventorySummary.categories.INSIGHT || 0)
            + (inventorySummary.categories.EXP || 0);
        const beastSummary = Input.getBeastSummary();

        this.btnOpen.setAttribute('title', `${displayName} - ${rank?.name || 'Chưa nhập đạo'}`);
        this.btnOpen.setAttribute('aria-label', `Mở hồ sơ của ${displayName}`);

        this.overview.innerHTML = `
            <article class="profile-hero__card is-accent" style="--profile-accent:${accent};--profile-light:${accentLight}">
                <div class="profile-hero__identity">
                    <div class="profile-hero__avatar" aria-hidden="true">
                        <img class="profile-hero__avatar-icon" src="./assets/images/sword-light.svg" alt="">
                    </div>
                    <div>
                        <div class="profile-hero__eyebrow">Đạo hiệu</div>
                        <h4 class="profile-hero__title">${escapeHtml(displayName)}</h4>
                        <div class="profile-hero__subtitle">${escapeHtml(majorRealm?.name || 'Phàm giới')} • ${escapeHtml(rank?.name || 'Chưa nhập đạo')}</div>
                    </div>
                </div>
                <div class="profile-hero__chips">
                    <span class="profile-chip">Tu vi<strong>${formatNumber(Input.exp)}/${formatNumber(rank?.exp || 0)}</strong></span>
                    <span class="profile-chip">Đột phá<strong>${Math.round(breakthroughChance * 100)}%</strong></span>
                    <span class="profile-chip">${escapeHtml(swordMetricLabel)}<strong>${swordStats.alive}/${swordStats.total}</strong></span>
                    <span class="profile-chip">Linh trùng<strong>${formatNumber(beastSummary.totalBeasts)}</strong></span>
                </div>
            </article>
            <article class="profile-hero__card">
                <div class="profile-hero__eyebrow">Tình trạng hiện tại</div>
                <div class="profile-hero__chips">
                    <span class="profile-chip is-soft">Linh lực<strong>${formatNumber(Input.mana)}/${formatNumber(Input.maxMana)}</strong></span>
                    <span class="profile-chip is-soft">${escapeHtml(rageLabel)}<strong>${formatNumber(Input.rage)}/${formatNumber(Input.maxRage)}</strong></span>
                    <span class="profile-chip is-soft">Sát thương<strong>${formatNumber(Input.getEffectiveAttackDamage())}</strong></span>
                    <span class="profile-chip is-soft">Linh thạch<strong>${formatNumber(Input.getSpiritStoneTotalValue())}</strong></span>
                    <span class="profile-chip is-soft">Bí pháp<strong>${escapeHtml(attackModeLabel)}</strong></span>
                </div>
            </article>
        `;

        const stats = [
            { label: 'Cảnh giới', value: rank?.name || 'Chưa nhập đạo' },
            { label: 'Đại cảnh giới', value: majorRealm?.name || 'Phàm giới' },
            { label: 'Tu vi', value: `${formatNumber(Input.exp)}/${formatNumber(rank?.exp || 0)}` },
            { label: 'Linh lực', value: `${formatNumber(Input.mana)}/${formatNumber(Input.maxMana)}` },
            { label: rageLabel, value: `${formatNumber(Input.rage)}/${formatNumber(Input.maxRage)}` },
            { label: 'Sát thương', value: `≈ ${formatNumber(Input.getEffectiveAttackDamage())}` },
            { label: 'Công lực', value: `+${Math.round((Input.getAttackMultiplier() - 1) * 100)}%` },
            { label: 'Phá khiên', value: `+${Math.round((Input.getShieldBreakMultiplier() - 1) * 100)}%` },
            { label: 'Tốc độ', value: `+${Math.round((Input.getSpeedMultiplier() - 1) * 100)}%` },
            { label: 'Hồi linh', value: `+${Math.round((Input.getManaRegenMultiplier() - 1) * 100)}%` },
            { label: 'Vận khí', value: `+${Math.round((Input.getDropRateMultiplier() - 1) * 100)}%` },
            { label: 'Tỉ lệ đột phá', value: `${Math.round(breakthroughChance * 100)}%` },
            { label: swordMetricLabel, value: `${swordStats.alive}/${swordStats.total}` },
            { label: 'Kiếm hỏng', value: `${swordStats.broken}` },
            { label: 'Linh trùng', value: `${formatNumber(beastSummary.totalBeasts)}/${formatNumber(beastSummary.capacity)}` },
            { label: 'Trứng noãn', value: `${formatNumber(beastSummary.totalEggs)}` },
            { label: 'Kỳ trùng đã mở', value: `${formatNumber(beastSummary.discoveredCount)}/${formatNumber(beastSummary.speciesTotal)}` },
            { label: 'Túi trữ vật', value: `${formatNumber(inventorySummary.uniqueCount)}/${formatNumber(inventorySummary.capacity)} ô` },
            { label: 'Ô trống', value: `${formatNumber(inventorySummary.freeSlots)}` }
        ];

        this.statsGrid.innerHTML = stats.map(stat => `
            <article class="profile-stat-card" style="--profile-accent:${accent}">
                <span class="profile-stat-label">${escapeHtml(stat.label)}</span>
                <strong class="profile-stat-value">${escapeHtml(stat.value)}</strong>
            </article>
        `).join('');

        this.wallet.innerHTML = buildWalletMarkup();

        if (!inventorySummary.entries.length) {
            this.pills.innerHTML = '<div class="profile-empty">Túi đan dược còn trống, chỉ mới tích lũy linh thạch và khí tức nền tảng.</div>';
            return;
        }

        const categoryOrder = Object.keys(CONFIG.PILL.CATEGORY_SORT || {});
        const categoryMarkup = Object.entries(inventorySummary.categories)
            .sort((a, b) => {
                const aIndex = categoryOrder.indexOf(a[0]);
                const bIndex = categoryOrder.indexOf(b[0]);
                return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
            })
            .map(([category, count]) => `
                <span class="profile-chip is-soft">
                    ${escapeHtml(Input.getItemCategoryLabel({ category }))}
                    <strong>${formatNumber(count)}</strong>
                </span>
            `)
            .join('');

        const featuredMarkup = inventorySummary.entries.slice(0, 4).map(item => `
            <div class="profile-pill-entry">
                <span>${escapeHtml(Input.getItemDisplayName(item))}</span>
                <strong>${formatNumber(item.count)}x</strong>
            </div>
        `).join('');

        this.pills.innerHTML = `
            <div class="profile-pill-summary">
                <article class="profile-stat-card" style="--profile-accent:${accent}">
                    <span class="profile-stat-label">Tổng đan</span>
                    <strong class="profile-stat-value">${formatNumber(inventorySummary.totalCount)}</strong>
                </article>
                <article class="profile-stat-card" style="--profile-accent:${accent}">
                    <span class="profile-stat-label">Số loại</span>
                    <strong class="profile-stat-value">${formatNumber(inventorySummary.uniqueCount)}</strong>
                </article>
                <article class="profile-stat-card" style="--profile-accent:${accent}">
                    <span class="profile-stat-label">Đan chiến đấu</span>
                    <strong class="profile-stat-value">${formatNumber(combatPillCount)}</strong>
                </article>
                <article class="profile-stat-card" style="--profile-accent:${accent}">
                    <span class="profile-stat-label">Đan hỗ trợ</span>
                    <strong class="profile-stat-value">${formatNumber(supportPillCount)}</strong>
                </article>
            </div>
            <div class="profile-chip-grid">${categoryMarkup}</div>
            <div class="profile-pill-list">${featuredMarkup}</div>
        `;
    },

    open() {
        this.render();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    }
};

document.getElementById('btn-form').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (Input.isVoidCollapsed) {
        showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
        return;
    }

    // --- LOGIC MỚI: KIỂM TRA MANA ---
    const cost = CONFIG.MANA.COST_CHANGE_FORM;

    if (Input.mana >= cost) {
        // Đủ Mana: Trừ mana và đổi dạng
        Input.updateMana(-cost);

        Input.guardForm = (Input.guardForm === 1) ? 2 : 1;

        const icon = e.currentTarget.querySelector('.icon-form');
        if (icon) {
            icon.style.transform = `rotate(${Input.guardForm === 1 ? -15 : 165}deg)`;
        }
    } else {
        // Không đủ Mana: Rung UI cảnh báo
        Input.triggerManaShake();
    }
});

document.getElementById('btn-breakthrough').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    // Gọi hàm thực hiện đột phá mà chúng ta đã viết ở bước trước
    Input.executeBreakthrough();
});

document.getElementById('btn-ultimate').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    Input.startUltimate();
});

const moveBtn = document.getElementById('btn-move');
const attackBtn = document.getElementById('btn-attack');

const startMoveJoystick = (e) => {
    if (!moveBtn || !Input.isTouchDevice || e.pointerType === 'mouse') return false;

    e.stopPropagation();
    e.preventDefault();

    if (Input.isVoidCollapsed) return false;

    if (moveBtn.setPointerCapture) {
        moveBtn.setPointerCapture(e.pointerId);
    }

    return Input.startMoveJoystick(e.pointerId, moveBtn, e.clientX, e.clientY);
};

const stopMoveJoystick = (e) => {
    if (!moveBtn || !Input.moveJoystick.active || Input.moveJoystick.pointerId !== e.pointerId) return;

    e.stopPropagation();
    e.preventDefault();

    if (moveBtn.hasPointerCapture && moveBtn.hasPointerCapture(e.pointerId)) {
        moveBtn.releasePointerCapture(e.pointerId);
    }

    Input.stopMoveJoystick(e.pointerId);
};

// Xử lý riêng cho nút bấm để không bị ảnh hưởng bởi logic handleDown của hệ thống
const startAttack = (e) => {
    e.stopPropagation();
    e.preventDefault();

    Input.resetAttackState();

    if (Input.isVoidCollapsed) {
        showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
        return false;
    }

    // 1. Kiểm tra xem còn thanh kiếm nào còn sống (hp > 0) không
    const aliveSwords = swords.filter(s => !s.isDead).length;

    // 2. Nếu đang dùng Khu Trùng Thuật thì chỉ cần còn mana
    if (Input.isInsectSwarmActive() && Input.mana <= 0) {
        Input.triggerManaShake();
        return false;
    }

    // 3. Nếu mana = 0 VÀ không còn kiếm nào sống
    if (!Input.isInsectSwarmActive() && Input.mana <= 0 && aliveSwords === 0) {
        Input.triggerManaShake();
        return false;
    }

    Input.isAttacking = true;
    return true;
};

const stopAttack = (e) => {
    e.stopPropagation();
    e.preventDefault();
    Input.resetAttackState();
};

if (moveBtn) {
    moveBtn.addEventListener('pointerdown', (e) => {
        startMoveJoystick(e);
    });

    moveBtn.addEventListener('pointermove', (e) => {
        if (!Input.moveJoystick.active || Input.moveJoystick.pointerId !== e.pointerId) return;

        e.stopPropagation();
        e.preventDefault();
        Input.updateMoveJoystick(e.clientX, e.clientY);
    });

    moveBtn.addEventListener('pointerup', stopMoveJoystick);
    moveBtn.addEventListener('pointercancel', stopMoveJoystick);
    moveBtn.addEventListener('lostpointercapture', (e) => Input.stopMoveJoystick(e.pointerId));
}

// Sử dụng pointerdown/up để nhạy nhất trên cả mobile và desktop
attackBtn.addEventListener('pointerdown', (e) => {
    if (Input.isTouchDevice && e.pointerType !== 'mouse') {
        if (!startAttack(e)) return;

        if (attackBtn.setPointerCapture) {
            attackBtn.setPointerCapture(e.pointerId);
        }

        return;
    }

    startAttack(e);
});

attackBtn.addEventListener('pointerup', (e) => {
    if (attackBtn.hasPointerCapture && attackBtn.hasPointerCapture(e.pointerId)) {
        attackBtn.releasePointerCapture(e.pointerId);
    }

    stopAttack(e);
});

attackBtn.addEventListener('pointercancel', (e) => {
    if (attackBtn.hasPointerCapture && attackBtn.hasPointerCapture(e.pointerId)) {
        attackBtn.releasePointerCapture(e.pointerId);
    }

    stopAttack(e);
});

attackBtn.addEventListener('lostpointercapture', () => {
    Input.resetAttackState();
});

attackBtn.addEventListener('pointerleave', (e) => {
    if (Input.isTouchDevice && e.pointerType !== 'mouse') return;
    stopAttack(e);
}); // Khi kéo ngón tay ra khỏi nút

/**
 * ====================================================================
 * MAIN MANAGER
 * ====================================================================
 */
const enemies = [];
let pills = [];
const swords = [];
let starField;
const guardCenter = { x: width / 2, y: height / 2, vx: 0, vy: 0 };

function getConfiguredSwordCount() {
    return Math.max(1, parseInt(CONFIG.SWORD.COUNT, 10) || 1);
}

function getBaseSwordCountBeforeFormation() {
    const configuredBase = Math.max(1, parseInt(CONFIG.SWORD.STARTING_COUNT_BEFORE_FORMATION, 10) || 1);
    return Math.min(configuredBase, getConfiguredSwordCount());
}

function getDesiredSwordCount() {
    return Input.attackMode === 'SWORD' && Input.hasDaiCanhKiemTranUnlocked()
        ? getConfiguredSwordCount()
        : getBaseSwordCountBeforeFormation();
}

function syncSwordFormation(options = {}) {
    const { rebuildAll = false } = options;
    const targetCount = getDesiredSwordCount();

    if (rebuildAll) {
        swords.length = 0;
    }

    if (swords.length > targetCount) {
        swords.length = targetCount;
    }

    for (let i = 0; i < targetCount; i++) {
        if (!swords[i]) {
            const sword = new Sword(i, scaleFactor);
            sword.x = guardCenter.x;
            sword.y = guardCenter.y;
            swords[i] = sword;
        }
    }

    updateSwordCounter(swords);
    if (typeof Input?.renderAttackModeUI === 'function') {
        Input.renderAttackModeUI();
    }

    return swords.length;
}

function init() {
    // Khởi tạo thông số theo rank đầu tiên
    const startingRank = CONFIG.CULTIVATION.RANKS[Input.rankIndex];
    Input.maxMana = startingRank.maxMana || CONFIG.MANA.MAX;
    Input.mana = Input.maxMana;
    Input.syncDerivedStats();

    document.body.classList.add('game-native-cursor-hidden');
    document.body.classList.toggle('is-touch-device', Input.isTouchDevice);
    syncPopupCursorState();

    SettingsUI.init();
    Input.spiritStones = getStartingSpiritStoneCounts();
    Input.renderManaUI();
    Input.renderExpUI();
    Input.renderRageUI();
    if (ShopUI) ShopUI.init();
    if (InventoryUI) InventoryUI.init();
    if (SkillsUI) SkillsUI.init();
    if (InsectBookUI) InsectBookUI.init();
    if (ProfileUI) ProfileUI.init();
    Input.renderAttackModeUI();
    starField = new StarField(CONFIG.BG.STAR_COUNT, width, height);
    for (let i = 0; i < CONFIG.ENEMY.SPAWN_COUNT; i++) enemies.push(new Enemy());
    syncSwordFormation({ rebuildAll: true });
    updateSwordCounter(swords);
}

function updateSwordCounter(swords) {
    const aliveSwords = swords.filter(s => !s.isDead).length;
    const totalSwords = swords.length;
    const display = document.getElementById('sword-count-text');

    if (display) {
        display.innerText = `${aliveSwords}/${totalSwords}`;

        // Hiệu ứng đổi màu nếu số lượng kiếm quá thấp (tùy chọn)
        if (aliveSwords < totalSwords * 0.3) {
            display.style.color = "#ff4444";
        } else {
            display.style.color = "#fff";
        }
    }
}

function updatePhysics(dt) {
    Camera.update();
    Input.update(dt);
    Input.regenMana();
    const speedMult = Input.getSpeedMultiplier();
    let dx = Input.x - guardCenter.x;
    let dy = Input.y - guardCenter.y;
    guardCenter.vx += dx * 0.04 * speedMult;
    guardCenter.vy += dy * 0.04 * speedMult;
    guardCenter.vx *= 0.82;
    guardCenter.vy *= 0.82;
    guardCenter.x += guardCenter.vx;
    guardCenter.y += guardCenter.vy;
}

function renderCursor() {
    // Không dùng shadow của canvas cũ để tránh bị đè màu
    ctx.shadowBlur = 0; 
    
    // Gọi trực tiếp Băng Diễm từ Input
    Input.drawCursor(ctx, scaleFactor);
}

function animate() {
    // 1. Tính Delta Time (dt) tính bằng giây
    const now = performance.now();
    const dt = (now - lastTime) / 1000; // Chia 1000 để ra giây
    lastTime = now;

    frameCount++;

    ctx.fillStyle = CONFIG.COLORS.BG_FADE;
    ctx.fillRect(0, 0, width, height);

    // 2. Truyền dt vào updatePhysics
    updatePhysics(dt);

    if (frameCount % 10 === 0) {
        updateSwordCounter(swords);
    }

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(Camera.currentZoom, Camera.currentZoom);
    ctx.translate(-width / 2, -height / 2);

    starField.draw(ctx, scaleFactor);

    ctx.save();
    ctx.translate(guardCenter.x, guardCenter.y);
    ctx.rotate(performance.now() * 0.0002);
    ctx.strokeStyle = "rgba(120,255,210,0.1)";
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.beginPath();
    ctx.arc(0, 0, 50 * scaleFactor, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    enemies.forEach(e => e.draw(ctx, scaleFactor));
    pills = pills.filter(pill => {
        const collected = pill.update(guardCenter.x, guardCenter.y);

        if (collected) {
            Input.collectDrop(collected);
            return false;
            // Cộng vào đúng loại đan trong Input
            Input.pills[pill.typeKey]++;

            const typeName = CONFIG.PILL.TYPES[pill.typeKey].name;
            showNotify(`+1 ${typeName}`, pill.color);

            Input.renderExpUI(); // Cập nhật lại giao diện ngay khi nhặt được
            return false;
        }

        pill.draw(ctx);
        return true;
    });

    const renderSwarm = Input.isInsectSwarmActive();
    const renderInsectUltimate = Input.isInsectUltimateActive();
    Input.updateInsectSwarm(dt, enemies, scaleFactor);
    Input.updateInsectUltimate(dt, enemies, scaleFactor);

    const hideSwords = renderSwarm || renderInsectUltimate;
    const swordInput = hideSwords
        ? { ...Input, isAttacking: false, isUltMode: false, ultimatePhase: 'idle', attackMode: 'SWORD', ultimateMode: null }
        : Input;

    swords.forEach(s => {
        s.update(guardCenter, enemies, swordInput, scaleFactor);
        if (!hideSwords) {
            s.draw(ctx, scaleFactor);
        }
    });

    if (renderSwarm) {
        Input.drawInsectSwarm(ctx, scaleFactor);
    }

    if (renderInsectUltimate) {
        Input.drawInsectUltimate(ctx, scaleFactor);
    }

    renderCursor();

    // Vẽ và cập nhật hạt hiệu ứng
    for (let i = visualParticles.length - 1; i >= 0; i--) {
        const p = visualParticles[i];
        const friction = p.friction ?? 1;
        const nextVx = (p.vx || 0) * friction;
        const nextVy = ((p.vy || 0) + (p.gravity || 0)) * friction;
        p.vx = nextVx;
        p.vy = nextVy;
        p.x += nextVx;
        p.y += nextVy;

        if (typeof p.radialVelocity === 'number') {
            p.radius = (p.radius || 0) + p.radialVelocity;
        }

        if (typeof p.sizeVelocity === 'number') {
            p.size = Math.max(0, (p.size || 0) + p.sizeVelocity);
        }

        if (typeof p.lengthVelocity === 'number') {
            p.length = Math.max(0, (p.length || 0) + p.lengthVelocity);
        }

        if (typeof p.rotationSpeed === 'number') {
            p.rotation = (p.rotation || 0) + p.rotationSpeed;
        }

        p.life -= p.decay ?? 0.02;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life) * (p.opacity ?? 1);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.shadowBlur = p.glow || 0;
        ctx.shadowColor = p.color;

        if (p.type === 'square') {
            const size = p.size || 0;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation || 0);
            ctx.fillRect(-size / 2, -size / 2, size, size);
        } else if (p.type === 'ring') {
            ctx.lineWidth = Math.max(0.6, (p.lineWidth || 2) * Math.max(0.35, p.life));
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0, p.radius || 0), 0, Math.PI * 2);
            ctx.stroke();
        } else if (p.type === 'ray') {
            const angle = p.angle || 0;
            const startRadius = p.radius || 0;
            const endRadius = startRadius + (p.length || 0);
            ctx.lineWidth = Math.max(0.8, (p.lineWidth || 2) * Math.max(0.35, p.life));
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(
                p.x + (Math.cos(angle) * startRadius),
                p.y + (Math.sin(angle) * startRadius)
            );
            ctx.lineTo(
                p.x + (Math.cos(angle) * endRadius),
                p.y + (Math.sin(angle) * endRadius)
            );
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0, p.size || 0), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        if (p.life <= 0) visualParticles.splice(i, 1);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
    requestAnimationFrame(animate);
}

(async function boot() {
    await preloadEnemyIcons();
    init();
    animate();
})();
// <!-- Create By: Vũ Hoài Nam -->
