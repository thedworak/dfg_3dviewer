<?php

namespace Drupal\dfg_3dviewer\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Drupal\Core\Controller\ControllerBase;

class ProgressController extends ControllerBase {

    public function check($entity_id) {

    $entity = \Drupal::entityTypeManager()
        ->getStorage('wisski_individual')
        ->load($entity_id);

    return new JsonResponse([
        'status' => $entity->get('field_processing_status')->value,
        'progress' => (int)$entity->get('processing_progress')->value,
        'message' => $entity->get('processing_message')->value,
    ]);
    }
}