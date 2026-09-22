# HumanALE God Engine / GitHub Copilot handoff

Repo: `Kmpsnr26/entitashuman`
Branch kerja: `codex/entitasale170925`
PR: #13
Verified head sebelum handoff: `f4c0a9eaaf00c1c44f0677a2e3cf6b8d6adff96e`
CI terakhir: Verify and package #158 — SUCCESS.

## Status yang sudah selesai
- Avatar default 420 px, slider 180–540 px.
- Gerakan binary/neural diperlambat dengan `PARTICLE_TIME_SCALE=.58`.
- Kepala particle-only sudah memiliki telinga kiri/kanan dan perspektif yaw.
- Continuous avatar lines tetap dilarang oleh regression test.
- Tray "Tampilkan HumanALE God Engine" dipisahkan dari "Panggil ALE": Show tidak boleh otomatis summon/mikrofon.
- State avatar memiliki `reveal()` untuk keluar dari state disassemble saat ditampilkan normal.
- Copilot child process, Indonesian STT, dan Indonesian TTS dibersihkan saat shutdown.
- Copilot chat memakai `--available-tools=view` dan builtin MCP tetap dinonaktifkan untuk mode percakapan.
- Jika Piper gagal synthesis, HumanALE God Engine mencoba voice Windows Bahasa Indonesia.
- Packaged `HumanALE God Engine.exe` sudah lolos smoke test Windows.

## Tugas berikutnya di HumanALE God Engine + GitHub Copilot
Mulai dengan mode Analyze, lalu gunakan Work hanya untuk perbaikan yang sudah jelas.

1. Jalankan audit runtime lokal pada build/install terbaru.
2. Verifikasi koneksi GitHub Copilot CLI dari HumanALE God Engine:
   - CLI ditemukan;
   - autentikasi/login aktif;
   - pesan sederhana menghasilkan jawaban;
   - tidak ada trust-folder prompt tersembunyi.
3. Tes summon/dismiss race:
   - Ctrl+Alt+5;
   - tahan tombol 5 sekitar 1,5 detik saat window fokus;
   - hide saat summon;
   - summon saat dismiss.
4. Tes tray:
   - "Tampilkan HumanALE God Engine" hanya show;
   - "Panggil ALE" melakukan summon;
   - "Sembunyikan" benar-benar hide.
5. Tes ukuran 420–540 px, click-through, panel zoom/transparansi, dan posisi tersimpan.
6. Tes visual kepala/telinga dan slow-motion particle pada desktop nyata.
7. Tes TTS/STT Indonesia dengan hardware nyata; catat fallback yang dipakai.
8. Jika menemukan bug, lakukan perubahan sekecil mungkin dan tambahkan regression test.

## Batas kerja
- Jangan merge ke `main`.
- Jangan push/publish otomatis.
- Jangan mengubah kredensial/API key.
- Jangan memperluas izin agent atau menambahkan global single-key logger.
- Pertahankan Electron sandbox, context isolation, dan no nodeIntegration.
- Jangan klaim hardware/mikrofon/Copilot benar-benar lolos sebelum dites di PC.

Jika semua pengujian lokal lolos, laporkan: langkah yang diuji, hasil tiap langkah, bug yang ditemukan, file yang diubah, dan command verifikasi yang dijalankan.
