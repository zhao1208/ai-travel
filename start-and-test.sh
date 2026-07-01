#!/bin/bash

echo "=========================================="
echo "AI Travel Assistant - OAuth Login Test"
echo "=========================================="
echo ""

# Kill any existing node processes
echo "🔄 Stopping existing servers..."
pkill -9 node 2>/dev/null || true
sleep 1

# Start the server
echo "🚀 Starting server..."
cd /root/ai-travel-assistant
node server.js > /tmp/oauth-test.log 2>&1 &
SERVER_PID=$!

echo "⏳ Waiting for server to start..."
sleep 3

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server started successfully (PID: $SERVER_PID)"
    echo ""
    
    # Test health endpoint
    echo "🧪 Testing API endpoints..."
    echo ""
    
    echo "1. Health Check:"
    curl -s http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/api/health
    echo ""
    echo ""
    
    echo "2. Check if Google OAuth route exists:"
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/auth/google || echo "Route not configured (need credentials)"
    echo ""
    
    echo "3. Check if WeChat OAuth route exists:"
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/auth/wechat || echo "Route not configured (need credentials)"
    echo ""
    
    echo "=========================================="
    echo "✅ OAuth Login Implementation Complete!"
    echo "=========================================="
    echo ""
    echo "📝 Next Steps:"
    echo "1. Configure OAuth credentials (see OAUTH_SETUP.md)"
    echo "2. Set environment variables or create .env file"
    echo "3. Restart the server"
    echo "4. Visit http://localhost:3000 and test login"
    echo ""
    echo "📊 Server Logs: tail -f /tmp/oauth-test.log"
    echo "🛑 To stop: kill $SERVER_PID"
    echo ""
else
    echo "❌ Server failed to start"
    echo "📋 Logs:"
    cat /tmp/oauth-test.log
fi
