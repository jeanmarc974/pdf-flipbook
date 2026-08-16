import { PageFlip } from 'https://cdn.jsdelivr.net/npm/page-flip@0.3.0/dist/js/pageFlip.module.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

const RENDER_SCALE = 1.2;
const MAX_PAGES = 500;
const INITIAL_RENDER_COUNT = 4;

const state = {
    pdfDoc: null,
    pageImages: [],
    pageFlip: null,
    zoom: 1,
    sidebarOpen: false,
    fileName: 'Document',
    totalPages: 0,
    outline: [],
    pageSize: { targetW: 400, renderHeight: 565 },
};

const $ = (id) => document.getElementById(id);

const el = {
    dropZone: $('drop-zone'),
    fileInput: $('file-input'),
    browseBtn: $('browse-btn'),
    app: $('app'),
    loadingOverlay: $('loading-overlay'),
    loadingText: $('loading-text'),
    flipbook: $('flipbook'),
    flipbookContainer: $('flipbook-container'),
    docTitle: $('doc-title'),
    btnPrev: $('btn-prev'),
    btnNext: $('btn-next'),
    pageInput: $('page-input'),
    pageTotal: $('page-total'),
    btnZoomIn: $('btn-zoom-in'),
    btnZoomOut: $('btn-zoom-out'),
    zoomLevel: $('zoom-level'),
    btnThumbnails: $('btn-thumbnails'),
    btnFullscreen: $('btn-fullscreen'),
    btnExport: $('btn-export'),
    btnNew: $('btn-new'),
    sidebar: $('sidebar'),
    btnCloseSidebar: $('btn-close-sidebar'),
    thumbnailsList: $('thumbnails-list'),
    outlineList: $('outline-list'),
    tabThumbnails: $('tab-thumbnails'),
    tabOutline: $('tab-outline'),
    dropText: $('drop-text'),
    bootScreen: $('boot-screen'),
    bootTitle: $('boot-title'),
    bootSubtitle: $('boot-subtitle'),
    progressBar: $('progress-bar'),
    progressPercent: $('progress-percent'),
};

function showLoading(text = 'Chargement du PDF…') {
    el.loadingText.textContent = text;
    el.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    el.loadingOverlay.classList.add('hidden');
}

function initDropZone() {
    el.browseBtn.addEventListener('click', () => el.fileInput.click());
    el.dropZone.addEventListener('click', (e) => {
        if (e.target === el.dropZone || e.target.closest('.drop-zone-content')) {
            if (e.target.tagName !== 'BUTTON') el.fileInput.click();
        }
    });

    el.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) loadPDF(file);
    });

    el.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.dropZone.classList.add('dragover');
    });

    el.dropZone.addEventListener('dragleave', () => {
        el.dropZone.classList.remove('dragover');
    });

    el.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        el.dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            loadPDF(file);
        } else {
            alert('Veuillez déposer un fichier PDF.');
        }
    });
}

async function loadPDF(source) {
    let arrayBuffer;
    let fileName;

    if (typeof source === 'string') {
        showBoot('Téléchargement du PDF', 'Récupération du document…');
        const response = await fetch(source);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentLength = parseInt(response.headers.get('content-length') || '0');
        if (contentLength > 0) {
            const reader = response.body.getReader();
            const chunks = [];
            let received = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                const pct = Math.round((received / contentLength) * 100);
                updateBootProgress(pct, 'Téléchargement du PDF', `${formatBytes(received)} / ${formatBytes(contentLength)}`);
            }

            arrayBuffer = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
            let offset = 0;
            for (const chunk of chunks) {
                arrayBuffer.set(chunk, offset);
                offset += chunk.length;
            }
            arrayBuffer = arrayBuffer.buffer;
        } else {
            arrayBuffer = await response.arrayBuffer();
        }
        fileName = source.split('/').pop().split('?')[0];
    } else {
        fileName = source.name;
        arrayBuffer = await source.arrayBuffer();
    }

    state.fileName = fileName.replace(/\.pdf$/i, '');
    el.docTitle.textContent = state.fileName;

    showBoot('Analyse du PDF', 'Lecture des pages…');
    updateBootProgress(0);

    try {
        state.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        state.totalPages = Math.min(state.pdfDoc.numPages, MAX_PAGES);

        if (state.pdfDoc.numPages > MAX_PAGES) {
            console.warn(`PDF has ${state.pdfDoc.numPages} pages, only first ${MAX_PAGES} will be loaded.`);
        }

        showBoot('Rendu des pages', `0 / ${Math.min(INITIAL_RENDER_COUNT, state.totalPages)} pages…`);
        await renderPagesProgressive();
        await loadOutline();

        hideBoot();
        el.dropZone.classList.add('hidden');
        el.app.classList.remove('hidden');

        await initFlipbook();
        buildThumbnails();
        updatePageIndicator();
        renderRemainingPages();
    } catch (err) {
        hideBoot();
        console.error(err);
        alert('Erreur lors du chargement du PDF : ' + err.message);
    }
}

function showBoot(title, subtitle) {
    el.bootTitle.textContent = title;
    el.bootSubtitle.textContent = subtitle;
    el.bootScreen.classList.remove('hidden');
    updateBootProgress(0);
}

function hideBoot() {
    el.bootScreen.classList.add('hidden');
}

function updateBootProgress(pct, title, subtitle) {
    el.progressBar.style.width = pct + '%';
    el.progressPercent.textContent = pct + '%';
    if (title) el.bootTitle.textContent = title;
    if (subtitle) el.bootSubtitle.textContent = subtitle;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' Ko';
    return (bytes / 1048576).toFixed(1) + ' Mo';
}

async function getPageSize() {
    const containerW = el.flipbookContainer.clientWidth || 800;
    const targetW = Math.min(500, Math.max(300, containerW / 2 - 40));
    const page = await state.pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const aspectRatio = viewport.height / viewport.width;
    const renderHeight = Math.round(targetW * aspectRatio);
    page.cleanup();
    return { targetW, renderHeight };
}

async function renderPage(pageNum) {
    const pdfPage = await state.pdfDoc.getPage(pageNum);
    const vp = pdfPage.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = vp.width;
    canvas.height = vp.height;
    await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise;

    const links = await extractLinks(pdfPage, vp);
    pdfPage.cleanup();

    const { targetW, renderHeight } = state.pageSize;
    return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.75),
        width: targetW,
        height: renderHeight,
        links: links,
        rendered: true,
    };
}

async function renderPagesProgressive() {
    state.pageImages = [];
    state.pageSize = await getPageSize();

    const initialCount = Math.min(INITIAL_RENDER_COUNT, state.totalPages);

    for (let i = 1; i <= initialCount; i++) {
        showBoot('Rendu des pages', `${i} / ${initialCount} pages…`);
        const pct = Math.round((i / initialCount) * 100);
        updateBootProgress(pct);
        const pageData = await renderPage(i);
        state.pageImages.push(pageData);
    }

    for (let i = initialCount + 1; i <= state.totalPages; i++) {
        state.pageImages.push({
            dataUrl: null,
            width: state.pageSize.targetW,
            height: state.pageSize.renderHeight,
            links: [],
            rendered: false,
        });
    }
}

async function renderRemainingPages() {
    for (let i = 0; i < state.pageImages.length; i++) {
        if (state.pageImages[i].rendered) continue;

        const pageNum = i + 1;
        try {
            const pageData = await renderPage(pageNum);
            state.pageImages[i] = pageData;

            const pageEl = el.flipbook.querySelector(`.page[data-page="${pageNum}"] img`);
            if (pageEl && !pageEl.src) {
                pageEl.src = pageData.dataUrl;
            }

            const thumbEl = el.thumbnailsList.querySelector(`.thumbnail-item[data-page="${pageNum}"] img`);
            if (thumbEl && !thumbEl.src) {
                thumbEl.src = pageData.dataUrl;
            }

            await new Promise(r => setTimeout(r, 0));
        } catch (err) {
            console.error(`Failed to render page ${pageNum}:`, err);
        }
    }
}

async function extractLinks(pdfPage, viewport) {
    const annotations = await pdfPage.getAnnotations();
    const links = [];

    for (const ann of annotations) {
        if (ann.subtype !== 'Link' && !ann.url && !ann.dest && !ann.ref) continue;

        const rect = viewport.convertToViewportRectangle(ann.rect);
        const x1 = Math.min(rect[0], rect[2]);
        const y1 = Math.min(rect[1], rect[3]);
        const x2 = Math.max(rect[0], rect[2]);
        const y2 = Math.max(rect[1], rect[3]);

        const left = (x1 / viewport.width) * 100;
        const top = (y1 / viewport.height) * 100;
        const width = ((x2 - x1) / viewport.width) * 100;
        const height = ((y2 - y1) / viewport.height) * 100;

        if (width < 0.5 || height < 0.5) continue;

        let dest = null;
        if (ann.dest) {
            dest = await resolveDest(ann.dest);
        } else if (ann.ref) {
            try {
                const resolved = await state.pdfDoc.getDestination(ann.ref);
                dest = await resolveDest(resolved);
            } catch (e) { /* ignore */ }
        }

        links.push({
            left: left.toFixed(2),
            top: top.toFixed(2),
            width: width.toFixed(2),
            height: height.toFixed(2),
            url: ann.url || null,
            dest: dest,
        });
    }

    return links;
}

async function resolveDest(dest) {
    if (!dest || !Array.isArray(dest) || dest.length === 0) return null;
    const namedDest = dest[0];
    let pageIndex = null;
    if (typeof namedDest === 'string') {
        const resolved = await state.pdfDoc.getDestination(namedDest);
        if (resolved && resolved[0]) {
            pageIndex = await state.pdfDoc.getPageIndex(resolved[0]);
        }
    } else if (namedDest) {
        try {
            pageIndex = await state.pdfDoc.getPageIndex(namedDest);
        } catch (e) { /* ignore */ }
    }
    return pageIndex !== null ? pageIndex + 1 : null;
}

async function initFlipbook() {
    el.flipbook.innerHTML = '';

    const firstPage = state.pageImages[0];
    const w = firstPage.width;
    const h = firstPage.height;

    state.pageFlip = new PageFlip(el.flipbook, {
        width: w,
        height: h,
        size: 'stretch',
        minWidth: 250,
        maxWidth: 600,
        minHeight: 300,
        maxHeight: 900,
        drawShadow: true,
        flippingTime: 600,
        usePortrait: true,
        startZIndex: 0,
        autoSize: true,
        maxShadowOpacity: 0.5,
        showCover: true,
        useMouseEvents: true,
        clickEventForward: true,
        swipeDistance: 30,
        showPageCorners: true,
        disableFlipByClick: false,
    });

    const pagesHTML = state.pageImages.map((p, i) => {
        const linksHTML = buildLinksHTML(p.links, i + 1);
        const imgSrc = p.dataUrl || '';
        const placeholderClass = p.rendered ? '' : 'page-placeholder';
        return `<div class="page ${placeholderClass}" data-page="${i + 1}">
            <img src="${imgSrc}" alt="Page ${i + 1}">
            ${linksHTML}
            <span class="page-number">${i + 1}</span>
        </div>`;
    }).join('');

    el.flipbook.innerHTML = pagesHTML;

    state.pageFlip.loadFromHTML(document.querySelectorAll('.page'));

    attachLinkHandlers();

    state.pageFlip.on('flip', (e) => {
        const pageNum = e.data;
        el.pageInput.value = pageNum + 1;
    });

    state.pageFlip.on('changeState', (e) => {
        if (e.data === 'read') {
            updatePageIndicator();
        }
    });
}

function buildLinksHTML(links, pageNum) {
    if (!links || links.length === 0) return '';
    return links.map((link, i) => {
        if (link.url) {
            return `<a class="page-link" href="${escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer"
                style="left:${link.left}%;top:${link.top}%;width:${link.width}%;height:${link.height}%"
                data-link="${i}"></a>`;
        } else if (link.dest) {
            return `<a class="page-link page-link-internal" href="#page-${link.dest}"
                style="left:${link.left}%;top:${link.top}%;width:${link.width}%;height:${link.height}%"
                data-dest="${link.dest}" data-link="${i}"></a>`;
        }
        return '';
    }).join('');
}

function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attachLinkHandlers() {
    el.flipbook.querySelectorAll('.page-link-internal').forEach((a) => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const dest = parseInt(a.dataset.dest);
            if (dest && state.pageFlip) {
                state.pageFlip.turnToPage(dest - 1);
            }
        });
    });
}

function updatePageIndicator() {
    if (!state.pageFlip) return;
    const current = state.pageFlip.getCurrentPageIndex() + 1;
    el.pageInput.value = current;
    el.pageTotal.textContent = `/ ${state.totalPages}`;
    el.pageTotal.setAttribute('data-pageshort', `${current}/${state.totalPages}`);
    el.pageInput.max = state.totalPages;

    document.querySelectorAll('.thumbnail-item').forEach((t) => {
        t.classList.toggle('active', parseInt(t.dataset.page) === current);
    });

    document.querySelectorAll('.outline-item').forEach((t) => {
        const p = parseInt(t.dataset.page);
        if (!p) return;
        t.classList.toggle('active', p === current);
    });

    const activeThumb = document.querySelector('.thumbnail-item.active');
    if (activeThumb && state.sidebarOpen) {
        activeThumb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    const activeOutline = document.querySelector('.outline-item.active');
    if (activeOutline && state.sidebarOpen) {
        activeOutline.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function buildThumbnails() {
    el.thumbnailsList.innerHTML = '';
    state.pageImages.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'thumbnail-item';
        div.dataset.page = i + 1;
        const imgSrc = p.dataUrl || '';
        div.innerHTML = `<img src="${imgSrc}" alt="Page ${i + 1}"><span class="thumb-num">${i + 1}</span>`;
        div.addEventListener('click', () => {
            state.pageFlip.turnToPage(i);
            updatePageIndicator();
        });
        el.thumbnailsList.appendChild(div);
    });
}

async function loadOutline() {
    try {
        const outline = await state.pdfDoc.getOutline();
        state.outline = outline || [];
        buildOutline(state.outline, 0);
    } catch (e) {
        console.warn('No outline available:', e);
        state.outline = [];
        buildOutline([], 0);
    }
}

async function buildOutline(items, level) {
    el.outlineList.innerHTML = '';

    if (!items || items.length === 0) {
        el.outlineList.innerHTML = '<div class="outline-empty">Ce PDF ne contient pas de sommaire.</div>';
        return;
    }

    for (const item of items) {
        const div = document.createElement('div');
        div.className = 'outline-item';
        div.style.paddingLeft = (14 + level * 16) + 'px';

        let pageNum = null;
        try {
            if (item.dest) {
                let dest = item.dest;
                if (typeof dest === 'string') {
                    dest = await state.pdfDoc.getDestination(dest);
                }
                if (dest && dest[0]) {
                    const idx = await state.pdfDoc.getPageIndex(dest[0]);
                    pageNum = idx + 1;
                }
            }
        } catch (e) { /* ignore */ }

        const title = document.createElement('span');
        title.className = 'outline-title';
        title.textContent = item.title;
        div.appendChild(title);

        if (pageNum) {
            const pageSpan = document.createElement('span');
            pageSpan.className = 'outline-page';
            pageSpan.textContent = pageNum;
            div.appendChild(pageSpan);

            div.dataset.page = pageNum;
            div.addEventListener('click', () => {
                state.pageFlip.turnToPage(pageNum - 1);
                updatePageIndicator();
            });
        }

        el.outlineList.appendChild(div);

        if (item.items && item.items.length > 0) {
            await buildOutlineChildren(item.items, level + 1);
        }
    }
}

async function buildOutlineChildren(items, level) {
    for (const item of items) {
        const div = document.createElement('div');
        div.className = 'outline-item';
        div.style.paddingLeft = (14 + level * 16) + 'px';

        let pageNum = null;
        try {
            if (item.dest) {
                let dest = item.dest;
                if (typeof dest === 'string') {
                    dest = await state.pdfDoc.getDestination(dest);
                }
                if (dest && dest[0]) {
                    const idx = await state.pdfDoc.getPageIndex(dest[0]);
                    pageNum = idx + 1;
                }
            }
        } catch (e) { /* ignore */ }

        const title = document.createElement('span');
        title.className = 'outline-title';
        title.textContent = item.title;
        div.appendChild(title);

        if (pageNum) {
            const pageSpan = document.createElement('span');
            pageSpan.className = 'outline-page';
            pageSpan.textContent = pageNum;
            div.appendChild(pageSpan);

            div.dataset.page = pageNum;
            div.addEventListener('click', () => {
                state.pageFlip.turnToPage(pageNum - 1);
                updatePageIndicator();
            });
        }

        el.outlineList.appendChild(div);

        if (item.items && item.items.length > 0) {
            await buildOutlineChildren(item.items, level + 1);
        }
    }
}

function switchSidebarTab(tab) {
    el.tabThumbnails.classList.toggle('active', tab === 'thumbnails');
    el.tabOutline.classList.toggle('active', tab === 'outline');
    el.thumbnailsList.classList.toggle('active', tab === 'thumbnails');
    el.outlineList.classList.toggle('active', tab === 'outline');
}

function initControls() {
    el.btnPrev.addEventListener('click', () => state.pageFlip.flipPrev());
    el.btnNext.addEventListener('click', () => state.pageFlip.flipNext());

    el.pageInput.addEventListener('change', () => {
        let p = parseInt(el.pageInput.value);
        if (isNaN(p) || p < 1) p = 1;
        if (p > state.totalPages) p = state.totalPages;
        state.pageFlip.turnToPage(p - 1);
    });

    el.btnZoomIn.addEventListener('click', () => setZoom(state.zoom + 0.15));
    el.btnZoomOut.addEventListener('click', () => setZoom(state.zoom - 0.15));

    el.btnThumbnails.addEventListener('click', () => {
        state.sidebarOpen = !state.sidebarOpen;
        el.sidebar.classList.toggle('open', state.sidebarOpen);
    });

    el.btnCloseSidebar.addEventListener('click', () => {
        state.sidebarOpen = false;
        el.sidebar.classList.remove('open');
    });

    el.tabThumbnails.addEventListener('click', () => switchSidebarTab('thumbnails'));
    el.tabOutline.addEventListener('click', () => switchSidebarTab('outline'));

    el.btnFullscreen.addEventListener('click', toggleFullscreen);

    el.btnExport.addEventListener('click', exportHTML);

    el.btnNew.addEventListener('click', () => {
        if (confirm('Voulez-vous ouvrir un nouveau PDF ?')) {
            location.reload();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (el.app.classList.contains('hidden')) return;
        switch (e.key) {
            case 'ArrowLeft':
                state.pageFlip.flipPrev();
                break;
            case 'ArrowRight':
                state.pageFlip.flipNext();
                break;
            case 'f': case 'F':
                toggleFullscreen();
                break;
            case 't': case 'T':
                el.btnThumbnails.click();
                break;
            case 'Escape':
                if (state.sidebarOpen) {
                    state.sidebarOpen = false;
                    el.sidebar.classList.remove('open');
                }
                break;
        }
    });

    window.addEventListener('resize', () => {
        if (state.pageFlip) state.pageFlip.update();
    });
}

function setZoom(z) {
    state.zoom = Math.max(0.5, Math.min(2.5, z));
    el.flipbookContainer.style.transform = `scale(${state.zoom})`;
    el.zoomLevel.textContent = Math.round(state.zoom * 100) + '%';
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        el.app.requestFullscreen?.() || el.app.webkitRequestFullscreen?.();
    } else {
        document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
}

async function exportHTML() {
    const unrendered = state.pageImages.filter(p => !p.rendered).length;
    if (unrendered > 0) {
        showLoading(`Finalisation du rendu… (${state.totalPages - unrendered}/${state.totalPages})`);
        await renderRemainingPages();
    }

    showLoading('Génération du fichier HTML…');

    try {
        const firstPage = state.pageImages[0];
        const w = firstPage.width;
        const h = firstPage.height;

        const pagesHTML = state.pageImages.map((p, i) => {
            const linksHTML = buildLinksHTML(p.links, i + 1);
            return `<div class="page" data-page="${i + 1}">
                <img src="${p.dataUrl}" alt="Page ${i + 1}">
                ${linksHTML}
                <span class="page-number">${i + 1}</span>
            </div>`;
        }).join('');

        const html = generateExportHTML(state.fileName, w, h, pagesHTML, state.totalPages);

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.fileName}-flipbook.html`;
        a.click();
        URL.revokeObjectURL(url);

        hideLoading();
    } catch (err) {
        hideLoading();
        console.error(err);
        alert('Erreur lors de l\'export : ' + err.message);
    }
}

function generateExportHTML(title, w, h, pagesHTML, totalPages) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Flipbook</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#1a1a2e;--accent:#e94560;--text:#eaeaea;--text-muted:#8a8a9a}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;height:100vh;user-select:none}
.toolbar{display:flex;align-items:center;justify-content:center;gap:12px;height:56px;background:#16213e;border-bottom:1px solid #2a2a4a}
.tool-btn{display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:transparent;border:none;border-radius:8px;color:var(--text);cursor:pointer;transition:background .2s}
.tool-btn:hover{background:rgba(255,255,255,.08)}
.tool-btn svg{width:20px;height:20px}
.page-info{font-size:14px;color:var(--text-muted);min-width:80px;text-align:center}
.title{font-size:14px;font-weight:600;color:var(--accent);position:absolute;left:20px;line-height:56px}
.flipbook-container{height:calc(100vh - 56px);display:flex;align-items:center;justify-content:center;overflow:auto;perspective:2000px}
.flipbook .page{background:#fff;overflow:hidden;position:relative}
.flipbook .page img{width:100%;height:100%;object-fit:contain;display:block}
.flipbook .page .page-number{position:absolute;bottom:6px;font-size:11px;color:#999;width:100%;text-align:center}
.page-link{position:absolute;cursor:pointer;background:transparent;z-index:5;border:2px solid transparent;border-radius:2px;transition:border-color .15s}
.page-link:hover{border-color:rgba(233,69,96,.6);background:rgba(233,69,96,.08)}
.page-link-internal{cursor:pointer}
::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:#2a2a4a;border-radius:4px}
</style>
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/page-flip@0.3.0/dist/js/pageFlip.module.js" type="module"><\/script>
</head>
<body>
<div class="toolbar">
    <span class="title">${title}</span>
    <button class="tool-btn" onclick="pf.flipPrev()" title="Précédent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <span class="page-info" id="page-info">1 / ${totalPages}</span>
    <button class="tool-btn" onclick="pf.flipNext()" title="Suivant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button class="tool-btn" onclick="toggleFs()" title="Plein écran"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</div>
<div class="flipbook-container">
    <div id="flipbook" class="flipbook">${pagesHTML}</div>
</div>
<script type="module">
import { PageFlip } from 'https://cdn.jsdelivr.net/npm/page-flip@0.3.0/dist/js/pageFlip.module.js';
window.pf = new PageFlip(document.getElementById('flipbook'), {
    width:${w},height:${h},size:'stretch',minWidth:250,maxWidth:600,minHeight:300,maxHeight:900,
    drawShadow:true,flippingTime:600,usePortrait:true,maxShadowOpacity:0.5,showCover:true,
    useMouseEvents:true,clickEventForward:true,swipeDistance:30,showPageCorners:true,disableFlipByClick:false
});
pf.loadFromHTML(document.querySelectorAll('.page'));
pf.on('flip', (e) => { document.getElementById('page-info').textContent = (e.data + 1) + ' / ${totalPages}'; });
document.querySelectorAll('.page-link-internal').forEach((a) => {
    a.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const dest = parseInt(a.dataset.dest);
        if (dest) pf.turnToPage(dest - 1);
    });
});
window.toggleFs = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
};
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') pf.flipPrev();
    if (e.key === 'ArrowRight') pf.flipNext();
    if (e.key === 'f' || e.key === 'F') toggleFs();
});
<\/script>
</body>
</html>`;
}

const DEFAULT_PDF = 'document.pdf';
const URL_PARAM = 'pdf';

function init() {
    initDropZone();
    initControls();

    const params = new URLSearchParams(window.location.search);
    const pdfParam = params.get(URL_PARAM);

    if (pdfParam) {
        loadPDF(pdfParam).catch(err => {
            console.error(err);
            hideBoot();
            el.dropZone.classList.remove('hidden');
            el.dropText.innerHTML = 'Impossible de charger le PDF depuis l\'URL.<br>Déposez un fichier PDF ici ou cliquez pour parcourir.';
        });
    } else {
        loadPDF(DEFAULT_PDF).catch(err => {
            console.warn('No default PDF found:', err.message);
            hideBoot();
            el.dropZone.classList.remove('hidden');
            el.dropText.innerHTML = 'Aucun PDF par défaut trouvé.<br>Déposez un fichier PDF ici ou cliquez pour parcourir.';
        });
    }
}

init();
