// ==UserScript==
// @name         VS-Exporter JSON & HTML Export mit Versionierung
// @namespace    http://customstylescript.net/
// @version      5.0
// @description  Exportiert Imperia-Dokumente mit vollständiger Versionierungslogik (metadata.json + HTML-Versionen) in eine ZIP-Datei, inkl. bestehender Funktionen (Semantik, Alpha-Listen, Schlagworte, Anlagen etc.)
// @match        https://imperia.berlinonline.de/imp/document/browser*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(async function() {
    'use strict';

    // === Hilfs-Logger ===
    const log = (...args) => console.log('[VS-Exporter]', ...args);

    // === Version ===
    log('VS-Exporter v5.0 geladen');

    // === Bibliotheken nachladen: FileSaver.js & JSZip ====================================================
    const injectScript = url => new Promise(res => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = res;
        document.head.appendChild(s);
    });

    async function ensureLibs() {
        // FileSaver.js
        if (typeof saveAs === 'undefined') {
            log('FileSaver.js fehlt, lade nach...');
            await injectScript('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js');
            log('FileSaver.js geladen');
        }
        // JSZip
        if (typeof JSZip === 'undefined') {
            log('JSZip fehlt, lade nach...');
            await injectScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
            log('JSZip geladen');
        }
    }

    // === CSS für Alpha-Listen =================================================================================
    const style = document.createElement('style');
    style.textContent = '.alpha-list { margin-left: 1.5em; padding-left: 0; }';
    document.head.appendChild(style);
    log('CSS für Alpha-Listen eingefügt');

    // === Slugify-Funktion ===================================================================================
    function slugify(txt) {
        return txt
            .replace(/Ä/g,'Ae').replace(/ä/g,'ae')
            .replace(/Ö/g,'Oe').replace(/ö/g,'oe')
            .replace(/Ü/g,'Ue').replace(/ü/g,'ue')
            .replace(/ß/g,'ss')
            .toLowerCase()
            .replace(/\s*\(.*?\)\s*/g,'')        // Klammerinhalt entfernen
            .replace(/[^a-z0-9]+/g,'_')          // Nicht-Alphanum. durch Unterstrich ersetzen
            .replace(/^_|_$/g,'');               // führende/abschließende Unterstriche entfernen
    }

    // === Gesetzes-Mapping für Schlagworte ====================================================================
    const lawDir = {
        'SGB II':'sgb_II',
        'SGB IX':'sgb_IX',
        'SGB XI':'sgb_XI',
        'SGB XII':'sgb_XII',
        'AsylbLG':'asylblg'
    };

    // === Semantische Listenverarbeitung (rekursiv) ===========================================================
    function processListChildren(nodes, linkMatches) {
        let html = '';
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            // 1) Ignoriere Marginal-Bereich
            if (node.id === 'layout-grid__area--marginal') break;

            // 2) UL mit a), b), ... in semantisches OL lower-alpha umwandeln
            if (node.tagName === 'UL') {
                const lis = Array.from(node.children).filter(n => n.tagName === 'LI');
                if (lis.length && lis.every(li => /^[a-z]\)|^[a-z]\./i.test(li.innerText.trim()))) {
                    const ol = document.createElement('ol');
                    ol.classList.add('alpha-list');
                    lis.forEach(li => {
                        const content = li.innerHTML.replace(/^[a-z](?:\)|\.)\s*/i, '').trim();
                        const newLi = document.createElement('li');
                        newLi.innerHTML = content;
                        // Inline-Styles für lower-alpha
                        newLi.style.listStyleType = 'lower-alpha';
                        newLi.style.marginLeft = '1em';
                        ol.appendChild(newLi);
                    });
                    html += ol.outerHTML;
                    continue;
                }
            }

            // 3) OL + nachfolgende UL semantisch verschachteln
            if (node.tagName === 'OL' && i + 1 < nodes.length && nodes[i + 1].tagName === 'UL') {
                const lastLi = node.querySelector('li:last-of-type');
                if (lastLi && lastLi.textContent.trim().endsWith(':')) {
                    const mergedOl = node.cloneNode(true);
                    const nestedUl = nodes[i + 1].cloneNode(true);
                    mergedOl.querySelector('li:last-of-type').appendChild(nestedUl);
                    html += mergedOl.outerHTML;
                    i++;
                    continue;
                }
            }

            // 4) Paragraphen-Block: Überschrift + Inhalt
            if (node.classList?.contains('modul-gesetz-paragraph')) {
                const heading = node.querySelector('h1.title,h2.title,h3.title,h4.title,h5.title,h6.title');
                if (heading) html += heading.outerHTML;
                const textile = node.querySelector('div.textile');
                if (textile) html += processListChildren(Array.from(textile.children), linkMatches);
                continue;
            }

            // 5) Textile-Container auflösen
            if (node.tagName === 'DIV' && node.classList.contains('textile')) {
                html += processListChildren(Array.from(node.children), linkMatches);
                continue;
            }

            // 6) Default: Links ersetzen und HTML anhängen
            let chunk = node.outerHTML;
            linkMatches.forEach(({ text, href }) => {
                const esc = text.replace(/[-\/^$*+?.()|[\]{}]/g, '\\$&');
                chunk = chunk.replace(new RegExp(esc, 'g'), `<a href="${href}">${text}</a>`);
            });
            html += chunk;
        }
        return html;
    }

    // === Kernfunktion: Einzel-Export mit Versionierungslogik =============================================
    async function exportRow(row) {
        log('=== Starte Einzel-Export ===');
        await ensureLibs();

        // --- Metadaten aus der Zeile extrahieren -------------------------------------------------------
        const title = row.querySelector('.col__title label')?.innerText.trim() || '';
        const rel = row.querySelector('.col__url a')?.href || '';
        log('Titel:', title, '| Rel. URL:', rel);

        const imperiaUrl = rel.startsWith('http') ? rel : 'https://imperia.berlinonline.de' + rel;
        const publicUrl = imperiaUrl.replace(/^https?:\/\/imperia\.berlinonline\.de/, 'https://www.berlin.de');
        const slug = slugify(title);

        const parts = imperiaUrl.split('/');
        const category = parts[parts.indexOf('kategorie') + 1] || '';
        const politikfeld = parts[parts.indexOf('sen') + 1] || '';
        log('Kategorie:', category, '| Politikfeld:', politikfeld);

        // --- Dokument holen und parsen -----------------------------------------------------------------
        let textHtml = '';
        try {
            textHtml = await fetch(imperiaUrl, { credentials: 'include' }).then(r => r.text());
            log('Detailseite geladen');
        } catch (e) {
            log('Fehler beim Laden der Seite:', e);
            return;
        }
        const doc = new DOMParser().parseFromString(textHtml, 'text/html');

        // --- Überschriften bereinigen -----------------------------------------------------------------
        doc.querySelectorAll('h1.title div.textile, h2.title div.textile, h3.title div.textile, h4.title div.textile, h5.title div.textile, h6.title div.textile')
           .forEach(divEl => {
               const h = divEl.closest('h1,h2,h3,h4,h5,h6');
               if (h) {
                   h.innerHTML = divEl.innerText.trim();
                   log('Überschrift bereinigt:', h.tagName, h.innerText);
               }
           });

        // --- Datum „gültig von“, Inkraft-/Außerkraft-Daten bestimmen -----------------------------------
        let gueltigVon = '';
        const mainP = doc.querySelector('#layout-grid__area--maincontent .textile p');
        if (mainP) {
            const m = mainP.innerText.match(/vom\s*(\d{1,2}\.\s*\w+\s*\d{4})/i);
            if (m) { gueltigVon = m[1]; log('Datum „gültig von“ gefunden:', gueltigVon); }
        }
        const inkP = Array.from(doc.querySelectorAll('p')).find(p => /inkrafttreten/i.test(p.innerText));
        if (inkP) {
            const m = inkP.innerText.match(/(\d{1,2}\.\s*\w+\s*\d{4})/);
            if (m) { gueltigVon = m[1]; log('Inkrafttreten-Datum gefunden:', gueltigVon); }
        }
        let ink = '', aus = '';
        doc.querySelectorAll('h2').forEach(h2 => {
            const t = h2.innerText.toLowerCase();
            if (t.includes('inkrafttreten')) ink = h2.innerText.trim();
            if (/au[ßs]erkrafttreten/.test(t)) aus = h2.innerText.trim();
        });
        log('Inkraft:', ink, '| Außerkraft:', aus);

        // --- Versionen aus dem Archiv extrahieren --------------------------------------------------------
        const archiveDiv = doc.querySelector('div.js-accordion#gesetz_archiv');
        const versionLis = archiveDiv ? Array.from(archiveDiv.querySelectorAll('li')) : [];
        let detailVersionen = [];

        // Vor Entfernen an einem Array merken, später aus dem DOM rausnehmen
        // (Wir entfernen danach contentheader und archiv, damit wir den sichtbaren Teil parsen.)
        detailVersionen = [];

        for (let i = 0; i < versionLis.length; i++) {
            const li = versionLis[i];
            // Datum extrahieren: "ab DD.MM.YYYY"
            const datumMatch = li.innerText.match(/ab\s*(\d{2}\.\d{2}\.\d{4})/);
            const datum = datumMatch ? datumMatch[1] : '';
            const jahr = datum ? datum.split('.')[2] : '';

            // Link zur Version: falls li einen <a> enthält, sonst fallback auf imperiaUrl
            let versionUrl = imperiaUrl;
            const aTag = li.querySelector('a');
            if (aTag) {
                const href = aTag.getAttribute('href') || aTag.href;
                versionUrl = href.startsWith('http') ? href : 'https://imperia.berlinonline.de' + href;
            }
            log(`Version ${i+1}: Datum=${datum}, URL=${versionUrl}`);

            // Versionieren: Seite abrufen und semantisch parsen
            let versionHtmlRaw = '';
            try {
                versionHtmlRaw = await fetch(versionUrl, { credentials: 'include' }).then(r => r.text());
                log(`Version ${i+1} HTML geladen`);
            } catch(e) {
                log(`Fehler beim Laden Version ${i+1}:`, e);
            }

            // DOMParser für Version
            const versionDoc = new DOMParser().parseFromString(versionHtmlRaw, 'text/html');

            // Überschriften in dieser Version bereinigen (analog)
            versionDoc.querySelectorAll('h1.title div.textile, h2.title div.textile, h3.title div.textile, h4.title div.textile, h5.title div.textile, h6.title div.textile')
                .forEach(divEl => {
                    const h = divEl.closest('h1,h2,h3,h4,h5,h6');
                    if (h) {
                        h.innerHTML = divEl.innerText.trim();
                    }
                });

            // Links für Schlagworte generieren (gleichen Regex wie für den Haupt-Text)
            const versionText = versionDoc.body.innerText;
            const versionLinkMatches = [];
            let match;
            const lawRegex = /§\s*(\d+)[^\S\r\n]*(?:Abs\.?\s*\d+)*[^\S\r\n]*(SGB\s+(?:II|IX|XI|XII)|AsylbLG)/g;
            while ((match = lawRegex.exec(versionText))) {
                const [full, num, lawFull] = match;
                const lawSlug = lawDir[lawFull];
                if (lawSlug) {
                    const href = `https://www.gesetze-im-internet.de/${lawSlug}/__${num}.html`;
                    versionLinkMatches.push({ text: full, href });
                }
            }

            // Den Inhalt dieser Version semantisch aufbauen:
            // - Überschrift(s)
            // - Toc und Text
            const versionHerounit = versionDoc.querySelector('#layout-grid__area--herounit');
            const versionMain = versionDoc.querySelector('#layout-grid__area--maincontent');
            let beforeVersionToc = '', versionTocHtml = '', afterVersionToc = '';
            if (versionMain) {
                const toc = versionMain.querySelector('#gesetz_toc');
                if (toc) {
                    versionTocHtml = toc.outerHTML;
                    const raw = versionMain.innerHTML;
                    const idx = raw.indexOf(versionTocHtml);
                    beforeVersionToc = raw.slice(0, idx);
                    afterVersionToc = raw.slice(idx + versionTocHtml.length);
                } else {
                    beforeVersionToc = versionMain.innerHTML;
                }
            }

            let versionContentHtml = '';
            if (versionHerounit) versionContentHtml += versionHerounit.outerHTML;
            versionContentHtml += beforeVersionToc + versionTocHtml;
            const afterDivVersion = document.createElement('div');
            afterDivVersion.innerHTML = afterVersionToc;
            versionContentHtml += processListChildren(Array.from(afterDivVersion.children), versionLinkMatches);

            // Status ableiten: erste Eintragung (= Index 0) ist aktuell/in Kraft, andere außer Kraft
            const status = (i === 0 ? 'in Kraft' : 'außer Kraft');
            const aktuell = (i === 0);

            detailVersionen.push({
                version: `v${i+1}`,
                status,
                datum,
                jahr,
                content: versionContentHtml,
                url: versionUrl,
                aktuell
            });
        }

        // --- Bereits existierende Content-Knoten bereinigen ------------------------------------------------
        const herounit = doc.querySelector('#layout-grid__area--herounit');
        const container = herounit?.parentElement;
        if (container) {
            // Content-Header entfernen
            container.querySelectorAll('#layout-grid__area--contentheader, div.js-accordion#gesetz_archiv').forEach(e => e.remove());
            log('Contentheader & Archiv entfernt für Hauptversion');
        }

        // --- Anlagen sammeln --------------------------------------------------------------------------------
        let attachments = [];
        if (container) {
            const dl = container.querySelector('section.modul-download-multi');
            if (dl) {
                attachments = Array.from(dl.querySelectorAll('a.link--download')).map(a => {
                    const href = a.getAttribute('href') || a.href;
                    return href.startsWith('http') ? href : 'https://www.berlin.de' + href;
                });
                log('Anlagen:', attachments);
            }
        }

        // --- Schlagworte und Linkplatzhalter für Hauptversion -------------------------------------------------
        let keywords = (doc.querySelector('meta[name="keywords"]')?.content.split(',') || []).map(s => s.trim());
        // Filter: entferne iiNNNN
        keywords = keywords.filter(k => !/^ii\d+$/i.test(k));
        log('Keywords nach Filterung:', keywords);

        const mainText = container?.innerText || '';
        const mainLinkMatches = [];
        {
            const regex = /§\s*(\d+)[^\S\r\n]*(?:Abs\.?\s*\d+)*[^\S\r\n]*(SGB\s+(?:II|IX|XI|XII)|AsylbLG)/g;
            let m;
            while ((m = regex.exec(mainText))) {
                const [full, num, lawFull] = m;
                const lawSlug = lawDir[lawFull];
                if (lawSlug) {
                    const href = `https://www.gesetze-im-internet.de/${lawSlug}/__${num}.html`;
                    keywords.push(`${lawSlug}_paragraf${num}`);
                    mainLinkMatches.push({ text: full, href });
                    log('Gesetz verlinkt:', full, '->', href);
                }
            }
        }
        keywords = Array.from(new Set(keywords));

        // --- Content für Hauptversion semantisch parsen --------------------------------------------------------
        let contentHtml = '';
        if (herounit) contentHtml += herounit.outerHTML;
        const mainContent = doc.querySelector('#layout-grid__area--maincontent');
        const tocHtml = mainContent.querySelector('#gesetz_toc')?.outerHTML || '';
        let beforeToc = '', afterToc = '';
        if (tocHtml) {
            const raw = mainContent.innerHTML;
            const idx = raw.indexOf(tocHtml);
            beforeToc = raw.slice(0, idx);
            afterToc = raw.slice(idx + tocHtml.length);
        } else {
            beforeToc = mainContent.innerHTML;
        }
        contentHtml += beforeToc + tocHtml;
        const afterDiv = document.createElement('div');
        afterDiv.innerHTML = afterToc;
        contentHtml += processListChildren(Array.from(afterDiv.children), mainLinkMatches);

        // --- metadata.json zusammenbauen --------------------------------------------------------------------
        const meta = {
            titel: title,
            dokumentnummer: slug,
            politikfeld,
            kategorie: category,
            status: 'veröffentlicht',
            schlagworte: keywords,
            url: publicUrl,
            anlagen: attachments,
            inkrafttreten: ink,
            ausserkrafttreten: aus,
            versionen: detailVersionen
        };

        // --- ZIP-Paket erstellen =============================================================================
        const zip = new JSZip();
        // metadata.json
        zip.file('metadata.json', JSON.stringify(meta, null, 2));
        // einzelne HTML-Dateien für jede Version
        detailVersionen.forEach(v => {
            zip.file(`${v.version}.html`, v.content);
        });
        // optional: Hauptversion ebenfalls separat speichern (z.B. v1.html ist in detailVersionen[0])
        // ZIP generieren & abspeichern
        try {
            const blob = await zip.generateAsync({ type: 'blob' });
            saveAs(blob, `${slug}_alle_versionen.zip`);
            log('ZIP mit allen Versionen erstellt und zum Download angeboten');
        } catch (e) {
            log('Fehler beim Erstellen der ZIP-Datei:', e);
        }
    }

    // === UI: Einzel-Export-Button =================================================================================
    document.body.addEventListener('click', e => {
        const cell = e.target.closest('td.col__select');
        if (!cell) return;
        const row = cell.closest('tr.i-listview-node');
        if (!row) return;
        const cb = row.querySelector('input[type=checkbox]');
        const prev = row.querySelector('td.vs-single-cell');
        if (prev) prev.remove();
        if (cb.checked) {
            const idx = cell.cellIndex;
            const c2 = row.insertCell(idx + 1);
            c2.className = 'vs-single-cell';
            c2.style = 'padding:2px;';
            const btn = document.createElement('button');
            btn.textContent = 'Exportiere dieses Dokument';
            btn.addEventListener('click', () => exportRow(row));
            c2.appendChild(btn);
        }
    }, true);

    // === UI: Bulk-Export ========================================================================================
    function addUI() {
        if (document.querySelector('#vs-bulk-ui')) return;
        const box = document.createElement('div');
        box.id = 'vs-bulk-ui';
        box.style = 'position:fixed;top:10px;left:10px;z-index:9999;background:#fff8dc;padding:8px;border:1px solid #000;';
        const sel = document.createElement('select');
        sel.id = 'vs-exporter-count';
        ['5', '10', 'all'].forEach(o => {
            const opt = document.createElement('option');
            opt.value = o;
            opt.textContent = o;
            sel.appendChild(opt);
        });
        const zipBtn = document.createElement('button');
        zipBtn.textContent = '🗂 Bulk Export';
        zipBtn.addEventListener('click', () => {
            // Für Bulk-Export müsste man hier die markierten Zeilen durchlaufen und nacheinander exportRow ausführen.
            // Derzeit bleibt diese Funktion leer, um Zeilen-Export und Versionierung separat zu halten.
            alert('Bulk-Export ist in v5.0 noch nicht aktiviert.');
        });
        box.append(sel, zipBtn);
        document.body.appendChild(box);
    }
    addUI();
    new MutationObserver(addUI).observe(document.body, { childList: true, subtree: true });
})();
