#!/bin/bash
# Test SSL services after NPM configuration

echo "Testing SSL endpoints..."
echo "========================"

domains=(
    "heimdall.shaunjackson.space"
    "auth.shaunjackson.space"
    "grafana.shaunjackson.space"
    "mail.shaunjackson.space"
    "webmail.shaunjackson.space"
)

for domain in "${domains[@]}"; do
    echo -n "Testing https://$domain - "
    response=$(curl -sI "https://$domain" --max-time 5 | head -1)
    if [[ $response == *"200"* ]] || [[ $response == *"302"* ]] || [[ $response == *"301"* ]]; then
        echo "✓ OK"
    else
        echo "✗ Failed: $response"
    fi
done

echo ""
echo "Certificate check:"
echo "=================="
echo "heimdall.shaunjackson.space certificate:"
echo | openssl s_client -servername heimdall.shaunjackson.space -connect heimdall.shaunjackson.space:443 2>/dev/null | openssl x509 -noout -dates | grep notAfter