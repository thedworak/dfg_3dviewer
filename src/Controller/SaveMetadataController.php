<?php

declare(strict_types=1);

namespace Drupal\dfg3dviewer\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class SaveMetadataController extends ControllerBase {

  public function save(Request $request): JsonResponse {

    /* =========================
       Auth (zastępuje $_SESSION)
    ========================= */

    if ($this->currentUser()->isAnonymous()) {
      throw new AccessDeniedHttpException('Unauthorized');
    }

    /* =========================
       Input JSON
    ========================= */

    $input = json_decode($request->getContent(), true);
    if (!is_array($input)) {
      throw new BadRequestHttpException('Invalid JSON');
    }

    /* =========================
       Validate data
    ========================= */

    $allowedPaths = [
      'modules/dfg_3dviewer/viewer',
    ];

    $path = $input['path'] ?? '';
    $filename = $input['filename'] ?? '';
    $content = $input['content'] ?? '';

    if (
      !in_array($path, $allowedPaths, true) ||
      !preg_match('/^[a-zA-Z0-9_-]+$/', $filename)
    ) {
      throw new BadRequestHttpException('Invalid parameters');
    }

    /* =========================
       Paths (bezpieczne)
    ========================= */

    $baseDir = realpath(DRUPAL_ROOT);
    $targetDir = realpath($baseDir . '/' . $path . '/metadata');

    if (!$targetDir || !str_starts_with($targetDir, $baseDir)) {
      throw new AccessDeniedHttpException('Invalid path');
    }

    /* =========================
       Save file
    ========================= */

    $filePath = $targetDir . '/' . $filename . '_viewer';

    if (file_put_contents($filePath, $content, LOCK_EX) === false) {
      throw new \RuntimeException('Cannot save file');
    }

    /* =========================
       Response
    ========================= */

    return new JsonResponse([
      'status' => 'ok',
    ]);
  }
}
