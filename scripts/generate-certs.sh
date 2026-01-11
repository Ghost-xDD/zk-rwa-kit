#!/bin/bash
# Generate self-signed certificates for local HTTPS development

set -e

CERTS_DIR="./certs"
DOMAIN="localhost"

echo "🔐 Generating self-signed certificates for $DOMAIN..."

# Create certs directory
mkdir -p "$CERTS_DIR"

# Generate private key and certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/privkey.pem" \
  -out "$CERTS_DIR/fullchain.pem" \
  -subj "/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:mockbank.local,IP:127.0.0.1"

echo "✅ Certificates generated in $CERTS_DIR/"
echo ""
echo "Files created:"
echo "  - $CERTS_DIR/privkey.pem (private key)"
echo "  - $CERTS_DIR/fullchain.pem (certificate)"
echo ""
echo "⚠️  To trust the certificate on macOS, run:"
echo "    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERTS_DIR/fullchain.pem"
echo ""
echo "⚠️  Add to /etc/hosts if using mockbank.local:"
echo "    echo '127.0.0.1 mockbank.local' | sudo tee -a /etc/hosts"
