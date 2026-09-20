# Dudidam 2 — Floating Binary Human
Avatar wajah biner mengambang di tengah layar. Panel tersembunyi. Matrix, statistik generatif, abstrak, dan campuran; partikel bereaksi terhadap kursor sebagai medan magnet.

## Versi desktop Windows
Jalankan Dudidam.exe dalam folder output Dudidam-Desktop. Jendela transparan, tanpa bingkai, selalu di atas, dapat diseret. Untuk source development: npm install, kemudian npm run desktop. Electron 44.4.3.

Klik kanan/dobel klik wajah atau H: kontrol. Enter: percakapan. B/N/G: kedip/angguk/geleng. 1–4: gaya partikel. M: mikrofon. R: tengahkan. Esc: tutup panel dan hentikan suara. Alt+F4 menutup aplikasi. Tombol minimalkan/tutup juga ada di kontrol.

## ChatGPT tanpa API key
Versi desktop menggunakan Codex CLI resmi yang sudah login dengan ChatGPT. Pemeriksaan memakai codex login status. Tombol Login ChatGPT menjalankan alur resmi codex login melalui browser. Tidak ada pembacaan/copy auth.json, cookie, password, atau token login. Tidak menggunakan API key. Mengikuti batas penggunaan akun ChatGPT/Codex. Ini bukan sinkronisasi riwayat chatgpt.com.

Percakapan dipanggil melalui IPC lokal terbatas; tidak ada endpoint HTTP untuk menjalankan Codex. Renderer hanya memuat aset lokal dengan sandbox, context isolation, tanpa Node integration. CLI menggunakan read-only sandbox, sesi ephemeral, tool shell/browser/plugin/hooks/apps/multi-agent dimatikan, dan cwd temporer terpisah. Pesan dibatasi ukurannya. Foto hanya disimpan sementara selama satu permintaan lalu dihapus.

Codex CLI ditemukan dari instalasi Codex Windows atau PATH. Untuk lokasi khusus gunakan environment DUDIDAM_CODEX_PATH pada launcher; jangan memasukkan kredensial.

## Suara dan kamera
Kamera menggunakan izin pengguna dan hanya mengirim satu foto ketika tombol Kirim satu foto & jelaskan ditekan. Tidak merekam video. Kamera berhenti saat panel chat ditutup atau aplikasi tersembunyi.
Pengenalan suara menggunakan SpeechRecognition browser. Chromium/Electron bisa tidak menyediakan layanan ini; ketika gagal aplikasi memberi pesan yang jelas. Gunakan teks atau dikte OS (Win+H secara manual). TTS memakai suara yang tersedia di Windows. Mikrofon dan kamera bukan layanan yang selalu merekam.

## Sites
https://binary-human-assistant.sitihasnah109.chatgpt.site
Proyek yang sama dipertahankan pada .openai/hosting.json; akses privat. Sites menampilkan wajah biner saja dan login identitas resmi. Browser tidak dapat membuat latar tembus sampai desktop. Tombol pop-up membuka jendela browser kecil; transparansi OS dan model via login tersedia pada desktop lokal. Tidak ada API key yang diminta di versi 2.

## Develop / verify
node server.mjs — http://127.0.0.1:4177
node build.mjs — dist/client dan dist/server
node --test tests/*.test.mjs
npm run desktop — popup native
node desktop/smoke.mjs — satu permintaan model nyata menggunakan akun ChatGPT (memakai kuota)

Statistik pada partikel adalah efek visual generatif, bukan metrik sistem. Tidak ada autostart Windows atau perubahan pet bawaan Codex.

