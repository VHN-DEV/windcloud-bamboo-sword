const Camera = {
    currentZoom: 1,
    targetZoom: 1,
    centerX: (typeof width === 'number' ? width : window.innerWidth) / 2,
    centerY: (typeof height === 'number' ? height : window.innerHeight) / 2,
    zoomAnchorScreenX: null,
    zoomAnchorScreenY: null,
    zoomAnchorWorldX: null,
    zoomAnchorWorldY: null,
    
    // Cần biến width, height từ hệ thống để tính toán chính xác
    update() {
        const previousZoom = this.currentZoom;
        this.currentZoom += (this.targetZoom - this.currentZoom) * CONFIG.ZOOM.SMOOTH;

        // Giữ điểm neo (vị trí con trỏ/ngón tay) đứng yên trên màn hình khi zoom
        if (
            this.zoomAnchorScreenX !== null &&
            this.zoomAnchorScreenY !== null &&
            this.zoomAnchorWorldX !== null &&
            this.zoomAnchorWorldY !== null &&
            Math.abs(this.currentZoom - previousZoom) > 0.0001
        ) {
            const screenCenterX = (typeof width === 'number' ? width : window.innerWidth) / 2;
            const screenCenterY = (typeof height === 'number' ? height : window.innerHeight) / 2;

            this.centerX = this.zoomAnchorWorldX - (this.zoomAnchorScreenX - screenCenterX) / this.currentZoom;
            this.centerY = this.zoomAnchorWorldY - (this.zoomAnchorScreenY - screenCenterY) / this.currentZoom;
        }

        if (Math.abs(this.targetZoom - this.currentZoom) < 0.0001) {
            this.currentZoom = this.targetZoom;
            this.clearZoomAnchor();
        }
    },

    clearZoomAnchor() {
        this.zoomAnchorScreenX = null;
        this.zoomAnchorScreenY = null;
        this.zoomAnchorWorldX = null;
        this.zoomAnchorWorldY = null;
    },

    setZoomAnchor(screenX, screenY) {
        this.zoomAnchorScreenX = screenX;
        this.zoomAnchorScreenY = screenY;
        const worldPosition = this.screenToWorld(screenX, screenY);
        this.zoomAnchorWorldX = worldPosition.x;
        this.zoomAnchorWorldY = worldPosition.y;
    },

    adjustZoom(amount, screenX = (typeof width === 'number' ? width : window.innerWidth) / 2, screenY = (typeof height === 'number' ? height : window.innerHeight) / 2) {
        if (!Number.isFinite(amount) || amount === 0) return;
        this.setZoomAnchor(screenX, screenY);
        this.targetZoom = Math.max(CONFIG.ZOOM.MIN, Math.min(CONFIG.ZOOM.MAX, this.targetZoom + amount));
    },

    /**
     * Chuyển đổi tọa độ từ màn hình (Screen) sang tọa độ trong game (World)
     * Dựa trên điểm trung tâm của canvas và mức độ Zoom hiện tại
     */
    screenToWorld(screenX, screenY) {
        const centerX = (typeof width === 'number' ? width : window.innerWidth) / 2;
        const centerY = (typeof height === 'number' ? height : window.innerHeight) / 2;
        
        return {
            x: (screenX - centerX) / this.currentZoom + this.centerX,
            y: (screenY - centerY) / this.currentZoom + this.centerY
        };
    }
};
