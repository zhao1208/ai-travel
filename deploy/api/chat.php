<?php
// Chat API - POST /api/chat
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
$messages = $input['messages'] ?? [];

if (empty($messages)) {
    jsonResponse(false, 'Messages are required');
}

// Check if LLM API is configured
$llmApiKey = getenv('LLM_API_KEY') ?: '';
$llmApiUrl = getenv('LLM_API_URL') ?: 'https://api.xiaomimimo.com/v1/chat/completions';
$llmModel = getenv('LLM_MODEL') ?: 'mimo-v2-flash';

if (!empty($llmApiKey)) {
    // Call real LLM API
    $response = callLLMAPI($llmApiKey, $llmApiUrl, $llmModel, $messages);
} else {
    // Use built-in mock responses
    $response = getMockResponse($messages);
}

echo json_encode(['content' => $response], JSON_UNESCAPED_UNICODE);
exit;

function callLLMAPI($apiKey, $apiUrl, $model, $messages) {
    $data = [
        'model' => $model,
        'messages' => $messages,
        'stream' => false,
    ];

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $result = json_decode($response, true);
        if (isset($result['choices'][0]['message']['content'])) {
            return $result['choices'][0]['message']['content'];
        }
    }

    // Fallback to mock response
    return getMockResponse($messages);
}

function getMockResponse($messages) {
    $lastMsg = strtolower($messages[count($messages) - 1]['content'] ?? '');

    if (preg_match('/shanghai|上海|plan|行程/i', $lastMsg)) {
        return "Great choice! Here's a 3-day Shanghai itinerary:\n\n**Day 1: Classic Shanghai**\n• Morning: The Bund waterfront walk\n• Afternoon: Yu Garden & Old City\n• Evening: Nanjing Road shopping + dinner\n\n**Day 2: Modern Shanghai**\n• Morning: Shanghai Tower (tallest building)\n• Afternoon: Art Museum or Tianzifang\n• Evening: Xintiandi nightlife\n\n**Day 3: Local Experience**\n• Morning: French Concession walking\n• Afternoon: Propaganda Poster Museum\n• Evening: Huangpu River cruise\n\nWant me to add restaurant recommendations or help with transportation?";
    }

    if (preg_match('/food|restaurant|美食|吃/i', $lastMsg)) {
        return "Here are some must-try Chinese foods:\n\n🍜 **Xiaolongbao** (小笼包) - Soup dumplings\n🥘 **Mapo Tofu** (麻婆豆腐) - Spicy tofu\n🥟 **Dumplings** (饺子) - Various fillings\n🦆 **Peking Duck** (北京烤鸭) - Iconic Beijing dish\n\nLocal tip: Look for restaurants with many locals - that's usually a good sign!";
    }

    if (preg_match('/translate|翻译|say/i', $lastMsg)) {
        return "I can help with translation! What phrase would you like me to translate? Just tell me what you need in English or Chinese, and I'll provide the translation with pinyin pronunciation.";
    }

    if (preg_match('/emergency|紧急|help/i', $lastMsg)) {
        return "Important emergency information:\n\n🆘 **Emergency Numbers in China:**\n• Police: **110**\n• Ambulance: **120**\n• Fire: **119**\n\nEssential phrases:\n• Help! = 救命! (Jiùmìng!)\n• Call the police = 报警 (Bàojǐng)\n• Hospital = 医院 (Yīyuàn)\n• I need help = 我需要帮助 (Wǒ xūyào bāngzhù)";
    }

    if (preg_match('/[\x{4e00}-\x{9fa5}]/u', $lastMsg)) {
        return "好的！我理解你的问题： \"$lastMsg\"\n\n我可以帮你：\n• 规划行程安排\n• 推荐美食餐厅\n• 翻译中英文\n• 提供交通建议\n• 介绍中国文化\n\n请告诉我你需要什么帮助？";
    }

    return "Hi! I'm your AI travel assistant for China. I can help you with:\n\n🗺️ **Trip Planning** - Itineraries for any city\n🍜 **Food Recommendations** - Local specialties\n🌐 **Translation** - Chinese ↔ English phrases\n🚇 **Transport Tips** - Metro, taxi, high-speed rail\n📍 **City Guides** - Attractions, culture, tips\n\nWhat would you like to know about traveling in China?";
}
