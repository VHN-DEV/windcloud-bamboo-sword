const MapUI = {
    overlay: document.getElementById('map-popup'),
    btnOpen: document.getElementById('btn-map'),
    btnClose: document.getElementById('close-map'),
    canvas: document.getElementById('map-canvas'),
    hint: document.getElementById('map-hint'),
    ctx: null,
    zoomLevel: 1,
    minZoom: 0.65,
    maxZoom: 2.8,
    pinchState: {
        active: false,
        pointerIds: new Set(),
        pointerPositions: new Map(),
        lastDistance: 0
    },

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

        this.bindZoomControls();
    },

    isOpen() {
        return this.overlay?.classList.contains('show') || this.overlay?.style.display === 'flex';
    },

    open() {
        this.resetZoom();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    },

    bindZoomControls() {
        if (!this.canvas) return;

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const step = e.deltaY < 0 ? 0.12 : -0.12;
            this.adjustZoom(step);
        }, { passive: false });

        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch') return;
            this.pinchState.pointerIds.add(e.pointerId);
            this.pinchState.pointerPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.pinchState.pointerIds.size >= 2) {
                this.pinchState.active = true;
                this.pinchState.lastDistance = this.getPinchDistance();
            }
        });

        this.canvas.addEventListener('pointermove', (e) => {
            if (!this.pinchState.pointerIds.has(e.pointerId)) return;
            this.pinchState.pointerPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (!this.pinchState.active) return;

            const currentDistance = this.getPinchDistance();
            if (!Number.isFinite(currentDistance) || currentDistance <= 0) return;
            const previousDistance = Number(this.pinchState.lastDistance) || currentDistance;
            const delta = (currentDistance - previousDistance) / 180;
            this.adjustZoom(delta);
            this.pinchState.lastDistance = currentDistance;
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });

        const stopPinchPointer = (e) => {
            this.pinchState.pointerIds.delete(e.pointerId);
            this.pinchState.pointerPositions.delete(e.pointerId);
            if (this.pinchState.pointerIds.size < 2) {
                this.pinchState.active = false;
                this.pinchState.lastDistance = 0;
            }
        };

        this.canvas.addEventListener('pointerup', stopPinchPointer);
        this.canvas.addEventListener('pointercancel', stopPinchPointer);
        this.canvas.addEventListener('pointerleave', stopPinchPointer);
    },

    getPinchDistance() {
        const activePointers = Array.from(this.pinchState.pointerIds);
        if (activePointers.length < 2) return 0;

        const first = this.pinchState.pointerPositions.get(activePointers[0]);
        const second = this.pinchState.pointerPositions.get(activePointers[1]);
        if (!first || !second) return 0;

        return Math.hypot(first.x - second.x, first.y - second.y);
    },

    adjustZoom(delta) {
        const nextZoom = this.zoomLevel + (Number(delta) || 0);
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, nextZoom));
    },

    resetZoom() {
        this.zoomLevel = 1;
        this.pinchState.active = false;
        this.pinchState.lastDistance = 0;
        this.pinchState.pointerIds.clear();
        this.pinchState.pointerPositions.clear();
    },

    syncCanvasResolution() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const targetWidth = Math.max(1, Math.round(rect.width * dpr));
        const targetHeight = Math.max(1, Math.round(rect.height * dpr));
        if (this.canvas.width === targetWidth && this.canvas.height === targetHeight) return;
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;
    },

    getVisionRadius() {
        const rawConsciousness = Number(
            Input?.getSwordFormationProgress?.().consciousness
            ?? Input?.getSwordConsciousnessStat?.()
            ?? 0
        );
        const consciousness = Number.isFinite(rawConsciousness)
            ? Math.max(0, rawConsciousness)
            : 0;
        const scaledRadius = 220 + (Math.log1p(consciousness) * 120);
        return Math.min(4200, Math.max(220, scaledRadius));
    },

    render({ player, enemies }) {
        if (!this.ctx || !this.isOpen() || !player) return;
        this.syncCanvasResolution();

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const visionRadiusWorld = this.getVisionRadius();
        const baseMapWorldRange = Math.max(visionRadiusWorld * 2.1, 620);
        const mapWorldRange = Math.max(220, baseMapWorldRange / Math.max(this.minZoom, this.zoomLevel));
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
            this.hint.textContent = `Thần thức: ${Math.round(visionRadiusWorld)} | Quái hiện: ${visibleMonsterCount}/${monsterCount} | Zoom: x${this.zoomLevel.toFixed(2)} (lăn hoặc chụm để phóng/thu)`;
        }
    }
};
