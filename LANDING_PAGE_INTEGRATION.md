# Landing Page Integration Guide

To allow users to download ExternAI from your existing landing page, follow these steps to link your build assets correctly.

## 1. Automated GitHub Releases (Recommended)
I have added a **GitHub Actions Workflow** to your project. This means you no longer have to build files manually on your computer!

### How to trigger a new release:
1. **Push your code** to GitHub.
2. **Create a Tag**: In your terminal, run these commands:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. **Wait**: GitHub will automatically start building for **Windows, Mac, and Linux** and create a release for you!

## 2. Add Download Logic to Your Landing Page
Add this script to your landing page's `<head>` or before the closing `</body>` tag to automatically detect the user's OS and provide the correct link.

### HTML Example
```html
<a href="#" id="download-btn" class="btn-primary">
    Download for your OS
</a>
```

### JavaScript Implementation
Copy and paste this script into your landing page:

```javascript
// Detect OS and set appropriate download link
function updateDownloadLink() {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;
    const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
    const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
    
    let downloadUrl = 'https://github.com/Luncedo1234/Extern/releases/latest';
    let osLabel = 'Download Now';

    if (macosPlatforms.indexOf(platform) !== -1) {
        // macOS - Pointing to the specific asset names created by electron-builder
        downloadUrl = 'https://github.com/Luncedo1234/Extern/releases/latest/download/ExternAI-arm64.dmg';
        osLabel = 'Download for macOS';
    } else if (windowsPlatforms.indexOf(platform) !== -1) {
        // Windows
        downloadUrl = 'https://github.com/Luncedo1234/Extern/releases/latest/download/ExternAI-Setup.exe';
        osLabel = 'Download for Windows';
    }

    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.href = downloadUrl;
        downloadBtn.textContent = osLabel;
    }
}

// Initialize on page load
window.addEventListener('load', updateDownloadLink);
```

## 3. Direct Links (Optional)
If you prefer static buttons, use these direct links:
- **macOS (Universal/Apple Silicon)**: `https://github.com/Luncedo1234/Extern/releases/latest/download/ExternAI-arm64.dmg`
- **macOS (Intel)**: `https://github.com/Luncedo1234/Extern/releases/latest/download/ExternAI-x64.dmg`
- **Windows**: `https://github.com/Luncedo1234/Extern/releases/latest/download/ExternAI-Setup.exe`
