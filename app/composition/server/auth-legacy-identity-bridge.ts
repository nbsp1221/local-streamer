import { randomUUID } from 'node:crypto';
import type { PublicUser } from '~/legacy/types/auth';
import { getUserRepository } from '~/legacy/repositories';

const LEGACY_BRIDGE_EMAIL = 'vault@local';

export type LegacyBridgeUser = PublicUser;

export async function resolveLegacyBridgeUser(): Promise<LegacyBridgeUser> {
  const userRepository = getUserRepository();
  const existingBridgeUser = await userRepository.findByEmail(LEGACY_BRIDGE_EMAIL);

  if (existingBridgeUser) {
    return userRepository.toPublicUser(existingBridgeUser);
  }

  const [adminUser] = await userRepository.findByRole('admin');
  if (adminUser) {
    return userRepository.toPublicUser(adminUser);
  }

  const [firstUser] = await userRepository.findAll();
  if (firstUser) {
    return userRepository.toPublicUser(firstUser);
  }

  try {
    const createdBridgeUser = await userRepository.create({
      email: LEGACY_BRIDGE_EMAIL,
      password: randomUUID(),
      role: 'admin',
    });

    return userRepository.toPublicUser(createdBridgeUser);
  }
  catch (error) {
    const racedBridgeUser = await userRepository.findByEmail(LEGACY_BRIDGE_EMAIL);

    if (racedBridgeUser) {
      return userRepository.toPublicUser(racedBridgeUser);
    }

    throw error;
  }
}
