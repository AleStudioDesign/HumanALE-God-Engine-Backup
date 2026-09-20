# Dudidam 2 — Floating Binary Human
Avatar wajah biner mengambang di tengah layar. Panel tersembunyi. Matrix, statistik generatif, abstrak, neural, dan campuran; partikel bereaksi terhadap kursor sebagai medan magnet. Wajah tanpa bayang hitam dan kontras kode menyesuaikan tema terang atau gelap perangkat, dengan pilihan manual di kontrol.

## Versi desktop Windows
Jalankan Dudidam.exe dalam folder output Dudidam-Desktop. Jendela pop-up avatar transparan, tanpa bingkai, selalu di atas, dapat diseret, dan menyimpan posisi terakhir. Transparansi hanya dipakai pada permukaan pop-up/avatar yang mengambang; panel kontrol dan percakapan tetap memakai latar panel yang jelas. Dudidam tetap dapat dipulihkan dari ikon tray saat disembunyikan. Mode **Tembus klik** membuat area transparan tidak menghalangi aplikasi di bawahnya; matikan kembali melalui menu tray. Untuk source development: npm install, kemudian npm run desktop. Electron 44.4.3.

Klik kanan/dobel klik wajah atau H: kontrol. Enter: percakapan. B/N/G: kedip/angguk/geleng. 1–5: gaya partikel. M: mikrofon. R: tengahkan. Esc: tutup panel dan hentikan suara. Alt+F4 menutup aplikasi. Tombol minimalkan/tutup juga ada di kontrol.

## ChatGPT tanpa API key
Versi desktop menggunakan Codex CLI resmi yang sudah login dengan ChatGPT. Pemeriksaan memakai codex login status. Tombol Login ChatGPT menjalankan alur resmi codex login melalui browser. Tidak ada pembacaan/copy auth.json, cookie, password, atau token login. Tidak menggunakan API key. Mengikuti batas penggunaan akun ChatGPT/Codex. Ini bukan sinkronisasi riwayat chatgpt.com.

Percakapan dipanggil melalui IPC lokal terbatas; tidak ada endpoint HTTP untuk menjalankan Codex. Renderer hanya memuat aset lokal dengan sandbox, context isolation, tanpa Node integration. CLI menggunakan read-only sandbox, sesi ephemeral, tool shell/browser/plugin/hooks/apps/multi-agent dimatikan, dan cwd temporer terpisah. Pesan dibatasi ukurannya. Foto hanya disimpan sementara selama satu permintaan lalu dihapus.

Codex CLI ditemukan dari instalasi Codex Windows atau PATH. Untuk lokasi khusus gunakan environment DUDIDAM_CODEX_PATH pada launcher; jangan memasukkan kredensial.

## Grok / xAI
Dudidam Desktop juga dapat memakai Grok sebagai provider tambahan. Pilih **AI provider → Grok / xAI** pada panel kontrol. Koneksi berjalan dari proses Electron ke xAI Responses API; API key tidak dikirim ke renderer, tidak disimpan di source, dan tidak dimasukkan ke paket atau GitHub.

Atur environment variable Windows `XAI_API_KEY` sebelum membuka Dudidam. Untuk sesi development PowerShell dapat memakai `$env:XAI_API_KEY="..."` lalu `npm run desktop`. Model default adalah `grok-4.6`; `XAI_MODEL` dapat dipakai untuk mengganti model yang tersedia pada akun xAI. Percakapan teks sudah didukung. Foto/kamera tetap diarahkan ke ChatGPT sampai dukungan vision Grok diaktifkan dan diuji terpisah.

## Suara, musik, dan kamera
Panel **Gerak dari audio** menggerakkan bibir serta kepala dari energi mikrofon, file musik yang dipilih, atau audio perangkat Windows. Audio perangkat memakai loopback Electron dan hanya dimulai setelah tombol ditekan. File musik tetap lokal di perangkat. Suara balasan Dudidam memakai batas kata TTS agar viseme tetap bergerak selama jawaban dibacakan.

Kamera menggunakan izin pengguna dan hanya mengirim satu foto ketika tombol Kirim satu foto & jelaskan ditekan. Tidak merekam video. Kamera berhenti saat panel chat ditutup atau aplikasi tersembunyi.
Pengenalan suara menggunakan SpeechRecognition browser. Chromium/Electron bisa tidak menyediakan layanan ini; ketika gagal aplikasi memberi pesan yang jelas. Gunakan teks atau dikte OS (Win+H secara manual). TTS memakai suara yang tersedia di Windows. Mikrofon dan kamera bukan layanan yang selalu merekam.

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

