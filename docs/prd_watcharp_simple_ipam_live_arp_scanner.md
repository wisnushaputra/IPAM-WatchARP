# Product Requirements Document (PRD): WatchARP — Simple IPAM & Live ARP Scanner

| Informasi Dokumen | Detail |
| :--- | :--- |
| **Nama Proyek** | WatchARP (IP Address Management & Active Network Scanner) |
| **Versi Dokumen** | 1.0 (MVP - Minimum Viable Product) |
| **Target Pembaca** | Junior Backend / Fullstack Developer |
| **Tech Stack Utama** | Python (FastAPI + Scapy), SQLite, React + Tailwind CSS |
| **Estimasi Pengerjaan** | 1 - 2 Minggu |

---

## 1. Pendahuluan & Konteks Masalah (Mengapa Kita Membuat Ini?)

Halo! Selamat datang di proyek **WatchARP**. Sebelum kamu mulai menulis kode, penting untuk memahami masalah apa yang sedang kita pecahkan.

Di banyak kantor, kampus, atau ISP skala kecil, administrator jaringan (*Network Engineer*) biasanya mencatat pembagian alamat IP statis menggunakan **Excel atau Google Sheets**. Cara manual ini punya tiga kelemahan fatal:
1. **Lupa Catat:** Teknisi memasang perangkat baru di lapangan menggunakan IP tertentu, tapi lupa memperbarui Excel.
2. **IP Conflict (Bentrok):** Karena di Excel tertulis "Kosong", teknisi lain memakai IP tersebut untuk server baru. Akibatnya, dua perangkat punya IP yang sama dan jaringan menjadi terganggu.
3. **Rogue Device (Perangkat Liar):** Ada orang yang mencolokkan perangkat atau mengatur IP statis sendiri tanpa izin, dan admin tidak tahu.

**Solusi Kita (WatchARP):**
Kita akan membangun aplikasi web pengganti Excel tersebut (**IPAM - IP Address Management**). Bedanya, aplikasi kita punya **"mata"** berupa **ARP Scanner**. Aplikasi ini bisa menyapu jaringan lokal secara langsung untuk mengecek: *"Apakah catatan di database kita sama dengan kondisi asli di kabel jaringan saat ini?"*

---

## 2. Istilah Teknis Penting (Glossary untuk Developer)

Jika kamu belum terlalu familier dengan konsep jaringan, pahami 4 istilah ini sebelum lanjut:
* **CIDR / Subnet (Contoh: `192.168.1.0/24`):** Cara penulisan rentang IP. Angka `/24` berarti ada **254 alamat IP** yang bisa dipakai oleh perangkat (mulai dari `192.168.1.1` sampai `192.168.1.254`).
* **MAC Address (Contoh: `D4:CA:6D:11:22:33`):** Alamat fisik unik yang tertanam di kartu jaringan setiap perangkat (seperti NIK KTP untuk perangkat). Alamat IP bisa diganti-ganti, tapi MAC Address umumnya tetap.
* **ARP (Address Resolution Protocol):** Protokol di jaringan lokal (LAN) yang bekerja seperti orang berteriak di dalam ruangan: *"Hei, siapa yang pakai IP `192.168.1.10`? Tolong sebutkan MAC Address kamu!"*. Kita akan memakai konsep ini untuk mendeteksi perangkat yang aktif.
* **OUI (Organizationally Unique Identifier):** 6 karakter pertama dari MAC Address (misal `D4:CA:6D`) yang menunjukkan merek pembuat perangkat tersebut (misal: MikroTik, Cisco, Apple, atau TP-Link).

---

## 3. User Stories (Apa yang Bisa Dilakukan Pengguna?)

Sebagai developer, bayangkan pengguna aplikasi kita adalah seorang **Network Admin**. Berikut adalah hal-hal yang ingin mereka lakukan di aplikasi kita:

1. **US-01 (Tambah Subnet):** Sebagai Admin, saya ingin memasukkan satu blok jaringan (misal `192.168.10.0/24`), lalu sistem otomatis membuatkan daftar 254 baris IP kosong di database agar saya tidak perlu mengetik satu per satu.
2. **US-02 (Kelola Data IP):** Sebagai Admin, saya ingin mengklik salah satu IP (misal `192.168.10.5`), mengubah statusnya menjadi "Terpakai (`Assigned`)", lalu mencatat nama perangkat (`Server-Billing`) dan MAC Address resminya.
3. **US-03 (Scan Jaringan):** Sebagai Admin, saya ingin menekan tombol **"Scan Subnet Sekarang"** agar aplikasi memindai jaringan lokal dan memberi tahu IP mana saja yang sedang menyala (*Online*) beserta MAC Address dan merek perangkatnya.
4. **US-04 (Deteksi Anomali/Masalah):** Sebagai Admin, saya ingin melihat warna indikator yang jelas (Hijau, Abu-abu, Kuning, Merah) supaya dalam 5 detik saya langsung tahu kalau ada perangkat liar atau salah konfigurasi IP.

---

## 4. Logika Inti Aplikasi: Matriks Rekonsiliasi Status

**Bagian ini sangat penting!** Ini adalah "otak" dari aplikasi kita. Setiap kali proses *ARP Scan* selesai, kode *backend* kamu harus membandingkan **Data di Database** dengan **Hasil Scan ARP**, lalu menentukan `reconciliation_status` berdasarkan aturan berikut:

| Status di Database (`admin_status`) | Apakah Merespon ARP Scan? (`is_online`) | Kecocokan MAC Address | Hasil Akhir (`reconciliation_status`) | Warna UI | Artinya bagi Admin |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `available` (Kosong) | Tidak (`False`) | - | **`FREE`** | Putih / Transparan | Aman, IP benar-benar kosong dan siap dipakai. |
| `assigned` (Terdaftar) | Ya (`True`) | `expected_mac` == `detected_mac` (atau `expected_mac` belum diisi) | **`VALID_ONLINE`** | **Hijau** | Normal. Perangkat resmi sedang menyala. |
| `assigned` (Terdaftar) | Tidak (`False`) | - | **`OFFLINE`** | **Abu-abu Gelap** | Perangkat resmi sedang mati / kabel tercabut. |
| `available` (Kosong) | Ya (`True`) | - | **`ROGUE_DEVICE`** | **Kuning / Oranye** | **Peringatan!** Di catatan kosong, tapi di jaringan ada yang pakai. |
| `assigned` (Terdaftar) | Ya (`True`) | `expected_mac` != `detected_mac` | **`MAC_MISMATCH`** | **Merah Berkedip** | **Bahaya!** IP ini dipakai oleh perangkat yang berbeda dari catatan resmi. |
| `reserved` (Cadangan) | Ya / Tidak | - | **`RESERVED`** | **Biru / Ungu** | IP dikunci khusus (misal untuk Gateway atau batas DHCP). |

> **Tips untuk Junior Dev:** Pastikan perbandingan MAC Address bersifat *case-insensitive* (ubah semua ke huruf besar, misal `.upper()`) dan format pemisahnya seragam (gunakan titik dua `AA:BB:CC:DD:EE:FF`) agar tidak salah deteksi karena perbedaan huruf besar/kecil.

---

## 5. Rancangan Database (Entity Relationship Diagram)

Kita menggunakan **SQLite** untuk tahap awal agar kamu tidak perlu repot menginstal server database terpisah. Cukup buat 3 tabel berikut menggunakan SQLAlchemy (ORM):

### A. Tabel `subnets`
Menyimpan daftar blok jaringan yang dikelola.
* `id` (Integer, Primary Key, Auto Increment)
* `name` (String, Wajib) — Contoh: `"LAN Lantai 2"`
* `cidr` (String, Wajib, Unique) — Contoh: `"192.168.10.0/24"`
* `gateway` (String, Opsional) — Contoh: `"192.168.10.1"`
* `vlan_id` (Integer, Opsional) — Contoh: `10`
* `last_scanned_at` (DateTime, Nullable) — Kapan terakhir kali subnet ini di-scan.
* `created_at` (DateTime, Default: `now()`)

### B. Tabel `ip_addresses`
Menyimpan detail setiap IP di dalam sebuah subnet.
* `id` (Integer, Primary Key, Auto Increment)
* `subnet_id` (Integer, Foreign Key ke `subnets.id` dengan `ON DELETE CASCADE`)
* `ip_address` (String, Wajib) — Contoh: `"192.168.10.5"`
* `admin_status` (Enum/String, Default: `"available"`) — Pilihan: `available`, `assigned`, `reserved`
* `hostname` (String, Nullable) — Contoh: `"AP-Lobby-Utama"`
* `description` (Text, Nullable) — Contoh: `"Dipasang oleh Budi tanggal 12 Mei"`
* `expected_mac` (String, Nullable) — MAC Address yang didaftarkan oleh admin.
* `detected_mac` (String, Nullable) — MAC Address terakhir yang ditemukan oleh ARP Scanner.
* `vendor` (String, Nullable) — Nama pabrik perangkat hasil baca dari `detected_mac` (Contoh: `"Ubiquiti Inc"`).
* `is_online` (Boolean, Default: `False`) — Apakah merespon saat scan terakhir?
* `last_seen_at` (DateTime, Nullable) — Waktu terakhir IP ini terdeteksi hidup.
* `reconciliation_status` (String, Default: `"FREE"`) — Hasil logika dari Bagian 4 (`FREE`, `VALID_ONLINE`, `OFFLINE`, `ROGUE_DEVICE`, `MAC_MISMATCH`, `RESERVED`).

### C. Tabel `scan_histories`
Menyimpan riwayat pemindaian untuk keperluan log.
* `id` (Integer, Primary Key, Auto Increment)
* `subnet_id` (Integer, Foreign Key ke `subnets.id`)
* `scanned_at` (DateTime, Default: `now()`)
* `total_online` (Integer) — Jumlah host yang hidup saat scan itu.
* `total_anomalies` (Integer) — Jumlah status `ROGUE_DEVICE` + `MAC_MISMATCH`.
* `duration_ms` (Integer) — Berapa milidetik proses scan berlangsung.

---

## 6. Spesifikasi API (Backend Endpoints)

Gunakan **FastAPI** untuk membuat REST API berikut. FastAPI dipilih karena otomatis membuatkan halaman dokumentasi di `http://localhost:8000/docs` yang bisa langsung kamu pakai untuk ngetes kode.

### 1. `POST /api/subnets`
* **Fungsi:** Membuat subnet baru dan otomatis men-generate seluruh baris IP-nya.
* **Request Body:**
  ```json
  {
    "name": "VLAN Server",
    "cidr": "192.168.88.0/24",
    "gateway": "192.168.88.1",
    "vlan_id": 88
  }
  ```
* **Cara Kerja di Backend:**
  1. Validasi apakah string `cidr` valid menggunakan modul bawaan Python `ipaddress.ip_network(cidr, strict=False)`.
  2. Batasi ukuran subnet maksimal `/22` (1022 host) agar database tidak *hang* jika user tidak sengaja memasukkan `/8` (16 juta IP).
  3. Simpan data ke tabel `subnets`.
  4. Looping semua host di dalam network tersebut (`for ip in network.hosts():`) dan lakukan *bulk insert* ke tabel `ip_addresses`. Jika IP sama dengan `gateway`, otomatis set `admin_status = "reserved"` dan `hostname = "Default Gateway"`.

### 2. `GET /api/subnets`
* **Fungsi:** Mengambil daftar semua subnet beserta ringkasan statistiknya (berapa persen IP yang terpakai, berapa yang *online*, berapa yang anomali).

### 3. `GET /api/subnets/{subnet_id}/ips`
* **Fungsi:** Mengambil seluruh daftar IP (misal 254 IP) di dalam satu subnet untuk ditampilkan di halaman utama. Dukung *query parameter* opsional seperti `?filter_status=ROGUE_DEVICE` untuk mempermudah pencarian.

### 4. `PUT /api/ips/{ip_id}`
* **Fungsi:** Mengubah data pencatatan manual oleh Admin.
* **Request Body:**
  ```json
  {
    "admin_status": "assigned",
    "hostname": "Printer-HRD",
    "expected_mac": "00:1A:2B:3C:4D:5E",
    "description": "Printer Epson di pojok ruang HRD"
  }
  ```
* **Cara Kerja di Backend:** Setelah data disimpan, hitung ulang `reconciliation_status` untuk IP tersebut dan kembalikan data terbarunya ke *frontend*.

### 5. `POST /api/subnets/{subnet_id}/scan`
* **Fungsi:** Memicu proses *Active ARP Scan* ke jaringan lokal.
* **Cara Kerja di Backend:**
  1. Ambil nilai `cidr` dari database berdasarkan `subnet_id`.
  2. Panggil fungsi *ARP Scanner* menggunakan pustaka `scapy` (`srp(Ether(dst="ff:ff:ff:ff:ff:ff")/ARP(pdst=cidr), timeout=2, verbose=0)`).
  3. Dari balasan yang didapat, kumpulkan pasangan `{ip_address: mac_address}`.
  4. Cari nama vendor dari setiap MAC Address menggunakan library `mac-vendor-lookup`.
  5. Update seluruh baris IP pada `subnet_id` tersebut di database:
     * Jika IP ada di daftar balasan ARP: set `is_online = True`, `detected_mac = mac`, `last_seen_at = now()`, dan hitung ulang `reconciliation_status`.
     * Jika IP **tidak** ada di daftar balasan ARP: set `is_online = False`, biarkan `detected_mac` tetap menyimpan nilai terakhir (jangan dihapus agar riwayat tetap terlihat), dan hitung ulang `reconciliation_status`.
  6. Catat ringkasan hasilnya ke tabel `scan_histories`.

### 6. `POST /api/ips/{ip_id}/trust-mac` (Fitur Pintas / Quick Action)
* **Fungsi:** Ketika muncul `ROGUE_DEVICE` (perangkat baru belum dicatat), Admin malas mengetik ulang MAC Address-nya. Tombol ini akan menyalin nilai `detected_mac` langsung ke kolom `expected_mac` dan mengubah status menjadi `assigned`.

---

## 7. Kebutuhan Antarmuka Pengguna (UI/UX Guidelines)

Kamu tidak perlu membuat desain yang rumit. Buat **1 Halaman Utama (Single Page Dashboard)** dengan komponen berikut:

1. **Sidebar / Dropdown Pemilih Subnet:** Di bagian kiri atau atas untuk memilih subnet mana yang sedang dilihat, ditambah tombol `+ Tambah Subnet`.
2. **Top Summary Cards (4 Kotak Statistik):**
   * **Total IP & Utilisasi:** Misal `45 / 254 IP Terdaftar (17.7%)`
   * **Perangkat Online:** Jumlah IP yang merespon scan terakhir.
   * **Rogue Devices (Kuning):** Jumlah IP asing yang terdeteksi hidup.
   * **MAC Conflict (Merah):** Jumlah IP yang MAC Address-nya tidak sesuai catatan.
3. **Visual IP Grid (Komponen Paling Keren di Proyek Ini!):**
   * Tampilkan kotak-kotak kecil berukuran `40x40px` berjajar rapi berisi angka akhiran IP (`.1`, `.2`, `.3`, ..., `.254`).
   * Warnai setiap kotak sesuai warna `reconciliation_status` (Hijau, Abu-abu, Kuning, Merah, Putih).
   * Saat kursor diarahkan (*hover*) ke kotak `.15`, tampilkan *tooltip* kecil berisi: `192.168.10.15 | Host: Server-DB | MAC: AA:BB:CC...`.
   * Saat kotak diklik, buka **Modal / Drawer Edit IP** di sebelah kanan.
4. **Tabel Detail IP (Di bawah IP Grid):**
   * Tabel standar dengan kolom: `IP Address`, `Status Admin`, `Hostname`, `Expected MAC`, `Detected MAC (Vendor)`, `Status Rekonsiliasi`, dan `Last Seen`.
   * Tambahkan tombol **"Approve / Daftarkan"** langsung di baris yang berstatus `ROGUE_DEVICE`.

---

## 8. Struktur Folder Proyek yang Direkomendasikan

Susun kode kamu seperti ini agar rapi dan mudah di-*maintain*:

```text
watcharp-project/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # Entry point FastAPI & CORS setup
│   │   ├── database.py          # Koneksi SQLite & Session SQLAlchemy
│   │   ├── models.py            # Definisi Tabel Database (ORM)
│   │   ├── schemas.py           # Validasi Request/Response (Pydantic)
│   │   ├── routers/
│   │   │   ├── subnets.py       # Endpoint CRUD Subnet & Scan trigger
│   │   │   └── ips.py           # Endpoint Update IP & Trust MAC
│   │   └── services/
│   │       ├── ip_calculator.py # Logika generate IP dari CIDR & Rekonsiliasi
│   │       └── arp_scanner.py   # Logika Scapy ARP Scan & MAC Vendor Lookup
│   ├── requirements.txt
│   └── watcharp.db              # File SQLite (otomatis terbuat)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── StatCards.jsx    # 4 kartu ringkasan di atas
│   │   │   ├── IpGridMap.jsx    # Visualisasi kotak .1 sampai .254
│   │   │   ├── IpTable.jsx      # Tabel daftar IP lengkap
│   │   │   └── EditIpModal.jsx  # Pop-up form untuk edit data IP
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

---

## 9. Hal Teknis Penting & "Jebakan" yang Harus Diperhatikan (Gotchas!)

Sebagai *junior developer*, kamu kemungkinan besar akan menemui 4 kendala teknis ini saat ngoding nanti. Baca solusinya di sini agar tidak bingung:

1. **Masalah Hak Akses Root / Administrator (`PermissionError` saat Scan):**
   * **Penyebab:** Library `Scapy` membuat paket jaringan level rendah (*Raw Socket*). Sistem operasi (Linux/Windows/macOS) melarang program biasa mengirim paket ARP tanpa izin Administrator/Root.
   * **Solusi:**
     * Saat menjalankan backend di Linux/macOS, jalankan dengan `sudo` atau berikan kapabilitas khusus ke binary Python: `sudo setcap cap_net_raw=eip $(which python3)`.
     * Di Windows, pastikan kamu sudah menginstal **Npcap** (centang opsi *"Install Npcap in WinPcap API-compatible Mode"*) dan jalankan terminal sebagai *Administrator*.
2. **Buat "Simulation / Mock Mode" untuk Development:**
   * **Kenapa perlu?** Kalau kamu sedang ngoding di kafe atau di kosan yang WiFi-nya mengisolasi klien, *ARP Scan* hanya akan menemukan laptopmu dan router saja (tidak seru untuk ngetes tampilan *Rogue* atau *Conflict*).
   * **Solusi:** Buat satu variabel di `.env` bernama `SCAN_MODE=mock` (atau `live`). Jika `mock`, fungsi scanner akan mengembalikan data ARP tiruan secara acak agar kamu bisa mengetes warna Kuning dan Merah di UI dengan mudah!
3. **Keterbatasan Jangkauan ARP (Layer 2 Boundary):**
   * **Konsep:** Paket ARP tidak bisa melewati Router (tidak bisa beda VLAN/Subnet). Artinya, aplikasi WatchARP hanya bisa melakukan *live scan* pada subnet yang satu jaringan langsung dengan komputer tempat aplikasi ini diinstal.
4. **Jangan Bikin UI "Freeze" Saat Scanning:**
   * Proses ARP scan untuk 254 IP membutuhkan waktu sekitar 2 hingga 4 detik. Pastikan tombol `"Scan Sekarang"` di *frontend* menampilkan animasi *loading spinner* (`isScanning = true`) dan tidak bisa diklik berkali-kali sampai *response* dari backend selesai.

---

## 10. Tahapan Pengerjaan (Step-by-Step Milestones)

Jangan kerjakan semuanya sekaligus! Ikuti urutan *milestone* ini agar kamu tidak kewalahan:

* **Hari 1 - 2 (Database & Kalkulasi Subnet):**
  Setup proyek FastAPI + SQLite. Buat endpoint `POST /api/subnets` yang bisa menerima `192.168.1.0/24` dan otomatis mengisi 254 baris IP ke database. Cek hasilnya lewat Swagger UI (`/docs`).
* **Hari 3 - 4 (Mesin ARP Scanner & Logika Rekonsiliasi):**
  Buat script Python terpisah untuk mengetes `Scapy` memindai WiFi/LAN lokal kamu. Jika sudah berhasil mendapatkan daftar IP & MAC Address, gabungkan ke dalam endpoint `POST /api/subnets/{id}/scan` dan terapkan aturan **Matriks Rekonsiliasi** (Bagian 4).
* **Hari 5 - 6 (Frontend Dashboard & Visual IP Grid):**
  Setup React + Tailwind CSS. Tampilkan daftar IP dalam bentuk **Visual IP Grid** (kotak `.1` s/d `.254`) dengan warna yang sesuai. Tambahkan fitur klik kotak untuk mengedit Hostname & Expected MAC.
* **Hari 7 (Finishing & Background Scheduler):**
  Tambahkan `APScheduler` di FastAPI agar sistem otomatis melakukan *scan* setiap 15 menit tanpa perlu diklik manual. Rapikan tampilan dan tulis cara instalasi di `README.md`.

---

## 11. Kriteria Selesai (Definition of Done - MVP)

Proyek ini dinyatakan **Selesai (Lulus MVP)** jika kamu bisa mendemokan skenario berikut tanpa *error*:
1. Menambahkan subnet lokal tempat laptopmu terhubung saat ini.
2. Menekan tombol **Scan**, dan aplikasi berhasil mendeteksi IP laptopmu, IP router/gateway, serta perangkat lain yang terhubung beserta merek vendornya (status berubah menjadi **Kuning / Rogue** karena belum didaftarkan).
3. Mengklik IP laptopmu yang berwarna Kuning, mendaftarkan Hostname-nya beserta MAC Address-nya, lalu statusnya berubah menjadi **Hijau (Valid Online)**.
4. Mengubah `Expected MAC` pada IP laptopmu dengan sengaja menjadi angka acak (`11:22:33:44:55:66`), lalu sistem langsung mengubah warnanya menjadi **Merah (MAC Mismatch / Conflict)**.