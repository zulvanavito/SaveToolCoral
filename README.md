# SaveToolCoral

A dedicated Unreal Engine 4.27 GVAS save game editor and converter specifically tailored for **Coral Island**, forked and expanded from [ch1pset/UESaveTool](https://github.com/ch1pset/UESaveTool).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](/LICENSE)
[![Engine: UE 4.27](https://img.shields.io/badge/Unreal%20Engine-4.27-brightgreen.svg)]()
[![Game: Coral Island](https://img.shields.io/badge/Game-Coral%20Island-teal.svg)]()

> **Credits & Attribution:**  
> This project is forked from [UESaveTool](https://github.com/ch1pset/UESaveTool) by [ch1pset](https://github.com/ch1pset). Original GVAS parsing and serialization architecture belongs to `ch1pset`. SaveToolCoral extends the original tool with dedicated Coral Island features, chunked Zlib decompression/compression (`0x9E2A83C1`), custom property handlers, automated 4-stage save validation, and character & inventory editing CLI.

---

## Features

- **Full Coral Island Compatibility (UE 4.27)**:
  - Transparent handling of outer GVAS container (`C_CompressedSaveGame`) and inner payload (`C_SaveGame`).
  - Native support for Unreal package chunked Zlib compression (`0x9E2A83C1` `PACKAGE_FILE_TAG`) with 128 KB chunk blocks.
- **Complete Property Serialization**:
  - Full support for `ByteProperty`, `BoolProperty`, `IntProperty`, `Int64Property`, `FloatProperty`, `NameProperty`, `StrProperty`, `TextProperty`, `EnumProperty`, `StructProperty`, `ArrayProperty`, `MapProperty`, `SetProperty`, `ObjectProperty`, and `SoftObjectProperty`.
  - **UnknownProperty Fallback**: Safeguards unrecognized property types by storing and re-emitting raw binary buffers without data corruption.
- **Character & Profile Editor**:
  - Edit character name, title/honorific (`CustomGenderText`), gender enum, and farm name across both `C_PlayerInformation` and `C_ChangedPlayerInfo`.
- **Modern Interactive Web GUI Editor**:
  - **Safe Drag & Drop & File Picker Upload**: Isolated in-memory editing without risky AppData auto-scanning; edits only the file you explicitly upload.
  - **Visual Item Artwork & Smart Local Cache**: Displays authentic game icons sourced from [Coral Island Fandom Wiki](https://coralisland.fandom.com/wiki/Coral_Island_Wiki) with fast local manifest indexing (`icon_index.json`) and native HTTP disk caching.
  - **Interactive 40-Slot Bag**: Visual Hotbar (slots 1–10) and interior bag grids with star tiers (Normal, Bronze, Silver, Gold, Osmium) and live quantity badges.
  - **In-Memory Instant Search**: Fast autocomplete searching over 5,160+ DataTable items with icon thumbnails.
  - **Character & Economy Form**: Edit player name, farm name, honorific title, gender, Gold, and Merit Points with quick-increment buttons.
  - **Direct Validated Download**: 1-click download of the rebuilt `.sav` binary file after passing 4-stage integrity tests.
- **Inventory & Item Management**:
  - View full visual table of all 40 slots (Hotbar & Bags).
  - Add or modify item stacks and quantities directly in `.sav` files.
  - Native support for Coral Island quality tiers: Base, Bronze (`-a`), Silver (`-b`), Gold (`-c`), and **Osmium** (`-d`).
- **4-Stage Automated Save Validation (`SaveValidator`)**:
  - Verifies GVAS header magic, property tree integrity, compression block validity, and round-trip re-deserialization before writing to disk.

---

## Requirements

- **Node.js**: Version 16.7.0 or newer (tested on Node.js 18, 20, and 24).
- Windows PowerShell, Command Prompt, or Linux/macOS terminal.
- Modern web browser (Chrome, Edge, Firefox, Safari, Brave).

---

## Web GUI Editor (Recommended)

SaveToolCoral features a fast, clean, tropical coastal-themed Web GUI:

### Running the Web GUI

```powershell
npm run gui
# or simply double-click gui.cmd in Windows Explorer
```

Open your browser at:
```
http://localhost:3000
```

### GUI Workflow

1. **Upload Save File**: Drag and drop your `.sav` file (e.g. `ManualSave0.sav`) into the dropzone or click **"Pilih File (.sav)"**.
   > **Save Location Guide**: On Windows, Coral Island saves are typically stored at:  
   > `%LOCALAPPDATA%\ProjectCoral\Saved\SaveGames\World_1\ManualSave0.sav`
2. **Edit Inventory & Player**:
   - Click any of the 40 slot cards to edit the item, adjust quantity (1–999), or pick star quality (Normal, Bronze, Silver, Gold, Osmium).
   - Use the search bar to find any of the 5,160+ items in the game database with icon thumbnails.
   - Switch to the **Profil dan Karakter** tab to edit character name, farm name, title, gender, Gold, or Merit Points.
3. **Download Validated Save**: Click **"Unduh File (.sav)"** in the top bar to download the updated save game file. The file is validated through `SaveValidator` to guarantee 100% binary game compatibility.

---

## Quick Start (CLI)

All operations can also be executed directly via terminal using `UESaveTool-CoralIsland.js`:

### 1. View Character & Save Details

```powershell
node ./UESaveTool-CoralIsland.js info ManualSave0.sav
```

### 2. View Inventory Slots

Displays all 40 slots with row numbers, indices, item IDs, names, and quantities:

```powershell
node ./UESaveTool-CoralIsland.js inventory ManualSave0.sav
```

### 3. Add or Modify Inventory Items Directly

Modify any slot (0–39) directly in the `.sav` file with automatic integrity validation:

```powershell
# Format: node ./UESaveTool-CoralIsland.js set-item <file.sav> --slot <0-39> --id <itemId> [--qty <count>]

# Example 1: Add 50 Auto Chests in Row 1 Slot 4 (Index 3)
node ./UESaveTool-CoralIsland.js set-item ManualSave0.sav --slot 3 --id item_65535 --qty 50

# Example 2: Add 999 Osmium Arame in Row 1 Slot 10 (Index 9)
node ./UESaveTool-CoralIsland.js set-item ManualSave0.sav --slot 9 --id item_50320-d --qty 999
```

### 4. Convert Between `.sav` and `.json`

```powershell
# Decompress and convert save to JSON
node ./UESaveTool-CoralIsland.js convert ManualSave0.sav ManualSave0.json

# Validate and rebuild JSON back into .sav
node ./UESaveTool-CoralIsland.js rebuild ManualSave0.json ManualSave0_rebuilt.sav
```

### 5. Edit Character Profile

```powershell
node ./UESaveTool-CoralIsland.js edit-player ManualSave0.json --name Ito --title Tuan --farm "Mey Farm"
```

---

## Item Quality System Reference

In Coral Island, item qualities (for crops, foraging, fish, critters, and ocean scavenging) are identified by DataTable ID suffixes:

| Quality            | Suffix   | Example Item ID | Displayed Name             |
| :----------------- | :------- | :-------------- | :------------------------- |
| **Regular / Base** | _(none)_ | `item_50320`    | Arame (No star)            |
| **Bronze**         | `-a`     | `item_50320-a`  | Bronze Star Arame          |
| **Silver**         | `-b`     | `item_50320-b`  | Silver Star Arame          |
| **Gold**           | `-c`     | `item_50320-c`  | Gold Star Arame            |
| **Osmium**         | `-d`     | `item_50320-d`  | Osmium Star Arame (Purple) |

_Full item databases are provided in `DT_InventoryItems.json` and English name mappings in `coral_island_en.json`._

---

## Programmatic Usage (API)

SaveToolCoral can be used as an ESModule in your own Node.js scripts:

```javascript
import fs from "fs";
import { Gvas, CoralPlayerEditor, SaveValidator } from "./index.js";

// Read and deserialize
const buf = fs.readFileSync("ManualSave0.sav");
const gvas = new Gvas();
gvas.deserializeFromBuffer(buf);

// Edit character
CoralPlayerEditor.editPlayer(gvas, {
  name: "Ito",
  title: "Tuan",
  farmName: "Mey Farm",
});

// Edit inventory slot
CoralPlayerEditor.setInventorySlot(gvas, 3, "item_65535", 50);

// Serialize and validate
const outBuf = gvas.serializeToBuffer();
SaveValidator.validate(outBuf, gvas);

fs.writeFileSync("ManualSave0_modified.sav", outBuf);
```

---

## Implementation Details & Design Patterns

If you wish to expand functionality, adhere to the core architecture:

- All properties extend the base [`Property`](file:///d:/01%20Projects/savetool/models/properties/Property.js) class implementing `get Size()`, `deserialize()`, `serialize()`, and `static from()`.
- Never instantiate a `Property` directly with `new` outside its own constructor/`from` method; always instantiate via `PropertyFactory.create()`.
- Chunked compression and decompression are handled by [`CoralCompressor`](file:///d:/01%20Projects/savetool/utils/CoralCompressor.js) with 48-byte headers and Zlib deflate.
- Save validation is performed by [`SaveValidator`](file:///d:/01%20Projects/savetool/utils/SaveValidator.js) to guarantee game compatibility before writing.

---

## Acknowledgements & Credits

- **[ch1pset/UESaveTool](https://github.com/ch1pset/UESaveTool)** — Original creator and base repository for Unreal Engine GVAS serialization.
- **[13xforever/gvas-converter](https://github.com/13xforever/gvas-converter)** — GVAS conversion research.
- **[Rob7045713/UeSaveSerializer](https://gist.github.com/Rob7045713/2f838ad66237f87c86d5396af573b71c)** — UE save serialization reference.
- **[Coral Island Wiki (Fandom)](https://coralisland.fandom.com/wiki/Coral_Island_Wiki)** — Official game artwork & item icons.
- **[koenigderluegner/coral-island-guide](https://github.com/koenigderluegner/coral-island-guide)** — Coral Island item data references.

---

## License

This project is licensed under the [MIT License](/LICENSE).
