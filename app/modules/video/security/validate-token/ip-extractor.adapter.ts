export class IpExtractorAdapter {
  getClientIP(request: Request): string | undefined {
    // Check various headers for client IP
    const forwarded = request.headers.get('X-Forwarded-For');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    const realIP = request.headers.get('X-Real-IP');
    if (realIP) {
      return realIP;
    }

    const cfIP = request.headers.get('CF-Connecting-IP');
    if (cfIP) {
      return cfIP;
    }

    return undefined;
  }
}
