<?php
// Database Initialization - 浏览器访问一次即可自动建表
require_once __DIR__ . '/config.php';

try {
    $db = getDB();

    // Create users table
    $db->exec("CREATE TABLE IF NOT EXISTS `users` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `name` VARCHAR(100) NOT NULL,
        `email` VARCHAR(255) NOT NULL UNIQUE,
        `password_hash` VARCHAR(255) NOT NULL,
        `avatar` VARCHAR(10) DEFAULT NULL,
        `role` ENUM('user', 'admin') DEFAULT 'user',
        `provider` VARCHAR(50) DEFAULT NULL,
        `joined_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_email` (`email`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Create ai_models table
    $db->exec("CREATE TABLE IF NOT EXISTS `ai_models` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `provider` VARCHAR(100) NOT NULL,
        `model_key` VARCHAR(100) NOT NULL,
        `api_base` VARCHAR(500) NOT NULL,
        `api_key` VARCHAR(500) DEFAULT '',
        `is_enabled` TINYINT(1) DEFAULT 1,
        `priority` INT DEFAULT 1,
        `timeout_ms` INT DEFAULT 30000,
        `max_tokens` INT DEFAULT 4096,
        `temperature` DECIMAL(3,2) DEFAULT 0.70,
        `supports_streaming` TINYINT(1) DEFAULT 1,
        `supports_vision` TINYINT(1) DEFAULT 0,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Create prompts table
    $db->exec("CREATE TABLE IF NOT EXISTS `prompts` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `scene_code` VARCHAR(100) NOT NULL,
        `name` VARCHAR(200) NOT NULL,
        `language` VARCHAR(10) DEFAULT 'en',
        `version` INT DEFAULT 1,
        `is_published` TINYINT(1) DEFAULT 0,
        `content` TEXT DEFAULT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Create chat_history table
    $db->exec("CREATE TABLE IF NOT EXISTS `chat_history` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `user_id` INT NOT NULL,
        `title` VARCHAR(200) DEFAULT 'New Chat',
        `messages_json` JSON DEFAULT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_user_id` (`user_id`),
        FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Insert default admin user (password: admin123)
    $stmt = $db->prepare("INSERT IGNORE INTO `users` (`name`, `email`, `password_hash`, `avatar`, `role`) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([
        'Admin',
        'admin@travelmate.com',
        password_hash('admin123', PASSWORD_DEFAULT),
        'A',
        'admin'
    ]);

    // Insert default AI models
    $models = [
        ['OpenAI', 'gpt-4o', 'https://api.openai.com/v1', '', 1, 1, 30000, 4096, 0.70, 1, 1],
        ['OpenAI', 'gpt-4o-mini', 'https://api.openai.com/v1', '', 1, 2, 20000, 4096, 0.70, 1, 0],
        ['Anthropic', 'claude-sonnet-4-20250514', 'https://api.anthropic.com/v1', '', 1, 3, 30000, 4096, 0.50, 1, 1],
        ['DeepSeek', 'deepseek-chat', 'https://api.deepseek.com/v1', '', 0, 4, 20000, 4096, 0.70, 1, 0],
        ['百度文心', 'ernie-4.0-8k', 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1', '', 0, 5, 20000, 4096, 0.70, 0, 0],
    ];
    $stmt = $db->prepare("INSERT IGNORE INTO `ai_models` (`provider`, `model_key`, `api_base`, `api_key`, `is_enabled`, `priority`, `timeout_ms`, `max_tokens`, `temperature`, `supports_streaming`, `supports_vision`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    foreach ($models as $m) {
        $stmt->execute($m);
    }

    // Insert default prompts
    $prompts = [
        ['trip_planning', 'Trip Planner', 'en', 3, 1],
        ['translator', 'Travel Translator', 'en', 2, 1],
        ['local_guide', 'Local Guide', 'en', 1, 0],
        ['food_helper', 'Food Advisor', 'zh', 2, 1],
    ];
    $stmt = $db->prepare("INSERT IGNORE INTO `prompts` (`scene_code`, `name`, `language`, `version`, `is_published`) VALUES (?, ?, ?, ?, ?)");
    foreach ($prompts as $p) {
        $stmt->execute($p);
    }

    jsonResponse(true, 'Database initialized successfully');
} catch (Exception $e) {
    jsonResponse(false, 'Initialization failed: ' . $e->getMessage());
}
