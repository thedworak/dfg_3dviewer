<?php

namespace Drupal\dfg_3dviewer\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Drupal\Core\Controller\ControllerBase;

class ProgressController extends ControllerBase {

  public function check($entity_id) {

    $entity = \Drupal::entityTypeManager()
      ->getStorage('wisski_individual')
      ->load($entity_id);

    if (!$entity) {
      \Drupal::logger('dfg_3dviewer')
        ->error('Entity not found for ID @id', ['@id' => $entity_id]);

      return new JsonResponse(['error' => 'Entity not found'], 404);
    }

    $status = $entity->hasField('field_processing_status')
      ? $entity->get('field_processing_status')->value
      : NULL;

    $progress = $entity->hasField('field_processing_progress')
      ? (int) $entity->get('field_processing_progress')->value
      : 0;

    $message = $entity->hasField('field_processing_message')
      ? $entity->get('field_processing_message')->value
      : '';

    return new JsonResponse([
      'status' => $status,
      'progress' => $progress,
      'message' => $message,
    ]);
  }
}