/* Educational data: the Solar System (rounded values, source: NASA Planetary Fact Sheet) */
window.SUN = {
  id: 'sun', name: 'The Sun',
  diameter: '1,392,700 km', distance: '—', year: '≈ 230 million years around the Milky Way',
  day: '≈ 25 days (at the equator)', temp: '≈ 5,500 °C at the surface', moons: '—',
  fact: 'The Sun holds 99.86% of all the mass in the Solar System. More than a million Earths could fit inside it.'
};

/* orbit/size = VISUAL values (compressed so everything fits the scene); the rest are real values */
window.PLANETS = [
  { id: 'mercury', name: 'Mercury', type: 'rocky', color: '#8f8b86', seed: 3,
    blobs: { colors: ['#6b6762', '#b0aca6'], n: 90, rmin: 2, rmax: 9, alpha: 0.55 },
    orbit: 0.30, size: 0.028, period: 0.2408, spin: 0.4,
    diameter: '4,879 km', distance: '57.9 million km', year: '88 days', day: '59 Earth days',
    temp: '−180 … 430 °C', moons: '0',
    fact: 'The smallest planet and the closest to the Sun. It has almost no atmosphere, so temperatures swing wildly between day and night.' },

  { id: 'venus', name: 'Venus', type: 'rocky', color: '#d9b36c', seed: 5,
    blobs: { colors: ['#e8cf94', '#c79a4f', '#f1e2b8'], n: 70, rmin: 10, rmax: 30, alpha: 0.4 },
    orbit: 0.40, size: 0.045, period: 0.6152, spin: -0.2,
    diameter: '12,104 km', distance: '108.2 million km', year: '225 days', day: '243 Earth days (retrograde)',
    temp: '≈ 464 °C', moons: '0',
    fact: 'The hottest planet, thanks to a runaway greenhouse effect. A day on Venus lasts longer than its year!' },

  { id: 'earth', name: 'Earth', type: 'rocky', color: '#2c6fc4', seed: 8,
    blobs: { colors: ['#3f8a45', '#4f9a4e', '#8a7a4a'], n: 38, rmin: 8, rmax: 26, alpha: 1 },
    clouds: true, caps: true,
    orbit: 0.50, size: 0.048, period: 1.0, spin: 3,
    diameter: '12,742 km', distance: '149.6 million km', year: '365.25 days', day: '24 hours',
    temp: '≈ 15 °C (average)', moons: '1 (the Moon)',
    fact: 'The only known planet with life and liquid water on its surface. About 71% of it is covered by oceans.' },

  { id: 'mars', name: 'Mars', type: 'rocky', color: '#b5502f', seed: 11,
    blobs: { colors: ['#8a3a22', '#c8693f', '#6e2e1c'], n: 60, rmin: 6, rmax: 22, alpha: 0.6 },
    caps: true,
    orbit: 0.60, size: 0.035, period: 1.8808, spin: 2.9,
    diameter: '6,779 km', distance: '227.9 million km', year: '687 days', day: '24 h 37 min',
    temp: '≈ −65 °C', moons: '2 (Phobos, Deimos)',
    fact: 'The Red Planet gets its color from iron oxide (rust) in its soil. It hosts Olympus Mons, the tallest volcano in the Solar System (~22 km).' },

  { id: 'jupiter', name: 'Jupiter', type: 'gas', color: '#c9a37b', seed: 14,
    bands: ['#d9b48c', '#b88a62', '#e6cfb0', '#a9744f', '#c9a37b'],
    spot: { x: 0.62, y: 0.62, rx: 20, ry: 11, color: '#b5482f' },
    orbit: 0.72, size: 0.11, period: 11.862, spin: 6,
    diameter: '139,820 km', distance: '778.5 million km', year: '11.86 years', day: '9 h 56 min',
    temp: '≈ −110 °C', moons: '90+',
    fact: 'The biggest planet: over 1,300 Earths would fit inside. The Great Red Spot is a giant storm that has raged for hundreds of years.' },

  { id: 'saturn', name: 'Saturn', type: 'gas', color: '#dcc58f', seed: 17, rings: true,
    bands: ['#e3cf9d', '#cdb77f', '#efe0b8', '#bfa86f'],
    orbit: 0.88, size: 0.095, period: 29.457, spin: 5.5,
    diameter: '116,460 km', distance: '1,434 million km', year: '29.5 years', day: '10 h 33 min',
    temp: '≈ −140 °C', moons: '270+',
    fact: 'It has the most spectacular rings, made of ice and rock. Saturn is less dense than water: it would float in an imaginary ocean!' },

  { id: 'uranus', name: 'Uranus', type: 'gas', color: '#8fd3d9', seed: 20,
    bands: ['#8fd3d9', '#9adde2', '#86c9d0'], rings: 'thin',
    orbit: 1.00, size: 0.065, period: 84.02, spin: -3,
    diameter: '50,724 km', distance: '2,871 million km', year: '84 years', day: '17 h 14 min (retrograde)',
    temp: '≈ −195 °C', moons: '28',
    fact: 'It rotates on its side: its axis is tilted by almost 98°, so each pole gets sunlight for decades at a time.' },

  { id: 'neptune', name: 'Neptune', type: 'gas', color: '#3f63d6', seed: 23,
    bands: ['#3f63d6', '#4a72e6', '#3556c0'],
    spot: { x: 0.35, y: 0.45, rx: 14, ry: 8, color: '#27389a' },
    orbit: 1.12, size: 0.063, period: 164.8, spin: 3.2,
    diameter: '49,244 km', distance: '4,495 million km', year: '164.8 years', day: '16 h 6 min',
    temp: '≈ −200 °C', moons: '16',
    fact: 'The farthest planet. It has the strongest winds in the Solar System, over 2,000 km/h. It was found through mathematics before anyone saw it.' }
];

/* Quiz questions: the answer is the id of the planet you must tap in AR */
window.QUIZ = [
  { q: 'Which is the largest planet in the Solar System?', a: 'jupiter' },
  { q: 'Which planet is closest to the Sun?', a: 'mercury' },
  { q: 'Which planet is known as the “Red Planet”?', a: 'mars' },
  { q: 'Which planet do we live on?', a: 'earth' },
  { q: 'Which planet has the most spectacular rings?', a: 'saturn' },
  { q: 'Which is the hottest planet (≈ 464 °C)?', a: 'venus' },
  { q: 'Which planet spins “on its side” (axis tilted ~98°)?', a: 'uranus' },
  { q: 'Which planet is farthest from the Sun?', a: 'neptune' },
  { q: 'Which planet has the Great Red Spot, a giant storm?', a: 'jupiter' },
  { q: 'Which is the smallest planet?', a: 'mercury' },
  { q: 'On which planet does a day last longer than a year?', a: 'venus' },
  { q: 'Which planet has Olympus Mons, the tallest volcano?', a: 'mars' },
  { q: 'Which planet has winds of over 2,000 km/h?', a: 'neptune' },
  { q: 'Which planet has the most known moons?', a: 'saturn' },
  { q: 'Which planet has a 365-day year and a single Moon?', a: 'earth' }
];

/* “Did you know…” facts shown at the end of the game */
window.FACTS = [
  'Sunlight takes about 8 minutes and 20 seconds to reach Earth.',
  'The asteroid belt between Mars and Jupiter holds millions of objects, yet their total mass is less than the Moon’s.',
  'Astronauts’ footprints on the Moon can last millions of years, because there is no wind.',
  'A year on Mercury lasts only 88 Earth days.',
  'Jupiter acts like a “shield”: its gravity deflects many comets and asteroids.',
  'The asteroid that hit Earth ~66 million years ago helped end the age of the dinosaurs.',
  'NASA successfully deflected an asteroid (the DART mission, 2022) — the first planetary-defense test.'
];
