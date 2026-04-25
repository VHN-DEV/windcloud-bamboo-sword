;(() => {
const PAGE_SIZE = 24;
const IMAGE_MANIFEST_URL = "../assets/js/pages/images-manifest.json";
let IMAGE_BY_FOLDER = window.__IMAGE_MANIFEST__ && typeof window.__IMAGE_MANIFEST__ === "object" ? window.__IMAGE_MANIFEST__ : {};

const tabsRoot = document.getElementById('tabs');
const grid = document.getElementById('icon-grid');
const searchInput = document.getElementById('search');
const countEl = document.getElementById('count');
const pageStatus = document.getElementById('page-status');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const toast = document.getElementById('toast');
const previewBgToggle = document.getElementById('preview-bg-toggle');
const svgModal = document.getElementById('svg-modal');
const svgModalClose = document.getElementById('svg-modal-close');
const svgPreviewBox = document.getElementById('svg-preview-box');
const copySvgCodeBtn = document.getElementById('copy-svg-code-btn');
const svgModalTitle = document.getElementById('svg-modal-title');
const svgModalTitleText = document.getElementById('svg-modal-title-text');
const copyLinkBtn = document.getElementById('copy-link-btn');
const downloadSvgBtn = document.getElementById('download-svg-btn');
const copyPngBtn = document.getElementById('copy-png-btn');
const downloadPngBtn = document.getElementById('download-png-btn');
const fillToggleBtn = document.getElementById('fill-toggle-btn');
const fillColorPicker = document.getElementById('fill-color-picker');
const fillColorWrap = document.getElementById('fill-color-wrap');
const fillColorCode = document.getElementById('fill-color-code');
const strokeToggleBtn = document.getElementById('stroke-toggle-btn');
const strokeColorPicker = document.getElementById('stroke-color-picker');
const strokeColorWrap = document.getElementById('stroke-color-wrap');
const strokeColorCode = document.getElementById('stroke-color-code');

if (!tabsRoot || !grid || !searchInput || !countEl || !pageStatus || !prevBtn || !nextBtn || !toast || !previewBgToggle || !svgModal || !svgModalClose || !svgPreviewBox || !copySvgCodeBtn || !svgModalTitle || !svgModalTitleText || !copyLinkBtn || !downloadSvgBtn || !copyPngBtn || !downloadPngBtn || !fillToggleBtn || !fillColorPicker || !fillColorWrap || !fillColorCode || !strokeToggleBtn || !strokeColorPicker || !strokeColorWrap || !strokeColorCode) {
    return;
}

let folderNames = Object.keys(IMAGE_BY_FOLDER);
let activeFolder = folderNames[0] || '';
let filtered = [];
let currentPage = 1;
let isLightPreview = false;
let currentSvgPath = '';
let originalSvgCode = '';
let previewBlobUrl = '';
let isLightPopupPreview = true;
let isFillEnabled = false;
let isStrokeEnabled = false;
const isFileProtocol = window.location.protocol === 'file:';

function renderPreviewBgToggle() {
    document.documentElement.style.setProperty('--preview-bg', isLightPreview ? 'var(--preview-bg-light)' : 'rgba(4, 10, 16, 0.55)');
    previewBgToggle.textContent = `Nền sáng: ${isLightPreview ? 'true' : 'false'}`;
    previewBgToggle.classList.toggle('is-active', isLightPreview);
}

function renderColorToggleUI() {
    fillToggleBtn.setAttribute('aria-checked', String(isFillEnabled));
    strokeToggleBtn.setAttribute('aria-checked', String(isStrokeEnabled));
    fillToggleBtn.setAttribute('data-state', isFillEnabled ? 'checked' : 'unchecked');
    strokeToggleBtn.setAttribute('data-state', isStrokeEnabled ? 'checked' : 'unchecked');
    fillColorWrap.classList.toggle('is-hidden', !isFillEnabled);
    strokeColorWrap.classList.toggle('is-hidden', !isStrokeEnabled);
    fillColorCode.textContent = fillColorPicker.value;
    strokeColorCode.textContent = strokeColorPicker.value;
}

function getCustomizedSvgCode() {
    if (!originalSvgCode) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(originalSvgCode, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.tagName.toLowerCase() !== 'svg') return originalSvgCode;

    const paintTargets = svg.querySelectorAll('path, circle, rect, polygon, polyline, line, ellipse, g, text, use');

    if (isFillEnabled) {
        const fillColor = fillColorPicker.value;
        svg.querySelectorAll('[fill]').forEach((el) => {
            if ((el.getAttribute('fill') || '').toLowerCase() !== 'none') el.setAttribute('fill', fillColor);
        });
        paintTargets.forEach((el) => {
            if (!el.hasAttribute('fill')) el.setAttribute('fill', fillColor);
        });
    }

    if (isStrokeEnabled) {
        const strokeColor = strokeColorPicker.value;
        svg.querySelectorAll('[stroke]').forEach((el) => {
            if ((el.getAttribute('stroke') || '').toLowerCase() !== 'none') el.setAttribute('stroke', strokeColor);
        });
        paintTargets.forEach((el) => {
            if (!el.hasAttribute('stroke')) return;
            if ((el.getAttribute('stroke') || '').toLowerCase() === 'none') return;
            el.setAttribute('stroke', strokeColor);
        });
    }

    return new XMLSerializer().serializeToString(svg);
}

function renderSvgModal() {
    const customized = getCustomizedSvgCode();
    svgPreviewBox.classList.toggle('is-dark', !isLightPopupPreview);
    if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        previewBlobUrl = '';
    }
    if (!customized) {
        if (isFileProtocol && currentSvgPath) {
            svgPreviewBox.innerHTML = `<img src="${currentSvgPath}" alt="${fileNameFromPath(currentSvgPath)}" style="max-width:180px;max-height:180px;object-fit:contain;">`;
            return;
        }
        svgPreviewBox.innerHTML = '';
        return;
    }
    const blob = new Blob([customized], { type: 'image/svg+xml;charset=utf-8' });
    previewBlobUrl = URL.createObjectURL(blob);
    svgPreviewBox.innerHTML = `<img src="${previewBlobUrl}" alt="SVG preview" style="width:100%;height:100%;max-width:180px;max-height:180px;object-fit:contain;">`;
}

async function openSvgModal(path) {
    currentSvgPath = path;
    svgModalTitleText.textContent = fileNameFromPath(path);
    isFillEnabled = false;
    isStrokeEnabled = false;
    renderColorToggleUI();

    if (isFileProtocol) {
        originalSvgCode = '';
        svgPreviewBox.innerHTML = `<img src="${path}" alt="${fileNameFromPath(path)}" style="max-width:180px;max-height:180px;object-fit:contain;">`;
        svgModal.classList.add('is-open');
        return;
    }

    try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) throw new Error('Không tải được SVG');
        originalSvgCode = await response.text();
        renderSvgModal();
        svgModal.classList.add('is-open');
    } catch (error) {
        showToast('Không mở được chi tiết SVG.');
    }
}

function closeSvgModal() {
    if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        previewBlobUrl = '';
    }
    svgModal.classList.remove('is-open');
}

function createPngBlobFromSvgCode(code) {
    return new Promise((resolve, reject) => {
        const svgBlob = new Blob([code], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(svgUrl);
                reject(new Error('Canvas not supported'));
                return;
            }
            if (!isLightPopupPreview) {
                ctx.fillStyle = '#0b1622';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(svgUrl);
                if (!blob) {
                    reject(new Error('Cannot export PNG'));
                    return;
                }
                resolve(blob);
            }, 'image/png');
        };
        img.onerror = () => {
            URL.revokeObjectURL(svgUrl);
            reject(new Error('Cannot render PNG'));
        };
        img.src = svgUrl;
    });
}

const fileNameFromPath = (path) => path.split('/').pop() || path;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
}

async function copyText(text, successMessage) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const temp = document.createElement('textarea');
            temp.value = text;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            temp.remove();
        }
        showToast(successMessage);
    } catch (err) {
        showToast('Không thể copy. Hãy kiểm tra quyền clipboard.');
    }
}

function copyPath(path) {
    return copyText(path, `Đã copy: ${path}`);
}


async function loadImageManifest() {
    try {
        if (!Object.keys(IMAGE_BY_FOLDER).length) {
            const response = await fetch(IMAGE_MANIFEST_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error('Không tải được manifest');
            IMAGE_BY_FOLDER = await response.json();
        }
        folderNames = Object.keys(IMAGE_BY_FOLDER);
        activeFolder = folderNames[0] || '';
    } catch (error) {
        IMAGE_BY_FOLDER = {};
        folderNames = [];
        activeFolder = '';
    }
}

function renderTabs() {
    tabsRoot.innerHTML = '';
    folderNames.forEach((folder) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tab-btn${folder === activeFolder ? ' is-active' : ''}`;
        button.textContent = `${folder} (${IMAGE_BY_FOLDER[folder].length})`;
        button.addEventListener('click', () => {
            activeFolder = folder;
            currentPage = 1;
            renderTabs();
            applyFilter(searchInput.value);
        });
        tabsRoot.appendChild(button);
    });
}

function renderPage() {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    grid.innerHTML = '';
    pageItems.forEach((path) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'icon-card';
        card.title = `Copy đường dẫn: ${path}`;
        card.addEventListener('click', () => {
            if (path.toLowerCase().endsWith('.svg')) {
                openSvgModal(path);
                return;
            }
            copyPath(path);
        });
        card.innerHTML = `<div class="icon-preview"><img loading="lazy" src="${path}" alt="${fileNameFromPath(path)}"></div><div class="icon-name">${fileNameFromPath(path)}</div>`;
        grid.appendChild(card);
    });

    countEl.textContent = `Thư mục ${activeFolder}: ${filtered.length} ảnh`;
    pageStatus.textContent = `Trang ${currentPage}/${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

function applyFilter(keyword = '') {
    const normalized = keyword.trim().toLowerCase();
    const base = IMAGE_BY_FOLDER[activeFolder] || [];
    filtered = normalized ? base.filter((path) => fileNameFromPath(path).toLowerCase().includes(normalized)) : base;
    currentPage = 1;
    renderPage();
}

async function init() {
    await loadImageManifest();
    if (!folderNames.length) {
        grid.innerHTML = '<p>Không tìm thấy thư mục ảnh trong assets/images.</p>';
        countEl.textContent = '0 ảnh';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }
    renderTabs();
    applyFilter('');
}

searchInput.addEventListener('input', (event) => applyFilter(event.target.value));
prevBtn.addEventListener('click', () => { currentPage -= 1; renderPage(); });
nextBtn.addEventListener('click', () => { currentPage += 1; renderPage(); });
previewBgToggle.addEventListener('click', () => {
    isLightPreview = !isLightPreview;
    renderPreviewBgToggle();
});
svgModalClose.addEventListener('click', closeSvgModal);
svgModal.addEventListener('click', (event) => {
    if (event.target === svgModal) closeSvgModal();
});
fillToggleBtn.addEventListener('click', () => {
    isFillEnabled = !isFillEnabled;
    renderColorToggleUI();
    renderSvgModal();
});
strokeToggleBtn.addEventListener('click', () => {
    isStrokeEnabled = !isStrokeEnabled;
    renderColorToggleUI();
    renderSvgModal();
});
fillColorPicker.addEventListener('input', () => {
    fillColorCode.textContent = fillColorPicker.value;
    renderSvgModal();
});
strokeColorPicker.addEventListener('input', () => {
    strokeColorCode.textContent = strokeColorPicker.value;
    renderSvgModal();
});
svgPreviewBox.addEventListener('click', () => {
    isLightPopupPreview = !isLightPopupPreview;
    renderSvgModal();
});
svgModalTitle.addEventListener('click', async () => {
    const name = (fileNameFromPath(currentSvgPath || 'icon.svg')).replace(/\.svg$/i, '');
    await copyText(name, `Đã copy name: ${name}`);
});
copyLinkBtn.addEventListener('click', async () => {
    const name = (fileNameFromPath(currentSvgPath || 'icon.svg')).replace(/\.svg$/i, '');
    const base = `${window.location.origin === 'null' ? '' : window.location.origin}${window.location.pathname}`;
    const shareLink = `${base}#${encodeURIComponent(name)}`;
    await copyText(shareLink, 'Đã copy link icon.');
});
copySvgCodeBtn.addEventListener('click', async () => {
    const code = getCustomizedSvgCode();
    if (!code) {
        if (!currentSvgPath) return;
        await copyText(currentSvgPath, 'Không đọc được code SVG trong file://, đã copy đường dẫn file.');
        return;
    }
    await copyText(code, 'Đã copy code SVG.');
});
downloadSvgBtn.addEventListener('click', () => {
    const code = getCustomizedSvgCode();
    if (!code) {
        if (!currentSvgPath) return;
        const a = document.createElement('a');
        a.href = currentSvgPath;
        a.download = fileNameFromPath(currentSvgPath);
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
    }
    const blob = new Blob([code], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = fileNameFromPath(currentSvgPath || 'icon.svg').replace(/\.svg$/i, '');
    a.href = url;
    a.download = `${name}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});
copyPngBtn.addEventListener('click', async () => {
    const code = getCustomizedSvgCode();
    if (!code) return;
    try {
        const blob = await createPngBlobFromSvgCode(code);
        if (navigator.clipboard?.write && window.ClipboardItem) {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast('Đã copy PNG vào clipboard.');
            return;
        }
        showToast('Trình duyệt không hỗ trợ copy ảnh PNG trực tiếp.');
    } catch (error) {
        showToast('Không thể copy PNG.');
    }
});
downloadPngBtn.addEventListener('click', async () => {
    const code = getCustomizedSvgCode();
    if (!code) return;
    const name = fileNameFromPath(currentSvgPath || 'icon.svg').replace(/\.svg$/i, '');
    try {
        const blob = await createPngBlobFromSvgCode(code);
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${name}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(pngUrl);
    } catch (error) {
        showToast('Không thể tải PNG.');
    }
});
renderColorToggleUI();
renderPreviewBgToggle();
init();
})();
