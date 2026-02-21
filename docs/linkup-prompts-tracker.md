# Prompts Tracker — Person B

## Role
Data quality gatekeeper. Craft and optimize prompts that the backend imports. Each backend agent has an inline fallback prompt, but Person B's versions should be more detailed and tested.

## Prompt Files

| File | Function | Returns | Used By |
|------|----------|---------|---------|
| `prompts/query_planner_prompt.py` | `build_prompt()` | `tuple[str, str]` (system, follow_up) | `agents/query_planner.py` |
| `prompts/extraction_prompt.py` | `build_prompt()` | `tuple[str, str]` (system, merge) | `agents/data_extractor.py` |
| `prompts/discovery_prompt.py` | `build_prompt(products)` | `str` (system prompt) | `discovery/prompts.py` |
| `prompts/matching_prompt.py` | `build_prompt()` | `str` (system prompt) | `matching/pipeline.py` |
| `prompts/pitch_deck_prompt.py` | `build_prompt()` | `str` (system prompt) | `actions/pitch_deck.py` |
| `prompts/email_prompt.py` | `build_prompt()` | `str` (system prompt) | `actions/email_generator.py` |

All agents use `_try_import_prompt()` — falls back to inline if import fails.

## Test Runners

```bash
# Enrichment pipeline (plan → search → extract)
uv run python -m prompts.test_runner "Stripe"              # Full pipeline, one company
uv run python -m prompts.test_runner "Stripe" --stage plan  # Query planner only (free)
uv run python -m prompts.test_runner --all                  # All 20 test companies

# Discovery
uv run python -m prompts.test_discovery              # Dry run: print prompt
uv run python -m prompts.test_discovery --run --max 5 # Live run
```

Results saved to `prompts/results/`.

## What's Done
- [x] `query_planner_prompt.py` — generates 5-8 queries, follow-up with gaps/hints
- [x] `extraction_prompt.py` — extracts Lead fields + confidences + gaps, merge addendum for follow-up
- [x] `discovery_prompt.py` — ICP derivation + search strategy for tool-use agent
- [x] `matching_prompt.py` — scores 1-10 with reasoning, conversion likelihood
- [x] `pitch_deck_prompt.py` — 7-slide structure with HTML body + speaker notes
- [x] `email_prompt.py` — cold outreach with company-specific opening + CTA
- [x] `test_runner.py` — CLI test harness for enrichment pipeline
- [x] `test_discovery.py` — CLI test harness for discovery

## Remaining Work
- [ ] Conversion prediction prompt (currently inline in `analytics.py`)
- [ ] Quality pass: run all prompts against 5 demo companies × 3 products, fix issues
- [ ] Ensure pitch decks are flawless for demo companies
- [ ] Prepare 3 backup pitch decks (pre-generated) in case API is slow
