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
    pills: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0
    },
    isReadyToBreak: false, // Thêm biến trạng thái này
    combo: 0,
    rage: 0,
    maxRage: 100,
    isUltMode: false, // Trạng thái tuyệt kỹ tối thượng

    updateCombo(isReset = false) {
        if (isReset) {
            this.combo = 0;
            this.rage = 0;
        } else {
            this.combo++;
            // Tăng nộ: diệt càng nhanh nộ càng tăng mạnh
            this.rage = Math.min(this.maxRage, this.rage + 2); 
        }
        this.renderRageUI();
    },

    renderRageUI() {
        const ultBtn = document.getElementById('btn-ultimate');
        if (ultBtn) {
            if (this.rage >= this.maxRage) {
                ultBtn.classList.add('ready', 'is-active');
                ultBtn.style.display = 'flex'; // Hiện nút khi đầy nộ
            } else {
                ultBtn.classList.remove('ready');
                // Nếu đang dùng Ult mà nộ về 0 thì tắt chế độ Ult
                if (this.rage <= 0) this.isUltMode = false;
            }
        }
    },

    // Hàm mới để tính tổng % tỉ lệ đột phá từ đan dược
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
                    this.isAttacking = false;
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
        const now = performance.now();
        const elapsed = now - this.lastManaRegenTick;

        if (elapsed >= CONFIG.MANA.REGEN_INTERVAL_MS) {
            // Tính toán số mana hồi dựa trên giây (hoặc chu kỳ MS)
            const ticks = Math.floor(elapsed / CONFIG.MANA.REGEN_INTERVAL_MS);

            if (ticks > 0) {
                // Sử dụng REGEN_PER_SEC thay vì REGEN_PER_MIN
                this.updateMana(ticks * CONFIG.MANA.REGEN_PER_SEC);
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
            this.createLevelUpExplosion(this.x, this.y, currentRank.color);
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
            if (this.isReadyToBreak) breakthroughGroup.classList.add('is-active');
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

    triggerExpError() {
        const el = document.getElementById('exp-container');
        el.classList.add('shake-red');
        setTimeout(() => el.classList.remove('shake-red'), 500);
    },

    update(dt) { // Nhận thêm tham số dt
        const worldPos = Camera.screenToWorld(this.screenX, this.screenY);
        this.x = worldPos.x;
        this.y = worldPos.y;

        // Tính tốc độ di chuyển của con trỏ/ngón tay
        this.speed = Math.hypot(this.x - this.px, this.y - this.py);
        this.px = this.x; this.py = this.y;

        // Gọi hàm xử lý tiêu hao mana
        this.processActiveConsumption(dt);
    },

    handleMove(e) {
        if (e.target.closest('.btn')) return;

        // Pointermove hoạt động cho cả chuột và touch di chuyển
        const p = e.touches ? e.touches[0] : e;
        this.screenX = p.clientX;
        this.screenY = p.clientY;
    },

    handleDown(e) {
        if (e.target.closest('.btn')) return;

        // LOGIC MỚI: Nếu là mobile, chạm màn hình KHÔNG kích hoạt tấn công
        if (this.isTouchDevice) return;

        // Nếu là Desktop (chuột), vẫn giữ logic nhấn giữ để tấn công
        e.preventDefault();
        this.attackTimer = setTimeout(() => {
            this.isAttacking = true;
        }, CONFIG.SWORD.ATTACK_DELAY_MS);
    },

    handleUp(e) {
        // Chỉ xử lý handleUp cho chuột trên desktop
        if (!this.isTouchDevice) {
            this.isAttacking = false;
            clearTimeout(this.attackTimer);
        }
    },

    handleWheel(e) {
        const delta = -e.deltaY * CONFIG.ZOOM.SENSITIVITY;
        Camera.adjustZoom(delta);
    },

    // Hàm tạo hiệu ứng hạt bùng nổ
    createLevelUpExplosion(x, y, color) {
        for (let i = 0; i < 30; i++) { // Giảm số lượng hạt
            visualParticles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8, // Giảm tốc độ bay
                vy: (Math.random() - 0.5) * 8,
                size: Math.random() * 3 + 1,   // Hạt nhỏ li ti như bụi ánh sáng
                life: 1.0,
                color: color || "#fff"
            });
        }
    },

    drawFlame(ctx, scaleFactor) {
        const time = performance.now() * 0.003;
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. Quầng sáng lạnh (Aura Băng Diễm)
        // Càng Lam Băng Diễm có đặc điểm tỏa ra hàn khí màu xanh lam nhạt
        ctx.shadowBlur = 20 * scaleFactor;
        ctx.shadowColor = "#00ffff"; // Màu Cyan cực sáng

        // 2. Định nghĩa các lớp màu "Càng Lam"
        // Lớp 1: Lam đậm (viền ngoài)
        // Lớp 2: Lam băng (thân lửa)
        // Lớp 3: Thiên lam trắng (lõi hỏa rực cháy)
        const layers = [
            { w: 12, h: 22, color: "rgba(0, 102, 255, 0.3)", f: 0.8 }, // Royal Blue mờ
            { w: 8,  h: 16, color: "#00d9ff", f: 1.2 },               // Electric Blue
            { w: 5,  h: 10, color: "#e0ffff", f: 1.8 }                // Lõi trắng xanh
        ];

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
            ctx.fillStyle = "rgba(150, 255, 255, 0.5)";
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

const SettingsUI = {
    overlay: document.getElementById('settings-popup'),
    btnOpen: document.getElementById('btn-settings'),
    btnClose: document.getElementById('close-settings'),
    btnSave: document.getElementById('save-settings'),

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
    },

    /**
     * Tải cấu hình từ LocalStorage và áp dụng vào object CONFIG toàn cục
     */
    load() {
        const savedData = localStorage.getItem('thanh_truc_settings');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                // Sử dụng đệ quy nhẹ hoặc gán tay để đảm bảo không làm mất các reference gốc
                // Ở đây gán trực tiếp các nhánh chính của CONFIG
                if (parsed.BG) Object.assign(CONFIG.BG, parsed.BG);
                if (parsed.ZOOM) Object.assign(CONFIG.ZOOM, parsed.ZOOM);
                if (parsed.COLORS) Object.assign(CONFIG.COLORS, parsed.COLORS);
                if (parsed.SWORD) Object.assign(CONFIG.SWORD, parsed.SWORD);
                if (parsed.ENEMY) Object.assign(CONFIG.ENEMY, parsed.ENEMY);
                if (parsed.MANA) Object.assign(CONFIG.MANA, parsed.MANA);
                if (parsed.PILL) Object.assign(CONFIG.PILL, parsed.PILL);
                if (parsed.CULTIVATION) Object.assign(CONFIG.CULTIVATION, parsed.CULTIVATION);
                
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
            }
        }, 300);
        document.body.style.cursor = 'none';
    },

    open() {
        document.body.style.cursor = 'default';
        
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
            'cfg-sw-regen': CONFIG.SWORD.REGEN_INTERVAL_MS,
            'cfg-sw-paused': CONFIG.SWORD.IS_PAUSED ? 1 : 0,

            'cfg-en-spawn': CONFIG.ENEMY.SPAWN_COUNT,
            'cfg-en-elite': CONFIG.ENEMY.ELITE_CHANCE,
            'cfg-en-shield-ch': CONFIG.ENEMY.SHIELD_CHANCE,
            'cfg-en-shield-hp': CONFIG.ENEMY.SHIELD_HP_RATIO,
            'cfg-en-debris': CONFIG.ENEMY.DEBRIS.COUNT,

            'cfg-ma-regen': CONFIG.MANA.REGEN_PER_SEC,
            'cfg-ma-atk': CONFIG.MANA.COST_ATTACK_PER_SEC,
            'cfg-ma-move': CONFIG.MANA.COST_MOVE_PER_SEC,
            'cfg-ma-res-cost': Math.abs(CONFIG.MANA.COST_RESPAWN),
            'cfg-sw-change-form': CONFIG.MANA.COST_CHANGE_FORM,
            'cfg-sw-gain-kill': CONFIG.MANA.GAIN_KILL,

            'cfg-pi-chance': CONFIG.PILL.CHANCE,
            'cfg-pi-magnet': CONFIG.PILL.MAGNET_SPEED,
            'cfg-pi-trail': CONFIG.PILL.TRAIL_LENGTH,
            'cfg-cu-penalty': CONFIG.CULTIVATION.BREAKTHROUGH_PENALTY_FACTOR,
            'cfg-cu-max-chance': CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE
        };

        for (let id in mapping) {
            let el = document.getElementById(id);
            if (el) {
                const value = mapping[id];
                el.value = (value !== undefined) ? value : ""; 
            }
        }

        this.overlay.style.display = 'flex';
        setTimeout(() => this.overlay.classList.add('show'), 10);
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
            CONFIG.SWORD.REGEN_INTERVAL_MS = parseInt(document.getElementById('cfg-sw-regen').value);
            CONFIG.SWORD.IS_PAUSED = document.getElementById('cfg-sw-paused').checked;

            CONFIG.ENEMY.SPAWN_COUNT = parseInt(document.getElementById('cfg-en-spawn').value);
            CONFIG.ENEMY.ELITE_CHANCE = parseFloat(document.getElementById('cfg-en-elite').value);
            CONFIG.ENEMY.SHIELD_CHANCE = parseFloat(document.getElementById('cfg-en-shield-ch').value);
            CONFIG.ENEMY.SHIELD_HP_RATIO = parseFloat(document.getElementById('cfg-en-shield-hp').value);
            CONFIG.ENEMY.DEBRIS.COUNT = parseInt(document.getElementById('cfg-en-debris').value);

            CONFIG.MANA.REGEN_PER_SEC = parseFloat(document.getElementById('cfg-ma-regen').value);
            CONFIG.MANA.COST_ATTACK_PER_SEC = parseFloat(document.getElementById('cfg-ma-atk').value);
            CONFIG.MANA.COST_MOVE_PER_SEC = parseFloat(document.getElementById('cfg-ma-move').value);
            CONFIG.MANA.COST_RESPAWN = -Math.abs(parseFloat(document.getElementById('cfg-ma-res-cost').value));
            CONFIG.MANA.COST_CHANGE_FORM = parseFloat(document.getElementById('cfg-sw-change-form').value);
            CONFIG.MANA.GAIN_KILL = parseFloat(document.getElementById('cfg-sw-gain-kill').value);
            
            CONFIG.PILL.CHANCE = parseFloat(document.getElementById('cfg-pi-chance').value);
            CONFIG.PILL.MAGNET_SPEED = parseInt(document.getElementById('cfg-pi-magnet').value);
            CONFIG.PILL.TRAIL_LENGTH = parseInt(document.getElementById('cfg-pi-trail').value);
            CONFIG.CULTIVATION.BREAKTHROUGH_PENALTY_FACTOR = parseFloat(document.getElementById('cfg-cu-penalty').value);
            CONFIG.CULTIVATION.MAX_BREAKTHROUGH_CHANCE = parseFloat(document.getElementById('cfg-cu-max-chance').value);

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
    }
};

// 2. Nút Đổi Hình Thái (Change Form)
document.getElementById('btn-form').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();

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
    if (Input.rage >= Input.maxRage) {
        Input.isUltMode = true;
        Input.rage = 0; // Reset nộ
        showNotify("VẠN KIẾM QUY TÔNG!", "#00ffff");
        
        // Sau 10 giây hết trạng thái hóa rồng
        setTimeout(() => { Input.isUltMode = false; }, 10000);
    }
});

const attackBtn = document.getElementById('btn-attack');

// Xử lý riêng cho nút bấm để không bị ảnh hưởng bởi logic handleDown của hệ thống
const startAttack = (e) => {
    e.stopPropagation();
    e.preventDefault();

    // 1. Kiểm tra xem còn thanh kiếm nào còn sống (hp > 0) không
    const aliveSwords = swords.filter(s => !s.isDead).length;

    // 2. Nếu mana = 0 VÀ không còn kiếm nào sống
    if (Input.mana <= 0 && aliveSwords === 0) {
        Input.triggerManaShake();
        Input.isAttacking = false; // Không cho phép tấn công
        return;
    }

    Input.isAttacking = true;
};

const stopAttack = (e) => {
    e.stopPropagation();
    e.preventDefault();
    Input.isAttacking = false;
    if (Input.attackTimer) clearTimeout(Input.attackTimer);
};

// Sử dụng pointerdown/up để nhạy nhất trên cả mobile và desktop
attackBtn.addEventListener('pointerdown', startAttack);
attackBtn.addEventListener('pointerup', stopAttack);
attackBtn.addEventListener('pointerleave', stopAttack); // Khi kéo ngón tay ra khỏi nút

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

function init() {
    // Khởi tạo thông số theo rank đầu tiên
    const startingRank = CONFIG.CULTIVATION.RANKS[Input.rankIndex];
    Input.maxMana = startingRank.maxMana || CONFIG.MANA.MAX;
    Input.mana = Input.maxMana;

    Input.renderManaUI();
    Input.renderExpUI();
    SettingsUI.init();
    starField = new StarField(250, width, height);
    for (let i = 0; i < CONFIG.ENEMY.SPAWN_COUNT; i++) enemies.push(new Enemy());
    for (let i = 0; i < CONFIG.SWORD.COUNT; i++) swords.push(new Sword(i, scaleFactor));
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
    let dx = Input.x - guardCenter.x;
    let dy = Input.y - guardCenter.y;
    guardCenter.vx += dx * 0.04;
    guardCenter.vy += dy * 0.04;
    guardCenter.vx *= 0.82;
    guardCenter.vy *= 0.82;
    guardCenter.x += guardCenter.vx;
    guardCenter.y += guardCenter.vy;
}

function renderCursor() {
    // Không dùng shadow của canvas cũ để tránh bị đè màu
    ctx.shadowBlur = 0; 
    
    // Gọi trực tiếp Băng Diễm từ Input
    Input.drawFlame(ctx, scaleFactor);
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
        const collected = pill.update(window.innerWidth / 2, window.innerHeight / 2);

        if (collected) {
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
    swords.forEach(s => {
        s.update(guardCenter, enemies, Input, scaleFactor);
        s.draw(ctx, scaleFactor);
    });
    renderCursor();

    // Vẽ và cập nhật hạt hiệu ứng
    visualParticles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        if (p.life <= 0) visualParticles.splice(i, 1);
    });
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