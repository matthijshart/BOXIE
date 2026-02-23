// Rendi — minimal multi-page demo logic (Claude-inspired)
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------- State ----------
  const KEY = 'rendi_demo_v2';
  const DEFAULT = {
    year: '2028',
    categories: {
      bank:       { status:'todo', files:[], data:null },
      beleggingen:{ status:'todo', files:[], data:null },
      vastgoed:   { status:'todo', files:[], data:null },
      leningen:   { status:'todo', files:[], data:null },
      crypto:     { status:'todo', files:[], data:null }
    }
  };

  function clone(x){ return JSON.parse(JSON.stringify(x)); }

  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return clone(DEFAULT);
      const s = JSON.parse(raw);
      // merge safety
      const merged = clone(DEFAULT);
      merged.year = s.year || merged.year;
      if(s.categories){
        for(const k of Object.keys(merged.categories)){
          merged.categories[k] = { ...merged.categories[k], ...(s.categories[k] || {}) };
          merged.categories[k].files = Array.isArray(merged.categories[k].files) ? merged.categories[k].files : [];
        }
      }
      return merged;
    }catch(e){
      return clone(DEFAULT);
    }
  }

  function save(s){
    try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){}
  }

  const state = load();

  // ---------- Helpers ----------
  const CAT_META = {
    bank:        { label:'Bank & sparen', icon:'🏦', page:'bank.html' },
    beleggingen: { label:'Beleggingen', icon:'📈', page:'beleggen.html' },
    vastgoed:    { label:'Vastgoed', icon:'🏠', page:'vastgoed.html' },
    leningen:    { label:'Vorderingen & schulden', icon:'🤝', page:'leningen.html' },
    crypto:      { label:'Crypto', icon:'🪙', page:'crypto.html' }
  };

  function computePct(){
    const vals = Object.values(state.categories).map(c => c.status);
    const done = vals.filter(v => v === 'ok').length;
    const warn = vals.filter(v => v === 'warn').length;
    const total = vals.length;
    const score = (done + 0.5 * warn) / total;
    return Math.round(score * 100);
  }

  function fmtEUR(n){
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    return sign + "€ " + abs.toLocaleString('nl-NL', { maximumFractionDigits: 0 });
  }

  function parseMoney(v){
    if(v === null || v === undefined) return 0;
    const s = String(v).trim().replace(/\./g,'').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  // toast
  const toast = $('#toast');
  function showToast(msg){
    if(!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
  }

  // ---------- Shared Topbar ----------
  const yearSelect = $('#yearSelect');
  if(yearSelect){
    yearSelect.value = state.year;
    yearSelect.addEventListener('change', () => {
      state.year = yearSelect.value;
      save(state);
      // re-render pages that depend on year
      if(document.body.dataset.page === 'dashboard') renderDashboard();
      if(document.body.dataset.page === 'category') renderCategory();
    });
  }

  const compBar = $('#completionBar');
  const compPct = $('#compPct');

  function renderCompletion(){
    const pct = computePct();
    if(compBar) compBar.style.width = pct + '%';
    if(compPct) compPct.textContent = pct + '%';
  }

  // ---------- Mobile menu sheet ----------
  const overlay = $('#overlay');
  const sheet = $('#sheet');
  const openMenu = $('#openMenu');
  const closeMenu = $('#closeMenu');
  const sheetLinks = $$('.sheetLink');

  function showMenu(){
    if(!overlay || !sheet) return;
    overlay.style.display = 'block';
    sheet.style.display = 'block';
  }
  function hideMenu(){
    if(!overlay || !sheet) return;
    overlay.style.display = 'none';
    sheet.style.display = 'none';
  }

  openMenu?.addEventListener('click', showMenu);
  closeMenu?.addEventListener('click', hideMenu);
  overlay?.addEventListener('click', hideMenu);
  sheetLinks.forEach(a => a.addEventListener('click', hideMenu));

  // Reset demo
  $('#resetBtn')?.addEventListener('click', () => {
    localStorage.removeItem(KEY);
    location.reload();
  });

  // ---------- Example data per category ----------
  function example(cat){
    if(cat === 'bank'){
      return {
        bank:'ING',
        iban:'NL00INGB0000000000',
        begin: 32000,
        end: 36500,
        interest: 245,
        fees: 18,
        note: 'Voorbeeld: rente en kosten herkend uit export.'
      };
    }
    if(cat === 'beleggingen'){
      return {
        broker:'DEGIRO',
        beginValue: 55000,
        endValue: 61200,
        deposits: 4000,
        withdrawals: 0,
        dividends: 820,
        costs: 120,
        note: 'Voorbeeld: waardeontwikkeling + dividend + kosten.'
      };
    }
    if(cat === 'vastgoed'){
      return {
        address:'Keizersgracht 1, Amsterdam',
        woz: 425000,
        useType:'gemengd',
        rent: 9500,
        bijtelling: 14238, // demo placeholder
        maintenance: 2100,
        note: 'Voorbeeld: WOZ opgehaald en gebruikstype gekozen.'
      };
    }
    if(cat === 'leningen'){
      return {
        counterparty:'Lening aan familie',
        principalBegin: 10000,
        principalEnd: 9000,
        interestReceived: 300,
        interestPaid: 0,
        note: 'Voorbeeld: rente ontvangen, aflossing verwerkt.'
      };
    }
    if(cat === 'crypto'){
      return {
        exchange:'Bitvavo',
        beginValue: 6000,
        endValue: 8500,
        staking: 120,
        fees: 20,
        note: 'Voorbeeld: staking en fees meegenomen.'
      };
    }
    return null;
  }

  // ---------- Calculations (demo) ----------
  function calc(cat, data){
    if(!data) return { result: 0, detail: [] };
    if(cat === 'bank'){
      const r = (data.interest || 0) - (data.fees || 0);
      return { result:r, detail:[['Rente', data.interest||0], ['Kosten', -(data.fees||0)]] };
    }
    if(cat === 'beleggingen'){
      const begin = data.beginValue||0, end = data.endValue||0;
      const dep = data.deposits||0, wit = data.withdrawals||0;
      const aanwas = (end - begin - dep + wit);
      const r = aanwas + (data.dividends||0) - (data.costs||0);
      return { result:r, detail:[['Aanwas (waarde)', aanwas], ['Dividend', data.dividends||0], ['Kosten', -(data.costs||0)]] };
    }
    if(cat === 'vastgoed'){
      // demo: use max(rent, bijtelling) - maintenance
      const base = Math.max(data.rent||0, data.bijtelling||0);
      const r = base - (data.maintenance||0);
      return { result:r, detail:[['Huur/bijtelling (demo)', base], ['Onderhoud', -(data.maintenance||0)]] };
    }
    if(cat === 'leningen'){
      const r = (data.interestReceived||0) - (data.interestPaid||0);
      return { result:r, detail:[['Rente ontvangen', data.interestReceived||0], ['Rente betaald', -(data.interestPaid||0)]] };
    }
    if(cat === 'crypto'){
      const begin = data.beginValue||0, end = data.endValue||0;
      const aanwas = end - begin;
      const r = aanwas + (data.staking||0) - (data.fees||0);
      return { result:r, detail:[['Aanwas (waarde)', aanwas], ['Staking', data.staking||0], ['Fees', -(data.fees||0)]] };
    }
    return { result:0, detail:[] };
  }

  // ---------- Dashboard ----------
  function renderDashboard(){
    renderCompletion();

    // Category list
    $$('.row[data-cat]').forEach(row => {
      const cat = row.dataset.cat;
      const c = state.categories[cat];
      const pill = row.querySelector('[data-status]');
      if(pill){
        pill.classList.remove('ok','warn','todo');
        pill.classList.add(c.status);
        pill.querySelector('.label').textContent =
          c.status === 'ok' ? 'In orde' : (c.status === 'warn' ? 'Controle' : 'Nog nodig');
      }
      const fileCount = row.querySelector('[data-files]');
      if(fileCount){
        fileCount.textContent = String(c.files.length || 0);
      }
    });

    // Attention list
    const attention = $('#attentionList');
    if(attention){
      const items = Object.entries(state.categories)
        .filter(([k,v]) => v.status !== 'ok')
        .sort((a,b) => (a[1].status === 'todo' ? -1 : 1) - (b[1].status === 'todo' ? -1 : 1))
        .slice(0, 3);

      attention.innerHTML = '';
      if(items.length === 0){
        attention.innerHTML = `<div style="color: rgba(11,15,25,.58); font-size:13px;">Alles ziet er goed uit. Je kunt exporteren.</div>`;
      }else{
        items.forEach(([k,v]) => {
          const m = CAT_META[k];
          const div = document.createElement('div');
          div.className = 'row';
          div.style.padding = '10px 0';
          div.innerHTML = `
            <div class="left">
              <div class="ico" aria-hidden="true">${m.icon}</div>
              <div class="title">
                <strong>${escapeHtml(m.label)}</strong>
                <span>${v.status === 'todo' ? 'Nog gegevens nodig' : 'Controleer de gevonden waarden'}</span>
              </div>
            </div>
            <a class="btn btnGhost btnSmall" href="${m.page}">Open</a>
          `;
          attention.appendChild(div);
        });
      }
    }

    // Export availability (demo)
    const exportBtn = $('#copyBtn');
    const exportText = $('#copyText');
    const exportHint = $('#exportHint');
    const copyMsg = $('#copyMsg');

    const pct = computePct();
    const hasFiles = Object.values(state.categories).some(c => (c.files||[]).length > 0);
    const ready = pct >= 80 && hasFiles;

    if(exportBtn){
      exportBtn.disabled = !ready;
      exportBtn.style.opacity = ready ? '1' : '.45';
      exportBtn.style.cursor = ready ? 'pointer' : 'not-allowed';
    }
    if(exportHint){
      exportHint.textContent = ready
        ? 'Kopieer de waarden en plak ze in je aangifte.'
        : 'Export komt beschikbaar zodra je uploads compleet zijn en de checklist is nagelopen.';
    }
    if(exportText){
      // Compose a simple demo export including per-category result
      const lines = [`Jaar: ${state.year}`, ``];
      for(const [k,v] of Object.entries(state.categories)){
        const m = CAT_META[k];
        const r = calc(k, v.data).result;
        lines.push(`${m.label}: ${v.data ? fmtEUR(r) : '—'}`);
      }
      lines.push('', 'Resultaat box 3 (demo): …', 'Opmerking: demo-export. In productie vul je dit met berekende waarden.');
      exportText.value = ready ? lines.join('\n') : 'Nog niet beschikbaar.';
    }
    if(copyMsg) copyMsg.textContent = '';
  }

  // copy button
  $('#copyBtn')?.addEventListener('click', async () => {
    const t = $('#copyText');
    const msg = $('#copyMsg');
    const btn = $('#copyBtn');
    if(!t || !btn || btn.disabled) return;
    try{
      await navigator.clipboard.writeText(t.value);
      if(msg){
        msg.textContent = 'Gekopieerd.';
        setTimeout(() => (msg.textContent = ''), 1400);
      }
    }catch(e){
      if(msg) msg.textContent = 'Kopiëren lukt niet. Selecteer de tekst handmatig.';
    }
  });

  // ---------- Category page ----------
  function renderFiles(listEl, files){
    listEl.innerHTML = '';
    if(!files || files.length === 0){
      const li = document.createElement('li');
      li.style.border = '0';
      li.style.background = 'transparent';
      li.style.padding = '8px 2px';
      li.style.color = 'rgba(11,15,25,.55)';
      li.textContent = 'Nog geen bestanden toegevoegd.';
      listEl.appendChild(li);
      return;
    }
    files.forEach((f, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${escapeHtml(f.name)} <span style="opacity:.6">(${formatBytes(f.size)})</span></span>
        <button type="button" data-idx="${idx}">Verwijder</button>
      `;
      li.querySelector('button').addEventListener('click', () => {
        files.splice(idx,1);
        save(state);
        renderCategory();
      });
      listEl.appendChild(li);
    });
  }

  function formatBytes(bytes){
    if(bytes === 0) return '0 B';
    if(!bytes) return '';
    const k = 1024;
    const sizes = ['B','KB','MB','GB'];
    let i = Math.floor(Math.log(bytes) / Math.log(k));
    i = Math.min(i, sizes.length - 1);
    const v = bytes / Math.pow(k, i);
    return (i === 0 ? v : v.toFixed(1)) + ' ' + sizes[i];
  }

  function setStatusPill(el, status){
    if(!el) return;
    el.classList.remove('ok','warn','todo');
    el.classList.add(status);
    el.querySelector('.label').textContent =
      status === 'ok' ? 'In orde' : (status === 'warn' ? 'Controle' : 'Nog nodig');
  }

  function setStepper(catStatus){
    // todo -> step1, warn -> step2, ok -> step3
    const s1 = $('#step1'), s2 = $('#step2'), s3 = $('#step3');
    [s1,s2,s3].forEach(x => x?.classList.remove('active'));
    if(catStatus === 'todo'){ s1?.classList.add('active'); }
    if(catStatus === 'warn'){ s2?.classList.add('active'); }
    if(catStatus === 'ok'){ s3?.classList.add('active'); }
  }

  function bindDrop(dropEl, onFiles){
    if(!dropEl) return;
    ['dragenter','dragover'].forEach(ev => dropEl.addEventListener(ev, (e) => {
      e.preventDefault();
      dropEl.style.borderColor = 'rgba(11,15,25,.35)';
    }));
    ['dragleave','drop'].forEach(ev => dropEl.addEventListener(ev, () => {
      dropEl.style.borderColor = 'rgba(11,15,25,.22)';
    }));
    dropEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files || []).map(f => ({ name:f.name, size:f.size }));
      onFiles(files);
    });
  }

  function renderCategory(){
    renderCompletion();
    const cat = document.body.dataset.category;
    if(!cat) return;

    const catState = state.categories[cat];
    const meta = CAT_META[cat];

    // status pill + stepper
    setStatusPill($('#catStatus'), catState.status);
    setStepper(catState.status);

    // breadcrumbs title
    const h1 = $('#pageTitle');
    if(h1) h1.textContent = meta.label;

    // files
    const list = $('#fileList');
    if(list) renderFiles(list, catState.files);

    // form enable/disable hint
    const needUpload = $('#needUpload');
    const form = $('#catForm');
    const hasUpload = (catState.files && catState.files.length > 0);
    if(needUpload) needUpload.style.display = hasUpload ? 'none' : 'block';
    if(form) form.style.opacity = hasUpload ? '1' : '.55';

    // fill form fields depending on category
    const data = catState.data;
    if(cat === 'bank'){
      setVal('bankName', data?.bank ?? '');
      setVal('iban', data?.iban ?? '');
      setVal('begin', data?.begin ?? '');
      setVal('end', data?.end ?? '');
      setVal('interest', data?.interest ?? '');
      setVal('fees', data?.fees ?? '');
      setVal('note', data?.note ?? '');
    }
    if(cat === 'beleggingen'){
      setVal('broker', data?.broker ?? '');
      setVal('beginValue', data?.beginValue ?? '');
      setVal('endValue', data?.endValue ?? '');
      setVal('deposits', data?.deposits ?? '');
      setVal('withdrawals', data?.withdrawals ?? '');
      setVal('dividends', data?.dividends ?? '');
      setVal('costs', data?.costs ?? '');
      setVal('note', data?.note ?? '');
    }
    if(cat === 'vastgoed'){
      setVal('address', data?.address ?? '');
      setVal('woz', data?.woz ?? '');
      setVal('useType', data?.useType ?? 'gemengd');
      setVal('rent', data?.rent ?? '');
      setVal('bijtelling', data?.bijtelling ?? '');
      setVal('maintenance', data?.maintenance ?? '');
      setVal('note', data?.note ?? '');
    }
    if(cat === 'leningen'){
      setVal('counterparty', data?.counterparty ?? '');
      setVal('principalBegin', data?.principalBegin ?? '');
      setVal('principalEnd', data?.principalEnd ?? '');
      setVal('interestReceived', data?.interestReceived ?? '');
      setVal('interestPaid', data?.interestPaid ?? '');
      setVal('note', data?.note ?? '');
    }
    if(cat === 'crypto'){
      setVal('exchange', data?.exchange ?? '');
      setVal('beginValue', data?.beginValue ?? '');
      setVal('endValue', data?.endValue ?? '');
      setVal('staking', data?.staking ?? '');
      setVal('fees', data?.fees ?? '');
      setVal('note', data?.note ?? '');
    }

    // summary KPI
    const summary = $('#summary');
    if(summary){
      const c = calc(cat, catState.data);
      summary.querySelector('[data-res]').textContent = catState.data ? fmtEUR(c.result) : '—';
      summary.querySelector('[data-st]').textContent =
        catState.status === 'ok' ? 'In orde' : (catState.status === 'warn' ? 'Controle' : 'Nog nodig');
      summary.querySelector('[data-files]').textContent = String(catState.files.length || 0);

      // detail list (minimal)
      const d = summary.querySelector('[data-detail]');
      if(d){
        d.innerHTML = '';
        if(catState.data){
          c.detail.forEach(([label,val]) => {
            const div = document.createElement('div');
            div.className = 'kpi';
            div.innerHTML = `<span>${escapeHtml(label)}</span><strong>${fmtEUR(val)}</strong>`;
            d.appendChild(div);
          });
        }else{
          d.innerHTML = `<div class="kpi"><span>Details</span><strong>—</strong></div>`;
        }
      }
    }

    // update details section with file names
    const sources = $('#sources');
    if(sources){
      const ul = sources.querySelector('ul');
      if(ul){
        ul.innerHTML = '';
        (catState.files || []).forEach(f => {
          const li = document.createElement('li');
          li.textContent = f.name;
          ul.appendChild(li);
        });
        if((catState.files||[]).length === 0){
          const li = document.createElement('li');
          li.textContent = 'Nog geen uploads.';
          ul.appendChild(li);
        }
      }
    }
  }

  function setVal(id, v){
    const el = document.getElementById(id);
    if(!el) return;
    el.value = String(v);
  }

  function bindCategory(){
    const cat = document.body.dataset.category;
    if(!cat) return;
    const catState = state.categories[cat];

    // file input / picker / drop
    const fileInput = $('#fileInput');
    const filePick = $('#filePick');
    const drop = $('#drop');

    filePick?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []).map(f => ({ name:f.name, size:f.size }));
      if(files.length){
        catState.files.push(...files);
        // set example-ish data if empty, else keep
        if(!catState.data) catState.data = example(cat);
        catState.status = 'warn';
        save(state);
        showToast('Bestanden toegevoegd.');
        renderCategory();
      }
      fileInput.value = '';
    });

    bindDrop(drop, (files) => {
      if(files.length){
        catState.files.push(...files);
        if(!catState.data) catState.data = example(cat);
        catState.status = 'warn';
        save(state);
        showToast('Bestanden toegevoegd.');
        renderCategory();
      }
    });

    // Example button
    $('#exampleBtn')?.addEventListener('click', () => {
      if(catState.files.length === 0){
        catState.files.push({ name:`voorbeeld-${cat}-${state.year}.pdf`, size: 240000 });
      }
      catState.data = example(cat);
      catState.status = 'warn';
      save(state);
      showToast('Voorbeeld geladen.');
      renderCategory();
    });

    // Special: vastgoed demo WOZ fetch
    $('#wozBtn')?.addEventListener('click', () => {
      const cur = catState.data || example(cat);
      // If address filled, keep it
      const addr = $('#address')?.value?.trim();
      cur.address = addr || cur.address;
      cur.woz = cur.woz || 425000;
      cur.bijtelling = cur.bijtelling || 14238;
      catState.data = cur;
      catState.status = 'warn';
      save(state);
      showToast('WOZ (demo) opgehaald.');
      renderCategory();
    });

    // Save button (mark ok)
    $('#saveBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      // if no upload, keep todo
      if(catState.files.length === 0){
        showToast('Upload eerst een bestand.');
        return;
      }

      const data = {};
      if(cat === 'bank'){
        data.bank = $('#bankName')?.value?.trim() || '';
        data.iban = $('#iban')?.value?.trim() || '';
        data.begin = parseMoney($('#begin')?.value);
        data.end = parseMoney($('#end')?.value);
        data.interest = parseMoney($('#interest')?.value);
        data.fees = parseMoney($('#fees')?.value);
        data.note = $('#note')?.value?.trim() || '';
      }
      if(cat === 'beleggingen'){
        data.broker = $('#broker')?.value?.trim() || '';
        data.beginValue = parseMoney($('#beginValue')?.value);
        data.endValue = parseMoney($('#endValue')?.value);
        data.deposits = parseMoney($('#deposits')?.value);
        data.withdrawals = parseMoney($('#withdrawals')?.value);
        data.dividends = parseMoney($('#dividends')?.value);
        data.costs = parseMoney($('#costs')?.value);
        data.note = $('#note')?.value?.trim() || '';
      }
      if(cat === 'vastgoed'){
        data.address = $('#address')?.value?.trim() || '';
        data.woz = parseMoney($('#woz')?.value);
        data.useType = $('#useType')?.value || 'gemengd';
        data.rent = parseMoney($('#rent')?.value);
        data.bijtelling = parseMoney($('#bijtelling')?.value);
        data.maintenance = parseMoney($('#maintenance')?.value);
        data.note = $('#note')?.value?.trim() || '';
      }
      if(cat === 'leningen'){
        data.counterparty = $('#counterparty')?.value?.trim() || '';
        data.principalBegin = parseMoney($('#principalBegin')?.value);
        data.principalEnd = parseMoney($('#principalEnd')?.value);
        data.interestReceived = parseMoney($('#interestReceived')?.value);
        data.interestPaid = parseMoney($('#interestPaid')?.value);
        data.note = $('#note')?.value?.trim() || '';
      }
      if(cat === 'crypto'){
        data.exchange = $('#exchange')?.value?.trim() || '';
        data.beginValue = parseMoney($('#beginValue')?.value);
        data.endValue = parseMoney($('#endValue')?.value);
        data.staking = parseMoney($('#staking')?.value);
        data.fees = parseMoney($('#fees')?.value);
        data.note = $('#note')?.value?.trim() || '';
      }

      catState.data = data;
      catState.status = 'ok';
      save(state);
      showToast('Opgeslagen.');
      renderCategory();
    });

    // Mark as "later" (todo)
    $('#laterBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      catState.status = 'todo';
      save(state);
      showToast('Gemarkeerd als later.');
      renderCategory();
    });
  }

  // ---------- Init by page ----------
  const page = document.body.dataset.page;

  if(page === 'dashboard'){
    renderDashboard();
  }
  if(page === 'category'){
    bindCategory();
    renderCategory();
  } else {
    // still render completion if present on other pages
    renderCompletion();
  }
})();