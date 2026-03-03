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
      $this->applyViewerFields($entity, $file, $cfg, $context);

      $this->updateProgress($entity, 100, 'ready', 'Conversion finished');
      $this->saveEntity($entity);

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

  private function applyViewerFields($entity, File $file, array $cfg, array $context): void {
    $extension = $context['extension'];
    $is_archive = (bool) $context['is_archive'];
    $fs = \Drupal::service('file_system');
    $file_uri = $file->getFileUri();
    $file_realpath = $fs->realpath($file_uri);

    $request = \Drupal::requestStack()->getCurrentRequest();
    $base = $request
      ? $request->getSchemeAndHttpHost()
      : rtrim((string) ($cfg['main_url'] ?? ''), '/');

    if ($file_realpath && is_file($file_realpath)) {
      $file_name = pathinfo($file_realpath, PATHINFO_BASENAME);
      $file_base = pathinfo($file_realpath, PATHINFO_FILENAME);
    }
    else {
      $file_name = $file->getFilename();
      $file_base = pathinfo($file_uri, PATHINFO_FILENAME) ?: pathinfo($file_name, PATHINFO_FILENAME);
    }
    $img_suffix = '_side45.png';

    $file_url = \Drupal::service('file_url_generator')->generate($file->getFileUri())->toString();
    $base_dir = rtrim(dirname($file_url), '/');
    $base_prefix = preg_match('/^https?:\/\//i', $base_dir) ? '' : $base;

    if ($is_archive) {
      $view_base = $base_prefix . $base_dir . '/' . $file_base . '_' . $extension . '/views/' . $file_base;

      if (!url_exists($view_base . $img_suffix)) {
        $file_base_archive = preg_replace('/_[0-9]+$/', '', $file_base);
        $view_base = $base_prefix . $base_dir . '/' . $file_base . '_' . $extension . '/views/' . $file_base_archive;
      }
    }
    else {
      $view_base = $base_prefix . $base_dir . '/views/' . $file_base;

      if (!url_exists($view_base . $img_suffix)) {
        $view_base = $base_prefix . $base_dir . '/' . $file_base;
      }

      if (!url_exists($view_base . $img_suffix)) {
        $view_base = $base_prefix . $base_dir . '/views/' . $file_base;
      }
    }

    $view_base = str_replace(' ', '%20', $view_base);
    clearstatcache();

    $images_temp = [
      $view_base . $img_suffix,
      $view_base . '_side0.png',
      $view_base . '_side90.png',
      $view_base . '_side135.png',
      $view_base . '_side180.png',
      $view_base . '_side225.png',
      $view_base . '_side270.png',
      $view_base . '_side315.png',
      $view_base . '_top.png',
    ];

    $images_paths = [];

    foreach ($images_temp as $url) {
      $url_path = parse_url($url, PHP_URL_PATH);
      if (!$url_path) {
        continue;
      }

      $local_path = rtrim(DRUPAL_ROOT, '/\\') . '/' . ltrim($url_path, '/');
      if (!is_file($local_path)) {
        continue;
      }

      $images_paths[] = $url;
    }

    if (!empty($images_paths) && $this->entityHasField($entity, $cfg['image_generation'])) {
      $entity->set($cfg['image_generation'], $images_paths);
    }

    $fpath = str_replace($file_name, '', $file_url);
    $last_slash = strrpos($fpath, '/');
    $sub_path = $last_slash !== FALSE ? substr($fpath, 0, $last_slash) : dirname($fpath);

    $file_base_archive = preg_replace('/_[0-9]+$/', '', $file_base, 1);
    $auto_path = '';

    if ($is_archive) {
      semi_automatic_path($sub_path . '/' . $file_base . '_' . $extension, $file_base, $file_base_archive, $auto_path, $extension);
    }
    else {
      semi_automatic_path($sub_path, $file_base, '', $auto_path, $extension);
    }

    if ($extension === 'glb') {
      $orig_path = $sub_path . '/' . $file_base . '.glb';
    }
    else {
      $orig_path = $sub_path . '/gltf/' . $file_base . '.glb';
    }

    $orig_arch_path = $sub_path . '/' . $file_base . '_' . $extension . '/gltf/' . $file_base . '.glb';

    if ($auto_path === '') {
      // Keep semi-automatic fallback result as-is.
    }
    elseif (!$is_archive) {
      $auto_path = $orig_path;
    }
    elseif (file_exists($orig_arch_path)) {
      $auto_path = $orig_arch_path;
    }
    else {
      $auto_path = $orig_path;
    }

    $auto_uri = $this->localPathToManagedUri($auto_path);
    if (!empty($auto_uri)) {
      $auto_path = $auto_uri;
    }

    if (!empty($auto_path) && $this->entityHasField($entity, $cfg['viewer_file_name'])) {
      $entity->set($cfg['viewer_file_name'], $auto_path);
      \Drupal::logger('dfg_3dviewer')->notice(
        'Saved viewer_file_name value "@value" (resolved_uri="@uri").',
        [
          '@value' => $auto_path,
          '@uri' => (string) $auto_uri,
        ]
      );
    }

    if ($this->entityHasField($entity, $cfg['field_df'])) {
      $entity->set($cfg['field_df'], '');
    }
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

  private function localPathToManagedUri(string $path): ?string {
    if ($path === '') {
      return NULL;
    }

    $normalized_path = rtrim($this->normalizePath($path), '/');
    $fs = \Drupal::service('file_system');

    foreach (['public', 'private', 'temporary'] as $scheme) {
      $scheme_root = $fs->realpath($scheme . '://');
      if (!$scheme_root) {
        continue;
      }

      $normalized_root = rtrim($this->normalizePath($scheme_root), '/');
      if ($normalized_path === $normalized_root) {
        return $scheme . '://';
      }

      $prefix = $normalized_root . '/';
      if (str_starts_with($normalized_path, $prefix)) {
        $relative = ltrim(substr($normalized_path, strlen($prefix)), '/');
        return $scheme . '://' . $relative;
      }
    }

    return NULL;
  }

  private function normalizePath(string $path): string {
    return str_replace('\\', '/', $path);
  }

  private function saveEntity($entity): void {
    if (method_exists($entity, 'save')) {
      $entity->save();
    }
  }

}
