/**
 * plugin-videolist.js
 * 動画いちらん — database_yt から動画を読み込んでタブ表示する
 *
 * プラグインインターフェース:
 *   window.ArniePlugins.register({ id, tabLabel, init(container, ctx) })
 *   ctx: { esc, fetchYT, ytCache }
 */
window.ArniePlugins.register({
  id:       'videolist',
  tabLabel: '動画いちらん',

  async init(container, ctx) {
    const { esc, fetchYT, ytCache } = ctx;

    /* ---- CSS（1回だけ注入） ---- */
    if (!document.getElementById('plugin-videolist-css')) {
      const style = document.createElement('style');
      style.id = 'plugin-videolist-css';
      style.textContent = `
/* ---- 動画いちらん レイアウト ---- */
.vl-wrap{max-width:1200px;margin:0 auto;padding:28px 24px 0}
.vl-search-row{position:relative;margin-bottom:20px}
.vl-search-input{width:100%;padding:12px 48px 12px 18px;border-radius:50px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Noto Sans JP',sans-serif;font-size:.95rem;outline:none;transition:border-color .2s,box-shadow .2s}
.vl-search-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}
.vl-search-input::placeholder{color:var(--text3)}
.vl-search-icon{position:absolute;right:18px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:1.1rem;pointer-events:none}
.vl-subtabs{display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap}
.vl-subtab{padding:6px 18px;border-radius:50px;border:1.5px solid var(--border);background:transparent;color:var(--text2);font-family:'Noto Sans JP',sans-serif;font-size:.82rem;font-weight:500;cursor:pointer;white-space:nowrap;transition:all .18s}
.vl-subtab:hover{border-color:var(--accent);color:var(--accent)}
.vl-subtab.active{background:var(--accent);border-color:var(--accent);color:#000;font-weight:700}
.vl-count{font-size:.82rem;color:var(--text2);margin-bottom:14px;min-height:1.2em}
.vl-count em{color:var(--accent);font-style:normal;font-weight:700}
.vl-empty{text-align:center;padding:60px 20px;color:var(--text3);font-size:.95rem}
/* カード色バリアント */
.card-vl-n{background:#0e1e3a;border-color:#1e4080}
.card-vl-n:hover{border-color:#4a8af5;box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 0 1px rgba(74,138,245,.25)}
.card-vl-n .card-label{color:#6aaaf8}.card-vl-n .card-title{color:#cde0ff}
.card-vl-rn{background:linear-gradient(105deg,#1a1a1a 50%,#0e1e3a 50%);border-color:#2a3a5a}
.card-vl-rn:hover{border-color:rgba(74,138,245,.5);box-shadow:0 8px 32px rgba(0,0,0,.45),0 0 0 1px rgba(74,138,245,.15)}
.card-vl-rn .card-label{color:#a0c4ff}
.card-vl-c{background:#2a0e1e;border-color:#6b2040}
.card-vl-c:hover{border-color:#c05080;box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 0 1px rgba(192,80,128,.25)}
.card-vl-c .card-label{color:#e080a8}.card-vl-c .card-title{color:#f0c8d8}
.card-vl-nc{background:linear-gradient(105deg,#1a1a1a 50%,#2a0e1e 50%);border-color:#4a2035}
.card-vl-nc:hover{border-color:rgba(192,80,128,.5);box-shadow:0 8px 32px rgba(0,0,0,.45),0 0 0 1px rgba(192,80,128,.15)}
.card-vl-nc .card-label{color:#e080a8}
@media(max-width:640px){.vl-wrap{padding:20px 12px 0}}
      `;
      document.head.appendChild(style);
    }

    /* ---- database_yt パーサー ---- */
    function parseDatabaseYt(text) {
      const items = [];
      let category = 'video';
      const categoryMap = {
        '動画':'video','video':'video',
        'ショート':'short','short':'short','shorts':'short',
        '配信':'live','live':'live',
      };
      for (const rawLine of text.split('\n')) {
        const line = rawLine.replace(/!!!.*$/, '').trim();
        if (!line) continue;
        if (line.startsWith('#')) {
          category = categoryMap[line.replace(/^#+\s*/,'').trim().toLowerCase()] || 'video';
          continue;
        }
        const m = line.match(/^(nr|nc|r|n|c)\s+(https?:\/\/\S+)/i);
        if (!m) continue;
        const url = m[2];
        const vid = extractVideoId(url);
        if (!vid) continue;
        items.push({ url, videoId: vid, videoType: category, color: m[1].toLowerCase() });
      }
      return items;
    }

    function extractVideoId(url) {
      let m;
      m = url.match(/youtu\.be\/([A-Za-z0-9_\-]{11})/);       if (m) return m[1];
      m = url.match(/[?&]v=([A-Za-z0-9_\-]{11})/);            if (m) return m[1];
      m = url.match(/\/shorts\/([A-Za-z0-9_\-]{11})/);        if (m) return m[1];
      m = url.match(/\/live\/([A-Za-z0-9_\-]{11})/);          if (m) return m[1];
      m = url.match(/\/embed\/([A-Za-z0-9_\-]{11})/);         if (m) return m[1];
      return null;
    }

    /* ---- database_yt 読み込み ---- */
    let allYtCards = [];
    try {
      const res = await fetch('./plugins/videolist/database');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allYtCards = parseDatabaseYt(await res.text());
    } catch (e) {
      console.warn('[plugin-videolist] database_yt 読み込みエラー:', e);
    }

    /* ---- DOM構築 ---- */
    container.innerHTML = `
      <div class="page-hero">
        <div class="page-hero-title">動画いちらん</div>
        <div class="page-hero-sub">全 ${allYtCards.length} 件 — 新しい順に表示</div>
      </div>
      <div class="vl-wrap">
        <div class="vl-search-row">
          <input class="vl-search-input" id="vlSearch" type="search" placeholder="タイトルで検索..." autocomplete="off">
          <span class="vl-search-icon">🔍</span>
        </div>
        <div class="vl-subtabs">
          <button class="vl-subtab active" data-vtype="all">すべて</button>
          <button class="vl-subtab" data-vtype="video">動画</button>
          <button class="vl-subtab" data-vtype="short">ショート</button>
          <button class="vl-subtab" data-vtype="live">配信</button>
        </div>
        <div class="vl-count" id="vlCount"></div>
        <div class="cards-grid" id="vlGrid"></div>
        <div class="vl-empty" id="vlEmpty" style="display:none">該当する動画が見つかりませんでした</div>
        <div class="page-bottom"></div>
      </div>`;

    /* ---- 状態 ---- */
    const colorClass = { n:'', r:'card-vl-n', nr:'card-vl-rn', c:'card-vl-c', nc:'card-vl-nc' };
    const typeLabel  = { all:'すべて', video:'動画', short:'ショート', live:'配信' };
    const typeTag    = { video:'動画', short:'ショート', live:'配信' };
    let vlSubTab = 'all';
    let vlQuery  = '';

    /* ---- renderVL（同期・キャッシュのみ参照） ---- */
    function getTitle(item) {
      /* videoIdから正規化URLを作り、そのキャッシュを優先して参照 */
      const normalUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
      return ytCache[normalUrl]?.title || ytCache[item.url]?.title || '';
    }

    function renderVL() {
      const grid    = container.querySelector('#vlGrid');
      const empty   = container.querySelector('#vlEmpty');
      const countEl = container.querySelector('#vlCount');
      if (!grid) return;
      const q = vlQuery.trim().toLowerCase();
      const filtered = allYtCards.filter(item => {
        if (vlSubTab !== 'all' && item.videoType !== vlSubTab) return false;
        if (q) return getTitle(item).toLowerCase().includes(q);
        return true;
      });
      countEl.innerHTML = q
        ? `「<em>${esc(vlQuery)}</em>」の検索結果 — <em>${filtered.length}</em> 件`
        : `${typeLabel[vlSubTab]} — <em>${filtered.length}</em> 件`;

      const existing = Array.from(grid.children);
      while (grid.children.length > filtered.length) grid.removeChild(grid.lastChild);

      filtered.forEach((item, i) => {
        const title = getTitle(item) || item.url;
        const extra = colorClass[item.color] || '';
        const tag   = typeTag[item.videoType] || 'YouTube';
        if (existing[i] && existing[i].dataset.vid === item.videoId) {
          const el = existing[i].querySelector('.vl-card-title');
          if (el) el.textContent = title;
        } else {
          const w = document.createElement('div');
          w.className = `card card-link${extra ? ' '+extra : ''}`;
          w.dataset.vid = item.videoId;
          w.style.animationDelay = `${Math.min(i*0.03,0.6)}s`;
          w.innerHTML = `
            <div class="card-media">
              <div class="card-thumb-wrap">
                <img class="card-thumb" src="https://img.youtube.com/vi/${esc(item.videoId)}/mqdefault.jpg" alt="" loading="lazy">
              </div>
              <div class="card-body">
                <div class="card-label">${esc(tag)}</div>
                <div class="card-title vl-card-title">${esc(title)}</div>
              </div>
            </div>`;
          w.addEventListener('click', () => window.open(item.url, '_blank', 'noopener'));
          if (i < grid.children.length) grid.replaceChild(w, grid.children[i]);
          else grid.appendChild(w);
        }
      });
      empty.style.display = filtered.length === 0 ? 'block' : 'none';
    }

    /* ---- プリフェッチ：正規化URLで取得して確実にキャッシュ ---- */
    async function prefetchTitles() {
      const BATCH = 4;
      for (let i = 0; i < allYtCards.length; i += BATCH) {
        await Promise.allSettled(
          allYtCards.slice(i,i+BATCH).map(item =>
            fetchYT(`https://www.youtube.com/watch?v=${item.videoId}`)
          )
        );
        renderVL();
        await new Promise(r => setTimeout(r, 120));
      }
    }

    /* ---- イベントバインド ---- */
    requestAnimationFrame(() => {
      container.querySelector('#vlSearch')?.addEventListener('input', e => {
        vlQuery = e.target.value; renderVL();
      });
      container.querySelectorAll('.vl-subtab').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.vl-subtab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          vlSubTab = btn.dataset.vtype; renderVL();
        });
      });
      renderVL();
      prefetchTitles();
    });
  }
});
