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

    $subdir = $request->request->get('path', '');
    if (!preg_match('/^\d{4}-\d{2}$/', $subdir)) {
      throw new \InvalidArgumentException('Invalid path format');
    }
    $directory = "public://$subdir";

    $fileSystem = \Drupal::service('file_system');

    $realBase = $fileSystem->realpath($directory);

    if ($realBase === FALSE || !is_dir($realBase)) {
      throw new \RuntimeException('Base directory does not exist');
    }

    $views = $directory . '/views';

    $fileSystem->prepareDirectory(
      $views,
      FileSystemInterface::CREATE_DIRECTORY |
      FileSystemInterface::MODIFY_PERMISSIONS
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
      $fileSystem->realpath($directory),
      $targetName
    );

    $realPath = $fileSystem->realpath($directory . '/' . $targetName);

    /* =========================
       WissKI call
    ========================= */

    $request = \Drupal::request();

    $wisskiBaseUrl = $request->getSchemeAndHttpHost();

    $url = $wisskiBaseUrl . '/' . $wisskiId . '/savePreview';

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
