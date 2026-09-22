# Semantic media manifest

`src/content/assets.ts` is the canonical typed manifest for 22 optimized local assets. Each entry declares path, dimensions, aspect ratio, crop focus, alt text and a byte budget.

The package contains a wordmark and fictional entrance illustration; editorial dining-room, pasta, burrata, Negroni and bar-service photographs; and five original event illustrations. Additional responsive event crops live in `src/content/event-art-defaults.ts`.

See [media licensing and attribution](MEDIA.md). Run `npm run assets:check` after changing any file or registry entry.
