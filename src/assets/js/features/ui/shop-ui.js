ShopUI = {
    overlay: document.getElementById('shop-popup'),
    btnOpen: document.getElementById('btn-shop'),
    btnClose: document.getElementById('close-shop'),
    list: document.getElementById('shop-items'),
    wallet: document.getElementById('shop-wallet'),
    toolbar: document.getElementById('shop-toolbar'),
    pagination: document.getElementById('shop-pagination'),
    categoryFilter: 'DAN_DUOC',
    currentPage: 1,
    lastPageSize: 0,
    expandedDescriptionIds: new Set(),

    init() {
        if (!this.overlay || !this.btnOpen) return;

        const content = this.overlay.querySelector('.popup-content');
        if (content) {
            content.addEventListener('pointerdown', (e) => e.stopPropagation());
        }

        this.btnOpen.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.open();
        });

        if (this.btnClose) {
            this.btnClose.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        if (this.list) {
            this.list.addEventListener('pointerdown', (e) => {
                const toggleBtn = e.target.closest('[data-description-toggle]');
                if (toggleBtn) {
                    e.stopPropagation();
                    toggleTrackedDescriptionCard(toggleBtn, this.expandedDescriptionIds);
                    return;
                }

                const actionBtn = e.target.closest('[data-shop-id]');
                if (!actionBtn) return;

                e.stopPropagation();
                Input.buyShopItem(actionBtn.getAttribute('data-shop-id'));
            });
        }

        if (this.pagination) {
            this.pagination.addEventListener('pointerdown', (e) => {
                const pageBtn = e.target.closest('[data-shop-page-target]');
                if (!pageBtn) return;

                e.stopPropagation();
                const targetPage = parseInt(pageBtn.getAttribute('data-shop-page-target'), 10);
                if (!Number.isNaN(targetPage)) {
                    this.currentPage = targetPage;
                    this.render();
                }
            });
        }

        if (this.toolbar) {
            this.toolbar.addEventListener('pointerdown', (e) => {
                const tabBtn = e.target.closest('[data-shop-tab]');
                if (tabBtn) {
                    e.stopPropagation();
                    const nextTab = tabBtn.getAttribute('data-shop-tab') || 'DAN_DUOC';
                    if (this.categoryFilter !== nextTab) {
                        this.categoryFilter = nextTab;
                        this.currentPage = 1;
                        this.render();
                    }
                    return;
                }
            });
        }

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });

        window.addEventListener('resize', () => {
            if (!this.overlay.classList.contains('show')) return;

            const nextPageSize = this.getPageSize();
            if (nextPageSize !== this.lastPageSize) {
                this.render();
            }
        });
    },

    getPageSize() {
        return window.innerWidth <= 720 ? 4 : 8;
    },

    buildPaginationTargets(totalPages) {
        const pages = new Set();

        for (let page = 1; page <= totalPages; page++) {
            const isEdge = page === 1 || page === totalPages;
            const isNearCurrent = Math.abs(page - this.currentPage) <= 1;
            if (totalPages <= 5 || isEdge || isNearCurrent) {
                pages.add(page);
            }
        }

        return [...pages].sort((a, b) => a - b);
    },

    renderPagination(totalItems, totalPages) {
        if (!this.pagination) return;

        if (!totalItems) {
            this.pagination.innerHTML = '';
            return;
        }

        const pages = this.buildPaginationTargets(totalPages);
        const pageButtons = [];

        pages.forEach((page, index) => {
            const prevPage = pages[index - 1];
            if (index > 0 && page - prevPage > 1) {
                pageButtons.push('<span class="shop-page-gap">...</span>');
            }

            pageButtons.push(`
                <button
                    type="button"
                    class="btn-shop-page ${page === this.currentPage ? 'is-active' : ''}"
                    data-shop-page-target="${page}"
                    ${page === this.currentPage ? 'disabled' : ''}
                >${page}</button>
            `);
        });

        this.pagination.innerHTML = `
            <button
                type="button"
                class="btn-shop-page btn-shop-page-nav"
                data-shop-page-target="${Math.max(1, this.currentPage - 1)}"
                ${this.currentPage === 1 ? 'disabled' : ''}
            aria-label="Trang trước"
                title="Trang trước"
            ><span aria-hidden="true">&lt;</span></button>
            <div class="shop-page-list">${pageButtons.join('')}</div>
            <button
                type="button"
                class="btn-shop-page btn-shop-page-nav"
                data-shop-page-target="${Math.min(totalPages, this.currentPage + 1)}"
                ${this.currentPage === totalPages ? 'disabled' : ''}
            aria-label="Trang sau"
                title="Trang sau"
            ><span aria-hidden="true">&gt;</span></button>
        `;
    },

    renderItems(items) {
        if (!this.list) return;

        if (!items.length) {
            this.list.innerHTML = `<div class="shop-empty">${UI_TEXT.SHOP_EMPTY}</div>`;
            return;
        }

        const cards = items.map(item => {
            const qualityConfig = Input.getItemQualityConfig(item);
            const isOwnedUnique = Boolean(item.isOneTime && item.uniqueKey && Input.hasUniquePurchase(item.uniqueKey));
            const hasDedicatedHabitat = item.category === 'SPIRIT_HABITAT' && Boolean(Input.insectHabitats?.[item.speciesKey]);
            const hasRainbowHabitat = item.category === 'SPIRIT_HABITAT' && Input.hasSevenColorSpiritBag();
            const canStoreOrUpgrade = this.canStoreOrUpgrade(item, isOwnedUnique);
            const isLimitedStock = Number.isFinite(item.shopStockRemaining);
            const hasStock = !isLimitedStock || item.shopStockRemaining > 0;
            const canAfford = !Input.isVoidCollapsed && canStoreOrUpgrade && hasStock && Input.canAffordLowStoneCost(item.priceLowStone);
            const priceMarkup = Input.renderSpiritStoneCostMarkup(item.priceLowStone);
            const actionLabel = this.getActionLabel(item, {
                canStoreOrUpgrade,
                isOwnedUnique,
                hasDedicatedHabitat,
                hasRainbowHabitat,
                hasStock
            });
            const cornerStockText = this.getPurchasableStockText(item, {
                isLimitedStock,
                isOwnedUnique,
                canStoreOrUpgrade,
                hasDedicatedHabitat,
                hasRainbowHabitat
            });

            return `
                <article class="shop-card has-pill-art" style="--slot-accent:${qualityConfig.color}">
                    <div class="shop-card-topline">
                        <div class="slot-badge">${escapeHtml(Input.getItemCategoryLabel(item))}</div>
                        ${cornerStockText
                            ? `<div class="shop-card-corner-meta">
                                <span>${escapeHtml(cornerStockText)}</span>
                            </div>`
                            : ''
                        }
                    </div>
                    ${buildPillVisualMarkup(item, qualityConfig, { context: 'shop' })}
                    <h4>${escapeHtml(Input.getItemDisplayName(item))}</h4>
                    <div class="item-description" data-description-card data-description-id="${escapeHtml(item.id)}">${Input.getItemDescriptionMarkup(item)}</div>
                    <div class="slot-meta">Giá: ${formatNumber(item.priceLowStone)} hạ phẩm linh thạch</div>
                    <div class="slot-meta slot-meta-price">
                        <span class="slot-meta-title">Giá</span>
                        ${priceMarkup}
                    </div>
                    <button class="btn-slot-action" data-shop-id="${escapeHtml(item.id)}" ${canAfford ? '' : 'disabled'}>${escapeHtml(actionLabel)}</button>
                </article>
            `;
        }).join('');

        this.list.innerHTML = cards;
        restoreTrackedDescriptionCards(this.list, this.expandedDescriptionIds);
    },

    render() {
        if (!this.wallet || !this.list || !this.toolbar || !this.pagination) return;

        this.wallet.innerHTML = buildWalletMarkup();
        this.ensureToolbar();

        const allItems = Input.getShopItems();
        const { filteredItems, tabTotalCount } = this.getFilteredResult(allItems);
        const pageSize = this.getPageSize();
        const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

        this.lastPageSize = pageSize;
        this.currentPage = Math.min(Math.max(1, this.currentPage), totalPages);

        const startIndex = (this.currentPage - 1) * pageSize;
        const pagedItems = filteredItems.slice(startIndex, startIndex + pageSize);

        this.syncToolbar(tabTotalCount, filteredItems.length);
        this.renderItems(pagedItems);
        this.renderPagination(filteredItems.length, totalPages);
    },

    open() {
        this.render();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    }
};

ShopUI.canStoreOrUpgrade = function (item, isOwnedUnique) {
    if (['BAG', 'RAINBOW_BAG'].includes(item.category)) {
        return Input.canUpgradeInventoryCapacity(item);
    }

    if (['SPIRIT_BAG', 'RAINBOW_SPIRIT_BAG', 'SPIRIT_HABITAT'].includes(item.category)) {
        return Input.canUpgradeBeastBagCapacity(item);
    }

    if (item.category === 'INSECT_EGG') {
        return true;
    }

    if (item.category === 'ALCHEMY_RECIPE' || item.category === 'ALCHEMY_FURNACE') {
        return !isOwnedUnique;
    }

    if (item.category === 'SWORD_ARTIFACT') {
        return Input.hasInventorySpaceForSpec(item);
    }

    return !isOwnedUnique && Input.hasInventorySpaceForSpec(item);
};

ShopUI.getPurchasableStockText = function (item, options = {}) {
    const {
        isLimitedStock = false,
        isOwnedUnique = false,
        canStoreOrUpgrade = false,
        hasDedicatedHabitat = false,
        hasRainbowHabitat = false
    } = options;

    if (isLimitedStock) {
        const remaining = Math.max(0, Math.floor(Number(item.shopStockRemaining) || 0));
        const maxStock = Math.max(remaining, Math.floor(Number(item.shopStockMax) || 0));
        return `${formatNumber(remaining)}/${formatNumber(maxStock)} món`;
    }

    if (item.isOneTime) {
        return `${isOwnedUnique ? '0' : '1'}/1 món`;
    }

    if (item.category === 'SPIRIT_HABITAT' && hasRainbowHabitat) {
        return '0 món';
    }

    if (item.category === 'SPIRIT_HABITAT' && !hasDedicatedHabitat) {
        return 'vô hạn';
    }

    return canStoreOrUpgrade ? 'vô hạn' : '0 món';
};

ShopUI.getActionLabel = function (item, options = {}) {
    const {
        canStoreOrUpgrade = false,
        isOwnedUnique = false,
        hasDedicatedHabitat = false,
        hasRainbowHabitat = false,
        hasStock = true
    } = options;

    if (!hasStock) return 'Hết hàng';

    if (item.category === 'BAG') {
        return canStoreOrUpgrade ? 'Khai mở' : 'Duyên pháp chưa hợp';
    }

    if (item.category === 'SWORD_ARTIFACT') {
        return canStoreOrUpgrade ? (CONFIG.SWORD?.ARTIFACT_ITEM?.buttonLabel || 'Mua') : 'Túi trữ vật đã mãn';
    }

    if (item.category === 'SWORD_ART' || item.category === 'FLAME_ART') {
        return isOwnedUnique ? 'Đã mua' : (canStoreOrUpgrade ? 'Mua' : 'Túi trữ vật đã mãn');
    }

    if (item.category === 'ARTIFACT') {
        if (isOwnedUnique) return 'Đã mua';
        return canStoreOrUpgrade
            ? (CONFIG.ARTIFACTS?.[item.uniqueKey]?.buttonLabel || 'Mua')
            : 'Túi trữ vật đã mãn';
    }

    if (item.category === 'RAINBOW_BAG') {
        return isOwnedUnique ? 'Đã khai mở' : (canStoreOrUpgrade ? 'Mua' : 'Duyên pháp chưa hợp');
    }

    if (item.category === 'SPIRIT_BAG') {
        return canStoreOrUpgrade ? 'Khai mở' : 'Duyên pháp chưa hợp';
    }

    if (item.category === 'RAINBOW_SPIRIT_BAG') {
        return isOwnedUnique ? 'Đã khai mở' : (canStoreOrUpgrade ? 'Mua' : 'Duyên pháp chưa hợp');
    }

    if (item.category === 'SPIRIT_HABITAT') {
        return hasRainbowHabitat ? 'Không cần thêm' : (hasDedicatedHabitat ? 'Khai mở' : 'Mua');
    }

    if (item.category === 'INSECT_EGG') {
        return 'Mua';
    }

    if (item.category === 'INSECT_SKILL') {
        return isOwnedUnique
            ? 'Đã lĩnh ngộ'
            : (canStoreOrUpgrade ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.buttonLabel || 'Mua') : 'Túi trữ vật đã mãn');
    }

    if (item.category === 'INSECT_ARTIFACT') {
        return isOwnedUnique ? 'Đã mua' : (canStoreOrUpgrade ? 'Mua' : 'Túi trữ vật đã mãn');
    }

    if (item.category === 'ALCHEMY_RECIPE') {
        return isOwnedUnique ? 'Đã lĩnh ngộ' : 'Mua';
    }

    if (item.category === 'ALCHEMY_FURNACE') {
        return isOwnedUnique ? 'Đã mua' : 'Mua';
    }

    return canStoreOrUpgrade ? 'Mua' : 'Túi trữ vật đã mãn';
};

ShopUI.ensureToolbar = function () {
    if (!this.toolbar || this.toolbar.dataset.ready === 'true') return;

    this.toolbar.innerHTML = `
        <div class="shop-tip" id="shop-tip"></div>
        <div class="panel-tabs shop-tabs" id="shop-tabs">
            ${ITEM_COLLECTION_TABS.filter(tab => tab.key !== 'KHAC').map(tab => `
                <button class="panel-tab" type="button" data-shop-tab="${tab.key}">
                    ${escapeHtml(tab.label)}
                </button>
            `).join('')}
        </div>
        <div class="shop-toolbar-meta">
            <div id="shop-summary" class="shop-summary"></div>
        </div>
    `;

    this.toolbar.dataset.ready = 'true';
};

ShopUI.syncToolbar = function (totalCount, filteredCount) {
    if (!this.toolbar) return;

    const nextRealm = Input.getNextMajorRealmInfo();
    const tip = nextRealm
        ? `Thiên Bảo Các đang bày bán đủ loại đan dược, đan phương, đan lư và bí pháp cho lần đột phá tới ${escapeHtml(nextRealm.name)}.`
        : 'Đã ở cảnh giới tối cao, Thiên Bảo Các vẫn còn đan cường hóa và pháp bảo đặc biệt.';

    const tipEl = this.toolbar.querySelector('#shop-tip');
    const summaryEl = this.toolbar.querySelector('#shop-summary');

    if (tipEl) tipEl.innerHTML = tip;

    this.toolbar.querySelectorAll('[data-shop-tab]').forEach(tabBtn => {
        tabBtn.classList.toggle('is-active', tabBtn.getAttribute('data-shop-tab') === this.categoryFilter);
    });

    if (summaryEl) {
        summaryEl.innerHTML = `${escapeHtml(getItemCollectionTabLabel(this.categoryFilter))}: ${formatShopSummaryText(filteredCount, totalCount)}`;
    }
};

ShopUI.filterItems = function (items) {
    return this.getFilteredResult(items).filteredItems;
};

ShopUI.getFilteredResult = function (items) {
    const filteredItems = [];

    items.forEach(item => {
        const tabKey = getItemCollectionTabKey(item);
        if (tabKey !== this.categoryFilter) {
            return;
        }

        filteredItems.push(item);
    });

    return { filteredItems, tabTotalCount: filteredItems.length };
};
