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
- **Geometry** is kept out of this file on purpose. Inlining all 25,399 points would add
  about 94 kB gzip to every homepage visit; per-route files cost ~2.4 kB for the one route
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
- `derived` — read out of `urban_bus_routes.json` for stops the export does not contain.
  Keyed by **normalised** name, because the line listings spell some stops three ways
  ("Starčevica - Integral inženjering" / "… Inženjering" / "Starčevica Integral …") and
  each spelling would otherwise become its own marker.

Derived coordinates are the weakest data in the set. Checked against OpenStreetMap they
sit a median of 45 m from the surveyed position against 5 m for registry stops, and ten of
them are more than 60 m out. Where OSM confirms the stop by name *and* by route membership,
the position is corrected through `move`.

### Stop name normalisation

Names are rewritten to plain Latin before anything else sees them, because the site
searches, sorts and links on that text:

- **Cyrillic is transliterated.** The export carries one Cyrillic stop name and one
  Cyrillic relation; both come out in Latin.
- **Non-breaking spaces become ordinary spaces.** 125 exported stop names contain U+00A0,
  which looks like a space and does not match one, so `Autoservis Derviši` was unreachable
  by typing its name.
- **Unicode Roman numerals become letters.** Three names used `Ⅰ` (U+2160) instead of `I`.

Anything left that is not plain Latin is a bug in this step, not in the data.

### Merging the two sources

The two datasets describe the same city at different vintages, so the generator folds a
derived stop into a registry stop when one of these holds, in order of confidence:

| Rule                            | Radius | Why                                                                                                                                              |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| same name **and** a shared line | 600 m  | Some legacy coordinates are badly off — `st-1400` is 246 m from its counterpart, "Široka rijeka" 273 m. A shared line makes the identity safe. |
| same name                       | 150 m  | Ordinary coordinate drift ("Poljoprivredna škola" is 97 m out).                                                                                  |
| any name                        | 30 m   | Close enough to be the same kerb, whatever the two sources call it.                                                                              |

A name match outranks a merely closer stop: the legacy coordinate for "Poljoprivredna
škola" sits 3 m from a _differently named_ registry stop while its real counterpart is
97 m away. `st-167` / `st-1400` are 58 m apart with different names, so they stay
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
- `move` — replace a stop's coordinate with `[lat, lon]`. Used for three things: surveyed
  corrections, operator route changes, and OSM positions for legacy stops the export never
  carried (those are the worst-placed records in the dataset — see below).
- `keepSeparate` — groups of stop ids that share a name but are genuinely separate kerbs
  closer together than the pole-merge radius. Each keeps its own marker. Line 20's two
  "Eko toplane" poles are 7 m apart and would otherwise collapse into one.
- `mergeInto` — force one stop to be drawn as another, combining their lines.
- `addStops` — add stops the export leaves off a route. Each is projected onto the route
  geometry and slotted in where that position implies, so the order stays right without
  hand-numbering. A stop further than 60 m from the line is reported.
- `moveLines` — reassign a line badge attached to the wrong pole of a same-named pair.
  Only needed for a line whose stop list has no route to speak for it: once a line has
  routes, the routes decide which stops carry its badge.

### Geometry overrides

`scripts/shape-overrides/<route id>.json` replaces the export's geometry for one route.
The file is a plain `[lat, lon][]` — already in the output format, so it is written
verbatim. A file matching no route is reported after every build.

Two cases use this today:

- **Line 20 towards and from Incel.** The operator changed the route: the bus now runs
  down the street Ada and loops south of Park Ada instead of turning north. The published
  geometry still shows the old loop, so both directions are spliced at the Ada/Bulevar
  vojvode Živojina Mišića junction and rejoined to the new path.
- **Lines 3B, 14B, 17 and 17A**, which the export does not cover at all — see below.

Line 19 towards Centar is corrected this way: the export omits Čajevac and
"Bulevar - neboderi", though its geometry passes within 20 m of both. Note that
"Bulevar - hirurgija" (`st-194`) and "Bulevar - neboderi" (`st-167`) are consecutive stops
312 m apart on the same carriageway, not duplicates — line 19 calls only at the latter.

Unknown ids in either map are reported as warnings, so the file cannot silently rot.

## Lines the export does not cover

The operator export has no routes for 3B, 9C, 14B, 17 and 17A, but `urban_bus_routes.json`
carries their ordered, per-direction stop lists. The generator turns those into real routes:
the **order comes from the line listing** — the only source that has it — the stop ids come
from the same name resolution used for derived stops, and the geometry comes from a shape
override.

Geometry for these was traced over the OpenStreetMap road network by routing between
consecutive stops, honouring `oneway` so the two directions differ where the street network
makes them differ. It is not taken from OSM route relations: their member order is not
travel order (measured against the drawn routes, 15 of 19 lines score at or below 0.26 on
Kendall's τ), so only the roads are borrowed, never the sequence.

A route is built **only when its shape override exists** — a route view with no line on the
map would be worse than the timetable link it replaces. That is why 9C still has no routes:
nothing has traced its geometry yet, and the generator warns about it on every build.

Travel times do not exist for these lines, so `time` and `distance` are null throughout.

## Known data issues

Recorded in `meta.warnings` on every build:

- **Low-resolution geometry on one route.** `9b-centar-cesma` has 71 geometry points where
  its opposite direction has 534, so its line is visibly coarse (121 m between points
  against 12 m elsewhere) and one stop sits 64 m off it. Everything else stays within 44 m
  of its own line. Routes are drawn only from published geometry; stops are never joined
  by straight segments, which would imply a path buses do not take.
- **Sequence gaps.** Route `10` skips sequence 10 and route `20-paprikovac-incel` skips 3,
  so a stop the operator lists is missing from the export. `seq` keeps the source value;
  display positions are renumbered contiguously. OpenStreetMap shows a stop at both of
  those positions, but neither has been confirmed against a current operator timetable.
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
  "Bulevar - neboderi" (`st-167`), but no route-19 variant in the export calls there. Rather than showing a
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
  All 19 exported lines match exactly (`13A`, `9B`, …); 3B, 14B, 17 and 17A are built from
  the line listing on top of that, leaving 9C as the only line without routes.
- Line pages keep their existing per-direction stop tables from `urban_bus_routes.json`,
  because the export covers only one direction for 17 of the 19 lines; replacing them
  would drop the return direction. The route map is additive.
