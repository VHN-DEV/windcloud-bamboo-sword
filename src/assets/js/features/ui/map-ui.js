const MapUI = {
    overlay: document.getElementById('map-popup'),
    btnOpen: document.getElementById('btn-map'),
    btnClose: document.getElementById('close-map'),
    canvas: document.getElementById('map-canvas'),
    hint: document.getElementById('map-hint'),
    ctx: null,

    init() {
        if (!this.overlay || !this.btnOpen || !this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.btnOpen.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.open();
        });

        if (this.btnClose) {
            this.btnClose.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.close();
            });
        }

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target !== this.overlay) return;
            e.stopPropagation();
            this.close();
        });

        const content = this.overlay.querySelector('.popup-content');
        if (content) {
            content.addEventListener('pointerdown', (e) => e.stopPropagation());
        }
    },

    isOpen() {
        return this.overlay?.classList.contains('show') || this.overlay?.style.display === 'flex';
    },

    open() {
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    },

    getVisionRadius() {
        const rawConsciousness = Number(Input?.getSwordFormationProgress?.().consciousness);
        const consciousness = Number.isFinite(rawConsciousness)
            ? Math.max(0, rawConsciousness)
            : 1_000_000;
        const scaledRadius = 220 + (Math.log1p(consciousness) * 120);
        return Math.min(4200, Math.max(220, scaledRadius));
    },

    render({ player, enemies }) {
        if (!this.ctx || !this.isOpen() || !player) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const visionRadiusWorld = this.getVisionRadius();
        const mapWorldRange = Math.max(visionRadiusWorld * 2.4, 760);
        const pxPerWorldRaw = (Math.min(width, height) * 0.46) / mapWorldRange;
        const pxPerWorld = Number.isFinite(pxPerWorldRaw) && pxPerWorldRaw > 0 ? pxPerWorldRaw : 0.001;
        const visionRadiusPx = visionRadiusWorld * pxPerWorld;
        const monsterCount = Array.isArray(enemies) ? enemies.length : 0;
        let visibleMonsterCount = 0;

        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(4, 9, 14, 0.94)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(40, 52, 66, 0.34)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(6, visionRadiusPx), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(127, 221, 255, 0.78)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(6, visionRadiusPx), 0, Math.PI * 2);
        ctx.stroke();

        const safeEnemies = Array.isArray(enemies) ? enemies : [];
        for (let i = 0; i < safeEnemies.length; i++) {
            const enemy = safeEnemies[i];
            const dx = (enemy?.x || 0) - player.x;
            const dy = (enemy?.y || 0) - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > visionRadiusWorld) continue;

            const dotX = centerX + (dx * pxPerWorld);
            const dotY = centerY + (dy * pxPerWorld);
            if (dotX < 0 || dotX > width || dotY < 0 || dotY > height) continue;

            visibleMonsterCount++;

            const rankId = Math.max(1, Number(enemy?.rankData?.id) || 1);
            const eliteBoost = enemy?.isElite ? 1.8 : 1;
            const dotRadius = Math.max(2.4, Math.min(11.5, (1.8 + (rankId * 0.15)) * eliteBoost));
            ctx.fillStyle = enemy?.isElite ? '#ff6f91' : '#ff4545';
            ctx.beginPath();
            ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#44d9ff';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#44d9ff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (this.hint) {
            this.hint.textContent = `Thần thức: ${Math.round(visionRadiusWorld)} | Quái hiện: ${visibleMonsterCount}/${monsterCount}`;
        }
    }
};
