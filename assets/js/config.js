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
        COUNT: 72,              // Tổng số lượng kiếm tối đa
        BASE_RADIUS: 150,       // Khoảng cách từ tâm đến lớp kiếm đầu tiên
        LAYER_SPACING: 70,      // Khoảng cách giữa các lớp kiếm (vòng trong - vòng ngoài)
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
        ATTACK_DELAY_VAR: { BASE: 6, RAND: 10 },  // Độ trễ ngẫu nhiên giữa các lần phóng kiếm
        FRAGMENTS: {            // Hiệu ứng mảnh vỡ khi kiếm gãy
            LIFE_TIME: 2000,    // Thời gian tồn tại của mảnh vỡ
            FADE_TIME: 1000     // Thời gian mờ dần trước khi mất tích
        },
    },
    ULTIMATE: {
        MAX_RAGE: 100,      // Giới hạn nộ đầy
        GAIN_PER_KILL: 2,   // Lượng nộ nhận được mỗi khi hạ 1 quái
        DURATION_MS: 10000, // Thời gian duy trì trạng thái ultimate
        TRANSITION_MS: 1000, // Thời gian hợp kiếm hoặc tách kiếm
        CHARGE_STEPS: 10,   // Số nấc hiển thị tiến độ nộ trên nút ultimate
    },
    INPUT: {
        JOYSTICK_CURSOR_SPEED: 0.10, // Hệ số độ nhạy/tốc độ con trỏ khi điều khiển bằng joystick mobile
        DOUBLE_TAP_DELAY: 300   // Khoảng cách tối đa giữa 2 lần chạm để tính là double tap
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
            MIN_ID: 1,
            MAX_ID: 45
        },
        SHIELD_CHANCE: 0.3,                         // Tỉ lệ quái sinh ra có khiên (0.3 = 30%)
        SHIELD_COLOR: "rgba(100, 200, 255, 0.4)", // Màu lõi khiên
        SHIELD_LINE: "#80dfff",                     // Màu nét vẽ vết nứt khiên
        SHIELD_HP_RATIO: 0.1,                       // 0.1 tương đương 10% máu quái
        RECOVERY_DELAY_MS: 3000,                    // Thời gian chờ sau khi bị tấn công trước khi bắt đầu hồi phục khiên
        RECOVERY_SPEED_PER_SEC: 0.05,               // Tốc độ hồi phục khiên mỗi giây (0.05 = 5% HP khiên mỗi giây)
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
            "./assets/images/animals/ammonite.svg",
            "./assets/images/animals/angel-wings.svg",
            "./assets/images/animals/angler-fish.svg",
            "./assets/images/animals/angular-spider.svg",
            "./assets/images/animals/animal-skull.svg",
            "./assets/images/animals/ant.svg",
            "./assets/images/animals/bear.svg",
            "./assets/images/animals/bee.svg",
            "./assets/images/animals/cat-kitty.svg",
            "./assets/images/animals/cat.svg",
            "./assets/images/animals/crab.svg",
            "./assets/images/animals/crocodile.svg",
            "./assets/images/animals/deer.svg",
            "./assets/images/animals/double-dragon.svg",
            "./assets/images/animals/dragon.svg",
            "./assets/images/animals/elephant.svg",
            "./assets/images/animals/fish-seafood.svg",
            "./assets/images/animals/flying-dragon.svg",
            "./assets/images/animals/fox.svg",
            "./assets/images/animals/gorilla.svg",
            "./assets/images/animals/hydra.svg",
            "./assets/images/animals/jelly-fish.svg",
            "./assets/images/animals/lion.svg",
            "./assets/images/animals/maggot.svg",
            "./assets/images/animals/minotaur.svg",
            "./assets/images/animals/monkey.svg",
            "./assets/images/animals/octopus.svg",
            "./assets/images/animals/perana.svg",
            "./assets/images/animals/rabbit.svg",
            "./assets/images/animals/shark.svg",
            "./assets/images/animals/snail-crawl.svg",
            "./assets/images/animals/squid.svg",
            "./assets/images/animals/squirrel.svg",
            "./assets/images/animals/tapir.svg",
            "./assets/images/animals/three-headed-dragon.svg",
            "./assets/images/animals/tiger.svg",
            "./assets/images/animals/turtle.svg",
            "./assets/images/animals/whale-tail.svg",
            "./assets/images/animals/whale.svg",
            "./assets/images/animals/wolf.svg",
        ]
    },
    ITEMS: {
        INVENTORY_MIN_SLOTS: 16, // Số ô tối thiểu luôn hiển thị trong Túi không gian
        INVENTORY_BASE_CAPACITY: 16,
        SELLBACK_RATIO: 0.5,
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
        MAX_BREAKTHROUGH_CHANCE: 0.99, // Tỉ lệ đột phá tối đa tôi đang để là 99% (luôn có 1% rủi ro để tăng độ kịch tính)
        BREAKTHROUGH_PENALTY_FACTOR: 0.4, // Hệ số mất tu vi khi đột phá thất bại (40%)
        OVERFLOW_LIMIT: 1.2,              // Giới hạn tràn exp (120% lượng exp cần thiết)
        MAJOR_REALMS: [
            { key: "LUYEN_KHI", name: "Luyện khí", startId: 1, endId: 13, nextKey: "TRUC_CO", nextName: "Trúc cơ" },
            { key: "TRUC_CO", name: "Trúc cơ", startId: 14, endId: 17, nextKey: "KET_DAN", nextName: "Kết đan" },
            { key: "KET_DAN", name: "Kết đan", startId: 18, endId: 21, nextKey: "NGUYEN_ANH", nextName: "Nguyên anh" },
            { key: "NGUYEN_ANH", name: "Nguyên anh", startId: 22, endId: 25, nextKey: "HOA_THAN", nextName: "Hóa thần" },
            { key: "HOA_THAN", name: "Hóa thần", startId: 26, endId: 29, nextKey: "LUYEN_HU", nextName: "Luyện hư" },
            { key: "LUYEN_HU", name: "Luyện hư", startId: 30, endId: 33, nextKey: "HOP_THE", nextName: "Hợp thể" },
            { key: "HOP_THE", name: "Hợp thể", startId: 34, endId: 37, nextKey: "DAI_THUA", nextName: "Đại thừa" },
            { key: "DAI_THUA", name: "Đại thừa", startId: 38, endId: 41, nextKey: "CHAN_TIEN", nextName: "Chân tiên" },
            { key: "CHAN_TIEN", name: "Chân tiên", startId: 42, endId: 45, nextKey: null, nextName: null }
        ],
        RANKS: [
            // --- NHÂN GIỚI ---
            // Luyện Khí Kỳ (Xanh lá)
            { id: 1, name: "Luyện khí sơ kỳ (Tầng 1)", exp: 5, expGive: 1, chance: 1, swordDurability: 3, damage: 1, hp: 1000, maxMana: 10, color: "#4CAF50", lightColor: "#A5D6A7" },
            { id: 2, name: "Luyện khí sơ kỳ (Tầng 2)", exp: 6, expGive: 1, chance: 0.95, swordDurability: 4, damage: 2, hp: 1100, maxMana: 15, color: "#4CAF50", lightColor: "#A5D6A7" },
            { id: 3, name: "Luyện khí sơ kỳ (Tầng 3)", exp: 7, expGive: 1, chance: 0.95, swordDurability: 5, damage: 3, hp: 1200, maxMana: 20, color: "#4CAF50", lightColor: "#A5D6A7" },
            { id: 4, name: "Luyện khí sơ kỳ (Tầng 4)", exp: 9, expGive: 2, chance: 0.95, swordDurability: 6, damage: 4, hp: 1300, maxMana: 25, color: "#4CAF50", lightColor: "#A5D6A7" },
            { id: 5, name: "Luyện khí trung kỳ (Tầng 5)", exp: 12, expGive: 2, chance: 0.9, swordDurability: 7, damage: 5, hp: 1400, maxMana: 30, color: "#43A047", lightColor: "#C8E6C9" },
            { id: 6, name: "Luyện khí trung kỳ (Tầng 6)", exp: 16, expGive: 3, chance: 0.9, swordDurability: 8, damage: 6, hp: 1500, maxMana: 35, color: "#43A047", lightColor: "#C8E6C9" },
            { id: 7, name: "Luyện khí trung kỳ (Tầng 7)", exp: 21, expGive: 4, chance: 0.9, swordDurability: 9, damage: 7, hp: 1600, maxMana: 40, color: "#43A047", lightColor: "#C8E6C9" },
            { id: 8, name: "Luyện khí trung kỳ (Tầng 8)", exp: 27, expGive: 5, chance: 0.9, swordDurability: 10, damage: 8, hp: 1700, maxMana: 45, color: "#43A047", lightColor: "#C8E6C9" },
            { id: 9, name: "Luyện khí hậu kỳ (Tầng 9)", exp: 35, expGive: 7, chance: 0.85, swordDurability: 11, damage: 9, hp: 1800, maxMana: 50, color: "#2E7D32", lightColor: "#E8F5E9" },
            { id: 10, name: "Luyện khí hậu kỳ (Tầng 10)", exp: 45, expGive: 9, chance: 0.85, swordDurability: 12, damage: 10, hp: 1900, maxMana: 55, color: "#2E7D32", lightColor: "#E8F5E9" },
            { id: 11, name: "Luyện khí hậu kỳ (Tầng 11)", exp: 58, expGive: 12, chance: 0.85, swordDurability: 13, damage: 11, hp: 2000, maxMana: 60, color: "#2E7D32", lightColor: "#E8F5E9" },
            { id: 12, name: "Luyện khí hậu kỳ (Tầng 12)", exp: 75, expGive: 15, chance: 0.8, swordDurability: 14, damage: 12, hp: 2100, maxMana: 65, color: "#2E7D32", lightColor: "#E8F5E9" },
            { id: 13, name: "Luyện khí đại viên mãn (Tầng 13)", exp: 100, expGive: 20, chance: 0.75, swordDurability: 15, damage: 13, hp: 2200, maxMana: 70, bonus: 100, color: "#1B5E20", lightColor: "#FFFFFF" },

            // Trúc Cơ Kỳ (Xanh dương)
            { id: 14, name: "Trúc cơ sơ kỳ", exp: 120, expGive: 25, chance: 0.7, swordDurability: 16, damage: 14, hp: 2300, maxMana: 75, color: "#2196F3", lightColor: "#90CAF9" },
            { id: 15, name: "Trúc cơ trung kỳ", exp: 180, expGive: 35, chance: 0.65, swordDurability: 17, damage: 15, hp: 2400, maxMana: 80, color: "#1E88E5", lightColor: "#BBDEFB" },
            { id: 16, name: "Trúc cơ hậu kỳ", exp: 270, expGive: 50, chance: 0.6, swordDurability: 18, damage: 16, hp: 2500, maxMana: 85, color: "#1565C0", lightColor: "#E3F2FD" },
            { id: 17, name: "Trúc cơ đại viên mãn", exp: 400, expGive: 80, chance: 0.55, swordDurability: 19, damage: 17, hp: 2600, maxMana: 90, bonus: 300, color: "#0D47A1", lightColor: "#FFFFFF" },

            // Kết Đan Kỳ (Cam)
            { id: 18, name: "Kết đan sơ kỳ", exp: 600, expGive: 120, chance: 0.5, swordDurability: 20, damage: 18, hp: 2700, maxMana: 95, color: "#FF9800", lightColor: "#FFCC80" },
            { id: 19, name: "Kết đan trung kỳ", exp: 900, expGive: 180, chance: 0.45, swordDurability: 21, damage: 19, hp: 2800, maxMana: 100, color: "#FB8C00", lightColor: "#FFE0B2" },
            { id: 20, name: "Kết đan hậu kỳ", exp: 1400, expGive: 280, chance: 0.4, swordDurability: 22, damage: 20, hp: 2900, maxMana: 105, color: "#EF6C00", lightColor: "#FFF3E0" },
            { id: 21, name: "Kết đan đại viên mãn", exp: 2000, expGive: 400, chance: 0.35, swordDurability: 23, damage: 21, hp: 3000, maxMana: 110, bonus: 1500, color: "#E65100", lightColor: "#FFFFFF" },

            // Nguyên Anh Kỳ (Hồng)
            { id: 22, name: "Nguyên anh sơ kỳ", exp: 3000, expGive: 600, chance: 0.35, swordDurability: 24, damage: 22, hp: 3100, maxMana: 105, color: "#E91E63", lightColor: "#F48FB1" },
            { id: 23, name: "Nguyên anh trung kỳ", exp: 5000, expGive: 1000, chance: 0.3, swordDurability: 25, damage: 23, hp: 3200, maxMana: 120, color: "#D81B60", lightColor: "#F8BBD0" },
            { id: 24, name: "Nguyên anh hậu kỳ", exp: 8000, expGive: 1600, chance: 0.25, swordDurability: 26, damage: 24, hp: 3300, maxMana: 125, color: "#C2185B", lightColor: "#FCE4EC" },
            { id: 25, name: "Nguyên anh đại viên mãn", exp: 12000, expGive: 2500, chance: 0.2, swordDurability: 27, damage: 25, hp: 3400, maxMana: 130, bonus: 8000, color: "#880E4F", lightColor: "#FFFFFF" },

            // Hóa Thần Kỳ (Tím)
            { id: 26, name: "Hóa thần sơ kỳ", exp: 18000, expGive: 3600, chance: 0.2, swordDurability: 28, damage: 26, hp: 3500, maxMana: 135, color: "#9C27B0", lightColor: "#CE93D8" },
            { id: 27, name: "Hóa thần trung kỳ", exp: 25000, expGive: 5000, chance: 0.18, swordDurability: 29, damage: 27, hp: 3600, maxMana: 140, color: "#8E24AA", lightColor: "#E1BEE7" },
            { id: 28, name: "Hóa thần hậu kỳ", exp: 35000, expGive: 7000, chance: 0.15, swordDurability: 30, damage: 28, hp: 3700, maxMana: 145, color: "#7B1FA2", lightColor: "#F3E5F5" },
            { id: 29, name: "Hóa thần đại viên mãn", exp: 50000, expGive: 10000, chance: 0.12, swordDurability: 31, damage: 29, hp: 3800, maxMana: 150, bonus: 25000, color: "#4A148C", lightColor: "#FFFFFF" },

            // --- LINH GIỚI ---
            // Luyện Hư Kỳ (Chàm)
            { id: 30, name: "Luyện hư sơ kỳ", exp: 60000, expGive: 12000, chance: 0.12, swordDurability: 32, damage: 30, hp: 3900, maxMana: 155, color: "#3F51B5", lightColor: "#9FA8DA" },
            { id: 31, name: "Luyện hư trung kỳ", exp: 80000, expGive: 16000, chance: 0.1, swordDurability: 33, damage: 31, hp: 4000, maxMana: 160, color: "#3949AB", lightColor: "#C5CAE9" },
            { id: 32, name: "Luyện hư hậu kỳ", exp: 110000, expGive: 22000, chance: 0.09, swordDurability: 34, damage: 32, hp: 4100, maxMana: 165, color: "#303F9F", lightColor: "#E8EAF6" },
            { id: 33, name: "Luyện hư đại viên mãn", exp: 150000, expGive: 30000, chance: 0.08, swordDurability: 35, damage: 33, hp: 4200, maxMana: 170, bonus: 30000, color: "#1A237E", lightColor: "#FFFFFF" },

            // Hợp Thể Kỳ (Xanh ngọc)
            { id: 34, name: "Hợp thể sơ kỳ", exp: 140000, expGive: 28000, chance: 0.08, swordDurability: 36, damage: 34, hp: 4300, maxMana: 175, color: "#00BCD4", lightColor: "#80DEEA" },
            { id: 35, name: "Hợp thể trung kỳ", exp: 180000, expGive: 36000, chance: 0.07, swordDurability: 37, damage: 35, hp: 4400, maxMana: 180, color: "#00ACC1", lightColor: "#B2EBF2" },
            { id: 36, name: "Hợp thể hậu kỳ", exp: 230000, expGive: 46000, chance: 0.06, swordDurability: 38, damage: 36, hp: 4500, maxMana: 185, color: "#0097A7", lightColor: "#E0F7FA" },
            { id: 37, name: "Hợp thể đại viên mãn", exp: 300000, expGive: 60000, chance: 0.05, swordDurability: 39, damage: 37, hp: 4600, maxMana: 190, bonus: 50000, color: "#006064", lightColor: "#FFFFFF" },

            // Đại Thừa Kỳ (Đỏ)
            { id: 38, name: "Đại thừa sơ kỳ", exp: 300000, expGive: 60000, chance: 0.05, swordDurability: 40, damage: 38, hp: 4700, maxMana: 195, color: "#F44336", lightColor: "#EF9A9A" },
            { id: 39, name: "Đại thừa trung kỳ", exp: 380000, expGive: 76000, chance: 0.04, swordDurability: 41, damage: 39, hp: 4800, maxMana: 200, color: "#E53935", lightColor: "#FFCDD2" },
            { id: 40, name: "Đại thừa hậu kỳ", exp: 480000, expGive: 96000, chance: 0.03, swordDurability: 42, damage: 40, hp: 4900, maxMana: 205, color: "#D32F2F", lightColor: "#FFEBEE" },
            { id: 41, name: "Đại thừa đại viên mãn", exp: 600000, expGive: 120000, chance: 0.02, swordDurability: 43, damage: 41, hp: 5000, maxMana: 210, bonus: 80000, color: "#B71C1C", lightColor: "#FFFFFF" },

            // --- TIÊN GIỚI ---
            // Chân Tiên (Vàng kim)
            { id: 42, name: "Chân tiên sơ kỳ", exp: 600000, expGive: 120000, chance: 0.02, swordDurability: 44, damage: 42, hp: 5100, maxMana: 215, color: "#FFD700", lightColor: "#FFF59D" },
            { id: 43, name: "Chân tiên trung kỳ", exp: 750000, expGive: 150000, chance: 0.015, swordDurability: 49, damage: 43, hp: 5200, maxMana: 220, color: "#FFC107", lightColor: "#FFF9C4" },
            { id: 44, name: "Chân tiên hậu kỳ", exp: 950000, expGive: 190000, chance: 0.01, swordDurability: 46, damage: 44, hp: 5500, maxMana: 225, color: "#FFA000", lightColor: "#FFFDE7" },
            { id: 45, name: "Chân tiên đại viên mãn", exp: 999999999, expGive: 0, chance: 0, swordDurability: 9999, damage: 9999, hp: 99999, maxMana: 9999, color: "#FF8F00", lightColor: "#FFFFFF" }
        ]
    },
    PILL: {
        CHANCE: 0.15,               // Tỉ lệ rơi mặc định (15%)
        ELITE_CHANCE: 1.0,          // Tỉ lệ rơi của quái Tinh Anh (100%)
        COLLECT_DELAY_MS: 600,      // Thời gian chờ trước khi bay về người chơi
        MAGNET_SPEED: 14,           // Tốc độ bay về phía người chơi
        TRAIL_LENGTH: 15,           // Độ dài vệt sáng (số lượng node)
        DROP_RATES: {
            NORMAL: { LOW: 0.85, MEDIUM: 0.10, HIGH: 0.05 },  // Quái thường: 85% Hạ, 10% Trung, 5% Thượng
            ELITE: { LOW: 0.10, MEDIUM: 0.60, HIGH: 0.30 }   // Tinh Anh: 10% Hạ, 60% Trung, 30% Thượng
        },
        DROP_COUNT: {
            NORMAL: 1,  // Quái thường rơi 1 viên
            ELITE: 3    // Tinh Anh rơi 3 viên
        },
        TYPES: {
            LOW: { name: "Hạ phẩm", boost: 0.02, color: "#00ffcc", radius: 4 },
            MEDIUM: { name: "Trung phẩm", boost: 0.05, color: "#00aaff", radius: 5.5 },
            HIGH: { name: "Thượng phẩm", boost: 0.12, color: "#ffcc00", radius: 7.5 }
        },
    },
    PILL: {
        CHANCE: 0.08,
        ELITE_CHANCE: 0.65,
        COLLECT_DELAY_MS: 600,
        MAGNET_SPEED: 14,
        TRAIL_LENGTH: 15,
        DROP_COUNT: {
            NORMAL: 1,
            ELITE: 2
        },
        CATEGORY_SORT: {
            EXP: 0,
            INSIGHT: 1,
            BREAKTHROUGH: 2,
            ATTACK: 3,
            SHIELD_BREAK: 4,
            BERSERK: 5,
            RAGE: 6,
            MANA: 7,
            MAX_MANA: 8,
            REGEN: 9,
            SPEED: 10,
            FORTUNE: 11,
            SPECIAL: 12
        },
        CATEGORY_RATES: {
            NORMAL: { EXP: 0.17, INSIGHT: 0.07, BREAKTHROUGH: 0.10, ATTACK: 0.12, SHIELD_BREAK: 0.05, BERSERK: 0.06, RAGE: 0.09, MANA: 0.08, MAX_MANA: 0.07, REGEN: 0.06, SPEED: 0.08, FORTUNE: 0.05 },
            ELITE: { EXP: 0.12, INSIGHT: 0.05, BREAKTHROUGH: 0.14, ATTACK: 0.14, SHIELD_BREAK: 0.08, BERSERK: 0.10, RAGE: 0.08, MANA: 0.07, MAX_MANA: 0.06, REGEN: 0.06, SPEED: 0.07, FORTUNE: 0.03 }
        },
        QUALITY_RATES: {
            NORMAL: { LOW: 0.72, MEDIUM: 0.20, HIGH: 0.07, SUPREME: 0.01 },
            ELITE: { LOW: 0.28, MEDIUM: 0.42, HIGH: 0.22, SUPREME: 0.08 }
        },
        EXP_QUALITIES: {
            LOW: { label: "Hạ phẩm", fullName: "Thanh Linh Tụ Khí Đan", expFactor: 0.05, color: "#69f0cb", radius: 4.5, buyPriceLowStone: 30 },
            MEDIUM: { label: "Trung phẩm", fullName: "Bích Hải Tụ Linh Đan", expFactor: 0.12, color: "#53b9ff", radius: 5.5, buyPriceLowStone: 140 },
            HIGH: { label: "Thượng phẩm", fullName: "Kim Tủy Dưỡng Nguyên Đan", expFactor: 0.24, color: "#ffd86b", radius: 6.5, buyPriceLowStone: 900 },
            SUPREME: { label: "Cực phẩm", fullName: "Thiên Hoa Uẩn Mạch Đan", expFactor: 0.40, color: "#ff7ad9", radius: 7.5, buyPriceLowStone: 5600 }
        },
        INSIGHT_QUALITIES: {
            LOW: { fullName: "Minh Tâm Ngộ Đạo Đan", expGainPct: 0.06, color: "#c2f970", radius: 4.5, buyPriceLowStone: 110 },
            MEDIUM: { fullName: "Thông Huyền Khai Ngộ Đan", expGainPct: 0.14, color: "#a5e65d", radius: 5.5, buyPriceLowStone: 520 },
            HIGH: { fullName: "Thiên Cơ Minh Đạo Đan", expGainPct: 0.28, color: "#d6ff7f", radius: 6.5, buyPriceLowStone: 2600 },
            SUPREME: { fullName: "Vạn Tượng Tri Kiến Đan", expGainPct: 0.45, color: "#f3ff9a", radius: 7.5, buyPriceLowStone: 14000 }
        },
        BREAKTHROUGH_QUALITIES: {
            LOW: { label: "Hạ phẩm", breakthroughBoost: 0.03, color: "#78f2ff", radius: 4.5, buyPriceLowStone: 80 },
            MEDIUM: { label: "Trung phẩm", breakthroughBoost: 0.07, color: "#79a8ff", radius: 5.5, buyPriceLowStone: 450 },
            HIGH: { label: "Thượng phẩm", breakthroughBoost: 0.13, color: "#c88fff", radius: 6.5, buyPriceLowStone: 2600 },
            SUPREME: { label: "Cực phẩm", breakthroughBoost: 0.22, color: "#ffe08f", radius: 7.5, buyPriceLowStone: 16000 }
        },
        ATTACK_QUALITIES: {
            LOW: { fullName: "Thanh Mộc Trảm Linh Đan", attackPct: 0.06, color: "#7fffd4", radius: 4.5, buyPriceLowStone: 90 },
            MEDIUM: { fullName: "Kim Tủy Phạt Mạch Đan", attackPct: 0.12, color: "#7dc7ff", radius: 5.5, buyPriceLowStone: 480 },
            HIGH: { fullName: "Liệt Dương Bá Thể Đan", attackPct: 0.22, color: "#ff9d6d", radius: 6.5, buyPriceLowStone: 2800 },
            SUPREME: { fullName: "Thái Huyền Tru Ma Đan", attackPct: 0.38, color: "#ffd36b", radius: 7.5, buyPriceLowStone: 16800 }
        },
        SHIELD_BREAK_QUALITIES: {
            LOW: { fullName: "Toái Giáp Phá Cấm Đan", shieldBreakPct: 0.18, color: "#9bf6ff", radius: 4.5, buyPriceLowStone: 100 },
            MEDIUM: { fullName: "Liệt Khiên Xuyên Mạch Đan", shieldBreakPct: 0.34, color: "#6ad7ff", radius: 5.5, buyPriceLowStone: 480 },
            HIGH: { fullName: "Thiên Sát Toái Thuẫn Đan", shieldBreakPct: 0.58, color: "#5ca8ff", radius: 6.5, buyPriceLowStone: 2500 },
            SUPREME: { fullName: "Hư Không Phá Giới Đan", shieldBreakPct: 0.90, color: "#7f8cff", radius: 7.5, buyPriceLowStone: 15000 }
        },
        BERSERK_QUALITIES: {
            LOW: { fullName: "Nhiên Huyết Cuồng Sát Đan", attackPct: 1.2, durationMs: 12000, auraMode: "berserk", sideManaLoss: 25, color: "#ff6b6b", radius: 5.2, buyPriceLowStone: 260 },
            MEDIUM: { fullName: "Phệ Linh Bạo Khí Đan", attackPct: 1.55, durationMs: 14000, auraMode: "berserk", sideMaxManaFlat: -15, color: "#ff7f50", radius: 6.0, buyPriceLowStone: 760 },
            HIGH: { fullName: "Trầm Mạch Thiên Sát Đan", attackPct: 1.9, durationMs: 16000, auraMode: "berserk", sideSpeedPct: -0.22, color: "#ff5349", radius: 6.8, buyPriceLowStone: 2100 },
            SUPREME: { fullName: "Nghịch Nguyên Thiêu Huyết Đan", attackPct: 2.35, durationMs: 18000, auraMode: "berserk", sideExpLossRatio: 0.18, color: "#ff2d55", radius: 7.8, buyPriceLowStone: 4800 }
        },
        RAGE_QUALITIES: {
            LOW: { fullName: "Chiến Ý Ngưng Hỏa Đan", rageGain: 25, color: "#ff9f43", radius: 4.5, buyPriceLowStone: 60 },
            MEDIUM: { fullName: "Liệt Tâm Nhiên Mạch Đan", rageGain: 50, color: "#ff7f50", radius: 5.5, buyPriceLowStone: 220 },
            HIGH: { fullName: "Sát Phạt Tụ Ý Đan", rageGain: 80, color: "#ff5b6e", radius: 6.5, buyPriceLowStone: 980 },
            SUPREME: { fullName: "Thiên Ma Chiến Hồn Đan", rageGain: 100, color: "#ff3366", radius: 7.5, buyPriceLowStone: 2800 }
        },
        MANA_QUALITIES: {
            LOW: { fullName: "Hồi Nguyên Bổ Khí Đan", manaRestore: 20, color: "#6de0ff", radius: 4.5, buyPriceLowStone: 40 },
            MEDIUM: { fullName: "Bích Lộ Hồi Linh Đan", manaRestore: 45, color: "#4fc3f7", radius: 5.5, buyPriceLowStone: 170 },
            HIGH: { fullName: "Kim Tủy Hoàn Linh Đan", manaRestore: 80, color: "#29b6f6", radius: 6.5, buyPriceLowStone: 720 },
            SUPREME: { fullName: "Thái Ất Quy Nguyên Đan", manaRestore: 140, color: "#00e5ff", radius: 7.5, buyPriceLowStone: 2200 }
        },
        MAX_MANA_QUALITIES: {
            LOW: { fullName: "Uẩn Hải Khai Mạch Đan", maxManaFlat: 5, color: "#9c88ff", radius: 4.5, buyPriceLowStone: 95 },
            MEDIUM: { fullName: "Tử Hà Dưỡng Phủ Đan", maxManaFlat: 10, color: "#8c7ae6", radius: 5.5, buyPriceLowStone: 420 },
            HIGH: { fullName: "Thiên Tuyền Khuyết Hải Đan", maxManaFlat: 18, color: "#7158e2", radius: 6.5, buyPriceLowStone: 1900 },
            SUPREME: { fullName: "Hư Thiên Nạp Linh Đan", maxManaFlat: 30, color: "#5f27cd", radius: 7.5, buyPriceLowStone: 9800 }
        },
        REGEN_QUALITIES: {
            LOW: { fullName: "Cam Lộ Dưỡng Tuyền Đan", manaRegenPct: 0.25, color: "#65d6ce", radius: 4.5, buyPriceLowStone: 70 },
            MEDIUM: { fullName: "Thanh Uyên Hồi Nguyên Đan", manaRegenPct: 0.50, color: "#4dd0e1", radius: 5.5, buyPriceLowStone: 320 },
            HIGH: { fullName: "Bích Tuyền Sinh Tức Đan", manaRegenPct: 0.80, color: "#26c6da", radius: 6.5, buyPriceLowStone: 1500 },
            SUPREME: { fullName: "Vạn Mạch Tuần Hoàn Đan", manaRegenPct: 1.20, color: "#00acc1", radius: 7.5, buyPriceLowStone: 7600 }
        },
        SPEED_QUALITIES: {
            LOW: { fullName: "Ngự Phong Khinh Thân Đan", speedPct: 0.08, color: "#7bed9f", radius: 4.5, buyPriceLowStone: 85 },
            MEDIUM: { fullName: "Lưu Vân Thuấn Ảnh Đan", speedPct: 0.15, color: "#2ed573", radius: 5.5, buyPriceLowStone: 360 },
            HIGH: { fullName: "Thiên La Tật Ảnh Đan", speedPct: 0.24, color: "#1dd1a1", radius: 6.5, buyPriceLowStone: 1600 },
            SUPREME: { fullName: "Kim Bằng Phá Hư Đan", speedPct: 0.36, color: "#10ac84", radius: 7.5, buyPriceLowStone: 8400 }
        },
        FORTUNE_QUALITIES: {
            LOW: { fullName: "Vân Mệnh Tụ Phúc Đan", dropRatePct: 0.10, color: "#ffd56f", radius: 4.5, buyPriceLowStone: 130 },
            MEDIUM: { fullName: "Kim Quang Tăng Vận Đan", dropRatePct: 0.18, color: "#ffca3a", radius: 5.5, buyPriceLowStone: 620 },
            HIGH: { fullName: "Tinh Tú Khải Vận Đan", dropRatePct: 0.30, color: "#ffb703", radius: 6.5, buyPriceLowStone: 3200 },
            SUPREME: { fullName: "Thiên Mệnh Hồng Phúc Đan", dropRatePct: 0.50, color: "#ffd166", radius: 7.5, buyPriceLowStone: 18600 }
        },
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
                durationMs: 1000,
                color: "#231130",
                radius: 8,
                buyPriceLowStone: 4444444
            }
        }
    },
    SPIRIT_STONE: {
        CHANCE: 0.35,
        ELITE_CHANCE: 1.0,
        COLLECT_DELAY_MS: 500,
        MAGNET_SPEED: 16,
        TRAIL_LENGTH: 12,
        STARTING_COUNTS: {
            LOW: 100,      // Số lượng hạ phẩm linh thạch ban đầu để dev test nhanh
            MEDIUM: 50,   // Số lượng trung phẩm linh thạch ban đầu
            HIGH: 25,     // Số lượng thượng phẩm linh thạch ban đầu
            SUPREME: 10   // Số lượng cực phẩm linh thạch ban đầu
        },
        DROP_COUNT: {
            NORMAL: 1,
            ELITE: 3
        },
        QUALITY_RATES: {
            NORMAL: { LOW: 0.88, MEDIUM: 0.10, HIGH: 0.019, SUPREME: 0.001 },
            ELITE: { LOW: 0.50, MEDIUM: 0.34, HIGH: 0.13, SUPREME: 0.03 }
        },
        TYPES: {
            LOW: { label: "Hạ phẩm linh thạch", shortLabel: "Hạ phẩm", value: 1, color: "#62f0d9", radius: 4.5 },
            MEDIUM: { label: "Trung phẩm linh thạch", shortLabel: "Trung phẩm", value: 100, color: "#59b6ff", radius: 5.5 },
            HIGH: { label: "Thượng phẩm linh thạch", shortLabel: "Thượng phẩm", value: 10000, color: "#b78cff", radius: 6.5 },
            SUPREME: { label: "Cực phẩm linh thạch", shortLabel: "Cực phẩm", value: 1000000, color: "#ffd76f", radius: 7.5 }
        }
    }
};
// <!-- Create By: Vũ Hoài Nam -->
