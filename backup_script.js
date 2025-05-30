
(async function() {
    'use strict';
    const log = (...args) => console.log('[VS-Exporter]', ...args);
    log('VS-Exporter v4.18 geladen');

    // FileSaver.js nachladen
    const injectScript = url => new Promise(res => {
        const s = document.createElement('script'); s.src = url; s.onload = res; document.head.appendChild(s);
    });
    async function ensureLibs() {
        if (typeof saveAs === 'undefined') {
            await injectScript('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js');
        }
    }

    // CSS für Alpha-Listen (fällt hier zurück, hauptsächlich inline-Styles verwendet)
    const style = document.createElement('style');
    style.textContent = '.alpha-list { margin-left: 1.5em; padding-left: 0; }';
    document.head.appendChild(style);

    // Slugify mit Umlaut-Ersetzung
    function slugify(txt) {
        return txt
            .replace(/Ä/g,'Ae').replace(/ä/g,'ae')
            .replace(/Ö/g,'Oe').replace(/ö/g,'oe')
            .replace(/Ü/g,'Ue').replace(/ü/g,'ue')
            .replace(/ß/g,'ss')
            .toLowerCase()
            .replace(/\s*\(.*?\)\s*/g,'')
            .replace(/[^a-z0-9]+/g,'_')
            .replace(/^_|_$/g,'');
    }

    // Gesetzes-Mapping
    const lawDir = { 'SGB II':'sgb_II', 'SGB IX':'sgb_IX', 'SGB XI':'sgb_XI', 'SGB XII':'sgb_XII', 'AsylbLG':'asylblg' };

    async function exportRow(row) {
        await ensureLibs();
        const title = row.querySelector('.col__title label')?.innerText.trim() || '';
        const rel = row.querySelector('.col__url a')?.href || '';
        const imperiaUrl = rel.startsWith('http') ? rel : 'https://imperia.berlinonline.de' + rel;
        const publicUrl = imperiaUrl.replace(/^https?:\/\/imperia\.berlinonline\.de/, 'https://www.berlin.de');
        const slug = slugify(title);
        log('Exportiere:', title);

        // Kategorie & Politikfeld
        const parts = imperiaUrl.split('/');
        const category = parts[parts.indexOf('kategorie')+1] || '';
        const politikfeld = parts[parts.indexOf('sen')+1] || '';
        log('Kategorie:', category, 'Politikfeld:', politikfeld);

        // Dokument laden + parsen
        let textHtml=''; try { textHtml = await fetch(imperiaUrl,{credentials:'include'}).then(r=>r.text()); } catch(e) { log('Fetch-Error:',e); }
        const doc = new DOMParser().parseFromString(textHtml,'text/html');

        // Überschriften bereinigen
        doc.querySelectorAll('h1.title div.textile, h2.title div.textile, h3.title div.textile, h4.title div.textile, h5.title div.textile, h6.title div.textile')
           .forEach(divEl=>{const h=divEl.closest('h1,h2,h3,h4,h5,h6'); if(h) h.innerHTML=divEl.innerText.trim();});

        // Datum & Inkraft/Außerkraft
        let gueltigVon='';
        const mainP=doc.querySelector('#layout-grid__area--maincontent .textile p');
        if(mainP){ const m=mainP.innerText.match(/vom\s*(\d{1,2}\.\s*\w+\s*\d{4})/i); if(m) gueltigVon=m[1]; }
        const inkP=Array.from(doc.querySelectorAll('p')).find(p=>/inkrafttreten/i.test(p.innerText));
        if(inkP){ const m=inkP.innerText.match(/(\d{1,2}\.\s*\w+\s*\d{4})/); if(m) gueltigVon=m[1]; }
        let ink='',aus=''; doc.querySelectorAll('h2').forEach(h2=>{const t=h2.innerText.toLowerCase(); if(t.includes('inkrafttreten')) ink=h2.innerText.trim(); if(/au[ßs]erkrafttreten/.test(t)) aus=h2.innerText.trim();});

        // Versionen
        const versionLis=Array.from(doc.querySelectorAll('#gesetz_archiv li'));
        const versionen=versionLis.length>0?versionLis.map((li,i)=>{const von=(li.innerText.match(/ab\s*(\d{2}\.\d{2}\.\d{4})/)||[])[1]||''; const bis=i>0?(versionLis[i-1].innerText.match(/ab\s*(\d{2}\.\d{2}\.\d{4})/)||[])[1]:'aktuell'; return{gueltig_von:von,gueltig_bis:bis,datei:`inhalt_v${i+1}.html`,aktuell:bis==='aktuell'};}) : [{gueltig_von:'',gueltig_bis:'aktuell',datei:'inhalt_v1.html',aktuell:true}];
        if(gueltigVon && versionen.length) versionen[0].gueltig_von=gueltigVon;

        // Inhalte vorbereiten
        const herounit=doc.querySelector('#layout-grid__area--herounit');
        const container=herounit?.parentElement;
        if(container) container.querySelectorAll('#layout-grid__area--contentheader').forEach(e=>e.remove());
        if(container) container.querySelectorAll('div.js-accordion#gesetz_archiv').forEach(e=>e.remove());

        // Anlagen
        let attachments=[];
        if(container){ const dl=container.querySelector('section.modul-download-multi'); if(dl) attachments=Array.from(dl.querySelectorAll('a.link--download')).map(a=>{const href=a.getAttribute('href')||a.href; return href.startsWith('http')?href:'https://www.berlin.de'+href;}); }

        // Schlagworte + Links
        let keywords=(doc.querySelector('meta[name="keywords"]')?.content.split(',')||[]).map(s=>s.trim());
        // Entferne automatisch generierte iiNNNN
        keywords = keywords.filter(k=>!/^ii\d+$/i.test(k));
        const mainContent=doc.querySelector('#layout-grid__area--maincontent');
        const tocHtml=mainContent.querySelector('#gesetz_toc')?.outerHTML||'';
        let beforeToc='', afterToc='';
        if(tocHtml){const raw=mainContent.innerHTML,idx=raw.indexOf(tocHtml); beforeToc=raw.slice(0,idx); afterToc=raw.slice(idx+tocHtml.length);} else beforeToc=mainContent.innerHTML;
        const text=container?.innerText||'';
        const lawRegex=/§\s*(\d+)[^\S\r\n]*(?:Abs\.?\s*\d+)*[^\S\r\n]*(SGB\s+(?:II|IX|XI|XII)|AsylbLG)/g;
        let match, linkMatches=[];
        while((match=lawRegex.exec(text))){ const [full,num,lawFull]=match; const lawSlug=lawDir[lawFull]; if(lawSlug){ log('Erkannt:',full); const href=`https://www.gesetze-im-internet.de/${lawSlug}/__${num}.html`; keywords.push(`${lawSlug}_paragraf${num}`); linkMatches.push({text:full,href}); }}
        keywords=Array.from(new Set(keywords));

        // Listen semantisch verarbeiten
        function processListChildren(nodes){
            let html='';
            for(let i=0;i<nodes.length;i++){
                const node=nodes[i];
                if(node.id==='layout-grid__area--marginal') break;
                // Modul-Archiv-Ignore bereits entfernt
                // a) bzw. a. UL -> OL lower-alpha
                if(node.tagName==='UL'){
                    const lis=Array.from(node.children).filter(n=>n.tagName==='LI');
                    if(lis.length>0 && lis.every(li=>/^[a-z]\)|^[a-z]\./i.test(li.innerText.trim()))){
                        const ol=document.createElement('ol');
                        ol.classList.add('alpha-list');
                        lis.forEach(li=>{
                            const content=li.innerHTML.replace(/^[a-z](?:\)|\.)\s*/i,'').trim();
                            const newLi=document.createElement('li');
                            newLi.innerHTML=content;
                            // Inline-Styles
                            newLi.style.listStyleType='lower-alpha';
                            newLi.style.marginLeft='1em';
                            ol.appendChild(newLi);
                        });
                        html+=ol.outerHTML; continue;
                    }
                }
                // OL + UL verschachteln
                if(node.tagName==='OL' && i+1<nodes.length && nodes[i+1].tagName==='UL'){
                    const ulNext=nodes[i+1]; const lastLi=node.querySelector('li:last-of-type');
                    if(lastLi && lastLi.textContent.trim().endsWith(':')){
                        const mergedOl=node.cloneNode(true);
                        const nestedUl=ulNext.cloneNode(true);
                        const firstSubLi=nestedUl.querySelector('li');
                        if(firstSubLi&&/^[a-z]\)|^[a-z]\./i.test(firstSubLi.innerText.trim())){
                            nestedUl.classList.add('alpha-list'); nestedUl.style.listStyleType='lower-alpha'; nestedUl.style.marginLeft='1em';
                        }
                        mergedOl.querySelector('li:last-of-type').appendChild(nestedUl);
                        html+=mergedOl.outerHTML; i++; continue;
                    }
                }
                // Paragraph-Block
                if(node.classList && node.classList.contains('modul-gesetz-paragraph')){
                    const heading=node.querySelector('h1.title,h2.title,h3.title,h4.title,h5.title,h6.title'); if(heading)html+=heading.outerHTML;
                    const textile=node.querySelector('div.textile'); if(textile)html+=processListChildren(Array.from(textile.children));
                    continue;
                }
                // Textile-Container
                if(node.tagName==='DIV'&&node.classList.contains('textile')){ html+=processListChildren(Array.from(node.children)); continue; }
                // Default: Links ersetzen
                let chunk=node.outerHTML;
                linkMatches.forEach(({text,href})=>{ const esc=text.replace(/[-\/^$*+?.()|[\]{}]/g,'\\$&'); chunk=chunk.replace(new RegExp(esc,'g'),`<a href="${href}">${text}</a>`); });
                html+=chunk;
            }
            return html;
        }

        // Content generieren
        let contentHtml=''; if(herounit)contentHtml+=herounit.outerHTML; contentHtml+=beforeToc+tocHtml;
        const afterDiv=document.createElement('div'); afterDiv.innerHTML=afterToc;
        contentHtml+=processListChildren(Array.from(afterDiv.children));

        // Meta erzeugen
        const meta={titel:title,dokumentnummer:slug,politikfeld,kategorie:category,status:'veröffentlicht',schlagworte:keywords,url:publicUrl,anlagen:attachments,inkrafttreten:ink,ausserkrafttreten:aus,versionen};
        saveAs(new Blob([JSON.stringify(meta,null,2)],{type:'application/json'}),`${slug}_meta.json`);
        versionen.forEach(v=>saveAs(new Blob([contentHtml],{type:'text/html'}),`${slug}_${v.datei}`));
        log('Export abgeschlossen');
    }

    // Einzel-Export-Button
    document.body.addEventListener('click',e=>{
        const cell=e.target.closest('td.col__select'); if(!cell) return;
        const row=cell.closest('tr.i-listview-node'); if(!row) return;
        const cb=row.querySelector('input[type=checkbox]');
        const prev=row.querySelector('td.vs-single-cell'); if(prev) prev.remove();
        if(cb.checked){
            const idx=cell.cellIndex;
            const c2=row.insertCell(idx+1); c2.className='vs-single-cell'; c2.style='padding:2px;';
            const btn=document.createElement('button'); btn.textContent='Exportiere dieses Dokument';
            btn.addEventListener('click',()=>exportRow(row)); c2.appendChild(btn);
        }
    },true);

    // Bulk UI
    function addUI(){
        if(document.querySelector('#vs-bulk-ui')) return;
        const box=document.createElement('div'); box.id='vs-bulk-ui';
        box.style='position:fixed;top:10px;left:10px;z-index:9999;background:#fff8dc;padding:8px;border:1px solid #000;';
        const sel=document.createElement('select'); sel.id='vs-exporter-count';
        ['5','10','all'].forEach(o=>{const opt=document.createElement('option');opt.value=o;opt.textContent=o;sel.appendChild(opt);});
        const zip=document.createElement('button'); zip.textContent='🗂 Bulk Export'; zip.addEventListener('click',()=>{});
        box.append(sel,zip); document.body.appendChild(box);
    }
    addUI();
    new MutationObserver(addUI).observe(document.body,{childList:true,subtree:true});
})();
