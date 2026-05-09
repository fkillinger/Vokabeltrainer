// ============================================================
//  Vokabeltrainer PWA  –  app.js
//  Logik analog zu main.py / frm_vocTrain / frm_vocRepeater
// ============================================================

let db = null;
let SQL = null;
let isDirty = false;
let list_langage = [];
let index_listLang = 0;
let currentVocId = null;   // aktive ID im Abfrage-Modus
let editRowId = null;       // ID der gerade editierten Zeile (Hauptmaske)
let autoSaveTimer = null;
let scoreMinFilter = 101;  // analog zu score_val < 101 in Python

// ─── DB PERSISTENZ ──────────────────────────────────────────

const DB_STORAGE_KEY = 'vokabeltrainer_db';

function markDirty() {
    isDirty = true;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveDatabase, 15000);
}

function saveDatabase() {
    if (!db || !isDirty) return;
    try {
        const data = db.export();
        const b64 = btoa(String.fromCharCode(...data));
        localStorage.setItem(DB_STORAGE_KEY, b64);
        isDirty = false;
        showStatus('Gespeichert ✓', 'ok');
    } catch (e) {
        showStatus('Speicherfehler: ' + e.message, 'err');
    }
}

function downloadDatabase() {
    saveDatabase();
    if (!db) return;
    const data = db.export();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vocabulary.sqlite';
    a.click();
    URL.revokeObjectURL(url);
}

async function loadDatabaseFromStorage() {
    const b64 = localStorage.getItem(DB_STORAGE_KEY);
    if (b64) {
        const binary = atob(b64);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        db = new SQL.Database(arr);
        return true;
    }
    return false;
}

async function loadDatabaseFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const arr = new Uint8Array(e.target.result);
                db = new SQL.Database(arr);
                isDirty = true;
                saveDatabase();
                resolve();
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// ─── SPRACHEN ────────────────────────────────────────────────

function loadLanguages() {
    list_langage = [];
    const res = db.exec("SELECT distinct tbl_name FROM sqlite_master WHERE type='table' AND tbl_name != 'sqlite_sequence' ORDER BY 1");
    if (res.length > 0) {
        res[0].values.forEach(row => list_langage.push(row[0]));
    }
    index_listLang = 0;
    refreshLanguageUI();
}

function refreshLanguageUI() {
    const sel = document.getElementById('cb_language');
    sel.innerHTML = '';
    list_langage.forEach((lang, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = lang;
        sel.appendChild(opt);
    });
    sel.value = index_listLang;

    const repLang = document.getElementById('rep_activeLang');
    if (repLang) repLang.textContent = list_langage[index_listLang] || '';

    refreshTable();
}

function createNewLanguage() {
    const name = document.getElementById('le_newLanguage').value.trim();
    if (!name) {
        showStatus('Bitte Sprachname eingeben', 'warn');
        return;
    }
    if (!db) {
        showStatus('Keine Datenbank geladen', 'err');
        return;
    }
    if (list_langage.includes(name)) {
        showStatus('Sprache bereits vorhanden', 'warn');
        return;
    }

    try {
        db.run(`CREATE TABLE IF NOT EXISTS "${name}" (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT    NOT NULL,
            vocable  TEXT    NOT NULL,
            sex      TEXT,
            mean_1   TEXT    NOT NULL,
            mean_2   TEXT,
            mean_3   TEXT,
            remark   TEXT,
            score    INTEGER NOT NULL
        )`);
        markDirty();

        list_langage = [];
        const res = db.exec("SELECT distinct tbl_name FROM sqlite_master WHERE type='table' AND tbl_name != 'sqlite_sequence' ORDER BY 1");
        if (res.length > 0) {
            res[0].values.forEach(row => list_langage.push(row[0]));
        }

        index_listLang = list_langage.indexOf(name);
        if (index_listLang < 0) index_listLang = 0;

        refreshLanguageUI();
        document.getElementById('le_newLanguage').value = '';
        showStatus(`Sprache "${name}" angelegt ✓`, 'ok');
    } catch(e) {
        showStatus('Fehler: ' + e.message, 'err');
    }
}

// ─── TABELLE (Hauptmaske) ────────────────────────────────────

function refreshTable(filterVoc = '', filterTrad = '') {
    if (!db || list_langage.length === 0) return;
    const lang = list_langage[index_listLang];
    const conditions = [];
    if (filterVoc)  conditions.push(`vocable LIKE '${filterVoc.replace(/'/g,"''")}%'`);
    if (filterTrad) conditions.push(`(mean_1 LIKE '${filterTrad.replace(/'/g,"''")}%' OR mean_2 LIKE '${filterTrad.replace(/'/g,"''")}%' OR mean_3 LIKE '${filterTrad.replace(/'/g,"''")}%')`);
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const res = db.exec(`SELECT id, vocable, sex, mean_1, mean_2, mean_3, score FROM "${lang}" ${where} ORDER BY vocable ASC`);
    const tbody = document.querySelector('#tv_vokabel tbody');
    tbody.innerHTML = '';

    if (res.length === 0) return;
    res[0].values.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td class="td-voc">${esc(row[1])}</td>
      <td class="td-sex">${esc(row[2] || '')}</td>
      <td class="td-mean">${esc(row[3])}</td>
      <td class="td-mean">${esc(row[4] || '')}</td>
      <td class="td-mean">${esc(row[5] || '')}</td>
      <td class="td-score">${row[6]}</td>
    `;
        tr.dataset.id = row[0];
        tr.addEventListener('click', () => loadRowToFields(row[0]));
        tbody.appendChild(tr);
    });
}

function loadRowToFields(id) {
    const lang = list_langage[index_listLang];
    const res = db.exec(`SELECT * FROM "${lang}" WHERE id = ${id}`);
    if (!res.length || !res[0].values.length) return;
    const row = res[0].values[0];
    // id=0, language=1, vocable=2, sex=3, mean_1=4, mean_2=5, mean_3=6, remark=7, score=8
    document.getElementById('le_vokabel').value = row[2] || '';
    document.getElementById('le_sex').value     = row[3] || '';
    document.getElementById('le_bed1').value    = row[4] || '';
    document.getElementById('le_bed2').value    = row[5] || '';
    document.getElementById('le_bed3').value    = row[6] || '';
    document.getElementById('te_remark').value  = row[7] || '';
    document.getElementById('le_score').value   = row[8] !== null ? row[8] : 100;
    editRowId = id;
    document.querySelectorAll('#tv_vokabel tr').forEach(tr => tr.classList.remove('selected'));
    document.querySelector(`#tv_vokabel tr[data-id="${id}"]`)?.classList.add('selected');
}

function newVoc() {
    editRowId = null;
    document.getElementById('le_vokabel').value = '';
    document.getElementById('le_sex').value     = '';
    document.getElementById('le_bed1').value    = '';
    document.getElementById('le_bed2').value    = '';
    document.getElementById('le_bed3').value    = '';
    document.getElementById('te_remark').value  = '';
    document.getElementById('le_score').value   = '100';
    document.getElementById('le_chercheVok').value  = '';
    document.getElementById('le_chercheTrad').value = '';
    document.querySelectorAll('#tv_vokabel tr').forEach(tr => tr.classList.remove('selected'));
    refreshTable();
    document.getElementById('le_vokabel').focus();
}

function writeVocToDB() {
    const lang   = list_langage[index_listLang];
    const voca   = document.getElementById('le_vokabel').value.trim();
    const sex    = document.getElementById('le_sex').value.trim();
    const mean_1 = document.getElementById('le_bed1').value.trim();
    const mean_2 = document.getElementById('le_bed2').value.trim();
    const mean_3 = document.getElementById('le_bed3').value.trim();
    const remark = document.getElementById('te_remark').value.trim();
    const score  = parseInt(document.getElementById('le_score').value) || 50;

    if (!voca || !mean_1) {
        showStatus('Vokabel und Bedeutung 1 sind Pflichtfelder!', 'err');
        return;
    }

    const check = db.exec(`SELECT id FROM "${lang}" WHERE vocable = '${voca.replace(/'/g,"''")}'`);
    const existId = (check.length && check[0].values.length) ? check[0].values[0][0] : null;

    if (existId) {
        db.run(`UPDATE "${lang}" SET language=?, vocable=?, sex=?, mean_1=?, mean_2=?, mean_3=?, remark=?, score=? WHERE id=?`,
            [lang, voca, sex, mean_1, mean_2, mean_3, remark, score, existId]);
        showStatus('Vokabel aktualisiert ✓', 'ok');
    } else {
        db.run(`INSERT INTO "${lang}" (language, vocable, sex, mean_1, mean_2, mean_3, remark, score) VALUES (?,?,?,?,?,?,?,?)`,
            [lang, voca, sex, mean_1, mean_2, mean_3, remark, score]);
        showStatus('Neue Vokabel gespeichert ✓', 'ok');
    }
    markDirty();
    refreshTable();
}

function delRow() {
    if (!editRowId) {
        showStatus('Keine Zeile ausgewählt', 'warn');
        return;
    }
    if (!confirm('Datensatz wirklich löschen?')) return;
    const lang = list_langage[index_listLang];
    db.run(`DELETE FROM "${lang}" WHERE id = ?`, [editRowId]);
    markDirty();
    editRowId = null;
    newVoc();
    showStatus('Datensatz gelöscht', 'ok');
}

// ─── ABFRAGE (Repeater) ──────────────────────────────────────

function newVocRep() {
    if (!db || list_langage.length === 0) return;
    const lang = list_langage[index_listLang];
    scoreMinFilter = parseInt(document.getElementById('rep_scoreMin').value) || 0;

    const scoreMax = parseInt(document.getElementById('rep_scoreMax').value) || 999;
    const eligible = db.exec(`SELECT id, vocable FROM "${lang}" WHERE score >= ${scoreMinFilter} AND score <= ${scoreMax}`);

    if (!eligible.length || !eligible[0].values.length) {
        showStatus('Keine Vokabeln mit Score ≥ ' + scoreMinFilter + ' gefunden', 'warn');
        return;
    }
    const rows = eligible[0].values;
    const pick = rows[Math.floor(Math.random() * rows.length)];

    // FIX: currentVocId VOR hideAnswer() setzen
    currentVocId = pick[0];

    document.getElementById('rep_vokabel').textContent = pick[1];
    document.getElementById('rep_activeLang').textContent = lang;

    hideAnswer();
    document.getElementById('rep_scoreDisplay').textContent = '';
}

function checkAnswer() {
    if (!currentVocId) {
        showStatus('Erst eine Vokabel laden (▶ Neue Vokabel)', 'warn');
        return;
    }
    const lang = list_langage[index_listLang];
    const res = db.exec(`SELECT sex, mean_1, mean_2, mean_3, remark, score FROM "${lang}" WHERE id = ${currentVocId}`);
    if (!res.length || !res[0].values.length) return;
    const row = res[0].values[0];

    document.getElementById('rep_sex').textContent    = row[0] || '–';
    document.getElementById('rep_mean1').textContent  = row[1] || '';
    document.getElementById('rep_mean2').textContent  = row[2] || '';
    document.getElementById('rep_mean3').textContent  = row[3] || '';
    document.getElementById('rep_remark').textContent = row[4] || '';
    document.getElementById('rep_scoreDisplay').textContent = 'Score: ' + row[5];
    document.getElementById('rep_answer').classList.remove('hidden');
    document.getElementById('rep_scoreControls').classList.remove('hidden');
}

function hideAnswer() {
    document.getElementById('rep_answer').classList.add('hidden');
    document.getElementById('rep_scoreControls').classList.add('hidden');
    document.getElementById('rep_sex').textContent    = '';
    document.getElementById('rep_mean1').textContent  = '';
    document.getElementById('rep_mean2').textContent  = '';
    document.getElementById('rep_mean3').textContent  = '';
    document.getElementById('rep_remark').textContent = '';
    // WICHTIG: currentVocId hier NICHT löschen!
}

function adjustScore(delta) {
    if (!currentVocId) {
        showStatus('Keine Vokabel aktiv', 'warn');
        return;
    }
    const lang = list_langage[index_listLang];
    db.run(`UPDATE "${lang}" SET score = MAX(0, score + ?) WHERE id = ?`, [delta, currentVocId]);
    markDirty();
    const res = db.exec(`SELECT score FROM "${lang}" WHERE id = ${currentVocId}`);
    const newScore = res[0]?.values[0][0];
    document.getElementById('rep_scoreDisplay').textContent = 'Score: ' + newScore;
    showStatus('Score: ' + newScore, 'ok');
}

// ─── EXCEL IMPORT ────────────────────────────────────────────

let xlsxRows = [];
let xlsxIndex = 0;

async function importFromXlsx(file) {
    if (typeof XLSX === 'undefined') {
        showStatus('SheetJS wird geladen...', 'warn');
        return;
    }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheetName = wb.SheetNames.includes('Tabelle1') ? 'Tabelle1' : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    xlsxRows = json.slice(2).filter(r => r[0] || r[1]);
    xlsxIndex = 0;
    if (xlsxRows.length === 0) {
        showStatus('Keine Daten in Tabelle1 gefunden', 'err');
        return;
    }
    showImportRow();
    showStatus(`${xlsxRows.length} Zeilen gefunden`, 'ok');
}

function showImportRow() {
    if (xlsxIndex >= xlsxRows.length) {
        showStatus('Alle Vokabeln importiert!', 'ok');
        return;
    }
    const row = xlsxRows[xlsxIndex];
    document.getElementById('imp_vokabel').value  = row[1] || '';
    document.getElementById('imp_mean1').value    = row[0] || '';
    document.getElementById('imp_mean2').value    = row[2] || '';
    document.getElementById('imp_mean3').value    = row[3] || '';
    document.getElementById('imp_sex').value      = '';
    document.getElementById('imp_remark').value   = '';
    document.getElementById('imp_counter').textContent = `${xlsxIndex + 1} / ${xlsxRows.length}`;
    updateImportSearch();
}

function acceptImportVoc() {
    const lang   = list_langage[index_listLang];
    const voca   = document.getElementById('imp_vokabel').value.trim();
    const sex    = document.getElementById('imp_sex').value.trim();
    const mean_1 = document.getElementById('imp_mean1').value.trim();
    const mean_2 = document.getElementById('imp_mean2').value.trim();
    const mean_3 = document.getElementById('imp_mean3').value.trim();
    const remark = document.getElementById('imp_remark').value.trim();
    const score  = parseInt(document.getElementById('imp_score').value) || 50;

    if (!voca || !mean_1) { showStatus('Vokabel und Bedeutung 1 erforderlich', 'err'); return; }

    const check = db.exec(`SELECT id FROM "${lang}" WHERE vocable = '${voca.replace(/'/g,"''")}'`);
    const existId = (check.length && check[0].values.length) ? check[0].values[0][0] : null;

    if (existId) {
        db.run(`UPDATE "${lang}" SET sex=?, mean_1=?, mean_2=?, mean_3=?, remark=?, score=? WHERE id=?`,
            [sex, mean_1, mean_2, mean_3, remark, score, existId]);
        showStatus('Vokabel aktualisiert ✓', 'ok');
    } else {
        db.run(`INSERT INTO "${lang}" (language, vocable, sex, mean_1, mean_2, mean_3, remark, score) VALUES (?,?,?,?,?,?,?,?)`,
            [lang, voca, sex, mean_1, mean_2, mean_3, remark, score]);
        showStatus('Vokabel importiert ✓', 'ok');
    }
    markDirty();
    updateImportSearch();
}

function nextImportVoc() {
    xlsxIndex++;
    showImportRow();
}

function importAllRemaining() {
    if (xlsxRows.length === 0) {
        showStatus('Keine Liste geladen', 'warn');
        return;
    }
    const lang = list_langage[index_listLang];
    const score = parseInt(document.getElementById('imp_score').value) || 50;
    let imported = 0;
    let updated = 0;

    for (let i = xlsxIndex; i < xlsxRows.length; i++) {
        const row = xlsxRows[i];
        const voca   = (row[1] || '').trim();
        const mean_1 = (row[0] || '').trim();
        const mean_2 = (row[2] || '').trim();
        const mean_3 = (row[3] || '').trim();

        if (!voca || !mean_1) continue; // Zeile überspringen wenn Pflichtfelder leer

        const check = db.exec(`SELECT id FROM "${lang}" WHERE vocable = '${voca.replace(/'/g,"''")}'`);
        const existId = (check.length && check[0].values.length) ? check[0].values[0][0] : null;

        if (existId) {
            db.run(`UPDATE "${lang}" SET mean_1=?, mean_2=?, mean_3=?, score=? WHERE id=?`,
                [mean_1, mean_2, mean_3, score, existId]);
            updated++;
        } else {
            db.run(`INSERT INTO "${lang}" (language, vocable, sex, mean_1, mean_2, mean_3, remark, score) VALUES (?,?,?,?,?,?,?,?)`,
                [lang, voca, '', mean_1, mean_2, mean_3, '', score]);
            imported++;
        }
    }

    markDirty();
    xlsxIndex = xlsxRows.length; // Zeiger ans Ende setzen
    document.getElementById('imp_counter').textContent = `${xlsxRows.length} / ${xlsxRows.length}`;
    showStatus(`${imported} neu importiert, ${updated} aktualisiert ✓`, 'ok');
}

function updateImportSearch() {
    const voca = document.getElementById('imp_vokabel').value.trim();
    if (!voca || !db || list_langage.length === 0) return;
    const lang = list_langage[index_listLang];
    const res = db.exec(`SELECT vocable, mean_1, score FROM "${lang}" WHERE vocable LIKE '${voca.replace(/'/g,"''")}%' ORDER BY vocable LIMIT 10`);
    const tbody = document.querySelector('#tv_imp_preview tbody');
    tbody.innerHTML = '';
    if (res.length && res[0].values.length) {
        res[0].values.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${esc(row[0])}</td><td>${esc(row[1])}</td><td>${row[2]}</td>`;
            tbody.appendChild(tr);
        });
    }
}

// ─── SCREEN-NAVIGATION ──────────────────────────────────────

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const map = { screen_main: 0, screen_repeater: 1, screen_import: 2 };
    document.querySelectorAll('.nav-btn')[map[id]]?.classList.add('active');
    if (id === 'screen_main') refreshTable();
    if (id === 'screen_repeater') {
        document.getElementById('rep_activeLang').textContent = list_langage[index_listLang] || '';
    }
    if (id === 'screen_import') {
        document.getElementById('imp_activeLang').textContent = list_langage[index_listLang] || '';
    }
}

// ─── HILFSFUNKTIONEN ────────────────────────────────────────

function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showStatus(msg, type = 'ok') {
    const el = document.getElementById('statusbar');
    if (!el) return;
    el.textContent = msg;
    el.className = 'statusbar ' + type;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.textContent = ''; el.className = 'statusbar'; }, 3000);
}

// ─── INIT ────────────────────────────────────────────────────

async function init() {
    document.getElementById('loadingScreen').classList.remove('hidden');

    SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
    });

    const loaded = await loadDatabaseFromStorage();
    if (!loaded) {
        db = new SQL.Database();
        showStatus('Neue Datenbank erstellt. Bitte .sqlite-Datei importieren.', 'warn');
    }

    loadLanguages();

    document.getElementById('cb_language').addEventListener('change', e => {
        index_listLang = parseInt(e.target.value);
        refreshTable();
        document.getElementById('rep_activeLang').textContent = list_langage[index_listLang];
        document.getElementById('imp_activeLang').textContent = list_langage[index_listLang];
    });

    document.getElementById('le_chercheVok').addEventListener('input', e => {
        refreshTable(e.target.value, document.getElementById('le_chercheTrad').value);
    });
    document.getElementById('le_chercheTrad').addEventListener('input', e => {
        refreshTable(document.getElementById('le_chercheVok').value, e.target.value);
    });
    document.getElementById('imp_vokabel').addEventListener('input', updateImportSearch);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) saveDatabase();
    });
    window.addEventListener('beforeunload', saveDatabase);

    document.getElementById('btn_loadSqlite').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        await loadDatabaseFromFile(file);
        loadLanguages();
        showStatus('Datenbank geladen ✓', 'ok');
    });

    document.getElementById('btn_xlsxFile').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (file) await importFromXlsx(file);
    });

    document.getElementById('loadingScreen').classList.add('hidden');
    showScreen('screen_main');

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
}

window.addEventListener('DOMContentLoaded', init);
