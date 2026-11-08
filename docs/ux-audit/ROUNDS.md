# UX/UI audit rounds

Three reviewers (radar app, website pages, GeoFS userscript) score 12 common
UX/UI categories from 1 to 10. Overall = average of the 12. Reviews read the
code and these screenshots; nothing was profiled on real devices.

## Overall score per round

| Round | What changed before it | Radar | Website | Userscript |
|---|---|---|---|---|
| 0 | Original audit on `main` | 5.3 | 5.4 | 4.7 |
| 1 | First fix pass | 6.5 | 6.7 | 6.6 |
| 2 | Round 1 fixes | 6.8 | 7.4 | 7.6 |
| 3 | Round 2 fixes | 7.1 | 7.8 | 7.9 |
| 4 | Round 3 fixes | 7.6 | 7.9 | 8.0 |
| 5 | Round 4 fixes + dark theme everywhere | 7.8 | 8.0 | 8.1 |
| 6 | Round 5 fixes | 7.8 | — | — |
| 7 | Round 6 fixes | 7.9 | — | — |
| 8 | Round 7 fixes | **8.0** | — | — |

## Per-category scores: original vs latest

| Category | Radar 0 | Radar latest | Website 0 | Website latest | Userscript 0 | Userscript latest |
|---|---|---|---|---|---|---|
| Visual design & consistency | 6 | 8 | 6 | 8 | 6 | 8 |
| Information hierarchy & layout | 6 | 8 | 6 | 8 | 6 | 9 |
| Navigation & discoverability | 5 | 8 | 4 | 8 | 4 | 8 |
| Feedback & system status | 6 | 8 | 6 | 8 | 3 | 8 |
| Onboarding & learnability | 7 | 8 | 6 | 8 | 5 | 8 |
| Accessibility | 3 | 8 | 4 | 8 | 3 | 8 |
| Responsiveness & mobile | 5 | 8 | 6 | 8 | 6 | 8 |
| Perceived performance | 5 | 8 | 5 | 8 | 5 | 8 |
| Forms & input handling | 4 | 8 | 6 | 8 | 5 | 8 |
| Copy & microcopy | 6 | 8 | 6 | 8 | 5 | 8 |
| Error prevention & recovery | 6 | 8 | 5 | 8 | 4 | 8 |
| Platform conventions | 5 | 8 | 5 | 8 | 5 | 8 |
| **Overall** | **5.3** | **8.0** | **5.4** | **8.0** | **4.7** | **8.1** |

Latest = radar round 8, website round 5, userscript round 5 (each reviewer
stopped once every category reached 8).

Screenshots: `before/` is `main`, `after/` is the final branch state.

## Second loop: target 9.5

Same three reviewers and 12 categories, re-scored from scratch with a stricter
scale (8 = good with clear gaps, 9 = excellent with only minor polish, 10 =
best-in-class). Each round's fixes are one commit; CodeRabbit reviews the PR
after every round.

| Round | Reviewed commit | Radar | Website | Userscript |
|---|---|---|---|---|
| 1 | `895561f` (after merging main) | 8.0 | 8.1 | 8.0 |
| 2 | `5b6ba9e` (round 1 fixes) | 8.4 | 8.5 | 8.3 |
| 3 | `274e681` (round 2 fixes) | 8.7 | 8.7 | 8.5 |
| 4 | `056e125` (round 3 fixes) | 8.7 | 8.8 | 8.8 |
| 5 | `8c57273` (round 4 fixes) | 8.9 | 8.8 | 8.9 |
| 6 | `eadd2d9` (round 5 fixes) | 8.8 | 8.9 | 8.9 |
| 7 | `4065cb7` (round 6 fixes) | 8.8 | 8.9 | 9.0 |
| 8 | `6f84ab2` (round 7 fixes) | — (reviewer interrupted) | 9.0 | 9.2 |
| 9 | `5b054f7` (round 8 fixes) | 9.1 | 9.1 | 9.4 |
| 10 | `06521de` (round 9 fixes) | 9.2 | 9.4 | 9.4 |
| 11 | `5187168` (round 10 fixes) | 9.3 | 9.4 | 9.4 |
| 12 | `a03b89c` (round 11 fixes) | 9.3 | 9.5 | 9.5 |

Round 12's own fixes (`2051dec`, plus the userscript status-pill fix in the
screenshot commit) address every remaining round-12 finding but have not been
re-scored.

### Per-category scores: original vs round 12

Round 0 used the original, looser scale; round 12 used the stricter one.

| Category | Radar 0 | Radar 12 | Website 0 | Website 12 | Userscript 0 | Userscript 12 |
|---|---|---|---|---|---|---|
| Visual design & consistency | 6 | 9 | 6 | 9.5 | 6 | 9.5 |
| Information hierarchy & layout | 6 | 9.5 | 6 | 9.5 | 6 | 9.5 |
| Navigation & discoverability | 5 | 9.5 | 4 | 9.5 | 4 | 9.5 |
| Feedback & system status | 6 | 9.5 | 6 | 9.5 | 3 | 9.5 |
| Onboarding & learnability | 7 | 9.5 | 6 | 9.5 | 5 | 9.5 |
| Accessibility | 3 | 9 | 4 | 9.5 | 3 | 9.5 |
| Responsiveness & mobile | 5 | 9.5 | 6 | 9.5 | 6 | 9.5 |
| Perceived performance | 5 | 9.5 | 5 | 9.5 | 5 | 9.5 |
| Forms & input handling | 4 | 9.5 | 6 | 9.5 | 5 | 9.5 |
| Copy & microcopy | 6 | 9 | 6 | 9 | 5 | 9.5 |
| Error prevention & recovery | 6 | 9 | 5 | 9.5 | 4 | 9.5 |
| Platform conventions | 5 | 9.5 | 5 | 9.5 | 5 | 9.5 |
| **Overall** | **5.3** | **9.3** | **5.4** | **9.5** | **4.7** | **9.5** |

## How the reviews were run

- **Models:** every reviewer and the agent applying the fixes ran on Claude
  Opus 5.5 (`claude-opus-5-5`) in Claude Code. No reviewer used a smaller or
  different model.
- **Reasoning:** adaptive extended thinking, with the session's default
  reasoning effort (medium). No reviewer had an effort or model override.
- **Reviewers:** three built-in `general-purpose` subagents per round (radar,
  website, userscript). Each round started fresh agents with no memory of
  earlier rounds beyond what the prompt said, so a reviewer couldn't "remember"
  being generous.
- **Read-only:** reviewers could read code, run git and look at screenshots,
  but could not edit files or run builds. Each prompt gave the scope, the
  previous scores, the list of fixes to verify, and a calibration rule
  (8 = good with clear gaps, 9 = excellent with minor polish, 10 =
  best-in-class; don't inflate, don't withhold 9.5 when nothing meaningful is
  left). Reviewers had to cite `file:line` evidence and flag regressions.
- **Fixes:** applied by the main agent, one commit per round, each checked
  with `tsc`, ESLint, the unit tests, a headless userscript harness on a mock
  GeoFS page and Playwright checks of the radar sheets (Back, X, search).
