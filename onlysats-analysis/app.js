(() => {
  const articles = window.ONLYSATS_ARTICLES || [];
  if (!articles.length) return;

  const $ = id => document.getElementById(id);
  const number = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dateTime = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shortDate = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const chartCanvas = $('price-chart');
  const chartWrap = chartCanvas.parentElement;
  const tooltip = $('chart-tooltip');
  const modeButtons = [...document.querySelectorAll('.mode-button')];
  let current = null;
  let hoverIndex = -1;
  let mode = 'beginner';
  try { mode = localStorage.getItem('onlysats-reading-mode') === 'pro' ? 'pro' : 'beginner'; } catch {}

  const text = (id, value) => { $(id).textContent = value; };
  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  };
  const price = value => value == null ? '—' : number.format(value);
  const unit = article => article.pair.endsWith('USDT') ? 'USDT' : 'USD';
  const fullPrice = (article, value) => value == null ? 'non disponibile' : `${price(value)} ${unit(article)}`;
  const tfLabel = timeframe => timeframe === '1mo' ? '1M' : timeframe.toUpperCase();
  const marketTime = article => Date.parse(article.asOf.replace(' UTC', 'Z').replace(' ', 'T'));
  const featured = [...articles].filter(article => article.timeframe === '1w').sort((a, b) => marketTime(b) - marketTime(a))[0] || articles[0];
  const articleFromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    return articles.find(article => article.id === id) || featured;
  };

  function renderCopy() {
    const content = current[mode];
    text('article-intro', content.intro);
    text('mode-description', mode === 'pro'
      ? 'Indicatori, struttura di mercato e scenari condizionali.'
      : 'Parole semplici, termini spiegati e contesto per iniziare.');
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    const sections = $('article-sections');
    sections.replaceChildren();
    for (const item of content.sections) {
      const section = node('section', 'analysis-section');
      section.append(node('h3', '', item.title), node('p', '', item.body));
      sections.append(section);
    }
    const glossaryHost = $('glossary');
    glossaryHost.replaceChildren();
    if (content.glossary?.length) {
      const box = node('div', 'glossary');
      const definitions = node('dl');
      for (const item of content.glossary) {
        definitions.append(node('dt', '', item.term), node('dd', '', item.meaning));
      }
      box.append(node('h3', '', 'Parole da conoscere'), definitions);
      glossaryHost.append(box);
    }
  }

  function renderAside() {
    const list = $('indicator-list');
    list.replaceChildren();
    const metrics = [
      ['RSI (14)', decimal.format(current.momentum.rsi)],
      ['EMA 20', fullPrice(current, current.trend.ema20)],
      ['EMA 50', fullPrice(current, current.trend.ema50)],
      ['EMA 200', fullPrice(current, current.trend.ema200)],
      ['ADX', decimal.format(current.trend.adx)],
      ['MACD istogramma', number.format(current.momentum.macdHist)],
      ['Volume / media 20', `${decimal.format(current.volumeVsSma20)}×`]
    ];
    for (const [label, value] of metrics) {
      const row = node('div');
      row.append(node('dt', '', label), node('dd', '', value));
      list.append(row);
    }
    const sources = $('source-list');
    sources.replaceChildren();
    for (const source of current.sources) {
      const item = node('li');
      const link = node('a', '', source.attribution || source.name);
      link.href = source.terms;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
      sources.append(item);
    }
    text('source-caveat', 'Valori riferiti allo snapshot indicato. Le candele e gli indicatori possono cambiare fino alla chiusura della barra.');
    const cycleLink = $('cycle-link');
    cycleLink.hidden = !current.cycleChart;
    if (current.cycleChart) cycleLink.href = current.cycleChart;
  }

  function renderArchive() {
    const grid = $('archive-grid');
    grid.replaceChildren();
    text('archive-count', `${articles.length} ANALISI`);
    for (const article of [...articles].sort((a, b) => marketTime(b) - marketTime(a))) {
      const button = node('button', 'archive-card');
      button.type = 'button';
      button.setAttribute('aria-current', String(article.id === current.id));
      const date = dateTime.format(new Date(article.generatedAt));
      const label = node('small', '', `${tfLabel(article.timeframe)} · ${date}`);
      const title = node('strong', '', article.title);
      const end = node('span', '', article.label);
      const arrow = node('span', 'arrow', '↗');
      end.append(arrow);
      button.append(label, title, end);
      button.addEventListener('click', () => {
        if (location.hash.slice(1) === article.id) renderArticle(article);
        else location.hash = article.id;
        window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      });
      grid.append(button);
    }
  }

  function renderTimeframes() {
    const host = $('timeframe-options');
    host.replaceChildren();
    const latest = new Map();
    for (const article of [...articles].sort((a, b) => marketTime(b) - marketTime(a))) {
      if (!latest.has(article.timeframe)) latest.set(article.timeframe, article);
    }
    for (const tf of ['1w', '1mo']) {
      const article = latest.get(tf);
      if (!article) continue;
      const button = node('button', '', tfLabel(tf));
      button.type = 'button';
      button.setAttribute('aria-label', `Apri l'analisi ${tf === '1mo' ? 'mensile' : 'settimanale'} più recente`);
      button.setAttribute('aria-pressed', String(tf === current.timeframe));
      button.addEventListener('click', () => {
        if (location.hash.slice(1) === article.id) renderArticle(article);
        else location.hash = article.id;
      });
      host.append(button);
    }
  }

  function renderArticle(article) {
    current = article;
    hoverIndex = -1;
    tooltip.hidden = true;
    document.title = `${article.title} — OnlySats Analysis`;
    text('article-label', article.label);
    text('article-date', dateTime.format(new Date(article.generatedAt)));
    text('article-title', article.title);
    const stamp = article.asOf.replace(' UTC', '').replace(' ', ' · ');
    text('snapshot-note', `Dati al ${stamp} UTC · ${article.lastBarClosed ? 'barra chiusa' : 'barra in corso'} · snapshot, non quotazione in tempo reale`);
    text('metric-price', price(article.price));
    text('metric-pair', article.pair);
    const change = $('metric-change');
    change.textContent = `${article.changePct >= 0 ? '+' : ''}${decimal.format(article.changePct)}%`;
    change.className = article.changePct >= 0 ? 'positive' : 'negative';
    text('metric-timeframe', `su 1 barra ${article.timeframe}`);
    text('metric-support', price(article.support));
    text('metric-resistance', price(article.resistance));
    text('chart-pair', `${article.pair} / ${tfLabel(article.timeframe)}`);
    text('chart-period', `${article.candles.length} BARRE`);
    $('full-chart-link').href = article.chart;
    $('chart-caption-link').href = article.chart;
    chartCanvas.setAttribute('aria-label', `Prezzo ${article.pair} nelle ultime ${article.candles.length} barre ${article.timeframe}. Supporto ${fullPrice(article, article.support)}, resistenza ${fullPrice(article, article.resistance)}.`);
    renderCopy();
    renderAside();
    renderTimeframes();
    renderArchive();
    drawChart();
  }

  function drawChart() {
    if (!current) return;
    const bounds = chartWrap.getBoundingClientRect();
    const width = Math.max(300, bounds.width);
    const height = Math.max(240, bounds.height);
    const dpr = window.devicePixelRatio || 1;
    chartCanvas.width = Math.round(width * dpr);
    chartCanvas.height = Math.round(height * dpr);
    const ctx = chartCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const rows = current.candles;
    const prices = rows.map(row => row[1]);
    const low = Math.min(...prices, current.support, current.resistance);
    const high = Math.max(...prices, current.support, current.resistance);
    const padding = Math.max(1, (high - low) * .09);
    const yMin = low - padding;
    const yMax = high + padding;
    const left = width < 520 ? 8 : 20;
    const right = width < 520 ? 55 : 76;
    const top = 16;
    const bottom = 32;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const x = index => left + index / (rows.length - 1) * plotWidth;
    const y = value => top + (yMax - value) / (yMax - yMin) * plotHeight;
    chartCanvas._chartGeometry = { left, right, plotWidth, rows };

    ctx.font = width < 520 ? '10px system-ui' : '11px system-ui';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#273845';
    ctx.fillStyle = '#8797a2';
    ctx.lineWidth = 1;
    for (let step = 0; step <= 4; step++) {
      const yy = top + step * plotHeight / 4;
      ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(width - right, yy); ctx.stroke();
      ctx.fillText(price(yMax - step * (yMax - yMin) / 4), width - right + 8, yy);
    }
    for (let step = 0; step <= 3; step++) {
      const xx = left + step * plotWidth / 3;
      ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, height - bottom); ctx.stroke();
      const index = Math.round(step * (rows.length - 1) / 3);
      const label = shortDate.format(new Date(rows[index][0] * 1000));
      ctx.fillText(label, Math.min(xx, width - right - 32), height - 12);
    }

    const levels = [
      { value: current.support, name: 'S', color: '#6e9ec3' },
      { value: current.resistance, name: 'R', color: '#f1a15a' }
    ];
    for (const level of levels) {
      const yy = y(level.value);
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = level.color;
      ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(width - right, yy); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = level.color;
      ctx.fillText(level.name, width - right + 8, Math.max(top + 8, Math.min(height - bottom - 8, yy - 12)));
    }

    const gradient = ctx.createLinearGradient(0, top, 0, height - bottom);
    gradient.addColorStop(0, 'rgba(119,211,197,.22)');
    gradient.addColorStop(1, 'rgba(119,211,197,0)');
    ctx.beginPath();
    rows.forEach((row, index) => index ? ctx.lineTo(x(index), y(row[1])) : ctx.moveTo(x(index), y(row[1])));
    ctx.lineTo(x(rows.length - 1), height - bottom);
    ctx.lineTo(left, height - bottom);
    ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
    ctx.beginPath();
    rows.forEach((row, index) => index ? ctx.lineTo(x(index), y(row[1])) : ctx.moveTo(x(index), y(row[1])));
    ctx.strokeStyle = '#77d3c5'; ctx.lineWidth = 2.25; ctx.lineJoin = 'round'; ctx.stroke();
    const selected = hoverIndex >= 0 ? hoverIndex : rows.length - 1;
    const xx = x(selected), yy = y(rows[selected][1]);
    if (hoverIndex >= 0) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = '#91a4b0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, height - bottom); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.arc(xx, yy, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#0a1119'; ctx.fill();
    ctx.beginPath(); ctx.arc(xx, yy, 3, 0, Math.PI * 2); ctx.fillStyle = '#77d3c5'; ctx.fill();
  }

  chartCanvas.addEventListener('pointermove', event => {
    if (!current || !chartCanvas._chartGeometry) return;
    const rect = chartCanvas.getBoundingClientRect();
    const { left, plotWidth, rows } = chartCanvas._chartGeometry;
    hoverIndex = Math.max(0, Math.min(rows.length - 1, Math.round(((event.clientX - rect.left - left) / plotWidth) * (rows.length - 1))));
    const row = rows[hoverIndex];
    tooltip.replaceChildren(
      node('strong', '', fullPrice(current, row[1])),
      node('span', '', new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(row[0] * 1000)) + ' UTC')
    );
    tooltip.hidden = false;
    drawChart();
  });
  chartCanvas.addEventListener('pointerleave', () => { hoverIndex = -1; tooltip.hidden = true; drawChart(); });
  modeButtons.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    try { localStorage.setItem('onlysats-reading-mode', mode); } catch {}
    renderCopy();
  }));
  window.addEventListener('hashchange', () => {
    const selected = articles.find(article => article.id === decodeURIComponent(location.hash.slice(1)));
    if (selected) renderArticle(selected);
  });
  if ('ResizeObserver' in window) new ResizeObserver(drawChart).observe(chartWrap);
  else window.addEventListener('resize', drawChart);
  renderArticle(articleFromHash());
})();
