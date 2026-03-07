export interface ClearKeyRequest {
  videoId: string;
  request: Request;
}

export interface ClearKeyResponse {
  success: true;
  clearKeyResponse: {
    keys: Array<{
      kty: string;
      kid: string;
      k: string;
    }>;
    type: string;
  };
  headers: Record<string, string>;
}

export interface ClearKeyDependencies {
  jwtValidator: {
    validateVideoRequest: (request: Request, videoId: string) => Promise<{
      valid: boolean;
      error?: string;
      payload?: { userId?: string };
    }>;
  };
  keyManager: {
    hasVideoKey: (videoId: string) => Promise<boolean>;
    getVideoKey: (videoId: string) => Promise<Buffer>;
  };
  keyUtils: {
    generateKeyId: (videoId: string) => string;
    hexToBase64Url: (hex: string) => string;
  };
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}
