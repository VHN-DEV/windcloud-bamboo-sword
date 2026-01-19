class StarField {
    constructor(count, width, height) {
        this.stars = [];
        const totalStars = CONFIG.BG.STAR_COUNT || count;

        for (let i = 0; i < totalStars; i++) {
            this.stars.push({
                x: random(-width, width * 2),
                y: random(-height, height * 2),
                r: random(CONFIG.BG.STAR_SIZE.MIN, CONFIG.BG.STAR_SIZE.MAX),
                alpha: random(CONFIG.BG.STAR_ALPHA.MIN, CONFIG.BG.STAR_ALPHA.MAX)
            });
        }
    }
    draw(ctx, scaleFactor) {
        ctx.shadowBlur = 0;
        const speed = CONFIG.BG.STAR_TWINKLE_SPEED;

        for (const s of this.stars) {
            s.alpha += random(-speed, speed);
            if (s.alpha > CONFIG.BG.STAR_ALPHA.MAX) s.alpha = CONFIG.BG.STAR_ALPHA.MAX;
            else if (s.alpha < CONFIG.BG.STAR_ALPHA.MIN) s.alpha = CONFIG.BG.STAR_ALPHA.MIN;

            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * scaleFactor, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
            ctx.fill();
        }
    }
}
