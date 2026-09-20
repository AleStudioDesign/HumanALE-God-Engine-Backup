# Dudidam · Binary Human Assistant

Asisten web mandiri dengan wajah biner dari referensi pengguna, animasi tatapan/kedip/kepala, perintah Bahasa Indonesia, pengenalan suara browser, dan balasan TTS. Tidak mengganti pet bawaan Codex/ChatGPT dan tidak mengendalikan sistem operasi.

## Menjalankan

Node.js 22+: `node server.mjs`, lalu buka http://127.0.0.1:4177. Tidak ada dependency install. Build: `node build.mjs`. Tes: `node --test tests/*.test.mjs`.

## Koneksi AI

Perintah gerakan dan waktu bekerja tanpa API. Untuk percakapan umum dan analisis satu foto kamera, tambahkan **secret** `OPENAI_API_KEY` pada runtime Sites, opsional `OPENAI_MODEL` (default `gpt-4.1-mini`), kemudian deploy ulang versi tersimpan. Jangan memasukkan key ke source/client atau percakapan. Login ChatGPT tidak sama dengan API key.

Backend menggunakan Responses API dengan `store:false`, timeout, pembatasan ukuran, validasi pesan/foto, dan same-origin POST. Situs harus tetap privat khusus pemilik; bila dibuka untuk umum tambahkan autentikasi dan rate limit sebelum memakai key berbayar.

## Interaksi dan privasi

- B berkedip, N mengangguk, G menggeleng, M mikrofon, Escape menghentikan mikrofon/suara. Shortcut tidak aktif ketika mengetik atau dialog terbuka.
- Mouse di atas avatar mengubah arah tatapan dan kepala. Mode pet adalah tampilan ringkas browser, bukan overlay Windows.
- Mikrofon memakai SpeechRecognition jika didukung. Layanan browser dapat memproses audio secara online. Browser tanpa dukungan menampilkan petunjuk dan tetap menerima teks.
- Kamera hanya aktif atas klik, pratinjau lokal. Satu foto dikirim ke OpenAI hanya setelah tombol “Lihat & jelaskan”. Tidak ada perekaman atau penyimpanan gambar dalam aplikasi.
- Kamera/mikrofon berhenti saat tab disembunyikan/ditutup. Riwayat percakapan berada di memori tab; tidak disimpan di localStorage/database.
- Permission perangkat, akurasi pengenalan suara, TTS, serta akses model/kuota perlu diverifikasi di perangkat pemilik.

## Deploy

Identitas Sites disimpan di `.openai/hosting.json`. `node build.mjs` menyiapkan Worker dan aset pada `dist`. Arsip deployment harus dibuat dari `dist` sesudah source yang sama di-commit/push. Pertahankan akses owner-private.

Dokumentasi API: https://developers.openai.com/api/docs/guides/text dan https://developers.openai.com/api/docs/guides/images-vision
