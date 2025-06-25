<?php

namespace Drupal\dfg_3dviewer\Controller;

use Drupal\wisski_core\Entity\WisskiEntity;
use Drupal\Core\Entity\ContentEntityStorageInterface;
use Drupal\Core\Cache\CacheableJsonResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Drupal\image\Entity\ImageStyle;
use Drupal\wisski_salz\Entity\Adapter;


class DFG3dController {

	public function editEntity(WisskiEntity $wisski_individual = NULL) {
		// Get module path (e.g., modules/custom/your_module/)
		$module_path = \Drupal::service('extension.list.module')->getPath('dfg_3dviewer');

		// Build full file path
		$file_path = DRUPAL_ROOT . '/' . $module_path . '/viewer/viewer-settings.json';

		$file_content = file_get_contents($file_path);
		$settings = json_decode($file_content, true);
		$pathGeneration = $settings->viewer->imageGeneration;

		if (isset($pathGeneration)) {
			$path = \Drupal::request()->request->get('path');
			
			$wisski_individual->set($pathGeneration, array($path));
			$wisski_individual->save();
			$wisski_info = $wisski_individual->$pathGeneration->getValue();
			$response = new CacheableJsonResponse();

			$response->setEncodingOptions(JSON_UNESCAPED_SLASHES);
			$data = array("id" => $wisski_individual->id(), "path" => $path, "wisski_info" => $wisski_info);
			$response->setData($data);

			return $response;	
		}

	}
}