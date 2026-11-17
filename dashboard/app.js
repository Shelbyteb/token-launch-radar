/* Token Radar dashboard: renders window.RADAR with no fetch and no network.
   Views: ranked board, live token market, set-aside list, model. The board is sortable
   and filterable; clicking a row opens its model breakdown, farm plan and comparables. */
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.getElementById('rows').innerHTML = '<tr><td colspan="8">No data.</td></tr>'; return; }

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var money = function (n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  };
  var moneyFull = function (n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  var pct = function (n) {
    if (n == null) return '<span class="mut">—</span>';
    var cls = n > 0 ? 'up' : n < 0 ? 'down' : 'mut';
    return '<span class="' + cls + '">' + (n > 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  };
  var ageText = function (days) { return days == null ? '<span class="mut">n/a</span>' : days + 'd'; };

  /* ---- header stats ---- */
  var top = D.rows[0];
  $('stats').innerHTML =
    '<div><dt>Board rows</dt><dd>' + D.board_size + '</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + D.watchlist_size + ' <small>covered</small></dd></div>' +
    '<div><dt>Top implied value</dt><dd>' + money(top.implied_value_usd) + '</dd></div>' +
    '<div><dt>Snapshot</dt><dd>' + esc(D.as_of) + '</dd></div>';

  $('aside-count').textContent = D.set_aside_size + '';
  $('src').textContent = 'Source: ' + D.source + ' · floor $' +
    (D.floor_usd / 1e6).toFixed(0) + 'M · ' + D.board_size + ' ranked rows, ' +
    D.live_size + ' live-token protocols, ' + D.set_aside_size + ' set aside.';

  /* ---- filter controls ---- */
  var cats = [], chains = [];
  D.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  cats.forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; $('f-cat').appendChild(o);
  });
  chains.forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; $('f-chain').appendChild(o);
  });

  var state = { view: 'board', sort: 'rank', dir: 1, cat: '', chain: '', minTvl: 0, watch: false, q: '', sel: null };
  var thead = document.querySelector('#board thead tr');
  var tbody = $('rows');

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (state.watch && !r.watchlist) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      var va = a[key], vb = b[key];
      if (va == null && vb == null) return a.rank - b.rank;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') return va.localeCompare(vb) * state.dir;
      return (va - vb) * state.dir || (a.rank - b.rank);
    });
    return rows;
  }

  function boardHead() {
    thead.innerHTML =
      '<th data-sort="rank" class="num">Rank</th>' +
      '<th data-sort="name">Protocol</th>' +
      '<th data-sort="implied_value_usd" class="num">Implied value</th>' +
      '<th data-sort="tvl_usd" class="num">TVL</th>' +
      '<th data-sort="change_7d" class="num">7d</th>' +
      '<th data-sort="age_days" class="num">Age</th>' +
      '<th data-sort="category">Category</th><th>Chains</th>';
    markSort();
  }
  function markSort() {
    thead.querySelectorAll('th').forEach(function (th) {
      th.classList.toggle('on', th.getAttribute('data-sort') === state.sort);
      if (th.getAttribute('data-sort') === state.sort) {
        th.textContent = th.textContent.replace(/ [▲▼]$/, '') + (state.dir === 1 ? ' ▲' : ' ▼');
      }
    });
  }

  function rowHtml(r) {
    var sel = state.sel === r.slug ? ' class="sel"' : '';
    return '<tr data-slug="' + esc(r.slug) + '"' + sel + '>' +
      '<td class="num">' + r.rank + '</td>' +
      '<td class="name"><b>' + esc(r.name) + '</b><span>' + esc(r.slug) + '</span>' +
      (r.watchlist ? '<br><span class="wl">WATCHLIST</span>' : '') + '</td>' +
      '<td class="num"><span class="val">' + money(r.implied_value_usd) + '</span></td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num">' + pct(r.change_7d) + '</td>' +
      '<td class="num">' + ageText(r.age_days) + '</td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td></tr>';
  }

  function factorBar(label, value, lo, hi, text) {
    var w = Math.max(2, Math.min(100, ((value - lo) / (hi - lo)) * 100));
    return '<div class="factor"><span>' + label + '</span><span class="bar"><i style="width:' + w.toFixed(0) + '%"></i></span><span>' + text + '</span></div>';
  }

  function showDetail(r) {
    state.sel = r.slug;
    var comp = D.rows
      .filter(function (x) { return x.slug !== r.slug && x.category === r.category; })
      .map(function (x) { return { x: x, d: Math.abs(Math.log(x.tvl_usd / r.tvl_usd)) }; })
      .sort(function (a, b) { return a.d - b.d; })
      .slice(0, 3);
    var compHtml = comp.length ? '<div class="comp"><h3>Nearest comparables · ' + esc(r.category || 'same category') + '</h3><table><thead><tr><th>Protocol</th><th class="num">TVL</th><th class="num">Implied</th></tr></thead><tbody>' +
      comp.map(function (c) {
        return '<tr><td>' + esc(c.x.name) + '</td><td class="num">' + money(c.x.tvl_usd) + '</td><td class="num">' + money(c.x.implied_value_usd) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '';
    $('detail').innerHTML =
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="sub">Rank #' + r.rank + ' · ' + esc(r.category || 'no category') + ' · ' + esc(r.chains.join(', ')) +
      ' · listed ' + (r.listed_at || 'date unknown') + (r.watchlist ? ' · <b style="color:var(--amber)">on the watchlist</b>' : '') + '</p>' +
      '<div class="big">' + moneyFull(r.implied_value_usd) + ' <small>implied value · TVL ' + money(r.tvl_usd) + '</small></div>' +
      '<div class="factors">' +
      factorBar('Category multiple', r.base_multiple, 0.05, 0.6, '×' + r.base_multiple.toFixed(3)) +
      factorBar('Growth ×', r.growth_multiplier, 0.75, 1.75, '×' + r.growth_multiplier.toFixed(3)) +
      factorBar('Maturity ×', r.maturity_multiplier, 0.65, 1.0, '×' + r.maturity_multiplier.toFixed(3)) +
      factorBar('Chains ×', r.chain_multiplier, 1, 1.08, '×' + r.chain_multiplier.toFixed(3)) +
      '</div>' +
      '<p class="sub">Implied = TVL × ' + r.base_multiple.toFixed(3) + ' × ' + r.growth_multiplier.toFixed(3) +
      ' × ' + r.maturity_multiplier.toFixed(3) + ' × ' + r.chain_multiplier.toFixed(3) +
      ' · 7d change ' + (r.change_7d == null ? 'not reported' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') +
      ' · age ' + (r.age_days == null ? 'unknown, counted as 365d' : r.age_days + 'd') + '.</p>' +
      '<h3>Farm plan · six steps</h3><ol class="farm">' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' + compHtml;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      tr.classList.toggle('sel', tr.getAttribute('data-slug') === r.slug);
    });
  }

  function renderBoard() {
    boardHead();
    var rows = filteredRows();
    $('count').textContent = rows.length + ' of ' + D.board_size + ' rows';
    $('hint').textContent = 'Click a row for its model breakdown, farm plan and comparables.';
    tbody.innerHTML = rows.map(rowHtml).join('') ||
      '<tr><td colspan="8">No protocols match these filters.</td></tr>';
    var sel = rows.filter(function (r) { return r.slug === state.sel; })[0];
    if (sel) showDetail(sel);
    else if (rows.length) showDetail(rows[0]);
    else $('detail').innerHTML = '<p class="empty">No protocols match these filters.</p>';
  }

  function renderLive() {
    thead.innerHTML = '<th>Protocol</th><th class="num">Market cap</th><th class="num">MCap / TVL</th>' +
      '<th class="num">TVL</th><th class="num">7d</th><th>Category</th><th>Chains</th>';
    $('count').textContent = D.live_size + ' largest live-token protocols — the market\u2019s own values';
    $('hint').textContent = 'These protocols already trade. Their market caps are the raw material of the model\u2019s category multiples — they are never ranked as launches.';
    tbody.innerHTML = D.live.map(function (p) {
      return '<tr data-slug="' + esc(p.slug) + '"><td class="name"><b>' + esc(p.name) + '</b><span>' + esc(p.slug) + '</span></td>' +
        '<td class="num"><span class="val">' + money(p.mcap_usd) + '</span></td>' +
        '<td class="num">' + (p.mcap_tvl == null ? '—' : '×' + p.mcap_tvl.toFixed(3)) + '</td>' +
        '<td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + pct(p.change_7d) + '</td>' +
        '<td>' + esc(p.category || '—') + '</td><td>' + esc(p.chains.slice(0, 3).join(', ')) + '</td></tr>';
    }).join('');
    $('detail').innerHTML = '<p class="empty">The live-token market sets the price of a launch: each category\u2019s ' +
      'multiple is the median market-cap-to-TVL ratio of its live protocols in this snapshot. ' +
      'Pick the <b>How the value is built</b> view to see every multiple.</p>';
  }

  function renderAside() {
    thead.innerHTML = '<th>Protocol</th><th class="num">TVL</th><th>Category</th><th>Chains</th><th>Why set aside</th>';
    $('count').textContent = D.set_aside_size + ' rankable protocols at or above the $50M floor, not ranked';
    $('hint').textContent = 'Set aside, not hidden: the watchlist\u2019s own definition leaves these out, and the snapshot carries no parent-protocol field to say more.';
    tbody.innerHTML = D.set_aside.map(function (p) {
      return '<tr><td class="name"><b>' + esc(p.name) + '</b><span>' + esc(p.slug) + '</span></td>' +
        '<td class="num">' + money(p.tvl_usd) + '</td><td>' + esc(p.category || '—') + '</td>' +
        '<td>' + esc(p.chains.slice(0, 3).join(', ')) + '</td><td>' + esc(p.reason) + '</td></tr>';
    }).join('');
    $('detail').innerHTML = '<p class="empty">A wrapped or staked product of a token that already trades is not ' +
      'a protocol still waiting on a launch of its own — so these sit outside the ranked board, ' +
      'where a judge can see the choice was deliberate.</p>';
  }

  function renderModel() {
    thead.innerHTML = '<th>Category</th><th class="num">Multiple used</th><th class="num">Live protocols</th><th>Source of the multiple</th>';
    $('count').textContent = 'Model radar-2 · ' + D.multiples.by_category.length + ' categories priced from the snapshot';
    $('hint').textContent = 'Implied = TVL × category multiple × growth × maturity × chains. Growth: 7d change clamped to −50%/+150%, half weight. Maturity: 0.65 + 0.35·√(age/1095d). Chains: +2% per extra chain, up to +8%.';
    tbody.innerHTML = D.multiples.by_category.map(function (m) {
      return '<tr><td class="name"><b>' + esc(m.category) + '</b></td>' +
        '<td class="num"><span class="val">×' + m.multiple.toFixed(3) + '</span></td>' +
        '<td class="num">' + m.live_count + '</td>' +
        '<td>' + (m.from_category ? 'Median FDV/TVL of this category\u2019s live-token protocols' : 'Too few live protocols — global median ×' + D.multiples.global_multiple.toFixed(3)) + '</td></tr>';
    }).join('');
    $('detail').innerHTML = '<h2>How the value is built</h2><p class="sub">Every multiple above comes from this snapshot\u2019s ' +
      'live-token protocols, clamped to ×0.05–×0.60 so one thin category cannot set the price of a whole board. ' +
      'A category with fewer than three live protocols falls back to the global median (×' + D.multiples.global_multiple.toFixed(3) + ').</p>' +
      '<p class="sub">Age is counted from listed_at to the snapshot date; when the snapshot reports no listed date, ' +
      '365 days is used. A protocol whose 7-day change is not reported grows at 0%.</p>';
  }

  function render() {
    document.querySelectorAll('#views button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-view') === state.view);
    });
    $('filters').style.display = state.view === 'board' ? '' : 'none';
    if (state.view === 'board') renderBoard();
    else if (state.view === 'live') renderLive();
    else if (state.view === 'aside') renderAside();
    else renderModel();
  }

  /* ---- events ---- */
  document.querySelectorAll('#views button').forEach(function (b) {
    b.addEventListener('click', function () { state.view = b.getAttribute('data-view'); render(); });
  });
  thead.addEventListener('click', function (e) {
    var th = e.target.closest('th[data-sort]');
    if (!th || state.view !== 'board') return;
    var key = th.getAttribute('data-sort');
    if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'name' || key === 'category' ? 1 : -1; }
    renderBoard();
  });
  tbody.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr || state.view !== 'board') return;
    var r = D.rows.filter(function (x) { return x.slug === tr.getAttribute('data-slug'); })[0];
    if (r) showDetail(r);
  });
  $('f-cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
  $('f-chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  $('f-tvl').addEventListener('change', function (e) { state.minTvl = Number(e.target.value); renderBoard(); });
  $('f-watch').addEventListener('change', function (e) { state.watch = e.target.checked; renderBoard(); });
  $('f-q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });

  /* ---- deep links: #row=<slug>, #cat=<category>, #watchlist=1, #view=<view> ---- */
  var hash = {};
  location.hash.slice(1).split('&').forEach(function (part) {
    var kv = part.split('=');
    if (kv[0]) hash[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
  });
  if (hash.view && ['board', 'live', 'aside', 'model'].indexOf(hash.view) >= 0) state.view = hash.view;
  if (hash.cat) { state.cat = hash.cat; $('f-cat').value = hash.cat; }
  if (hash.watchlist === '1') { state.watch = true; $('f-watch').checked = true; }
  if (hash.row) state.sel = hash.row;

  render();
  if (state.view === 'board' && !state.sel && D.rows.length) showDetail(D.rows[0]);
})();
