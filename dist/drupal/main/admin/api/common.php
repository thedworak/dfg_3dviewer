<?php
session_start();
if (!isset($_SESSION['admin'])) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

function json_response($data) {
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function workspace_root() {
    // admin/api is at viewer/admin/api -> go up 3
    return realpath(__DIR__ . '/../../../');
}

function backup_file($path, $keep = 5) {
    if (!file_exists($path)) return;
    $dir = dirname($path);
    $base = basename($path);
    // simple .bak (latest)
    copy($path, $dir . '/' . $base . '.bak');
    // timestamped
    $ts = date('Ymd-His');
    $copy = $dir . '/' . $base . '.' . $ts;
    copy($path, $copy);

    // rotate old backups: match $base.* in same dir (exclude .bak)
    $pattern = $dir . '/' . $base . '.*';
    $files = glob($pattern);
    // filter timestamped copies only (YYYYmmdd-HHMMSS)
    $backups = array_filter($files, function($f) use ($base){ return preg_match('/' . preg_quote($base, '/') . '\.\d{8}-\d{6}$/', $f); });
    usort($backups, function($a,$b){ return filemtime($b) - filemtime($a); });
    if (count($backups) > $keep) {
        $remove = array_slice($backups, $keep);
        foreach($remove as $r) @unlink($r);
    }
}

function save_uploaded_schema($targetPath) {
    if (!isset($_FILES['file'])) return ['error'=>'no_file'];
    $f = $_FILES['file'];
    if ($f['error'] !== UPLOAD_ERR_OK) return ['error'=>'upload_error'];
    // validate json
    $content = file_get_contents($f['tmp_name']);
    if (json_decode($content) === null) return ['error'=>'invalid_json'];
    // backup existing
    if (file_exists($targetPath)) backup_file($targetPath, intval(getenv('ADMIN_BACKUP_KEEP') ?: 10));
    if (!is_dir(dirname($targetPath))) mkdir(dirname($targetPath), 0755, true);
    if (!move_uploaded_file($f['tmp_name'], $targetPath)) return ['error'=>'move_failed'];
    return ['ok'=>true];
}
