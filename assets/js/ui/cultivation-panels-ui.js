SkillsUI = {
    overlay: document.getElementById('skills-popup'),
    btnOpen: document.getElementById('btn-skill-list'),
    btnClose: document.getElementById('close-skills'),
    list: document.getElementById('attack-skill-list'),
    currentTab: 'BI_PHAP',

    isOpen() {
        return Boolean(this.overlay && this.overlay.classList.contains('show'));
    },

    init() {
        if (!this.overlay || !this.btnOpen || !this.list) return;

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

        this.list.addEventListener('pointerdown', (e) => {
            const tabBtn = e.target.closest('[data-skill-tab]');
            if (tabBtn) {
                e.stopPropagation();
                const nextTab = tabBtn.getAttribute('data-skill-tab') || 'BI_PHAP';
                if (this.currentTab !== nextTab) {
                    this.currentTab = nextTab;
                    this.render();
                }
                return;
            }

            const toggleBtn = e.target.closest('[data-insect-toggle]');
            if (toggleBtn) {
                e.stopPropagation();
                e.preventDefault();

                if (Input.toggleInsectSpeciesCombatEnabled(toggleBtn.getAttribute('data-insect-toggle'))) {
                    this.render();
                }
                return;
            }

            const artifactBtn = e.target.closest('[data-artifact-toggle]');
            if (artifactBtn) {
                e.stopPropagation();
                e.preventDefault();

                if (Input.toggleArtifactDeployment(artifactBtn.getAttribute('data-artifact-toggle'))) {
                    this.render();
                }
                return;
            }

            const skillBtn = e.target.closest('[data-attack-skill]');
            if (!skillBtn) return;

            e.stopPropagation();
            const skillKey = skillBtn.getAttribute('data-attack-skill');
            const changed = Input.attackMode === skillKey
                ? Input.clearAttackSkill()
                : Input.setAttackMode(skillKey);

            if (changed) {
                this.render();
                this.close();
            }
        });

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });
    },

    renderTabsMarkup() {
        return `
            <div class="panel-tabs attack-skill-tabs">
                <button class="panel-tab ${this.currentTab === 'BI_PHAP' ? 'is-active' : ''}" type="button" data-skill-tab="BI_PHAP">Bí pháp</button>
                <button class="panel-tab ${this.currentTab === 'PHAP_BAO' ? 'is-active' : ''}" type="button" data-skill-tab="PHAP_BAO">Pháp bảo</button>
            </div>
        `;
    },

    renderInsectRosterMarkup(skill) {
        if (skill.key !== 'INSECT' || !skill.unlocked) return '';

        if (!skill.roster?.length) {
            return `
                <div class="attack-skill-card__roster is-empty">
                    <span>Chưa có linh trùng nào đủ duyên nhập trận.</span>
                </div>
            `;
        }

        return `
            <div class="attack-skill-card__roster">
                <div class="attack-skill-card__roster-head">
                    <strong>Trùng trận hiện có</strong>
                    <span>${escapeHtml(skill.rosterSummary || '')}</span>
                </div>
                <div class="insect-toggle-list">
                    ${skill.roster.map(entry => `
                        <button
                            class="insect-toggle-chip ${entry.enabled ? 'is-enabled' : ''}"
                            type="button"
                            data-insect-toggle="${escapeHtml(entry.speciesKey)}"
                            style="--toggle-accent:${entry.accent}"
                            aria-pressed="${entry.enabled ? 'true' : 'false'}"
                        >
                            <span class="insect-toggle-chip__title">${escapeHtml(entry.name)}</span>
                            <span class="insect-toggle-chip__meta">${formatNumber(entry.count)} linh trùng | ${escapeHtml(entry.modeLabel)}</span>
                            <span class="insect-toggle-chip__note">${escapeHtml(entry.note)}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderCurrentStateMarkup() {
        const currentMode = Input.attackMode;
        const title = Input.getAttackModeDisplayName(currentMode);
        const activeArtifacts = Input.getActiveArtifactNames();
        const swordProgress = Input.getSwordFormationProgress();
        const summary = currentMode === 'INSECT'
            ? `${formatNumber(Input.getCombatReadyInsectCount())} linh trùng đang bày trùng trận.`
            : currentMode === 'SWORD'
                ? `${formatNumber(Input.getAliveSwordStats().alive)} kiếm đang hộ trận.`
                : `${formatNumber(getBaseSwordCountBeforeFormation())} thanh bản mệnh kiếm đang hộ thân.`;
        const description = currentMode === 'INSECT'
            ? 'Bí pháp ngự trùng đang vận chuyển, lấy đàn trùng làm công sát chủ đạo.'
            : currentMode === 'SWORD'
                ? 'Kiếm ý đã khai trận, kiếm quang trấn thủ quanh thân.'
                : 'Chưa vận chuyển bí pháp nào, kiếm tu đang trở về kiếm thế sơ khởi.';
        const artifactText = activeArtifacts.length
            ? `Pháp bảo hộ thể: ${activeArtifacts.join(', ')}.`
            : 'Hiện chưa triển khai pháp bảo hộ thể nào.';

        return `
            <article class="attack-skill-state" style="--skill-accent:${currentMode === 'INSECT' ? '#79ffd4' : '#8fffe0'}">
                <span class="attack-skill-state__eyebrow">Đạo trạng hiện tại</span>
                <strong class="attack-skill-state__title">${escapeHtml(title)}</strong>
                <p class="attack-skill-state__description">${escapeHtml(description)}</p>
                <span class="attack-skill-state__summary">${escapeHtml(summary)}</span>
                <span class="attack-skill-state__summary">${escapeHtml(artifactText)}</span>
            </article>
        `;
    },

    renderArtifactStateMarkup() {
        const artifactList = Input.getArtifactSkillList();
        const activeArtifacts = artifactList.filter(entry => entry.active);
        const unlockedCount = artifactList.filter(entry => entry.unlocked).length;
        const purchasedCount = artifactList.filter(entry => entry.purchased).length;
        const title = activeArtifacts.length
            ? activeArtifacts.map(entry => entry.name).join(', ')
            : 'Chưa triển khai pháp bảo';
        const description = activeArtifacts.length
            ? 'Linh dực phong lôi đang bám theo tâm niệm, hộ trì hai bên con trỏ chuột.'
            : 'Pháp bảo sau khi luyện hóa có thể khai triển hoặc thu hồi ngay trong bảng này.';
        const summary = unlockedCount > 0
            ? `${formatNumber(activeArtifacts.length)} đang triển khai | ${formatNumber(unlockedCount)} đã luyện hóa | ${formatNumber(purchasedCount)} đã kết duyên`
            : purchasedCount > 0
                ? `Đã kết duyên ${formatNumber(purchasedCount)} pháp bảo nhưng còn chờ luyện hóa`
                : 'Chưa có pháp bảo nào nhập túi trữ vật';

        return `
            <article class="attack-skill-state" style="--skill-accent:${activeArtifacts[0]?.accent || '#9fe8ff'}">
                <span class="attack-skill-state__eyebrow">Pháp bảo hộ thể</span>
                <strong class="attack-skill-state__title">${escapeHtml(title)}</strong>
                <p class="attack-skill-state__description">${escapeHtml(description)}</p>
                <span class="attack-skill-state__summary">${escapeHtml(summary)}</span>
            </article>
        `;
    },

    renderAttackSkillsMarkup() {
        return Input.getAttackSkillList().map(skill => `
            <article class="attack-skill-card ${skill.active ? 'is-active' : ''} ${!skill.unlocked || !skill.ready ? 'is-disabled' : ''}" style="--skill-accent:${skill.accent}">
                <div class="attack-skill-card__head">
                    <div>
                        <h4>${escapeHtml(skill.name)}</h4>
                        <p>${escapeHtml(skill.description)}</p>
                    </div>
                    <span class="attack-skill-card__tag">${skill.active ? 'Đang vận chuyển' : (skill.unlocked ? 'Đã lĩnh ngộ' : 'Chưa lĩnh ngộ')}</span>
                </div>
                <div class="attack-skill-card__foot">
                    <span>${escapeHtml(skill.note)}</span>
                    <button class="btn-slot-action" type="button" data-attack-skill="${escapeHtml(skill.key)}" ${skill.unlocked && skill.ready ? '' : 'disabled'}>
                        ${skill.active ? 'Thu hồi' : 'Khai triển'}
                    </button>
                </div>
                ${this.renderInsectRosterMarkup(skill)}
            </article>
        `).join('');
    },

    renderArtifactCardsMarkup() {
        return Input.getArtifactSkillList().map(artifact => {
            const artifactConfig = Input.getArtifactConfig(artifact.uniqueKey) || {};
            const actionLabel = artifact.active
                ? (artifactConfig.stowLabel || 'Thu hồi')
                : (artifactConfig.deployLabel || 'Triển khai');
            const statusLabel = artifact.active
                ? 'Đang triển khai'
                : artifact.unlocked
                    ? 'Đã luyện hóa'
                    : artifact.purchased
                        ? 'Đã mua'
                        : 'Chưa kết duyên';

            return `
                <article class="attack-skill-card ${artifact.active ? 'is-active' : ''} ${!artifact.unlocked ? 'is-disabled' : ''}" style="--skill-accent:${artifact.accent}">
                    <div class="attack-skill-card__head">
                        <div>
                            <h4>${escapeHtml(artifact.name)}</h4>
                            <p>${escapeHtml(artifact.description)}</p>
                        </div>
                        <span class="attack-skill-card__tag">${escapeHtml(statusLabel)}</span>
                    </div>
                    <div class="attack-skill-card__foot">
                        <span>${escapeHtml(artifact.note)}</span>
                        <button class="btn-slot-action" type="button" data-artifact-toggle="${escapeHtml(artifact.uniqueKey)}" ${artifact.unlocked ? '' : 'disabled'}>
                            ${escapeHtml(actionLabel)}
                        </button>
                    </div>
                </article>
            `;
        }).join('');
    },

    render() {
        if (!this.list) return;

        const panelMarkup = this.currentTab === 'PHAP_BAO'
            ? this.renderArtifactStateMarkup() + this.renderArtifactCardsMarkup()
            : this.renderCurrentStateMarkup() + this.renderAttackSkillsMarkup();

        this.list.innerHTML = `
            ${this.renderTabsMarkup()}
            <div class="attack-skill-panel">
                ${panelMarkup}
            </div>
        `;
    },

    open() {
        this.render();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    }
};

SkillsUI.renderCurrentStateMarkup = function () {
    const currentMode = Input.attackMode;
    const title = Input.getAttackModeDisplayName(currentMode);
    const activeArtifacts = Input.getActiveArtifactNames();
    const swordProgress = Input.getSwordFormationProgress();
    const summary = currentMode === 'INSECT'
        ? `${formatNumber(Input.getCombatReadyInsectCount())} linh trùng đang bày trùng trận.`
        : currentMode === 'SWORD'
            ? `${formatNumber(Input.getAliveSwordStats().alive)} kiếm đang hộ trận.`
            : `${formatNumber(swordProgress.bonded)} thanh Thanh Trúc Phong Vân Kiếm đang hộ thân.`;
    const description = currentMode === 'INSECT'
        ? 'Bí pháp ngự trùng đang vận chuyển, lấy đàn trùng làm công sát chủ đạo.'
        : currentMode === 'SWORD'
            ? 'Kiếm ý đã khai trận, kiếm quang trấn thủ quanh thân.'
            : swordProgress.bonded > 0
                ? (swordProgress.ready ? 'Thanh Trúc Phong Vân Kiếm đang xạ quanh tâm theo đúng số đã triển khai; khi khai Đại Canh Kiếm Trận chỉ vận dụng 72 thanh.' : 'Thanh Trúc Phong Vân Kiếm đang tách thành các phân kiếm hộ thân, chờ gom đủ 72 thanh để khai đại trận.')
                : 'Chưa triển khai Thanh Trúc Phong Vân Kiếm nào, cần kết duyên thêm tại Linh Thị Cửa Hàng.';
    const artifactText = activeArtifacts.length
        ? `Pháp bảo hộ thể: ${activeArtifacts.join(', ')}.`
        : 'Hiện chưa triển khai pháp bảo hộ thể nào.';

    return `
        <article class="attack-skill-state" style="--skill-accent:${currentMode === 'INSECT' ? '#79ffd4' : '#8fffe0'}">
            <span class="attack-skill-state__eyebrow">Đạo trạng hiện tại</span>
            <strong class="attack-skill-state__title">${escapeHtml(title)}</strong>
            <p class="attack-skill-state__description">${escapeHtml(description)}</p>
            <span class="attack-skill-state__summary">${escapeHtml(summary)}</span>
            <span class="attack-skill-state__summary">${escapeHtml(artifactText)}</span>
        </article>
    `;
};

InsectBookUI = {
    overlay: document.getElementById('insect-book-popup'),
    btnClose: document.getElementById('close-insect-book'),
    summary: document.getElementById('insect-book-summary'),
    grid: document.getElementById('insect-book-grid'),

    isOpen() {
        return Boolean(this.overlay && this.overlay.classList.contains('show'));
    },

    init() {
        if (!this.overlay || !this.grid) return;

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
    },

    render() {
        if (!this.summary || !this.grid) return;

        const beastSummary = Input.getBeastSummary();
        this.summary.innerHTML = `
            <div class="book-summary">
                <div class="book-summary__card">
                    <span>Đã mở</span>
                    <strong>${formatNumber(beastSummary.discoveredCount)}/${formatNumber(beastSummary.speciesTotal)} mục</strong>
                </div>
                <div class="book-summary__card">
                    <span>Trứng noãn</span>
                    <strong>${formatNumber(beastSummary.totalEggs)}</strong>
                </div>
                <div class="book-summary__card">
                    <span>Linh trùng</span>
                    <strong>${formatNumber(beastSummary.totalBeasts)}/${formatNumber(beastSummary.capacity)}</strong>
                </div>
            </div>
        `;

        this.grid.innerHTML = Input.getInsectSpeciesEntries().map(([speciesKey, species]) => {
            const discovered = Boolean(Input.discoveredInsects[speciesKey]);
            const tier = Input.getInsectTierInfo(species.tier);
            const eggCount = Input.insectEggs[speciesKey] || 0;
            const beastCount = Input.tamedInsects[speciesKey] || 0;

            return `
                <article class="insect-book-card ${discovered ? 'is-discovered' : 'is-locked'}" style="${buildInsectBookStyleVars(species)}">
                    <div class="insect-book-card__image-wrap">
                        ${buildInsectArtMarkup(speciesKey)}
                        <span class="insect-book-card__tier">${escapeHtml(tier.label)}</span>
                        ${discovered ? '' : '<span class="insect-book-card__veil">Chưa thu thập</span>'}
                    </div>
                    <div class="insect-book-card__body">
                        <h4>${escapeHtml(species.name)}</h4>
                        ${getInsectStyleHint(species) ? `<div class="insect-book-card__style">${escapeHtml(getInsectStyleHint(species))}</div>` : ''}
                        <p>${escapeHtml(species.description)}</p>
                        <div class="insect-book-card__meta">
                            ${getInsectStyleLabel(species) ? `<span>${escapeHtml(getInsectStyleLabel(species))}</span>` : ''}
                            <span>Trứng ${formatNumber(eggCount)}</span>
                            <span>Đã nở ${formatNumber(beastCount)}</span>
                        </div>
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

ProfileUI = {
    overlay: document.getElementById('profile-popup'),
    btnOpen: document.getElementById('btn-profile'),
    btnClose: document.getElementById('close-profile'),
    overview: document.getElementById('profile-overview'),
    statsGrid: document.getElementById('profile-stats-grid'),
    wallet: document.getElementById('profile-wallet'),
    pills: document.getElementById('profile-pills'),

    isOpen() {
        return Boolean(this.overlay && this.overlay.classList.contains('show'));
    },

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

        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) this.close();
        });

        this.render();
    },

    render() {
        if (!this.overview || !this.statsGrid || !this.wallet || !this.pills) return;

        const rank = Input.getCurrentRank();
        const majorRealm = Input.getCurrentMajorRealmInfo();
        const breakthroughChance = Input.getCurrentBreakthroughChance();
        const swordStats = Input.getAliveSwordStats();
        const inventorySummary = Input.getInventorySummary();
        const displayName = Input.getPlayerDisplayName();
        const accent = getRankAccentColor(rank);
        const accentLight = getRankLightColor(rank);
        const rageLabel = Input.getUltimateResourceLabel();
        const attackModeLabel = Input.getAttackModeDisplayName();
        const swordMetricLabel = Input.attackMode === 'SWORD' ? 'Kiếm trận' : 'Bản mệnh kiếm';
        const combatPillCount = (inventorySummary.categories.ATTACK || 0)
            + (inventorySummary.categories.SHIELD_BREAK || 0)
            + (inventorySummary.categories.BERSERK || 0)
            + (inventorySummary.categories.RAGE || 0);
        const supportPillCount = (inventorySummary.categories.MANA || 0)
            + (inventorySummary.categories.MAX_MANA || 0)
            + (inventorySummary.categories.REGEN || 0)
            + (inventorySummary.categories.SPEED || 0)
            + (inventorySummary.categories.FORTUNE || 0)
            + (inventorySummary.categories.INSIGHT || 0)
            + (inventorySummary.categories.EXP || 0);
        const beastSummary = Input.getBeastSummary();

        this.btnOpen.setAttribute('title', `${displayName} - ${rank?.name || 'Chưa nhập đạo'}`);
        this.btnOpen.setAttribute('aria-label', `Mở hồ sơ của ${displayName}`);

        this.overview.innerHTML = `
            <article class="profile-hero__card is-accent" style="--profile-accent:${accent};--profile-light:${accentLight}">
                <div class="profile-hero__identity">
                    <div class="profile-hero__avatar" aria-hidden="true">
                        <img class="profile-hero__avatar-icon" src="./assets/images/sword-light.svg" alt="">
                    </div>
                    <div>
                        <div class="profile-hero__eyebrow">Đạo hiệu</div>
                        <h4 class="profile-hero__title">${escapeHtml(displayName)}</h4>
                        <div class="profile-hero__subtitle">${escapeHtml(majorRealm?.name || 'Phàm giới')} • ${escapeHtml(rank?.name || 'Chưa nhập đạo')}</div>
                    </div>
                </div>
                <div class="profile-hero__chips">
                    <span class="profile-chip">Tu vi<strong>${formatNumber(Input.exp)}/${formatNumber(rank?.exp || 0)}</strong></span>
                    <span class="profile-chip">Đột phá<strong>${Math.round(breakthroughChance * 100)}%</strong></span>
                    <span class="profile-chip">${escapeHtml(swordMetricLabel)}<strong>${swordStats.alive}/${swordStats.total}</strong></span>
                    <span class="profile-chip">Linh trùng<strong>${formatNumber(beastSummary.totalBeasts)}</strong></span>
                </div>
            </article>
            <article class="profile-hero__card">
                <div class="profile-hero__eyebrow">Tình trạng hiện tại</div>
                <div class="profile-hero__chips">
                    <span class="profile-chip is-soft">Linh lực<strong>${formatNumber(Input.mana)}/${formatNumber(Input.maxMana)}</strong></span>
                    <span class="profile-chip is-soft">${escapeHtml(rageLabel)}<strong>${formatNumber(Input.rage)}/${formatNumber(Input.maxRage)}</strong></span>
                    <span class="profile-chip is-soft">Sát thương<strong>${formatNumber(Input.getEffectiveAttackDamage())}</strong></span>
                    <span class="profile-chip is-soft">Linh thạch<strong>${formatNumber(Input.getSpiritStoneTotalValue())}</strong></span>
                    <span class="profile-chip is-soft">Bí pháp<strong>${escapeHtml(attackModeLabel)}</strong></span>
                </div>
            </article>
        `;

        const stats = [
            { label: 'Cảnh giới', value: rank?.name || 'Chưa nhập đạo' },
            { label: 'Đại cảnh giới', value: majorRealm?.name || 'Phàm giới' },
            { label: 'Tu vi', value: `${formatNumber(Input.exp)}/${formatNumber(rank?.exp || 0)}` },
            { label: 'Linh lực', value: `${formatNumber(Input.mana)}/${formatNumber(Input.maxMana)}` },
            { label: rageLabel, value: `${formatNumber(Input.rage)}/${formatNumber(Input.maxRage)}` },
            { label: 'Sát thương', value: `≈ ${formatNumber(Input.getEffectiveAttackDamage())}` },
            { label: 'Công lực', value: formatBoostPercent(Input.getAttackMultiplier()) },
            { label: 'Phá khiên', value: formatBoostPercent(Input.getShieldBreakMultiplier()) },
            { label: 'Tốc độ', value: formatBoostPercent(Input.getSpeedMultiplier()) },
            { label: 'Hồi linh', value: formatBoostPercent(Input.getManaRegenMultiplier()) },
            { label: 'Vận khí', value: formatBoostPercent(Input.getDropRateMultiplier()) },
            { label: 'Tỉ lệ đột phá', value: `${Math.round(breakthroughChance * 100)}%` },
            { label: swordMetricLabel, value: `${swordStats.alive}/${swordStats.total}` },
            { label: 'Kiếm hỏng', value: `${swordStats.broken}` },
            { label: 'Linh trùng', value: `${formatNumber(beastSummary.totalBeasts)}/${formatNumber(beastSummary.capacity)}` },
            { label: 'Trứng noãn', value: `${formatNumber(beastSummary.totalEggs)}` },
            { label: 'Kỳ trùng đã mở', value: `${formatNumber(beastSummary.discoveredCount)}/${formatNumber(beastSummary.speciesTotal)}` },
            { label: 'Túi trữ vật', value: `${formatNumber(inventorySummary.uniqueCount)}/${formatNumber(inventorySummary.capacity)} ô` },
            { label: 'Ô trống', value: `${formatNumber(inventorySummary.freeSlots)}` }
        ];

        this.statsGrid.innerHTML = stats.map(stat => `
            <article class="profile-stat-card" style="--profile-accent:${accent}">
                <span class="profile-stat-label">${escapeHtml(stat.label)}</span>
                <strong class="profile-stat-value">${escapeHtml(stat.value)}</strong>
            </article>
        `).join('');

        this.wallet.innerHTML = buildWalletMarkup();

        if (!inventorySummary.entries.length) {
            this.pills.innerHTML = '<div class="profile-empty">Túi đan dược còn trống, chỉ mới tích lũy linh thạch và khí tức nền tảng.</div>';
            return;
        }

        const categoryOrder = Object.keys(CONFIG.PILL.CATEGORY_SORT || {});
        const categoryMarkup = Object.entries(inventorySummary.categories)
            .sort((a, b) => {
                const aIndex = categoryOrder.indexOf(a[0]);
                const bIndex = categoryOrder.indexOf(b[0]);
                return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
            })
            .map(([category, count]) => `
                <span class="profile-chip is-soft">
                    ${escapeHtml(Input.getItemCategoryLabel({ category }))}
                    <strong>${formatNumber(count)}</strong>
                </span>
            `)
            .join('');

        const featuredMarkup = inventorySummary.entries.slice(0, 4).map(item => `
            <div class="profile-pill-entry">
                <span>${escapeHtml(Input.getItemDisplayName(item))}</span>
                <strong>${formatNumber(item.count)}x</strong>
            </div>
        `).join('');

        this.pills.innerHTML = `
            <div class="profile-pill-summary">
                <article class="profile-stat-card" style="--profile-accent:${accent}">
                    <span class="profile-stat-label">Tổng đan</span>
                    <strong class="profile-stat-value">${formatNumber(inventorySummary.totalCount)}</strong>
                </article>
                <article class="profile-stat-card" style="--profile-accent:${accent}">
                    <span class="profile-stat-label">Số loại</span>
                    <strong class="profile-stat-value">${formatNumber(inventorySummary.uniqueCount)}</strong>
                </article>
                <article class="profile-stat-card" style="--profile-accent:${accent}">
                    <span class="profile-stat-label">Đan chiến đấu</span>
                    <strong class="profile-stat-value">${formatNumber(combatPillCount)}</strong>
                </article>
                <article class="profile-stat-card" style="--profile-accent:${accent}">
                    <span class="profile-stat-label">Đan hỗ trợ</span>
                    <strong class="profile-stat-value">${formatNumber(supportPillCount)}</strong>
                </article>
            </div>
            <div class="profile-chip-grid">${categoryMarkup}</div>
            <div class="profile-pill-list">${featuredMarkup}</div>
        `;
    },

    open() {
        this.render();
        openPopup(this.overlay);
    },

    close() {
        closePopup(this.overlay);
    }
};
