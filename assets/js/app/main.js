(function bootstrapMain() {
    if (typeof bootGame !== 'function') {
        console.error('[main.js] bootGame() chưa sẵn sàng. Hãy kiểm tra thứ tự load script.');
        return;
    }

    bootGame();
})();
