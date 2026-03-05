<?php

namespace Drupal\dfg_3dviewer\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Drupal\Core\Database\Database;
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

    $db = Database::getConnection();

    $result = $db->query("
      SELECT
      p.field_processing_progress_value AS progress,
      s.field_processing_status_value AS status,
      m.field_processing_message_value AS message
      FROM node__field_processing_progress p
      LEFT JOIN node__field_processing_status s ON s.entity_id = p.entity_id
      LEFT JOIN node__field_processing_message m ON m.entity_id = p.entity_id
      WHERE p.entity_id = :id
    ", [':id' => $id])->fetchAssoc();

    if (!$result) {
      return new JsonResponse(['error'=>'not found'],404);
    }

    $response = new JsonResponse([
      'progress' => (int)$result['progress'],
      'status' => $result['status'],
      'message' => $result['message']
    ]);

    $response->headers->set('Cache-Control','no-store');

    return $response;

  }

}