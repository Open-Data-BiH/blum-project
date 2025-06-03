# Banja Luka Public Transport Information System

A comprehensive web application providing real-time information about public transportation in Banja Luka, including urban and suburban bus lines, schedules, prices, and interactive maps.

## Features

- 🗺️ Interactive maps showing bus routes and stops
- 🚌 Urban and suburban bus line information
- ⏰ Real-time timetables and schedules
- 💰 Current ticket prices and fare information
- 🌐 Bilingual support (Bosnian/Serbian/Croatian and English)
- 📱 Mobile-responsive design
- 🚴 Bike station locations (Nextbike integration)
- ✈️ Airport transfer information

## Project Structure

```
/
├── index.html                 # Main HTML file
├── assets/                    # Static assets
│   ├── images/               # Images and graphics
│   └── documents/            # PDF documents and studies
├── css/                      # Stylesheets
│   ├── components/          # Component-specific styles
│   ├── layout/              # Layout and grid styles
│   └── vendor/              # Third-party CSS
├── js/                       # JavaScript files
│   ├── components/          # Modular JS components
│   ├── utils/               # Utility functions
│   └── vendor/              # Third-party JavaScript
├── data/                     # JSON data files
│   ├── routes/              # Bus route information
│   ├── timetables/          # Schedule data
│   └── config/              # Configuration files
└── docs/                     # Documentation
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
   git clone <repository-url>
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
- Local transport companies (AUTOPREVOZ, PAVLOVIĆ, BOČAC, ALDEMO, RALE)
- Community contributions

## Contributing

This is a community project aimed at improving public transport accessibility in Banja Luka. Contributions are welcome!

## Credits

Map visualization created by **Uticajna Grupa - Imamo Plan** (Serbia):
- Jug Cerović
- Marko Njegić  
- Stefan Milojević

## Disclaimer

This is not an official website of the City of Banja Luka or any transport company. All data is provided for informational purposes only. For official information about schedules, prices, and other details, please contact the relevant institutions or transport companies.

## License

This project is a gift to the city and its citizens, developed as a volunteer initiative. 