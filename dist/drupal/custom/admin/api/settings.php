<?php
require __DIR__ . '/common.php';

$root = workspace_root();
$target = $root . '/viewer-settings.json';
$example1 = $root . '/viewer-settings-example.json';
$example2 = $root . '/viewer/viewer-settings-example.json';

// Ensure file exists by copying example if needed
if (!file_exists($target)) {
    if (file_exists($example1)) copy($example1, $target);
    elseif (file_exists($example2)) copy($example2, $target);
    else file_put_contents($target, json_encode(new stdClass()));
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $data = file_get_contents($target);
    header('Content-Type: application/json');
    echo $data;
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    // validate JSON
    $decoded = json_decode($body, true);
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        json_response(['error' => 'invalid_json']);
    }
    // backup
    backup_file($target);
    // atomic write
    $tmp = $target . '.tmp';
    file_put_contents($tmp, json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    rename($tmp, $target);
    json_response(['ok' => true]);
}

http_response_code(405);
json_response(['error' => 'method_not_allowed']);
