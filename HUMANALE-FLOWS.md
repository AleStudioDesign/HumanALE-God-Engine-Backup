# Alur HumanALE god egine yang Disatukan

Repository ini menyatukan dua riwayat HumanALE god egine tanpa menimpa salah satunya.

## Alur aktif

Branch `codex/unify-dudidam-flows-20260921` adalah alur gabungan berbasis HumanALE god egine 2.2.0. Alur ini mempertahankan desktop avatar dan panel terpisah, ChatGPT melalui login Codex, GitHub Copilot dan provider tambahan, Developer Agent Hub, ALE wake yang harus diaktifkan pengguna, animasi partikel-only terbaru, dikte lokal, serta suara balasan Piper Bahasa Indonesia.

## Alur warisan

Branch `legacy/binary-assistant-v2` mempertahankan proyek `binary-assistant` sebagai snapshot lengkap. Alur ini memakai avatar/popup yang lebih sederhana, bridge ChatGPT lokal melalui Codex CLI, dan fallback suara native Windows. Branch ini tetap dapat dibangun dan diuji secara mandiri; isinya tidak disalin paksa di atas alur aktif.

## Hubungan riwayat

Commit merge penyatuan mempunyai kedua riwayat sebagai parent. Merge memakai strategi `ours` hanya pada titik penghubung riwayat, setelah fitur yang masih relevan sudah dipadukan ke alur aktif. Karena itu:

- commit dan source alur warisan tetap dapat ditelusuri;
- commit GitHub terbaru tetap utuh;
- branch aktif tidak diganti oleh snapshot lama;
- tidak ada force-push atau penulisan ulang riwayat.

## Aturan pengembangan berikutnya

1. Kembangkan aplikasi utama dari branch gabungan atau branch turunannya.
2. Gunakan `legacy/binary-assistant-v2` sebagai referensi perilaku dan pemulihan, bukan sebagai folder yang disalin seluruhnya ke aplikasi utama.
3. Pindahkan fitur lama secara terarah per fungsi atau commit, lalu selesaikan konflik berdasarkan perilaku yang diinginkan.
4. Jalankan `npm run verify` setelah setiap integrasi, kemudian `npm run package:desktop` untuk memverifikasi paket Windows.
5. Jangan memakai force-push pada branch `main`, `codex/entitasale170925`, branch gabungan, atau branch warisan.
