<?php
// Database Configuration - 请修改以下配置
define('DB_HOST', 'localhost');
define('DB_NAME', 'travelmate');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// Session Configuration
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database Connection
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            jsonResponse(false, 'Database connection failed: ' . $e->getMessage());
            exit;
        }
    }
    return $pdo;
}

// JSON Response Helper
function jsonResponse($success, $message = '', $data = null) {
    $response = ['success' => $success, 'message' => $message];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

// Require Authentication
function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(false, 'Please login first');
        exit;
    }
    return $_SESSION['user_id'];
}

// Require Admin
function requireAdmin() {
    $userId = requireAuth();
    $db = getDB();
    $stmt = $db->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user || $user['role'] !== 'admin') {
        jsonResponse(false, 'Admin access required');
        exit;
    }
    return $userId;
}
