const QUALITY_RADIUS_BASE = {
    LOW: { radius: 4.5 },
    MEDIUM: { radius: 5.5 },
    HIGH: { radius: 6.5 },
    SUPREME: { radius: 7.5 }
};

const QUALITY_META_BASE = {
    LOW: { label: "Hạ phẩm", radius: QUALITY_RADIUS_BASE.LOW.radius },
    MEDIUM: { label: "Trung phẩm", radius: QUALITY_RADIUS_BASE.MEDIUM.radius },
    HIGH: { label: "Thượng phẩm", radius: QUALITY_RADIUS_BASE.HIGH.radius },
    SUPREME: { label: "Cực phẩm", radius: QUALITY_RADIUS_BASE.SUPREME.radius }
};

const PILL_TYPE_BASE = {
    LOW: { radius: 4 },
    MEDIUM: { radius: 5.5 },
    HIGH: { radius: 7.5 }
};

function createTieredConfig(definitions, baseByTier) {
    const result = {};
    Object.keys(definitions).forEach(function (tier) {
        result[tier] = Object.assign({}, baseByTier && baseByTier[tier], definitions[tier]);
    });
    return result;
}

function createRadiusQualityConfig(definitions) {
    return createTieredConfig(definitions, QUALITY_RADIUS_BASE);
}

function createLabeledQualityConfig(definitions) {
    return createTieredConfig(definitions, QUALITY_META_BASE);
}

function normalizeImageAssetName(imageName) {
    const normalizedPath = String(imageName || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/[?#].*$/, '');

    if (!normalizedPath) return '';

    const imageRootMarker = '/assets/images/';
    const markerIndex = normalizedPath.indexOf(imageRootMarker);
    if (markerIndex !== -1) {
        return normalizedPath.slice(markerIndex + imageRootMarker.length);
    }

    return normalizedPath
        .replace(/^\.?\/?(?:src\/)?assets\/images\//, '')
        .replace(/^\.?\/?public\/assets\/images\//, '')
        .replace(/^\.?\/+/, '');
}

function imagePath(imageName) {
    const normalizedName = normalizeImageAssetName(imageName);
    return normalizedName ? `./assets/images/${normalizedName}` : '';
}

const IMAGE_PATHS = {
    UI: {
        PROFILE_SWORD: imagePath("sword-light.svg")
    },
    BAGS: {
        STORAGE: imagePath("bag.svg"),
        TREASURE: imagePath("tui-tru-vat.svg")
    },
    ARTIFACTS: {
        CAN_LAM_BANG_DIEM: imagePath("artifacts/can-lam-bang-diem.svg"),
        CHUONG_THIEN_BINH: imagePath("artifacts/chuong-thien-binh.svg"),
        PHONG_LOI_SI: imagePath("artifacts/phong-loi-si.svg"),
        HUYET_SAC_PHI_PHONG: imagePath("artifacts/huyet-sac-phi-phong.svg"),
        HU_THIEN_DINH: imagePath("artifacts/hu-thien-dinh.svg")
    },
    ABERRATIONS: {
        KIEN_THIEN_TINH: imagePath("aberrations/kien-thien-tinh.svg"),
        PHE_KIM_TRUNG: imagePath("aberrations/phe-kim-trung.svg"),
        PHI_THIEN_TU_VAN_HAT: imagePath("aberrations/phi-thien-tu-van-hac.svg"),
        HUYET_NGOC_TRI_CHU: imagePath("aberrations/huyet-ngoc-tri-chu.svg"),
        HUYEN_DIEM_NGA: imagePath("aberrations/huyen-diem-nga.svg"),
        THIET_HOA_NGHI: imagePath("aberrations/thiet-hoa-nghi.svg"),
        KIM_GIAP_HAT: imagePath("aberrations/kim-giap-hac.svg"),
        HUYET_THUC_NGHI: imagePath("aberrations/huyet-thuc-nghi.svg"),
        BANG_TAM: imagePath("aberrations/bang-tam.svg"),
        LUC_DUC_SUONG_CONG: imagePath("aberrations/luc-duc-suong-cong.svg")
    }
};

const CONFIG = {
    CORE: {
        BASE_WIDTH: 1920        // Chiều rộng cơ sở để tính toán tỉ lệ scale trên các màn hình khác nhau
    },
    ZOOM: {
        MIN: 0.5,               // Mức thu nhỏ tối đa
        MAX: 5.0,               // Mức phóng to tối đa
        SENSITIVITY: 0.001,     // Độ nhạy của con lăn chuột
        STEP: 0.2,              // Khoảng cách zoom mỗi lần nhấn phím +/-
        SMOOTH: 0.1             // Độ mượt khi chuyển đổi zoom (càng nhỏ càng chậm)
    },
    BG: {
        STAR_COUNT: 1000,                       // Tổng số lượng sao trên nền trời
        STAR_SIZE: { MIN: 0.5, MAX: 2 },        // Kích thước ngẫu nhiên của hạt sao
        STAR_ALPHA: { MIN: 0.2, MAX: 1 },       // Độ trong suốt ngẫu nhiên của sao
        STAR_TWINKLE_SPEED: 0.01                // Tốc độ nhấp nháy của sao
    },
    SWORD: {
        STARTING_COUNT_BEFORE_FORMATION: 0, // Mặc định chưa có kiếm hộ thân, cần kết duyên từng thanh rồi mới triển khai
        COUNT: 72,              // Tổng số lượng kiếm tối đa
        BASE_RADIUS: 110,       // Khoảng cách từ tâm đến lớp kiếm đầu tiên
        LAYER_SPACING: 65,      // Khoảng cách giữa các lớp kiếm (vòng trong - vòng ngoài)
        SPIN_SPEED_BASE: 0.05,  // Tốc độ quay cơ bản của vòng kiếm
        ATTACK_DELAY_MS: 180,   // Thời gian chờ để kích hoạt trạng thái tấn công khi nhấn giữ
        TRAIL_LENGTH: 6,        // Độ dài bóng ma (trail) của thanh kiếm
        SIZE: 70,               // Kích thước (chiều dài) hiển thị của thanh kiếm
        STUN_DURATION_MS: 1000, // Thời gian mục tiêu bị khựng khi trúng kiếm
        RESPAWN_DELAY_MS: 1500, // Thời gian hồi phục sau khi kiếm bị vỡ
        DEATH_WAIT_MS: 2000,    // Thời gian thanh kiếm nằm lại hiện trường trước khi biến mất hẳn
        SPEED_MULT: 50,         // Hệ số nhân tốc độ quay chung toàn hệ thống
        IS_PAUSED: false,          // Trạng thái tạm dừng
        BREATH_SPEED: { MIN: 0.015, MAX: 0.025 }, // Tốc độ hiệu ứng "nhịp thở" (co giãn vòng kiếm)
        FLOW_OFFSET: { MIN: 40, MAX: 100 },       // Biên độ dao động xa gần của kiếm khi bay
        IDLE_SPHERE: {
            DENSITY_MAX: 4.2,           // Mật độ tối đa khi số kiếm tăng cao
            DENSITY_DIVISOR: 4.8,       // Số càng nhỏ thì càng nở quỹ đạo nhanh theo số lượng kiếm
            FLOW_NOISE_WEIGHT: 0.45,    // Độ lệch pha ngẫu nhiên giữa các thanh kiếm
            YAW_SPEED_BASE: 0.90,       // Tốc độ tự quay chính của thiên cầu khi ở trạng thái thường
            YAW_SPEED_DENSITY_BONUS: 0.05, // Càng nhiều kiếm thì vòng cầu quay càng dày và nhanh hơn
            PITCH_BASE: 0.88,           // Góc nghiêng nền của mặt cầu
            PITCH_OSC_SPEED: 0.34,      // Tốc độ dao động trục nghiêng
            PITCH_OSC_LAYER_STEP: 0.42, // Độ lệch nhịp giữa các tầng kiếm
            PITCH_OSC_AMPLITUDE: 0.1,   // Biên độ lắc nhẹ của thiên cầu
            ROLL_SPEED_BASE: 0.16,      // Tốc độ tự lăn của quỹ đạo cầu
            ROLL_SPEED_LAYER_STEP: 0.02, // Mỗi tầng tăng thêm một chút tốc độ lăn
            RADIUS_MIN_BASE: 56,        // Bán kính tối thiểu của tầng trong cùng
            RADIUS_MIN_LAYER_STEP: 12,  // Mỗi tầng ngoài nở thêm bao nhiêu
            RADIUS_MAX_BASE: 78,        // Bán kính cơ sở theo mật độ đàn kiếm
            RADIUS_DENSITY_STEP: 28,    // Độ nở thêm theo số lượng kiếm đang có
            RADIUS_MAX_LAYER_STEP: 13,  // Độ nở thêm theo tầng khi tính bán kính tối đa
            BREATH_SPEED_BASE: 0.9,     // Nhịp "thở" của quỹ đạo
            BREATH_SPEED_INDEX_STEP: 0.06, // Độ lệch nhịp thở theo từng thanh
            BREATH_AMPLITUDE: 0.045,    // Mức co giãn của thiên cầu
            X_RADIUS_BASE: 1.08,        // Tỉ lệ nở theo trục ngang
            X_RADIUS_LAYER_BONUS: 0.04, // Tầng xen kẽ sẽ nở ngang thêm nhẹ
            Y_RADIUS_SCALE: 0.88,       // Tỉ lệ nén theo trục dọc để tạo cảm giác elip-cầu
            DEPTH_LIFT_SCALE: 0.3,      // Độ nâng lên/hạ xuống theo chiều sâu giả 3D
            DRIFT_X_SPEED: 0.42,        // Nhịp trôi nhẹ theo trục X
            DRIFT_X_AMPLITUDE: 3.5,     // Biên độ trôi theo trục X
            DRIFT_Y_SPEED: 0.36,        // Nhịp trôi nhẹ theo trục Y
            DRIFT_Y_NOISE_SCALE: 0.8,   // Độ lệch pha trôi Y theo từng kiếm
            DRIFT_Y_AMPLITUDE: 2.5,     // Biên độ trôi theo trục Y
            VISUAL_SCALE_BASE: 0.72,    // Kích thước tối thiểu khi kiếm nằm phía sau
            VISUAL_SCALE_DEPTH_MULT: 0.24, // Mức tăng kích thước theo chiều sâu
            OPACITY_BASE: 0.42,         // Độ mờ tối thiểu khi kiếm ra phía sau
            OPACITY_DEPTH_MULT: 0.27,   // Mức tăng độ rõ theo chiều sâu
            LOOKAHEAD_TIME: 0.08        // Khoảng nhìn trước để xoay mũi kiếm theo quỹ đạo
        },
        ATTACK_DELAY_VAR: { BASE: 6, RAND: 10 },  // Độ trễ ngẫu nhiên giữa các lần phóng kiếm
        FRAGMENTS: {            // Hiệu ứng mảnh vỡ khi kiếm gãy
            LIFE_TIME: 2000,    // Thời gian tồn tại của mảnh vỡ
            FADE_TIME: 1000     // Thời gian mờ dần trước khi mất tích
        },
        ARTIFACT_ITEM: {
            uniqueKey: "THANH_TRUC_PHONG_VAN_KIEM",
            fullName: "Thanh Trúc Phong Vân Kiếm",
            quality: "HIGH",
            color: "#66f0c2",
            secondaryColor: "#dffef2",
            auraColor: "#30b894",
            buyPriceLowStone: 1800,
            sellPriceLowStone: 900,
            buttonLabel: "Mua 1 thanh",
            inventoryActionLabel: "Triển khai",
            realmLabel: "Pháp bảo cao cấp",
            evolutionLabel: "Linh bảo (gần Thông thiên)",
            featureSummary: "Phân kiếm thành trận, dẫn Tịch Tà Thần Lôi và tăng trưởng theo chủ nhân.",
            description: "Bộ kiếm tre xanh có thể tách hợp linh hoạt. Mỗi lần luyện hóa sẽ thêm một thanh hộ thân; đủ 72 thanh mới có thể khai triển Đại Canh Kiếm Trận.",
            gradeSystem: "Pháp khí: hạ, trung, thượng, cực phẩm • Pháp bảo: phổ thông, cao cấp, đỉnh cấp • Cổ bảo • Linh bảo, Thông thiên linh bảo • Huyền thiên chi bảo.",
            thunderStrike: {
                TRIGGER_CHANCE: 0.18, // Tỉ lệ kích hoạt
                FORMATION_TRIGGER_CHANCE: 0.32, // Tỉ lệ kích hoạt khi hình thành
                MOVEMENT_LOCK_MS: 180, // Thời gian khóa di chuyển
                SLOW_MS: 1000, // Thời gian làm chậm
                SLOW_FACTOR: 0.72, // Hệ số làm chậm
                DODGE_SUPPRESS_MS: 1200, // Thời gian áp chế né tránh
                SHIELD_BLOCK_MS: 1600 // Thời gian chặn khiên
            }
        },
        INSTANCE_SYSTEM: {
            BASE_POWER_RATING: 100, // Công lực cơ bản của mỗi instance kiếm
            BREAKS_PER_DURABILITY_LOSS: 4, // Số lần gãy khi mất độ bền
            MIN_DURABILITY: 1, // Độ bền tối thiểu trước khi kiếm vỡ hoàn toàn
            REFINED_DURABILITY_BASE: 8, // Độ bền cơ bản của instance trúc luyện hóa
            REFINED_DURABILITY_PER_120_YEARS: 2 // Độ bền tăng thêm theo mỗi 120 năm ôn dưỡng cho instance trúc luyện hóa
        },
        CONTROL: {
            WITHOUT_SECRET_ART: 1, // Không có nghệ thuật bí mật
            MAX_CONSCIOUSNESS_CONTROL: 72 // Số lượng kiếm tối đa có thể điều khiển ý thức (tương đương với số kiếm tối đa)
        },
        NURTURE_SYSTEM: {
            ROOT_MATERIAL_KEY: "KIM_LOI_TRUC_ROOT", // Mã định danh nguyên liệu gốc trong kho
            ROOT_INSTANCE_PREFIX: "KIM_LOI_TRUC_ROOT", // Tiền tố để tạo instance gốc khi bắt đầu nuôi dưỡng
            REFINED_INSTANCE_PREFIX: "THANH_TRUC_REFINED", // Tiền tố để tạo instance trúc luyện hóa khi hoàn thành mỗi giai đoạn
            MIN_REFINE_YEARS: 10000, // Chỉ từ 1 vạn năm tuổi mới đủ điều kiện luyện thành Thanh Trúc Phong Vân Kiếm
            AUTO_YEARS_PER_SECOND: 2, // Số năm tự động gia tăng mỗi giây
            AUTO_UI_REFRESH_MS: 1000, // Thời gian làm mới giao diện người dùng tự động
            AUTO_SAVE_INTERVAL_MS: 5000, // Thời gian tự động lưu tiến trình nuôi dưỡng
            CHUONG_ACCELERATION_YEARS: 1200, // Số năm tăng tốc mặc định khi dùng Chưởng Thiên Bình
            MAX_NURTURE_YEARS: 50000, // Giới hạn ôn dưỡng để người chơi có thể tiếp tục tăng sức mạnh kiếm sau mốc 1 vạn năm
            ROOT_SELLBACK_RATIO: 0.5, // Tỉ lệ hoàn lại khi bán nguyên liệu gốc (50% giá mua)
            REFINED_POWER_BASE: 100, // Công lực cơ bản của trúc luyện hóa
            REFINED_POWER_PER_YEAR: 1.05, // Tăng công lực theo từng năm
            REFINED_SELL_BASE: 800, // Giá bán cơ bản của trúc luyện hóa
            REFINED_SELL_PER_POWER: 10, // Giá bán tăng theo công lực
            STAGE_THRESHOLDS: [
                {
                    years: 0,
                    label: "Kim Lôi Trúc Mẫu",
                    displayName: "Kim Lôi Trúc Mẫu",
                    visualStage: "seed-core"
                },
                {
                    years: 1,
                    label: "Bạch Lôi Trúc",
                    displayName: "Bạch Lôi Trúc",
                    visualStage: "white-lightning"
                },
                {
                    years: 5000,
                    label: "Lam Lôi Trúc",
                    displayName: "Lam Lôi Trúc",
                    visualStage: "azure-lightning"
                },
                {
                    years: 10000,
                    label: "Kim Lôi Trúc",
                    displayName: "Kim Lôi Trúc",
                    visualStage: "golden-lightning"
                }
            ]
        }
    },
    ULTIMATE: {
        MAX_RAGE: 100,      // Giới hạn nộ đầy
        GAIN_PER_KILL: 2,   // Lượng nộ nhận được mỗi khi hạ 1 quái
        DURATION_MS: 10000, // Thời gian duy trì trạng thái ultimate
        TRANSITION_MS: 1000, // Thời gian hợp kiếm hoặc tách kiếm
        CHARGE_STEPS: 100,   // Số nấc hiển thị tiến độ nộ trên nút ultimate
        CORE_HIT_INTERVAL_MS: 42, // Khoảng thời gian giữa các lần kiếm chính đánh trúng mục tiêu khi ở trạng thái ultimate
        ATTACK_BURST_INTERVAL_MS: 32, // Khoảng thời gian giữa các lần phóng ra hạt tấn công khi ở trạng thái ultimate
        ATTACK_BURST_PARTICLE_COUNT: 8, // Số lượng hạt tấn công được phóng ra mỗi lần
        MAX_ACTIVE_BURST_PARTICLES: 200 // Số lượng hạt tấn công tối đa có thể tồn tại cùng lúc để tránh quá tải hiệu ứng
    },
    INPUT: {
        JOYSTICK_CURSOR_SPEED: 0.01, // Hệ số độ nhạy/tốc độ con trỏ khi điều khiển bằng joystick mobile
        DOUBLE_TAP_DELAY: 300   // Khoảng cách tối đa giữa 2 lần chạm để tính là double tap
    },
    CURSOR: {
        BASE_DOT_RADIUS: 3.2, // Bán kính của chấm sáng ở tâm con trỏ
        BASE_RING_RADIUS: 7.5, // Bán kính của vòng tròn xung quanh chấm sáng
        BASE_DOT_COLOR: "#f3fffd", // Màu của chấm sáng ở tâm con trỏ
        BASE_RING_COLOR: "rgba(143, 255, 224, 0.32)", // Màu của vòng tròn xung quanh chấm sáng
        BASE_GLOW_COLOR: "rgba(143, 255, 224, 0.42)", // Màu của hào quang phát ra từ con trỏ
        BASE_GLOW_BLUR: 10 // Độ mờ của hào quang phát ra từ con trỏ
    },
    COLORS: {
        BG_FADE: "rgba(0, 0, 8, 0.25)",         // Màu nền phủ (tạo hiệu ứng lưu ảnh/motion blur)
        SWORD_BLADE: ["#d0fff5", "#7fdcc0", "#3fa78a"], // Gradient màu lưỡi kiếm
        SWORD_TRAIL: "rgba(120, 255, 210, 0.3)",// Màu vệt sáng phía sau kiếm
        SWORD_HANDLE: "#2f7f68",        // Màu chuôi kiếm
        SWORD_GLOW_OUTER: "#8fffe0",    // Màu hào quang vòng ngoài
        SWORD_GLOW_INNER: "#9fffe6",    // Màu hào quang lõi kiếm
        SWORD_FRAGMENT: "#2a5a4d",      // Màu các mảnh vỡ
        SWORD_AURA_SHADOW: "#fffaa0",   // Màu bóng đổ của linh khí
        SWORD_BAMBOO_GREEN: '#4FE3C1', // Màu xanh trúc chính
        SWORD_BAMBOO_DARK: '#1FAF9A',  // Màu xanh đậm
        SWORD_GOLD_LIGHT: '#FFF2C2',   // Vàng kim sáng
        SWORD_GOLD_MID: '#E6C87A',    // Vàng kim vừa
        SWORD_GOLD_DARK: '#B8944E',    // Vàng đồng
        SWORD_NODE: '#7FFFE6',         // Màu đốt trúc sáng
        ENEMY_PARTICLE: "#8cf0ff",      // Màu hạt hiệu ứng từ quái vật
        ENEMY_SHADOW_SHIELD: "#00ffff", // Màu bóng của khiên bảo vệ quái
        SHIELD_GLOW: "rgba(0, 255, 255, 0.8)",  // Độ rực sáng của khiên
        SHIELD_RING_PULSE: "rgba(140, 245, 255, 1)", // Màu vòng xung lực khi khiên bị đánh
        SHIELD_RING_OUTER: "rgba(140, 245, 255, 0.2)", // Màu viền ngoài của khiên
    },
    IMAGES: IMAGE_PATHS,
    ENEMY: {
        SPAWN_COUNT: 10,                  // Số lượng quái xuất hiện cùng lúc
        SPAWN_PADDING: 50,                // Khoảng cách an toàn từ mép màn hình khi quái xuất hiện
        ELITE_MULT: 5, // Hệ số nhân phần thưởng cho quái Tinh Anh
        ELITE_CHANCE: 0.01,               // Tỉ lệ quái tinh anh xuất hiện (1%)
        BASE_SIZE: { MIN: 10, VAR: 50 },  // Công thức kích thước: r = MIN + random^1.5 * VAR
        GUARANTEED_PLAYER_SCALE_COUNT: 1, // Số lượng quái luôn bám theo cấp người chơi
        GUARANTEED_COUNT: 3,              // Số lượng quái vừa sức luôn xuất hiện mỗi lần spawn
        DIFF_LIMIT: 6, // Ngưỡng chênh lệch cảnh giới để bắt đầu giảm sát thương
        MAJOR_RANK_DIFF: 9, // Ngưỡng chênh lệch cảnh giới để bắt đầu né tránh hoàn toàn
        NOTIFY_COOLDOWN_MS: 3000,    // Thời gian chờ giữa các lần thông báo né tránh
        BASE_DODGE_CHANCE: 0.1, // 10% né tránh cơ bản cho quái thường
        ELITE_DODGE_BONUS: 0.15, // Tinh anh né thêm 15% (tổng 25%)
        DODGE_PER_RANK_DIFF: 0.05, // Mỗi cấp chênh lệch tăng 5% né tránh
        MAX_DODGE_CHANCE: 0.75,    // Né tối đa 75% (để người chơi vẫn có cửa thắng)
        SPAWN_RANK_RANGE: {
            MIN_ID: 1, // Cảnh giới tối thiểu của quái vật
            MAX_ID: 64 // Cảnh giới tối đa của quái vật
        },
        SHIELD_CHANCE: 0.3,                         // Tỉ lệ quái sinh ra có khiên (0.3 = 30%)
        SHIELD_COLOR: "rgba(100, 200, 255, 0.4)", // Màu lõi khiên
        SHIELD_LINE: "#80dfff",                     // Màu nét vẽ vết nứt khiên
        SHIELD_HP_RATIO: 0.1,                       // 0.1 tương đương 10% máu quái
        RECOVERY_DELAY_MS: 3000,                    // Thời gian chờ sau khi bị tấn công trước khi bắt đầu hồi phục khiên
        RECOVERY_SPEED_PER_SEC: 0.05,               // Tốc độ hồi phục khiên mỗi giây (0.05 = 5% HP khiên mỗi giây)
        PROACTIVE_ATTACK: {
            BASE_CHANCE: 0.16,                      // Tỉ lệ cơ bản để quái chủ động tấn công khi ở gần người chơi
            MIN_CHANCE: 0.02,                       // Giới hạn tối thiểu để vẫn còn khả năng chủ động
            MAX_CHANCE: 0.42,                       // Giới hạn tối đa để tránh dồn dập quá mức
            LOWER_OR_EQUAL_BONUS_PER_LEVEL: 0.04,   // Quái thấp hơn hoặc ngang cấp sẽ hiếu chiến hơn mỗi cấp chênh
            HIGHER_RANK_PENALTY_PER_LEVEL: 0.06,    // Quái cao cấp hơn người chơi sẽ giảm tỉ lệ chủ động
            ELITE_BONUS: 0.05,                      // Tinh anh vẫn có khuynh hướng chủ động hơn nhẹ
            ROLL_INTERVAL_MS: 900,                  // Khoảng thời gian giữa mỗi lần "quyết định" có chủ động hay không
            AGGRO_WINDOW_MS: 2800                   // Sau khi đã chủ động thì duy trì đà tấn công trong khoảng này
        },
        DEBRIS: {                                   // Mảnh vỡ khi quái chết
            COUNT: 10,                              // Số lượng mảnh bắn ra
            SPEED: { MIN: 4, MAX: 12 },             // Tốc độ bắn mảnh vỡ
            SIZE: { MIN: 1, MAX: 3 },               // Kích thước mảnh vỡ
            LIFE_DECAY: 0.025                       // Tốc độ biến mất của mảnh vỡ mỗi frame
        },
        PALETTES: [                                 // Danh sách các bộ màu ngẫu nhiên cho quái
            ["#ff9999", "#cc3333"], ["#99ccff", "#3366cc"],
            ["#99ff99", "#33cc33"], ["#ffcc99", "#cc6600"],
            ["#ff99ff", "#cc33cc"], ["#ffff99", "#cccc33"]
        ],
        ANIMALS: [
            "ammonite.svg",
            "angel-wings.svg",
            "angler-fish.svg",
            "angular-spider.svg",
            "animal-skull.svg",
            "ant.svg",
            "bear.svg",
            "bee.svg",
            "cat-kitty.svg",
            "cat.svg",
            "crab.svg",
            "crocodile.svg",
            "deer.svg",
            "double-dragon.svg",
            "dragon.svg",
            "elephant.svg",
            "fish-seafood.svg",
            "flying-dragon.svg",
            "fox.svg",
            "gorilla.svg",
            "hydra.svg",
            "jelly-fish.svg",
            "lion.svg",
            "maggot.svg",
            "minotaur.svg",
            "monkey.svg",
            "octopus.svg",
            "perana.svg",
            "rabbit.svg",
            "shark.svg",
            "snail-crawl.svg",
            "squid.svg",
            "squirrel.svg",
            "tapir.svg",
            "three-headed-dragon.svg",
            "tiger.svg",
            "turtle.svg",
            "whale-tail.svg",
            "whale.svg",
            "wolf.svg",
        ].map(fileName => imagePath(`animals/${fileName}`)),
        MATERIAL_DROPS: {
            "ammonite": { GIAP_XAC: 5.2, LINH_LAN: 1.4 },
            "angel-wings": { LINH_VU: 5.1, LINH_TY: 1.9, YEU_HUYET: 1.2 },
            "angler-fish": { LINH_LAN: 4.2, YEU_NANH: 2.1, TINH_THIT: 1.4 },
            "angular-spider": { LINH_TY: 4.8, DOC_NANG: 3.4, PHONG_CHAM: 1.6 },
            "animal-skull": { YEU_COT: 5.4, YEU_HUYET: 1.4 },
            "ant": { PHONG_CHAM: 4.6, TINH_THIT: 1.4, YEU_HUYET: 0.8 },
            "bear": { YEU_BI: 4.4, TINH_THIT: 2.4, YEU_HUYET: 1.6 },
            "bee": { PHONG_CHAM: 4.8, DOC_NANG: 2.8, LINH_VU: 1.2 },
            "cat-kitty": { LINH_MAO: 4.2, YEU_NANH: 2.2, YEU_HUYET: 1.1 },
            "cat": { LINH_MAO: 4.2, YEU_NANH: 2.4, YEU_HUYET: 1.0 },
            "crab": { GIAP_XAC: 5.0, TINH_THIT: 1.8, YEU_GIAC: 1.1 },
            "crocodile": { YEU_BI: 4.0, LINH_LAN: 2.8, TINH_THIT: 1.3 },
            "deer": { YEU_GIAC: 5.2, LINH_MAO: 1.5, YEU_HUYET: 1.4, NGAN_NAM_HOANG_TINH: 0.8 },
            "double-dragon": { LONG_LAN: 5.6, YEU_DAN: 2.0, YEU_HUYET: 1.2 },
            "dragon": { LONG_LAN: 5.4, YEU_DAN: 1.8, YEU_HUYET: 1.3, THIEN_LINH_QUA: 0.35 },
            "elephant": { TU_NGA: 5.2, YEU_BI: 2.2, YEU_COT: 1.3 },
            "fish-seafood": { LINH_LAN: 4.4, TINH_THIT: 2.4 },
            "flying-dragon": { LONG_LAN: 5.2, LINH_VU: 1.6, YEU_DAN: 1.7, TUYET_NGOC_THAO: 0.55 },
            "fox": { LINH_MAO: 4.2, YEU_NANH: 2.5, YEU_HUYET: 1.0 },
            "gorilla": { YEU_BI: 4.2, YEU_COT: 1.8, TINH_THIT: 2.0 },
            "hydra": { LONG_LAN: 4.2, DOC_NANG: 3.6, YEU_DAN: 1.6, HUYEN_HOA_LIEN: 0.48 },
            "jelly-fish": { XUC_TU: 4.4, DOC_NANG: 2.8, YEU_HUYET: 1.0 },
            "lion": { YEU_NANH: 5.4, YEU_HUYET: 1.8, TINH_THIT: 1.4 },
            "maggot": { TINH_THIT: 4.0, YEU_HUYET: 2.2, DOC_NANG: 0.9 },
            "minotaur": { YEU_GIAC: 4.8, YEU_COT: 2.3, YEU_HUYET: 1.8 },
            "monkey": { LINH_MAO: 3.8, YEU_BI: 2.4, TINH_THIT: 1.8 },
            "octopus": { XUC_TU: 5.0, YEU_HUYET: 2.0, TINH_THIT: 1.3 },
            "perana": { YEU_NANH: 4.8, LINH_LAN: 2.4, YEU_HUYET: 1.4 },
            "rabbit": { LINH_MAO: 5.0, YEU_HUYET: 1.2, TINH_THIT: 1.0 },
            "shark": { YEU_NANH: 5.2, LINH_LAN: 2.8, TINH_THIT: 1.4 },
            "snail-crawl": { GIAP_XAC: 4.8, LINH_TY: 1.6, TINH_THIT: 1.0 },
            "squid": { XUC_TU: 4.8, LINH_LAN: 1.8, TINH_THIT: 1.2 },
            "squirrel": { LINH_MAO: 4.6, YEU_HUYET: 1.1, TINH_THIT: 1.0 },
            "tapir": { YEU_BI: 4.3, TINH_THIT: 2.2, YEU_HUYET: 1.4 },
            "three-headed-dragon": { LONG_LAN: 5.8, YEU_DAN: 2.2, YEU_HUYET: 1.4, THIEN_LINH_QUA: 0.5, HUYEN_HOA_LIEN: 0.4 },
            "tiger": { YEU_NANH: 5.6, YEU_HUYET: 1.9, TINH_THIT: 1.5 },
            "turtle": { GIAP_XAC: 5.2, YEU_COT: 1.6, TINH_THIT: 1.2 },
            "whale-tail": { YEU_COT: 4.8, LINH_LAN: 2.0, TINH_THIT: 1.5 },
            "whale": { YEU_COT: 5.0, TINH_THIT: 2.6, LINH_LAN: 1.4 },
            "wolf": { YEU_NANH: 5.8, YEU_HUYET: 1.8, TINH_THIT: 1.4 }
        }
    },
    ITEMS: {
        INVENTORY_MIN_SLOTS: 16, // Số ô tối thiểu luôn hiển thị trong Túi không gian
        INVENTORY_BASE_CAPACITY: 16, // Số ô tối đa luôn hiển thị trong Túi không gian
        SELLBACK_RATIO: 0.5, // Tỉ lệ bán lại vật phẩm khi bán tất cả vật phẩm trong Túi
        STORAGE_BAGS: {
            LOW: {
                fullName: "Thanh Mộc Trữ Vật Nang",
                capacity: 24,
                color: "#72f1cf",
                buyPriceLowStone: 320
            },
            MEDIUM: {
                fullName: "Lưu Vân Nạp Linh Túi",
                capacity: 40,
                color: "#6db8ff",
                buyPriceLowStone: 1200
            },
            HIGH: {
                fullName: "Tinh Hà Giới Tử Đại",
                capacity: 64,
                color: "#c090ff",
                buyPriceLowStone: 5200
            },
            SUPREME: {
                fullName: "Càn Khôn Vạn Tượng Nang",
                capacity: 96,
                color: "#ffd76f",
                buyPriceLowStone: 18000
            }
        },
        SEVEN_COLOR_BAG: {
            fullName: "Thất Sắc Vô Tận Nang",
            quality: "SUPREME",
            color: "#fff1a8",
            capacity: Number.POSITIVE_INFINITY,
            buyPriceLowStone: 4800000,
            buttonLabel: "Mua"
        },
        MATERIALS: {
            YEU_GIAC: {
                fullName: "Yêu giác",
                quality: "HIGH",
                color: "#f5c87a",
                radius: 4.8,
                buyPriceLowStone: 120, // Giá mua tính theo Low Stone
                dropWeight: 1.05, // Tỉ lệ rơi khi đánh quái (càng cao càng dễ rơi)
                nutrition: 0, // Giá trị dinh dưỡng khi dùng làm thức ăn cho kỳ trùng
                description: "Sừng yêu thú cứng như linh thiết, thường dùng làm nguyên liệu ấp nở kỳ trùng giáp xác."
            },
            YEU_HUYET: {
                fullName: "Yêu huyết",
                quality: "MEDIUM",
                color: "#ff6f88",
                radius: 4.9,
                buyPriceLowStone: 90,
                dropWeight: 1.35,
                nutrition: 2,
                description: "Tinh huyết lấy từ yêu thú vừa ngã xuống, thích hợp làm thức ăn và môi chất dưỡng trùng."
            },
            YEU_DAN: {
                fullName: "Yêu đan",
                quality: "HIGH",
                color: "#a48dff",
                radius: 5.2,
                buyPriceLowStone: 180,
                dropWeight: 0.72,
                nutrition: 1,
                description: "Nội đan ngưng tụ yêu lực, là linh tài hiếm dùng để kích hoạt trứng và bồi bổ vài loài kỳ trùng."
            },
            TINH_THIT: {
                fullName: "Tinh thịt",
                quality: "MEDIUM",
                color: "#ffb27d",
                radius: 4.9,
                buyPriceLowStone: 75,
                dropWeight: 1.55,
                nutrition: 3,
                description: "Phần huyết nhục tinh luyện từ xác yêu thú, là loại thức ăn ổn định nhất cho nhiều đàn kỳ trùng."
            },
            DOC_NANG: {
                fullName: "Độc nang",
                quality: "HIGH",
                color: "#75d86a",
                radius: 5,
                buyPriceLowStone: 140,
                dropWeight: 0.88,
                nutrition: 1,
                description: "Túi độc còn nguyên dược tính, vừa có thể ấp các dị trùng độc hệ vừa dùng làm khẩu phần đặc thù."
            },
            LINH_TY: {
                fullName: "Linh ty",
                quality: "MEDIUM",
                color: "#93d6ff",
                radius: 4.8,
                buyPriceLowStone: 110,
                dropWeight: 1.02,
                nutrition: 2,
                description: "Tơ linh khí kết lại thành sợi, vừa dùng ổn định ổ ấp vừa làm thức ăn cho các loài tàm, nga và chu."
            },
            YEU_NANH: {
                fullName: "Yêu nanh",
                quality: "MEDIUM",
                color: "#f8e6b4",
                radius: 4.7,
                buyPriceLowStone: 105,
                dropWeight: 1.18,
                nutrition: 0,
                description: "Nanh nhọn còn sót sát khí, thường lấy từ lang yêu, hổ yêu hay hải thú hung lệ để luyện khí hoặc giao dịch."
            },
            LINH_VU: {
                fullName: "Linh vũ",
                quality: "MEDIUM",
                color: "#d7f0ff",
                radius: 4.7,
                buyPriceLowStone: 95,
                dropWeight: 0.96,
                nutrition: 1,
                description: "Lông cánh thấm linh quang, nhẹ như hư vụ, thích hợp làm phụ liệu cho linh thú phi hành và vài loại kỳ trùng."
            },
            GIAP_XAC: {
                fullName: "Giáp xác",
                quality: "HIGH",
                color: "#d7b38a",
                radius: 5.1,
                buyPriceLowStone: 135,
                dropWeight: 0.92,
                nutrition: 0,
                description: "Mảnh vỏ cứng lột từ quy yêu, giải yêu hay giáp xác dị chủng, thường dùng để bồi cốt, rèn giáp và ấp trùng giáp xác."
            },
            YEU_BI: {
                fullName: "Yêu bì",
                quality: "MEDIUM",
                color: "#b98262",
                radius: 4.9,
                buyPriceLowStone: 90,
                dropWeight: 1.16,
                nutrition: 2,
                description: "Da yêu thú đã qua tinh luyện, dẻo mà bền, vừa có thể may linh cụ vừa dùng làm khẩu phần dưỡng đàn."
            },
            LONG_LAN: {
                fullName: "Long lân",
                quality: "HIGH",
                color: "#7dd7c5",
                radius: 5.2,
                buyPriceLowStone: 185,
                dropWeight: 0.68,
                nutrition: 1,
                description: "Vảy rồng lưu lại long uy, là linh tài thượng phẩm hiếm gặp, thường rơi từ chân long hoặc dị long nhiều đầu."
            },
            LINH_LAN: {
                fullName: "Linh lân",
                quality: "MEDIUM",
                color: "#69c7ff",
                radius: 4.9,
                buyPriceLowStone: 100,
                dropWeight: 1.08,
                nutrition: 1,
                description: "Phiến lân óng ánh thu được từ ngư yêu và thủy thú, giàu thủy linh, hợp làm thức ăn và vật dẫn cho linh trùng thủy hệ."
            },
            XUC_TU: {
                fullName: "Xúc tu",
                quality: "MEDIUM",
                color: "#b88cff",
                radius: 4.9,
                buyPriceLowStone: 92,
                dropWeight: 1.04,
                nutrition: 2,
                description: "Xúc tu dai dẻo của hải yêu, sứa yêu hay bạch tuộc dị chủng, chứa nhiều linh dịch và huyết tinh."
            },
            YEU_COT: {
                fullName: "Yêu cốt",
                quality: "HIGH",
                color: "#f2efe8",
                radius: 5.1,
                buyPriceLowStone: 145,
                dropWeight: 0.82,
                nutrition: 1,
                description: "Tinh cốt còn lưu dư uy của đại yêu, thường dùng để luyện khí, dựng khung linh cụ hoặc nghiền bột bồi dưỡng linh thú."
            },
            PHONG_CHAM: {
                fullName: "Phong châm",
                quality: "HIGH",
                color: "#ffd96f",
                radius: 4.8,
                buyPriceLowStone: 128,
                dropWeight: 0.86,
                nutrition: 0,
                description: "Độc châm bén như kim thu được từ phong yêu hay dị trùng giáp xác, rất hợp để luyện độc khí và bày ám trận."
            },
            LINH_MAO: {
                fullName: "Linh mao",
                quality: "LOW",
                color: "#f6f0d8",
                radius: 4.5,
                buyPriceLowStone: 68,
                dropWeight: 1.26,
                nutrition: 1,
                description: "Lông mao mềm nhẹ, tích tụ linh tức từ hồ yêu, miêu yêu hay thỏ yêu, có thể làm lót ổ ấp và phụ liệu dưỡng thú."
            },
            TU_NGA: {
                fullName: "Tượng ngà",
                quality: "HIGH",
                color: "#fff2cf",
                radius: 5.2,
                buyPriceLowStone: 190,
                dropWeight: 0.64,
                nutrition: 0,
                description: "Ngà cổ của tượng yêu, cứng bền mà chứa linh văn tự nhiên, là vật hiếm cho luyện khí và khắc trận văn."
            },
            NGAN_NAM_HOANG_TINH: {
                fullName: "Ngàn năm hoàng tinh",
                quality: "HIGH",
                color: "#ffd870",
                radius: 5.1,
                buyPriceLowStone: 220,
                dropWeight: 0.82,
                nutrition: 1,
                description: "Linh dược tụ thổ mộc chi khí, thường dùng làm chủ dược khi luyện các loại tăng tu vi đan."
            },
            TUYET_NGOC_THAO: {
                fullName: "Tuyết ngọc thảo",
                quality: "HIGH",
                color: "#c9f4ff",
                radius: 5.1,
                buyPriceLowStone: 240,
                dropWeight: 0.74,
                nutrition: 1,
                description: "Linh thảo hàn tính kết tinh trong ngọc mạch, dùng để ổn định đan độc và nâng phẩm chất đan dược."
            },
            HUYEN_HOA_LIEN: {
                fullName: "Huyền hỏa liên",
                quality: "SUPREME",
                color: "#ff9c74",
                radius: 5.6,
                buyPriceLowStone: 420,
                dropWeight: 0.52,
                nutrition: 0,
                description: "Liên hoa sinh trong địa hỏa, là phụ liệu bồi hỏa lực khi khai đỉnh luyện đan."
            },
            THIEN_LINH_QUA: {
                fullName: "Thiên linh quả",
                quality: "SUPREME",
                color: "#8bffcf",
                radius: 5.4,
                buyPriceLowStone: 520,
                dropWeight: 0.45,
                nutrition: 2,
                description: "Linh quả hấp thu thiên địa tinh hoa, thường làm quân dược cho cao giai đan phương."
            },
            KIM_LOI_TRUC_ROOT: {
                fullName: "Kim Lôi Trúc Mẫu",
                quality: "SUPREME",
                color: "#8ff7bf",
                radius: 6.2,
                buyPriceLowStone: 2400,
                dropWeight: 0,
                nutrition: 0,
                description: "Mẫu căn của Kim Lôi Trúc, mang lôi tức và mộc nguyên tinh thuần. Phải ôn dưỡng từ 1 vạn năm tuổi trở lên mới có thể khai luyện thành Thanh Trúc Phong Vân Kiếm."
            },
            NGUYET_HOA_LO: {
                fullName: "Nguyệt hoa lộ",
                quality: "MEDIUM",
                color: "#d8eeff",
                radius: 4.9,
                buyPriceLowStone: 148,
                dropWeight: 0.9,
                nutrition: 1,
                description: "Linh lộ đọng trên cánh hoa dưới trăng, giúp trung hòa dược tính và ổn định dược lực."
            },
            DIA_TAM_HOA_TINH: {
                fullName: "Địa tâm hỏa tinh",
                quality: "HIGH",
                color: "#ffb47b",
                radius: 5.1,
                buyPriceLowStone: 268,
                dropWeight: 0.64,
                nutrition: 0,
                description: "Tinh thể hỏa mạch ngưng kết dưới lòng đất, dùng để gia cố hỏa lực cho đan lô."
            },
            VAN_MOC_CHI: {
                fullName: "Vạn mộc chi",
                quality: "SUPREME",
                color: "#95ffc2",
                radius: 5.4,
                buyPriceLowStone: 420,
                dropWeight: 0.4,
                nutrition: 2,
                description: "Linh chi thượng cổ chứa tinh mộc thuần khiết, thường là linh tài phụ trợ cho cao phẩm đan phương."
            }
        },
        MATERIAL_DROP: {
            NORMAL_CHANCE: 0.42, // Tỉ lệ rơi vật phẩm thường
            ELITE_CHANCE: 0.88, // Tỉ lệ rơi vật phẩm tinh anh
            NORMAL_COUNT: { MIN: 1, MAX: 2 }, // Số lượng vật phẩm thường
            ELITE_COUNT: { MIN: 2, MAX: 4 } // Số lượng vật phẩm tinh anh
        }
    },
    ALCHEMY: {
        ENABLED: true,
        REQUIRES_HU_THIEN_DINH: true,
        NOTIFY_COLOR: "#93c8d8",
        DEFAULT_BREW_MS: 32000,
        FORMULA_QUALITY_LABELS: {
            LOW: "Hạ phẩm",
            MEDIUM: "Trung phẩm",
            HIGH: "Thượng phẩm",
            SUPREME: "Cực phẩm"
        },
        FURNACES: {
            HA_PHAM_DAN_LO: {
                name: "Thanh Đồng Đan Lô",
                quality: "LOW",
                buyPriceLowStone: 2400,
                brewTimeMultiplier: 1.2,
                successRate: 0.76,
                outputMultiplier: 1
            },
            TRUNG_PHAM_DAN_LO: {
                name: "Tử Kim Đan Lô",
                quality: "MEDIUM",
                buyPriceLowStone: 5800,
                brewTimeMultiplier: 1,
                successRate: 0.84,
                outputMultiplier: 1.2
            },
            THUONG_PHAM_DAN_LO: {
                name: "Thái Huyền Đan Lô",
                quality: "HIGH",
                buyPriceLowStone: 12800,
                brewTimeMultiplier: 0.82,
                successRate: 0.9,
                outputMultiplier: 1.45
            },
            CUC_PHAM_DAN_LO: {
                name: "Cửu Khiếu Đan Lô",
                quality: "SUPREME",
                buyPriceLowStone: 24800,
                brewTimeMultiplier: 0.66,
                successRate: 0.95,
                outputMultiplier: 1.8
            }
        },
        RECIPES: {
            TU_KHI_DAN_PHUONG: {
                name: "Tụ Khí Đan Phương",
                formulaQuality: "LOW",
                realmTier: "Phàm đan",
                buyPriceLowStone: 420,
                brewTimeMs: 18000,
                output: { category: "EXP", quality: "MEDIUM", count: 1 },
                ingredients: [
                    { materialKey: "NGAN_NAM_HOANG_TINH", count: 2 },
                    { materialKey: "LINH_TY", count: 1 },
                    { materialKey: "YEU_HUYET", count: 1 }
                ]
            },
            HOI_LINH_DAN_PHUONG: {
                name: "Hồi Linh Đan Phương",
                formulaQuality: "MEDIUM",
                realmTier: "Linh đan",
                buyPriceLowStone: 960,
                brewTimeMs: 26000,
                output: { category: "MANA", quality: "HIGH", count: 1 },
                ingredients: [
                    { materialKey: "TUYET_NGOC_THAO", count: 2 },
                    { materialKey: "NGUYET_HOA_LO", count: 1 },
                    { materialKey: "TINH_THIT", count: 1 },
                    { materialKey: "YEU_DAN", count: 1 }
                ]
            },
            KHAI_HAI_DAN_PHUONG: {
                name: "Khai Hải Đan Phương",
                formulaQuality: "HIGH",
                realmTier: "Huyền đan",
                buyPriceLowStone: 1880,
                brewTimeMs: 34000,
                output: { category: "MAX_MANA", quality: "HIGH", count: 1 },
                ingredients: [
                    { materialKey: "THIEN_LINH_QUA", count: 1 },
                    { materialKey: "TUYET_NGOC_THAO", count: 1 },
                    { materialKey: "VAN_MOC_CHI", count: 1 },
                    { materialKey: "YEU_DAN", count: 2 }
                ]
            },
            THAI_HUYEN_TRU_MA_PHUONG: {
                name: "Thái Huyền Tru Ma Phương",
                formulaQuality: "SUPREME",
                realmTier: "Địa đan",
                buyPriceLowStone: 3600,
                brewTimeMs: 52000,
                output: { category: "ATTACK", quality: "SUPREME", count: 1 },
                ingredients: [
                    { materialKey: "HUYEN_HOA_LIEN", count: 1 },
                    { materialKey: "THIEN_LINH_QUA", count: 1 },
                    { materialKey: "DIA_TAM_HOA_TINH", count: 1 },
                    { materialKey: "LONG_LAN", count: 2 }
                ]
            }
        },
        MATERIAL_RECIPE_MAP: {
            NGAN_NAM_HOANG_TINH: ["TU_KHI_DAN_PHUONG"],
            TUYET_NGOC_THAO: ["HOI_LINH_DAN_PHUONG", "KHAI_HAI_DAN_PHUONG"],
            HUYEN_HOA_LIEN: ["THAI_HUYEN_TRU_MA_PHUONG"],
            THIEN_LINH_QUA: ["KHAI_HAI_DAN_PHUONG", "THAI_HUYEN_TRU_MA_PHUONG"]
        }
    },
    MANA: {
        // Lưu ý: MAX giờ đây sẽ được ghi đè bởi giá trị trong CULTIVATION.RANKS
        MAX: 100,               // Giới hạn Linh lực mặc định
        START: 100,             // Linh lực khi bắt đầu game
        REGEN_PER_SEC: 2,     // Tốc độ hồi phục Linh lực mỗi giây
        REGEN_INTERVAL_MS: 1000,// Chu kỳ hồi phục (1000ms = 1 giây một lần)
        COST_RESPAWN: -3,       // Chi phí Mana để hồi phục một thanh kiếm bị vỡ
        GAIN_KILL: 0,           // Lượng Mana nhận lại khi tiêu diệt một quái vật
        COST_MOVE_PER_SEC: 0.5, // Tiêu hao Mana mỗi giây khi di chuyển
        COST_ATTACK_PER_SEC: 1, // Tiêu hao Mana mỗi giây khi đang ở trạng thái tấn công
        COST_CHANGE_FORM: 1     // Chi phí Mana mỗi lần chuyển đổi hình thái (vòng bảo vệ)
    },
    CULTIVATION: {
        STARTING_RANK_ID: 1, // Cảnh giới khởi đầu khi bắt đầu game mới (dùng id trong RANKS để test nhanh)
        MAX_BREAKTHROUGH_CHANCE: 0.99, // Tỉ lệ đột phá tối đa tôi đang để là 99% (luôn có 1% rủi ro để tăng độ kịch tính)
        BREAKTHROUGH_PENALTY_FACTOR: 0.4, // Hệ số mất tu vi khi đột phá thất bại (40%)
        OVERFLOW_LIMIT: 1.2,              // Giới hạn tràn exp (120% lượng exp cần thiết)
        TRIBULATION: {
            // Cấu hình linh động các mốc độ kiếp:
            // Mỗi mốc sourceRankId sẽ mở popup độ kiếp và nếu thành công sẽ nhảy sang targetRankId.
            // Có thể thêm bao nhiêu mốc tùy ý.
            STEPS: [
                { sourceRankId: 41, targetRankId: 42 } // Đại thừa đại viên mãn -> Chân tiên sơ kỳ
            ],

            // Legacy fallback (giữ tương thích ngược nếu chưa dùng STEPS)
            SOURCE_RANK_ID: 41,
            TARGET_RANK_ID: 42,
            STRIKE_COUNT: 9,
            BASE_HP: 1000,
            STRIKE_INTERVAL_MS: 1200,
            PREPARE_DELAY_MS: 800,
            // Dải sát thương tinh chỉnh để độ kiếp không gần-như-chắc-thất-bại.
            // Với 9 đạo lôi kiếp, mốc này cho tỉ lệ sống sót trung bình ~55%.
            DAMAGE_RATIO_MIN: 0.07,
            DAMAGE_RATIO_MAX: 0.15
        },
        MAJOR_REALMS: [
            { key: "LUYEN_KHI", name: "Luyện khí", startId: 1, endId: 13, nextKey: "TRUC_CO", nextName: "Trúc cơ" },
            { key: "TRUC_CO", name: "Trúc cơ", startId: 14, endId: 17, nextKey: "KET_DAN", nextName: "Kết đan" },
            { key: "KET_DAN", name: "Kết đan", startId: 18, endId: 21, nextKey: "NGUYEN_ANH", nextName: "Nguyên anh" },
            { key: "NGUYEN_ANH", name: "Nguyên anh", startId: 22, endId: 25, nextKey: "HOA_THAN", nextName: "Hóa thần" },
            { key: "HOA_THAN", name: "Hóa thần", startId: 26, endId: 29, nextKey: "LUYEN_HU", nextName: "Luyện hư" },
            { key: "LUYEN_HU", name: "Luyện hư", startId: 30, endId: 33, nextKey: "HOP_THE", nextName: "Hợp thể" },
            { key: "HOP_THE", name: "Hợp thể", startId: 34, endId: 37, nextKey: "DAI_THUA", nextName: "Đại thừa" },
            { key: "DAI_THUA", name: "Đại thừa", startId: 38, endId: 41, nextKey: "CHAN_TIEN", nextName: "Chân tiên" },
            { key: "CHAN_TIEN", name: "Chân tiên", startId: 42, endId: 45, nextKey: "KIM_TIEN", nextName: "Kim tiên" },
            { key: "KIM_TIEN", name: "Kim tiên", startId: 46, endId: 49, nextKey: "THAI_AT", nextName: "Thái Ất" },
            { key: "THAI_AT", name: "Thái Ất", startId: 50, endId: 53, nextKey: "DAI_LA", nextName: "Đại la" },
            { key: "DAI_LA", name: "Đại la", startId: 54, endId: 60, nextKey: "DAO_TO", nextName: "Đạo tổ" },
            { key: "DAO_TO", name: "Đạo tổ", startId: 61, endId: 64, nextKey: null, nextName: null }
        ],
        RANKS: [
            // --- NHÂN GIỚI ---
            // Luyện Khí Kỳ
            { id: 1, consciousness: 1, name: "Luyện khí sơ kỳ (Tầng 1)", exp: 5, expGive: 1, chance: 1, swordDurability: 3, damage: 1, hp: 1000, maxMana: 10, color: "#CDD5E0", lightColor: "#F5F7FB" },
            { id: 2, consciousness: 4, name: "Luyện khí sơ kỳ (Tầng 2)", exp: 6, expGive: 1, chance: 0.95, swordDurability: 4, damage: 2, hp: 1100, maxMana: 15, color: "#B8C2D0", lightColor: "#EEF2F8" },
            { id: 3, consciousness: 7, name: "Luyện khí sơ kỳ (Tầng 3)", exp: 7, expGive: 1, chance: 0.95, swordDurability: 5, damage: 3, hp: 1200, maxMana: 20, color: "#A3AFBF", lightColor: "#E7ECF4" },
            { id: 4, consciousness: 10, name: "Luyện khí sơ kỳ (Tầng 4)", exp: 9, expGive: 2, chance: 0.95, swordDurability: 6, damage: 4, hp: 1300, maxMana: 25, color: "#8F9DAF", lightColor: "#E0E6F0" },
            { id: 5, consciousness: 13, name: "Luyện khí trung kỳ (Tầng 5)", exp: 12, expGive: 2, chance: 0.9, swordDurability: 7, damage: 5, hp: 1400, maxMana: 30, color: "#7A899E", lightColor: "#D8DFEA" },
            { id: 6, consciousness: 16, name: "Luyện khí trung kỳ (Tầng 6)", exp: 16, expGive: 3, chance: 0.9, swordDurability: 8, damage: 6, hp: 1500, maxMana: 35, color: "#66758C", lightColor: "#D0D8E4" },
            { id: 7, consciousness: 19, name: "Luyện khí trung kỳ (Tầng 7)", exp: 21, expGive: 4, chance: 0.9, swordDurability: 9, damage: 7, hp: 1600, maxMana: 40, color: "#55647A", lightColor: "#C8D1DE" },
            { id: 8, consciousness: 22, name: "Luyện khí trung kỳ (Tầng 8)", exp: 27, expGive: 5, chance: 0.9, swordDurability: 10, damage: 8, hp: 1700, maxMana: 45, color: "#465567", lightColor: "#C0CAD8" },
            { id: 9, consciousness: 25, name: "Luyện khí hậu kỳ (Tầng 9)", exp: 35, expGive: 7, chance: 0.85, swordDurability: 11, damage: 9, hp: 1800, maxMana: 50, color: "#394959", lightColor: "#B9C3D2" },
            { id: 10, consciousness: 28, name: "Luyện khí hậu kỳ (Tầng 10)", exp: 45, expGive: 9, chance: 0.85, swordDurability: 12, damage: 10, hp: 1900, maxMana: 55, color: "#2D3D4B", lightColor: "#B2BDCC" },
            { id: 11, consciousness: 31, name: "Luyện khí hậu kỳ (Tầng 11)", exp: 58, expGive: 12, chance: 0.85, swordDurability: 13, damage: 11, hp: 2000, maxMana: 60, color: "#233241", lightColor: "#ABB6C6" },
            { id: 12, consciousness: 34, name: "Luyện khí hậu kỳ (Tầng 12)", exp: 75, expGive: 15, chance: 0.8, swordDurability: 14, damage: 12, hp: 2100, maxMana: 65, color: "#1B2937", lightColor: "#A4AFC0" },
            { id: 13, consciousness: 37, name: "Luyện khí đại viên mãn (Tầng 13)", exp: 100, expGive: 20, chance: 0.75, swordDurability: 15, damage: 13, hp: 2200, maxMana: 70, bonus: 100, color: "#141F2D", lightColor: "#FFFFFF" },

            // Trúc Cơ Kỳ
            { id: 14, consciousness: 40, name: "Trúc cơ sơ kỳ", exp: 120, expGive: 25, chance: 0.7, swordDurability: 16, damage: 14, hp: 2300, maxMana: 75, color: "#A8F5AE", lightColor: "#EFFFF1" },
            { id: 15, consciousness: 43, name: "Trúc cơ trung kỳ", exp: 180, expGive: 35, chance: 0.65, swordDurability: 17, damage: 15, hp: 2400, maxMana: 80, color: "#79E989", lightColor: "#DDFDE5" },
            { id: 16, consciousness: 46, name: "Trúc cơ hậu kỳ", exp: 270, expGive: 50, chance: 0.6, swordDurability: 18, damage: 16, hp: 2500, maxMana: 85, color: "#4ED86A", lightColor: "#C9F9D3" },
            { id: 17, consciousness: 49, name: "Trúc cơ đại viên mãn", exp: 400, expGive: 80, chance: 0.55, swordDurability: 19, damage: 17, hp: 2600, maxMana: 90, bonus: 300, color: "#27BF4C", lightColor: "#B2F2BE" },

            // Kết Đan Kỳ
            { id: 18, consciousness: 52, name: "Kết đan sơ kỳ", exp: 600, expGive: 120, chance: 0.5, swordDurability: 20, damage: 18, hp: 2700, maxMana: 95, color: "#9BD3FF", lightColor: "#ECF7FF" },
            { id: 19, consciousness: 55, name: "Kết đan trung kỳ", exp: 900, expGive: 180, chance: 0.45, swordDurability: 21, damage: 19, hp: 2800, maxMana: 100, color: "#6CBBFF", lightColor: "#DCEEFF" },
            { id: 20, consciousness: 58, name: "Kết đan hậu kỳ", exp: 1400, expGive: 280, chance: 0.4, swordDurability: 22, damage: 20, hp: 2900, maxMana: 105, color: "#3A9FFF", lightColor: "#C9E4FF" },
            { id: 21, consciousness: 61, name: "Kết đan đại viên mãn", exp: 2000, expGive: 400, chance: 0.35, swordDurability: 23, damage: 21, hp: 3000, maxMana: 110, bonus: 1500, color: "#0F84F2", lightColor: "#B5D9FF" },

            // Nguyên Anh Kỳ
            { id: 22, consciousness: 73, name: "Nguyên anh sơ kỳ", exp: 3000, expGive: 600, chance: 0.35, swordDurability: 24, damage: 22, hp: 3100, maxMana: 115, color: "#D2B3FF", lightColor: "#F6EEFF" },
            { id: 23, consciousness: 77, name: "Nguyên anh trung kỳ", exp: 5000, expGive: 1000, chance: 0.3, swordDurability: 25, damage: 23, hp: 3200, maxMana: 120, color: "#B98DFF", lightColor: "#EBDDFF" },
            { id: 24, consciousness: 81, name: "Nguyên anh hậu kỳ", exp: 8000, expGive: 1600, chance: 0.25, swordDurability: 26, damage: 24, hp: 3300, maxMana: 125, color: "#9D67F2", lightColor: "#DFC9FF" },
            { id: 25, consciousness: 85, name: "Nguyên anh đại viên mãn", exp: 12000, expGive: 2500, chance: 0.2, swordDurability: 27, damage: 25, hp: 3400, maxMana: 130, bonus: 8000, color: "#8142DB", lightColor: "#D2B3FF" },

            // Hóa Thần Kỳ
            { id: 26, consciousness: 89, name: "Hóa thần sơ kỳ", exp: 18000, expGive: 3600, chance: 0.2, swordDurability: 28, damage: 26, hp: 3500, maxMana: 135, color: "#FFD199", lightColor: "#FFF4E6" },
            { id: 27, consciousness: 93, name: "Hóa thần trung kỳ", exp: 25000, expGive: 5000, chance: 0.18, swordDurability: 29, damage: 27, hp: 3600, maxMana: 140, color: "#FFB866", lightColor: "#FFE9CC" },
            { id: 28, consciousness: 97, name: "Hóa thần hậu kỳ", exp: 35000, expGive: 7000, chance: 0.15, swordDurability: 30, damage: 28, hp: 3700, maxMana: 145, color: "#FF9D33", lightColor: "#FFDEB0" },
            { id: 29, consciousness: 101, name: "Hóa thần đại viên mãn", exp: 50000, expGive: 10000, chance: 0.12, swordDurability: 31, damage: 29, hp: 3800, maxMana: 150, bonus: 25000, color: "#F28000", lightColor: "#FFD195" },

            // --- LINH GIỚI ---
            // Luyện Hư Kỳ
            { id: 30, consciousness: 105, name: "Luyện hư sơ kỳ", exp: 60000, expGive: 12000, chance: 0.12, swordDurability: 32, damage: 30, hp: 3900, maxMana: 155, color: "#FFD0E6", lightColor: "#FFF2F9" },
            { id: 31, consciousness: 109, name: "Luyện hư trung kỳ", exp: 80000, expGive: 16000, chance: 0.1, swordDurability: 33, damage: 31, hp: 4000, maxMana: 160, color: "#FFADD2", lightColor: "#FFE5F1" },
            { id: 32, consciousness: 113, name: "Luyện hư hậu kỳ", exp: 110000, expGive: 22000, chance: 0.09, swordDurability: 34, damage: 32, hp: 4100, maxMana: 165, color: "#FF87BD", lightColor: "#FFD6E9" },
            { id: 33, consciousness: 117, name: "Luyện hư đại viên mãn", exp: 150000, expGive: 30000, chance: 0.08, swordDurability: 35, damage: 33, hp: 4200, maxMana: 170, bonus: 30000, color: "#F45CA3", lightColor: "#FFC5DF" },

            // Hợp Thể Kỳ
            { id: 34, consciousness: 121, name: "Hợp thể sơ kỳ", exp: 165000, expGive: 33000, chance: 0.08, swordDurability: 36, damage: 34, hp: 4300, maxMana: 175, color: "#FFC8C8", lightColor: "#FFF1F1" },
            { id: 35, consciousness: 125, name: "Hợp thể trung kỳ", exp: 180000, expGive: 36000, chance: 0.07, swordDurability: 37, damage: 35, hp: 4400, maxMana: 180, color: "#FFA1A1", lightColor: "#FFE3E3" },
            { id: 36, consciousness: 129, name: "Hợp thể hậu kỳ", exp: 230000, expGive: 46000, chance: 0.06, swordDurability: 38, damage: 36, hp: 4500, maxMana: 185, color: "#FF7575", lightColor: "#FFD3D3" },
            { id: 37, consciousness: 133, name: "Hợp thể đại viên mãn", exp: 300000, expGive: 60000, chance: 0.05, swordDurability: 39, damage: 37, hp: 4600, maxMana: 190, bonus: 50000, color: "#F14949", lightColor: "#FFC2C2" },

            // Đại Thừa Kỳ
            { id: 38, consciousness: 137, name: "Đại thừa sơ kỳ", exp: 340000, expGive: 68000, chance: 0.05, swordDurability: 40, damage: 38, hp: 4700, maxMana: 195, color: "#FFE9A8", lightColor: "#FFF9E3" },
            { id: 39, consciousness: 141, name: "Đại thừa trung kỳ", exp: 380000, expGive: 76000, chance: 0.04, swordDurability: 41, damage: 39, hp: 4800, maxMana: 200, color: "#FFD974", lightColor: "#FFF1C7" },
            { id: 40, consciousness: 145, name: "Đại thừa hậu kỳ", exp: 480000, expGive: 96000, chance: 0.03, swordDurability: 42, damage: 40, hp: 4900, maxMana: 205, color: "#FFC640", lightColor: "#FFE7A8" },
            { id: 41, consciousness: 149, name: "Đại thừa đại viên mãn", exp: 600000, expGive: 120000, chance: 0.02, swordDurability: 43, damage: 41, hp: 5000, maxMana: 210, bonus: 80000, color: "#EFAE12", lightColor: "#FFD98A" },

            // --- TIÊN GIỚI ---
            // Chân Tiên
            { id: 42, consciousness: 153, name: "Chân tiên sơ kỳ", exp: 2300000, expGive: 460000, chance: 0.011, swordDurability: 48, damage: 46, hp: 5800, maxMana: 260, color: "#B8F2FF", lightColor: "#EFFBFF" },
            { id: 43, consciousness: 157, name: "Chân tiên trung kỳ", exp: 3200000, expGive: 640000, chance: 0.01, swordDurability: 49, damage: 47, hp: 6000, maxMana: 275, color: "#86E5FF", lightColor: "#DDF6FF" },
            { id: 44, consciousness: 161, name: "Chân tiên hậu kỳ", exp: 4500000, expGive: 900000, chance: 0.009, swordDurability: 50, damage: 48, hp: 6200, maxMana: 290, color: "#52D6FF", lightColor: "#C9F0FF" },
            { id: 45, consciousness: 165, name: "Chân tiên đại viên mãn", exp: 6200000, expGive: 1240000, chance: 0.008, swordDurability: 51, damage: 49, hp: 6400, maxMana: 305, bonus: 620000, color: "#1BC2F5", lightColor: "#B3E8FF" },

            // Kim Tiên (Pháp tắc ngưng tụ)
            { id: 46, consciousness: 169, name: "Kim tiên sơ kỳ", exp: 8500000, expGive: 1700000, chance: 0.007, swordDurability: 52, damage: 50, hp: 6700, maxMana: 320, color: "#BCC2FF", lightColor: "#F0F1FF" },
            { id: 47, consciousness: 173, name: "Kim tiên trung kỳ", exp: 11500000, expGive: 2300000, chance: 0.006, swordDurability: 53, damage: 51, hp: 7000, maxMana: 335, color: "#969FFF", lightColor: "#E2E5FF" },
            { id: 48, consciousness: 177, name: "Kim tiên hậu kỳ", exp: 15500000, expGive: 3100000, chance: 0.0055, swordDurability: 54, damage: 52, hp: 7300, maxMana: 350, color: "#707BFA", lightColor: "#D2D8FF" },
            { id: 49, consciousness: 181, name: "Kim tiên đại viên mãn", exp: 21000000, expGive: 4200000, chance: 0.005, swordDurability: 55, damage: 53, hp: 7600, maxMana: 365, bonus: 2100000, color: "#4E59E3", lightColor: "#C0C8FF" },

            // Thái Ất (Ngọc Tiên)
            { id: 50, consciousness: 185, name: "Thái Ất sơ kỳ", exp: 28500000, expGive: 5700000, chance: 0.0048, swordDurability: 56, damage: 54, hp: 8000, maxMana: 380, color: "#B3F4E8", lightColor: "#ECFFFA" },
            { id: 51, consciousness: 189, name: "Thái Ất trung kỳ", exp: 38000000, expGive: 7600000, chance: 0.0042, swordDurability: 57, damage: 55, hp: 8400, maxMana: 395, color: "#81E9D4", lightColor: "#DCFFF3" },
            { id: 52, consciousness: 193, name: "Thái Ất hậu kỳ", exp: 50000000, expGive: 10000000, chance: 0.0036, swordDurability: 58, damage: 56, hp: 8800, maxMana: 410, color: "#4EDCBE", lightColor: "#C8F9EA" },
            { id: 53, consciousness: 197, name: "Thái Ất đại viên mãn", exp: 65000000, expGive: 13000000, chance: 0.003, swordDurability: 59, damage: 57, hp: 9200, maxMana: 425, bonus: 6500000, color: "#21C6A4", lightColor: "#B2F0DE" },

            // Đại La (Trảm Tam Thi)
            { id: 54, consciousness: 201, name: "Đại la sơ kỳ", exp: 82000000, expGive: 16400000, chance: 0.0028, swordDurability: 60, damage: 58, hp: 9700, maxMana: 440, color: "#EEC9FF", lightColor: "#FAEFFF" },
            { id: 55, consciousness: 205, name: "Đại la trung kỳ", exp: 102000000, expGive: 20400000, chance: 0.0026, swordDurability: 61, damage: 59, hp: 10200, maxMana: 455, color: "#DFA2FF", lightColor: "#F2E2FF" },
            { id: 56, consciousness: 209, name: "Đại la hậu kỳ", exp: 128000000, expGive: 25600000, chance: 0.0024, swordDurability: 62, damage: 60, hp: 10700, maxMana: 470, color: "#CE79FF", lightColor: "#E9D3FF" },
            { id: 57, consciousness: 213, name: "Đại la đại viên mãn", exp: 160000000, expGive: 32000000, chance: 0.0022, swordDurability: 63, damage: 61, hp: 11200, maxMana: 485, bonus: 16000000, color: "#BC4FFF", lightColor: "#DFC2FF" },
            { id: 58, consciousness: 217, name: "Đại la trảm nhất thi", exp: 200000000, expGive: 40000000, chance: 0.002, swordDurability: 64, damage: 62, hp: 11800, maxMana: 500, color: "#A52EFF", lightColor: "#D4B0FF" },
            { id: 59, consciousness: 221, name: "Đại la trảm nhị thi", exp: 260000000, expGive: 52000000, chance: 0.0018, swordDurability: 65, damage: 63, hp: 12400, maxMana: 520, color: "#8B16E8", lightColor: "#C99EFF" },
            { id: 60, consciousness: 225, name: "Đại la trảm tam thi", exp: 340000000, expGive: 68000000, chance: 0.0015, swordDurability: 66, damage: 64, hp: 13000, maxMana: 540, bonus: 34000000, color: "#7100C8", lightColor: "#BC8BFA" },

            // Đạo Tổ (Hợp đạo)
            { id: 61, consciousness: 229, name: "Đạo tổ sơ cảnh", exp: 450000000, expGive: 90000000, chance: 0.0012, swordDurability: 67, damage: 65, hp: 14000, maxMana: 580, color: "#FFC39D", lightColor: "#FFF2E8" },
            { id: 62, consciousness: 233, name: "Đạo tổ ổn định đạo", exp: 600000000, expGive: 120000000, chance: 0.001, swordDurability: 68, damage: 66, hp: 15200, maxMana: 620, color: "#FF9663", lightColor: "#FFE5D6" },
            { id: 63, consciousness: 237, name: "Đạo tổ trung tầng", exp: 800000000, expGive: 160000000, chance: 0.0008, swordDurability: 69, damage: 67, hp: 16500, maxMana: 680, color: "#FF6A33", lightColor: "#FFD7C3" },
            { id: 64, consciousness: Number.POSITIVE_INFINITY, name: "Đạo tổ đỉnh phong", exp: Number.POSITIVE_INFINITY, expGive: 0, chance: 0, swordDurability: 99999, damage: Number.POSITIVE_INFINITY, hp: Number.POSITIVE_INFINITY, maxMana: Number.POSITIVE_INFINITY, color: "#34C759", lightColor: "#FFFFFF", accentColor: "#FFF4B8", barGradient: "linear-gradient(90deg, #ff3b30 0%, #ff9500 16%, #ffcc00 32%, #34c759 48%, #007aff 64%, #5856d6 80%, #af52de 100%)", textGradient: "linear-gradient(90deg, #ff3b30 0%, #ff9500 16%, #ffcc00 32%, #34c759 48%, #007aff 64%, #5856d6 80%, #af52de 100%)", infiniteStats: true }
        ]
    },
    PILL: {
        CHANCE: 0.08, // Tỉ lệ rơi mặc định (8%)
        ELITE_CHANCE: 0.65, // Tỉ lệ rơi của quái Tinh Anh (65%)
        COLLECT_DELAY_MS: 600, // Thời gian chờ trước khi bay về người chơi
        MAGNET_SPEED: 14, // Tốc độ bay về phía người chơi
        TRAIL_LENGTH: 15, // Độ dài vệt sáng (số lượng node)
        DROP_COUNT: {
            NORMAL: 1, // Quái thường rơi 1 viên
            ELITE: 2 // Tinh Anh rơi 2 viên
        },
        DROP_RATES: {
            NORMAL: { LOW: 0.85, MEDIUM: 0.10, HIGH: 0.05 },
            ELITE: { LOW: 0.10, MEDIUM: 0.60, HIGH: 0.30 }
        },
        TYPES: createTieredConfig({
            LOW: { name: "Hạ phẩm", boost: 0.02, color: "#00ffcc" },
            MEDIUM: { name: "Trung phẩm", boost: 0.05, color: "#00aaff" },
            HIGH: { name: "Thượng phẩm", boost: 0.12, color: "#ffcc00" },
            PERFECT: { name: "Cực phẩm", boost: 0.25, color: "#ff33cc" },
        }, PILL_TYPE_BASE),
        CATEGORY_SORT: {
            EXP: 0, // Loại thưởng EXP
            INSIGHT: 1, // Loại thưởng INSIGHT
            BREAKTHROUGH: 2, // Loại thưởng BREAKTHROUGH
            ATTACK: 3, // Loại thưởng ATTACK
            SHIELD_BREAK: 4, // Loại thưởng SHIELD_BREAK
            BERSERK: 5, // Loại thưởng BERSERK
            RAGE: 6, // Loại thưởng RAGE
            MANA: 7, // Loại thưởng MANA
            MAX_MANA: 8, // Loại thưởng MAX_MANA
            REGEN: 9, // Loại thưởng REGEN
            SPEED: 10, // Loại thưởng SPEED
            FORTUNE: 11, // Loại thưởng FORTUNE
            SWORD_ART: 12, // Loại thưởng SWORD_ART
            FLAME_ART: 13, // Loại thưởng FLAME_ART
            SWORD_ARTIFACT: 14, // Loại thưởng SWORD_ARTIFACT
            ARTIFACT: 15, // Loại thưởng ARTIFACT
            INSECT_SKILL: 16, // Loại thưởng INSECT_SKILL
            INSECT_ARTIFACT: 17, // Loại thưởng INSECT_ARTIFACT
            SPECIAL: 18 // Loại thưởng SPECIAL
        },
        CATEGORY_RATES: {
            NORMAL: { EXP: 0.17, INSIGHT: 0.07, BREAKTHROUGH: 0.10, ATTACK: 0.12, SHIELD_BREAK: 0.05, BERSERK: 0.06, RAGE: 0.09, MANA: 0.08, MAX_MANA: 0.07, REGEN: 0.06, SPEED: 0.08, FORTUNE: 0.05 },
            ELITE: { EXP: 0.12, INSIGHT: 0.05, BREAKTHROUGH: 0.14, ATTACK: 0.14, SHIELD_BREAK: 0.08, BERSERK: 0.10, RAGE: 0.08, MANA: 0.07, MAX_MANA: 0.06, REGEN: 0.06, SPEED: 0.07, FORTUNE: 0.03 }
        },
        QUALITY_RATES: {
            NORMAL: { LOW: 0.72, MEDIUM: 0.20, HIGH: 0.07, SUPREME: 0.01 },
            ELITE: { LOW: 0.28, MEDIUM: 0.42, HIGH: 0.22, SUPREME: 0.08 }
        },
        EXP_QUALITIES: createLabeledQualityConfig({
            LOW: { fullName: "Thanh Linh Tụ Khí Đan", expFactor: 0.05, color: "#69f0cb", buyPriceLowStone: 30 },
            MEDIUM: { fullName: "Bích Hải Tụ Linh Đan", expFactor: 0.12, color: "#53b9ff", buyPriceLowStone: 140 },
            HIGH: { fullName: "Kim Tủy Dưỡng Nguyên Đan", expFactor: 0.24, color: "#ffd86b", buyPriceLowStone: 900 },
            SUPREME: { fullName: "Thiên Hoa Uẩn Mạch Đan", expFactor: 0.40, color: "#ff7ad9", buyPriceLowStone: 5600 }
        }),
        INSIGHT_QUALITIES: createRadiusQualityConfig({
            LOW: { fullName: "Minh Tâm Ngộ Đạo Đan", expGainPct: 0.06, color: "#c2f970", buyPriceLowStone: 110 },
            MEDIUM: { fullName: "Thông Huyền Khai Ngộ Đan", expGainPct: 0.14, color: "#a5e65d", buyPriceLowStone: 520 },
            HIGH: { fullName: "Thiên Cơ Minh Đạo Đan", expGainPct: 0.28, color: "#d6ff7f", buyPriceLowStone: 2600 },
            SUPREME: { fullName: "Vạn Tượng Tri Kiến Đan", expGainPct: 0.45, color: "#f3ff9a", buyPriceLowStone: 14000 }
        }),
        BREAKTHROUGH_QUALITIES: createLabeledQualityConfig({
            LOW: { breakthroughBoost: 0.03, color: "#78f2ff", buyPriceLowStone: 80 },
            MEDIUM: { breakthroughBoost: 0.07, color: "#79a8ff", buyPriceLowStone: 450 },
            HIGH: { breakthroughBoost: 0.13, color: "#c88fff", buyPriceLowStone: 2600 },
            SUPREME: { breakthroughBoost: 0.22, color: "#ffe08f", buyPriceLowStone: 16000 }
        }),
        ATTACK_QUALITIES: createRadiusQualityConfig({
            LOW: { fullName: "Thanh Mộc Trảm Linh Đan", attackPct: 0.06, color: "#7fffd4", buyPriceLowStone: 90 },
            MEDIUM: { fullName: "Kim Tủy Phạt Mạch Đan", attackPct: 0.12, color: "#7dc7ff", buyPriceLowStone: 480 },
            HIGH: { fullName: "Liệt Dương Bá Thể Đan", attackPct: 0.22, color: "#ff9d6d", buyPriceLowStone: 2800 },
            SUPREME: { fullName: "Thái Huyền Tru Ma Đan", attackPct: 0.38, color: "#ffd36b", buyPriceLowStone: 16800 }
        }),
        SHIELD_BREAK_QUALITIES: createRadiusQualityConfig({
            LOW: { fullName: "Toái Giáp Phá Cấm Đan", shieldBreakPct: 0.18, color: "#9bf6ff", buyPriceLowStone: 100 },
            MEDIUM: { fullName: "Liệt Khiên Xuyên Mạch Đan", shieldBreakPct: 0.34, color: "#6ad7ff", buyPriceLowStone: 480 },
            HIGH: { fullName: "Thiên Sát Toái Thuẫn Đan", shieldBreakPct: 0.58, color: "#5ca8ff", buyPriceLowStone: 2500 },
            SUPREME: { fullName: "Hư Không Phá Giới Đan", shieldBreakPct: 0.90, color: "#7f8cff", buyPriceLowStone: 15000 }
        }),
        BERSERK_QUALITIES: createRadiusQualityConfig({
            LOW: { fullName: "Nhiên Huyết Cuồng Sát Đan", attackPct: 1.2, durationMs: 12000, auraMode: "berserk", sideManaLoss: 25, color: "#ff6b6b", radius: 5.2, buyPriceLowStone: 260 },
            MEDIUM: { fullName: "Phệ Linh Bạo Khí Đan", attackPct: 1.55, durationMs: 14000, auraMode: "berserk", sideMaxManaFlat: -15, color: "#ff7f50", radius: 6.0, buyPriceLowStone: 760 },
            HIGH: { fullName: "Trầm Mạch Thiên Sát Đan", attackPct: 1.9, durationMs: 16000, auraMode: "berserk", sideSpeedPct: -0.22, color: "#ff5349", radius: 6.8, buyPriceLowStone: 2100 },
            SUPREME: { fullName: "Nghịch Nguyên Thiêu Huyết Đan", attackPct: 2.35, durationMs: 18000, auraMode: "berserk", sideExpLossRatio: 0.18, color: "#ff2d55", radius: 7.8, buyPriceLowStone: 4800 }
        }),
        RAGE_QUALITIES: createRadiusQualityConfig({
            LOW: { fullName: "Chiến Ý Ngưng Hỏa Đan", rageGain: 25, color: "#ff9f43", buyPriceLowStone: 60 },
            MEDIUM: { fullName: "Liệt Tâm Nhiên Mạch Đan", rageGain: 50, color: "#ff7f50", buyPriceLowStone: 220 },
            HIGH: { fullName: "Sát Phạt Tụ Ý Đan", rageGain: 80, color: "#ff5b6e", buyPriceLowStone: 980 },
            SUPREME: { fullName: "Thiên Ma Chiến Hồn Đan", rageGain: 100, color: "#ff3366", buyPriceLowStone: 2800 }
        }),
        MANA_QUALITIES: createRadiusQualityConfig({
            LOW: { fullName: "Hồi Nguyên Bổ Khí Đan", manaRestore: 20, color: "#6de0ff", buyPriceLowStone: 40 },
            MEDIUM: { fullName: "Bích Lộ Hồi Linh Đan", manaRestore: 45, color: "#4fc3f7", buyPriceLowStone: 170 },
            HIGH: { fullName: "Kim Tủy Hoàn Linh Đan", manaRestore: 80, color: "#29b6f6", buyPriceLowStone: 720 },
            SUPREME: { fullName: "Thái Ất Quy Nguyên Đan", manaRestore: 140, color: "#00e5ff", buyPriceLowStone: 2200 }
        }),
        MAX_MANA_QUALITIES: createRadiusQualityConfig({
            LOW: { fullName: "Uẩn Hải Khai Mạch Đan", maxManaFlat: 5, color: "#9c88ff", buyPriceLowStone: 95 },
            MEDIUM: { fullName: "Tử Hà Dưỡng Phủ Đan", maxManaFlat: 10, color: "#8c7ae6", buyPriceLowStone: 420 },
            HIGH: { fullName: "Thiên Tuyền Khuyết Hải Đan", maxManaFlat: 18, color: "#7158e2", buyPriceLowStone: 1900 },
            SUPREME: { fullName: "Hư Thiên Nạp Linh Đan", maxManaFlat: 30, color: "#5f27cd", buyPriceLowStone: 9800 }
        }),
        REGEN_QUALITIES: createRadiusQualityConfig({
            LOW: { fullName: "Cam Lộ Dưỡng Tuyền Đan", manaRegenPct: 0.25, color: "#65d6ce", buyPriceLowStone: 70 },
            MEDIUM: { fullName: "Thanh Uyên Hồi Nguyên Đan", manaRegenPct: 0.50, color: "#4dd0e1", buyPriceLowStone: 320 },
            HIGH: { fullName: "Bích Tuyền Sinh Tức Đan", manaRegenPct: 0.80, color: "#26c6da", buyPriceLowStone: 1500 },
            SUPREME: { fullName: "Vạn Mạch Tuần Hoàn Đan", manaRegenPct: 1.20, color: "#00acc1", buyPriceLowStone: 7600 }
        }),
        SPEED_QUALITIES: createRadiusQualityConfig({
            LOW: { fullName: "Ngự Phong Khinh Thân Đan", speedPct: 0.08, color: "#7bed9f", buyPriceLowStone: 85 },
            MEDIUM: { fullName: "Lưu Vân Thuấn Ảnh Đan", speedPct: 0.15, color: "#2ed573", buyPriceLowStone: 360 },
            HIGH: { fullName: "Thiên La Tật Ảnh Đan", speedPct: 0.24, color: "#1dd1a1", buyPriceLowStone: 1600 },
            SUPREME: { fullName: "Kim Bằng Phá Hư Đan", speedPct: 0.36, color: "#10ac84", buyPriceLowStone: 8400 }
        }),
        FORTUNE_QUALITIES: createRadiusQualityConfig({
            LOW: { fullName: "Vân Mệnh Tụ Phúc Đan", dropRatePct: 0.10, color: "#ffd56f", buyPriceLowStone: 130 },
            MEDIUM: { fullName: "Kim Quang Tăng Vận Đan", dropRatePct: 0.18, color: "#ffca3a", buyPriceLowStone: 620 },
            HIGH: { fullName: "Tinh Tú Khải Vận Đan", dropRatePct: 0.30, color: "#ffb703", buyPriceLowStone: 3200 },
            SUPREME: { fullName: "Thiên Mệnh Hồng Phúc Đan", dropRatePct: 0.50, color: "#ffd166", buyPriceLowStone: 18600 }
        }),
        SPECIAL_ITEMS: {
            CHUNG_CUC_DAO_NGUYEN_DAN: {
                fullName: "Chung Cực Đạo Nguyên Đan",
                quality: "SUPREME",
                auraMode: "rainbow",
                color: "#fff1a8",
                radius: 8.2,
                buyPriceLowStone: 8888888
            },
            TAN_DAO_DIET_NGUYEN_DAN: {
                fullName: "Tẫn Đạo Diệt Nguyên Đan",
                quality: "SUPREME",
                auraMode: "void",
                durationMs: 60000, // Thời gian tồn tại của hiệu ứng sau khi sử dụng (1 phút)
                color: "#231130",
                radius: 8,
                buyPriceLowStone: 4444444
            }
        }
    },
    SECRET_ARTS: {
        THANH_LINH_KIEM_QUYET: {
            fullName: "Thanh Linh Kiếm Quyết",
            quality: "HIGH",
            color: "#72f7d0",
            buyPriceLowStone: 280000,
            buttonLabel: "Mua",
            inventoryActionLabel: "Lĩnh ngộ",
            description: "Kiếm quyết nhập thần, sau khi lĩnh ngộ mới có thể lấy thần thức điều khiển nhiều thanh Thanh Trúc Phong Vân Kiếm bay quanh thân."
        },
        DAI_CANH_KIEM_TRAN: {
            fullName: "Đại Canh Kiếm Trận",
            quality: "SUPREME",
            color: "#ffd36b",
            buyPriceLowStone: 1000000,
            buttonLabel: "Mua",
            inventoryActionLabel: "Lĩnh ngộ",
            description: "Trận đạo bí pháp lấy Thanh Trúc Phong Vân Kiếm làm trận cơ. Chỉ sau khi lĩnh ngộ và gom đủ kiếm khí mới có thể bày trận hộ thân, trấn sát bốn phương.",
            visualStyle: "formation"
        }
    },
    ARTIFACTS: {
        CHUONG_THIEN_BINH: {
            fullName: "Chưởng Thiên Bình",
            quality: "SUPREME",
            color: "#8fffe0",
            secondaryColor: "#cffff1",
            auraColor: "#6ce5ba",
            buyPriceLowStone: 8800000,
            buttonLabel: "Mua",
            inventoryActionLabel: "Gia tốc",
            isOneTime: true, // Chỉ sử dụng được một lần, sau khi dùng sẽ biến mất khỏi kho
            cooldownMs: 30000, // Thời gian hồi chiêu sau khi sử dụng
            nurtureBoostYears: 1200, // Số năm gia tăng vào thời điểm hiện tại sau khi sử dụng
            description: "Bình nhỏ màu lục cổ, phủ kín hoa văn huyền ảo và tỏa khí tức thời gian. Có thể gia tốc thời quang, tích trữ lục dịch, thúc sinh cơ và bồi dưỡng linh dược. Đây là một Huyền thiên chi bảo chạm đến pháp tắc thời gian."
        },
        PHONG_LOI_SI: {
            fullName: "Phong Lôi Sí",
            quality: "SUPREME",
            color: "#9fe8ff",
            secondaryColor: "#dffeff",
            auraColor: "#89a6ff",
            buyPriceLowStone: 1800000,
            buttonLabel: "Mua",
            inventoryActionLabel: "Luyện hóa",
            deployLabel: "Triển khai",
            stowLabel: "Thu hồi",
            description: "Phong lôi song sí, sau khi luyện hóa sẽ hóa thành linh dực hộ tại thần niệm, bám hai bên tâm ấn mà tăng thêm vẻ thần tốc.",
            cursorStyle: {
                WING_OFFSET_X: 15, // Khoảng mở ngang của đôi cánh hai bên con trỏ
                WING_OFFSET_Y: -1.5, // Độ nâng của cánh so với tâm con trỏ
                WING_WIDTH: 15, // Bề ngang cánh chính
                WING_HEIGHT: 20, // Độ cao vút của cánh
                FLAP_AMPLITUDE: 0.12, // Độ rung nhịp phong lôi
                FLAP_SPEED: 0.0052, // Tốc độ nhịp rung
                GLOW_BLUR: 16, // Mức sáng của lôi mang
                ARC_LENGTH: 9 // Chiều dài điện văn phụ trên cánh
            },
            teleportSkill: {
                NAME: "Phong Lôi Độn",
                CHARGE_MS: 90, // Thời gian tích trữ trước khi dịch chuyển
                TRANSITION_MS: 48, // Thời gian chuyển tiếp giữa vị trí cũ và mới
                COOLDOWN_MS: 320, // Thời gian hồi chiêu
                MANA_COST: 18, // Mana tiêu hao khi sử dụng
                TRIGGER_TRAVEL_DISTANCE: 140, // Khoảng cách tối thiểu để kích hoạt hiệu ứng sau khi dịch chuyển
                BLINK_DISTANCE: 220, // Khoảng cách dịch chuyển tối đa
                MIN_BLINK_DISTANCE: 88, // Khoảng cách dịch chuyển tối thiểu để kích hoạt hiệu ứng
                MIN_MOVE_SPEED: 0.8, // Tốc độ di chuyển tối thiểu để kích hoạt hiệu ứng
                AFTERIMAGE_MS: 280, // Thời gian tồn tại của ảnh sau khi dịch chuyển
                TRAIL_MS: 260, // Thời gian tồn tại của vệt lôi sau khi dịch chuyển
                FLASH_MS: 80, // Thời gian tồn tại của hiệu ứng sáng chớp sau khi dịch chuyển
                IMPACT_RADIUS: 26 // Bán kính ảnh hưởng của vụ nổ điện sau khi dịch chuyển
            }
        },
        HUYET_SAC_PHI_PHONG: {
            fullName: "Huyết Sắc Phi Phong",
            quality: "SUPREME",
            color: "#ff5d73",
            secondaryColor: "#ffd0d6",
            auraColor: "#b81531",
            buyPriceLowStone: 2200000,
            buttonLabel: "Mua",
            inventoryActionLabel: "Luyện hóa",
            deployLabel: "Triển khai",
            stowLabel: "Thu hồi",
            imagePath: IMAGE_PATHS.ARTIFACTS.HUYET_SAC_PHI_PHONG,
            speedBonusPct: 0.42, // Tỉ lệ gia tăng tốc độ di chuyển khi triển khai
            trailOffsetStanding: 18, // Khoảng cách giữa nhân vật và vệt máu khi đứng yên
            trailOffsetMoving: 9, // Khoảng cách giữa nhân vật và vệt máu khi di chuyển
            movingAnchorFollow: 0.78, // Tỉ lệ bám theo tâm ấn khi di chuyển (giá trị càng cao thì vệt máu càng bám sát tâm ấn)
            description: "Huyết sắc phi phong như dải máu hóa gió. Sau khi luyện hóa sẽ bám theo tâm ấn, gia tăng thân pháp và kéo ra huyết quang đỏ rực phía sau mỗi lần di chuyển."
        },
        CAN_LAM_BANG_DIEM: {
            fullName: "Càn Lam Băng Diễm",
            quality: "SUPREME",
            color: "#79d9ff",
            secondaryColor: "#d7f7ff",
            auraColor: "#46b7ff",
            buyPriceLowStone: 1000000,
            buttonLabel: "Mua",
            inventoryActionLabel: "Luyện hóa",
            deployLabel: "Triển khai",
            stowLabel: "Thu hồi",
            imagePath: IMAGE_PATHS.ARTIFACTS.CAN_LAM_BANG_DIEM,
            castSkill: {
                MANA_COST: 22 // Linh lực tiêu hao mỗi lần thi triển
            },
            description: "Pháp bảo lam sắc, sau khi luyện hóa có thể triển khai lên tâm niệm. Khi triển khai, con trỏ hóa lam diễm và có thể chủ động thi triển truy kích."
        },
        HU_THIEN_DINH: {
            fullName: "Hư Thiên Đỉnh",
            quality: "SUPREME",
            color: "#93c8d8",
            secondaryColor: "#d9ecf3",
            auraColor: "#5f8595",
            buyPriceLowStone: 3600000,
            buttonLabel: "Mua",
            inventoryActionLabel: "Luyện hóa",
            deployLabel: "Triển khai",
            stowLabel: "Thu hồi",
            imagePath: IMAGE_PATHS.ARTIFACTS.HU_THIEN_DINH,
            shield: {
                MAX_CAPACITY: 280,
                DAMAGE_REDUCTION_PCT: 0.92,
                CRACK_RECOVER_PER_SEC: 0.16
            },
            description: "Tiểu đỉnh cổ xanh xám, mang không gian nội tại như một tiểu thế giới. Có thể thu nạp, phong ấn và trấn áp mục tiêu. Khi triển khai sẽ dựng Đỉnh ảnh hộ thể, hấp thụ sát thương cho đến khi dần nứt vỡ."
        }
    },
    INSECT: {
        STARTING_BEAST_BAG_CAPACITY: 6,
        UNIQUE_ITEMS: {
            KHU_TRUNG_THUAT: {
                fullName: "Khu Trùng Thuật",
                quality: "HIGH",
                color: "#ff92c2",
                buyPriceLowStone: 4200,
                buttonLabel: "Mua",
                inventoryActionLabel: "Lĩnh ngộ"
            },
            KY_TRUNG_BANG: {
                fullName: "Kỳ Trùng Bảng",
                quality: "SUPREME",
                color: "#ffd871",
                buyPriceLowStone: 6800,
                buttonLabel: "Mua"
            }
        },
        BEAST_BAG: {
            fullName: "Linh Thú Đại",
            quality: "HIGH",
            color: "#8ebfff",
            capacity: 24,
            buyPriceLowStone: 9600,
            buttonLabel: "Mua"
        },
        SEVEN_COLOR_BEAST_BAG: {
            fullName: "Thất Sắc Linh Thú Đại",
            quality: "SUPREME",
            color: "#ffe38b",
            capacity: Number.POSITIVE_INFINITY,
            buyPriceLowStone: 5600000,
            buttonLabel: "Mua"
        },
        TIERS: {
            PHAM: { label: "Phàm Trùng", color: "#85ffb8", shortLabel: "Phàm" },
            LINH: { label: "Linh Trùng", color: "#78d8ff", shortLabel: "Linh" },
            HUYEN: { label: "Huyền Trùng", color: "#aa9cff", shortLabel: "Huyền" },
            THIEN: { label: "Thiên Trùng", color: "#ffd26e", shortLabel: "Thiên" },
            DE: { label: "Đế Trùng", color: "#ff7cc7", shortLabel: "Đế" }
        },
        EGG_DROP: {
            NORMAL_CHANCE: 0.12, // Tỉ lệ rơi trứng thường
            ELITE_CHANCE: 0.34, // Tỉ lệ rơi trứng tinh anh
            NORMAL_COUNT: 1, // Số lượng trứng thường
            ELITE_COUNT: 2 // Số lượng trứng tinh anh
        },
        HATCH: {
            MIN_MANA_COST: 0, // Mana tối thiểu để có thể ấp trứng
            NOTIFY_COLOR: "#79ffd4",
            DEFAULT_DURATION_MS: 14000,
            TIER_DURATION_MS: {
                PHAM: 9000,
                LINH: 12000,
                HUYEN: 15000,
                THIEN: 18000,
                DE: 22000
            },
            SPECIES_DURATION_MS: {
                HUYEN_DIEM_NGA: 20000,
                THON_LINH_TRUNG: 24000
            }
        },
        CARE: {
            FEED_INTERVAL_MS: 30000, // Thời gian giữa các lần cho ăn
            FOOD_PER_INSECT: 1, // Số lượng thức ăn cần thiết cho mỗi con trùng
            STARVATION_DEATH_CHANCE: 0.24, // Tỉ lệ chết đói
            WRONG_HABITAT_DEATH_CHANCE: 0.18, // Tỉ lệ chết do môi trường không phù hợp
            BREED_CHANCE_PER_CYCLE: 0.26, // Tỉ lệ sinh sản mỗi chu kỳ
            MAX_CYCLES_PER_UPDATE: 5, // Số chu kỳ tối đa được xử lý trong một lần cập nhật (giúp giảm lag khi có nhiều trùng)
            ALERT_COOLDOWN_MS: 12000 // Thời gian chờ giữa các lần cảnh báo khi trùng có nguy cơ chết (giúp tránh spam thông báo)
        },
        ATTACK: {
            HIT_INTERVAL_MS: 220, // Thời gian giữa các lần tấn công
            TARGET_RANGE: 220, // Khoảng cách tối đa để bầy trùng có thể tấn công mục tiêu
            BASE_DAMAGE_FACTOR: 0.45, // Hệ số sát thương cơ bản (sát thương thực tế = base damage factor * attack stat của người chơi)
            BONUS_DAMAGE_PER_5: 0.08, // Hệ số sát thương cộng thêm cho mỗi 5 điểm tấn công (sát thương thực tế = base damage factor * attack stat + bonus damage per 5 * floor(attack stat / 5))
            VISUAL_LIMIT: 36, // Giới hạn số lượng hình ảnh trực quan hiển thị
            VISUAL_MIN_RADIUS: 20, // Bán kính tối thiểu của hình ảnh trực quan
            VISUAL_MAX_RADIUS: 74, // Bán kính tối đa của hình ảnh trực quan
            VISUAL_JITTER: 14,              // Độ rung ngẫu nhiên của quỹ đạo bầy trùng
            VISUAL_SPEED_MIN: 0.72, // Tốc độ tối thiểu của bầy trùng
            VISUAL_SPEED_MAX: 1.6,  // Tốc độ tối đa của bầy trùng
            VISUAL_WOBBLE_SPEED_MIN: 0.6, // Tốc độ rung tối thiểu của quỹ đạo bầy trùng
            VISUAL_WOBBLE_SPEED_MAX: 1.35, // Tốc độ rung tối đa của quỹ đạo bầy trùng
            VISUAL_IDLE_ORBIT_SPEED: 1.05,  // Khi không công kích
            VISUAL_ATTACK_ORBIT_SPEED: 1.45,// Khi đang công kích nhưng chưa bám mục tiêu
            VISUAL_TARGET_ORBIT_SPEED: 1.7, // Khi đã bám quanh mục tiêu
            VISUAL_IDLE_FOLLOW_SPEED: 6.2, // Tốc độ bầy trùng di chuyển khi không công kích
            VISUAL_TARGET_FOLLOW_SPEED: 6.8, // Tốc độ bầy trùng di chuyển khi đã bám quanh mục tiêu
            REPRODUCE_ON_KILL_CHANCE: 0.16, // Tỉ lệ sinh sản thêm một con trùng mới khi bầy trùng hiện tại giết được một mục tiêu
            DEATH_ON_HIT_CHANCE: 0.04, // Tỉ lệ chết khi bầy trùng tấn công trúng mục tiêu (do quá sức hoặc phản đòn)
            DEATH_ON_SHIELD_CHANCE: 0.12 // Tỉ lệ chết khi bầy trùng bị chắn bởi khiên hoặc lá chắn (do va chạm hoặc phản đòn)
        },
        ULTIMATE: {
            NAME: "Vạn Trùng Phệ Giới",
            NOTIFY_COLOR: "#ff7bc3",
            DURATION_MS: 7600, // Thời gian hiệu lực của chiêu thức
            HIT_INTERVAL_MS: 150, // Thời gian giữa các lần tấn công
            TARGET_RANGE: 320, // Khoảng cách tối đa để bầy trùng có thể tấn công mục tiêu
            DAMAGE_MULTIPLIER: 1.32, // Hệ số sát thương của chiêu thức (sát thương thực tế = damage multiplier * sát thương cơ bản của bầy trùng)
            STRIKES_PER_SPECIES: 1, // Số lần tấn công tối đa trên mỗi loài trùng trong một lần sử dụng chiêu thức (giúp tăng tính đa dạng của mục tiêu bị tấn công)
            MAX_TARGETS: 5, // Số lượng mục tiêu tối đa có thể bị tấn công trong một lần sử dụng chiêu thức (giúp cân bằng sức mạnh của chiêu thức)
            VISUAL_LIMIT: 48, // Giới hạn số lượng hình ảnh trực quan hiển thị (chiêu thức mạnh hơn nên có thể hiển thị nhiều hơn)
            VISUAL_RADIUS: 118, // Bán kính cố định của hình ảnh trực quan (chiêu thức mạnh hơn nên có bán kính lớn hơn)
            VISUAL_JITTER: 24,             // Độ rung ngẫu nhiên của quỹ đạo bầy trùng (chiêu thức mạnh hơn nên có thể có độ rung lớn hơn)
            REPRODUCE_ON_KILL_CHANCE: 0.2, // Tỉ lệ sinh sản thêm một con trùng mới khi bầy trùng hiện tại giết được một mục tiêu (chiêu thức mạnh hơn nên có tỉ lệ sinh sản cao hơn)
            DEATH_ON_HIT_CHANCE: 0.03, // Tỉ lệ chết khi bầy trùng tấn công trúng mục tiêu (do quá sức hoặc phản đòn) (chiêu thức mạnh hơn nên có tỉ lệ chết thấp hơn)
            DEATH_ON_SHIELD_CHANCE: 0.08 // Tỉ lệ chết khi bầy trùng bị chắn bởi khiên hoặc lá chắn (do va chạm hoặc phản đòn) (chiêu thức mạnh hơn nên có tỉ lệ chết thấp hơn)
        },
        SPECIES: {
            KIEN_THIEN_TINH: {
                rank: 9,
                name: "Kiến Thiên Tinh",
                tier: "THIEN",
                color: "#ffd46a",
                eggColor: "#fff0c3",
                secondaryColor: "#fff2a8",
                auraColor: "#ffb94d",
                imagePath: IMAGE_PATHS.ABERRATIONS.KIEN_THIEN_TINH,
                styleLabel: "Thiên thạch quang đàn",
                styleHint: "Kiến phát sáng, quần thể lao xuống như mưa sao sa.",
                weight: 7,
                attackFactor: 1.28, // Hệ số sát thương của loài trùng này (sát thương thực tế = attack factor * sát thương cơ bản của bầy trùng)
                vitality: 0.84, // Khả năng sống sót của loài trùng này
                fertility: 0.68, // Khả năng sinh sản của loài trùng này
                description: "Thiên trùng mang tinh quang trong giáp xác, hợp thành đàn thì công phạt đồng bộ như mưa sao sa."
            },
            PHE_KIM_TRUNG: {
                rank: 10,
                name: "Phệ Kim Trùng",
                tier: "DE",
                color: "#ffb63f",
                eggColor: "#ffe6a8",
                secondaryColor: "#ffe37c",
                auraColor: "#ff8b2d",
                imagePath: IMAGE_PATHS.ABERRATIONS.PHE_KIM_TRUNG,
                styleLabel: "Kim thực hung trùng",
                styleHint: "Sâu vàng kim loại, bản năng cắn nuốt mọi thứ.",
                weight: 3,
                attackFactor: 1.45,
                vitality: 0.78,
                fertility: 0.52,
                description: "Danh trùng hung danh hiển hách, lấy kim thạch làm thức ăn, bầy lớn đủ sức cắn xuyên linh tài và pháp bảo."
            },
            PHI_THIEN_TU_VAN_HAT: {
                rank: 14,
                name: "Phi Thiên Tử Văn Hạt",
                tier: "HUYEN",
                color: "#b18cff",
                eggColor: "#ebd8ff",
                secondaryColor: "#d3a7ff",
                auraColor: "#7b47ff",
                imagePath: IMAGE_PATHS.ABERRATIONS.PHI_THIEN_TU_VAN_HAT,
                styleLabel: "Tử độc phi hạt",
                styleHint: "Bọ cạp có cánh, tím độc, tốc độ cực nhanh.",
                weight: 12,
                attackFactor: 1.12,
                vitality: 0.92,
                fertility: 0.82,
                description: "Dị hạt thân nhỏ nhưng linh mẫn dị thường, đuôi độc tím văn có thể liên tục bám theo khí cơ của con mồi."
            },
            HUYET_NGOC_TRI_CHU: {
                rank: 16,
                name: "Huyết Ngọc Tri Chu",
                tier: "LINH",
                color: "#ff6f8f",
                eggColor: "#ffd6df",
                secondaryColor: "#ffb7c5",
                auraColor: "#9f173f",
                imagePath: IMAGE_PATHS.ABERRATIONS.HUYET_NGOC_TRI_CHU,
                styleLabel: "Huyết ngọc yêu chu",
                styleHint: "Nhện đỏ trong suốt, cảm giác ngọc và máu hòa làm một.",
                weight: 18,
                attackFactor: 1,
                vitality: 1,
                fertility: 0.9,
                description: "Linh chu toàn thân đỏ như ngọc máu, giỏi dệt tơ khóa mục tiêu rồi rút sinh cơ từng chút một."
            },
            HUYEN_DIEM_NGA: {
                rank: 17,
                name: "Huyễn Diệm Nga",
                tier: "PHAM",
                color: "#ff96d7",
                eggColor: "#ffe0f3",
                secondaryColor: "#88ffe5",
                auraColor: "#b681ff",
                imagePath: IMAGE_PATHS.ABERRATIONS.HUYEN_DIEM_NGA,
                styleLabel: "Huyễn hỏa điệp ảnh",
                styleHint: "Bướm phát hỏa, phủ quanh là huyền quang huyễn thuật.",
                weight: 24,
                attackFactor: 0.85,
                vitality: 1.1,
                fertility: 1.05,
                description: "Yêu nga cánh mỏng mang huyễn hỏa nhàn sắc, thường dùng để quấy nhiễu thần thức và bủa mây mê hoặc đối thủ."
            },
            KIM_TAM: {
                rank: "Không rõ",
                name: "Kim Tằm",
                tier: "LINH",
                color: "#ffe066",
                eggColor: "#fff3b0",
                secondaryColor: "#fff0c2",
                auraColor: "#d7a41d",
                styleLabel: "Kim tàm cổ chủng",
                styleHint: "Tằm vàng, mang hơi hướng cổ trùng và ký sinh.",
                weight: 6,
                attackFactor: 1.05,
                vitality: 0.95,
                fertility: 0.6,
                description: "Cổ trùng dạng tằm, có thể ký sinh và âm thầm thôn phệ linh lực, cực kỳ nguy hiểm trong ám toán."
            },
            THIET_HOA_NGHI: {
                rank: "Không rõ",
                name: "Thiết Hỏa Nghĩ",
                tier: "PHAM",
                color: "#ff9a43",
                eggColor: "#ffd6a5",
                secondaryColor: "#ffc86d",
                auraColor: "#ff5d2a",
                imagePath: IMAGE_PATHS.ABERRATIONS.THIET_HOA_NGHI,
                styleLabel: "Thiết hỏa quần nghĩ",
                styleHint: "Kiến lửa bọc kim loại, số đông và nóng rực.",
                weight: 2,
                attackFactor: 0.9,
                vitality: 0.85,
                fertility: 1.2,
                description: "Kiến lửa thân kim loại, số lượng đông đảo, có thể tự bạo hoặc thiêu đốt mục tiêu."
            },
            KIM_GIAP_HAT: {
                rank: "Không rõ",
                name: "Kim Giáp Hạt",
                tier: "LINH",
                color: "#d4af37",
                eggColor: "#f7e7a1",
                secondaryColor: "#ffe38a",
                auraColor: "#b88716",
                imagePath: IMAGE_PATHS.ABERRATIONS.KIM_GIAP_HAT,
                styleLabel: "Kim giáp chiến hạt",
                styleHint: "Bọ cạp giáp vàng, thiên hướng tank và cứng cáp.",
                weight: 10,
                attackFactor: 1.1,
                vitality: 1.2,
                fertility: 0.7,
                description: "Bọ cạp giáp vàng, phòng ngự cực mạnh, đuôi chứa kịch độc, thiên về cận chiến."
            },
            HUYET_THUC_NGHI: {
                rank: "Không rõ",
                name: "Huyết Thực Nghĩ",
                tier: "HUYEN",
                color: "#ff475f",
                eggColor: "#ff9aaa",
                secondaryColor: "#ffb0bc",
                auraColor: "#8f0018",
                imagePath: IMAGE_PATHS.ABERRATIONS.HUYET_THUC_NGHI,
                styleLabel: "Huyết thực sát nghĩ",
                styleHint: "Kiến đỏ máu, hung tàn và càng giết càng mạnh.",
                weight: 3,
                attackFactor: 1.15,
                vitality: 0.9,
                fertility: 1.3,
                description: "Kiến hút máu, nuốt sinh linh để tăng trưởng, càng giết càng mạnh."
            },
            BANG_TAM: {
                rank: "Không rõ",
                name: "Băng Tằm",
                tier: "LINH",
                color: "#aeefff",
                eggColor: "#dff9ff",
                secondaryColor: "#f0fdff",
                auraColor: "#7dd4ff",
                imagePath: IMAGE_PATHS.ABERRATIONS.BANG_TAM,
                styleLabel: "Hàn tơ băng tằm",
                styleHint: "Tằm băng, tỏa ra aura lạnh và âm hàn.",
                weight: 5,
                attackFactor: 0.95,
                vitality: 1.05,
                fertility: 0.75,
                description: "Tằm mang hàn khí, có thể đóng băng linh lực và làm chậm mọi chuyển động xung quanh."
            },
            LUC_DUC_SUONG_CONG: {
                rank: "Không rõ",
                name: "Lục Dực Sương Công",
                tier: "HUYEN",
                color: "#9ae9ff",
                eggColor: "#e9fbff",
                secondaryColor: "#d7f8ff",
                auraColor: "#5ebfff",
                imagePath: IMAGE_PATHS.ABERRATIONS.LUC_DUC_SUONG_CONG,
                styleLabel: "Lục dực hàn công",
                styleHint: "Sáu cánh chở sương, lượn tới đâu hàn vụ phủ tới đó.",
                weight: 8,
                attackFactor: 1.14,
                vitality: 0.92,
                fertility: 0.74,
                description: "Dị công sáu cánh mang hàn vụ và sương độc. Khi nhập đàn sẽ kéo băng vụ khóa thân pháp mục tiêu rồi rỉa dần sinh cơ."
            },
            THON_LINH_TRUNG: {
                rank: "Không rõ",
                name: "Thôn Linh Trùng",
                tier: "LINH",
                color: "#c9d5ff",
                eggColor: "#eef3ff",
                secondaryColor: "#ffffff",
                auraColor: "#7f92ff",
                styleLabel: "Phệ linh vi trùng",
                styleHint: "Trùng nhỏ li ti, chuyên hút và ăn mòn năng lượng.",
                weight: 1,
                attackFactor: 0.8,
                vitality: 0.7,
                fertility: 1.4,
                description: "Dị trùng chuyên thôn phệ linh khí, thường xuất hiện trong môi trường linh lực dày đặc."
            }
        }
    },
    SPIRIT_STONE: {
        CHANCE: 0.35, // Tỉ lệ rơi linh thạch khi đánh quái
        ELITE_CHANCE: 1.0, // Tỉ lệ rơi linh thạch khi đánh quái tinh anh
        COLLECT_DELAY_MS: 500, // Thời gian chờ giữa các lần thu thập linh thạch (giúp tránh spam thu thập)
        MAGNET_SPEED: 16, // Tốc độ di chuyển của linh thạch khi bị hút
        TRAIL_LENGTH: 12, // Số lượng điểm trong vệt sáng của linh thạch khi di chuyển
        STARTING_COUNTS: {
            LOW: 400,     // Số lượng hạ phẩm linh thạch ban đầu để dev test nhanh
            MEDIUM: 200,   // Số lượng trung phẩm linh thạch ban đầu
            HIGH: 100,     // Số lượng thượng phẩm linh thạch ban đầu
            SUPREME: 50   // Số lượng cực phẩm linh thạch ban đầu
        },
        DROP_COUNT: {
            NORMAL: 1, // Số lượng linh thạch rơi ra khi đánh quái thường
            ELITE: 2 // Số lượng linh thạch rơi ra khi đánh quái tinh anh
        },
        QUALITY_RATES: {
            NORMAL: { LOW: 0.84, MEDIUM: 0.13, HIGH: 0.028, SUPREME: 0.002 }, // Tỉ lệ rơi theo chất lượng khi đánh quái thường
            ELITE: { LOW: 0.44, MEDIUM: 0.36, HIGH: 0.16, SUPREME: 0.04 } // Tỉ lệ rơi theo chất lượng khi đánh quái tinh anh
        },
        TYPES: {
            LOW: { label: "Hạ phẩm linh thạch", shortLabel: "Hạ phẩm", value: 1, color: "#62f0d9", radius: 4.5 }, // Thông tin hiển thị và giá trị của linh thạch hạ phẩm
            MEDIUM: { label: "Trung phẩm linh thạch", shortLabel: "Trung phẩm", value: 100, color: "#59b6ff", radius: 5.5 }, // Thông tin hiển thị và giá trị của linh thạch trung phẩm
            HIGH: { label: "Thượng phẩm linh thạch", shortLabel: "Thượng phẩm", value: 10000, color: "#b78cff", radius: 6.5 }, // Thông tin hiển thị và giá trị của linh thạch thượng phẩm
            SUPREME: { label: "Cực phẩm linh thạch", shortLabel: "Cực phẩm", value: 1000000, color: "#ffd76f", radius: 7.5 } // Thông tin hiển thị và giá trị của linh thạch cực phẩm
        }
    }
};
CONFIG.ENEMY.MAX_SHIELD_CRACK_LINES = 48; // Số lượng đường nứt tối đa trên khiên hoặc lá chắn của quái vật (giúp cân bằng hiệu ứng nứt khi có nhiều đòn đánh liên tiếp)
CONFIG.ENEMY.MAX_SHIELD_CRACK_RINGS = 4; // Số lượng vòng nứt tối đa trên khiên hoặc lá chắn của quái vật

// <!-- Create By: Vũ Hoài Nam -->
