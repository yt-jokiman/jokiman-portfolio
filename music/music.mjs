import { summarize, ranking } from './model.mjs';

const $ = id => document.getElementById(id);
const state = { year: 'all', artist: '', view: 'artists', sort: 'ms', query: '', limit: 20 };
const number = value => value.toLocaleString('ja-JP');
const hours = ms => (ms / 3600000).toLocaleString('ja-JP', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const name = artist => artist === 'Koresawa' ? 'コレサワ' : artist;
let data, current;

function createArtistOptions() {
  const all = summarize(data);
  ranking(all.artists).forEach(artist => {
    const option = document.createElement('option');
    option.value = artist.name;
    option.textContent = name(artist.name);
    $('artist').append(option);
  });
}

function renderFavorites() {
  // These always show the selected period's top 3, before the artist filter.
  const scope = summarize(data, state.year);
  const leaders = ranking(scope.artists).slice(0, 3);
  $('favorites-period').textContent = `${state.year === 'all' ? '全期間' : `${state.year}年`}のTOP 3`;
  $('favorite-grid').innerHTML = leaders.map((artist, i) => `<button type="button" class="favorite-card" data-artist="${escape(artist.name)}" aria-label="${escape(name(artist.name))}の記録を見る"><span class="favorite-kicker">0${i + 1} / MOST LISTENED</span><span class="arrow" aria-hidden="true">↗</span><h3>${escape(name(artist.name))}</h3><div class="favorite-stats"><span class="favorite-hours">${hours(artist.ms)} <small>時間</small></span><span class="favorite-share">${(artist.ms / scope.ms * 100).toFixed(1)}% of time</span></div></button>`).join('');
}

function renderChart() {
  const max = Math.max(1, ...current.months.map(month => month.ms));
  $('chart').style.setProperty('--n', current.months.length);
  $('chart').innerHTML = current.months.map(month => {
    const label = `${month.month.replace('-', '年')}月`;
    const readout = `${label} — ${hours(month.ms)}時間 / ${number(month.plays)}回`;
    return `<div class="chart-column"><button type="button" class="month-button" style="--height:${month.ms / max * 100}" data-readout="${escape(readout)}" aria-label="${escape(readout)}" aria-pressed="false"><span class="month-bar" aria-hidden="true"></span></button><span class="month-label">${month.month.slice(2).replace('-', '/')}</span></div>`;
  }).join('');
  const peak = current.months.slice().sort((a, b) => b.ms - a.ms)[0];
  $('chart-readout').textContent = peak?.ms ? `最多の月：${peak.month.replace('-', '年')}月 / ${hours(peak.ms)}時間` : 'この条件での再生記録はありません。';
  $('month-data').innerHTML = current.months.map(month => `<div><span>${month.month}</span><span>${hours(month.ms)} 時間</span></div>`).join('');
}

function renderRanking() {
  const isTrack = state.view === 'tracks';
  // Search also supports the Japanese display label for Koresawa.
  const query = state.query.replace(/コレサワ/g, 'Koresawa');
  const results = ranking(isTrack ? current.tracks : current.artists, state.sort, query);
  const max = Math.max(1, ...results.map(row => row[state.sort]));
  $('result-count').textContent = `${number(results.length)} ${isTrack ? 'TRACKS' : 'ARTISTS'}`;
  $('rank-type-label').textContent = isTrack ? 'TRACK / ARTIST' : 'ARTIST';
  $('ranking-list').innerHTML = results.slice(0, state.limit).map((row, i) => {
    const label = isTrack ? row.title : name(row.name);
    const subtitle = isTrack ? name(row.artist) : `${number(row.tracks)}曲`;
    let title;
    if (!isTrack) title = `<button type="button" class="rank-title" data-artist="${escape(row.name)}">${escape(label)}</button>`;
    else if (row.uri) title = `<a class="rank-title" href="https://open.spotify.com/track/${row.uri.split(':')[2]}" target="_blank" rel="noopener noreferrer" aria-label="${escape(label)}をSpotifyで開く（新しいタブ）">${escape(label)} <span aria-hidden="true">↗</span></a>`;
    else title = `<span class="rank-title">${escape(label)}</span>`;
    const primary = state.sort === 'plays' ? `${number(row.plays)} 回` : `${hours(row.ms)} 時間`;
    const secondary = state.sort === 'plays' ? `${hours(row.ms)} 時間` : `${number(row.plays)} 回`;
    return `<li class="rank-row" style="--share:${row[state.sort] / max}"><span class="rank-number">${String(i + 1).padStart(2, '0')}</span><div>${title}<span class="rank-subtitle">${escape(subtitle)}</span></div><span class="rank-value">${primary}<small>${secondary}</small></span></li>`;
  }).join('');
  $('empty').hidden = results.length > 0;
  $('show-more').hidden = results.length <= state.limit;
  $('show-more').textContent = `もっと見る（${Math.min(state.limit, results.length)} / ${number(results.length)}）`;
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
}

function render() {
  current = summarize(data, state.year, state.artist);
  $('total-hours').textContent = hours(current.ms);
  $('total-plays').textContent = number(current.plays);
  $('total-tracks').textContent = number(current.tracks.length);
  $('artist-count').textContent = `${number(current.artists.length)} アーティスト / 1秒未満の再生も曲数に含む`;
  $('scope-label').textContent = `${state.year === 'all' ? '全期間' : `${state.year}年`} / ${state.artist ? name(state.artist) : '音楽のみ'}`;
  $('year').value = state.year;
  $('artist').value = state.artist;
  renderFavorites(); renderChart(); renderRanking();
}

function selectArtist(artist) {
  state.artist = artist; state.view = 'tracks'; state.query = ''; state.limit = 20;
  $('search').value = '';
  render();
}

async function init() {
  try {
    const response = await fetch('./data.json');
    if (!response.ok) throw new Error(`Data request failed (${response.status})`);
    data = await response.json();
    if (data.version !== 1 || !data.tracks?.length) throw new Error('Unexpected archive format');
    $('date-range').textContent = `${data.start.replaceAll('-', '.')} — ${data.end.replaceAll('-', '.')} / JST`;
    for (const year of data.years) {
      const option = document.createElement('option'); option.value = year; option.textContent = `${year}年`; $('year').append(option);
    }
    createArtistOptions();
    $('audit').textContent = `元データ ${number(data.audit.inputRecords)}件 → 音楽 ${number(data.audit.musicRecords)}件。完全重複 ${number(data.audit.duplicates)}件・プライベート ${number(data.audit.privateRecords)}件・音楽以外 ${number(data.audit.nonMusicRecords)}件・0ms／無効 ${number(data.audit.invalidRecords)}件を除外。自動更新ではありません。`;
    $('year').addEventListener('change', event => { state.year = event.target.value; state.limit = 20; render(); });
    $('artist').addEventListener('change', event => { state.artist = event.target.value; state.limit = 20; render(); });
    $('sort').addEventListener('change', event => { state.sort = event.target.value; state.limit = 20; renderRanking(); });
    $('search').addEventListener('input', event => { state.query = event.target.value; state.limit = 20; renderRanking(); });
    $('reset').addEventListener('click', () => { Object.assign(state, { year: 'all', artist: '', view: 'artists', sort: 'ms', query: '', limit: 20 }); $('search').value = ''; $('sort').value = 'ms'; render(); });
    document.querySelector('.switcher').addEventListener('click', event => { const button = event.target.closest('[data-view]'); if (button) { state.view = button.dataset.view; state.limit = 20; renderRanking(); } });
    for (const id of ['favorite-grid', 'ranking-list']) $(id).addEventListener('click', event => { const button = event.target.closest('[data-artist]'); if (button) { selectArtist(button.dataset.artist); $('ranking-title').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); } });
    $('show-more').addEventListener('click', () => { state.limit += 20; renderRanking(); });
    const readMonth = event => {
      const button = event.target.closest('.month-button');
      if (!button) return;
      $('chart-readout').textContent = button.dataset.readout;
      document.querySelectorAll('.month-button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    };
    $('chart').addEventListener('click', readMonth);
    $('chart').addEventListener('focusin', readMonth);
    render();
    $('load-status').hidden = true; $('dashboard').hidden = false;
  } catch (error) {
    console.error('Listening archive could not be loaded:', error);
    $('date-range').textContent = 'LISTENING ARCHIVE';
    $('load-status').innerHTML = '記録を読み込めませんでした。通信状態を確認してページを再読み込みしてください。 <a href="/">ポートフォリオに戻る</a>';
  }
}
init();
