class Sword {
    constructor(index, scaleFactor) {
        this.index = index;
        this.layer = Math.floor(index / 24);
        this.baseAngle = (Math.PI * 2 / 24) * (index % 24);
        this.spinAngle = 0;
        this.spinSpeed = (CONFIG.SWORD.SPIN_SPEED_BASE / (this.layer + 1)) * (this.layer % 2 ? -1 : 1);
        this.radius = (CONFIG.SWORD.BASE_RADIUS + this.layer * CONFIG.SWORD.LAYER_SPACING) * scaleFactor;
        this.x = window.innerWidth / 2;
        this.y = window.innerHeight / 2;
        this.vx = 0; this.vy = 0;
        this.drawAngle = 0;
        this.trail = [];
        this.breath = random(0, Math.PI * 2);
        this.breathSpeed = random(CONFIG.SWORD.BREATH_SPEED.MIN, CONFIG.SWORD.BREATH_SPEED.MAX);
        this.attackDelay = this.layer * CONFIG.SWORD.ATTACK_DELAY_VAR.BASE + random(0, CONFIG.SWORD.ATTACK_DELAY_VAR.RAND);
        this.attackFrame = 0;
        this.flowNoise = Math.random() * Math.PI * 2;
        this.flowOffsetAngle = (Math.PI * 2 / 72) * index;
        this.flowOffsetRadius = (CONFIG.SWORD.FLOW_OFFSET.MIN + Math.random() * (CONFIG.SWORD.FLOW_OFFSET.MAX - CONFIG.SWORD.FLOW_OFFSET.MIN)) * scaleFactor;
        this.isStunned = false;
        this.stunTimer = 0;
        const rankData = CONFIG.CULTIVATION.RANKS[Input.rankIndex] || CONFIG.CULTIVATION.RANKS[0];
        this.maxHp = rankData.swordDurability;
        this.hp = this.maxHp;
        this.isDead = false;
        this.respawnTimer = 0;
        this.fragments = [];
        this.deathTime = 0;
        this.powerPenalty = 1; // hệ số sát thương theo độ bền
        this.isEnlarged = false;      // Đang trong trạng thái cường hóa phóng to
        this.currentVisualScale = 1;  // Tỉ lệ hiển thị thực tế (để animation mượt)
        this.targetVisualScale = 1;   // Tỉ lệ đích muốn hướng tới
    }

    update(guardCenter, enemies, Input, scaleFactor) {
        if (this.isDead) {
            const now = performance.now();
            if (now > this.respawnTimer) {
                // KIỂM TRA MANA TRƯỚC KHI HỒI SINH
                if (Input.mana >= Math.abs(CONFIG.MANA.COST_RESPAWN)) {
                    Input.updateMana(CONFIG.MANA.COST_RESPAWN); // TRỪ 1 MANA KHI TÁI SINH
                    this.respawn(Input);
                } else {
                    // Nếu không đủ mana, trì hoãn việc hồi sinh thêm 1 giây để kiểm tra lại sau
                    this.respawnTimer = now + 1000;
                }
            }
            return;
        }

        if (this.isStunned) {
            this.handleStun(scaleFactor);
            return;
        }

        this.breath += this.breathSpeed;
        this.breathSpeed = random(CONFIG.SWORD.BREATH_SPEED.MIN, CONFIG.SWORD.BREATH_SPEED.MAX);
        const currentRadius = this.radius + Math.sin(this.breath) * 8 * scaleFactor;

        if (!Input.isAttacking) {
            this.updateGuardMode(guardCenter, currentRadius, Input, scaleFactor);
        } else {
            this.updateAttackMode(enemies, Input, scaleFactor);
        }
    }

    handleStun(scaleFactor) {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.drawAngle += 0.2;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > CONFIG.SWORD.TRAIL_LENGTH) this.trail.shift();

        if (performance.now() > this.stunTimer) {
            this.isStunned = false;
            this.vx *= 0.2;
            this.vy *= 0.2;
        }
    }

    respawn(Input) {
        const rankData = CONFIG.CULTIVATION.RANKS[Input.rankIndex] || CONFIG.CULTIVATION.RANKS[0];
        this.maxHp = rankData.swordDurability;
        this.hp = this.maxHp;
        this.isDead = false;
        this.x = Input.x;
        this.y = Input.y;
        this.vx = 0;
        this.vy = 0;
        this.isStunned = false;
        this.trail = [];
        this.fragments = [];
    }

    updateGuardMode(guardCenter, r, Input, scaleFactor) {
        // Nếu đang bay về mà vẫn to, thì thu nhỏ lại
        if (this.isEnlarged) {
            this.isEnlarged = false;
            this.targetVisualScale = 1;
        }
        this.currentVisualScale += (this.targetVisualScale - this.currentVisualScale) * 0.1;
        
        let globalRotation = 0;
        if (!CONFIG.SWORD.IS_PAUSED) {
            globalRotation = (performance.now() / 1000) * this.spinSpeed * (CONFIG.SWORD.SPEED_MULT || 100);
        } else {
            globalRotation = 0; 
        }

        const a = this.baseAngle + globalRotation;

        const tx = guardCenter.x + Math.cos(a) * r;
        const ty = guardCenter.y + Math.sin(a) * r;

        if (Input.speed > 1.5) {
            const dx = tx - this.x;
            const dy = ty - this.y;
            const d = Math.hypot(dx, dy) || 1;

            this.vx += (dx / d) * Math.min(d * 0.05, 4 * scaleFactor);
            this.vy += (dy / d) * Math.min(d * 0.05, 4 * scaleFactor);

            this.vx *= 0.85;
            this.vy *= 0.85;

            this.x += this.vx;
            this.y += this.vy;

            this.drawAngle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
        } else {
            const dx = tx - this.x;
            const dy = ty - this.y;

            this.x += dx * 0.12;
            this.y += dy * 0.12;

            this.vx *= 0.5;
            this.vy *= 0.5;

            if (Math.hypot(dx, dy) < 0.5) {
                this.x = tx;
                this.y = ty;
            }

            let targetAngle = (Input.guardForm === 1)
                ? a + Math.PI / 2
                : Math.atan2(ty - this.y, tx - this.x) + Math.PI / 2;

            let diff = targetAngle - this.drawAngle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.drawAngle += diff * 0.15;
        }

        // if (Input.speed > 1.5) {
        //     this.flowNoise += 0.04;
        //     const fx = Input.x + Math.cos(this.flowOffsetAngle + this.flowNoise) * this.flowOffsetRadius;
        //     const fy = Input.y + Math.sin(this.flowOffsetAngle + this.flowNoise) * this.flowOffsetRadius;
        //     const dx = fx - this.x;
        //     const dy = fy - this.y;
        //     const d = Math.hypot(dx, dy) || 1;
        //     this.vx += (dx / d) * Math.min(d * 0.04, 3 * scaleFactor);
        //     this.vy += (dy / d) * Math.min(d * 0.04, 3 * scaleFactor);
        //     this.vx *= 0.9; this.vy *= 0.9;
        //     this.x += this.vx; this.y += this.vy;
        //     this.drawAngle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
        // } else {
        //     const dx = tx - this.x;
        //     const dy = ty - this.y;
        //     this.x += dx * 0.12; this.y += dy * 0.12;
        //     this.vx *= 0.5; this.vy *= 0.5;
        //     let targetAngle = (Input.guardForm === 1) ? a + Math.PI / 2 : Math.atan2(ty - this.y, tx - this.x) + Math.PI / 2;
        //     let diff = targetAngle - this.drawAngle;
        //     while (diff < -Math.PI) diff += Math.PI * 2;
        //     while (diff > Math.PI) diff -= Math.PI * 2;
        //     this.drawAngle += diff * 0.15;
        // }
        this.attackFrame = 0;
        this.trail = [];
    }

    updateAttackMode(enemies, Input, scaleFactor) {
        this.attackFrame++;
        if (this.attackFrame < this.attackDelay) return;

        // --- SỬA/THÊM: CHỈ NGẪU NHIÊN KHI BẮT ĐẦU TẤN CÔNG ---
        // Điều kiện: Chưa phóng to + May mắn (1%) + Đủ Mana
        if (!this.isEnlarged && Math.random() < 0.01 && Input.mana >= 1) {
            Input.updateMana(-1); // Trừ 1 Mana cho một lần phóng to
            this.isEnlarged = true;
            this.targetVisualScale = 2.5; // Kích thước khổng lồ
        }

        // Hiệu ứng co giãn mượt mà (luôn chạy để update currentVisualScale)
        this.currentVisualScale += (this.targetVisualScale - this.currentVisualScale) * 0.1;

        // --- GIẢM SÁT THƯƠNG KHI KIẾM GẦN VỠ ---
        const durabilityRate = this.hp / this.maxHp; // 1 → mới, 0 → sắp gãy
        this.powerPenalty = 0.6 + durabilityRate * 0.4;
        // 100% HP → 1.0 | 0 HP → 0.6

        let target = null, minStartDist = Infinity;
        for (const e of enemies) {
            const d = Math.hypot(e.x - Input.x, e.y - Input.y);
            if (d < minStartDist) { minStartDist = d; target = e; }
        }

        if (target) {
            const dx = target.x - this.x, dy = target.y - this.y;
            const d = Math.hypot(dx, dy) || 1;

            this.vx += (dx / d) * 10 * scaleFactor;
            this.vy += (dy / d) * 10 * scaleFactor;
            this.vx *= 0.92; this.vy *= 0.92;
            this.x += this.vx; this.y += this.vy;
            this.drawAngle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
            if (Math.hypot(this.x - target.x, this.y - target.y) < target.r + (target.hasShield ? 10 : 0)) {
                if (this.isEnlarged) {
                    this.powerPenalty *= 1.5; // Tăng 50% sát thương cho phát chém này
                    
                    // Tạo hiệu ứng đặc biệt khi chém bằng kiếm to
                    if (typeof Input.createLevelUpExplosion === 'function') {
                        Input.createLevelUpExplosion(target.x, target.y, "#ffcc00");
                    }
                    
                    // Chém xong thì thu nhỏ lại ngay
                    this.isEnlarged = false;
                    this.targetVisualScale = 1;
                }

                const result = target.hit(this);

                // Reset lại powerPenalty về mức bình thường dựa trên độ bền sau khi tính hit xong
                const durabilityRate = this.hp / this.maxHp;
                this.powerPenalty = 0.6 + durabilityRate * 0.4;

                if (result === "missed") {
                    // Khi né tránh: Kiếm chỉ bị giảm tốc độ một chút chứ không bị Stun
                    this.vx *= 0.5;
                    this.vy *= 0.5;
                    // Không trừ độ bền kiếm
                } else if (result === "shielded") {
                    // Khi đánh vào khiên: Bị Stun và trừ độ bền (như cũ)
                    this.hp -= target.isElite ? 3 : 1;

                    if (this.hp <= 0) {
                        this.breakSword(scaleFactor);
                    } else {
                        this.isStunned = true;
                        this.stunTimer = performance.now() + CONFIG.SWORD.STUN_DURATION_MS;
                        this.vx = -this.vx * 1.5 + (Math.random() - 0.5) * 10;
                        this.vy = -this.vy * 1.5 + (Math.random() - 0.5) * 10;
                    }
                }
            }

            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > CONFIG.SWORD.TRAIL_LENGTH) this.trail.shift();
        }
    }

    breakSword(scaleFactor) {
        this.isDead = true;
        this.deathTime = performance.now();
        this.respawnTimer = this.deathTime + CONFIG.SWORD.DEATH_WAIT_MS + CONFIG.SWORD.RESPAWN_DELAY_MS;

        const sLen = CONFIG.SWORD.SIZE * scaleFactor;
        const cos = Math.cos(this.drawAngle);
        const sin = Math.sin(this.drawAngle);

        this.fragments.push({
            type: 'handle',
            x: this.x,
            y: this.y,
            vx: -this.vx * 0.2 + random(-1, 1),
            vy: -this.vy * 0.2 + random(-1, 1),
            angle: this.drawAngle,
            va: random(-0.1, 0.1)
        });

        this.fragments.push({
            type: 'mid',
            x: this.x + cos * (sLen * 0.4) + sin * (sLen * 0.4),
            y: this.y + sin * (sLen * 0.4) - cos * (sLen * 0.4),
            vx: -this.vx * 0.4 + random(-2, 2),
            vy: -this.vy * 0.4 + random(-2, 2),
            angle: this.drawAngle + random(-0.2, 0.2),
            va: random(-0.2, 0.2)
        });

        this.fragments.push({
            type: 'tip',
            x: this.x + cos * (sLen * 0.8) + sin * (sLen * 0.8),
            y: this.y + sin * (sLen * 0.8) - cos * (sLen * 0.8),
            vx: -this.vx * 0.6 + random(-3, 3),
            vy: -this.vy * 0.6 + random(-3, 3),
            angle: this.drawAngle + random(-0.5, 0.5),
            va: random(-0.4, 0.4)
        });
    }

    draw(ctx, scaleFactor) {
        if (this.isDead) {
            if (this.fragments.length > 0) {
                const age = performance.now() - this.deathTime;
                const lifeTime = CONFIG.SWORD.FRAGMENTS.LIFE_TIME;
                const fadeTime = CONFIG.SWORD.FRAGMENTS.FADE_TIME;

                const alpha = age > lifeTime ? 1 - ((age - lifeTime) / fadeTime) : 1;

                ctx.save();
                ctx.globalAlpha = alpha;
                this.drawFragments(ctx, scaleFactor);
                ctx.restore();
            }
            return;
        }

        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.strokeStyle = CONFIG.COLORS.SWORD_TRAIL;
            ctx.lineWidth = 2 * scaleFactor;
            ctx.stroke();
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.drawAngle);
        ctx.scale(this.currentVisualScale, this.currentVisualScale);
        this.drawAura(ctx, scaleFactor);
        this.drawBlade(ctx, scaleFactor);
        ctx.restore();
    }

    drawFragments(ctx, scaleFactor) {
        const sLen = CONFIG.SWORD.SIZE * scaleFactor;
        const sWid = 4 * scaleFactor;

        this.fragments.forEach(f => {
            f.x += f.vx;
            f.y += f.vy;
            f.angle += f.va;

            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.angle);

            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";

            ctx.beginPath();
            if (f.type === 'handle') {
                ctx.fillStyle = CONFIG.COLORS.SWORD_HANDLE;
                ctx.fillRect(-3 * scaleFactor, 0, 6 * scaleFactor, 14 * scaleFactor);

                ctx.fillStyle = CONFIG.COLORS.SWORD_BLADE[2];
                ctx.moveTo(-sWid / 2, 0);
                ctx.lineTo(sWid / 2, 0);
                ctx.lineTo(sWid / 2, -sLen * 0.3);
                ctx.lineTo(0, -sLen * 0.2);
                ctx.lineTo(-sWid / 2, -sLen * 0.35);
                ctx.fill();
            }
            else if (f.type === 'mid') {
                ctx.fillStyle = CONFIG.COLORS.SWORD_BLADE[1];
                ctx.moveTo(-sWid / 2, 0);
                ctx.lineTo(sWid / 2, 0);
                ctx.lineTo(sWid / 2, -sLen * 0.3);
                ctx.lineTo(-sWid / 2, -sLen * 0.25);
                ctx.fill();
            }
            else if (f.type === 'tip') {
                ctx.fillStyle = CONFIG.COLORS.SWORD_BLADE[0];
                ctx.moveTo(-sWid / 2, 0);
                ctx.lineTo(sWid / 2, 0);
                ctx.lineTo(0, -sLen * 0.4);
                ctx.fill();
            }
            ctx.restore();
        });
    }

    drawAura(ctx, scaleFactor) {
        const auraCount = Math.floor(random(2, 8));
        ctx.shadowColor = CONFIG.COLORS.SWORD_AURA_SHADOW;
        ctx.shadowBlur = 8 * scaleFactor;
        for (let i = 0; i < auraCount; i++) {
            ctx.beginPath();
            let py = -random(0, CONFIG.SWORD.SIZE * scaleFactor);
            let px = random(-3, 3) * scaleFactor;
            ctx.moveTo(px, py);
            for (let s = 0; s < 3; s++) {
                px += random(-4, 4) * scaleFactor;
                py += random(-3, 3) * scaleFactor;
                ctx.lineTo(px, py);
            }
            ctx.strokeStyle = `rgba(255,255,180,${random(0.3, 0.6)})`;
            ctx.lineWidth = 2 * scaleFactor;
            ctx.stroke();
        }
    }

    drawBlade(ctx, scaleFactor) {
        const sLen = CONFIG.SWORD.SIZE * scaleFactor;
        
        // THÂN KIẾM: Điều chỉnh tỷ lệ để mũi kiếm chiếm khoảng 15-20% tổng chiều dài
        const baseWid = 9 * scaleFactor; 
        const tipWid = 5 * scaleFactor;  // Độ rộng tại điểm bắt đầu vát mũi
        const bladeBodyLen = sLen * 0.85; // Thân chiếm 85% chiều dài
        const swordTipLen = sLen;         // Mũi nhọn kết thúc tại 100% chiều dài

        // 1. VẼ LƯỠI KIẾM (Gồm thân và mũi nhọn)
        const bladeGrd = ctx.createLinearGradient(-baseWid/2, 0, baseWid/2, 0);
        bladeGrd.addColorStop(0, CONFIG.COLORS.SWORD_GOLD_MID);
        bladeGrd.addColorStop(0.3, CONFIG.COLORS.SWORD_BAMBOO_DARK);
        bladeGrd.addColorStop(0.5, CONFIG.COLORS.SWORD_BAMBOO_GREEN);
        bladeGrd.addColorStop(0.7, CONFIG.COLORS.SWORD_BAMBOO_DARK);
        bladeGrd.addColorStop(1, CONFIG.COLORS.SWORD_GOLD_MID);

        ctx.save();
        ctx.shadowColor = CONFIG.COLORS.SWORD_BAMBOO_GREEN;
        ctx.shadowBlur = 10 * scaleFactor;
        ctx.fillStyle = bladeGrd;
        
        ctx.beginPath();
        ctx.moveTo(-baseWid / 2, 0);                // Gốc trái
        ctx.lineTo(baseWid / 2, 0);                 // Gốc phải
        ctx.lineTo(tipWid / 2, -bladeBodyLen);      // Điểm bắt đầu vát bên phải
        ctx.lineTo(0, -swordTipLen);                // Đỉnh mũi kiếm nhọn (hội tụ tại tâm)
        ctx.lineTo(-tipWid / 2, -bladeBodyLen);     // Điểm bắt đầu vát bên trái
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 2. VẼ 10 ĐỐT TRÚC (Nằm gọn bên trong phần THÂN lưỡi)
        ctx.save();
        ctx.strokeStyle = CONFIG.COLORS.SWORD_NODE;
        ctx.lineWidth = 1.2 * scaleFactor;
        ctx.globalAlpha = 0.4;
        const nodeCount = 10;
        // Chỉ vẽ đốt trong phạm vi thân kiếm để không bị lòi ra ngoài mũi nhọn
        const nodeSpacing = bladeBodyLen / (nodeCount + 1); 
        
        for (let i = 1; i <= nodeCount; i++) {
            const y = -i * nodeSpacing;
            // Tính toán độ rộng tại vị trí y để đốt trúc không tràn ra khỏi cạnh kiếm
            const currentHalfWidth = (baseWid / 2) - (Math.abs(y) / bladeBodyLen) * ((baseWid - tipWid) / 2);
            const nodeMargin = 2 * scaleFactor; 
            
            ctx.beginPath();
            ctx.moveTo(-currentHalfWidth + nodeMargin, y);
            ctx.lineTo(currentHalfWidth - nodeMargin, y);
            ctx.stroke();
        }
        ctx.restore();

        // 3. THANH CHẮN TAY (Giữ nguyên logic của bạn)
        ctx.save();
        const gWidthTop = 13 * scaleFactor;    
        const gWidthBottom = 16 * scaleFactor; 
        const layerHeight = 1.5 * scaleFactor;
        const drawTrapezoid = (y, widthTop, widthBottom, height) => {
            ctx.beginPath();
            ctx.moveTo(-widthTop / 2, y);
            ctx.lineTo(widthTop / 2, y);
            ctx.lineTo(widthBottom / 2, y + height);
            ctx.lineTo(-widthBottom / 2, y + height);
            ctx.closePath();
            ctx.fill();
        };
        ctx.fillStyle = CONFIG.COLORS.SWORD_BAMBOO_DARK;
        drawTrapezoid(-2.5 * scaleFactor, gWidthTop, gWidthTop + 0.8, layerHeight);
        
        const goldGrd = ctx.createLinearGradient(-gWidthBottom/2, 0, gWidthBottom/2, 0);
        goldGrd.addColorStop(0.5, CONFIG.COLORS.SWORD_GOLD_LIGHT);
        ctx.fillStyle = goldGrd;
        drawTrapezoid(-2.5 * scaleFactor + layerHeight, gWidthTop + 0.8, gWidthBottom - 0.8, layerHeight);
        
        ctx.fillStyle = CONFIG.COLORS.SWORD_BAMBOO_DARK;
        drawTrapezoid(-2.5 * scaleFactor + (layerHeight * 2), gWidthBottom - 0.8, gWidthBottom, layerHeight);
        ctx.restore();

        // 4. CHUÔI KIẾM (Giữ nguyên logic của bạn)
        const hiltLen = 20 * scaleFactor;
        const hiltWidTop = 4 * scaleFactor;
        const hiltWidBottom = 6.5 * scaleFactor;
        
        const hiltGrd = ctx.createLinearGradient(0, layerHeight, 0, hiltLen);
        hiltGrd.addColorStop(0, CONFIG.COLORS.SWORD_BAMBOO_DARK);
        hiltGrd.addColorStop(0.8, CONFIG.COLORS.SWORD_BAMBOO_GREEN);
        hiltGrd.addColorStop(1, "#90EE90");

        ctx.save();
        ctx.fillStyle = hiltGrd;
        ctx.beginPath();
        ctx.moveTo(-hiltWidTop / 2, layerHeight);
        ctx.lineTo(hiltWidTop / 2, layerHeight);
        ctx.quadraticCurveTo(hiltWidTop / 2, hiltLen * 0.7, hiltWidBottom / 2, hiltLen);
        ctx.lineTo(-hiltWidBottom / 2, hiltLen);
        ctx.quadraticCurveTo(-hiltWidTop / 2, hiltLen * 0.7, -hiltWidTop / 2, layerHeight);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = CONFIG.COLORS.SWORD_BAMBOO_DARK;
        ctx.fillRect(-hiltWidBottom / 2, hiltLen, hiltWidBottom, 1.5 * scaleFactor);
        ctx.restore();
    }
}