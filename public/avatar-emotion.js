export const emotions=['neutral','happy','angry','annoyed','sad'];

export function emotionFromText(value){
 const text=String(value||'').toLocaleLowerCase('id-ID');
 if(/\b(sedih|berduka|menangis|kehilangan|kecewa)\b/u.test(text))return 'sad';
 if(/\b(marah|geram|murka|benci)\b/u.test(text))return 'angry';
 if(/\b(kesal|jengkel|sebal|menyebalkan)\b/u.test(text))return 'annoyed';
 if(/\b(senang|bahagia|gembira|hebat|mantap|selamat|terima kasih)\b/u.test(text))return 'happy';
 return 'neutral';
}
