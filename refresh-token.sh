#!/bin/bash
# ================================
# Refresh Zoho CRM Access Token
# and update .env file
# ================================

# Check for jq dependency
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required but not installed."
    echo "Install with: sudo apt install jq"
    exit 1
fi

# Load environment variables
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    exit 1
fi
source .env

# Validate required variables
for var in ZOHO_REFRESH_TOKEN ZOHO_CLIENT_ID ZOHO_CLIENT_SECRET ZOHO_ACCOUNTS_URL; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env"
        exit 1
    fi
done

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

# Add timestamp to the token
echo "# Last updated: $(date)" >> .env

echo "✅ Updated .env with new access token"
echo "🔄 Please restart your server to use the new token."