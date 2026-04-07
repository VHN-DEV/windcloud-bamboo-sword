class Pill {
    constructor(x, y, dropSpec = { kind: 'PILL', category: 'EXP', quality: 'LOW' }) {
        this.x = x;
        this.y = y;
        this.dropSpec = {
            kind: 'PILL',
            category: 'EXP',
            quality: 'LOW',
            ...dropSpec
        };

        const appearance = this.getAppearance();
        this.r = appearance.radius;
        this.color = appearance.color;

        this.state = 0;
        this.velocity = { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 };
        this.friction = 0.96;
        this.spawnTime = Date.now();
        this.history = [];
        this.maxHistory = this.getConfig().TRAIL_LENGTH;
    }

    getConfig() {
        if (this.dropSpec.kind === 'STONE') {
            return CONFIG.SPIRIT_STONE;
        }

        return CONFIG.PILL;
    }

    getAppearance() {
        if (this.dropSpec.kind === 'STONE') {
            return CONFIG.SPIRIT_STONE.TYPES[this.dropSpec.quality] || CONFIG.SPIRIT_STONE.TYPES.LOW;
        }

        if (this.dropSpec.kind === 'MATERIAL') {
            const materialConfig = CONFIG.ITEMS?.MATERIALS?.[this.dropSpec.materialKey];
            return {
                color: materialConfig?.color || '#ffb27d',
                radius: materialConfig?.radius || 4.8
            };
        }

        if (this.dropSpec.kind === 'INSECT_EGG') {
            const species = CONFIG.INSECT?.SPECIES?.[this.dropSpec.speciesKey];
            return {
                color: species?.eggColor || species?.color || "#d7fff1",
                radius: 5.4
            };
        }

        if (this.dropSpec.specialKey) {
            return CONFIG.PILL.SPECIAL_ITEMS[this.dropSpec.specialKey] || CONFIG.PILL.EXP_QUALITIES.LOW;
        }

        const categoryMap = {
            EXP: CONFIG.PILL.EXP_QUALITIES,
            INSIGHT: CONFIG.PILL.INSIGHT_QUALITIES,
            BREAKTHROUGH: CONFIG.PILL.BREAKTHROUGH_QUALITIES,
            ATTACK: CONFIG.PILL.ATTACK_QUALITIES,
            SHIELD_BREAK: CONFIG.PILL.SHIELD_BREAK_QUALITIES,
            BERSERK: CONFIG.PILL.BERSERK_QUALITIES,
            RAGE: CONFIG.PILL.RAGE_QUALITIES,
            MANA: CONFIG.PILL.MANA_QUALITIES,
            MAX_MANA: CONFIG.PILL.MAX_MANA_QUALITIES,
            REGEN: CONFIG.PILL.REGEN_QUALITIES,
            SPEED: CONFIG.PILL.SPEED_QUALITIES,
            FORTUNE: CONFIG.PILL.FORTUNE_QUALITIES
        };

        const categoryDefs = categoryMap[this.dropSpec.category];
        if (categoryDefs) {
            return categoryDefs[this.dropSpec.quality] || categoryDefs.LOW;
        }

        return CONFIG.PILL.EXP_QUALITIES[this.dropSpec.quality] || CONFIG.PILL.EXP_QUALITIES.LOW;
    }

    update(playerX, playerY) {
        const cfg = this.getConfig();
        this.maxHistory = cfg.TRAIL_LENGTH;
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
            const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));

            this.x += (dx / dist) * cfg.MAGNET_SPEED;
            this.y += (dy / dist) * cfg.MAGNET_SPEED;

            if (dist < 20) return this.dropSpec;
        }
        return null;
    }

    drawTrail(ctx) {
        if (this.history.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(this.history[0].x, this.history[0].y);
        for (let i = 1; i < this.history.length; i++) {
            ctx.lineTo(this.history[i].x, this.history[i].y);
        }
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.r * 0.8;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.28;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    drawPill(ctx) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);

        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.35, this.color);
        grad.addColorStop(1, "rgba(0, 0, 0, 0.2)");

        ctx.fillStyle = grad;
        ctx.fill();
    }

    drawStone(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI / 4);
        ctx.shadowBlur = 18;
        ctx.shadowColor = this.color;

        const size = this.r * 1.7;
        const grad = ctx.createLinearGradient(-size, -size, size, size);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.45, this.color);
        grad.addColorStop(1, "rgba(20, 35, 60, 0.35)");

        ctx.fillStyle = grad;
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.9, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.9, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    drawEgg(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = 18;
        ctx.shadowColor = this.color;

        const eggHeight = this.r * 2.3;
        const eggWidth = this.r * 1.55;
        const grad = ctx.createRadialGradient(-eggWidth * 0.2, -eggHeight * 0.35, this.r * 0.2, 0, 0, eggHeight);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.42, this.color);
        grad.addColorStop(1, "rgba(14, 24, 34, 0.45)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -eggHeight * 0.55);
        ctx.bezierCurveTo(eggWidth * 0.68, -eggHeight * 0.5, eggWidth * 0.78, eggHeight * 0.1, 0, eggHeight * 0.62);
        ctx.bezierCurveTo(-eggWidth * 0.78, eggHeight * 0.1, -eggWidth * 0.68, -eggHeight * 0.5, 0, -eggHeight * 0.55);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(-eggWidth * 0.16, -eggHeight * 0.18, this.r * 0.35, Math.PI * 1.05, Math.PI * 1.85);
        ctx.stroke();
        ctx.restore();
    }

    draw(ctx) {
        ctx.save();
        this.drawTrail(ctx);

        if (this.dropSpec.kind === 'STONE') {
            this.drawStone(ctx);
        } else if (this.dropSpec.kind === 'INSECT_EGG') {
            this.drawEgg(ctx);
        } else {
            this.drawPill(ctx);
        }

        ctx.restore();
    }
}
