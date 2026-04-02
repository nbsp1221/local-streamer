# Playback Test Fixtures

This directory is the authoritative fixture source for hermetic playback and browser smoke verification.

Rules:

- do not read playback seed assets from ignored repo-local `storage/`
- keep only the smallest packaged assets needed for runtime workspace seeding and required browser smoke
- update `tests/support/playback-fixture-manifest.ts` when fixture ownership changes
