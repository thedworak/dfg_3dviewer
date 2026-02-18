public function check($entity_id) {

  $entity = \Drupal::entityTypeManager()
    ->getStorage('wisski_individual')
    ->load($entity_id);

  return new JsonResponse([
    'status' => $entity->get('processing_status')->value,
    'progress' => (int)$entity->get('processing_progress')->value,
    'message' => $entity->get('processing_message')->value,
  ]);
}