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
		$path = \Drupal::request()->request->get('path');		
		
		$wisski_individual->set('f605dc6b727a1099b9e52b3ccbdf5673', array($path));
		$wisski_individual->save();
		$wisski_info = $wisski_individual->f605dc6b727a1099b9e52b3ccbdf5673->getValue();
		$response = new CacheableJsonResponse();

		$response->setEncodingOptions(JSON_UNESCAPED_SLASHES);
		$data = array("id" => $wisski_individual->id(), "path" => $path, "wisski_info" => $wisski_info);
		$response->setData($data);

		return $response;
	}
}