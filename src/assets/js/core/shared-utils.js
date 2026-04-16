function pickWeightedKey(rates, fallbackKey = null) {
    const entries = Object.entries(rates || {});
    if (!entries.length) return fallbackKey;

    const normalizedEntries = entries
        .map(([key, weight]) => [key, Math.max(0, Number(weight) || 0)])
        .filter(([, weight]) => weight > 0);

    if (!normalizedEntries.length) {
        return fallbackKey || entries[0][0];
    }

    const totalWeight = normalizedEntries.reduce((sum, [, weight]) => sum + weight, 0);
    const roll = Math.random() * totalWeight;
    let cursor = 0;

    for (const [key, weight] of normalizedEntries) {
        cursor += weight;
        if (roll <= cursor) return key;
    }

    return fallbackKey || normalizedEntries[normalizedEntries.length - 1][0];
}

function formatNumber(value) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return '0';
    if (!Number.isFinite(numericValue)) return '∞';
    return numberFormatter.format(Math.floor(numericValue));
}

function formatBoostPercent(multiplier) {
    const boostValue = (Number(multiplier) || 0) - 1;
    if (!Number.isFinite(boostValue)) return '+∞%';
    const rounded = Math.round(boostValue * 100);
    return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

function serializeForStorage(value) {
    return JSON.stringify(value, (key, currentValue) => {
        if (typeof currentValue === 'number' && !Number.isFinite(currentValue)) {
            if (Number.isNaN(currentValue)) {
                return { [STORAGE_SPECIAL_NUMBER_TAG]: 'NaN' };
            }

            return {
                [STORAGE_SPECIAL_NUMBER_TAG]: currentValue > 0 ? 'Infinity' : '-Infinity'
            };
        }

        return currentValue;
    });
}

function parseStoredJson(serializedValue) {
    return JSON.parse(serializedValue, (key, currentValue) => {
        if (
            currentValue
            && typeof currentValue === 'object'
            && !Array.isArray(currentValue)
            && Object.prototype.hasOwnProperty.call(currentValue, STORAGE_SPECIAL_NUMBER_TAG)
        ) {
            const specialValue = currentValue[STORAGE_SPECIAL_NUMBER_TAG];

            if (specialValue === 'Infinity') return Number.POSITIVE_INFINITY;
            if (specialValue === '-Infinity') return Number.NEGATIVE_INFINITY;
            if (specialValue === 'NaN') return Number.NaN;
        }

        return currentValue;
    });
}

function escapeHtml(value) {
    return repairLegacyText(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function resolveImagePathFromPublic(imageName) {
    const normalizedImageName = typeof normalizeImageAssetName === 'function'
        ? normalizeImageAssetName(imageName)
        : String(imageName || '').trim();
    if (!normalizedImageName) {
        return {
            primarySrc: '',
            fallbackSrc: ''
        };
    }

    return {
        primarySrc: `./assets/images/${normalizedImageName}`,
        fallbackSrc: `./src/assets/images/${normalizedImageName}`
    };
}

function buildImageSrcWithFallbackMarkup(imageName) {
    const { primarySrc, fallbackSrc } = resolveImagePathFromPublic(imageName);
    if (!primarySrc) {
        return 'src=""';
    }

    const safePrimary = escapeHtml(primarySrc);
    if (!fallbackSrc) {
        return `src="${safePrimary}"`;
    }

    const safeFallback = escapeHtml(fallbackSrc);
    return `src="${safePrimary}" onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='1';this.src='${safeFallback}';}"`;
}

function buildItemDescriptionContentMarkup(description) {
    const normalizedDescription = repairLegacyText(description).trim();
    const sideEffectMarker = 'Tác dụng phụ:';
    const markerIndex = normalizedDescription.indexOf(sideEffectMarker);

    if (markerIndex === -1) {
        return escapeHtml(normalizedDescription);
    }

    const mainText = normalizedDescription.slice(0, markerIndex).trim();
    const sideText = normalizedDescription.slice(markerIndex + sideEffectMarker.length).trim();

    return `
        ${mainText ? escapeHtml(mainText) : ''}
        <span class="item-description__side-effect">
            <span class="item-description__side-label">${escapeHtml(sideEffectMarker)}</span>
            ${escapeHtml(sideText)}
        </span>
    `.trim();
}

function hslaColor(h, s, l, a = 1) {
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;
}

function getSafeProgressPercent(current, max) {
    const currentValue = Number(current);
    const maxValue = Number(max);

    if (!Number.isFinite(currentValue) && !Number.isFinite(maxValue)) return 100;
    if (!Number.isFinite(maxValue)) return 100;
    if (!Number.isFinite(currentValue)) return 100;
    if (maxValue <= 0) return 0;

    return Math.max(0, Math.min(100, (currentValue / maxValue) * 100));
}

function getRankAccentColor(rank) {
    return rank?.accentColor || rank?.color || '#8fffe0';
}

function getRankLightColor(rank) {
    return rank?.lightColor || getRankAccentColor(rank);
}

function getRankBarBackground(rank) {
    if (rank?.barGradient) return rank.barGradient;
    return `linear-gradient(90deg, ${getRankLightColor(rank)}, ${getRankAccentColor(rank)})`;
}

function applyRankTextVisual(element, rank) {
    if (!element) return;

    const textGradient = rank?.textGradient || '';
    const accentColor = getRankAccentColor(rank);

    element.style.background = textGradient || 'none';
    element.style.webkitBackgroundClip = textGradient ? 'text' : '';
    element.style.backgroundClip = textGradient ? 'text' : '';
    element.style.webkitTextFillColor = textGradient ? 'transparent' : '';
    element.style.color = textGradient ? 'transparent' : accentColor;
    element.style.textShadow = textGradient
        ? '0 0 14px rgba(255, 255, 255, 0.35)'
        : '';
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function withAlpha(color, alpha = 1) {
    const safeAlpha = clampNumber(Number(alpha) || 0, 0, 1);
    const normalized = String(color || '').trim();

    if (!normalized) {
        return `rgba(121, 255, 212, ${safeAlpha})`;
    }

    const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3 || hex.length === 4) {
            hex = hex.split('').map(char => char + char).join('');
        }

        const baseHex = hex.length === 8 ? hex.slice(0, 6) : hex;
        const baseAlpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        const r = parseInt(baseHex.slice(0, 2), 16);
        const g = parseInt(baseHex.slice(2, 4), 16);
        const b = parseInt(baseHex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${(baseAlpha * safeAlpha).toFixed(3)})`;
    }

    const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
        const parts = rgbMatch[1].split(',').map(part => part.trim());
        if (parts.length >= 3) {
            const baseAlpha = parts[3] != null ? clampNumber(Number(parts[3]) || 0, 0, 1) : 1;
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${(baseAlpha * safeAlpha).toFixed(3)})`;
        }
    }

    const hslMatch = normalized.match(/^hsla?\(([^)]+)\)$/i);
    if (hslMatch) {
        const parts = hslMatch[1].split(',').map(part => part.trim());
        if (parts.length >= 3) {
            const baseAlpha = parts[3] != null ? clampNumber(Number(parts[3]) || 0, 0, 1) : 1;
            return `hsla(${parts[0]}, ${parts[1]}, ${parts[2]}, ${(baseAlpha * safeAlpha).toFixed(3)})`;
        }
    }

    return normalized;
}
