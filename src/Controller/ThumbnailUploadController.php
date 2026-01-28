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

    if (!$file || !$file->isValid()) {
      throw new BadRequestHttpException('Upload failed');
    }

    $clientMime = $file->getClientMimeType();
    $realMime   = $file->getMimeType();

    $allowed = ['image/png', 'image/jpeg'];

    if (
      !in_array($clientMime, $allowed, true) ||
      !in_array($realMime, $allowed, true)
    ) {
      throw new HttpException(415, 'Invalid image type');
    }

    /* =========================
       Target directory
    ========================= */

    $fileSystem = \Drupal::service('file_system');

    $directory = 'public://dfg_3dviewer/views';

    $fileSystem->prepareDirectory(
      $directory,
      FileSystemInterface::CREATE_DIRECTORY |
      FileSystemInterface::MODIFY_PERMISSIONS
    );

    /* =========================
       Save file
    ========================= */

    $extension = $file->getClientOriginalExtension() ?: 'png';
    $targetPath = $directory . '/' . $filename . '_side45.' . $extension;

    $file->move(
      $fileSystem->realpath($directory),
      basename($targetPath)
    );

    $realPath = $fileSystem->realpath($targetPath);

    /* =========================
       WissKI call
    ========================= */

    $wisskiBaseUrl = getenv('WISSKI_URL');
    if (!$wisskiBaseUrl) {
      throw new \RuntimeException('WISSKI_URL not configured');
    }

    $url = rtrim($wisskiBaseUrl, '/') . '/' . $wisskiId . '/savePreview';

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
      'wisski_status' => $wisskiStatus,
    ]);
  }
}
