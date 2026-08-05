# Feed card — the app's primary browse surface

Prototype: `feed-card-prototype.html` (opens in any browser, edit and re-look).
Render: `feed-card-prototype.png`.

## Where this came from

A TikTok carousel: a creator posting SIXT affiliate offers as full-screen
slides. Location and dates pinned at the top, one vehicle per screen, spec
chips, a studio render of the car, and a big discounted price against a
struck-through original.

Three things in it are worth taking. One is worth refusing.

## Take: the format

One offer per screen, vertical, swipeable, thumb-reachable. It beats a scroll
of cards because it gives each vehicle the whole screen and forces a decision
per swipe instead of an endless comparison. It is also the native shape of the
channel where rental demand actually lives.

## Take: the hierarchy

Where and when locked to the top and editable in place — that is genuinely good
UX and the reason the card can be so aggressive with the rest of the space. The
object big. The money unmissable.

## Take: it is a POST, not a screen

This is the part worth the most. Their card exists because a creator screenshot
it into a feed. Ours should be able to leave the app on purpose: an operator
generates the card for their vehicle and posts it. The share control is not an
afterthought on this surface, it is the point of it — see "next" below.

## Refuse: the discount mechanic

"-70%", struck-through rack rate, "Offre spéciale appliquée".

- **Commercially it is not ours to run.** SIXT owns its fleet and has inventory
  rot to clear. On Rentivo the owner receives the rental subtotal; a 70% cut
  either comes out of their pocket or is theatre against a price nobody paid.
- **It contradicts the positioning.** The whole repositioning away from luxury
  rests on "the price is the price, no surprises". Struck-through-price theatre
  teaches the customer that the number is negotiable fiction. It would undo the
  work.
- **Legally it is narrower than it looks.** The strict Omnibus rule (prior price
  = lowest in the last 30 days, PID Art. 6a) applies to GOODS, and vehicle
  rental is a service, so that specific rule does not bind us. But the Unfair
  Commercial Practices Directive still does: a reference price nobody ever paid
  is a misleading practice regardless. Do not build a discount ribbon on the
  assumption that services are unregulated.

## Instead: the money block is the differentiator

Three numbers, no theatre:

| | |
|---|---|
| `EUR 35 /day` | what you compare on |
| `Total, 7 days — EUR 245` | what you actually pay, service fee included |
| `Deposit — EUR 0` | the number every competitor hides until the counter |

Deposit is the single biggest reason a first-time renter abandons, and it is
the one number SIXT's card does not contain anywhere. Showing it — in green
when the waiver zeroes it — is worth more than any percentage badge.

Plus what a marketplace has and a rental chain does not: **a named host**,
with private-host vs verified-operator stated on the card.

## Design notes

- Dark ground here, unlike the marketing site. Different scene: the app is used
  after booking, at a counter or a quayside, often at night. See DESIGN.md in
  rentivo-web for why the site went light.
- Photography is real, not a studio cut-out. Operators upload their own; a
  render would be a lie about what you are collecting.
- Archivo for the title (width axis, signage), Manrope for everything else.
- Accent `#FF7A45` only on the primary CTA and the category eyebrow.
- No struck-through prices, no percentage badges, no glass chips, no emoji.

## Defects found and fixed in the prototype (do not reintroduce)

- A two-line title landed on the photograph, because the text block was
  anchored to the bottom with no room reserved for its tallest case. The body
  now has a min-height and the veil turns solid above it.
- `1 bags`, and `— bags` for a boat. Specs are singularised and omitted when
  they have no value.
- Top context bar was unreadable over a bright photo. Top scrim strengthened.
- A long operator name wrapped and pushed the booking chip onto a second line.
  Name truncates, chip never wraps.

## Next

1. Port to React Native. The list is a `FlatList` with `pagingEnabled` and
   `snapToInterval`; the card is one component driven by the existing listing
   shape.
2. Build the share export. Render the card off-screen at 1080x1920 and hand it
   to the OS share sheet, so an operator can post their own vehicle to a story
   in two taps. This is the distribution feature, not a design flourish.
3. Only then extend the language to the rest of the app.
