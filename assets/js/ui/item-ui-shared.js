const ITEM_COLLECTION_TABS = Object.freeze([
    { key: 'DAN_DUOC', label: 'Đan dược' },
    { key: 'TRUNG_NOAN', label: 'Trùng noãn' },
    { key: 'THIEN_TAI_DIA_BAO', label: 'Thiên tài địa bảo' },
    { key: 'TUI', label: 'Túi' },
    { key: 'BI_PHAP', label: 'Bí pháp' },
    { key: 'PHAP_BAO', label: 'Pháp bảo' },
    { key: 'KHAC', label: 'Khác' }
]);

function getItemCollectionTabLabel(tabKey) {
    return ITEM_COLLECTION_TABS.find(tab => tab.key === tabKey)?.label || 'Khác';
}

function getItemCollectionTabKey(item) {
    const category = item?.category || 'EXP';

    if (['EXP', 'INSIGHT', 'BREAKTHROUGH', 'ATTACK', 'SHIELD_BREAK', 'BERSERK', 'RAGE', 'MANA', 'MAX_MANA', 'REGEN', 'SPEED', 'FORTUNE'].includes(category)) {
        return 'DAN_DUOC';
    }

    if (category === 'SPECIAL') return 'DAN_DUOC';
    if (category === 'INSECT_EGG') return 'TRUNG_NOAN';
    if (category === 'MATERIAL') return 'THIEN_TAI_DIA_BAO';
    if (['BAG', 'RAINBOW_BAG', 'SPIRIT_BAG', 'RAINBOW_SPIRIT_BAG', 'SPIRIT_HABITAT'].includes(category)) return 'TUI';
    if (category === 'FLAME_ART' && item?.uniqueKey === 'CAN_LAM_BANG_DIEM') return 'PHAP_BAO';
    if (['SWORD_ART', 'FLAME_ART', 'INSECT_SKILL'].includes(category)) return 'BI_PHAP';
    if (['SWORD_ARTIFACT', 'ARTIFACT', 'INSECT_ARTIFACT'].includes(category)) return 'PHAP_BAO';

    return 'DAN_DUOC';
}

function getKimLoiTrucArtStageMeta(item) {
    if (typeof Input !== 'undefined'
        && Input
        && typeof Input.getKimLoiTrucStageMeta === 'function') {
        return Input.getKimLoiTrucStageMeta(item);
    }

    return { visualStage: 'buried-root' };
}

function buildMaterialArtMarkup(materialKey, item = null) {
    if (materialKey === 'KIM_LOI_TRUC_ROOT') {
        const stageMeta = getKimLoiTrucArtStageMeta(item);
        const visualStage = stageMeta?.visualStage || 'buried-root';

        return `
            <div class="kim-loi-truc-mau-art kim-loi-truc-mau-art--${visualStage}" aria-hidden="true">
                <span class="kim-loi-truc-mau-art__halo"></span>
                <span class="kim-loi-truc-mau-art__ground"></span>
                <span class="kim-loi-truc-mau-art__mound"></span>
                <span class="kim-loi-truc-mau-art__crack"></span>
                <span class="kim-loi-truc-mau-art__core"></span>
                <span class="kim-loi-truc-mau-art__stalk kim-loi-truc-mau-art__stalk--main"></span>
                <span class="kim-loi-truc-mau-art__stalk kim-loi-truc-mau-art__stalk--mid"></span>
                <span class="kim-loi-truc-mau-art__stalk kim-loi-truc-mau-art__stalk--side"></span>
                <span class="kim-loi-truc-mau-art__leaf kim-loi-truc-mau-art__leaf--left"></span>
                <span class="kim-loi-truc-mau-art__leaf kim-loi-truc-mau-art__leaf--right"></span>
                <span class="kim-loi-truc-mau-art__leaf kim-loi-truc-mau-art__leaf--upper-left"></span>
                <span class="kim-loi-truc-mau-art__leaf kim-loi-truc-mau-art__leaf--upper-right"></span>
                <span class="kim-loi-truc-mau-art__root kim-loi-truc-mau-art__root--left"></span>
                <span class="kim-loi-truc-mau-art__root kim-loi-truc-mau-art__root--right"></span>
                <span class="kim-loi-truc-mau-art__spark kim-loi-truc-mau-art__spark--1"></span>
                <span class="kim-loi-truc-mau-art__spark kim-loi-truc-mau-art__spark--2"></span>
                <span class="kim-loi-truc-mau-art__spark kim-loi-truc-mau-art__spark--3"></span>
            </div>
        `;
    }

    const slug = String(materialKey || 'material')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `
        <div class="material-art material-art--${slug}" aria-hidden="true">
            <span class="material-art__halo"></span>
            <span class="material-art__piece material-art__piece--1"></span>
            <span class="material-art__piece material-art__piece--2"></span>
            <span class="material-art__piece material-art__piece--3"></span>
            <span class="material-art__piece material-art__piece--4"></span>
        </div>
    `;
}

function buildChuongThienBinhVisualMarkup() {
    const imagePath = CONFIG.IMAGES?.ARTIFACTS?.CHUONG_THIEN_BINH || '';
    return `
        <div class="chuong-thien-binh-art" aria-hidden="true">
            <span class="chuong-thien-binh-art__halo"></span>
            <span class="chuong-thien-binh-art__particle chuong-thien-binh-art__particle--1"></span>
            <span class="chuong-thien-binh-art__particle chuong-thien-binh-art__particle--2"></span>
            <span class="chuong-thien-binh-art__particle chuong-thien-binh-art__particle--3"></span>
            <img src="${imagePath}" class="chuong-thien-binh-art__image" alt="">
        </div>
    `;
}

function buildPhongLoiArtifactVisualMarkup() {
    const imagePath = CONFIG.IMAGES?.ARTIFACTS?.PHONG_LOI_SI || '';
    return `
        <div class="phong-loi-art" aria-hidden="true">
            <span class="phong-loi-art__halo"></span>
            <img src="${imagePath}" class="phong-loi-art__image" alt="">
        </div>
    `;
}

function buildStaticArtifactImageVisualMarkup(imagePath, variantClass = '') {
    const wrapperClass = ['artifact-svg-art', variantClass].filter(Boolean).join(' ');
    return `
        <div class="${wrapperClass}" aria-hidden="true">
            <span class="artifact-svg-art__halo"></span>
            <img src="${imagePath}" class="artifact-svg-art__image" alt="">
        </div>
    `;
}

function buildThanhTrucSwordArtifactVisualMarkup() {
    return `
        <div class="thanh-truc-art" aria-hidden="true">
            <span class="thanh-truc-art__halo"></span>
            <span class="thanh-truc-art__sword thanh-truc-art__sword--center"></span>
            <span class="thanh-truc-art__sword thanh-truc-art__sword--left"></span>
            <span class="thanh-truc-art__sword thanh-truc-art__sword--right"></span>
            <span class="thanh-truc-art__lightning thanh-truc-art__lightning--1"></span>
            <span class="thanh-truc-art__lightning thanh-truc-art__lightning--2"></span>
        </div>
    `;
}

function buildItemImageVisualMarkup(imagePath, { coreClass = '', imageClass = '', extraMarkup = '' } = {}) {
    const imageClasses = ['pill-visual__item-icon', imageClass].filter(Boolean).join(' ');

    return `
        <span class="pill-visual__core ${coreClass}"></span>
        ${extraMarkup}
        <img src="${imagePath}" class="${imageClasses}" alt="">
    `;
}

function buildPillVisualMarkup(item, qualityConfig, options = {}) {
    const visualMap = {
        EXP: { className: 'is-exp', aura: 'rgba(105, 240, 203, 0.32)' },
        INSIGHT: { className: 'is-insight', aura: 'rgba(208, 255, 124, 0.34)' },
        BREAKTHROUGH: { className: 'is-breakthrough', aura: 'rgba(120, 168, 255, 0.32)' },
        ATTACK: { className: 'is-attack', aura: 'rgba(255, 160, 109, 0.34)' },
        SHIELD_BREAK: { className: 'is-shield-break', aura: 'rgba(111, 187, 255, 0.34)' },
        BERSERK: { className: 'is-berserk', aura: 'rgba(255, 75, 93, 0.34)' },
        RAGE: { className: 'is-rage', aura: 'rgba(255, 112, 70, 0.34)' },
        MANA: { className: 'is-mana', aura: 'rgba(87, 200, 255, 0.30)' },
        MAX_MANA: { className: 'is-max-mana', aura: 'rgba(164, 121, 255, 0.30)' },
        REGEN: { className: 'is-regen', aura: 'rgba(89, 226, 219, 0.30)' },
        SPEED: { className: 'is-speed', aura: 'rgba(149, 255, 186, 0.30)' },
        FORTUNE: { className: 'is-fortune', aura: 'rgba(255, 214, 102, 0.32)' },
        BAG: { className: 'is-bag', aura: 'rgba(151, 197, 255, 0.26)', isBagLike: true },
        RAINBOW_BAG: { className: 'is-bag', aura: 'rgba(255, 240, 170, 0.34)', isBagLike: true, rainbow: true },
        SWORD_ART: { className: 'is-sword-art', aura: 'rgba(121, 255, 212, 0.32)' },
        FLAME_ART: { className: 'is-flame-art', aura: 'rgba(104, 217, 255, 0.34)' },
        SWORD_ARTIFACT: { className: 'is-sword-artifact', aura: 'rgba(102, 240, 194, 0.34)' },
        ARTIFACT: { className: 'is-artifact', aura: 'rgba(159, 232, 255, 0.34)' },
        INSECT_SKILL: { className: 'is-insect-skill', aura: 'rgba(121, 255, 212, 0.32)' },
        INSECT_ARTIFACT: { className: 'is-insect-artifact', aura: 'rgba(255, 216, 113, 0.34)' },
        SPIRIT_BAG: { className: 'is-spirit-bag', aura: 'rgba(142, 191, 255, 0.30)', isBagLike: true },
        RAINBOW_SPIRIT_BAG: { className: 'is-spirit-bag', aura: 'rgba(255, 231, 130, 0.36)', isBagLike: true, rainbow: true },
        SPIRIT_HABITAT: { className: 'is-habitat', aura: 'rgba(142, 191, 255, 0.34)', isBagLike: true },
        INSECT_EGG: { className: 'is-insect-egg', aura: 'rgba(255, 240, 195, 0.32)' },
        MATERIAL: { className: 'is-material', aura: 'rgba(255, 176, 130, 0.30)' },
        CHUNG_CUC_DAO_NGUYEN_DAN: { className: 'is-special-rainbow', aura: 'rgba(255, 255, 255, 0.40)' },
        TAN_DAO_DIET_NGUYEN_DAN: { className: 'is-special-void', aura: 'rgba(84, 42, 115, 0.44)' }
    };

    const visualKey = item.specialKey || item.category;
    const visual = visualMap[visualKey] || visualMap.EXP;
    const insectSpecies = item.category === 'INSECT_EGG' ? Input.getInsectSpecies(item.speciesKey) : null;
    const uniqueConfig = item.uniqueKey ? Input.getUniqueItemConfig(item.uniqueKey) : null;
    const artifactConfig = item.category === 'ARTIFACT' && item.uniqueKey
        ? uniqueConfig
        : item.category === 'SWORD_ARTIFACT'
            ? (CONFIG.SWORD?.ARTIFACT_ITEM || null)
            : null;
    const isCanLamFlameArt = item.category === 'FLAME_ART' && item.uniqueKey === 'CAN_LAM_BANG_DIEM';
    const isPhongLoiArtifact = item.category === 'ARTIFACT' && item.uniqueKey === 'PHONG_LOI_SI';
    const isChuongThienBinhArtifact = item.category === 'ARTIFACT' && item.uniqueKey === 'CHUONG_THIEN_BINH';
    const isHuyetSacArtifact = item.category === 'ARTIFACT' && item.uniqueKey === 'HUYET_SAC_PHI_PHONG';
    const isCanLamArtifact = item.category === 'ARTIFACT' && item.uniqueKey === 'CAN_LAM_BANG_DIEM';
    const isThanhTrucSwordArtifact = item.category === 'SWORD_ARTIFACT';
    const isFormationSecretArt = item.category === 'SWORD_ART'
        && (item.uniqueKey === 'DAI_CANH_KIEM_TRAN' || uniqueConfig?.visualStyle === 'formation');
    const isKimLoiTrucMau = item.category === 'MATERIAL' && item.materialKey === 'KIM_LOI_TRUC_ROOT';
    const kimLoiStageMeta = isKimLoiTrucMau ? getKimLoiTrucArtStageMeta(item) : null;
    const visualClasses = [visual.className];
    const bagImagePath = ['BAG', 'RAINBOW_BAG'].includes(item.category)
        ? (CONFIG.IMAGES?.BAGS?.TREASURE || '')
        : (CONFIG.IMAGES?.BAGS?.STORAGE || '');

    if (isPhongLoiArtifact) {
        visualClasses.push('is-artifact-phong-loi');
    }
    if (isChuongThienBinhArtifact) {
        visualClasses.push('is-artifact-chuong-thien-binh');
    }
    if (isThanhTrucSwordArtifact) {
        visualClasses.push('is-artifact-thanh-truc');
    }
    if (isKimLoiTrucMau) {
        visualClasses.push('is-material-kim-loi-root');
        if (kimLoiStageMeta?.visualStage) {
            visualClasses.push(`is-material-kim-loi-root--${kimLoiStageMeta.visualStage}`);
        }
    }
    if (visual.rainbow) {
        visualClasses.push('is-rainbow-bag');
    }

    const centerMarkup = isPhongLoiArtifact
        ? buildPhongLoiArtifactVisualMarkup()
        : isChuongThienBinhArtifact
        ? buildChuongThienBinhVisualMarkup()
        : isCanLamFlameArt && uniqueConfig?.imagePath
        ? buildStaticArtifactImageVisualMarkup(uniqueConfig.imagePath, 'is-can-lam')
        : isHuyetSacArtifact && artifactConfig?.imagePath
        ? buildStaticArtifactImageVisualMarkup(artifactConfig.imagePath, 'is-huyet-sac')
        : isThanhTrucSwordArtifact
        ? buildThanhTrucSwordArtifactVisualMarkup()
        : visual.className === 'is-insect-egg'
        ? `
            <div class="pill-visual__beast" style="${buildInsectVisualVars(insectSpecies, { egg: true })}">
                ${buildInsectArtMarkup(item.speciesKey, { egg: true })}
            </div>
        `
        : visual.className === 'is-material'
            ? buildMaterialArtMarkup(item.materialKey, item)
        : visual.isBagLike
        ? buildItemImageVisualMarkup(bagImagePath, {
            coreClass: 'pill-visual__core--bag',
            imageClass: 'pill-visual__item-icon--bag'
        })
        : visual.className === 'is-insect-skill'
            ? `
                <span class="pill-visual__core pill-visual__core--book"></span>
                <span class="pill-visual__cover-seal pill-visual__cover-seal--insect"></span>
            `
            : visual.className === 'is-sword-art'
                ? `
                    <span class="pill-visual__core pill-visual__core--book"></span>
                    <span class="pill-visual__cover-seal pill-visual__cover-seal--${isFormationSecretArt ? 'formation' : 'sword'}"></span>
                `
            : visual.className === 'is-flame-art'
                ? uniqueConfig?.imagePath
                    ? buildItemImageVisualMarkup(uniqueConfig.imagePath, {
                        coreClass: 'pill-visual__core--flame',
                        imageClass: 'pill-visual__item-icon--flame'
                    })
                    : `
                        <span class="pill-visual__core pill-visual__core--flame"></span>
                        <span class="pill-visual__flame-mark"></span>
                    `
            : visual.className === 'is-artifact'
                ? artifactConfig?.imagePath
                    ? buildItemImageVisualMarkup(artifactConfig.imagePath, {
                        coreClass: 'pill-visual__core--artifact',
                        imageClass: 'pill-visual__item-icon--artifact',
                        extraMarkup: isCanLamArtifact ? '' : `
                            <span class="pill-visual__wing-artifact pill-visual__wing-artifact--left"></span>
                            <span class="pill-visual__wing-artifact pill-visual__wing-artifact--right"></span>
                        `
                    })
                    : `
                        <span class="pill-visual__core pill-visual__core--artifact"></span>
                        <span class="pill-visual__wing-artifact pill-visual__wing-artifact--left"></span>
                        <span class="pill-visual__wing-artifact pill-visual__wing-artifact--right"></span>
                    `
            : visual.className === 'is-insect-artifact'
                ? `
                    <span class="pill-visual__core pill-visual__core--book"></span>
                `
        : `
            <span class="pill-visual__core"></span>
            <span class="pill-visual__sigil"></span>
        `;

    const styleVars = [
        `--pill-accent:${qualityConfig.color}`,
        `--pill-aura:${visual.aura}`
    ];

    if (artifactConfig?.secondaryColor) {
        styleVars.push(`--artifact-secondary:${artifactConfig.secondaryColor}`);
    }

    if (artifactConfig?.auraColor) {
        styleVars.push(`--artifact-aura:${artifactConfig.auraColor}`);
    }

    if (isPhongLoiArtifact) {
        styleVars.push(`--artifact-lightning-light:${CONFIG.COLORS?.SWORD_GOLD_LIGHT || '#FFF2C2'}`);
        styleVars.push(`--artifact-lightning-mid:${CONFIG.COLORS?.SWORD_GOLD_MID || '#E6C87A'}`);
        styleVars.push(`--artifact-lightning-dark:${CONFIG.COLORS?.SWORD_GOLD_DARK || '#B8944E'}`);
    }

    return `
        <div class="pill-visual ${visualClasses.join(' ')}" style="${styleVars.join(';')}" aria-hidden="true">
            <span class="pill-visual__backdrop"></span>
            <span class="pill-visual__orbit pill-visual__orbit--outer"></span>
            <span class="pill-visual__orbit pill-visual__orbit--inner"></span>
            <span class="pill-visual__spark pill-visual__spark--1"></span>
            <span class="pill-visual__spark pill-visual__spark--2"></span>
            <span class="pill-visual__spark pill-visual__spark--3"></span>
            ${centerMarkup}
        </div>
    `;
}
