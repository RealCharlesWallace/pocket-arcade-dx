import type { GameCartridge } from '../core/types';
import { linksQuestCartridge } from './links-quest';
import { pocketBrawlCartridge } from './pocket-brawl';
import { pocketMonstersCartridge } from './pocket-monsters';
import { romLoaderCartridge } from './rom-loader';
import { streetRacerCartridge } from './street-racer';
import { superPixelLandCartridge } from './super-pixel-land';
import { tetrablockDxCartridge } from './tetrablock-dx';

/**
 * Central Cartridge Registry.
 *
 * HOW TO ADD A NEW GAME LATER:
 * 1. Create a folder in `src/games/<your-game>/index.ts` exporting a `GameCartridge` object.
 * 2. Import and append it to `CARTRIDGE_REGISTRY` below.
 * It will automatically appear in the 3D Game Boy's on-screen Carousel AND the Library Dialog!
 */
export const CARTRIDGE_REGISTRY: GameCartridge[] = [
  pocketMonstersCartridge,
  pocketBrawlCartridge,
  linksQuestCartridge,
  superPixelLandCartridge,
  tetrablockDxCartridge,
  streetRacerCartridge,
  romLoaderCartridge,
];
