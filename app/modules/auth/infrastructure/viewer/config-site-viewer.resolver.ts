import type { SiteViewer } from '~/modules/auth/domain/site-viewer';
import { getAuthOwnerConfig } from '~/shared/config/auth.server';

export class ConfigSiteViewerResolver {
  async resolveViewer(): Promise<SiteViewer> {
    const ownerConfig = getAuthOwnerConfig();

    return {
      email: ownerConfig.ownerEmail,
      id: ownerConfig.ownerId,
      role: ownerConfig.ownerRole,
    };
  }
}
