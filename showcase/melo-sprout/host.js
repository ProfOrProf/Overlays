(() => {
  const stateUrl = '../goal';
  let shown = null;
  let firstState = null;

  const fetchState = () => fetch(stateUrl, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  const firstStateReady = (async () => {
    for (;;) {
      const s = await fetchState();
      if (s) { firstState = s; return s; }
      await new Promise(r => setTimeout(r, 1000));
    }
  })();

  window.SE_API = {
    store: {
      get: async () => {
        const s = await firstStateReady;
        shown = Number(s.amount) || 0;
        return { progress: { amount: shown } };
      },
      set: () => {}
    },
    counters: { get: async () => ({ count: 0 }) },
    resumeQueue: () => {},
    sanitize: async ({ message }) => ({ result: { message } }),
    cheerFilter: async (m) => m,
    setField: () => {},
    getOverlayStatus: () => ({ isEditorMode: false, muted: false })
  };

  const progress = () => (typeof client !== 'undefined' && client && client.details && client.details.progress) || null;

  const apply = (amount) => {
    const p = progress();
    if (!p || shown === null) return;
    if (amount === shown) return;
    if (amount === 0) p.reset();
    else if (amount > shown) p.add(amount - shown);
    else p.remove(shown - amount);
    shown = amount;
  };

  const poll = async () => {
    const s = await fetchState();
    if (s) apply(Number(s.amount) || 0);
    setTimeout(poll, 1000);
  };

  window.addEventListener('load', async () => {
    const s = await firstStateReady;
    await new Promise(r => setTimeout(r, 400));
    window.dispatchEvent(new CustomEvent('onWidgetLoad', {
      detail: {
        channel: { username: '', apiToken: '', id: '', providerId: '', avatar: '' },
        currency: { code: 'USD', name: 'U.S. Dollar', symbol: '$' },
        fieldData: s.fieldData || {},
        recents: [],
        session: { data: {} },
        overlay: { isEditorMode: false, muted: false }
      }
    }));
    setTimeout(poll, 1500);
  });
})();
