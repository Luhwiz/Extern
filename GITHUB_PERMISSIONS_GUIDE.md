# GitHub Actions Permissions Guide

## Overview
GitHub Actions workflows need specific permissions to create releases, upload artifacts, and publish packages. This guide explains how to configure these permissions correctly.

---

## ✅ What We've Already Fixed

The workflow file now has:
```yaml
permissions:
  contents: write
```

This gives the workflow permission to:
- Create and modify releases
- Push tags
- Commit to the repository
- Upload release assets

---

## 🔧 Step-by-Step: Configure Repository Settings

### **Step 1: Enable Workflow Permissions**

1. Go to your repository on GitHub:
   ```
   https://github.com/Luncedo1234/Extern
   ```

2. Click **Settings** (top right menu)

3. In the left sidebar, scroll down to **Actions** → **General**

4. Scroll to the bottom section: **Workflow permissions**

5. Select one of these options:

   **Option A (Recommended - More Secure):**
   - ✅ Select: **"Read repository contents and packages permissions"**
   - ✅ Check: **"Allow GitHub Actions to create and approve pull requests"**
   
   This limits permissions by default, but our workflow explicitly requests `contents: write`.

   **Option B (Simpler):**
   - ✅ Select: **"Read and write permissions"**
   
   This gives all workflows write access by default.

6. Click **Save** at the bottom

---

## 🔐 Understanding Permission Levels

### **Built-in GITHUB_TOKEN (Current Setup)**
- ✅ Automatically provided to workflows
- ✅ Scoped to the repository
- ✅ Expires after the workflow completes
- ✅ More secure
- ⚠️ Limited to basic operations

### **Personal Access Token (PAT) - If Needed**
Only use if GITHUB_TOKEN fails (it shouldn't with proper settings).

**When to use:**
- Publishing to npm registry
- Triggering workflows from other workflows
- Cross-repository operations

**How to create:**
1. Go to: https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `write:packages` (Upload packages)
4. Copy the token
5. In your repo: Settings → Secrets and variables → Actions → New repository secret
6. Name: `RELEASE_PAT`
7. Value: Paste your token
8. Click **Add secret**

Then update workflow to use it:
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.RELEASE_PAT }}
```

---

## 📋 Current Workflow Permissions Explained

```yaml
permissions:
  contents: write
```

**What this allows:**
- ✅ Create releases
- ✅ Upload release assets (.dmg, .exe, .AppImage)
- ✅ Modify repository contents
- ✅ Push tags
- ✅ Read repository data

**What this doesn't allow:**
- ❌ Publish to npm (needs separate npm token)
- ❌ Modify other repositories
- ❌ Access organization secrets

---

## 🚀 Verify Everything Works

### **Option 1: Check Current Run**
```bash
# View the workflow status
open https://github.com/Luncedo1234/Extern/actions
```

Look for:
- ✅ Green checkmarks on all jobs
- ✅ "Release" job completes successfully
- ✅ Assets appear in the release

### **Option 2: Manual Test**
```bash
# Trigger a test release
npm version patch          # Creates v1.0.1
git push origin main --tags
```

---

## 🐛 Troubleshooting

### **Error: "Resource not accessible by integration" (403)**

**Cause:** Workflow doesn't have write permissions

**Fix:**
1. Check repository Settings → Actions → General → Workflow permissions
2. Ensure either:
   - "Read and write permissions" is selected, OR
   - "Read permissions" with explicit `permissions: contents: write` in workflow

### **Error: "Invalid credentials"**

**Cause:** GITHUB_TOKEN expired or invalid

**Fix:**
- For built-in token: No action needed (auto-generated)
- For PAT: Regenerate token and update secret

### **Error: "refusing to allow a Personal Access Token to create or update workflow"**

**Cause:** PAT is trying to modify `.github/workflows/`

**Fix:**
- Use GITHUB_TOKEN for workflow modifications
- Or give PAT the `workflow` scope

### **Artifacts not uploading**

**Cause:** Files don't exist or wrong path pattern

**Fix:**
```bash
# Check what files were built
ls -la dist/

# Update workflow paths to match actual files
```

---

## 📚 Additional Resources

- [GitHub Actions Permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [Workflow Permissions](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions)
- [Creating a PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

---

## ✨ Quick Checklist

Before running a release:

- [ ] Repository Settings → Actions → General → Workflow permissions is configured
- [ ] Workflow file has `permissions: contents: write`
- [ ] `.env` file is not committed (it's in .gitignore)
- [ ] `package.json` version is updated
- [ ] Changes are committed and pushed
- [ ] Tag is created and pushed: `git push origin v1.0.0`
- [ ] Monitor at: https://github.com/Luncedo1234/Extern/actions

---

## 🎯 Next Steps

1. **Configure Repository Permissions** (Step 1 above) ⬅️ **DO THIS NOW**
2. Wait for current build to complete
3. If it still fails, check the error logs and refer to Troubleshooting section
4. Once successful, test the installers
5. Deploy the download website

---

**Current Status:**
- ✅ Workflow file fixed (removed duplicate permissions)
- ⏳ Waiting for you to configure repository settings
- ⏳ Then we'll recreate the tag to trigger a fresh build
