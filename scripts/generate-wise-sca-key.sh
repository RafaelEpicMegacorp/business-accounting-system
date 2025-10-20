#!/bin/bash

# Generate Wise SCA (Strong Customer Authentication) RSA Key Pair
# This script generates the private/public key pair needed for Wise transaction API access

set -e

echo "🔑 Generating Wise SCA RSA Key Pair..."
echo ""

# Check if keys already exist
if [ -f "wise_sca_key" ] || [ -f "wise_sca_key.pub" ]; then
  echo "⚠️  Key files already exist in current directory!"
  echo "   wise_sca_key"
  echo "   wise_sca_key.pub"
  echo ""
  read -p "Overwrite? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
  fi
  rm -f wise_sca_key wise_sca_key.pub
fi

# Generate 4096-bit RSA key pair in OpenSSL PEM format (required for Wise SCA)
# Using -m pem ensures OpenSSL format instead of default OpenSSH format
ssh-keygen -t rsa -b 4096 -m pem -f wise_sca_key -N "" -C "wise-sca-accounting-system"

echo ""
echo "✅ Keys generated successfully!"
echo ""
echo "📁 Files created:"
echo "   • wise_sca_key (private key - keep secret!)"
echo "   • wise_sca_key.pub (public key - upload to Wise)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 NEXT STEPS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Upload PUBLIC key to Wise:"
echo "   • Go to: https://wise.com/settings/api-tokens"
echo "   • Click: 'Manage public keys'"
echo "   • Click: 'Add new public key'"
echo "   • Copy and paste the content below:"
echo ""
echo "━━━ PUBLIC KEY (Copy this) ━━━"
cat wise_sca_key.pub
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "2️⃣  Add PRIVATE key to Railway:"
echo "   • Go to Railway Dashboard"
echo "   • Select: business-accounting-system"
echo "   • Click: Variables tab"
echo "   • Add new variable:"
echo "     Name: WISE_PRIVATE_KEY"
echo "     Value: (content of wise_sca_key file)"
echo ""
echo "   To copy private key to clipboard (macOS):"
echo "   $ cat wise_sca_key | pbcopy"
echo ""
echo "   Or display it:"
echo "   $ cat wise_sca_key"
echo ""
echo "3️⃣  Test the connection:"
echo "   • Wait for Railway to redeploy (~2 minutes)"
echo "   • Visit: https://ds-accounting.netlify.app"
echo "   • Go to: Wise Sync tab"
echo "   • Click: 'Sync All History'"
echo "   • Should see transactions populate!"
echo ""
echo "⚠️  SECURITY:"
echo "   • Keep wise_sca_key SECRET (never commit to git)"
echo "   • wise_sca_key is already in .gitignore"
echo "   • Store backup securely (password manager)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
