<?php
declare(strict_types=1);
session_start();

/* =========================
   Auth
========================= */

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit('Unauthorized');
}

/* =========================
   CSRF
========================= */

$headers = getallheaders();
if (
    empty($headers['X-CSRF-Token']) ||
    $headers['X-CSRF-Token'] !== ($_SESSION['csrf'] ?? null)
) {
    http_response_code(403);
    exit('Invalid CSRF token');
}

/* =========================
   Input JSON
========================= */

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    exit('Invalid JSON');
}

/* =========================
   Validate data
========================= */

$allowedPaths = [
    'modules/dfg_3dviewer/viewer/'
];

$path = $input['path'] ?? '';
$filename = $input['filename'] ?? '';
$content = $input['content'] ?? '';

if (
    !in_array($path, $allowedPaths, true) ||
    !preg_match('/^[a-zA-Z0-9_\-]+$/', $filename)
) {
    http_response_code(400);
    exit('Invalid parameters');
}

/* =========================
   Paths
========================= */

$baseDir = realpath(__DIR__ . '/../../');
$targetDir = realpath($baseDir . '/' . $path . '/metadata');

if ($targetDir === false || !str_starts_with($targetDir, $baseDir)) {
    http_response_code(403);
    exit('Invalid path');
}

/* =========================
   Save file
========================= */

$filePath = $targetDir . '/' . $filename . '_viewer.json';

file_put_contents($filePath, $content, LOCK_EX);

/* =========================
   Response
========================= */

echo json_encode([
    'status' => 'ok'
]);
