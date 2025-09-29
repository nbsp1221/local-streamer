# ClearKey Playback Warning Investigation

## Summary
- **Context**: Opening any DASH/DRM protected video via the Vidstack player emits multiple console warnings and an uncaught `TypeError` originating from `dashjs`.
- **Impact**: Playback still succeeds, but the flood of warnings/errors complicates debugging and may mask real issues. Direct navigation to `/player/:id` can temporarily render the route in an error state because the player initializes before tokens are fetched.

## Reproduction
1. Start the dev server (`bun dev --host 127.0.0.1 --port 5176`).
2. Visit `http://127.0.0.1:5176/` and click any video card (e.g. **playtime**).
3. Open the browser console. Vidstack logs appear first, followed by `dash.js` warnings and the uncaught `TypeError`.

## Observed Console Output
```
[LOG] ✅ [Vidstack] Clear Key DRM configured successfully
[WARNING] [CapabilitiesFilter] Codec video/mp4;codecs="hev1.1.6.H120.90" not supported. Removing Representation with ID 0
TypeError: Cannot read properties of undefined (reading 'getSupportedKeySystemMetadataFromContentProtection')
    at dashjs.js:11779:133
    at c3 (dashjs.js:11780:8)
    at d3 (dashjs.js:11745:18)
    ...
[WARNING] ClearKey schemeIdURI is using W3C Common PSSH systemID (1077efec-c0b2-4d02-ace3-3c1e52e2fb4b) in Content Protection. See DASH-IF IOP v4.1 section 7.6.2.4
```

The network log shows the manifest carries two `ContentProtection` blocks with the common ClearKey system ID:
```
<ContentProtection value="cenc" schemeIdUri="urn:mpeg:dash:mp4protection:2011" .../>
<ContentProtection schemeIdUri="urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b">
  <cenc:pssh>AAAANHBzc2gBAAAAEHfv7MCyTQKs4zweUuL7SwAAAAHGi1AewHO/RJBfBX23pkMMAAAAAA==</cenc:pssh>
</ContentProtection>
```

## Analysis
- The warnings originate from `dash.js` (v5) filtering capabilities for each `AdaptationSet`. Because our video track is encoded as HEVC (`hev1.1.6.H120.90`), Dash removes the representation if the browser cannot decode HEVC. This is expected on browsers without hardware HEVC decoding.
- The uncaught `TypeError` is triggered inside `ProtectionController` while attempting to convert `ContentProtection` entries into key-system metadata (`dashjs.js` line ~11779). The controller expects a `protectionController` instance to be supplied via its configuration; otherwise `getSupportedKeySystemMetadataFromContentProtection` is undefined.
  - In our integration we call `detail.onInstance(dashInstance => dashInstance.setProtectionData(...))` immediately. When dash.js processes the manifest before protection is configured, `o3` (internal reference to the protection controller) is `undefined`, producing the TypeError.
  - The error is harmless because Dash continues initializing, but it surfaces on every playback.
- ClearKey warnings surface because the manifest sets `schemeIdUri="urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b"`, the W3C Common PSSH identifier for ClearKey manifests.[^w3c-clearkey] DASH-IF IOP v4.3 specifies that the ClearKey `schemeIdUri` should instead use `urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e` with `value="ClearKey1.0"`, while the PSSH box may still carry the common system ID (`1077…`).[^dashif] The UUID `edef8ba9-79d6-4ace-a3c8-27dcd51d21ed` actually identifies Widevine, and PlayReady corresponds to `9a04f079-9840-4286-ab92-e65be0885f95`, so pointing `schemeIdUri` at either would mislabel the stream.[^widevine-playready]

## Additional Finding
- Navigating directly to `/player/:id` from a cold load results in SSR rendering an error (`Cannot read properties of undefined (reading 'src')`). During SSR, `videoSrc` is `undefined` until the token request runs on the client. The Vidstack server renderer expects a defined `src` and throws. Client navigation from the library avoids this, masking the issue.

## Recommendations
1. **Guard Dash protection setup**
   - Delay `setProtectionData` until a protection controller is available:
     ```ts
     detail.onInstance((dash) => {
       const controller = dash.getProtectionController && dash.getProtectionController();
       if (!controller) {
         dash.initialize();
         dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
           configureClearKeyDRM(dash);
         });
       } else {
         configureClearKeyDRM(dash);
       }
     });
     ```
   - Alternatively, explicitly create a protection controller via `dash.setProtectionData` only after calling `dash.setProtectionController` (dash.js API) or use Vidstack's upcoming DRM helpers.
2. **Suppress / handle HEVC capability warnings**
   - Provide an H.264 fallback ladder or detect browser HEVC support before selecting the representation.
3. **Adjust manifest ClearKey metadata**
   - Configure the packager to emit `schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e"` with `value="ClearKey1.0"`, keeping the `1077…` system ID inside the PSSH payload only. This aligns with DASH-IF IOP guidance[^dashif] and avoids the dash.js warning.
4. **Fix SSR error path**
   - Provide a placeholder `src` (e.g., empty string) or render the `MediaPlayer` only after the token fetch resolves so server rendering does not throw.

## Next Steps
- Prototype the protection-controller guard and run E2E playback to confirm the TypeError disappears.
- Review shaka-packager settings to emit compliant ClearKey metadata.
- Backfill unit/e2e coverage for direct navigation to `/player/:id` so SSR regressions are caught automatically.

## References
[^dashif]: [DASH-IF ClearKey Content Protection guidelines](https://github.com/Dash-Industry-Forum/ClearKey-Content-Protection#readme)
[^w3c-clearkey]: [W3C "cenc" Initialization Data Format](https://www.w3.org/TR/eme-initdata-cenc/)
[^widevine-playready]: [Azure Media Services DRM overview](https://learn.microsoft.com/azure/media-services/latest/drm-overview#digital-rights-management-scheme-id-uris)
