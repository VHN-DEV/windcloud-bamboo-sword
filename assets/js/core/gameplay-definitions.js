function getInsectCombatPalette(species) {
    const primary = species?.color || '#79ffd4';
    const secondary = species?.secondaryColor || primary;
    const aura = species?.auraColor || secondary;

    return { primary, secondary, aura };
}

function syncInsectVisualMotion(node, desiredX, desiredY, dt, followSpeed = 8, trailLimit = 4) {
    if (!node) return;

    const safeDt = Math.max(0.001, Number(dt) || 0);
    const step = clampNumber((Number(followSpeed) || 8) * safeDt, 0.08, 0.42);
    const currentX = Number.isFinite(node.x) ? node.x : desiredX;
    const currentY = Number.isFinite(node.y) ? node.y : desiredY;

    node.x = currentX + (desiredX - currentX) * step;
    node.y = currentY + (desiredY - currentY) * step;

    if (!Array.isArray(node.trail)) {
        node.trail = [];
    }

    const lastPoint = node.trail[0];
    if (!lastPoint || Math.hypot(lastPoint.x - node.x, lastPoint.y - node.y) >= 1.2) {
        node.trail.unshift({ x: node.x, y: node.y });
    }

    if (node.trail.length > trailLimit) {
        node.trail.length = trailLimit;
    }
}

function drawInsectTrail(ctx, node, color, baseWidth, alpha = 0.22) {
    const points = Array.isArray(node?.trail) ? node.trail : [];
    if (points.length < 2) return;

    for (let index = 1; index < points.length; index++) {
        const from = points[index - 1];
        const to = points[index];
        const fade = 1 - (index / points.length);
        if (fade <= 0) continue;

        ctx.beginPath();
        ctx.strokeStyle = withAlpha(color, alpha * fade);
        ctx.lineWidth = Math.max(0.45, baseWidth * fade);
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    }
}

function normalizeSearchText(value) {
    return repairLegacyText(value)
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
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

const ATTACK_MODE_LABELS = Object.freeze({
    BASE: 'Thanh Trúc Phong Vân Kiếm',
    SWORD: 'Đại Canh Kiếm Trận',
    INSECT: 'Khu Trùng Thuật'
});

const SWORD_SECRET_ART_KEYS = Object.freeze(['THANH_LINH_KIEM_QUYET', 'DAI_CANH_KIEM_TRAN']);

const THANH_LINH_UI_TEXT = Object.freeze({
    SKILL_NAME: 'Thanh Linh Kiem Quyet',
    SKILL_DESCRIPTION: 'Lay than thuc dieu khien Thanh Truc Phong Van Kiem bay quanh than, so kiem xuat tran tang dan theo canh gioi.',
    learned(limit, statLabel) {
        return `Da linh ngo, hien than thuc ${statLabel} co the dieu ${limit} thanh kiem ho than.`;
    },
    pendingInventory() {
        return 'Kiem quyet dang nam trong tui, linh ngo xong moi co the dieu nhieu thanh kiem ho than.';
    },
    baseOnly() {
        return 'Chua linh ngo, hien chi co the ngu 1 thanh kiem va giu kiem the so khoi.';
    }
});

const SWORD_UI_TEXT = Object.freeze({
    CATEGORY_LABEL: 'Pháp bảo kiếm trận',
    SKILL_NAME: 'Đại Canh Kiếm Trận',
    SKILL_DESCRIPTION: 'Khai đại trận hộ thân, ngự kiếm quang trấn thủ và công phạt bốn phương.',
    readyNotifyLearned(required) {
        return `Thanh Trúc Phong Vân Kiếm đã đủ ${required}/${required} thanh, có thể khai triển Đại Canh Kiếm Trận.`;
    },
    readyNotifyNeedArt(required) {
        return `Thanh Trúc Phong Vân Kiếm đã đủ ${required}/${required} thanh, nhưng vẫn cần lĩnh ngộ bí pháp Đại Canh Kiếm Trận.`;
    },
    noteActive(alive) {
        return `${alive} kiếm đang hộ trận`;
    },
    noteReady(bonded, required) {
        return `${bonded} thanh hộ thân, Đại Canh dùng ${required} thanh`;
    },
    noteLearnedPending(bonded, required) {
        return `Đã lĩnh ngộ bí pháp, cần đủ ${required} thanh để khai triển (${bonded}/${required}).`;
    },
    noteInInventory(required) {
        return `Bí pháp đang nằm trong túi, hãy lĩnh ngộ trước rồi mới khai triển khi đủ ${required} thanh.`;
    },
    noteRecovering(bonded, required) {
        return `Đã kết duyên bí pháp nhưng chưa thể phục hồi vật dẫn, hiện có ${bonded}/${required} thanh.`;
    },
    noteCollecting(bonded, required, stockedSuffix = '') {
        return `Đã triển khai ${bonded}/${required} thanh${stockedSuffix}`;
    },
    noteUnknown(required) {
        return `Chưa kết duyên Thanh Trúc Phong Vân Kiếm (${required} thanh)`;
    },
    titleLearned(bonded, required) {
        return `Đại Canh Kiếm Trận - đã lĩnh ngộ, hiện có ${bonded}/${required} thanh`;
    },
    needCount(bonded, required) {
        return `Cần triển khai đủ ${required} thanh Thanh Trúc Phong Vân Kiếm trước khi khai triển Đại Canh Kiếm Trận (${bonded}/${required}).`;
    },
    NEED_ART: 'Chưa lĩnh ngộ bí pháp Đại Canh Kiếm Trận.',
    secretArtDescription(required) {
        return `Kiếm đạo bí pháp chỉ truyền một lần. Mua xong sẽ giữ lại trong túi; chỉ sau khi lĩnh ngộ và đã triển khai đủ ${required} thanh Thanh Trúc Phong Vân Kiếm mới có thể khai triển Đại Canh Kiếm Trận.`;
    },
    deployReady(name, bonded, required) {
        return `Triển khai ${name}: hiện có ${bonded} thanh hộ thân, đã đủ ${required} thanh để khai triển Đại Canh Kiếm Trận.`;
    },
    deployNeedArt(name, bonded, required) {
        return `Triển khai ${name}: hiện có ${bonded} thanh hộ thân, đã đủ ${required} thanh nhưng vẫn cần lĩnh ngộ bí pháp Đại Canh Kiếm Trận.`;
    },
    deployCount(name, bonded) {
        return `Triển khai ${name}: hiện có ${bonded} thanh đang xạ quanh tâm.`;
    },
    learnReady(name, required) {
        return `Lĩnh ngộ ${name}: kiếm trận sẽ vận dụng ${required} thanh, còn phân kiếm hộ thân vẫn giữ theo số đã kết duyên.`;
    },
    learnPending(name, bonded, required) {
        return `Lĩnh ngộ ${name}: đã hiểu kiếm ý, nhưng vẫn cần đủ ${required} thanh Thanh Trúc Phong Vân Kiếm để khai triển kiếm trận (${bonded}/${required}).`;
    }
});

function getStartingSpiritStoneCounts() {
    const source = CONFIG.SPIRIT_STONE?.STARTING_COUNTS || {};

    return {
        LOW: Math.max(0, Math.floor(source.LOW || 0)),
        MEDIUM: Math.max(0, Math.floor(source.MEDIUM || 0)),
        HIGH: Math.max(0, Math.floor(source.HIGH || 0)),
        SUPREME: Math.max(0, Math.floor(source.SUPREME || 0))
    };
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
    LUC_DUC_SUONG_CONG: [{ materialKey: 'LINH_VU', count: 2 }, { materialKey: 'DOC_NANG', count: 1 }],
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
    LUC_DUC_SUONG_CONG: ['DOC_NANG', 'LINH_VU'],
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
    LUC_DUC_SUONG_CONG: {
        label: 'Lá»¥c dá»±c hĂ n táº­p',
        summary: 'LÆ°á»£n quanh con má»“i rá»“i phun sÆ°Æ¡ng Ä‘á»™c, káº¿o cháº­m vĂ  khá»‘a hÆ°á»›ng nĂ©.',
        focus: 'swift',
        damageScale: 1.02,
        latchRadius: 21
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

