interface DrmConfig {
  key: string;
  keyId: string;
}

interface DashPlaybackProviderInstance {
  addRequestInterceptor?: (callback: (request: { url: string }) => Promise<{ url: string }>) => void;
  extend?: (parentNameString: string, childInstance: () => Record<string, unknown>, override: boolean) => void;
  getProtectionController?: () => unknown;
  off?: (event: string, callback: () => void) => void;
  on?: (event: string, callback: () => void) => void;
  setProtectionData?(data: unknown): void;
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
    if (input.provider.addRequestInterceptor) {
      input.provider.addRequestInterceptor(async request => ({
        ...request,
        url: appendPlaybackToken(request.url, token),
      }));
    }
    else if (input.provider.extend) {
      const modifyRequest = (request: { url: string }) => ({
        ...request,
        url: appendPlaybackToken(request.url, token),
      });

      input.provider.extend('RequestModifier', () => ({
        modifyRequest,
        modifyRequestURL: (requestUrl: string) => appendPlaybackToken(requestUrl, token),
      }), true);
    }
  }

  const drmConfig = input.drmConfig;

  if (!drmConfig || !input.provider.setProtectionData) {
    return;
  }

  const attachProtectionData = () => {
    input.provider.setProtectionData?.({
      'org.w3.clearkey': {
        clearkeys: {
          [drmConfig.keyId]: drmConfig.key,
        },
      },
    });
  };

  const tryAttachProtectionData = () => {
    try {
      attachProtectionData();
      return true;
    }
    catch {
      return false;
    }
  };

  try {
    input.provider.getProtectionController?.();
  }
  catch {
    // Some dash.js builds materialize the protection controller lazily and may throw while probing.
  }

  if (tryAttachProtectionData()) {
    return;
  }

  if (input.provider.on && input.provider.off) {
    const handleStreamInitialized = () => {
      input.provider.off?.('streamInitialized', handleStreamInitialized);
      tryAttachProtectionData();
    };

    input.provider.on('streamInitialized', handleStreamInitialized);
  }
}

function appendPlaybackToken(urlValue: string, token: string) {
  const baseOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const isAbsoluteUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(urlValue);
  const url = new URL(urlValue, baseOrigin);

  if (url.searchParams.has('token')) {
    return urlValue;
  }

  url.searchParams.set('token', token);

  if (isAbsoluteUrl) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
