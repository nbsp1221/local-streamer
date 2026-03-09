import type { PlaybackClearKeyService } from '~/modules/playback/application/ports/playback-clearkey-service.port';
import type { PlaybackManifestService } from '~/modules/playback/application/ports/playback-manifest-service.port';
import type { PlaybackMediaSegmentService } from '~/modules/playback/application/ports/playback-media-segment-service.port';
import type { PlaybackTokenService } from '~/modules/playback/application/ports/playback-token-service.port';
import type { VideoCatalogPort } from '~/modules/playback/application/ports/video-catalog.port';
import { IssuePlaybackTokenUseCase } from '~/modules/playback/application/use-cases/issue-playback-token.usecase';
import { ResolvePlayerVideoUseCase } from '~/modules/playback/application/use-cases/resolve-player-video.usecase';
import { ServePlaybackClearKeyLicenseUseCase } from '~/modules/playback/application/use-cases/serve-playback-clearkey-license.usecase';
import { ServePlaybackManifestUseCase } from '~/modules/playback/application/use-cases/serve-playback-manifest.usecase';
import { ServePlaybackMediaSegmentUseCase } from '~/modules/playback/application/use-cases/serve-playback-media-segment.usecase';
import { LegacyVideoCatalogAdapter } from '~/modules/playback/infrastructure/catalog/legacy-video-catalog.adapter';
import { LegacyPlaybackClearKeyServiceAdapter } from '~/modules/playback/infrastructure/license/legacy-playback-clearkey.service.adapter';
import { LegacyPlaybackManifestServiceAdapter } from '~/modules/playback/infrastructure/media/legacy-playback-manifest.service.adapter';
import { LegacyPlaybackMediaSegmentServiceAdapter } from '~/modules/playback/infrastructure/media/legacy-playback-media-segment.service.adapter';
import { JsonWebTokenPlaybackTokenService } from '~/modules/playback/infrastructure/token/jsonwebtoken-playback-token.service';

interface ServerPlaybackServices {
  issuePlaybackToken: IssuePlaybackTokenUseCase;
  resolvePlayerVideo: ResolvePlayerVideoUseCase;
  servePlaybackClearKeyLicense: ServePlaybackClearKeyLicenseUseCase;
  servePlaybackManifest: ServePlaybackManifestUseCase;
  servePlaybackMediaSegment: ServePlaybackMediaSegmentUseCase;
}

interface ServerPlaybackServiceDependencies {
  clearKeyService: PlaybackClearKeyService;
  manifestService: PlaybackManifestService;
  mediaSegmentService: PlaybackMediaSegmentService;
  tokenService: PlaybackTokenService;
  videoCatalog: VideoCatalogPort;
}

let cachedPlaybackServices: ServerPlaybackServices | null = null;

function createDefaultDependencies(): ServerPlaybackServiceDependencies {
  return {
    clearKeyService: new LegacyPlaybackClearKeyServiceAdapter(),
    manifestService: new LegacyPlaybackManifestServiceAdapter(),
    mediaSegmentService: new LegacyPlaybackMediaSegmentServiceAdapter(),
    tokenService: new JsonWebTokenPlaybackTokenService(),
    videoCatalog: new LegacyVideoCatalogAdapter(),
  };
}

export function createServerPlaybackServices(
  overrides: Partial<ServerPlaybackServiceDependencies> = {},
): ServerPlaybackServices {
  const hasAllOverrides = Boolean(
    overrides.clearKeyService &&
    overrides.manifestService &&
    overrides.mediaSegmentService &&
    overrides.tokenService &&
    overrides.videoCatalog,
  );
  const defaultDependencies = hasAllOverrides ? null : createDefaultDependencies();
  const deps = {
    clearKeyService: overrides.clearKeyService ?? defaultDependencies!.clearKeyService,
    manifestService: overrides.manifestService ?? defaultDependencies!.manifestService,
    mediaSegmentService: overrides.mediaSegmentService ?? defaultDependencies!.mediaSegmentService,
    tokenService: overrides.tokenService ?? defaultDependencies!.tokenService,
    videoCatalog: overrides.videoCatalog ?? defaultDependencies!.videoCatalog,
  };

  return {
    issuePlaybackToken: new IssuePlaybackTokenUseCase({
      tokenService: deps.tokenService,
    }),
    resolvePlayerVideo: new ResolvePlayerVideoUseCase({
      videoCatalog: deps.videoCatalog,
    }),
    servePlaybackClearKeyLicense: new ServePlaybackClearKeyLicenseUseCase({
      clearKeyService: deps.clearKeyService,
      tokenService: deps.tokenService,
    }),
    servePlaybackManifest: new ServePlaybackManifestUseCase({
      manifestService: deps.manifestService,
      tokenService: deps.tokenService,
    }),
    servePlaybackMediaSegment: new ServePlaybackMediaSegmentUseCase({
      mediaSegmentService: deps.mediaSegmentService,
      tokenService: deps.tokenService,
    }),
  };
}

export function getServerPlaybackServices(): ServerPlaybackServices {
  if (cachedPlaybackServices) {
    return cachedPlaybackServices;
  }

  cachedPlaybackServices = createServerPlaybackServices();

  return cachedPlaybackServices;
}
