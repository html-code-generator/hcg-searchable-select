# Changelog

All notable changes to hcg-select are documented here.

## [1.0.4] - 2026-07-20

### Fixed

- Search input keeps focus when the native `<select>` is wrapped in a `<label>` (label click forwarding no longer steals focus from the search box).

## [1.0.3] - 2026-07-19

### Fixed

- Searchable select works inside modal `<dialog>` elements: option click selection, list scrollbar interaction, and outside-click detection no longer break when the dialog focus trap moves focus to the dialog element.
