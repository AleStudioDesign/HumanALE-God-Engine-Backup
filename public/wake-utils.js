export const HOLD_TO_SUMMON_MS=1500;

export function containsAleWakeWord(value=''){
 const text=String(value).trim();
 return /(^|[\s,.;:!?])ale(?=$|[\s,.;:!?])/i.test(text);
}
