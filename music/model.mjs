export function summarize(data, year = 'all', artist = '') {
  const tracks = data.tracks.map(track => {
    const stats = track.stats.filter(row => year === 'all' || row[0] === year);
    return { ...track, ms: stats.reduce((sum, row) => sum + row[1], 0), plays: stats.reduce((sum, row) => sum + row[2], 0) };
  }).filter(track => track.ms > 0 && (!artist || track.artist === artist));
  const artistMap = new Map();
  for (const track of tracks) {
    if (!artistMap.has(track.artist)) artistMap.set(track.artist, { name: track.artist, ms: 0, plays: 0, tracks: 0 });
    const entry = artistMap.get(track.artist);
    entry.ms += track.ms; entry.plays += track.plays; entry.tracks++;
  }
  const months = new Map();
  // Include zero-play months between the first and last month in the chosen scope.
  const first = year === 'all' ? data.start.slice(0, 7) : `${year}-01`;
  const last = year === 'all' ? data.end.slice(0, 7) : `${year}-12`;
  let date = new Date(`${first}-01T00:00:00Z`);
  while (date.toISOString().slice(0, 7) <= last) {
    const month = date.toISOString().slice(0, 7);
    if (month >= data.start.slice(0, 7) && month <= data.end.slice(0, 7)) months.set(month, { month, ms: 0, plays: 0 });
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  for (const [month, name, ms, plays] of data.months) {
    if ((year === 'all' || month.startsWith(year)) && (!artist || name === artist)) {
      const entry = months.get(month);
      if (entry) { entry.ms += ms; entry.plays += plays; }
    }
  }
  return {
    tracks, artists: [...artistMap.values()], months: [...months.values()],
    ms: tracks.reduce((sum, track) => sum + track.ms, 0),
    plays: tracks.reduce((sum, track) => sum + track.plays, 0)
  };
}

export function ranking(items, mode = 'ms', query = '') {
  const needle = query.normalize('NFKC').toLocaleLowerCase('ja');
  return items.filter(item => !needle || `${item.title || item.name} ${item.artist || ''}`.normalize('NFKC').toLocaleLowerCase('ja').includes(needle))
    .slice().sort((a, b) => b[mode] - a[mode] || b.ms - a.ms || (a.title || a.name).localeCompare(b.title || b.name, 'ja'));
}
