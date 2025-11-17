#!/bin/bash

# SmartChart Vercel Deployment Script
# This script helps deploy your application to Vercel

set -e  # Exit on any error

echo "🚀 SmartChart Deployment Script"
echo "================================"
echo ""

# Check if vercel is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not installed. Please install Node.js first."
    exit 1
fi

# Function to deploy to production
deploy_production() {
    echo "📦 Building project..."
    npm run build

    echo ""
    echo "🚀 Deploying to production..."
    npx vercel --prod

    echo ""
    echo "✅ Production deployment complete!"
}

# Function to deploy preview
deploy_preview() {
    echo "📦 Building project..."
    npm run build

    echo ""
    echo "🔍 Deploying preview..."
    npx vercel

    echo ""
    echo "✅ Preview deployment complete!"
}

# Function to check environment variables
check_env() {
    echo "🔍 Checking environment variables..."

    if [ ! -f .env ]; then
        echo "⚠️  Warning: .env file not found"
        echo "   Make sure to set environment variables in Vercel dashboard"
    else
        echo "✅ .env file found"

        if grep -q "VITE_ANTHROPIC_API_KEY" .env; then
            echo "✅ VITE_ANTHROPIC_API_KEY is set"
        else
            echo "⚠️  Warning: VITE_ANTHROPIC_API_KEY not found in .env"
        fi

        if grep -q "VITE_GEMINI_API_KEY" .env; then
            echo "✅ VITE_GEMINI_API_KEY is set"
        else
            echo "⚠️  Warning: VITE_GEMINI_API_KEY not found in .env"
        fi
    fi

    echo ""
    echo "📝 Remember to set these environment variables in Vercel:"
    echo "   - VITE_ANTHROPIC_API_KEY"
    echo "   - VITE_GEMINI_API_KEY"
    echo ""
}

# Main menu
echo "What would you like to do?"
echo ""
echo "1) Deploy to Production"
echo "2) Deploy Preview"
echo "3) Check Environment Variables"
echo "4) Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        read -p "⚠️  Are you sure you want to deploy to PRODUCTION? (y/n): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            deploy_production
        else
            echo "❌ Deployment cancelled"
        fi
        ;;
    2)
        deploy_preview
        ;;
    3)
        check_env
        ;;
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac