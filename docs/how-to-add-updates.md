# How To Add Public Transport Updates

This project reads updates from:

- `public/data/transport/updates.json`

An update card is visible when **today** falls inside its visibility window:

- `datePublished` is in the past or today
- `dateExpiry` is empty OR still in the future

Both checks run server-side at build time and again client-side on page load.

`dateStart` is **informational** — it is shown on the card as "Effective from" but does **not** affect visibility. Use it when the announcement is published before the change actually takes effect.

## Data Structure

`updates.json` has two top-level arrays:

- `categories`: available filter tabs on the page
- `updates`: individual news/update cards

Each update object uses this shape:

```json
{
    "id": "unique-id",
    "type": "line_change | closure | schedule_change",
    "severity": "info | warning | urgent",
    "title": { "bhs": "...", "en": "..." },
    "description": { "bhs": "...", "en": "..." },
    "affectedLines": ["13A", "7"],
    "datePublished": "YYYY-MM-DD",
    "dateStart": "YYYY-MM-DD",
    "dateExpiry": "YYYY-MM-DD or null",
    "source": "Source name",
    "sourceUrl": "https://..."
}
```

- `datePublished` — when the announcement was published. Controls visibility start.
- `dateStart` — *optional*, informational. When the announced change actually takes effect. Shown on the card as "Effective from". Omit when the change takes effect on the same day it is published.
- `dateExpiry` — last day the card stays visible, or `null` for no expiry.

Copy-paste scaffolds for each `type` live in `examples/updates.example.json`.

## Step-By-Step

1. Open `examples/updates.example.json` and copy one of the template records.
2. Paste it into the `updates` array in `public/data/transport/updates.json`.
3. Set a new unique `id` (recommended format: `topic-YYYY-MM-short-slug`).
4. Set `type` to one of the existing categories:
    - `line_change`
    - `closure`
    - `schedule_change`
5. Add both language texts (`title.bhs`, `title.en`, `description.bhs`, `description.en`).
6. Add affected lines in `affectedLines` (or leave `[]` if not specific).
7. Set the dates in `YYYY-MM-DD`:
    - `datePublished` — today (or any past date you want the card visible from).
    - `dateStart` — optional. Drop the field when it would match `datePublished`.
    - `dateExpiry` — last day the card stays visible, or `null` for no expiry.
8. Add `source` and `sourceUrl` (leave `sourceUrl` empty only if no URL exists).
9. Save and refresh `/updates/`.

## Hide An Update

- To hide immediately: set `dateExpiry` to a past date or delete the entry.
- To delay publication: set `datePublished` to a future date.

## Quick Validation Checklist

- `id` is unique
- `type` exists in `categories`
- both `bhs` and `en` text fields are filled
- dates use `YYYY-MM-DD`
- JSON is valid (commas and quotes are correct)
