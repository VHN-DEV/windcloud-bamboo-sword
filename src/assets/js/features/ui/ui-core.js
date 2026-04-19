let ShopUI = null;
let InventoryUI = null;
let BeastBagUI = null;
let ProfileUI = null;
let SkillsUI = null;
let InsectBookUI = null;
let AlchemyUI = null;

const TEXT_REPAIR_ATTRIBUTES = Object.freeze(['title', 'aria-label', 'placeholder', 'alt']);
// Match common mojibake prefixes without flagging valid Vietnamese words
// such as "pháp", "phẩm", or "đột phá".
const BROKEN_TEXT_PATTERN = /(?:Ã[\u0080-\u00ff]|Â[\u0080-\u00ff]|Ä[\u0080-\u00ff]|Ă[\u0080-\u00ff]|Æ[\u0080-\u00ff]|á[\u0080-\u00ff]|â(?:€|€¦|€“|€”|€¢|€˜|€™|€œ|€�)|ð[\u0080-\u00ff]?|Ð[\u0080-\u00ff]|Ñ[\u0080-\u00ff]|�)/u;
let legacyTextRepairObserver = null;

const UI_TEXT = Object.freeze({
    ATTACK_MODE_SWORD: 'Đại Canh Kiếm Trận',
    ATTACK_MODE_BASE: 'Thanh Trúc Phong Vân Kiếm',
    PHONG_LOI_SI_STATES: Object.freeze({
        INACTIVE: 'THU',
        ACTIVE: 'KHAI',
        CHARGING: 'TỤ'
    }),
    PHONG_LOI_SI_RESTING: 'Phong Lôi Sí đang thu liễm',
    NGU_LOI_THUAT_RESTING: 'Ngự Lôi Thuật đang thu liễm',
    SHOP_RESET_FILTERS: 'Tẩy tuyển điều kiện',
    SHOP_EMPTY: 'Thiên Bảo Các tạm thời không có bảo vật hợp điều kiện đã định.',
    BEAST_FOOD_SELECT_HINT: 'Hãy chọn linh liệu tương hợp.',
    BEAST_FOOD_AMOUNT_HINT: 'Hãy nhập số phần linh liệu hợp lệ.',
    BEAST_FOOD_NOT_ENOUGH_INVENTORY: 'Túi trữ vật không đủ linh liệu này.',
    BEAST_FOOD_RAINBOW_NOT_NEEDED: 'Thất Sắc Linh Thú Đại không cần nạp linh liệu.',
    BEAST_FOOD_SLOT_NOT_ENOUGH: 'Ô linh liệu của mục này chưa đủ linh dưỡng.',
    VOID_COLLAPSED: 'THÂN THỂ ĐÃ TAN VÀO HƯ VÔ - HÃY TÁI NHẬP GIỚI VỰC ĐỂ TRỌNG TỤ CHÂN THÂN',
    POPUP_TITLES: Object.freeze({
        SETTINGS: 'THIÊN ĐẠO QUY TẮC',
        SHOP: 'THIÊN BẢO CÁC',
        INVENTORY: 'TÚI KHÔNG GIAN TRỮ VẬT',
        SKILLS: 'BẢNG BÍ PHÁP',
        INSECT_BOOK: 'KỲ TRÙNG BẢNG',
        PROFILE: 'HỒ SƠ KIẾM TU',
        ALCHEMY: 'ĐAN LÔ - HƯ THIÊN ĐỈNH'
    }),
    INVENTORY_TABS: Object.freeze({
        ITEMS: 'Vật phẩm'
    }),
    ARIA: Object.freeze({
        PROFILE: 'Mở hồ sơ kiếm tu',
        SETTINGS: 'Thiên đạo quy tắc',
        SHOP: 'Thiên Bảo Các',
        INVENTORY: 'Túi trữ vật',
        BEAST_BAG: 'Linh thú đại',
        BREAKTHROUGH: 'Độ kiếp đột phá',
        MOVE: 'Luân bàn thân pháp',
        ULTIMATE: 'Tuyệt kỹ',
        FORM: 'Đổi kiếm thức',
        PHONG_LOI_SI: 'Phong Lôi Sí',
        NGU_LOI_THUAT: 'Ngự Lôi Thuật',
        SKILL_LIST: 'Bảng bí pháp',
        ATTACK: 'Xuất kiếm',
        ALCHEMY: 'Đan lô Hư Thiên Đỉnh'
    })
});

function formatShopSummaryText(filteredCount, totalCount) {
    return `Hiển lộ <strong>${formatNumber(filteredCount)}</strong> / ${formatNumber(totalCount)} kiện bảo vật`;
}

function tryDecodeLatin1Utf8(value) {
    const text = String(value ?? '');

    if (!text || Array.from(text).some(char => char.charCodeAt(0) > 0xFF)) {
        return text;
    }

    try {
        const bytes = Uint8Array.from(Array.from(text, char => char.charCodeAt(0)));
        return new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
        return text;
    }
}

function repairBrokenTextSegment(value) {
    let repaired = String(value ?? '');

    for (let pass = 0; pass < 2; pass++) {
        if (!BROKEN_TEXT_PATTERN.test(repaired)) break;

        const nextValue = tryDecodeLatin1Utf8(repaired);
        if (!nextValue || nextValue === repaired) break;

        repaired = nextValue;
    }

    return repaired;
}

function repairLegacyText(value) {
    const text = String(value ?? '');

    if (!BROKEN_TEXT_PATTERN.test(text)) {
        return text;
    }

    if (Array.from(text).every(char => char.charCodeAt(0) <= 0xFF)) {
        return repairBrokenTextSegment(text);
    }

    return text.replace(/[\u0000-\u00ff]+/g, segment => {
        return BROKEN_TEXT_PATTERN.test(segment)
            ? repairBrokenTextSegment(segment)
            : segment;
    });
}

function repairLegacyTextTree(root) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
        const repairedValue = repairLegacyText(root.nodeValue);
        if (repairedValue !== root.nodeValue) {
            root.nodeValue = repairedValue;
        }
        return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
        const element = root;
        if (['SCRIPT', 'STYLE'].includes(element.tagName)) {
            return;
        }

        TEXT_REPAIR_ATTRIBUTES.forEach(attribute => {
            if (!element.hasAttribute(attribute)) return;

            const currentValue = element.getAttribute(attribute) || '';
            const repairedValue = repairLegacyText(currentValue);
            if (repairedValue !== currentValue) {
                element.setAttribute(attribute, repairedValue);
            }
        });
    }

    Array.from(root.childNodes || []).forEach(child => repairLegacyTextTree(child));
}

function ensureLegacyTextRepairObserver() {
    if (legacyTextRepairObserver || typeof MutationObserver === 'undefined' || !document?.body) {
        return;
    }

    legacyTextRepairObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => repairLegacyTextTree(node));
                return;
            }

            if (mutation.type === 'characterData') {
                repairLegacyTextTree(mutation.target);
                return;
            }

            if (mutation.type === 'attributes') {
                repairLegacyTextTree(mutation.target);
            }
        });
    });

    legacyTextRepairObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: TEXT_REPAIR_ATTRIBUTES
    });
}

function toggleDescriptionCard(card, forceExpanded = null) {
    if (!card) return false;

    const nextExpanded = typeof forceExpanded === 'boolean'
        ? forceExpanded
        : !card.classList.contains('is-expanded');
    const fullContent = card.querySelector('.item-description__full');
    const toggleBtn = card.querySelector('[data-description-toggle]');

    card.classList.toggle('is-expanded', nextExpanded);

    if (fullContent) {
        fullContent.style.maxHeight = nextExpanded ? `${fullContent.scrollHeight}px` : '0px';
    }

    if (toggleBtn) {
        const nextLabel = nextExpanded ? 'Thu gọn' : 'Xem thêm';
        toggleBtn.textContent = nextLabel;
        toggleBtn.setAttribute('aria-expanded', String(nextExpanded));
        toggleBtn.setAttribute('aria-label', `${nextLabel} mô tả`);
    }

    return nextExpanded;
}

function toggleTrackedDescriptionCard(toggleBtn, expandedIds) {
    if (!toggleBtn) return false;

    const card = toggleBtn.closest('[data-description-card]');
    const cardId = card?.getAttribute('data-description-id') || '';
    const nextExpanded = toggleDescriptionCard(card);

    if (expandedIds instanceof Set && cardId) {
        if (nextExpanded) {
            expandedIds.add(cardId);
        } else {
            expandedIds.delete(cardId);
        }
    }

    return nextExpanded;
}

function restoreTrackedDescriptionCards(root, expandedIds) {
    if (!root?.querySelectorAll || !(expandedIds instanceof Set)) return;

    const nextExpandedIds = new Set();

    root.querySelectorAll('[data-description-card][data-description-id]').forEach(card => {
        const cardId = card.getAttribute('data-description-id') || '';
        if (!cardId || !expandedIds.has(cardId)) return;

        toggleDescriptionCard(card, true);
        nextExpandedIds.add(cardId);
    });

    expandedIds.clear();
    nextExpandedIds.forEach(cardId => expandedIds.add(cardId));
}

function refreshExpandedDescriptionCards(root = document) {
    if (!root?.querySelectorAll) return;

    root.querySelectorAll('.item-description.is-expanded').forEach(card => {
        const fullContent = card.querySelector('.item-description__full');
        if (fullContent) {
            fullContent.style.maxHeight = `${fullContent.scrollHeight}px`;
        }
    });
}

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

function setTextIfPresent(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = repairLegacyText(text);
}

function setAttrIfPresent(selector, attribute, value) {
    const node = document.querySelector(selector);
    if (node) node.setAttribute(attribute, repairLegacyText(value));
}

function repairLegacyUiText() {
    if (document?.title != null) {
        document.title = `${UI_TEXT.ATTACK_MODE_SWORD} - 72 ${UI_TEXT.ATTACK_MODE_BASE}`;
    }

    [
        ['#settings-popup .popup-header h3', UI_TEXT.POPUP_TITLES.SETTINGS],
        ['#shop-popup .popup-header h3', UI_TEXT.POPUP_TITLES.SHOP],
        ['#inventory-popup .popup-header h3', UI_TEXT.POPUP_TITLES.INVENTORY],
        ['#skills-popup .popup-header h3', UI_TEXT.POPUP_TITLES.SKILLS],
        ['#insect-book-popup .popup-header h3', UI_TEXT.POPUP_TITLES.INSECT_BOOK],
        ['#profile-popup .popup-header h3', UI_TEXT.POPUP_TITLES.PROFILE],
        ['#alchemy-popup .popup-header h3', UI_TEXT.POPUP_TITLES.ALCHEMY],
        ['#inventory-panel-items h4', UI_TEXT.INVENTORY_TABS.ITEMS],
        ['#btn-phong-loi-blink .phong-loi-toggle__state', UI_TEXT.PHONG_LOI_SI_STATES.INACTIVE],
        ['#btn-ngu-loi .ngu-loi-toggle__state', UI_TEXT.PHONG_LOI_SI_STATES.INACTIVE]
    ].forEach(([selector, text]) => setTextIfPresent(selector, text));

    [
        ['#btn-profile', 'aria-label', UI_TEXT.ARIA.PROFILE],
        ['#btn-settings img', 'alt', UI_TEXT.ARIA.SETTINGS],
        ['#btn-shop img', 'alt', UI_TEXT.ARIA.SHOP],
        ['#btn-inventory img', 'alt', UI_TEXT.ARIA.INVENTORY],
        ['#btn-beast-bag img', 'alt', UI_TEXT.ARIA.BEAST_BAG],
        ['#btn-breakthrough img', 'alt', UI_TEXT.ARIA.BREAKTHROUGH],
        ['#btn-move', 'aria-label', UI_TEXT.ARIA.MOVE],
        ['#btn-ultimate img', 'alt', UI_TEXT.ARIA.ULTIMATE],
        ['#btn-form img', 'alt', UI_TEXT.ARIA.FORM],
        ['#btn-phong-loi-blink', 'title', UI_TEXT.PHONG_LOI_SI_RESTING],
        ['#btn-phong-loi-blink', 'aria-label', UI_TEXT.PHONG_LOI_SI_RESTING],
        ['#btn-phong-loi-blink img', 'alt', UI_TEXT.ARIA.PHONG_LOI_SI],
        ['#btn-ngu-loi', 'title', UI_TEXT.NGU_LOI_THUAT_RESTING],
        ['#btn-ngu-loi', 'aria-label', UI_TEXT.NGU_LOI_THUAT_RESTING],
        ['#btn-ngu-loi img', 'alt', UI_TEXT.ARIA.NGU_LOI_THUAT],
        ['#btn-can-lam-cast', 'title', 'Càn Lam Băng Diễm chưa triển khai'],
        ['#btn-can-lam-cast', 'aria-label', 'Càn Lam Băng Diễm chưa triển khai'],
        ['#btn-can-lam-cast img', 'alt', 'Càn Lam Băng Diễm'],
        ['#btn-skill-list', 'title', UI_TEXT.ARIA.SKILL_LIST],
        ['#btn-attack img', 'alt', UI_TEXT.ARIA.ATTACK],
        ['#btn-alchemy-lab', 'title', UI_TEXT.ARIA.ALCHEMY],
        ['#btn-alchemy-lab', 'aria-label', UI_TEXT.ARIA.ALCHEMY],
        ['#btn-alchemy-lab img', 'alt', UI_TEXT.ARIA.ALCHEMY]
    ].forEach(([selector, attribute, value]) => setAttrIfPresent(selector, attribute, value));

    repairLegacyTextTree(document.body || document.documentElement);
    ensureLegacyTextRepairObserver();
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

window.addEventListener('resize', () => refreshExpandedDescriptionCards());
