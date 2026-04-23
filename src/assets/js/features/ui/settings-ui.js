const SettingsUI = {
    overlay: document.getElementById('settings-popup'),
    btnOpen: document.getElementById('btn-settings'),
    btnClose: document.getElementById('close-settings'),
    btnSave: document.getElementById('save-settings'),
    btnReset: document.getElementById('reset-settings'),
    btnResetProgress: document.getElementById('reset-progress'),
    btnTestModeTrue: document.getElementById('cfg-test-mode-true'),
    btnTestModeFalse: document.getElementById('cfg-test-mode-false'),
    testModeStatus: document.getElementById('cfg-test-mode-status'),
    isTestMode: false,

    init() {
        if (!this.overlay || !this.btnOpen) return;

        // Tải dữ liệu đã lưu từ trước khi khởi tạo UI
        this.load();
        this.loadTestMode();

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

        if (this.btnResetProgress) {
            this.btnResetProgress.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                if (confirm("Xóa toàn bộ tiến trình tu luyện hiện tại? Tu vi, linh thạch, vật phẩm và linh thú sẽ quay về lúc khởi đầu.")) {
                    GameProgress.reset();
                }
            });
        }

        if (this.btnTestModeTrue) {
            this.btnTestModeTrue.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.applyTestMode(true);
            });
        }

        if (this.btnTestModeFalse) {
            this.btnTestModeFalse.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.applyTestMode(false);
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

    loadTestMode() {
        const savedMode = localStorage.getItem('thanh_truc_test_mode');
        this.isTestMode = savedMode === 'true';
        this.updateTestModeUi();
    },

    updateTestModeUi() {
        if (this.testModeStatus) {
            this.testModeStatus.textContent = this.isTestMode ? 'TRUE' : 'FALSE';
            this.testModeStatus.style.color = this.isTestMode ? '#8fffe0' : '#ff9b9b';
        }

        if (this.btnTestModeTrue) {
            this.btnTestModeTrue.classList.toggle('is-active', this.isTestMode);
        }

        if (this.btnTestModeFalse) {
            this.btnTestModeFalse.classList.toggle('is-active', !this.isTestMode);
        }
    },

    applyTestMode(enabled) {
        const nextMode = Boolean(enabled);
        const wasTestMode = this.isTestMode;
        this.isTestMode = nextMode;
        localStorage.setItem('thanh_truc_test_mode', String(this.isTestMode));
        this.updateTestModeUi();

        if (!wasTestMode && this.isTestMode) {
            Input.spiritStones = Input.spiritStones || {};
            Input.spiritStones.SUPREME = Math.max(0, Math.floor(Number(Input.spiritStones.SUPREME) || 0)) + 100;
            Input.refreshResourceUI?.();
            showNotify("Chế độ test đã bật: nhận 100 Cực phẩm linh thạch!", "#ffd76f");
            return;
        }

        if (wasTestMode && !this.isTestMode) {
            showNotify("Chế độ test đã tắt.", "#ff9b9b");
        }
    },

    /**
     * Tải cấu hình từ LocalStorage và áp dụng vào object CONFIG toàn cục
     */
    load() {
        const savedData = localStorage.getItem('thanh_truc_settings');
        if (savedData) {
            try {
                const parsed = parseStoredJson(savedData);
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
        this.updateTestModeUi();
        
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
            localStorage.setItem('thanh_truc_settings', serializeForStorage(CONFIG));

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
            window.starField = starField;

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
