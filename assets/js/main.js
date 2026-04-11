const random = (min, max) => Math.random() * (max - min) + min;
const canvas = document.getElementById("c");
const enemyIcons = {};
const ctx = canvas.getContext("2d", { alpha: false });
const IS_TOUCH_ENVIRONMENT = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

let scaleFactor = 1;
let width, height;
let frameCount = 0;
let lastTime = performance.now();
let frameNow = lastTime;
let visualParticles = [];
let swordRenderBuffer = [];

function trimVisualParticles(limit = 320) {
    const safeLimit = Math.max(0, Math.floor(limit || 0));
    if (!safeLimit) {
        visualParticles.length = 0;
        return;
    }

    if (visualParticles.length > safeLimit) {
        visualParticles.splice(0, visualParticles.length - safeLimit);
    }
}

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
    item.innerText = repairLegacyText(text);
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

    if (document.body) {
        document.body.classList.toggle('is-touch-device', IS_TOUCH_ENVIRONMENT);
        document.body.classList.toggle('is-mobile-landscape', IS_TOUCH_ENVIRONMENT && window.innerWidth > window.innerHeight);
    }
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
resize();

const QUALITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'SUPREME'];
const STONE_ORDER = ['SUPREME', 'HIGH', 'MEDIUM', 'LOW'];
const numberFormatter = new Intl.NumberFormat('vi-VN');

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
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return '0';
    if (!Number.isFinite(numericValue)) return '∞';
    return numberFormatter.format(Math.floor(numericValue));
}

function getFrameNow() {
    return frameNow;
}

function formatBoostPercent(multiplier) {
    const boostValue = (Number(multiplier) || 0) - 1;
    if (!Number.isFinite(boostValue)) return '+∞%';
    const rounded = Math.round(boostValue * 100);
    return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

const STORAGE_SPECIAL_NUMBER_TAG = '__thanh_truc_special_number__';
const ITEM_DESCRIPTION_COLLAPSE_THRESHOLD = 140;

function serializeForStorage(value) {
    return JSON.stringify(value, (key, currentValue) => {
        if (typeof currentValue === 'number' && !Number.isFinite(currentValue)) {
            if (Number.isNaN(currentValue)) {
                return { [STORAGE_SPECIAL_NUMBER_TAG]: 'NaN' };
            }

            return {
                [STORAGE_SPECIAL_NUMBER_TAG]: currentValue > 0 ? 'Infinity' : '-Infinity'
            };
        }

        return currentValue;
    });
}

function parseStoredJson(serializedValue) {
    return JSON.parse(serializedValue, (key, currentValue) => {
        if (
            currentValue
            && typeof currentValue === 'object'
            && !Array.isArray(currentValue)
            && Object.prototype.hasOwnProperty.call(currentValue, STORAGE_SPECIAL_NUMBER_TAG)
        ) {
            const specialValue = currentValue[STORAGE_SPECIAL_NUMBER_TAG];

            if (specialValue === 'Infinity') return Number.POSITIVE_INFINITY;
            if (specialValue === '-Infinity') return Number.NEGATIVE_INFINITY;
            if (specialValue === 'NaN') return Number.NaN;
        }

        return currentValue;
    });
}

function escapeHtml(value) {
    return repairLegacyText(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildItemDescriptionContentMarkup(description) {
    const normalizedDescription = repairLegacyText(description).trim();
    const sideEffectMarker = 'Tác dụng phụ:';
    const markerIndex = normalizedDescription.indexOf(sideEffectMarker);

    if (markerIndex === -1) {
        return escapeHtml(normalizedDescription);
    }

    const mainText = normalizedDescription.slice(0, markerIndex).trim();
    const sideText = normalizedDescription.slice(markerIndex + sideEffectMarker.length).trim();

    return `
        ${mainText ? escapeHtml(mainText) : ''}
        <span class="item-description__side-effect">
            <span class="item-description__side-label">${escapeHtml(sideEffectMarker)}</span>
            ${escapeHtml(sideText)}
        </span>
    `.trim();
}

function hslaColor(h, s, l, a = 1) {
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;
}

function getSafeProgressPercent(current, max) {
    const currentValue = Number(current);
    const maxValue = Number(max);

    if (!Number.isFinite(currentValue) && !Number.isFinite(maxValue)) return 100;
    if (!Number.isFinite(maxValue)) return 100;
    if (!Number.isFinite(currentValue)) return 100;
    if (maxValue <= 0) return 0;

    return Math.max(0, Math.min(100, (currentValue / maxValue) * 100));
}

function getRankAccentColor(rank) {
    return rank?.accentColor || rank?.color || '#8fffe0';
}

function getRankLightColor(rank) {
    return rank?.lightColor || getRankAccentColor(rank);
}

function getRankBarBackground(rank) {
    if (rank?.barGradient) return rank.barGradient;
    return `linear-gradient(90deg, ${getRankLightColor(rank)}, ${getRankAccentColor(rank)})`;
}

function applyRankTextVisual(element, rank) {
    if (!element) return;

    const textGradient = rank?.textGradient || '';
    const accentColor = getRankAccentColor(rank);

    element.style.background = textGradient || 'none';
    element.style.webkitBackgroundClip = textGradient ? 'text' : '';
    element.style.backgroundClip = textGradient ? 'text' : '';
    element.style.webkitTextFillColor = textGradient ? 'transparent' : '';
    element.style.color = textGradient ? 'transparent' : accentColor;
    element.style.textShadow = textGradient
        ? '0 0 14px rgba(255, 255, 255, 0.35)'
        : '';
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function withAlpha(color, alpha = 1) {
    const safeAlpha = clampNumber(Number(alpha) || 0, 0, 1);
    const normalized = String(color || '').trim();

    if (!normalized) {
        return `rgba(121, 255, 212, ${safeAlpha})`;
    }

    const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3 || hex.length === 4) {
            hex = hex.split('').map(char => char + char).join('');
        }

        const baseHex = hex.length === 8 ? hex.slice(0, 6) : hex;
        const baseAlpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        const r = parseInt(baseHex.slice(0, 2), 16);
        const g = parseInt(baseHex.slice(2, 4), 16);
        const b = parseInt(baseHex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${(baseAlpha * safeAlpha).toFixed(3)})`;
    }

    const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
        const parts = rgbMatch[1].split(',').map(part => part.trim());
        if (parts.length >= 3) {
            const baseAlpha = parts[3] != null ? clampNumber(Number(parts[3]) || 0, 0, 1) : 1;
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${(baseAlpha * safeAlpha).toFixed(3)})`;
        }
    }

    const hslMatch = normalized.match(/^hsla?\(([^)]+)\)$/i);
    if (hslMatch) {
        const parts = hslMatch[1].split(',').map(part => part.trim());
        if (parts.length >= 3) {
            const baseAlpha = parts[3] != null ? clampNumber(Number(parts[3]) || 0, 0, 1) : 1;
            return `hsla(${parts[0]}, ${parts[1]}, ${parts[2]}, ${(baseAlpha * safeAlpha).toFixed(3)})`;
        }
    }

    return normalized;
}

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

const Input = {
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
        PHONG_LOI_SI: false,
        HUYET_SAC_PHI_PHONG: false
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

        GameProgress.requestSave();
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

    reformSwordFormationState({ rebuildAll = false } = {}) {
        if (typeof syncSwordFormation !== 'function' || typeof swords === 'undefined' || !Array.isArray(swords)) {
            return false;
        }

        syncSwordFormation({ rebuildAll });

        const anchorX = typeof guardCenter !== 'undefined' ? guardCenter.x : this.x;
        const anchorY = typeof guardCenter !== 'undefined' ? guardCenter.y : this.y;
        const activeStates = this.getActiveSwordArtifactStates({
            mode: this.attackMode === 'SWORD' ? 'SWORD' : 'BASE'
        });

        swords.forEach((sword, index) => {
            if (!sword) return;

            sword.index = index;
            sword.layer = Math.floor(index / 24);
            if (typeof sword.bindArtifactState === 'function') {
                sword.bindArtifactState(activeStates[index] || null);
            }
            sword.maxHp = Math.max(1, sword.getArtifactDurabilityValue ? sword.getArtifactDurabilityValue() : (sword.maxHp || 1));
            sword.hp = sword.maxHp;
            sword.isDead = false;
            sword.fragments = [];
            sword.x = anchorX;
            sword.y = anchorY;
            sword.vx = 0;
            sword.vy = 0;
            sword.drawAngle = 0;
            sword.trail = [];
            sword.attackFrame = 0;
            sword.pierceCount = 0;
            sword.isReturning = false;
            sword.isStunned = false;
            sword.stunTimer = 0;
            sword.isEnlarged = false;
            sword.currentVisualScale = 1;
            sword.targetVisualScale = 1;
            sword.lastUltimateHitAt = 0;
        });

        if (typeof updateSwordCounter === 'function') {
            updateSwordCounter(swords);
        }

        return true;
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

        this.resetAttackState();
        this.rankIndex = maxRankIndex;
        this.exp = maxRank.exp;
        this.isReadyToBreak = false;
        this.breakthroughBonus = 0;
        this.syncDerivedStats();
        this.mana = this.maxMana;
        this.reformSwordFormationState({ rebuildAll: true });
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
        const isBlinkTransiting = this.isPhongLoiBlinkTransiting();

        // 1. Tính toán chi phí di chuyển
        // Nếu tốc độ > 1 (tránh nhiễu khi chuột rung nhẹ)
        if (!isBlinkTransiting && this.speed > 1) {
            costTick += CONFIG.MANA.COST_MOVE_PER_SEC * dt;
        }

        // 2. Tính toán chi phí tấn công
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
            const percentage = getSafeProgressPercent(this.mana, this.maxMana);
            bar.style.width = percentage + '%';
            text.innerText = `Linh lực: ${formatNumber(this.mana)}/${formatNumber(this.maxMana)}`;

            // Logic đổi màu khi mana thấp (đã khai báo trong SCSS)
            if (Number.isFinite(percentage) && percentage < 20) {
                bar.classList.add('low-mana');
            } else {
                bar.classList.remove('low-mana');
            }
        }

        if (ProfileUI && typeof ProfileUI.isOpen === 'function' && ProfileUI.isOpen()) {
            ProfileUI.render();
        }

        GameProgress.requestSave();
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

        if (this.rankIndex >= this.getMaxRankIndex() || currentRank.infiniteStats) {
            this.exp = currentRank.exp;
            this.isReadyToBreak = false;
            this.renderExpUI();
            return;
        }

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

        if (false && item.category === 'SWORD_ARTIFACT' && this.getBondedSwordCount() >= getConfiguredSwordCount()) {
            showNotify(
                `Đã triển khai đủ ${formatNumber(getConfiguredSwordCount())} thanh Thanh Trúc Phong Vân Kiếm.`,
                qualityConfig.color || '#66f0c2'
            );
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

        if (item.category === 'ARTIFACT' && this.hasArtifactUnlocked(item.uniqueKey)) {
            showNotify(`${this.getItemDisplayName(item)} đã được luyện hóa, chỉ cần vào Bảng Bí Pháp để triển khai.`, qualityConfig.color || '#9fe8ff');
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
            case 'SWORD_ARTIFACT': {
                const wasUnlocked = this.hasDaiCanhKiemTranUnlocked();
                this.bondedSwordCount = this.getBondedSwordCount() + 1;
                const unlocked = this.syncDaiCanhKiemTranProgress();
                const progress = this.getSwordFormationProgress();
                syncSwordFormation();
                showNotify(
                    unlocked && !wasUnlocked
                        ? `Triển khai ${this.getItemDisplayName(item)}: đã đủ ${formatNumber(progress.required)}/${formatNumber(progress.required)} thanh, có thể khai triển Đại Canh Kiếm Trận.`
                        : `Triển khai ${this.getItemDisplayName(item)}: ${formatNumber(progress.bonded)}/${formatNumber(progress.required)} thanh đang hộ thân.`,
                    qualityConfig.color || '#66f0c2'
                );
                this.refreshResourceUI();
                return true;
            }
            case 'SWORD_ART':
                this.bondedSwordCount = Math.max(this.getBondedSwordCount(), getConfiguredSwordCount());
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
            case 'ARTIFACT':
                this.unlockCultivationArt(item.uniqueKey);
                this.setArtifactDeployment(item.uniqueKey, true, { silent: true, skipRefresh: true });
                showNotify(
                    `Luyện hóa ${this.getItemDisplayName(item)}: ${this.getArtifactAttunementNote(item.uniqueKey)}`,
                    qualityConfig.color || '#9fe8ff'
                );
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

        if (item.category === 'ARTIFACT' && this.hasArtifactUnlocked(item.uniqueKey)) {
            showNotify(`${this.getItemDisplayName(item)} đã được luyện hóa, chỉ cần vào Bảng Bí Pháp để triển khai.`, qualityConfig.color || '#9fe8ff');
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
            case 'ARTIFACT':
                this.unlockCultivationArt(item.uniqueKey);
                this.setArtifactDeployment(item.uniqueKey, true, { silent: true, skipRefresh: true });
                showNotify(
                    `Luyện hóa ${this.getItemDisplayName(item)}: ${this.getArtifactAttunementNote(item.uniqueKey)}`,
                    qualityConfig.color || '#9fe8ff'
                );
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
        if (this.rankIndex >= this.getMaxRankIndex() || rank.infiniteStats) return 0;

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
        if (this.hasSevenColorInventoryBag()) {
            return Number.POSITIVE_INFINITY;
        }

        const baseCapacity = Math.max(
            parseInt(CONFIG.ITEMS.INVENTORY_BASE_CAPACITY, 10) || 0,
            parseInt(CONFIG.ITEMS.INVENTORY_MIN_SLOTS, 10) || 16
        );

        return Math.max(baseCapacity, Math.floor(this.inventoryCapacity || 0));
    },

    hasSevenColorInventoryBag() {
        return this.hasUniquePurchase('THAT_SAC_TRU_VAT_NANG');
    },

    hasSevenColorSpiritBag() {
        return this.hasUniquePurchase('THAT_SAC_LINH_THU_DAI');
    },

    hasInventorySpaceForSpec(spec) {
        if (this.hasSevenColorInventoryBag()) {
            return true;
        }

        const itemKey = this.buildInventoryKey(spec);
        const existingItem = this.inventory[itemKey];

        if (existingItem && existingItem.count > 0) {
            return true;
        }

        return this.getInventoryEntries().length < this.getInventoryCapacity();
    },

    canUpgradeInventoryCapacity(item) {
        if (!item) return false;

        if (item.category === 'RAINBOW_BAG') {
            return !this.hasSevenColorInventoryBag();
        }

        if (this.hasSevenColorInventoryBag() || item.category !== 'BAG') return false;

        const qualityConfig = this.getItemQualityConfig(item);
        return Math.max(0, Math.floor(qualityConfig.capacity || 0)) > 0;
    },

    canUpgradeBeastBagCapacity(item) {
        if (!item) return false;

        if (item.category === 'RAINBOW_SPIRIT_BAG') {
            return !this.hasSevenColorSpiritBag();
        }

        if (item.category === 'SPIRIT_HABITAT') {
            return !this.hasSevenColorSpiritBag() && Boolean(item.speciesKey && this.getInsectSpecies(item.speciesKey));
        }

        if (this.hasSevenColorSpiritBag() || item.category !== 'SPIRIT_BAG') return false;

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
            usageRatio: Number.isFinite(capacity) && capacity > 0 ? (uniqueCount / capacity) : 0
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

    getArtifactMovementSpeedBonusPct() {
        if (this.isVoidCollapsed) return 0;

        return Object.keys(CONFIG.ARTIFACTS || {}).reduce((total, uniqueKey) => {
            if (!this.isArtifactDeployed(uniqueKey)) return total;
            return total + Math.max(0, Number(this.getArtifactConfig(uniqueKey)?.speedBonusPct) || 0);
        }, 0);
    },

    getMovementSpeedMultiplier() {
        return Math.max(0.35, this.getSpeedMultiplier() + this.getArtifactMovementSpeedBonusPct());
    },

    ensureHuyetSacPhiPhongTrail() {
        if (!Array.isArray(this.huyetSacPhiPhongTrail)) {
            this.huyetSacPhiPhongTrail = [];
        }
        return this.huyetSacPhiPhongTrail;
    },

    clearHuyetSacPhiPhongTrail() {
        const trail = this.ensureHuyetSacPhiPhongTrail();
        trail.length = 0;
        return trail;
    },

    updateHuyetSacPhiPhongTrail(anchor, deltaX = 0, deltaY = 0) {
        const trail = this.ensureHuyetSacPhiPhongTrail();
        const active = this.isArtifactDeployed('HUYET_SAC_PHI_PHONG');
        if (!active || !anchor) {
            trail.length = 0;
            return trail;
        }

        const now = performance.now();
        const artifactConfig = this.getArtifactConfig('HUYET_SAC_PHI_PHONG') || {};
        const trailLifetimeMs = Math.max(180, Math.floor(Number(artifactConfig.trailLifetimeMs) || 360));
        const maxTrailPoints = Math.max(6, Math.floor(Number(artifactConfig.maxTrailPoints) || 16));
        const moveDistance = Math.hypot(deltaX, deltaY);
        const restOffset = Math.max(10, Number(artifactConfig.trailOffsetStanding) || Number(artifactConfig.trailOffset) || 18);
        const movingOffset = Math.max(6, Math.min(restOffset, Number(artifactConfig.trailOffsetMoving) || 9));
        const movingFollow = clampNumber(Number(artifactConfig.movingAnchorFollow) || 0.78, 0, 1);

        for (let index = trail.length - 1; index >= 0; index--) {
            if ((now - (trail[index]?.startedAt || 0)) > trailLifetimeMs) {
                trail.splice(index, 1);
            }
        }

        if (moveDistance <= 0.3) {
            return trail;
        }

        const directionX = deltaX / moveDistance;
        const directionY = deltaY / moveDistance;
        const motionRatio = clampNumber(moveDistance / 18, 0, 1);
        const anchorTargetX = Number.isFinite(this.x) ? this.x : anchor.x;
        const anchorTargetY = Number.isFinite(this.y) ? this.y : anchor.y;
        const trailAnchorX = anchor.x + ((anchorTargetX - anchor.x) * motionRatio * movingFollow);
        const trailAnchorY = anchor.y + ((anchorTargetY - anchor.y) * motionRatio * movingFollow);
        const offsetDistance = restOffset + ((movingOffset - restOffset) * motionRatio);

        trail.unshift({
            x: trailAnchorX - (directionX * offsetDistance),
            y: trailAnchorY - (directionY * offsetDistance),
            startedAt: now,
            width: Math.max(14, Math.min(28, 14 + (moveDistance * 1.8)))
        });

        if (trail.length > maxTrailPoints) {
            trail.length = maxTrailPoints;
        }

        return trail;
    },

    drawHuyetSacPhiPhongTrail(ctx, scaleFactor) {
        const trail = this.ensureHuyetSacPhiPhongTrail();
        if (!trail.length || !this.isArtifactDeployed('HUYET_SAC_PHI_PHONG')) return;

        const artifactConfig = this.getArtifactConfig('HUYET_SAC_PHI_PHONG') || {};
        const primaryColor = artifactConfig.color || '#ff5d73';
        const secondaryColor = artifactConfig.secondaryColor || '#ffd0d6';
        const auraColor = artifactConfig.auraColor || '#b81531';
        const now = performance.now();
        const trailLifetimeMs = Math.max(180, Math.floor(Number(artifactConfig.trailLifetimeMs) || 360));

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();

            let started = false;
            for (let index = 0; index < trail.length; index++) {
                const point = trail[index];
                if (!point) continue;

                const ageRatio = clampNumber((now - point.startedAt) / trailLifetimeMs, 0, 1);
                if (ageRatio >= 1) continue;

                if (!started) {
                    ctx.moveTo(point.x, point.y);
                    started = true;
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }

            if (!started) {
                continue;
            }

            ctx.strokeStyle = pass === 0
                ? withAlpha(auraColor, 0.3)
                : withAlpha(primaryColor, 0.78);
            ctx.lineWidth = (pass === 0 ? 18 : 8) * scaleFactor;
            ctx.shadowBlur = (pass === 0 ? 20 : 12) * scaleFactor;
            ctx.shadowColor = pass === 0 ? withAlpha(auraColor, 0.56) : withAlpha(primaryColor, 0.88);
            ctx.stroke();
        }

        trail.forEach((point, index) => {
            const ageRatio = clampNumber((now - point.startedAt) / trailLifetimeMs, 0, 1);
            if (ageRatio >= 1) return;

            const alpha = 1 - ageRatio;
            const radius = Math.max(2.2, ((point.width || 16) * 0.24) * (1 - (index / Math.max(1, trail.length * 1.25)))) * scaleFactor;
            const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.4);
            gradient.addColorStop(0, withAlpha('#ffffff', 0.34 * alpha));
            gradient.addColorStop(0.22, withAlpha(secondaryColor, 0.48 * alpha));
            gradient.addColorStop(0.68, withAlpha(primaryColor, 0.3 * alpha));
            gradient.addColorStop(1, withAlpha(auraColor, 0));

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius * 2.4, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    },

    prunePhongLoiBlinkEffects(now = performance.now()) {
        const state = this.ensurePhongLoiBlinkState();
        state.trails = (state.trails || []).filter(effect => (now - effect.startedAt) < effect.durationMs);
        state.afterimages = (state.afterimages || []).filter(effect => (now - effect.startedAt) < effect.durationMs);
        return state;
    },

    beginPhongLoiBlinkCharge(guardCenter) {
        const state = this.ensurePhongLoiBlinkState();
        const cfg = this.getPhongLoiBlinkConfig();
        const now = performance.now();

        trimVisualParticles(260);
        this.updateMana(-cfg.manaCost);
        state.accumulatedDistance = 0;
        state.charging = {
            startedAt: now,
            anchorX: guardCenter.x,
            anchorY: guardCenter.y
        };

        for (let i = 0; i < 6; i++) {
            const angle = random(0, Math.PI * 2);
            const speed = random(1.2, 3.2);
            visualParticles.push({
                type: i % 3 === 0 ? 'square' : 'spark',
                x: guardCenter.x,
                y: guardCenter.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - random(0.2, 1.1),
                size: random(1.8, 3.6),
                sizeVelocity: -0.035,
                friction: 0.93,
                gravity: -0.01,
                life: 0.7,
                decay: random(0.045, 0.07),
                opacity: 0.86,
                color: i % 2 === 0 ? '#9fe8ff' : '#b48cff',
                glow: 10,
                rotation: angle,
                rotationSpeed: random(-0.2, 0.2)
            });
        }

        this.renderPhongLoiBlinkButton();
    },

    startPhongLoiBlinkTransit(guardCenter, destinationX, destinationY, directionX, directionY) {
        const state = this.ensurePhongLoiBlinkState();
        const cfg = this.getPhongLoiBlinkConfig();
        const now = performance.now();
        const originX = guardCenter.x;
        const originY = guardCenter.y;

        trimVisualParticles(280);

        guardCenter.vx = 0;
        guardCenter.vy = 0;

        state.trails.unshift({
            fromX: originX,
            fromY: originY,
            toX: destinationX,
            toY: destinationY,
            directionX,
            directionY,
            startedAt: now,
            durationMs: cfg.trailMs
        });
        state.afterimages.unshift({
            x: originX,
            y: originY,
            directionX,
            directionY,
            startedAt: now,
            durationMs: cfg.afterimageMs
        });

        if (state.trails.length > 6) state.trails.length = 6;
        if (state.afterimages.length > 5) state.afterimages.length = 5;

        state.charging = null;
        state.transiting = {
            startedAt: now,
            durationMs: cfg.transitionMs,
            originX,
            originY,
            destinationX,
            destinationY
        };
        state.lastBlinkAt = now;

        this.createPhongLoiBlinkBurst(originX, originY, directionX, directionY, { arrival: false });
        this.createPhongLoiBlinkBurst(destinationX, destinationY, directionX, directionY, { arrival: true });
        this.renderPhongLoiBlinkButton();
        return true;
    },

    updatePhongLoiBlinkMotion(guardCenter, movementDx, movementDy) {
        const now = performance.now();
        const state = this.prunePhongLoiBlinkEffects(now);
        const cfg = this.getPhongLoiBlinkConfig();

        if (!this.hasPhongLoiBlinkSkill()) {
            if (state.enabled || state.charging || state.trails.length || state.afterimages.length) {
                this.resetPhongLoiBlinkState({ clearEffects: true });
                this.renderPhongLoiBlinkButton();
            }
            return;
        }

        if (state.transiting) {
            const transit = state.transiting;
            const progress = clampNumber((now - transit.startedAt) / Math.max(1, transit.durationMs || 1), 0, 1);
            const eased = 1 - Math.pow(1 - progress, 4);

            guardCenter.x = transit.originX + ((transit.destinationX - transit.originX) * eased);
            guardCenter.y = transit.originY + ((transit.destinationY - transit.originY) * eased);
            guardCenter.vx = 0;
            guardCenter.vy = 0;

            if (progress >= 1) {
                guardCenter.x = transit.destinationX;
                guardCenter.y = transit.destinationY;
                state.transiting = null;
            }
            return;
        }

        if (state.charging) {
            state.charging.anchorX = guardCenter.x;
            state.charging.anchorY = guardCenter.y;

            if ((now - state.charging.startedAt) >= cfg.chargeMs) {
                const directionLength = Math.hypot(state.lastMoveVectorX, state.lastMoveVectorY);
                if (directionLength < 0.5) {
                    state.charging = null;
                    return;
                }

                const safeMargin = Math.max(18, 26 * scaleFactor);
                const minVisible = Camera.screenToWorld(safeMargin, safeMargin);
                const maxVisible = Camera.screenToWorld(window.innerWidth - safeMargin, window.innerHeight - safeMargin);
                const targetDx = this.x - guardCenter.x;
                const targetDy = this.y - guardCenter.y;
                const targetDistance = Math.hypot(targetDx, targetDy);
                const desiredBlinkDistance = (!this.isTouchDevice && !this.moveJoystick.active && targetDistance > cfg.minMoveSpeed)
                    ? Math.min(cfg.blinkDistance, Math.max(cfg.minBlinkDistance, targetDistance))
                    : cfg.blinkDistance;
                const destinationX = clampNumber(guardCenter.x + (state.lastMoveVectorX * desiredBlinkDistance), minVisible.x, maxVisible.x);
                const destinationY = clampNumber(guardCenter.y + (state.lastMoveVectorY * desiredBlinkDistance), minVisible.y, maxVisible.y);
                const actualDistance = Math.hypot(destinationX - guardCenter.x, destinationY - guardCenter.y);

                if (actualDistance < Math.max(16, cfg.minBlinkDistance * 0.45)) {
                    state.charging = null;
                    state.accumulatedDistance = 0;
                    return;
                }

                const directionX = (destinationX - guardCenter.x) / actualDistance;
                const directionY = (destinationY - guardCenter.y) / actualDistance;
                this.startPhongLoiBlinkTransit(guardCenter, destinationX, destinationY, directionX, directionY);
            }
            return;
        }

        if (!state.enabled) {
            state.accumulatedDistance = 0;
            return;
        }

        const movementDistance = Math.hypot(movementDx, movementDy);
        if (movementDistance < cfg.minMoveSpeed) {
            state.accumulatedDistance = 0;
            return;
        }

        const targetDx = this.x - guardCenter.x;
        const targetDy = this.y - guardCenter.y;
        const targetDistance = Math.hypot(targetDx, targetDy);

        if (targetDistance >= cfg.minMoveSpeed) {
            state.lastMoveVectorX = targetDx / targetDistance;
            state.lastMoveVectorY = targetDy / targetDistance;
        } else {
            state.lastMoveVectorX = movementDx / movementDistance;
            state.lastMoveVectorY = movementDy / movementDistance;
        }

        state.accumulatedDistance += movementDistance;

        if (state.accumulatedDistance < cfg.triggerTravelDistance) return;
        if ((now - (state.lastBlinkAt || 0)) < cfg.cooldownMs) return;

        const directionLength = Math.hypot(state.lastMoveVectorX, state.lastMoveVectorY);
        if (directionLength < 0.5) {
            state.accumulatedDistance = 0;
            return;
        }

        if (this.mana < cfg.manaCost) {
            state.accumulatedDistance = 0;

            if ((now - (state.lastFailAt || 0)) > 900) {
                state.lastFailAt = now;
                showNotify('Phong Lôi Sí thiếu linh lực để xé không gian.', this.getArtifactConfig('PHONG_LOI_SI')?.color || '#9fe8ff');
                this.triggerManaShake();
            }
            return;
        }

        this.beginPhongLoiBlinkCharge(guardCenter);
    },

    syncLandscapeMode() {
        const isLandscape = this.isTouchDevice && window.innerWidth > window.innerHeight;

        if (document.body) {
            document.body.classList.toggle('is-mobile-landscape', isLandscape);
        }

        if (!isLandscape && screen.orientation?.unlock) {
            try {
                screen.orientation.unlock();
            } catch (error) {
                // Trình duyệt có thể từ chối unlock ngoài fullscreen.
            }
        }

        return isLandscape;
    },

    requestLandscapeMode() {
        if (!this.isTouchDevice || !this.syncLandscapeMode()) return;

        const now = performance.now();
        if (now - (this.landscapeMode.lastRequestAt || 0) < 600) return;
        this.landscapeMode.lastRequestAt = now;

        const root = document.documentElement;
        let fullscreenTask = Promise.resolve(null);

        if (!document.fullscreenElement) {
            try {
                if (typeof root.requestFullscreen === 'function') {
                    fullscreenTask = Promise.resolve(root.requestFullscreen({ navigationUI: 'hide' })).catch(() => null);
                } else if (typeof root.webkitRequestFullscreen === 'function') {
                    root.webkitRequestFullscreen();
                }
            } catch (error) {
                fullscreenTask = Promise.resolve(null);
            }
        }

        Promise.resolve(fullscreenTask).finally(() => {
            if (screen.orientation?.lock) {
                screen.orientation.lock('landscape').catch(() => null);
            }
        });
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

    getTouchHitTarget(target = null, clientX = null, clientY = null) {
        if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
            const pointTarget = document.elementFromPoint(clientX, clientY);
            if (pointTarget instanceof Element) return pointTarget;
        }

        return target instanceof Element ? target : null;
    },

    isUiInteractionTarget(target) {
        if (!(target instanceof Element)) return false;

        return Boolean(
            target.closest('.controls-layer') ||
            target.closest('.popup-overlay') ||
            target.closest('#mana-container') ||
            target.closest('#exp-container') ||
            target.closest('#sword-counter') ||
            target.closest('button, input, select, textarea, label, a, summary')
        );
    },

    updateTouchCursor(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
        this.screenX = clientX;
        this.screenY = clientY;
    },

    startTouchCursor(pointerId, target, clientX, clientY) {
        if (!this.isTouchDevice || pointerId == null) return false;
        if (hasVisiblePopupOverlay()) return false;

        const hitTarget = this.getTouchHitTarget(target, clientX, clientY);
        if (this.isUiInteractionTarget(hitTarget)) return false;

        this.touchCursor.active = true;
        this.touchCursor.pointerId = pointerId;
        this.updateTouchCursor(clientX, clientY);
        return true;
    },

    stopTouchCursor(pointerId = null) {
        if (!this.touchCursor.active) return;
        if (pointerId !== null && this.touchCursor.pointerId !== pointerId) return;

        this.touchCursor.active = false;
        this.touchCursor.pointerId = null;
    },

    hasActiveTouchCursor() {
        return this.touchCursor.active && !this.pinchZoomActive;
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
            capacity: this.getBeastBagUpgradeCapacity(),
            buyPriceLowStone: Math.max(0, Math.floor(shopInfo.habitatBuyPriceLowStone || 0)),
            buttonLabel: 'Mua'
        };
    },

    getBeastBagUpgradeCapacity() {
        return Math.max(
            1,
            Math.floor(
                CONFIG.INSECT?.BEAST_BAG?.capacity
                || CONFIG.INSECT?.STARTING_BEAST_BAG_CAPACITY
                || 1
            )
        );
    },

    ensureInsectHabitatCapacities() {
        if (!this.insectHabitatCapacities || typeof this.insectHabitatCapacities !== 'object' || Array.isArray(this.insectHabitatCapacities)) {
            this.insectHabitatCapacities = {};
        }

        if (this.beastBagCapacityMigrated) {
            return this.insectHabitatCapacities;
        }

        const purchasedSpeciesKeys = Object.keys(this.insectHabitats || {})
            .filter(speciesKey => this.insectHabitats[speciesKey] && this.getInsectSpecies(speciesKey));
        const migratedBaseCapacity = (() => {
            const legacyCapacity = Math.max(0, Math.floor(this.beastBagCapacity || 0));
            if (!purchasedSpeciesKeys.length || legacyCapacity <= 0) {
                return this.getBeastBagUpgradeCapacity();
            }

            return Math.max(
                this.getBeastBagUpgradeCapacity(),
                Math.ceil(legacyCapacity / purchasedSpeciesKeys.length)
            );
        })();

        purchasedSpeciesKeys.forEach(speciesKey => {
            const currentCapacity = Math.max(0, Math.floor(this.insectHabitatCapacities[speciesKey] || 0));
            if (currentCapacity <= 0) {
                this.insectHabitatCapacities[speciesKey] = migratedBaseCapacity;
            }
        });

        this.beastBagCapacityMigrated = true;
        return this.insectHabitatCapacities;
    },

    getInsectHabitatCapacity(speciesKey) {
        if (!speciesKey) return 0;

        const habitatKey = this.getSpeciesHabitatKey(speciesKey);
        if (habitatKey === 'RAINBOW') {
            return Number.POSITIVE_INFINITY;
        }

        if (!this.insectHabitats?.[speciesKey]) {
            return 0;
        }

        const capacities = this.ensureInsectHabitatCapacities();
        return Math.max(0, Math.floor(capacities[speciesKey] || 0));
    },

    upgradeInsectHabitatCapacity(speciesKey, extraCapacity = this.getBeastBagUpgradeCapacity(), { unlock = true } = {}) {
        if (!this.getInsectSpecies(speciesKey)) return 0;

        const safeExtraCapacity = Math.max(0, Math.floor(extraCapacity || 0));
        if (!this.insectHabitats) this.insectHabitats = {};
        if (unlock) this.insectHabitats[speciesKey] = true;

        const capacities = this.ensureInsectHabitatCapacities();
        const currentCapacity = Math.max(0, Math.floor(capacities[speciesKey] || 0));
        const nextCapacity = currentCapacity + safeExtraCapacity;
        capacities[speciesKey] = nextCapacity;
        this.markDiscoveredInsect(speciesKey);
        return nextCapacity;
    },

    getInsectHabitatOccupancy(speciesKey) {
        return Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
    },

    getInsectHabitatFreeSlots(speciesKey) {
        const capacity = this.getInsectHabitatCapacity(speciesKey);
        if (!Number.isFinite(capacity)) return Number.POSITIVE_INFINITY;
        return Math.max(0, capacity - this.getInsectHabitatOccupancy(speciesKey));
    },

    getSpeciesHabitatKey(speciesKey) {
        if (this.insectHabitats?.[speciesKey]) return speciesKey;
        if (this.hasSevenColorSpiritBag()) return 'RAINBOW';
        return null;
    },

    isSpeciesInRainbowHabitat(speciesKey) {
        return this.getSpeciesHabitatKey(speciesKey) === 'RAINBOW';
    },

    needsSpeciesManualFeeding(speciesKey) {
        const habitatKey = this.getSpeciesHabitatKey(speciesKey);
        return Boolean(habitatKey && habitatKey !== 'RAINBOW');
    },

    hasInsectHabitat(speciesKey) {
        return Boolean(this.getSpeciesHabitatKey(speciesKey));
    },

    unlockInsectHabitat(speciesKey) {
        if (!this.getInsectSpecies(speciesKey)) return false;
        if (!this.insectHabitats) this.insectHabitats = {};
        this.insectHabitats[speciesKey] = true;
        this.ensureInsectHabitatCapacities();
        if (Math.max(0, Math.floor(this.insectHabitatCapacities?.[speciesKey] || 0)) <= 0) {
            this.insectHabitatCapacities[speciesKey] = this.getBeastBagUpgradeCapacity();
        }
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

    ensureBeastFoodStorageShape() {
        if (!this.beastFoodStorage || typeof this.beastFoodStorage !== 'object' || Array.isArray(this.beastFoodStorage)) {
            this.beastFoodStorage = {};
            return this.beastFoodStorage;
        }

        const values = Object.values(this.beastFoodStorage);
        const hasNestedBuckets = values.some(value => value && typeof value === 'object' && !Array.isArray(value));
        if (!hasNestedBuckets && values.length > 0) {
            const sharedBucket = {};
            Object.entries(this.beastFoodStorage).forEach(([materialKey, count]) => {
                const safeCount = Math.max(0, Math.floor(count || 0));
                if (safeCount > 0) sharedBucket[materialKey] = safeCount;
            });
            this.beastFoodStorage = Object.keys(sharedBucket).length ? { _SHARED: sharedBucket } : {};
        }

        return this.beastFoodStorage;
    },

    getFoodStorageBucket(habitatKey = '_SHARED', { create = false } = {}) {
        const storage = this.ensureBeastFoodStorageShape();
        const safeHabitatKey = habitatKey || '_SHARED';
        const existing = storage[safeHabitatKey];

        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
            return existing;
        }

        if (!create) return null;
        storage[safeHabitatKey] = {};
        return storage[safeHabitatKey];
    },

    getFoodStorageCount(materialKey, habitatKey = '_SHARED', { includeShared = true } = {}) {
        const readCount = (bucketKey) => {
            const bucket = this.getFoodStorageBucket(bucketKey);
            return Math.max(0, Math.floor(bucket?.[materialKey] || 0));
        };

        const safeHabitatKey = habitatKey || '_SHARED';
        let total = readCount(safeHabitatKey);
        if (includeShared && safeHabitatKey !== '_SHARED') {
            total += readCount('_SHARED');
        }

        return total;
    },

    getFoodStorageEntries(habitatKey = null, { includeShared = true } = {}) {
        const storage = this.ensureBeastFoodStorageShape();
        const mergedCounts = {};

        const mergeBucket = (bucketKey) => {
            const bucket = storage[bucketKey];
            if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return;

            Object.entries(bucket).forEach(([materialKey, count]) => {
                const safeCount = Math.max(0, Math.floor(count || 0));
                if (safeCount <= 0) return;
                mergedCounts[materialKey] = (mergedCounts[materialKey] || 0) + safeCount;
            });
        };

        if (habitatKey) {
            mergeBucket(habitatKey);
            if (includeShared && habitatKey !== '_SHARED') mergeBucket('_SHARED');
        } else {
            Object.keys(storage).forEach(mergeBucket);
        }

        return Object.entries(mergedCounts)
            .map(([materialKey, count]) => ({
                materialKey,
                count,
                materialConfig: this.getMaterialConfig(materialKey)
            }))
            .filter(entry => entry.materialConfig && entry.count > 0)
            .sort((a, b) => {
                const qualityDiff = QUALITY_ORDER.indexOf(b.materialConfig.quality || 'LOW') - QUALITY_ORDER.indexOf(a.materialConfig.quality || 'LOW');
                if (qualityDiff !== 0) return qualityDiff;
                return (a.materialConfig.fullName || a.materialKey).localeCompare(b.materialConfig.fullName || b.materialKey, 'vi');
            });
    },

    getHabitatFoodNutritionAvailable(habitatKey = null, { includeShared = true } = {}) {
        return this.getFoodStorageEntries(habitatKey, { includeShared }).reduce((total, entry) => {
            const nutrition = Math.max(0, Number(entry.materialConfig?.nutrition) || 0);
            return total + (entry.count * nutrition);
        }, 0);
    },

    storeMaterialAsFood(materialKey, count = 1, habitatKey = '_SHARED') {
        const safeCount = Math.max(0, Math.floor(count || 0));
        if (safeCount <= 0) return 0;

        const materialConfig = this.getMaterialConfig(materialKey);
        if (!materialConfig || Math.max(0, Number(materialConfig.nutrition) || 0) <= 0) return 0;

        const transferred = this.consumeMaterial(materialKey, safeCount);
        if (transferred <= 0) return 0;

        const bucket = this.getFoodStorageBucket(habitatKey, { create: true });
        bucket[materialKey] = Math.max(0, Math.floor(bucket[materialKey] || 0)) + transferred;
        return transferred;
    },

    consumeStoredFood(materialKey, count = 1, habitatKey = '_SHARED', { allowSharedFallback = true } = {}) {
        const safeCount = Math.max(0, Math.floor(count || 0));
        if (safeCount <= 0) return 0;

        const consumeFromBucket = (bucketKey, neededCount) => {
            if (neededCount <= 0) return 0;
            const bucket = this.getFoodStorageBucket(bucketKey);
            const currentCount = Math.max(0, Math.floor(bucket?.[materialKey] || 0));
            if (currentCount <= 0) return 0;

            const consumed = Math.min(currentCount, neededCount);
            const nextCount = currentCount - consumed;

            if (nextCount <= 0) delete bucket[materialKey];
            else bucket[materialKey] = nextCount;

            return consumed;
        };

        const safeHabitatKey = habitatKey || '_SHARED';
        let consumed = consumeFromBucket(safeHabitatKey, safeCount);

        if (allowSharedFallback && safeHabitatKey !== '_SHARED' && consumed < safeCount) {
            consumed += consumeFromBucket('_SHARED', safeCount - consumed);
        }

        return consumed;
    },

    createDefaultInsectColony(speciesKey, count = 0) {
        const safeCount = Math.max(0, Math.floor(count || 0));
        if (safeCount <= 0) return null;

        const species = this.getInsectSpecies(speciesKey);
        let male = 0;
        let female = 0;

        if (safeCount === 1) {
            const preferFemale = (species?.fertility || 1) >= (species?.attackFactor || 1);
            male = preferFemale ? 0 : 1;
            female = preferFemale ? 1 : 0;
        } else {
            male = Math.max(1, Math.floor(safeCount / 2));
            female = safeCount - male;
            if (female <= 0) {
                female = 1;
                male = Math.max(1, safeCount - female);
            }
        }

        const leaderGender = female > male ? 'FEMALE' : 'MALE';

        return {
            male,
            female,
            leaderGender,
            leaderPower: this.rollInsectPower(speciesKey, 'leader')
        };
    },

    rollInsectPower(speciesKey, source = 'wild') {
        const species = this.getInsectSpecies(speciesKey);
        const attack = Number(species?.attackFactor) || 1;
        const vitality = Number(species?.vitality) || 1;
        const fertility = Number(species?.fertility) || 1;
        const sourceBonus = source === 'breed' ? 0.08 : (source === 'leader' ? 0.12 : 0);
        const variance = 0.82 + (Math.random() * 0.58);
        return Number((((attack * 1.4) + (vitality * 0.95) + (fertility * 0.7)) * variance + sourceBonus).toFixed(3));
    },

    ensureInsectColony(speciesKey, targetCount = null) {
        const safeTargetCount = Math.max(0, Math.floor(
            targetCount === null
                ? (this.tamedInsects?.[speciesKey] || 0)
                : targetCount
        ));

        if (safeTargetCount <= 0) {
            if (this.insectColonies?.[speciesKey]) delete this.insectColonies[speciesKey];
            if (this.insectSatiety?.[speciesKey]) delete this.insectSatiety[speciesKey];
            return null;
        }

        if (!this.insectColonies) this.insectColonies = {};
        const existing = this.insectColonies[speciesKey];

        if (!existing) {
            const colony = this.createDefaultInsectColony(speciesKey, safeTargetCount);
            this.insectColonies[speciesKey] = colony;
            return colony;
        }

        existing.male = Math.max(0, Math.floor(existing.male || 0));
        existing.female = Math.max(0, Math.floor(existing.female || 0));

        let total = existing.male + existing.female;
        while (total < safeTargetCount) {
            if (existing.male <= existing.female) existing.male += 1;
            else existing.female += 1;
            total++;
        }

        while (total > safeTargetCount) {
            if (existing.leaderGender === 'MALE' && existing.male <= 1 && existing.female > 0) {
                existing.female -= 1;
            } else if (existing.leaderGender === 'FEMALE' && existing.female <= 1 && existing.male > 0) {
                existing.male -= 1;
            } else if (existing.male >= existing.female && existing.male > 0) {
                existing.male -= 1;
            } else if (existing.female > 0) {
                existing.female -= 1;
            }
            total--;
        }

        if (!existing.leaderGender || (existing.leaderGender === 'MALE' && existing.male <= 0) || (existing.leaderGender === 'FEMALE' && existing.female <= 0)) {
            existing.leaderGender = existing.female > existing.male ? 'FEMALE' : 'MALE';
            existing.leaderPower = this.rollInsectPower(speciesKey, 'leader');
        }

        return existing;
    },

    updateInsectColonyPopulation(speciesKey, previousCount, nextCount, options = {}) {
        const safePreviousCount = Math.max(0, Math.floor(previousCount || 0));
        const safeNextCount = Math.max(0, Math.floor(nextCount || 0));
        const delta = safeNextCount - safePreviousCount;

        if (safeNextCount <= 0) {
            if (this.insectColonies?.[speciesKey]) delete this.insectColonies[speciesKey];
            if (this.insectSatiety?.[speciesKey]) delete this.insectSatiety[speciesKey];
            return null;
        }

        if (!this.insectColonies) this.insectColonies = {};
        const colony = this.ensureInsectColony(speciesKey, safePreviousCount) || {
            male: 0,
            female: 0,
            leaderGender: null,
            leaderPower: 0
        };
        this.insectColonies[speciesKey] = colony;

        if (delta > 0) {
            const source = options.source || 'hatch';
            for (let i = 0; i < delta; i++) {
                const sex = Math.random() < 0.5 ? 'MALE' : 'FEMALE';
                if (sex === 'MALE') colony.male += 1;
                else colony.female += 1;

                const power = this.rollInsectPower(speciesKey, source);
                if (!colony.leaderGender || power >= Math.max(0, Number(colony.leaderPower) || 0)) {
                    colony.leaderGender = sex;
                    colony.leaderPower = power;
                }
            }
        } else if (delta < 0) {
            for (let i = 0; i < Math.abs(delta); i++) {
                const removeGender = (() => {
                    if (colony.male <= 0) return 'FEMALE';
                    if (colony.female <= 0) return 'MALE';
                    if (colony.leaderGender === 'MALE' && colony.male <= 1) return 'FEMALE';
                    if (colony.leaderGender === 'FEMALE' && colony.female <= 1) return 'MALE';
                    return colony.male >= colony.female ? 'MALE' : 'FEMALE';
                })();

                if (removeGender === 'MALE' && colony.male > 0) colony.male -= 1;
                else if (colony.female > 0) colony.female -= 1;
            }

            if ((colony.leaderGender === 'MALE' && colony.male <= 0) || (colony.leaderGender === 'FEMALE' && colony.female <= 0)) {
                colony.leaderGender = colony.female > colony.male ? 'FEMALE' : 'MALE';
                colony.leaderPower = this.rollInsectPower(speciesKey, 'leader');
            }
        }

        return this.ensureInsectColony(speciesKey, safeNextCount);
    },

    getSpeciesSexSummary(speciesKey) {
        const colony = this.ensureInsectColony(speciesKey);
        return {
            male: Math.max(0, Math.floor(colony?.male || 0)),
            female: Math.max(0, Math.floor(colony?.female || 0))
        };
    },

    getSpeciesLeaderInfo(speciesKey) {
        const colony = this.ensureInsectColony(speciesKey);
        if (!colony) return null;

        const gender = colony.leaderGender === 'FEMALE' ? 'FEMALE' : 'MALE';
        return {
            gender,
            power: Math.max(0, Number(colony.leaderPower) || 0),
            title: gender === 'FEMALE' ? 'Trùng Hậu' : 'Trùng Vương'
        };
    },

    getSpeciesSatiety(speciesKey) {
        return Math.max(0, Math.floor(this.insectSatiety?.[speciesKey] || 0));
    },

    changeSpeciesSatiety(speciesKey, delta = 0) {
        const safeDelta = Math.trunc(delta || 0);
        if (!safeDelta) return this.getSpeciesSatiety(speciesKey);

        if (!this.insectSatiety) this.insectSatiety = {};
        const nextValue = Math.max(0, this.getSpeciesSatiety(speciesKey) + safeDelta);
        if (nextValue <= 0) delete this.insectSatiety[speciesKey];
        else this.insectSatiety[speciesKey] = nextValue;
        return nextValue;
    },

    consumeSpeciesSatiety(speciesKey, nutritionNeeded = 0) {
        const safeNeed = Math.max(0, Math.ceil(nutritionNeeded || 0));
        if (safeNeed <= 0) {
            return { met: true, consumedNutrition: 0, shortage: 0 };
        }

        const availableNutrition = this.getSpeciesSatiety(speciesKey);
        const consumedNutrition = Math.min(availableNutrition, safeNeed);
        this.changeSpeciesSatiety(speciesKey, -consumedNutrition);

        return {
            met: consumedNutrition >= safeNeed,
            consumedNutrition,
            shortage: Math.max(0, safeNeed - consumedNutrition)
        };
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
        if (!this.needsSpeciesManualFeeding(speciesKey)) return 0;

        const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
        const careConfig = CONFIG.INSECT?.CARE || {};
        const foodPerInsect = Math.max(1, Math.floor(careConfig.FOOD_PER_INSECT || 1));
        return count * foodPerInsect;
    },

    getTotalFoodNutritionAvailable() {
        return this.getHabitatFoodNutritionAvailable();
    },

    getAvailableFoodNutritionForSpecies(speciesKey) {
        if (!this.needsSpeciesManualFeeding(speciesKey)) {
            return Number.POSITIVE_INFINITY;
        }

        const habitatKey = this.getSpeciesHabitatKey(speciesKey);
        const preferredKeys = this.getSpeciesPreferredFoodKeys(speciesKey);
        const allFoodKeys = Object.entries(CONFIG.ITEMS?.MATERIALS || {})
            .filter(([, materialConfig]) => (Number(materialConfig?.nutrition) || 0) > 0)
            .map(([materialKey]) => materialKey);
        const orderedKeys = [...preferredKeys, ...allFoodKeys.filter(materialKey => !preferredKeys.includes(materialKey))];

        return orderedKeys.reduce((total, materialKey) => {
            const materialConfig = this.getMaterialConfig(materialKey);
            const nutrition = Math.max(0, Number(materialConfig?.nutrition) || 0);
            if (nutrition <= 0) return total;
            return total + (this.getFoodStorageCount(materialKey, habitatKey) * nutrition);
        }, 0);
    },

    consumeFoodForSpecies(speciesKey, nutritionNeeded = 0) {
        if (!this.needsSpeciesManualFeeding(speciesKey)) {
            return { met: true, consumedNutrition: 0, consumedItems: [], shortage: 0 };
        }

        const habitatKey = this.getSpeciesHabitatKey(speciesKey);
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

            let availableCount = this.getFoodStorageCount(materialKey, habitatKey);
            while (availableCount > 0 && remainingNutrition > 0) {
                if (this.consumeStoredFood(materialKey, 1, habitatKey) <= 0) break;
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

    feedSpeciesNow(speciesKey, cycles = 1) {
        const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
        if (count <= 0) {
            return { success: false, reason: 'empty', consumedNutrition: 0, shortage: 0 };
        }

        if (!this.needsSpeciesManualFeeding(speciesKey)) {
            return { success: false, reason: 'rainbow', consumedNutrition: 0, shortage: 0 };
        }

        const nutritionNeeded = this.getSpeciesFoodDemand(speciesKey) * Math.max(1, Math.floor(cycles || 1));
        const feedResult = this.consumeFoodForSpecies(speciesKey, nutritionNeeded);
        if (feedResult.consumedNutrition > 0) {
            this.changeSpeciesSatiety(speciesKey, feedResult.consumedNutrition);
        }

        return {
            ...feedResult,
            success: feedResult.consumedNutrition > 0,
            reason: feedResult.met ? 'fed' : (feedResult.consumedNutrition > 0 ? 'partial' : 'no-food')
        };
    },

    feedAllSpeciesNow(cycles = 1) {
        const result = {
            fedSpecies: [],
            partialSpecies: [],
            totalNutrition: 0
        };

        this.getActiveInsectSpeciesKeys().forEach(speciesKey => {
            const feedResult = this.feedSpeciesNow(speciesKey, cycles);
            if (!feedResult.success) return;

            result.totalNutrition += feedResult.consumedNutrition || 0;
            if (feedResult.met) result.fedSpecies.push(speciesKey);
            else result.partialSpecies.push(speciesKey);
        });

        return result;
    },

    getSpeciesCareStatus(speciesKey) {
        const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
        const habitatKey = this.getSpeciesHabitatKey(speciesKey);
        const isRainbowHabitat = habitatKey === 'RAINBOW';
        const needsManualFeeding = this.needsSpeciesManualFeeding(speciesKey);
        const habitatCapacity = this.getBeastBagCapacity(speciesKey);
        const habitatFreeSlots = this.getInsectHabitatFreeSlots(speciesKey);
        const foodDemand = this.getSpeciesFoodDemand(speciesKey);
        const availableFood = isRainbowHabitat
            ? Number.POSITIVE_INFINITY
            : (needsManualFeeding ? this.getAvailableFoodNutritionForSpecies(speciesKey) : 0);
        const habitatConfig = this.getInsectHabitatConfig(speciesKey);
        const sexSummary = this.getSpeciesSexSummary(speciesKey);
        const leaderInfo = this.getSpeciesLeaderInfo(speciesKey);
        const storedSatiety = this.getSpeciesSatiety(speciesKey);
        const preferredFoodKeys = this.getSpeciesPreferredFoodKeys(speciesKey);
        const hasBreedingPair = count >= 2 && sexSummary.male > 0 && sexSummary.female > 0;
        const foodStorageNutrition = isRainbowHabitat
            ? Number.POSITIVE_INFINITY
            : (needsManualFeeding ? this.getHabitatFoodNutritionAvailable(habitatKey) : 0);

        return {
            speciesKey,
            count,
            habitatKey,
            hasHabitat: Boolean(habitatKey),
            habitatName: habitatConfig.fullName,
            isRainbowHabitat,
            habitatCapacity,
            habitatFreeSlots,
            foodDemand,
            availableFood,
            foodStorageNutrition,
            storedSatiety,
            sexSummary,
            leaderInfo,
            preferredFoodKeys,
            hasFood: isRainbowHabitat || foodDemand <= 0 || storedSatiety >= foodDemand,
            canFeed: needsManualFeeding && availableFood > 0,
            needsManualFeeding,
            canReproduce: hasBreedingPair
                && Boolean(habitatKey)
                && this.hasBeastCapacity(1, speciesKey)
                && (isRainbowHabitat || storedSatiety >= foodDemand || availableFood >= foodDemand)
        };
    },

    getHatchPreview(speciesKey, count = 1) {
        const species = this.getInsectSpecies(speciesKey);
        const requestedCount = Math.max(1, Math.floor(count || 1));
        const availableEggs = Math.max(0, Math.floor(this.insectEggs?.[speciesKey] || 0));
        const freeSlots = this.hasInsectHabitat(speciesKey)
            ? this.getInsectHabitatFreeSlots(speciesKey)
            : 0;
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
        const breedChance = Math.max(0, Math.min(1, Number(careConfig.BREED_CHANCE_PER_CYCLE) || 0));
        const result = {
            consumedNutrition: 0,
            hungerLosses: [],
            habitatLosses: [],
            births: []
        };

        this.getActiveInsectSpeciesKeys().forEach(speciesKey => {
            const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
            if (count <= 0) return;

            const careStatus = this.getSpeciesCareStatus(speciesKey);
            const feedResult = this.consumeSpeciesSatiety(speciesKey, careStatus.foodDemand);
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

            if (this.getSpeciesCareStatus(speciesKey).canReproduce && Math.random() < breedChance) {
                this.changeTamedInsects(speciesKey, 1, { source: 'breed' });
                result.births.push(speciesKey);
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
            habitatLosses: [],
            births: []
        };

        for (let cycleIndex = 0; cycleIndex < cycleCount; cycleIndex++) {
            const cycleResult = this.runBeastCareCycle();
            aggregate.consumedNutrition += cycleResult.consumedNutrition || 0;
            aggregate.hungerLosses.push(...(cycleResult.hungerLosses || []));
            aggregate.habitatLosses.push(...(cycleResult.habitatLosses || []));
            aggregate.births.push(...(cycleResult.births || []));
        }

        this.beastCare.lastTickAt += cycleCount * intervalMs;
        if (now - this.beastCare.lastTickAt > intervalMs * maxCycles) {
            this.beastCare.lastTickAt = now;
        }

        if (aggregate.consumedNutrition > 0 || aggregate.hungerLosses.length || aggregate.habitatLosses.length || aggregate.births.length) {
            this.refreshResourceUI();
        }

        const canAlert = (now - Math.max(0, Number(this.beastCare.lastAlertAt) || 0)) >= Math.max(0, Math.floor(careConfig.ALERT_COOLDOWN_MS || 0));
        if (!canAlert || (!aggregate.hungerLosses.length && !aggregate.habitatLosses.length && !aggregate.births.length)) return;

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
        if (aggregate.births.length) {
            notices.push(`Sinh nở: ${formatLossSummary(aggregate.births)}`);
        }

        showNotify(
            notices.join(' | '),
            aggregate.hungerLosses.length || aggregate.habitatLosses.length ? '#ff8a80' : '#79ffd4'
        );
        this.beastCare.lastAlertAt = now;
    },

    getBeastBagCapacity(speciesKey = null) {
        if (speciesKey) {
            return this.getInsectHabitatCapacity(speciesKey);
        }

        if (this.hasSevenColorSpiritBag()) {
            return Number.POSITIVE_INFINITY;
        }

        return Object.keys(this.insectHabitats || {})
            .filter(key => this.insectHabitats[key] && this.getInsectSpecies(key))
            .reduce((total, key) => total + this.getInsectHabitatCapacity(key), 0);
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
        const manualCareSpeciesKeys = activeSpeciesKeys.filter(speciesKey => this.needsSpeciesManualFeeding(speciesKey));
        const safeSpeciesCount = activeSpeciesKeys.filter(speciesKey => this.hasInsectHabitat(speciesKey)).length;
        const foodStock = this.getTotalFoodNutritionAvailable();
        const foodDemand = manualCareSpeciesKeys.reduce((total, speciesKey) => total + this.getSpeciesFoodDemand(speciesKey), 0);
        const foodCycles = foodDemand > 0 ? Math.floor(foodStock / foodDemand) : Number.POSITIVE_INFINITY;
        const reproductiveSpeciesCount = activeSpeciesKeys.filter(speciesKey => this.getSpeciesCareStatus(speciesKey).canReproduce).length;

        return {
            totalEggs,
            totalBeasts,
            capacity,
            freeSlots: Math.max(0, capacity - totalBeasts),
            discoveredCount,
            speciesTotal,
            usageRatio: Number.isFinite(capacity) && capacity > 0 ? (totalBeasts / capacity) : 0,
            foodStock,
            foodDemand,
            foodCycles,
            safeSpeciesCount,
            reproductiveSpeciesCount,
            manualCareSpeciesCount: manualCareSpeciesKeys.length,
            rainbowSpeciesCount: Math.max(0, activeSpeciesKeys.length - manualCareSpeciesKeys.length)
        };
    },

    getBeastBagTabs() {
        const tabs = [
            {
                key: 'all',
                label: 'Tổng đàn',
                note: `${formatNumber(this.getTotalTamedInsectCount())} linh trùng`
            }
        ];

        if (this.hasSevenColorSpiritBag()) {
            return tabs;
        }

        const dedicatedSpeciesKeys = Object.keys(this.insectHabitats || {})
            .filter(speciesKey => this.insectHabitats[speciesKey] && this.getInsectSpecies(speciesKey));

        dedicatedSpeciesKeys
            .sort((a, b) => {
                const speciesA = this.getInsectSpecies(a);
                const speciesB = this.getInsectSpecies(b);
                return (speciesA?.name || a).localeCompare(speciesB?.name || b, 'vi');
            })
            .forEach(speciesKey => {
                const species = this.getInsectSpecies(speciesKey);
                const count = Math.max(0, Math.floor(this.tamedInsects?.[speciesKey] || 0));
                const eggCount = Math.max(0, Math.floor(this.insectEggs?.[speciesKey] || 0));
                const capacity = this.getBeastBagCapacity(speciesKey);
                const capacityText = Number.isFinite(capacity)
                    ? `${formatNumber(count)}/${formatNumber(capacity)} ô`
                    : `${formatNumber(count)}/&infin; ô`;
                const noteParts = [capacityText, 'Ô thức ăn riêng'];
                if (eggCount > 0) noteParts.push(`${formatNumber(eggCount)} trứng`);
                tabs.push({
                    key: `species:${speciesKey}`,
                    label: species?.name || speciesKey,
                    note: noteParts.join(' | ')
                });
            });

        return tabs;
    },

    getBeastTabSpeciesKeys(tabKey = this.selectedBeastBagTab || 'all') {
        const safeTabKey = tabKey || 'all';
        if (safeTabKey === 'all') {
            return this.getInsectSpeciesEntries().map(([speciesKey]) => speciesKey);
        }

        if (safeTabKey === 'rainbow') {
            return this.getInsectSpeciesEntries()
                .map(([speciesKey]) => speciesKey)
                .filter(speciesKey => this.getSpeciesHabitatKey(speciesKey) === 'RAINBOW');
        }

        if (safeTabKey.startsWith('species:')) {
            const speciesKey = safeTabKey.split(':')[1] || '';
            return speciesKey && this.getInsectSpecies(speciesKey) ? [speciesKey] : [];
        }

        return [];
    },

    shouldShowBeastFeedPanel(tabKey = this.selectedBeastBagTab || 'all') {
        if (this.hasSevenColorSpiritBag()) return true;
        return tabKey === 'rainbow' || String(tabKey || '').startsWith('species:');
    },

    ensureValidBeastBagTab() {
        if (this.hasSevenColorSpiritBag()) {
            this.selectedBeastBagTab = 'all';
            return this.selectedBeastBagTab;
        }

        const tabs = this.getBeastBagTabs();
        if (!tabs.some(tab => tab.key === this.selectedBeastBagTab)) {
            this.selectedBeastBagTab = 'all';
        }

        return this.selectedBeastBagTab;
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

    getInventoryEntryByUniqueKey(uniqueKey, categories = null) {
        if (!uniqueKey) return null;

        const allowedCategories = Array.isArray(categories) && categories.length
            ? new Set(categories)
            : null;

        return Object.values(this.inventory || {}).find(item => {
            if (!item || item.uniqueKey !== uniqueKey || item.count <= 0) return false;
            return !allowedCategories || allowedCategories.has(item.category);
        }) || null;
    },

    ensureUniqueInventoryEntry(spec, count = 1) {
        const safeCount = Math.max(1, Math.floor(Number(count) || 0));
        const itemKey = this.buildInventoryKey(spec);

        if (!this.inventory[itemKey]) {
            this.inventory[itemKey] = {
                key: itemKey,
                kind: spec.kind || 'UNIQUE',
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

        this.inventory[itemKey].count = Math.max(
            safeCount,
            Math.floor(Number(this.inventory[itemKey].count) || 0)
        );

        return this.inventory[itemKey];
    },

    restorePendingSecretArts() {
        Object.entries(CONFIG.SECRET_ARTS || {}).forEach(([uniqueKey, artConfig]) => {
            if (!this.hasUniquePurchase(uniqueKey) || this.hasCultivationArt(uniqueKey)) return;

            const category = SWORD_SECRET_ART_KEYS.includes(uniqueKey) ? 'SWORD_ART' : 'FLAME_ART';
            const existingEntry = this.getInventoryEntryByUniqueKey(uniqueKey, [category]);
            if (existingEntry) return;

            this.ensureUniqueInventoryEntry({
                kind: 'UNIQUE',
                category,
                quality: artConfig.quality || 'SUPREME',
                uniqueKey
            }, 1);
        });
    },

    getThanhTrucSwordArtifactConfig() {
        return CONFIG.SWORD?.ARTIFACT_ITEM || null;
    },

    isThanhTrucSwordArtifactItem(item) {
        return Boolean(item && item.category === 'SWORD_ARTIFACT');
    },

    getSwordInstanceSystemConfig() {
        return CONFIG.SWORD?.INSTANCE_SYSTEM || {};
    },

    getSwordControlConfig() {
        return CONFIG.SWORD?.CONTROL || {};
    },

    createSwordArtifactInstanceKey(prefix = 'THANH_TRUC_SWORD') {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    },

    getSwordBasePowerRating() {
        return Math.max(1, Math.floor(Number(this.getSwordInstanceSystemConfig().BASE_POWER_RATING) || 100));
    },

    getSwordDurabilityBaseline(rank = null) {
        const rankData = rank || this.getCurrentRank();
        const minDurability = Math.max(1, Math.floor(Number(this.getSwordInstanceSystemConfig().MIN_DURABILITY) || 1));
        return Math.max(minDurability, Math.floor(Number(rankData?.swordDurability) || 0));
    },

    getRefinedThanhTrucSwordDurability(years = 0) {
        const cfg = this.getSwordInstanceSystemConfig();
        const steps = Math.max(0, Math.floor(Number(years) || 0) / 120);
        const refinedBase = Math.max(1, Math.floor(Number(cfg.REFINED_DURABILITY_BASE) || 8));
        const stepValue = Math.max(1, Math.floor(Number(cfg.REFINED_DURABILITY_PER_120_YEARS) || 2));
        return Math.max(this.getSwordDurabilityBaseline(), refinedBase + Math.floor(steps) * stepValue);
    },

    normalizeSwordArtifactState(state, fallbackItem = null) {
        const safeSource = state && typeof state === 'object' ? state : {};
        const sourceItem = fallbackItem && typeof fallbackItem === 'object' ? fallbackItem : {};
        const instanceKey = String(safeSource.instanceKey || safeSource.id || sourceItem.instanceKey || '').trim()
            || this.createSwordArtifactInstanceKey();
        const source = typeof safeSource.source === 'string'
            ? safeSource.source
            : (typeof sourceItem.source === 'string' ? sourceItem.source : 'SHOP');
        const refineYears = Math.max(0, Math.floor(Number(safeSource.refineYears ?? sourceItem.refineYears) || 0));
        const isRefined = source === 'REFINED' || refineYears > 0;
        const powerRating = Math.max(
            1,
            Math.floor(
                Number(safeSource.powerRating ?? sourceItem.powerRating)
                || (isRefined ? this.getRefinedThanhTrucSwordPower(refineYears) : this.getSwordBasePowerRating())
            )
        );
        const derivedMaxDurability = isRefined
            ? this.getRefinedThanhTrucSwordDurability(refineYears)
            : this.getSwordDurabilityBaseline();
        const maxDurability = Math.max(
            1,
            Math.floor(Number(safeSource.maxDurability ?? sourceItem.maxDurability) || derivedMaxDurability)
        );
        const durability = Math.max(
            0,
            Math.min(
                maxDurability,
                Math.floor(Number(safeSource.durability ?? sourceItem.durability) || maxDurability)
            )
        );

        return {
            instanceKey,
            source,
            refineYears,
            powerRating,
            sellPriceLowStone: Math.max(
                0,
                Math.floor(Number(safeSource.sellPriceLowStone ?? sourceItem.sellPriceLowStone) || 0)
            ),
            maxDurability,
            durability,
            breakWear: Math.max(0, Math.floor(Number(safeSource.breakWear ?? sourceItem.breakWear) || 0)),
            breakCount: Math.max(0, Math.floor(Number(safeSource.breakCount ?? sourceItem.breakCount) || 0)),
            equippedAt: Math.max(0, Math.floor(Number(safeSource.equippedAt ?? sourceItem.equippedAt) || Date.now()))
        };
    },

    createSwordArtifactStateFromItem(item) {
        return this.normalizeSwordArtifactState({}, item);
    },

    ensureSwordArtifactState() {
        const sourceStates = Array.isArray(this.equippedSwordArtifacts) ? this.equippedSwordArtifacts : [];
        const seenKeys = new Set();
        const normalizedStates = sourceStates
            .map(entry => this.normalizeSwordArtifactState(entry))
            .filter(entry => {
                if (!entry || seenKeys.has(entry.instanceKey)) return false;
                seenKeys.add(entry.instanceKey);
                return true;
            });

        if (!normalizedStates.length && Math.max(0, Math.floor(Number(this.bondedSwordCount) || 0)) > 0) {
            const legacyCount = Math.max(0, Math.floor(Number(this.bondedSwordCount) || 0));
            for (let index = 0; index < legacyCount; index++) {
                normalizedStates.push(this.normalizeSwordArtifactState({
                    instanceKey: this.createSwordArtifactInstanceKey('LEGACY_THANH_TRUC'),
                    source: 'LEGACY',
                    equippedAt: Date.now() + index
                }));
            }
        }

        this.equippedSwordArtifacts = normalizedStates;
        this.bondedSwordCount = normalizedStates.length;
        return this.equippedSwordArtifacts;
    },

    getEquippedSwordArtifacts() {
        return this.ensureSwordArtifactState();
    },

    getEquippedSwordArtifactSnapshot() {
        return this.getEquippedSwordArtifacts().map(state => ({ ...state }));
    },

    getEquippedSwordArtifactByKey(instanceKey) {
        return this.getEquippedSwordArtifacts().find(state => state.instanceKey === instanceKey) || null;
    },

    getUsableEquippedSwordArtifacts() {
        return this.getEquippedSwordArtifacts().filter(state => Math.max(0, Math.floor(Number(state?.durability) || 0)) > 0);
    },

    getBrokenEquippedSwordArtifacts() {
        return this.getEquippedSwordArtifacts().filter(state => Math.max(0, Math.floor(Number(state?.durability) || 0)) <= 0);
    },

    sortSwordArtifactsForControl(states) {
        return [...states].sort((a, b) => {
            const powerDiff = (Math.floor(Number(b?.powerRating) || 0)) - (Math.floor(Number(a?.powerRating) || 0));
            if (powerDiff !== 0) return powerDiff;

            const durabilityDiff = (Math.floor(Number(b?.durability) || 0)) - (Math.floor(Number(a?.durability) || 0));
            if (durabilityDiff !== 0) return durabilityDiff;

            return (Math.floor(Number(a?.equippedAt) || 0)) - (Math.floor(Number(b?.equippedAt) || 0));
        });
    },

    getSwordConsciousnessStat() {
        return Math.max(1, this.rankIndex + 1);
    },

    getSwordConsciousnessLabel() {
        return formatNumber(this.getSwordConsciousnessStat());
    },

    hasThanhLinhKiemQuyetUnlocked() {
        return this.hasCultivationArt('THANH_LINH_KIEM_QUYET');
    },

    getSwordEquipCapacity() {
        if (!this.hasThanhLinhKiemQuyetUnlocked()) {
            return Math.min(
                getConfiguredSwordCount(),
                Math.max(1, Math.floor(Number(this.getSwordControlConfig().WITHOUT_SECRET_ART) || 1))
            );
        }

        return Math.max(1, Math.min(
            getConfiguredSwordCount(),
            Math.max(1, Math.floor(Number(this.getSwordControlConfig().MAX_CONSCIOUSNESS_CONTROL) || getConfiguredSwordCount())),
            this.getSwordConsciousnessStat()
        ));
    },

    getSwordControlLimit() {
        const usableCount = this.getUsableEquippedSwordArtifacts().length;
        if (usableCount <= 0) return 0;

        return Math.min(usableCount, this.getSwordEquipCapacity());
    },

    getActiveSwordArtifactStates({ mode = this.attackMode } = {}) {
        const usableStates = this.sortSwordArtifactsForControl(this.getUsableEquippedSwordArtifacts());
        if (mode === 'SWORD' && this.canDeployDaiCanhKiemTran()) {
            return usableStates.slice(0, getConfiguredSwordCount());
        }

        return usableStates.slice(0, this.getSwordControlLimit());
    },

    getBondedSwordCount() {
        return this.getEquippedSwordArtifacts().length;
    },

    getFormationSwordCount() {
        return Math.min(this.getUsableEquippedSwordArtifacts().length, getConfiguredSwordCount());
    },

    getSwordArtifactInventoryCount() {
        return Object.values(this.inventory || {}).reduce((total, item) => {
            return total + (this.isThanhTrucSwordArtifactItem(item) ? Math.max(0, Math.floor(item.count || 0)) : 0);
        }, 0);
    },

    getSwordFormationProgress() {
        const required = getConfiguredSwordCount();
        const bonded = this.getBondedSwordCount();
        const usableBonded = this.getUsableEquippedSwordArtifacts().length;
        const formationBonded = this.getFormationSwordCount();
        const stocked = this.getSwordArtifactInventoryCount();
        const owned = Math.max(0, bonded + stocked);
        const capacity = this.getSwordEquipCapacity();
        const controlled = this.getSwordControlLimit();

        return {
            bonded,
            usableBonded,
            formationBonded,
            capacity,
            controlled,
            stocked,
            owned,
            required,
            remaining: Math.max(0, required - usableBonded),
            ready: usableBonded >= required,
            overflow: Math.max(0, bonded - required),
            broken: Math.max(0, bonded - usableBonded),
            inactive: Math.max(0, usableBonded - controlled),
            freeSlots: Math.max(0, capacity - bonded),
            consciousness: this.getSwordConsciousnessStat(),
            thanhLinhUnlocked: this.hasThanhLinhKiemQuyetUnlocked()
        };
    },

    hasKnownSwordArtifact() {
        const progress = this.getSwordFormationProgress();
        return progress.bonded > 0 || progress.stocked > 0 || progress.ready;
    },

    getSwordArtifactPowerMultiplier(state) {
        const powerRating = Math.max(1, Math.floor(Number(state?.powerRating) || this.getSwordBasePowerRating()));
        return Math.max(0.35, powerRating / this.getSwordBasePowerRating());
    },

    isSwordArtifactDamaged(target) {
        const state = typeof target === 'string' ? this.getEquippedSwordArtifactByKey(target) : target;
        if (!state) return false;
        return Math.floor(Number(state.durability) || 0) < Math.floor(Number(state.maxDurability) || 0);
    },

    recordSwordArtifactBreak(instanceKey) {
        const state = this.getEquippedSwordArtifactByKey(instanceKey);
        if (!state) return null;

        state.breakCount = Math.max(0, Math.floor(Number(state.breakCount) || 0)) + 1;
        state.breakWear = Math.max(0, Math.floor(Number(state.breakWear) || 0)) + 1;

        const breakThreshold = Math.max(1, Math.floor(Number(this.getSwordInstanceSystemConfig().BREAKS_PER_DURABILITY_LOSS) || 4));
        let durabilityReduced = false;

        if (state.breakWear >= breakThreshold && state.durability > 0) {
            state.breakWear = 0;
            state.durability = Math.max(0, Math.floor(Number(state.durability) || 0) - 1);
            durabilityReduced = true;
        }

        this.bondedSwordCount = this.getEquippedSwordArtifacts().length;

        if (durabilityReduced) {
            const swordName = this.getItemDisplayName({ category: 'SWORD_ARTIFACT', quality: 'HIGH' });
            showNotify(
                state.durability > 0
                    ? `${swordName} hao tổn độ bền, còn ${formatNumber(state.durability)}/${formatNumber(state.maxDurability)}.`
                    : `${swordName} đã cạn độ bền, cần Chưởng Thiên Bình phục hồi trước khi tiếp tục xuất trận.`,
                this.getThanhTrucSwordArtifactConfig()?.color || '#66f0c2'
            );
        }

        GameProgress.requestSave();
        return state;
    },

    repairSwordArtifactDurability(target, { silent = false } = {}) {
        const state = typeof target === 'string' ? this.getEquippedSwordArtifactByKey(target) : target;
        if (!state) return false;

        const maxDurability = Math.max(1, Math.floor(Number(state.maxDurability) || 0));
        const currentDurability = Math.max(0, Math.floor(Number(state.durability) || 0));
        if (currentDurability >= maxDurability) return false;

        state.durability = maxDurability;
        state.breakWear = 0;

        if (typeof syncSwordFormation === 'function') {
            syncSwordFormation({ rebuildAll: true });
        }

        if (!silent) {
            showNotify(
                `${this.getItemDisplayName({ category: 'SWORD_ARTIFACT', quality: 'HIGH' })} đã được phục hồi ${formatNumber(maxDurability)}/${formatNumber(maxDurability)} độ bền.`,
                this.getThanhTrucSwordArtifactConfig()?.color || '#66f0c2'
            );
        }

        GameProgress.requestSave();
        return true;
    },

    equipSwordArtifactFromInventoryItem(itemKey) {
        const item = this.inventory?.[itemKey];
        if (!item || item.count <= 0 || item.category !== 'SWORD_ARTIFACT') return false;

        const qualityConfig = this.getItemQualityConfig(item);
        const progress = this.getSwordFormationProgress();
        const capacity = Math.max(1, Math.floor(Number(progress.capacity) || this.getSwordEquipCapacity() || 1));

        if (progress.bonded >= capacity) {
            const notifyText = progress.thanhLinhUnlocked
                ? `Thần thức hiện tại chỉ đủ điều khiển tối đa ${formatNumber(capacity)} thanh kiếm hộ thân. Đang trang bị ${formatNumber(progress.bonded)}/${formatNumber(capacity)} thanh, chưa thể triển khai thêm.`
                : `Chưa lĩnh ngộ Thanh Linh Kiếm Quyết nên thần thức hiện chỉ giữ được ${formatNumber(capacity)} thanh kiếm hộ thân.`;

            showNotify(notifyText, qualityConfig.color || '#66f0c2');
            return false;
        }

        const state = this.createSwordArtifactStateFromItem(item);

        item.count--;
        if (item.count <= 0) {
            delete this.inventory[itemKey];
        }

        this.getEquippedSwordArtifacts().push(state);
        this.bondedSwordCount = this.getEquippedSwordArtifacts().length;
        const wasDeployable = this.canDeployDaiCanhKiemTran();
        const nextProgress = this.getSwordFormationProgress();
        const deployable = this.syncDaiCanhKiemTranProgress();

        if (typeof syncSwordFormation === 'function') {
            syncSwordFormation({ rebuildAll: true });
        }

        showNotify(
            deployable && !wasDeployable
                ? SWORD_UI_TEXT.deployReady(this.getItemDisplayName(item), formatNumber(nextProgress.bonded), formatNumber(nextProgress.required))
                : nextProgress.ready && !this.hasDaiCanhKiemTranUnlocked()
                    ? SWORD_UI_TEXT.deployNeedArt(this.getItemDisplayName(item), formatNumber(nextProgress.bonded), formatNumber(nextProgress.required))
                    : SWORD_UI_TEXT.deployCount(this.getItemDisplayName(item), formatNumber(nextProgress.bonded)),
            qualityConfig.color || '#66f0c2'
        );

        this.refreshResourceUI();
        return true;
    },

    unequipSwordArtifactToInventory(instanceKey) {
        const state = this.getEquippedSwordArtifactByKey(instanceKey);
        if (!state) return false;

        const spec = {
            kind: 'UNIQUE',
            category: 'SWORD_ARTIFACT',
            quality: state.source === 'REFINED' ? (state.refineYears >= 720 ? 'SUPREME' : 'HIGH') : (this.getThanhTrucSwordArtifactConfig()?.quality || 'HIGH'),
            uniqueKey: this.getThanhTrucSwordArtifactConfig()?.uniqueKey || 'THANH_TRUC_PHONG_VAN_KIEM',
            instanceKey: state.instanceKey,
            source: state.source,
            refineYears: state.refineYears,
            powerRating: state.powerRating,
            sellPriceLowStone: state.sellPriceLowStone,
            maxDurability: state.maxDurability,
            durability: state.durability,
            breakWear: state.breakWear,
            breakCount: state.breakCount
        };

        if (!this.hasInventorySpaceForSpec(spec)) {
            showNotify('Túi trữ vật đã đầy, chưa thể gỡ thanh kiếm này vào túi.', '#ff8a80');
            return false;
        }

        const nextStates = this.getEquippedSwordArtifacts().filter(entry => entry.instanceKey !== instanceKey);
        this.equippedSwordArtifacts = nextStates;
        this.bondedSwordCount = nextStates.length;
        this.addInventoryItem(spec, 1);

        if (typeof syncSwordFormation === 'function') {
            syncSwordFormation({ rebuildAll: true });
        }

        this.enforcePhongLoiSiSwordRequirement();
        this.ensureValidAttackMode();
        showNotify(
            `${this.getItemDisplayName({ category: 'SWORD_ARTIFACT', quality: spec.quality })} đã được gỡ trang bị và đưa về túi trữ vật.`,
            this.getThanhTrucSwordArtifactConfig()?.color || '#66f0c2'
        );
        this.refreshResourceUI();
        return true;
    },

    syncDaiCanhKiemTranProgress({ notifyUnlock = false } = {}) {
        const progress = this.getSwordFormationProgress();
        const deployable = this.canDeployDaiCanhKiemTran();

        if (notifyUnlock && progress.ready) {
            showNotify(
                this.hasDaiCanhKiemTranUnlocked()
                    ? SWORD_UI_TEXT.readyNotifyLearned(formatNumber(progress.required))
                    : SWORD_UI_TEXT.readyNotifyNeedArt(formatNumber(progress.required)),
                this.getThanhTrucSwordArtifactConfig()?.color || '#66f0c2'
            );
        }

        return deployable;
    },

    hasDaiCanhKiemTranUnlocked() {
        return this.hasCultivationArt('DAI_CANH_KIEM_TRAN');
    },

    canDeployDaiCanhKiemTran() {
        return this.hasDaiCanhKiemTranUnlocked() && this.getSwordFormationProgress().ready;
    },

    hasCanLamBangDiemUnlocked() {
        return this.hasCultivationArt('CAN_LAM_BANG_DIEM');
    },

    castCanLamBangDiem() {
        if (this.isVoidCollapsed || !this.hasCanLamBangDiemUnlocked()) return false;
        if (!this.isArtifactDeployed('CAN_LAM_BANG_DIEM')) {
            showNotify('Càn Lam Băng Diễm chưa triển khai, hãy khai triển tại mục Pháp bảo trước.', '#69d9ff');
            return false;
        }
        const livingEnemies = (Array.isArray(enemies) ? enemies : []).filter(enemy => enemy && enemy.hp > 0);
        if (!livingEnemies.length) {
            showNotify('Không có mục tiêu để thi triển Càng Lam Băng Diễm.', '#69d9ff');
            return false;
        }

        const anchorX = Number.isFinite(this.x) ? this.x : guardCenter.x;
        const anchorY = Number.isFinite(this.y) ? this.y : guardCenter.y;
        const target = livingEnemies.reduce((closest, enemy) => {
            if (!closest) return enemy;
            const currentDist = Math.hypot((enemy.x || 0) - anchorX, (enemy.y || 0) - anchorY);
            const bestDist = Math.hypot((closest.x || 0) - anchorX, (closest.y || 0) - anchorY);
            return currentDist < bestDist ? enemy : closest;
        }, null);
        if (!target) return false;

        guardCenter.x = target.x;
        guardCenter.y = target.y;
        this.x = target.x;
        this.y = target.y;
        this.px = this.x;
        this.py = this.y;

        target.applyMovementLock?.(900);
        target.applySlow?.(3000, 0.08);
        target.applyDodgeSuppression?.(3000);

        const dotSword = { powerPenalty: 0.36, ignoreDodge: true, shieldBreakMultiplier: 1.2 };
        for (let tick = 1; tick <= 3; tick++) {
            setTimeout(() => {
                if (!target || target.hp <= 0) return;
                const hpBefore = target.hp;
                target.hit(dotSword);
                if (hpBefore > 0 && target.hp <= 0) {
                    this.createCanLamDissolveBurst(target.x, target.y);
                }
            }, tick * 1000);
        }

        showNotify('Thi triển Càng Lam Băng Diễm: lao tới mục tiêu gần nhất, thiêu băng trong 3 giây.', '#69d9ff');
        this.refreshResourceUI();
        return true;
    },

    createCanLamDissolveBurst(x, y) {
        trimVisualParticles(260);
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = random(1.8, 5.8);
            visualParticles.push({
                type: 'spark',
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - random(0.1, 1),
                gravity: 0.04,
                friction: 0.95,
                size: random(2, 4.5),
                sizeVelocity: -0.03,
                life: 0.9,
                decay: random(0.03, 0.05),
                opacity: 0.86,
                color: i % 2 === 0 ? '#78e6ff' : '#9fd6ff',
                glow: 12
            });
        }
    },

    getUnlockedSwordTargetCount() {
        return getConfiguredSwordCount();
    },

    hasKhuTrungThuatUnlocked() {
        return this.hasCultivationArt('KHU_TRUNG_THUAT');
    },

    hasSecretArtInInventory(uniqueKey) {
        if (!uniqueKey) return false;
        const category = SWORD_SECRET_ART_KEYS.includes(uniqueKey) ? 'SWORD_ART' : 'FLAME_ART';
        return Boolean(this.getInventoryEntryByUniqueKey(uniqueKey, [category]));
    },

    hasKnownThanhLinhKiemQuyet() {
        return this.hasUniquePurchase('THANH_LINH_KIEM_QUYET')
            || this.hasThanhLinhKiemQuyetUnlocked()
            || this.hasSecretArtInInventory('THANH_LINH_KIEM_QUYET');
    },

    getArtifactConfig(uniqueKey) {
        return CONFIG.ARTIFACTS?.[uniqueKey]
            || (uniqueKey === 'CAN_LAM_BANG_DIEM' ? CONFIG.SECRET_ARTS?.CAN_LAM_BANG_DIEM : null)
            || null;
    },

    getArtifactAttunementNote(uniqueKey) {
        const artifactConfig = this.getArtifactConfig(uniqueKey) || {};
        if (uniqueKey === 'PHONG_LOI_SI') {
            return 'phong lôi linh dực đã hiện bên tâm ấn.';
        }
        if (uniqueKey === 'HUYET_SAC_PHI_PHONG') {
            const speedBonus = Math.round((Number(artifactConfig.speedBonusPct) || 0) * 100);
            return `huyết ảnh đã quấn quanh thân pháp, tốc độ di chuyển tăng ${formatNumber(speedBonus)}% và sẽ lưu huyết quang phía sau.`;
        }
        return 'pháp bảo đã hiện bên tâm ấn.';
    },

    getArtifactStatusNote(uniqueKey, { active = false, unlocked = false, purchased = false } = {}) {
        const artifactConfig = this.getArtifactConfig(uniqueKey) || {};

        if (uniqueKey === 'PHONG_LOI_SI') {
            if (active) {
                return this.isPhongLoiBlinkEnabled()
                    ? 'Linh dực phong lôi đang hộ tại hai bên con trỏ, thân pháp dịch chuyển đã bật.'
                    : 'Linh dực phong lôi đang hộ tại hai bên con trỏ, thân pháp dịch chuyển đang tắt.';
            }
        } else if (uniqueKey === 'HUYET_SAC_PHI_PHONG') {
            const speedBonus = Math.round((Number(artifactConfig.speedBonusPct) || 0) * 100);
            if (active) {
                return `Huyết ảnh đang kéo dài sau thân pháp, tốc độ di chuyển tăng ${formatNumber(speedBonus)}% và để lại một đạo hồng tuyến.`;
            }
            if (unlocked) {
                return `Đã luyện hóa, có thể triển khai để tăng ${formatNumber(speedBonus)}% tốc độ di chuyển.`;
            }
        }

        if (unlocked) {
            return 'Đã luyện hóa, có thể triển khai hoặc thu hồi bất kỳ lúc nào.';
        }

        if (purchased) {
            return 'Đã kết duyên nhưng còn chờ luyện hóa trong túi trữ vật.';
        }

        return 'Chưa từng kết duyên với pháp bảo này.';
    },

    getArtifactDeploymentMessage(uniqueKey, nextActive) {
        const artifactConfig = this.getArtifactConfig(uniqueKey) || {};

        if (uniqueKey === 'PHONG_LOI_SI') {
            return nextActive
                ? `${artifactConfig.fullName} đã khai triển bên tâm ấn.`
                : `${artifactConfig.fullName} đã thu vào thần hải.`;
        }

        if (uniqueKey === 'HUYET_SAC_PHI_PHONG') {
            return nextActive
                ? `${artifactConfig.fullName} đã triển khai sau lưng thân pháp.`
                : `${artifactConfig.fullName} đã thu vào thần hải.`;
        }

        return nextActive
            ? `${artifactConfig.fullName || uniqueKey} đã khai triển bên tâm ấn.`
            : `${artifactConfig.fullName || uniqueKey} đã thu vào thần hải.`;
    },

    hasArtifactPurchased(uniqueKey) {
        return Boolean(uniqueKey && this.hasUniquePurchase(uniqueKey));
    },

    hasArtifactUnlocked(uniqueKey) {
        return Boolean(uniqueKey && this.hasCultivationArt(uniqueKey));
    },

    isArtifactDeployed(uniqueKey) {
        return Boolean(uniqueKey && this.activeArtifacts?.[uniqueKey] && this.hasArtifactUnlocked(uniqueKey));
    },

    hasKnownArtifact() {
        const artifactKeys = new Set([...Object.keys(CONFIG.ARTIFACTS || {}), 'CAN_LAM_BANG_DIEM']);
        return Array.from(artifactKeys).some(uniqueKey => this.hasArtifactPurchased(uniqueKey) || this.hasArtifactUnlocked(uniqueKey));
    },

    hasActiveArtifact() {
        const artifactKeys = new Set([...Object.keys(CONFIG.ARTIFACTS || {}), 'CAN_LAM_BANG_DIEM']);
        return Array.from(artifactKeys).some(uniqueKey => this.isArtifactDeployed(uniqueKey));
    },

    getActiveArtifactNames() {
        const artifactKeys = new Set([...Object.keys(CONFIG.ARTIFACTS || {}), 'CAN_LAM_BANG_DIEM']);
        return Array.from(artifactKeys)
            .filter(uniqueKey => this.isArtifactDeployed(uniqueKey))
            .map(uniqueKey => this.getArtifactConfig(uniqueKey)?.fullName || uniqueKey);
    },

    getThanhTrucSwordThunderConfig() {
        return this.getThanhTrucSwordArtifactConfig()?.thunderStrike || {};
    },

    triggerThanhTrucSwordThunder(target, { shielded = false, scaleFactor = 1 } = {}) {
        const progress = this.getSwordFormationProgress();
        if (!target || progress.bonded <= 0) return false;

        const cfg = this.getThanhTrucSwordThunderConfig();
        const triggerChance = this.attackMode === 'SWORD'
            ? Math.max(0, Math.min(1, Number(cfg.FORMATION_TRIGGER_CHANCE) || 0.32))
            : Math.max(0, Math.min(1, Number(cfg.TRIGGER_CHANCE) || 0.18));

        if (Math.random() > triggerChance) return false;

        const x = Number(target.x) || this.x;
        const y = Number(target.y) || this.y;
        const primaryColor = this.getThanhTrucSwordArtifactConfig()?.color || '#66f0c2';
        const secondaryColor = this.getThanhTrucSwordArtifactConfig()?.secondaryColor || '#dffef2';
        const lightningLight = CONFIG.COLORS?.SWORD_GOLD_LIGHT || '#FFF2C2';
        const lightningMid = CONFIG.COLORS?.SWORD_GOLD_MID || '#E6C87A';
        const intensity = Math.max(0.24, progress.formationBonded / Math.max(1, progress.required));

        trimVisualParticles(280);
        visualParticles.push({
            type: 'ring',
            x,
            y,
            radius: 12 * scaleFactor,
            radialVelocity: (20 + (intensity * 18)) * scaleFactor,
            lineWidth: 2.2 + (intensity * 1.2),
            color: secondaryColor,
            glow: 18,
            life: 0.9,
            decay: 0.08
        });

        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 / 4) * i + (Math.random() * 0.5);
            visualParticles.push({
                type: 'ray',
                x,
                y,
                angle,
                radius: 4 * scaleFactor,
                length: (16 + (intensity * 14)) * scaleFactor,
                lengthVelocity: 1.2 * scaleFactor,
                lineWidth: 1.6 + (intensity * 0.8),
                color: i % 2 === 0 ? lightningLight : lightningMid,
                glow: 16,
                life: 0.82,
                decay: 0.09
            });
        }

        if (typeof target.applyMovementLock === 'function') {
            target.applyMovementLock(Math.max(40, Math.floor((Number(cfg.MOVEMENT_LOCK_MS) || 180) * (shielded ? 1.15 : 1))));
        }
        if (typeof target.applySlow === 'function') {
            target.applySlow(
                Math.max(120, Math.floor((Number(cfg.SLOW_MS) || 1000) * (shielded ? 1.15 : 1))),
                Math.max(0.2, Math.min(1, Number(cfg.SLOW_FACTOR) || 0.72))
            );
        }
        if (typeof target.suppressDodge === 'function') {
            target.suppressDodge(Math.max(120, Math.floor((Number(cfg.DODGE_SUPPRESS_MS) || 1200) * (shielded ? 1.2 : 1))));
        }
        if (typeof target.blockShieldRecovery === 'function') {
            target.blockShieldRecovery(Math.max(120, Math.floor((Number(cfg.SHIELD_BLOCK_MS) || 1600) * (shielded ? 1.2 : 1))));
        }

        return true;
    },

    ensurePhongLoiBlinkState() {
        if (!this.phongLoiBlink) {
            this.phongLoiBlink = {
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

        return this.phongLoiBlink;
    },

    getPhongLoiBlinkConfig() {
        const blinkConfig = this.getArtifactConfig('PHONG_LOI_SI')?.teleportSkill || {};

        return {
            name: blinkConfig.NAME || 'Phong Lôi Độn',
            chargeMs: Math.max(0, parseInt(blinkConfig.CHARGE_MS, 10) || 90),
            cooldownMs: Math.max(0, parseInt(blinkConfig.COOLDOWN_MS, 10) || 320),
            manaCost: Math.max(0, Number(blinkConfig.MANA_COST) || 18),
            triggerTravelDistance: Math.max(24, Number(blinkConfig.TRIGGER_TRAVEL_DISTANCE) || 140),
            blinkDistance: Math.max(32, Number(blinkConfig.BLINK_DISTANCE) || 220),
            minBlinkDistance: Math.max(24, Number(blinkConfig.MIN_BLINK_DISTANCE) || 88),
            minMoveSpeed: Math.max(0.05, Number(blinkConfig.MIN_MOVE_SPEED) || 0.8),
            afterimageMs: Math.max(120, parseInt(blinkConfig.AFTERIMAGE_MS, 10) || 280),
            trailMs: Math.max(120, parseInt(blinkConfig.TRAIL_MS, 10) || 260),
            flashMs: Math.max(40, parseInt(blinkConfig.FLASH_MS, 10) || 80),
            transitionMs: Math.max(20, parseInt(blinkConfig.TRANSITION_MS, 10) || 48),
            impactRadius: Math.max(10, Number(blinkConfig.IMPACT_RADIUS) || 26)
        };
    },

    hasPhongLoiBlinkSkill() {
        return this.isArtifactDeployed('PHONG_LOI_SI');
    },

    isPhongLoiBlinkEnabled() {
        return this.hasPhongLoiBlinkSkill() && Boolean(this.ensurePhongLoiBlinkState().enabled);
    },

    isPhongLoiBlinkCharging() {
        return Boolean(this.ensurePhongLoiBlinkState().charging);
    },

    isPhongLoiBlinkTransiting() {
        return Boolean(this.ensurePhongLoiBlinkState().transiting);
    },

    isPhongLoiBlinkBusy() {
        const state = this.ensurePhongLoiBlinkState();
        return Boolean(state.charging || state.transiting);
    },

    resetPhongLoiBlinkState({ clearEffects = false } = {}) {
        const state = this.ensurePhongLoiBlinkState();
        state.enabled = false;
        state.accumulatedDistance = 0;
        state.lastMoveVectorX = 0;
        state.lastMoveVectorY = 0;
        state.charging = null;
        state.transiting = null;

        if (clearEffects) {
            state.trails = [];
            state.afterimages = [];
        }

        return state;
    },

    renderPhongLoiBlinkButton() {
        const button = document.getElementById('btn-phong-loi-blink');
        if (!button) return;

        const label = button.querySelector('.phong-loi-toggle__state');
        const state = this.ensurePhongLoiBlinkState();
        const cfg = this.getPhongLoiBlinkConfig();
        const available = this.hasPhongLoiBlinkSkill();
        const enabled = available && Boolean(state.enabled);
        const charging = available && Boolean(state.charging);
        const costText = formatNumber(cfg.manaCost);

        button.classList.toggle('is-hidden', !available);
        button.classList.toggle('is-active', enabled);
        button.classList.toggle('is-charging', charging);
        button.style.display = available ? 'flex' : 'none';
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');

        if (label) {
            label.textContent = charging
                ? UI_TEXT.PHONG_LOI_SI_STATES.CHARGING
                : (enabled ? UI_TEXT.PHONG_LOI_SI_STATES.ACTIVE : UI_TEXT.PHONG_LOI_SI_STATES.INACTIVE);
        }

        const title = !available
            ? 'Phong Lôi Sí chưa triển khai'
            : charging
                ? `Phong Lôi Sí đang tụ lôi - hao ${costText} linh lực`
                : enabled
                    ? `Phong Lôi Sí đang khai mở - ${cfg.name}, hao ${costText} linh lực mỗi lần dịch chuyển`
                    : `Phong Lôi Sí đang thu liễm - khai mở để kích hoạt ${cfg.name}`;

        button.title = title;
        button.setAttribute('aria-label', title);
    },

    renderCanLamCastButton() {
        const button = document.getElementById('btn-can-lam-cast');
        if (!button) return;

        const label = button.querySelector('.can-lam-toggle__state');
        const available = this.isArtifactDeployed('CAN_LAM_BANG_DIEM');

        button.classList.toggle('is-hidden', !available);
        button.classList.toggle('is-active', available);
        button.style.display = available ? 'flex' : 'none';
        button.setAttribute('aria-pressed', available ? 'true' : 'false');

        if (label) {
            label.textContent = available ? 'KHAI' : 'THU';
        }

        const title = available
            ? 'Thi triển Càn Lam Băng Diễm vào mục tiêu gần nhất'
            : 'Càn Lam Băng Diễm chưa triển khai';

        button.title = title;
        button.setAttribute('aria-label', title);
    },

    setPhongLoiBlinkEnabled(nextEnabled, { silent = false, force = false } = {}) {
        const state = this.ensurePhongLoiBlinkState();
        const available = this.hasPhongLoiBlinkSkill();
        const normalized = available && Boolean(nextEnabled);

        if (!force && !available) {
            this.renderPhongLoiBlinkButton();
            return false;
        }

        if (state.enabled === normalized && !(force && !normalized)) {
            this.renderPhongLoiBlinkButton();
            return false;
        }

        state.enabled = normalized;
        state.accumulatedDistance = 0;
        state.lastMoveVectorX = 0;
        state.lastMoveVectorY = 0;

        if (!normalized) {
            state.charging = null;
        }

        if (!silent) {
            const artifactColor = this.getArtifactConfig('PHONG_LOI_SI')?.color || '#9fe8ff';
            const blinkName = this.getPhongLoiBlinkConfig().name;
            showNotify(
                normalized
                    ? `${blinkName} đã khai mở theo Phong Lôi Sí.`
                    : `${blinkName} đã thu liễm về tâm ấn.`,
                artifactColor
            );
        }

        this.renderPhongLoiBlinkButton();
        if (SkillsUI && typeof SkillsUI.isOpen === 'function' && SkillsUI.isOpen()) {
            SkillsUI.render();
        }
        return true;
    },

    togglePhongLoiBlink() {
        return this.setPhongLoiBlinkEnabled(!this.isPhongLoiBlinkEnabled());
    },

    setArtifactDeployment(uniqueKey, nextActive, { silent = false, skipRefresh = false } = {}) {
        const artifactConfig = this.getArtifactConfig(uniqueKey);
        if (!artifactConfig || !this.hasArtifactUnlocked(uniqueKey)) return false;
        if (!this.activeArtifacts) this.activeArtifacts = {};

        const normalized = Boolean(nextActive);
        if (Boolean(this.activeArtifacts[uniqueKey]) === normalized) return false;
        if (uniqueKey === 'PHONG_LOI_SI' && normalized) {
            const equippedSwordCount = Array.isArray(this.getEquippedSwordArtifacts?.())
                ? this.getEquippedSwordArtifacts().length
                : 0;
            if (equippedSwordCount < 1) {
                showNotify('Cần trang bị ít nhất 1 Thanh Trúc Phong Vân Kiếm mới có thể triển khai Phong Lôi Sí.', artifactConfig.color || '#9fe8ff');
                return false;
            }
        }

        this.activeArtifacts[uniqueKey] = normalized;

        if (uniqueKey === 'PHONG_LOI_SI') {
            this.resetPhongLoiBlinkState({ clearEffects: !normalized });
        }
        if (uniqueKey === 'HUYET_SAC_PHI_PHONG') {
            this.clearHuyetSacPhiPhongTrail();
        }
        if (uniqueKey === 'CAN_LAM_BANG_DIEM') {
            this.renderCanLamCastButton();
        }

        if (!silent) {
            showNotify(this.getArtifactDeploymentMessage(uniqueKey, normalized), artifactConfig.color || '#9fe8ff');
        }

        if (skipRefresh) {
            this.renderAttackModeUI();
        } else {
            this.refreshResourceUI();
        }

        return true;
    },

    toggleArtifactDeployment(uniqueKey) {
        return this.setArtifactDeployment(uniqueKey, !this.isArtifactDeployed(uniqueKey));
    },

    enforcePhongLoiSiSwordRequirement({ silent = false } = {}) {
        if (!this.isArtifactDeployed('PHONG_LOI_SI')) return false;
        const equippedSwordCount = Array.isArray(this.getEquippedSwordArtifacts?.())
            ? this.getEquippedSwordArtifacts().length
            : 0;
        if (equippedSwordCount > 0) return false;

        this.setArtifactDeployment('PHONG_LOI_SI', false, { silent: true, skipRefresh: true });
        if (!silent) {
            showNotify('Đã thu hồi Phong Lôi Sí vì không còn Thanh Trúc Phong Vân Kiếm để dẫn lôi vận hành.', this.getArtifactConfig('PHONG_LOI_SI')?.color || '#9fe8ff');
        }
        return true;
    },

    getArtifactSkillList() {
        return Object.entries(CONFIG.ARTIFACTS || {}).map(([uniqueKey, artifactConfig]) => {
            const purchased = this.hasArtifactPurchased(uniqueKey);
            const unlocked = this.hasArtifactUnlocked(uniqueKey);
            const active = this.isArtifactDeployed(uniqueKey);

            return {
                key: uniqueKey,
                uniqueKey,
                name: artifactConfig.fullName || uniqueKey,
                description: artifactConfig.description || 'Pháp bảo hộ thân có thể triển khai quanh tâm ấn.',
                purchased,
                unlocked,
                active,
                ready: unlocked,
                accent: artifactConfig.color || '#9fe8ff',
                note: this.getArtifactStatusNote(uniqueKey, { active, unlocked, purchased })
            };
        });
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
        if (mode === 'SWORD') return this.canDeployDaiCanhKiemTran();
        if (mode === 'INSECT') return this.hasKhuTrungThuatUnlocked();
        return mode === 'BASE';
    },

    hasActiveAttackSkill() {
        return this.attackMode === 'SWORD' || this.attackMode === 'INSECT';
    },

    getAttackModeDisplayName(mode = this.attackMode) {
        if (mode === 'SWORD') return ATTACK_MODE_LABELS.SWORD;
        if (mode === 'INSECT') return ATTACK_MODE_LABELS.INSECT;
        return ATTACK_MODE_LABELS.BASE;
    },

    canUseInsectAttackMode() {
        return this.hasKhuTrungThuatUnlocked() && this.getCombatReadyInsectCount() > 0;
    },

    isInsectSwarmActive() {
        return this.attackMode === 'INSECT' && this.canUseInsectAttackMode() && !this.isUltMode && !this.isUltimateBusy();
    },

    getAttackSkillList() {
        const formationLearned = this.hasDaiCanhKiemTranUnlocked();
        const formationReady = this.canDeployDaiCanhKiemTran();
        const swordStats = this.getAliveSwordStats();
        const swordProgress = this.getSwordFormationProgress();
        const hasSwordArtInInventory = Boolean(this.getInventoryEntryByUniqueKey('DAI_CANH_KIEM_TRAN', ['SWORD_ART']));
        const totalInsects = this.getTotalTamedInsectCount();
        const combatReadyCount = this.getCombatReadyInsectCount();
        const reservedCount = Math.max(0, totalInsects - combatReadyCount);

        return [
            {
                key: 'SWORD',
                name: SWORD_UI_TEXT.SKILL_NAME,
                description: SWORD_UI_TEXT.SKILL_DESCRIPTION,
                unlocked: formationLearned,
                active: this.attackMode === 'SWORD',
                ready: formationReady,
                accent: CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.color || '#ffd36b',
                note: formationReady
                    ? this.attackMode === 'SWORD'
                        ? SWORD_UI_TEXT.noteActive(formatNumber(swordStats.alive))
                        : SWORD_UI_TEXT.noteReady(formatNumber(swordProgress.bonded), formatNumber(swordProgress.required))
                    : formationLearned
                        ? SWORD_UI_TEXT.noteLearnedPending(formatNumber(swordProgress.bonded), formatNumber(swordProgress.required))
                        : hasSwordArtInInventory
                            ? SWORD_UI_TEXT.noteInInventory(formatNumber(swordProgress.required))
                            : this.hasUniquePurchase('DAI_CANH_KIEM_TRAN')
                                ? SWORD_UI_TEXT.noteRecovering(formatNumber(swordProgress.bonded), formatNumber(swordProgress.required))
                                : swordProgress.bonded > 0 || swordProgress.stocked > 0
                                    ? SWORD_UI_TEXT.noteCollecting(
                                        formatNumber(swordProgress.bonded),
                                        formatNumber(swordProgress.required),
                                        swordProgress.stocked > 0 ? ` | ${formatNumber(swordProgress.stocked)} thanh còn trong túi` : ''
                                    )
                                    : SWORD_UI_TEXT.noteUnknown(formatNumber(swordProgress.required))
            },
            {
                key: 'INSECT',
                name: 'Khu Trùng Thuật',
                description: 'Điểm linh trùng nhập trận, bám sát mục tiêu và công phạt theo bản mệnh từng loài.',
                unlocked: this.hasKhuTrungThuatUnlocked(),
                active: this.attackMode === 'INSECT',
                ready: this.canUseInsectAttackMode(),
                accent: CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.color || '#ff92c2',
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
        const swordProgress = this.getSwordFormationProgress();
        if (skillBtn) {
            skillBtn.classList.toggle('is-active', this.hasActiveAttackSkill() || this.hasActiveArtifact());
            skillBtn.classList.toggle('is-disabled', !this.hasDaiCanhKiemTranUnlocked() && !this.hasKhuTrungThuatUnlocked() && !this.hasKnownArtifact() && !this.hasKnownSwordArtifact());

            if (this.attackMode === 'INSECT') {
                skillBtn.title = `Khu Trùng Thuật - ${formatNumber(this.getCombatReadyInsectCount())} linh trùng xuất trận`;
            } else if (this.attackMode === 'SWORD') {
                skillBtn.title = `Đại Canh Kiếm Trận - ${formatNumber(this.getAliveSwordStats().alive)} kiếm hộ trận`;
            } else if (this.hasDaiCanhKiemTranUnlocked()) {
                skillBtn.title = SWORD_UI_TEXT.titleLearned(formatNumber(swordProgress.bonded), formatNumber(swordProgress.required));
            } else if (swordProgress.bonded > 0 || swordProgress.stocked > 0) {
                skillBtn.title = `Thanh Trúc Phong Vân Kiếm - ${formatNumber(swordProgress.bonded)} thanh đã triển khai, Đại Canh dùng ${formatNumber(swordProgress.required)} thanh`;
            } else if (this.hasActiveArtifact()) {
                skillBtn.title = `Pháp bảo hộ thể - ${this.getActiveArtifactNames().join(', ')}`;
            } else {
                skillBtn.title = 'Bảng bí pháp';
            }
        }

        const swordCounter = document.getElementById('sword-counter');
        if (swordCounter) {
            swordCounter.classList.toggle('is-hidden', this.isInsectSwarmActive() || this.isInsectUltimateActive());
        }

        this.renderPhongLoiBlinkButton();

        GameProgress.requestSave();
    },

    ensureValidAttackMode() {
        const previousMode = this.attackMode;

        if (this.attackMode === 'SWORD' && !this.canDeployDaiCanhKiemTran()) {
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

        const previousMode = this.attackMode;
        this.attackMode = 'BASE';
        syncSwordFormation();
        showNotify(
            `Thu hồi bí pháp, trở về ${formatNumber(getBaseSwordCountBeforeFormation())} thanh bản mệnh kiếm.`,
            previousMode === 'INSECT'
                ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.color || '#ff92c2')
                : (CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.color || '#ffd36b')
        );
        return true;
    },

    setAttackMode(mode) {
        const nextMode = mode === 'INSECT' ? 'INSECT' : 'SWORD';

        if (this.isUltimateBusy()) {
            showNotify('Không thể đổi bí pháp khi tuyệt kỹ đang vận chuyển.', '#ffd36b');
            return false;
        }

        if (!this.hasUnlockedAttackSkill(nextMode)) {
            if (nextMode === 'SWORD') {
                const progress = this.getSwordFormationProgress();
                showNotify(
                    this.hasDaiCanhKiemTranUnlocked()
                        ? SWORD_UI_TEXT.needCount(formatNumber(progress.bonded), formatNumber(progress.required))
                        : SWORD_UI_TEXT.NEED_ART,
                    '#ffd36b'
                );
            } else {
                showNotify('Chưa lĩnh ngộ bí pháp này.', '#ffd36b');
            }
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
            nextMode === 'INSECT'
                ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.color || '#ff92c2')
                : (CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.color || '#ffd36b')
        );
        return true;
    },

    hasBeastCapacity(amount = 1, speciesKey = null) {
        const safeAmount = Math.max(0, Math.floor(amount || 0));
        if (speciesKey) {
            const capacity = this.getBeastBagCapacity(speciesKey);
            if (!Number.isFinite(capacity)) return true;
            return (this.getInsectHabitatOccupancy(speciesKey) + safeAmount) <= capacity;
        }

        const capacity = this.getBeastBagCapacity();
        if (!Number.isFinite(capacity)) return true;
        return (this.getTotalTamedInsectCount() + safeAmount) <= capacity;
    },

    addInsectEgg(speciesKey, count = 1) {
        const species = this.getInsectSpecies(speciesKey);
        const safeCount = Math.max(0, Math.floor(count || 0));
        if (!species || safeCount <= 0) return 0;

        this.insectEggs[speciesKey] = Math.max(0, Math.floor(this.insectEggs[speciesKey] || 0)) + safeCount;
        this.markDiscoveredInsect(speciesKey);
        return safeCount;
    },

    changeTamedInsects(speciesKey, delta = 0, options = {}) {
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

        this.updateInsectColonyPopulation(speciesKey, currentCount, nextCount, options);

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

        this.changeTamedInsects(speciesKey, hatchCount, { source: 'hatch' });
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
        const candidates = pool.filter(speciesKey => this.getSpeciesCareStatus(speciesKey).canReproduce);

        if (!candidates.length || Math.random() >= chance) return null;

        const weighted = {};
        candidates.forEach(speciesKey => {
            const species = this.getInsectSpecies(speciesKey);
            const count = this.tamedInsects[speciesKey] || 0;
            weighted[speciesKey] = Math.max(0.05, count * Math.max(0.15, species?.fertility || 1));
        });

        const chosenKey = pickWeightedKey(weighted, candidates[0]);
        this.changeTamedInsects(chosenKey, 1, { source: 'breed' });
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
            || (CONFIG.SWORD?.ARTIFACT_ITEM?.uniqueKey === uniqueKey ? CONFIG.SWORD.ARTIFACT_ITEM : null)
            || CONFIG.ARTIFACTS?.[uniqueKey]
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
            RAINBOW_BAG: { SUPREME: CONFIG.ITEMS.SEVEN_COLOR_BAG },
            SWORD_ART: CONFIG.SECRET_ARTS,
            FLAME_ART: CONFIG.SECRET_ARTS,
            ARTIFACT: CONFIG.ARTIFACTS,
            INSECT_SKILL: CONFIG.INSECT.UNIQUE_ITEMS,
            INSECT_ARTIFACT: CONFIG.INSECT.UNIQUE_ITEMS,
            SPIRIT_BAG: { HIGH: CONFIG.INSECT.BEAST_BAG },
            RAINBOW_SPIRIT_BAG: { SUPREME: CONFIG.INSECT.SEVEN_COLOR_BEAST_BAG }
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

        if (item.category === 'SWORD_ARTIFACT') {
            return this.getThanhTrucSwordArtifactConfig() || CONFIG.PILL.EXP_QUALITIES.LOW;
        }

        if (item.category === 'RAINBOW_BAG') {
            return CONFIG.ITEMS.SEVEN_COLOR_BAG;
        }

        if (item.category === 'RAINBOW_SPIRIT_BAG') {
            return CONFIG.INSECT.SEVEN_COLOR_BEAST_BAG;
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

        if (item.category === 'SWORD_ARTIFACT') {
            return qualityConfig.fullName || 'Thanh Truc Phong Van Kiem';
        }

        if (item.uniqueKey && qualityConfig.fullName) {
            return qualityConfig.fullName;
        }

        if (item.category === 'BREAKTHROUGH') {
            const realmName = item.realmName || this.getNextMajorRealmInfo()?.name || 'đột phá';
            return `${qualityConfig.label} ${realmName} đan`;
        }

        if (['BAG', 'RAINBOW_BAG', 'SPIRIT_BAG', 'RAINBOW_SPIRIT_BAG', 'SPIRIT_HABITAT'].includes(item.category)) {
            return qualityConfig.fullName;
        }

        return qualityConfig.fullName;
    },

    _getItemCategoryLabelLegacy(item) {
        const staticLabels = {
            MATERIAL: 'Nguyên liệu',
            SPIRIT_HABITAT: 'Linh thú Đại',
            BAG: 'Túi trữ vật',
            SPIRIT_BAG: 'Linh thú Đại',
            ARTIFACT: 'Pháp bảo',
            INSECT_SKILL: 'Trùng đạo bí pháp',
            INSECT_ARTIFACT: 'Kỳ trùng bảo vật',
            INSECT_EGG: 'Trứng noãn'
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
            return 'Cực phẩm đạo đan bảy sắc, lập tức đưa tu vi lên Đạo Tổ đỉnh phong, mở thất sắc đạo quang và để lại trạng thái vô hạn.';
        }

        if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
            return 'Cấm kỵ hắc đan, cưỡng ép bước vào Đạo Tổ đỉnh phong trong 1 phút rồi tan vào hư vô. Chỉ có thể hồi phục khi tải lại giới vực.';
        }

        if (item.category === 'SPIRIT_HABITAT') {
            const species = this.getInsectSpecies(item.speciesKey);
            const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
            return species
                ? `Linh Thú Đại riêng dành cho ${species.name}. Lần mua đầu tiên sẽ khai mở tab riêng, mỗi lần mua sau mở rộng thêm ${formatNumber(extraSlots)} ô sức chứa cho chính loài này.`
                : `Linh Thú Đại riêng giúp kỳ trùng sinh nở an toàn và mỗi lần mua tăng thêm ${formatNumber(extraSlots)} ô sức chứa.`;
        }

        if (item.category === 'MATERIAL') {
            const usageSummary = this.getMaterialUsageSummary(item.materialKey);
            return [qualityConfig.description, usageSummary].filter(Boolean).join(' ');
        }

        if (item.category === 'SWORD_ARTIFACT') {
            const progress = this.getSwordFormationProgress();
            const storedText = progress.stocked > 0
                ? ` Trong túi còn ${formatNumber(progress.stocked)} thanh chờ triển khai.`
                : '';

            return `${qualityConfig.description || 'Kiếm khí trúc xanh có thể hợp tan tùy niệm.'} Tính năng: ${qualityConfig.featureSummary || 'Phân kiếm thành trận và dẫn lôi điện.'} Phẩm cấp hiện tại: ${qualityConfig.realmLabel || 'Pháp bảo'}. Tiềm lực tiến hóa: ${qualityConfig.evolutionLabel || 'Linh bảo'}. Hệ phẩm cấp pháp bảo: ${qualityConfig.gradeSystem || ''} Hiện đã triển khai ${formatNumber(progress.bonded)} thanh hộ thân; Đại Canh Kiếm Trận sẽ vận dụng ${formatNumber(progress.required)} thanh.${storedText}`;
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
            case 'RAINBOW_BAG':
                return 'Thất sắc trữ vật nang mở ra không gian vô hạn, có thể dung nạp mọi loại vật phẩm. Chỉ có thể mua một lần nhưng giá cực cao.';
            case 'RAINBOW_SPIRIT_BAG':
                return 'Thất sắc Linh thú Đại có thể chứa mọi loài kỳ trùng với dung lượng vô hạn. Sau khi sở hữu, mọi loài đều được xem như có chỗ an trí phù hợp.';
            case 'BAG': {
                const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
                return `Mở rộng túi trữ vật thêm ${formatNumber(extraSlots)} ô. Có thể mua nhiều lần để cộng dồn dung lượng.`;
            }
            case 'SPIRIT_BAG': {
                const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
                return `Mở rộng Linh Thú Đại thêm ${formatNumber(extraSlots)} ô, tăng chỗ cho linh trùng đã nở. Có thể mua nhiều lần để cộng dồn dung lượng.`;
            }
            case 'SWORD_ART':
                if (item.uniqueKey === 'DAI_CANH_KIEM_TRAN') {
                    return `Trận đạo bí pháp chuyên dùng ${formatNumber(getConfiguredSwordCount())} thanh Thanh Trúc Phong Vân Kiếm để lập đại trận hộ thân và công phạt. Chỉ khi gom đủ kiếm và lĩnh ngộ bí pháp mới có thể khai triển trận đồ hoàn chỉnh.`;
                }
                return SWORD_UI_TEXT.secretArtDescription(formatNumber(getConfiguredSwordCount()));
            case 'FLAME_ART':
                return 'Thiên địa linh hỏa Càn Lam Băng Diễm. Sau khi luyện hóa, con trỏ tâm niệm mới hiện hóa thành lam diễm.';
            case 'ARTIFACT':
                return qualityConfig.description || 'Pháp bảo hộ thân sau khi luyện hóa có thể khai triển quanh tâm ấn trong Bảng Bí Pháp.';
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
                return `Tăng ${Math.round(qualityConfig.breakthroughBoost * 100)}% tỷ lệ đột phá tới ${realmName}.`;
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
                return `Tăng vĩnh viễn ${Math.round((qualityConfig.dropRatePct || 0) * 100)}% tỷ lệ rơi đan dược và linh thạch.`;
            case 'EXP':
            default:
                return `Tăng ${Math.round(qualityConfig.expFactor * 100)}% tu vi của cảnh giới hiện tại.`;
        }
    },

    getItemDescriptionMarkup(item) {
        const description = repairLegacyText(this.getItemDescription(item)).trim();
        const contentMarkup = buildItemDescriptionContentMarkup(description);
        const shouldCollapse = description.length > ITEM_DESCRIPTION_COLLAPSE_THRESHOLD || description.includes('Tác dụng phụ:');

        if (!shouldCollapse) {
            return `<div class="item-description__body">${contentMarkup}</div>`;
        }

        return `
            <div class="item-description__preview">${contentMarkup}</div>
            <button
                type="button"
                class="item-description__toggle"
                data-description-toggle
                aria-expanded="false"
                aria-label="Xem thêm mô tả"
            >Xem thêm</button>
            <div class="item-description__full">${contentMarkup}</div>
        `.trim();
    },

    getItemCategoryLabel(item) {
        if (item.category === 'RAINBOW_BAG') return 'Túi trữ vật';
        if (item.category === 'RAINBOW_SPIRIT_BAG') return 'Linh thú Đại';
        const staticLabels = {
            MATERIAL: 'Nguyên liệu',
            SPIRIT_HABITAT: 'Linh thú Đại',
            BAG: 'Túi trữ vật',
            SPIRIT_BAG: 'Linh thú Đại',
            ARTIFACT: 'Pháp bảo',
            SWORD_ART: 'Kiếm đạo bí pháp',
            FLAME_ART: 'Thiên địa linh hỏa',
            INSECT_SKILL: 'Trùng đạo bí pháp',
            INSECT_ARTIFACT: 'Kỳ trùng bảo vật',
            INSECT_EGG: 'Trứng noãn'
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
            return 'Cực phẩm đạo đan bảy sắc, lập tức đưa tu vi lên Đạo tổ đỉnh phong, mở thất sắc đạo quang và để lại trạng thái vô hạn.';
        }

        if (item.specialKey === 'TAN_DAO_DIET_NGUYEN_DAN') {
            return 'Cấm kỵ hắc đan, cưỡng ép bước vào Đạo tổ đỉnh phong trong 1 phút rồi tan vào hư vô. Chỉ có thể hồi phục khi tải lại giới vực.';
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
            case 'ARTIFACT':
                return qualityConfig.description || 'Pháp bảo hộ thân sau khi luyện hóa có thể khai triển quanh tâm ấn trong Bảng Bí Pháp.';
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
        if (item.category === 'SWORD_ARTIFACT') return true;
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
                category: SWORD_SECRET_ART_KEYS.includes(uniqueKey) ? 'SWORD_ART' : 'FLAME_ART',
                quality: artConfig.quality || 'SUPREME',
                uniqueKey,
                priceLowStone: artConfig.buyPriceLowStone || 0,
                isOneTime: true
            });
        });

        if (CONFIG.SWORD?.ARTIFACT_ITEM) {
            items.push({
                id: `SWORD_ARTIFACT:${CONFIG.SWORD.ARTIFACT_ITEM.uniqueKey || 'THANH_TRUC_PHONG_VAN_KIEM'}`,
                kind: 'UNIQUE',
                category: 'SWORD_ARTIFACT',
                quality: CONFIG.SWORD.ARTIFACT_ITEM.quality || 'HIGH',
                uniqueKey: CONFIG.SWORD.ARTIFACT_ITEM.uniqueKey || 'THANH_TRUC_PHONG_VAN_KIEM',
                priceLowStone: CONFIG.SWORD.ARTIFACT_ITEM.buyPriceLowStone || 0
            });
        }

        Object.entries(CONFIG.ARTIFACTS || {}).forEach(([uniqueKey, artifactConfig]) => {
            items.push({
                id: `ARTIFACT:${uniqueKey}`,
                kind: 'UNIQUE',
                category: 'ARTIFACT',
                quality: artifactConfig.quality || 'SUPREME',
                uniqueKey,
                priceLowStone: artifactConfig.buyPriceLowStone || 0,
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

        if (CONFIG.ITEMS?.SEVEN_COLOR_BAG) {
            items.push({
                id: 'RAINBOW_BAG:SUPREME',
                kind: 'UPGRADE',
                category: 'RAINBOW_BAG',
                quality: CONFIG.ITEMS.SEVEN_COLOR_BAG.quality || 'SUPREME',
                uniqueKey: 'THAT_SAC_TRU_VAT_NANG',
                priceLowStone: CONFIG.ITEMS.SEVEN_COLOR_BAG.buyPriceLowStone || 0,
                isOneTime: true
            });
        }

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

        if (CONFIG.INSECT?.SEVEN_COLOR_BEAST_BAG) {
            items.push({
                id: 'RAINBOW_SPIRIT_BAG:SUPREME',
                kind: 'UPGRADE',
                category: 'RAINBOW_SPIRIT_BAG',
                quality: CONFIG.INSECT.SEVEN_COLOR_BEAST_BAG.quality || 'SUPREME',
                uniqueKey: 'THAT_SAC_LINH_THU_DAI',
                priceLowStone: CONFIG.INSECT.SEVEN_COLOR_BEAST_BAG.buyPriceLowStone || 0,
                isOneTime: true
            });
        }

        const shopOrder = {
            SWORD_ART: -5,
            FLAME_ART: -4,
            SWORD_ARTIFACT: -3.75,
            ARTIFACT: -3.5,
            INSECT_SKILL: -3,
            INSECT_ARTIFACT: -2,
            RAINBOW_SPIRIT_BAG: -1.6,
            SPIRIT_HABITAT: -1.25,
            INSECT_EGG: -1.1,
            RAINBOW_BAG: -1.05,
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
        this.enforcePhongLoiSiSwordRequirement({ silent: true });
        this.renderExpUI();

        if (BeastBagUI && typeof BeastBagUI.syncAvailability === 'function') {
            BeastBagUI.syncAvailability();
        }

        if (ShopUI && typeof ShopUI.render === 'function') {
            ShopUI.render();
        }

        if (InventoryUI && typeof InventoryUI.render === 'function') {
            InventoryUI.render();
        }

        if (BeastBagUI && typeof BeastBagUI.isOpen === 'function' && BeastBagUI.isOpen()) {
            BeastBagUI.render();
        }

        if (ProfileUI && typeof ProfileUI.render === 'function') {
            ProfileUI.render();
        }

        // Không render SkillsUI liên tục trong refresh tổng để tránh giật danh sách kiếm khi người dùng đang cuộn.
        // SkillsUI sẽ tự render khi mở popup hoặc khi người dùng tương tác trực tiếp trong popup.

        if (InsectBookUI && typeof InsectBookUI.isOpen === 'function' && InsectBookUI.isOpen()) {
            InsectBookUI.render();
        }

        this.renderAttackModeUI();
        GameProgress.requestSave();
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

        if (false && item.category === 'SWORD_ARTIFACT') {
            const progress = this.getSwordFormationProgress();
            if (progress.owned >= progress.required) {
                showNotify(
                    `Đã kết duyên đủ ${formatNumber(progress.required)} thanh Thanh Trúc Phong Vân Kiếm, không cần mua thêm.`,
                    qualityConfig.color || '#66f0c2'
                );
                return false;
            }
        }

        if (item.category === 'BAG' && !this.canUpgradeInventoryCapacity(item)) {
            showNotify('Túi trữ vật này chưa thể gia tăng dung lượng.', '#ffd36b');
            return false;
        }

        if (item.category === 'RAINBOW_BAG' && !this.canUpgradeInventoryCapacity(item)) {
            showNotify('Thất Sắc Trữ Vật Nang đã được khai mở.', qualityConfig.color || '#ffd36b');
            return false;
        }

        if (item.category === 'SPIRIT_BAG' && !this.canUpgradeBeastBagCapacity(item)) {
            showNotify('Linh Thú Đại này chưa thể gia tăng dung lượng.', qualityConfig.color || '#ffd36b');
            return false;
        }

        if (item.category === 'RAINBOW_SPIRIT_BAG' && !this.canUpgradeBeastBagCapacity(item)) {
            showNotify('Thất Sắc Linh Thú Đại đã được khai mở.', qualityConfig.color || '#ffd36b');
            return false;
        }

        if (item.category === 'SPIRIT_HABITAT' && !this.canUpgradeBeastBagCapacity(item)) {
            showNotify(
                this.hasSevenColorSpiritBag()
                    ? 'Thất Sắc Linh Thú Đại đã khai mở, không cần mua thêm Linh Thú Đại riêng.'
                    : 'Linh Thú Đại này chưa thể khai mở.',
                qualityConfig.color || '#8ebfff'
            );
            return false;
        }

        const requiresInventorySpace = !['BAG', 'RAINBOW_BAG', 'SPIRIT_BAG', 'RAINBOW_SPIRIT_BAG', 'SPIRIT_HABITAT', 'INSECT_EGG'].includes(item.category);
        if (requiresInventorySpace && !this.hasInventorySpaceForSpec(item)) {
            showNotify('Túi trữ vật đã đầy, không thể mua thêm vật phẩm mới.', '#ff8a80');
            return false;
        }

        if (!this.spendSpiritStones(item.priceLowStone)) {
            showNotify('Linh thạch không đủ để giao dịch', '#ff8a80');
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

        if (item.category === 'RAINBOW_BAG') {
            this.markUniquePurchase(item.uniqueKey);
            showNotify(
                'Thất Sắc Trữ Vật Nang đã khai mở, túi trữ vật đạt dung lượng vô hạn.',
                qualityConfig.color || '#fff1a8'
            );
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'RAINBOW_SPIRIT_BAG') {
            this.markUniquePurchase(item.uniqueKey);
            showNotify(
                'Thất Sắc Linh Thú Đại đã khai mở, mọi kỳ trùng đều có thể an trí trong không gian vô hạn.',
                qualityConfig.color || '#ffe38b'
            );
            this.refreshResourceUI();
            return true;
        }

        if (item.category === 'SPIRIT_HABITAT') {
            const hadDedicatedHabitat = Boolean(this.insectHabitats?.[item.speciesKey]);
            const extraSlots = Math.max(0, Math.floor(qualityConfig.capacity || 0));
            const nextCapacity = this.upgradeInsectHabitatCapacity(item.speciesKey, extraSlots, { unlock: true });
            const actionText = hadDedicatedHabitat ? 'mở rộng lên' : 'đã khai mở với sức chứa';
            const deltaText = hadDedicatedHabitat ? ` (+${formatNumber(extraSlots)} ô)` : '';

            showNotify(
                `${this.getItemDisplayName(item)} ${actionText} ${formatNumber(nextCapacity)} ô${deltaText}`,
                qualityConfig.color || '#8ebfff'
            );
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
        if (['ARTIFACT', 'SWORD_ARTIFACT', 'INSECT_ARTIFACT', 'INSECT_SKILL', 'SWORD_ART', 'FLAME_ART'].includes(item.category)) return 0;

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

        if (item.category === 'ARTIFACT' && this.hasArtifactUnlocked(item.uniqueKey)) {
            showNotify(`${this.getItemDisplayName(item)} đã được luyện hóa, chỉ cần vào Bảng Bí Pháp để triển khai.`, qualityConfig.color || '#9fe8ff');
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
            case 'ARTIFACT':
                this.unlockCultivationArt(item.uniqueKey);
                this.setArtifactDeployment(item.uniqueKey, true, { silent: true, skipRefresh: true });
                showNotify(
                    `Luyện hóa ${this.getItemDisplayName(item)}: ${this.getArtifactAttunementNote(item.uniqueKey)}`,
                    qualityConfig.color || '#9fe8ff'
                );
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
        if (this.rankIndex >= this.getMaxRankIndex() || currentRank.infiniteStats) {
            this.isReadyToBreak = false;
            showNotify(`Đã chạm ${currentRank.name}, thiên đạo không còn cửa ải cao hơn`, getRankAccentColor(currentRank));
            this.refreshResourceUI();
            return;
        }

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
                    showNotify(`CƯỠNG ÉP ĐỘT PHÁ THÀNH CÔNG: ${nextRank.name.toUpperCase()}`, "#ff8800");
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
        const rankAccent = getRankAccentColor(rank);
        const rankLight = getRankLightColor(rank);

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
                ? `<span style="color:#b48cff; font-weight:bold;">${UI_TEXT.VOID_COLLAPSED}</span>`
                : this.isReadyToBreak ?
                `<span style="color:#ffcc00; font-weight:bold;">SẴN SÀNG ĐỘT PHÁ</span>` :
                `Tu vi: ${formatNumber(this.exp)}/${formatNumber(rank.exp)}`;

            textExp.innerHTML = `${statusText} | ` +
                `<span style="color:#86fff0">Cơ sở: ${basePercent}%</span> | ` +
                `<span style="color:#ffd36b">Đan trợ lực: +${bonusPercent}%</span> | ` +
                `<span style="color:#ff9ef7">Tổng TL: ${totalPercent}%</span>`;
        }

        if (breakthroughGroup) {
            if (this.isReadyToBreak && this.rankIndex < this.getMaxRankIndex() && !rank.infiniteStats) breakthroughGroup.classList.add('is-active');
            else breakthroughGroup.classList.remove('is-active');
        }

        const percentage = getSafeProgressPercent(this.exp, rank.exp);
        if (barExp) {
            barExp.style.width = `${percentage}%`;
            barExp.style.background = getRankBarBackground(rank);

            if (this.isReadyToBreak) {
                barExp.style.boxShadow = `0 0 15px #fff, 0 0 5px ${rankAccent}`;
                barExp.classList.add('exp-full-glow');
            } else {
                barExp.style.boxShadow = `0 0 10px ${rankLight}`;
                barExp.classList.remove('exp-full-glow');
            }
        }

        if (rankText) {
            rankText.innerText = `Cảnh giới: ${rank.name}`;
            applyRankTextVisual(rankText, rank);
        }
        if (ProfileUI && typeof ProfileUI.isOpen === 'function' && ProfileUI.isOpen()) {
            ProfileUI.render();
        }

        GameProgress.requestSave();
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
            this.stopTouchCursor();
            this.pinchZoomActive = false;
            return;
        }

        this.updateBeastCare();

        const joystickTarget = this.getMoveJoystickTarget();
        if (joystickTarget) {
            this.x = joystickTarget.x;
            this.y = joystickTarget.y;
        } else if (this.isTouchDevice && this.hasActiveTouchCursor()) {
            const worldPos = Camera.screenToWorld(this.screenX, this.screenY);
            this.x = worldPos.x;
            this.y = worldPos.y;
        } else if (this.isTouchDevice) {
            this.x = guardCenter.x;
            this.y = guardCenter.y;
        } else {
            const worldPos = Camera.screenToWorld(this.screenX, this.screenY);
            this.x = worldPos.x;
            this.y = worldPos.y;
        }

        // Tính tốc độ di chuyển của con trỏ/ngón tay
        this.screenSpeed = Math.hypot(this.screenX - this.prevScreenX, this.screenY - this.prevScreenY);
        this.prevScreenX = this.screenX;
        this.prevScreenY = this.screenY;
        this.speed = Math.hypot(this.x - this.px, this.y - this.py);
        this.px = this.x; this.py = this.y;

        this.ensureValidAttackMode();

        // Gọi hàm xử lý tiêu hao mana
        this.processActiveConsumption(dt);
    },

    handleMove(e) {
        if (this.isVoidCollapsed) return;
        const isTouchPointer = this.isTouchDevice && e.pointerType && e.pointerType !== 'mouse';
        if (isTouchPointer) {
            if (!this.touchCursor.active || this.touchCursor.pointerId !== e.pointerId || this.pinchZoomActive) return;
            this.updateTouchCursor(e.clientX, e.clientY);
            return;
        }

        if (this.isTouchDevice) return;
        if (e.target.closest('.btn')) return;

        // Pointermove hoạt động cho cả chuột và touch di chuyển
        const p = e.touches ? e.touches[0] : e;
        this.screenX = p.clientX;
        this.screenY = p.clientY;
    },

    handleDown(e) {
        if (this.isVoidCollapsed) return;
        const isTouchPointer = this.isTouchDevice && e.pointerType && e.pointerType !== 'mouse';

        if (isTouchPointer) {
            this.startTouchCursor(e.pointerId, e.target, e.clientX, e.clientY);
            return;
        }

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
        const isTouchPointer = this.isTouchDevice && e.pointerType && e.pointerType !== 'mouse';
        if (isTouchPointer) {
            this.stopTouchCursor(e.pointerId);
            return;
        }
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

        markLeaderInsectVisuals(visuals);
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
            const size = Math.max(1.8, node.size * scaleFactor * (node.isLeader ? 1.8 : 1));

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
            case 'LUC_DUC_SUONG_CONG': {
                primaryOutcome = strike(primaryTarget, baseFactor * 1.04, {
                    slowMs: 2200,
                    slowFactor: 0.18,
                    dodgeDisabledMs: 1200,
                    rootMs: 480 + Math.min(520, count * 18)
                });
                if (primaryOutcome.landed && sortedOthers.length) {
                    strike(sortedOthers[0], baseFactor * 0.42, {
                        slowMs: 1200,
                        slowFactor: 0.42,
                        ignoreDodge: true
                    });
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
        const visualSpeedMin = Math.max(0.2, Number(cfg.VISUAL_SPEED_MIN) || 0.72);
        const visualSpeedMax = Math.max(visualSpeedMin, Number(cfg.VISUAL_SPEED_MAX) || 1.6);
        const wobbleSpeedMin = Math.max(0.2, Number(cfg.VISUAL_WOBBLE_SPEED_MIN) || 0.6);
        const wobbleSpeedMax = Math.max(wobbleSpeedMin, Number(cfg.VISUAL_WOBBLE_SPEED_MAX) || 1.35);
        const idleOrbitSpeed = Math.max(0.2, Number(cfg.VISUAL_IDLE_ORBIT_SPEED) || 1.05);
        const attackOrbitSpeed = Math.max(0.2, Number(cfg.VISUAL_ATTACK_ORBIT_SPEED) || 1.45);
        const targetOrbitSpeed = Math.max(0.2, Number(cfg.VISUAL_TARGET_ORBIT_SPEED) || 1.7);
        const idleFollowSpeed = Math.max(1, Number(cfg.VISUAL_IDLE_FOLLOW_SPEED) || 6.2);
        const targetFollowSpeed = Math.max(1, Number(cfg.VISUAL_TARGET_FOLLOW_SPEED) || 6.8);
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
                speed: random(visualSpeedMin, visualSpeedMax),
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: random(wobbleSpeedMin, wobbleSpeedMax),
                size: random(2, 3.8) * (species?.tier === 'DE' ? 1.18 : 1),
                targetRef: null,
                trail: [],
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

            const previousTargetRef = node.targetRef || null;
            const profile = this.getInsectCombatProfile(node.speciesKey);
            const hasTargetFocus = this.isAttacking && focusTargets.length > 0;

            if (hasTargetFocus) {
                if (!focusTargets.includes(node.targetRef)) {
                    node.targetRef = this.chooseInsectTargetForSpecies(node.speciesKey, focusTargets, centerX, centerY);
                }
            } else {
                node.targetRef = null;
            }

            if (previousTargetRef !== node.targetRef) {
                node.trail = [];
            }

            const orbitMin = node.targetRef ? Math.max(8, (profile.latchRadius || 16) * 0.7) * scaleFactor : minRadius;
            const orbitMax = node.targetRef ? Math.max(orbitMin + 4, (profile.latchRadius || 16) * 1.35) * scaleFactor : maxRadius;
            const anchorX = node.targetRef ? node.targetRef.x : centerX;
            const anchorY = node.targetRef ? node.targetRef.y : centerY;
            const chaosJitter = node.targetRef ? jitter * 0.22 : jitter * 0.74;

            node.angle += dt * node.speed * (node.targetRef ? targetOrbitSpeed : (this.isAttacking ? attackOrbitSpeed : idleOrbitSpeed));
            node.wobble += dt * node.wobbleSpeed;
            node.targetRadius += random(node.targetRef ? -3.5 : -7, node.targetRef ? 3.5 : 7) * dt * 10;
            node.targetRadius = Math.max(orbitMin, Math.min(orbitMax, node.targetRadius));
            node.radius += (node.targetRadius - node.radius) * (node.targetRef ? 0.09 : 0.06);

            const swirlX = Math.cos(node.angle) * node.radius;
            const swirlY = Math.sin(node.angle * 1.18 + node.wobble) * (node.radius * (node.targetRef ? 0.54 : 0.72));
            const chaosX = Math.cos(node.wobble * 1.7 + node.angle * 0.45) * chaosJitter;
            const chaosY = Math.sin(node.wobble * 1.35 - node.angle * 0.4) * chaosJitter;

            syncInsectVisualMotion(
                node,
                anchorX + swirlX + chaosX,
                anchorY + swirlY + chaosY,
                dt,
                node.targetRef ? targetFollowSpeed : idleFollowSpeed,
                node.targetRef ? 5 : 4
            );
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
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const highlightedTargets = new Set();

        this.insectCombat.visuals.forEach(node => {
            const species = this.getInsectSpecies(node.speciesKey);
            const palette = getInsectCombatPalette(species);
            const size = Math.max(1.8, node.size * scaleFactor * (node.isLeader ? 1.8 : 1));

            drawInsectTrail(
                ctx,
                node,
                node.targetRef ? palette.aura : palette.primary,
                size * (node.targetRef ? 0.62 : 0.46),
                node.targetRef ? 0.36 : 0.22
            );

            if (node.targetRef && !highlightedTargets.has(node.targetRef)) {
                highlightedTargets.add(node.targetRef);
                ctx.beginPath();
                ctx.strokeStyle = withAlpha(palette.aura, 0.2);
                ctx.lineWidth = Math.max(0.7, 0.85 * scaleFactor);
                ctx.arc(node.targetRef.x, node.targetRef.y, Math.max(5 * scaleFactor, size * 1.55), 0, Math.PI * 2);
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
            gradient.addColorStop(0.18, palette.secondary);
            gradient.addColorStop(0.58, palette.primary);
            gradient.addColorStop(1, withAlpha(palette.aura, 0.08));

            ctx.beginPath();
            ctx.shadowBlur = node.targetRef ? 16 : 12;
            ctx.shadowColor = withAlpha(palette.aura, node.targetRef ? 0.92 : 0.78);
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
                speed: random(2.0, 4.2),
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: random(1.4, 3.2),
                size: random(2.6, 5.4) * (species?.tier === 'DE' ? 1.2 : 1),
                targetRef: null,
                trail: [],
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

            const previousTargetRef = node.targetRef || null;
            node.targetRef = focusTargets.length ? focusTargets[index % focusTargets.length] : null;
            if (previousTargetRef !== node.targetRef) {
                node.trail = [];
            }

            const profile = this.getInsectCombatProfile(node.speciesKey);
            const latchRadius = Math.max(10, (profile.latchRadius || 16) * scaleFactor);
            const anchorX = node.targetRef ? node.targetRef.x : centerX;
            const anchorY = node.targetRef ? node.targetRef.y : centerY;
            const minRadius = node.targetRef ? latchRadius * 0.55 : targetRadius;
            const maxRadius = node.targetRef ? latchRadius * 1.45 : orbitRadius;
            const nodeJitter = node.targetRef ? jitter * 0.26 : jitter * 0.68;

            node.angle += dt * node.speed * (node.targetRef ? 4.2 : 2.6);
            node.wobble += dt * node.wobbleSpeed;
            node.targetRadius += random(node.targetRef ? -2.5 : -6, node.targetRef ? 2.5 : 6) * dt * 10;
            node.targetRadius = Math.max(minRadius, Math.min(maxRadius, node.targetRadius));
            node.radius += (node.targetRadius - node.radius) * (node.targetRef ? 0.13 : 0.08);

            const swirlX = Math.cos(node.angle) * node.radius;
            const swirlY = Math.sin(node.angle * 1.35 + node.wobble) * (node.radius * (node.targetRef ? 0.48 : 0.76));
            const chaosX = Math.cos(node.wobble * 1.8 + node.angle * 0.52) * nodeJitter;
            const chaosY = Math.sin(node.wobble * 1.55 - node.angle * 0.46) * nodeJitter;

            syncInsectVisualMotion(
                node,
                anchorX + swirlX + chaosX,
                anchorY + swirlY + chaosY,
                dt,
                node.targetRef ? 13 : 9.5,
                node.targetRef ? 6 : 5
            );
        });

        markLeaderInsectVisuals(visuals);
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
        ctx.lineJoin = 'round';
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

        const highlightedTargets = new Set();
        this.insectUltimate.visuals.forEach(node => {
            const species = this.getInsectSpecies(node.speciesKey);
            const palette = getInsectCombatPalette(species);
            const size = Math.max(2.2, node.size * scaleFactor * 1.14);

            drawInsectTrail(
                ctx,
                node,
                node.targetRef ? palette.aura : palette.primary,
                size * (node.targetRef ? 0.72 : 0.56),
                node.targetRef ? 0.4 : 0.24
            );

            if (node.targetRef && !highlightedTargets.has(node.targetRef)) {
                highlightedTargets.add(node.targetRef);
                ctx.beginPath();
                ctx.strokeStyle = withAlpha(palette.aura, 0.24);
                ctx.lineWidth = Math.max(0.8, 1.1 * scaleFactor);
                ctx.arc(node.targetRef.x, node.targetRef.y, Math.max((node.targetRef.r + 7) * scaleFactor, size * 1.8), 0, Math.PI * 2);
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
            gradient.addColorStop(0.16, palette.secondary);
            gradient.addColorStop(0.62, palette.primary);
            gradient.addColorStop(1, withAlpha(palette.aura, 0.08));

            ctx.beginPath();
            ctx.shadowBlur = node.targetRef ? 18 : 14;
            ctx.shadowColor = withAlpha(palette.aura, node.targetRef ? 1 : 0.82);
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

    createPhongLoiBlinkBurst(x, y, directionX = 1, directionY = 0, { arrival = true } = {}) {
        trimVisualParticles(280);
        const artifactConfig = this.getArtifactConfig('PHONG_LOI_SI') || {};
        const cfg = this.getPhongLoiBlinkConfig();
        const primaryColor = artifactConfig.color || '#9fe8ff';
        const secondaryColor = artifactConfig.secondaryColor || '#dffeff';
        const auraColor = artifactConfig.auraColor || '#89a6ff';
        const flashLife = Math.max(0.05, cfg.flashMs / 1000);
        const rayPalette = arrival
            ? ['#ffffff', primaryColor, '#d5d8ff', '#b48cff']
            : [secondaryColor, primaryColor, auraColor, '#ffffff'];
        const rayCount = arrival ? 12 : 8;
        const sparkCount = arrival ? 16 : 10;
        const directionAngle = Math.atan2(directionY, directionX || 0.0001);

        visualParticles.push(
            {
                type: 'glow',
                x,
                y,
                size: arrival ? 20 : 14,
                sizeVelocity: arrival ? 2.1 : 1.2,
                life: flashLife,
                decay: flashLife > 0 ? (1 / flashLife) : 1,
                opacity: arrival ? 0.9 : 0.38,
                color: '#ffffff',
                glow: arrival ? 28 : 18
            },
            {
                type: 'ring',
                x,
                y,
                radius: arrival ? 14 : 8,
                radialVelocity: arrival ? 5.8 : 4.2,
                lineWidth: arrival ? 3.2 : 2.2,
                life: 0.96,
                decay: arrival ? 0.046 : 0.062,
                opacity: 0.9,
                color: arrival ? primaryColor : secondaryColor,
                glow: arrival ? 20 : 14
            },
            {
                type: 'ring',
                x,
                y,
                radius: arrival ? cfg.impactRadius : 18,
                radialVelocity: arrival ? 6.2 : 4.4,
                lineWidth: arrival ? 2.4 : 1.8,
                life: 0.9,
                decay: arrival ? 0.038 : 0.05,
                opacity: 0.64,
                color: auraColor,
                glow: 16
            }
        );

        for (let i = 0; i < rayCount; i++) {
            const angle = arrival
                ? ((Math.PI * 2 * i) / rayCount) + random(-0.08, 0.08)
                : directionAngle + random(-0.55, 0.55);
            visualParticles.push({
                type: 'ray',
                x,
                y,
                angle,
                radius: random(arrival ? 4 : 2, arrival ? 14 : 8),
                radialVelocity: random(arrival ? 3.8 : 2.8, arrival ? 6.4 : 4.8),
                length: random(arrival ? 20 : 16, arrival ? 40 : 30),
                lengthVelocity: random(0.18, 0.46),
                lineWidth: random(arrival ? 1.6 : 1.2, arrival ? 3.2 : 2.4),
                life: 0.9,
                decay: random(0.04, 0.058),
                opacity: arrival ? 0.92 : 0.82,
                color: rayPalette[i % rayPalette.length],
                glow: arrival ? 16 : 12
            });
        }

        for (let i = 0; i < sparkCount; i++) {
            const angle = arrival
                ? random(0, Math.PI * 2)
                : directionAngle + random(-0.72, 0.72);
            const speed = random(arrival ? 2.6 : 1.8, arrival ? 7.8 : 5.6);
            visualParticles.push({
                type: i % 5 === 0 ? 'square' : 'spark',
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - random(0.1, arrival ? 1.3 : 0.8),
                gravity: arrival ? 0.045 : 0.02,
                friction: 0.95,
                size: random(arrival ? 2.2 : 1.6, arrival ? 5.2 : 4.2),
                sizeVelocity: -0.04,
                life: 0.92,
                decay: random(0.024, 0.04),
                opacity: arrival ? 0.92 : 0.72,
                color: rayPalette[i % rayPalette.length],
                glow: arrival ? 14 : 10,
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

    getPhongLoiWingSpread() {
        const motionSpeed = this.isTouchDevice ? this.speed : this.screenSpeed;
        const targetSpread = this.isTouchDevice
            ? clampNumber((motionSpeed - 0.08) / 1.15, 0, 1)
            : clampNumber((motionSpeed - 1.25) / 13, 0, 1);
        const currentSpread = Number(this.phongLoiWingSpread) || 0;
        const smoothing = 0.16 + (targetSpread * 0.08);

        this.phongLoiWingSpread = clampNumber(currentSpread + ((targetSpread - currentSpread) * smoothing), 0, 1);

        return this.phongLoiWingSpread;
    },

    drawPhongLoiWingAura(ctx, options) {
        const {
            wingWidth,
            wingHeight,
            glowBlur,
            scaleFactor,
            spread,
            time,
            lightningLight,
            lightningMid,
            lightningDark
        } = options;
        const pulse = 0.58 + (Math.abs(Math.sin((time * 1.65) + (spread * 1.1))) * 0.42);
        const auraCount = Math.max(2, Math.floor(random(2, 4.2 + (spread * 1.8))));

        ctx.save();
        ctx.shadowBlur = glowBlur * (0.22 + (pulse * 0.24));
        ctx.shadowColor = withAlpha(lightningLight, 0.66);

        for (let i = 0; i < auraCount; i++) {
            const zoneRoll = Math.random();
            const spanRatio = random(0.08, 0.94);
            let px = 0;
            let py = 0;
            let driftX = 0;
            let driftY = 0;

            if (zoneRoll < 0.42) {
                px = wingWidth * (0.08 + (spanRatio * (0.68 + (spread * 0.18)))) + random(-1.3, 1.3) * scaleFactor;
                py = -wingHeight * (0.06 + (spanRatio * (0.62 + (spread * 0.18)))) + random(-2.4, -0.25) * scaleFactor;
                driftX = random(-1.6, 2.8) * scaleFactor;
                driftY = random(-2.2, 1.4) * scaleFactor;
            } else if (zoneRoll < 0.8) {
                px = wingWidth * (0.06 + (spanRatio * (0.58 + (spread * 0.12)))) + random(-1.2, 1.2) * scaleFactor;
                py = wingHeight * (0.02 + (spanRatio * (0.18 + (spread * 0.08)))) + random(0.25, 2.6) * scaleFactor;
                driftX = random(-1.8, 2.6) * scaleFactor;
                driftY = random(-1.6, 2.2) * scaleFactor;
            } else {
                px = wingWidth * (0.58 + (spanRatio * (0.24 + (spread * 0.16)))) + random(-1.1, 1.6) * scaleFactor;
                py = random(-wingHeight * (0.46 + (spread * 0.16)), wingHeight * (0.12 + (spread * 0.08)));
                driftX = random(-2.2, 2.8) * scaleFactor;
                driftY = random(-2.2, 2.2) * scaleFactor;
            }

            ctx.beginPath();
            ctx.moveTo(px, py);

            for (let step = 0; step < 3; step++) {
                px += driftX + random(-1.8, 1.8) * scaleFactor;
                py += driftY + random(-1.6, 1.6) * scaleFactor;
                ctx.lineTo(px, py);
            }

            const alpha = random(0.22, 0.46) * pulse;
            ctx.strokeStyle = withAlpha(i % 2 === 0 ? lightningLight : lightningMid, alpha);
            ctx.lineWidth = Math.max(0.45, random(0.65, 1.02) * scaleFactor);
            ctx.stroke();

            if (Math.random() < 0.36) {
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(
                    px + random(-1.8, 1.8) * scaleFactor,
                    py + random(-1.6, 1.6) * scaleFactor
                );
                ctx.strokeStyle = withAlpha(lightningDark, random(0.18, 0.34) * pulse);
                ctx.lineWidth = Math.max(0.3, random(0.38, 0.62) * scaleFactor);
                ctx.stroke();
            }
        }

        ctx.restore();
    },

    drawPhongLoiWing(ctx, options) {
        const {
            side,
            wingOffsetX,
            wingOffsetY,
            wingWidth,
            wingHeight,
            glowBlur,
            flapAmplitude,
            scaleFactor,
            spread,
            time,
            primaryColor,
            secondaryColor,
            auraColor,
            lightningLight,
            lightningMid,
            lightningDark
        } = options;
        const upperTipX = wingWidth * (0.88 + (spread * 0.28));
        const upperTipY = -wingHeight * (0.7 + (spread * 0.18));
        const lowerTailX = wingWidth * (0.52 + (spread * 0.08));
        const lowerTailY = wingHeight * (0.16 + (spread * 0.12));
        const flap = Math.sin((time * (1.02 + (spread * 0.32))) + (side < 0 ? 0.3 : 0.92))
            * ((flapAmplitude * 0.22) + (spread * flapAmplitude * 0.78));
        const rootSway = Math.sin(time + (side < 0 ? 0.45 : 1.08)) * wingHeight * (0.02 + (spread * 0.08));
        const poseOffsetX = wingOffsetX * (0.7 + (spread * 0.42));
        const poseOffsetY = wingOffsetY + (wingHeight * ((1 - spread) * 0.1)) + rootSway;
        const wingTilt = 0.54 - (spread * 0.34) + flap;
        const featherStrokes = [
            {
                startX: wingWidth * 0.06,
                startY: wingHeight * 0.01,
                controlX: wingWidth * 0.12,
                controlY: -wingHeight * 0.08,
                tipX: wingWidth * (0.24 + (spread * 0.04)),
                tipY: -wingHeight * (0.18 + (spread * 0.08)),
                color: secondaryColor,
                alpha: 0.52
            },
            {
                startX: wingWidth * 0.1,
                startY: wingHeight * 0.02,
                controlX: wingWidth * 0.22,
                controlY: -wingHeight * 0.16,
                tipX: wingWidth * (0.44 + (spread * 0.08)),
                tipY: -wingHeight * (0.4 + (spread * 0.12)),
                color: primaryColor,
                alpha: 0.5
            },
            {
                startX: wingWidth * 0.14,
                startY: wingHeight * 0.03,
                controlX: wingWidth * 0.3,
                controlY: -wingHeight * 0.2,
                tipX: wingWidth * (0.68 + (spread * 0.16)),
                tipY: -wingHeight * (0.64 + (spread * 0.18)),
                color: auraColor,
                alpha: 0.6
            },
            {
                startX: wingWidth * 0.1,
                startY: wingHeight * 0.07,
                controlX: wingWidth * 0.28,
                controlY: wingHeight * 0.03,
                tipX: wingWidth * (0.52 + (spread * 0.08)),
                tipY: wingHeight * (0.04 + (spread * 0.04)),
                color: primaryColor,
                alpha: 0.44
            },
            {
                startX: wingWidth * 0.08,
                startY: wingHeight * 0.09,
                controlX: wingWidth * 0.22,
                controlY: wingHeight * 0.16,
                tipX: wingWidth * (0.42 + (spread * 0.06)),
                tipY: wingHeight * (0.16 + (spread * 0.08)),
                color: auraColor,
                alpha: 0.38
            }
        ];

        ctx.save();
        ctx.scale(side, 1);
        ctx.translate(poseOffsetX, poseOffsetY);
        ctx.rotate(wingTilt);
        ctx.shadowBlur = glowBlur * (0.74 + (spread * 0.32));
        ctx.shadowColor = withAlpha(auraColor, 0.72);

        const wingGradient = ctx.createLinearGradient(0, -wingHeight * 0.9, upperTipX, lowerTailY);
        wingGradient.addColorStop(0, withAlpha(secondaryColor, 0.98));
        wingGradient.addColorStop(0.52, withAlpha(primaryColor, 0.94));
        wingGradient.addColorStop(1, withAlpha(auraColor, 0.24));

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(
            wingWidth * (0.18 + (spread * 0.03)),
            -wingHeight * (0.12 + (spread * 0.06)),
            wingWidth * (0.42 + (spread * 0.12)),
            -wingHeight * (0.56 + (spread * 0.14)),
            upperTipX,
            upperTipY
        );
        ctx.quadraticCurveTo(
            wingWidth * (0.78 + (spread * 0.12)),
            -wingHeight * (0.36 + (spread * 0.08)),
            wingWidth * (0.6 + (spread * 0.08)),
            -wingHeight * (0.06 + (spread * 0.04))
        );
        ctx.quadraticCurveTo(
            wingWidth * (0.72 + (spread * 0.1)),
            wingHeight * (0.08 + (spread * 0.04)),
            lowerTailX,
            lowerTailY
        );
        ctx.quadraticCurveTo(
            wingWidth * (0.28 + (spread * 0.05)),
            wingHeight * (0.24 + (spread * 0.08)),
            wingWidth * 0.1,
            wingHeight * (0.12 + (spread * 0.05))
        );
        ctx.quadraticCurveTo(wingWidth * 0.02, wingHeight * 0.05, 0, 0);
        ctx.closePath();
        ctx.fillStyle = wingGradient;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(wingWidth * 0.02, wingHeight * 0.01);
        ctx.quadraticCurveTo(
            wingWidth * (0.2 + (spread * 0.04)),
            -wingHeight * (0.16 + (spread * 0.04)),
            wingWidth * (0.64 + (spread * 0.12)),
            -wingHeight * (0.58 + (spread * 0.18))
        );
        ctx.quadraticCurveTo(
            wingWidth * (0.54 + (spread * 0.06)),
            -wingHeight * (0.28 + (spread * 0.08)),
            wingWidth * (0.44 + (spread * 0.02)),
            -wingHeight * 0.02
        );
        ctx.quadraticCurveTo(
            wingWidth * (0.48 + (spread * 0.04)),
            wingHeight * (0.04 + (spread * 0.03)),
            wingWidth * 0.16,
            wingHeight * (0.08 + (spread * 0.04))
        );
        ctx.closePath();
        ctx.fillStyle = withAlpha('#ffffff', 0.16 + (spread * 0.12));
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(
            wingWidth * 0.18,
            -wingHeight * 0.1,
            wingWidth * (0.36 + (spread * 0.12)),
            -wingHeight * (0.34 + (spread * 0.14)),
            wingWidth * (0.68 + (spread * 0.16)),
            -wingHeight * (0.62 + (spread * 0.2))
        );
        ctx.strokeStyle = withAlpha('#ffffff', 0.78);
        ctx.lineWidth = Math.max(0.7, 1.02 * scaleFactor);
        ctx.stroke();

        featherStrokes.forEach((feather, index) => {
            ctx.beginPath();
            ctx.moveTo(feather.startX, feather.startY);
            ctx.quadraticCurveTo(feather.controlX, feather.controlY, feather.tipX, feather.tipY);
            ctx.strokeStyle = withAlpha(feather.color, feather.alpha);
            ctx.lineWidth = Math.max(0.45, (0.9 - (index * 0.08)) * Math.max(scaleFactor, 0.9));
            ctx.stroke();
        });

        this.drawPhongLoiWingAura(ctx, {
            wingWidth,
            wingHeight,
            glowBlur,
            scaleFactor,
            spread,
            time,
            lightningLight,
            lightningMid,
            lightningDark
        });

        ctx.restore();
    },

    drawPhongLoiArtifact(ctx, scaleFactor) {
        if (!this.isArtifactDeployed('PHONG_LOI_SI')) return;

        const artifactConfig = this.getArtifactConfig('PHONG_LOI_SI');
        const cursorStyle = artifactConfig?.cursorStyle || {};
        const wingOffsetX = Math.max(9, (cursorStyle.WING_OFFSET_X || 15) * scaleFactor);
        const wingOffsetY = (cursorStyle.WING_OFFSET_Y || -1.5) * scaleFactor;
        const wingWidth = Math.max(8, (cursorStyle.WING_WIDTH || 15) * scaleFactor);
        const wingHeight = Math.max(10, (cursorStyle.WING_HEIGHT || 20) * scaleFactor);
        const glowBlur = Math.max(8, (cursorStyle.GLOW_BLUR || 16) * scaleFactor);
        const flapAmplitude = Number(cursorStyle.FLAP_AMPLITUDE) || 0.12;
        const time = performance.now() * (Number(cursorStyle.FLAP_SPEED) || 0.0052);
        const spread = this.getPhongLoiWingSpread();
        const secondaryColor = artifactConfig?.secondaryColor || '#dffeff';
        const primaryColor = artifactConfig?.color || '#9fe8ff';
        const auraColor = artifactConfig?.auraColor || '#89a6ff';
        const lightningLight = CONFIG.COLORS?.SWORD_GOLD_LIGHT || '#FFF2C2';
        const lightningMid = CONFIG.COLORS?.SWORD_GOLD_MID || '#E6C87A';
        const lightningDark = CONFIG.COLORS?.SWORD_GOLD_DARK || '#B8944E';

        ctx.save();
        ctx.translate(this.x, this.y);

        [-1, 1].forEach(side => {
            this.drawPhongLoiWing(ctx, {
                side,
                wingOffsetX,
                wingOffsetY,
                wingWidth,
                wingHeight,
                glowBlur,
                flapAmplitude,
                scaleFactor,
                spread,
                time,
                primaryColor,
                secondaryColor,
                auraColor,
                lightningLight,
                lightningMid,
                lightningDark
            });
        });

        ctx.restore();
    },

    drawPhongLoiBlinkGhost(ctx, effect, scaleFactor, artifactConfig) {
        const now = performance.now();
        const progress = (now - effect.startedAt) / Math.max(1, effect.durationMs || 1);
        if (progress >= 1) return;

        const cursorStyle = artifactConfig?.cursorStyle || {};
        const alpha = (1 - progress);
        const wingOffsetX = Math.max(8, (cursorStyle.WING_OFFSET_X || 15) * scaleFactor * 0.92);
        const wingOffsetY = (cursorStyle.WING_OFFSET_Y || -1.5) * scaleFactor;
        const wingWidth = Math.max(7, (cursorStyle.WING_WIDTH || 15) * scaleFactor * 0.92);
        const wingHeight = Math.max(9, (cursorStyle.WING_HEIGHT || 20) * scaleFactor * 0.92);
        const glowBlur = Math.max(6, (cursorStyle.GLOW_BLUR || 16) * scaleFactor * 0.72);
        const flapAmplitude = (Number(cursorStyle.FLAP_AMPLITUDE) || 0.12) * 0.7;
        const time = (effect.startedAt + (progress * 120)) * (Number(cursorStyle.FLAP_SPEED) || 0.0052);
        const spread = clampNumber(0.28 + (alpha * 0.42), 0.18, 0.92);
        const secondaryColor = artifactConfig?.secondaryColor || '#dffeff';
        const primaryColor = artifactConfig?.color || '#9fe8ff';
        const auraColor = artifactConfig?.auraColor || '#89a6ff';
        const lightningLight = CONFIG.COLORS?.SWORD_GOLD_LIGHT || '#FFF2C2';
        const lightningMid = CONFIG.COLORS?.SWORD_GOLD_MID || '#E6C87A';
        const lightningDark = CONFIG.COLORS?.SWORD_GOLD_DARK || '#B8944E';

        ctx.save();
        ctx.translate(effect.x, effect.y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.2 + (alpha * 0.32);
        ctx.shadowBlur = 18 * scaleFactor;
        ctx.shadowColor = withAlpha(auraColor, 0.65);

        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 28 * scaleFactor);
        halo.addColorStop(0, withAlpha('#ffffff', 0.26 * alpha));
        halo.addColorStop(0.34, withAlpha(primaryColor, 0.18 * alpha));
        halo.addColorStop(1, withAlpha(auraColor, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, 28 * scaleFactor, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.16 + (alpha * 0.26);
        [-1, 1].forEach(side => {
            this.drawPhongLoiWing(ctx, {
                side,
                wingOffsetX,
                wingOffsetY,
                wingWidth,
                wingHeight,
                glowBlur,
                flapAmplitude,
                scaleFactor,
                spread,
                time,
                primaryColor,
                secondaryColor,
                auraColor,
                lightningLight,
                lightningMid,
                lightningDark
            });
        });

        ctx.globalAlpha = 0.24 + (alpha * 0.24);
        ctx.strokeStyle = withAlpha('#ffffff', 0.46 * alpha);
        ctx.lineWidth = Math.max(1, 1.35 * scaleFactor);
        ctx.beginPath();
        ctx.arc(0, 0, (14 + (progress * 10)) * scaleFactor, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    },

    drawPhongLoiBlinkTrail(ctx, effect, scaleFactor, artifactConfig) {
        const now = performance.now();
        const progress = (now - effect.startedAt) / Math.max(1, effect.durationMs || 1);
        if (progress >= 1) return;

        const alpha = 1 - progress;
        const primaryColor = artifactConfig?.color || '#9fe8ff';
        const auraColor = artifactConfig?.auraColor || '#89a6ff';
        const highlightColor = artifactConfig?.secondaryColor || '#dffeff';
        const dx = effect.toX - effect.fromX;
        const dy = effect.toY - effect.fromY;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const normalX = -dy / distance;
        const normalY = dx / distance;
        const segmentCount = Math.max(4, Math.min(8, Math.round(distance / 34)));
        const jitter = Math.max(5, 12 * scaleFactor) * alpha;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let lane = 0; lane < 3; lane++) {
            ctx.beginPath();
            ctx.moveTo(effect.fromX, effect.fromY);

            for (let step = 1; step < segmentCount; step++) {
                const ratio = step / segmentCount;
                const baseX = effect.fromX + (dx * ratio);
                const baseY = effect.fromY + (dy * ratio);
                const laneDrift = (lane - 1) * jitter * 0.22;
                const wander = Math.sin((ratio * Math.PI * 4) + (lane * 1.4) + progress * 18) * jitter;
                const pointX = baseX + (normalX * (wander + laneDrift));
                const pointY = baseY + (normalY * (wander + laneDrift));
                ctx.lineTo(pointX, pointY);
            }

            ctx.lineTo(effect.toX, effect.toY);
            ctx.strokeStyle = lane === 1
                ? withAlpha(highlightColor, 0.84 * alpha)
                : withAlpha(lane === 0 ? auraColor : primaryColor, (0.26 + (lane * 0.08)) * alpha);
            ctx.lineWidth = Math.max(0.9, (lane === 1 ? 2.6 : 4.8) * scaleFactor * (0.8 + (alpha * 0.35)));
            ctx.shadowBlur = lane === 1 ? 18 * scaleFactor : 10 * scaleFactor;
            ctx.shadowColor = lane === 1 ? withAlpha(highlightColor, 0.9 * alpha) : withAlpha(primaryColor, 0.4 * alpha);
            ctx.stroke();
        }

        ctx.restore();
    },

    drawPhongLoiBlinkCharge(ctx, charge, scaleFactor, artifactConfig) {
        const cfg = this.getPhongLoiBlinkConfig();
        const elapsed = performance.now() - charge.startedAt;
        const progress = clampNumber(elapsed / Math.max(1, cfg.chargeMs), 0, 1);
        const primaryColor = artifactConfig?.color || '#9fe8ff';
        const auraColor = artifactConfig?.auraColor || '#89a6ff';
        const secondaryColor = artifactConfig?.secondaryColor || '#dffeff';
        const directionX = this.ensurePhongLoiBlinkState().lastMoveVectorX || 1;
        const directionY = this.ensurePhongLoiBlinkState().lastMoveVectorY || 0;
        const angle = Math.atan2(directionY, directionX || 0.0001);
        const pulse = 0.82 + (Math.sin(performance.now() * 0.05) * 0.18);
        const radius = (18 + (progress * 10)) * scaleFactor;
        const anchorX = Number.isFinite(charge.anchorX) ? charge.anchorX : this.x;
        const anchorY = Number.isFinite(charge.anchorY) ? charge.anchorY : this.y;

        ctx.save();
        ctx.translate(anchorX, anchorY);
        ctx.globalCompositeOperation = 'lighter';

        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 2.6);
        halo.addColorStop(0, withAlpha('#ffffff', 0.18 + (progress * 0.16)));
        halo.addColorStop(0.28, withAlpha(primaryColor, 0.22 + (progress * 0.18)));
        halo.addColorStop(0.62, withAlpha(auraColor, 0.16));
        halo.addColorStop(1, withAlpha(auraColor, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 2.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.rotate(performance.now() * 0.0042);
        ctx.strokeStyle = withAlpha(primaryColor, 0.52 + (progress * 0.16));
        ctx.lineWidth = Math.max(1.2, 2.1 * scaleFactor);
        ctx.setLineDash([6 * scaleFactor, 8 * scaleFactor]);
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * (1.2 + (progress * 0.16)), radius * (0.76 + (progress * 0.08)), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-4 * scaleFactor, 0);
        ctx.lineTo((28 + (progress * 18)) * scaleFactor, 0);
        ctx.strokeStyle = withAlpha('#ffffff', 0.84);
        ctx.lineWidth = Math.max(1.2, 2 * scaleFactor);
        ctx.shadowBlur = 16 * scaleFactor;
        ctx.shadowColor = withAlpha(secondaryColor, 0.92);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo((10 + (progress * 4)) * scaleFactor, (-5 - (progress * 6)) * scaleFactor);
        ctx.lineTo((20 + (progress * 10)) * scaleFactor, (-1 + (progress * 3)) * scaleFactor);
        ctx.lineTo((16 + (progress * 8)) * scaleFactor, (7 + (progress * 6)) * scaleFactor);
        ctx.strokeStyle = withAlpha(auraColor, 0.66);
        ctx.lineWidth = Math.max(0.9, 1.5 * scaleFactor);
        ctx.stroke();
        ctx.restore();

        for (let i = 0; i < 4; i++) {
            const sparkAngle = angle + ((i - 1.5) * 0.58) + (Math.sin((elapsed * 0.022) + i) * 0.12);
            const sparkDistance = radius * (0.58 + (i * 0.18) + (Math.sin((elapsed * 0.016) + (i * 1.4)) * 0.08)) * pulse;
            const px = Math.cos(sparkAngle) * sparkDistance;
            const py = Math.sin(sparkAngle) * sparkDistance;
            ctx.beginPath();
            ctx.fillStyle = withAlpha(i % 2 === 0 ? primaryColor : '#ffffff', 0.42 + (progress * 0.22));
            ctx.shadowBlur = 10 * scaleFactor;
            ctx.shadowColor = withAlpha(primaryColor, 0.72);
            ctx.arc(px, py, Math.max(0.8, (1.6 + (progress * 1.2)) * scaleFactor), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    drawPhongLoiBlinkEffects(ctx, scaleFactor) {
        const state = this.prunePhongLoiBlinkEffects();
        if (!state.charging && !state.trails.length && !state.afterimages.length) return;

        const artifactConfig = this.getArtifactConfig('PHONG_LOI_SI') || {};

        state.afterimages.forEach(effect => {
            this.drawPhongLoiBlinkGhost(ctx, effect, scaleFactor, artifactConfig);
        });

        state.trails.forEach(effect => {
            this.drawPhongLoiBlinkTrail(ctx, effect, scaleFactor, artifactConfig);
        });

        if (state.charging) {
            this.drawPhongLoiBlinkCharge(ctx, state.charging, scaleFactor, artifactConfig);
        }
    },

    drawCursor(ctx, scaleFactor) {
        this.drawHuyetSacPhiPhongCloak(ctx, scaleFactor);
        if (this.isArtifactDeployed('CAN_LAM_BANG_DIEM')) {
            this.drawFlame(ctx, scaleFactor);
        } else {
            this.drawCursorSeed(ctx, scaleFactor);
        }

        this.drawPhongLoiArtifact(ctx, scaleFactor);
    },

    drawHuyetSacPhiPhongCloak(ctx, scaleFactor) {
        if (!this.isArtifactDeployed('HUYET_SAC_PHI_PHONG')) return;

        const artifactConfig = this.getArtifactConfig('HUYET_SAC_PHI_PHONG') || {};
        const primaryColor = artifactConfig.color || '#ff5d73';
        const secondaryColor = artifactConfig.secondaryColor || '#ffd0d6';
        const auraColor = artifactConfig.auraColor || '#b81531';
        const dx = Number.isFinite(this.x - this.px) ? this.x - this.px : 0;
        const dy = Number.isFinite(this.y - this.py) ? this.y - this.py : 1;
        const moveLen = Math.max(0.001, Math.hypot(dx, dy));
        const nx = dx / moveLen;
        const ny = dy / moveLen;
        const backX = -nx;
        const backY = -ny;
        const sideX = -backY;
        const sideY = backX;
        const base = 18 * scaleFactor;
        const length = (42 + Math.min(18, moveLen * 0.6)) * scaleFactor;

        const leftX = this.x + sideX * base * 0.65;
        const leftY = this.y + sideY * base * 0.65;
        const rightX = this.x - sideX * base * 0.65;
        const rightY = this.y - sideY * base * 0.65;
        const tailX = this.x + backX * length;
        const tailY = this.y + backY * length;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        grad.addColorStop(0, withAlpha(secondaryColor, 0.72));
        grad.addColorStop(0.45, withAlpha(primaryColor, 0.58));
        grad.addColorStop(1, withAlpha(auraColor, 0.08));
        ctx.fillStyle = grad;
        ctx.shadowBlur = 18 * scaleFactor;
        ctx.shadowColor = withAlpha(primaryColor, 0.74);
        ctx.beginPath();
        ctx.moveTo(leftX, leftY);
        ctx.quadraticCurveTo(this.x + backX * (length * 0.35), this.y + backY * (length * 0.35), tailX, tailY);
        ctx.quadraticCurveTo(this.x + sideX * 2, this.y + sideY * 2, rightX, rightY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
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

const hiddenSwordInputState = Object.assign(Object.create(Input), {
    isAttacking: false,
    isUltMode: false,
    ultimatePhase: 'idle',
    attackMode: 'SWORD',
    ultimateMode: null
});

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

const phongLoiBlinkBtn = document.getElementById('btn-phong-loi-blink');
if (phongLoiBlinkBtn) {
    phongLoiBlinkBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (Input.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return;
        }

        Input.togglePhongLoiBlink();
    });
}

const canLamCastBtn = document.getElementById('btn-can-lam-cast');
if (canLamCastBtn) {
    canLamCastBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (Input.isVoidCollapsed) {
            showNotify('Thân thể đã tan vào hư vô, cần tải lại giới vực để hồi phục', '#a778ff');
            return;
        }

        Input.castCanLamBangDiem();
    });
}

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
    const configuredBase = Math.max(0, parseInt(CONFIG.SWORD.STARTING_COUNT_BEFORE_FORMATION, 10) || 0);
    const controlledCount = typeof Input?.getSwordControlLimit === 'function'
        ? Input.getSwordControlLimit()
        : configuredBase;
    return Math.max(configuredBase, controlledCount);
}

function getDesiredSwordCount() {
    return Input.attackMode === 'SWORD' && Input.canDeployDaiCanhKiemTran()
        ? getConfiguredSwordCount()
        : getBaseSwordCountBeforeFormation();
}

function syncSwordFormation(options = {}) {
    const { rebuildAll = false } = options;
    const targetStates = typeof Input?.getActiveSwordArtifactStates === 'function'
        ? Input.getActiveSwordArtifactStates({ mode: Input.attackMode === 'SWORD' ? 'SWORD' : 'BASE' })
        : [];
    const targetCount = Input.attackMode === 'SWORD' && Input.canDeployDaiCanhKiemTran()
        ? Math.min(getConfiguredSwordCount(), targetStates.length)
        : targetStates.length;

    if (rebuildAll) {
        swords.length = 0;
    }

    if (swords.length > targetCount) {
        swords.length = targetCount;
    }

    for (let i = 0; i < targetCount; i++) {
        if (!swords[i]) {
            const sword = new Sword(i, scaleFactor, targetStates[i] || null);
            sword.x = guardCenter.x;
            sword.y = guardCenter.y;
            swords[i] = sword;
        } else if (typeof swords[i].bindArtifactState === 'function') {
            swords[i].bindArtifactState(targetStates[i] || null);
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
    document.body.classList.add('game-native-cursor-hidden');
    document.body.classList.toggle('is-touch-device', Input.isTouchDevice);
    Input.syncLandscapeMode();
    syncPopupCursorState();
    repairLegacyUiText();

    SettingsUI.init();
    GameProgress.init();
    Input.renderManaUI();
    Input.renderExpUI();
    Input.renderRageUI();
    if (ShopUI) ShopUI.init();
    if (InventoryUI) InventoryUI.init();
    if (BeastBagUI) BeastBagUI.init();
    if (SkillsUI) SkillsUI.init();
    if (InsectBookUI) InsectBookUI.init();
    if (ProfileUI) ProfileUI.init();
    Input.renderAttackModeUI();
    starField = new StarField(CONFIG.BG.STAR_COUNT, width, height);
    for (let i = 0; i < CONFIG.ENEMY.SPAWN_COUNT; i++) enemies.push(new Enemy());
    syncSwordFormation({ rebuildAll: true });
    updateSwordCounter(swords);
    GameProgress.requestSave();
}

document.addEventListener('fullscreenchange', () => Input.syncLandscapeMode());
window.addEventListener('orientationchange', () => Input.syncLandscapeMode());

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
    const isBlinkTransiting = Input.isPhongLoiBlinkTransiting();
    const prevGuardX = guardCenter.x;
    const prevGuardY = guardCenter.y;
    const speedMultRaw = Input.getMovementSpeedMultiplier();
    const speedMult = Number.isFinite(speedMultRaw) ? speedMultRaw : 16;

    if (isBlinkTransiting) {
        guardCenter.vx = 0;
        guardCenter.vy = 0;
    } else {
        let dx = Input.x - guardCenter.x;
        let dy = Input.y - guardCenter.y;
        guardCenter.vx += dx * 0.04 * speedMult;
        guardCenter.vy += dy * 0.04 * speedMult;
        guardCenter.vx *= 0.82;
        guardCenter.vy *= 0.82;
        guardCenter.x += guardCenter.vx;
        guardCenter.y += guardCenter.vy;
    }

    Input.updatePhongLoiBlinkMotion(
        guardCenter,
        guardCenter.x - prevGuardX,
        guardCenter.y - prevGuardY
    );
    Input.updateHuyetSacPhiPhongTrail(
        guardCenter,
        guardCenter.x - prevGuardX,
        guardCenter.y - prevGuardY
    );
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
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    frameNow = now;
    Input.lastFrameTime = now;

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
    ctx.rotate(now * 0.0002);
    ctx.strokeStyle = "rgba(120,255,210,0.1)";
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.beginPath();
    ctx.arc(0, 0, 50 * scaleFactor, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    enemies.forEach(e => e.draw(ctx, scaleFactor));
    let nextPillIndex = 0;
    for (let i = 0; i < pills.length; i++) {
        const pill = pills[i];
        const collected = pill.update(guardCenter.x, guardCenter.y);

        if (collected) {
            Input.collectDrop(collected);
            continue;
            // Cộng vào đúng loại đan trong Input
            Input.pills[pill.typeKey]++;

            const typeName = CONFIG.PILL.TYPES[pill.typeKey].name;
            showNotify(`+1 ${typeName}`, pill.color);

            Input.renderExpUI(); // Cập nhật lại giao diện ngay khi nhặt được
            return false;
        }

        pill.draw(ctx);
        pills[nextPillIndex++] = pill;
    }
    pills.length = nextPillIndex;

    const renderSwarm = Input.isInsectSwarmActive();
    const renderInsectUltimate = Input.isInsectUltimateActive();
    Input.updateInsectSwarm(dt, enemies, scaleFactor);
    Input.updateInsectUltimate(dt, enemies, scaleFactor);

    const hideSwords = renderSwarm || renderInsectUltimate;
    let swordInput = Input;
    if (hideSwords) {
        hiddenSwordInputState.x = Input.x;
        hiddenSwordInputState.y = Input.y;
        hiddenSwordInputState.speed = Input.speed;
        hiddenSwordInputState.mana = Input.mana;
        hiddenSwordInputState.maxMana = Input.maxMana;
        swordInput = hiddenSwordInputState;
    }

    for (let i = 0; i < swords.length; i++) {
        swords[i].update(guardCenter, enemies, swordInput, scaleFactor, now);
    }

    if (!hideSwords) {
        swordRenderBuffer.length = swords.length;
        for (let i = 0; i < swords.length; i++) {
            swordRenderBuffer[i] = swords[i];
        }

        if (swordRenderBuffer.length > 1) {
            swordRenderBuffer.sort((leftSword, rightSword) => (leftSword.renderDepth || 0) - (rightSword.renderDepth || 0));
        }

        for (let i = 0; i < swordRenderBuffer.length; i++) {
            swordRenderBuffer[i].draw(ctx, scaleFactor, now);
        }
    }

    if (renderSwarm) {
        Input.drawInsectSwarm(ctx, scaleFactor);
    }

    if (renderInsectUltimate) {
        Input.drawInsectUltimate(ctx, scaleFactor);
    }

    Input.drawPhongLoiBlinkEffects(ctx, scaleFactor);
    Input.drawHuyetSacPhiPhongTrail(ctx, scaleFactor);
    renderCursor();

    // Vẽ và cập nhật hạt hiệu ứng
    let nextParticleIndex = 0;
    for (let i = 0; i < visualParticles.length; i++) {
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
        if (p.life <= 0) {
            continue;
        }

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
        visualParticles[nextParticleIndex++] = p;
    }
    visualParticles.length = nextParticleIndex;
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
