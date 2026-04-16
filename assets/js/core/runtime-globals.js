const random = (min, max) => Math.random() * (max - min) + min;
const canvas = document.getElementById("c");
const enemyIcons = {};
const ctx = canvas.getContext("2d", { alpha: true });
const IS_TOUCH_ENVIRONMENT = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

let scaleFactor = 1;
let width, height;
let frameCount = 0;
let lastTime = performance.now();
let frameNow = lastTime;
let visualParticles = [];
let swordRenderBuffer = [];

function trimVisualParticles(limit = 320) {
    const safeLimit = Math.max(0, Math.floor(limit || 0));
    if (!safeLimit) {
        visualParticles.length = 0;
        return;
    }

    if (visualParticles.length > safeLimit) {
        visualParticles.splice(0, visualParticles.length - safeLimit);
    }
}

function preloadEnemyIcons() {
    return Promise.all(
        CONFIG.ENEMY.ANIMALS.map(path => {
            return new Promise(resolve => {
                const img = new Image();
                img.src = path;
                const key = path.split('/').pop().split('.')[0];

                img.onload = () => {
                    enemyIcons[key] = img;
                    resolve();
                };

                img.onerror = () => {
                    console.error("Failed to load icon:", path);
                    resolve(); // Không chặn game
                };
            });
        })
    );
}

function showNotify(text, color) {
    let container = document.getElementById('game-notification');
    if (!container) {
        container = document.createElement('div');
        container.id = 'game-notification';
        document.body.appendChild(container);
    }

    // Giới hạn tối đa 3 thông báo cùng lúc để màn hình gọn gàng
    if (container.children.length > 2) {
        container.removeChild(container.firstChild);
    }

    const item = document.createElement('div');
    item.className = 'notify-item';
    item.innerText = repairLegacyText(text);
    item.style.color = color;
    item.style.borderLeft = `3px solid ${color}`; // Thêm vạch màu nhỏ bên trái cho tinh tế

    container.appendChild(item);

    // Xóa sau 2.5 giây (khớp với thời gian animation)
    setTimeout(() => {
        item.remove();
    }, 2500);
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    scaleFactor = width / CONFIG.CORE.BASE_WIDTH;
    if (typeof window.starField?.resize === 'function') {
        window.starField.resize(width, height);
    }

    if (document.body) {
        document.body.classList.toggle('is-touch-device', IS_TOUCH_ENVIRONMENT);
        document.body.classList.toggle('is-mobile-landscape', IS_TOUCH_ENVIRONMENT && window.innerWidth > window.innerHeight);
    }
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
resize();

if (typeof GameContext !== 'undefined' && GameContext && typeof GameContext.register === 'function') {
    GameContext.register('runtime', {
        random,
        canvas,
        ctx,
        enemyIcons,
        get scaleFactor() { return scaleFactor; },
        get width() { return width; },
        get height() { return height; },
        get frameCount() { return frameCount; },
        set frameCount(value) { frameCount = value; },
        get frameNow() { return frameNow; },
        set frameNow(value) { frameNow = value; },
        get lastTime() { return lastTime; },
        set lastTime(value) { lastTime = value; },
        get visualParticles() { return visualParticles; },
        get swordRenderBuffer() { return swordRenderBuffer; },
        trimVisualParticles,
        preloadEnemyIcons,
        showNotify,
        resize
    });
}
