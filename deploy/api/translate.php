<?php
// Translate API - POST /api/translate
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
$text = $input['text'] ?? '';
$from = $input['from'] ?? 'en';
$to = $input['to'] ?? 'zh';

if (empty($text)) {
    jsonResponse(false, 'Text is required');
}

// Check if LLM API is configured
$llmApiKey = getenv('LLM_API_KEY') ?: '';

if (!empty($llmApiKey)) {
    $result = callLLMTranslate($llmApiKey, $text, $from, $to);
} else {
    $result = getBuiltinTranslation($text, $from, $to);
}

echo json_encode($result, JSON_UNESCAPED_UNICODE);
exit;

function callLLMTranslate($apiKey, $text, $from, $to) {
    $llmApiUrl = getenv('LLM_API_URL') ?: 'https://api.xiaomimimo.com/v1/chat/completions';
    $llmModel = getenv('LLM_MODEL') ?: 'mimo-v2-flash';

    $fromLang = $from === 'zh' ? 'Chinese' : 'English';
    $toLang = $to === 'zh' ? 'Chinese' : 'English';

    $systemPrompt = "You are a professional translator. Translate the following {$fromLang} text to {$toLang}. Provide ONLY the translation, no explanations. If it's already in the target language or cannot be translated, return it as-is.";

    $data = [
        'model' => $llmModel,
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $text],
        ],
        'max_tokens' => 512,
        'temperature' => 0.3,
    ];

    $ch = curl_init($llmApiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $result = json_decode($response, true);
        if (isset($result['choices'][0]['message']['content'])) {
            $content = trim($result['choices'][0]['message']['content']);
            return ['text' => $content, 'pinyin' => null];
        }
    }

    return getBuiltinTranslation($text, $from, $to);
}

function getBuiltinTranslation($text, $from, $to) {
    $enToZh = [
        'hello' => ['text' => '你好', 'pinyin' => 'Nǐ hǎo'],
        'thank you' => ['text' => '谢谢', 'pinyin' => 'Xièxiè'],
        'goodbye' => ['text' => '再见', 'pinyin' => 'Zàijiàn'],
        'yes' => ['text' => '是', 'pinyin' => 'Shì'],
        'no' => ['text' => '不是', 'pinyin' => 'Bú shì'],
        'please' => ['text' => '请', 'pinyin' => 'Qǐng'],
        'sorry' => ['text' => '对不起', 'pinyin' => 'Duìbùqǐ'],
        'excuse me' => ['text' => '不好意思', 'pinyin' => 'Bù hǎoyìsi'],
        'how much' => ['text' => '多少钱', 'pinyin' => 'Duōshao qián'],
        'water' => ['text' => '水', 'pinyin' => 'Shuǐ'],
        'food' => ['text' => '食物', 'pinyin' => 'Shíwù'],
        'restaurant' => ['text' => '餐厅', 'pinyin' => 'Cāntīng'],
        'hotel' => ['text' => '酒店', 'pinyin' => 'Jiǔdiàn'],
        'airport' => ['text' => '机场', 'pinyin' => 'Jīchǎng'],
        'train' => ['text' => '火车', 'pinyin' => 'Huǒchē'],
        'taxi' => ['text' => '出租车', 'pinyin' => 'Chūzū chē'],
        'metro' => ['text' => '地铁', 'pinyin' => 'Dìtiě'],
        'bathroom' => ['text' => '洗手间', 'pinyin' => 'Xǐshǒujiān'],
        'help' => ['text' => '救命', 'pinyin' => 'Jiùmìng'],
        'police' => ['text' => '警察', 'pinyin' => 'Jǐngchá'],
        'hospital' => ['text' => '医院', 'pinyin' => 'Yīyuàn'],
        'where' => ['text' => '在哪里', 'pinyin' => 'Zài nǎlǐ'],
        'how' => ['text' => '怎么', 'pinyin' => 'Zěnme'],
        'want' => ['text' => '要', 'pinyin' => 'Yào'],
        'go' => ['text' => '去', 'pinyin' => 'Qù'],
        'i' => ['text' => '我', 'pinyin' => 'Wǒ'],
        'you' => ['text' => '你', 'pinyin' => 'Nǐ'],
        'me' => ['text' => '我', 'pinyin' => 'Wǒ'],
        'to' => ['text' => '到', 'pinyin' => 'Dào'],
    ];

    $zhToEn = [
        '你好' => ['text' => 'Hello'],
        '谢谢' => ['text' => 'Thank you'],
        '再见' => ['text' => 'Goodbye'],
        '是' => ['text' => 'Yes'],
        '不是' => ['text' => 'No'],
        '请' => ['text' => 'Please'],
        '对不起' => ['text' => 'Sorry'],
        '救命' => ['text' => 'Help!'],
        '警察' => ['text' => 'Police'],
        '医院' => ['text' => 'Hospital'],
        '机场' => ['text' => 'Airport'],
        '酒店' => ['text' => 'Hotel'],
        '餐厅' => ['text' => 'Restaurant'],
        '多少钱' => ['text' => 'How much?'],
        '洗手间在哪里' => ['text' => 'Where is the bathroom?'],
    ];

    $lowerText = strtolower($text);

    if ($from === 'en' && $to === 'zh') {
        if (isset($enToZh[$lowerText])) {
            return $enToZh[$lowerText];
        }
        foreach ($enToZh as $key => $val) {
            if (strpos($lowerText, $key) !== false) {
                return $val;
            }
        }
        return ['text' => "【{$text}】", 'pinyin' => '(Translation using AI)'];
    }

    if ($from === 'zh' && $to === 'en') {
        if (isset($zhToEn[$text])) {
            return $zhToEn[$text];
        }
        foreach ($zhToEn as $key => $val) {
            if (strpos($text, $key) !== false) {
                return $val;
            }
        }
        return ['text' => "[{$text}]", 'pinyin' => null];
    }

    return ['text' => $text, 'pinyin' => null];
}
