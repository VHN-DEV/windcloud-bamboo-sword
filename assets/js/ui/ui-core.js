let ShopUI = null;
let InventoryUI = null;
let BeastBagUI = null;
let ProfileUI = null;
let SkillsUI = null;
let InsectBookUI = null;

const UI_TEXT = Object.freeze({
    PHONG_LOI_SI_STATES: Object.freeze({
        INACTIVE: 'THU',
        ACTIVE: 'KHAI',
        CHARGING: 'TỤ'
    }),
    PHONG_LOI_SI_RESTING: 'Phong Lôi Sí đang thu liễm',
    SHOP_RESET_FILTERS: 'Tẩy điều kiện',
    SHOP_EMPTY: 'Không có bảo vật nào ứng với điều kiện đã định.',
    BEAST_FOOD_SELECT_HINT: 'Hãy chọn linh liệu phù hợp.',
    BEAST_FOOD_AMOUNT_HINT: 'Hãy nhập số phần linh liệu hợp lệ.',
    BEAST_FOOD_NOT_ENOUGH_INVENTORY: 'Túi trữ vật không đủ linh liệu này.',
    BEAST_FOOD_RAINBOW_NOT_NEEDED: 'Thất Sắc Linh Thú Đại không cần nạp linh liệu.',
    BEAST_FOOD_SLOT_NOT_ENOUGH: 'Ô linh liệu của mục này chưa đủ linh dưỡng.',
    VOID_COLLAPSED: 'THÂN THỂ ĐÃ TAN VÀO HƯ VÔ - HÃY TÁI NHẬP GIỚI VỰC ĐỂ TRỌNG TỤ CHÂN THÂN'
});

function formatShopSummaryText(filteredCount, totalCount) {
    return `Hiển lộ <strong>${formatNumber(filteredCount)}</strong> / ${formatNumber(totalCount)} bảo vật`;
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
    if (node) node.textContent = text;
}

function setAttrIfPresent(selector, attribute, value) {
    const node = document.querySelector(selector);
    if (node) node.setAttribute(attribute, value);
}

function repairLegacyUiText() {
    if (document?.title != null) {
        document.title = 'Đại Canh Kiếm Trận - 72 Thanh Trúc Phong Vân Kiếm';
    }

    [
        ['#settings-popup .popup-header h3', 'THIÊN ĐẠO QUY TẮC'],
        ['#shop-popup .popup-header h3', 'LINH THỊ CỬA HÀNG'],
        ['#inventory-popup .popup-header h3', 'TÚI KHÔNG GIAN TRỮ VẬT'],
        ['#skills-popup .popup-header h3', 'BẢNG BÍ PHÁP'],
        ['#insect-book-popup .popup-header h3', 'KỲ TRÙNG BẢNG'],
        ['#profile-popup .popup-header h3', 'HỒ SƠ KIẾM TU'],
        ['#inventory-tabs [data-inventory-tab="items"]', 'Vật phẩm'],
        ['#inventory-tabs [data-inventory-tab="stones"]', 'Linh thạch'],
        ['#inventory-panel-items h4', 'Vật phẩm'],
        ['#inventory-panel-stones h4', 'Linh thạch'],
        ['#btn-phong-loi-blink .phong-loi-toggle__state', UI_TEXT.PHONG_LOI_SI_STATES.INACTIVE]
    ].forEach(([selector, text]) => setTextIfPresent(selector, text));

    [
        ['#btn-profile', 'aria-label', 'Mở hồ sơ kiếm tu'],
        ['#btn-settings img', 'alt', 'Thiên đạo quy tắc'],
        ['#btn-shop img', 'alt', 'Linh thị'],
        ['#btn-inventory img', 'alt', 'Túi trữ vật'],
        ['#btn-beast-bag img', 'alt', 'Linh thú đại'],
        ['#btn-breakthrough img', 'alt', 'Độ kiếp đột phá'],
        ['#btn-move', 'aria-label', 'Luân bàn thân pháp'],
        ['#btn-ultimate img', 'alt', 'Tuyệt kỹ'],
        ['#btn-form img', 'alt', 'Đổi kiếm thức'],
        ['#btn-phong-loi-blink', 'title', UI_TEXT.PHONG_LOI_SI_RESTING],
        ['#btn-phong-loi-blink', 'aria-label', UI_TEXT.PHONG_LOI_SI_RESTING],
        ['#btn-phong-loi-blink img', 'alt', 'Phong Lôi Sí'],
        ['#btn-skill-list', 'title', 'Bảng bí pháp'],
        ['#btn-attack img', 'alt', 'Xuất kiếm']
    ].forEach(([selector, attribute, value]) => setAttrIfPresent(selector, attribute, value));
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
