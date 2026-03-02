<?php

declare(strict_types=1);

namespace Drupal\dfg_3dviewer\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\File\FileSystemInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ThumbnailUploadController extends ControllerBase {

  private function getConfiguredBaseUrl(): string {
    $config = \Drupal::config('dfg_3dviewer.settings');
    $base = (string) (
      $config->get('dfg_3dviewer_main_url')
      ?? $config->get('main_url')
      ?? ''
    );
    $base = trim($base);
    if ($base === '') {
      $request = \Drupal::request();
      return rtrim($request->getSchemeAndHttpHost(), '/');
    }
    if (!preg_match('#^https?://#i', $base)) {
      $base = 'https://' . $base;
    }
    return rtrim($base, '/');
  }

  public function upload(Request $request): JsonResponse {

    /* =========================
       Auth
    ========================= */

    if ($this->currentUser()->isAnonymous()) {
      throw new AccessDeniedHttpException('Unauthorized');
    }

    /* =========================
       Input (POST fields)
    ========================= */

    $filename = $request->request->get('filename', '');
    $wisskiId = $request->request->get('wisski_individual', '');

    if (!is_string($filename) || !preg_match('#^[a-zA-Z0-9_-]+$#', $filename)) {
      throw new BadRequestHttpException('Invalid filename');
    }

    if (!is_string($wisskiId) || !preg_match('#^[a-zA-Z0-9_-]+$#', $wisskiId)) {
      throw new BadRequestHttpException('Invalid WissKI id');
    }

    /* =========================
       Uploaded file
    ========================= */

    $file = $request->files->get('data');

    if (!$file || $file->getError() !== UPLOAD_ERR_OK) {
      throw new BadRequestHttpException('Upload failed');
    }

    $allowed = ['image/png', 'image/jpeg'];

    $mime = $file->getClientMimeType();

    if (!in_array($mime, $allowed, true)) {
      throw new HttpException(415, 'Invalid image type');
    }

    if (!@getimagesize($file->getPathname())) {
      throw new HttpException(415, 'File is not a valid image');
    }

    /* =========================
      Target directory
    ========================= */


    $uri = (string) $request->request->get('path', '');
    $parsed = parse_url($uri);
    $path = $parsed['path'] ?? '';

    $relative = preg_replace('#^/?sites/default/files/#', '', $path);

    if (str_contains($relative, '..')) {
      throw new \InvalidArgumentException('Invalid path');
    }

    $fileSystem = \Drupal::service('file_system');

    $directory = 'public://' . $relative;
    $views = $directory . '/views';

    if (!is_dir($fileSystem->realpath($directory))) {
      throw new \RuntimeException('Base directory missing');
    }

    $fileSystem->prepareDirectory(
      $views,
      FileSystemInterface::CREATE_DIRECTORY
      | FileSystemInterface::MODIFY_PERMISSIONS
    );

    /* =========================
      Filename
    ========================= */

    $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $filename);

    $extension = match ($mime) {
      'image/png'  => 'png',
      'image/jpeg' => 'jpg',
    };

    $targetName = $filename . '_side45.' . $extension;

    /* =========================
      Save
    ========================= */

    $file->move(
      $fileSystem->realpath($views),
      $targetName
    );

    $realPath = $fileSystem->realpath($views . '/' . $targetName);
    /* =========================
       WissKI call
    ========================= */

    $wisskiBaseUrl = $this->getConfiguredBaseUrl();
    $url = $wisskiBaseUrl . '/wisski/dfg_3dviewer/' . $wisskiId . '/savePreview';

    $client = \Drupal::httpClient();

    try {
      $response = $client->post($url, [
        'form_params' => [
          'path' => $realPath,
        ],
        'timeout' => 5,
      ]);

      $wisskiStatus = $response->getStatusCode();
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->error($e->getMessage());
      $wisskiStatus = 0;
    }

    /* =========================
       Response
    ========================= */

    return new JsonResponse([
      'status' => 'ok',
      'bytes' => filesize($realPath),
      'wisski_status' => $wisskiStatus
      ]);
  }
}
