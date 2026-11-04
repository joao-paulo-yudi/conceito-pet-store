/* Conceito Pet Store · movimento e interações (sem bibliotecas) */
(() => {
  const C = window.CONCEITO || {};
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const still = () => root.classList.contains('still');
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- WhatsApp e dados da loja ---------- */
  const waUrl = (msg) => `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg || 'Oi! Vim pelo site.')}`;
  window.CPS_waUrl = waUrl;
  $$('.js-wa').forEach(a => { a.href = waUrl(a.dataset.msg); a.target = '_blank'; a.rel = 'noopener'; });

  const social = C.instagram || C.facebook;
  $$('.js-social').forEach(a => { if (social) { a.href = social; a.textContent = C.instagram ? 'Ver mais no Instagram' : 'Ver mais no Facebook'; } else a.remove(); });

  const addr = $('.js-address');
  if (addr) {
    if (C.endereco) {
      addr.textContent = C.endereco + (C.cidade ? `, ${C.cidade}` : '');
      if (C.mapa) { const a = document.createElement('a'); a.href = C.mapa; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Abrir no mapa'; a.style.display = 'block'; a.style.marginTop = '6px'; addr.append(a); }
    } else addr.textContent = `Pet shop em ${C.cidade || 'Votorantim, SP'}. Chame no WhatsApp e mandamos a localização.`;
  }
  const phones = $('.js-phones');
  if (phones) (C.telefones || []).forEach(t => {
    const li = document.createElement('li'); const a = document.createElement('a');
    a.href = 'tel:+55' + t.replace(/\D/g, ''); a.textContent = t; li.append(a); phones.append(li);
  });
  const socials = $('.js-socials');
  if (socials) [['Instagram', C.instagram, 'i-ig'], ['Facebook', C.facebook, 'i-fb']].forEach(([n, u, ic]) => {
    if (!u) return;
    const li = document.createElement('li');
    li.innerHTML = `<a href="${u}" target="_blank" rel="noopener" style="display:inline-flex;gap:8px;align-items:center"><svg width="18" height="18" aria-hidden="true"><use href="#${ic}"/></svg>${n}</a>`;
    socials.append(li);
  });
  const hours = $('.js-hours');
  if (hours) {
    if (C.horarios && C.horarios.length) C.horarios.forEach(([d, h]) => { const li = document.createElement('li'); li.innerHTML = `<span>${d}</span> <b>${h}</b>`; hours.append(li); });
    else { const li = document.createElement('li'); li.textContent = 'Consulte pelo WhatsApp.'; hours.append(li); }
  }

  /* ---------- botão flutuante some perto da reserva e do rodapé ---------- */
  const hideFor = new Set();
  const fio = new IntersectionObserver(es => {
    es.forEach(e => e.isIntersecting ? hideFor.add(e.target) : hideFor.delete(e.target));
    document.body.classList.toggle('no-float', hideFor.size > 0);
  }, { rootMargin: '0px 0px 0px 0px' });
  ['#book-card', '#contato'].forEach(s => { const el = $(s); el && fio.observe(el); });

  /* ---------- pausar animações ---------- */
  const mt = $('#motion-toggle');
  const syncToggle = () => { if (mt) mt.textContent = still() ? 'Ligar animações' : 'Pausar animações'; };
  syncToggle();
  mt && mt.addEventListener('click', () => {
    root.classList.toggle('still');
    try { localStorage.setItem('cps-still', still() ? '1' : '0'); } catch (e) {}
    if (!still()) root.classList.add('go');
    syncToggle();
  });

  /* ---------- entradas (uma vez) ---------- */
  const rio = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rise').forEach((el, i) => { el.style.transitionDelay = (el.closest('.hero') ? i * 90 : 0) + 'ms'; rio.observe(el); });

  /* ---------- hero: objetos seguem o cursor ---------- */
  const stage = $('[data-parallax-root]');
  const objs = stage ? $$('.obj', stage).map(el => ({ el, d: parseFloat(el.dataset.depth || 1), base: getComputedStyle(el).transform })) : [];
  let mx = 0, my = 0, tx = 0, ty = 0, heroRaf = 0;
  function heroLoop(t) {
    tx += (mx - tx) * 0.08; ty += (my - ty) * 0.08;
    const sy = Math.min(window.scrollY, 900);
    objs.forEach(({ el, d }, i) => {
      const f = Math.sin(t / 1600 + i * 2.1) * 6;
      el.style.translate = `${tx * d * 22}px ${ty * d * 22 + f - sy * 0.04 * d}px`;
    });
    heroRaf = (still() || window.scrollY > innerHeight * 1.2) ? 0 : requestAnimationFrame(heroLoop);
  }
  const kickHero = () => { if (!heroRaf && !still() && objs.length) heroRaf = requestAnimationFrame(heroLoop); };
  if (canHover) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; kickHero(); }, { passive: true });
  addEventListener('scroll', kickHero, { passive: true });
  kickHero();

  /* ---------- leva e traz: a van percorre a estrada com a rolagem ---------- */
  const map = $('#map'), road = $('#road-path'), done = $('#road-done'), van = $('#van');
  if (map && road && van) {
    const L = road.getTotalLength();
    done.style.strokeDasharray = L; done.style.strokeDashoffset = L;
    let last = -1;
    const draw = () => {
      const r = map.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100) return;
      let p = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .35), 0, 1);
      if (still()) p = 1;
      if (Math.abs(p - last) < 0.001) return; last = p;
      const ease = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const at = road.getPointAtLength(L * ease), ah = road.getPointAtLength(Math.min(L, L * ease + 4));
      const ang = clamp(Math.atan2(ah.y - at.y, ah.x - at.x) * 180 / Math.PI, -24, 24);
      done.style.strokeDashoffset = L * (1 - ease);
      const w = map.clientWidth, h = map.clientHeight;
      van.style.transform = `translate(${at.x / 600 * w - van.offsetWidth / 2}px, ${at.y / 500 * h - van.offsetHeight * .78}px) rotate(${ang}deg)`;
    };
    addEventListener('scroll', () => requestAnimationFrame(draw), { passive: true });
    addEventListener('resize', () => { last = -1; draw(); });
    draw(); window.CPS_drawRoad = () => { last = -1; draw(); };
  }

  /* ---------- folha de adesivos: descolam uma vez e inclinam em 3D ---------- */
  const sheet = $('[data-sheet]');
  if (sheet) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      $$('.sticker', sheet).forEach((s, i) => { s.style.animationDelay = i * 110 + 'ms'; s.classList.add('is-peel'); });
      io.disconnect();
    }), { rootMargin: '0px 0px -15% 0px' });
    if (!still()) { $$('.sticker', sheet).forEach(s => s.style.opacity = 0); io.observe(sheet); sheet.addEventListener('animationend', e => { e.target.style.opacity = ''; }); }
    if (canHover) $$('[data-lean]').forEach(s => {
      s.addEventListener('pointermove', e => {
        if (still()) return;
        const r = s.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        s.style.transform = `perspective(800px) rotate(var(--rot)) rotateX(${-y * 10}deg) rotateY(${x * 12}deg) translateZ(0)`;
        s.style.boxShadow = `${6 - x * 6}px ${6 - y * 6}px 0 #1C1410`;
      });
      s.addEventListener('pointerleave', () => { s.style.transform = ''; s.style.boxShadow = ''; });
    });
  }

  /* ---------- saíram assim: o laço cai na foto ---------- */
  const duo = $('#duo'), bowDrop = $('#drop-bow');
  if (duo && bowDrop) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.disconnect();
      if (still()) return;
      bowDrop.animate([
        { transform: 'translateY(-220px) rotate(-60deg) scale(.7)', opacity: 0 },
        { transform: 'translateY(10px) rotate(8deg) scale(1.05)', opacity: 1, offset: .62 },
        { transform: 'translateY(-14px) rotate(-4deg) scale(1)', offset: .8 },
        { transform: 'translateY(0) rotate(0) scale(1)', opacity: 1 }
      ], { duration: 1100, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
    }), { threshold: .45 });
    io.observe(duo);
  }

  /* ---------- contrato de desenvolvimento ---------- */
  const q = new URLSearchParams(location.search);
  if (q.get('motion') === 'off') root.classList.add('still');
  if (q.get('motion') === 'on') root.classList.remove('still');
  if (q.has('jump')) { scrollTo(0, +q.get('jump')); $$('.rise').forEach(e => e.classList.add('in')); }
  addEventListener('load', () => { window.__ready = true; });
})();
