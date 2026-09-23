# Coral Island Save Editing Support (UESaveTool)

Panduan lengkap untuk membaca, mengedit, dan me-rebuild file save **Coral Island** (Unreal Engine 4.27) menggunakan **UESaveTool** tanpa menyebabkan crash atau data corrupt.

---

## 1. Ikhtisar Arsitektur

Save game Coral Island (seperti `ManualSave0.sav`) menggunakan format **Two-Tier GVAS** khas Unreal Engine 4.27:

1. **Outer Container (GVAS Pembungkus)**:
   - SaveGameType: `/Script/ProjectCoral.C_CompressedSaveGame`
   - Property `compressedSaveData` bertipe `ArrayProperty` dari `ByteProperty`.
2. **Chunked Package Compression**:
   - Header chunk 48-byte dengan magic `0x9E2A83C1` (`PACKAGE_FILE_TAG`).
   - Ukuran blok per 128 KB (131.072 byte) menggunakan kompresi `zlib/deflate`.
3. **Inner Payload (GVAS Asli)**:
   - Berisi data savegame utama berukuran ~41 MB (SaveGameType `/Script/ProjectCoral.C_SaveGame`).
   - Root struct `saveData` (`C_SaveData`) yang berisi 77 property utama.
   - Karakter pemain berada di dalam `players[0]` (`C_PlayerSaveData`) yang memuat:
     - `pendingChangedPlayerInfo` (`C_ChangedPlayerInfo`)
     - `playerInfo` (`C_PlayerInformation`)

UESaveTool telah dilengkapi dengan:

- Dukungan penuh untuk property Unreal: `ByteProperty`, `BoolProperty`, `IntProperty`, `Int64Property`, `FloatProperty`, `NameProperty`, `StrProperty`, `TextProperty`, `EnumProperty`, `StructProperty`, `ArrayProperty`, `MapProperty`, `SetProperty`, `ObjectProperty`, `SoftObjectProperty`.
- **UnknownProperty fallback** tanpa crash jika menemukan property yang belum dikenal.
- **Validation System** sebelum file save ditulis ke disk.

---

## 2. Cara Install & Persiapan

### Prasyarat

- **Node.js**: Versi 16 atau lebih baru (disarankan Node.js 18/20/22/24).
- Terminal PowerShell / Command Prompt di Windows atau Bash di Linux/macOS.

### Instalasi

Clone atau buka direktori repository `UESaveTool`:

```powershell
cd "d:\01 Projects\UESaveTool"
npm install
```

---

## 3. Cara Convert Save Game (.sav ke .json)

Perintah ini akan mendekompresi chunk zlib, mengekstrak GVAS internal, dan mengubahnya menjadi format JSON yang mudah dibaca dan diedit:

Menggunakan `uesavetool`:

```powershell
node ./uesavetool.js convert ManualSave0.sav ManualSave0.json
```

Atau menggunakan executable wrapper Coral Island:

```powershell
node ./UESaveTool-CoralIsland.js convert ManualSave0.sav ManualSave0.json
# atau di Windows CMD / PowerShell:
.\UESaveTool-CoralIsland convert ManualSave0.sav ManualSave0.json
```

**Output**: File `ManualSave0.json` siap untuk diinspeksi atau diedit.

---

## 4. Cara Edit Karakter

Anda dapat mengubah nama karakter, panggilan/gelar (`CustomGenderText`), dan nama kebun secara aman pada tingkat properti (property-level modification):

### Contoh: Ubah Nama menjadi "Ito" dan Panggilan menjadi "Tuan"

```powershell
node ./uesavetool.js edit-player ManualSave0.json --name Ito --title Tuan
```

Opsi yang tersedia:

- `--name <string>`: Mengubah nama pemain (`PlayerName`, `SanitizedPlayerName`, `Name`, `SanitizedName`).
- `--title <string>`: Mengubah panggilan/gelar gender (`CustomGenderText`, `sanitizedCustomGenderText`, `parentLabel`, `sanitizedParentLabel`).
- `--farm <string>`: Mengubah nama kebun (`farmName`, `sanitizedFarmName`).
- `--out <file>`: (Opsional) Tentukan file JSON output jika tidak ingin menimpa file input.

### Memeriksa Informasi Karakter

Untuk melihat nama dan status karakter saat ini dari file `.sav` atau `.json`:

```powershell
node ./UESaveTool-CoralIsland.js info ManualSave0.sav
node ./UESaveTool-CoralIsland.js info ManualSave0.json
```

---

## 5. Cara Rebuild Save Game (.json ke .sav)

Setelah file JSON diedit, rebuild kembali menjadi file `.sav` biner yang valid:

```powershell
node ./uesavetool.js rebuild ManualSave0.json ManualSave0_Ito_Tuan.sav
```

atau:

```powershell
node ./UESaveTool-CoralIsland.js rebuild ManualSave0.json ManualSave0_Ito_Tuan.sav
```

Saat proses rebuild berjalan, sistem secara otomatis:

1. Menghitung ulang ukuran byte setiap property dan struct secara dinamis.
2. Memvalidasi struktur header GVAS.
3. Membagi payload uncompressed ke dalam chunk 128 KB dan mengompresnya dengan zlib.
4. Menuliskan chunk header 48-byte dengan magic `0x9E2A83C1`.
5. Membungkusnya ke dalam outer container GVAS `compressedSaveData`.
6. Menjalankan **Save Validation System** mandiri sebelum file disimpan ke disk.

---

## 6. Cara Cek & Edit Inventory / Item Tas

Kapasitas tas di Coral Island memiliki 40 slot (`0` s/d `39`). Tas dibagi menjadi 4 baris:

- **Baris 1 (Hotbar)**: Slot 1 s/d 10 (Index `0` - `9`)
- **Baris 2 (Tas Dalam)**: Slot 1 s/d 10 (Index `10` - `19`)
- **Baris 3**: Slot 1 s/d 10 (Index `20` - `29`)
- **Baris 4**: Slot 1 s/d 10 (Index `30` - `39`)

### A. Melihat Daftar Item Tas

Untuk melihat penataan slot dan jumlah item saat ini:

```powershell
node ./UESaveTool-CoralIsland.js inventory ManualSave0.sav
```

### B. Menambah atau Mengubah Item Tas Secara Instan

Anda dapat menyuntikkan atau menimpa slot tertentu langsung ke file `.sav` tanpa perlu konversi manual:

```powershell
# Format: node ./UESaveTool-CoralIsland.js set-item <file.sav> --slot <0-39> --id <itemId> --qty <jumlah>

# Contoh 1: Menambahkan 50 Auto Chest di Baris 1 Slot 4 (Index 3)
node ./UESaveTool-CoralIsland.js set-item ManualSave0.sav --slot 3 --id item_65535 --qty 50

# Contoh 2: Menambahkan 999 Osmium Arame di Baris 1 Slot 10 (Index 9)
node ./UESaveTool-CoralIsland.js set-item ManualSave0.sav --slot 9 --id item_50320-d --qty 999
```

---

## 7. Sistem Kualitas Item (Item Quality)

Pada game Coral Island, kualitas item (seperti hasil panen, laut, bunga, serangga) dikodekan menggunakan **akhiran (suffix) pada row ID DataTable `DT_InventoryItems`**:

- **Base / Normal**: `item_XXXXX` (contoh: `item_50320` untuk Arame biasa)
- **Bronze (Bintang Perunggu)**: `item_XXXXX-a`
- **Silver (Bintang Perak)**: `item_XXXXX-b`
- **Gold (Bintang Emas)**: `item_XXXXX-c`
- **Osmium (Bintang Ungu)**: `item_XXXXX-d` (contoh: `item_50320-d` untuk Osmium Arame)

Database lokal untuk mencari ID item tersedia di folder proyek:

- `DT_InventoryItems.json`: Berisi seluruh row definition item internal game.
- `coral_island_en.json`: Kamus nama item dalam bahasa Inggris.

---

## 8. Sistem Validasi (Save Validation System)

Untuk mencegah crash pada game atau save file corrupt, sistem menjalankan 4 tahap validasi ketat:

1. **GVAS Header Validation**:
   - Memastikan magic header persis `GVAS`.
   - Memastikan `SaveGameVersion` (2) dan `PackageVersion` (522) sesuai spesifikasi UE 4.27.
2. **Property Count & Integrity**:
   - Memastikan jumlah total properti root dan properti di dalam struct utama (`saveData`, `players`) konsisten.
   - Memastikan hierarki objek tidak terputus.
3. **Compression Block Integrity**:
   - Memverifikasi setiap chunk memiliki magic `0x9E2A83C1`.
   - Menguji dekompresi zlib pada setiap chunk (test inflate) untuk memastikan tidak ada chunk yang rusak.
4. **Parser Re-read Validation**:
   - Membaca ulang buffer biner yang telah dibuat menggunakan parser GVAS. Jika ada struktur atau offset yang salah sekecil 1 byte, proses rebuild akan dibatalkan seketika dan file tidak akan di-generate.

---

## 9. Troubleshooting Crash Unreal Engine

Jika game Coral Island mengalami crash atau tidak dapat memuat save game, perhatikan hal-hal berikut:

### Penyebab Umum Crash UE4 & Solusinya

1. **Crash: "Assertion failed: Ar.Tell() == EndOffset"**:
   - **Penyebab**: Ukuran property yang dideklarasikan di tag tidak sama dengan jumlah byte data yang sebenarnya ditulis (misalnya akibat manipulasi hex editor manual).
   - **Solusi**: Jangan gunakan hex editor. Selalu gunakan `uesavetool edit-player` dan `rebuild`, karena ukuran payload dihitung secara otomatis oleh serializer.

2. **Crash saat memuat nama karakter**:
   - **Penyebab**: String FName atau FString tidak diakhiri null terminator (`\0`), atau panjang string salah.
   - **Solusi**: UESaveTool secara otomatis memastikan semua string Unreal diakhiri dengan `\0` dan panjang buffer dihitung menggunakan `Buffer.byteLength(str, 'utf8')`.

3. **Crash: "Corrupt compression block"**:
   - **Penyebab**: File dikompresi dengan zlib biasa tanpa header chunk Unreal 48-byte (`0x9E2A83C1`) dan blok 128KB.
   - **Solusi**: Rebuild selalu menggunakan `CoralCompressor` yang secara otomatis menyusun chunk UE4 yang valid.

4. **Karakter Kembali ke Nama Lama**:
   - **Penyebab**: Hanya mengubah `Name` di `playerInfo` tetapi tidak mengubah `pendingChangedPlayerInfo`.
   - **Solusi**: `uesavetool edit-player` otomatis menyinkronkan kedua struct (`C_ChangedPlayerInfo` dan `C_PlayerInformation`).

5. **Tips Aman**:
   - Selalu buat backup file save asli Anda sebelum mengganti file di direktori save game game:
     `%LOCALAPPDATA%\ProjectCoral\Saved\SaveGames\`

---

## 10. Web GUI Editor Lokal (SaveToolCoral GUI)

SaveToolCoral menyediakan antarmuka grafis berbasis web lokal yang sangat mudah digunakan tanpa perlu mengingat perintah CLI:

```powershell
# Menjalankan server GUI
npm run gui
```

Atau cukup klik dua kali file **`gui.cmd`** di Windows Explorer.

Buka browser di **`http://localhost:3000`** untuk:

- Mengunggah file savegame secara aman via **Drag & Drop** atau **Pilih File (File Picker)** tanpa risiko salah menimpa file di AppData.
- Mengedit 40 slot tas secara visual (Hotbar + 3 baris tas).
- Autocomplete pencarian 5.100+ item dari database Coral Island.
- Memilih tingkatan kualitas bintang (Normal, Bronze, Silver, Gold, Osmium).
- Mengedit nama karakter, nama kebun, title, Gold, dan Merit Points.
- Mengunduh langsung file `.sav` biner resmi yang telah lolos uji integritas `SaveValidator`.
- Menyalin jalur direktori savegame game (`%LOCALAPPDATA%\ProjectCoral\...`) sekali klik.
