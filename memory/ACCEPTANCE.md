# Assemble acceptance record

Preview URL: https://assemble-app-1.preview.emergentagent.com (tested 2026-06; test reports iteration_1, iteration_2 and a re-run of tests/test_extract_summary.py)
Deployed URL: NOT RUN. The app has not been deployed yet. Re-run these checks on the live URL after publishing.

| # | Check | Preview | Deployed |
|---|-------|---------|----------|
| 1 | Sign-in: Google redirect, email+password, labeled demo accounts | PASS | NOT RUN |
| 2 | Private per-firm data; forwarded link / role switch gives no access (403) | PASS | NOT RUN |
| 3 | Intake: unknowns visible, invalid dates/counts/currency rejected without adjustment | PASS | NOT RUN |
| 4 | Cheap plan Alder+Redwood $156k fails weeks 1 and 2 | PASS | NOT RUN |
| 5 | Baseline Alder/Birch/Cedar $168k, 4/4/4, passes | PASS | NOT RUN |
| 6 | Failed candidate never claims impossible/cheapest; incomplete search labeled; headroom not profit | PASS | NOT RUN |
| 7 | Partner sees only own sites/terms; confirm / request change / decline | PASS | NOT RUN |
| 8 | Responses tied to version + terms hash; stale tab 409; duplicate submit idempotent | PASS | NOT RUN |
| 9 | S09/S10 to week 1: 6/4/2, 2-slot gap week 1 | PASS | NOT RUN |
| 10 | Dogwood repair $172k; Alder + Dogwood re-review; Birch, Cedar carry over | PASS | NOT RUN |
| 11 | Discard preview keeps consents; select keeps history | PASS | NOT RUN |
| 12 | Birch +$14k stress test: $186k fails ceiling | PASS | NOT RUN |
| 13 | Per-visitor demo copy and reset isolation | PASS | NOT RUN |
| 14 | Everything survives reload; history is the receipt | PASS | NOT RUN |
| 15 | AI reading: facts with line + verbatim excerpt; unknowns/conflicts kept | PASS | NOT RUN |
| 16 | "2-man crew" never becomes crew count/capacity | PASS | NOT RUN |
| 17 | Redwood "week three only" email changes the reading (later date wins, conflict visible) | PASS | NOT RUN |
| 18 | Injected instructions in documents ignored and listed | PASS | NOT RUN |
| 19 | Correction keeps original, prior, editor, time; re-read keeps corrections; candidate recalculated on use | PASS | NOT RUN |
| 20 | Bad file type / malformed output / timeout keep input, offer retry, no false success | PASS (bad type + malformed verified; timeout by code review) | NOT RUN |
| 21 | Organizer-only dated printable summary (checks, contributions, exact responses, conditions) | PASS | NOT RUN |
| 22 | Mobile 390px usable | PASS | NOT RUN |

Human tasks outside the app (not tracked here): 118-second demo recording, submission by Sunday 11:30 Pacific, customer research (ASMBL-1), optional finals demo.
