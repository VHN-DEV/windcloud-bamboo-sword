InventoryUI = {
    overlay: document.getElementById('inventory-popup'),
    btnOpen: document.getElementById('btn-inventory'),
    btnClose: document.getElementById('close-inventory'),
    wallet: document.getElementById('inventory-wallet'),
    tabs: document.getElementById('inventory-tabs'),
    itemPanel: document.getElementById('inventory-panel-items'),
    pillGrid: document.getElementById('inventory-pill-grid'),
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

        if (this.pillGrid) {
            this.pillGrid.addEventListener('pointerdown', (e) => {
                const toggleBtn = e.target.closest('[data-description-toggle]');
                if (toggleBtn) {
                    e.stopPropagation();
                    toggleTrackedDescriptionCard(toggleBtn, this.expandedDescriptionIds);
                    return;
                }

                const actionBtn = e.target.closest('[data-item-key]');
                if (!actionBtn) return;

                e.stopPropagation();
                const itemKey = actionBtn.getAttribute('data-item-key');
                const action = actionBtn.getAttribute('data-action') || 'use';

                if (typeof Input.handleInventoryItemAction === 'function') {
                    Input.handleInventoryItemAction(itemKey, action);
                } else if (action === 'sell') {
                    Input.sellInventoryItem(itemKey);
                } else if (action === 'special') {
                    if (typeof Input.useInventoryItemSpecial === 'function') {
                        Input.useInventoryItemSpecial(itemKey);
                    }
                } else {
                    Input.useInventoryItem(itemKey);
                }
            });
        }

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });
    },

    render() {
        if (!this.wallet || !this.pillGrid) return;

        Input.selectedInventoryTab = 'items';
        this.wallet.innerHTML = buildWalletMarkup() + buildInventoryCapacityMarkup();
        if (this.itemPanel) {
            this.itemPanel.classList.add('is-active');
        }

        const inventorySummary = Input.getInventorySummary();
        const entries = inventorySummary.entries;
        const spiritStoneEntries = typeof Input.getSpiritStoneInventoryEntries === 'function'
            ? Input.getSpiritStoneInventoryEntries()
            : [];
        const normalCards = entries.map(item => {
            const qualityConfig = Input.getItemQualityConfig(item);
            const usable = Input.isInventoryItemUsable(item);
            const sellPrice = Input.getInventorySellPrice(item);
            const sellPriceMarkup = Input.renderSpiritStoneCostMarkup(sellPrice);
            const isArtifactBook = item.category === 'INSECT_ARTIFACT';
            const inventoryActionLabel = typeof Input.getInventoryItemActionLabel === 'function'
                ? Input.getInventoryItemActionLabel(item)
                : (item.category === 'BREAKTHROUGH' && !usable ? `Chờ ${item.realmName}` : 'Dùng');
            const secondaryAction = typeof Input.getInventoryItemSecondaryAction === 'function'
                ? Input.getInventoryItemSecondaryAction(item)
                : null;
            const secondaryActionLabel = secondaryAction?.label || 'Bán';
            const secondaryActionType = secondaryAction?.type || 'sell';
            const secondaryActionDisabled = secondaryAction
                ? Boolean(secondaryAction.disabled)
                : sellPrice <= 0;
            const defaultActions = [
                {
                    type: 'use',
                    label: isArtifactBook ? 'Xem' : inventoryActionLabel,
                    disabled: !usable,
                    variant: 'primary'
                },
                {
                    type: secondaryActionType,
                    label: secondaryActionLabel,
                    disabled: secondaryActionDisabled,
                    variant: 'secondary'
                }
            ];
            const actions = typeof Input.getInventoryItemActions === 'function'
                ? Input.getInventoryItemActions(item, defaultActions)
                : defaultActions;
            const actionMarkup = (Array.isArray(actions) ? actions : defaultActions)
                .filter(action => action && action.type)
                .map(action => `
                        <button
                            class="btn-slot-action${action.variant === 'secondary' ? ' is-secondary' : ''}"
                            data-action="${escapeHtml(action.type)}"
                            data-item-key="${escapeHtml(item.key)}"
                            ${action.disabled ? 'disabled' : ''}
                        >${escapeHtml(action.label || 'Dùng')}</button>
                    `)
                .join('');

            return `
                <article class="inventory-slot has-pill-art" style="--slot-accent:${qualityConfig.color}">
                    <div class="slot-badge">${formatNumber(item.count)}x</div>
                    ${buildPillVisualMarkup(item, qualityConfig, { context: 'inventory' })}
                    <h4>${escapeHtml(Input.getItemDisplayName(item))}</h4>
                    <div class="item-description" data-description-card data-description-id="${escapeHtml(item.key)}">${Input.getItemDescriptionMarkup(item)}</div>
                    <div class="slot-meta">Bán lại: ${formatNumber(sellPrice)} hạ phẩm linh thạch</div>
                    <div class="slot-meta slot-meta-price">
                        <span class="slot-meta-title">Bán lại</span>
                        ${sellPriceMarkup}
                    </div>
                    <div class="slot-actions">
                        ${actionMarkup}
                    </div>
                </article>
            `;
        });
        const spiritStoneCards = spiritStoneEntries.map(stone => `
            <article class="inventory-slot has-pill-art" style="--slot-accent:${escapeHtml(stone.color)}">
                <div class="slot-badge">${formatNumber(stone.count)}x</div>
                <div class="pill-visual is-material">
                    <span class="pill-visual__aura" style="--pill-aura:${escapeHtml(stone.color)}"></span>
                    <span class="pill-visual__core"></span>
                    <span class="pill-visual__spark"></span>
                    <span class="pill-visual__spark"></span>
                    <span class="pill-visual__spark"></span>
                </div>
                <h4>${escapeHtml(stone.label)}</h4>
                <div class="item-description">
                    Tinh hoa thiên địa ngưng tụ trong linh thạch. Luyện hoá 1 viên nhận <strong>${formatNumber(stone.lowValue)} tu vi</strong>.
                </div>
                <div class="slot-meta">Loại tiền tệ có thể chuyển thành tu vi</div>
                <div class="slot-actions">
                    <button
                        class="btn-slot-action"
                        data-action="refine"
                        data-item-key="${escapeHtml(stone.key)}"
                    >Luyện hoá</button>
                </div>
            </article>
        `);
        const cards = normalCards.concat(spiritStoneCards);

        const emptySlotCount = Math.max(0, CONFIG.ITEMS.INVENTORY_MIN_SLOTS - cards.length);
        for (let i = 0; i < emptySlotCount; i++) {
            cards.push('<article class="inventory-slot is-empty"><span>Ô trống</span></article>');
        }
        this.pillGrid.innerHTML = cards.join('');
        restoreTrackedDescriptionCards(this.pillGrid, this.expandedDescriptionIds);
    },

    open() {
        this.render();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    }
};
