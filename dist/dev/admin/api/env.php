<?php
require __DIR__ . '/common.php';

$root = workspace_root();
$target = $root . '/scripts/.env';
$example = $root . '/scripts/.env.example';

// Ensure .env exists by copying example
if (!file_exists($target)) {
    if (file_exists($example)) copy($example, $target);
    else file_put_contents($target, "# .env\n");
}

function parse_env($path) {
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $out = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($k,$v) = explode('=', $line, 2);
            $out[trim($k)] = trim($v);
        }
    }
    return $out;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_response(parse_env($target));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        http_response_code(400);
        json_response(['error' => 'invalid_json']);
    }
    // backup
    backup_file($target);
    // write env
    $lines = [];
    foreach ($decoded as $k => $v) {
        $lines[] = $k . '=' . $v;
    }
    $tmp = $target . '.tmp';
    file_put_contents($tmp, implode("\n", $lines) . "\n");
    rename($tmp, $target);
    json_response(['ok' => true]);
}

http_response_code(405);
json_response(['error' => 'method_not_allowed']);
