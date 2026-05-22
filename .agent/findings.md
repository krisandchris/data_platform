# TASK-022 Findings

## Repository Facts

- The shell receives normalized label config with `code`, `labelZh`, and `labelEn`.
- Existing helper functions rendered `option.code`, which leaked English codes into the QC page.
- The user explicitly excluded `violation_category` from this localization pass.

## Implemented Decisions

- Display-only helpers were added so model/draft values remain original codes.
- For `violation_category`, the page continues displaying the raw value/code.
- For other label-config backed fields, visible text prefers `labelZh`, then `labelEn`, then known local fallback labels, then raw value.
- Datalist suggestions keep raw `value` but include localized `label`, so adding a tag still stores the original code.
- Lease/status/progress/topbar/relation/candidate labels were changed to Chinese operator text.

## Risks

- Free-text fields such as relation subject/object/description can still contain English if the sample data itself is English. The change maps known tag/code values for display-only text but does not mutate editable free-text values.
- Some technical identifiers remain intentionally raw, including `violation_category`, sample IDs, candidate IDs, relation IDs, and persisted operation field names.
