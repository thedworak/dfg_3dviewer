<?php
require __DIR__ . '/common.php';

$root = workspace_root();
$p = $root . '/scripts/.env.schema.json';
if (file_exists($p)) {
    if (isset($_GET['delete']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (@unlink($p)) json_response(['ok'=>true]);
        http_response_code(500); json_response(['error'=>'delete_failed']);
    }
    header('Content-Type: application/json');
    echo file_get_contents($p);
    exit;
}

http_response_code(204);
exit;
