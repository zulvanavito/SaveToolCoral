import express from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { Gvas, CoralPlayerEditor, SaveValidator } from "../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for JSON (supports large base64 dataUrl), raw binary uploads, and static assets
app.use(express.json({ limit: "50mb" }));
app.use(express.raw({ type: "application/octet-stream", limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

// In-memory item database cache
console.log("[INIT] Loading item database into memory...");
let itemDatabase = new Map(); // key: baseId -> item data
let allItemsList = [];

function initItemDatabase() {
  try {
    const dtPath = path.join(rootDir, "DT_InventoryItems.json");
    const enPath = path.join(rootDir, "coral_island_en.json");

    let enData = {};
    if (fs.existsSync(enPath)) {
      enData = JSON.parse(fs.readFileSync(enPath, "utf8"));
    }

    if (fs.existsSync(dtPath)) {
      const dtRaw = JSON.parse(fs.readFileSync(dtPath, "utf8"));
      const rows = dtRaw[0]?.Rows || dtRaw.Rows || {};

      for (const [key, row] of Object.entries(rows)) {
        if (!key.startsWith("item_") || key === "None") continue;

        let qualitySuffix = null;
        let baseId = key;
        if (key.endsWith("-a")) {
          qualitySuffix = "bronze";
          baseId = key.slice(0, -2);
        } else if (key.endsWith("-b")) {
          qualitySuffix = "silver";
          baseId = key.slice(0, -2);
        } else if (key.endsWith("-c")) {
          qualitySuffix = "gold";
          baseId = key.slice(0, -2);
        } else if (key.endsWith("-d")) {
          qualitySuffix = "osmium";
          baseId = key.slice(0, -2);
        }

        let nameKey = `DT_InventoryItems.${baseId}_name`;
        let descKey = `DT_InventoryItems.${baseId}_description`;

        let rawName =
          row.name?.SourceString ||
          row.name?.LocalizedString ||
          enData[nameKey] ||
          enData[key] ||
          baseId;
        let rawDesc =
          row.description?.SourceString ||
          row.description?.LocalizedString ||
          enData[descKey] ||
          "";
        let category = row.displayKey || "General";

        if (!itemDatabase.has(baseId)) {
          itemDatabase.set(baseId, {
            baseId,
            name: rawName,
            description: rawDesc,
            category,
            stackable: row.stackable !== false,
            qualities: {
              base: baseId,
            },
          });
        }

        const entry = itemDatabase.get(baseId);
        if (qualitySuffix) {
          entry.qualities[qualitySuffix] = key;
        }
      }

      for (const item of itemDatabase.values()) {
        item.hasQualities = Object.keys(item.qualities).length > 1;
      }

      allItemsList = Array.from(itemDatabase.values());
      console.log(
        `[INIT] Database loaded: ${allItemsList.length} unique base items.`,
      );
    } else {
      console.warn("[INIT] DT_InventoryItems.json not found in root dir.");
    }
  } catch (err) {
    console.error("[INIT] Error loading item database:", err);
  }
}

initItemDatabase();

// Helper: resolve item metadata by any key (including -a, -b, -c, -d)
function resolveItemInfo(itemId) {
  if (!itemId) return null;
  const cleanId = itemId.replace(/\0/g, "").trim();

  let quality = "base";
  let baseId = cleanId;
  if (cleanId.endsWith("-a")) {
    quality = "bronze";
    baseId = cleanId.slice(0, -2);
  } else if (cleanId.endsWith("-b")) {
    quality = "silver";
    baseId = cleanId.slice(0, -2);
  } else if (cleanId.endsWith("-c")) {
    quality = "gold";
    baseId = cleanId.slice(0, -2);
  } else if (cleanId.endsWith("-d")) {
    quality = "osmium";
    baseId = cleanId.slice(0, -2);
  }

  const meta = itemDatabase.get(baseId);
  return {
    id: cleanId,
    baseId,
    name: meta?.name || cleanId,
    category: meta?.category || "Unknown",
    quality,
    stackable: meta?.stackable !== false,
    hasQualities: meta ? Object.keys(meta.qualities).length > 1 : false,
    availableQualities: meta?.qualities || { base: cleanId },
  };
}

// Local icon cache and wiki resolution
const iconsDir = path.join(__dirname, "public", "icons");
const iconIndexPath = path.join(iconsDir, "icon_index.json");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

let iconIndex = {};
if (fs.existsSync(iconIndexPath)) {
  try {
    iconIndex = JSON.parse(fs.readFileSync(iconIndexPath, "utf8"));
  } catch (err) {
    iconIndex = {};
  }
}

function saveIconIndex() {
  try {
    fs.writeFileSync(iconIndexPath, JSON.stringify(iconIndex, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving icon index:", err);
  }
}

function getSafeFilename(name) {
  return (
    name
      .replace(/\0/g, "")
      .trim()
      .replace(/[^a-zA-Z0-9_\-]/g, "_") + ".png"
  );
}

async function resolveFandomIconUrl(name) {
  if (!name || name === "(Kosong)") return null;
  const cleanName = name.replace(/\0/g, "").trim();
  const sentence =
    cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();

  const titles = Array.from(
    new Set([`File:${cleanName}.png`, `File:${sentence}.png`]),
  ).join("|");

  try {
    const url = `https://coralisland.fandom.com/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url&redirects=1&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SaveToolCoral/1.2" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.query?.pages) {
        for (const page of Object.values(data.query.pages)) {
          if (page.imageinfo && page.imageinfo[0]?.url) {
            return page.imageinfo[0].url;
          }
        }
      }
    }

    // Fallback: search File namespace
    const searchUrl = `https://coralisland.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanName)}&srnamespace=6&srlimit=1&format=json`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "SaveToolCoral/1.2" },
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const match = searchData.query?.search?.[0];
      if (match?.title) {
        const infoUrl = `https://coralisland.fandom.com/api.php?action=query&titles=${encodeURIComponent(match.title)}&prop=imageinfo&iiprop=url&format=json`;
        const infoRes = await fetch(infoUrl, {
          headers: { "User-Agent": "SaveToolCoral/1.2" },
        });
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          for (const page of Object.values(infoData.query?.pages || {})) {
            if (page.imageinfo && page.imageinfo[0]?.url) {
              return page.imageinfo[0].url;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`Error resolving icon for ${name}:`, err.message);
  }
  return null;
}

// Active session state
let loadedGvas = null;
let currentFilename = "ManualSave0.sav";
let currentOutBuf = null;

// Helper: Parse GVAS buffer into frontend payload
function parseGvasPayload(buf, filename = "ManualSave0.sav") {
  const gvas = new Gvas();
  gvas.deserializeFromBuffer(buf);

  // Player Information
  const info = CoralPlayerEditor.getPlayerInfo(gvas);
  const pData = CoralPlayerEditor.findPlayerSaveData(gvas);

  let gold = 0;
  let meritPoints = 0;
  if (pData?.Properties) {
    const gProp = pData.Properties.find(
      (p) => (p.Name || "").replace(/\0/g, "").trim() === "playerCurrentGold",
    );
    if (gProp) gold = Number(gProp.Value || 0);

    const mProp = pData.Properties.find(
      (p) =>
        (p.Name || "").replace(/\0/g, "").trim() === "playerCurrentMeritPoint",
    );
    if (mProp) meritPoints = Number(mProp.Value || 0);
  }

  // Inventory Slots (Full 40 slots representation)
  const rawInv = CoralPlayerEditor.getInventory(gvas);
  const slots = [];

  for (let i = 0; i < 40; i++) {
    const match = rawInv.find((it) => it.slotIndex === i);
    if (match && match.id) {
      const meta = resolveItemInfo(match.id);
      slots.push({
        slotIndex: i,
        id: match.id,
        name: meta?.name || match.id,
        category: meta?.category || "General",
        quantity: match.quantity || 1,
        quality: meta?.quality || "base",
        hasQualities: meta?.hasQualities || false,
        availableQualities: meta?.availableQualities || { base: match.id },
        empty: false,
      });
    } else {
      slots.push({
        slotIndex: i,
        id: "",
        name: "(Kosong)",
        category: "Empty",
        quantity: 0,
        quality: "base",
        hasQualities: false,
        availableQualities: { base: "" },
        empty: true,
      });
    }
  }

  loadedGvas = gvas;
  currentFilename = filename;
  currentOutBuf = null;

  return {
    filename,
    size: buf.length,
    player: {
      name: info.name || "",
      farmName: info.farmName || "",
      gender: info.gender || "EC_Gender::Male",
      title: info.title || "",
      gold,
      meritPoints,
    },
    inventory: slots,
  };
}

// GET /api/icon/:name - Get icon (serves local file or returns resolved CDN URL)
app.get("/api/icon/:name", async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name || name === "(Kosong)") {
      return res.status(404).send("Not found");
    }

    const safeFilename = getSafeFilename(name);
    const diskPath = path.join(iconsDir, safeFilename);

    // Serve from local disk cache if available
    if (fs.existsSync(diskPath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", "image/png");
      return res.sendFile(diskPath);
    }

    // Query and cache wiki icon URL if missing
    let cdnUrl = iconIndex[name]?.cdnUrl;
    if (!cdnUrl && iconIndex[name] !== null) {
      cdnUrl = await resolveFandomIconUrl(name);
      if (cdnUrl) {
        iconIndex[name] = {
          filename: safeFilename,
          cdnUrl,
          updatedAt: Date.now(),
        };
        saveIconIndex();
      } else {
        iconIndex[name] = null;
        saveIconIndex();
      }
    }

    if (cdnUrl) {
      return res.json({ success: true, url: cdnUrl, local: false });
    }

    res.status(404).json({ success: false, error: "Icon not found on Wiki" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/icons/save-cache - Save base64 image data into local disk cache
app.post("/api/icons/save-cache", (req, res) => {
  try {
    const { name, dataUrl } = req.body;
    if (!name || !dataUrl) {
      return res
        .status(400)
        .json({ success: false, error: "Missing name or dataUrl" });
    }

    const cleanName = name.replace(/\0/g, "").trim();
    const safeFilename = getSafeFilename(cleanName);
    const diskPath = path.join(iconsDir, safeFilename);

    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    fs.writeFileSync(diskPath, buffer);
    iconIndex[cleanName] = {
      filename: safeFilename,
      cachedAt: Date.now(),
      size: buffer.length,
    };
    saveIconIndex();

    res.json({ success: true, filename: safeFilename, size: buffer.length });
  } catch (err) {
    console.error("Save cache error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/icons/resolve-batch - Batch resolve icon paths (local or Fandom CDN)
app.post("/api/icons/resolve-batch", async (req, res) => {
  try {
    const names = Array.isArray(req.body.names) ? req.body.names : [];
    const uniqueNames = Array.from(
      new Set(names.filter((n) => n && n !== "(Kosong)")),
    );

    const results = {};
    const missingFandom = [];

    // Check local disk before querying remote wiki
    for (const name of uniqueNames) {
      const safeFilename = getSafeFilename(name);
      const diskPath = path.join(iconsDir, safeFilename);
      if (fs.existsSync(diskPath)) {
        results[name] = `/icons/${safeFilename}`;
      } else if (iconIndex[name]?.cdnUrl) {
        results[name] = iconIndex[name].cdnUrl;
      } else if (iconIndex[name] === null) {
        results[name] = null;
      } else {
        missingFandom.push(name);
      }
    }

    // Query missing icons from wiki
    if (missingFandom.length > 0) {
      await Promise.all(
        missingFandom.map(async (name) => {
          const cdnUrl = await resolveFandomIconUrl(name);
          if (cdnUrl) {
            results[name] = cdnUrl;
            iconIndex[name] = {
              filename: getSafeFilename(name),
              cdnUrl,
              updatedAt: Date.now(),
            };
          } else {
            iconIndex[name] = null;
            results[name] = null;
          }
        }),
      );
      saveIconIndex();
    }

    res.json({ success: true, icons: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/icons/stats - Return count and disk size of icon cache
app.get("/api/icons/stats", (req, res) => {
  try {
    const files = fs.existsSync(iconsDir)
      ? fs.readdirSync(iconsDir).filter((f) => f.endsWith(".png"))
      : [];
    let totalBytes = 0;
    for (const f of files) {
      totalBytes += fs.statSync(path.join(iconsDir, f)).size;
    }

    res.json({
      success: true,
      count: files.length,
      totalBytes,
      totalKB: (totalBytes / 1024).toFixed(1),
      totalMB: (totalBytes / 1024 / 1024).toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/icons/clear - Clear the local icon cache
app.post("/api/icons/clear", (req, res) => {
  try {
    const files = fs.existsSync(iconsDir)
      ? fs.readdirSync(iconsDir).filter((f) => f.endsWith(".png"))
      : [];
    for (const f of files) {
      fs.unlinkSync(path.join(iconsDir, f));
    }
    iconIndex = {};
    saveIconIndex();

    res.json({
      success: true,
      message: `Cache ikon dibersihkan (${files.length} file dihapus).`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload - Handle binary save file upload (Drag & Drop or File Picker)
app.post("/api/upload", (req, res) => {
  try {
    const buf = req.body;
    if (!buf || buf.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Buffer file kosong atau tidak valid.",
      });
    }

    const filename = req.headers["x-filename"]
      ? decodeURIComponent(req.headers["x-filename"])
      : "ManualSave0.sav";
    const result = parseGvasPayload(buf, filename);

    res.json({
      success: true,
      message: `File ${filename} berhasil dimuat dan dibaca.`,
      ...result,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({
      success: false,
      error: `Gagal membaca save file: ${err.message}`,
    });
  }
});

// GET /api/load-workspace - Quick loader for project workspace ManualSave0.sav (if exists)
app.get("/api/load-workspace", (req, res) => {
  try {
    const defaultFile = path.join(rootDir, "ManualSave0.sav");
    if (!fs.existsSync(defaultFile)) {
      return res.status(404).json({
        success: false,
        error: "ManualSave0.sav tidak ditemukan di folder workspace.",
      });
    }

    const buf = fs.readFileSync(defaultFile);
    const result = parseGvasPayload(buf, "ManualSave0.sav");

    res.json({
      success: true,
      message: "ManualSave0.sav dari workspace berhasil dimuat.",
      ...result,
    });
  } catch (err) {
    console.error("Workspace load error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/items - Autocomplete search items from in-memory database
app.get("/api/items", (req, res) => {
  try {
    const q = (req.query.q || "").toLowerCase().trim();
    const limit = Math.min(Number(req.query.limit) || 30, 100);

    if (!q) {
      return res.json({
        success: true,
        items: allItemsList.slice(0, limit),
      });
    }

    const matches = [];
    for (const item of allItemsList) {
      if (
        item.name.toLowerCase().includes(q) ||
        item.baseId.toLowerCase().includes(q)
      ) {
        matches.push(item);
        if (matches.length >= limit) break;
      }
    }

    res.json({ success: true, items: matches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/save - Update in-memory GVAS and validate 100%
app.post("/api/save", (req, res) => {
  try {
    if (!loadedGvas) {
      return res
        .status(400)
        .json({ success: false, error: "Belum ada file save yang dimuat." });
    }

    const { player, inventory } = req.body;

    // Update player information
    if (player) {
      CoralPlayerEditor.editPlayer(loadedGvas, {
        name: player.name,
        title: player.title,
        gender: player.gender,
        farmName: player.farmName,
      });

      const pData = CoralPlayerEditor.findPlayerSaveData(loadedGvas);
      if (pData?.Properties) {
        if (player.gold !== undefined) {
          const gProp = pData.Properties.find(
            (p) =>
              (p.Name || "").replace(/\0/g, "").trim() === "playerCurrentGold",
          );
          if (gProp) gProp.Value = Number(player.gold);
        }
        if (player.meritPoints !== undefined) {
          const mProp = pData.Properties.find(
            (p) =>
              (p.Name || "").replace(/\0/g, "").trim() ===
              "playerCurrentMeritPoint",
          );
          if (mProp) mProp.Value = Number(player.meritPoints);
        }
      }
    }

    // Update inventory slots
    if (Array.isArray(inventory)) {
      const pData = CoralPlayerEditor.findPlayerSaveData(loadedGvas);
      const invProp = pData?.Properties?.find(
        (p) =>
          (p.Name || "").replace(/\0/g, "").trim().toLowerCase() ===
          "inventory",
      );

      if (invProp && Array.isArray(invProp.Elements)) {
        for (const slot of inventory) {
          if (slot.empty || !slot.id) {
            const existingIdx = invProp.Elements.findIndex((el) => {
              const sProp = el.Properties?.find(
                (p) =>
                  (p.Name || "").replace(/\0/g, "").trim() ===
                  "desiredSlotIndex",
              );
              const val = sProp
                ? Array.isArray(sProp.Value)
                  ? sProp.Value[1]
                  : sProp.Value
                : -1;
              return Number(val) === Number(slot.slotIndex);
            });
            if (existingIdx !== -1) {
              invProp.Elements.splice(existingIdx, 1);
            }
          } else {
            CoralPlayerEditor.setInventorySlot(
              loadedGvas,
              slot.slotIndex,
              slot.id,
              Number(slot.quantity || 1),
            );
          }
        }
      }
    }

    // Serialize to binary buffer and validate integrity
    const outBuf = loadedGvas.serializeToBuffer();
    SaveValidator.validate(outBuf, loadedGvas);
    currentOutBuf = outBuf;

    res.json({
      success: true,
      message: "Save game berhasil diperbarui dan tervalidasi 100%!",
      filename: currentFilename,
      size: outBuf.length,
    });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/download - Download the validated binary .sav file
app.get("/api/download", (req, res) => {
  try {
    if (!currentOutBuf) {
      if (loadedGvas) {
        currentOutBuf = loadedGvas.serializeToBuffer();
        SaveValidator.validate(currentOutBuf, loadedGvas);
      } else {
        return res
          .status(400)
          .send("Belum ada data save game yang dimuat atau disimpan.");
      }
    }

    const safeName = currentFilename || "ManualSave0.sav";
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", currentOutBuf.length);
    res.send(currentOutBuf);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).send(`Error saat mengunduh file: ${err.message}`);
  }
});

// GET /api/save-path - Helper to get the Coral Island save path for user clipboard
app.get("/api/save-path", (req, res) => {
  const gamePath = path.join(
    os.homedir(),
    "AppData",
    "Local",
    "ProjectCoral",
    "Saved",
    "SaveGames",
    "World_1",
  );
  res.json({
    success: true,
    path: gamePath,
    exists: fs.existsSync(gamePath),
  });
});

app.listen(PORT, () => {
  console.log(
    `================================================================`,
  );
  console.log(` SaveToolCoral GUI Server running at http://localhost:${PORT}`);
  console.log(
    `================================================================`,
  );
});
