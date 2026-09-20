export function parseCommand(text) {
 const s=text.toLowerCase().trim().replace(/[!?.,]/g,'');
 if (/^(tolong |coba |silakan )?(berkedip|kedip|blink)( dong| lagi)?$/.test(s)) return 'blink';
 if (/^(tolong |coba )?(mengangguk|angguk|nod)( dong| lagi)?$/.test(s)) return 'nod';
 if (/^(tolong |coba )?(menggeleng|geleng|gelengkan kepala|menggelengkan kepala)( dong| lagi)?$/.test(s)) return 'shake';
 if (/^(diam|stop|berhenti|hentikan suara)$/.test(s)) return 'stop';
 if (/^(jam berapa|sekarang jam berapa|pukul berapa)$/.test(s)) return 'time';
 if (/^(tanggal berapa|sekarang tanggal berapa|hari apa|hari ini hari apa)$/.test(s)) return 'date';
 if (/^(bantuan|help|apa yang bisa kamu lakukan|apa kemampuanmu)$/.test(s)) return 'help';
 if (/^(mode pet|tampilan pet)$/.test(s)) return 'pet';
 if (/^(halo|hai|hi|hello|halo dudidam|hai dudidam)$/.test(s)) return 'hello';
 return null;
}
