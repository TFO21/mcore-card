/* M CORE — Oturum kartı çizimi (ortak). Hem uygulama hem paylaşım sayfası (share/) kullanır.
   Girdi: sade veri nesnesi (aşağıdaki pack/unpack ile QR bağlantısına sığar). Çıktı: 1200 × 675 kart.
   Bağımlılık yok; düz tarayıcı JS. */
(function (g) {
  'use strict';
  const FD = '"Barlow Semi Condensed", "Barlow", "Segoe UI", sans-serif';
  const FB = '"Barlow", "Segoe UI", sans-serif';
  const COL = { cyan: '#18D8F0', blue2: '#1F57F5', red: '#FF1E28', text: '#F2F4F8', t2: '#C9CED6', t3: '#8C95A3', dim: '#4A5262', green: '#3FE08A', amber: '#FFB020' };
  const pad = (n) => String(n).padStart(2, '0');
  const fdate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const ftime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmt = (v, dec = 0) => (v == null || !isFinite(v) ? '–' : Number(v).toLocaleString('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec }));

  /* ---------- QR bağlantısı için sıkıştırma: kısa anahtarlı JSON → base64url (UTF-8) */
  const DK = ['t60', 't100', 't200', 'q400', 'q400v', 't50100', 't80120', 't100200'];
  function pack(d) {
    const r = (x, n) => (x == null ? null : Math.round(x * Math.pow(10, n)) / Math.pow(10, n));
    const o = {
      v: 1, c: [d.car.id, d.car.name, d.car.chassis, d.car.engine, d.car.ps, d.car.file],
      s: Math.round(d.start / 60000), e: Math.round(d.end / 60000),
      d: DK.map((k) => r(d.drag[k], k === 'q400v' ? 1 : 2)), a: r(d.best100, 2),
      b: [r(d.brake['100'], 1), r(d.brake['200'], 1)], y: d.dyno ? [Math.round(d.dyno.pe), Math.round(d.dyno.tq)] : null,
      n: [d.runs, d.invalid, d.stops, d.pulls], o: d.oil == null ? null : Math.round(d.oil), t: d.amb == null ? null : Math.round(d.amb),
      k: [d.cond.tyre, d.cond.fuel, d.cond.pass, d.cond.road, d.condEdited ? 1 : 0], x: d.demo ? 1 : 0
    };
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    let bin = ''; bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unpack(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    if (o.v !== 1) throw new Error('Desteklenmeyen kart sürümü');
    const drag = {}; DK.forEach((k, i) => { if (o.d[i] != null) drag[k] = o.d[i]; });
    return {
      car: { id: o.c[0], name: o.c[1], chassis: o.c[2], engine: o.c[3], ps: o.c[4], file: o.c[5] },
      start: new Date(o.s * 60000), end: new Date(o.e * 60000), drag, best100: o.a,
      brake: { '100': o.b[0], '200': o.b[1] }, dyno: o.y ? { pe: o.y[0], tq: o.y[1] } : null,
      runs: o.n[0], invalid: o.n[1], stops: o.n[2], pulls: o.n[3], oil: o.o, amb: o.t,
      cond: { tyre: o.k[0], fuel: o.k[1], pass: o.k[2], road: o.k[3] }, condEdited: !!o.k[4], demo: !!o.x
    };
  }

  /* ---------- çizim */
  const imgs = {};
  function img(src, redraw) {
    let im = imgs[src];
    if (!im) { im = imgs[src] = new Image(); im.src = src; }
    if (!im.complete) im.addEventListener('load', redraw, { once: true });
    return im.complete && im.naturalWidth ? im : null;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function skew(ctx, x, y, w, h, s) { ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - s, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }

  /* opts.logo: logo görsel yolu · opts.carSrc: araç görsel yolu */
  function draw(canvas, d, opts) {
    const W0 = 1200, H0 = 675, k = 2;
    canvas.width = W0 * k; canvas.height = H0 * k;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const redraw = () => { if (canvas.isConnected) draw(canvas, d, opts); };
    const T = (s, x, y, font, color, align = 'left', ls = 0, shadow) => {
      ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align;
      if ('letterSpacing' in ctx) ctx.letterSpacing = ls + 'px';
      if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = 22; }
      ctx.fillText(s, x, y); ctx.shadowBlur = 0;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      return ctx.measureText(s).width;
    };

    ctx.clearRect(0, 0, W0, H0);
    rr(ctx, 0, 0, W0, H0, 28); ctx.save(); ctx.clip();
    let gr = ctx.createLinearGradient(0, 0, W0, H0); gr.addColorStop(0, '#0C1527'); gr.addColorStop(.55, '#070B13'); gr.addColorStop(1, '#05070A');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W0, H0);
    gr = ctx.createRadialGradient(330, 470, 10, 330, 470, 420); gr.addColorStop(0, 'rgba(31,87,245,.30)'); gr.addColorStop(1, 'rgba(31,87,245,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W0, H0);
    ctx.save(); ctx.globalAlpha = .9;
    [[COL.blue2, 0], [COL.red, 1]].forEach(([c, i]) => {
      const g2 = ctx.createLinearGradient(0, 0, 0, 560); g2.addColorStop(0, c); g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2; ctx.beginPath(); const x = 250 + i * 86; ctx.moveTo(x + 200, -10); ctx.lineTo(x + 262, -10); ctx.lineTo(x + 62, 560); ctx.lineTo(x, 560); ctx.closePath(); ctx.fill();
    });
    ctx.restore();

    const logo = opts.logo ? img(opts.logo, redraw) : null;
    if (logo) ctx.drawImage(logo, 44, 34, 220, 220 * logo.naturalHeight / logo.naturalWidth);
    T('OTURUM KARTI', 44, 112, `700 15px ${FB}`, COL.t3, 'left', 4);
    T(`${fdate(d.start)} · ${ftime(d.start)}–${ftime(d.end)}`, 44, 140, `italic 600 24px ${FD}`, COL.text);
    T(d.car.name, W0 - 44, 62, `700 26px ${FD}`, COL.text, 'right');
    T(`${d.car.chassis} · ${d.car.engine} · ${d.car.ps} PS`, W0 - 44, 88, `500 16px ${FB}`, COL.t3, 'right');
    if (d.demo) { ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.5; skew(ctx, W0 - 166, 104, 122, 28, 10); ctx.stroke(); T('DEMO VERİ', W0 - 105, 124, `700 13px ${FB}`, COL.amber, 'center', 2.5); }

    const t100 = d.drag.t100;
    T('EN İYİ 0–100 KM/H', 44, 206, `700 15px ${FB}`, COL.t3, 'left', 3.5);
    const hv = t100 == null ? '–' : fmt(t100, 2);
    const hw = T(hv, 38, 330, `italic 800 136px ${FD}`, t100 == null ? COL.dim : COL.cyan, 'left', 0, t100 == null ? null : 'rgba(24,216,240,.45)');
    if (t100 != null) T('s', 52 + hw, 330, `italic 600 38px ${FD}`, COL.cyan);
    gr = ctx.createRadialGradient(300, 548, 4, 300, 548, 260); gr.addColorStop(0, 'rgba(46,141,255,.55)'); gr.addColorStop(.5, 'rgba(255,30,40,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(0, 548); ctx.scale(1, .12); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(300, 0, 280, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const car = opts.carSrc ? img(opts.carSrc, redraw) : null;
    if (car) { const cw = 440, chh = cw * car.naturalHeight / car.naturalWidth; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12; ctx.drawImage(car, 80, 552 - chh, cw, chh); ctx.restore(); }

    if (t100 != null && d.best100 != null) {
      const all = Math.abs(t100 - d.best100) < 0.005;
      const lbl = all ? 'TÜM ZAMANLARIN EN İYİSİ' : `TÜM ZAMANLAR +${fmt(t100 - d.best100, 2)} s`;
      ctx.font = `700 14px ${FB}`; const lw = ctx.measureText(lbl).width + 52;
      skew(ctx, 44, 350, lw, 30, 10); ctx.fillStyle = all ? 'rgba(63,224,138,.16)' : 'rgba(255,255,255,.07)'; ctx.fill();
      ctx.strokeStyle = all ? COL.green : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.2; ctx.stroke();
      T(lbl, 44 + lw / 2, 370, `700 14px ${FB}`, all ? COL.green : COL.t2, 'center', 1.5);
    }

    const g2 = (k2) => (d.drag[k2] == null ? '–' : fmt(d.drag[k2], 2));
    const stats = [
      ['400 M', g2('q400'), 's', d.drag.q400v == null ? '' : `çıkış ${fmt(d.drag.q400v, 1)} km/h`],
      ['50–100 KM/H', g2('t50100'), 's', 'ara hızlanma'],
      ['80–120 KM/H', g2('t80120'), 's', 'ara hızlanma'],
      ['100–200 KM/H', g2('t100200'), 's', ''],
      ['100–0 FREN', d.brake['100'] == null ? '–' : fmt(d.brake['100'], 1), 'm', d.brake['200'] == null ? 'durma mesafesi' : `200–0: ${fmt(d.brake['200'], 1)} m`],
      ['SANAL DYNO', d.dyno ? fmt(d.dyno.pe) : '–', 'BG', d.dyno ? `${fmt(d.dyno.tq)} Nm · tahmini` : 'geçerli çekiş yok']
    ];
    const gx = 582, gy = 176, cw = 286, ch = 104;
    stats.forEach(([l, val, u, n], i) => {
      const x = gx + (i % 2) * (cw + 14), y = gy + Math.floor(i / 2) * (ch + 12);
      skew(ctx, x, y, cw, ch, 16);
      const tg = ctx.createLinearGradient(x, y, x, y + ch); tg.addColorStop(0, 'rgba(20,32,52,.95)'); tg.addColorStop(1, 'rgba(8,12,20,.95)');
      ctx.fillStyle = tg; ctx.fill(); ctx.strokeStyle = 'rgba(106,174,255,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = COL.cyan; ctx.save(); ctx.shadowColor = COL.cyan; ctx.shadowBlur = 8; skew(ctx, x + 22, y + 18, 5, 18, 3); ctx.fill(); ctx.restore();
      T(l, x + 36, y + 33, `700 14px ${FB}`, COL.t2, 'left', 2);
      const vw = T(val, x + 26, y + 84, `italic 700 48px ${FD}`, val === '–' ? COL.dim : COL.text);
      if (val !== '–') T(u, x + 34 + vw, y + 84, `italic 600 20px ${FD}`, COL.t2);
      if (n) T(n, x + cw - 28, y + 84, `500 13px ${FB}`, COL.t3, 'right');
    });

    let cx = 582;
    [[d.runs, 'koşu'], [d.invalid, 'geçersiz'], [d.stops, 'duruş'], [d.pulls, 'çekiş']].forEach(([nn, l]) => {
      const w = T(String(nn), cx, 572, `italic 700 32px ${FD}`, COL.text); const w2 = T(l, cx + w + 8, 572, `500 16px ${FB}`, COL.t3); cx += w + 8 + w2 + 30;
    });
    T(`Yağ maks. ${d.oil == null ? '–' : fmt(d.oil)} °C`, W0 - 44, 572, `500 16px ${FB}`, COL.t3, 'right');

    gr = ctx.createLinearGradient(44, 0, W0 - 44, 0); gr.addColorStop(0, 'rgba(46,141,255,0)'); gr.addColorStop(.2, 'rgba(46,141,255,.8)'); gr.addColorStop(.8, 'rgba(46,141,255,.8)'); gr.addColorStop(1, 'rgba(46,141,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(44, 600, W0 - 88, 1.5);
    const cd = d.cond;
    T('KOŞULLAR', 44, 640, `700 13px ${FB}`, COL.t3, 'left', 3);
    T(`${d.amb == null ? '–' : fmt(d.amb)} °C dış · ${cd.tyre} lastik · Yakıt %${fmt(cd.fuel)} · Sürücü + ${cd.pass} yolcu · ${cd.road} yol`, 150, 640, `500 19px ${FB}`, COL.t2);
    T(d.condEdited ? 'kullanıcı girişi' : 'varsayılan · kullanıcı girişi', W0 - 44, 640, `500 14px ${FB}`, COL.t3, 'right');

    const empty = !Object.keys(d.drag).length && d.brake['100'] == null && d.brake['200'] == null && !d.dyno;
    if (empty) T('Bu oturumda henüz geçerli ölçüm yok', 44, 400, `600 20px ${FB}`, COL.t3);
    ctx.restore();
    rr(ctx, 0.75, 0.75, W0 - 1.5, H0 - 1.5, 28); ctx.strokeStyle = 'rgba(106,174,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  g.MCoreCard = { draw, pack, unpack };
})(window);
