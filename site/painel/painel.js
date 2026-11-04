/* Painel de reservas · Conceito Pet Store */
(() => {
  const C = window.CONCEITO || {};
  const $ = s => document.querySelector(s);
  const show = id => ['setup', 'login', 'app'].forEach(k => { $('#' + k).hidden = k !== id; });
  if (!C.supabaseUrl || !C.supabaseAnonKey) { show('setup'); return; }
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const br = s => { const [y, m, d] = s.split('-'); return `${d}/${m}`; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DOWS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const LABEL = { pendente: 'Pendente', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' };
  let settings = null, day = iso(new Date());

  /* ---------- login ---------- */
  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return show('login');
    const { data: adm } = await sb.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (!adm) { $('#login-msg').className = 'msg err'; $('#login-msg').textContent = 'Este usuário não é administrador. Veja o passo 4 do LEIA-ME.'; await sb.auth.signOut(); return show('login'); }
    $('#who').textContent = session.user.email;
    show('app'); await loadSettings(); setDay(day);
  }
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault(); const m = $('#login-msg'); m.className = 'msg'; m.textContent = 'Entrando...';
    const { error } = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
    if (error) { m.className = 'msg err'; m.textContent = 'E-mail ou senha incorretos.'; return; }
    m.textContent = ''; boot();
  });
  $('#logout').addEventListener('click', async () => { await sb.auth.signOut(); show('login'); });

  /* ---------- agenda do dia ---------- */
  function setDay(d) { day = d; $('#day').value = d; $('#b-day').value = $('#b-day').value || d; loadDay(); }
  const shift = n => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); setDay(iso(d)); };
  $('#prev').onclick = () => shift(-1); $('#next').onclick = () => shift(1); $('#today').onclick = () => setDay(iso(new Date()));
  $('#day').addEventListener('change', e => e.target.value && setDay(e.target.value));

  const waMsg = (b, kind) => {
    const pet = b.pet_name, when = `${br(b.day)} às ${b.slot}`;
    const t = {
      confirmado: `Oi, ${b.owner_name}! Aqui é da Conceito Pet Store. Confirmamos ${b.service.toLowerCase()} do(a) ${pet} em ${when}${b.pickup ? '. Vamos buscar no endereço informado.' : '.'} Até lá!`,
      cancelado: `Oi, ${b.owner_name}! Aqui é da Conceito Pet Store. Infelizmente não vamos conseguir atender o(a) ${pet} em ${when}. Podemos remarcar?`,
      pronto: `Oi, ${b.owner_name}! O(a) ${pet} já está prontinho(a) e cheiroso(a)!${b.pickup ? ' Já estamos saindo para levar.' : ' Pode vir buscar.'}`
    }[kind];
    const phone = b.phone.replace(/\D/g, ''); const full = phone.startsWith('55') ? phone : '55' + phone;
    return `https://wa.me/${full}?text=${encodeURIComponent(t)}`;
  };

  async function loadDay() {
    const list = $('#list'); list.innerHTML = '<p class="empty">Carregando...</p>';
    const [{ data: bks, error }, { data: blks }] = await Promise.all([
      sb.from('bookings').select('*').eq('day', day).order('slot').order('created_at'),
      sb.from('blocks').select('*').eq('day', day)
    ]);
    if (error) { list.innerHTML = `<p class="empty">Não deu para carregar: ${esc(error.message)}</p>`; return; }
    const slots = [...new Set([...(settings?.slots || []), ...bks.map(b => b.slot)])].sort();
    const dayBlocked = (blks || []).some(b => !b.slot);
    const active = bks.filter(b => b.status !== 'cancelado').length;
    const dw = DOWS[new Date(day + 'T12:00:00').getDay()];
    $('#count').textContent = `${dw}, ${br(day)}: ${active} ${active === 1 ? 'reserva' : 'reservas'}${dayBlocked ? ' · dia fechado' : ''}`;
    list.innerHTML = '';
    slots.forEach(s => {
      const here = bks.filter(b => b.slot === s);
      const blocked = dayBlocked || (blks || []).some(b => b.slot === s);
      const box = document.createElement('div'); box.className = 'slot';
      const n = here.filter(b => b.status !== 'cancelado').length;
      box.innerHTML = `<div class="slot-h">${s} <small>${n}/${settings?.capacity ?? '?'}</small>${blocked ? '<span class="lock">fechado</span>' : ''}</div>`;
      if (!here.length) box.insertAdjacentHTML('beforeend', '<p class="small">Livre</p>');
      here.forEach(b => box.append(card(b)));
      list.append(box);
    });
    loadPending(); loadBlocks();
  }

  function card(b) {
    const el = document.createElement('article'); el.className = 'bk st-' + b.status;
    el.innerHTML = `
      <div class="bk-top"><b>${esc(b.pet_name)} <span class="small">(${esc(b.pet_size)}${b.breed ? ', ' + esc(b.breed) : ''})</span></b><span class="pill">${LABEL[b.status]}</span></div>
      <dl>
        <dt>Serviço</dt><dd>${esc(b.service)}</dd>
        <dt>Tutor</dt><dd>${esc(b.owner_name)} · ${esc(b.phone)}</dd>
        <dt>Leva e traz</dt><dd>${b.pickup ? esc(b.address) : 'Não'}</dd>
        ${b.notes ? `<dt>Recado</dt><dd>${esc(b.notes)}</dd>` : ''}
        <dt>Código</dt><dd>${esc(b.code)}</dd>
      </dl>
      <div class="act"></div>`;
    const act = el.querySelector('.act');
    const btn = (label, cls, fn) => { const x = document.createElement('button'); x.type = 'button'; x.className = cls; x.textContent = label; x.onclick = fn; act.append(x); };
    const link = (label, cls, href) => { const a = document.createElement('a'); a.className = cls; a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = `<svg aria-hidden="true"><use href="#i-wa"/></svg>${label}`; act.append(a); };
    if (b.status === 'pendente') { btn('Confirmar', 'ok', () => setStatus(b, 'confirmado')); }
    if (b.status === 'confirmado') { btn('Concluído', 'done', () => setStatus(b, 'concluido')); link('Avisar que está pronto', '', waMsg(b, 'pronto')); }
    if (b.status === 'pendente' || b.status === 'confirmado') btn('Cancelar', 'no', () => { if (confirm(`Cancelar a reserva de ${b.pet_name}?`)) setStatus(b, 'cancelado'); });
    if (b.status === 'cancelado') btn('Reabrir', '', () => setStatus(b, 'pendente'));
    link(b.status === 'cancelado' ? 'Avisar cancelamento' : 'Mensagem de confirmação', '', waMsg(b, b.status === 'cancelado' ? 'cancelado' : 'confirmado'));
    return el;
  }

  async function setStatus(b, status) {
    const { error } = await sb.from('bookings').update({ status }).eq('id', b.id);
    if (error) return alert('Não deu para salvar: ' + error.message);
    if (status === 'confirmado' && confirm('Reserva confirmada. Abrir o WhatsApp do cliente com a mensagem de confirmação?')) window.open(waMsg({ ...b, status }, 'confirmado'), '_blank', 'noopener');
    loadDay();
  }

  async function loadPending() {
    const { data } = await sb.from('bookings').select('day,slot,pet_name,service').eq('status', 'pendente').gte('day', iso(new Date())).order('day').order('slot').limit(30);
    const ul = $('#pending'); ul.innerHTML = '';
    if (!data || !data.length) { ul.innerHTML = '<li class="small" style="cursor:default">Nenhuma reserva esperando. Tudo em dia.</li>'; return; }
    data.forEach(b => { const li = document.createElement('li'); li.innerHTML = `<b>${br(b.day)} ${b.slot}</b> · ${esc(b.pet_name)} <span class="small">(${esc(b.service)})</span>`; li.onclick = () => setDay(b.day); ul.append(li); });
  }

  /* ---------- bloqueios ---------- */
  async function loadBlocks() {
    const { data } = await sb.from('blocks').select('*').gte('day', iso(new Date())).order('day').order('slot', { nullsFirst: true });
    const ul = $('#blocks'); ul.innerHTML = '';
    (data || []).forEach(k => {
      const li = document.createElement('li');
      li.innerHTML = `<span><b>${br(k.day)}</b> ${k.slot ? k.slot : 'dia inteiro'}${k.reason ? ' · ' + esc(k.reason) : ''}</span>`;
      const x = document.createElement('button'); x.type = 'button'; x.textContent = 'Reabrir';
      x.onclick = async () => { await sb.from('blocks').delete().eq('id', k.id); loadDay(); };
      li.append(x); ul.append(li);
    });
  }
  $('#block-form').addEventListener('submit', async e => {
    e.preventDefault();
    const slot = $('#b-slot').value || null;
    const { error } = await sb.from('blocks').insert({ day: $('#b-day').value, slot, reason: $('#b-reason').value.trim() || null });
    if (error) return alert(error.code === '23505' ? 'Esse horário já está fechado.' : 'Não deu para fechar: ' + error.message);
    $('#b-reason').value = ''; loadDay();
  });

  /* ---------- configurações ---------- */
  async function loadSettings() {
    const { data } = await sb.from('settings').select('*').eq('id', 1).single();
    settings = data;
    $('#s-slots').value = data.slots.join(', '); $('#s-cap').value = data.capacity; $('#s-ahead').value = data.days_ahead;
    const box = $('#s-closed'); box.innerHTML = '';
    DOWS.forEach((d, i) => { box.insertAdjacentHTML('beforeend', `<label class="opt"><input type="checkbox" value="${i}" ${data.closed_dow.includes(i) ? 'checked' : ''}><span>${d}</span></label>`); });
    const sel = $('#b-slot'); sel.innerHTML = '<option value="">Dia inteiro</option>' + data.slots.map(s => `<option>${s}</option>`).join('');
  }
  $('#settings-form').addEventListener('submit', async e => {
    e.preventDefault(); const m = $('#settings-msg'); m.className = 'msg';
    const slots = $('#s-slots').value.split(',').map(s => s.trim()).filter(Boolean)
      .map(s => { const [h, mi = '00'] = s.replace('h', ':').split(':'); return `${pad(+h)}:${pad(+mi || 0)}`; })
      .filter(s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s));
    if (!slots.length) { m.className = 'msg err'; m.textContent = 'Coloque pelo menos um horário, ex.: 08:00, 09:00'; return; }
    const closed = [...document.querySelectorAll('#s-closed input:checked')].map(i => +i.value);
    const { error } = await sb.from('settings').update({ slots: [...new Set(slots)].sort(), capacity: +$('#s-cap').value || 1, closed_dow: closed, days_ahead: +$('#s-ahead').value || 21, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) { m.className = 'msg err'; m.textContent = 'Não deu para salvar: ' + error.message; return; }
    m.textContent = 'Agenda salva.'; await loadSettings(); loadDay();
  });

  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') show('login'); });
  boot();
})();
