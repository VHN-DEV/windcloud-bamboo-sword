function formatAlchemyCountdown(ms) {
    const safeMs = Math.max(0, Math.floor(Number(ms) || 0));
    const totalSeconds = Math.max(1, Math.ceil(safeMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
        return `${formatNumber(minutes)}m ${formatNumber(seconds)}s`;
    }

    return `${formatNumber(totalSeconds)}s`;
}

AlchemyUI = {
    overlay: document.getElementById('alchemy-popup'),
    btnOpen: document.getElementById('btn-alchemy-lab'),
    btnClose: document.getElementById('close-alchemy'),
    status: document.getElementById('alchemy-status'),
    recipeGrid: document.getElementById('alchemy-recipe-grid'),

    init() {
        this.overlay = document.getElementById('alchemy-popup') || this.overlay;
        this.btnOpen = document.getElementById('btn-alchemy-lab') || this.btnOpen;
        this.btnClose = document.getElementById('close-alchemy') || this.btnClose;
        this.status = document.getElementById('alchemy-status') || this.status;
        this.recipeGrid = document.getElementById('alchemy-recipe-grid') || this.recipeGrid;

        if (this.btnOpen) {
            this.btnOpen.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (this.btnOpen.classList.contains('is-hidden')) return;
                this.open();
            });
        }

        if (!this.overlay) return;

        const content = this.overlay.querySelector('.popup-content');
        if (content) {
            content.addEventListener('pointerdown', (e) => e.stopPropagation());
        }

        if (this.btnClose) {
            this.btnClose.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });

        if (this.recipeGrid) {
            this.recipeGrid.addEventListener('pointerdown', (e) => {
                const craftBtn = e.target.closest('[data-alchemy-recipe]');
                if (!craftBtn) return;
                e.stopPropagation();
                const recipeKey = craftBtn.getAttribute('data-alchemy-recipe') || '';
                if (!recipeKey || typeof Input.craftAlchemyRecipe !== 'function') return;
                Input.craftAlchemyRecipe(recipeKey);
                this.render();
            });
        }
    },

    isOpen() {
        return Boolean(this.overlay && this.overlay.classList.contains('show'));
    },

    getRecipeModels() {
        const recipeDefs = typeof Input.getAlchemyRecipeDefinitions === 'function'
            ? Input.getAlchemyRecipeDefinitions()
            : (CONFIG.ALCHEMY?.RECIPES || {});
        return Object.entries(recipeDefs)
            .filter(([recipeKey]) => typeof Input.canUseAlchemyRecipe === 'function' ? Input.canUseAlchemyRecipe(recipeKey) : true)
            .map(([recipeKey, recipe]) => {
                const outputSpec = {
                    kind: 'PILL',
                    category: recipe?.output?.category || 'EXP',
                    quality: recipe?.output?.quality || 'LOW',
                    realmKey: recipe?.output?.realmKey || null,
                    realmName: recipe?.output?.realmName || null,
                    specialKey: recipe?.output?.specialKey || null
                };
                const outputName = Input.getItemDisplayName(outputSpec);
                const outputDescription = typeof Input.getItemDescription === 'function'
                    ? Input.getItemDescription(outputSpec)
                    : '';
                const requirements = Array.isArray(recipe.ingredients)
                    ? recipe.ingredients.map(ingredient => {
                        const need = Math.max(1, Math.floor(Number(ingredient.count) || 0));
                        const owned = typeof Input.getRecipeOwnedIngredientCount === 'function'
                            ? Input.getRecipeOwnedIngredientCount(ingredient.materialKey)
                            : 0;
                        const materialConfig = Input.getMaterialConfig(ingredient.materialKey) || {};
                        return {
                            key: ingredient.materialKey,
                            name: materialConfig.fullName || ingredient.materialKey,
                            need,
                            owned,
                            ok: owned >= need
                        };
                    })
                    : [];

                return {
                    key: recipeKey,
                    name: recipe?.name || recipeKey,
                    formulaQuality: recipe?.formulaQuality || 'LOW',
                    tier: recipe?.realmTier || 'Đan',
                    outputName,
                    outputDescription,
                    brewTimeMs: Math.max(1000, Math.floor(Number(recipe?.brewTimeMs) || Number(CONFIG.ALCHEMY?.DEFAULT_BREW_MS) || 30000)),
                    canCraft: requirements.every(req => req.ok),
                    requirements
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    },

    render() {
        if (!this.overlay || !this.status || !this.recipeGrid) return;

        const hasHuThienPurchased = Input.hasArtifactPurchased('HU_THIEN_DINH') || Input.hasArtifactUnlocked('HU_THIEN_DINH');
        const ownedFurnaces = typeof Input.getOwnedAlchemyFurnaceKeys === 'function' ? Input.getOwnedAlchemyFurnaceKeys() : [];
        const canUseDing = typeof Input.canUseHuThienDinhForAlchemy === 'function' && Input.canUseHuThienDinhForAlchemy();
        const activeBatch = Input.alchemyBatch || null;
        const remainingMs = typeof Input.getAlchemyBatchRemainingMs === 'function' ? Input.getAlchemyBatchRemainingMs() : 0;
        const selectedFurnace = typeof Input.getCurrentAlchemyFurnaceConfig === 'function' ? Input.getCurrentAlchemyFurnaceConfig() : null;
        const usingHuThien = Input.hasArtifactUnlocked('HU_THIEN_DINH') && Input.isArtifactDeployed('HU_THIEN_DINH');
        const activeFurnaceName = usingHuThien ? 'Hư Thiên Đỉnh (pháp bảo)' : (selectedFurnace?.name || 'Chưa định đan lư');

        if (!hasHuThienPurchased && !ownedFurnaces.length) {
            this.status.innerHTML = '<div class="profile-empty">Chưa có Hư Thiên Đỉnh hoặc đan lư. Hãy đến Thiên Bảo Các thỉnh bảo rồi quay lại khai lò luyện đan.</div>';
            this.recipeGrid.innerHTML = '';
            return;
        }

        if (activeBatch && remainingMs > 0) {
            const outputName = Input.getItemDisplayName({ category: activeBatch.outputCategory, quality: activeBatch.outputQuality });
            this.status.innerHTML = `<div class="profile-empty">Đang luyện ${escapeHtml(outputName)} • Lò: ${escapeHtml(activeFurnaceName)} • Còn ${escapeHtml(formatAlchemyCountdown(remainingMs))}.</div>`;
        } else if (!canUseDing) {
            this.status.innerHTML = '<div class="profile-empty">Đã có đan lư nhưng chưa khai triển Hư Thiên Đỉnh. Vẫn có thể khai lò bằng đan lư thường.</div>';
        } else {
            this.status.innerHTML = `<div class="profile-empty">${escapeHtml(activeFurnaceName)} đã sẵn sàng. Chọn đan phương bên dưới để khai lò luyện đan.</div>`;
        }

        const recipes = this.getRecipeModels();
        if (!recipes.length) {
            this.recipeGrid.innerHTML = '<article class="inventory-slot is-empty"><span>Chưa sở hữu đan phương nào. Hãy thỉnh ở tab Đan phương trong Thiên Bảo Các.</span></article>';
            return;
        }

        this.recipeGrid.innerHTML = recipes.map(recipe => {
            const reqMarkup = recipe.requirements.map(req => `
                <li>${escapeHtml(req.name)}: <strong style="color:${req.ok ? '#8fffcf' : '#ff8a80'}">${formatNumber(req.owned)}/${formatNumber(req.need)}</strong></li>
            `).join('');
            const formulaLabel = CONFIG.ALCHEMY?.FORMULA_QUALITY_LABELS?.[recipe.formulaQuality] || 'Đan phương';
            const isBusy = activeBatch && remainingMs > 0;

            return `
                <article class="inventory-slot has-pill-art" style="--slot-accent:${recipe.canCraft ? '#8fffcf' : '#7aa3b7'}">
                    <div class="slot-badge">${escapeHtml(formulaLabel)}</div>
                    <h4>${escapeHtml(recipe.name)}</h4>
                    <p>${escapeHtml(recipe.tier)} • Thành đan: ${escapeHtml(recipe.outputName)}</p>
                    <p>Mô tả tác dụng: ${escapeHtml(recipe.outputDescription || 'Đan dược này sẽ cường hóa căn cơ theo phẩm chất tương ứng.')}</p>
                    <p>Thời gian luyện cơ bản: ${escapeHtml(formatAlchemyCountdown(recipe.brewTimeMs))}</p>
                    <ul class="alchemy-requirements">${reqMarkup}</ul>
                    <div class="slot-actions">
                        <button
                            class="btn-slot-action"
                            data-alchemy-recipe="${escapeHtml(recipe.key)}"
                            ${recipe.canCraft && canUseDing && !isBusy ? '' : 'disabled'}
                        >Luyện đan</button>
                    </div>
                </article>
            `;
        }).join('');
    },

    open() {
        this.render();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    }
};
