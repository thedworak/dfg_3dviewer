<?php

namespace Drupal\dfg_3dviewer\Plugin\QueueWorker;

use Drupal\Core\Archiver\ArchiverException;
use Drupal\Core\Archiver\Zip;
use Drupal\Core\Queue\QueueWorkerBase;
use Drupal\file\Entity\File;

/**
 * @QueueWorker(
 *   id = "dfg_3dviewer_convert",
 *   title = @Translation("DFG 3D Viewer Convert Worker"),
 *   cron = {"time" = 120}
 * )
 */
class ConvertWorker extends QueueWorkerBase {

  public function processItem($data) {
    $GLOBALS['dfg_3dviewer_worker_running'] = TRUE;

    $entity_id = $data['entity_id'] ?? NULL;
    $file_id = $data['file_id'] ?? NULL;
    $entity_type = $data['entity_type'] ?? 'wisski_individual';
    $source_filename = $data['source_filename'] ?? '';
    $source_uri = $data['source_uri'] ?? '';

    if (!$entity_id || !$file_id) {
      \Drupal::logger('dfg_3dviewer')->error('Missing entity_id or file_id in queue item.');
      unset($GLOBALS['dfg_3dviewer_worker_running']);
      return;
    }

    $entity = \Drupal::entityTypeManager()->getStorage($entity_type)->load($entity_id);
    if (!$entity) {
      \Drupal::logger('dfg_3dviewer')->error(
        'Entity @type:@id not found for conversion.',
        ['@type' => $entity_type, '@id' => $entity_id]
      );
      unset($GLOBALS['dfg_3dviewer_worker_running']);
      return;
    }

    $lock = \Drupal::lock();
    $lock_name = 'dfg_3dviewer_convert_' . $entity_type . '_' . $entity_id . '_' . $file_id;

    if (!$lock->acquire($lock_name, 3600)) {
      unset($GLOBALS['dfg_3dviewer_worker_running']);
      return;
    }

    try {
      $file = File::load($file_id);
      if (!$file) {
        throw new \RuntimeException('File not found for conversion queue item.');
      }

      $cfg = dfg_3dviewer_config();
      $fs = \Drupal::service('file_system');
      $file_uri = $file->getFileUri();
      $input_realpath = $fs->realpath($file_uri);

      \Drupal::logger('dfg_3dviewer')->notice(
        'Worker picked queued file: file_id=@file_id, filename="@filename", uri="@uri", realpath="@realpath", queued_filename="@queued_filename", queued_uri="@queued_uri".',
        [
          '@file_id' => $file_id,
          '@filename' => $file->getFilename(),
          '@uri' => $file_uri,
          '@realpath' => (string) $input_realpath,
          '@queued_filename' => (string) $source_filename,
          '@queued_uri' => (string) $source_uri,
        ]
      );
      \Drupal::logger('dfg_3dviewer')->notice(
        'Resolved viewer field config: image_generation="@image", field_df="@field_df", viewer_file_name="@viewer_file_name", viewer_file_upload="@viewer_file_upload".',
        [
          '@image' => (string) ($cfg['image_generation'] ?? ''),
          '@field_df' => (string) ($cfg['field_df'] ?? ''),
          '@viewer_file_name' => (string) ($cfg['viewer_file_name'] ?? ''),
          '@viewer_file_upload' => (string) ($cfg['viewer_file_upload'] ?? ''),
        ]
      );

      $module_path = $fs->realpath(
        \Drupal::service('module_handler')->getModule('dfg_3dviewer')->getPath()
      );

      if (!$module_path) {
        throw new \RuntimeException('Cannot resolve module path.');
      }

      $this->updateProgress($entity, 5, 'processing', 'Preparing...');
      $this->saveEntity($entity);

      $context = $this->convertFile($entity, $file, $cfg, $module_path);
      $this->saveEntity($entity);

      $this->updateProgress($entity, 80, 'processing', 'Updating viewer fields...');
      $viewer_result = $this->applyViewerFields($entity, $file, $cfg, $context);

      $this->updateProgress($entity, 100, 'ready', 'Conversion finished');
      $this->saveEntity($entity);
      $this->ensureImageFieldPersisted($entity_type, (string) $entity_id, $viewer_result);

      \Drupal::logger('dfg_3dviewer')->notice(
        'Conversion finished for entity @entity_id and file @file_id.',
        ['@entity_id' => $entity_id, '@file_id' => $file_id]
      );
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->error(
        'Conversion failed for entity @id: @msg',
        ['@id' => $entity_id, '@msg' => $e->getMessage()]
      );

      $this->updateProgress($entity, 100, 'failed', 'Conversion failed');
      $this->saveEntity($entity);
    }
    finally {
      $lock->release($lock_name);
      unset($GLOBALS['dfg_3dviewer_worker_running']);
    }
  }

  private function convertFile($entity, File $file, array $cfg, string $module_path): array {
    $fs = \Drupal::service('file_system');
    $realpath = $fs->realpath($file->getFileUri());

    if (!$realpath || !is_file($realpath)) {
      throw new \RuntimeException('Input file does not exist on filesystem.');
    }

    $parts = pathinfo($realpath);
    $extension = strtolower($parts['extension'] ?? '');
    if ($extension === '') {
      throw new \RuntimeException('Cannot resolve input file extension.');
    }

    $archives = \Drupal::service('dfg_3dviewer.model_format_manager')->getZipFormats();
    $is_archive = in_arrayi($extension, $archives);

    $new_file = $parts['dirname'] . '/gltf/' . $parts['filename'] . '.glb';
    $new_dir = $parts['dirname'] . '/' . $parts['filename'] . '_' . $extension . '/gltf/';

    if (!file_exists($new_file) && !is_dir($new_dir)) {
      if ($is_archive) {
        $this->updateProgress($entity, 10, 'processing', 'Extracting archive...');

        $extract_path = $parts['dirname'] . '/' . $parts['filename'] . '_' . $extension . '/';
        if (!is_dir($extract_path) && !mkdir($extract_path, 0775, TRUE) && !is_dir($extract_path)) {
          throw new \RuntimeException('Cannot create archive extraction directory.');
        }

        if ($extension === 'zip') {
          try {
            $zip = new Zip($realpath);
            $zip->extract($extract_path);
            $zip->remove($realpath);
          }
          catch (ArchiverException $e) {
            throw new \RuntimeException('Archive extraction failed: ' . $e->getMessage(), 0, $e);
          }
        }
        else {
          $map = [
            'rar' => 'RAR',
            'tar' => 'TAR',
            'gz' => 'TAR',
            'xz' => 'XZ',
          ];

          $type = $map[$extension] ?? strtoupper($extension);
          $result = \Drupal::service('dfg_3dviewer.convert_process')
            ->uncompress($module_path, $type, $realpath, $extract_path, $parts['filename']);

          if (!($result['success'] ?? FALSE)) {
            throw new \RuntimeException('Archive extraction failed.');
          }
        }

        $this->updateProgress($entity, 25, 'processing', 'Model detected...');

        $allowed_formats = \Drupal::service('dfg_3dviewer.model_format_manager')->getAllowedModelFormats();
        $model_file = NULL;

        $iterator = new \RecursiveIteratorIterator(
          new \RecursiveDirectoryIterator($extract_path, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $candidate) {
          if (!$candidate->isFile()) {
            continue;
          }

          $candidate_ext = strtolower($candidate->getExtension());
          if (in_arrayi($candidate_ext, $allowed_formats)) {
            $model_file = $candidate->getPathname();
            break;
          }
        }

        if (!$model_file) {
          throw new \RuntimeException('No supported 3D model found in archive.');
        }

        $this->updateProgress($entity, 35, 'processing', 'Converting to GLTF and generating thumbnails...');

        $convert_result = \Drupal::service('dfg_3dviewer.convert_process')->run(
          $module_path,
          $model_file,
          (int) $cfg['lightweight'],
          [
            'c' => TRUE,
            'l' => '3',
            'b' => TRUE,
            'o' => $extract_path,
            'f' => TRUE,
            'a' => 'false',
          ]
        );

        if (($convert_result['exit_code'] ?? 1) !== 0) {
          throw new \RuntimeException('Conversion failed.');
        }
      }
      else {
        $this->updateProgress($entity, 35, 'processing', 'Converting to GLTF and generating thumbnails...');

        $convert_result = \Drupal::service('dfg_3dviewer.convert_process')->run(
          $module_path,
          $realpath,
          (int) $cfg['lightweight'],
          [
            'c' => TRUE,
            'l' => '3',
            'b' => TRUE,
            'f' => TRUE,
          ]
        );

        if (($convert_result['exit_code'] ?? 1) !== 0) {
          throw new \RuntimeException('Conversion failed.');
        }
      }
    }

    return [
      'extension' => $extension,
      'is_archive' => $is_archive,
    ];
  }

  private function applyViewerFields($entity, File $file, array $cfg, array $context): array {
    $result = [
      'image_field' => (string) ($cfg['image_generation'] ?? ''),
      'image_urls' => [],
      'lang' => 'en',
      'applied_before_save' => 0,
    ];
    $extension = $context['extension'];
    $is_archive = (bool) $context['is_archive'];
    $fs = \Drupal::service('file_system');
    $file_uri = $file->getFileUri();
    $file_realpath = $fs->realpath($file_uri);
    $dir_uri = preg_replace('#/[^/]+$#', '', $file_uri) ?: '';

    if ($file_realpath && is_file($file_realpath)) {
      $file_name = pathinfo($file_realpath, PATHINFO_BASENAME);
      $file_base = pathinfo($file_realpath, PATHINFO_FILENAME);
    }
    else {
      $file_name = $file->getFilename();
      $file_base = pathinfo($file_uri, PATHINFO_FILENAME) ?: pathinfo($file_name, PATHINFO_FILENAME);
    }
    $file_base_archive = preg_replace('/_[0-9]+$/', '', $file_base, 1);

    $views_dirs = [];
    if ($is_archive) {
      $views_dirs[] = $dir_uri . '/' . $file_base . '_' . $extension . '/views';
      $views_dirs[] = $dir_uri . '/' . $file_base . '_' . strtoupper($extension) . '/views';
    }
    else {
      $views_dirs[] = $dir_uri . '/views';
    }

    $suffixes = [
      '_side45.png',
      '_side90.png',
      '_side135.png',
      '_side180.png',
      '_side225.png',
      '_side270.png',
      '_side315.png',
      '_top.png',
      '_RENDER.png',
    ];

    $name_candidates = [$file_base];
    if ($file_base_archive !== $file_base) {
      $name_candidates[] = $file_base_archive;
    }
    if ($is_archive) {
      $name_candidates[] = $file_base . '_' . $extension;
      $name_candidates[] = $file_base . '_' . strtoupper($extension);
    }

    $best_images = [];
    foreach (array_unique($views_dirs) as $views_dir_uri) {
      $views_real = $fs->realpath($views_dir_uri);
      if (!$views_real || !is_dir($views_real)) {
        continue;
      }

      $dynamic_names = [];
      $side45_files = glob(rtrim($views_real, '/\\') . '/*_side45.png') ?: [];
      foreach ($side45_files as $side45_file) {
        $base_name = preg_replace('/_side45\.png$/', '', basename($side45_file));
        if (!empty($base_name)) {
          $dynamic_names[] = $base_name;
        }
      }

      $all_names = array_unique(array_merge($name_candidates, $dynamic_names));
      foreach ($all_names as $base_name) {
        $candidate_images = [];
        foreach ($suffixes as $suffix) {
          $img_uri = $views_dir_uri . '/' . $base_name . $suffix;
          if (!$this->uriExists($img_uri)) {
            continue;
          }

          $img_url = $this->uriToUrl($img_uri, (string) ($cfg['main_url'] ?? ''));
          if ($img_url !== NULL) {
            $candidate_images[] = $img_url;
          }
        }

        if (count($candidate_images) > count($best_images)) {
          $best_images = $candidate_images;
        }
      }
    }

    $images_paths = $best_images;

    if (!empty($images_paths) && $this->entityHasField($entity, $cfg['image_generation'])) {
      $lang = $this->getCurrentLanguageId();

      $images_field_values = $this->buildFieldValues($entity, $cfg['image_generation'], $images_paths);
      $applied_count = $this->applyFieldValues($entity, $cfg['image_generation'], $images_field_values, $lang);
      $result['image_urls'] = $images_paths;
      $result['lang'] = $lang;
      $result['applied_before_save'] = $applied_count;
      $first_image = $images_paths[0] ?? '';
      \Drupal::logger('dfg_3dviewer')->notice(
        'Added @count rendered images to field "@field" for file "@filename" (@uri). Applied count before save: @applied. First image: @first',
        [
          '@count' => count($images_paths),
          '@field' => $cfg['image_generation'],
          '@filename' => $file_name,
          '@uri' => $file_uri,
          '@applied' => $applied_count,
          '@first' => $first_image,
        ]
      );
    }
    else {
      $views_dirs_text = implode(', ', array_unique($views_dirs));
      $name_candidates_text = implode(', ', array_unique($name_candidates));
      \Drupal::logger('dfg_3dviewer')->warning(
        'No rendered images found for file_uri="@uri" (archive=@archive). Checked views dirs: @dirs. Name candidates: @names',
        [
          '@uri' => $file_uri,
          '@archive' => $is_archive ? 'true' : 'false',
          '@dirs' => $views_dirs_text,
          '@names' => $name_candidates_text,
        ]
      );
    }

    $preferred_uris = [];

    if ($is_archive) {
      $preferred_uris[] = $dir_uri . '/' . $file_base . '_' . $extension . '/gltf/' . $file_base . '.glb';

      if ($file_base_archive !== $file_base) {
        $preferred_uris[] = $dir_uri . '/' . $file_base . '_' . $extension . '/gltf/' . $file_base_archive . '.glb';
      }

      $preferred_uris[] = $dir_uri . '/gltf/' . $file_base . '.glb';

      if ($file_base_archive !== $file_base) {
        $preferred_uris[] = $dir_uri . '/gltf/' . $file_base_archive . '.glb';
      }
    }
    else {
      if ($extension === 'glb') {
        $preferred_uris[] = $dir_uri . '/' . $file_base . '.glb';
      }
      else {
        $preferred_uris[] = $dir_uri . '/gltf/' . $file_base . '.glb';
      }
    }

    $auto_path = '';
    foreach ($preferred_uris as $candidate_uri) {
      if ($this->uriExists($candidate_uri)) {
        $auto_path = $candidate_uri;
        break;
      }
    }

    if ($auto_path === '') {
      $auto_path = $preferred_uris[0] ?? '';
    }

    if (!empty($auto_path) && $this->entityHasField($entity, $cfg['viewer_file_name'])) {
      $entity->set($cfg['viewer_file_name'], $auto_path);
      \Drupal::logger('dfg_3dviewer')->notice(
        'Saved viewer_file_name value "@value".',
        [
          '@value' => $auto_path,
        ]
      );
    }

    return $result;
  }

  private function updateProgress($entity, int $percent, string $status, string $message = ''): void {
    if ($this->entityHasField($entity, 'field_processing_progress')) {
      $entity->set('field_processing_progress', $percent);
    }

    if ($this->entityHasField($entity, 'field_processing_status')) {
      $entity->set('field_processing_status', $status);
    }

    if ($message && $this->entityHasField($entity, 'field_processing_message')) {
      $entity->set('field_processing_message', $message);
    }
  }

  private function entityHasField($entity, string $field_name): bool {
    return method_exists($entity, 'hasField') && $entity->hasField($field_name);
  }

  private function uriExists(string $uri): bool {
    if ($uri === '') {
      return FALSE;
    }

    $fs = \Drupal::service('file_system');
    $real = $fs->realpath($uri);
    return !empty($real) && is_file($real);
  }

  private function uriToUrl(string $uri, string $public_base_url = ''): ?string {
    if ($uri === '') {
      return NULL;
    }

    try {
      $generator = \Drupal::service('file_url_generator');
      $relative = (string) $generator->generateString($uri);

      $public_base_url = trim($public_base_url);
      if ($public_base_url !== '') {
        $base_parts = parse_url($public_base_url);
        if (is_array($base_parts) && !empty($base_parts['scheme']) && !empty($base_parts['host'])) {
          return rtrim($public_base_url, '/') . '/' . ltrim($relative, '/');
        }
      }

      $absolute = $generator->generateAbsoluteString($uri);
      $host = parse_url($absolute, PHP_URL_HOST);
      if (is_string($host) && strpos($host, '_') !== FALSE) {
        return $relative;
      }

      return $absolute;
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Cannot build URL for URI "@uri": @msg',
        [
          '@uri' => $uri,
          '@msg' => $e->getMessage(),
        ]
      );
      return NULL;
    }
  }

  private function buildFieldValues($entity, string $field_name, array $scalar_values): array {
    $main_property = 'value';
    $field_type = 'unknown';
    $property_defs = [];
    $has_value_property = TRUE;
    $has_wisski_language = FALSE;

    try {
      $definition = $entity->getFieldDefinition($field_name);
      if ($definition && method_exists($definition, 'getItemDefinition')) {
        $item_definition = $definition->getItemDefinition();
        if ($item_definition && method_exists($item_definition, 'getPropertyDefinitions')) {
          $property_defs = $item_definition->getPropertyDefinitions() ?: [];
        }
      }

      $has_value_property = empty($property_defs) || isset($property_defs['value']);
      $has_wisski_language = isset($property_defs['wisski_language']);

      if ($definition && method_exists($definition, 'getFieldStorageDefinition')) {
        $storage_definition = $definition->getFieldStorageDefinition();
        if ($storage_definition && method_exists($storage_definition, 'getType')) {
          $field_type = (string) $storage_definition->getType();
        }
        if ($storage_definition && method_exists($storage_definition, 'getMainPropertyName')) {
          $candidate = (string) $storage_definition->getMainPropertyName();
          if ($candidate !== '') {
            $main_property = $candidate;
          }
        }
      }
    }
    catch (\Throwable $e) {
      // Keep default main property fallback.
    }

    if ($has_value_property) {
      $main_property = 'value';
    }

    if ($main_property === 'target_id' && !$has_value_property) {
      $values = [];
      foreach ($scalar_values as $value) {
        $uri = $this->imageLocationToUri((string) $value);
        if ($uri === NULL || !$this->uriExists($uri)) {
          continue;
        }

        $file_id = $this->getOrCreateFileIdByUri($uri);
        if (!empty($file_id)) {
          $values[] = ['target_id' => $file_id];
        }
      }

      \Drupal::logger('dfg_3dviewer')->notice(
        'Prepared @count values for field "@field" (type="@type", main_property="@main").',
        [
          '@count' => count($values),
          '@field' => $field_name,
          '@type' => $field_type,
          '@main' => $main_property,
        ]
      );

      return $values;
    }

    $values = [];
    $lang = 'en';
    try {
      $lang = (string) \Drupal::languageManager()->getCurrentLanguage()->getId();
      if ($lang === '') {
        $lang = 'en';
      }
    }
    catch (\Throwable $e) {
      $lang = 'en';
    }

    foreach ($scalar_values as $value) {
      $row = [$main_property => $value];
      if ($has_wisski_language) {
        $row['wisski_language'] = $lang;
      }
      $values[] = $row;
    }

    \Drupal::logger('dfg_3dviewer')->notice(
      'Prepared @count scalar values for field "@field" (type="@type", main_property="@main", wisski_language=@wl).',
      [
        '@count' => count($values),
        '@field' => $field_name,
        '@type' => $field_type,
        '@main' => $main_property,
        '@wl' => $has_wisski_language ? 'yes' : 'no',
      ]
    );

    return $values;
  }

  private function applyFieldValues($entity, string $field_name, array $values, string $lang = 'en'): int {
    if (!$this->entityHasField($entity, $field_name)) {
      return 0;
    }

    $applied = [];

    try {
      $entity->set($field_name, $values);
      $applied = $entity->get($field_name)->getValue();
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Direct set() failed for field "@field": @msg',
        [
          '@field' => $field_name,
          '@msg' => $e->getMessage(),
        ]
      );
    }

    if (empty($applied) && !empty($values)) {
      try {
        $entity->set($field_name, []);
        foreach ($values as $row) {
          $entity->get($field_name)->appendItem($row);
        }
        $applied = $entity->get($field_name)->getValue();
      }
      catch (\Throwable $e) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'appendItem() fallback failed for field "@field": @msg',
          [
            '@field' => $field_name,
            '@msg' => $e->getMessage(),
          ]
        );
      }
    }

    if (empty($applied)
      && !empty($values)
      && method_exists($entity, 'hasTranslation')
      && method_exists($entity, 'getTranslation')
      && $entity->hasTranslation($lang)) {
      try {
        $translation = $entity->getTranslation($lang);
        if ($this->entityHasField($translation, $field_name)) {
          $translation->set($field_name, $values);
          $applied = $translation->get($field_name)->getValue();

          if (empty($applied)) {
            $translation->set($field_name, []);
            foreach ($values as $row) {
              $translation->get($field_name)->appendItem($row);
            }
            $applied = $translation->get($field_name)->getValue();
          }
        }
      }
      catch (\Throwable $e) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'Translation fallback failed for field "@field" lang="@lang": @msg',
          [
            '@field' => $field_name,
            '@lang' => $lang,
            '@msg' => $e->getMessage(),
          ]
        );
      }
    }

    return is_array($applied) ? count($applied) : 0;
  }

  private function getCurrentLanguageId(): string {
    $lang = 'en';
    try {
      $lang = (string) \Drupal::languageManager()->getCurrentLanguage()->getId();
      if ($lang === '') {
        $lang = 'en';
      }
    }
    catch (\Throwable $e) {
      $lang = 'en';
    }
    return $lang;
  }

  private function getPersistedFieldValues(string $entity_type, string $entity_id, string $field_name): array {
    try {
      $storage = \Drupal::entityTypeManager()->getStorage($entity_type);
      if (method_exists($storage, 'resetCache')) {
        $storage->resetCache([$entity_id]);
      }

      if (method_exists($storage, 'loadUnchanged')) {
        $loaded = $storage->loadUnchanged($entity_id);
      }
      else {
        $loaded = $storage->load($entity_id);
      }
      if (!$loaded || !$this->entityHasField($loaded, $field_name)) {
        return [];
      }
      $values = $loaded->get($field_name)->getValue();
      return is_array($values) ? $values : [];
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Could not read persisted values for field "@field" on @type:@id: @msg',
        [
          '@field' => $field_name,
          '@type' => $entity_type,
          '@id' => $entity_id,
          '@msg' => $e->getMessage(),
        ]
      );
      return [];
    }
  }

  private function ensureImageFieldPersisted(string $entity_type, string $entity_id, array $viewer_result): void {
    $field_name = trim((string) ($viewer_result['image_field'] ?? ''));
    $image_urls = array_values(array_filter(
      (array) ($viewer_result['image_urls'] ?? []),
      static fn($url): bool => is_string($url) && trim($url) !== ''
    ));

    if ($field_name === '' || empty($image_urls)) {
      return;
    }

    $persisted_values = $this->getPersistedFieldValues($entity_type, $entity_id, $field_name);
    $persisted_count = count($persisted_values);
    if ($persisted_count > 0) {
      \Drupal::logger('dfg_3dviewer')->notice(
        'Persisted image field "@field" on @type:@id after save with @count values.',
        [
          '@field' => $field_name,
          '@type' => $entity_type,
          '@id' => $entity_id,
          '@count' => $persisted_count,
        ]
      );
      return;
    }

    $lang = trim((string) ($viewer_result['lang'] ?? '')) ?: $this->getCurrentLanguageId();

    \Drupal::logger('dfg_3dviewer')->warning(
      'Image field "@field" on @type:@id is empty after save. Starting retry with alternate value formats.',
      [
        '@field' => $field_name,
        '@type' => $entity_type,
        '@id' => $entity_id,
      ]
    );

    $formats = [
      'buildFieldValues',
      'legacy_value_wisski_language',
      'plain_scalar_values',
      'plain_single_scalar',
    ];

    foreach ($formats as $format) {
      try {
        $entity = \Drupal::entityTypeManager()->getStorage($entity_type)->load($entity_id);
        if (!$entity || !$this->entityHasField($entity, $field_name)) {
          return;
        }

        $applied_count = 0;
        if ($format === 'buildFieldValues') {
          $rows = $this->buildFieldValues($entity, $field_name, $image_urls);
          $applied_count = $this->applyFieldValues($entity, $field_name, $rows, $lang);
        }
        elseif ($format === 'legacy_value_wisski_language') {
          $rows = [];
          foreach ($image_urls as $url) {
            $rows[] = [
              'value' => (string) $url,
              'wisski_language' => $lang,
            ];
          }
          $applied_count = $this->applyFieldValues($entity, $field_name, $rows, $lang);
        }
        elseif ($format === 'plain_scalar_values') {
          $entity->set($field_name, $image_urls);
          $applied_now = $entity->get($field_name)->getValue();
          $applied_count = is_array($applied_now) ? count($applied_now) : 0;
        }
        else {
          $entity->set($field_name, [$image_urls[0]]);
          $applied_now = $entity->get($field_name)->getValue();
          $applied_count = is_array($applied_now) ? count($applied_now) : 0;
        }

        $this->saveEntity($entity);
        $persisted_values = $this->getPersistedFieldValues($entity_type, $entity_id, $field_name);
        $persisted_count = count($persisted_values);

        \Drupal::logger('dfg_3dviewer')->notice(
          'Retry format "@format" for field "@field" on @type:@id: applied_before_save=@applied, persisted_after_save=@persisted.',
          [
            '@format' => $format,
            '@field' => $field_name,
            '@type' => $entity_type,
            '@id' => $entity_id,
            '@applied' => $applied_count,
            '@persisted' => $persisted_count,
          ]
        );

        if ($persisted_count > 0) {
          return;
        }
      }
      catch (\Throwable $e) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'Retry format "@format" failed for field "@field" on @type:@id: @msg',
          [
            '@format' => $format,
            '@field' => $field_name,
            '@type' => $entity_type,
            '@id' => $entity_id,
            '@msg' => $e->getMessage(),
          ]
        );
      }
    }

    \Drupal::logger('dfg_3dviewer')->error(
      'Could not persist image field "@field" on @type:@id after all retries.',
      [
        '@field' => $field_name,
        '@type' => $entity_type,
        '@id' => $entity_id,
      ]
    );
  }

  private function imageLocationToUri(string $location): ?string {
    $location = trim($location);
    if ($location === '') {
      return NULL;
    }

    if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $location)) {
      if (str_starts_with($location, 'public://') || str_starts_with($location, 'private://') || str_starts_with($location, 'temporary://')) {
        return $location;
      }

      $parsed_path = parse_url($location, PHP_URL_PATH);
      if (is_string($parsed_path)) {
        $location = $parsed_path;
      }
      else {
        return NULL;
      }
    }

    $location = ltrim($location, '/');
    if (str_starts_with($location, 'sites/default/files/')) {
      return 'public://' . substr($location, strlen('sites/default/files/'));
    }

    return NULL;
  }

  private function getOrCreateFileIdByUri(string $uri): ?int {
    if ($uri === '') {
      return NULL;
    }

    try {
      $storage = \Drupal::entityTypeManager()->getStorage('file');
      $existing = $storage->loadByProperties(['uri' => $uri]);
      if (!empty($existing)) {
        $file = reset($existing);
        return $file ? (int) $file->id() : NULL;
      }

      if (!$this->uriExists($uri)) {
        return NULL;
      }

      $file = File::create(['uri' => $uri]);
      $file->setPermanent();
      $file->save();
      return (int) $file->id();
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Could not map URI "@uri" to file entity: @msg',
        [
          '@uri' => $uri,
          '@msg' => $e->getMessage(),
        ]
      );
      return NULL;
    }
  }

  private function saveEntity($entity): void {
    if (method_exists($entity, 'save')) {
      $entity->save();
    }
  }

}
