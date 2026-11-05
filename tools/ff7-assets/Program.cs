// ff7-assets list <regex>            — list package paths matching regex (case-insensitive)
// ff7-assets props <package>          — dump a package's exports as JSON
// ff7-assets tex <package> <out.png>  — export a Texture2D as PNG
using System.Text.RegularExpressions;
using CUE4Parse.Compression;
using CUE4Parse.FileProvider;
using CUE4Parse.UE4.Assets.Exports.Texture;
using CUE4Parse.UE4.Versions;
using CUE4Parse_Conversion.Textures;
using CUE4Parse_Conversion.Options;
using Newtonsoft.Json;

// The game's Paks folder, and the type mappings UE4SS dumps from the running game (see README.md).
var Paks = Environment.GetEnvironmentVariable("FF7_PAKS") ?? throw new Exception("set FF7_PAKS to the game's End\\Content\\Paks folder");
await OodleHelper.InitializeAsync();

var provider = new DefaultFileProvider(Paks, SearchOption.TopDirectoryOnly, new VersionContainer(EGame.GAME_FinalFantasy7Rebirth));
provider.Initialize();
provider.Mount();
var usmap = Environment.GetEnvironmentVariable("FF7_USMAP");
if (!string.IsNullOrEmpty(usmap)) provider.MappingsContainer = new CUE4Parse.MappingsProvider.Usmap.FileUsmapTypeMappingsProvider(usmap);
Console.Error.WriteLine($"files: {provider.Files.Count}");

switch (args[0])
{
    case "list":
        var re = new Regex(args[1], RegexOptions.IgnoreCase);
        foreach (var f in provider.Files.Keys.Where(k => re.IsMatch(k)).OrderBy(k => k)) Console.WriteLine(f);
        break;
    case "props":
        var exports = provider.LoadPackage(args[1]).GetExports();
        Console.WriteLine(JsonConvert.SerializeObject(exports, Formatting.Indented));
        break;
    case "stitch":
    {
        // stitch <prefix up to "_Split"> <grid> <out.png> [scale]: tiles SplitN, row-major
        int grid = int.Parse(args[2]);
        float scale = args.Length > 4 ? float.Parse(args[4], System.Globalization.CultureInfo.InvariantCulture) : 1f;
        SkiaSharp.SKCanvas? canvas = null; SkiaSharp.SKBitmap? full = null; int tw = 0, th = 0;
        for (int i = 0; i < grid * grid; i++)
        {
            var t = provider.LoadPackage($"{args[1]}{i}.uasset").GetExports().OfType<UTexture2D>().First();
            using var b = (t.Decode(16384, ETexturePlatform.DesktopMobile) ?? throw new Exception($"decode {i}")).ToSkBitmap();
            if (full == null) { tw = (int)(b.Width * scale); th = (int)(b.Height * scale); full = new SkiaSharp.SKBitmap(tw * grid, th * grid); canvas = new SkiaSharp.SKCanvas(full); }
            canvas!.DrawBitmap(b, new SkiaSharp.SKRect((i % grid) * tw, (i / grid) * th, (i % grid + 1) * tw, (i / grid + 1) * th));
        }
        canvas!.Flush();
        using (var data = full!.Encode(SkiaSharp.SKEncodedImageFormat.Png, 100)) File.WriteAllBytes(args[3], data.ToArray());
        Console.WriteLine($"{args[3]} {full.Width}x{full.Height}");
        break;
    }
    case "names":
    {
        // names <lang> <out.json>: the location names, `$map<NNNN>` and `$area<NNNN>_…`, from the
        // game's resident text table, without the help texts and anything carrying markup.
        var lang = args[1];
        var table = Newtonsoft.Json.Linq.JArray.FromObject(
            provider.LoadPackage($"End/Content/Text/{lang}/Resident_TxtRes.uasset").GetExports(), JsonSerializer.Create())[0]["Strings"]!;
        var keep = new Regex(@"^\$(map|area)\d");
        var names = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var entry in table.Children<Newtonsoft.Json.Linq.JProperty>())
        {
            var text = (string?)entry.Value["Text"];
            if (text == null || !keep.IsMatch(entry.Name) || entry.Name.EndsWith("_help") || text.Contains('<') || text.Contains('\n')) continue;
            names[entry.Name] = text;
        }
        File.WriteAllText(args[2], JsonConvert.SerializeObject(names, Formatting.Indented) + "\n");
        Console.WriteLine($"{args[2]}: {names.Count} names");
        break;
    }
    case "regions":
    {
        // regions <out-dir> <size> <webp-quality>: one map image per NaviMapSetting (Layer0, else
        // Background; the coarsest LOD, stitched if it has several tiles) plus maps.json with the
        // world origin of its top-left pixel and the cm per pixel at the exported size.
        string outDir = args[1]; int size = int.Parse(args[2]); int quality = int.Parse(args[3]);
        Directory.CreateDirectory(outDir);
        var meta = new SortedDictionary<string, object>();
        foreach (var path in provider.Files.Keys.Where(k => k.StartsWith("End/Content/DataAsset/Game/NaviMap/NaviMapSetting_") && k.EndsWith(".uasset")).OrderBy(k => k))
        {
            var setting = Path.GetFileNameWithoutExtension(path).Substring("NaviMapSetting_".Length);
            // Story variants (`2600-NIBLA_Before`) cannot be told apart from memory yet, and 99xx are
            // test levels: one map per location, the plain one.
            if (setting.Contains('_') || setting.StartsWith("99")) continue;
            try
            {
                var o = Newtonsoft.Json.Linq.JArray.FromObject(provider.LoadPackage(path).GetExports(), JsonSerializer.Create())[0]["Properties"]!;
                var layer = o["NaviMapLayerInfo"]?.FirstOrDefault(t => (string?)t["Key"] == "_Layer0")?["Value"] ?? o["BackgroundLayerInfo"];
                var lods = layer!["TextureLods"]!.Where(l => l["TextureInfos"]!.Any()).ToList();
                var lod = lods.OrderBy(l => l["TextureInfos"]!.Count()).First();
                var tiles = lod["TextureInfos"]!.ToList();
                int grid = (int)Math.Round(Math.Sqrt(tiles.Count));
                double ppcm = (double)lod["PixelPerCm"]!;
                var wt = o["WorldTransform"]?["Translation"];
                double wx = (double?)wt?["X"] ?? 0, wy = (double?)wt?["Y"] ?? 0;
                double bx = (double)tiles[0]["BaseLocation"]!["X"]!, by = (double)tiles[0]["BaseLocation"]!["Y"]!;
                SkiaSharp.SKBitmap? full = null; SkiaSharp.SKCanvas? canvas = null; int tw = 0, th = 0;
                for (int i = 0; i < tiles.Count; i++)
                {
                    var name = (string)tiles[i]["TextureName"]!;
                    var texPath = provider.Files.Keys.First(k => k.EndsWith("/" + name + ".uasset"));
                    var t = provider.LoadPackage(texPath).GetExports().OfType<UTexture2D>().First();
                    using var b = (t.Decode(16384, ETexturePlatform.DesktopMobile) ?? throw new Exception($"decode {name}")).ToSkBitmap();
                    if (full == null) { tw = b.Width; th = b.Height; full = new SkiaSharp.SKBitmap(tw * grid, th * grid); canvas = new SkiaSharp.SKCanvas(full); }
                    canvas!.DrawBitmap(b, (i % grid) * tw, (i / grid) * th);
                }
                canvas!.Flush();
                int ow = Math.Min(size, full!.Width), oh = (int)Math.Round((double)full.Height * ow / full.Width);
                using var scaled = full.Resize(new SkiaSharp.SKImageInfo(ow, oh), SkiaSharp.SKFilterQuality.High);
                using (var data = scaled.Encode(SkiaSharp.SKEncodedImageFormat.Webp, quality)) File.WriteAllBytes(Path.Combine(outDir, setting + ".webp"), data.ToArray());
                double cmPerPx = (double)full.Width / ow / ppcm;
                meta[setting] = new { x = Math.Round(bx - wx, 1), y = Math.Round(by - wy, 1), cmPerPx = Math.Round(cmPerPx, 4), w = ow, h = oh };
                Console.WriteLine($"{setting}  {ow}x{oh}  {new FileInfo(Path.Combine(outDir, setting + ".webp")).Length / 1024} KB  loc={(string?)o["LocationId"]}");
                full.Dispose(); canvas.Dispose();
            }
            catch (Exception e) { Console.WriteLine($"{setting}  SKIPPED: {e.Message}"); }
        }
        File.WriteAllText(Path.Combine(outDir, "maps.json"), JsonConvert.SerializeObject(meta, Formatting.Indented));
        break;
    }
    case "tex":
        var tex = provider.LoadPackage(args[1]).GetExports().OfType<UTexture2D>().First();
        var bmp = tex.Decode(16384, ETexturePlatform.DesktopMobile) ?? throw new Exception("decode failed");
        using (var img = bmp.ToSkBitmap())
        using (var data = img.Encode(SkiaSharp.SKEncodedImageFormat.Png, 100))
            File.WriteAllBytes(args[2], data.ToArray());
        Console.WriteLine($"{args[2]} {bmp.Width}x{bmp.Height}");
        break;
}

