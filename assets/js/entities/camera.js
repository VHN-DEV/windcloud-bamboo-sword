const Camera = {
    currentZoom: 1,
    targetZoom: 1,
    
    // Cần biến width, height từ hệ thống để tính toán chính xác
    update() {
        this.currentZoom += (this.targetZoom - this.currentZoom) * CONFIG.ZOOM.SMOOTH;
    },

    adjustZoom(amount) {
        this.targetZoom = Math.max(CONFIG.ZOOM.MIN, Math.min(CONFIG.ZOOM.MAX, this.targetZoom + amount));
    },

    /**
     * Chuyển đổi tọa độ từ màn hình (Screen) sang tọa độ trong game (World)
     * Dựa trên điểm trung tâm của canvas và mức độ Zoom hiện tại
     */
    screenToWorld(screenX, screenY) {
        // width và height được lấy từ biến global trong main script
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        return {
            x: (screenX - centerX) / this.currentZoom + centerX,
            y: (screenY - centerY) / this.currentZoom + centerY
        };
    }
};