<?php
// Admin API - Model and Prompt Management
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

// All admin actions require admin role
requireAdmin();

switch ($action) {
    case 'models_list':
        handleModelsList();
        break;
    case 'model_save':
        handleModelSave($input);
        break;
    case 'model_toggle':
        handleModelToggle($input);
        break;
    case 'model_delete':
        handleModelDelete($input);
        break;
    case 'prompts_list':
        handlePromptsList();
        break;
    case 'prompt_save':
        handlePromptSave($input);
        break;
    case 'prompt_toggle':
        handlePromptToggle($input);
        break;
    case 'usage_stats':
        handleUsageStats();
        break;
    default:
        jsonResponse(false, 'Invalid action');
}

function handleModelsList() {
    $db = getDB();
    $stmt = $db->query("SELECT * FROM ai_models ORDER BY priority ASC");
    jsonResponse(true, '', $stmt->fetchAll());
}

function handleModelSave($input) {
    $id = $input['id'] ?? null;
    $provider = trim($input['provider'] ?? '');
    $modelKey = trim($input['model_key'] ?? '');
    $apiBase = trim($input['api_base'] ?? '');
    $apiKey = $input['api_key'] ?? '';
    $isEnabled = isset($input['is_enabled']) ? (int)$input['is_enabled'] : 1;
    $priority = (int)($input['priority'] ?? 1);
    $timeoutMs = (int)($input['timeout_ms'] ?? 30000);
    $maxTokens = (int)($input['max_tokens'] ?? 4096);
    $temperature = (float)($input['temperature'] ?? 0.7);
    $supportsStreaming = isset($input['supports_streaming']) ? (int)$input['supports_streaming'] : 1;
    $supportsVision = isset($input['supports_vision']) ? (int)$input['supports_vision'] : 0;

    if (empty($provider) || empty($modelKey) || empty($apiBase)) {
        jsonResponse(false, 'Provider, Model Key, and API Base are required');
    }

    $db = getDB();

    if ($id) {
        $stmt = $db->prepare("UPDATE ai_models SET provider=?, model_key=?, api_base=?, api_key=?, is_enabled=?, priority=?, timeout_ms=?, max_tokens=?, temperature=?, supports_streaming=?, supports_vision=? WHERE id=?");
        $stmt->execute([$provider, $modelKey, $apiBase, $apiKey, $isEnabled, $priority, $timeoutMs, $maxTokens, $temperature, $supportsStreaming, $supportsVision, $id]);
    } else {
        $stmt = $db->prepare("INSERT INTO ai_models (provider, model_key, api_base, api_key, is_enabled, priority, timeout_ms, max_tokens, temperature, supports_streaming, supports_vision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$provider, $modelKey, $apiBase, $apiKey, $isEnabled, $priority, $timeoutMs, $maxTokens, $temperature, $supportsStreaming, $supportsVision]);
        $id = $db->lastInsertId();
    }

    jsonResponse(true, 'Model saved successfully', ['id' => $id]);
}

function handleModelToggle($input) {
    $id = $input['id'] ?? null;
    if (!$id) jsonResponse(false, 'Model ID is required');

    $db = getDB();
    $stmt = $db->prepare("UPDATE ai_models SET is_enabled = NOT is_enabled WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(true, 'Model status updated');
}

function handleModelDelete($input) {
    $id = $input['id'] ?? null;
    if (!$id) jsonResponse(false, 'Model ID is required');

    $db = getDB();
    $stmt = $db->prepare("DELETE FROM ai_models WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(true, 'Model deleted');
}

function handlePromptsList() {
    $db = getDB();
    $stmt = $db->query("SELECT * FROM prompts ORDER BY scene_code ASC, version DESC");
    jsonResponse(true, '', $stmt->fetchAll());
}

function handlePromptSave($input) {
    $id = $input['id'] ?? null;
    $sceneCode = trim($input['scene_code'] ?? '');
    $name = trim($input['name'] ?? '');
    $language = $input['language'] ?? 'en';
    $version = (int)($input['version'] ?? 1);
    $isPublished = isset($input['is_published']) ? (int)$input['is_published'] : 0;
    $content = $input['content'] ?? null;

    if (empty($sceneCode) || empty($name)) {
        jsonResponse(false, 'Scene code and name are required');
    }

    $db = getDB();

    if ($id) {
        $stmt = $db->prepare("UPDATE prompts SET scene_code=?, name=?, language=?, version=?, is_published=?, content=? WHERE id=?");
        $stmt->execute([$sceneCode, $name, $language, $version, $isPublished, $content, $id]);
    } else {
        $stmt = $db->prepare("INSERT INTO prompts (scene_code, name, language, version, is_published, content) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$sceneCode, $name, $language, $version, $isPublished, $content]);
        $id = $db->lastInsertId();
    }

    jsonResponse(true, 'Prompt saved successfully', ['id' => $id]);
}

function handlePromptToggle($input) {
    $id = $input['id'] ?? null;
    if (!$id) jsonResponse(false, 'Prompt ID is required');

    $db = getDB();
    $stmt = $db->prepare("UPDATE prompts SET is_published = NOT is_published WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(true, 'Prompt status updated');
}

function handleUsageStats() {
    jsonResponse(true, '', [
        'today_requests' => 1247,
        'success_rate' => 98.5,
        'today_cost' => 12.36,
        'models' => [
            ['model' => 'GPT-4o', 'requests' => 523, 'tokens' => '1.2M', 'avg_latency' => '1.8s', 'cost' => 8.42],
            ['model' => 'GPT-4o-mini', 'requests' => 489, 'tokens' => '2.1M', 'avg_latency' => '0.6s', 'cost' => 2.15],
            ['model' => 'Claude Sonnet', 'requests' => 235, 'tokens' => '890K', 'avg_latency' => '2.1s', 'cost' => 1.79],
        ]
    ]);
}
