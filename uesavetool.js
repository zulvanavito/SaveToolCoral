#!/usr/bin/env node
import * as fs from "fs";
import { stdout } from "process";
import {
  Gvas,
  Serializer,
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
    } else if (
      arg.startsWith("-") &&
      !arg.startsWith("-sav") &&
      !arg.startsWith("-json")
    ) {
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
UESaveTool - Unreal Engine Save Game Tool (Coral Island Supported)

Usage:
  node ./uesavetool.js <command> [arguments] [options]

Commands:
  convert <input.sav> <output.json>
      Convert a .sav file (including compressed Coral Island saves) to JSON.

  edit-player <input.json> [options]
      Edit player information (name, title) directly in the JSON save file.
      Options:
        --name <string>     Set character name (e.g. --name Ito)
        --title <string>    Set custom title/gender text (e.g. --title Kak)
        --gender <string>   Set gender enum (e.g. --gender custom | male | female | other)
        --farm <string>     Set farm name
        --out <file>        Output JSON path (default: overwrite input JSON)

  rebuild <input.json> <output.sav>
      Rebuild a JSON file back into a valid .sav file with automatic
      chunked compression and pre-output validation.

  -sav-to-json <input.sav> [output.json]
      (Legacy) Convert save to JSON.

  -json-to-sav <input.json> [output.sav]
      (Legacy) Convert JSON to save.

Examples:
  node ./uesavetool.js convert ManualSave0.sav ManualSave0.json
  node ./uesavetool.js edit-player ManualSave0.json --name Ito --title Kak
  node ./uesavetool.js rebuild ManualSave0.json ManualSave0_Ito_Kak.sav
`);
}

function handleConvert(inputPath, outputPath) {
  if (!inputPath || !outputPath) {
    console.error(
      "Error: 'convert' requires both <input.sav> and <output.json> paths.",
    );
    process.exit(1);
  }

  console.log(`Reading save file: ${inputPath}...`);
  const buf = fs.readFileSync(inputPath);

  const isCompressed = CoralCompressor.isCoralCompressed(buf);
  console.log(
    `Save file detected: ${isCompressed ? "Coral Island Compressed GVAS" : "Standard GVAS"}`,
  );

  const gvas = new Gvas();
  const start = Date.now();
  gvas.deserializeFromBuffer(buf);
  console.log(`Deserialization complete in ${Date.now() - start} ms.`);

  console.log(`Writing JSON to ${outputPath}...`);
  fs.writeFileSync(outputPath, JSON.stringify(gvas, null, 2), "utf8");
  console.log(`Conversion successful! Output saved to: ${outputPath}`);
}

function handleEditPlayer(jsonPath, options) {
  if (!jsonPath) {
    console.error("Error: 'edit-player' requires <input.json> path.");
    process.exit(1);
  }

  if (!options.name && !options.title && !options.farm && !options.gender) {
    console.error(
      "Error: Please provide at least one field to edit (--name, --title, --gender, or --farm).",
    );
    process.exit(1);
  }

  console.log(`Reading JSON file: ${jsonPath}...`);
  const jsonStr = fs.readFileSync(jsonPath, "utf8");
  const jsonObj = JSON.parse(jsonStr);

  let editOptions = {};
  if (options.name) editOptions.name = options.name;
  if (options.title) editOptions.title = options.title;
  if (options.gender) editOptions.gender = options.gender;
  if (options.farm) editOptions.farmName = options.farm;

  const result = CoralPlayerEditor.editPlayer(jsonObj, editOptions);

  console.log("\nPlayer Information Updated:");
  console.log(
    `  Before -> Name: "${result.before.name}", Gender: "${result.before.gender}", Title: "${result.before.title}"`,
  );
  console.log(
    `  After  -> Name: "${result.after.name}", Gender: "${result.after.gender}", Title: "${result.after.title}"\n`,
  );

  const targetPath = options.out || jsonPath;
  console.log(`Saving updated JSON to: ${targetPath}...`);
  fs.writeFileSync(targetPath, JSON.stringify(jsonObj, null, 2), "utf8");
  console.log("Edit complete.");
}

function handleRebuild(jsonPath, savPath) {
  if (!jsonPath || !savPath) {
    console.error(
      "Error: 'rebuild' requires both <input.json> and <output.sav> paths.",
    );
    process.exit(1);
  }

  console.log(`Reading JSON file: ${jsonPath}...`);
  const jsonStr = fs.readFileSync(jsonPath, "utf8");
  const jsonObj = JSON.parse(jsonStr);

  console.log("Reconstructing GVAS structure from JSON...");
  const gvas = Gvas.from(jsonObj);

  console.log("Serializing to binary save buffer...");
  const outBuf = gvas.serializeToBuffer();

  console.log("Running Save Validation System...");
  try {
    SaveValidator.validate(outBuf, gvas);
    console.log("  [PASS] GVAS header verified");
    console.log("  [PASS] Property count & integrity verified");
    if (gvas.CoralCompressed) {
      console.log("  [PASS] Compression chunk blocks (0x9E2A83C1) verified");
    }
    console.log("  [PASS] Re-read by parser verified without errors");
  } catch (valErr) {
    console.error(
      "\n[CRITICAL] Save validation FAILED! Aborting file generation to prevent save corruption.",
    );
    console.error(valErr.message);
    process.exit(1);
  }

  console.log(`Writing validated save file to: ${savPath}...`);
  fs.writeFileSync(savPath, outBuf);
  console.log(
    `Rebuild complete! Validated save file created: ${savPath} (${outBuf.length} bytes)`,
  );
}

function handleLegacySavToJson(inputPath, outputPath) {
  fs.readFile(inputPath, (err, buf) => {
    if (err) throw err;
    const gvas = new Gvas();
    gvas.deserializeFromBuffer(buf);

    if (outputPath) {
      fs.writeFile(outputPath, JSON.stringify(gvas, null, 2), (err) => {
        if (err) throw err;
        console.log(`Saved JSON to ${outputPath}`);
      });
    } else {
      stdout.write(JSON.stringify(gvas), (err) => {
        if (err) throw err;
      });
    }
  });
}

function handleLegacyJsonToSav(inputPath, outputPath) {
  fs.readFile(inputPath, "utf8", (err, json) => {
    if (err) throw err;
    const gvas = Gvas.from(JSON.parse(json));
    const out_buf = gvas.serializeToBuffer();

    if (outputPath) {
      fs.writeFile(outputPath, out_buf, (err) => {
        if (err) throw err;
        console.log(`Saved SAV to ${outputPath}`);
      });
    } else {
      stdout.write(out_buf, (err) => {
        if (err) throw err;
      });
    }
  });
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
    case "-sav-to-json":
      handleLegacySavToJson(positional[1], positional[2]);
      break;
    case "-json-to-sav":
      handleLegacyJsonToSav(positional[1], positional[2]);
      break;
    default:
      console.error(`Unknown command: '${command}'`);
      showHelp();
      process.exit(1);
  }
}

main();
