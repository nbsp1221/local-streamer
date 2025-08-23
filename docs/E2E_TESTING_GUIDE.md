# End-to-End Testing Guide

This guide provides instructions for AI assistants to perform comprehensive end-to-end testing of the Local Streamer application.

## Prerequisites

1. **Start Development Server**
   ```bash
   bun dev
   ```
   The application will be available at `http://localhost:5173`

## Testing Tools

### Primary Tool: cURL
- Use cURL for API endpoint testing and most server interactions
- Preferred for authentication, file operations, and API validation

### Secondary Tool: Playwright
- Use Playwright for browser-based testing when cURL is insufficient
- Required for UI interactions, video playback testing, and complex user flows

## Test Credentials

**Administrator Account:**
- **Email:** `admin@admin.com`
- **Password:** `admin@admin.com`

## Test Assets

### Video Files
- **Primary Test Video:** `./data/test-videos/playtime.mp4`
- **Alternative Test Video:** `./data/test-videos/bunny.mp4` (larger file size)

### Encoding Performance Optimization
- **Recommendation:** Use GPU encoding instead of CPU encoding for faster test execution
- **Exception:** Only use CPU encoding when specifically testing the encoding functionality itself

## Important Notes

- **Security:** All video content is encrypted with AES-128
- **Performance:** GPU encoding significantly reduces test execution time
- **Authentication:** JWT tokens are required for video resource access
- **File Structure:** Videos are stored in UUID-based directories under `data/videos/`
