'use strict';
// Lidhja me Supabase. app.js thërret api(metoda, adresa, të dhëna) dhe kjo skedë e kthen në thirrje Supabase.
const sb = supabase.createClient(window.POS_CONFIG.SUPABASE_URL, window.POS_CONFIG.SUPABASE_ANON_KEY);

/* ---------- përkthimi i rreshtave ---------- */
const mapBiz = b => b && ({ id: b.id, name: b.name, phone: b.phone, addr: b.addr, logo: b.logo, paidUntil: b.paid_until, fee: +b.fee, low: b.low, drivers: b.drivers || [], active: b.active });
const mapUser = p => p && ({ id: p.id, email: p.email, role: p.role, name: p.name, bizId: p.biz_id, canCancel: p.can_cancel, active: p.active });
const mapProd = p => ({ id: p.id, name: p.name, cat: p.cat, price: +p.price, track: p.track, stock: p.stock, img: p.img });
const mapOrder = o => ({
  id: o.id, no: o.no, date: o.created_at, type: o.type, items: (o.items || []).map(i => ({ ...i, price: +i.price })),
  sub: +o.sub, fee: +o.fee, total: +o.total, note: o.note, paid: o.paid, status: o.status,
  cname: o.cname, phone: o.phone, addr: o.addr, driver: o.driver, userName: o.user_name, cancelledBy: o.cancelled_by,
});
const mapExp = e => ({ id: e.id, date: e.date, desc: e.descr, cat: e.cat, amount: +e.amount });

function check({ data, error }) {
  if (error) {
    const m = error.message || 'Gabim';
    if (/Abonimi|Nuk keni qasje|JWT/i.test(m)) setTimeout(boot, 1500);
    throw new Error(/Invalid login/i.test(m) ? 'Email ose fjalëkalim i gabuar' : /banned/i.test(m) ? 'Llogaria është bllokuar' : m);
  }
  return data;
}
// Supabase kthen maksimum 1000 rreshta për kërkesë, prandaj i marrim me faqe
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(await build().range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

/* ---------- fotot ---------- */
const IMG_MARK = '/storage/v1/object/public/images/';
async function uploadImg(dataUrl, folder) {
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${folder}/${crypto.randomUUID()}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
  check(await sb.storage.from('images').upload(path, blob, { contentType: blob.type }));
  return sb.storage.from('images').getPublicUrl(path).data.publicUrl;
}
async function removeImg(url) {
  if (url && url.includes(IMG_MARK)) await sb.storage.from('images').remove([decodeURIComponent(url.split(IMG_MARK)[1])]).catch(() => {});
}
// img: undefined = pa ndryshim, '' = hiqe, dataURL = foto e re
async function resolveImg(img, old, folder) {
  if (img === undefined) return old || '';
  const nu = img ? await uploadImg(img, folder) : '';
  if (old) await removeImg(old);
  return nu;
}

/* ---------- hyrja ---------- */
function bizStateOf(b) {
  if (!b) return { ok: false, reason: 'Lokali nuk u gjet.' };
  if (!b.active) return { ok: false, reason: 'Llogaria e lokalit është çaktivizuar. Kontaktoni administratorin.' };
  if (b.paidUntil < ymd(new Date())) return { ok: false, reason: `Abonimi ka skaduar më ${dmy(b.paidUntil)}. Kontaktoni administratorin për vazhdim.` };
  return { ok: true };
}
async function getMe() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data: p } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (!p) return { user: { role: 'none', email: session.user.email }, biz: null, bizState: { ok: false, reason: 'Kjo llogari nuk është e lidhur me asnjë lokal. Kontaktoni administratorin.' } };
  if (!p.active) return { user: mapUser(p), biz: null, bizState: { ok: false, reason: 'Llogaria juaj është bllokuar.' } };
  if (p.role === 'super') return { user: mapUser(p), biz: null, bizState: { ok: true } };
  const { data: b } = await sb.from('businesses').select('*').eq('id', p.biz_id).maybeSingle();
  const biz = mapBiz(b);
  return { user: mapUser(p), biz, bizState: bizStateOf(biz) };
}

/* ---------- "API" ---------- */
const ROUTES = [
  ['POST', /^\/api\/login$/, async (m, b) => { check(await sb.auth.signInWithPassword({ email: b.email.trim(), password: b.password })); return { ok: true }; }],
  ['POST', /^\/api\/logout$/, async () => { await sb.auth.signOut(); return { ok: true }; }],
  ['POST', /^\/api\/password$/, async (m, b) => {
    if (String(b.new || '').length < 8) throw new Error('Fjalëkalimi i ri duhet të ketë të paktën 8 shkronja');
    const { error } = await sb.auth.signInWithPassword({ email: ME.user.email, password: b.old || '' });
    if (error) throw new Error('Fjalëkalimi aktual është gabim');
    check(await sb.auth.updateUser({ password: b.new }));
    return { ok: true };
  }],

  // Produktet
  ['GET', /^\/api\/products$/, async () => (await fetchAll(() => sb.from('products').select('*').eq('biz_id', ME.biz.id).order('name'))).map(mapProd)],
  ['POST', /^\/api\/products$/, async (m, b) => {
    const old = b.id ? check(await sb.from('products').select('img').eq('id', b.id).single()) : null;
    const row = { biz_id: ME.biz.id, name: b.name, cat: b.cat || '', price: b.price, track: !!b.track, stock: b.track ? Math.max(0, Math.floor(b.stock || 0)) : 0 };
    row.img = await resolveImg(b.img, old?.img, ME.biz.id);
    const q = b.id ? sb.from('products').update(row).eq('id', b.id) : sb.from('products').insert(row);
    return mapProd(check(await q.select().single()));
  }],
  ['POST', /^\/api\/products\/([\w-]+)\/stock$/, async (m, b, q, id) => mapProd(check(await sb.rpc('add_stock', { pid: id, n: Math.floor(b.add) })))],
  ['DELETE', /^\/api\/products\/([\w-]+)$/, async (m, b, q, id) => {
    const old = check(await sb.from('products').select('img').eq('id', id).single());
    check(await sb.from('products').delete().eq('id', id));
    await removeImg(old.img);
    return { ok: true };
  }],

  // Porositë
  ['GET', /^\/api\/orders$/, async (m, b, q) => (await fetchAll(() => sb.from('orders').select('*').eq('biz_id', ME.biz.id)
    .gte('created_at', q.get('from')).lte('created_at', q.get('to')).order('no'))).map(mapOrder)],
  ['POST', /^\/api\/orders$/, async (m, b) => mapOrder(check(await sb.rpc('create_order', { p: b })))],
  ['POST', /^\/api\/orders\/([\w-]+)\/action$/, async (m, b, q, id) => mapOrder(check(await sb.rpc('order_action', { oid: id, act: b.action, drv: b.driver ?? null })))],
  ['DELETE', /^\/api\/orders\/([\w-]+)$/, async (m, b, q, id) => { check(await sb.rpc('delete_order', { oid: id })); return { ok: true }; }],

  // Harxhimet
  ['GET', /^\/api\/expenses$/, async (m, b, q) => (await fetchAll(() => sb.from('expenses').select('*').eq('biz_id', ME.biz.id)
    .gte('date', q.get('from')).lte('date', q.get('to')).order('date'))).map(mapExp)],
  ['POST', /^\/api\/expenses$/, async (m, b) => mapExp(check(await sb.from('expenses').insert({ biz_id: ME.biz.id, date: b.date, descr: b.desc, cat: b.cat, amount: b.amount }).select().single()))],
  ['DELETE', /^\/api\/expenses\/([\w-]+)$/, async (m, b, q, id) => { check(await sb.from('expenses').delete().eq('id', id)); return { ok: true }; }],

  // Cilësimet dhe punëtorët
  ['POST', /^\/api\/settings$/, async (m, b) => mapBiz(check(await sb.rpc('update_settings', { p: b })))],
  ['GET', /^\/api\/workers$/, async () => check(await sb.from('profiles').select('*').eq('biz_id', ME.biz.id).eq('role', 'worker').order('name')).map(mapUser)],
  ['POST', /^\/api\/workers$/, async (m, b) => mapUser(check(await sb.rpc('save_user', { p: { ...b, can_cancel: !!b.canCancel } })))],
  ['DELETE', /^\/api\/workers\/([\w-]+)$/, async (m, b, q, id) => { check(await sb.rpc('delete_user', { uid: id })); return { ok: true }; }],

  // Super admin
  ['GET', /^\/api\/admin\/businesses$/, async () => check(await sb.rpc('admin_businesses')).map(x => ({ ...mapBiz(x.biz), users: x.users.map(mapUser), orders: x.orders }))],
  ['POST', /^\/api\/admin\/businesses$/, async (m, b) => {
    const row = {};
    if ('name' in b) row.name = b.name;
    if ('paidUntil' in b) row.paid_until = b.paidUntil;
    if ('active' in b) row.active = b.active;
    let biz = b.id
      ? check(await sb.from('businesses').update(row).eq('id', b.id).select().single())
      : check(await sb.from('businesses').insert(row).select().single());
    if ('logo' in b) {
      const logo = await resolveImg(b.logo, biz.logo, biz.id);
      biz = check(await sb.from('businesses').update({ logo }).eq('id', biz.id).select().single());
    }
    return mapBiz(biz);
  }],
  ['POST', /^\/api\/admin\/owners$/, async (m, b) => mapUser(check(await sb.rpc('save_user', { p: { ...b, biz_id: b.bizId } })))],
  ['DELETE', /^\/api\/admin\/users\/([\w-]+)$/, async (m, b, q, id) => { check(await sb.rpc('delete_user', { uid: id })); return { ok: true }; }],
];

async function api(method, url, body = {}) {
  const [path, qs] = url.split('?');
  for (const [m, re, fn] of ROUTES) {
    const mt = m === method && path.match(re);
    if (mt) return fn(method, body || {}, new URLSearchParams(qs || ''), mt[1]);
  }
  throw new Error('Veprim i panjohur: ' + method + ' ' + path);
}
