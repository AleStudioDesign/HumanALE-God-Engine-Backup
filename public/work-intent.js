export function isExplicitProjectWorkRequest(text=''){
 const value=String(text).toLowerCase().replace(/\s+/g,' ').trim();
 return /^(?:ok[,. ]+)?(?:(?:tolong|bantu|coba)\s+)?(?:kerjakan(?:\s+langsung)?|lakukan(?:\s+(?:sekarang|langsung))?|perbaiki(?:\s+(?:kode|proyek|project|avatar|fitur))?|ubah(?:\s+(?:kode|proyek|project|avatar|fitur))|implementasikan|terapkan(?:\s+(?:perubahan|perbaikan|ini))?|lanjutkan\s+(?:proyek|project|tugas|pekerjaan)|edit\s+(?:kode|proyek|project|file))\b/.test(value);
}
