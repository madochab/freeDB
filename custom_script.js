(async function() {

  //////////////////////////////////////////////////////////////////////////
  // 0) KONFIG
  //////////////////////////////////////////////////////////////////////////

  const PAPA_PARSE_CDN = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';

  // Spalten, die per default ausgeblendet werden
  const defaultHiddenKeys = [
    "Empfänger E-Mail",
    "Empfänger Subject",
    "Erzeugt am",
    "Zuletzt bearbeitet am"
  ];

  // Minimiert Freeze beim Eintippen
  const SEARCH_DEBOUNCE_TIME = 500;

  // CSS
  const style = document.createElement('style');
  style.textContent = `
    body {
      margin: 10px;
      font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
      background-color: #f4f6f8;
      color: #2e2e2e;
    }

    #mainContent {
      width: 100%;
      margin-bottom: 1rem;
    }

    #menuWrapper {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      padding: 1rem;
      margin-bottom: 1rem;
    }

    #toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    #headingForButtons {
      font-size: 0.9rem;
      font-weight: 600;
      color: #555;
      margin: 0;
      padding: 0;
    }

    #toggleColumns, #hiddenToggleContainer {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      max-width: 100%;
    }

    #toggleColumns {
      background: #f9f9f9;
      padding: 0.5rem;
      border-radius: 6px;
      border: 1px solid #ddd;
      flex: 1 1 100%;
    }

    #hiddenToggleContainer {
      min-width: 200px;
      background-color: #fafafa;
      border: 1px dashed #ccc;
      padding: 0.5rem;
      border-radius: 6px;
      flex: 1 1 100%;
      position: relative;
    }
    /* Icon für ausgeblendete Spalten */
    #hiddenToggleContainer::before {
      content: "\\f070  Ausgeblendete Spalten";
      font-family: "Font Awesome 5 Free";
      font-weight: 900;
      position: absolute;
      top: -1.2rem;
      left: 0;
      color: #888;
      font-size: 0.8rem;
    }

    /* Spalten-Buttons */
    #toggleColumns button, 
    #hiddenToggleContainer button {
      border: none;
      background: #e0e3e7;
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 0.8rem;
      color: #333;
      transition: background 0.2s;
    }
    #toggleColumns button:hover,
    #hiddenToggleContainer button:hover {
      background: #d1d4d8;
    }
    .hidden-btn {
      opacity: 0.5;
    }

    /* Toggle-Switches */
    .switchGroup {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .switchItem {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .switchItem label {
      font-size: 0.8rem;
      color: #333;
    }
    .switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 24px;
    }
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 34px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background-color: #66bb6a;
    }
    input:checked + .slider:before {
      transform: translateX(26px);
    }

    /* Normaler Button für Reset */
    .resetButton {
      border: none;
      background: #e0e3e7;
      border-radius: 4px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 0.8rem;
      color: #333;
      transition: background 0.2s;
      margin-right: 0.5rem;
    }
    .resetButton:hover {
      background: #d1d4d8;
    }

    /* Globale Suche mit Icon */
    #globalSearchInput {
      display: block;
      width: 100%;
      padding: 0.6rem 2.2rem 0.6rem 2.5rem;
      border: 1px solid #ccc;
      border-radius: 8px;
      outline: none;
      font-size: 0.9rem;
      background: url('data:image/svg+xml;utf8,<svg fill="%23aaa" viewBox="0 0 512 512" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M505 442.7l-99.7-99.7c28.3-34.5 45.7-78.5 45.7-126.3 0-110.5-89.5-200-200-200S52.4 106.2 52.4 216.7 141.9 416.7 252.4 416.7c47.8 0 91.8-17.4 126.3-45.7l99.7 99.7c2.4 2.4 5.6 3.6 8.6 3.6 3.1 0 6.2-1.2 8.6-3.6 4.8-4.8 4.8-12.5 0-17.3zM252.4 376.7c-88.3 0-160-71.6-160-160s71.6-160 160-160 160 89.5 160 200-89.5 200-160 200z"/></svg>') no-repeat 0.8rem center #fff;
      background-size: 16px;
      margin-bottom: 0.5rem;
    }
    #globalSearchInput:focus {
      border-color: #999;
    }

    /* Spaltenfilter => identisches CSS */
    .filterInput {
      border: 1px solid #ccc;
      border-radius: 8px;
      outline: none;
      font-size: 0.9rem;
      display: block;
      width: 100%;
      padding: 0.6rem 2.2rem 0.6rem 2.5rem;
      margin-bottom: 0.5rem;
    }
    .filterInput:focus {
      border-color: #999;
    }

    #visibleRowCounter {
      font-size: 0.85rem;
      color: #666;
      margin-top: 0.5rem;
    }

    /* TABELLE => auto => Browser rechnet Spaltenbreiten */
    #myFullTable {
      width: 100% !important;
      table-layout: auto !important; 
      border-collapse: collapse;
      background: #fff;
    }

    /* Ermöglicht Umbrüche in Überschriften */
    #myFullTable thead tr th {
      text-align: center;
      vertical-align: middle;
      font-weight: 600;
      padding: 0.8rem;
      border-bottom: 1px solid #ddd;
      background: #f9f9f9;
      position: relative;
      white-space: normal;
      word-wrap: break-word;
    }

    /* Keine Border in der 2. Kopfzeile für die Aktion-Spalte */
    #myFullTable thead tr:nth-child(2) th.Aktion,
    #myFullTable thead tr:nth-child(2) td.Aktion {
      border: none !important;
    }

    #myFullTable thead tr:nth-child(2) th,
    #myFullTable thead tr:nth-child(2) td {
      border-bottom: 1px solid #ddd;
      background: #fafafa;
      text-align: center;
      vertical-align: middle;
      padding: 0.6rem;
      position: relative;
    }

    #myFullTable tbody tr td {
      padding: 0.6rem 0.8rem;
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }

    /* Aktion-Spalte => 40px */
    th.Aktion, td.Aktion {
      width: 40px !important;
      min-width: 40px !important;
      max-width: 40px !important;
      overflow: hidden;
      text-align: center;
      vertical-align: middle;
      border: none !important;
    }
    td.Aktion {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 2px !important;
      background: none !important;
      border: none !important;
    }
    td.Aktion button {
      border: none !important;
      background: none;
      cursor: pointer;
      font-size: 0.8rem;
      outline: none;
      color: #666;
      transition: color 0.2s;
      display: block;
      line-height: 1;
      margin-bottom: 5px;
      padding: 0.6rem 0.8rem;
    }
    td.Aktion button:hover {
      color: #111;
    }
    td.Aktion button i {
      pointer-events: none;
    }

    .marked-row {
      background-color: #fffdd0 !important;
    }

    .highlight {
      background-color: #fffea0;
    }
    .col-highlight {
      background-color: #c6f6d5;
    }

    #myFullTable tfoot td {
      border-top: 1px solid #ccc;
      background: #fdfdfd;
      font-size: 0.85rem;
      padding: 0.6rem 0.8rem;
      color: #666;
    }

    /* Für die grünen/roten Symbole */
    .check-yes {
      color: green;
      font-weight: bold;
    }
    .check-no {
      color: red;
      font-weight: bold;
    }

    .listWrapper {
      margin-left: 0.5em;
    }
    .listWrapper li {
      white-space: nowrap;
      margin-bottom: 0;
    }
  `;
  document.head.appendChild(style);

  //////////////////////////////////////////////////////////////////////////
  // HILFSFUNKTIONEN
  //////////////////////////////////////////////////////////////////////////

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      console.log('[Addon] Lade externes Script:', src);
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        console.log('[Addon] Script geladen:', src);
        resolve();
      };
      script.onerror = () => reject(new Error('[Addon] Fehler beim Laden des Scripts: ' + src));
      document.head.appendChild(script);
    });
  }

  function parseBasicAuthUrl(fullUrl) {
    try {
      const u = new URL(fullUrl);
      const user = u.username;
      const pass = u.password;
      u.username = '';
      u.password = '';
      const urlNoCred = u.toString();
      return { urlNoCred, user, pass };
    } catch (err) {
      console.warn('[Addon] parseBasicAuthUrl Fehler:', err);
      return { urlNoCred: fullUrl, user: '', pass: '' };
    }
  }

  function findAllCsvUrl() {
    console.log('[Addon] Suche CSV-Link in der Tabelle...');
    const tables = document.querySelectorAll('table');
    for (let table of tables) {
      const rows = table.querySelectorAll('tr');
      for (let row of rows) {
        const th = row.querySelector('th');
        const td = row.querySelector('td');
        if (th && td) {
          const thText = th.innerText.trim();
          if (thText === 'CSV:') {
            const csvUrl = td.innerText.trim();
            console.log('[Addon] Gefundener CSV-Link:', csvUrl);
            if (!csvUrl.includes('index.csv')) {
              console.warn('[Addon] CSV-Link enthält nicht "index.csv".');
              return null;
            }
            const allUrl = csvUrl.replace('index.csv', 'all.csv');
            console.log('[Addon] "all.csv"-Link:', allUrl);
            return allUrl;
          }
        }
      }
    }
    return null;
  }

  async function fetchCsv(urlWithAuth) {
    console.log('[Addon] fetchCsv -> URL mit Credentials:', urlWithAuth);
    const { urlNoCred, user, pass } = parseBasicAuthUrl(urlWithAuth);
    console.log('[Addon] -> urlNoCred=', urlNoCred, ' user=', user, ' pass=', pass);

    const authHeader = 'Basic ' + btoa(user + ':' + pass);
    console.log('[Addon] Authorization Header:', authHeader);

    const resp = await fetch(urlNoCred, {
      headers: {
        'Authorization': authHeader
      }
    });
    if (!resp.ok) {
      throw new Error(`[Addon] HTTP-Error: ${resp.status} ${resp.statusText}`);
    }
    const csvText = await resp.text();
    console.log('[Addon] CSV-Text geladen, Länge:', csvText.length);
    return csvText;
  }

  function parseWithPapa(csvText) {
    console.log('[Addon] parseWithPapa -> Starte Papa.parse...');
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: results => {
          if (results.errors && results.errors.length) {
            console.warn('[Addon] Papa Parse errors:', results.errors);
          }
          console.log('[Addon] Papa parse => data.length=', results.data.length);
          resolve(results.data);
        },
        error: err => {
          reject(err);
        }
      });
    });
  }

  function reInsertButtonInOrder(container, btn) {
    const allBtns = Array.from(container.querySelectorAll('button'));
    const idx = parseInt(btn.dataset.originalIndex, 10);
    const next = allBtns.find(b => parseInt(b.dataset.originalIndex, 10) > idx);
    if (next) {
      container.insertBefore(btn, next);
    } else {
      container.appendChild(btn);
    }
  }

  //////////////////////////////////////////////////////////////////////////
  // TABELLE BAUEN
  //////////////////////////////////////////////////////////////////////////

  function buildTable(data, columns, container) {
    console.log('[Addon] Erzeuge neue Tabelle mit', data.length, 'Zeilen und', columns.length, 'Spalten.');

    // "Aktion" an den Anfang schieben
    columns = columns.filter(c => c !== 'Aktion');
    columns.unshift('Aktion');

    const table = document.createElement('table');
    table.id = 'myFullTable';

    // table-layout: auto => Browser berechnet Spaltenbreite
    table.style.tableLayout = 'auto';
    table.style.width = '100%';

    const thead = document.createElement('thead');
    const row1 = document.createElement('tr'); // Spaltennamen
    const row2 = document.createElement('tr'); // Suchzeile

    columns.forEach(col => {
      const norm = col.trim();
      const th = document.createElement('th');
      th.className = norm;
      if (norm === 'Aktion') {
        th.innerText = ''; // keine Überschrift
      } else {
        th.innerText = norm;
      }
      row1.appendChild(th);
    });

    columns.forEach(col => {
      const norm = col.trim();
      const td = document.createElement('td');
      if (norm === 'Aktion') {
        td.className = 'Aktion'; // 2. Zeile => leer
      } else {
        // Erzeugt Filter-Input
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.classList.add('filterInput');
        inp.placeholder = 'Suche';
        td.appendChild(inp);
      }
      row2.appendChild(td);
    });

    thead.appendChild(row1);
    thead.appendChild(row2);
    table.appendChild(thead);

    // TBODY
    const tbody = document.createElement('tbody');
    data.forEach(obj => {
      const tr = document.createElement('tr');

      columns.forEach(col => {
        const norm = col.trim();
        const td = document.createElement('td');

        if (norm === 'Aktion') {
          td.classList.add('Aktion');
          // Buttons: Edit, Del, Mark, View
          const rowId = obj["ID"] || '';

          // Bearbeiten
          const btnEdit = document.createElement('button');
          btnEdit.innerHTML = '<i class="fas fa-edit"></i>';
          btnEdit.title = 'Bearbeiten';
          btnEdit.addEventListener('click', () => enterEditMode(tr, rowId));

          // Löschen
          const btnDel = document.createElement('button');
          btnDel.innerHTML = '<i class="fas fa-trash"></i>';
          btnDel.title = 'Löschen';
          btnDel.addEventListener('click', () => doDeleteRow(tr, rowId));

          // Markieren
          const btnMark = document.createElement('button');
          btnMark.innerHTML = '<i class="fas fa-star"></i>';
          btnMark.title = 'Markieren';
          btnMark.addEventListener('click', () => {
            tr.classList.toggle('marked-row');
          });

          // Ansehen
          const btnView = document.createElement('button');
          btnView.innerHTML = '<i class="fas fa-eye"></i>';
          btnView.title = 'Ansehen';
          btnView.addEventListener('click', () => {
            window.open(`https://www.berlin.de/freedb/detail.php/${rowId}`, '_blank');
          });

          td.appendChild(btnEdit);
          td.appendChild(btnDel);
          td.appendChild(btnMark);
          td.appendChild(btnView);

        } else {
          // Original-Text
          td.textContent = (obj[col] != null) ? obj[col] : '';
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // TFOOT
    const tfoot = document.createElement('tfoot');
    const tfrow = document.createElement('tr');
    const tfcell = document.createElement('td');
    tfcell.colSpan = columns.length;
    tfcell.textContent = `Zeilen: ${data.length}`;
    tfrow.appendChild(tfcell);
    tfoot.appendChild(tfrow);
    table.appendChild(tfoot);

    container.appendChild(table);

    console.log('[Addon] Tabelle fertig gebaut.');
  }

  //////////////////////////////////////////////////////////////////////////
  // FREEDB-AKTIONEN: Bearbeiten / Löschen
  //////////////////////////////////////////////////////////////////////////

  function enterEditMode(tr, rowId) {
    if (tr.dataset.editMode === 'true') return;
    tr.dataset.editMode = 'true';

    const tds = tr.querySelectorAll('td');
    tds.forEach(td => {
      if (td.classList.contains('Aktion')) {
        td.innerHTML = '';
        const btnSave = document.createElement('button');
        btnSave.innerHTML = '<i class="fas fa-check"></i>';
        btnSave.title = 'Speichern';
        btnSave.addEventListener('click', () => saveEditMode(tr, rowId));

        const btnCancel = document.createElement('button');
        btnCancel.innerHTML = '<i class="fas fa-times"></i>';
        btnCancel.title = 'Abbrechen';
        btnCancel.addEventListener('click', () => cancelEditMode(tr));

        td.appendChild(btnSave);
        td.appendChild(btnCancel);

      } else {
        const originalText = td.textContent;
        td.dataset.originalText = originalText;
        td.textContent = '';

        if (originalText.length > 60) {
          const ta = document.createElement('textarea');
          ta.value = originalText;
          ta.rows = 3;
          ta.style.width = '95%';
          td.appendChild(ta);
        } else {
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.value = originalText;
          inp.style.width = '95%';
          td.appendChild(inp);
        }
      }
    });
  }

  function cancelEditMode(tr) {
    tr.dataset.editMode = 'false';
    const tds = tr.querySelectorAll('td');
    const rowId = tds[0]?.textContent || '???';
    tds.forEach(td => {
      if (td.classList.contains('Aktion')) {
        recreateActionButtons(tr, td, rowId);
      } else {
        const orig = td.dataset.originalText || '';
        td.textContent = orig;
      }
    });
    // Nach Abbrechen => transformDisplay
    applyDisplayTransform(tr);
  }

  async function saveEditMode(tr, rowId) {
    const payload = {};
    const tds = tr.querySelectorAll('td');
    const table = tr.closest('table');
    const thead = table.querySelector('thead');
    const row1 = thead.querySelector('tr:first-child');

    tds.forEach((td, index) => {
      if (td.classList.contains('Aktion')) return;
      const input = td.querySelector('input, textarea');
      if (!input) return;
      const colName = row1.children[index].className.trim();
      payload[colName] = input.value;
    });

    console.log('[Addon] saveEditMode rowId=', rowId, 'payload=', payload);

    const formData = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      formData.append(k, v);
    }

    try {
      const resp = await fetch(`https://www.berlin.de/freedb/edit.php/${rowId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });
      if (!resp.ok) {
        alert(`Speichern fehlgeschlagen: ${resp.status} ${resp.statusText}`);
        return;
      }

      // Erfolg => revert
      tr.dataset.editMode = 'false';
      tds.forEach((td, index) => {
        if (td.classList.contains('Aktion')) {
          recreateActionButtons(tr, td, rowId);
        } else {
          const colName = row1.children[index].className.trim();
          const newVal = payload[colName] || '';
          td.textContent = newVal;
        }
      });
      console.log('[Addon] Erfolgreich gespeichert.');
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert('Fehler beim Speichern: ' + err.message);
    }

    // Nach Speichern => transform
    applyDisplayTransform(tr);
  }

  function recreateActionButtons(tr, td, rowId) {
    td.innerHTML = '';
    const btnEdit = document.createElement('button');
    btnEdit.innerHTML = '<i class="fas fa-edit"></i>';
    btnEdit.title = 'Bearbeiten';
    btnEdit.addEventListener('click', () => enterEditMode(tr, rowId));

    const btnDel = document.createElement('button');
    btnDel.innerHTML = '<i class="fas fa-trash"></i>';
    btnDel.title = 'Löschen';
    btnDel.addEventListener('click', () => doDeleteRow(tr, rowId));

    const btnMark = document.createElement('button');
    btnMark.innerHTML = '<i class="fas fa-star"></i>';
    btnMark.title = 'Markieren';
    btnMark.addEventListener('click', () => {
      tr.classList.toggle('marked-row');
    });

    const btnView = document.createElement('button');
    btnView.innerHTML = '<i class="fas fa-eye"></i>';
    btnView.title = 'Ansehen';
    btnView.addEventListener('click', () => {
      window.open(`https://www.berlin.de/freedb/detail.php/${rowId}`, '_blank');
    });

    td.appendChild(btnEdit);
    td.appendChild(btnDel);
    td.appendChild(btnMark);
    td.appendChild(btnView);
  }

  async function doDeleteRow(tr, rowId) {
    const ok = confirm(`Wirklich löschen (ID=${rowId})?`);
    if (!ok) return;

    try {
      const resp = await fetch(`https://www.berlin.de/freedb/delete.php/${rowId}`, {
        method: 'POST'
      });
      if (!resp.ok) {
        alert(`Löschen fehlgeschlagen: ${resp.status} ${resp.statusText}`);
        return;
      }
      tr.remove();
      console.log(`[Addon] Zeile ID=${rowId} gelöscht`);
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      alert('Fehler beim Löschen: ' + err.message);
    }
  }

  //////////////////////////////////////////////////////////////////////////
  // SUCHE & FILTER
  //////////////////////////////////////////////////////////////////////////

  let tableData = [];
  let columnsGlobal = [];
  let searchTimeout = null;
  let colButtons = [];
  let colIndexMap = {};

  function initControls(data, columns) {
    console.log('[Addon] initControls start...');
    tableData = data;
    columnsGlobal = columns;

    const table = document.querySelector('#myFullTable');
    if (!table) {
      console.warn('[Addon] #myFullTable nicht gefunden.');
      return;
    }

    // div.ajax => ausblenden + #mainContent davor einfügen
    const divAjax = document.querySelector('div.ajax');
    if (divAjax) {
      divAjax.style.display = 'none'; 
      const mainContent = document.getElementById('mainContent');
      if (divAjax.parentNode) {
        divAjax.parentNode.insertBefore(mainContent, divAjax);
        console.log('[Addon] #mainContent vor div.ajax eingefügt, div.ajax hidden.');
      }
    }

    // MenuWrapper
    const menuWrapper = document.createElement('div');
    menuWrapper.id = 'menuWrapper';
    table.parentNode.insertBefore(menuWrapper, table);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.id = 'toolbar';
    menuWrapper.appendChild(toolbar);

    // Spalten-Buttons
    const headingForButtons = document.createElement('div');
    headingForButtons.id = 'headingForButtons';
    headingForButtons.innerText = 'Sichtbare Spalten'; // <-- geändert

    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'toggleColumns';

    const hiddenToggleContainer = document.createElement('div');
    hiddenToggleContainer.id = 'hiddenToggleContainer';

    toolbar.appendChild(headingForButtons);
    toolbar.appendChild(toggleContainer);
    toolbar.appendChild(hiddenToggleContainer);

    // Toggle-Switches für Freigabe, Änderung
    const switchGroup = document.createElement('div');
    switchGroup.className = 'switchGroup';

    // Freigabe Switch
    const switchItemFreigabe = document.createElement('div');
    switchItemFreigabe.className = 'switchItem';
    const labelFreigabe = document.createElement('label');
    labelFreigabe.textContent = 'Freigabe';
    const switchFreigabe = document.createElement('label');
    switchFreigabe.className = 'switch';
    const inputFreigabe = document.createElement('input');
    inputFreigabe.type = 'checkbox';
    const sliderFreigabe = document.createElement('span');
    sliderFreigabe.className = 'slider';

    switchFreigabe.appendChild(inputFreigabe);
    switchFreigabe.appendChild(sliderFreigabe);
    switchItemFreigabe.appendChild(labelFreigabe);
    switchItemFreigabe.appendChild(switchFreigabe);

    // Änderung Switch
    const switchItemAenderung = document.createElement('div');
    switchItemAenderung.className = 'switchItem';
    const labelAenderung = document.createElement('label');
    labelAenderung.textContent = 'Änderung';
    const switchAenderung = document.createElement('label');
    switchAenderung.className = 'switch';
    const inputAenderung = document.createElement('input');
    inputAenderung.type = 'checkbox';
    const sliderAenderung = document.createElement('span');
    sliderAenderung.className = 'slider';

    switchAenderung.appendChild(inputAenderung);
    switchAenderung.appendChild(sliderAenderung);
    switchItemAenderung.appendChild(labelAenderung);
    switchItemAenderung.appendChild(switchAenderung);

    switchGroup.appendChild(switchItemFreigabe);
    switchGroup.appendChild(switchItemAenderung);
    toolbar.appendChild(switchGroup);

    // Reset => normaler Button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'resetButton';
    resetBtn.textContent = 'Reset Filter';
    toolbar.appendChild(resetBtn);

    // Globale Suche
    const globalSearchInput = document.createElement('input');
    globalSearchInput.type = 'text';
    globalSearchInput.id = 'globalSearchInput';
    globalSearchInput.placeholder = 'Globale Suche...';
    toolbar.appendChild(globalSearchInput);

    const visibleRowCounter = document.createElement('div');
    visibleRowCounter.id = 'visibleRowCounter';
    toolbar.appendChild(visibleRowCounter);

    // HEAD references
    const thead = table.querySelector('thead');
    const row1 = thead.querySelector('tr:first-child');
    const row2 = thead.querySelector('tr:nth-child(2)');
    const headerCells = row1.querySelectorAll('th');
    const rows = table.querySelectorAll('tbody tr');
    const footRows = table.querySelectorAll('tfoot tr');

    // colIndexMap
    headerCells.forEach((th, i) => {
      const cn = th.className.trim();
      colIndexMap[cn] = i;
    });
    console.log('[Addon] colIndexMap:', colIndexMap);

    // Spalten-Buttons => alle außer "Aktion"
    headerCells.forEach((th, index) => {
      const colName = th.className.trim();
      if (!colName || colName === 'Aktion') return;
      const btn = document.createElement('button');
      btn.textContent = colName;
      btn.dataset.originalIndex = index;
      toggleContainer.appendChild(btn);

      btn.addEventListener('click', () => {
        const isHidden = (th.style.display === 'none');
        if (isHidden) showColumnByIndex(index);
        else hideColumnByIndex(index);
      });
      colButtons[index] = btn;
    });

    // Original-Inhalte in dataset
    rows.forEach(r => {
      const tds = r.querySelectorAll('td');
      tds.forEach(td => {
        let content = td.textContent;
        if (content == null || content === 'undefined') content = '';
        td.dataset.originalContent = content;
      });
    });

    // Default Hidden
    defaultHiddenKeys.forEach(k => {
      const idx = colIndexMap[k.trim()];
      if (typeof idx === 'number') {
        hideColumnByIndex(idx);
      }
    });

    // Spaltensuche
    const colSearchInputs = [];
    row2.querySelectorAll('td').forEach((cell, idx) => {
      const th = headerCells[idx];
      if (!th) return;
      const colName = th.className.trim();
      if (colName === 'Aktion') return;
      const inp = cell.querySelector('input[type="text"]');
      if (inp) {
        colSearchInputs.push({ input: inp, colIndex: idx });
      }
    });

    // Globale Suche + Spalten-Suche => Debounce
    globalSearchInput.addEventListener('keyup', runDebouncedSearch);
    colSearchInputs.forEach(cf => {
      cf.input.addEventListener('keyup', runDebouncedSearch);
    });

    // Switch-Logik
    inputFreigabe.addEventListener('change', () => {
      if (inputFreigabe.checked) {
        // "ON" => Zeige nur freigabe=="nein"
        doFilterFreigabe();
      } else {
        // "OFF" => Zeige alle
        showAllRows();
      }
    });
    inputAenderung.addEventListener('change', () => {
      if (inputAenderung.checked) {
        // "ON" => Zeige nur Änderungsmitteilung=="ja"
        doFilterAenderung();
      } else {
        // "OFF" => Zeige alle
      }
    });

    // Reset-Button
    resetBtn.addEventListener('click', () => {
      console.log('[Addon] Reset Filter => Alles zurücksetzen');
      // Leere globale Suche
      globalSearchInput.value = '';
      // Leere Spaltenfilter
      colSearchInputs.forEach(cf => {
        cf.input.value = '';
      });
      // Toggle-Switches aus
      inputFreigabe.checked = false;
      inputAenderung.checked = false;

      // Zeige alle
      showAllRows();
    });

    // Initial => transform
    rows.forEach(r => applyDisplayTransform(r));

    console.log('[Addon] initControls fertig. data.length=', data.length);
    updateVisibleCount();
    updateTfootColspan();

    ////////////////////////////////////////////////////////////////////////
    // Filter-Funktionen
    ////////////////////////////////////////////////////////////////////////
    function doFilterFreigabe() {
      console.log('[Addon] doFilterFreigabe => freigabe="nein".');
      const idxFreigabe = colIndexMap["freigabe"];
      if (typeof idxFreigabe !== 'number') {
        console.warn('[Addon] Spalte "freigabe" nicht gefunden.');
        return;
      }
      let countShown = 0;
      rows.forEach(r => {
        const tds = r.querySelectorAll('td');
        const val = (tds[idxFreigabe]?.dataset.originalContent || '').toLowerCase();
        if (val === 'nein') {
          r.style.display = '';
          countShown++;
        } else {
          r.style.display = 'none';
        }
      });
      console.log(`[Addon] freigabe=nein => ${countShown} Zeilen angezeigt.`);
      updateVisibleCount();
    }

    function doFilterAenderung() {
      console.log('[Addon] doFilterAenderung => Änderungsmitteilung="ja".');
      const idxAend = colIndexMap["Änderungsmitteilung"];
      if (typeof idxAend !== 'number') {
        console.warn('[Addon] Spalte "Änderungsmitteilung" nicht gefunden!');
        return;
      }
      let countShown = 0;
      rows.forEach(r => {
        const tds = r.querySelectorAll('td');
        const val = (tds[idxAend]?.dataset.originalContent || '').toLowerCase();
        if (val === 'ja') {
          r.style.display = '';
          countShown++;
        } else {
          r.style.display = 'none';
        }
      });
      console.log(`[Addon] Änderung=ja => ${countShown} Zeilen angezeigt.`);
      updateVisibleCount();
    }

    function showAllRows() {
      console.log('[Addon] showAllRows => alles anzeigen.');
      rows.forEach(r => {
        r.style.display = '';
        // reset highlight
        const tds = r.querySelectorAll('td');
        tds.forEach(td => {
          td.innerHTML = td.dataset.originalContent || '';
        });
      });
      updateVisibleCount();
      // neu transformieren
      rows.forEach(rr => applyDisplayTransform(rr));
    }

    function runDebouncedSearch() {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(doSearch, SEARCH_DEBOUNCE_TIME);
    }

    function doSearch() {
      console.log('[Addon] doSearch() getriggert.');
      searchTimeout = null;

      const globalSearch = globalSearchInput.value.trim().toLowerCase();
      const globalRegex = globalSearch ? new RegExp('(' + escapeRegExp(globalSearch) + ')', 'gi') : null;

      // Sammle Spalten-Filter
      const filters = [];
      colSearchInputs.forEach(cf => {
        const term = cf.input.value.trim().toLowerCase();
        if (term) {
          filters.push({
            colIndex: cf.colIndex,
            term,
            regex: new RegExp('(' + escapeRegExp(term) + ')', 'gi')
          });
        }
      });

      let countShown = 0;
      rows.forEach(r => {
        const tds = r.querySelectorAll('td');
        const dataCells = Array.from(tds).filter((td, i) => {
          // skip hidden columns
          if (headerCells[i].style.display === 'none') return false;
          return true;
        });
        const combinedText = dataCells.map(td => (td.dataset.originalContent || '').toLowerCase()).join(' ');

        const matchGlobal = (!globalSearch || combinedText.includes(globalSearch));
        let matchCols = true;
        for (let f of filters) {
          const c = tds[f.colIndex];
          if (!c || c.style.display === 'none') continue;
          const textVal = (c.dataset.originalContent || '').toLowerCase();
          if (!textVal.includes(f.term)) {
            matchCols = false;
            break;
          }
        }

        if (matchGlobal && matchCols) {
          r.style.display = '';
          countShown++;
          // reset to original text
          tds.forEach(td => {
            td.innerHTML = td.dataset.originalContent || '';
          });
          // highlight
          if (globalRegex) {
            dataCells.forEach(td => {
              let txt = td.innerHTML;
              txt = txt.replace(globalRegex, `<span class="highlight">$1</span>`);
              td.innerHTML = txt;
            });
          }
          // col highlight
          filters.forEach(f => {
            const c = tds[f.colIndex];
            if (!c || c.style.display === 'none') return;
            let txt = c.innerHTML;
            txt = txt.replace(f.regex, `<span class="col-highlight">$1</span>`);
            c.innerHTML = txt;
          });
        } else {
          r.style.display = 'none';
        }
      });
      console.log(`[Addon] doSearch => ${countShown} Zeilen angezeigt.`);

      updateVisibleCount();
      // Nach dem Highlight => transform
      rows.forEach(r => {
        if (r.style.display !== 'none') {
          applyDisplayTransform(r);
        }
      });
    }

    function escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function hideColumnByIndex(index) {
      const thead = table.querySelector('thead');
      const row1 = thead.querySelector('tr:first-child');
      const row2 = thead.querySelector('tr:nth-child(2)');
      const headerCells = row1.querySelectorAll('th');
      const rows = table.querySelectorAll('tbody tr');
      const footRows = table.querySelectorAll('tfoot tr');

      const th = headerCells[index];
      if (th) th.style.display = 'none';

      rows.forEach(r => {
        const c = r.children[index];
        if (c) c.style.display = 'none';
      });
      footRows.forEach(fr => {
        const c = fr.children[index];
        if (c) c.style.display = 'none';
      });
      const row2cell = row2.children[index];
      if (row2cell) row2cell.style.display = 'none';

      const btn = colButtons[index];
      if (btn) {
        btn.classList.add('hidden-btn');
        if (btn.parentNode.id === 'toggleColumns') {
          btn.parentNode.removeChild(btn);
          reInsertButtonInOrder(hiddenToggleContainer, btn);
        }
      }
      updateVisibleCount();
      updateTfootColspan();
    }

    function showColumnByIndex(index) {
      const thead = table.querySelector('thead');
      const row1 = thead.querySelector('tr:first-child');
      const row2 = thead.querySelector('tr:nth-child(2)');
      const headerCells = row1.querySelectorAll('th');
      const rows = table.querySelectorAll('tbody tr');
      const footRows = table.querySelectorAll('tfoot tr');

      const th = headerCells[index];
      if (th) th.style.display = '';

      rows.forEach(r => {
        const c = r.children[index];
        if (c) c.style.display = '';
      });
      footRows.forEach(fr => {
        const c = fr.children[index];
        if (c) c.style.display = '';
      });
      const row2cell = row2.children[index];
      if (row2cell) row2cell.style.display = '';

      const btn = colButtons[index];
      if (btn) {
        btn.classList.remove('hidden-btn');
        if (btn.parentNode.id === 'hiddenToggleContainer') {
          btn.parentNode.removeChild(btn);
          reInsertButtonInOrder(toggleContainer, btn);
        }
      }
      updateVisibleCount();
      updateTfootColspan();
    }

    function updateVisibleCount() {
      const rows = table.querySelectorAll('tbody tr');
      let visibleRows = 0;
      rows.forEach(r => {
        if (r.style.display !== 'none') {
          visibleRows++;
        }
      });
      const footRows = table.querySelectorAll('tfoot tr');
      footRows.forEach(fr => {
        const td = fr.querySelector('td');
        if (td) td.textContent = `Zeilen: ${visibleRows}`;
      });
      const visibleRowCounter = document.getElementById('visibleRowCounter');
      if (visibleRowCounter) {
        visibleRowCounter.textContent = 'Aktuell sichtbare Zeilen: ' + visibleRows;
      }
    }

    function updateTfootColspan() {
      const thead = table.querySelector('thead');
      const row1 = thead.querySelector('tr:first-child');
      const headerCells = row1.querySelectorAll('th');
      const visibleCols = Array.from(headerCells).filter(th => th.style.display !== 'none').length;
      const footRows = table.querySelectorAll('tfoot tr');
      footRows.forEach(fr => {
        const td = fr.querySelector('td');
        if (td) td.colSpan = visibleCols;
      });
    }

    //////////////////////////////////////////////////////////////////////////
    // DIE WICHTIGE FUNKTION: applyDisplayTransform
    // => Wandelt "ja"/"nein" optisch um + bracket-lists
    //    und falls bracket-list mit nur 1 item "ja"/"nein" => check/x + 50px
    //////////////////////////////////////////////////////////////////////////
    function applyDisplayTransform(row) {
      const tds = row.querySelectorAll('td');
      tds.forEach(td => {
        // Falls hidden => skip
        if (td.style.display === 'none') return;
        // Hole den *aktuellen* text
        let txt = td.innerText.trim();

        // Falls "ja" oder "nein"
        if (txt.toLowerCase() === 'ja') {
          td.innerHTML = '<span class="check-yes">✔</span>';
          return;
        } else if (txt.toLowerCase() === 'nein') {
          td.innerHTML = '<span class="check-no">✘</span>';
          return;
        }

        // Falls es wie ein Array aussieht: ["A","B"] etc.
        if (/^\[\s*".*"\s*\]$/.test(txt)) {
          try {
            const arr = JSON.parse(txt);
            if (Array.isArray(arr)) {
              if (arr.length === 1) {
                // Single item => check if "ja"/"nein"
                let single = (arr[0] || '').toString().trim().toLowerCase();
                if (single === 'ja') {
                  td.innerHTML = '<span class="check-yes">✔</span>';
                  td.style.maxWidth = '50px';
                  td.style.width = '50px';
                  return;
                } else if (single === 'nein') {
                  td.innerHTML = '<span class="check-no">✘</span>';
                  td.style.maxWidth = '50px';
                  td.style.width = '50px';
                  return;
                } else {
                  // irgendein anderer Einzelwert => normal anzeigen, max 50px
                  td.textContent = arr[0];
                  td.style.maxWidth = '50px';
                  td.style.width = '50px';
                  return;
                }
              } else {
                // Mehrere Items => bullet-list
                const ul = document.createElement('ul');
                ul.className = 'listWrapper';
                arr.forEach(item => {
                  const li = document.createElement('li');
                  li.textContent = item;
                  ul.appendChild(li);
                });
                td.innerHTML = '';
                td.appendChild(ul);
                return;
              }
            }
          } catch(e) {
            // parse error => ignoriere
          }
        }
        // sonst => belassen
      });
    }

  }

  //////////////////////////////////////////////////////////////////////////
  // START
  //////////////////////////////////////////////////////////////////////////

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  async function start() {
    console.log('[Addon] DOM geladen. Lade Papa Parse...');
    try {
      await loadScript(PAPA_PARSE_CDN);
      console.log('[Addon] Papa Parse erfolgreich geladen.');
    } catch (err) {
      console.error('[Addon] Fehler beim Laden Papa Parse:', err);
      return;
    }

    // Container
    const mainContent = document.createElement('div');
    mainContent.id = 'mainContent';
    document.body.appendChild(mainContent);

    // CSV laden
    const allCsvUrl = findAllCsvUrl();
    if (!allCsvUrl) {
      console.warn('[Addon] Kein all.csv-URL gefunden.');
      return;
    }

    let csvText;
    try {
      csvText = await fetchCsv(allCsvUrl);
    } catch (err) {
      console.error('[Addon] CSV laden fehlgeschlagen:', err);
      return;
    }

    let data;
    try {
      data = await parseWithPapa(csvText);
    } catch (err) {
      console.error('[Addon] Papa parse error:', err);
      return;
    }
    if (!data.length) {
      console.warn('[Addon] Keine Daten in CSV.');
      return;
    }

    // Optional: Sortierung ID desc
    if (data[0].hasOwnProperty('ID')) {
      data.sort((a,b) => (parseInt(b.ID,10)||0) - (parseInt(a.ID,10)||0));
      console.log('[Addon] Daten sortiert nach ID desc.');
    }

    let columns = Object.keys(data[0]);
    console.log('[Addon] CSV hat Spalten:', columns);

    // Baue Container
    const tableContainer = document.createElement('div');
    tableContainer.id = 'myCsvContainer';
    mainContent.appendChild(tableContainer);

    // 1) buildTable
    buildTable(data, columns, tableContainer);

    // 2) initControls
    initControls(data, columns);
  }

})();
