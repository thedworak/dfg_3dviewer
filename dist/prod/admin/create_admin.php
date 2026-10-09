<?php
// CLI script: php create_admin.php username password
if (php_sapi_name() !== 'cli') {
    echo "This script must be run from CLI\n";
    exit(1);
}
if ($argc < 3) {
    echo "Usage: php create_admin.php username password\n";
    exit(1);
}
$username = $argv[1];
$password = $argv[2];

$pdo = require __DIR__ . '/db.php';

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('INSERT INTO admins (username, password, created_at) VALUES (?, ?, ?)');
try {
    $stmt->execute([$username, $hash, date('c')]);
    echo "Admin user created: $username\n";
} catch (Exception $e) {
    echo "Error creating admin: " . $e->getMessage() . "\n";
    exit(1);
}
