# Project Reorganization Migration Plan

## Current Issues

1. **Large monolithic files**:
   - `styles.css` (57KB, 2696 lines) - should be split into components
   - `script.js` (68KB, 1704 lines) - should be modularized

2. **Poor file organization**:
   - Large assets (PNG 6.3MB, PDF 9.6MB) in root directory
   - Mixed file types in root
   - No logical grouping of related files

3. **Missing project structure**:
   - No package.json for dependency management
   - No documentation (README, setup instructions)
   - No development tooling setup

## Proposed New Structure

```
/
├── index.html                    # Main HTML file
├── package.json                  # Project dependencies and scripts
├── README.md                     # Project documentation
├── .gitignore                    # Git ignore file
├── assets/                       # Static assets
│   ├── images/                   # Images and graphics
│   │   └── gradski-prevoz-mapa-banja-luka.png
│   └── documents/                # PDF documents and studies
│       └── Studija javnog prevoza BL 2023.pdf
├── css/                          # Stylesheets
│   ├── main.css                  # Main styles (combined/minified)
│   ├── components/               # Component-specific styles
│   │   ├── header.css
│   │   ├── navigation.css
│   │   ├── map.css
│   │   ├── timetables.css
│   │   ├── price-tables.css
│   │   └── footer.css
│   └── layout/                   # Layout and grid styles
│       ├── base.css
│       ├── grid.css
│       └── responsive.css
├── js/                           # JavaScript files
│   ├── main.js                   # Main application entry point
│   ├── components/               # Modular JS components
│   │   ├── map-controller.js
│   │   ├── urban-lines-viewer.js
│   │   ├── language-switcher.js
│   │   ├── timetable-viewer.js
│   │   └── price-table-loader.js
│   └── utils/                    # Utility functions
│       ├── data-loader.js
│       ├── dom-helpers.js
│       └── api-client.js
├── data/                         # JSON data files
│   ├── routes/                   # Bus route information
│   │   ├── urban_bus_routes.js
│   │   ├── urban_lines.json
│   │   └── suburban_lines.json
│   ├── timetables/               # Schedule data
│   │   ├── urban_timetables.json
│   │   └── suburban_timetables.json
│   └── config/                   # Configuration files
│       ├── companies.json        # Company ownership data
│       ├── translations.json     # Language translations
│       ├── contacts.json
│       ├── prices.json
│       ├── bike_stations.json
│       └── transport_hubs.json
└── docs/                         # Documentation
    ├── MIGRATION_PLAN.md
    ├── API.md
    └── DEVELOPMENT.md
```

## Migration Steps

### Phase 1: Setup Project Infrastructure ✅
- [x] Create README.md with project documentation
- [x] Create package.json for dependency management
- [x] Create new directory structure
- [x] Create migration plan documentation

### Phase 2: Move Assets
```bash
# Move large files to assets directory
Move-Item "gradski-prevoz-mapa-banja-luka.png" "assets/images/"
Move-Item "Studija javnog prevoza BL 2023.pdf" "assets/documents/"
```

### Phase 3: Reorganize Data Files
```bash
# Move route data
Move-Item "data/urban_bus_routes.js" "data/routes/"
Move-Item "data/urban_lines.json" "data/routes/"
Move-Item "data/suburban_lines.json" "data/routes/"

# Move timetable data
Move-Item "data/urban_timetables.json" "data/timetables/"
Move-Item "data/suburban_timetables.json" "data/timetables/"

# Move config data
Move-Item "data/urban_company_ownership.json" "data/config/companies.json"
Move-Item "data/suburban_company_ownership.json" "data/config/suburban_companies.json"
Move-Item "data/bhs_en_translations.json" "data/config/translations.json"
Move-Item "data/contacts.json" "data/config/"
Move-Item "data/prices.json" "data/config/"
Move-Item "data/bike_stations.json" "data/config/"
Move-Item "data/transport_hubs.json" "data/config/"
```

### Phase 4: Split Large CSS File
Break down `css/styles.css` (2696 lines) into logical components:
- Extract header styles → `css/components/header.css`
- Extract navigation styles → `css/components/navigation.css`
- Extract map styles → `css/components/map.css`
- Extract base/layout styles → `css/layout/base.css`

### Phase 5: Modularize JavaScript
Break down `js/script.js` (1704 lines) into:
- Core application logic → `js/main.js`
- Language switching → `js/components/language-switcher.js`
- Data loading utilities → `js/utils/data-loader.js`
- DOM manipulation helpers → `js/utils/dom-helpers.js`

### Phase 6: Update File References
- Update `index.html` to reference new file paths
- Update JavaScript imports/includes
- Update any hardcoded asset paths

## Benefits of New Structure

1. **Maintainability**: Smaller, focused files are easier to maintain
2. **Scalability**: Modular structure supports future feature additions
3. **Performance**: Can implement selective loading and caching strategies
4. **Development**: Better development workflow with proper tooling
5. **Collaboration**: Clear structure makes it easier for multiple developers

## Rollback Plan

If issues arise during migration:
1. Git checkout to previous state
2. All original files are preserved during moves
3. Step-by-step migration allows partial rollback

## Testing After Migration

1. Verify all pages load correctly
2. Test map functionality
3. Verify data loading for all sections
4. Test responsive design
5. Check language switching
6. Validate all external links and assets

## Next Steps

1. Execute migration phases in order
2. Test thoroughly after each phase
3. Update any build/deployment scripts
4. Consider implementing a build process for CSS/JS concatenation
5. Add proper error handling and logging 