import test from 'node:test';
import assert from 'node:assert/strict';
import {containsAleWakeWord,HOLD_TO_SUMMON_MS} from '../public/wake-utils.js';

test('ALE wake word matches a standalone call',()=>{
 assert.equal(containsAleWakeWord('ALE'),true);
 assert.equal(containsAleWakeWord('hai ALE tolong dengar'),true);
 assert.equal(containsAleWakeWord('ale, buka percakapan'),true);
});

test('ALE wake word does not trigger inside another word',()=>{
 assert.equal(containsAleWakeWord('sale'),false);
 assert.equal(containsAleWakeWord('palette'),false);
 assert.equal(containsAleWakeWord(''),false);
});

test('hold-to-summon delay stays intentional',()=>{
 assert.equal(HOLD_TO_SUMMON_MS,1500);
});
