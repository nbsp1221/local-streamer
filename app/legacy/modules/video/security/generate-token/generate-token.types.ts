export interface GenerateVideoTokenRequest {
  videoId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface GenerateVideoTokenResponse {
  token: string;
}

export interface GenerateVideoTokenDependencies {
  jwt: {
    sign: (payload: any, secret: string, options: any) => string;
  };
  config: {
    jwtSecret: string;
    jwtIssuer: string;
    jwtAudience: string;
    jwtExpiry: string;
  };
  logger?: {
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
  };
}
