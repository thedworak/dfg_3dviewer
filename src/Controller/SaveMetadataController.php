<?php

declare(strict_types=1);

namespace Drupal\dfg_3dviewer\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Drupal\Core\File\FileSystemInterface;

class SaveMetadataController extends ControllerBase {
	
	private const ALLOWED_SUBDIR = 'viewer';

	public function save(Request $request): JsonResponse {	  

		/* =========================
		   Auth (no $_SESSION)
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

		$path = $input['path'] ?? '';
		$filename = $input['filename'] ?? '';
		$content = $input['content'] ?? '';

		if (!is_string($path) || !is_string($filename)) {
			throw new BadRequestHttpException('Invalid input');
		}

		// ie. 2025-02 albo project_1/session_3
		if (!preg_match('#^[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*$#', $path)) {
			\Drupal::logger('dfg_3dviewer')->error(
			  'Invalid filename received: "@path"',
			  ['@path' => $path]
			);
		}

		if (!preg_match('#^[a-zA-Z0-9_-]+$#', $filename)) {
			\Drupal::logger('dfg_3dviewer')->error(
			  'Invalid filename received: "@filename"',
			  ['@filename' => $filename]
			);
		}

		/* =========================
		   Paths (safe)
		========================= */

		$directory = $path . '/metadata';

		$fileSystem = \Drupal::service('file_system');

		$fileSystem->prepareDirectory(
			$directory,
			FileSystemInterface::CREATE_DIRECTORY |
			FileSystemInterface::MODIFY_PERMISSIONS
		);

		$realDir = $fileSystem->realpath($directory);

		/* =========================
		   Save file
		========================= */

		$content = is_array($content)
			? json_encode($content, JSON_PRETTY_PRINT)
			: (string) $content;

		$filePath = $directory . '/' . $filename . '_viewer.json';

		$fileSystem->saveData(
		  $content,
		  $filePath,
		  FileSystemInterface::EXISTS_REPLACE
		);

		/* =========================
		   Response
		========================= */

		return new JsonResponse([
		  'status' => 'ok',
		]);
	  }
}
