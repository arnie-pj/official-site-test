/**
 * plugin-utasearch.js
 * 歌見た検索 — アニー・イールド用カスタム
 *
 * データファイル: plugins/utasearch/database
 * フォーマット（元の歌見た検索と同一）:
 *   ■Music Video
 *   https://youtu.be/XXXXX
 *
 *   ■歌ってみた枠
 *   https://youtu.be/YYYYY
 *   ボイチェン        ← 任意。直後のタイムスタンプに適用
 *   0:12 曲名
 *   3:45 曲名2
 *
 *   ■歌ってみた枠（タイムスタンプ準備中）
 *   https://youtu.be/ZZZZZ
 */
window.ArniePlugins.register({
  id:       'utasearch',
  tabLabel: 'うた検索',

  async init(container, ctx) {
    const { esc } = ctx;

    /* ---- アニー用カラートークン ---- */
    const THEME = {
      bg:           '#0d0d0d',
      accent:       '#f5d000',
      accentDim:    'rgba(245,208,0,0.15)',
      text:         '#f0f0f0',
      text2:        '#999',
      cardNormal:   '#1e1e1e',
      cardNormalBorder: '#2e2e2e',
      cardVc:       '#1a1028',
      cardVcBorder: '#5a3080',
      badgeBg:      '#3a1060',
      badgeColor:   '#c090f8',
      shadow:       'rgba(245,208,0,0.08)',
    };

    /* ---- CSS（1回だけ注入） ---- */
    if (!document.getElementById('plugin-utasearch-css')) {
      const style = document.createElement('style');
      style.id = 'plugin-utasearch-css';
      style.textContent = `
.us-wrap { max-width:1200px; margin:0 auto; padding:0 24px 40px; }

/* 検索バー */
.us-search-row { position:relative; margin-bottom:16px; }
.us-search-input {
  width:100%; padding:12px 48px 12px 18px; border-radius:50px;
  border:1.5px solid ${THEME.cardNormalBorder}; background:${THEME.cardNormal};
  color:${THEME.text}; font-family:'Noto Sans JP',sans-serif; font-size:.95rem;
  outline:none; transition:border-color .2s, box-shadow .2s;
}
.us-search-input:focus { border-color:${THEME.accent}; box-shadow:0 0 0 3px ${THEME.accentDim}; }
.us-search-input::placeholder { color:${THEME.text2}; }
.us-search-icon { position:absolute; right:18px; top:50%; transform:translateY(-50%); color:${THEME.text2}; font-size:1.1rem; pointer-events:none; }

/* サブタブ */
.us-subtabs { display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap; }
.us-subtab {
  padding:6px 18px; border-radius:50px;
  border:1.5px solid ${THEME.cardNormalBorder}; background:transparent;
  color:${THEME.text2}; font-family:'Noto Sans JP',sans-serif;
  font-size:.82rem; font-weight:500; cursor:pointer; white-space:nowrap; transition:all .18s;
}
.us-subtab:hover { border-color:${THEME.accent}; color:${THEME.accent}; }
.us-subtab.active { background:${THEME.accent}; border-color:${THEME.accent}; color:#000; font-weight:700; }

/* 件数ラベル */
.us-count { font-size:.82rem; color:${THEME.text2}; margin-bottom:14px; min-height:1.2em; }
.us-count em { color:${THEME.accent}; font-style:normal; font-weight:700; }

/* カード（通常） */
.us-card {
  border-radius:14px; overflow:hidden; cursor:pointer;
  text-decoration:none; color:inherit; display:flex; flex-direction:row; align-items:stretch;
  animation:fadeUp .3s ease both; transition:transform .2s, box-shadow .2s;
}
.us-card:hover { transform:translateY(-3px); box-shadow:0 10px 28px ${THEME.shadow}; }
.us-card.us-normal { background:${THEME.cardNormal}; border:1px solid ${THEME.cardNormalBorder}; }
.us-card.us-vc     { background:${THEME.cardVc};     border:1px solid ${THEME.cardVcBorder}; }

/* サムネ */
.us-thumb-wrap { flex:0 0 96px; padding:7px 0 7px 7px; display:flex; align-items:center; }
.us-thumb { width:96px; aspect-ratio:16/9; object-fit:cover; border-radius:6px; background:#2a2a2a; display:block; }

/* ボディ */
.us-body { flex:1; padding:8px 12px; display:flex; flex-direction:column; justify-content:center; min-width:0; }
.us-title { font-size:1rem; font-weight:700; line-height:1.45; margin-bottom:5px; color:${THEME.text};
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; word-break:break-all; }
.us-meta  { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.us-ts    { font-size:.75rem; color:${THEME.text2}; font-variant-numeric:tabular-nums; }
.us-badge-vc { font-size:.68rem; padding:2px 7px; border-radius:20px; background:${THEME.badgeBg}; color:${THEME.badgeColor}; font-weight:600; }

/* 空・エラー */
.us-empty { text-align:center; padding:60px 20px; color:${THEME.text2}; font-size:.95rem; }

@media(max-width:640px){ .us-wrap{ padding:0 12px 40px; } }
      `;
      document.head.appendChild(style);
    }

    /* ---- パーサー ---- */
    function getVideoId(url) {
      // youtu.be/XXXX
      let m = url.match(/youtu\.be\/([A-Za-z0-9_\-]{11})/); if (m) return m[1];
      // watch?v=XXXX
      m = url.match(/[?&]v=([A-Za-z0-9_\-]{11})/);          if (m) return m[1];
      return null;
    }
    function tsToSeconds(ts) {
      const p = ts.trim().split(':').map(Number);
      if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
      if (p.length === 2) return p[0]*60 + p[1];
      return 0;
    }
    function cleanTitle(raw) {
      return raw
        .replace(/[🍆🌸✨💫⭐🎵🎶🎤🎸🎹🥁🎷🎺🪗🎻🎼🎙️🔊🍑⚡💧🐧]+.*$/u, '')
        .replace(/＜[^\s]*/g, '')
        .trim() || raw.trim();
    }
    function parseDb(text) {
      const lines = text.split('\n').map(l => l.trim());
      const mv = [], live = [], pending = [];
      const TS_RE = /^(\d+:\d+(?::\d+)?)\s+(.+)$/;
      let section = null, currentUrl = null, currentVc = false;
      for (const line of lines) {
        if (!line) continue;
        if (line.includes('タイムスタンプ準備中')) { section='pending'; currentUrl=null; continue; }
        if (line === '■Music Video')               { section='mv';      currentUrl=null; continue; }
        if (line === '■歌ってみた枠')              { section='live';    currentUrl=null; continue; }
        if (line.startsWith('https://')) {
          currentUrl = line; currentVc = false;
          if (section === 'mv') {
            const vid = getVideoId(line);
            if (vid) mv.push({ videoId:vid, url:line, contentTitle:null, isVoicechanger:false, timestamp:null });
            currentUrl = null;
          } else if (section === 'pending') {
            const vid = getVideoId(line);
            if (vid) pending.push({ videoId:vid, url:line, contentTitle:null, isVoicechanger:false, timestamp:null });
            currentUrl = null;
          }
          continue;
        }
        if (section === 'live' && line === 'ボイチェン') { currentVc = true; continue; }
        if (section === 'live' && currentUrl) {
          const m = TS_RE.exec(line);
          if (m) {
            const secs = tsToSeconds(m[1]);
            const vid  = getVideoId(currentUrl);
            if (vid) live.push({
              videoId: vid,
              url: `https://www.youtube.com/watch?v=${vid}&t=${secs}`,
              contentTitle: cleanTitle(m[2]),
              isVoicechanger: currentVc,
              timestamp: m[1],
            });
          }
        }
      }
      return { mv, live, pending };
    }

    /* ---- YouTubeタイトルキャッシュ（プラグイン独自） ---- */
    const infoCache = {};
    async function fetchInfo(videoId) {
      if (infoCache[videoId]) return infoCache[videoId];
      try {
        const r = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        const d = await r.json();
        infoCache[videoId] = { title: d.title || '' };
      } catch { infoCache[videoId] = { title:'' }; }
      return infoCache[videoId];
    }

    /* ---- データ読み込み ---- */
    let mv = [], live = [], pending = [];
    try {
      const res = await fetch('./plugins/utasearch/database');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseDb(await res.text());
      mv = parsed.mv; live = parsed.live; pending = parsed.pending;
    } catch (e) {
      console.warn('[plugin-utasearch] database 読み込みエラー:', e);
    }

    /* ---- DOM構築 ---- */
    container.innerHTML = `
      <div class="page-hero">
        <div class="page-hero-title">うた検索</div>
        <div class="page-hero-sub">アニー・イールドのうたをみんなで聞こう！</div>
      </div>
      <div class="us-wrap">
        <div class="us-search-row">
          <input class="us-search-input" id="usSearch" type="search" placeholder="曲名・動画タイトルで検索..." autocomplete="off">
          <span class="us-search-icon">🔍</span>
        </div>
        <div class="us-subtabs" id="usSubtabs">
          <button class="us-subtab active" data-tab="mv">Music Video</button>
          <button class="us-subtab" data-tab="live">歌枠</button>
          <button class="us-subtab" data-tab="pending">歌枠（準備中）</button>
        </div>
        <div class="us-count" id="usCount"></div>
        <div class="cards-grid" id="usGrid"></div>
        <div class="us-empty" id="usEmpty" style="display:none">該当するコンテンツが見つかりませんでした</div>
        <div class="page-bottom"></div>
      </div>`;

    /* ---- 状態 ---- */
    let activeTab   = 'mv';
    let searchQuery = '';
    const tabItems  = { mv, live, pending };
    const tabNames  = { mv:'Music Video', live:'歌枠', pending:'歌枠（タイムスタンプ準備中）' };

    /* ---- カード生成 ---- */
    function makeCard(item) {
      const info  = infoCache[item.videoId] || {};
      const title = item.contentTitle || info.title || item.videoId;
      const isVC  = item.isVoicechanger;
      const a = document.createElement('a');
      a.className = `us-card ${isVC ? 'us-vc' : 'us-normal'}`;
      a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.innerHTML = `
        <div class="us-thumb-wrap">
          <img class="us-thumb" src="https://img.youtube.com/vi/${esc(item.videoId)}/mqdefault.jpg" alt="${esc(title)}" loading="lazy">
        </div>
        <div class="us-body">
          <div class="us-title">${esc(title)}</div>
          <div class="us-meta">
            ${item.timestamp ? `<span class="us-ts">${esc(item.timestamp)}</span>` : ''}
            ${isVC           ? `<span class="us-badge-vc">ボイチェン</span>` : ''}
          </div>
        </div>`;
      return a;
    }

    /* ---- render ---- */
    function render() {
      const grid    = container.querySelector('#usGrid');
      const empty   = container.querySelector('#usEmpty');
      const countEl = container.querySelector('#usCount');
      const subtabs = container.querySelector('#usSubtabs');
      grid.innerHTML = '';
      const q = searchQuery.trim().toLowerCase();
      let items;
      if (q) {
        subtabs.style.opacity = '0.5';
        items = [...mv, ...live, ...pending].filter(item => {
          const info = infoCache[item.videoId] || {};
          return (item.contentTitle||'').toLowerCase().includes(q)
              || (info.title||'').toLowerCase().includes(q);
        });
        countEl.innerHTML = `「<em>${esc(searchQuery)}</em>」の検索結果 — <em>${items.length}</em> 件`;
      } else {
        subtabs.style.opacity = '1';
        items = tabItems[activeTab] || [];
        countEl.innerHTML = `${tabNames[activeTab]} — <em>${items.length}</em> 件`;
      }
      if (items.length === 0) { empty.style.display='block'; return; }
      empty.style.display = 'none';
      items.forEach((item, i) => {
        const card = makeCard(item);
        card.style.animationDelay = `${Math.min(i*0.02,0.6)}s`;
        grid.appendChild(card);
      });
    }

    /* ---- イベント ---- */
    requestAnimationFrame(() => {
      container.querySelector('#usSearch').addEventListener('input', e => {
        searchQuery = e.target.value; render();
      });
      container.querySelectorAll('.us-subtab').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.us-subtab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeTab = btn.dataset.tab;
          searchQuery = '';
          container.querySelector('#usSearch').value = '';
          render();
        });
      });
      render();

      /* バックグラウンドでタイトル取得 */
      (async () => {
        const allIds = [...new Set([...mv,...live,...pending].map(i=>i.videoId))];
        const BATCH = 5;
        for (let i = 0; i < allIds.length; i += BATCH) {
          await Promise.allSettled(allIds.slice(i,i+BATCH).map(id => fetchInfo(id)));
          render();
          await new Promise(r => setTimeout(r, 150));
        }
      })();
    });
  }
});
