// SOLMAR — random.js
// Seeded random helpers. One seed reproduces the same city, the same traffic
// colours and the same pedestrian outfits, which is what makes the staged
// screenshots deterministic: ?seed=1 always builds the same Solmar.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.next = mulberry32(this.seed);
  }
  // Float in [0, 1).
  float() {
    return this.next();
  }
  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }
  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  // One element of an array.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  // True with the given probability.
  chance(p) {
    return this.next() < p;
  }
  // A pastel-ish colour as a hex number, for buildings and cars.
  colour(palette) {
    return this.pick(palette);
  }
}

// A small shared palette of sun-soaked colours for the city.
export const PALETTE = {
  buildings: [0xe8b48a, 0xd9a066, 0xc98d7a, 0xa8b8c4, 0x8fa8b8, 0xe0cfa8, 0xb8a88f, 0x9fb8a0, 0xd8b8c0, 0x7fa0b8],
  cars: [0xc0392b, 0x2e6fb0, 0xe8c832, 0x2e8b57, 0xe8e8e8, 0x222831, 0xd35400, 0x8e44ad, 0x16a085, 0xb03a5b],
  clothes: [0xdd5555, 0x5588dd, 0x55aa66, 0xddaa33, 0xaa66cc, 0xdddddd, 0x333333, 0xcc8844, 0x44bbbb, 0x996633],
};
