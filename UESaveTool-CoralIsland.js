#!/usr/bin/env node
/**
 * UESaveTool-CoralIsland
 * Dedicated CLI for Coral Island (Unreal Engine 4.27) Save Game Management
 */

import * as fs from "fs";
import {
  Gvas,
  CoralPlayerEditor,
  SaveValidator,
  CoralCompressor,
} from "./index.js";

function parseArgs(args) {
  let positional = [];
  let options = {};

  for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    if (arg.startsWith("--")) {
      let key = arg.slice(2);
      let next = args[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith("-")) {
      let key = arg.slice(1);
      let next = args[i + 1];
      if (next && !next.startsWith("-")) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, options };
}

function showHelp() {
  console.log(`
================================================================
 UESaveTool-CoralIsland: Coral Island Save Game Tool (UE 4.27)
================================================================

Commands:
  convert <input.sav> <output.json>
      Decompress and convert Coral Island .sav to JSON format.

  edit-player <input.json> [options]
      Edit player information in the JSON file.
      Options:
        --name <string>     Set character name (e.g. --name Ito)
        --title <string>    Set custom title/gender text (e.g. --title Kak)
        --gender <string>   Set gender enum (e.g. --gender custom | male | female | other)
        --farm <string>     Set farm name
        --out <file>        Output JSON path (optional, default: overwrite input)

  rebuild <input.json> <output.sav>
      Validate, recompress, and rebuild the JSON save file back into .sav.

  info <input.sav | input.json>
      Display current character and save game details.

  inventory <input.sav | input.json>
      Display player inventory slots and item details.

  set-item <input.sav | input.json> --slot <0-39> --id <itemId> [--qty <count>]
      Add or update an item slot in the inventory.

Examples:
  node ./UESaveTool-CoralIsland.js convert ManualSave0.sav ManualSave0.json
  node ./UESaveTool-CoralIsland.js edit-player ManualSave0.json --name Ito --title Kak
  node ./UESaveTool-CoralIsland.js rebuild ManualSave0.json ManualSave0_Ito_Kak.sav
  node ./UESaveTool-CoralIsland.js info ManualSave0_Ito_Kak.sav
  node ./UESaveTool-CoralIsland.js inventory ManualSave0.sav
  node ./UESaveTool-CoralIsland.js set-item ManualSave0.sav --slot 4 --id item_65535 --qty 50
`);
}

function handleConvert(inputPath, outputPath) {
  if (!inputPath || !outputPath) {
    console.error(
      "Error: 'convert' requires both <input.sav> and <output.json>.",
    );
    process.exit(1);
  }

  console.log(`[1/3] Reading: ${inputPath}`);
  const buf = fs.readFileSync(inputPath);

  if (!CoralCompressor.isCoralCompressed(buf)) {
    console.warn(
      "Warning: File does not appear to be a compressed Coral Island save, attempting standard parse...",
    );
  }

  console.log(`[2/3] Decompressing chunks & parsing GVAS properties...`);
  const gvas = new Gvas();
  const start = Date.now();
  gvas.deserializeFromBuffer(buf);
  console.log(`      Parsed in ${Date.now() - start} ms.`);

  console.log(`[3/3] Saving JSON output to: ${outputPath}...`);
  fs.writeFileSync(outputPath, JSON.stringify(gvas, null, 2), "utf8");
  console.log(`[DONE] Converted successfully: ${outputPath}`);
}

function handleEditPlayer(jsonPath, options) {
  if (!jsonPath) {
    console.error("Error: 'edit-player' requires <input.json>.");
    process.exit(1);
  }

  if (!options.name && !options.title && !options.farm && !options.gender) {
    console.error(
      "Error: Specify at least one attribute to modify (--name, --title, --gender, --farm).",
    );
    process.exit(1);
  }

  console.log(`Reading JSON: ${jsonPath}...`);
  const jsonStr = fs.readFileSync(jsonPath, "utf8");
  const jsonObj = JSON.parse(jsonStr);

  let editOptions = {};
  if (options.name) editOptions.name = options.name;
  if (options.title) editOptions.title = options.title;
  if (options.gender) editOptions.gender = options.gender;
  if (options.farm) editOptions.farmName = options.farm;

  const result = CoralPlayerEditor.editPlayer(jsonObj, editOptions);

  console.log(`\n--- Character Details Updated ---`);
  console.log(
    `  Nama      : ${result.before.name || "(none)"} -> ${result.after.name}`,
  );
  console.log(
    `  Gender    : ${result.before.gender || "(none)"} -> ${result.after.gender}`,
  );
  console.log(
    `  Panggilan : ${result.before.title || "(none)"} -> ${result.after.title}`,
  );
  if (options.farm) {
    console.log(
      `  Kebun     : ${result.before.farmName || "(none)"} -> ${result.after.farmName}`,
    );
  }
  console.log(`---------------------------------\n`);

  const targetPath = options.out || jsonPath;
  fs.writeFileSync(targetPath, JSON.stringify(jsonObj, null, 2), "utf8");
  console.log(`[DONE] Updated JSON saved: ${targetPath}`);
}

function handleRebuild(jsonPath, savPath) {
  if (!jsonPath || !savPath) {
    console.error(
      "Error: 'rebuild' requires both <input.json> and <output.sav>.",
    );
    process.exit(1);
  }

  console.log(`[1/4] Reading JSON: ${jsonPath}...`);
  const jsonStr = fs.readFileSync(jsonPath, "utf8");
  const jsonObj = JSON.parse(jsonStr);

  console.log(`[2/4] Serializing GVAS property tree...`);
  const gvas = Gvas.from(jsonObj);
  const outBuf = gvas.serializeToBuffer();

  console.log(`[3/4] Running Validation Checks...`);
  try {
    SaveValidator.validate(outBuf, gvas);
    console.log(`      ✓ GVAS Header valid`);
    console.log(`      ✓ Property counts match`);
    console.log(`      ✓ Chunked compression blocks verified (0x9E2A83C1)`);
    console.log(`      ✓ Parser re-read validation passed`);
  } catch (err) {
    console.error(
      `\n[ABORT] Validation failed! Refusing to write corrupt save file.`,
    );
    console.error(err.message);
    process.exit(1);
  }

  console.log(`[4/4] Writing rebuilt save: ${savPath}...`);
  fs.writeFileSync(savPath, outBuf);
  console.log(
    `[DONE] Save successfully rebuilt: ${savPath} (${outBuf.length} bytes)`,
  );
}

function handleInventory(filePath) {
  if (!filePath) {
    console.error("Error: 'inventory' requires file path.");
    process.exit(1);
  }

  let gvasObj = null;
  if (filePath.endsWith(".json")) {
    gvasObj = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } else {
    const buf = fs.readFileSync(filePath);
    const gvas = new Gvas();
    gvas.deserializeFromBuffer(buf);
    gvasObj = gvas;
  }

  const items = CoralPlayerEditor.getInventory(gvasObj);
  const ITEM_NAMES = {
    item_65083: "Pickaxe",
    item_65078: "Axe",
    item_65138: "Watering Can",
    item_65244: "Hoe",
    item_80082: "Wood",
    item_131008: "Scythe",
    item_61004: "Osmium Ore",
    item_62004: "Osmium Kelp",
    item_62008: "Osmium Kelp Essence",
    item_65063: "Hardwood",
    item_65221: "Fishing Pole",
    item_65535: "Auto Chest",
    item_41029: "Resin",
    item_65509: "Auto Petter",
    item_65022: "Aging Barrel",
    item_65534: "Ultimate Scarecrow",
    item_50506: "Slime Goop",
    "item_50320-d": "Osmium Arame",
    item_50320: "Arame",
    item_50204: "Murex",
    item_65359: "Large Fish Bait",
    item_10002: "Pink Diamond",
    item_61015: "Diamond",
    item_50509: "Tough Meat",
    item_50507: "Silky Fur",
    item_65358: "Medium Fish Bait",
    item_134005: "Monarch Caterpillar",
    item_65107: "Scrap",
  };

  console.log(`\n--- Coral Island Inventory Slots (${items.length} items) ---`);
  for (const it of items) {
    const name = ITEM_NAMES[it.id] || it.id;
    const row = Math.floor(it.slotIndex / 10) + 1;
    const col = (it.slotIndex % 10) + 1;
    console.log(
      `  [Baris ${row}, Slot ${col.toString().padStart(2, " ")}] (Index ${it.slotIndex.toString().padStart(2, " ")}): ${it.id.padEnd(12, " ")} | ${name.padEnd(20, " ")} | Qty: ${it.quantity}`,
    );
  }
  console.log(
    `-------------------------------------------------------------\n`,
  );
}

function handleInfo(filePath) {
  if (!filePath) {
    console.error("Error: 'info' requires file path.");
    process.exit(1);
  }

  let gvasObj = null;
  if (filePath.endsWith(".json")) {
    gvasObj = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } else {
    const buf = fs.readFileSync(filePath);
    const gvas = new Gvas();
    gvas.deserializeFromBuffer(buf);
    gvasObj = gvas;
  }

  let info = CoralPlayerEditor.getPlayerInfo(gvasObj);
  console.log(`\n--- Coral Island Save Information ---`);
  console.log(`  File      : ${filePath}`);
  console.log(`  Nama      : ${info.name || "(Kosong)"}`);
  console.log(`  Gender    : ${info.gender || "(Kosong)"}`);
  console.log(`  Panggilan : ${info.title || "(Kosong)"}`);
  console.log(`  Kebun     : ${info.farmName || "(Kosong)"}`);
  console.log(`-------------------------------------\n`);
}

function handleSetItem(filePath, options) {
  if (!filePath) {
    console.error("Error: 'set-item' requires file path.");
    process.exit(1);
  }
  if (options.slot === undefined || !options.id) {
    console.error(
      "Error: 'set-item' requires --slot <0-39> and --id <itemId> (optional: --qty <number>).",
    );
    process.exit(1);
  }

  const slot = Number(options.slot);
  const id = options.id;
  const qty = Number(options.qty || 1);

  let isSav = !filePath.endsWith(".json");
  if (isSav) {
    const buf = fs.readFileSync(filePath);
    const gvas = new Gvas();
    gvas.deserializeFromBuffer(buf);
    CoralPlayerEditor.setInventorySlot(gvas, slot, id, qty);
    const outBuf = gvas.serializeToBuffer();
    SaveValidator.validate(outBuf, gvas);
    fs.writeFileSync(filePath, outBuf);
    console.log(
      `[DONE] Slot ${slot} updated with ${id} (Qty: ${qty}) in ${filePath}`,
    );
  } else {
    const jsonObj = JSON.parse(fs.readFileSync(filePath, "utf8"));
    CoralPlayerEditor.setInventorySlot(jsonObj, slot, id, qty);
    fs.writeFileSync(filePath, JSON.stringify(jsonObj, null, 2), "utf8");
    console.log(
      `[DONE] Slot ${slot} updated with ${id} (Qty: ${qty}) in ${filePath}`,
    );
  }
}

function main() {
  const rawArgs = process.argv.slice(2);
  if (
    rawArgs.length === 0 ||
    rawArgs.includes("-h") ||
    rawArgs.includes("--help")
  ) {
    showHelp();
    return;
  }

  const { positional, options } = parseArgs(rawArgs);
  const command = positional[0];

  switch (command) {
    case "convert":
      handleConvert(positional[1], positional[2]);
      break;
    case "edit-player":
      handleEditPlayer(positional[1], options);
      break;
    case "rebuild":
      handleRebuild(positional[1], positional[2]);
      break;
    case "info":
      handleInfo(positional[1]);
      break;
    case "inventory":
    case "inv":
      handleInventory(positional[1]);
      break;
    case "set-item":
      handleSetItem(positional[1], options);
      break;
    default:
      console.error(`Unknown command: '${command}'`);
      showHelp();
      process.exit(1);
  }
}

main();
