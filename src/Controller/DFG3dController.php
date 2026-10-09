<?php

namespace Drupal\dfg_3dviewer\Controller;

use Drupal\wisski_core\Entity\WisskiEntity;
use Drupal\Core\Entity\ContentEntityStorageInterface;
use Drupal\Core\Cache\CacheableJsonResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Drupal\image\Entity\ImageStyle;
use Drupal\wisski_salz\Entity\Adapter;
use Drupal\Core\Controller\ControllerBase;

use Drupal\file\Entity\File;
use Drupal\Core\File\FileSystemInterface;


class DFG3dController extends ControllerBase {


	public function __construct() {
		dfg_3dviewer_init_constants();
	}

	public static function create($container) {
		return new static();
	}

	public function view() {
		return [
		'#markup' => DFG_3DVIEWER_MAIN_URL,
		];
	}

	public function editEntity(?WisskiEntity $wisski_individual = NULL) {

		$module_path = \Drupal::service('extension.list.module')->getPath('dfg_3dviewer');
		$file_path = DRUPAL_ROOT . '/' . $module_path . '/viewer/viewer-settings.json';

		$file_content = file_get_contents($file_path);
		$settings = json_decode($file_content);
		$pathGeneration = $settings->viewer->imageGeneration ?? NULL;

		if ($pathGeneration) {

			$url = \Drupal::request()->request->get('path');

			// Change URL to public://
			$parsed = parse_url($url, PHP_URL_PATH);

			if (str_starts_with($parsed, '/sites/default/files/')) {

				$relative = str_replace('/sites/default/files/', '', $parsed);
				$uri = 'public://' . $relative;

				$realpath = \Drupal::service('file_system')->realpath($uri);

				if (file_exists($realpath)) {

					// Check wheter file exists or not
					$files = \Drupal::entityTypeManager()
						->getStorage('file')
						->loadByProperties(['uri' => $uri]);

					if ($files) {
						$file = reset($files);
					} else {
						$file = File::create(['uri' => $uri]);
						$file->setPermanent();
						$file->save();
					}

					$wisski_individual->set($pathGeneration, [
						'target_id' => $file->id(),
					]);

					$wisski_individual->save();
				}
			}

			$response = new CacheableJsonResponse();
			$response->setEncodingOptions(JSON_UNESCAPED_SLASHES);

			$response->setData([
				"id" => $wisski_individual->id(),
				"path" => $url,
			]);

			return $response;
		}
	}
}