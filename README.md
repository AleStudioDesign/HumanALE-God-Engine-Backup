# Dudidam 2 — Floating Binary Human
Avatar wajah biner mengambang di tengah layar. Panel tersembunyi. Matrix, statistik generatif, abstrak, neural, dan campuran; kode biner membelok serta mengorbit di sekitar kursor sebagai medan magnet. Wajah tidak memakai bayang hitam atau pelat buram. Setiap glyph membentuk kontrasnya sendiri melalui outline gelap berwarna dan inti terang berwarna, sementara hue, saturasi, energi, serta opasitasnya berevolusi perlahan. Karena sisi gelap dan terang hadir bersamaan, glyph tetap terbaca di area wallpaper terang maupun gelap tanpa mengganti seluruh avatar ke satu mode. Leher biner mengikuti rotasi kepala maksimal ±30°, sementara akar neural dari belakang leher mengalirkan pulsa data dan gelombang frekuensi menuju area otak. Bibir dan glyph mulut bergerak berdasarkan energi suara saat Dudidam berbicara.

## Versi desktop Windows
Jalankan Dudidam.exe dalam folder output Dudidam-Desktop. Jendela kompak 420×480 menampilkan avatar transparan tanpa bingkai, selalu di atas, dapat diseret, dan menyimpan posisi terakhir. Avatar memakai area maksimal 380 px dan panel maksimal 330 px. Transparansi hanya dipakai pada permukaan pop-up/avatar yang mengambang; panel kontrol dan percakapan tetap memakai latar panel yang jelas. Dudidam tetap dapat dipulihkan dari ikon tray saat disembunyikan. Area kosong di sekitar wajah otomatis meneruskan klik ke aplikasi di bawahnya, sementara wajah, balon, tombol, dan panel tetap dapat diklik. Mode **Tembus klik penuh** tersedia untuk mengabaikan seluruh jendela dan dapat dimatikan kembali melalui menu tray. Untuk source development: npm install, kemudian npm run desktop. Electron 44.4.3.

Klik kanan/dobel klik wajah atau H: kontrol. Enter: percakapan. B/N/G: kedip/angguk/geleng. 1–5: gaya partikel. M: mikrofon. R: tengahkan. Esc: tutup panel dan hentikan suara. Alt+F4 menutup aplikasi. Tombol minimalkan/tutup juga ada di kontrol.

## ChatGPT tanpa API key
Versi desktop menggunakan Codex CLI resmi yang sudah login dengan ChatGPT. Pemeriksaan memakai codex login status. Tombol Login ChatGPT menjalankan alur resmi codex login melalui browser. Tidak ada pembacaan/copy auth.json, cookie, password, atau token login. Tidak menggunakan API key. Mengikuti batas penggunaan akun ChatGPT/Codex. Ini bukan sinkronisasi riwayat chatgpt.com.

Percakapan dipanggil melalui IPC lokal terbatas; tidak ada endpoint HTTP untuk menjalankan Codex. Renderer hanya memuat aset lokal dengan sandbox, context isolation, tanpa Node integration. CLI menggunakan read-only sandbox, sesi ephemeral, tool shell/browser/plugin/hooks/apps/multi-agent dimatikan, dan cwd temporer terpisah. Pesan dibatasi ukurannya. Foto hanya disimpan sementara selama satu permintaan lalu dihapus.

Codex CLI ditemukan dari instalasi Codex Windows atau PATH. Untuk lokasi khusus gunakan environment DUDIDAM_CODEX_PATH pada launcher; jangan memasukkan kredensial.


## OpenAI API
Selain login ChatGPT melalui Codex CLI, Dudidam dapat memakai OpenAI API secara langsung. Pilih **AI provider → OpenAI API**. Atur `OPENAI_API_KEY` pada environment Windows; model default `gpt-5.4-mini` dan dapat diganti dengan `OPENAI_MODEL`. Request dikirim dari proses Electron ke Responses API. Key tidak dikirim ke renderer, HTML, localStorage, artifact, atau GitHub. Provider ini mendukung teks dan satu foto JPEG dari kamera.

## Claude / Anthropic
Pilih **AI provider → Claude / Anthropic** dan atur `ANTHROPIC_API_KEY`. Model default `claude-sonnet-4-6` dan dapat diganti dengan `ANTHROPIC_MODEL`. Dudidam menggunakan Anthropic Messages API dari proses Electron. Foto belum diteruskan melalui adapter ini.

## DeepSeek
Pilih **AI provider → DeepSeek** dan atur `DEEPSEEK_API_KEY`. Model default `deepseek-flash` dan dapat diganti dengan `DEEPSEEK_MODEL`. Dudidam memakai DeepSeek Responses API dari proses Electron. Foto belum diteruskan melalui adapter ini.

## Secret setup
`.env.example` hanya berisi nama variabel dan nilai model default, tanpa secret. Untuk Windows, set key sebagai environment variable atau lewat secret manager lokal sebelum membuka Dudidam. Jangan commit file `.env`, token, atau API key. GitHub Copilot CLI dapat memakai OAuth lokal; untuk non-interaktif Dudidam juga mengenali `COPILOT_GITHUB_TOKEN` bila Anda memang memilih autentikasi token.

## Grok / xAI
Dudidam Desktop juga dapat memakai Grok sebagai provider tambahan. Pilih **AI provider → Grok / xAI** pada panel kontrol. Koneksi berjalan dari proses Electron ke xAI Responses API; API key tidak dikirim ke renderer, tidak disimpan di source, dan tidak dimasukkan ke paket atau GitHub.

Atur environment variable Windows `XAI_API_KEY` sebelum membuka Dudidam. Untuk sesi development PowerShell dapat memakai `$env:XAI_API_KEY="..."` lalu `npm run desktop`. Model default adalah `grok-4.6`; `XAI_MODEL` dapat dipakai untuk mengganti model yang tersedia pada akun xAI. Percakapan teks sudah didukung. Foto/kamera tetap diarahkan ke ChatGPT sampai dukungan vision Grok diaktifkan dan diuji terpisah.

## Gemini / Google AI
Dudidam Desktop dapat memakai Gemini sebagai provider ketiga. Pilih **AI provider → Gemini / Google**. Request berjalan dari proses Electron langsung ke Gemini API dengan header autentikasi Google; key tidak pernah dikirim ke renderer, HTML, localStorage, artifact, atau GitHub.

Atur environment variable Windows `GEMINI_API_KEY` atau `GOOGLE_API_KEY` sebelum membuka Dudidam. Jika keduanya ada, `GOOGLE_API_KEY` diprioritaskan. Untuk development PowerShell dapat memakai `$env:GEMINI_API_KEY="..."` lalu `npm run desktop`. Model default adalah `gemini-3.6-flash`; `GEMINI_MODEL` dapat dipakai untuk mengganti model. Gemini mendukung percakapan teks dan satu foto JPEG dari kamera Dudidam melalui input inline.

## AskCodi
AskCodi tersedia sebagai provider API langsung melalui gateway OpenAI-compatible `https://api.askcodi.com/v1`. Atur `ASKCODI_API_KEY` dan `ASKCODI_MODEL`, lalu pilih **AI provider → AskCodi**. Dudidam tidak menaruh key atau model secret ke renderer, HTML, localStorage, GitHub, atau artifact. Foto belum dikirim melalui adapter AskCodi ini.

## Developer Agent Hub
Tombol **Developer agents** pada kontrol desktop menampilkan Continue, Sourcegraph Cody, Pieces for Developers, AskCodi, Phind, Amazon Q Developer, Windsurf/Codeium, Tabnine, Replit Agent, Cursor, GitHub Copilot, OpenAI Codex, Claude, DeepSeek, dan konektor lain yang terdaftar. Hub mendeteksi CLI lokal atau environment konfigurasi tanpa menyalin token ke UI.

Pemanggilan langsung dari Dudidam sengaja dibatasi ke mode baca/analisis: Continue memakai `cn -p ... --readonly`, Cody memakai `cody chat`, dan Cursor memakai `agent -p ... --mode=ask`. Hub tidak memakai Cursor `--force` dan tidak mengaktifkan mode tulis otomatis. Set `DUDIDAM_PROJECT_ROOT` ke folder checkout repo agar agent membaca proyek yang benar.

Koneksi lain mengikuti kemampuan resmi produknya: Pieces melalui URL MCP lokal (`PIECES_MCP_URL`), Sourcegraph/Cody dapat memakai Sourcegraph MCP atau Cody CLI, Amazon Q/Tabnine/Windsurf/Replit berperan sebagai MCP-capable agent/client di lingkungan masing-masing. Phind ditampilkan sebagai layanan eksternal karena adapter API/MCP publik resmi belum dipakai dalam Dudidam.

## Suara, musik, dan kamera
Panel **Gerak dari audio** menggerakkan bibir serta kepala dari energi mikrofon, file musik yang dipilih, atau audio perangkat Windows. Audio perangkat memakai loopback Electron dan hanya dimulai setelah tombol ditekan. File musik tetap lokal di perangkat. Pemeriksaan izin media Electron mengizinkan origin lokal Dudidam dan tetap menampilkan persetujuan pengguna sebelum mikrofon atau kamera aktif. Suara balasan Dudidam memakai batas kata TTS agar viseme tetap bergerak selama jawaban dibacakan.

Kamera menggunakan izin pengguna dan hanya mengirim satu foto ketika tombol Kirim satu foto & jelaskan ditekan. Tidak merekam video. Kamera berhenti saat panel chat ditutup atau aplikasi tersembunyi.
Tombol **Dikte suara** melakukan pemeriksaan singkat dengan `getUserMedia({audio:true})`, membedakan perangkat tidak ditemukan, izin ditolak, perangkat tidak dapat dibuka, serta pengenal ucapan yang tidak tersedia atau gagal terhubung. Semua track pemeriksaan langsung dihentikan. Pengenalan suara memakai SpeechRecognition browser setelah pemeriksaan berhasil; Chromium/Electron bisa tidak menyediakan layanan ini. Jika mikrofon sehat tetapi pengenal ucapan tidak tersedia, gunakan teks atau dikte OS (Win+H secara manual). TTS memakai suara yang tersedia di Windows. Mikrofon dan kamera bukan layanan yang selalu merekam.

## Sites
https://binary-human-assistant.sitihasnah109.chatgpt.site
Proyek yang sama dipertahankan pada .openai/hosting.json dan tetap memakai kebijakan akses publik yang sudah ada. Sites menampilkan wajah biner saja dan login identitas resmi. Browser tidak dapat membuat latar tembus sampai desktop. Tombol pop-up membuka jendela browser kecil; transparansi OS, mode tembus klik, dan model via login tersedia pada desktop lokal. Tidak ada API key yang diminta di versi 2.


## Verifikasi dan paket Windows
Jalankan `npm run verify` untuk menjalankan test dan build web dalam satu perintah. Di Windows, `npm run package:desktop` membuat folder portable `Dudidam-Desktop` dari runtime Electron yang sudah terpasang dan mengganti executable menjadi `Dudidam.exe`. Paket ini tidak memasukkan kredensial atau data login ChatGPT.

GitHub Actions menjalankan verifikasi pada pull request dan push ke `main`, membangun artefak Windows `Dudidam-Desktop-Windows`, lalu menjalankan smoke test startup pada paket `Dudidam.exe` untuk memastikan runtime dan renderer lokal dapat dimuat. Smoke test model nyata tetap dijalankan manual karena memerlukan akun ChatGPT yang sudah login.

## Develop / verify
node server.mjs — http://127.0.0.1:4177
node build.mjs — dist/client dan dist/server
node --test tests/*.test.mjs
npm run desktop — popup native
node desktop/smoke.mjs — satu permintaan model nyata menggunakan akun ChatGPT (memakai kuota)

Statistik pada partikel adalah efek visual generatif, bukan metrik sistem. Tidak ada autostart Windows atau perubahan pet bawaan Codex.

