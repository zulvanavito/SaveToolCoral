# Coral Island Save Tool Knowledge Base & Agent Guidelines

Dokumen ini berisi rangkuman teknis, struktur data, dan panduan langkah-demi-langkah (SOP) untuk membaca, mengedit, dan me-rebuild save game **Coral Island** (Unreal Engine 4.27) menggunakan repository `UESaveTool`.

> **Penting bagi AI Agent**: Dokumen ini memuat seluruh konteks penting sehingga tidak perlu membaca riwayat chat masa lalu untuk memodifikasi save game.

---

## 1. Lokasi File Save Game

- **Workspace Proyek**: `d:\01 Projects\savetool\ManualSave0.sav`
- **Folder Game Aktif (AppData)**:
  `C:\Users\shawn\AppData\Local\ProjectCoral\Saved\SaveGames\World_1\ManualSave0.sav`
  _(Setiap kali melakukan modifikasi, buat backup terlebih dahulu dan sinkronkan ke folder AppData jika diminta)_.

---

## 2. Arsitektur Save Game Coral Island (UE 4.27)

1. **Outer Container (GVAS Pembungkus)**:
   - `SaveGameType`: `/Script/ProjectCoral.C_CompressedSaveGame`
   - Properti `compressedSaveData` bertipe `ArrayProperty` berisi `ByteProperty`.
2. **Chunked Package Compression**:
   - Header chunk 48-byte dengan magic `0x9E2A83C1` (`PACKAGE_FILE_TAG`).
   - Ukuran uncompressed chunk: 128 KB (131.072 byte) menggunakan zlib deflate/inflate via `CoralCompressor.js`.
3. **Inner Payload (GVAS Asli)**:
   - Header GVAS standar (`0x53415647`), `SaveGameVersion`: 2, `PackageVersion`: 522.
   - Root struct: `saveData` (`C_SaveData`).
   - Data Pemain: `players[0]` (`C_PlayerSaveData`).
     - Karakter & Nama: `pendingChangedPlayerInfo` (`C_ChangedPlayerInfo`) dan `playerInfo` (`C_PlayerInformation`).
     - Inventory Tas: Array `inventory` berisi elemen struct `C_InventorySlotData`.

---

## 3. Sistem Kualitas Item (Item Quality)

Di Coral Island, kualitas item (seperti hasil laut, panen, bunga, serangga, ikan) ditentukan oleh **akhiran (suffix) pada row ID DataTable `DT_InventoryItems`**:

- **Base / Regular (Tanpa Bintang)**: `item_XXXXX` (contoh: `item_50320` untuk Arame)
- **Bronze (Bintang Perunggu)**: `item_XXXXX-a`
- **Silver (Bintang Perak)**: `item_XXXXX-b`
- **Gold (Bintang Emas)**: `item_XXXXX-c`
- **Osmium (Bintang Ungu)**: `item_XXXXX-d` (contoh: `item_50320-d` untuk Osmium Arame)

Database master item lokal tersedia di proyek:

- `DT_InventoryItems.json`: Seluruh data baris item internal game.
- `coral_island_en.json`: Kamus terjemahan nama item ke bahasa Inggris.

---

## 4. Struktur Slot Inventory Tas

- Kapasitas tas standar adalah 40 slot (`desiredSlotIndex`: `0` s/d `39`).
  - **Baris 1 (Hotbar)**: Index `0` s/d `9`
  - **Baris 2 (Tas Dalam)**: Index `10` s/d `19`
  - **Baris 3**: Index `20` s/d `29`
  - **Baris 4**: Index `30` s/d `39`
- Format struct tiap slot `C_InventorySlotData`:
  - `desiredSlotIndex` (IntProperty)
  - `ID` (NameProperty, string berakhiran `\0`)
  - `quantity` (IntProperty)
  - `charges` (IntProperty, default `-1`)
  - `maxCharges` (IntProperty, default `-1`)
  - `objectData` (ArrayProperty ByteProperty, kosong jika item biasa, atau berisi property Map enchantments untuk tools)

---

## 5. Perintah CLI Utama (`UESaveTool-CoralIsland.js`)

Semua operasi save game dapat dilakukan langsung via CLI:

### A. Melihat Status Karakter & Save

```powershell
node ./UESaveTool-CoralIsland.js info ManualSave0.sav
```

### B. Melihat Isi Tas & Daftar Slot

```powershell
node ./UESaveTool-CoralIsland.js inventory ManualSave0.sav
```

### C. Menambah / Mengubah Slot Item Langsung ke File `.sav`

```powershell
# Format: node ./UESaveTool-CoralIsland.js set-item <file.sav> --slot <0-39> --id <itemId> --qty <jumlah>
node ./UESaveTool-CoralIsland.js set-item ManualSave0.sav --slot 4 --id item_65535 --qty 50
```

### D. Mengubah Profil Karakter (Nama, Panggilan, Gender, Kebun)

```powershell
node ./UESaveTool-CoralIsland.js convert ManualSave0.sav ManualSave0.json
node ./UESaveTool-CoralIsland.js edit-player ManualSave0.json --name Ito --title Tuan --farm "Mey Farm"
node ./UESaveTool-CoralIsland.js rebuild ManualSave0.json ManualSave0.sav
```

---

## 6. Prosedur Wajib (SOP) Sebelum & Sesudah Modifikasi

1. **Backup**: Selalu buat backup file target sebelum menulis perubahan.
2. **Pertahankan Peralatan**: Jangan menimpa slot peralatan kerja (Pickaxe, Hoe, Fishing Pole, dll.) kecuali secara eksplisit diminta user.
3. **Validasi Mandiri**: Rebuild file `.sav` wajib melewati `SaveValidator.validate(outBuf, gvas)` yang menguji 4 hal:
   - Validitas Magic GVAS.
   - Konsistensi jumlah properti.
   - Integritas blok chunk kompresi zlib (`0x9E2A83C1`).
   - Round-trip de-serialisasi buffer biner.
4. **Sinkronisasi**: Setelah `ManualSave0.sav` di proyek selesai diuji, salin file tersebut ke folder AppData game agar pemain bisa langsung memuatnya di dalam game tanpa copy-paste manual.

---

## 7. Web GUI Editor Lokal (`gui/server.js`)

Save game editor berbasis web lokal dapat dijalankan dengan:

```powershell
npm run gui
# atau double click gui.cmd
```

- **Akses**: `http://localhost:3000`
- **Fitur**: Sistem aman Upload Drag & Drop & File Picker (tanpa memindai AppData otomatis), visual 40-slot bag, pencarian 5.100+ item in-memory, pemilih kualitas bintang otomatis, form edit pemain & ekonomi, validasi integritas biner, serta tombol unduh langsung file `.sav` tervalidasi.

---

<!-- antislop:start -->

## 8. Standar Desain & Filter Antislop

Untuk setiap pekerjaan UI, copy teks, aksesibilitas, tata letak mobile, atau komentar kode:

1. Baca [`DESIGN.md`](file:///d:/01%20Projects/savetool/DESIGN.md) untuk acuan identitas, palet warna, tipografi, dan parameter dials.
2. Terapkan filter inti **antislop** serta skill spesifik yang relevan:
   - **UI / Visual**: `antislop-ui` (palet Coolors `#eff5f5`, `#116379`, `#77c6e1`, `#0aa0eb`, `#3fd0e7`, permukaan _matte_, tanpa glow/gradien ungu klise, tanpa emoji dekoratif).
   - **Teks & Copy**: `antislop-copywriting` (tanpa em dash `—`, kalimat aktif, to-the-point, tone profesional).
   - **Aksesibilitas & Pengguna**: `antislop-human` (kontras WCAG AAA 7.4:1, navigasi keyboard, status visual jelas).
   - **Tata Letak Responsif**: `antislop-layoutmobile` (grid reflow 2/5/10 kolom, tap target nyaman).
   - **Komentar Kode**: `antislop-code` (higiene komentar kode, tanpa komentar AI slop generik).
3. **Mode Penggunaan**: Mode 1 (**DURING** / Saat Pengerjaan), mencegah kemunculan slop sejak tahap perancangan hingga pengujian Delivery Gate.
<!-- antislop:end -->
