// Interaction smoke tests against a minimal DOM double; not a visual browser test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { summarize, ranking } from '../music/model.mjs';
const data = JSON.parse(fs.readFileSync(new URL('../music/data.json', import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL('../music/music.mjs', import.meta.url), 'utf8').replace(/^import[^\n]*\n/, '');
const html = fs.readFileSync(new URL('../music/index.html', import.meta.url), 'utf8');
class Element {
  constructor() { this.hidden = false; this.value = ''; this.textContent = ''; this.innerHTML = ''; this.dataset = {}; this.events = {}; this.children = []; this.attrs = {}; this.style = { setProperty() {} }; }
  addEventListener(name, handler) { this.events[name] = handler; }
  append(node) { this.children.push(node); }
  setAttribute(key, value) { this.attrs[key] = value; }
  scrollIntoView() {}
  dispatch(name, event = { target: this }) { this.events[name]?.(event); }
}
async function setup(fail = false) {
  const ids = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
  ids.get('dashboard').hidden = true;
  const switcher = new Element(), buttons = ['artists', 'tracks'].map(view => { const button = new Element(); button.dataset.view = view; return button; });
  const errors = [];
  const context = {
    summarize, ranking,
    document: { getElementById: id => ids.get(id), createElement: () => new Element(), querySelector: () => switcher, querySelectorAll: selector => selector === '[data-view]' ? buttons : [] },
    fetch: async () => ({ ok: !fail, status: fail ? 503 : 200, json: async () => data }),
    console: { error: (...args) => errors.push(args) },
    matchMedia: () => ({ matches: true })
  };
  await vm.runInNewContext(source, context);
  return { ids, switcher, buttons, errors };
}
test('loads data, changes year, searches tracks, sorts, paginates and resets', async () => {
  const { ids, switcher, buttons, errors } = await setup();
  assert.equal(errors.length, 0);
  assert.equal(ids.get('dashboard').hidden, false);
  assert.equal(ids.get('load-status').hidden, true);
  assert.equal(ids.get('total-hours').textContent, '4,608.5');
  assert.equal((ids.get('ranking-list').innerHTML.match(/class="rank-row"/g) || []).length, 20);
  ids.get('show-more').dispatch('click');
  assert.equal((ids.get('ranking-list').innerHTML.match(/class="rank-row"/g) || []).length, 40);
  ids.get('year').value = '2026'; ids.get('year').dispatch('change');
  assert(ids.get('scope-label').textContent.includes('2026年'));
  switcher.dispatch('click', { target: { closest: () => buttons[1] } });
  ids.get('search').value = 'コレサワ'; ids.get('search').dispatch('input');
  assert(ids.get('ranking-list').innerHTML.includes('コレサワ'));
  assert(!ids.get('ranking-list').innerHTML.includes('SHISHAMO'));
  ids.get('sort').value = 'plays'; ids.get('sort').dispatch('change');
  ids.get('search').value = 'no-match-987654321'; ids.get('search').dispatch('input');
  assert.equal(ids.get('empty').hidden, false);
  ids.get('reset').dispatch('click');
  assert.equal(ids.get('total-hours').textContent, '4,608.5');
  assert.equal(ids.get('year').value, 'all');
  assert.equal(ids.get('search').value, '');
});
test('artist shortcut and error state', async () => {
  const { ids } = await setup();
  ids.get('favorite-grid').dispatch('click', { target: { closest: () => ({ dataset: { artist: 'SHISHAMO' } }) } });
  assert.equal(ids.get('artist').value, 'SHISHAMO');
  assert.equal(ids.get('total-hours').textContent, '2,319.9');
  assert.equal(ids.get('rank-type-label').textContent, 'TRACK / ARTIST');
  const failed = await setup(true);
  assert.equal(failed.ids.get('dashboard').hidden, true);
  assert(failed.ids.get('load-status').innerHTML.includes('読み込めませんでした'));
  assert.equal(failed.errors.length, 1);
});
