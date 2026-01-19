class Pill {
    constructor(x, y, typeKey = 'LOW') {
        this.x = x;
        this.y = y;
        this.typeKey = typeKey; // Lưu lại để khi thu thập biết là loại nào

        const typeData = CONFIG.PILL.TYPES[typeKey];
        this.r = typeData.radius;
        this.color = typeData.color;

        this.state = 0;
        this.velocity = { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 };
        this.friction = 0.96;
        this.spawnTime = Date.now();
        this.history = [];
        this.maxHistory = CONFIG.PILL.TRAIL_LENGTH;
    }

    update(playerX, playerY) {
        const cfg = CONFIG.PILL;
        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > this.maxHistory) this.history.shift();

        if (this.state === 0) {
            this.x += this.velocity.x;
            this.y += this.velocity.y;
            this.velocity.x *= this.friction;
            this.velocity.y *= this.friction;

            if (Date.now() - this.spawnTime > cfg.COLLECT_DELAY_MS) this.state = 1;
        } else {
            const dx = playerX - this.x;
            const dy = playerY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Dùng tốc độ từ CONFIG
            this.x += (dx / dist) * cfg.MAGNET_SPEED;
            this.y += (dy / dist) * cfg.MAGNET_SPEED;

            if (dist < 20) return true;
        }
        return false;
    }

    draw(ctx) {
        ctx.save();

        // 1. VẼ VỆT SÁNG (TRAIL)
        if (this.history.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.history[0].x, this.history[0].y);
            for (let i = 1; i < this.history.length; i++) {
                ctx.lineTo(this.history[i].x, this.history[i].y);
            }
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.r * 0.8;
            ctx.lineCap = "round";
            ctx.globalAlpha = 0.3; // Đuôi mờ dần
            ctx.stroke();
        }

        // 2. VẼ VIÊN LINH ĐAN
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);

        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
        grad.addColorStop(0, "#fff");
        grad.addColorStop(1, this.color);

        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
    }
}