/* Conceito Pet Store · reservas (Supabase quando configurado; senão, WhatsApp) */
(() => {
  const C = window.CONCEITO || {};
  const $ = (s, el = document) => el.querySelector(s);
  const form = $('#book-form'); if (!form) return;
  const hasDB = !!(C.supabaseUrl && C.supabaseAnonKey);
  const msg = $('#form-msg');
  const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  let S = { slots: C.horariosPadrao || [], capacity: 1, closed: C.diasFechados || [0], ahead: C.diasAFrente || 21 };
  let avail = {};           // "yyyy-mm-dd|HH:MM" -> {full, blocked}
  let sb = null, sbLoading = null;

  if (!hasDB) $('#book-submit').innerHTML = '<svg aria-hidden="true" style="width:22px;height:22px" fill="currentColor"><use href="#i-wa"/></svg>Enviar reserva pelo WhatsApp';

  /* ---------- opções ---------- */
  const radio = (box, name, value, label, extra = {}) => {
    const l = document.createElement('label'); l.className = 'opt';
    const i = document.createElement('input'); i.type = 'radio'; i.name = name; i.value = value;
    Object.assign(i, extra);
    const s = document.createElement('span'); s.innerHTML = label;
    l.append(i, s); box.append(l); return i;
  };
  (C.servicos || []).forEach((v, k) => radio($('#opt-service'), 'service', v, v, { checked: k === 0 }));
  (C.portes || []).forEach(v => radio($('#opt-size'), 'size', v, v));

  function renderDays() {
    const box = $('#opt-day'); box.innerHTML = '';
    const d = new Date(); d.setHours(12, 0, 0, 0);
    let first = null;
    for (let i = 0; i <= S.ahead; i++) {
      const day = new Date(d); day.setDate(d.getDate() + i);
      const closed = S.closed.includes(day.getDay());
      const label = `${i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DOW[day.getDay()]}<b>${day.getDate()}</b>${MON[day.getMonth()]}`;
      const inp = radio(box, 'day', iso(day), label, { disabled: closed });
      if (closed) inp.closest('.opt').title = 'Fechado';
      if (!closed && !first && dayHasFree(iso(day))) first = inp;
    }
    if (first) { first.checked = true; renderSlots(first.value); }
  }
  function dayHasFree(day) {
    const today = iso(new Date()) === day;
    return S.slots.some(s => !(today && s <= nowHM()) && !(avail[day + '|' + s] || {}).full && !(avail[day + '|' + s] || {}).blocked);
  }
  function renderSlots(day) {
    const box = $('#opt-slot'), keep = (form.slot && form.slot.value) || '';
    box.innerHTML = '';
    const today = iso(new Date()) === day;
    let anyTaken = false, anyFree = false;
    S.slots.forEach(s => {
      const a = avail[day + '|' + s] || {};
      const gone = (today && s <= nowHM()) || a.full || a.blocked;
      if (a.full || a.blocked) anyTaken = true; if (!gone) anyFree = true;
      radio(box, 'slot', s, s, { disabled: gone, checked: !gone && s === keep });
    });
    $('#slot-hint').textContent = !anyFree ? 'Esse dia está cheio. Escolha outro dia.' : anyTaken ? 'Os horários riscados já estão ocupados.' : (hasDB ? '' : 'A loja confirma o horário pelo WhatsApp.');
  }
  $('#opt-day').addEventListener('change', e => { if (e.target.name === 'day') renderSlots(e.target.value); });

  /* ---------- leva e traz ---------- */
  const pick = $('#f-pickup');
  pick.addEventListener('change', () => { $('#addr-box').classList.toggle('show', pick.checked); if (pick.checked) $('#f-addr').focus(); });

  /* ---------- máscara de telefone ---------- */
  const ph = $('#f-phone');
  ph.addEventListener('input', () => {
    let d = ph.value.replace(/\D/g, '').slice(0, 11);
    if (d.length > 6) ph.value = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    else if (d.length > 2) ph.value = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    else ph.value = d;
  });

  /* ---------- Supabase (carrega só quando precisa) ---------- */
  function loadSB() {
    if (!hasDB) return Promise.resolve(null);
    if (sb) return Promise.resolve(sb);
    if (sbLoading) return sbLoading;
    sbLoading = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = '/assets/js/supabase.js'; s.async = true;
      s.onload = () => { sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: false } }); res(sb); };
      s.onerror = rej; document.head.append(s);
    });
    return sbLoading;
  }
  async function refresh() {
    if (!hasDB) { renderDays(); return; }
    try {
      const c = await loadSB();
      const { data: st } = await c.from('settings').select('*').eq('id', 1).maybeSingle();
      if (st) S = { slots: st.slots, capacity: st.capacity, closed: st.closed_dow, ahead: st.days_ahead };
      const from = new Date(), to = new Date(); to.setDate(to.getDate() + S.ahead);
      const { data, error } = await c.rpc('availability', { d_from: iso(from), d_to: iso(to) });
      if (error) throw error;
      avail = {}; (data || []).forEach(r => { avail[r.day + '|' + r.slot] = { full: r.taken >= r.capacity, blocked: r.blocked }; });
    } catch (e) { console.warn('Reservas: sem conexão com o banco, usando horários padrão.', e); }
    const keepDay = form.day && form.day.value;
    renderDays();
    if (keepDay) { const i = form.querySelector(`input[name=day][value="${keepDay}"]`); if (i && !i.disabled) { i.checked = true; renderSlots(keepDay); } }
  }
  renderDays();
  const near = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { near.disconnect(); refresh(); } }, { rootMargin: '600px 0px' });
  near.observe(form);

  /* ---------- envio ---------- */
  const ERR = {
    data_invalida: 'Escolha uma data dentro dos próximos dias.',
    dia_fechado: 'A loja não abre nesse dia. Escolha outro.',
    horario_invalido: 'Escolha um dos horários da lista.',
    horario_passou: 'Esse horário já passou. Escolha outro.',
    horario_bloqueado: 'Esse horário foi fechado pela loja. Escolha outro.',
    horario_lotado: 'Alguém acabou de pegar esse horário. Escolha outro.',
    telefone_invalido: 'Confira o número do WhatsApp com DDD.',
    dados_faltando: 'Preencha o nome do pet e o seu nome.',
    endereco_faltando: 'Coloque o endereço para a gente buscar o pet.',
    limite_telefone: 'Esse número já tem reservas demais nesse dia. Chame a gente no WhatsApp.'
  };
  const fail = (t, el) => { msg.className = 'form-msg err'; msg.textContent = t; if (el) el.focus(); };

  form.addEventListener('submit', async e => {
    e.preventDefault(); msg.textContent = '';
    const f = new FormData(form);
    if (f.get('website')) return;
    const v = k => (f.get(k) || '').toString().trim();
    if (!v('service')) return fail('Escolha o serviço.', form.querySelector('[name=service]'));
    if (!v('pet')) return fail('Qual o nome do pet?', $('#f-pet'));
    if (!v('size')) return fail('Escolha o porte do pet.', form.querySelector('[name=size]'));
    if (!v('day')) return fail('Escolha o dia.', form.querySelector('[name=day]:not(:disabled)'));
    if (!v('slot')) return fail('Escolha o horário.', form.querySelector('[name=slot]:not(:disabled)'));
    if (pick.checked && v('address').length < 6) return fail(ERR.endereco_faltando, $('#f-addr'));
    if (!v('name')) return fail('Qual o seu nome?', $('#f-name'));
    const digits = v('phone').replace(/\D/g, '');
    if (digits.length < 10) return fail(ERR.telefone_invalido, ph);

    const [y, m, d] = v('day').split('-');
    const dataBR = `${d}/${m}`;
    const lines = (code) => [
      `Oi! Quero reservar pelo site${code ? ` (código ${code})` : ''}:`,
      `• Serviço: ${v('service')}`,
      `• Pet: ${v('pet')}${v('breed') ? ` (${v('breed')})` : ''}, porte ${v('size').toLowerCase()}`,
      `• Dia: ${dataBR} às ${v('slot')}`,
      `• Leva e traz: ${pick.checked ? 'sim, ' + v('address') : 'não'}`,
      `• Tutor: ${v('name')}`,
      v('notes') ? `• Recado: ${v('notes')}` : ''
    ].filter(Boolean).join('\n');

    const btn = $('#book-submit'); btn.disabled = true; const old = btn.innerHTML; btn.textContent = 'Reservando...';
    try {
      if (!hasDB) { showDone(null, lines(null), dataBR, v('slot')); window.open(window.CPS_waUrl(lines(null)), '_blank', 'noopener'); return; }
      const c = await loadSB();
      const { data, error } = await c.rpc('book', {
        p_day: v('day'), p_slot: v('slot'), p_service: v('service'), p_pet_name: v('pet'), p_pet_size: v('size'),
        p_breed: v('breed'), p_owner_name: v('name'), p_phone: digits, p_pickup: pick.checked,
        p_address: pick.checked ? v('address') : '', p_notes: v('notes')
      });
      if (error) {
        const key = Object.keys(ERR).find(k => (error.message || '').includes(k));
        if (key === 'horario_lotado' || key === 'horario_bloqueado') refresh();
        throw new Error(key ? ERR[key] : 'Não deu para reservar agora. Tente de novo ou chame no WhatsApp.');
      }
      showDone(data, lines(data), dataBR, v('slot'));
    } catch (err) { fail(err.message || 'Não deu para reservar agora. Tente de novo ou chame no WhatsApp.'); }
    finally { btn.disabled = false; if (document.body.contains(btn)) btn.innerHTML = old; }
  });

  function showDone(code, text, dia, hora) {
    const card = $('#book-card');
    card.innerHTML = '';
    const box = document.createElement('div'); box.className = 'done';
    box.innerHTML = code
      ? `<svg viewBox="0 0 64 64" width="64" height="64" fill="#F5A300" style="margin:0 auto" aria-hidden="true"><use href="#i-paw"/></svg>
         <h3>Horário reservado!</h3><p>${dia} às ${hora}. Seu código é</p><span class="code">${code}</span>
         <p>A loja confirma pelo WhatsApp. Se quiser adiantar, mande a mensagem agora.</p>
         <div class="btn-row"><a class="btn btn--wa" target="_blank" rel="noopener" href="${window.CPS_waUrl(text)}"><svg aria-hidden="true"><use href="#i-wa"/></svg>Avisar no WhatsApp</a></div>`
      : `<svg viewBox="0 0 64 64" width="64" height="64" fill="#F5A300" style="margin:0 auto" aria-hidden="true"><use href="#i-paw"/></svg>
         <h3>Quase lá!</h3><p>Abrimos o WhatsApp com a sua reserva para ${dia} às ${hora}. É só enviar a mensagem.</p>
         <div class="btn-row"><a class="btn btn--wa" target="_blank" rel="noopener" href="${window.CPS_waUrl(text)}"><svg aria-hidden="true"><use href="#i-wa"/></svg>Abrir o WhatsApp de novo</a></div>`;
    card.append(box);
    box.setAttribute('tabindex', '-1'); box.focus();
  }
})();
