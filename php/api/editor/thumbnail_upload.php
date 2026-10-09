<?php
declare(strict_types=1);
session_start();

header('Content-Type: application/json');

/* =========================
   Auth
========================= */

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(['error' => 'Unauthorized']));
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
    exit(json_encode(['error' => 'Invalid CSRF']));
}

/* =========================
   Input
========================= */

$filename = $_POST['filename'] ?? '';
$wisskiId = $_POST['wisski_individual'] ?? '';

if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $filename)) {
    http_response_code(400);
    exit(json_encode(['error' => 'Invalid filename']));
}

if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $wisskiId)) {
    http_response_code(400);
    exit(json_encode(['error' => 'Invalid wisski id']));
}

/* =========================
   File validation
========================= */

if (
    !isset($_FILES['data']) ||
    $_FILES['data']['error'] !== UPLOAD_ERR_OK
) {
    http_response_code(400);
    exit(json_encode(['error' => 'Upload failed']));
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $_FILES['data']['tmp_name']);

$allowedMimes = ['image/png', 'image/jpeg'];
if (!in_array($mime, $allowedMimes, true)) {
    http_response_code(415);
    exit(json_encode(['error' => 'Invalid image type']));
}

/* =========================
   Safe path
========================= */

$baseDir = realpath(__DIR__ . '/../../modules/dfg_3dviewer/viewer');
$targetDir = $baseDir . '/views';

if (!is_dir($targetDir)) {
    mkdir($targetDir, 0755, true);
}

$targetFile = $targetDir . '/' . $filename . '_side45.png';

/* =========================
   Move upload
========================= */

if (!move_uploaded_file($_FILES['data']['tmp_name'], $targetFile)) {
    http_response_code(500);
    exit(json_encode(['error' => 'File write failed']));
}

/* =========================
   WissKI call
========================= */

$wisskiBaseUrl = $_ENV['WISSKI_URL'];
$url = rtrim($wisskiBaseUrl, '/') . '/' . $wisskiId . '/savePreview';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POSTFIELDS => http_build_query([
        'path' => $targetFile
    ]),
    CURLOPT_TIMEOUT => 5
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

/* =========================
   Response
========================= */

echo json_encode([
    'status' => 'ok',
    'bytes' => filesize($targetFile),
    'wisski_status' => $httpCode
]);
