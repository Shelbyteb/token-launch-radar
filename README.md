# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Shelbyteb/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Shelbyteb/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar — every pre-token protocol in the snapshot, ranked by what its token could be worth at launch, with a farm plan for each. 226 rows: the full 40-protocol watchlist plus all 186 rankable pre-token protocols below the $50M floor. The implied value is built only from the snapshot's own figures: each category's FDV/TVL multiple (the median market-cap-to-TVL ratio of that category's live-token protocols in the same snapshot), 7-day TVL growth, no-token age, and chain breadth. Live-token protocols are kept strictly separate, and the 63 rankable protocols above the floor that the watchlist leaves out are listed as set aside, not hidden.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Node 22+, standard library only, no network. `main.ts` reads the sealed snapshot, writes `board.json`, `data.js`, the dashboard and screenshots to the output directory, and `dossier.json` last. Run it twice on the same snapshot and diff the outputs: they are byte-identical.

## The model (radar-2)

- **Category multiple:** per-category median FDV/TVL among live-token protocols in the same snapshot (at least 3 live protocols, else the global median), clamped to ×0.05–×0.60.
- **Growth:** 7-day TVL change clamped to −50%/+150%, half weight.
- **Maturity:** 0.65 + 0.35·√(age/1095d) — older with still no token means more pent-up launch value, with diminishing returns. Unknown age counts as 365 days.
- **Chains:** +2% per extra chain, up to +8%.
- **Farm plans:** six steps per protocol — wallet setup, the category's action, a weekly qualifying action, a hold period by age (30/45/60 days), a claim-safety check, and a farm log — each with a cost and a time, sized by the protocol's own TVL tier.

## The dashboard

A single static page (`dashboard/`): a sortable, filterable board table, a detail panel per protocol with its factor breakdown, farm plan and nearest comparables, a live-token market view, a set-aside view, and the full model with its multiples. No framework, no network.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
