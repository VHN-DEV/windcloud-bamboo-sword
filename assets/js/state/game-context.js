const GameContext = {
    services: {},
    register(name, service) {
        if (!name) return;
        this.services[name] = service;
    },
    get(name) {
        return this.services[name] || null;
    }
};

