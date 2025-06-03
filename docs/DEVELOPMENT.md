# Development Guide

## Getting Started

### Prerequisites
- Node.js (v14 or higher) for development server
- Git for version control
- Modern web browser

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd blum
   ```

2. Install development dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:8000`

## Project Structure

### Key Files and Directories

- `index.html` - Main entry point
- `css/` - All stylesheets
  - `styles.css` - Main stylesheet (needs to be modularized)
  - `components/` - Component-specific styles
- `js/` - JavaScript files
  - `script.js` - Main application logic (needs to be modularized)
  - `map.js` - Map functionality
  - `urban-lines-viewer.js` - Urban lines viewer
- `data/` - JSON data files for routes, timetables, etc.

### Data Files

The application uses several JSON files for data:
- **Routes**: `urban_lines.json`, `suburban_lines.json`, `urban_bus_routes.js`
- **Timetables**: `urban_timetables.json`, `suburban_timetables.json`
- **Configuration**: `prices.json`, `contacts.json`, `bhs_en_translations.json`
- **Other**: `bike_stations.json`, `transport_hubs.json`

## Development Workflow

### Making Changes

1. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes
3. Test locally using the development server
4. Commit your changes with descriptive messages
5. Push and create a pull request

### Code Style Guidelines

#### CSS
- Use consistent indentation (2 spaces)
- Follow BEM methodology for class naming
- Group related properties together
- Use CSS custom properties for colors and common values

#### JavaScript
- Use ES6+ features where appropriate
- Follow consistent naming conventions (camelCase for variables/functions)
- Add comments for complex logic
- Keep functions small and focused

#### HTML
- Use semantic HTML5 elements
- Ensure accessibility with proper ARIA labels
- Maintain proper indentation

## Testing

### Manual Testing Checklist

- [ ] Page loads without errors
- [ ] Map displays correctly and is interactive
- [ ] Language switching works (BHS/EN)
- [ ] All navigation links work
- [ ] Timetables load and display properly
- [ ] Price tables render correctly
- [ ] Mobile responsiveness works
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)

### Data Validation

- Verify JSON files are valid
- Check that all referenced routes exist in data files
- Ensure translations cover all text elements
- Validate map coordinates and routes

## Common Tasks

### Adding a New Bus Line

1. Update `data/urban_lines.json` or `data/suburban_lines.json`
2. Add route data to `data/urban_bus_routes.js`
3. Update timetable data in appropriate timetable JSON
4. Test the new line appears correctly on map and in listings

### Adding New Translations

1. Update `data/bhs_en_translations.json`
2. Add corresponding `data-lang` attributes in HTML
3. Test language switching functionality

### Updating Styles

1. Locate the appropriate CSS file
2. Follow existing patterns and conventions
3. Test responsive design changes
4. Verify cross-browser compatibility

## Performance Considerations

### Current Issues
- Large CSS file (57KB) impacts initial load
- Large JavaScript file (68KB) blocks rendering
- Large image assets (6MB+ PNG) slow page load

### Optimization Opportunities
- Split CSS into smaller, component-based files
- Implement lazy loading for large assets
- Minify and compress JavaScript/CSS
- Optimize images (WebP format, proper sizing)
- Implement caching strategies

## Browser Support

### Minimum Requirements
- Chrome/Chromium 60+
- Firefox 55+
- Safari 11+
- Edge 79+

### Key Features Used
- CSS Grid and Flexbox
- ES6 JavaScript features
- Leaflet.js mapping library
- CSS Custom Properties

## Deployment

The project is a static website that can be deployed to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

### Build Process
Currently no build process - files are served directly. Consider adding:
- CSS/JS minification
- Image optimization
- Bundle generation

## Troubleshooting

### Common Issues

1. **Map not loading**: Check Leaflet.js CDN availability
2. **Data not displaying**: Verify JSON file syntax and paths
3. **Styles not applying**: Check CSS file paths and syntax
4. **JavaScript errors**: Use browser developer tools console

### Debug Mode
Add `?debug=true` to URL for additional console logging (if implemented).

## Contributing

### Types of Contributions Welcome
- Bug fixes
- Performance improvements
- New features (with discussion first)
- Documentation improvements
- Accessibility enhancements
- Translation updates

### Code Review Process
1. All changes require review
2. Ensure backward compatibility
3. Test on multiple devices/browsers
4. Update documentation as needed

## Resources

- [Leaflet.js Documentation](https://leafletjs.com/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [CSS Grid Guide](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) 