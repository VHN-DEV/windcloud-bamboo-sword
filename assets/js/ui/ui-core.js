let ShopUI = null;
let InventoryUI = null;
let BeastBagUI = null;
let ProfileUI = null;
let SkillsUI = null;
let InsectBookUI = null;

const TEXT_REPAIR_ATTRIBUTES = Object.freeze(['title', 'aria-label', 'placeholder', 'alt']);
const BROKEN_TEXT_PATTERN = /(?:Ã.|Â.|Ä.|Ă.|Æ.|á.|â.|ð|Ð|Ñ|�)/;
let legacyTextRepairObserver = null;

const UI_TEXT = Object.freeze({
    PHONG_LOI_SI_STATES: Object.freeze({
        INACTIVE: t('ui.phong_loi_si.inactive'),
        ACTIVE: t('ui.phong_loi_si.active'),
        CHARGING: t('ui.phong_loi_si.charging')
    }),
    PHONG_LOI_SI_RESTING: t('ui.phong_loi_si.resting'),
    SHOP_RESET_FILTERS: t('ui.shop.reset_filters'),
    SHOP_EMPTY: t('ui.shop.empty'),
    BEAST_FOOD_SELECT_HINT: t('ui.beast.food_select_hint'),
    BEAST_FOOD_AMOUNT_HINT: t('ui.beast.food_amount_hint'),
    BEAST_FOOD_NOT_ENOUGH_INVENTORY: t('ui.beast.food_not_enough_inventory'),
    BEAST_FOOD_RAINBOW_NOT_NEEDED: t('ui.beast.rainbow_not_needed'),
    BEAST_FOOD_SLOT_NOT_ENOUGH: t('ui.beast.food_slot_not_enough'),
    VOID_COLLAPSED: t('ui.void_collapsed')
});

function formatShopSummaryText(filteredCount, totalCount) {
    return `Hiển lộ <strong>${formatNumber(filteredCount)}</strong> / ${formatNumber(totalCount)} bảo vật`;
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
        document.title = `${t('attack_mode.sword')} - 72 ${t('attack_mode.base')}`;
    }

    [
        ['#settings-popup .popup-header h3', t('ui.popup.settings')],
        ['#shop-popup .popup-header h3', t('ui.popup.shop')],
        ['#inventory-popup .popup-header h3', t('ui.popup.inventory')],
        ['#skills-popup .popup-header h3', t('ui.popup.skills')],
        ['#insect-book-popup .popup-header h3', t('ui.popup.insect_book')],
        ['#profile-popup .popup-header h3', t('ui.popup.profile')],
        ['#inventory-tabs [data-inventory-tab="items"]', t('ui.inventory.items')],
        ['#inventory-tabs [data-inventory-tab="stones"]', t('ui.inventory.stones')],
        ['#inventory-panel-items h4', t('ui.inventory.items')],
        ['#inventory-panel-stones h4', t('ui.inventory.stones')],
        ['#btn-phong-loi-blink .phong-loi-toggle__state', UI_TEXT.PHONG_LOI_SI_STATES.INACTIVE]
    ].forEach(([selector, text]) => setTextIfPresent(selector, text));

    [
        ['#btn-profile', 'aria-label', t('ui.aria.profile')],
        ['#btn-settings img', 'alt', t('ui.aria.settings')],
        ['#btn-shop img', 'alt', t('ui.aria.shop')],
        ['#btn-inventory img', 'alt', t('ui.aria.inventory')],
        ['#btn-beast-bag img', 'alt', t('ui.aria.beast_bag')],
        ['#btn-breakthrough img', 'alt', t('ui.aria.breakthrough')],
        ['#btn-move', 'aria-label', t('ui.aria.move')],
        ['#btn-ultimate img', 'alt', t('ui.aria.ultimate')],
        ['#btn-form img', 'alt', t('ui.aria.form')],
        ['#btn-phong-loi-blink', 'title', UI_TEXT.PHONG_LOI_SI_RESTING],
        ['#btn-phong-loi-blink', 'aria-label', UI_TEXT.PHONG_LOI_SI_RESTING],
        ['#btn-phong-loi-blink img', 'alt', t('ui.aria.phong_loi_si')],
        ['#btn-skill-list', 'title', t('ui.aria.skill_list')],
        ['#btn-attack img', 'alt', t('ui.aria.attack')]
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
