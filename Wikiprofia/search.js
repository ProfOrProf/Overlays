(function () {
  const INPUT_ID = 'wikia-search-input';
  const RESULTS_ID = 'wikia-search-results';

  let pages = [];
  let articles = new Map();

  async function loadManifest() {
    const res = await fetch('/wikiprofia/manifest.json', { cache: 'no-store' });
    const data = await res.json();
    pages = data.runners || [];
  }

  async function loadArticles() {
    const own = pages.filter(p => p.page);
    await Promise.all(own.map(async p => {
      try {
        const res = await fetch(p.url, { cache: 'force-cache' });
        if (!res.ok) return;
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        doc.querySelectorAll('script, style, noscript').forEach(n => n.remove());
        const text = (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ').trim();
        if (text) articles.set(p.twitch, text);
      } catch (_) { }
    }));
  }

  function haystack(p) {
    return [p.title, p.twitch, p.description || '', articles.get(p.twitch) || ''].join(' ');
  }

  function score(q, p) {
    const ql = q.toLowerCase();
    let s = 0;
    if (p.title.toLowerCase() === ql || p.twitch === ql) s += 12;
    else if (p.title.toLowerCase().includes(ql) || p.twitch.includes(ql)) s += 6;
    if ((p.description || '').toLowerCase().includes(ql)) s += 2;
    if ((articles.get(p.twitch) || '').toLowerCase().includes(ql)) s += 1;
    return s;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function snippet(p, query, max = 180) {
    const text = p.description || articles.get(p.twitch) || '';
    if (!text) return '';
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    const start = idx < 0 ? 0 : Math.max(0, idx - Math.floor(max / 2));
    const slice = esc(text.slice(start, start + max));
    const pat = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const marked = slice.replace(new RegExp(pat, 'ig'), m => `<b>${m}</b>`);
    return (start > 0 ? '…' : '') + marked + (start + max < text.length ? '…' : '');
  }

  function render(items, query) {
    const box = document.getElementById(RESULTS_ID);
    if (!items.length) {
      box.innerHTML = `<div class="result">No results for &ldquo;${esc(query)}&rdquo;.</div>`;
      box.hidden = false;
      return;
    }
    box.innerHTML = items.slice(0, 40).map(p => `
      <div class="result">
        <a class="title" href="${esc(p.url)}">${esc(p.title)}</a>
        <div class="snippet">${snippet(p, query)}</div>
      </div>
    `).join('');
    box.hidden = false;
  }

  function search(query) {
    const box = document.getElementById(RESULTS_ID);
    if (!query || query.trim().length < 2) { box.hidden = true; return; }
    const q = query.trim();
    const hits = pages
      .map(p => ({ p, s: score(q, p) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || a.p.title.localeCompare(b.p.title))
      .map(x => x.p);
    render(hits, q);
  }

  function bindUI() {
    const input = document.getElementById(INPUT_ID);
    const box = document.getElementById(RESULTS_ID);
    if (!input || !box) return;
    let t = null;
    input.addEventListener('input', () => {
      clearTimeout(t);
      const q = input.value;
      t = setTimeout(() => search(q), 120);
    });
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) box.hidden = false; });
    document.addEventListener('click', e => {
      if (!box.contains(e.target) && e.target !== input) box.hidden = true;
    });
  }

  window.initWikiprofiaSearch = async function initWikiprofiaSearch() {
    try {
      if (!pages.length) await loadManifest();
      bindUI();
      loadArticles();
    } catch (e) {
      console.error('Wikiprofia search init failed', e);
    }
  };
})();
