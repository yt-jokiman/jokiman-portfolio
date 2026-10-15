# jokiman-portfolio
Jokiman personal portfolio website

## Listening Archive

`/music/` is a static music-only archive. It shares the portfolio's hosting and has no external runtime dependencies. It is marked `noindex` while the site is in progress; this is not access protection.

The public JSON is an allowlisted aggregate, never the Spotify export. IP addresses, platform/country fields, individual timestamps, private-session records and podcast titles are not included.

To rebuild from an export kept **outside this repository**:

```sh
node tools/build-listening-data.mjs /absolute/path/to/spotify-export
node --test tests/listening.test.mjs
```

Pass all Audio and Video JSON files together. The generator removes exact full-record duplicates; it assigns listening time to the playback end timestamp converted to JST. Time includes positive partial plays; displayed play counts require at least 30 seconds. Tracks are grouped by exact artist and title. `Koresawa` is displayed as `コレサワ` without changing the source grouping.

Publish only reviewed website files and aggregate data; never upload raw exports or the ReadMe PDF. A repository push to the existing production branch deploys through the connected Vercel project.
