'use strict';
/* ============ Ndihmës ============ */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const den = n => Math.round(n || 0).toLocaleString('de-DE') + ' den';
const pad = n => String(n).padStart(2, '0');
const ymd = d => { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const hm = d => { d = new Date(d); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dmy = s => { const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}.${m}.${y}`; };
const dayStart = s => { const [y, m, d] = s.split('-'); return new Date(y, m - 1, d).toISOString(); };
const dayEnd = s => { const [y, m, d] = s.split('-'); return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString(); };
const MONTHS = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'];
const STATUS = { pritje: 'Në pritje', rruge: 'Me motor', dorezuar: 'Dorëzuar', perfunduar: 'Përfunduar', anuluar: 'Anuluar' };
const EXP_CATS = ['Përbërës / ushqim', 'Pije', 'Rroga', 'Qiraja', 'Rryma & uji', 'Karburant', 'Mirëmbajtje', 'Tjetër'];
const emoji = cat => { const c = (cat || '').toLowerCase(); return /pij|drink/.test(c) ? '🥤' : /sallat/.test(c) ? '🥗' : /ëmbël|embel|dessert|tort/.test(c) ? '🍰' : /sanduiç|burger|hamb/.test(c) ? '🍔' : '🍕'; };
const daysLeft = s => Math.round((new Date(s + 'T00:00:00') - new Date(ymd(new Date()) + 'T00:00:00')) / 864e5);
function monthRange(y, m) { const last = new Date(y, m + 1, 0).getDate(); return [`${y}-${pad(m + 1)}-01`, `${y}-${pad(m + 1)}-${pad(last)}`]; }

// api() dhe getMe() janë te backend.js (Supabase)
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

/* ============ Dritaret (modal) — në vend të alert/confirm të shfletuesit ============ */
function modal({ title, html = '', ok = 'Ruaj', okCls = '', cancel = 'Mbyll', onOk, onOpen }) {
  return new Promise(res => {
    const ov = document.createElement('div');
    ov.className = 'ov';
    ov.innerHTML = `<div class="dlg"><h3>${esc(title)}</h3><div class="mb">${html}</div><div class="err"></div>
      <div class="bt">${cancel ? `<button class="btn sec" data-x>${esc(cancel)}</button>` : ''}${ok ? `<button class="btn ${okCls}" data-ok>${esc(ok)}</button>` : ''}</div></div>`;
    $('modalRoot').append(ov);
    const close = v => { ov.remove(); res(v); };
    ov.querySelector('[data-x]')?.addEventListener('click', () => close(null));
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(null); });
    const okb = ov.querySelector('[data-ok]');
    okb?.addEventListener('click', async () => {
      if (!onOk) return close(true);
      okb.disabled = true;
      try { const r = await onOk(ov); if (r !== false) close(r === undefined ? true : r); }
      catch (e) { ov.querySelector('.err').textContent = e.message; }
      finally { okb.disabled = false; }
    });
    ov.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && okb) okb.click(); if (e.key === 'Escape') close(null); });
    onOpen && onOpen(ov);
    setTimeout(() => ov.querySelector('input:not([type=file]),select')?.focus(), 30);
  });
}
const confirmBox = (msg, ok = 'Po', cls = '') => modal({ title: 'Konfirmo', html: `<p style="margin:0">${esc(msg)}</p>`, ok, okCls: cls, cancel: 'Jo' }).then(Boolean);
const val = (ov, sel) => ov.querySelector(sel).value.trim();

/* ============ Fotot ============ */
function resizeImage(file, max, cover) {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        let { width: w, height: h } = im, sx = 0, sy = 0, sw = w, sh = h, cw, ch;
        if (cover) { const s = Math.min(w, h); sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s; cw = ch = Math.min(max, s); }
        else { const k = Math.min(1, max / Math.max(w, h)); cw = Math.round(w * k); ch = Math.round(h * k); }
        const c = document.createElement('canvas'); c.width = cw; c.height = ch;
        const g = c.getContext('2d');
        if (cover) { g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); }
        g.drawImage(im, sx, sy, sw, sh, 0, 0, cw, ch);
        ok(cover ? c.toDataURL('image/jpeg', 0.82) : c.toDataURL('image/png'));
      };
      im.onerror = () => bad(new Error('Kjo foto nuk mund të lexohet'));
      im.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
// html për zgjedhjen e fotos; state.img: undefined = pa ndryshim, '' = hequr, dataURL = e re
const imgPickHtml = (cur, ph) => `<div class="imgpick">${cur ? `<img class="pv" src="${esc(cur)}">` : `<div class="pv">${ph}</div>`}
  <div><label class="btn sec sm" style="margin:0;display:inline-block;color:var(--ink)">📷 Zgjidh foto<input type="file" accept="image/*" class="hide imgf"></label>
  <button type="button" class="btn danger sm imgdel ${cur ? '' : 'hide'}">Hiq</button><div class="muted" style="font-size:12px;margin-top:6px">JPG ose PNG</div></div></div>`;
function bindImgPick(ov, state, max, cover, ph) {
  const f = ov.querySelector('.imgf'), del = ov.querySelector('.imgdel');
  const setPv = src => { const old = ov.querySelector('.pv'); const n = document.createElement(src ? 'img' : 'div'); n.className = 'pv'; if (src) n.src = src; else n.textContent = ph; old.replaceWith(n); del.classList.toggle('hide', !src); };
  f.onchange = async () => { if (!f.files[0]) return; try { state.img = await resizeImage(f.files[0], max, cover); setPv(state.img); } catch (e) { toast(e.message); } };
  del.onclick = () => { state.img = ''; setPv(''); };
}

/* ============ Printimi 80mm ============ */
function print80(inner) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.append(f);
  const d = f.contentDocument;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>Printo</title><style>
    @page{size:80mm auto;margin:3mm}
    body{font-family:'Courier New',monospace;font-size:12px;width:72mm;margin:0;color:#000}
    .c{text-align:center}.r{display:flex;justify-content:space-between;gap:6px}.r span:last-child{white-space:nowrap;text-align:right}
    hr{border:0;border-top:1px dashed #000;margin:5px 0}h1{font-size:15px;margin:2px 0}h2{font-size:13px;margin:6px 0 2px}
    img{max-width:38mm;max-height:22mm}.big{font-size:14px;font-weight:700}
  </style></head><body>${inner}</body></html>`);
  d.close();
  const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); };
  const imgs = [...d.images];
  if (imgs.length) Promise.all(imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))).then(go); else setTimeout(go, 50);
}
const r80 = (a, b) => `<div class="r"><span>${a}</span><span>${b}</span></div>`;
function head80() {
  const b = ME.biz;
  return `<div class="c">${b.logo ? `<img src="${esc(b.logo)}"><br>` : ''}<h1>${esc(b.name)}</h1>${b.addr ? esc(b.addr) + '<br>' : ''}${b.phone ? 'Tel: ' + esc(b.phone) : ''}</div><hr>`;
}
function printReceipt(o) {
  print80(head80() + `Porosia #${o.no}<br>${dmy(ymd(o.date))} ${hm(o.date)}<br><b>${o.type === 'lokal' ? 'NË LOKAL' : 'NË ADRESË'}</b><br>Shitësi: ${esc(o.userName)}<hr>
    ${o.items.map(i => r80(`${i.qty}× ${esc(i.name)}`, den(i.price * i.qty))).join('')}
    ${o.fee ? r80('Dërgesa', den(o.fee)) : ''}<hr>
    <div class="big">${r80('TOTALI', den(o.total))}</div>${r80('Pagesa', o.paid ? 'PAGUAR' : 'PA PAGUAR')}
    ${o.type === 'adrese' ? `<hr>${o.cname ? esc(o.cname) + '<br>' : ''}${esc(o.addr)}<br>Tel: ${esc(o.phone)}${o.driver ? '<br>Motoristi: ' + esc(o.driver) : ''}` : ''}
    ${o.note ? '<hr>Shënim: ' + esc(o.note) : ''}<hr><div class="c">Faleminderit!</div>`);
}

/* ============ Instalimi si aplikacion (Chrome / Edge) ============ */
let installEvt = null;
const installBtnHtml = cls => `<button type="button" class="${cls} instBtn ${installEvt ? '' : 'hide'}">⬇ Instalo programin</button>`;
const showInstallBtns = () => document.querySelectorAll('.instBtn').forEach(b => b.classList.toggle('hide', !installEvt));
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; showInstallBtns(); });
window.addEventListener('appinstalled', () => { installEvt = null; showInstallBtns(); toast('Programi u instalua ✔'); });
document.addEventListener('click', async e => {
  if (!e.target.closest('.instBtn') || !installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null; showInstallBtns();
});

/* ============ Nisja / hyrja ============ */
let ME = null, tab = '', P = [], pollT = null;
async function boot() {
  clearInterval(pollT);
  try { ME = await getMe(); } catch { ME = null; }
  if (!ME) return showLogin();
  if (ME.user.role === 'super') { tab = 'lokalet'; return shell(); }
  if (!ME.bizState.ok) return showBlocked(ME.bizState.reason);
  tab = tab && TABS()[tab] ? tab : 'pos';
  shell();
}
async function showLogin() {
  const setup = false; // super admini krijohet me supabase/2-super-admin.sql
  $('app').innerHTML = `<div class="login"><form class="card" id="lf">
    <div class="logo">🍕</div><h1>${setup ? 'Krijo llogarinë Super Admin' : 'Hyrje'}</h1>
    <p class="muted" style="text-align:center;margin:0 0 10px">${setup ? 'Hera e parë: kjo llogari do të menaxhojë lokalet dhe abonimet.' : 'Pizzeria POS'}</p>
    <label>Email</label><input id="le" type="email" autocomplete="username" required>
    <label>Fjalëkalimi</label><input id="lp" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" required>
    ${setup ? '<label>Përsërit fjalëkalimin</label><input id="lp2" type="password" autocomplete="new-password" required>' : ''}
    <button class="btn big" style="margin-top:16px">${setup ? 'Krijo' : 'Hyr'}</button><div class="err" id="lerr"></div>
    ${installBtnHtml('btn sec big')}</form></div>`;
  $('lf').onsubmit = async e => {
    e.preventDefault();
    const email = $('le').value, password = $('lp').value;
    try {
      if (setup) {
        if (password !== $('lp2').value) throw new Error('Fjalëkalimet nuk përputhen');
        await api('POST', '/api/setup', { email, password });
      }
      await api('POST', '/api/login', { email, password });
      boot();
    } catch (x) { $('lerr').textContent = x.message; }
  };
}
function showBlocked(reason) {
  $('app').innerHTML = `<div class="login"><div class="card" style="text-align:center"><div class="logo">🔒</div><h1>Qasja është ndalur</h1>
    <p>${esc(reason)}</p><button class="btn sec" id="lo">Dil</button></div></div>`;
  $('lo').onclick = logout;
}
async function logout() { await api('POST', '/api/logout').catch(() => {}); ME = null; tab = ''; boot(); }

/* ============ Korniza ============ */
const TABS = () => {
  const r = ME.user.role;
  if (r === 'super') return { lokalet: ['Lokalet', renderSuper] };
  const t = { pos: ['Porosi e re', renderPOS], orders: ['Porositë', renderOrders] };
  if (r === 'owner') Object.assign(t, { products: ['Produktet & Stoku', renderProducts], expenses: ['Harxhimet', renderExpenses], report: ['Raporti', renderReport], workers: ['Punëtorët', renderWorkers], settings: ['Cilësimet', renderSettings] });
  return t;
};
function shell() {
  const b = ME.biz, u = ME.user, sup = u.role === 'super';
  const brand = sup ? `<div class="ph">⚙</div><b>Super Admin</b>` : `${b.logo ? `<img src="${esc(b.logo)}" alt="">` : '<div class="ph">🍕</div>'}<b>${esc(b.name)}</b>`;
  const left = !sup && u.role === 'owner' && b.paidUntil ? daysLeft(b.paidUntil) : 99;
  $('app').innerHTML = `<header><div class="brand">${brand}</div><nav id="nav">${Object.entries(TABS()).map(([k, [l]]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</nav>
    <div class="who">${esc(u.name || u.email)} · ${{ super: 'Super admin', owner: 'Pronar', worker: 'Punëtor' }[u.role]}${installBtnHtml('')}<button id="pw">🔑</button><button id="lo">Dil</button></div></header>
    <main>${left <= 7 ? `<div class="banner">⚠ Abonimi skadon më <b>${dmy(b.paidUntil)}</b> (${left <= 0 ? 'sot' : 'pas ' + left + ' ditësh'}). Kontaktoni administratorin për vazhdim.</div>` : ''}<div id="view"></div></main>`;
  $('nav').onclick = e => { const t = e.target.dataset.t; if (!t) return; tab = t; document.querySelectorAll('#nav button').forEach(x => x.classList.toggle('on', x.dataset.t === t)); go(); };
  $('lo').onclick = logout;
  $('pw').onclick = changePassword;
  go();
}
function go() { clearInterval(pollT); $('view').innerHTML = '<div class="empty">Duke ngarkuar...</div>'; TABS()[tab][1]().catch(e => { $('view').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }); }
function changePassword() {
  modal({
    title: 'Ndrysho fjalëkalimin', html: `<label>Fjalëkalimi aktual</label><input type="password" id="o1"><label>Fjalëkalimi i ri (min. 8)</label><input type="password" id="o2"><label>Përsërite</label><input type="password" id="o3">`,
    onOk: async ov => { if (val(ov, '#o2') !== val(ov, '#o3')) throw new Error('Fjalëkalimet nuk përputhen'); await api('POST', '/api/password', { old: val(ov, '#o1'), new: val(ov, '#o2') }); toast('Fjalëkalimi u ndryshua'); }
  });
}
const loadProducts = async () => { P = await api('GET', '/api/products'); P.sort((a, b) => (a.cat || '').localeCompare(b.cat || '') || a.name.localeCompare(b.name)); };
const prod = id => P.find(p => p.id === id);
const tileImg = p => p.img ? `<img class="im" src="${esc(p.img)}" alt="" loading="lazy">` : `<div class="im">${emoji(p.cat)}</div>`;

/* ============ POROSI E RE ============ */
const POS = { cart: [], type: 'lokal', cat: '', q: '', paid: true, feeTouched: false };
async function renderPOS() {
  await loadProducts();
  $('view').innerHTML = `<div class="pos"><div><div class="chips" id="cats"></div><input id="search" placeholder="Kërko produkt..." style="margin-bottom:12px" value="${esc(POS.q)}"><div class="tiles" id="grid"></div></div>
    <div class="card" style="align-self:start;position:sticky;top:12px"><h2>Porosia</h2><div id="cart"></div>
      <div class="toggle"><button id="tyL">🏠 Në lokal</button><button id="tyA">🛵 Në adresë</button></div>
      <div id="addr" class="hide"><label>Emri i klientit</label><input id="cName"><label>Telefoni *</label><input id="cPhone" type="tel" placeholder="07x xxx xxx"><label>Adresa *</label><input id="cAddr">
        <div class="row"><div><label>Motoristi</label><select id="cDrv"><option value="">— më vonë —</option>${ME.biz.drivers.map(d => `<option>${esc(d)}</option>`).join('')}</select></div><div><label>Dërgesa (den)</label><input id="cFee" type="number" min="0" value="${ME.biz.fee}"></div></div></div>
      <label>Shënim</label><input id="cNote" placeholder="p.sh. pa qepë">
      <label class="chk"><input type="checkbox" id="cPaid"> 💵 Paguar tani</label>
      <div><div class="tot"><span>Produktet</span><span id="sub"></span></div><div class="tot" id="feeRow"><span>Dërgesa</span><span id="feeV"></span></div><div class="tot g"><span>Totali</span><span id="tot"></span></div></div>
      <button class="btn big" id="finish" style="margin-top:12px">Përfundo porosinë</button><button class="btn sec" id="clr" style="width:100%;margin-top:6px">Pastro</button></div></div>`;
  POS.cart = POS.cart.filter(l => prod(l.pid));
  drawGrid(); setType(POS.type, true);
  $('cats').onclick = e => { const b = e.target.closest('.chip'); if (b) { POS.cat = b.dataset.c; drawGrid(); } };
  $('search').oninput = e => { POS.q = e.target.value; drawGrid(); };
  $('grid').onclick = e => { const b = e.target.closest('.tile'); if (b) addToCart(b.dataset.id); };
  $('cart').onclick = e => { const b = e.target.closest('button[data-i]'); if (!b) return; const l = POS.cart[b.dataset.i]; if (+b.dataset.d > 0) return addToCart(l.pid); if (--l.qty <= 0) POS.cart.splice(b.dataset.i, 1); drawCart(); };
  $('tyL').onclick = () => setType('lokal'); $('tyA').onclick = () => setType('adrese');
  $('cFee').oninput = () => { POS.feeTouched = true; drawCart(); };
  $('cPaid').onchange = e => { POS.paid = e.target.checked; };
  $('clr').onclick = resetPOS;
  $('finish').onclick = finishOrder;
}
function drawGrid() {
  const cats = [...new Set(P.map(p => p.cat || 'Të tjera'))];
  $('cats').innerHTML = ['', ...cats].map(c => `<button class="chip ${c === POS.cat ? 'on' : ''}" data-c="${esc(c)}">${c ? esc(c) : 'Të gjitha'}</button>`).join('');
  const q = POS.q.toLowerCase();
  const list = P.filter(p => (!POS.cat || (p.cat || 'Të tjera') === POS.cat) && p.name.toLowerCase().includes(q));
  $('grid').innerHTML = list.length ? list.map(p => `<button class="tile ${p.track && p.stock <= 0 ? 'out' : ''}" data-id="${p.id}">${tileImg(p)}
    ${p.track ? `<span class="stk ${p.stock <= ME.biz.low ? 'low' : ''}">${p.stock}</span>` : ''}<span class="nm">${esc(p.name)}</span><span class="pr">${den(p.price)}</span></button>`).join('')
    : `<div class="empty">${P.length ? 'Asnjë produkt' : ME.user.role === 'owner' ? 'Shto produktet te "Produktet & Stoku".' : 'Pronari nuk ka shtuar produkte ende.'}</div>`;
}
function drawCart() {
  $('cart').innerHTML = POS.cart.length ? POS.cart.map((l, i) => { const p = prod(l.pid); return `<div class="cart-line"><span class="n">${esc(p.name)}<br><small class="muted">${den(p.price)}</small></span>
    <span class="qty"><button data-i="${i}" data-d="-1">−</button><b style="min-width:22px;text-align:center">${l.qty}</b><button data-i="${i}" data-d="1">+</button></span><b style="min-width:80px;text-align:right">${den(p.price * l.qty)}</b></div>`; }).join('')
    : '<div class="empty" style="padding:16px">Kliko produktet për t\'i shtuar</div>';
  const sub = POS.cart.reduce((a, l) => a + prod(l.pid).price * l.qty, 0), fee = POS.type === 'adrese' ? (+$('cFee').value || 0) : 0;
  $('sub').textContent = den(sub); $('feeV').textContent = den(fee); $('tot').textContent = den(sub + fee);
  $('feeRow').classList.toggle('hide', POS.type !== 'adrese');
}
function addToCart(id) {
  const p = prod(id), l = POS.cart.find(x => x.pid === id), q = (l ? l.qty : 0) + 1;
  if (p.track && q > p.stock) return toast(`Nuk ka stok për "${p.name}" (ka ${p.stock})`);
  if (l) l.qty = q; else POS.cart.push({ pid: id, qty: 1 });
  drawCart();
}
function setType(t, keepPaid) {
  if (!keepPaid) POS.paid = t === 'lokal';
  POS.type = t;
  $('tyL').classList.toggle('on', t === 'lokal'); $('tyA').classList.toggle('on', t === 'adrese');
  $('addr').classList.toggle('hide', t !== 'adrese'); $('cPaid').checked = POS.paid;
  drawCart();
}
function resetPOS() { POS.cart = []; POS.feeTouched = false; ['cName', 'cPhone', 'cAddr', 'cNote'].forEach(i => $(i).value = ''); $('cDrv').value = ''; $('cFee').value = ME.biz.fee; setType('lokal'); }
async function finishOrder() {
  if (!POS.cart.length) return toast('Porosia është bosh');
  if (POS.type === 'adrese' && (!$('cPhone').value.trim() || !$('cAddr').value.trim())) return toast('Shkruaj telefonin dhe adresën');
  const btn = $('finish'); btn.disabled = true;
  try {
    const o = await api('POST', '/api/orders', {
      type: POS.type, items: POS.cart, note: $('cNote').value, paid: $('cPaid').checked,
      cname: $('cName').value, phone: $('cPhone').value, addr: $('cAddr').value, driver: $('cDrv').value, fee: +$('cFee').value || 0,
    });
    resetPOS(); await loadProducts(); drawGrid();
    const pr = await modal({ title: `Porosia #${o.no} u ruajt ✔`, html: `<p style="font-size:20px;margin:0"><b>${den(o.total)}</b> · ${o.paid ? 'Paguar' : 'Pa paguar'}</p>`, ok: '🖨 Printo faturën', cancel: 'Jo, faleminderit' });
    if (pr) printReceipt(o);
  } catch (e) { toast(e.message); } finally { btn.disabled = false; }
}

/* ============ POROSITË ============ */
const OF = { date: ymd(new Date()), type: '', status: '', paid: '' };
let ORD = [];
async function renderOrders() {
  $('view').innerHTML = `<div class="card noprint"><div class="row">
    <div><label>Data</label><input type="date" id="oDate" value="${OF.date}"></div>
    <div><label>Lloji</label><select id="oType"><option value="">Të gjitha</option><option value="lokal">Në lokal</option><option value="adrese">Në adresë</option></select></div>
    <div><label>Statusi</label><select id="oStatus"><option value="">Të gjitha</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div><label>Pagesa</label><select id="oPaid"><option value="">Të gjitha</option><option value="1">Paguar</option><option value="0">Pa paguar</option></select></div></div></div>
    <div id="oSum" class="muted" style="margin:0 0 10px 4px"></div><div class="orders" id="olist"></div>`;
  $('oType').value = OF.type; $('oStatus').value = OF.status; $('oPaid').value = OF.paid;
  [['oDate', 'date'], ['oType', 'type'], ['oStatus', 'status'], ['oPaid', 'paid']].forEach(([id, k]) => $(id).onchange = e => { OF[k] = e.target.value; loadOrders(); });
  $('olist').onclick = orderAction;
  $('olist').onchange = async e => { const s = e.target.closest('select[data-drv]'); if (!s) return; try { await api('POST', `/api/orders/${s.dataset.drv}/action`, { action: 'driver', driver: s.value }); loadOrders(); } catch (x) { toast(x.message); } };
  await loadOrders();
  pollT = setInterval(() => { if (!$('modalRoot').children.length && !document.activeElement?.closest?.('#olist')) loadOrders(); }, 20000);
}
async function loadOrders() {
  if (!OF.date) OF.date = ymd(new Date());
  ORD = await api('GET', `/api/orders?from=${encodeURIComponent(dayStart(OF.date))}&to=${encodeURIComponent(dayEnd(OF.date))}`);
  if (!$('olist')) return;
  const list = ORD.filter(o => (!OF.type || o.type === OF.type) && (!OF.status || o.status === OF.status) && (OF.paid === '' || o.paid === (OF.paid === '1'))).sort((a, b) => b.no - a.no);
  const okO = list.filter(o => o.status !== 'anuluar');
  $('oSum').textContent = `${okO.length} porosi · ${den(okO.reduce((s, o) => s + o.total, 0))} · pa paguar: ${den(okO.filter(o => !o.paid).reduce((s, o) => s + o.total, 0))}`;
  const own = ME.user.role === 'owner', canCancel = own || ME.user.canCancel;
  $('olist').innerHTML = list.length ? list.map(o => {
    const live = o.status !== 'anuluar', drivers = [...new Set([...ME.biz.drivers, o.driver].filter(Boolean))];
    return `<div class="order ${live ? '' : 'anuluar'}">
    <div class="top"><b>#${o.no} · ${hm(o.date)}</b><span><span class="badge b-${o.type}">${o.type === 'lokal' ? 'Në lokal' : 'Në adresë'}</span> <span class="badge b-${o.status}">${STATUS[o.status]}</span>
      ${live ? `<span class="badge ${o.paid ? 'b-paid' : 'b-unpaid'}">${o.paid ? '💵 Paguar' : 'Pa paguar'}</span>` : ''}</span></div>
    <div class="items">${o.items.map(i => i.qty + '× ' + esc(i.name)).join(', ')}</div>
    ${o.note ? `<div class="muted" style="font-size:13px">📝 ${esc(o.note)}</div>` : ''}
    ${o.type === 'adrese' ? `<div style="margin:8px 0;font-size:14px">${o.cname ? '<b>' + esc(o.cname) + '</b><br>' : ''}📍 ${esc(o.addr)}
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap"><span>${esc(o.phone)}</span><a class="call" href="tel:${esc(o.phone.replace(/[^\d+]/g, ''))}">📞 Thirr</a></div>
      <div style="margin-top:6px">🛵 <select data-drv="${o.id}" style="width:auto;padding:4px 8px" ${live ? '' : 'disabled'}><option value="">— pa motorist —</option>${drivers.map(x => `<option ${x === o.driver ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div></div>` : ''}
    <div style="display:flex;justify-content:space-between;align-items:end"><span class="muted" style="font-size:13px">${esc(o.userName)}${o.fee ? ' · dërgesa ' + den(o.fee) : ''}${o.cancelledBy ? '<br>Anuloi: ' + esc(o.cancelledBy) : ''}</span><b style="font-size:17px">${den(o.total)}</b></div>
    <div class="acts">
      ${live && !o.paid ? `<button class="btn ok sm" data-a="paid" data-id="${o.id}">💵 Konfirmo pagesën</button>` : ''}
      ${live && o.type === 'adrese' && o.status === 'pritje' ? `<button class="btn blue sm" data-a="rruge" data-id="${o.id}">🛵 Doli me motor</button>` : ''}
      ${live && o.type === 'adrese' && o.status !== 'dorezuar' ? `<button class="btn ok sm" data-a="dorezuar" data-id="${o.id}">✔ Dorëzuar</button>` : ''}
      <button class="btn sec sm" data-a="print" data-id="${o.id}">🖨 Fatura</button>
      ${live && canCancel ? `<button class="btn danger sm" data-a="cancel" data-id="${o.id}">Anulo</button>` : ''}
      ${own ? `<button class="btn danger sm" data-a="delete" data-id="${o.id}">🗑 Fshi</button>` : ''}
    </div></div>`;
  }).join('') : '<div class="empty">Nuk ka porosi për këtë filtër.</div>';
}
async function orderAction(e) {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const o = ORD.find(x => x.id === b.dataset.id), a = b.dataset.a;
  try {
    if (a === 'print') return printReceipt(o);
    if (a === 'paid') { if (!await confirmBox(`Konfirmo pagesën e porosisë #${o.no}: ${den(o.total)}?`, '💵 Po, u pagua', 'ok')) return; }
    if (a === 'cancel') { if (!await confirmBox(`Anulo porosinë #${o.no}? Stoku kthehet mbrapa. Porosia mbetet në listë si "Anuluar".`, 'Po, anuloje', 'danger')) return; }
    if (a === 'delete') {
      if (!await confirmBox(`Fshi përgjithmonë porosinë #${o.no} (${den(o.total)})? Nuk do të shfaqet më as në raport.`, '🗑 Po, fshije', 'danger')) return;
      await api('DELETE', `/api/orders/${o.id}`); toast('Porosia u fshi'); return loadOrders();
    }
    await api('POST', `/api/orders/${o.id}/action`, { action: a });
    toast({ paid: 'Pagesa u konfirmua', cancel: 'Porosia u anulua', rruge: 'Doli me motor', dorezuar: 'U dorëzua' }[a]);
    loadOrders();
  } catch (x) { toast(x.message); }
}

/* ============ PRODUKTET (pronari) ============ */
async function renderProducts() {
  await loadProducts();
  const low = P.filter(p => p.track && p.stock <= ME.biz.low);
  $('view').innerHTML = `${low.length ? `<div class="banner">⚠ Po mbaron stoku: ${low.map(p => `<b>${esc(p.name)}</b> (${p.stock})`).join(', ')}</div>` : ''}
    <div class="card"><h2>Produktet</h2><p class="muted" style="margin-top:-6px">Kliko një produkt për ta ndryshuar ose për t'i vënë foto.</p>
    <div class="tiles" id="pgrid"><button class="tile add" data-a="new">＋<br>Shto produkt</button>
    ${P.map(p => `<div class="tile" data-id="${p.id}">${tileImg(p)}${p.track ? `<span class="stk ${p.stock <= ME.biz.low ? 'low' : ''}">Stok: ${p.stock}</span>` : ''}
      <span class="nm">${esc(p.name)}</span><span class="pr">${den(p.price)}</span>
      <div class="tacts">${p.track ? `<button class="btn ok sm" data-a="stock" data-id="${p.id}">+ Stok</button>` : ''}<button class="btn sec sm" data-a="edit" data-id="${p.id}">Ndrysho</button></div></div>`).join('')}</div></div>`;
  $('pgrid').onclick = e => {
    const b = e.target.closest('[data-a]'), t = e.target.closest('.tile[data-id]');
    if (b?.dataset.a === 'new') return editProduct(null);
    if (b?.dataset.a === 'stock') return addStock(prod(b.dataset.id));
    if (t) editProduct(prod(t.dataset.id));
  };
}
function editProduct(p) {
  const st = {}, cats = [...new Set(P.map(x => x.cat).filter(Boolean))];
  modal({
    title: p ? 'Ndrysho produktin' : 'Produkt i ri', ok: 'Ruaj', html: `${imgPickHtml(p?.img, emoji(p?.cat))}
      <label>Emri *</label><input id="pn" value="${esc(p?.name)}" placeholder="p.sh. Pica Margarita">
      <div class="row"><div><label>Kategoria</label><input id="pc" list="pcl" value="${esc(p?.cat)}" placeholder="Pica, Pije..."><datalist id="pcl">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div><label>Çmimi (den) *</label><input id="pp" type="number" min="0" value="${p ? p.price : ''}"></div></div>
      <label class="chk"><input type="checkbox" id="pt" ${p?.track ? 'checked' : ''}> Ndiq stokun (pije, produkte të gatshme)</label>
      <div id="psw" class="${p?.track ? '' : 'hide'}"><label>Sasia në stok</label><input id="ps" type="number" min="0" value="${p ? p.stock : 0}"></div>
      ${p ? '<div style="margin-top:16px"><button type="button" class="btn danger sm" id="pdel">🗑 Fshi produktin</button></div>' : ''}`,
    onOpen: ov => {
      bindImgPick(ov, st, 500, true, emoji(p?.cat));
      ov.querySelector('#pt').onchange = e => ov.querySelector('#psw').classList.toggle('hide', !e.target.checked);
      const d = ov.querySelector('#pdel');
      if (d) d.onclick = async () => { if (await confirmBox(`Fshi "${p.name}"? Porositë e vjetra mbeten në raport.`, 'Po, fshije', 'danger')) { await api('DELETE', '/api/products/' + p.id).catch(x => toast(x.message)); ov.remove(); renderProducts(); } };
    },
    onOk: async ov => {
      if (!val(ov, '#pn') || val(ov, '#pp') === '') throw new Error('Shkruaj emrin dhe çmimin');
      await api('POST', '/api/products', { id: p?.id, name: val(ov, '#pn'), cat: val(ov, '#pc'), price: +val(ov, '#pp'), track: ov.querySelector('#pt').checked, stock: +val(ov, '#ps') || 0, img: st.img });
      toast('U ruajt'); renderProducts();
    },
  });
}
function addStock(p) {
  modal({
    title: 'Shto stok: ' + p.name, ok: 'Shto', html: `<p class="muted" style="margin:0">Tani në stok: <b>${p.stock}</b></p><label>Sa copë erdhën?</label><input id="sq" type="number" min="1" value="24">`,
    onOk: async ov => { const n = parseInt(val(ov, '#sq')); if (!(n > 0)) throw new Error('Shkruaj sasinë'); await api('POST', `/api/products/${p.id}/stock`, { add: n }); toast(`+${n} ${p.name}`); renderProducts(); },
  });
}

/* ============ HARXHIMET (pronari) ============ */
const now0 = new Date();
const EF = { y: now0.getFullYear(), m: now0.getMonth() };
const yearOpts = sel => { const y = new Date().getFullYear(); let s = ''; for (let i = y - 3; i <= y + 1; i++) s += `<option ${i === sel ? 'selected' : ''}>${i}</option>`; return s; };
const monthOpts = sel => MONTHS.map((n, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${n}</option>`).join('');
async function renderExpenses() {
  const [f, t] = monthRange(EF.y, EF.m);
  const list = (await api('GET', `/api/expenses?from=${f}&to=${t}`)).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((s, e) => s + e.amount, 0), byCat = {};
  list.forEach(e => byCat[e.cat || 'Tjetër'] = (byCat[e.cat || 'Tjetër'] || 0) + e.amount);
  $('view').innerHTML = `<div class="card"><h2>Shto harxhim</h2><div class="row">
      <div><label>Data</label><input type="date" id="ed" value="${ymd(new Date())}"></div>
      <div><label>Kategoria</label><select id="ec">${EXP_CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div style="flex:2"><label>Përshkrimi</label><input id="eds" placeholder="p.sh. Miell 50kg, djathë..."></div>
      <div><label>Shuma (den)</label><input id="ea" type="number" min="0"></div>
      <div style="flex:0"><button class="btn" id="eadd">Shto</button></div></div></div>
    <div class="card"><div class="row" style="margin-bottom:10px"><div><label>Muaji</label><select id="em">${monthOpts(EF.m)}</select></div><div><label>Viti</label><select id="ey">${yearOpts(EF.y)}</select></div><div></div></div>
      <h2>Harxhimet — ${MONTHS[EF.m]} ${EF.y}: ${den(total)}</h2>
      ${Object.keys(byCat).length ? `<div class="stats">${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="stat"><div class="l">${esc(c)}</div><div class="v" style="font-size:19px">${den(v)}</div></div>`).join('')}</div>` : ''}
      ${list.length ? `<table><thead><tr><th>Data</th><th>Kategoria</th><th>Përshkrimi</th><th class="r">Shuma</th><th></th></tr></thead><tbody>
      ${list.map(e => `<tr><td>${dmy(e.date)}</td><td>${esc(e.cat)}</td><td>${esc(e.desc)}</td><td class="r"><b>${den(e.amount)}</b></td><td class="r"><button class="btn danger sm" data-del="${e.id}">Fshi</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Nuk ka harxhime për këtë muaj.</div>'}</div>`;
  $('em').onchange = e => { EF.m = +e.target.value; renderExpenses(); };
  $('ey').onchange = e => { EF.y = +e.target.value; renderExpenses(); };
  $('eadd').onclick = async () => {
    try {
      if (!$('eds').value.trim() || $('ea').value === '') throw new Error('Shkruaj përshkrimin dhe shumën');
      await api('POST', '/api/expenses', { date: $('ed').value, cat: $('ec').value, desc: $('eds').value, amount: +$('ea').value });
      toast('Harxhimi u shtua'); renderExpenses();
    } catch (x) { toast(x.message); }
  };
  $('view').onclick = async e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const ex = list.find(x => x.id === b.dataset.del);
    if (await confirmBox(`Fshi harxhimin "${ex.desc}" (${den(ex.amount)})?`, 'Fshije', 'danger')) { await api('DELETE', '/api/expenses/' + ex.id).catch(x => toast(x.message)); renderExpenses(); }
  };
}

/* ============ RAPORTI (pronari) ============ */
const RF = { mode: 'dita', day: ymd(new Date()), y: now0.getFullYear(), m: now0.getMonth(), from: ymd(new Date()), to: ymd(new Date()) };
let REP = null;
function repRange() {
  if (RF.mode === 'dita') return [RF.day, RF.day, 'Dita ' + dmy(RF.day)];
  if (RF.mode === 'muaji') { const [f, t] = monthRange(RF.y, RF.m); return [f, t, `${MONTHS[RF.m]} ${RF.y}`]; }
  return [RF.from, RF.to, `${dmy(RF.from)} – ${dmy(RF.to)}`];
}
async function renderReport() {
  $('view').innerHTML = `<div class="card noprint"><div class="row">
    <div><label>Raporti për</label><select id="rmode"><option value="dita">Një ditë</option><option value="muaji">Një muaj</option><option value="periudha">Periudhë (nga – deri)</option></select></div>
    <div class="rm rm-dita"><label>Data</label><input type="date" id="rday" value="${RF.day}"></div>
    <div class="rm rm-muaji"><label>Muaji</label><select id="rm">${monthOpts(RF.m)}</select></div>
    <div class="rm rm-muaji"><label>Viti</label><select id="ry">${yearOpts(RF.y)}</select></div>
    <div class="rm rm-periudha"><label>Nga</label><input type="date" id="rf" value="${RF.from}"></div>
    <div class="rm rm-periudha"><label>Deri</label><input type="date" id="rt" value="${RF.to}"></div>
    <div style="flex:0;display:flex;gap:6px"><button class="btn" id="p80">🖨 Printo 80mm</button><button class="btn sec" id="pa4">🖨 A4</button></div></div></div><div id="rout"></div>`;
  $('rmode').value = RF.mode;
  const vis = () => document.querySelectorAll('.rm').forEach(x => x.classList.toggle('hide', !x.classList.contains('rm-' + RF.mode)));
  vis();
  $('rmode').onchange = e => { RF.mode = e.target.value; vis(); loadReport(); };
  $('rday').onchange = e => { RF.day = e.target.value; loadReport(); };
  $('rm').onchange = e => { RF.m = +e.target.value; loadReport(); };
  $('ry').onchange = e => { RF.y = +e.target.value; loadReport(); };
  $('rf').onchange = e => { RF.from = e.target.value; loadReport(); };
  $('rt').onchange = e => { RF.to = e.target.value; loadReport(); };
  $('p80').onclick = () => REP && print80(report80(REP));
  $('pa4').onclick = () => window.print();
  await loadProducts();
  await loadReport();
}
async function loadReport() {
  const [f, t, label] = repRange();
  if (!f || !t) return;
  const [orders, exps] = await Promise.all([
    api('GET', `/api/orders?from=${encodeURIComponent(dayStart(f))}&to=${encodeURIComponent(dayEnd(t))}`),
    api('GET', `/api/expenses?from=${f}&to=${t}`),
  ]);
  const R = REP = computeReport(orders, exps, f, t, label);
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '0%';
  const tbl = (heads, rows, empty) => rows.length ? `<table><thead><tr>${heads.map((h, i) => `<th class="${i ? 'r' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'r' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : `<div class="empty">${empty}</div>`;
  $('rout').innerHTML = `<div class="card"><h2>Raporti — ${esc(label)}</h2><div class="muted">${esc(ME.biz.name)} · printuar ${dmy(ymd(new Date()))} ${hm(new Date())}</div></div>
  <div class="stats">
    <div class="stat"><div class="l">Shitje gjithsej</div><div class="v">${den(R.sales)}</div><div class="x">${R.ok.length} porosi${R.canc.length ? ` · ${R.canc.length} të anuluara (${den(R.cancSum)})` : ''}</div></div>
    <div class="stat"><div class="l">💵 Të paguara</div><div class="v">${den(R.paid)}</div><div class="x">Pa paguar: ${den(R.sales - R.paid)}</div></div>
    <div class="stat"><div class="l">🏠 Në lokal</div><div class="v">${R.lok.length} porosi</div><div class="x">${den(R.lokSum)} · ${pct(R.lok.length, R.ok.length)}</div></div>
    <div class="stat"><div class="l">🛵 Në adresë</div><div class="v">${R.adr.length} porosi</div><div class="x">${den(R.adrSum)} · ${pct(R.adr.length, R.ok.length)}</div></div>
    <div class="stat"><div class="l">Dërgesat</div><div class="v">${R.delivered} dorëzuar</div><div class="x">${R.onRoad} me motor · ${R.waiting} në pritje · taksa ${den(R.fees)}</div></div>
    <div class="stat neg"><div class="l">Harxhimet</div><div class="v">${den(R.expTotal)}</div><div class="x">${R.exps.length} shënime</div></div>
    <div class="stat ${R.net >= 0 ? 'pos' : 'neg'}"><div class="l">Fitimi (shitje − harxhime)</div><div class="v">${den(R.net)}</div></div>
  </div>
  <div class="card"><h2>Shitja sipas produktit</h2>${tbl(['Produkti', 'Në lokal', 'Në adresë', 'Sasia', 'Denarë'], R.prods.map(r => [esc(r.name), r.l, r.a, `<b>${r.qty}</b>`, `<b>${den(r.rev)}</b>`]), 'Nuk ka shitje në këtë periudhë.')}</div>
  ${R.days.length > 1 ? `<div class="card"><h2>Sipas ditëve</h2>${tbl(['Data', 'Në lokal', 'Në adresë', 'Porosi', 'Shitje'], R.days.map(d => [dmy(d.d), d.l, d.a, d.n, `<b>${den(d.sum)}</b>`]), '')}</div>` : ''}
  <div class="card"><h2>Motoristët</h2>${tbl(['Motoristi', 'Porosi', 'Dorëzuar', 'Taksa dërgese', 'Vlera'], R.drivers.map(([k, v]) => [esc(k), v.n, v.del, den(v.fee), den(v.rev)]), 'Nuk ka dërgesa.')}</div>
  <div class="card"><h2>Sipas shitësit</h2>${tbl(['Shitësi', 'Porosi', 'Shitje'], R.sellers.map(([k, v]) => [esc(k), v.n, den(v.sum)]), 'Nuk ka shitje.')}</div>
  <div class="card"><h2>Harxhimet</h2>${tbl(['Kategoria', 'Shuma'], R.expCats.map(([k, v]) => [esc(k), den(v)]), 'Nuk ka harxhime.')}</div>
  <div class="card"><h2>Stoku tani</h2>${tbl(['Produkti', 'Në stok'], P.filter(p => p.track).map(p => [esc(p.name), `<span class="${p.stock <= ME.biz.low ? 'low' : ''}">${p.stock}</span>`]), 'Asnjë produkt me stok të ndjekur.')}</div>`;
}
function computeReport(orders, exps, f, t, label) {
  const ok = orders.filter(o => o.status !== 'anuluar'), canc = orders.filter(o => o.status === 'anuluar');
  const sum = a => a.reduce((s, o) => s + o.total, 0);
  const lok = ok.filter(o => o.type === 'lokal'), adr = ok.filter(o => o.type === 'adrese');
  const byP = {}, byD = {}, byS = {}, byDay = {}, expC = {};
  ok.forEach(o => {
    o.items.forEach(i => { const r = byP[i.pid] = byP[i.pid] || { name: i.name, qty: 0, rev: 0, l: 0, a: 0 }; r.qty += i.qty; r.rev += i.qty * i.price; r[o.type === 'lokal' ? 'l' : 'a'] += i.qty; });
    const s = byS[o.userName || '—'] = byS[o.userName || '—'] || { n: 0, sum: 0 }; s.n++; s.sum += o.total;
    const d = ymd(o.date), dd = byDay[d] = byDay[d] || { d, n: 0, l: 0, a: 0, sum: 0 }; dd.n++; dd[o.type === 'lokal' ? 'l' : 'a']++; dd.sum += o.total;
  });
  adr.forEach(o => { const k = o.driver || '— pa motorist —', r = byD[k] = byD[k] || { n: 0, del: 0, rev: 0, fee: 0 }; r.n++; if (o.status === 'dorezuar') r.del++; r.rev += o.total; r.fee += o.fee; });
  exps.forEach(e => expC[e.cat || 'Tjetër'] = (expC[e.cat || 'Tjetër'] || 0) + e.amount);
  const sales = sum(ok), expTotal = exps.reduce((s, e) => s + e.amount, 0);
  return {
    label, ok, canc, cancSum: sum(canc), lok, adr, lokSum: sum(lok), adrSum: sum(adr), sales, paid: sum(ok.filter(o => o.paid)),
    delivered: adr.filter(o => o.status === 'dorezuar').length, onRoad: adr.filter(o => o.status === 'rruge').length, waiting: adr.filter(o => o.status === 'pritje').length,
    fees: adr.reduce((s, o) => s + o.fee, 0), prods: Object.values(byP).sort((a, b) => b.rev - a.rev),
    drivers: Object.entries(byD), sellers: Object.entries(byS).sort((a, b) => b[1].sum - a[1].sum), days: Object.values(byDay).sort((a, b) => a.d.localeCompare(b.d)),
    exps, expTotal, expCats: Object.entries(expC).sort((a, b) => b[1] - a[1]), net: sales - expTotal,
  };
}
function report80(R) {
  const sec = t => `<h2>${t}</h2>`;
  return head80() + `<div class="c"><b>RAPORTI I SHITJEVE</b><br>${esc(R.label)}<br>Printuar: ${dmy(ymd(new Date()))} ${hm(new Date())}</div><hr>
    <div class="big">${r80('SHITJE', den(R.sales))}</div>${r80('Porosi', R.ok.length)}${r80('Të paguara', den(R.paid))}${r80('Pa paguar', den(R.sales - R.paid))}
    ${R.canc.length ? r80('Të anuluara', `${R.canc.length} (${den(R.cancSum)})`) : ''}<hr>
    ${r80('Në lokal', `${R.lok.length} · ${den(R.lokSum)}`)}${r80('Në adresë', `${R.adr.length} · ${den(R.adrSum)}`)}${r80(' Dorëzuar', R.delivered)}${r80(' Taksa dërgese', den(R.fees))}<hr>
    ${sec('PRODUKTET')}${R.prods.map(r => r80(`${r.qty}× ${esc(r.name)}`, den(r.rev))).join('') || 'Asnjë'}
    ${R.days.length > 1 ? '<hr>' + sec('SIPAS DITËVE') + R.days.map(d => r80(`${dmy(d.d)} (${d.n})`, den(d.sum))).join('') : ''}
    ${R.drivers.length ? '<hr>' + sec('MOTORISTËT') + R.drivers.map(([k, v]) => r80(`${esc(k)} (${v.n})`, den(v.rev))).join('') : ''}
    ${R.sellers.length ? '<hr>' + sec('SHITËSIT') + R.sellers.map(([k, v]) => r80(`${esc(k)} (${v.n})`, den(v.sum))).join('') : ''}
    <hr>${sec('HARXHIMET')}${R.expCats.map(([k, v]) => r80(esc(k), den(v))).join('') || 'Asnjë'}${r80('<b>Gjithsej</b>', `<b>${den(R.expTotal)}</b>`)}
    <hr><div class="big">${r80('FITIMI', den(R.net))}</div><hr><div class="c">— fund —</div>`;
}

/* ============ PUNËTORËT (pronari) ============ */
async function renderWorkers() {
  const W = await api('GET', '/api/workers');
  $('view').innerHTML = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">Punëtorët</h2><button class="btn" id="wadd">＋ Shto punëtor</button></div>
    <p class="muted" style="margin-top:0">Punëtorët hyjnë me emailin dhe fjalëkalimin që u cakton ti. Ata mund të bëjnë vetëm porosi (shitje). Stokun, harxhimet dhe raportet i sheh vetëm pronari.</p>
    ${W.length ? `<table><thead><tr><th>Emri</th><th>Email</th><th>Mund të anulojë</th><th>Statusi</th><th></th></tr></thead><tbody>
    ${W.map(w => `<tr><td><b>${esc(w.name)}</b></td><td>${esc(w.email)}</td><td>${w.canCancel ? 'Po' : 'Jo'}</td><td>${w.active ? '<span class="badge b-paid">Aktiv</span>' : '<span class="badge b-anuluar">Bllokuar</span>'}</td>
      <td class="r"><button class="btn sec sm" data-e="${w.id}">Ndrysho</button> <button class="btn danger sm" data-d="${w.id}">Fshi</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nuk ka punëtorë ende.</div>'}</div>`;
  $('wadd').onclick = () => userModal(null, 'worker', '/api/workers', renderWorkers);
  $('view').onclick = async e => {
    const ed = e.target.closest('[data-e]'), dl = e.target.closest('[data-d]');
    if (ed) userModal(W.find(w => w.id === ed.dataset.e), 'worker', '/api/workers', renderWorkers);
    if (dl) { const w = W.find(x => x.id === dl.dataset.d); if (await confirmBox(`Fshi punëtorin ${w.name || w.email}? Nuk do të mund të hyjë më.`, 'Fshije', 'danger')) { await api('DELETE', '/api/workers/' + w.id).catch(x => toast(x.message)); renderWorkers(); } }
  };
}
function userModal(u, role, url, after, extra = {}) {
  modal({
    title: u ? 'Ndrysho: ' + (u.name || u.email) : role === 'owner' ? 'Pronar i ri' : 'Punëtor i ri', html: `
      <label>Emri</label><input id="un" value="${esc(u?.name)}">
      <label>Email (për hyrje)</label><input id="ue" type="email" value="${esc(u?.email)}">
      <label>${u ? 'Fjalëkalim i ri (lëre bosh që të mos ndryshojë)' : 'Fjalëkalimi (min. 6)'}</label><input id="up" type="text" autocomplete="off">
      ${role === 'worker' ? `<label class="chk"><input type="checkbox" id="uc" ${u?.canCancel ? 'checked' : ''}> Mund të anulojë porosi</label>` : ''}
      <label class="chk"><input type="checkbox" id="ua" ${!u || u.active ? 'checked' : ''}> Aktiv (mund të hyjë)</label>`,
    onOk: async ov => {
      await api('POST', url, { ...extra, id: u?.id, name: val(ov, '#un'), email: val(ov, '#ue'), password: val(ov, '#up') || undefined, canCancel: ov.querySelector('#uc')?.checked, active: ov.querySelector('#ua').checked });
      toast('U ruajt'); after();
    },
  });
}

/* ============ CILËSIMET (pronari) ============ */
async function renderSettings() {
  const b = ME.biz;
  $('view').innerHTML = `<div class="card"><h2>Lokali</h2>
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:6px">${b.logo ? `<img src="${esc(b.logo)}" style="height:60px;border-radius:8px">` : ''}<span class="muted" style="font-size:13px">Logon e vendos administratori i programit.</span></div>
    <div class="row"><div><label>Emri i lokalit</label><input id="sn" value="${esc(b.name)}"></div><div><label>Telefoni</label><input id="sp" value="${esc(b.phone)}"></div><div><label>Adresa</label><input id="sa" value="${esc(b.addr)}"></div></div>
    <div class="row"><div><label>Çmimi i dërgesës (den)</label><input id="sf" type="number" min="0" value="${b.fee}"></div><div><label>Paralajmëro kur stoku bie nën</label><input id="sl" type="number" min="0" value="${b.low}"></div><div></div></div>
    <p class="muted" style="font-size:13px">Abonimi vlen deri më <b>${dmy(b.paidUntil)}</b>.</p>
    <button class="btn" id="ss">Ruaj</button></div>
    <div class="card"><h2>Motoristët</h2><div class="row"><div style="flex:3"><input id="dn" placeholder="Emri i motoristit"></div><div style="flex:0"><button class="btn" id="dadd">Shto</button></div></div><div id="dl" style="margin-top:10px"></div></div>`;
  const drv = [...b.drivers];
  const saveS = async () => { ME.biz = await api('POST', '/api/settings', { name: $('sn').value, phone: $('sp').value, addr: $('sa').value, fee: +$('sf').value || 0, low: +$('sl').value || 0, drivers: drv }); };
  const drawD = () => $('dl').innerHTML = drv.length ? drv.map((d, i) => `<div class="urow"><span>🛵 ${esc(d)}</span><button class="btn danger sm" data-i="${i}">Hiq</button></div>`).join('') : '<div class="muted">Nuk ka motoristë</div>';
  drawD();
  $('ss').onclick = async () => { try { await saveS(); toast('U ruajt'); shell(); } catch (x) { toast(x.message); } };
  $('dadd').onclick = async () => { const n = $('dn').value.trim(); if (!n) return; drv.push(n); $('dn').value = ''; await saveS().catch(x => toast(x.message)); drawD(); };
  $('dl').onclick = async e => { const x = e.target.closest('[data-i]'); if (!x) return; drv.splice(+x.dataset.i, 1); await saveS().catch(y => toast(y.message)); drawD(); };
}

/* ============ SUPER ADMIN ============ */
let BIZ = [];
function addMonths(s, n) { const base = s && s > ymd(new Date()) ? s : ymd(new Date()); const [y, m, d] = base.split('-').map(Number); const dt = new Date(y, m - 1 + n, d); return ymd(dt); }
function subBadge(b) {
  if (!b.active) return '<span class="badge b-anuluar">Çaktivizuar</span>';
  const n = daysLeft(b.paidUntil);
  if (n < 0) return `<span class="badge" style="background:#fdecea;color:var(--accent)">Skaduar ${dmy(b.paidUntil)}</span>`;
  if (n <= 7) return `<span class="badge b-unpaid">Skadon ${dmy(b.paidUntil)} (${n} ditë)</span>`;
  return `<span class="badge b-paid">Aktiv deri ${dmy(b.paidUntil)}</span>`;
}
async function renderSuper() {
  BIZ = await api('GET', '/api/admin/businesses');
  $('view').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h2 style="margin:0">Lokalet (klientët) — ${BIZ.length}</h2><button class="btn" id="bnew">＋ Lokal i ri</button></div>
    <div class="biz">${BIZ.map(b => `<div class="bizc">
      <div class="hd">${b.logo ? `<img src="${esc(b.logo)}">` : '<div class="ph">🍕</div>'}<div style="flex:1"><b style="font-size:16px">${esc(b.name)}</b><br>${subBadge(b)}<div class="muted" style="font-size:12px;margin-top:3px">${b.orders} porosi gjithsej</div></div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0"><button class="btn ok sm" data-a="m1" data-id="${b.id}">+1 muaj</button><button class="btn ok sm" data-a="m12" data-id="${b.id}">+1 vit</button><button class="btn sec sm" data-a="edit" data-id="${b.id}">Ndrysho / Logo</button></div>
      <div class="muted" style="font-size:13px;font-weight:600">Pronarët</div>
      ${b.users.filter(u => u.role === 'owner').map(u => `<div class="urow"><span>${esc(u.name || '—')}<br><small class="muted">${esc(u.email)}${u.active ? '' : ' · bllokuar'}</small></span><span><button class="btn sec sm" data-a="uedit" data-id="${b.id}" data-u="${u.id}">Ndrysho</button> <button class="btn danger sm" data-a="udel" data-id="${b.id}" data-u="${u.id}">Fshi</button></span></div>`).join('') || '<div class="muted" style="font-size:13px;padding:6px 0">Asnjë pronar</div>'}
      <button class="btn sec sm" data-a="unew" data-id="${b.id}" style="margin-top:8px">＋ Shto pronar</button>
      <div class="muted" style="font-size:12px;margin-top:8px">${b.users.filter(u => u.role === 'worker').length} punëtorë</div></div>`).join('') || '<div class="empty">Nuk ka lokale ende. Kliko "Lokal i ri".</div>'}</div>`;
  $('bnew').onclick = () => bizModal(null);
  $('view').onclick = async e => {
    const btn = e.target.closest('[data-a]'); if (!btn) return;
    const b = BIZ.find(x => x.id === btn.dataset.id), u = b?.users.find(x => x.id === btn.dataset.u), a = btn.dataset.a;
    try {
      if (a === 'm1' || a === 'm12') {
        const nd = addMonths(b.paidUntil, a === 'm1' ? 1 : 12);
        if (!await confirmBox(`Vazhdo abonimin e "${b.name}" deri më ${dmy(nd)}?`, 'Po', 'ok')) return;
        await api('POST', '/api/admin/businesses', { id: b.id, paidUntil: nd, active: true }); toast('Abonimi u vazhdua deri ' + dmy(nd)); renderSuper();
      }
      if (a === 'edit') bizModal(b);
      if (a === 'unew') userModal(null, 'owner', '/api/admin/owners', renderSuper, { bizId: b.id });
      if (a === 'uedit') userModal(u, 'owner', '/api/admin/owners', renderSuper, { bizId: b.id });
      if (a === 'udel' && await confirmBox(`Fshi pronarin ${u.email}?`, 'Fshije', 'danger')) { await api('DELETE', '/api/admin/users/' + u.id); renderSuper(); }
    } catch (x) { toast(x.message); }
  };
}
function bizModal(b) {
  const st = {};
  modal({
    title: b ? 'Ndrysho lokalin' : 'Lokal i ri', html: `<label>Logo e lokalit</label>${imgPickHtml(b?.logo, '🍕')}
      <label>Emri i lokalit</label><input id="bn" value="${esc(b?.name)}">
      <label>Abonimi i paguar deri më</label><input id="bp" type="date" value="${b?.paidUntil || addMonths('', 1)}">
      <label class="chk"><input type="checkbox" id="ba" ${!b || b.active ? 'checked' : ''}> Aktiv</label>`,
    onOpen: ov => bindImgPick(ov, st, 400, false, '🍕'),
    onOk: async ov => {
      if (!val(ov, '#bn')) throw new Error('Shkruaj emrin');
      const body = { id: b?.id, name: val(ov, '#bn'), paidUntil: val(ov, '#bp'), active: ov.querySelector('#ba').checked };
      if (st.img !== undefined) body.logo = st.img;
      const nb = await api('POST', '/api/admin/businesses', body);
      toast('U ruajt'); await renderSuper();
      if (!b) userModal(null, 'owner', '/api/admin/owners', renderSuper, { bizId: nb.id });
    },
  });
}

boot();
