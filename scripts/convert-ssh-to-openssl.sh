#!/bin/bash

# Convert SSH format RSA key to OpenSSL PEM format for Wise SCA
# This fixes the 403 SCA authentication error

set -e

echo "🔧 Converting SSH RSA Key to OpenSSL PEM Format"
echo ""

if [ ! -f "wise_sca_key" ]; then
  echo "❌ Error: wise_sca_key file not found"
  echo "   Please run this script from the directory containing your SSH key"
  exit 1
fi

# Check if key is in SSH format
if grep -q "BEGIN OPENSSH PRIVATE KEY" wise_sca_key; then
  echo "✓ Found SSH format key (OPENSSH PRIVATE KEY)"
  echo ""

  # Convert SSH format to OpenSSL PEM format
  echo "Converting to OpenSSL PEM format..."
  ssh-keygen -p -N "" -m pem -f wise_sca_key

  echo ""
  echo "✅ Conversion successful!"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 NEXT STEPS:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "1️⃣  Verify the conversion:"
  echo "   $ head -1 wise_sca_key"
  echo "   Should show: -----BEGIN RSA PRIVATE KEY-----"
  echo ""
  echo "2️⃣  Update Railway environment variable:"
  echo "   • Go to Railway Dashboard"
  echo "   • Select: business-accounting-system"
  echo "   • Click: Variables tab"
  echo "   • Update WISE_PRIVATE_KEY with new content:"
  echo ""
  echo "   To copy to clipboard (macOS):"
  echo "   $ cat wise_sca_key | pbcopy"
  echo ""
  echo "3️⃣  Wait for Railway to redeploy (~2 minutes)"
  echo ""
  echo "4️⃣  Test the sync:"
  echo "   • Visit: https://ds-accounting.netlify.app"
  echo "   • Go to: Wise Sync tab"
  echo "   • Click: 'Sync All History'"
  echo "   • Should now fetch transactions successfully! 🎉"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

elif grep -q "BEGIN RSA PRIVATE KEY" wise_sca_key; then
  echo "✓ Key is already in OpenSSL PEM format (RSA PRIVATE KEY)"
  echo ""
  echo "✅ No conversion needed!"
  echo ""
  echo "If you're still getting 403 errors, the issue might be:"
  echo "1. Public key in Wise doesn't match this private key"
  echo "2. Key wasn't properly uploaded to Railway"
  echo ""
  echo "To update Railway with this key:"
  echo "$ cat wise_sca_key | pbcopy"
  echo ""

else
  echo "❌ Error: Unrecognized key format"
  echo "   Please ensure this is a valid RSA private key"
  exit 1
fi
