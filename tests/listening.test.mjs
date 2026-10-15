import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarize, ranking } from '../music/model.mjs';
const data = JSON.parse(fs.readFileSync(new URL('../music/data.json', import.meta.url), 'utf8'));

test('all-time, year, artist and month totals reconcile', () => {
  const all = summarize(data);
  assert.equal(all.ms, data.audit.musicMs);
  assert.equal(all.plays, data.audit.qualifiedPlays);
  assert.equal(all.months.reduce((s, r) => s + r.ms, 0), all.ms);
  assert.equal(data.years.reduce((s, year) => s + summarize(data, year).ms, 0), all.ms);
  assert.equal(all.artists.reduce((s, a) => s + a.ms, 0), all.ms);
  for (const year of data.years) {
    const scope = summarize(data, year);
    assert.equal(scope.months.reduce((s, r) => s + r.ms, 0), scope.ms);
    assert.equal(scope.months.reduce((s, r) => s + r.plays, 0), scope.plays);
    for (const artist of ranking(scope.artists).slice(0, 5)) {
      const selected = summarize(data, year, artist.name);
      assert.equal(selected.ms, artist.ms);
      assert.equal(selected.months.reduce((s, r) => s + r.ms, 0), selected.ms);
    }
  }
});
test('rankings, search, artist filter and empty state', () => {
  const all = summarize(data);
  assert.equal(ranking(all.artists)[0].name, 'SHISHAMO');
  for (const metric of ['ms', 'plays']) {
    const result = ranking(all.tracks, metric);
    assert(result.every((r, i) => i === 0 || r[metric] <= result[i - 1][metric]));
  }
  assert(ranking(all.tracks, 'ms', 'shishamo').every(r => r.artist.toLowerCase().includes('shishamo') || r.title.toLowerCase().includes('shishamo')));
  assert.equal(summarize(data, 'all', 'nonexistent').tracks.length, 0);
  assert.equal(ranking(all.tracks, 'ms', 'no-match-987654321').length, 0);
});
test('all 68 months are present; timestamps use JST, not file-year labels', () => {
  const months = summarize(data).months;
  assert.equal(months.length, 68);
  assert.equal(months[0].month, '2021-03');
  assert.equal(months.at(-1).month, '2026-10');
  assert.equal(summarize(data, '2026').months.length, 10);
});
test('public data uses only approved keys and valid Spotify track identifiers', () => {
  assert.deepEqual(Object.keys(data).sort(), ['version', 'source', 'timezone', 'start', 'end', 'years', 'audit', 'tracks', 'months'].sort());
  for (const track of data.tracks) {
    assert.deepEqual(Object.keys(track).sort(), ['title', 'artist', 'uri', 'stats'].sort());
    assert(track.uri === null || /^spotify:track:[A-Za-z0-9]{22}$/.test(track.uri));
    for (const [year, ms, plays] of track.stats) {
      assert(/^20\d\d$/.test(year)); assert(ms > 0); assert(Number.isInteger(plays)); assert(plays >= 0);
    }
  }
  for (const row of data.months) { assert.equal(row.length, 4); assert(/^20\d\d-\d\d$/.test(row[0])); }
  assert(!/"(?:ip_addr|platform|conn_country|ts|episode_name|username|offline_timestamp)"\s*:/.test(JSON.stringify(data)));
});
test('page links and DOM targets exist', () => {
  const html = fs.readFileSync(new URL('../music/index.html', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../music/music.mjs', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, id] of js.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(id), `Missing #${id}`);
  for (const file of ['music.css', 'music.mjs', 'model.mjs', 'data.json']) assert(fs.existsSync(new URL(`../music/${file}`, import.meta.url)));
  assert(html.includes('noindex, follow'));
  const homepage = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(homepage.includes('href="/music/"'));
});
