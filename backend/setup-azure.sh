#!/bin/bash

# Azure App Service Setup Script (No Docker)
# Run this to create your backend infrastructure on Azure

# Configuration
RG_NAME="externai-rg-prod"
LOCATION="eastus"
PLAN_NAME="externai-plan-prod"
APP_NAME="externai-backend-production" # Must be globally unique!
RUNTIME="NODE|20-lts"

echo "🚀 Starting Azure Setup..."

# 1. Create Resource Group
echo "📦 Creating Resource Group: $RG_NAME..."
az group create --name $RG_NAME --location $LOCATION

# 2. Create App Service Plan (Free Tier for testing, use B1 for production)
echo "🏗️ Creating App Service Plan (Free Tier)..."
az appservice plan create --name $PLAN_NAME --resource-group $RG_NAME --sku F1 --is-linux

# 3. Create Web App
echo "🌐 Creating Web App: $APP_NAME..."
az webapp create --name $APP_NAME --resource-group $RG_NAME --plan $PLAN_NAME --runtime "$RUNTIME"

# 4. Configure Environment Variables (Placeholders - You MUST update these!)
echo "⚙️ Configuring Environment Variables..."
az webapp config appsettings set --name $APP_NAME --resource-group $RG_NAME --settings \
  FIREBASE_PROJECT_ID="REPLACE_ME" \
  FIREBASE_CLIENT_EMAIL="REPLACE_ME" \
  FIREBASE_PRIVATE_KEY="REPLACE_ME" \
  ANTHROPIC_API_KEY="REPLACE_ME"

# 5. Get Publish Profile for GitHub Actions
echo "🔑 Getting Publish Profile..."
az webapp deployment list-publishing-profiles --name $APP_NAME --resource-group $RG_NAME --xml > publish_profile.xml

echo "✅ Setup Complete!"
echo "---------------------------------------------------"
echo "👉 NEXT STEPS:"
echo "1. Open 'publish_profile.xml' and copy the entire content."
echo "2. Go to your GitHub Repo -> Settings -> Secrets -> Actions"
echo "3. Create a New Repository Secret named 'AZURE_WEBAPP_PUBLISH_PROFILE'"
echo "4. Paste the XML content and save."
echo "5. Delete 'publish_profile.xml' from your computer."
echo "6. Go to the Azure Portal and update the 'FIREBASE_...' and 'ANTHROPIC_...' settings with your real keys."
