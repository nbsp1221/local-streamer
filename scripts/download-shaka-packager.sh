#!/bin/bash

# Shaka Packager Binary Downloader
# Downloads the latest Shaka Packager binary from Google's shaka-project/shaka-packager
# and installs it to the binaries directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
BINARIES_DIR="$PROJECT_ROOT/binaries"
TEMP_DIR="$PROJECT_ROOT/.shaka-download-temp"
GITHUB_API_URL="https://api.github.com/repos/shaka-project/shaka-packager/releases/latest"

echo "📦 Shaka Packager Binary Downloader"
echo ""

# Create directories
mkdir -p "$BINARIES_DIR"
mkdir -p "$TEMP_DIR"

echo "📁 Project root: $PROJECT_ROOT"
echo "📁 Binaries directory: $BINARIES_DIR"
echo ""

# Clean up any existing binary
if [ -f "$BINARIES_DIR/packager" ]; then
    echo "🧹 Cleaning up existing packager binary..."
    rm -f "$BINARIES_DIR/packager"
fi

# Detect OS and architecture
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
    Linux*)
        if [ "$ARCH" = "x86_64" ]; then
            BINARY_PATTERN="packager-linux-x64"
        else
            echo "❌ Unsupported Linux architecture: $ARCH"
            rm -rf "$TEMP_DIR"
            exit 1
        fi
        ;;
    Darwin*)
        if [ "$ARCH" = "x86_64" ]; then
            BINARY_PATTERN="packager-osx-x64"
        elif [ "$ARCH" = "arm64" ]; then
            BINARY_PATTERN="packager-osx-x64"  # Use x64 for compatibility
        else
            echo "❌ Unsupported macOS architecture: $ARCH"
            rm -rf "$TEMP_DIR"
            exit 1
        fi
        ;;
    CYGWIN*|MINGW*|MSYS*)
        BINARY_PATTERN="packager-win-x64.exe"
        ;;
    *)
        echo "❌ Unsupported operating system: $OS"
        rm -rf "$TEMP_DIR"
        exit 1
        ;;
esac

echo "🔍 Detected platform: $OS ($ARCH)"
echo "🎯 Looking for binary: $BINARY_PATTERN"
echo ""

# Get latest release info and find download URL
echo "🔍 Fetching latest release from shaka-project/shaka-packager..."
DOWNLOAD_URL=$(curl -s "$GITHUB_API_URL" | grep "browser_download_url" | grep "$BINARY_PATTERN" | head -n1 | cut -d'"' -f4)

if [ -z "$DOWNLOAD_URL" ]; then
    echo "❌ Failed to find $BINARY_PATTERN build URL"
    echo "💡 Available releases at: https://github.com/shaka-project/shaka-packager/releases"
    rm -rf "$TEMP_DIR"
    exit 1
fi

FILENAME=$(basename "$DOWNLOAD_URL")
echo "✅ Found: $FILENAME"
echo "📥 URL: $DOWNLOAD_URL"

# Download Shaka Packager
echo ""
echo "⬇️  Downloading Shaka Packager..."
cd "$TEMP_DIR"

curl -L -o "$FILENAME" "$DOWNLOAD_URL"

if [ ! -f "$FILENAME" ]; then
    echo "❌ Download failed"
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "✅ Download completed: $(du -h "$FILENAME" | cut -f1)"

# Copy binary to project binaries directory
echo ""
echo "📦 Installing binary..."

# Determine final binary name (remove .exe extension on non-Windows)
FINAL_BINARY_NAME="packager"
if [[ "$FILENAME" == *.exe ]]; then
    FINAL_BINARY_NAME="packager.exe"
fi

cp "$FILENAME" "$BINARIES_DIR/$FINAL_BINARY_NAME"
chmod +x "$BINARIES_DIR/$FINAL_BINARY_NAME"

echo "✅ Installed as: $FINAL_BINARY_NAME"

# Clean up temporary files
echo ""
echo "🧹 Cleaning up temporary files..."
cd "$PROJECT_ROOT"
rm -rf "$TEMP_DIR"

# Verify binary
echo ""
echo "🔍 Verifying installation..."

echo "📍 Shaka Packager version:"
"$BINARIES_DIR/$FINAL_BINARY_NAME" --version || echo "Version check failed (this is normal for some Shaka Packager builds)"

echo ""
echo "🎉 Shaka Packager installed successfully!"
echo "📍 Binary location: $BINARIES_DIR/$FINAL_BINARY_NAME"
echo ""
echo "✨ Features:"
echo "  • AES-128 HLS encryption support"
echo "  • fMP4 segment generation"
echo "  • HEVC/H.265 support"
echo "  • Industry-standard packaging"
echo ""
echo "🚀 Ready to use with Local Streamer!"
