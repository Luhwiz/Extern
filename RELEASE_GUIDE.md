# ExternAI Distribution Guide

This guide explains the professional distribution system for ExternAI, inspired by Cursor's approach.

## Overview

ExternAI uses a three-part distribution system:
1. **Automated builds** via GitHub Actions
2. **Branded download website** with OS detection
3. **Auto-updates** using electron-updater

## 🚀 Release Process

### 1. Prepare for Release

```bash
# 1. Update version in package.json
npm version patch  # or minor, or major

# 2. Commit changes
git add .
git commit -m "Release v1.0.1"

# 3. Create and push tag
git tag v1.0.1
git push origin main --tags
```

### 2. Automated Build & Publish

Once you push a tag (e.g., `v1.0.1`), GitHub Actions automatically:
- ✅ Builds for macOS (Intel + Apple Silicon)
- ✅ Builds for Windows (x64 + x86)
- ✅ Builds for Linux (AppImage, .deb, .rpm)
- ✅ Creates GitHub Release with all installers
- ✅ Generates update manifest files (`latest-mac.yml`, `latest.yml`, `latest-linux.yml`)

**No manual work required!**

### 3. Users Download from Website

Users visit your website (`externai.com` or `externai.vercel.app`) and see:
- Automatic OS detection
- Single "Download for [Your OS]" button
- Links to other platforms
- Latest version number from GitHub API

## 🔄 Auto-Update System

### How It Works

1. **App starts** → Checks GitHub for updates
2. **Update found** → Shows dialog to download
3. **User clicks "Download"** → Downloads in background
4. **Download complete** → Prompts to restart
5. **User restarts** → New version installed

### Update Checking

- Checks on app startup (production only)
- Re-checks every 4 hours
- Silent in development mode

### Update Flow

```
┌─────────────┐
│  App Start  │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Check GitHub API │
│ (latest.yml)     │
└──────┬───────────┘
       │
       ├── No Update ──> Continue
       │
       └── Update Available
                │
                ▼
       ┌────────────────┐
       │  Show Dialog   │
       │ "Download Now?"│
       └────────┬───────┘
                │
                ├── Later ──> Continue
                │
                └── Download
                         │
                         ▼
                ┌─────────────────┐
                │ Download Update │
                │ (Background)    │
                └────────┬────────┘
                         │
                         ▼
                ┌──────────────────┐
                │   Show Dialog    │
                │ "Restart to      │
                │  Install?"       │
                └────────┬─────────┘
                         │
                         ├── Later ──> Install on Quit
                         │
                         └── Restart
                                  │
                                  ▼
                          ┌──────────────┐
                          │   Updated!   │
                          └──────────────┘
```

## 🌐 Website Deployment

### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd website
vercel

# Set custom domain
vercel domains add externai.com
```

### Option 2: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd website
netlify deploy --prod
```

### Option 3: GitHub Pages

```bash
# Push website folder to gh-pages branch
git subtree push --prefix website origin gh-pages

# Access at: https://luncedo202.github.io/-externai-Desktop
```

## 📦 Build Configuration

### package.json

```json
{
  "build": {
    "appId": "com.externai.ide",
    "productName": "ExternAI",
    "publish": {
      "provider": "github",
      "owner": "Luncedo1234",
      "repo": "Extern"
    }
  }
}
```

### File Outputs

After build (`npm run dist:mac`):

```
dist/
├── ExternAI-x64.dmg           # Intel Mac
├── ExternAI-arm64.dmg         # Apple Silicon
├── ExternAI-x64.zip           # Intel Mac (alternative)
├── ExternAI-arm64.zip         # Apple Silicon (alternative)
├── latest-mac.yml             # Update manifest for Mac
├── ExternAI-Setup.exe         # Windows installer
├── ExternAI-x.x.x.exe         # Windows portable
├── latest.yml                 # Update manifest for Windows
├── ExternAI.AppImage          # Linux AppImage
├── externai_x.x.x_amd64.deb   # Debian/Ubuntu
├── externai-x.x.x.x86_64.rpm  # Fedora/RedHat
└── latest-linux.yml           # Update manifest for Linux
```

## 🔐 Code Signing (Optional but Recommended)

### macOS

1. Get Apple Developer account ($99/year)
2. Create certificates in Xcode
3. Add to GitHub Secrets:
   - `APPLE_ID`
   - `APPLE_ID_PASSWORD` (app-specific password)
   - `APPLE_TEAM_ID`

### Windows

1. Get code signing certificate (DigiCert, Sectigo, etc.)
2. Add to GitHub Secrets:
   - `CSC_LINK` (certificate file in base64)
   - `CSC_KEY_PASSWORD` (certificate password)

## 📊 Monitoring

### Check GitHub Actions

Visit: https://github.com/Luncedo1234/Extern/actions

### Check Releases

Visit: https://github.com/Luncedo1234/Extern/releases

### Update Metrics

Check download stats:
- GitHub release downloads
- Website analytics (Vercel/Netlify dashboard)

## 🐛 Troubleshooting

### Build fails on GitHub Actions

- Check logs in Actions tab
- Verify all dependencies in package.json
- Ensure node-pty rebuilds correctly

### Users not getting updates

- Verify `latest.yml` files are in release
- Check app is in production mode (`app.isPackaged`)
- Verify GitHub release is not a draft

### macOS "App is damaged" error

- Need to code sign the app
- Or users need to run: `xattr -cr /Applications/ExternAI.app`

### Windows SmartScreen warning

- Need code signing certificate
- Or users click "More info" → "Run anyway"

## 🎯 Next Steps

1. **Set up custom domain**: `externai.com`
2. **Add code signing** for trusted installs
3. **Set up analytics** to track downloads
4. **Create landing page** with features, pricing, etc.
5. **Add feedback system** for bug reports

## 📚 Resources

- [electron-builder docs](https://www.electron.build/)
- [electron-updater docs](https://www.electron.build/auto-update)
- [GitHub Actions docs](https://docs.github.com/en/actions)
- [Vercel docs](https://vercel.com/docs)

---

**Ready to release?**

```bash
npm version patch
git push origin main --tags
```

Then watch GitHub Actions build and publish everything automatically! 🚀
