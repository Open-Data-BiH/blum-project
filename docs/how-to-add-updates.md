# How To Add Public Transport Updates

This project reads updates from:

- `public/data/transport/updates.json`

The updates page (`/updates/`) automatically renders all records where:

- `isActive` is `true`
- `dateExpiry` is empty OR still in the future (client-side check)

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
  "dateExpiry": "YYYY-MM-DD or null",
  "isActive": true,
  "source": "Source name",
  "sourceUrl": "https://..."
}
```

## Step-By-Step

1. Open `public/data/transport/updates.json`.
2. Copy one of the existing template/example records in `updates`.
3. Set a new unique `id` (recommended format: `topic-YYYY-MM-short-slug`).
4. Set `type` to one of the existing categories:
   - `line_change`
   - `closure`
   - `schedule_change`
5. Add both language texts (`title.bhs`, `title.en`, `description.bhs`, `description.en`).
6. Add affected lines in `affectedLines` (or leave `[]` if not specific).
7. Set `datePublished` and `dateExpiry` in `YYYY-MM-DD`.
8. Set `isActive: true`.
9. Add `source` and `sourceUrl` (leave `sourceUrl` empty only if no URL exists).
10. Save and refresh `/updates/`.

## Deactivate Or Archive Old Updates

- To hide an update immediately: set `isActive` to `false`.
- To auto-hide after a date: keep `isActive: true` and set `dateExpiry` in the past.

## Quick Validation Checklist

- `id` is unique
- `type` exists in `categories`
- both `bhs` and `en` text fields are filled
- dates use `YYYY-MM-DD`
- JSON is valid (commas and quotes are correct)
