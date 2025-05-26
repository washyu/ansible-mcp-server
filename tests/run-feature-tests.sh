#!/bin/bash

# Simple Feature Test Runner
set -e

ENVIRONMENT="dev"
VERBOSE=false
DRY_RUN=false

# Parse flags
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--verbose] [--dry-run] [ENVIRONMENT]"
            echo "Environments: dev, qa, staging, prod"
            exit 0
            ;;
        dev|qa|staging|prod)
            ENVIRONMENT="$1"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [[ "$DRY_RUN" == "true" ]]; then
    echo "Would run feature tests for environment: $ENVIRONMENT"
    exit 0
fi

echo "Running VM Lifecycle Feature Tests..."
echo "Environment: $ENVIRONMENT"

# Check if config exists
CONFIG_FILE="./tests/config/environments/${ENVIRONMENT}.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "Error: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Run the test
if [[ "$VERBOSE" == "true" ]]; then
    node tests/feature/vm-lifecycle-feature.test.js "$ENVIRONMENT"
else
    node tests/feature/vm-lifecycle-feature.test.js "$ENVIRONMENT" 2>&1
fi