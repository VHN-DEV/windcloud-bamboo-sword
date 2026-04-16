function isTouchOverUiControl(touch) {
    const hitTarget = Input.getTouchHitTarget(touch?.target, touch?.clientX, touch?.clientY);
    return Input.isUiInteractionTarget(hitTarget);
}

function canUseTouchPinchZoom(touches) {
    if (!Input.isTouchDevice || !touches || touches.length !== 2) return false;
    if (Input.isVoidCollapsed || hasVisiblePopupOverlay()) return false;
    if (Input.moveJoystick.active || Input.isAttacking) return false;

    return Array.from(touches).every(touch => !isTouchOverUiControl(touch));
}

window.addEventListener('pointerdown', e => {
    if (Input.isTouchDevice && e.pointerType && e.pointerType !== 'mouse') {
        Input.requestLandscapeMode();
    }
}, { capture: true });
window.addEventListener('pointermove', e => Input.handleMove(e));
window.addEventListener('pointerdown', e => Input.handleDown(e));
window.addEventListener('pointerup', e => Input.handleUp(e));
window.addEventListener('pointercancel', e => Input.handleUp(e));
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

window.addEventListener('touchstart', e => {
    if (canUseTouchPinchZoom(e.touches)) {
        Input.pinchZoomActive = true;
        Input.initialPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        return;
    }

    Input.initialPinchDist = 0;
    Input.pinchZoomActive = false;

    if (e.touches.length >= 2 && (Input.moveJoystick.active || Input.isAttacking || Array.from(e.touches).some(isTouchOverUiControl))) {
        e.preventDefault();
    }
}, { passive: false });

window.addEventListener('touchmove', e => {
    if (canUseTouchPinchZoom(e.touches)) {
        e.preventDefault();
        Input.pinchZoomActive = true;
        const currentDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (currentDist - Input.initialPinchDist) * 0.01;
        Camera.adjustZoom(delta);
        Input.initialPinchDist = currentDist;
        return;
    }

    Input.initialPinchDist = 0;
    Input.pinchZoomActive = false;

    if (e.touches.length >= 2 && (Input.moveJoystick.active || Input.isAttacking || Array.from(e.touches).some(isTouchOverUiControl))) {
        e.preventDefault();
    }
}, { passive: false });

window.addEventListener('touchend', e => {
    if (e.touches.length < 2) {
        Input.initialPinchDist = 0;
        Input.pinchZoomActive = false;
    }
}, { passive: false });

window.addEventListener('touchcancel', () => {
    Input.initialPinchDist = 0;
    Input.pinchZoomActive = false;
}, { passive: false });

