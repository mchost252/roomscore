#!/bin/bash
# Local Development Setup Script
# Run this once to set up local SQLite database

echo "📦 Installing dependencies..."
cd "$(dirname "$0")"
npm install

echo "🗄️  Setting up local SQLite database..."
npx prisma generate

echo "📊 Pushing schema to local database..."
npx prisma db push

echo "✅ Local setup complete!"
echo ""
echo "To run the backend locally:"
echo "  npm run dev"
echo ""
echo "To switch back to Supabase:"
echo "  Remove or rename .env.local"
echo "  DATABASE_URL in .env will be used instead"
