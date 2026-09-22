import { describe, expect, it } from 'vitest';
import flyers from './imported-flyers.json';
describe('demo media isolation',()=>{it('ships no imported client flyers',()=>expect(flyers).toEqual({}));});
