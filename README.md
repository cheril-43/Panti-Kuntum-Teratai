# Panti Asuhan Kuntum Teratai — Sistem Manajemen Dokumentasi & Website Resmi

Website resmi dan sistem manajemen dokumentasi mandiri untuk Yayasan Panti Asuhan Kuntum Teratai, Bukit Duri, Tebet, Jakarta Selatan.

Didesain agar **pengurus yayasan dapat mengelola dokumentasi kegiatan secara mandiri langsung dari HP atau laptop** tanpa harus meminta bantuan programmer untuk mengedit kode HTML/CSS/JS setiap minggunya.

---

## 1. Arsitektur & Teknologi

- **Frontend**: HTML5 Semantik, Vanilla CSS3 (CSS Variables, Flexbox, CSS Grid), Vanilla JavaScript (ES6+), Font Awesome 6.4.0, Google Fonts (*Playfair Display* & *Poppins*).
- **Backend-as-a-Service (BaaS)**: [Supabase](https://supabase.com/) (PostgreSQL Database, Supabase Auth, Supabase Storage).
- **Keamanan Akses**: PostgreSQL **Row Level Security (RLS)** & Storage Access Policies.
- **Optimasi Gambar**: Client-Side HTML5 Canvas Compression (`js/image-compressor.js`) — otomatis mengompres foto berukuran besar dari HP sebelum diunggah ke storage.
- **Biaya Operasional**: **Rp 0 / Gratis** (Memanfaatkan Paket Free Tier Supabase dan Free Static Hosting).

---

## 2. Struktur Direktori Proyek

```
web Panti Kuntum Teratai/
├── index.html                   # Halaman utama publik
├── galeri.html                  # Halaman galeri & album kolase publik (Dinamis + Fallback)
├── pengurus.html                # Halaman struktur kepengurusan & data anak binaan
├── robots.txt                   # Pengaturan rayapan mesin pencari (SEO)
├── sitemap.xml                  # Peta situs Google Search Console
├── .env.example                 # Contoh variabel lingkungan konfigurasi
├── README.md                    # Panduan instalasi, deployment, dan serah terima
├── admin/
│   ├── login.html               # Halaman masuk aman admin/pengurus
│   └── index.html               # Dashboard pengelola dokumentasi (Mobile & Desktop)
├── js/
│   ├── supabase-config.js       # Inisialisasi Supabase client & fungsi data
│   └── image-compressor.js      # Utilitas kompresi foto sisi browser
├── supabase/
│   └── schema.sql               # Skrip SQL tabel, RLS, Storage policy, dan trigger
└── [file aset gambar...]       # Logo, QRIS resmi, dan banner
```

---

## 3. Panduan Setup Backend (Supabase) — 5 Menit Selesai

### Langkah 1: Buat Proyek Supabase
1. Buka [https://supabase.com](https://supabase.com) dan buat akun (disarankan menggunakan email resmi yayasan).
2. Klik **"New Project"**, beri nama misalnya `kuntum-teratai-web`, dan buat password database yang kuat.
3. Pilih region terdekat, misalnya **Singapore (Southeast Asia)**.

### Langkah 2: Jalankan Skrip Database & Keamanan
1. Di dashboard Supabase, buka menu **SQL Editor** di panel kiri.
2. Klik **"New Query"**.
3. Buka file `supabase/schema.sql` di proyek ini, salin seluruh kodenya, lalu tempelkan ke SQL Editor Supabase.
4. Klik tombol **"Run"** (Jalankan). Semua tabel (`albums`, `album_photos`, `user_roles`), fungsi keamanan RLS, dan Storage Bucket `documentation` akan otomatis terbentuk secara sempurna.

### Langkah 3: Daftarkan Akun Owner Pertama
1. Buka menu **Authentication -> Users** di dashboard Supabase.
2. Klik **"Add user" -> "Create user"**.
3. Masukkan email pengurus utama (misal: `pantikuntumteratai@gmail.com`) dan buat kata sandi yang aman. Centang **"Auto Confirm User"** lalu klik Create.
4. Salin **User UID** dari akun yang baru dibuat tersebut.
5. Kembali ke **SQL Editor**, jalankan perintah berikut (ganti `<USER_UID>` dengan ID yang Anda salin):
   ```sql
   INSERT INTO public.user_roles (user_id, email, role)
   VALUES ('<USER_UID_ANDA>', 'pantikuntumteratai@gmail.com', 'owner');
   ```

### Langkah 4: Hubungkan Frontend ke Supabase
1. Buka menu **Project Settings -> API** di dashboard Supabase.
2. Salin **Project URL** dan **anon (public) key**.
3. Ada 2 cara mudah menghubungkannya:
   - **Cara A**: Buka file `js/supabase-config.js`, masukkan URL dan anon key pada konstanta `DEFAULT_SUPABASE_URL` dan `DEFAULT_SUPABASE_ANON_KEY`.
   - **Cara B (Tanpa Edit Kode)**: Buka halaman `admin/login.html` di browser, klik tautan *"Pengaturan Koneksi Supabase"* di bawah form, lalu tempelkan URL dan Anon Key Anda.

---

## 4. Panduan Penggunaan untuk Pengurus Organisasi

### A. Masuk ke Dashboard
Buka `https://domain-anda.or.id/admin/login.html` (atau klik tautan *"Portal Pengurus"* di footer website). Masukkan email dan kata sandi Anda.

### B. Membuat Album Kegiatan Baru
1. Klik tombol pink **"+ Tambah Album Kegiatan"**.
2. Masukkan Judul Kegiatan, Tanggal, Kategori, dan Deskripsi singkat.
3. Pilih status **Published** agar langsung tayang ke publik, atau **Draft** jika masih ingin diperiksa secara internal.
4. Klik **"Simpan Album"**.

### C. Mengunggah Banyak Foto Sekaligus
1. Klik tombol **"Kelola Foto"** pada kartu album.
2. Klik area unggah dropzone, lalu pilih beberapa foto sekaligus dari galeri HP atau file manager laptop.
3. Sistem secara otomatis mengompres foto berukuran besar (menjadi ~200-400 KB berkualitas tinggi) dan mengunggahnya dengan bilah progres.

### D. Menghapus Foto atau Album
- **Menghapus Foto**: Buka "Kelola Foto", klik ikon tong sampah merah pada foto tertentu. File akan terhapus dari database sekaligus dihapus dari Storage (tidak meninggalkan file sampah).
- **Menghapus Album**: Klik ikon tong sampah pada kartu album. Sistem akan meminta konfirmasi ganda sebelum menghapus album dan seluruh foto di dalamnya.

### E. Menambah / Mencabut Hak Akses Admin (Khusus Owner)
1. Buka tab **"Kelola Admin"** di toolbar dashboard.
2. Daftarkan email pengurus yang dipercayai.
3. Pengelola Utama (Owner) dapat mencabut hak admin kapan pun jika terjadi pergantian pengurus yayasan.

---

## 5. Panduan Deployment & Hosting Gratis Selamanya

Karena proyek ini adalah frontend statis dengan backend Supabase, Anda dapat meng-hostingnya secara **100% gratis** tanpa biaya server:

### Opsi A: Cloudflare Pages / Vercel / Netlify (Sangat Direkomendasikan)
1. Buat repositori GitHub (Private atau Public).
2. Hubungkan ke Vercel atau Cloudflare Pages.
3. Website akan otomatis memiliki HTTPS / SSL resmi gratis dan terhubung ke domain kustom yayasan (misal: `pantikuntumteratai.or.id`).

### Opsi B: cPanel / Shared Hosting Konvensional
Cukup unggah seluruh isi folder ini ke dalam folder `public_html` di cPanel hosting yayasan Anda melalui File Manager atau FTP.

---

## 6. Analisis Biaya & Batasan Paket Gratis

| Layanan | Paket | Kapasitas Gratis | Perkiraan Biaya Saat Bertambah |
| :--- | :---: | :--- | :--- |
| **Supabase Database** | Free | 500 MB data teks (cukup untuk ribuan album) | Gratis selamanya untuk penggunaan standar |
| **Supabase Storage** | Free | 1 GB file gambar (~3.000–5.000 foto berkat kompresi otomatis) | $25/bulan jika melebihi 100 GB |
| **Supabase Auth** | Free | 50.000 pengguna aktif per bulan | Gratis |
| **Hosting Frontend** | Free | Bandwidth 100 GB/bulan (Vercel/Cloudflare Pages) | Gratis |
| **Domain .or.id / .org** | Berbayar | Domain resmi yayasan sosial | ~Rp 50.000 – Rp 150.000 / tahun |

---

## 7. Prosedur Serah Terima (Handover Checklist)

1. **Akun Organisasi**: Pastikan akun Supabase dan akun registrasi domain dibuat menggunakan email resmi yayasan (bukan email pribadi developer).
2. **Pemindahan Kepemilikan (Transfer Project)**: Di Supabase, developer dapat mengundang email pengurus ke organisasi Supabase, lalu menetapkan pengurus sebagai *Owner* dan developer keluar dari tim.
3. **Penyimpanan Kredensial**: Catat Project URL dan Anon Key di buku panduan inventaris digital yayasan.
4. **Cadangan Data (Backup)**: Supabase menyediakan fitur ekspor SQL dan backup harian yang dapat diunduh kapan saja melalui menu *Database -> Backups*.

---

*Dibuat dengan sepenuh hati untuk mendukung keberlanjutan dan kemandirian Yayasan Panti Asuhan Kuntum Teratai.*
