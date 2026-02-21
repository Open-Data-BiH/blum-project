# BLum

### Urbana mobilnost Banja Luka

Nezavisna open-source platforma za informacije o javnom prevozu i urbanoj mobilnosti u Banjoj Luci.

## Misija

Omogućiti jednostavan i transparentan pristup informacijama o javnom prevozu građanima i posjetiocima grada.

> BLum nije zvanična stranica javnog prevoza.

## Features

- ðŸ—ºï¸ Interactive maps showing bus routes and stops
- ðŸšŒ Urban and suburban bus line information
- â° Real-time timetables and schedules
- ðŸ’° Current ticket prices and fare information
- ðŸŒ Bilingual support (Bosnian/Serbian/Croatian and English)
- ðŸ“± Mobile-responsive design
- ðŸš´ Bike station locations (Nextbike integration)
- âœˆï¸ Airport transfer information

## Project Structure

```
/
â”œâ”€â”€ index.html                 # Main HTML file
â”œâ”€â”€ assets/                    # Static assets
â”‚   â”œâ”€â”€ images/               # Images and graphics
â”‚   â””â”€â”€ documents/            # PDF documents and studies
â”œâ”€â”€ css/                      # Stylesheets
â”‚   â”œâ”€â”€ components/          # Component-specific styles
â”‚   â”œâ”€â”€ layout/              # Layout and grid styles
â”‚   â””â”€â”€ vendor/              # Third-party CSS
â”œâ”€â”€ js/                       # JavaScript files
â”‚   â”œâ”€â”€ components/          # Modular JS components
â”‚   â”œâ”€â”€ utils/               # Utility functions
â”‚   â””â”€â”€ vendor/              # Third-party JavaScript
â”œâ”€â”€ data/                     # JSON data files
â”‚   â”œâ”€â”€ routes/              # Bus route information
â”‚   â”œâ”€â”€ timetables/          # Schedule data
â”‚   â””â”€â”€ config/              # Configuration files
â””â”€â”€ docs/                     # Documentation
```

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Mapping**: Leaflet.js
- **Icons**: Font Awesome
- **Fonts**: Google Fonts (Open Sans)
- **Data Format**: JSON

## Setup and Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Open-Data-BiH/blum-project.git
   cd blum
   ```

2. Serve the files using a local web server:

   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

3. Open your browser and navigate to `http://localhost:8000`

## Data Sources

The transportation data is sourced from:

- Official Banja Luka city administration
- Local transport companies (AUTOPREVOZ, PAVLOVIÄ†, BOÄŒAC, ALDEMO, RALE)
- Community contributions

## Contributing

This is a community project aimed at improving public transport accessibility in Banja Luka. Contributions are welcome!

## Credits

Map visualization created by **Uticajna Grupa - Imamo Plan** (Serbia):

- Jug CeroviÄ‡
- Marko NjegiÄ‡  
- Stefan MilojeviÄ‡

## Disclaimer

This is not an official website of the City of Banja Luka or any transport company. All data is provided for informational purposes only. For official information about schedules, prices, and other details, please contact the relevant institutions or transport companies.

## License

This project is a gift to the city and its citizens, developed as a volunteer initiative.
