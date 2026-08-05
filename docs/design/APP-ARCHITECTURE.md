# App architecture — density levels, not screens

Working prototype: `app-density-prototype.html`. Open it on a phone.
Feed, heart something, hit Grid, heart more, hit Compare.

## The problem this solves

A TikTok-style feed is superb for one thing and useless for another. Renting is
not one task, it is four, and they want opposite interfaces:

| Phase | What the person is doing | What the interface must be |
|---|---|---|
| Wonder | "what can I even get in Marbella?" | one thing at a time, big, emotional |
| Gather | "these four look good" | frictionless collecting, without losing your place |
| Decide | "which of these four?" | aligned columns, comparable, unemotional |
| Commit | booking | linear, quiet, no surprises |

Every incumbent fails by shipping phase-3 tooling — a filter rail and a grid —
at phase 1, so browsing feels like filling in a form. A straight TikTok clone
fails the other way: it never gives you phase 3, so it feels great and sells
nothing.

## The answer: one space at three densities

Not three screens with tabs between them. **The same items, at different
densities, and moving between them is a zoom.**

- **Density 1 — Feed.** One vehicle per viewport. Vertical swipe is the next
  vehicle, horizontal swipe inside a card is that vehicle (photos, then the
  inclusions and the money breakdown). The footer — title, rate, total,
  deposit, host, reserve — never moves.
- **Density 2 — Grid.** Two columns, same items, same order, same shortlist
  state. This is the scan view.
- **Density 3 — Compare.** The shortlist only, as aligned columns, one row per
  attribute, lowest value in each row marked.

Feed and grid are a scale-and-fade of the same content, and a tile tap zooms
back into that exact card. **Position is preserved in both directions**, so
gathering never costs you your place. That single property is what makes the
app feel like a place rather than a stack of screens.

## The shortlist is the bridge, and it is an edge

The tray is a persistent bottom edge that rises the moment something is
hearted. It is not a screen you navigate to, because navigating away is
precisely what breaks browsing. It shows thumbnails and a count, and it is the
only route into Compare.

Hearting works identically in the feed and in the grid, and the state is
shared. The heart is the whole phase-1-to-phase-3 mechanism.

## Why this is enjoyable rather than merely usable

- **One decision per swipe.** No page of thirty thumbnails asking to be
  processed. The pace is set by the thumb.
- **The money never leaves the screen.** You can look through every photo and
  read the full receipt without losing sight of the number you are deciding on.
- **Nothing punishes curiosity.** Zoom out, zoom in, heart, unheart; you always
  land where you were.
- **The reward for gathering is real.** Compare marks the lowest per-day, total
  and deposit, so the shortlist pays you back for building it.
- **Motion is orientation, not decoration.** The feed-to-grid transition is a
  zoom because a zoom explains where the thing you were looking at went.
  ease-out-expo, no bounce.

## Rules that must survive the port

1. The card footer lives OUTSIDE the horizontal list. Put it inside and the
   pinned-price property — the reason this beats the reference design — is lost.
2. Feed and grid share one data source and one shortlist set. Two lists means
   two truths and the hearts will drift apart.
3. Feed scroll position and grid scroll position map to each other. Losing it
   in either direction breaks the whole premise.
4. Compare scrolls horizontally with the attribute column pinned. Without it
   the fourth shortlisted vehicle is unreachable — the defect appears exactly
   when the feature starts mattering.
5. `prefers-reduced-motion` kills the zoom, keeps the snap. Nothing is lost.
6. The grid must be reachable without a gesture, and every card readable by a
   screen reader in a fixed order: pinned footer first, media second.

## Known gaps

- **Portrait photography is required.** A landscape photo centre-cropped into a
  9:19.5 viewport becomes sky. The listing form has to ask operators for a
  vertical cover shot and say why.
- **Density 4, the map, is not built.** "Where in Marbella" is a real question
  this cannot answer yet. It belongs between grid and compare.
- **The receipt shows the fee, not the owner's net.** Deliberate — showing the
  payout hands both sides the arithmetic for meeting off-platform. See
  FEED-TWO-AXIS.md.
- **No empty, error or loading states yet.** The prototype has data. The app
  will not, on the first run in a new city, and that is the screen that decides
  whether someone stays.

## Port order

1. Feed + card (paged `FlatList`, inner paged `FlatList`, footer as sibling).
2. Shortlist store + tray. Small, and it unlocks the rest.
3. Grid + the shared transition.
4. Compare.
5. Share export — the card rendered at 1080x1920 to the OS share sheet. This is
   the only piece here that brings traffic rather than spending it.
