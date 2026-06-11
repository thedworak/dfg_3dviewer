<?php
require __DIR__ . '/common.php';

$root = workspace_root();
$body = file_get_contents('php://input');
$data = json_decode($body, true);
if (!$data || !isset($data['action'])) { http_response_code(400); json_response(['error'=>'invalid_request']); }

$action = $data['action'];
if ($action === 'clear_cache') {
    $target = $root . '/viewer/build';
    $out = '';
    if (is_dir($target)) {
        // remove all files
        $cmd = 'rm -rf ' . escapeshellarg($target) . '/*';
        $out = shell_exec($cmd . ' 2>&1');
    } else { $out = 'no build dir'; }
    json_response(['ok'=>true,'output'=>$out]);
}

if ($action === 'rebuild_thumbs') {
    $script = $root . '/scripts/render.sh';
    if (file_exists($script) && is_executable($script)) {
        $out = shell_exec(escapeshellcmd($script) . ' 2>&1');
        json_response(['ok'=>true,'output'=>$out]);
    }
    http_response_code(500); json_response(['error'=>'script_missing']);
}

if ($action === 'diagnostics') {
    $out = [];
    $out['php'] = shell_exec('php -v 2>&1');
    $out['uname'] = shell_exec('uname -a 2>&1');
    $out['df'] = shell_exec('df -h 2>&1');
    json_response(['ok'=>true,'output'=>$out]);
}

http_response_code(400); json_response(['error'=>'unknown_action']);
