import { runBrowserCompatiblePlaybackBackfillCli } from '../app/modules/playback/infrastructure/backfill/browser-compatible-playback-backfill';

if (import.meta.main) {
  const summary = await runBrowserCompatiblePlaybackBackfillCli();

  if (summary.failed.length > 0) {
    process.exitCode = 1;
  }
}
