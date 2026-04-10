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

function buildMaterialArtMarkup(materialKey) {
    if (materialKey === 'KIM_LOI_TRUC_ROOT') {
        return `
            <div class="kim-loi-truc-mau-art" aria-hidden="true">
                <span class="kim-loi-truc-mau-art__halo"></span>
                <span class="kim-loi-truc-mau-art__core"></span>
                <span class="kim-loi-truc-mau-art__stalk kim-loi-truc-mau-art__stalk--main"></span>
                <span class="kim-loi-truc-mau-art__stalk kim-loi-truc-mau-art__stalk--side"></span>
                <span class="kim-loi-truc-mau-art__leaf kim-loi-truc-mau-art__leaf--left"></span>
                <span class="kim-loi-truc-mau-art__leaf kim-loi-truc-mau-art__leaf--right"></span>
                <span class="kim-loi-truc-mau-art__root kim-loi-truc-mau-art__root--left"></span>
                <span class="kim-loi-truc-mau-art__root kim-loi-truc-mau-art__root--right"></span>
                <span class="kim-loi-truc-mau-art__spark kim-loi-truc-mau-art__spark--1"></span>
                <span class="kim-loi-truc-mau-art__spark kim-loi-truc-mau-art__spark--2"></span>
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
    return `
        <div class="chuong-thien-binh-art" aria-hidden="true">
            <span class="chuong-thien-binh-art__halo"></span>
            <span class="chuong-thien-binh-art__particle chuong-thien-binh-art__particle--1"></span>
            <span class="chuong-thien-binh-art__particle chuong-thien-binh-art__particle--2"></span>
            <span class="chuong-thien-binh-art__particle chuong-thien-binh-art__particle--3"></span>
            <img src="./assets/images/chuong-thien-binh.svg" class="chuong-thien-binh-art__image" alt="">
        </div>
    `;
}

function buildPhongLoiArtifactVisualMarkup() {
    const wingPath = 'M28.665 25.537c-1.966-1.094-3.116-2.962-3.232-4.673-0.619-9.164-15.889-10.357-23.662-19.509 0.403 11.661 13.204 11.604 20.744 17.449-4.879-2.113-12.876-1.649-18.664-5.404 2.7 8.775 12.332 5.886 19.406 8.271-4.212-0.411-9.768 1.968-15.02 0.086 4.638 7.31 10.654 2.427 16.483 2.47-2.94 0.749-5.977 4.025-10.036 3.718 4.946 4.76 7.536 0.139 11.079-1.633-0.357 0.425-0.583 0.967-0.61 1.565-0.064 1.443 1.054 2.665 2.497 2.73s2.665-1.054 2.73-2.497c0.052-1.169-0.672-2.193-1.716-2.574z';
    const wingOuterTransform = 'translate(-18 -16) rotate(-45 16 16) scale(1.14 1.14)';
    const wingInnerTransform = 'translate(-12 -11) rotate(-45 16 16) scale(0.84 0.84)';

    return `
        <div class="phong-loi-art" aria-hidden="true">
            <span class="phong-loi-art__halo"></span>
            <svg class="phong-loi-art__svg" viewBox="0 0 128 92" role="presentation" focusable="false">
                <g class="phong-loi-art__wing phong-loi-art__wing--left" transform="translate(54 48) scale(-1 1)">
                    <path class="phong-loi-art__wing-shadow" d="${wingPath}" transform="translate(-20 -18) rotate(-45 16 16) scale(1.26 1.24)"></path>
                    <path class="phong-loi-art__wing-base" d="${wingPath}" transform="${wingOuterTransform}"></path>
                    <path class="phong-loi-art__wing-inner" d="${wingPath}" transform="${wingInnerTransform}"></path>
                    <path class="phong-loi-art__wing-vein" d="M2 1 C 10 -7, 20 -16, 31 -30 M6 4 C 14 -2, 22 -10, 29 -18 M5 8 C 11 7, 17 5, 23 0"></path>
                </g>
                <g class="phong-loi-art__wing phong-loi-art__wing--right" transform="translate(74 48)">
                    <path class="phong-loi-art__wing-shadow" d="${wingPath}" transform="translate(-20 -18) rotate(-45 16 16) scale(1.26 1.24)"></path>
                    <path class="phong-loi-art__wing-base" d="${wingPath}" transform="${wingOuterTransform}"></path>
                    <path class="phong-loi-art__wing-inner" d="${wingPath}" transform="${wingInnerTransform}"></path>
                    <path class="phong-loi-art__wing-vein" d="M2 1 C 10 -7, 20 -16, 31 -30 M6 4 C 14 -2, 22 -10, 29 -18 M5 8 C 11 7, 17 5, 23 0"></path>
                </g>
                <path class="phong-loi-art__shaft" d="M64 24 C68 33 70 42 70 50 C70 60 67 68 64 76 C61 68 58 60 58 50 C58 42 60 33 64 24 Z"></path>
                <path class="phong-loi-art__core" d="M64 33 L70 47 L64 62 L58 47 Z"></path>
                <path class="phong-loi-art__lightning" d="M63 35 L68 30 L65 42 L72 38 L61 58 L64 46 L57 50 Z"></path>
            </svg>
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
    const artifactConfig = item.category === 'ARTIFACT' && item.uniqueKey
        ? (CONFIG.ARTIFACTS?.[item.uniqueKey] || null)
        : item.category === 'SWORD_ARTIFACT'
            ? (CONFIG.SWORD?.ARTIFACT_ITEM || null)
            : null;
    const isPhongLoiArtifact = item.category === 'ARTIFACT' && item.uniqueKey === 'PHONG_LOI_SI';
    const isChuongThienBinhArtifact = item.category === 'ARTIFACT' && item.uniqueKey === 'CHUONG_THIEN_BINH';
    const isThanhTrucSwordArtifact = item.category === 'SWORD_ARTIFACT';
    const isKimLoiTrucMau = item.category === 'MATERIAL' && item.materialKey === 'KIM_LOI_TRUC_ROOT';
    const visualClasses = [visual.className];

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
    }
    if (visual.rainbow) {
        visualClasses.push('is-rainbow-bag');
    }

    const centerMarkup = isPhongLoiArtifact
        ? buildPhongLoiArtifactVisualMarkup()
        : isChuongThienBinhArtifact
        ? buildChuongThienBinhVisualMarkup()
        : isThanhTrucSwordArtifact
        ? buildThanhTrucSwordArtifactVisualMarkup()
        : visual.className === 'is-insect-egg'
        ? `
            <div class="pill-visual__beast" style="${buildInsectVisualVars(insectSpecies, { egg: true })}">
                ${buildInsectArtMarkup(item.speciesKey, { egg: true })}
            </div>
        `
        : visual.className === 'is-material'
            ? buildMaterialArtMarkup(item.materialKey)
        : visual.isBagLike
        ? `
            <span class="pill-visual__core pill-visual__core--bag"></span>
            <img src="./assets/images/bag.svg" class="pill-visual__item-icon" alt="">
        `
        : visual.className === 'is-insect-skill'
            ? `
                <span class="pill-visual__core pill-visual__core--book"></span>
                <span class="pill-visual__cover-seal pill-visual__cover-seal--insect"></span>
            `
            : visual.className === 'is-sword-art'
                ? `
                    <span class="pill-visual__core pill-visual__core--book"></span>
                    <span class="pill-visual__cover-seal pill-visual__cover-seal--sword"></span>
                `
            : visual.className === 'is-flame-art'
                ? `
                    <span class="pill-visual__core pill-visual__core--flame"></span>
                    <span class="pill-visual__flame-mark"></span>
                `
            : visual.className === 'is-artifact'
                ? `
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
