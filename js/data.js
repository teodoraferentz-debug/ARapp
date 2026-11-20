/* Date educaționale: Sistemul Solar (valori rotunjite, surse: NASA Planetary Fact Sheet) */
window.SUN = {
  id: 'soare', name: 'Soarele',
  diameter: '1.392.700 km', distance: '—', year: '≈ 230 mil. ani în jurul Căii Lactee',
  day: '≈ 25 zile (la ecuator)', temp: '≈ 5.500 °C la suprafață', moons: '—',
  fact: 'Soarele conține 99,86% din masa Sistemului Solar. În el ar încăpea peste un milion de Pământuri.'
};

/* orbit/size = valori VIZUALE (comprimate ca să încapă în scenă), restul = valori reale */
window.PLANETS = [
  { id: 'mercur', name: 'Mercur', type: 'rocky', color: '#8f8b86', seed: 3,
    blobs: { colors: ['#6b6762', '#b0aca6'], n: 90, rmin: 2, rmax: 9, alpha: 0.55 },
    orbit: 0.30, size: 0.028, period: 0.2408, spin: 0.4,
    diameter: '4.879 km', distance: '57,9 mil. km', year: '88 zile', day: '59 zile terestre',
    temp: '−180 … 430 °C', moons: '0',
    fact: 'Cea mai mică planetă și cea mai apropiată de Soare. Nu are atmosferă, așa că temperaturile variază enorm între zi și noapte.' },

  { id: 'venus', name: 'Venus', type: 'rocky', color: '#d9b36c', seed: 5,
    blobs: { colors: ['#e8cf94', '#c79a4f', '#f1e2b8'], n: 70, rmin: 10, rmax: 30, alpha: 0.4 },
    orbit: 0.40, size: 0.045, period: 0.6152, spin: -0.2,
    diameter: '12.104 km', distance: '108,2 mil. km', year: '225 zile', day: '243 zile terestre (retrograd)',
    temp: '≈ 464 °C', moons: '0',
    fact: 'Cea mai fierbinte planetă din sistem, din cauza efectului de seră. O zi pe Venus durează mai mult decât un an al ei!' },

  { id: 'pamant', name: 'Pământ', type: 'rocky', color: '#2c6fc4', seed: 8,
    blobs: { colors: ['#3f8a45', '#4f9a4e', '#8a7a4a'], n: 38, rmin: 8, rmax: 26, alpha: 1 },
    clouds: true, caps: true,
    orbit: 0.50, size: 0.048, period: 1.0, spin: 3,
    diameter: '12.742 km', distance: '149,6 mil. km', year: '365,25 zile', day: '24 ore',
    temp: '≈ 15 °C (medie)', moons: '1 (Luna)',
    fact: 'Singura planetă cunoscută care are viață și apă lichidă la suprafață. Aproximativ 71% din suprafața ei este acoperită de oceane.' },

  { id: 'marte', name: 'Marte', type: 'rocky', color: '#b5502f', seed: 11,
    blobs: { colors: ['#8a3a22', '#c8693f', '#6e2e1c'], n: 60, rmin: 6, rmax: 22, alpha: 0.6 },
    caps: true,
    orbit: 0.60, size: 0.035, period: 1.8808, spin: 2.9,
    diameter: '6.779 km', distance: '227,9 mil. km', year: '687 zile', day: '24 h 37 min',
    temp: '≈ −65 °C', moons: '2 (Phobos, Deimos)',
    fact: 'Planeta Roșie datorează culoarea oxidului de fier din sol. Găzduiește Olympus Mons, cel mai înalt vulcan din Sistemul Solar (~22 km).' },

  { id: 'jupiter', name: 'Jupiter', type: 'gas', color: '#c9a37b', seed: 14,
    bands: ['#d9b48c', '#b88a62', '#e6cfb0', '#a9744f', '#c9a37b'],
    spot: { x: 0.62, y: 0.62, rx: 20, ry: 11, color: '#b5482f' },
    orbit: 0.72, size: 0.11, period: 11.862, spin: 6,
    diameter: '139.820 km', distance: '778,5 mil. km', year: '11,86 ani', day: '9 h 56 min',
    temp: '≈ −110 °C', moons: 'peste 90',
    fact: 'Cea mai mare planetă: ar încăpea în ea peste 1.300 de Pământuri. Marea Pată Roșie este o furtună uriașă care durează de sute de ani.' },

  { id: 'saturn', name: 'Saturn', type: 'gas', color: '#dcc58f', seed: 17, rings: true,
    bands: ['#e3cf9d', '#cdb77f', '#efe0b8', '#bfa86f'],
    orbit: 0.88, size: 0.095, period: 29.457, spin: 5.5,
    diameter: '116.460 km', distance: '1.434 mil. km', year: '29,5 ani', day: '10 h 33 min',
    temp: '≈ −140 °C', moons: 'peste 270',
    fact: 'Are cele mai spectaculoase inele, făcute din gheață și rocă. Densitatea sa medie e mai mică decât a apei: ar pluti într-un ocean imaginar!' },

  { id: 'uranus', name: 'Uranus', type: 'gas', color: '#8fd3d9', seed: 20,
    bands: ['#8fd3d9', '#9adde2', '#86c9d0'], rings: 'thin', ringTilt: true,
    orbit: 1.00, size: 0.065, period: 84.02, spin: -3,
    diameter: '50.724 km', distance: '2.871 mil. km', year: '84 ani', day: '17 h 14 min (retrograd)',
    temp: '≈ −195 °C', moons: '28',
    fact: 'Se rotește „pe o parte”: axa ei este înclinată la aproape 98°, așa că polii ei primesc Soare ani la rând.' },

  { id: 'neptun', name: 'Neptun', type: 'gas', color: '#3f63d6', seed: 23,
    bands: ['#3f63d6', '#4a72e6', '#3556c0'],
    spot: { x: 0.35, y: 0.45, rx: 14, ry: 8, color: '#27389a' },
    orbit: 1.12, size: 0.063, period: 164.8, spin: 3.2,
    diameter: '49.244 km', distance: '4.495 mil. km', year: '164,8 ani', day: '16 h 6 min',
    temp: '≈ −200 °C', moons: '16',
    fact: 'Cea mai îndepărtată planetă. Are cele mai puternice vânturi din sistem, de peste 2.000 km/h. A fost descoperită prin calcule matematice, înainte să fie văzută.' }
];

/* Întrebări quiz: răspunsul = id-ul planetei pe care trebuie să o atingi în AR */
window.QUIZ = [
  { q: 'Care este cea mai mare planetă din Sistemul Solar?', a: 'jupiter' },
  { q: 'Care planetă este cea mai apropiată de Soare?', a: 'mercur' },
  { q: 'Care planetă este cunoscută drept „Planeta Roșie”?', a: 'marte' },
  { q: 'Pe ce planetă locuim?', a: 'pamant' },
  { q: 'Care planetă are cele mai spectaculoase inele?', a: 'saturn' },
  { q: 'Care este cea mai fierbinte planetă (≈ 464 °C)?', a: 'venus' },
  { q: 'Care planetă se rotește „pe o parte” (axă înclinată la ~98°)?', a: 'uranus' },
  { q: 'Care este cea mai îndepărtată planetă de Soare?', a: 'neptun' },
  { q: 'Pe care planetă se află Marea Pată Roșie, o furtună uriașă?', a: 'jupiter' },
  { q: 'Care este cea mai mică planetă?', a: 'mercur' },
  { q: 'Pe care planetă o zi durează mai mult decât un an?', a: 'venus' },
  { q: 'Pe care planetă se află Olympus Mons, cel mai înalt vulcan?', a: 'marte' },
  { q: 'Care planetă are vânturi de peste 2.000 km/h?', a: 'neptun' },
  { q: 'Care planetă are cei mai mulți sateliți cunoscuți?', a: 'saturn' },
  { q: 'Care planetă are un an de 365 de zile și o singură Lună?', a: 'pamant' }
];

/* „Știai că…” afișate la finalul jocului */
window.FACTS = [
  'Lumina Soarelui ajunge la Pământ în aproximativ 8 minute și 20 de secunde.',
  'Centura de asteroizi dintre Marte și Jupiter conține milioane de corpuri, dar masa lor totală e mai mică decât a Lunii.',
  'Pe Lună, urmele de pași ale astronauților pot dura milioane de ani, pentru că nu există vânt.',
  'Un an pe Mercur are doar 88 de zile terestre.',
  'Jupiter acționează ca un „scut”: gravitația lui deviază multe comete și asteroizi.',
  'Asteroidul care a lovit Pământul acum ~66 de milioane de ani a contribuit la dispariția dinozaurilor.',
  'NASA a deviat cu succes un asteroid (misiunea DART, 2022) — prima apărare planetară testată.'
];
