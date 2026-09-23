# Design Direction: SaveToolCoral GUI

Dokumen ini mendefinisikan sistem desain, palet warna, tipografi, dan hierarki visual antarmuka web lokal SaveToolCoral sesuai prinsip `antislop` dan `antislop-ui`.

---

## 1. Identitas & Karakter Produk

- **Nama Produk**: SaveToolCoral
- **Jenis Produk**: Desktop Game Companion & Save Editor untuk Coral Island (Unreal Engine 4.27).
- **Kepribadian**: Jernih (_crisp_), tenang (_coastal lagoon_), fungsional, dan terpercaya layaknya utilitas desktop native. Menghindari kesan dasbor teknologi/hacker gelap generik buatan AI.
- **Mood**: Suasana pulau tropis, air laut jernih, dan pesisir pantai yang rapi dan segar.

---

## 2. Palet Warna (Coolors Palette)

Palet warna resmi yang disetujui:

| Token                     | Hex Code  | Nama Karakter   | Peran Fungsional dalam UI                                                 |
| :------------------------ | :-------- | :-------------- | :------------------------------------------------------------------------ |
| `color-surface-base`      | `#eff5f5` | Sea Mist White  | Latar belakang utama aplikasi, body background, kartu kontainer luar.     |
| `color-surface-card`      | `#ffffff` | Pure Foam       | Latar belakang slot terisi, kartu modal, input field untuk kontras tajam. |
| `color-brand-primary`     | `#116379` | Deep Ocean Teal | Teks utama, heading, border struktural, penanda bingkai, kontras tinggi.  |
| `color-accent-sky`        | `#77c6e1` | Lagoon Sky      | Border halus slot kosong, pembatas sekunder, tag kategori.                |
| `color-interactive-azure` | `#0aa0eb` | Tropical Azure  | Tombol aksi utama (CTA Simpan), highlight aktif tab, border fokus.        |
| `color-accent-seafoam`    | `#3fd0e7` | Seafoam Cyan    | Aksen hover, seleksi slot aktif, highlight bintang kualitas osmium.       |

### Tingkat Kualitas Bintang Item (Game-Specific Badges)

- **Normal**: Teks netral `#116379` tanpa badge bintang.
- **Bronze (Perunggu)**: `#9c5123` lembut dengan latar `#faeae1`.
- **Silver (Perak)**: `#5a6e7c` dengan latar `#e8edf0`.
- **Gold (Emas)**: `#b8860b` dengan latar `#fcf5dc`.
- **Osmium (Ungu/Cyan Iridiscent)**: `#6b21a8` atau paduan dengan `#3fd0e7`.

---

## 3. Tipografi

- **Font Keluarga**: `Plus Jakarta Sans` (Google Fonts), sans-serif geometris modern dengan keterbacaan tinggi.
- **Monospace**: `JetBrains Mono` atau font monospace sistem untuk ID item internal (`item_XXXXX`) dan kuantitas numerik.
- **Hierarki & Berat**:
  - H1 App Title: 20px, Bold (700), warna `#116379`.
  - Subtitle / Meta: 12px, Regular (400), warna `#4d7a86`.
  - Row Headings: 13px, SemiBold (600), warna `#116379`.
  - Item Names: 12px, Bold (700), warna `#116379`.
  - Item ID / Slot Index: 10px, Monospace (500), warna `#5f8a96`.

---

## 4. Dials (Tingkat Dinamika Visual)

- **ENERGY (Tingkat Energi)**: **2**  
  Tampilan bersih, tenang, dengan satu aksen interaktif dominan (`#0aa0eb`) pada momen tindakan utama.
- **RHYTHM (Irama Tata Letak)**: **2**  
  Pembeda visual yang tegas antara Hotbar (Slot 1–10) dengan Baris Tas Dalam (Slot 11–40), serta pemisahan tab yang jelas antara Tas dan Profil Pemain.
- **MOTION (Gerakan / Animasi)**: **1**  
  Transisi halus hanya pada interaksi pengguna (hover tombol, fokus input, klik slot). Tidak ada animasi berulang (_no endless loops_, tidak ada denyut/pulse abadi).

---

## 5. Aturan Anti-Slop (Delivery Gate Constraints)

1. **Bebas Em Dash (`—`)**: Tidak menggunakan tanda pisah em dash pada judul atau label teks antarmuka (R-02).
2. **Bebas Dekorasi Emoji**: Seluruh emoji pada judul baris, tab navigasi, tombol aksi, dan tips bantuan dihilangkan (R-04). Teks berdiri sendiri dengan jelas dan profesional.
3. **Kontrol Radius Konsisten**: Menggunakan skala terukur: `rounded-md` (6px) untuk badge/tombol kecil, `rounded-lg` (8px) untuk slot tas dan input, `rounded-xl` (12px) hanya untuk kontainer besar/modal (R-11).
4. **Matte & Solid Surfaces**: Tidak menggunakan efek blur kaca menyeluruh (_excessive glassmorphism_) atau efek bayangan mengambang berlebihan (R-10, R-12, R-13).
5. **Aksesibilitas Kontras**: Memenuhi standar WCAG AAA untuk teks utama (rasio 7.4:1 antara `#116379` dan `#eff5f5`) (R-25).
