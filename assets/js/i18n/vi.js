const I18N_VI = Object.freeze({
    quality: Object.freeze({
        low: 'Hạ phẩm',
        medium: 'Trung phẩm',
        high: 'Thượng phẩm',
        supreme: 'Cực phẩm'
    }),
    tabs: Object.freeze({
        dan_duoc: 'Đan dược',
        trung_noan: 'Trùng noãn',
        nguyen_lieu: 'Nguyên liệu',
        tui: 'Túi',
        bi_phap: 'Bí pháp',
        phap_bao: 'Pháp bảo',
        khac: 'Khác'
    }),
    attack_mode: Object.freeze({
        base: 'Thanh Trúc Phong Vân Kiếm',
        sword: 'Đại Canh Kiếm Trận',
        insect: 'Khu Trùng Thuật'
    }),
    sword: Object.freeze({
        category_label: 'Pháp bảo kiếm trận',
        skill_name: 'Đại Canh Kiếm Trận',
        skill_description: 'Khai đại trận hộ thân, ngự kiếm quang trấn thủ và công phạt bốn phương.',
        note_active: '{alive} kiếm đang hộ trận',
        note_ready: '{bonded} thanh hộ thân, Đại Canh dùng {required} thanh',
        note_learned_pending: 'Đã lĩnh ngộ bí pháp, cần đủ {required} thanh để khai triển ({bonded}/{required}).',
        note_in_inventory: 'Bí pháp đang nằm trong túi, hãy lĩnh ngộ trước rồi mới khai triển khi đủ {required} thanh.',
        note_recovering: 'Đã kết duyên bí pháp nhưng chưa thể phục hồi vật dẫn, hiện có {bonded}/{required} thanh.',
        note_collecting: 'Đã triển khai {bonded}/{required} thanh{stockedSuffix}',
        note_unknown: 'Chưa kết duyên Thanh Trúc Phong Vân Kiếm ({required} thanh)',
        title_learned: 'Đại Canh Kiếm Trận - đã lĩnh ngộ, hiện có {bonded}/{required} thanh',
        ready_notify_learned: 'Thanh Trúc Phong Vân Kiếm đã đủ {required}/{required} thanh, có thể khai triển Đại Canh Kiếm Trận.',
        ready_notify_need_art: 'Thanh Trúc Phong Vân Kiếm đã đủ {required}/{required} thanh, nhưng vẫn cần lĩnh ngộ bí pháp Đại Canh Kiếm Trận.',
        need_count: 'Cần triển khai đủ {required} thanh Thanh Trúc Phong Vân Kiếm trước khi khai triển Đại Canh Kiếm Trận ({bonded}/{required}).',
        need_art: 'Chưa lĩnh ngộ bí pháp Đại Canh Kiếm Trận.',
        deploy_ready: 'Triển khai {name}: hiện có {bonded} thanh hộ thân, đã đủ {required} thanh để khai triển Đại Canh Kiếm Trận.',
        deploy_need_art: 'Triển khai {name}: hiện có {bonded} thanh hộ thân, đã đủ {required} thanh nhưng vẫn cần lĩnh ngộ bí pháp Đại Canh Kiếm Trận.',
        deploy_count: 'Triển khai {name}: hiện có {bonded} thanh đang xạ quanh tâm.',
        learn_ready: 'Lĩnh ngộ {name}: kiếm trận sẽ vận dụng {required} thanh, còn phân kiếm hộ thân vẫn giữ theo số đã kết duyên.',
        learn_pending: 'Lĩnh ngộ {name}: đã hiểu kiếm ý, nhưng vẫn cần đủ {required} thanh Thanh Trúc Phong Vân Kiếm để khai triển kiếm trận ({bonded}/{required}).',
        secret_art_description: 'Kiếm đạo bí pháp chỉ truyền một lần. Mua xong sẽ giữ lại trong túi; chỉ sau khi lĩnh ngộ và đã triển khai đủ {required} thanh Thanh Trúc Phong Vân Kiếm mới có thể khai triển Đại Canh Kiếm Trận.'
    }),
    ui: Object.freeze({
        phong_loi_si: Object.freeze({
            inactive: 'THU',
            active: 'KHAI',
            charging: 'TỤ',
            resting: 'Phong Lôi Sí đang thu liễm'
        }),
        shop: Object.freeze({
            reset_filters: 'Tẩy điều kiện',
            empty: 'Không có bảo vật nào ứng với điều kiện đã định.'
        }),
        beast: Object.freeze({
            food_select_hint: 'Hãy chọn linh liệu phù hợp.',
            food_amount_hint: 'Hãy nhập số phần linh liệu hợp lệ.',
            food_not_enough_inventory: 'Túi trữ vật không đủ linh liệu này.',
            rainbow_not_needed: 'Thất Sắc Linh Thú Đại không cần nạp linh liệu.',
            food_slot_not_enough: 'Ô linh liệu của mục này chưa đủ linh dưỡng.'
        }),
        void_collapsed: 'THÂN THỂ ĐÃ TAN VÀO HƯ VÔ - HÃY TÁI NHẬP GIỚI VỰC ĐỂ TRỌNG TỤ CHÂN THÂN',
        popup: Object.freeze({
            settings: 'THIÊN ĐẠO QUY TẮC',
            shop: 'LINH THỊ CỬA HÀNG',
            inventory: 'TÚI KHÔNG GIAN TRỮ VẬT',
            skills: 'BẢNG BÍ PHÁP',
            insect_book: 'KỲ TRÙNG BẢNG',
            profile: 'HỒ SƠ KIẾM TU'
        }),
        inventory: Object.freeze({
            items: 'Vật phẩm',
            stones: 'Linh thạch'
        }),
        aria: Object.freeze({
            profile: 'Mở hồ sơ kiếm tu',
            settings: 'Thiên đạo quy tắc',
            shop: 'Linh thị',
            inventory: 'Túi trữ vật',
            beast_bag: 'Linh thú đại',
            breakthrough: 'Độ kiếp đột phá',
            move: 'Luân bàn thân pháp',
            ultimate: 'Tuyệt kỹ',
            form: 'Đổi kiếm thức',
            phong_loi_si: 'Phong Lôi Sí',
            skill_list: 'Bảng bí pháp',
            attack: 'Xuất kiếm'
        })
    })
});

function getI18nValue(key) {
    return String(key || '')
        .split('.')
        .reduce((current, part) => current && Object.prototype.hasOwnProperty.call(current, part) ? current[part] : undefined, I18N_VI);
}

function t(key, params = {}, fallback = null) {
    const template = getI18nValue(key);
    const baseText = typeof template === 'string'
        ? template
        : (fallback == null ? String(key || '') : String(fallback));
    const rendered = baseText.replace(/\{(\w+)\}/g, (match, token) => {
        return Object.prototype.hasOwnProperty.call(params, token)
            ? String(params[token])
            : match;
    });

    return typeof repairLegacyText === 'function'
        ? repairLegacyText(rendered)
        : rendered;
}
