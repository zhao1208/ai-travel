<?php
// Auth API - User Registration, Login, Logout
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

switch ($action) {
    case 'register':
        handleRegister($input);
        break;
    case 'login':
        handleLogin($input);
        break;
    case 'logout':
        handleLogout();
        break;
    case 'profile':
        handleProfile();
        break;
    default:
        jsonResponse(false, 'Invalid action');
}

function handleRegister($input) {
    $name = trim($input['name'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($name)) jsonResponse(false, 'Name is required');
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(false, 'Valid email is required');
    if (strlen($password) < 8) jsonResponse(false, 'Password must be at least 8 characters');

    $db = getDB();

    // Check if email exists
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonResponse(false, 'Email already registered');
    }

    // Determine role
    $adminEmails = ['admin@travelmate.com', 'root@travelmate.com', 'admin@example.com'];
    $role = in_array($email, $adminEmails) ? 'admin' : 'user';

    // Insert user
    $stmt = $db->prepare("INSERT INTO users (name, email, password_hash, avatar, role) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), strtoupper(substr($name, 0, 1)), $role]);

    $userId = $db->lastInsertId();

    // Set session
    $_SESSION['user_id'] = $userId;
    $_SESSION['user_email'] = $email;
    $_SESSION['user_role'] = $role;

    jsonResponse(true, 'Registration successful', [
        'id' => $userId,
        'name' => $name,
        'email' => $email,
        'avatar' => strtoupper(substr($name, 0, 1)),
        'role' => $role,
        'joinedAt' => date('c'),
    ]);
}

function handleLogin($input) {
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($email) || empty($password)) {
        jsonResponse(false, 'Email and password are required');
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(false, 'Invalid email or password');
    }

    // Update admin role if needed
    $adminEmails = ['admin@travelmate.com', 'root@travelmate.com', 'admin@example.com'];
    if (in_array($email, $adminEmails) && $user['role'] !== 'admin') {
        $stmt = $db->prepare("UPDATE users SET role = 'admin' WHERE id = ?");
        $stmt->execute([$user['id']]);
        $user['role'] = 'admin';
    }

    // Set session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $user['role'];

    jsonResponse(true, 'Login successful', [
        'id' => $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'avatar' => $user['avatar'],
        'role' => $user['role'],
        'provider' => $user['provider'],
        'joinedAt' => $user['joined_at'],
    ]);
}

function handleLogout() {
    session_destroy();
    jsonResponse(true, 'Logged out successfully');
}

function handleProfile() {
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(false, 'Not logged in');
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT id, name, email, avatar, role, provider, joined_at FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(false, 'User not found');
    }

    jsonResponse(true, '', [
        'id' => $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'avatar' => $user['avatar'],
        'role' => $user['role'],
        'provider' => $user['provider'],
        'joinedAt' => $user['joined_at'],
    ]);
}
