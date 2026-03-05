<?php

namespace Drupal\dfg_3dviewer\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Drupal\node\Entity\Node;

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
    $node = Node::load((int) $id);
    if (!$node) {
      return new JsonResponse(['error' => 'not found'], 404);
    }

    $progress = 0;
    $status = 'unknown';
    $message = '';

    if ($node->hasField('field_processing_progress')) {
      $value = $node->get('field_processing_progress')->value;
      $progress = is_numeric($value) ? (int) $value : 0;
    }
    if ($node->hasField('field_processing_status')) {
      $statusValue = $node->get('field_processing_status')->value;
      $status = $statusValue !== NULL && $statusValue !== '' ? (string) $statusValue : 'unknown';
    }
    if ($node->hasField('field_processing_message')) {
      $messageValue = $node->get('field_processing_message')->value;
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

}
