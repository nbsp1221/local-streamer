import { cp } from 'node:fs/promises';
import { join } from 'node:path';
import { assertRequiredPlaybackFixture } from './playback-fixture-manifest';

export async function copyPlaybackFixture(input: {
  targetVideosDir: string;
  videoId: string;
}): Promise<void> {
  const fixtureDir = await assertRequiredPlaybackFixture(input.videoId);

  await cp(
    fixtureDir,
    join(input.targetVideosDir, input.videoId),
    { recursive: true },
  );
}
