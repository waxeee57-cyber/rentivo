# Two-axis feed — working prototype

Open `feed-two-axis-prototype.html` on a phone. It is a real scroll surface,
not a picture; CSS scroll-snap on both axes, no framework.

## The model

- **Vertical** — next vehicle. One card per viewport, `scroll-snap-stop: always`
  so a hard flick cannot skip past three vehicles.
- **Horizontal, inside a card** — this vehicle. Photos, then a receipt panel.

## The rule that makes it a rental tool instead of a video feed

**The footer never moves.** Title, specs, rate, total, deposit, host, and the
reserve button are pinned and constant across the whole horizontal axis. Only
the media area changes underneath them.

This is the difference between browsing and being entertained. On the reference
card (SIXT via TikTok) the price is part of the slide, so swiping sideways
means losing sight of it. Here you can look through every photo and read the
receipt without the number you are deciding on ever leaving the screen.

## The sideways axis goes DEEPER, not WIDER

The last horizontal panel is not another photograph. It is:

- **What you get** — the inclusions, as a list, not a paragraph.
- **Where the money goes** — rate x days, service fee, what you pay.

Swiping sideways answers "tell me more about THIS one" rather than "show me
another one". Another-one is the vertical axis, and mixing the two is how a
browse surface stops meaning anything.

## Three problems this pattern creates. Do not ship without answers.

### 1. Comparison becomes impossible — the serious one

TikTok is a consumption surface. Renting is a **comparison** task. Seeing one
vehicle at a time is excellent for discovery ("what can I get in Marbella next
week?") and actively bad for choosing between four cars you already like. This
is why every incumbent uses a grid, and dismissing that as unimaginative would
be a mistake.

Expect this pattern to raise engagement and *lower* conversion unless it has an
escape hatch. Minimum:

- a shortlist (the heart control) that accumulates across the feed;
- a compare view showing the shortlist side by side, with rate, total and
  deposit aligned in columns;
- a way back — swiping up past a vehicle you liked should not lose it.

Ship the feed as the **top of the funnel**, with the grid still reachable. Not
as a replacement for search.

### 2. It demands portrait photography

A 3:2 landscape photo centre-cropped into a 9:19.5 viewport loses most of the
subject — see the sailboat frame in the render, which becomes sail and sky.
Operators upload landscape photos by default, because every other rental
platform shows landscape cards.

So this is a product requirement, not a styling detail: the listing form has to
ask for a **vertical cover shot** and say why. Until then the feed will look
worse for real listings than it does in this prototype, which uses photographs
chosen to survive the crop.

### 3. The receipt panel invites disintermediation

The prototype's money panel currently shows "You pay EUR 245 / Giulia M.
receives EUR 220". That is maximally transparent and it is on-brand, but it
also hands the renter and the owner the exact arithmetic for meeting off the
platform next time. That is the classic marketplace leak, and it costs the
recurring revenue rather than the first booking.

The transparency that actually helps the renter is **what the fee buys**, not
what the owner nets:

> Service fee EUR 25 — payment protection, damage-waiver handling, and support
> in your language for the whole rental.

Same honesty about the number, no invitation to route around it. Decide this
deliberately before it ships; it is a business decision wearing a UI costume.

## Port notes

- `FlatList` vertical, `pagingEnabled`, `snapToInterval = screenHeight`,
  `decelerationRate="fast"`, `windowSize={3}`.
- Inner horizontal `FlatList` per card, same paging. Keep the footer OUTSIDE it
  as an absolutely positioned sibling, or the pinned-price property is lost.
- Prefetch the next card's first image only. Prefetching whole cards on a feed
  is how this pattern eats a data plan.
- `prefers-reduced-motion`: disable smooth scrolling, keep snapping.
- Accessibility: the vertical axis needs a non-gesture route. Every card should
  be reachable from the grid, and the card itself must be readable by a screen
  reader in a fixed order — pinned footer first, media second.
