// casa ポップ依頼：スマホで開く画面（依頼・一覧・許可・仕上がり確認・直し）
(() => {
  const CFG = window.POP_CONFIG || {};
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname); // 手元の試し用
  const app = document.getElementById('app');
  let qs = new URLSearchParams(location.search);
  let token = '';
  let me = { name: '', owner: false };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = s => esc(s).replace(/\n/g, '<br>');
  // 2026-11-22 → 11/22（日）
  const day = s => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s || '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number(m[2]) + '/' + Number(m[3]) + '（' + '日月火水木金土'[d.getDay()] + '）';
  };
  const $ = s => app.querySelector(s);
  const mem = {
    get: k => { try { return localStorage.getItem('pop_' + k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { localStorage.setItem('pop_' + k, v); } catch (e) { /* 使えなくても困らない */ } }
  };

  /* ---------- 窓口とのやりとり ---------- */

  async function api(action, data) {
    const res = await fetch(CFG.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action, idToken: token }, data || {}))
    });
    const j = await res.json();
    if (!j.ok) {
      if (j.error === 'LOGIN' && !LOCAL && window.liff) {
        liff.logout();
        liff.login({ redirectUri: location.href });
        await new Promise(() => {});
      }
      throw new Error(j.error === 'LOGIN' ? 'LINE から開き直してください' : (j.error || 'うまくいきませんでした'));
    }
    return j;
  }

  function loadScript(src) {
    return new Promise((ok, ng) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => ng(new Error('読み込めませんでした。電波のよい所でもう一度開いてください'));
      document.head.appendChild(s);
    });
  }

  async function boot() {
    try {
      if (LOCAL) {
        const as = qs.get('as') || 'staffA';
        token = 'demo:' + as + ':' + (qs.get('name') || (as === 'owner' ? 'オーナー' : 'Kazuki'));
        CFG.gasUrl = '/exec';
      } else {
        if (!CFG.gasUrl || !CFG.liffId) throw new Error('まだ準備中です');
        await loadScript('https://static.line-scdn.net/liff/edge/2/sdk.js');
        await liff.init({ liffId: CFG.liffId });
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return; }
        token = liff.getIDToken();
        qs = new URLSearchParams(location.search);
      }
      me = await api('me');
      route();
    } catch (e) { fatal(e); }
  }

  /* ---------- 画面の切り替え ---------- */

  function go(params, replace) {
    const next = new URLSearchParams();
    ['as', 'name'].forEach(k => { if (qs.get(k)) next.set(k, qs.get(k)); });
    Object.keys(params).forEach(k => { if (params[k] != null && params[k] !== '') next.set(k, params[k]); });
    const url = location.pathname + '?' + next.toString();
    if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
    qs = next;
    route();
  }
  window.addEventListener('popstate', () => { qs = new URLSearchParams(location.search); route(); });

  function route() {
    window.scrollTo(0, 0);
    const v = qs.get('v') || 'new', id = qs.get('id');
    const run = { new: viewNew, list: viewList, job: () => viewJob(id), edit: () => viewEdit(id), reject: () => viewText('reject', id), redo: () => viewText('redo', id), fix: () => viewText('fix', id) }[v] || viewNew;
    Promise.resolve().then(run).catch(fatal);
  }

  function closeApp() {
    if (!LOCAL && window.liff && liff.isInClient && liff.isInClient()) liff.closeWindow();
    else go({ v: 'list' });
  }

  function header(title, opt) {
    opt = opt || {};
    return '<div class="hd">' + (opt.back ? '<button class="bk" data-back>‹</button>' : '') + '<span>' + esc(title) + '</span><span class="sp"></span>' +
      (opt.link ? '<button class="lk" data-link>' + esc(opt.link[0]) + '</button>' : '') + '</div>';
  }
  function wire(opt) {
    opt = opt || {};
    const b = $('[data-back]'); if (b) b.onclick = () => (history.length > 1 ? history.back() : go({ v: 'list' }));
    const l = $('[data-link]'); if (l && opt.link) l.onclick = opt.link[1];
  }
  function loading(title) { app.innerHTML = header(title) + '<div class="wait">読み込み中…</div>'; }
  function fatal(e) {
    app.innerHTML = header('casa ポップ依頼') + '<div class="pad"><div class="err">' + esc((e && e.message) || e) + '</div><button class="btn plain" id="re">もう一度読み込む</button></div>';
    $('#re').onclick = () => location.reload();
  }
  function showErr(e) {
    let box = $('#err');
    if (!box) return alert((e && e.message) || e);
    box.innerHTML = '<div class="err">' + esc((e && e.message) || e) + '</div>';
    box.scrollIntoView({ block: 'center' });
  }
  async function busy(btn, fn) {
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = '送っています…';
    try { await fn(); } catch (e) { btn.disabled = false; btn.textContent = old; showErr(e); }
  }
  function done(title, text, buttons) {
    app.innerHTML = '<div class="done"><div class="mk">✓</div><h2>' + esc(title) + '</h2><p>' + nl(text) + '</p></div><div class="pad" id="acts"></div>';
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn ' + (b[2] || 'plain'); el.textContent = b[0]; el.onclick = b[1];
      $('#acts').appendChild(el);
    });
  }

  /* ---------- 依頼の欄 ---------- */

  const MAKES = ['A3', '正方形', '両方'];

  function formHtml(f, mode) {
    const v = k => esc(f[k] || '');
    return '<div class="pad white" style="padding-bottom:18px">' +
      '<div class="two">' +
        '<div class="f"><label>店舗</label><input id="store" list="stores" placeholder="例：札幌" value="' + v('store') + '"></div>' +
        '<div class="f"><label>いつまでに</label><input id="due" type="date" value="' + v('due') + '"></div>' +
      '</div>' +
      (mode === 'new' ? '<div class="f"><label>お名前</label><input id="name" placeholder="例：Kazuki" value="' + v('name') + '"></div>' : '') +
      '<div class="f"><label>作るもの<span class="req">必ず</span></label><div class="chips" id="make">' +
        MAKES.map(m => '<button type="button" class="chip' + (f.make === m ? ' on' : '') + '" data-m="' + m + '">' + m + '</button>').join('') + '</div></div>' +
      '<div class="f"><label>大会名（ポップの題）<span class="req">必ず</span></label><input id="title" placeholder="例：ITEM POKER 100K" value="' + v('title') + '"></div>' +
      '<div class="f"><label>色のイメージ</label><input id="color" placeholder="例：黄色" value="' + v('color') + '"></div>' +
      '<div class="two">' +
        '<div class="f"><label>開始</label><input id="start" placeholder="例：17:00" value="' + v('start') + '"></div>' +
        '<div class="f"><label>レイト（締切）</label><input id="late" placeholder="例：22:00" value="' + v('late') + '"></div>' +
      '</div>' +
      '<div class="f"><label>参加費</label><textarea id="fee" rows="2" placeholder="例：Entry(Re) ¥5,000 / 50,000点">' + v('fee') + '</textarea></div>' +
      '<div class="f"><label>プライズ</label><textarea id="prize" rows="3" placeholder="例：1位 50,000pt&#10;2位 30,000pt">' + v('prize') + '</textarea></div>' +
      '<div class="f"><label>そのほか入れたい文（自由に）</label><textarea id="free" rows="4" placeholder="早割・学割・注意書きなど、ポップに入れたい文をそのまま">' + v('free') + '</textarea></div>' +
      '<div id="sqbox">' +
        '<div class="sec">正方形に入れる文字<small>空のままなら、上＝題／中央＝いちばん大きい数字／下＝参加費 で作ります。</small></div>' +
        '<div class="f"><label>上の段</label><input id="sqTop" placeholder="例：ITEM POKER" value="' + v('sqTop') + '"></div>' +
        '<div class="f"><label>中央（いちばん大きく）</label><input id="sqMid" placeholder="例：100K" value="' + v('sqMid') + '"></div>' +
        '<div class="f"><label>下の段</label><input id="sqBottom" placeholder="例：特殊ゲーム" value="' + v('sqBottom') + '"></div>' +
      '</div>' +
      '<div id="err"></div>';
  }

  function wireForm() {
    const sync = () => { const on = $('#make .chip.on'); $('#sqbox').style.display = on && on.dataset.m === 'A3' ? 'none' : ''; };
    app.querySelectorAll('#make .chip').forEach(c => {
      c.onclick = () => { app.querySelectorAll('#make .chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); sync(); };
    });
    sync();
  }

  function readForm() {
    const on = $('#make .chip.on');
    const f = { make: on ? on.dataset.m : '' };
    ['store', 'due', 'name', 'title', 'color', 'start', 'late', 'fee', 'prize', 'free', 'sqTop', 'sqMid', 'sqBottom'].forEach(k => {
      const el = $('#' + k); if (el) f[k] = el.value.trim();
    });
    if (f.make === 'A3') { f.sqTop = ''; f.sqMid = ''; f.sqBottom = ''; }
    if (!f.make) throw new Error('「作るもの」を選んでください');
    if (!f.title) throw new Error('「大会名（ポップの題）」を入れてください');
    return f;
  }

  function viewNew() {
    const opt = { link: ['依頼の状況', () => go({ v: 'list' })] };
    app.innerHTML = header('ポップを依頼する', opt) +
      formHtml({ store: mem.get('store'), name: mem.get('name') || me.name, make: '両方' }, 'new') +
      '<button class="btn ok" id="send">依頼を送る</button>' +
      '<div class="hint">送るとオーナーに届きます。<br>許可が出たら作り始めます。</div></div>';
    wire(opt); wireForm();
    $('#send').onclick = ev => busy(ev.target, async () => {
      const f = readForm();
      mem.set('store', f.store); mem.set('name', f.name);
      const r = await api('submit', { fields: f });
      done('依頼を送りました', '受付番号 ' + r.id + '\nオーナーの許可が出たら作り始めます。\nできあがったら LINE に届きます。', [
        ['依頼の状況を見る', () => go({ v: 'list' }), 'sub'], ['閉じる', closeApp]
      ]);
    });
  }

  /* ---------- 一覧 ---------- */

  const STAFF_TEXT = { pending: '許可待ち', approved: '作成待ち', working: '作成中', review: 'オーナーが確認中', delivered: '届きました', rejected: '見送り', closed: '作り直し中', error: '作成中' };
  const TAG = { pending: 'w', approved: 'm', working: 'm', review: 'c', delivered: 'd', rejected: 'g', closed: 'g', error: 'c' };

  function sub(j) {
    const who = [j.store, me.owner && j.userName ? j.userName + ' さん' : ''].filter(Boolean).join('・');
    const make = j.make === '両方' ? 'A3＋正方形' : j.make;
    return [who, make, j.kind === 'fix' ? '直し' : ''].filter(Boolean).join('　');
  }
  function item(j, label) {
    return '<button class="it" data-id="' + esc(j.id) + '"><div class="t"><b>' + esc(j.title) + '</b><span>' + esc(sub(j)) + '</span></div><span class="tag ' + TAG[j.status] + '">' + esc(label) + '</span></button>';
  }

  async function viewList() {
    const opt = { link: ['＋ 依頼する', () => go({ v: 'new' })] };
    loading(me.owner ? '依頼の一覧' : '依頼の状況');
    const r = await api('list');
    const by = s => r.jobs.filter(j => j.status === s);
    let h = '';
    const group = (title, list, label) => { if (list.length) h += '<div class="grp">' + esc(title) + '（' + list.length + '）</div>' + list.map(j => item(j, typeof label === 'function' ? label(j) : label)).join(''); };
    if (r.owner) {
      group('許可待ち', by('pending'), '許可する ›');
      group('仕上がりの確認待ち', by('review'), '確認する ›');
      group('作れなかったもの', by('error'), '見る ›');
      group('Mac が作成中', by('working'), '作成中');
      group('作成待ち（Mac が開いたら作ります）', by('approved'), '作成待ち');
      group('届け済み', by('delivered').slice(0, 20), '完了');
      group('お断り', by('rejected').slice(0, 5), 'お断り');
    } else {
      const mine = r.jobs;
      group('進んでいるもの', mine.filter(j => ['pending', 'approved', 'working', 'review', 'error', 'closed'].includes(j.status)), j => STAFF_TEXT[j.status]);
      group('できたポップ', mine.filter(j => j.status === 'delivered').slice(0, 30), '見る ›');
      group('見送り', mine.filter(j => j.status === 'rejected').slice(0, 5), '見送り');
    }
    if (!h) h = '<div class="empty">まだ依頼はありません。<br>右上の「＋ 依頼する」からどうぞ。</div>';
    if (r.owner) h += '<div class="note">Mac が閉じている・寝ているときは、依頼を待たせておきます。Mac が開いたら、許可済みのものから順番に作ります。</div>';
    app.innerHTML = header(me.owner ? '依頼の一覧' : '依頼の状況', opt) + '<div class="pad" style="padding-top:2px">' + h + '</div>';
    wire(opt);
    app.querySelectorAll('.it').forEach(b => { b.onclick = () => go({ v: 'job', id: b.dataset.id }); });
  }

  /* ---------- 1件の中身 ---------- */

  function detail(j) {
    const rows = [['店・人', [j.store, j.userName ? j.userName + ' さん' : ''].filter(Boolean).join('　')], ['作るもの', j.make === '両方' ? 'A3 と 正方形' : j.make],
      ['色', j.color], ['いつまで', day(j.due)], ['開始', j.start], ['レイト', j.late], ['参加費', j.fee], ['プライズ', j.prize], ['そのほか', j.free],
      ['正方形 上', j.sqTop], ['正方形 中央', j.sqMid], ['正方形 下', j.sqBottom]];
    return rows.filter(r => r[1]).map(r => '<div class="kv"><span>' + esc(r[0]) + '</span><b>' + nl(r[1]) + '</b></div>').join('');
  }
  function images(j) {
    if (!j.a3 && !j.sq) return '';
    return '<div class="card"><div class="ct">できたポップ</div><div class="imgs">' +
      (j.a3 ? '<a class="a3" href="' + esc(j.a3) + '" target="_blank" rel="noopener"><img src="' + esc(j.a3p || j.a3) + '" alt="A3">A3（押すと大きく）</a>' : '') +
      (j.sq ? '<a class="sq" href="' + esc(j.sq) + '" target="_blank" rel="noopener"><img src="' + esc(j.sqp || j.sq) + '" alt="正方形">正方形</a>' : '') +
      '</div></div>';
  }

  async function viewJob(id) {
    loading('依頼の中身');
    const r = await api('get', { id });
    const j = r.job, o = r.owner;
    const label = o ? j.statusText : STAFF_TEXT[j.status];
    let acts = '';
    if (o && j.status === 'pending') acts = '<button class="btn ok" data-a="approve">許可する</button><div class="brow"><button class="btn sub" data-a="edit">直して許可</button><button class="btn ng" data-a="reject">断る</button></div>';
    if (o && j.status === 'review') acts = '<button class="btn ok" data-a="deliver">OK・スタッフに届ける</button><button class="btn sub" data-a="redo">作り直す（直しを書く）</button><div class="hint">OK を押すまで、スタッフには見えません。</div>';
    if (o && j.status === 'error') acts = '<button class="btn ok" data-a="retry">もう一度作る</button>';
    if (o && j.status === 'delivered') acts = '<button class="btn sub" data-a="redo">作り直す（直しを書く）</button>';
    if (!o && j.mine && j.status === 'delivered') acts = '<button class="btn sub" data-a="fix">直しを頼む</button><div class="hint">画像を押すと大きく開きます。長押しで保存できます。</div>';
    // 仕上がりを見る場面では、画像のすぐ下にボタンを置く（下まで送らなくてよいように）
    const top = j.a3 || j.sq;
    app.innerHTML = header('依頼の中身', { back: true }) + '<div class="pad">' +
      images(j) + (top ? '<div id="err"></div><div style="margin:-2px 0 14px">' + acts + '</div>' : '') +
      '<div class="card"><div class="ct">' + esc(j.title) + '</div><div style="margin:8px 0 4px"><span class="tag ' + TAG[j.status] + '">' + esc(label) + '</span>　<span style="font-size:12.5px;color:#6b7380;font-weight:700">番号 ' + esc(j.id) + '</span></div>' +
      (j.kind === 'fix' ? '<div class="fixbox"><small>直したい所（番号 ' + esc(j.parent) + ' の直し）</small>' + nl(j.note) + '</div>' : '') +
      (j.status === 'rejected' && j.msg ? '<div class="fixbox"><small>オーナーから</small>' + nl(j.msg) + '</div>' : '') +
      (o && j.status === 'error' && j.msg ? '<div class="fixbox"><small>作れなかった理由</small>' + nl(j.msg) + '</div>' : '') +
      detail(j) + '</div>' + (top ? '' : '<div id="err"></div>' + acts) + '</div>';
    wire();
    app.querySelectorAll('[data-a]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'edit' || a === 'reject' || a === 'redo' || a === 'fix') return go({ v: a, id });
        busy(b, async () => {
          const x = a === 'deliver' ? await api('deliver', { id }) : await api('decide', { id, decision: a });
          done(x.message, '', [['一覧へ', () => go({ v: 'list' }), 'sub'], ['閉じる', closeApp]]);
        });
      };
    });
  }

  async function viewEdit(id) {
    loading('直して許可');
    const r = await api('get', { id });
    if (!r.owner) throw new Error('この操作はオーナーだけができます');
    app.innerHTML = header('直して許可', { back: true }) + formHtml(r.job, 'edit') +
      '<button class="btn ok" id="send">この内容で許可する</button></div>';
    wire(); wireForm();
    $('#send').onclick = ev => busy(ev.target, async () => {
      const x = await api('decide', { id, decision: 'approve', fields: readForm() });
      done(x.message, '', [['一覧へ', () => go({ v: 'list' }), 'sub'], ['閉じる', closeApp]]);
    });
  }

  const TEXTS = {
    reject: { title: '断る', label: 'スタッフへのひとこと（なくてもOK）', ph: '例：今月はこの大会をやらないので見送りです', btn: '断る', cls: 'ng' },
    redo: { title: '作り直す', label: '直したい所', ph: '例：題字をもっと大きく。プライズの4位を消す', btn: 'この直しで作り直す', cls: 'ok' },
    fix: { title: '直しを頼む', label: '直したい所', ph: '例：正方形の下の段を「Entry ¥5,000」に変えてください', btn: '直しを送る', cls: 'ok' }
  };

  async function viewText(kind, id) {
    const t = TEXTS[kind];
    loading(t.title);
    const r = await api('get', { id });
    app.innerHTML = header(t.title, { back: true }) + '<div class="pad">' + (kind === 'reject' ? '' : images(r.job)) +
      '<div class="card"><div class="ct">' + esc(r.job.title) + '</div><div style="font-size:12.5px;color:#6b7380;font-weight:700;margin-top:4px">番号 ' + esc(r.job.id) + '</div></div>' +
      '<div class="f"><label>' + esc(t.label) + '</label><textarea id="text" rows="5" placeholder="' + esc(t.ph) + '"></textarea></div><div id="err"></div>' +
      '<button class="btn ' + t.cls + '" id="send">' + esc(t.btn) + '</button>' +
      (kind === 'fix' ? '<div class="hint">オーナーの許可が出たら作り直します。</div>' : '') + '</div>';
    wire();
    $('#send').onclick = ev => busy(ev.target, async () => {
      const text = $('#text').value.trim();
      if (kind === 'reject') {
        const x = await api('decide', { id, decision: 'reject', msg: text });
        return done(x.message, '', [['一覧へ', () => go({ v: 'list' }), 'sub'], ['閉じる', closeApp]]);
      }
      const x = await api(kind, { id, text });
      const msg = x.status === 'approved' ? 'Mac が開いていれば、まもなく作り直します。' : 'オーナーの許可が出たら作り直します。';
      done('直しを受け付けました', '受付番号 ' + x.id + '\n' + msg, [['依頼の状況を見る', () => go({ v: 'list' }), 'sub'], ['閉じる', closeApp]]);
    });
  }

  boot();
})();
