# HumanALE god egine 2.5 — Dudidam reference neural avatar

Branch default repositori backup ini adalah `codex/ale-hologram-gpt-starter/dudidam-neural-avatar`. Gunakan branch tersebut sebagai dasar PR perubahan snapshot backup; workflow verifikasi juga mencakup push dan PR ke branch ini. Repositori pengembangan HumanALE/NARA aktif berada di [Kmpsnr26/entitashuman](https://github.com/Kmpsnr26/entitashuman).

Avatar Dudidam kini memakai wajah referensi sebagai sekitar 16 ribu partikel berkedalaman. Gambar dipakai untuk menyusun posisi/intensitas kode, bukan ditempel sebagai bitmap di kanvas. Kepala, pipi, dahi, dagu, dan leher memakai proyeksi 3D dari permukaan frontal; ini bukan model kepala 360 derajat atau renderer WebGL. Bibir berasal dari kisi wajah yang sama dengan deformasi kulit kontinu, bukan lapisan bibir tambahan. Mata lebih kecil, cekung, dan berisi permukaan bola mata melengkung dari biner tanpa titik pupil/kilau terpisah.

Aliran kode perlahan berkumpul dari leher menuju inti otak. Kepala menoleh ke kiri/kanan dan mendongak/menunduk mengikuti pointer relatif terhadap widget, sementara leher membengkok lebih lambat dan daun telinga ikut berputar sebagai bagian dari kisi 3D. Kedipan lembut, napas, dan mikro-gerak tetap berjalan tanpa kilatan acak. Partikel wajah memiliki sambungan halus yang membawa sinyal; kode biner berganti mengikuti gelombang teratur. Sambungan baru tumbuh pelan secara berkala, lebih kuat saat mode evolusi aktif, lalu kembali tenang. Preferensi reduced-motion meredam gerak otomatis, tetapi gerak yang mengikuti mouse tetap responsif. Seret wajah untuk memindahkan avatar; posisi desktop tetap disimpan. Panel, percakapan, provider, terminal, emosi, reaksi telinga, dan energi suara memakai jalur Dudidam yang sudah ada. Tidak ada provider, kredensial, atau backend AI yang diganti.

## Zoom, material, dan transisi

- Gulir pada wajah atau gunakan **Jelajah inti neural** di kontrol untuk zoom 1–3.8×. Turunkan ke 1× untuk wajah utuh.
- Zoom membuka permukaan kepala dan memperlihatkan 459 simpul, 677 sambungan, serta 9 jalur leher–otak. Jaringan ini visualisasi artistik, bukan data otak, big data eksternal, atau koneksi AI yang sesungguhnya.
- Campuran memakai biner, partikel neural dan kubus; Matrix memakai biner; Statistik menambahkan angka generatif; Abstrak memakai kubus; Neural memakai titik-titik jaringan.
- Saat muncul, partikel menyusun wajah dari bentuk abstrak. Saat ditutup/disembunyikan, partikel terurai dahulu sebelum jendela hilang.
- Bibir menerima energi audio nyata dari jalur suara Dudidam. Uji renderer menggunakan energi sintetis tanpa menghubungi provider AI atau membuka mikrofon.

## Kontras desktop dan privasi

Mode **Otomatis per area desktop** menghitung grid luminansi 16×20 di belakang jendela setiap sekitar 950 ms: hitam/grafit di atas latar putih, palet terang di atas latar gelap, termasuk latar campuran. Thumbnail layar hanya sementara di memori proses utama; gambar tidak disimpan, dicatat, atau dikirim ke jaringan. Renderer hanya menerima grid angka pada area widget. Browser biasa tidak dapat membaca desktop dan mengikuti tema sistem/manual. Bila sampel desktop tidak tersedia selama 5.5 detik, renderer kembali ke tema sistem.

Agar tidak membaca warna dirinya sendiri, widget dikecualikan dari tangkapan layar Windows saat mode otomatis aktif. Widget dapat tidak muncul dalam rekaman/screenshot OS: pilih **Manual: latar gelap/terang** untuk merekam dan menghentikan pembacaan latar. Pengecualian memerlukan Windows 10 2004 atau lebih baru. Palet **Hitam grafit** juga dapat dipilih sendiri.


## Dua alur, satu repository

Riwayat aplikasi aktif dan proyek standalone lama sudah disatukan tanpa force-push atau penggantian source secara massal. Aplikasi 2.5.0 menjadi alur aktif, sedangkan snapshot standalone dipertahankan pada branch `legacy/binary-assistant-v2`. Lihat [HUMANALE-FLOWS.md](HUMANALE-FLOWS.md) untuk hubungan branch dan aturan integrasi agar kedua alur tidak saling menimpa.

## Versi desktop Windows
Jalankan HumanALE-God-Engine.exe dalam folder output HumanALE-God-Engine-Desktop. Jendela avatar 420×480 transparan tanpa bingkai, selalu di atas, dapat diseret, dan menyimpan posisi terakhir. Kontrol, percakapan, dan Developer Agent Hub membuka **jendela panel terpisah** yang dapat diseret melalui bilah judul Windows, dipindah jauh dari avatar atau ke monitor lain, serta diubah ukurannya. Mengklik kanan wajah atau menekan H membuka kontrol; Enter membuka percakapan. Avatar tetap terlihat ketika panel dipindah. HumanALE god egine dapat dipulihkan dari ikon tray saat disembunyikan. Area kosong di sekitar wajah otomatis meneruskan klik ke aplikasi di bawahnya. Untuk source development: npm install, kemudian npm run desktop. Electron 44.4.3.

Klik kanan/dobel klik wajah atau H: kontrol. Enter: percakapan. B/N/G: kedip/angguk/geleng. 1–5: gaya partikel. M: mikrofon. R: tengahkan. Esc: tutup panel dan hentikan suara. Alt+F4 menutup aplikasi. Tombol minimalkan/tutup juga ada di kontrol.

## ChatGPT tanpa API key
Versi desktop menggunakan Codex CLI resmi yang sudah login dengan ChatGPT. Login ini dapat memakai akun ChatGPT yang sama di komputer, tetapi riwayat/sesi percakapan ChatGPT yang sedang terbuka tidak otomatis disalin ke HumanALE god egine. Pemeriksaan memakai codex login status. Tombol Login ChatGPT menjalankan alur resmi codex login melalui browser. Tidak ada pembacaan/copy auth.json, cookie, password, atau token login. Tidak menggunakan API key. Mengikuti batas penggunaan akun ChatGPT/Codex. Ini bukan sinkronisasi riwayat chatgpt.com.

Percakapan dipanggil melalui IPC lokal terbatas; tidak ada endpoint HTTP untuk menjalankan Codex. Renderer hanya memuat aset lokal dengan sandbox, context isolation, tanpa Node integration. CLI menggunakan read-only sandbox, sesi ephemeral, tool shell/browser/plugin/hooks/apps/multi-agent dimatikan, dan cwd temporer terpisah. Pesan dibatasi ukurannya. Foto hanya disimpan sementara selama satu permintaan lalu dihapus.

Codex CLI ditemukan dari instalasi Codex Windows atau PATH. Untuk lokasi khusus gunakan environment `HUMANALE_CODEX_PATH` pada launcher (alias lama `DUDIDAM_CODEX_PATH` tetap didukung); jangan memasukkan kredensial.

## GitHub Copilot dalam avatar
Pilih **AI provider → GitHub Copilot** pada panel kontrol. HumanALE god egine menjalankan GitHub Copilot CLI lokal dengan akun GitHub yang sudah login. Jika belum login, tekan **Login Copilot**. Mode ini untuk percakapan berbahasa Indonesia tanpa akses tool atau edit proyek; Developer Agent Hub tetap menyediakan mode kerja proyek secara terpisah. Riwayat percakapan hanya berada di memori HumanALE god egine, dan foto belum didukung. Saat Copilot dipilih, avatar memakai aksen cyan dan label Copilot; saat ChatGPT dipilih, label dan aksen ChatGPT kembali. Ini adalah tampilan HumanALE god egine yang menunjukkan provider aktif, bukan karakter atau logo resmi kedua layanan.


## OpenAI API
Selain login ChatGPT melalui Codex CLI, HumanALE god egine dapat memakai OpenAI API secara langsung. Pilih **AI provider → OpenAI API**. Atur `OPENAI_API_KEY` pada environment Windows; model default `gpt-5.4-mini` dan dapat diganti dengan `OPENAI_MODEL`. Request dikirim dari proses Electron ke Responses API. Key tidak dikirim ke renderer, HTML, localStorage, artifact, atau GitHub. Provider ini mendukung teks dan satu foto JPEG dari kamera.

## Claude / Anthropic
Pilih **AI provider → Claude / Anthropic** dan atur `ANTHROPIC_API_KEY`. Model default `claude-sonnet-4-6` dan dapat diganti dengan `ANTHROPIC_MODEL`. HumanALE god egine menggunakan Anthropic Messages API dari proses Electron. Foto belum diteruskan melalui adapter ini.

## DeepSeek
Pilih **AI provider → DeepSeek** dan atur `DEEPSEEK_API_KEY`. Model default `deepseek-flash` dan dapat diganti dengan `DEEPSEEK_MODEL`. HumanALE god egine memakai DeepSeek Responses API dari proses Electron. Foto belum diteruskan melalui adapter ini.

## Secret setup
`.env.example` hanya berisi nama variabel dan nilai model default, tanpa secret. Untuk Windows, set key sebagai environment variable atau lewat secret manager lokal sebelum membuka HumanALE god egine. Jangan commit file `.env`, token, atau API key. GitHub Copilot CLI dapat memakai OAuth lokal; untuk non-interaktif HumanALE god egine juga mengenali `COPILOT_GITHUB_TOKEN` bila Anda memang memilih autentikasi token.

## Grok / xAI
HumanALE god egine Desktop juga dapat memakai Grok sebagai provider tambahan. Pilih **AI provider → Grok / xAI** pada panel kontrol. Koneksi berjalan dari proses Electron ke xAI Responses API; API key tidak dikirim ke renderer, tidak disimpan di source, dan tidak dimasukkan ke paket atau GitHub.

Atur environment variable Windows `XAI_API_KEY` sebelum membuka HumanALE god egine. Untuk sesi development PowerShell dapat memakai `$env:XAI_API_KEY="..."` lalu `npm run desktop`. Model default adalah `grok-4.6`; `XAI_MODEL` dapat dipakai untuk mengganti model yang tersedia pada akun xAI. Percakapan teks sudah didukung. Foto/kamera tetap diarahkan ke ChatGPT sampai dukungan vision Grok diaktifkan dan diuji terpisah.

## Gemini / Google AI
HumanALE god egine Desktop dapat memakai Gemini sebagai provider ketiga. Pilih **AI provider → Gemini / Google**. Request berjalan dari proses Electron langsung ke Gemini API dengan header autentikasi Google; key tidak pernah dikirim ke renderer, HTML, localStorage, artifact, atau GitHub.

Atur environment variable Windows `GEMINI_API_KEY` atau `GOOGLE_API_KEY` sebelum membuka HumanALE god egine. Jika keduanya ada, `GOOGLE_API_KEY` diprioritaskan. Untuk development PowerShell dapat memakai `$env:GEMINI_API_KEY="..."` lalu `npm run desktop`. Model default adalah `gemini-3.6-flash`; `GEMINI_MODEL` dapat dipakai untuk mengganti model. Gemini mendukung percakapan teks dan satu foto JPEG dari kamera HumanALE god egine melalui input inline.

## AskCodi
AskCodi tersedia sebagai provider API langsung melalui gateway OpenAI-compatible `https://api.askcodi.com/v1`. Atur `ASKCODI_API_KEY` dan `ASKCODI_MODEL`, lalu pilih **AI provider → AskCodi**. HumanALE god egine tidak menaruh key atau model secret ke renderer, HTML, localStorage, GitHub, atau artifact. Foto belum dikirim melalui adapter AskCodi ini.

## Developer Agent Hub
Tombol **Developer agents** pada kontrol desktop menampilkan Continue, Sourcegraph Cody, Pieces for Developers, AskCodi, Phind, Amazon Q Developer, Windsurf/Codeium, Tabnine, Replit Agent, Cursor, GitHub Copilot, OpenAI Codex, Claude, DeepSeek, dan konektor lain yang terdaftar. Hub mendeteksi CLI lokal atau environment konfigurasi tanpa menyalin token ke UI.

Pemanggilan langsung dari HumanALE god egine memiliki mode **Analisis** untuk agent yang didukung. Untuk **GitHub Copilot** dan **OpenAI Codex** tersedia mode **Lanjutkan pekerjaan** yang dapat mengedit file checkout proyek. GitHub Copilot dibatasi ke tool view/grep/glob/edit/create/apply_patch tanpa shell bebas; Codex memakai sandbox `workspace-write`. Sebelum Codex ditandai siap atau dijalankan, Agent Hub memeriksa `codex login status`; jika CLI ada tetapi login tidak aktif, UI menampilkan instruksi login dan tidak memulai pekerjaan. Eksekusi Codex memakai output JSON Lines agar kegagalan turn dapat dibedakan dari pesan model. Timeout default adalah 120 detik untuk Analisis dan 600 detik untuk Lanjutkan pekerjaan; dapat diubah dengan `HUMANALE_AGENT_TIMEOUT_MS` dalam batas 30–900 detik (alias lama `DUDIDAM_AGENT_TIMEOUT_MS` tetap didukung). Keduanya diberi instruksi untuk tidak `git push`, publish, atau mengubah kredensial. Continue tetap memakai `cn -p ... --readonly`, Cody memakai `cody chat`, dan Cursor memakai `agent -p ... --mode=ask`. Set `HUMANALE_PROJECT_ROOT` ke folder checkout repo (alias lama `DUDIDAM_PROJECT_ROOT` tetap didukung) agar agent membaca proyek yang benar.

Koneksi lain mengikuti kemampuan resmi produknya: Pieces melalui URL MCP lokal (`PIECES_MCP_URL`), Sourcegraph/Cody dapat memakai Sourcegraph MCP atau Cody CLI, Amazon Q/Tabnine/Windsurf/Replit berperan sebagai MCP-capable agent/client di lingkungan masing-masing. Phind ditampilkan sebagai layanan eksternal karena adapter API/MCP publik resmi belum dipakai dalam HumanALE god egine.

## Suara, musik, dan kamera
Panel **Gerak dari audio** menggerakkan bibir serta kepala dari energi mikrofon, file musik yang dipilih, atau audio perangkat Windows. Audio perangkat memakai loopback Electron dan hanya dimulai setelah tombol ditekan. File musik tetap lokal di perangkat. Pemeriksaan izin media Electron mengizinkan origin lokal HumanALE god egine dan tetap menampilkan persetujuan pengguna sebelum mikrofon atau kamera aktif. Pada versi desktop, setiap balasan dari pertanyaan yang diketik otomatis dibacakan oleh model lokal Piper Indonesia `id_ID-news_tts-medium` dalam `%LOCALAPPDATA%\HumanALE god egine\voice-models\piper`; suara Windows/Chromium Bahasa Indonesia (`id-ID`) tetap menjadi cadangan untuk versi web. Teks balasan tidak dikirim ke layanan suara lain. Jika voice lokal belum ada, balasan tetap tampil sebagai teks agar tidak dibaca oleh suara bahasa lain.

Kamera menggunakan izin pengguna dan hanya mengirim satu foto ketika tombol Kirim satu foto & jelaskan ditekan. Tidak merekam video. Kamera berhenti saat panel chat ditutup atau aplikasi tersembunyi.
Tombol **Dikte suara** memeriksa mikrofon dan izin, lalu memakai pengenal lokal Faster Whisper untuk Bahasa Indonesia bila tersedia. Rekaman dibatasi 12 detik, diproses di komputer, dan file sementaranya dihapus. Untuk mengaktifkan suara dan dikte Indonesia pada komputer baru, pasang Python 3.12, lalu jalankan `Setup-suara-Indonesia.ps1` dari folder paket. Skrip mencari Python yang tersedia (atau memakai `HUMANALE_PYTHON_PATH` / `DUDIDAM_PYTHON_PATH` bila diatur), membuat lingkungan suara terpisah di `%LOCALAPPDATA%\HumanALE god egine\voice-runtime`, dan mengunduh model ke `%LOCALAPPDATA%\HumanALE god egine\voice-models` tanpa hak administrator. Unduhan awal memerlukan internet; sesudahnya model lokal dapat dipakai offline dan tidak dibundel ke aplikasi agar paket desktop tetap ringan. Jika runtime lokal tidak tersedia, HumanALE god egine mencoba SpeechRecognition browser dan menjelaskan kegagalannya. Wake “ALE” tetap memakai SpeechRecognition saat diaktifkan dan dapat gagal pada Electron; pintasan global Ctrl+Alt+5 tetap tersedia. Wake nonaktif setiap aplikasi dibuka. Mikrofon dan kamera tidak merekam terus menerus tanpa diaktifkan.

## Sites
https://binary-human-assistant.sitihasnah109.chatgpt.site
Proyek yang sama dipertahankan pada .openai/hosting.json dan tetap memakai kebijakan akses publik yang sudah ada. Sites menampilkan wajah biner saja dan login identitas resmi. Browser tidak dapat membuat latar tembus sampai desktop. Tombol pop-up membuka jendela browser kecil; transparansi OS, mode tembus klik, dan model via login tersedia pada desktop lokal. Tidak ada API key yang diminta di versi 2.


## Verifikasi dan paket Windows
Jalankan `npm run verify` untuk menjalankan test dan build web dalam satu perintah. Di Windows, `npm run package:desktop` membuat folder portable `HumanALE-God-Engine-Desktop` dari runtime Electron yang sudah terpasang dan mengganti executable menjadi `HumanALE-God-Engine.exe`. Paket ini tidak memasukkan kredensial atau data login ChatGPT.

GitHub Actions menjalankan verifikasi pada pull request dan push ke `main`, membangun paket Windows, lalu menunggu hasil smoke test startup pada `HumanALE-God-Engine.exe`. Workflow Android menyimpan APK debug sebagai artefak Actions. Publikasi rilis Windows maupun Android hanya berjalan lewat `workflow_dispatch` pada `main` dengan `publish_release` aktif; push biasa tidak menerbitkan rilis. Workflow backup ini belum menyediakan verifikasi Authenticode atau signing Android produksi. Hasil build tidak membuktikan acceptance perangkat nyata. Smoke test model nyata tetap dijalankan manual karena memerlukan akun ChatGPT yang sudah login.

## Develop / verify
node server.mjs — http://127.0.0.1:4177
node build.mjs — dist/client dan dist/server
node --test tests/*.test.mjs
npm run desktop — popup native
node desktop/smoke.mjs — satu permintaan model nyata menggunakan akun ChatGPT (memakai kuota)

Statistik pada partikel adalah efek visual generatif, bukan metrik sistem. Tidak ada autostart Windows atau perubahan pet bawaan Codex.

# Avatar, telinga, emosi, dan suara Indonesia

Kontrol avatar menyediakan **Karakter emosi** (otomatis dari balasan, netral, bahagia, marah, kesal, sedih) dan **Efek suara** (bayi robot atau natural). Preset bayi robot memakai model suara Indonesia lokal Piper bila tersedia; suara Windows Indonesia menjadi cadangan. Telinga biner bereaksi terhadap pita frekuensi rendah, menengah, dan tinggi dari Mikrofon visual, Audio perangkat, atau file musik yang dipilih. Mikrofon tetap memerlukan izin pengguna.
