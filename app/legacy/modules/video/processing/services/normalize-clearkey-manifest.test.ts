import { describe, expect, it } from 'vitest';
import { normalizeClearKeyManifest } from './normalize-clearkey-manifest';

describe('normalizeClearKeyManifest', () => {
  it('rewrites the ClearKey schemeIdUri and adds the DASH-IF value without touching the PSSH payload', () => {
    const originalManifest = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <ContentProtection value="cenc" schemeIdUri="urn:mpeg:dash:mp4protection:2011" />
      <ContentProtection schemeIdUri="urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b">
        <cenc:pssh>AAAANHBzc2gBAAAAEHfv7MCyTQKs4zweUuL7SwAAAAHGi1AewHO/RJBfBX23pkMMAAAAAA==</cenc:pssh>
      </ContentProtection>
      <Representation id="0" codecs="avc1.640028" />
    </AdaptationSet>
  </Period>
</MPD>`;

    const normalizedManifest = normalizeClearKeyManifest(originalManifest);

    expect(normalizedManifest).toContain('schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e"');
    expect(normalizedManifest).toContain('value="ClearKey1.0"');
    expect(normalizedManifest).toContain('<cenc:pssh>AAAANHBzc2gBAAAAEHfv7MCyTQKs4zweUuL7SwAAAAHGi1AewHO/RJBfBX23pkMMAAAAAA==</cenc:pssh>');
    expect(normalizedManifest).toContain('codecs="avc1.640028"');
  });

  it('is idempotent when the manifest is already normalized', () => {
    const normalizedManifest = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <ContentProtection schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" value="ClearKey1.0">
        <cenc:pssh>AAAANHBzc2gBAAAAEHfv7MCyTQKs4zweUuL7SwAAAAHGi1AewHO/RJBfBX23pkMMAAAAAA==</cenc:pssh>
      </ContentProtection>
    </AdaptationSet>
  </Period>
</MPD>`;

    expect(normalizeClearKeyManifest(normalizedManifest)).toBe(normalizedManifest);
  });
});
