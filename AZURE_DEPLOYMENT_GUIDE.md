# Azure App Service Deployment Guide

## Prerequisites

1. **Azure Account**: Sign up at https://portal.azure.com
2. **Azure CLI**: Install from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

## Quick Deployment Steps

### 1. Install Azure CLI

**macOS:**
```bash
brew install azure-cli
```

**Or download from:** https://aka.ms/installazureclimacos

### 2. Login to Azure

```bash
az login
```

This will open your browser for authentication.

### 3. Create Resource Group

```bash
az group create --name eletr0-backend-rg --location eastus
```

### 4. Create App Service Plan (Free Tier)

```bash
az appservice plan create \
  --name eletr0-backend-plan \
  --resource-group eletr0-backend-rg \
  --sku F1 \
  --is-linux
```

**Note:** F1 is free tier. For production, use B1 ($13/month) or higher.

### 5. Create Web App

```bash
az webapp create \
  --name eletr0-backend \
  --resource-group eletr0-backend-rg \
  --plan eletr0-backend-plan \
  --runtime "NODE:18-lts"
```

**Your backend URL will be:** `https://eletr0-backend.azurewebsites.net`

### 6. Configure Environment Variables

```bash
az webapp config appsettings set \
  --name eletr0-backend \
  --resource-group eletr0-backend-rg \
  --settings \
    FIREBASE_PROJECT_ID="your-project-id" \
    FIREBASE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com" \
    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Key-Here\n-----END PRIVATE KEY-----" \
    ANTHROPIC_API_KEY="sk-ant-api03-..." \
    ALLOWED_ORIGINS="*" \
    NODE_ENV="production" \
    MAX_LIFETIME_REQUESTS="20"
```

### 7. Configure Deployment from GitHub

**Option A: Using Azure CLI**

```bash
# Connect your GitHub repo
az webapp deployment source config \
  --name eletr0-backend \
  --resource-group eletr0-backend-rg \
  --repo-url https://github.com/Luncedo1234/Extern \
  --branch main \
  --manual-integration

# Set deployment path to backend folder
az webapp config appsettings set \
  --name eletr0-backend \
  --resource-group eletr0-backend-rg \
  --settings \
    PROJECT="backend"
```

**Option B: Using Azure Portal** (Easier)

1. Go to https://portal.azure.com
2. Find your app: `eletr0-backend`
3. Go to **Deployment Center**
4. Select **GitHub**
5. Authorize and select:
   - **Organization:** Luncedo1234
   - **Repository:** Extern
   - **Branch:** main
6. Click **Save**

### 8. Configure Build Settings

In Azure Portal → Your App → **Configuration** → **General settings**:
- **Startup Command:** `cd backend && node server.js`

Or using CLI:
```bash
az webapp config set \
  --name eletr0-backend \
  --resource-group eletr0-backend-rg \
  --startup-file "cd backend && node server.js"
```

### 9. Enable Logging (for debugging)

```bash
az webapp log config \
  --name eletr0-backend \
  --resource-group eletr0-backend-rg \
  --application-logging filesystem \
  --detailed-error-messages true \
  --failed-request-tracing true \
  --web-server-logging filesystem
```

### 10. View Logs

```bash
# Stream live logs
az webapp log tail \
  --name eletr0-backend \
  --resource-group eletr0-backend-rg

# Or in portal: Log stream section
```

### 11. Test Deployment

```bash
curl https://eletr0-backend.azurewebsites.net/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-12T...",
  "uptime": 123.45,
  "environment": "production"
}
```

---

## Update Frontend to Use Azure Backend

### 1. Update Environment Variable

Create/update `.env` in project root:
```bash
VITE_BACKEND_URL=https://eletr0-backend.azurewebsites.net
```

### 2. Rebuild Application

```bash
cd /Users/sonelisepakade/Desktop/eletr0
npm run build
```

### 3. Test

```bash
npm start
# Or distribute the build
```

---

## Troubleshooting

### App Won't Start

**Check logs:**
```bash
az webapp log tail --name eletr0-backend --resource-group eletr0-backend-rg
```

**Common issues:**
1. **Wrong startup command** - Set to: `cd backend && node server.js`
2. **Missing environment variables** - Verify all vars are set
3. **Port binding** - App should use `process.env.PORT` (Azure sets this automatically)

### 502 Bad Gateway

**Check:**
1. App is listening on `0.0.0.0` not `localhost` ✅ (already done)
2. App is using `process.env.PORT` ✅ (already done)
3. Health check endpoint is working
4. No syntax errors in code

### Environment Variables Not Working

**View current settings:**
```bash
az webapp config appsettings list \
  --name eletr0-backend \
  --resource-group eletr0-backend-rg
```

### Deployment Not Triggering

**Manually trigger:**
```bash
az webapp deployment source sync \
  --name eletr0-backend \
  --resource-group eletr0-backend-rg
```

---

## Upgrading from Free Tier

When you need better performance:

```bash
# Upgrade to Basic B1 ($13/month)
az appservice plan update \
  --name eletr0-backend-plan \
  --resource-group eletr0-backend-rg \
  --sku B1

# Or Standard S1 ($55/month) for auto-scaling
az appservice plan update \
  --name eletr0-backend-plan \
  --resource-group eletr0-backend-rg \
  --sku S1
```

---

## Monitoring & Scaling

### View Metrics

```bash
az monitor metrics list \
  --resource "/subscriptions/YOUR-SUB/resourceGroups/eletr0-backend-rg/providers/Microsoft.Web/sites/eletr0-backend"
```

### Auto-scaling (Standard tier and above)

In Azure Portal → Your App → **Scale out (App Service plan)**

---

## Cost Estimate

- **Free Tier (F1):** $0/month - Good for testing
- **Basic B1:** ~$13/month - Good for production with moderate traffic
- **Standard S1:** ~$55/month - Auto-scaling, staging slots
- **Premium P1V2:** ~$96/month - Better performance, more features

**Egress (data transfer):** First 100GB free, then $0.087/GB

---

## Useful Commands

```bash
# Restart app
az webapp restart --name eletr0-backend --resource-group eletr0-backend-rg

# Stop app
az webapp stop --name eletr0-backend --resource-group eletr0-backend-rg

# Start app
az webapp start --name eletr0-backend --resource-group eletr0-backend-rg

# Delete everything (be careful!)
az group delete --name eletr0-backend-rg --yes
```

---

## Security Best Practices

1. **Use Key Vault for secrets** (recommended for production)
2. **Enable HTTPS only** (already default)
3. **Set up CORS properly** (change `ALLOWED_ORIGINS` from `*` to your domain)
4. **Enable Application Insights** for monitoring

---

## Next Steps

1. Deploy to Azure using the steps above
2. Test the health endpoint
3. Update your Electron app's `.env` with the Azure URL
4. Rebuild and test the full application
5. Monitor logs for any issues

---

**Your Backend URL:** `https://eletr0-backend.azurewebsites.net`

Replace `eletr0-backend` with your chosen app name (must be globally unique).

**Last Updated:** January 12, 2026
