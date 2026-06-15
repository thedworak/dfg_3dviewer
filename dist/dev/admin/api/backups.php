<?php
require __DIR__ . '/common.php';

$root = workspace_root();

// GET ?target=settings|env -> list backups (most recent first, limited to 5)
// POST restore {target, file}

function list_backups($target) {
    global $root;
    if ($target === 'settings') {
        $path = $root . '/viewer-settings.json';
        $base = 'viewer-settings.json';
    } elseif ($target === 'env') {
        $path = $root . '/scripts/.env';
        $base = '.env';
        $dir = dirname($path);
        $base = basename($path);
    } else {
        return ['error'=>'invalid_target'];
    }
    $dir = dirname($path);
    $pattern = $dir . '/' . $base . '.*';
    $files = glob($pattern);
    // filter timestamped copies only (YYYYmmdd-HHMMSS)
    $backups = array_filter($files, function($f) use ($base){ return preg_match('/' . preg_quote($base, '/') . '\.\d{8}-\d{6}$/', $f); });
    usort($backups, function($a,$b){ return filemtime($b) - filemtime($a); });
    $backups = array_slice($backups, 0, 5);
    $out = [];
    foreach($backups as $b) $out[] = ['file'=>basename($b),'path'=>$b,'ts'=>date('c', filemtime($b))];
    return ['backups'=>$out];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $target = $_GET['target'] ?? null;
    if (!$target) { http_response_code(400); json_response(['error'=>'missing_target']); }
    json_response(list_backups($target));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);
    if (!$data || !isset($data['target']) || !isset($data['file'])) { http_response_code(400); json_response(['error'=>'invalid_request']); }
    $target = $data['target'];
    $file = basename($data['file']);
    if ($target === 'settings') {
        $path = $root . '/viewer-settings.json';
        $dir = dirname($path);
        $src = $dir . '/' . $file;
    } elseif ($target === 'env') {
        $path = $root . '/scripts/.env';
        $dir = dirname($path);
        $src = $dir . '/' . $file;
    } else { http_response_code(400); json_response(['error'=>'invalid_target']); }
    if (!file_exists($src)) { http_response_code(404); json_response(['error'=>'not_found']); }
    // make a backup of current file before restore
    if (file_exists($path)) backup_file($path);
    if (!copy($src, $path)) { http_response_code(500); json_response(['error'=>'restore_failed']); }
    json_response(['ok'=>true]);
}

http_response_code(405); json_response(['error'=>'method_not_allowed']);
