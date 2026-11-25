import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewPrimePageMedia} from '../scripts/prime-manual-cutover-gate.mjs';
const fresh=()=>JSON.parse(readFileSync(new URL('../config/prime-selected-media.json',import.meta.url),'utf8'));
test('Prime page media is scoped and fail-closed',()=>{
 assert.equal(reviewPrimePageMedia(fresh()),true);
 for(const mutate of [
  m=>m.prime_page_assets.pop(),
  m=>m.prime_page_assets[1]=m.prime_page_assets[0],
  m=>m.prime_page_assets[0].sha256='invalid',
  m=>m.prime_page_assets[0].claim='owner-declared',
  m=>m.prime_page_assets[5].source='https://example.org/',
  m=>m.prime_page_assets[5].verification='individual-source-pending'
 ]){const m=fresh();mutate(m);assert.equal(reviewPrimePageMedia(m),false);}
});
