export interface VideoTokenPayload {
  videoId: string;
  userId: string;
  ip?: string;
  userAgent?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string;
}

export interface ValidateVideoTokenRequest {
  token: string;
  expectedVideoId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ValidateVideoTokenResponse {
  valid: true;
  payload: VideoTokenPayload;
}

export interface ValidateVideoTokenDependencies {
  jwt: {
    verify: (token: string, secret: string, options: any) => any;
    TokenExpiredError: any;
    JsonWebTokenError: any;
  };
  config: {
    jwtSecret: string;
    jwtIssuer: string;
    jwtAudience: string;
  };
  logger?: {
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
  };
}

export interface ExtractVideoTokenRequest {
  request: Request;
}

export interface ExtractVideoTokenResponse {
  token: string | null;
}

export interface ValidateVideoRequestRequest {
  request: Request;
  expectedVideoId?: string;
}

export interface ValidateVideoRequestResponse {
  valid: true;
  payload: VideoTokenPayload;
}

export interface ValidateVideoRequestDependencies {
  tokenExtractor: {
    extractVideoToken: (request: Request) => string | null;
  };
  tokenValidator: {
    validateVideoToken: (token: string, expectedVideoId?: string, ip?: string, userAgent?: string) => Promise<{
      valid: boolean;
      payload?: VideoTokenPayload;
      error?: string;
    }>;
  };
  ipExtractor: {
    getClientIP: (request: Request) => string | undefined;
  };
}
