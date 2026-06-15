<?php
require __DIR__ . '/common.php';

$root = workspace_root();

// expects multipart/form-data with field 'file' and 'target' in POST (values: 'settings' or 'env')
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); json_response(['error'=>'method_not_allowed']);
}

$target = $_POST['target'] ?? $_GET['target'] ?? null;
if (!$target) { http_response_code(400); json_response(['error'=>'missing_target']); }

if ($target === 'settings') {
    $dest = $root . '/viewer-settings.schema.json';
} elseif ($target === 'env') {
    $dest = $root . '/scripts/.env.schema.json';
} else {
    http_response_code(400); json_response(['error'=>'invalid_target']);
}

$res = save_uploaded_schema($dest);
if (isset($res['ok'])) json_response($res);
http_response_code(400); json_response($res);
