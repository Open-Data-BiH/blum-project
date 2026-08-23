# Transit network data

`public/data/transport/routes/transit_network.json` is the single dataset behind the
stop markers on the homepage map, the full-screen map page (`/mapa/`), the route view,
and the route map on line pages.

Route geometry lives beside it in `public/data/transport/routes/shapes/<route id>.json`,
one file per direction, fetched only when that route is shown.

Both are **generated** — never edit them by hand:

```bash
npm run data:transit
```

The generator is `scripts/build-transit-network.mjs`. Its inputs are listed in
`scripts/transit-source.json`: the operator export bundle (routes, stops and route stops),
the route geometry as GeoJSON, and the flat row dump, plus `urban_bus_routes.json`, which
supplies **line colours** and the stops for lines the export does not cover. All inputs are
read-only.

The export also carries a colour per route, which is deliberately **not** used — the site
keeps its own palette, and the export disagrees with itself (line 13P has a different
colour per direction).

## Data model

Three flat tables, so nothing is stored twice and every relationship is a lookup by id.

```jsonc
{
  "meta":  { "generated": "…", "mergeRadiusMeters": 30, "counts": { … }, "warnings": [ … ] },
  "lines": [ { "id": "19", "color": "#ff9f43", "routes": ["19-sargovac-centar", "19-centar-sargovac"] } ],
  "routes": [
    {
      "id": "19-sargovac-centar",
      "lineId": "19",
      "relation": "ŠARGOVAC - CENTAR (VIDOVDANSKA)",
      "origin": "ŠARGOVAC", "via": [], "destination": "CENTAR (VIDOVDANSKA)",
      "timing": "a",
      "direction": "a",
      "hasShape": true,
      "stops": [ { "stopId": "st-253", "seq": 1, "role": "start", "time": 0, "distance": 0 } ]
    }
  ],
  "stops": [
    { "id": "st-253", "name": "Okretnica Tunjice", "street": null,
      "lat": 44.836, "lon": 17.168, "source": "registry", "lines": ["19"],
      "mergedIds": ["st-5531"] }
  ]
}
```

- **`lines`** are the public line numbers riders know (`19`, `13A`). A line lists the
  route variants that belong to it, so the number and its directions stay distinct.
- **`routes`** are the direction variants. Every covered line has both directions except
  line 3, which the export publishes one way only. They are never merged, because their
  stop lists genuinely differ.
- **`stops`** hold coordinates once; routes reference them by id.
- **Geometry** is kept out of this file on purpose. Inlining all 21,231 points would add
  about 79 kB gzip to every homepage visit; per-route files cost ~2.4 kB for the one route
  a reader actually opens. `hasShape` says whether the file exists.

Derived views (stop → lines, ordered stops of a route) are built at runtime by
`src/lib/transit.ts`, so the file stays the only source of truth.

## Stop arrival estimates

Stop popups combine the published departure timetable with cumulative route-stop `time`
values. They are schedule-based estimates, not GPS positions or live predictions.

An estimate is shown only when the timetable direction can be matched to the route, the
selected stop lies inside that route's nominal origin→destination slice, and every source
sequence and timing segment from the nominal start to the stop is complete. Timetable notes
describe branches, extensions, short turns, or alternate origins, but the source has no
machine-readable mapping from those patterns to stops. A direction and service day containing
an annotated departure is therefore treated as unavailable; skipping that departure could
incorrectly promote a later regular trip as the next bus. Rows that do not meet these
conditions say that an estimate is currently unavailable instead of inventing a time.

The browser applies the same weekday/weekend and school-holiday schedule selection as the
full timetable. It considers a late trip that crosses midnight and, after today's service is
exhausted, may show the first departure for the following day.

### IDs

| Kind            | Format                        | Example              |
| --------------- | ----------------------------- | -------------------- |
| Stop (registry) | `st-` + operator stop number  | `st-1538`            |
| Stop (derived)  | `st-` + slug of the stop name | `st-pivara`          |
| Route           | line + direction endpoints    | `19-sargovac-centar` |
| Line            | the public line number        | `13A`                |

Route ids describe the direction so they can be read at a glance and used in markup.
Parenthetical qualifiers are dropped (`ZALUŽANI (NENADA KOSTIĆA)` → `zaluzani`); a numeric
suffix is appended if two variants of a line would otherwise collide.

### Stop sources

- `registry` — from the operator's stop export: stable id, surveyed coordinates, and the
  routes that call there.
- `derived` — read out of `urban_bus_routes.json` for stops the export does not contain
  (lines 3B, 9C, 14B, 17 and 17A have no route data at all). Keyed by name, so they carry
  no route data and cannot open a route view.

### Merging the two sources

The two datasets describe the same city at different vintages, so the generator folds a
derived stop into a registry stop when one of these holds, in order of confidence:

| Rule                            | Radius | Why                                                                                                                                              |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| same name **and** a shared line | 600 m  | Some legacy coordinates are badly off — "Gimnazija" is 246 m from its counterpart, "Široka rijeka" 273 m. A shared line makes the identity safe. |
| same name                       | 150 m  | Ordinary coordinate drift ("Poljoprivredna škola" is 97 m out).                                                                                  |
| any name                        | 30 m   | Close enough to be the same kerb, whatever the two sources call it.                                                                              |

A name match outranks a merely closer stop: the legacy coordinate for "Poljoprivredna
škola" sits 3 m from a _differently named_ registry stop while its real counterpart is
97 m away. `Bulevar` / `Gimnazija` are 67 m apart with different names, so they stay
separate — the 30 m rule is deliberately tight for that reason.

When a derived stop is absorbed, any line it carries that the registry does not know
about is added to the registry stop, so popups keep listing every line that serves it.
Most derived stops merge into the export; the rest remain as their own markers.

### Collapsing duplicate poles

Both sources list the two kerbs of a stop separately — `st-314` and `st-1520` are both
"Široka rijeka", 20 m apart. Stops with the same normalised name within **60 m** are drawn
as one marker carrying the union of their lines; the absorbed ids move to `mergedIds`, and
`createTransitIndex` resolves them, so a route naming `st-314` still finds its marker.
This removes 96 duplicate markers.

The radius is deliberately tight. The two kerbs of a street sit 60-120 m apart and each
lies on its own direction's geometry, so merging those would leave a route's numbered
stops floating beside the drawn line.

Stop names that are still shared by more than one marker are listed in `meta.warnings`
after every build — some are genuinely different places ("Donji Barlovci" twice on one
route, 550 m apart), so they are left alone rather than merged.

All of this is a **display-level** decision; no source record is rewritten, and every
merge is printed by the generator so the heuristics can be audited after each run.

### Manual corrections

`scripts/transit-overrides.json` handles conflicts the matching cannot settle:

- `rename` — give a stop a clearer display name, e.g. to tell two "Prodavnica" apart.
  Renames run before pole collapsing, so renaming can also unify a duplicate.
- `mergeInto` — force one stop to be drawn as another, combining their lines.
- `addStops` — add stops the export leaves off a route. Each is projected onto the route
  geometry and slotted in where that position implies, so the order stays right without
  hand-numbering. A stop further than 60 m from the line is reported.

Line 19 towards Centar is corrected this way: the export omits Čajevac and Bulevar,
though its geometry passes within 20 m of both. Note that Gimnazija (`st-194`) and Bulevar
(`st-167`) are consecutive stops 312 m apart on the same carriageway, not duplicates —
line 19 calls only at Bulevar.

Unknown ids in either map are reported as warnings, so the file cannot silently rot.

## Known data issues

Recorded in `meta.warnings` on every build:

- **Low-resolution geometry on one route.** `9b-centar-cesma` has 71 geometry points where
  its opposite direction has 534, so its line is visibly coarse (121 m between points
  against 12 m elsewhere) and one stop sits 64 m off it. Everything else stays within 44 m
  of its own line. Routes are drawn only from published geometry; stops are never joined
  by straight segments, which would imply a path buses do not take.
- **Sequence gaps.** Route `10` skips sequence 10 and route `20-paprikovac-incel` skips 3,
  so a stop the operator lists is missing from the export. `seq` keeps the source value;
  display positions are renumbered contiguously.
- **Several start/end markers per route.** Seven routes mark more than one `p`/`z` stop, so
  `role` flags turnaround points rather than only termini. First and last stop are taken
  from array position, not from `role`.
- **Two timing columns.** Each stop carries two travel-time variants and neither is
  documented. The generator keeps whichever covers more stops on the route and records
  which in `timing`; the discarded one is often a round 60 s placeholder. Line 1 has times
  for only 18 of 28 stops, so `time` and `distance` are nullable and are not shown in the UI.
- **Duplicate stop names.** After collapsing nearby poles, 23 names are still used by more
  than one marker (`Prodavnica` ×4, `Rebrovac` ×3). They are far enough apart to be
  different places, so they are **not** merged — stop identity is the id, never the name.
  Use `rename` in the overrides file where riders cannot tell them apart.
- **The two sources disagree about some stop lists.** The legacy data says line 19 serves
  "Bulevar", but no route-19 variant in the export calls there. Rather than showing a
  route that omits the stop the user clicked, such a line links to the timetable instead
  of opening the route view (`pickRouteForStop` returns null).
- **One Cyrillic relation.** Line 1's relation is transliterated to Latin to match the rest
  of the site.
- **`urban_bus_routes.json` inconsistencies.** Lines 3, 12, 14B and 17A have a different
  number of stops and coordinates; stops without a coordinate are skipped.

## Assumptions

- `time` is seconds and `distance` is metres **from the previous stop** on that route; the
  first stop is 0. This is inferred from the values, not documented by the source.
- The public line number is the join key between the export and the site's own line data.
  All 19 covered lines match exactly (`13A`, `9B`, …).
- Line pages keep their existing per-direction stop tables from `urban_bus_routes.json`,
  because the export covers only one direction for 17 of the 19 lines; replacing them
  would drop the return direction. The route map is additive.
