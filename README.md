# BLum - Banja Luka urbana mobilnost

BLum je nezavisna open-source inicijativa za lakši pristup informacijama o javnom
prevozu i urbanoj mobilnosti u Banjoj Luci.

Nastao je kao odgovor na redove vožnje, trase i obavještenja koja su često rasuta,
teško dostupna ili neujednačena. Cilj je da građani na jednom mjestu brzo pronađu
linije, stajališta, redove vožnje i važne promjene u prevozu.

Trenutno je fokusiran na javni prevoz, uz postepeno širenje na druge oblike urbane
mobilnosti.

English version: [README.en.md](README.en.md)

> BLum nije zvanična stranica javnog prevoza.

## Lokalno pokretanje

Potreban je Node.js 22.12 ili noviji.

```bash
npm install
npm run dev
```

Za lokalni prikaz CARTO mapa kopirajte `.env.example` u `.env` i unesite
`PUBLIC_CARTO_BASEMAP_KEY`. U produkciji se ista vrijednost postavlja kao
repository secret `CARTO_BASEMAP_KEY`.

Za provjeru projekta pokrenite `npm run ci`.
