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

let pendingPointerMoveEvent = null;
let pointerMoveRafId = 0;
function flushPointerMove() {
    pointerMoveRafId = 0;
    if (!pendingPointerMoveEvent) return;
    Input.handleMove(pendingPointerMoveEvent);
    pendingPointerMoveEvent = null;
}

window.addEventListener('pointermove', e => {
    pendingPointerMoveEvent = e;
    if (pointerMoveRafId) return;
    pointerMoveRafId = requestAnimationFrame(flushPointerMove);
});
window.addEventListener('pointerdown', e => Input.handleDown(e));
window.addEventListener('pointerup', e => Input.handleUp(e));
window.addEventListener('pointercancel', e => Input.handleUp(e));
window.addEventListener('wheel', e => {
    const hitTarget = typeof Input.getTouchHitTarget === 'function'
        ? Input.getTouchHitTarget(e.target, e.clientX, e.clientY)
        : e.target;

    // Ưu tiên cuộn nội dung popup/UI, không ép zoom khi con trỏ đang ở vùng giao diện.
    if (typeof Input.isUiInteractionTarget === 'function' && Input.isUiInteractionTarget(hitTarget)) {
        return;
    }

    e.preventDefault();
    Camera.adjustZoom(-e.deltaY * CONFIG.ZOOM.SENSITIVITY, e.clientX, e.clientY);
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
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        Camera.adjustZoom(delta, centerX, centerY);
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
