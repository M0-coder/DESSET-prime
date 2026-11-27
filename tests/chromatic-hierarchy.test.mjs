import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const system = read('styles-system.css');
const hero = read('styles-hero-editorial.css');
const service = read('styles-service-video.css');
const token = name => {
  const match = system.match(new RegExp(name + ':\\s*(#[0-9a-fA-F]{6})\\s*;'));
  assert.ok(match, 'Missing color token ' + name);
  return match[1];
};
const luminance = hex => {
  const channels = hex.slice(1).match(/../g).map(c => parseInt(c,16)/255)
    .map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return .2126*channels[0] + .7152*channels[1] + .0722*channels[2];
};
const contrast = (a,b) => {
  const [lo,hi] = [luminance(a),luminance(b)].sort((x,y)=>x-y);
  return (hi+.05)/(lo+.05);
};
test('chromatic hierarchy retains accessible brand combinations', () => {
  const paper = token('--ds-60-paper'), surface = token('--ds-60-surface');
  const ink = token('--ds-30-ink'), blue = token('--ds-accent-blue');
  assert.equal(blue.toUpperCase(), '#073BBC');
  assert.equal(ink.toUpperCase(), '#000000');
  for (const background of [paper,surface]) {
    assert.ok(contrast(ink,background) >= 4.5);
    assert.ok(contrast(blue,background) >= 4.5);
  }
  assert.ok(contrast('#FFFFFF',blue) >= 4.5);
  assert.match(system,/--ds-30-blue:var\(--ds-accent-blue\)/);
});
test('hero retains neutral rail, localized gold and keyboard contrast', () => {
  assert.match(hero,/#inicio \.v4-hero-rail\{[^}]*background:var\(--ds-60-surface\);border-top:3px solid var\(--ds-10-gold\)/);
  assert.match(hero,/\.nav-expand:focus-visible\{outline:2px solid #fff/);
  const header = hero.match(/background:linear-gradient\(180deg,rgba\(0,0,0,([.\d]+)\),rgba\(0,0,0,([.\d]+)\)\)/);
  assert.ok(header,'Missing header scrim');
  const gray = Math.ceil(255*(1-Math.min(Number(header[1]),Number(header[2])))).toString(16).padStart(2,'0');
  assert.ok(contrast('#FFFFFF','#'+gray.repeat(3))>=4.5,'White text against worst-case white video frame');
});
test('video CTA focus has light and dark rings', () => {
  assert.match(service,/a:focus-visible\{outline:3px solid #fff;outline-offset:4px;box-shadow:0 0 0 4px #073bbc,0 0 0 9px #000\}/);
});
