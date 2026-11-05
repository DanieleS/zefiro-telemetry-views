# Final Fantasy VII Rebirth: maps and place names

Everything here was extracted from the Steam release (file version 1.0.0.5) by
`tools/ff7-assets`. Nothing in this folder is edited by hand.

| File | What it is |
|---|---|
| `maps/<location>.webp` | The game's own region map (its NaviMap texture, layer 0), one per location that has one, at 1024 px |
| `maps.json` | For each map: the world X and Y of its top-left pixel (cm), centimetres per pixel, and its size |
| `names.it.json` | The Italian names the game shows for places: `$map<NNNN>` for a location, `$area<NNNN>_…` for a sub-area |

The maps and names belong to Square Enix. They are here so the view can draw where the player is,
in the same style as the game's own map.

## How the view uses them

The profile's `locations` lists the location volumes the player stands in. The smallest volume is
the place. Its LocationID (`2250-CORLM`) gives the area name through `$map2250`, and its name key
(`$area2250_Railway`), if it has one, gives the sub-area. The smallest volume with a map here gives
the map. A world position becomes a pixel as `(position - (x, y)) / cmPerPx`.

## Regenerating them

After a game update, or to change a size:

1. **Type mappings.** The game's packages use unversioned properties, so reading them needs a
   `.usmap`. [UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) dumps one from the running game. It has a
   ready configuration for this game in its `zCustomGameConfigs`. Install UE4SS in
   `End\Binaries\Win64`, set `GuiConsoleEnabled = 1` in `UE4SS-settings.ini`, load a save, and press
   *Generate .usmap file* in the console's Dumpers tab. The file lands in `Win64\ue4ss\`. Rename
   `dwmapi.dll` to disable UE4SS again.
2. **Extract.** With the .NET 10 SDK:

   ```powershell
   $env:FF7_PAKS  = 'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII REBIRTH\End\Content\Paks'
   $env:FF7_USMAP = '<path to the .usmap>'
   dotnet run --project tools/ff7-assets -c Release -- names IT views/ff7-rebirth/assets/names.it.json
   dotnet run --project tools/ff7-assets -c Release -- regions views/ff7-rebirth/assets/maps 1024 70
   Move-Item -Force views/ff7-rebirth/assets/maps/maps.json views/ff7-rebirth/assets/maps.json
   ```

`regions` takes each map's coarsest level of detail (one 2048 px tile), scales it down, and writes
it as WebP at the given quality. Story variants (`2600-NIBLA_Before`) and test levels (`99xx`) are
skipped: the profile cannot tell a story state apart yet. The pak files are not encrypted, only
Oodle-compressed. CUE4Parse fetches the Oodle library on first use.

The same tool lists and dumps any package (`list <regex>`, `props <package>`), which is how these
were found: `Content/Menu/Billboard/Map/<location>/` holds the map tiles,
`Content/DataAsset/Game/NaviMap/NaviMapSetting_<location>` their placement, and
`Content/Text/<lang>/Resident_TxtRes` the text table.
