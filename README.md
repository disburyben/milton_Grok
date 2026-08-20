# Premier Speedway 3D map

Interactive 3D map of **Premier Speedway (Sungold Stadium)** in Allansford, just east of Warrnambool, Victoria.

The scene is georeferenced from OpenStreetMap footprints (track, buildings, roads, railway) and draped on Esri World Imagery satellite tiles.

## Open the map

You cannot open `index.html` as a raw GitHub file. It needs a local web server (or GitHub Pages).

```bash
npm install
npm start
```

Then open **http://localhost:5173**.

Without installing Vite globally:

```bash
npx --yes serve .
```

Open the URL it prints (usually http://localhost:3000).

### GitHub Pages

After merging, enable Pages in the repo:

1. Settings → Pages
2. Source: **GitHub Actions**

The workflow `.github/workflows/pages.yml` publishes the built map to  
`https://disburyben.github.io/milton_Grok/`

## Controls

- Drag to orbit, scroll to zoom, right-drag to pan
- Camera presets: Aerial, Grandstand, Mount Max, Pits, Turn 1, Driver cam
- Toggles: Night race, Sprintcars, Satellite, Labels
- Click map markers for venue notes
- Hover the clay oval to read coordinates

## Data

- Track and facility outlines: OpenStreetMap
- Aerial imagery: Esri World Imagery
- Venue facts: 410 m banked clay oval at 10275 Princes Highway, Allansford
