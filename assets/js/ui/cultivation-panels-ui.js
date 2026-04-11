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
            <article class="attack-skill-state" style="--skill-accent:${currentMode === 'INSECT' ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.color || '#ff92c2') : (CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.color || '#ffd36b')}">
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
        <article class="attack-skill-state" style="--skill-accent:${currentMode === 'INSECT' ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.color || '#ff92c2') : (CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.color || '#ffd36b')}">
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
        const swordProgress = Input.getSwordFormationProgress();
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
                        <img class="profile-hero__avatar-icon" src="${CONFIG.IMAGES?.UI?.PROFILE_SWORD || ''}" alt="">
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
                    <span class="profile-chip is-soft">Thần thức<strong>${formatNumber(swordProgress.consciousness)}</strong></span>
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
            { label: 'Thần thức', value: `${formatNumber(swordProgress.consciousness)}` },
            { label: 'Giới hạn kiếm hộ thân', value: `${formatNumber(swordProgress.capacity)}` },
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

Object.assign(SkillsUI, {
    expandedSwordArtifactPanel: false,
    swordRosterScrollTop: 0,
    swordRosterScrollLockUntil: 0,

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

            const secretArtBtn = e.target.closest('[data-secret-art-use]');
            if (secretArtBtn) {
                e.stopPropagation();
                e.preventDefault();

                if (Input.useInventoryItem(secretArtBtn.getAttribute('data-secret-art-use'))) {
                    this.render();
                }
                return;
            }

            const secretArtCastBtn = e.target.closest('[data-secret-art-cast]');
            if (secretArtCastBtn) {
                e.stopPropagation();
                e.preventDefault();

                if (typeof Input.castCanLamBangDiem === 'function' && Input.castCanLamBangDiem()) {
                    this.render();
                    this.close();
                }
                return;
            }

            const swordPanelBtn = e.target.closest('[data-sword-artifact-toggle]');
            if (swordPanelBtn) {
                e.stopPropagation();
                e.preventDefault();
                this.expandedSwordArtifactPanel = !this.expandedSwordArtifactPanel;
                this.render();
                return;
            }

            const swordActionBtn = e.target.closest('[data-sword-instance-action]');
            if (swordActionBtn) {
                e.stopPropagation();
                e.preventDefault();

                const instanceKey = swordActionBtn.getAttribute('data-sword-instance-key');
                const action = swordActionBtn.getAttribute('data-sword-instance-action');
                const changed = action === 'repair'
                    ? Input.useChuongThienBinhOnTarget(instanceKey)
                    : Input.unequipSwordArtifactToInventory(instanceKey);

                if (changed) {
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

        this.list.addEventListener('scroll', (e) => {
            const rosterList = e.target?.closest?.('.attack-skill-card__sword-roster-list');
            if (!rosterList) return;
            this.swordRosterScrollTop = rosterList.scrollTop;
            this.swordRosterScrollLockUntil = Date.now() + 180;
        }, true);
    },

    renderTabsMarkup() {
        return `
            <div class="panel-tabs attack-skill-tabs">
                <button class="panel-tab ${this.currentTab === 'BI_PHAP' ? 'is-active' : ''}" type="button" data-skill-tab="BI_PHAP">Bí pháp</button>
                <button class="panel-tab ${this.currentTab === 'PHAP_BAO' ? 'is-active' : ''}" type="button" data-skill-tab="PHAP_BAO">Pháp bảo</button>
            </div>
        `;
    },

    getVisibleSecretArtEntries() {
        const swordProgress = Input.getSwordFormationProgress();
        const secretArts = [];
        const daiCanhItem = Input.getInventoryEntryByUniqueKey('DAI_CANH_KIEM_TRAN', ['SWORD_ART']);
        const thanhLinhItem = Input.getInventoryEntryByUniqueKey('THANH_LINH_KIEM_QUYET', ['SWORD_ART']);
        const khuTrungItem = Input.getInventoryEntryByUniqueKey('KHU_TRUNG_THUAT', ['INSECT_SKILL']);
        const totalInsects = Input.getTotalTamedInsectCount();
        const combatReadyCount = Input.getCombatReadyInsectCount();
        const reservedCount = Math.max(0, totalInsects - combatReadyCount);
        const daiCanhLearned = Input.hasDaiCanhKiemTranUnlocked();
        const thanhLinhLearned = Input.hasThanhLinhKiemQuyetUnlocked();
        const khuTrungLearned = Input.hasKhuTrungThuatUnlocked();

        if (daiCanhLearned || daiCanhItem || Input.hasUniquePurchase('DAI_CANH_KIEM_TRAN')) {
            secretArts.push({
                key: 'SWORD',
                name: CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.fullName || 'Đại Canh Kiếm Trận',
                description: 'Trận đạo bí pháp dùng Thanh Trúc Phong Vân Kiếm đủ chuẩn để bày trận hộ thân và công phạt.',
                unlocked: daiCanhLearned,
                active: Input.attackMode === 'SWORD',
                ready: Input.canDeployDaiCanhKiemTran(),
                accent: CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.color || '#ffd36b',
                statusLabel: daiCanhLearned
                    ? 'Đã lĩnh ngộ'
                    : daiCanhItem
                        ? 'Chờ lĩnh ngộ'
                        : 'Đã kết duyên',
                note: daiCanhLearned
                    ? (Input.canDeployDaiCanhKiemTran()
                        ? `${formatNumber(swordProgress.formationBonded)}/${formatNumber(swordProgress.required)} kiếm đủ chuẩn, có thể khai triển kiếm trận.`
                        : `Còn thiếu ${formatNumber(swordProgress.remaining)} thanh kiếm đủ độ bền để khai triển.`)
                    : daiCanhItem
                        ? `Bí pháp đã nằm trong túi. Hiện có ${formatNumber(swordProgress.usableBonded)}/${formatNumber(swordProgress.required)} thanh kiếm sẵn sàng.`
                        : `Đã kết duyên nhưng chưa lĩnh ngộ. Hiện có ${formatNumber(swordProgress.usableBonded)} thanh kiếm đủ độ bền.`,
                modeKey: 'SWORD',
                buttonLabel: daiCanhLearned ? (Input.attackMode === 'SWORD' ? 'Thu hồi' : 'Khai triển') : 'Lĩnh ngộ',
                buttonDisabled: daiCanhLearned ? !Input.canDeployDaiCanhKiemTran() : !daiCanhItem,
                inventoryKey: daiCanhItem?.key || null,
                roster: []
            });
        }

        if (thanhLinhLearned || thanhLinhItem || Input.hasUniquePurchase('THANH_LINH_KIEM_QUYET')) {
            secretArts.push({
                key: 'THANH_LINH_KIEM_QUYET',
                name: CONFIG.SECRET_ARTS?.THANH_LINH_KIEM_QUYET?.fullName || 'Thanh Linh Kiếm Quyết',
                description: 'Thần thức nhập kiếm, tăng số lượng phi kiếm có thể điều khiển đồng thời.',
                unlocked: thanhLinhLearned,
                active: false,
                ready: true,
                accent: CONFIG.SECRET_ARTS?.THANH_LINH_KIEM_QUYET?.color || '#72f7d0',
                statusLabel: thanhLinhLearned
                    ? 'Đã lĩnh ngộ'
                    : thanhLinhItem
                        ? 'Chờ lĩnh ngộ'
                        : 'Đã kết duyên',
                note: thanhLinhLearned
                    ? `Thần thức hiện tại ${formatNumber(swordProgress.consciousness)}. Có thể giữ tối đa ${formatNumber(swordProgress.capacity)} thanh kiếm hộ thân.`
                    : `Chưa lĩnh ngộ nên chỉ có thể dùng ${formatNumber(Math.max(1, Math.floor(Number(CONFIG.SWORD?.CONTROL?.WITHOUT_SECRET_ART) || 1)))} thanh kiếm đứng hộ thân.`,
                modeKey: null,
                buttonLabel: thanhLinhLearned ? 'Đã lĩnh ngộ' : 'Lĩnh ngộ',
                buttonDisabled: !thanhLinhItem,
                inventoryKey: thanhLinhItem?.key || null,
                roster: []
            });
        }

        if (khuTrungLearned || khuTrungItem || Input.hasUniquePurchase('KHU_TRUNG_THUAT')) {
            secretArts.push({
                key: 'INSECT',
                name: 'Khu Trùng Thuật',
                description: 'Điều độ linh trùng nhập trận, bám sát mục tiêu và công phạt theo bản mệnh từng loài.',
                unlocked: khuTrungLearned,
                active: Input.attackMode === 'INSECT',
                ready: Input.canUseInsectAttackMode(),
                accent: CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.color || '#ff92c2',
                statusLabel: khuTrungLearned
                    ? 'Đã lĩnh ngộ'
                    : khuTrungItem
                        ? 'Chờ lĩnh ngộ'
                        : 'Đã kết duyên',
                note: khuTrungLearned
                    ? (combatReadyCount > 0
                        ? `${formatNumber(combatReadyCount)} linh trùng xuất trận${reservedCount > 0 ? ` | ${formatNumber(reservedCount)} đang dưỡng đàn` : ''}`
                        : totalInsects > 0
                            ? 'Toàn bộ kỳ trùng đang lưu lại dưỡng đàn.'
                            : 'Chưa có linh trùng nào phá noãn.')
                    : khuTrungItem
                        ? 'Bí pháp đã có trong túi, có thể lĩnh ngộ bất cứ lúc nào.'
                        : 'Chưa có bí pháp trong túi.',
                modeKey: 'INSECT',
                buttonLabel: khuTrungLearned ? (Input.attackMode === 'INSECT' ? 'Thu hồi' : 'Khai triển') : 'Lĩnh ngộ',
                buttonDisabled: khuTrungLearned ? !Input.canUseInsectAttackMode() : !khuTrungItem,
                inventoryKey: khuTrungItem?.key || null,
                roster: khuTrungLearned ? Input.getInsectCombatRoster() : [],
                rosterSummary: khuTrungLearned
                    ? `${formatNumber(combatReadyCount)} xuất trận / ${formatNumber(totalInsects)} trong đàn`
                    : ''
            });
        }

        return secretArts;
    },

    getVisibleArtifactEntries() {
        return Input.getArtifactSkillList().filter(artifact => artifact.purchased || artifact.unlocked);
    },

    shouldShowSwordArtifactCard() {
        const swordProgress = Input.getSwordFormationProgress();
        return swordProgress.bonded > 0 || swordProgress.stocked > 0;
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
                : swordProgress.bonded > 0
                    ? `${formatNumber(swordProgress.controlled)} / ${formatNumber(swordProgress.usableBonded)} kiếm đang được thần thức điều động.`
                    : 'Chưa có bí pháp hay kiếm trận nào đang vận chuyển.';
        const description = currentMode === 'INSECT'
            ? 'Bí pháp ngự trùng đang vận chuyển, lấy đàn trùng làm công sát chủ đạo.'
            : currentMode === 'SWORD'
                ? 'Đại Canh Kiếm Trận đã khai mở, kiếm ý đang hộ trận quanh thân.'
                : swordProgress.bonded > 0
                    ? (swordProgress.thanhLinhUnlocked
                        ? 'Thanh Linh Kiếm Quyết đã nhập tâm, số kiếm hộ thân phụ thuộc thần thức hiện tại.'
                        : 'Chưa lĩnh ngộ Thanh Linh Kiếm Quyết nên chỉ có một thanh kiếm đứng hộ thân và chém khi bấm tấn công.')
                    : 'Chưa vận chuyển bí pháp nào, kiếm tu đang trở về kiếm thế sơ khởi.';
        const swordText = swordProgress.bonded > 0
            ? `Thanh Trúc Phong Vân Kiếm: ${formatNumber(swordProgress.bonded)}/${formatNumber(swordProgress.capacity)} đang trang bị | ${formatNumber(swordProgress.stocked)} trong túi | thần thức ${formatNumber(swordProgress.consciousness)}.`
            : 'Chưa có Thanh Trúc Phong Vân Kiếm nào nhập trận.';
        const artifactText = activeArtifacts.length
            ? `Pháp bảo hộ thể: ${activeArtifacts.join(', ')}.`
            : 'Hiện chưa triển khai pháp bảo hộ thể nào.';

        return `
            <article class="attack-skill-state" style="--skill-accent:${currentMode === 'INSECT' ? (CONFIG.INSECT?.UNIQUE_ITEMS?.KHU_TRUNG_THUAT?.color || '#ff92c2') : (CONFIG.SECRET_ARTS?.DAI_CANH_KIEM_TRAN?.color || '#ffd36b')}">
                <span class="attack-skill-state__eyebrow">Đạo trạng hiện tại</span>
                <strong class="attack-skill-state__title">${escapeHtml(title)}</strong>
                <p class="attack-skill-state__description">${escapeHtml(description)}</p>
                <span class="attack-skill-state__summary">${escapeHtml(summary)}</span>
                <span class="attack-skill-state__summary">${escapeHtml(swordText)}</span>
                <span class="attack-skill-state__summary">${escapeHtml(artifactText)}</span>
            </article>
        `;
    },

    renderArtifactStateMarkup() {
        const artifactList = this.getVisibleArtifactEntries();
        const activeArtifacts = artifactList.filter(entry => entry.active);
        const swordProgress = Input.getSwordFormationProgress();
        const title = activeArtifacts.length
            ? activeArtifacts.map(entry => entry.name).join(', ')
            : this.shouldShowSwordArtifactCard()
                ? 'Thanh Trúc Phong Vân Kiếm'
                : 'Chưa triển khai pháp bảo';
        const description = this.shouldShowSwordArtifactCard()
            ? 'Thanh Trúc Phong Vân Kiếm đã được tách thành từng thanh riêng, có thể xem uy năng, độ bền và gỡ trang bị ngay tại đây.'
            : activeArtifacts.length
                ? 'Linh dực phong lôi đang bám theo tâm niệm, hộ trì hai bên con trỏ chuột.'
                : 'Pháp bảo sau khi luyện hóa có thể khai triển hoặc thu hồi ngay trong bảng này.';
        const summary = this.shouldShowSwordArtifactCard()
            ? `${formatNumber(swordProgress.bonded)}/${formatNumber(swordProgress.capacity)} đang trang bị | ${formatNumber(swordProgress.stocked)} trong túi | ${formatNumber(swordProgress.broken)} thanh cạn độ bền`
            : artifactList.length > 0
                ? `${formatNumber(activeArtifacts.length)} đang triển khai | ${formatNumber(artifactList.filter(entry => entry.unlocked).length)} đã luyện hóa`
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

    renderSecretArtActionMarkup(skill) {
        if (!skill.unlocked && skill.inventoryKey) {
            return `
                <button class="btn-slot-action" type="button" data-secret-art-use="${escapeHtml(skill.inventoryKey)}" ${skill.buttonDisabled ? 'disabled' : ''}>
                    ${escapeHtml(skill.buttonLabel)}
                </button>
            `;
        }

        if (skill.modeKey) {
            return `
                <button class="btn-slot-action" type="button" data-attack-skill="${escapeHtml(skill.modeKey)}" ${skill.buttonDisabled ? 'disabled' : ''}>
                    ${escapeHtml(skill.buttonLabel)}
                </button>
            `;
        }

        if (skill.castActionKey) {
            return `
                <button class="btn-slot-action" type="button" data-secret-art-cast="${escapeHtml(skill.castActionKey)}" ${skill.buttonDisabled ? 'disabled' : ''}>
                    ${escapeHtml(skill.buttonLabel)}
                </button>
            `;
        }

        return `
            <button class="btn-slot-action" type="button" disabled>
                ${escapeHtml(skill.buttonLabel)}
            </button>
        `;
    },

    renderAttackSkillsMarkup() {
        return this.getVisibleSecretArtEntries().map(skill => `
            <article class="attack-skill-card ${skill.active ? 'is-active' : ''} ${(skill.unlocked && (skill.ready || !skill.modeKey)) ? '' : 'is-disabled'}" style="--skill-accent:${skill.accent}">
                <div class="attack-skill-card__head">
                    <div>
                        <h4>${escapeHtml(skill.name)}</h4>
                        <p>${escapeHtml(skill.description)}</p>
                    </div>
                    <span class="attack-skill-card__tag">${escapeHtml(skill.statusLabel)}</span>
                </div>
                <div class="attack-skill-card__foot">
                    <span>${escapeHtml(skill.note)}</span>
                    ${this.renderSecretArtActionMarkup(skill)}
                </div>
                ${this.renderInsectRosterMarkup(skill)}
            </article>
        `).join('');
    },

    renderSwordArtifactRosterMarkup() {
        const swordConfig = Input.getThanhTrucSwordArtifactConfig() || {};
        const swordProgress = Input.getSwordFormationProgress();
        const equippedSwords = Input.getEquippedSwordArtifacts();
        const cooldownRemainingMs = Input.getChuongThienBinhCooldownRemainingMs?.() || 0;
        const hasChuongThienBinh = Input.hasChuongThienBinh?.() || false;

        if (!equippedSwords.length) {
            return `
                <div class="attack-skill-card__roster is-empty">
                    <span>Chưa có thanh kiếm nào đang được trang bị.</span>
                </div>
            `;
        }

        return `
            <div class="attack-skill-card__roster">
                <div class="attack-skill-card__roster-head">
                    <strong>Kiếm đang trang bị</strong>
                    <span>${formatNumber(swordProgress.bonded)}/${formatNumber(swordProgress.capacity)} thanh | ${formatNumber(swordProgress.stocked)} còn trong túi</span>
                </div>
                <div class="attack-skill-card__sword-roster-list">
                    ${equippedSwords.map((state, index) => {
                        const damaged = Input.isSwordArtifactDamaged?.(state) || false;
                        const actionButtons = [
                            hasChuongThienBinh && damaged
                                ? `
                                    <button
                                        class="btn-slot-action"
                                        type="button"
                                        data-sword-instance-action="repair"
                                        data-sword-instance-key="${escapeHtml(state.instanceKey)}"
                                        ${Input.isVoidCollapsed || cooldownRemainingMs > 0 ? 'disabled' : ''}
                                    >${escapeHtml(cooldownRemainingMs > 0 ? `Hồi ${Math.ceil(cooldownRemainingMs / 1000)}s` : 'Phục bền')}</button>
                                `
                                : '',
                            `
                                <button
                                    class="btn-slot-action is-secondary"
                                    type="button"
                                    data-sword-instance-action="unequip"
                                    data-sword-instance-key="${escapeHtml(state.instanceKey)}"
                                >Gỡ</button>
                            `
                        ].filter(Boolean).join('');

                        return `
                            <article class="attack-skill-card__sword-chip" style="--toggle-accent:${swordConfig.color || '#66f0c2'}">
                                <div class="attack-skill-card__sword-head">
                                    <span class="attack-skill-card__sword-title">Thanh kiếm ${formatNumber(index + 1)}</span>
                                    <div class="attack-skill-card__sword-actions">
                                        ${actionButtons}
                                    </div>
                                </div>
                                <span class="attack-skill-card__sword-meta">Uy năng ${formatNumber(state.powerRating)} | Độ bền ${formatNumber(state.durability)}/${formatNumber(state.maxDurability)}</span>
                                <span class="attack-skill-card__sword-note">${escapeHtml(damaged
                                    ? `Đã hao tổn. Vỡ ${formatNumber(state.breakCount || 0)} lần.`
                                    : `Trạng thái ổn định. Vỡ ${formatNumber(state.breakCount || 0)} lần.`)}</span>
                            </article>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    renderSwordArtifactCardMarkup() {
        if (!this.shouldShowSwordArtifactCard()) return '';

        const swordConfig = Input.getThanhTrucSwordArtifactConfig() || {};
        const swordProgress = Input.getSwordFormationProgress();
        const statusLabel = swordProgress.bonded > 0
            ? `Đang trang bị ${formatNumber(swordProgress.bonded)}/${formatNumber(swordProgress.capacity)}`
            : `Trong túi ${formatNumber(swordProgress.stocked)}`;
        const note = swordProgress.thanhLinhUnlocked
            ? `Thần thức ${formatNumber(swordProgress.consciousness)} | Giữ tối đa ${formatNumber(swordProgress.capacity)} thanh | Hiện điều động ${formatNumber(swordProgress.controlled)}/${formatNumber(swordProgress.usableBonded)} thanh còn nguyên vẹn.`
            : `Chưa lĩnh ngộ Thanh Linh Kiếm Quyết nên hiện chỉ giữ được ${formatNumber(swordProgress.capacity)} thanh kiếm hộ thân.`;

        return `
            <article class="attack-skill-card ${this.expandedSwordArtifactPanel ? 'is-active' : ''}" style="--skill-accent:${swordConfig.color || '#66f0c2'}">
                <div class="attack-skill-card__head">
                    <div>
                        <h4>${escapeHtml(swordConfig.fullName || 'Thanh Trúc Phong Vân Kiếm')}</h4>
                        <p>Quản lý từng thanh kiếm đã trang bị, xem uy năng và độ bền, đồng thời có thể gỡ về túi trữ vật.</p>
                    </div>
                    <span class="attack-skill-card__tag">${escapeHtml(statusLabel)}</span>
                </div>
                <div class="attack-skill-card__foot">
                    <span>${escapeHtml(note)}</span>
                    <button class="btn-slot-action" type="button" data-sword-artifact-toggle>
                        ${this.expandedSwordArtifactPanel ? 'Thu danh sách' : 'Xem kiếm'}
                    </button>
                </div>
                ${this.expandedSwordArtifactPanel ? this.renderSwordArtifactRosterMarkup() : ''}
            </article>
        `;
    },

    renderArtifactCardsMarkup() {
        const visibleArtifacts = this.getVisibleArtifactEntries();
        const cards = [];

        if (this.shouldShowSwordArtifactCard()) {
            cards.push(this.renderSwordArtifactCardMarkup());
        }

        visibleArtifacts.forEach(artifact => {
            const artifactConfig = Input.getArtifactConfig(artifact.uniqueKey) || {};
            const actionLabel = artifact.active
                ? (artifactConfig.stowLabel || 'Thu hồi')
                : (artifactConfig.deployLabel || 'Triển khai');
            const statusLabel = artifact.active
                ? 'Đang triển khai'
                : artifact.unlocked
                    ? 'Đã luyện hóa'
                    : 'Đã kết duyên';

            cards.push(`
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
            `);
        });

        return cards.join('');
    },

    render() {
        if (!this.list) return;
        if (Date.now() < (this.swordRosterScrollLockUntil || 0)) return;

        const previousRosterList = this.list.querySelector('.attack-skill-card__sword-roster-list');
        if (previousRosterList) {
            this.swordRosterScrollTop = previousRosterList.scrollTop;
        }

        const panelMarkup = this.currentTab === 'PHAP_BAO'
            ? this.renderArtifactStateMarkup() + this.renderArtifactCardsMarkup()
            : this.renderCurrentStateMarkup() + this.renderAttackSkillsMarkup();

        this.list.innerHTML = `
            ${this.renderTabsMarkup()}
            <div class="attack-skill-panel">
                ${panelMarkup}
            </div>
        `;

        const rosterList = this.list.querySelector('.attack-skill-card__sword-roster-list');
        if (rosterList && this.swordRosterScrollTop > 0) {
            rosterList.scrollTop = this.swordRosterScrollTop;
        }
    }
});
