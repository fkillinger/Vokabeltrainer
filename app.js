// ============================================================
//  Vokabeltrainer PWA  –  app.js
// ============================================================

let db = null;
let SQL = null;
let isDirty = false;
let list_langage = [];
let index_listLang = 0;
let currentVocId = null;
let editRowId = null;
let autoSaveTimer = null;
let scoreMinFilter = 0;
let queryDirection = 'fwd'; // 'fwd' = Fremdsprache→Deutsch, 'rev' = Deutsch→Fremdsprache

// ─── TEXT-TO-SPEECH ─────────────────────────────────────────────

const langCodeMap = {
    'franz':    'fr-FR',
    'french':   'fr-FR',
    'français': 'fr-FR',
    'english':  'en-GB',
    'englisch': 'en-GB',
    'danish':   'da-DK',
    'dänisch':  'da-DK',
    'spanish':  'es-ES',
    'spanisch': 'es-ES',
    'italian':  'it-IT',
    'italienisch': 'it-IT',
};

function getLangCode(tableName) {
    const key = (tableName || '').toLowerCase();
    return langCodeMap[key] || 'de-DE';
}

function speak(text, tableName) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // laufende Ausgabe stoppen
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = getLangCode(tableName);
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

function speakCurrent() {
    const lang = list_langage[index_listLang];
    const text = document.getElementById('rep_vokabel').textContent;
    if (text && text !== '–') speak(text, lang);
}

function speakAnswer() {
    // Antwort vorlesen: bei fwd = Bedeutung 1, bei rev = Vokabel
    const lang = list_langage[index_listLang];
    if (queryDirection === 'fwd') {
        const text = document.getElementById('rep_mean1').textContent;
        if (text) speak(text, 'deutsch');
    } else {
        const text = document.getElementById('rep_ans_vocable').textContent;
        if (text) speak(text, lang);
    }
}

// ─── I18N ────────────────────────────────────────────────────

const i18n = {
    de: {
        // Topbar
        app_title:          'Vokabel',
        app_title2:         'trainer',
        // Nav
        nav_manage:         'Verwalten',
        nav_query:          'Abfrage',
        nav_import:         'Import',
        // Screen Hauptmaske
        sec_enter:          'Vokabel eingeben',
        lbl_vocable:        'Vokabel',
        lbl_sex:            'Geschlecht',
        lbl_sex_ph:         'm/f/n',
        lbl_meaning1:       'Bedeutung 1',
        lbl_meaning1_ph:    'Pflichtfeld',
        lbl_meaning2:       'Bedeutung 2',
        lbl_meaning3:       'Bedeutung 3',
        lbl_remark:         'Bemerkung',
        lbl_remark_ph:      'optional',
        lbl_score:          'Score',
        btn_new:            '＋ Neu',
        btn_save:           '💾 Speichern',
        btn_tofield:        '✏️ in Feld',
        btn_delete:         '🗑 Löschen',
        sec_search:         'Suche',
        ph_search_voc:      '🔍 Vokabel',
        ph_search_mean:     '🔍 Bedeutung',
        th_vocable:         'Vokabel',
        th_sex:             'Sex',
        th_mean1:           'Bed. 1',
        th_mean2:           'Bed. 2',
        th_mean3:           'Bed. 3',
        th_score:           'Score',
        sec_newlang:        'Neue Sprache anlegen',
        ph_newlang:         'Sprache z.B. Espanol',
        btn_newlang:        'Anlegen',
        sec_db:             'Datenbank',
        btn_loadsqlite:     '📂 .sqlite laden',
        btn_savesqlite:     '💾 .sqlite speichern',
        // Screen Abfrage
        sec_settings:       'Abfrage-Einstellungen',
        lbl_scorerange:     'Score',
        lbl_activelang:     'Aktive Sprache',
        btn_newvoc:         '▶ Neue Vokabel',
        btn_checkanswer:    '🔍 Antwort aufdecken',
        lbl_ans_sex:        'Geschlecht',
        lbl_ans_mean1:      'Bedeutung 1',
        lbl_ans_mean2:      'Bedeutung 2',
        lbl_ans_mean3:      'Bedeutung 3',
        lbl_ans_remark:     'Bemerkung',
        btn_score_vgood:    '−10 ✓✓',
        btn_score_good:     '−1 ✓',
        btn_score_bad:      '+1 △',
        btn_score_vbad:     '+10 ✗',
        btn_nextvoc:        '▶ Nächste Vokabel',
        // Abfragerichtung
        lbl_direction:      'Richtung',
        dir_fwd:            '→ Deutsch',
        dir_rev:            '→ Fremdsprache',
        lbl_ans_vocable:    'Vokabel',
        // Screen Import
        lbl_activelang_imp: 'Aktive Sprache',
        sec_xlsx:           'Import aus Excel (.xlsx)',
        btn_xlsx:           '📊 .xlsx wählen',
        lbl_voc_imp:        'Vokabel',
        ph_voc_col:         'Spalte B',
        lbl_sex_imp:        'Geschlecht',
        lbl_mean1_imp:      'Bedeutung 1',
        ph_mean1_col:       'Spalte A',
        lbl_mean2_imp:      'Bedeutung 2',
        ph_mean2_col:       'Spalte C',
        lbl_mean3_imp:      'Bedeutung 3',
        ph_mean3_col:       'Spalte D',
        lbl_remark_imp:     'Bemerkung',
        lbl_score_imp:      'Score',
        btn_accept:         '✓ Akzeptieren',
        btn_next:           '→ Nächste',
        btn_importall:      '⚡ Alle importieren',
        sec_preview:        'In DB vorhanden?',
        th_mean1_prev:      'Bedeutung 1',
        sec_manual:         'Einzelne Vokabel manuell',
        txt_manual:         'Felder oben ausfüllen und „Akzeptieren" klicken – auch ohne Excel-Datei nutzbar.',
        // Status
        st_saved:           'Gespeichert ✓',
        st_saveerr:         'Speicherfehler: ',
        st_newdb:           'Neue Datenbank erstellt. Bitte .sqlite-Datei importieren.',
        st_dbloaded:        'Datenbank geladen ✓',
        st_langempty:       'Bitte Sprachname eingeben',
        st_nodb:            'Keine Datenbank geladen',
        st_langexists:      'Sprache bereits vorhanden',
        st_langcreated:     'Sprache angelegt ✓',
        st_langerr:         'Fehler: ',
        st_norow:           'Keine Zeile ausgewählt',
        st_deleted:         'Datensatz gelöscht',
        st_required:        'Vokabel und Bedeutung 1 sind Pflichtfelder!',
        st_updated:         'Vokabel aktualisiert ✓',
        st_inserted:        'Neue Vokabel gespeichert ✓',
        st_noscorerange:    'Keine Vokabeln in diesem Score-Bereich gefunden',
        st_loadfirst:       'Erst eine Vokabel laden (▶ Neue Vokabel)',
        st_novocactive:     'Keine Vokabel aktiv',
        st_noxlsx:          'Keine Liste geladen',
        st_noxlsxdata:      'Keine Daten in Tabelle1 gefunden',
        st_imp_required:    'Vokabel und Bedeutung 1 erforderlich',
        st_imp_updated:     'Vokabel aktualisiert ✓',
        st_imp_inserted:    'Vokabel importiert ✓',
        st_imp_all:         'neu importiert,',
        st_imp_all2:        'aktualisiert ✓',
        st_noselected:      'Keine Zeile in Tabelle ausgewählt',
        // confirm
        cf_delete:          'Datensatz wirklich löschen?',
        st_maxlang:         'Maximum 3 Sprachen in der kostenlosen Version',
        btn_dellang:        'Sprache löschen',
        st_dellang_confirm: 'Sprache und ALLE Vokabeln unwiderruflich löschen?',
        st_dellang_ok:      'Sprache gelöscht ✓',
        st_dellang_none:    'Keine Sprache ausgewählt',
        lbl_version:        'Version',
        about_title:        'Vokabeltrainer',
        about_text:         'Persönlicher Vokabeltrainer – kostenlose Version\nBis zu 3 Sprachen, unbegrenzte Vokabeln\nDaten werden lokal gespeichert.',
        btn_close:          'Schließen',
    },
    en: {
        app_title:          'Vocab',
        app_title2:         'trainer',
        nav_manage:         'Manage',
        nav_query:          'Quiz',
        nav_import:         'Import',
        sec_enter:          'Enter vocabulary',
        lbl_vocable:        'Word',
        lbl_sex:            'Gender',
        lbl_sex_ph:         'm/f/n',
        lbl_meaning1:       'Meaning 1',
        lbl_meaning1_ph:    'Required',
        lbl_meaning2:       'Meaning 2',
        lbl_meaning3:       'Meaning 3',
        lbl_remark:         'Remark',
        lbl_remark_ph:      'optional',
        lbl_score:          'Score',
        btn_new:            '＋ New',
        btn_save:           '💾 Save',
        btn_tofield:        '✏️ To field',
        btn_delete:         '🗑 Delete',
        sec_search:         'Search',
        ph_search_voc:      '🔍 Word',
        ph_search_mean:     '🔍 Meaning',
        th_vocable:         'Word',
        th_sex:             'Gender',
        th_mean1:           'Mean. 1',
        th_mean2:           'Mean. 2',
        th_mean3:           'Mean. 3',
        th_score:           'Score',
        sec_newlang:        'Add new language',
        ph_newlang:         'Language e.g. Spanish',
        btn_newlang:        'Create',
        sec_db:             'Database',
        btn_loadsqlite:     '📂 Load .sqlite',
        btn_savesqlite:     '💾 Save .sqlite',
        sec_settings:       'Quiz settings',
        lbl_scorerange:     'Score',
        lbl_activelang:     'Active language',
        btn_newvoc:         '▶ New word',
        btn_checkanswer:    '🔍 Show answer',
        lbl_ans_sex:        'Gender',
        lbl_ans_mean1:      'Meaning 1',
        lbl_ans_mean2:      'Meaning 2',
        lbl_ans_mean3:      'Meaning 3',
        lbl_ans_remark:     'Remark',
        btn_score_vgood:    '−10 ✓✓',
        btn_score_good:     '−1 ✓',
        btn_score_bad:      '+1 △',
        btn_score_vbad:     '+10 ✗',
        btn_nextvoc:        '▶ Next word',
        lbl_direction:      'Direction',
        dir_fwd:            '→ German',
        dir_rev:            '→ Foreign',
        lbl_ans_vocable:    'Word',
        lbl_activelang_imp: 'Active language',
        sec_xlsx:           'Import from Excel (.xlsx)',
        btn_xlsx:           '📊 Choose .xlsx',
        lbl_voc_imp:        'Word',
        ph_voc_col:         'Column B',
        lbl_sex_imp:        'Gender',
        lbl_mean1_imp:      'Meaning 1',
        ph_mean1_col:       'Column A',
        lbl_mean2_imp:      'Meaning 2',
        ph_mean2_col:       'Column C',
        lbl_mean3_imp:      'Meaning 3',
        ph_mean3_col:       'Column D',
        lbl_remark_imp:     'Remark',
        lbl_score_imp:      'Score',
        btn_accept:         '✓ Accept',
        btn_next:           '→ Next',
        btn_importall:      '⚡ Import all',
        sec_preview:        'Already in DB?',
        th_mean1_prev:      'Meaning 1',
        sec_manual:         'Single word manually',
        txt_manual:         'Fill in the fields above and click "Accept" – works without an Excel file too.',
        st_saved:           'Saved ✓',
        st_saveerr:         'Save error: ',
        st_newdb:           'New database created. Please import a .sqlite file.',
        st_dbloaded:        'Database loaded ✓',
        st_langempty:       'Please enter a language name',
        st_nodb:            'No database loaded',
        st_langexists:      'Language already exists',
        st_langcreated:     'Language created ✓',
        st_langerr:         'Error: ',
        st_norow:           'No row selected',
        st_deleted:         'Record deleted',
        st_required:        'Word and Meaning 1 are required!',
        st_updated:         'Word updated ✓',
        st_inserted:        'New word saved ✓',
        st_noscorerange:    'No words found in this score range',
        st_loadfirst:       'Load a word first (▶ New word)',
        st_novocactive:     'No word active',
        st_noxlsx:          'No list loaded',
        st_noxlsxdata:      'No data found in Tabelle1',
        st_imp_required:    'Word and Meaning 1 required',
        st_imp_updated:     'Word updated ✓',
        st_imp_inserted:    'Word imported ✓',
        st_imp_all:         'newly imported,',
        st_imp_all2:        'updated ✓',
        st_noselected:      'No row selected in table',
        cf_delete:          'Really delete this record?',
        st_maxlang:         'Maximum 3 languages in the free version',
        btn_dellang:        'Delete language',
        st_dellang_confirm: 'Delete language and ALL vocabulary permanently?',
        st_dellang_ok:      'Language deleted ✓',
        st_dellang_none:    'No language selected',
        lbl_version:        'Version',
        about_title:        'Vocab Trainer',
        about_text:         'Personal vocabulary trainer – free version\nUp to 3 languages, unlimited vocabulary\nData is stored locally.',
        btn_close:          'Close',
    },
    fr: {
        app_title:          'Voca',
        app_title2:         'bulaire',
        nav_manage:         'Gérer',
        nav_query:          'Révision',
        nav_import:         'Importer',
        sec_enter:          'Saisir un mot',
        lbl_vocable:        'Mot',
        lbl_sex:            'Genre',
        lbl_sex_ph:         'm/f/n',
        lbl_meaning1:       'Signification 1',
        lbl_meaning1_ph:    'Obligatoire',
        lbl_meaning2:       'Signification 2',
        lbl_meaning3:       'Signification 3',
        lbl_remark:         'Remarque',
        lbl_remark_ph:      'optionnel',
        lbl_score:          'Score',
        btn_new:            '＋ Nouveau',
        btn_save:           '💾 Enregistrer',
        btn_tofield:        '✏️ Vers champ',
        btn_delete:         '🗑 Supprimer',
        sec_search:         'Recherche',
        ph_search_voc:      '🔍 Mot',
        ph_search_mean:     '🔍 Signification',
        th_vocable:         'Mot',
        th_sex:             'Genre',
        th_mean1:           'Sign. 1',
        th_mean2:           'Sign. 2',
        th_mean3:           'Sign. 3',
        th_score:           'Score',
        sec_newlang:        'Ajouter une langue',
        ph_newlang:         'Langue ex. Espagnol',
        btn_newlang:        'Créer',
        sec_db:             'Base de données',
        btn_loadsqlite:     '📂 Charger .sqlite',
        btn_savesqlite:     '💾 Sauver .sqlite',
        sec_settings:       'Paramètres de révision',
        lbl_scorerange:     'Score',
        lbl_activelang:     'Langue active',
        btn_newvoc:         '▶ Nouveau mot',
        btn_checkanswer:    '🔍 Voir la réponse',
        lbl_ans_sex:        'Genre',
        lbl_ans_mean1:      'Signification 1',
        lbl_ans_mean2:      'Signification 2',
        lbl_ans_mean3:      'Signification 3',
        lbl_ans_remark:     'Remarque',
        btn_score_vgood:    '−10 ✓✓',
        btn_score_good:     '−1 ✓',
        btn_score_bad:      '+1 △',
        btn_score_vbad:     '+10 ✗',
        btn_nextvoc:        '▶ Mot suivant',
        lbl_direction:      'Direction',
        dir_fwd:            '→ Allemand',
        dir_rev:            '→ Langue étrangère',
        lbl_ans_vocable:    'Mot',
        lbl_activelang_imp: 'Langue active',
        sec_xlsx:           'Importer depuis Excel (.xlsx)',
        btn_xlsx:           '📊 Choisir .xlsx',
        lbl_voc_imp:        'Mot',
        ph_voc_col:         'Colonne B',
        lbl_sex_imp:        'Genre',
        lbl_mean1_imp:      'Signification 1',
        ph_mean1_col:       'Colonne A',
        lbl_mean2_imp:      'Signification 2',
        ph_mean2_col:       'Colonne C',
        lbl_mean3_imp:      'Signification 3',
        ph_mean3_col:       'Colonne D',
        lbl_remark_imp:     'Remarque',
        lbl_score_imp:      'Score',
        btn_accept:         '✓ Accepter',
        btn_next:           '→ Suivant',
        btn_importall:      '⚡ Tout importer',
        sec_preview:        'Déjà en DB?',
        th_mean1_prev:      'Signification 1',
        sec_manual:         'Mot unique manuellement',
        txt_manual:         'Remplissez les champs ci-dessus et cliquez sur « Accepter » – fonctionne aussi sans fichier Excel.',
        st_saved:           'Enregistré ✓',
        st_saveerr:         'Erreur de sauvegarde: ',
        st_newdb:           'Nouvelle base créée. Veuillez importer un fichier .sqlite.',
        st_dbloaded:        'Base de données chargée ✓',
        st_langempty:       'Veuillez saisir un nom de langue',
        st_nodb:            'Aucune base de données chargée',
        st_langexists:      'Langue déjà existante',
        st_langcreated:     'Langue créée ✓',
        st_langerr:         'Erreur: ',
        st_norow:           'Aucune ligne sélectionnée',
        st_deleted:         'Enregistrement supprimé',
        st_required:        'Le mot et la signification 1 sont obligatoires!',
        st_updated:         'Mot mis à jour ✓',
        st_inserted:        'Nouveau mot enregistré ✓',
        st_noscorerange:    'Aucun mot trouvé dans cette plage de score',
        st_loadfirst:       'Chargez un mot d\'abord (▶ Nouveau mot)',
        st_novocactive:     'Aucun mot actif',
        st_noxlsx:          'Aucune liste chargée',
        st_noxlsxdata:      'Aucune donnée trouvée dans Tabelle1',
        st_imp_required:    'Mot et signification 1 obligatoires',
        st_imp_updated:     'Mot mis à jour ✓',
        st_imp_inserted:    'Mot importé ✓',
        st_imp_all:         'nouvellement importés,',
        st_imp_all2:        'mis à jour ✓',
        st_noselected:      'Aucune ligne sélectionnée dans le tableau',
        cf_delete:          'Vraiment supprimer cet enregistrement?',
        st_maxlang:         'Maximum 3 langues dans la version gratuite',
        btn_dellang:        'Supprimer la langue',
        st_dellang_confirm: 'Supprimer la langue et TOUS les mots définitivement?',
        st_dellang_ok:      'Langue supprimée ✓',
        st_dellang_none:    'Aucune langue sélectionnée',
        lbl_version:        'Version',
        about_title:        'Entraîneur de vocabulaire',
        about_text:         'Entraîneur de vocabulaire personnel – version gratuite\nJusqu\'à 3 langues, vocabulaire illimité\nLes données sont stockées localement.',
        btn_close:          'Fermer',
    }
};

let uiLang = localStorage.getItem('uiLang') || 'de';

function t(key) {
    return i18n[uiLang]?.[key] || i18n['de'][key] || key;
}

function applyLanguage() {
    // Alle Elemente mit data-i18n Attribut aktualisieren
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const attr = el.getAttribute('data-i18n-attr');
        if (attr) {
            el.setAttribute(attr, t(key));
        } else {
            el.textContent = t(key);
        }
    });

    // Sprachbuttons markieren
    document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === uiLang);
    });

    // Tabellenkopf aktualisieren (7 Spalten, letzte = 🔊 fest)
    const ths = document.querySelectorAll('#tv_vokabel thead th');
    if (ths.length >= 6) {
        ths[0].textContent = t('th_vocable');
        ths[1].textContent = t('th_sex');
        ths[2].textContent = t('th_mean1');
        ths[3].textContent = t('th_mean2');
        ths[4].textContent = t('th_mean3');
        ths[5].textContent = t('th_score');
        // ths[6] = 🔊 bleibt fest
    }

    localStorage.setItem('uiLang', uiLang);
}

function setUiLang(lang) {
    uiLang = lang;
    applyLanguage();
}

function speakField() {
    const lang = list_langage[index_listLang];
    const text = document.getElementById('le_vokabel').value.trim();
    if (text) speak(text, lang);
}

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
        showStatus(t('st_saved'), 'ok');
    } catch (e) {
        showStatus(t('st_saveerr') + e.message, 'err');
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
    // FIX 2: Zuletzt verwendete Sprache wiederherstellen
    const savedLang = localStorage.getItem('activeLang');
    const savedIdx  = savedLang ? list_langage.indexOf(savedLang) : -1;
    index_listLang  = savedIdx >= 0 ? savedIdx : 0;
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

    // FIX 1: setTimeout stellt sicher dass DOM vollständig bereit ist
    // bevor die Tabelle befüllt wird – behebt Suchproblem beim ersten Aufruf
    setTimeout(() => refreshTable(), 0);
}

function createNewLanguage() {
    const name = document.getElementById('le_newLanguage').value.trim();
    if (!name) { showStatus(t('st_langempty'), 'warn'); return; }
    if (!db)   { showStatus(t('st_nodb'), 'err'); return; }
    if (list_langage.length >= 10) { showStatus(t('st_maxlang'), 'warn'); return; }
    if (list_langage.includes(name)) { showStatus(t('st_langexists'), 'warn'); return; }

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
        showStatus(`${t('st_langcreated').replace('✓', '')} "${name}" ✓`, 'ok');
    } catch(e) {
        showStatus(t('st_langerr') + e.message, 'err');
    }
}

function deleteLanguage() {
    if (list_langage.length === 0) { showStatus(t('st_dellang_none'), 'warn'); return; }
    const lang = list_langage[index_listLang];
    if (!confirm(`${t('st_dellang_confirm')}\n\n"${lang}"`)) return;
    try {
        db.run(`DROP TABLE IF EXISTS "${lang}"`);
        markDirty();
        list_langage = [];
        const res = db.exec("SELECT distinct tbl_name FROM sqlite_master WHERE type='table' AND tbl_name != 'sqlite_sequence' ORDER BY 1");
        if (res.length > 0) res[0].values.forEach(row => list_langage.push(row[0]));
        index_listLang = 0;
        localStorage.setItem('activeLang', list_langage[0] || '');
        refreshLanguageUI();
        showStatus(`"${lang}" – ${t('st_dellang_ok')}`, 'ok');
    } catch(e) {
        showStatus(t('st_langerr') + e.message, 'err');
    }
}

function showAbout() {
    const el = document.getElementById('about_modal');
    if (el) el.classList.remove('hidden');
}

function hideAbout() {
    const el = document.getElementById('about_modal');
    if (el) el.classList.add('hidden');
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
    document.getElementById('le_vokabel').value     = '';
    document.getElementById('le_sex').value         = '';
    document.getElementById('le_bed1').value        = '';
    document.getElementById('le_bed2').value        = '';
    document.getElementById('le_bed3').value        = '';
    document.getElementById('te_remark').value      = '';
    document.getElementById('le_score').value       = '100';
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

    if (!voca || !mean_1) { showStatus(t('st_required'), 'err'); return; }

    const check = db.exec(`SELECT id FROM "${lang}" WHERE vocable = '${voca.replace(/'/g,"''")}'`);
    const existId = (check.length && check[0].values.length) ? check[0].values[0][0] : null;

    if (existId) {
        db.run(`UPDATE "${lang}" SET language=?, vocable=?, sex=?, mean_1=?, mean_2=?, mean_3=?, remark=?, score=? WHERE id=?`,
            [lang, voca, sex, mean_1, mean_2, mean_3, remark, score, existId]);
        showStatus(t('st_updated'), 'ok');
    } else {
        db.run(`INSERT INTO "${lang}" (language, vocable, sex, mean_1, mean_2, mean_3, remark, score) VALUES (?,?,?,?,?,?,?,?)`,
            [lang, voca, sex, mean_1, mean_2, mean_3, remark, score]);
        showStatus(t('st_inserted'), 'ok');
    }
    markDirty();
    refreshTable();
}

function delRow() {
    if (!editRowId) { showStatus(t('st_norow'), 'warn'); return; }
    if (!confirm(t('cf_delete'))) return;
    const lang = list_langage[index_listLang];
    db.run(`DELETE FROM "${lang}" WHERE id = ?`, [editRowId]);
    markDirty();
    editRowId = null;
    newVoc();
    showStatus(t('st_deleted'), 'ok');
}

// ─── ABFRAGE (Repeater) ──────────────────────────────────────

function newVocRep() {
    if (!db || list_langage.length === 0) return;
    const lang = list_langage[index_listLang];
    scoreMinFilter = parseInt(document.getElementById('rep_scoreMin').value) || 0;
    const scoreMax = parseInt(document.getElementById('rep_scoreMax').value) || 999;

    const eligible = db.exec(`SELECT id, vocable, mean_1, mean_2, mean_3 FROM "${lang}" WHERE score >= ${scoreMinFilter} AND score <= ${scoreMax}`);
    if (!eligible.length || !eligible[0].values.length) {
        showStatus(t('st_noscorerange'), 'warn');
        return;
    }
    const rows = eligible[0].values;
    const pick = rows[Math.floor(Math.random() * rows.length)];

    currentVocId = pick[0];
    document.getElementById('rep_activeLang').textContent = lang;

    if (queryDirection === 'fwd') {
        // Vorwärts: Vokabel zeigen, Bedeutung erraten
        document.getElementById('rep_vokabel').textContent = pick[1];
    } else {
        // Rückwärts: zufällige Bedeutung zeigen, Vokabel erraten
        const meanings = [pick[2], pick[3], pick[4]].filter(m => m && m.trim() !== '');
        const randomMeaning = meanings[Math.floor(Math.random() * meanings.length)];
        document.getElementById('rep_vokabel').textContent = randomMeaning;
    }

    hideAnswer();
    document.getElementById('rep_scoreDisplay').textContent = '';
}

function checkAnswer() {
    if (!currentVocId) { showStatus(t('st_loadfirst'), 'warn'); return; }
    const lang = list_langage[index_listLang];
    const res = db.exec(`SELECT vocable, sex, mean_1, mean_2, mean_3, remark, score FROM "${lang}" WHERE id = ${currentVocId}`);
    if (!res.length || !res[0].values.length) return;
    const row = res[0].values[0];
    // row: vocable=0, sex=1, mean_1=2, mean_2=3, mean_3=4, remark=5, score=6

    if (queryDirection === 'fwd') {
        // Vorwärts: Bedeutungen zeigen, Vokabel war die Frage
        document.getElementById('rep_ans_vocable_row').classList.add('hidden');
        document.getElementById('rep_sex').textContent    = row[1] || '–';
        document.getElementById('rep_mean1').textContent  = row[2] || '';
        document.getElementById('rep_mean2').textContent  = row[3] || '';
        document.getElementById('rep_mean3').textContent  = row[4] || '';
        document.getElementById('rep_remark').textContent = row[5] || '';
    } else {
        // Rückwärts: Vokabel zeigen, Bedeutungen waren die Frage
        document.getElementById('rep_ans_vocable_row').classList.remove('hidden');
        document.getElementById('rep_ans_vocable').textContent = row[0] || '';
        document.getElementById('rep_sex').textContent    = row[1] || '–';
        document.getElementById('rep_mean1').textContent  = row[2] || '';
        document.getElementById('rep_mean2').textContent  = row[3] || '';
        document.getElementById('rep_mean3').textContent  = row[4] || '';
        document.getElementById('rep_remark').textContent = row[5] || '';
    }

    document.getElementById('rep_scoreDisplay').textContent = 'Score: ' + row[6];
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
}

function adjustScore(delta) {
    if (!currentVocId) { showStatus(t('st_novocactive'), 'warn'); return; }
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
    if (typeof XLSX === 'undefined') { showStatus('SheetJS...', 'warn'); return; }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheetName = wb.SheetNames.includes('Tabelle1') ? 'Tabelle1' : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    xlsxRows = json.slice(2).filter(r => r[0] || r[1]);
    xlsxIndex = 0;
    if (xlsxRows.length === 0) { showStatus(t('st_noxlsxdata'), 'err'); return; }
    showImportRow();
    showStatus(`${xlsxRows.length} ${t('nav_import')} ✓`, 'ok');
}

function showImportRow() {
    if (xlsxIndex >= xlsxRows.length) { showStatus(t('btn_importall') + ' ✓', 'ok'); return; }
    const row = xlsxRows[xlsxIndex];
    document.getElementById('imp_vokabel').value = row[1] || '';
    document.getElementById('imp_mean1').value   = row[0] || '';
    document.getElementById('imp_mean2').value   = row[2] || '';
    document.getElementById('imp_mean3').value   = row[3] || '';
    document.getElementById('imp_sex').value     = '';
    document.getElementById('imp_remark').value  = '';
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

    if (!voca || !mean_1) { showStatus(t('st_imp_required'), 'err'); return; }

    const check = db.exec(`SELECT id FROM "${lang}" WHERE vocable = '${voca.replace(/'/g,"''")}'`);
    const existId = (check.length && check[0].values.length) ? check[0].values[0][0] : null;

    if (existId) {
        db.run(`UPDATE "${lang}" SET sex=?, mean_1=?, mean_2=?, mean_3=?, remark=?, score=? WHERE id=?`,
            [sex, mean_1, mean_2, mean_3, remark, score, existId]);
        showStatus(t('st_imp_updated'), 'ok');
    } else {
        db.run(`INSERT INTO "${lang}" (language, vocable, sex, mean_1, mean_2, mean_3, remark, score) VALUES (?,?,?,?,?,?,?,?)`,
            [lang, voca, sex, mean_1, mean_2, mean_3, remark, score]);
        showStatus(t('st_imp_inserted'), 'ok');
    }
    markDirty();
    updateImportSearch();
}

function nextImportVoc() {
    xlsxIndex++;
    showImportRow();
}

function importAllRemaining() {
    if (xlsxRows.length === 0) { showStatus(t('st_noxlsx'), 'warn'); return; }
    const lang  = list_langage[index_listLang];
    const score = parseInt(document.getElementById('imp_score').value) || 50;
    let imported = 0, updated = 0;

    for (let i = xlsxIndex; i < xlsxRows.length; i++) {
        const row  = xlsxRows[i];
        const voca   = (row[1] || '').trim();
        const mean_1 = (row[0] || '').trim();
        const mean_2 = (row[2] || '').trim();
        const mean_3 = (row[3] || '').trim();
        if (!voca || !mean_1) continue;

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
    xlsxIndex = xlsxRows.length;
    document.getElementById('imp_counter').textContent = `${xlsxRows.length} / ${xlsxRows.length}`;
    showStatus(`${imported} ${t('st_imp_all')} ${updated} ${t('st_imp_all2')}`, 'ok');
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
    if (id === 'screen_main')     refreshTable();
    if (id === 'screen_repeater') document.getElementById('rep_activeLang').textContent = list_langage[index_listLang] || '';
    if (id === 'screen_import')   document.getElementById('imp_activeLang').textContent = list_langage[index_listLang] || '';
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
        showStatus(t('st_newdb'), 'warn');
    }

    loadLanguages();
    applyLanguage();

    // UI-Sprachumschalter
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setUiLang(btn.dataset.lang));
    });

    // Abfragerichtung-Umschalter
    document.querySelectorAll('.dir-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            queryDirection = btn.dataset.dir;
            document.querySelectorAll('.dir-btn').forEach(b => b.classList.toggle('active', b.dataset.dir === queryDirection));
            hideAnswer();
            document.getElementById('rep_vokabel').textContent = '–';
            currentVocId = null;
        });
    });

    document.getElementById('cb_language').addEventListener('change', e => {
        index_listLang = parseInt(e.target.value);
        // FIX 2b: Aktive Sprache persistieren
        localStorage.setItem('activeLang', list_langage[index_listLang]);
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

    document.addEventListener('visibilitychange', () => { if (document.hidden) saveDatabase(); });
    window.addEventListener('beforeunload', saveDatabase);

    document.getElementById('btn_loadSqlite').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        await loadDatabaseFromFile(file);
        loadLanguages();
        showStatus(t('st_dbloaded'), 'ok');
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

function writeVocToField_current() {
    if (!editRowId) { showStatus(t('st_noselected'), 'warn'); return; }
    loadRowToFields(editRowId);
}

window.addEventListener('DOMContentLoaded', init);
