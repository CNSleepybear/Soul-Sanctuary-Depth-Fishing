// ===== src/renderer/ui/LocationIllustration.ts =====
// Original vector travel stamps for the field journal and destination picker.
// Kept in code so the illustrations remain crisp, offline and theme-aware.

import { LOCATIONS } from '../data/location-data';

export function locationIllustration(id: string): string {
  const location = LOCATIONS.find((entry) => entry.id === id);
  const art = location?.theme?.art;
  const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
  const foliage = hex(location?.theme?.island.grass ?? 0x7f9a62);
  const rock = hex(location?.theme?.island.stone ?? 0x8d9a93);
  const water = hex(location?.theme?.waterColor ?? 0x496f76);
  const accent = hex(art?.accent ?? 0xc4574f);
  const light = hex(art?.glow ?? 0xffcb8a);
  const ink = '#35424a';
  const paper = '#e6ddc8';
  const rect = (x: number, y: number, w: number, h: number, color: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
  const polygon = (points: string, color: string) =>
    `<polygon points="${points}" fill="${color}"/>`;
  const window = (x: number, y: number) => rect(x, y, 3, 4, light);
  const pine = (x: number, y: number, size = 1) =>
    `<g transform="translate(${x} ${y}) scale(${size})">${rect(-1, -3, 3, 13, '#8d7661')}${polygon('-12,3 0,-19 12,3', foliage)}${polygon('-9,-5 0,-25 9,-5', foliage)}${polygon('-6,-13 0,-30 6,-13', foliage)}</g>`;
  const house = (x: number, y: number, w: number, h: number, color: string) =>
    `${rect(x, y, w, h, color)}${polygon(`${x - 2},${y} ${x + w / 2},${y - 8} ${x + w + 2},${y}`, ink)}${window(x + 4, y + 7)}${window(x + w - 7, y + 7)}${rect(x + w / 2 - 2, y + h - 8, 4, 8, ink)}`;
  let landmark = '';
  switch (id) {
    case 'japan':
      landmark = `${rect(76, 34, 5, 35, accent)}${rect(106, 34, 5, 35, accent)}${rect(72, 39, 44, 4, accent)}${rect(69, 29, 50, 6, accent)}${rect(65, 26, 58, 4, ink)}${rect(91, 32, 5, 11, ink)}${rect(39, 41, 4, 28, '#947861')}${rect(23, 25, 34, 19, '#dcabb4')}${rect(30, 19, 24, 10, '#edc7c9')}${rect(17, 37, 25, 9, '#c58c9f')}`;
      break;
    case 'china':
      landmark = `${rect(73, 40, 5, 27, '#a49d7c')}${rect(107, 40, 5, 27, '#a49d7c')}${polygon('65,40 92,24 120,40', ink)}${rect(70, 40, 45, 4, accent)}${rect(86, 47, 14, 20, light)}${[30, 41, 51].map((x, i) => `${rect(x, 22 + i * 5, 3, 46 - i * 5, foliage)}${rect(x - 8, 29 + i * 5, 18, 3, foliage)}${rect(x - 4, 42, 16, 3, foliage)}`).join('')}`;
      break;
    case 'usa':
      landmark = [30, 55, 85, 108]
        .map(
          (x, i) =>
            `${rect(x, 24 + (i % 2) * 9, 20, 43 - (i % 2) * 9, ink)}${rect(x + 3, 26 + (i % 2) * 9, 3, 24, i % 2 ? '#d481be' : '#77c6cd')}${rect(x + 10, 49, 13, 3, '#e6b47b')}${window(x + 9, 38)}`,
        )
        .join('');
      break;
    case 'uk':
      landmark = `${rect(84, 25, 15, 43, '#a78c66')}${polygon('81,25 91,12 102,25', ink)}<circle cx="91.5" cy="33" r="5" fill="${paper}"/><path d="M91.5 29v4l3 1" stroke="${ink}" fill="none"/>${house(32, 44, 29, 24, '#887362')}${rect(64, 48, 10, 21, '#b86152')}${rect(66, 51, 6, 11, paper)}`;
      break;
    case 'france':
      landmark = `<path d="M96 16 81 68M96 16l15 52M84 56h24M89 41h15M92 29h9M96 10v8" stroke="${accent}" stroke-width="3.5" fill="none"/>${house(33, 46, 28, 22, '#b8a488')}${rect(28, 48, 38, 4, '#d1a47f')}${pine(124, 58, 0.65)}`;
      break;
    case 'germany':
      landmark = `${house(65, 42, 40, 26, '#b3a48b')}${polygon('61,42 85,23 110,42', paper)}${rect(71, 48, 6, 13, light)}${rect(94, 45, 4, 10, '#719287')}${pine(38, 58, 1.05)}${pine(122, 57, 0.9)}${rect(95, 23, 4, 10, ink)}`;
      break;
    case 'italy':
    case 'denmark':
      landmark = [33, 56, 79, 102]
        .map((x, i) =>
          house(
            x,
            37 - (i % 2) * 7,
            20,
            30 + (i % 2) * 7,
            ['#c58a63', '#c6ab76', '#b77169', '#91aaa7'][i],
          ),
        )
        .join('');
      landmark += `<path d="M98 78h29l-6 5h-18Z" fill="${ink}"/><path d="M111 76V49l13 23h-13" stroke="${paper}" fill="${paper}"/>`;
      break;
    case 'iceland':
      landmark = `<path d="m22 28 24-9 24 4 25-8 28 9" fill="none" stroke="#80bfa5" stroke-width="6" opacity=".4"/>${house(63, 42, 38, 27, ink)}${rect(76, 30, 12, 38, ink)}${polygon('73,30 82,18 91,30', ink)}${rect(79, 47, 6, 13, paper)}${rect(41, 68, 25, 4, '#c9dcd6')}`;
      break;
    case 'thailand':
      landmark = `${rect(57, 60, 59, 8, accent)}${rect(65, 48, 43, 13, paper)}${polygon('57,48 86,30 116,48', accent)}${polygon('64,35 86,19 109,35', accent)}${rect(84, 12, 4, 10, light)}${window(84, 53)}${pine(34, 58, 0.8)}`;
      break;
    case 'egypt':
      landmark = `${polygon('37,69 68,24 100,69', '#c69c64')}${polygon('68,24 68,69 100,69', '#a27e56')}${polygon('84,69 108,36 133,69', '#dfbd83')}${rect(24, 45, 4, 24, '#8c785c')}${polygon('13,44 26,36 39,44', foliage)}${rect(113, 47, 5, 22, accent)}${rect(111, 45, 9, 4, light)}`;
      break;
    default:
      landmark = `${house(37, 47, 27, 22, paper)}${rect(76, 40, 28, 29, paper)}<path d="M76 40a14 14 0 0 1 28 0Z" fill="#6b9cb7"/>${rect(88, 50, 5, 10, '#7298aa')}${rect(113, 34, 11, 35, paper)}${polygon('111,34 118,25 126,34', '#6b9cb7')}${rect(119, 22, 2, 7, paper)}`;
  }
  return `<svg class="location-illustration" viewBox="0 0 160 96" fill="none" aria-hidden="true" focusable="false"><ellipse cx="80" cy="78" rx="65" ry="13" fill="${water}" opacity=".55"/>${polygon('23,65 79,51 138,65 137,75 80,89 23,75', rock)}${polygon('23,65 79,51 138,65 80,81', foliage)}<g stroke-linejoin="round">${landmark}</g><path d="M24 81h17m73 3h16M49 87h17" stroke="${paper}" stroke-width="1" opacity=".6"/><circle cx="127" cy="19" r="6" fill="${light}" opacity=".65"/></svg>`;
}
