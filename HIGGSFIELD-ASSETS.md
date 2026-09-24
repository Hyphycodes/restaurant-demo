# Higgsfield asset brief — Casa Aurelia

The site's strength is interface design and directed motion. The one ceiling that design cannot raise is the photography: the current library is five licensed stock photographs, re-graded for the evening (`scripts/grade-night-media.ts`). They were shot in daylight and studio light. None of them shows people, the exterior, the city at night, or anything moving.

Eight assets would change that. Each one replaces a specific graded still or fills a specific gap. Nothing on this list is filler.

## House rules for every generation

- **Light:** practical light only. Candles, brass sconces and a warm bar back-light at about 2200–2700K. Deep shadows, no fill, no flash. Blacks should sit at the warm brown of `#120d0a`, never crushed to neutral.
- **Palette:** walnut, oxblood, candle amber, cream linen, subtle olive, polished brass. One restrained red per frame, from a Negroni, the wine or a napkin.
- **People:** real hospitality, not a campaign. No faces turned to the lens. Hands, shoulders, profiles and soft focus. Nobody should be recognisable.
- **Avoid:** neon, logos, visible text (Casa Aurelia is fictional and must not be signed), smoke machines, glossy commercial food styling, and the teal-and-orange grade.
- **Finish:** a light 35mm grain, gentle halation around flames, and a shallow depth of field (roughly f/1.8–2.8).
- **Video:** slow and continuous. Seamless loops where noted. No cuts, no speed ramps. Export a 1080p master plus a 720p web version and a still poster frame. Target size: under 4MB for a 10s web loop.

## Wiring an asset in

- **Registering it:** add the file under `public/media/`, then register it in `src/content/assets.ts`. Video uses `kind: 'video'` and needs a poster; `AssetVideo` renders the poster first.
- **Replacing an existing image:** reuse the existing semantic id, or change the id the component asks for. Every placement listed below names that id.
- **Verifying:** `npm run assets:check` confirms the dimensions, budgets and usage. The admin can also swap any registered image from **Look → Photos & videos**.

---

## 1. The room at eight o'clock — homepage hero

- **Page/section:** Homepage hero (`roomNight` / `roomNightTall`), and the face of the Behind the Hospitality split.
- **Type:** video loop plus poster still. Make two renders: 16:9 for desktop and 9:16 for mobile.
- **Duration:** 10s, seamless loop.
- **Framing:** a low, table-height view across three candlelit two-tops toward a long banquette. A guest's hand and wine glass fill the soft foreground on the left. The title sits in the lower-left third, so keep that area dark and uncluttered.
- **Camera:** a very slow dolly-in, about 30cm over the loop, with a barely perceptible drift right.
- **Lighting:** candles on every table and two brass wall sconces. The windows at the back are dark, with faint city bokeh.
- **Prompt:** `Cinematic interior of an intimate Italian supper club in Chicago at night, low table-height camera slowly dollying across candlelit dark walnut tables toward a deep oxblood leather banquette, soft out-of-focus guests in profile, a hand resting beside a glass of red wine in the foreground, brass wall sconces, dark windows with faint city bokeh, warm 2400K candlelight, deep brown shadows, no faces toward camera, no text or signage, shallow depth of field, 35mm film grain, gentle halation, elegant and mysterious, seamless loop`

## 2. The green door — Visit hero and footer

- **Page/section:** Visit hero. It replaces the interior photograph and gives the "green door, mid-block" copy something to point at.
- **Type:** a still, plus an optional 6s video loop.
- **Aspect ratio:** 16:9, plus a 4:5 crop for mobile.
- **Framing:** a three-quarter view of a narrow, deep-green lacquered door in a dark brick West Loop facade. A single brass sconce, wet pavement and a small unlit brass plate carry no readable text. Leave space on the right for copy.
- **Camera:** locked off. In the video, only the rain, the reflections and one passing car light move.
- **Lighting:** the sconce is the key light, with sodium streetlight spill and a wet reflection.
- **Prompt:** `Night exterior of an unmarked supper club entrance on a quiet West Loop Chicago street, narrow deep green lacquered door set in dark old brick, single warm brass wall sconce, wet pavement reflecting amber light, light drizzle, a car's headlights slowly passing and sweeping across the brick, no readable signage or text, cinematic, moody, 35mm film look, shallow depth of field, locked-off camera`

## 3. The martini, stirred cold — the Listening Room

- **Page/section:** the "9:30 pm — The Listening Room" chapter in the evening sequence (`barNight`), and the Il Bar course photograph on the menu.
- **Type:** video loop plus poster.
- **Aspect ratio:** 4:5.
- **Duration:** 6s, seamless loop.
- **Framing:** a tight shot of a bartender's hands stirring a mixing glass with a long bar spoon. A chilled coupe waits beside it and back-bar bottles glow out of focus. Show the forearms and the rolled cuffs of a white shirt only.
- **Camera:** a slow push-in, about 10cm.
- **Lighting:** amber back-bar glow as rim light, with a small pool of light on the bar top.
- **Prompt:** `Macro close-up of a bartender's hands stirring a martini in a crystal mixing glass with a long bar spoon, rolled white shirt cuffs, a chilled coupe glass waiting on a dark walnut bar, back-bar bottles glowing amber and out of focus, condensation on the glass, warm rim light, deep shadows, slow push-in, no faces, no labels or text, cinematic 35mm grain, seamless loop`

## 4. Parmesan snow — dinner

- **Page/section:** the "7:30 pm — Dinner" chapter (`pastaNight`), the menu hero, and the homepage kitchen composition.
- **Type:** video loop plus poster.
- **Aspect ratio:** 4:5.
- **Duration:** 6s.
- **Framing:** a 45° overhead of rigatoni in vodka sauce in a warm ceramic bowl. Parmigiano is grated over it from above, and a hand holds the grater in the top corner. Linen and a candle sit at the edge of frame.
- **Camera:** locked off, or a 2° slow rotation.
- **Lighting:** candle key from the upper left, with a soft warm bounce off the linen.
- **Prompt:** `45 degree overhead shot of spicy rigatoni in a glossy vodka tomato cream sauce in a warm handmade ceramic bowl on a dark walnut table, fine parmigiano falling like snow from a grater held by a hand at the top of frame, cream linen napkin and a candle flame at the edge, warm candlelight key, rich shadows, steam rising gently, shallow depth of field, editorial food film, no text, 35mm grain`

## 5. The Negroni hour — aperitivo

- **Page/section:** the "5:00 pm — Aperitivo" chapter and the menu's cocktails course. It replaces `negroniPaper`, which was shot on a bright studio background.
- **Type:** still.
- **Aspect ratio:** 4:5.
- **Framing:** a Negroni over a single clear ice cube on a marble bar edge, with an orange peel expressed over the glass and a mist of oil catching the light. Windows behind show the last blue light of dusk.
- **Lighting:** late dusk from the window mixed with the first candle. This is the only frame on the site that should be cool at the edges.
- **Prompt:** `A Negroni in a heavy rocks glass over one large clear ice cube on the edge of a white marble bar, a hand expressing an orange peel over the glass with a fine mist of citrus oil catching warm light, soft blue dusk light from tall windows behind, first candle lit beside the glass, rich ruby color, elegant, cinematic still, shallow depth of field, 35mm film grain, no text or labels`

## 6. Arriving — private dining

- **Page/section:** the Private Dining hero (`roomNight`), and the Rooms section on the homepage.
- **Type:** video loop plus poster.
- **Aspect ratio:** 16:9.
- **Duration:** 8s.
- **Framing:** a long private table set for twenty, with candles down its length. Guests are arriving at the far end: coats come off, glasses are handed over and silhouettes greet each other. The near end of the table is empty and waiting.
- **Camera:** a very slow track along the table toward the arrivals.
- **Lighting:** candle rows, plus warm light spilling from a doorway at the back.
- **Prompt:** `Long private dining table in a dark wood-paneled back room set for twenty with linen, wine glasses and a row of candles down its length, guests arriving at the far end in soft focus taking off coats and greeting each other, warm light spilling from a doorway behind them, slow tracking shot along the table, no faces toward camera, candlelight, deep shadows, intimate celebration, cinematic 35mm grain, no text`

## 7. Needle drop — events

- **Page/section:** the Events hero (`barNight`), the event poster wall background, and the signage brand slide.
- **Type:** video loop plus poster.
- **Aspect ratio:** 16:9.
- **Duration:** 8s.
- **Framing:** a close-up of a turntable tone arm lowering onto a spinning record. A vermouth glass stands on the cabinet and a dim room of listening guests is out of focus behind.
- **Camera:** locked off, with a very subtle focus pull from the needle to the room.
- **Lighting:** one small lamp on the record cabinet, with candles behind.
- **Prompt:** `Close-up of a vintage turntable tone arm slowly lowering onto a spinning black vinyl record, a glass of vermouth with an orange twist on the walnut record cabinet, a dim candlelit listening room with seated guests softly out of focus behind, warm lamp light, slow focus pull from needle to room, intimate late-night atmosphere, 35mm film grain, no text or labels, seamless loop`

## 8. The city after dinner — Behind the Hospitality

- **Page/section:** the stage behind the Behind the Hospitality sequence, and the footer. It gives the operating room a Chicago horizon.
- **Type:** video loop.
- **Aspect ratio:** 21:9.
- **Duration:** 12s.
- **Framing:** an elevated L track at night crossing a West Loop street. A train passes slowly across frame, its lit windows streaking, with the wet street below and warm restaurant windows at street level.
- **Camera:** locked off from the level of a second-storey window across the street.
- **Lighting:** sodium streetlight, the train's interior light, and warm window glow. The frame should read dark overall.
- **Prompt:** `Wide cinematic night shot of an elevated train crossing above a quiet West Loop Chicago street, lit train windows passing slowly across frame, wet street reflecting sodium lights, warm glowing restaurant windows at street level, light mist, locked-off camera from a second floor window across the street, dark moody palette of warm amber and deep brown, 35mm film grain, no readable signs or text, seamless loop`

---

**Order of work if budget is limited:** 1 (the hero changes the first impression), then 4 and 3 (appetite and the bar), then 2 (Visit and trust). The other four add depth but nothing is broken without them.
