# MainStreet loading screen

An original FiveM loading screen for MainStreet RP. It shares no code, images
or video with any other server's loading screen.

## What it shows

- **Background:** a night city drawn live in the browser. Downtown lights
  flicker, searchlights sweep, palm trees sway, and a helicopter crosses now
  and then. There is no background video, so it adds almost nothing to what
  players download.
- **Wordmark:** "MainStreet" in chrome graffiti with a green glow, plus an
  "RP" tag. Your official logo replaces it if you add one (see below).
- **Loading bar:** a stretch of road whose lit part grows with the real load.
  It is driven by FiveM's own loading events (`startInitFunctionOrder`,
  `initFunctionInvoking`, `startDataFileEntries`, `onDataFileEntry`,
  `loadProgress`, `onLogLine`).
  - The bar never moves backwards.
  - The label names the current stage: Starting up, Preparing the city,
    Loading map data, Streaming the streets, Joining the session.
  - The game's latest log line shows small, bottom right.
- **Tips:** rotating every 9 seconds.
- **Music:** an original looping theme. Players can mute it with the button,
  top right, or the **M** key.
- **Status:** a connection timer, top left.

## Install

1. Copy the `mainstreet-loading` folder into your server's `resources`.
2. Add `ensure mainstreet-loading` to `server.cfg`.
3. Remove or stop any other loading-screen resource. Only one can be active.

### When it closes

The manifest uses `loadscreen_manual_shutdown 'yes'`. `client.lua` closes the
screen when the player spawns.

- **With a character-select resource:** it usually closes the loading screen
  itself (`ShutdownLoadingScreenNui()`), and that is fine. The screen then
  goes away when character selection opens.
- **From another resource:** call `TriggerEvent('mainstreet-loading:close')`
  or `exports['mainstreet-loading']:close()`.

## Make it yours

Everything is in `html/config.js`:

| Setting | What it does |
|---|---|
| `name`, `tag` | The wordmark text (default `MainStreet` and `RP`) |
| `logo` | Put your official logo at `html/img/logo.png` (transparent PNG, about 1200 px wide). It replaces the wordmark automatically. |
| `tips` | The rotating tips. The defaults are general roleplay advice: swap in your server's real keybinds, Discord and rules. |
| `tipSeconds` | How long each tip stays up |
| `music.src`, `music.volume` | Swap the track (`.ogg` recommended) or set its volume from 0 to 1 |

## Preview without the game

Open `html/index.html` in a normal browser. Outside FiveM it plays a simulated
load, so you can check the look. Click once if your browser holds the music
back.

## Credits

- **Fonts:** Sedgwick Ave Display and Barlow Semi Condensed, both under the
  SIL Open Font License. The licence texts are in `html/fonts/`.
- **Music:** composed for this resource with showtime's local music
  generator. It is free to use and needs no credit.
