<?php

namespace Drupal\dfg_3dviewer\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Drupal\node\Entity\Node;
use Drupal\Core\Entity\EntityInterface;

class ModelController {

  public function create(Request $request) {

    $node = Node::create([
      'type' => 'model',
      'title' => 'Processing model',
      'field_processing_progress' => 0,
      'field_processing_status' => 'preparing',
      'field_processing_message' => 'Preparing...'
    ]);

    $node->save();

    $id = $node->id();

    exec("/opt/drupal/scripts/worker.sh $id > /dev/null 2>&1 &");

    return new JsonResponse([
      'entity_id' => $id,
      'status' => 'started'
    ]);
  }

  public function status($id) {
    $entity = $this->loadProcessingEntity((string) $id);
    if (!$entity) {
      return new JsonResponse(['error' => 'not found'], 404);
    }

    $progress = 0;
    $status = 'unknown';
    $message = '';

    if ($entity->hasField('field_processing_progress')) {
      $value = $entity->get('field_processing_progress')->value;
      $progress = is_numeric($value) ? (int) $value : 0;
    }
    if ($entity->hasField('field_processing_status')) {
      $statusValue = $entity->get('field_processing_status')->value;
      $status = $statusValue !== NULL && $statusValue !== '' ? (string) $statusValue : 'unknown';
    }
    if ($entity->hasField('field_processing_message')) {
      $messageValue = $entity->get('field_processing_message')->value;
      $message = $messageValue !== NULL ? (string) $messageValue : '';
    }

    $response = new JsonResponse([
      'progress' => $progress,
      'status' => $status,
      'message' => $message
    ]);

    $response->headers->set('Cache-Control','no-store');

    return $response;

  }

  private function loadProcessingEntity(string $id): ?EntityInterface {
    if ($id === '') {
      return NULL;
    }

    $entity_type_manager = \Drupal::entityTypeManager();

    foreach (['wisski_individual', 'node'] as $entity_type) {
      try {
        if ($entity_type_manager->hasDefinition($entity_type)) {
          $entity = $entity_type_manager->getStorage($entity_type)->load($id);
          if ($entity instanceof EntityInterface) {
            return $entity;
          }
        }
      }
      catch (\Throwable $e) {
      }
    }

    if (ctype_digit($id)) {
      $node = Node::load((int) $id);
      if ($node instanceof EntityInterface) {
        return $node;
      }
    }

    return NULL;
  }

}
