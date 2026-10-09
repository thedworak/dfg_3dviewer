<?php
require __DIR__ . '/common.php';

$root = workspace_root();
$dir = $root . '/viewer/hdri';
if (!is_dir($dir)) mkdir($dir, 0755, true);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $files = array_values(array_filter(scandir($dir), function($f){ return !in_array($f, ['.','..']); }));
    json_response(['files' => $files]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // If multipart upload
    if (!empty($_FILES['file'])) {
        $f = $_FILES['file'];
        if ($f['error'] !== UPLOAD_ERR_OK) { http_response_code(400); json_response(['error'=>'upload_error']); }
        $name = basename($f['name']);
        $target = $dir . '/' . $name;
        if (!move_uploaded_file($f['tmp_name'], $target)) { http_response_code(500); json_response(['error'=>'move_failed']); }
        json_response(['ok'=>true,'file'=>$name]);
    }
    // JSON action (delete)
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);
    if (!$data) { http_response_code(400); json_response(['error'=>'invalid_json']); }
    if (isset($data['action']) && $data['action'] === 'delete' && isset($data['file'])) {
        $file = basename($data['file']);
        $path = $dir . '/' . $file;
        if (file_exists($path)) { unlink($path); json_response(['ok'=>true]); }
        http_response_code(404); json_response(['error'=>'not_found']);
    }
    http_response_code(400); json_response(['error'=>'unknown_action']);
}

http_response_code(405); json_response(['error'=>'method_not_allowed']);
