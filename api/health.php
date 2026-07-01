<?php
// Health Check API
// Load config for CORS headers and session
require_once __DIR__ . '/config.php';

// Override any previous output from config.php
// Config sets Content-Type but health.php returns a different JSON shape

$llmApiKey = getenv('LLM_API_KEY') ?: '';
$googleClientId = getenv('GOOGLE_CLIENT_ID') ?: '';
$wechatAppId = getenv('WECHAT_APP_ID') ?: '';

echo json_encode([
    'status' => 'ok',
    'llmConfigured' => !empty($llmApiKey),
    'googleAuthConfigured' => !empty($googleClientId),
    'wechatAuthConfigured' => !empty($wechatAppId),
], JSON_UNESCAPED_UNICODE);
