// Run locally: node tools/build-listening-data.mjs /absolute/path/to/export-folder
// Only the allowlisted aggregate below is published. Never copy exports into this repo.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const input = process.argv[2];
if (!input) throw new Error('Provide the local Spotify export folder.');
const files = fs.readdirSync(input).filter(name => /^Streaming_History_(Audio|Video)_.*\.json$/.test(name)).sort();
if (!files.length) throw new Error('No Spotify streaming-history files found.');
const seen = new Set();
const tracks = new Map();
const monthly = new Map();
const artists = new Set();
const years = new Set();
const audit = { inputRecords: 0, duplicates: 0, privateRecords: 0, nonMusicRecords: 0, invalidRecords: 0, musicRecords: 0, musicMs: 0, qualifiedPlays: 0 };
let start = null, end = null;
for (const file of files) {
  const rows = JSON.parse(fs.readFileSync(path.join(input, file), 'utf8'));
  assert(Array.isArray(rows));
  for (const row of rows) {
    audit.inputRecords++;
    const identity = JSON.stringify(Object.keys(row).sort().map(key => [key, row[key]]));
    if (seen.has(identity)) { audit.duplicates++; continue; }
    seen.add(identity);
    if (row.incognito_mode === true) { audit.privateRecords++; continue; }
    const ms = row.ms_played;
    const date = new Date(row.ts);
    if (!Number.isFinite(ms) || ms <= 0 || !Number.isFinite(date.getTime())) { audit.invalidRecords++; continue; }
    const title = row.master_metadata_track_name;
    const artist = row.master_metadata_album_artist_name;
    if (!title || !artist) { audit.nonMusicRecords++; continue; }
    // ts is the END of playback in UTC. Assign each row to its end-date in JST.
    const localDate = new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
    start = start === null || localDate < start ? localDate : start;
    end = end === null || localDate > end ? localDate : end;
    const year = localDate.slice(0, 4), month = localDate.slice(0, 7);
    const play = ms >= 30000 ? 1 : 0;
    audit.musicRecords++; audit.musicMs += ms; audit.qualifiedPlays += play;
    years.add(year); artists.add(artist);
    const key = JSON.stringify([artist, title]);
    if (!tracks.has(key)) tracks.set(key, { title, artist, uri: null, stats: new Map() });
    const track = tracks.get(key);
    if (/^spotify:track:[A-Za-z0-9]{22}$/.test(row.spotify_track_uri || '')) track.uri = row.spotify_track_uri;
    const stats = track.stats.get(year) || [0, 0];
    stats[0] += ms; stats[1] += play;
    track.stats.set(year, stats);
    const monthKey = JSON.stringify([month, artist]);
    const monthStats = monthly.get(monthKey) || [month, artist, 0, 0];
    monthStats[2] += ms; monthStats[3] += play;
    monthly.set(monthKey, monthStats);
  }
}
const data = {
  version: 1,
  source: 'Spotify Extended Streaming History',
  timezone: 'Asia/Tokyo', start, end,
  years: [...years].sort(),
  audit,
  tracks: [...tracks.values()].sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)).map(track => ({
    title: track.title, artist: track.artist, uri: track.uri,
    stats: [...track.stats].sort().map(([year, values]) => [year, ...values])
  })),
  months: [...monthly.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
};
assert.equal(data.tracks.reduce((sum, t) => sum + t.stats.reduce((s, x) => s + x[1], 0), 0), audit.musicMs);
assert.equal(data.months.reduce((sum, m) => sum + m[2], 0), audit.musicMs);
assert.equal(data.tracks.reduce((sum, t) => sum + t.stats.reduce((s, x) => s + x[2], 0), 0), audit.qualifiedPlays);
assert.equal(audit.inputRecords, audit.duplicates + audit.privateRecords + audit.nonMusicRecords + audit.invalidRecords + audit.musicRecords);
const output = path.join(path.dirname(fileURLToPath(import.meta.url)), '../music/data.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(data));
console.log(JSON.stringify({ start, end, artists: artists.size, tracks: data.tracks.length, audit, bytes: fs.statSync(output).size }, null, 2));
