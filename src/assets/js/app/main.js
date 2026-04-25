(function bootstrapMain() {
    if (typeof canvas === 'undefined' || !canvas || typeof ctx === 'undefined' || !ctx) {
        return;
    }

    if (typeof bootGame !== 'function') {
        console.error('[main.js] bootGame() chua san sang. Hay kiem tra thu tu load script.');
        return;
    }

    bootGame();
})();
