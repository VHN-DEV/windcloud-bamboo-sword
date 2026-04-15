ShopUI = {
    overlay: document.getElementById('shop-popup'),
    btnOpen: document.getElementById('btn-shop'),
    btnClose: document.getElementById('close-shop'),
    list: document.getElementById('shop-items'),
    wallet: document.getElementById('shop-wallet'),
    toolbar: document.getElementById('shop-toolbar'),
    pagination: document.getElementById('shop-pagination'),
    searchQuery: '',
    categoryFilter: 'DAN_DUOC',
    qualityFilter: 'ALL',
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

        this.overlay.addEventListener('input', (e) => {
            if (e.target.id !== 'shop-search') return;

            e.stopPropagation();
            this.searchQuery = e.target.value || '';
            this.currentPage = 1;
            this.render();
        });

        this.overlay.addEventListener('change', (e) => {
            if (e.target.id === 'shop-filter-quality') {
                this.qualityFilter = e.target.value || 'ALL';
                this.currentPage = 1;
                this.render();
            }
        });

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

                const resetBtn = e.target.closest('[data-shop-action="reset-filters"]');
                if (!resetBtn) return;

                e.stopPropagation();
                this.searchQuery = '';
                this.categoryFilter = 'DAN_DUOC';
                this.qualityFilter = 'ALL';
                this.currentPage = 1;
                this.render();
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
        const pages = [];

        for (let page = 1; page <= totalPages; page++) {
            const isEdge = page === 1 || page === totalPages;
            const isNearCurrent = Math.abs(page - this.currentPage) <= 1;
            if (totalPages <= 5 || isEdge || isNearCurrent) {
                pages.push(page);
            }
        }

        return pages.filter((page, index) => pages.indexOf(page) === index)
            .sort((a, b) => a - b);
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
            >Trước</button>
            <div class="shop-page-list">${pageButtons.join('')}</div>
            <div class="shop-page-status">Trang ${this.currentPage}/${totalPages}</div>
            <button
                type="button"
                class="btn-shop-page btn-shop-page-nav"
                data-shop-page-target="${Math.min(totalPages, this.currentPage + 1)}"
                ${this.currentPage === totalPages ? 'disabled' : ''}
            >Sau</button>
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
            const swordProgress = item.category === 'SWORD_ARTIFACT' ? Input.getSwordFormationProgress() : null;
            const canStoreOrUpgrade = item.category === 'BAG'
                ? Input.canUpgradeInventoryCapacity(item)
                : item.category === 'RAINBOW_BAG'
                    ? Input.canUpgradeInventoryCapacity(item)
                    : item.category === 'SPIRIT_BAG'
                        ? Input.canUpgradeBeastBagCapacity(item)
                        : item.category === 'RAINBOW_SPIRIT_BAG'
                            ? Input.canUpgradeBeastBagCapacity(item)
                            : item.category === 'SPIRIT_HABITAT'
                                ? Input.canUpgradeBeastBagCapacity(item)
                                : item.category === 'INSECT_EGG'
                                    ? true
                                    : item.category === 'SWORD_ARTIFACT'
                                        ? Input.hasInventorySpaceForSpec(item)
                                    : (!isOwnedUnique && Input.hasInventorySpaceForSpec(item));
            const canAfford = !Input.isVoidCollapsed && canStoreOrUpgrade && Input.canAffordLowStoneCost(item.priceLowStone);
            const priceMarkup = Input.renderSpiritStoneCostMarkup(item.priceLowStone);
            let actionLabel = item.category === 'BAG'
                ? (canStoreOrUpgrade ? 'Mở rộng' : 'Không hợp lệ')
                : (canStoreOrUpgrade ? 'Mua' : 'Túi đầy');

            if (item.category === 'SWORD_ARTIFACT') {
                actionLabel = canStoreOrUpgrade
                    ? (CONFIG.SWORD?.ARTIFACT_ITEM?.buttonLabel || 'Mua')
                    : (canStoreOrUpgrade ? (CONFIG.SWORD?.ARTIFACT_ITEM?.buttonLabel || 'Mua') : 'Túi đầy');
                actionLabel = canStoreOrUpgrade
                    ? (CONFIG.SWORD?.ARTIFACT_ITEM?.buttonLabel || 'Mua')
                    : 'Túi đầy';
            } else if (item.category === 'SWORD_ART' || item.category === 'FLAME_ART') {
                actionLabel = isOwnedUnique ? 'Đã mua' : (canStoreOrUpgrade ? 'Mua' : 'Túi đầy');
            } else if (item.category === 'ARTIFACT') {
                actionLabel = isOwnedUnique
                    ? 'Đã mua'
                    : (canStoreOrUpgrade ? (CONFIG.ARTIFACTS?.[item.uniqueKey]?.buttonLabel || 'Mua') : 'Túi đầy');
            } else if (item.category === 'RAINBOW_BAG') {
                actionLabel = isOwnedUnique ? 'Đã khai mở' : (canStoreOrUpgrade ? 'Mua' : 'Không hợp lệ');
            } else if (item.category === 'SPIRIT_BAG') {
                actionLabel = canStoreOrUpgrade ? 'Mở rộng' : 'Không hợp lệ';
            } else if (item.category === 'RAINBOW_SPIRIT_BAG') {
                actionLabel = isOwnedUnique ? 'Đã khai mở' : (canStoreOrUpgrade ? 'Mua' : 'Không hợp lệ');
            } else if (item.category === 'SPIRIT_HABITAT') {
                actionLabel = hasRainbowHabitat ? 'Không cần' : (hasDedicatedHabitat ? 'Mở rộng' : 'Mua');
            } else if (item.category === 'INSECT_EGG') {
                actionLabel = 'Mua';
            } else if (item.category === 'INSECT_SKILL') {
                actionLabel = isOwnedUnique ? 'Đã mua' : (canStoreOrUpgrade ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.buttonLabel || 'Mua') : 'Túi đầy');
            } else if (item.category === 'INSECT_ARTIFACT') {
                actionLabel = isOwnedUnique ? 'Đã sở hữu' : (canStoreOrUpgrade ? 'Mua' : 'Túi đầy');
            }

            return `
                <article class="shop-card has-pill-art" style="--slot-accent:${qualityConfig.color}">
                    <div class="slot-badge">${escapeHtml(Input.getItemCategoryLabel(item))}</div>
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
        const filteredItems = this.filterItems(allItems);
        const tabTotalCount = allItems.filter(item => getItemCollectionTabKey(item) === this.categoryFilter).length;
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

ShopUI.ensureToolbar = function () {
    if (!this.toolbar || this.toolbar.dataset.ready === 'true') return;

    const qualityOptions = ['ALL', ...QUALITY_ORDER].map(quality => {
        const label = quality === 'ALL' ? 'Tất cả phẩm chất' : getQualityLabel(quality);
        return `<option value="${quality}">${escapeHtml(label)}</option>`;
    }).join('');

    this.toolbar.innerHTML = `
        <div class="shop-tip" id="shop-tip"></div>
        <div class="panel-tabs shop-tabs" id="shop-tabs">
            ${ITEM_COLLECTION_TABS.filter(tab => tab.key !== 'KHAC').map(tab => `
                <button class="panel-tab" type="button" data-shop-tab="${tab.key}">
                    ${escapeHtml(tab.label)}
                </button>
            `).join('')}
        </div>
        <div class="shop-toolbar-row">
            <label class="shop-field shop-field-search">
                <span>Tìm kiếm</span>
                <input id="shop-search" class="shop-control-input" type="search" placeholder="Tên đan, túi, công dụng, phẩm chất...">
            </label>
            <div class="shop-filter-group">
                <label class="shop-field">
                    <span>Phẩm chất</span>
                    <select id="shop-filter-quality" class="shop-control-input">${qualityOptions}</select>
                </label>
            </div>
        </div>
        <div class="shop-toolbar-meta">
            <div id="shop-summary" class="shop-summary"></div>
            <button type="button" class="btn-shop-reset" data-shop-action="reset-filters">${UI_TEXT.SHOP_RESET_FILTERS}</button>
        </div>
    `;

    this.toolbar.dataset.ready = 'true';
};

ShopUI.syncToolbar = function (totalCount, filteredCount) {
    if (!this.toolbar) return;

    const nextRealm = Input.getNextMajorRealmInfo();
    const tip = nextRealm
        ? `Đang bày bán đủ loại đan dược, bí pháp và vật tư cho lần đột phá tới ${escapeHtml(nextRealm.name)}.`
        : 'Đã ở cảnh giới tối cao, cửa hàng vẫn còn đan cường hóa và vật phẩm đặc biệt.';

    const tipEl = this.toolbar.querySelector('#shop-tip');
    const searchEl = this.toolbar.querySelector('#shop-search');
    const qualityEl = this.toolbar.querySelector('#shop-filter-quality');
    const summaryEl = this.toolbar.querySelector('#shop-summary');
    const resetBtn = this.toolbar.querySelector('[data-shop-action="reset-filters"]');

    if (tipEl) tipEl.innerHTML = tip;
    if (searchEl && searchEl.value !== this.searchQuery) searchEl.value = this.searchQuery;
    if (qualityEl && qualityEl.value !== this.qualityFilter) qualityEl.value = this.qualityFilter;

    this.toolbar.querySelectorAll('[data-shop-tab]').forEach(tabBtn => {
        tabBtn.classList.toggle('is-active', tabBtn.getAttribute('data-shop-tab') === this.categoryFilter);
    });

    if (summaryEl) {
        summaryEl.innerHTML = `${escapeHtml(getItemCollectionTabLabel(this.categoryFilter))}: ${formatShopSummaryText(filteredCount, totalCount)}`;
    }

    if (resetBtn) {
        resetBtn.disabled = !this.searchQuery && this.categoryFilter === 'DAN_DUOC' && this.qualityFilter === 'ALL';
    }
};

ShopUI.filterItems = function (items) {
    const query = normalizeSearchText(this.searchQuery);

    return items.filter(item => {
        if (getItemCollectionTabKey(item) !== this.categoryFilter) {
            return false;
        }

        if (this.qualityFilter !== 'ALL' && item.quality !== this.qualityFilter) {
            return false;
        }

        if (!query) return true;

        const haystack = normalizeSearchText([
            Input.getItemDisplayName(item),
            Input.getItemDescription(item),
            Input.getItemCategoryLabel(item),
            getQualityLabel(item.quality),
            item.realmName || '',
            getItemCollectionTabLabel(getItemCollectionTabKey(item))
        ].join(' '));

        return haystack.includes(query);
    });
};
