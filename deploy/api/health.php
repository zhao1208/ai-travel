<?php
// Health Check API
require_once __DIR__ . '/config.php';

$llmApiKey = getenv('LLM_API_KEY') ?: '';
$googleClientId = getenv('GOOGLE_CLIENT_ID') ?: '';
$wechatAppId = getenv('WECHAT_APP_ID') ?: '';

jsonResponse(true, '', [
    'status' => 'ok',
    'llmConfigured' => !empty($llmApiKey),
    'googleAuthConfigured' => !empty($googleClientId),
    'wechatAuthConfigured' => !empty($wechatAppId),
]);
