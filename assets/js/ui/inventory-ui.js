InventoryUI = {
    overlay: document.getElementById('inventory-popup'),
    btnOpen: document.getElementById('btn-inventory'),
    btnClose: document.getElementById('close-inventory'),
    wallet: document.getElementById('inventory-wallet'),
    tabs: document.getElementById('inventory-tabs'),
    itemPanel: document.getElementById('inventory-panel-items'),
    stonePanel: document.getElementById('inventory-panel-stones'),
    pillGrid: document.getElementById('inventory-pill-grid'),
    stoneGrid: document.getElementById('inventory-stone-grid'),
    currentTab: 'items',

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

        if (this.pillGrid) {
            this.pillGrid.addEventListener('pointerdown', (e) => {
                const toggleBtn = e.target.closest('[data-description-toggle]');
                if (toggleBtn) {
                    e.stopPropagation();
                    toggleDescriptionCard(toggleBtn.closest('[data-description-card]'));
                    return;
                }

                const actionBtn = e.target.closest('[data-item-key]');
                if (!actionBtn) return;

                e.stopPropagation();
                const itemKey = actionBtn.getAttribute('data-item-key');
                const action = actionBtn.getAttribute('data-action') || 'use';

                if (action === 'sell') {
                    Input.sellInventoryItem(itemKey);
                } else {
                    Input.useInventoryItem(itemKey);
                }
            });
        }

        if (this.tabs) {
            this.tabs.addEventListener('pointerdown', (e) => {
                const tabBtn = e.target.closest('[data-inventory-tab]');
                if (!tabBtn) return;

                e.stopPropagation();
                this.currentTab = tabBtn.getAttribute('data-inventory-tab') || 'items';
                Input.selectedInventoryTab = this.currentTab;
                this.render();
            });
        }

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });
    },

    render() {
        if (!this.wallet || !this.pillGrid || !this.stoneGrid) return;

        this.currentTab = Input.selectedInventoryTab || this.currentTab || 'items';
        if (!['items', 'stones'].includes(this.currentTab)) {
            this.currentTab = 'items';
            Input.selectedInventoryTab = 'items';
        }
        this.wallet.innerHTML = buildWalletMarkup() + buildInventoryCapacityMarkup();

        if (this.tabs) {
            this.tabs.querySelectorAll('[data-inventory-tab]').forEach(tabBtn => {
                tabBtn.classList.toggle('is-active', tabBtn.getAttribute('data-inventory-tab') === this.currentTab);
            });
        }

        [
            { panel: this.itemPanel, key: 'items' },
            { panel: this.stonePanel, key: 'stones' }
        ].forEach(entry => {
            if (!entry.panel) return;
            entry.panel.classList.toggle('is-active', entry.key === this.currentTab);
        });

        const inventorySummary = Input.getInventorySummary();
        const entries = inventorySummary.entries;
        const cards = entries.map(item => {
            const qualityConfig = Input.getItemQualityConfig(item);
            const usable = Input.isInventoryItemUsable(item);
            const sellPrice = Input.getInventorySellPrice(item);
            const sellPriceMarkup = Input.renderSpiritStoneCostMarkup(sellPrice);
            const isArtifactBook = item.category === 'INSECT_ARTIFACT';
            const inventoryActionLabel = item.category === 'SWORD_ARTIFACT'
                ? (CONFIG.SWORD?.ARTIFACT_ITEM?.inventoryActionLabel || 'Triển khai')
                : item.category === 'SWORD_ART'
                ? (CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.inventoryActionLabel || 'Lĩnh ngộ')
                : item.category === 'FLAME_ART'
                    ? (CONFIG.SECRET_ARTS?.CAN_LAM_BANG_DIEM?.inventoryActionLabel || 'Luyện hóa')
                    : item.category === 'ARTIFACT'
                        ? (CONFIG.ARTIFACTS?.[item.uniqueKey]?.inventoryActionLabel || 'Luyện hóa')
                        : item.category === 'INSECT_SKILL'
                            ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.inventoryActionLabel || 'Lĩnh ngộ')
                            : null;
            const label = item.category === 'BREAKTHROUGH' && !usable
                ? `Chờ ${item.realmName}`
                : 'Dùng';

            return `
                <article class="inventory-slot has-pill-art" style="--slot-accent:${qualityConfig.color}">
                    <div class="slot-badge">${formatNumber(item.count)}x</div>
                    ${buildPillVisualMarkup(item, qualityConfig, { context: 'inventory' })}
                    <h4>${escapeHtml(Input.getItemDisplayName(item))}</h4>
                    <div class="item-description" data-description-card>${Input.getItemDescriptionMarkup(item)}</div>
                    <div class="slot-meta">Bán lại: ${formatNumber(sellPrice)} hạ phẩm linh thạch</div>
                    <div class="slot-meta slot-meta-price">
                        <span class="slot-meta-title">Bán lại</span>
                        ${sellPriceMarkup}
                    </div>
                    <div class="slot-actions">
                        <button class="btn-slot-action" data-action="use" data-item-key="${escapeHtml(item.key)}" ${usable ? '' : 'disabled'}>${escapeHtml(isArtifactBook ? 'Xem' : (inventoryActionLabel || label))}</button>
                        <button class="btn-slot-action is-secondary" data-action="sell" data-item-key="${escapeHtml(item.key)}" ${sellPrice > 0 ? '' : 'disabled'}>Bán</button>
                    </div>
                </article>
            `;
        });

        const emptySlotCount = Math.max(0, CONFIG.ITEMS.INVENTORY_MIN_SLOTS - cards.length);
        for (let i = 0; i < emptySlotCount; i++) {
            cards.push('<article class="inventory-slot is-empty"><span>Ô trống</span></article>');
        }
        this.pillGrid.innerHTML = cards.join('');

        this.stoneGrid.innerHTML = STONE_ORDER.map(quality => {
            const stoneType = Input.getSpiritStoneType(quality);

            return `
                <article class="inventory-slot stone-slot" style="--slot-accent:${stoneType.color}">
                    <div class="slot-badge">Linh thạch</div>
                    <h4>${escapeHtml(stoneType.label)}</h4>
                    <p>Quy đổi: ${formatNumber(stoneType.value)} hạ phẩm linh thạch.</p>
                    <div class="slot-count">${formatNumber(Input.spiritStones[quality] || 0)}</div>
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
