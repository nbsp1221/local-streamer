interface DrmConfig {
  key: string;
  keyId: string;
}

interface DashPlaybackProviderInstance {
  addRequestInterceptor?: (callback: (request: { url: string }) => Promise<{ url: string }>) => void;
  getProtectionController?: () => unknown;
  off?: (event: string, callback: () => void) => void;
  on?: (event: string, callback: () => void) => void;
  setProtectionData?: (data: Record<string, unknown>) => void;
}

interface ConfigureDashPlaybackProviderInput {
  drmConfig: DrmConfig | null;
  provider: DashPlaybackProviderInstance;
  token: string | null;
}

export async function configureDashPlaybackProvider(
  input: ConfigureDashPlaybackProviderInput,
) {
  const token = input.token;

  if (token) {
    input.provider.addRequestInterceptor?.(async (request) => {
      if (request.url.includes('token=')) {
        return request;
      }

      const url = new URL(request.url);
      url.searchParams.set('token', token);

      return {
        ...request,
        url: url.toString(),
      };
    });
  }

  const drmConfig = input.drmConfig;

  if (!drmConfig || !input.provider.setProtectionData) {
    return;
  }

  try {
    input.provider.setProtectionData({
      'org.w3.clearkey': {
        clearkeys: {
          [drmConfig.keyId]: drmConfig.key,
        },
      },
    });
  }
  catch {
    // Preserve the last good playback session if DRM reattachment fails mid-stream.
  }
}
