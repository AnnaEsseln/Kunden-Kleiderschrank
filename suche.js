module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Nur POST erlaubt' });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY fehlt' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const role = body.role || 'Person';
    const size = body.size || 'offen';
    const palette = body.palette || { name: '', desc: '' };
    const style = body.style || '';
    const budget = body.budget || 100;

    const sys = 'Du bist ein erfahrener Styling-Assistent für Familien-Fotoshootings im DACH-Raum. '
      + 'Du findest konkrete, aktuell erhältliche Outfits aus deutschen, österreichischen oder Schweizer Online-Shops. '
      + 'Antworte ausschließlich mit einem gültigen JSON-Objekt, ohne Text davor oder danach und ohne Markdown-Backticks. '
      + 'Schema: {"titel":string,"beschreibung":string,"shop":string,"preis":string,"url":string,"tipp":string}. '
      + 'beschreibung maximal zwei Sätze. tipp ein kurzer Styling-Hinweis. '
      + 'url muss eine funktionierende Shop- oder Suchseite eines DACH-Shops sein.';

    const usr = 'Finde EIN Outfit für eine Person bei einem Familien-Fotoshooting.'
      + ' Rolle: ' + role
      + '. Kleidergröße: ' + size
      + '. Farbpalette: ' + palette.name + ' (' + palette.desc + ')'
      + '. Stilrichtung: ' + style
      + '. Budget: maximal ' + budget + ' Euro pro Person.'
      + ' Nutze die Websuche und schlage ein konkretes, aktuell erhältliches Outfit vor, das farblich zur Palette passt und im Budget liegt.';

    const antwort = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: sys,
        messages: [{ role: 'user', content: usr }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    if (!antwort.ok) {
      const detail = await antwort.text();
      res.status(502).json({ error: 'Anthropic API Fehler', detail: detail });
      return;
    }

    const data = await antwort.json();
    const text = (data.content || [])
      .filter(function (b) { return b.type === 'text'; })
      .map(function (b) { return b.text; })
      .join(' ');

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < 0) {
      res.status(502).json({ error: 'Keine verwertbare Antwort vom Modell' });
      return;
    }

    const outfit = JSON.parse(text.slice(start, end + 1));
    res.status(200).json(outfit);
  } catch (e) {
    res.status(500).json({ error: 'Serverfehler', detail: String(e && e.message ? e.message : e) });
  }
};
