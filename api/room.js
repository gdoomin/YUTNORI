const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function cmd(args) {
  const r = await fetch(BASE, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const j = await r.json();
  return j.result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!BASE || !TOKEN) { res.status(500).json({ error: 'storage-unconfigured' }); return; }

  const id = String((req.query && req.query.id) || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);

  try {
    if (req.method === 'GET') {
      if (!id) { res.status(400).json({ error: 'id-required' }); return; }
      const val = await cmd(['GET', 'sadari:' + id]);
      if (!val) { res.status(404).json({ error: 'not-found' }); return; }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).send(val);
      return;
    }

    if (req.method === 'POST') {
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (raw.length > 20000) { res.status(413).json({ error: 'too-large' }); return; }
      const newId = id || (Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 6));
      await cmd(['SET', 'sadari:' + newId, raw, 'EX', 60 * 60 * 12]);
      res.status(200).json({ id: newId });
      return;
    }

    res.status(405).json({ error: 'method-not-allowed' });
  } catch (e) {
    res.status(502).json({ error: 'storage-error', detail: String(e).slice(0, 120) });
  }
};
