# Server Composition Root

This directory owns server-side dependency assembly.

Routes should consume prewired handlers or factories from here instead of instantiating repositories, DB adapters, FFmpeg services, or DRM services directly.
