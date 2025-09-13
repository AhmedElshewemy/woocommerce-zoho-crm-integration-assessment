#!/bin/bash
# ================================
# Refresh Zoho CRM Access Token
# and update .env file
# ================================

# Load environment variables
source .env

# Request new access token
RESPONSE=$(curl -s -X POST "$ZOHO_ACCOUNTS_URL/oauth/v2/token" \
  -d "refresh_token=$ZOHO_REFRESH_TOKEN" \
  -d "client_id=$ZOHO_CLIENT_ID" \
  -d "client_secret=$ZOHO_CLIENT_SECRET" \
  -d "grant_type=refresh_token")

# Extract access_token using jq (JSON parser)
ACCESS_TOKEN=$(echo $RESPONSE | jq -r '.access_token')

if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to refresh token!"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "✅ Got new access token: $ACCESS_TOKEN"

# Replace or append ZOHO_ACCESS_TOKEN in .env
if grep -q "ZOHO_ACCESS_TOKEN=" .env; then
  sed -i "s|^ZOHO_ACCESS_TOKEN=.*|ZOHO_ACCESS_TOKEN=$ACCESS_TOKEN|" .env
else
  echo "ZOHO_ACCESS_TOKEN=$ACCESS_TOKEN" >> .env
fi

echo "✅ Updated .env with new access token"
echo "Please restart your server to use the new token."