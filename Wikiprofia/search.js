// /wikiprofia/search.js
(function () {
  const INPUT_ID = 'wikia-search-input';
  const RESULTS_ID = 'wikia-search-results';

  let pages = [];
  let cache = new Map(); // url -> { text, title }
  let controller;

  async function loadManifest() {
    const res = await fetch('manifest.json', { cache: 'no-store' });
    const data = await res.json();
    pages = data.runners || [];
  }

  async function fetchPageText(url) {
    if (cache.has(url)) return cache.get(url);

    const res = await fetch(url, { cache: 'force-cache' });
    const html = await res.text();

    // Parse HTML to extract title + text content
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = (doc.querySelector('h1')?.textContent || doc.title || url).trim();
    const text = doc.body ? doc.body.textContent.replace(/\s+/g, ' ').trim() : html;

    const payload = { title, text, url };
    cache.set(url, payload);
    return payload;
  }

  function scoreHit(q, page) {
    const ql = q.toLowerCase();
    const titleScore = (page.title.toLowerCase().includes(ql) ? 5 : 0);
    const bodyScore = (page.text.toLowerCase().includes(ql) ? 1 : 0);
    return titleScore + bodyScore;
  }

  function makeSnippet(text, query, max = 180) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text.slice(0, max) + (text.length > max ? '…' : '');
    const start = Math.max(0, idx - Math.floor(max / 2));
    const slice = text.slice(start, start + max);
    // highlight
    const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return slice.replace(new RegExp(esc, 'ig'), (m) => `<b>${m}</b>`) + '…';
  }

  function renderResults(items, query) {
    const box = document.getElementById(RESULTS_ID);
    if (!items.length) {
      box.innerHTML = `<div class="result">No results for “${escapeHtml(query)}”.</div>`;
      box.hidden = false;
      return;
    }
    box.innerHTML = items.map(it => `
      <div class="result">
        <a class="title" href="${it.url}">${escapeHtml(it.title)}</a>
        <div class="snippet">${makeSnippet(it.text, query)}</div>
      </div>
    `).join('');
    box.hidden = false;
  }

  function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]))}

  async function search(query) {
    if (!query || query.trim().length < 2) {
      document.getElementById(RESULTS_ID).hidden = true;
      return;
    }
    // abort previous in-flight fetches if any
    if (controller) controller.abort();
    controller = new AbortController();

    // fetch & score pages
    const records = await Promise.all(pages.map(p => fetchPageText(p.url).catch(() => null)));
    const results = records
      .filter(Boolean)
      .map(r => ({ ...r, score: scoreHit(query, r) }))
      .filter(r => r.score > 0)
      .sort((a,b) => b.score - a.score || a.title.localeCompare(b.title));

    renderResults(results, query);
  }

  function bindUI() {
    const input = document.getElementById(INPUT_ID);
    const box = document.getElementById(RESULTS_ID);
    if (!input || !box) return;

    let t = null;
    input.addEventListener('input', () => {
      clearTimeout(t);
      const q = input.value;
      t = setTimeout(() => search(q), 160);
    });
    input.addEventListener('focus', () => { if (input.value.length >= 2) box.hidden = false; });
    document.addEventListener('click', (e) => {
      if (!box.contains(e.target) && e.target !== input) box.hidden = true;
    });
  }

  // Public hook so runner pages can init the same search bar
  window.initWikiprofiaSearch = async function initWikiprofiaSearch() {
    try {
      if (!pages.length) await loadManifest();
      bindUI();
    } catch (e) {
      console.error('Wikiprofia search init failed', e);
    }
  };
})();
