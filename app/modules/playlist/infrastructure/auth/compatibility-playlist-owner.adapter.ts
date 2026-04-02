import { resolveLegacyCompatibilityUser } from '~/composition/server/auth';

export class CompatibilityPlaylistOwnerAdapter {
  async resolveOwner() {
    const user = await resolveLegacyCompatibilityUser();
    return { id: user.id };
  }
}
