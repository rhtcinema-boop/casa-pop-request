// casa ポップ依頼：依頼の文を作って、LINE でオーナーに送るだけのページ。
// 窓口やログインは使わない。貼った文に、作るもの・店舗・いつまで・名前を付けて、LINE の「送る」画面を開く。
(() => {
  const app = document.getElementById('app');
  const $ = s => app.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mem = {
    get: k => { try { return localStorage.getItem('pop_' + k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { localStorage.setItem('pop_' + k, v); } catch (e) { /* 使えなくても困らない */ } }
  };
  // 2026-11-22 → 11/22（日）
  const day = s => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s || '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number(m[2]) + '/' + Number(m[3]) + '（' + '日月火水木金土'[d.getDay()] + '）';
  };

  const MAKES = ['A3', '正方形', '両方'];
  const EXAMPLE = '例）\nITEM POKER 100K\n黄色のイメージで\n\nStart 17:00　Late 22:00\nEntry(Re)：¥5,000 / 50,000点\n早割：19:00までの着席で…\n1位 50,000pt　2位 30,000pt\n\n正方形：ITEM POKER／100K／特殊ゲーム';

  function render() {
    const v = k => esc(mem.get(k));
    app.innerHTML =
      '<div class="hd"><span>ポップを依頼する</span></div>' +
      '<div class="pad white" style="padding-bottom:22px">' +
        '<div class="f"><label for="text">ポップに入れたい文字<span class="req">必ず</span></label>' +
          '<textarea id="text" rows="13" placeholder="' + esc(EXAMPLE) + '">' + v('draft') + '</textarea>' +
          '<div class="tip">いつもの文をそのまま貼れば OK。色や雰囲気、正方形に入れる言葉も、ここに書いてください。</div></div>' +
        '<div class="f"><label>作るもの<span class="req">必ず</span></label><div class="chips" id="make">' +
          MAKES.map(m => '<button type="button" class="chip' + ((mem.get('make') || '両方') === m ? ' on' : '') + '" data-m="' + m + '">' + m + '</button>').join('') + '</div></div>' +
        '<div class="two">' +
          '<div class="f"><label for="store">店舗</label><input id="store" list="stores" placeholder="例：札幌" value="' + v('store') + '"></div>' +
          '<div class="f"><label for="due">いつまでに</label><input id="due" type="date"></div>' +
        '</div>' +
        '<div class="f"><label for="name">お名前</label><input id="name" placeholder="例：Kazuki" value="' + v('name') + '"></div>' +
        '<div id="err"></div>' +
        '<button class="btn ok" id="send">LINE で送る</button>' +
        '<button class="btn plain" id="copy">文をコピーする</button>' +
        '<div class="hint" id="hint">「LINE で送る」を押すと LINE が開きます。<br>送り先にオーナーを選んで、送信してください。</div>' +
      '</div>';
    app.querySelectorAll('#make .chip').forEach(c => {
      c.onclick = () => { app.querySelectorAll('#make .chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); };
    });
    $('#text').addEventListener('input', () => mem.set('draft', $('#text').value));
    $('#send').onclick = () => act(msg => {
      location.href = 'https://line.me/R/share?text=' + encodeURIComponent(msg);
      note('LINE が開かないときは、「文をコピーする」を押して、LINE に貼って送ってください。');
    });
    $('#copy').onclick = () => act(async msg => {
      try { await navigator.clipboard.writeText(msg); }
      catch (e) { const t = document.createElement('textarea'); t.value = msg; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      note('コピーしました。LINE を開いて、オーナーとのトークに貼って送ってください。');
    });
  }

  function note(s) { $('#hint').textContent = s; }

  // 欄を読んで、送る文を作る
  function act(fn) {
    $('#err').innerHTML = '';
    const on = $('#make .chip.on');
    const f = { text: $('#text').value.trim(), make: on ? on.dataset.m : '', store: $('#store').value.trim(), due: $('#due').value, name: $('#name').value.trim() };
    if (!f.text) return fail('ポップに入れたい文字を書いてください');
    if (!f.make) return fail('「作るもの」を選んでください');
    mem.set('store', f.store); mem.set('name', f.name); mem.set('make', f.make);
    const head = ['【ポップ依頼】', '作るもの：' + (f.make === '両方' ? '両方（A3 と 正方形）' : f.make + ' だけ')];
    if (f.store) head.push('店舗：' + f.store);
    if (f.due) head.push('いつまで：' + day(f.due));
    if (f.name) head.push('依頼：' + f.name);
    window.__lastMessage = head.join('\n') + '\n――――――\n' + f.text; // 確かめ用
    mem.set('draft', ''); // 送ったら、次に開いたときは空から（今の画面の文はそのまま残る）
    fn(window.__lastMessage);
  }
  function fail(s) {
    $('#err').innerHTML = '<div class="err">' + esc(s) + '</div>';
    $('#err').scrollIntoView({ block: 'center' });
  }

  render();
})();
