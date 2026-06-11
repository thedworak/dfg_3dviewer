<?php

namespace Drupal\dfg_3dviewer\Plugin\QueueWorker;

use Drupal\Core\Archiver\ArchiverException;
use Drupal\Core\Archiver\Zip;
use Drupal\Core\Queue\QueueWorkerBase;
use Drupal\dfg_3dviewer\Controller\XmlExportController;
use Drupal\file\Entity\File;
use Symfony\Component\HttpFoundation\Request;

/**
 * @QueueWorker(
 *   id = "dfg_3dviewer_convert",
 *   title = @Translation("DFG 3D Viewer Convert Worker"),
 *   cron = {"time" = 600}
 * )
 */
class ConvertWorker extends QueueWorkerBase {

  private const ADDITIONAL_MODEL_MIRROR_FIELDS = [
    'fdc6300213a0d25d4b68069564846363',
  ];
  private const RECONSTRUCTION_MODELS_FIELD = 'f94cadbe486273b659d4bb3dc220e6d1';
  private const VIEWER_BUNDLE_ID = 'b3a82072952d2046c19de83ac32aa185';

  public function processItem($data) {
    $GLOBALS['dfg_3dviewer_worker_running'] = TRUE;
    $started_at = microtime(TRUE);
    $outcome = 'unknown';

    $entity_id = $data['entity_id'] ?? NULL;
    $file_id = $data['file_id'] ?? NULL;
    $entity_type = $data['entity_type'] ?? 'wisski_individual';
    $source_filename = $data['source_filename'] ?? '';
    $source_uri = $data['source_uri'] ?? '';

    if (!$entity_id) {
      \Drupal::logger('dfg_3dviewer')->error('Missing entity_id in queue item.');
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

    $cfg = dfg_3dviewer_config();
    if (empty($file_id)) {
      if (function_exists('dfg_3dviewer_resolve_current_file_reference')) {
        $resolved = dfg_3dviewer_resolve_current_file_reference($entity, (string) ($cfg['viewer_file_upload'] ?? ''));
        if (is_array($resolved) && !empty($resolved['file_id'])) {
          $file_id = (int) $resolved['file_id'];
          \Drupal::logger('dfg_3dviewer')->notice(
            'Worker resolved missing file_id from entity: entity @entity_id file @file_id.',
            [
              '@entity_id' => (string) $entity_id,
              '@file_id' => (string) $file_id,
            ]
          );
        }
      }
    }
    if (empty($file_id) && function_exists('dfg_3dviewer_load_last_file_id')) {
      $last_file_id = dfg_3dviewer_load_last_file_id((string) $entity_type, (string) $entity_id);
      if (!empty($last_file_id)) {
        $file_id = (int) $last_file_id;
        \Drupal::logger('dfg_3dviewer')->notice(
          'Worker resolved missing file_id from state: entity @entity_id file @file_id.',
          [
            '@entity_id' => (string) $entity_id,
            '@file_id' => (string) $file_id,
          ]
        );
      }
    }
    if (empty($file_id)) {
      \Drupal::logger('dfg_3dviewer')->error(
        'Worker cannot resolve file_id for entity @entity_id; skipping item.',
        ['@entity_id' => (string) $entity_id]
      );
      unset($GLOBALS['dfg_3dviewer_worker_running']);
      return;
    }

    $request_context_pushed = $this->pushSafeRequestContext($cfg);
    $this->repairMalformedPublicFileUrls($entity, $cfg);
    $this->updateProgress($entity, 5, 'init', 'Preparing...');
    try {
      $this->saveEntity($entity);
    }
    catch (\Throwable $e) {
      $this->popSafeRequestContext($request_context_pushed);
      unset($GLOBALS['dfg_3dviewer_worker_running']);
      throw $e;
    }

    $lock = \Drupal::lock();
    $lock_name = 'dfg_3dviewer_convert_' . $entity_type . '_' . $entity_id . '_' . $file_id;

    if (!$lock->acquire($lock_name, 3600)) {
      \Drupal::logger('dfg_3dviewer')->notice(
        'Worker skipped for entity @entity_id file @file_id: lock "@lock" is already held.',
        [
          '@entity_id' => (string) $entity_id,
          '@file_id' => (string) $file_id,
          '@lock' => $lock_name,
        ]
      );
      $this->popSafeRequestContext($request_context_pushed);
      unset($GLOBALS['dfg_3dviewer_worker_running']);
      return;
    }

    try {
      $file = File::load($file_id);
      if (!$file) {
        throw new \RuntimeException('File not found for conversion queue item.');
      }

      $fs = \Drupal::service('file_system');
      $file_uri = $file->getFileUri();
      $input_realpath = $fs->realpath($file_uri);
      $picked_at = $this->formatLogTimestamp();
      $this->updateProgress($entity, 5, 'preparing', 'Preparing...');

      \Drupal::logger('dfg_3dviewer')->notice(
        'Worker picked queued file: picked_at="@picked_at", file_id=@file_id, filename="@filename", uri="@uri", realpath="@realpath", queued_filename="@queued_filename", queued_uri="@queued_uri".',
        [
          '@picked_at' => $picked_at,
          '@file_id' => $file_id,
          '@filename' => $file->getFilename(),
          '@uri' => $file_uri,
          '@realpath' => (string) $input_realpath,
          '@queued_filename' => (string) $source_filename,
          '@queued_uri' => (string) $source_uri,
        ]
      );
      \Drupal::logger('dfg_3dviewer')->notice(
        'Resolved viewer field config: image_generation="@image", field_df="@field_df", viewer_file_name="@viewer_file_name", viewer_file_upload="@viewer_file_upload", api_3d_file_field="@api_3d_file_field".',
        [
          '@image' => (string) ($cfg['image_generation'] ?? ''),
          '@field_df' => (string) ($cfg['field_df'] ?? ''),
          '@viewer_file_name' => (string) ($cfg['viewer_file_name'] ?? ''),
          '@viewer_file_upload' => (string) ($cfg['viewer_file_upload'] ?? ''),
          '@api_3d_file_field' => (string) ($cfg['api_3d_file_field'] ?? ''),
        ]
      );

      $module_path = $fs->realpath(
        \Drupal::service('module_handler')->getModule('dfg_3dviewer')->getPath()
      );

      if (!$module_path) {
        throw new \RuntimeException('Cannot resolve module path.');
      }

      $this->updateProgress($entity, 5, 'processing', 'Converting model...');
      $this->saveEntity($entity);

      $context = $this->convertFile($entity, $file, $cfg, $module_path);
      $this->saveEntity($entity);

      $this->updateProgress($entity, 90, 'updating', 'Updating viewer fields...');
      $viewer_result = $this->applyViewerFields($entity, $file, $cfg, $context);
      $is_lightweight = !empty($cfg['lightweight']);

      $this->updateProgress($entity, 100, 'ready', 'Conversion finished');
      $this->saveEntity($entity);
      if (!$is_lightweight) {
        $this->ensureImageFieldPersisted($entity_type, (string) $entity_id, $viewer_result);
      }
      $this->ensureModelFieldsPersisted($entity_type, (string) $entity_id, $viewer_result);
      if (!$is_lightweight) {
        $this->updateXmlExportField($entity, $cfg);
      }
      $this->saveEntity($entity);
      $outcome = 'success';

      $status_after = '';
      $progress_after = '';
      $message_after = '';
      try {
        $reloaded = \Drupal::entityTypeManager()->getStorage($entity_type)->load($entity_id);
        if ($reloaded) {
          $status_after = $reloaded->hasField('field_processing_status')
            ? (string) $reloaded->get('field_processing_status')->value
            : '';
          $progress_after = $reloaded->hasField('field_processing_progress')
            ? (string) $reloaded->get('field_processing_progress')->value
            : '';
          $message_after = $reloaded->hasField('field_processing_message')
            ? (string) $reloaded->get('field_processing_message')->value
            : '';
        }
      }
      catch (\Throwable $e) {
        // Keep conversion successful; this log is best-effort diagnostics.
      }

      \Drupal::logger('dfg_3dviewer')->notice(
        'Worker post-conversion state for @type:@entity_id file @file_id => status="@status", progress="@progress", message="@message".',
        [
          '@type' => (string) $entity_type,
          '@entity_id' => (string) $entity_id,
          '@file_id' => (string) $file_id,
          '@status' => $status_after,
          '@progress' => $progress_after,
          '@message' => $message_after,
        ]
      );

      \Drupal::logger('dfg_3dviewer')->notice(
        'Conversion finished for entity @entity_id and file @file_id.',
        ['@entity_id' => $entity_id, '@file_id' => $file_id]
      );
    }
    catch (\Throwable $e) {
      $outcome = 'failed';
      \Drupal::logger('dfg_3dviewer')->error(
        'Conversion failed for entity @id: @msg',
        ['@id' => $entity_id, '@msg' => $e->getMessage()]
      );

      $this->updateProgress($entity, 100, 'failed', 'Conversion failed');
      $this->saveEntity($entity);
    }
    finally {
      $lock->release($lock_name);
      $this->popSafeRequestContext($request_context_pushed);
      $duration_ms = (int) round((microtime(TRUE) - $started_at) * 1000);
      \Drupal::logger('dfg_3dviewer')->notice(
        'Worker finalized for @type:@entity_id file @file_id with outcome="@outcome" in @duration_ms ms.',
        [
          '@type' => (string) $entity_type,
          '@entity_id' => (string) $entity_id,
          '@file_id' => (string) $file_id,
          '@outcome' => $outcome,
          '@duration_ms' => (string) $duration_ms,
        ]
      );
      unset($GLOBALS['dfg_3dviewer_worker_running']);
    }
  }

  private function convertFile($entity, File $file, array $cfg, string $module_path): array {
    $fs = \Drupal::service('file_system');
    $realpath = NULL;

    for ($i = 0; $i < 10; $i++) {
      clearstatcache();

      $candidate = $fs->realpath($file->getFileUri());

      if ($candidate && is_file($candidate)) {
        $realpath = $candidate;
        break;
      }

      usleep(500000); // 0.5 sec
    }

    if (!$realpath || !is_file($realpath)) {
      throw new \RuntimeException(
        'Input file does not exist on filesystem after retry wait.'
      );
    }

    $parts = pathinfo($realpath);
    $extension = strtolower($parts['extension'] ?? '');
    if ($extension === '') {
      throw new \RuntimeException('Cannot resolve input file extension.');
    }

    $archives = \Drupal::service('dfg_3dviewer.model_format_manager')->getZipFormats();
    $is_archive = in_arrayi($extension, $archives);
    $archive_suffix = strtoupper($extension);
    $converted_output_uri = '';

    $new_file = $parts['dirname'] . '/gltf/' . $parts['filename'] . '.glb';
    $new_dir = $parts['dirname'] . '/' . $parts['filename'] . '_' . $archive_suffix . '/gltf/';

    if (!file_exists($new_file) && !is_dir($new_dir)) {
      if ($is_archive) {
        $this->updateProgress($entity, 10, 'processing', 'Extracting archive...');

        $extract_path = $parts['dirname'] . '/' . $parts['filename'] . '_' . $archive_suffix . '/';
        if (!is_dir($extract_path) && !mkdir($extract_path, 0775, TRUE) && !is_dir($extract_path)) {
          throw new \RuntimeException('Cannot create archive extraction directory.');
        }

        if ($extension === 'zip') {
          if (!class_exists(\ZipArchive::class)) {
            throw new \RuntimeException('ZipArchive extension is required for zip extraction.');
          }

          $zipArchive = new \ZipArchive();
          $openResult = $zipArchive->open($realpath);
          if ($openResult !== TRUE) {
            throw new \RuntimeException('Cannot open zip archive: error code ' . $openResult);
          }

          for ($i = 0; $i < $zipArchive->numFiles; $i++) {
            $entryName = $zipArchive->getNameIndex($i);
            if ($entryName === false) {
              continue;
            }

            $normalizedEntry = str_replace('\\', '/', $entryName);
            if (strpos($normalizedEntry, '..') !== false
              || preg_match('#(^|/)\.{1,2}(/|$)#', $normalizedEntry)
              || preg_match('#^([A-Za-z]:|/)#', $normalizedEntry)
            ) {
              $zipArchive->close();
              throw new \RuntimeException('Zip archive contains unsafe path entry: ' . $entryName);
            }
          }

          if (!$zipArchive->extractTo($extract_path)) {
            $zipArchive->close();
            throw new \RuntimeException('Archive extraction failed during zip extract.');
          }

          $zipArchive->close();
          clearstatcache();
        }
        else {
          $map = [
            'rar' => 'RAR',
            'tar' => 'TAR',
            'gz' => 'GZ',
            'xz' => 'XZ',
          ];

          $type = $map[$extension] ?? strtoupper($extension);
          $result = \Drupal::service('dfg_3dviewer.convert_process')
            ->uncompress($module_path, $type, $realpath, $extract_path, $parts['filename']);

          if (!($result['success'] ?? FALSE)) {
            $error = trim((string) ($result['error'] ?? ''));
            $output = trim((string) ($result['output'] ?? ''));
            $details = '';
            if ($error !== '') {
              $details .= ' Error: ' . $error;
            }
            if ($output !== '') {
              $details .= ' Output: ' . $output;
            }
            throw new \RuntimeException('Archive extraction failed.' . $details);
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

        $source_dir_uri = preg_replace('#/[^/]+$#', '', $file->getFileUri()) ?: '';
        $converted_output_uri = $source_dir_uri
          . '/' . $parts['filename'] . '_' . $archive_suffix
          . '/gltf/' . pathinfo($model_file, PATHINFO_FILENAME) . '.glb';

        \Drupal::logger('dfg_3dviewer')->notice(
          'Archive conversion target path set to gltf output: @uri',
          ['@uri' => $converted_output_uri]
        );

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
          ],
          function (int $percent, string $state, string $message) use ($entity): void {
            $this->updateProgress($entity, $percent, $state, $message);
            $this->saveEntity($entity);
          }
        );

        if (($convert_result['exit_code'] ?? 1) !== 0) {
          $exit_code = (int) ($convert_result['exit_code'] ?? 1);
          $error_output = trim((string) ($convert_result['error'] ?? ''));
          $standard_output = trim((string) ($convert_result['output'] ?? ''));
          $command = trim((string) ($convert_result['command'] ?? ''));
          \Drupal::logger('dfg_3dviewer')->error(
            'Archive conversion failure details for entity @entity_id file @file_id. Command: @command. Stdout: @stdout. Stderr: @stderr',
            [
              '@entity_id' => (string) ($entity->id() ?? ''),
              '@file_id' => (string) $file->id(),
              '@command' => $command !== '' ? $command : '[unavailable]',
              '@stdout' => $this->truncateLogText($standard_output),
              '@stderr' => $this->truncateLogText($error_output),
            ]
          );
          $message = 'Conversion failed (exit=' . $exit_code . ').';
          if ($error_output !== '') {
            $message .= ' Error: ' . $error_output;
          }
          throw new \RuntimeException($message);
        }
      }
      else {
        $convert_result = \Drupal::service('dfg_3dviewer.convert_process')->run(
          $module_path,
          $realpath,
          (int) $cfg['lightweight'],
          [
            'c' => TRUE,
            'l' => '3',
            'b' => TRUE,
            'f' => TRUE,
          ],
          function (int $percent, string $state, string $message) use ($entity): void {
            $this->updateProgress($entity, $percent, $state, $message);
            $this->saveEntity($entity);
          }
        );

        if (($convert_result['exit_code'] ?? 1) !== 0) {
          $exit_code = (int) ($convert_result['exit_code'] ?? 1);
          $error_output = trim((string) ($convert_result['error'] ?? ''));
          $standard_output = trim((string) ($convert_result['output'] ?? ''));
          $command = trim((string) ($convert_result['command'] ?? ''));
          \Drupal::logger('dfg_3dviewer')->error(
            'Conversion failure details for entity @entity_id file @file_id. Input: @input. Command: @command. Stdout: @stdout. Stderr: @stderr',
            [
              '@entity_id' => (string) ($entity->id() ?? ''),
              '@file_id' => (string) $file->id(),
              '@input' => (string) $realpath,
              '@command' => $command !== '' ? $command : '[unavailable]',
              '@stdout' => $this->truncateLogText($standard_output),
              '@stderr' => $this->truncateLogText($error_output),
            ]
          );
          $message = 'Conversion failed (exit=' . $exit_code . ').';
          if ($error_output !== '') {
            $message .= ' Error: ' . $error_output;
          }
          throw new \RuntimeException($message);
        }
      }
    }

    return [
      'extension' => $extension,
      'is_archive' => $is_archive,
      'converted_output_uri' => $converted_output_uri,
    ];
  }

  private function applyViewerFields($entity, File $file, array $cfg, array $context): array {
    clearstatcache();
    $is_lightweight = !empty($cfg['lightweight']);
    $result = [
      'image_field' => (string) ($cfg['image_generation'] ?? ''),
      'image_urls' => [],
      'model_fields' => [],
      'api_3d_file_field' => trim((string) ($cfg['api_3d_file_field'] ?? '')),
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
    $upload_base = pathinfo((string) $file->getFilename(), PATHINFO_FILENAME);
    if ($upload_base === '') {
      $upload_base = $file_base;
    }
    //$file_base_archive = preg_replace('/_[0-9]+$/', '', $file_base, 1); //temporary disabled
    $file_base_archive = $file_base;

    \Drupal::logger('dfg_3dviewer')->notice(
      'Archive path debug: file_base="@base", archive_dir="@dir"',
      [
        '@base' => $file_base,
        '@dir' => $dir_uri . '/' . $file_base . '_' . strtoupper($extension) . '/gltf',
      ]
    );

    if (!$is_lightweight) {
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

            $img_url = $this->uriToUrl($img_uri, $this->getPreferredPublicBaseUrl($cfg));
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
      $image_storage_values = [];
      foreach ($images_paths as $image_path) {
        $image_uri = $this->imageLocationToUri((string) $image_path);
        $image_storage_values[] = $image_uri ?? (string) $image_path;
      }
      $image_storage_values = array_values(array_unique(array_filter($image_storage_values)));

      if (!empty($images_paths) && $this->entityHasField($entity, $cfg['image_generation'])) {
        $lang = $this->getCurrentLanguageId();
        $image_field = (string) $cfg['image_generation'];
        $requires_target_id = $this->fieldRequiresTargetId($entity, $image_field);

        if ($requires_target_id) {
          if ($this->hasMalformedTargetIdFieldValues($entity, $image_field)) {
            $applied_count = 0;
            \Drupal::logger('dfg_3dviewer')->warning(
              'Skipped updating target_id image field "@field": malformed existing values detected (non-numeric target IDs).',
              ['@field' => $image_field]
            );
          }
          else {
            $images_field_values = $this->buildFieldValues($entity, $image_field, $image_storage_values);
            if (!empty($images_field_values)) {
              $applied_count = $this->applyFieldValues($entity, $image_field, $images_field_values, $lang);
            }
            else {
              $applied_count = 0;
              \Drupal::logger('dfg_3dviewer')->warning(
                'Skipped updating target_id image field "@field": no valid file IDs could be mapped from rendered image paths.',
                ['@field' => $image_field]
              );
            }
          }
        }
        else {
          $applied_count = $this->applyPlainScalarFieldValues($entity, $image_field, $image_storage_values, $lang);
          if ($applied_count === 0) {
            $images_field_values = $this->buildFieldValues($entity, $image_field, $image_storage_values);
            $applied_count = $this->applyFieldValues($entity, $image_field, $images_field_values, $lang);
          }
        }
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
    }
    else {
      \Drupal::logger('dfg_3dviewer')->notice(
        'Skipping rendered image discovery and image field updates for file "@filename" because lightweight mode is enabled.',
        [
          '@filename' => $file_name,
        ]
      );
    }

    $preferred_uris = [];
    $converted_output_uri = trim((string) ($context['converted_output_uri'] ?? ''));
    if ($converted_output_uri !== '') {
      $preferred_uris[] = $converted_output_uri;
    }
    $base_names = array_values(array_filter(array_unique([
      $upload_base,
      $file_base,
      $file_base_archive,
    ])));
    $output_extensions = ['glb', 'gltf'];

    if ($is_archive) {
      $archive_dirs = [
        $dir_uri . '/' . $file_base . '_' . $extension . '/gltf',
        $dir_uri . '/' . $file_base . '_' . strtoupper($extension) . '/gltf',
        $dir_uri . '/gltf',
      ];

      foreach (array_unique($archive_dirs) as $candidate_dir) {
        foreach ($base_names as $base_name) {
          foreach ($output_extensions as $output_ext) {
            $preferred_uris[] = rtrim($candidate_dir, '/\\') . '/' . $base_name . '.' . $output_ext;
          }
        }

        $candidate_real_dir = $fs->realpath($candidate_dir);
        if ($candidate_real_dir && is_dir($candidate_real_dir)) {
          foreach ($output_extensions as $output_ext) {
            $converted_files = glob(rtrim($candidate_real_dir, '/\\') . '/*.' . $output_ext) ?: [];
            foreach ($converted_files as $converted_file) {
              $preferred_uris[] = rtrim($candidate_dir, '/\\') . '/' . basename($converted_file);
            }
          }
        }
      }
    }
    else {
      $non_archive_dirs = in_array($extension, ['glb', 'gltf'], TRUE)
        ? [$dir_uri, $dir_uri . '/gltf']
        : [$dir_uri . '/gltf', $dir_uri];

      foreach (array_unique($non_archive_dirs) as $candidate_dir) {
        foreach ($base_names as $base_name) {
          foreach ($output_extensions as $output_ext) {
            $preferred_uris[] = rtrim($candidate_dir, '/\\') . '/' . $base_name . '.' . $output_ext;
          }
        }
      }
    }

    $auto_path = '';
    foreach ($preferred_uris as $candidate_uri) {
      if ($this->uriExists($candidate_uri)) {
        $auto_path = $candidate_uri;
        break;
      }
    }
    \Drupal::logger('dfg_3dviewer')->notice(
      'Viewer auto_path selection for entity @entity_id: chosen="@chosen" candidates=@count',
      [
        '@entity_id' => (string) ($entity->id() ?? ''),
        '@chosen' => $auto_path,
        '@count' => count($preferred_uris),
      ]
    );
    $auto_path_url = $auto_path !== ''
      ? ($this->uriToUrl($auto_path, $this->getPreferredPublicBaseUrl($cfg)) ?? '')
      : '';
    $auto_storage_value = $auto_path !== '' ? $auto_path : $auto_path_url;
    $source_model_uri = (string) $file_uri;
    $source_model_url = $this->uriToUrl($source_model_uri, $this->getPreferredPublicBaseUrl($cfg)) ?? '';
    $is_source_model_directly_viewable = in_array(strtolower((string) $extension), ['glb', 'gltf'], TRUE);
    $final_model_uri = $auto_path !== '' ? $auto_path : $source_model_uri;
    $final_model_url = $auto_path !== '' ? $auto_path_url : $source_model_url;
    $final_model_storage_value = $final_model_uri !== '' ? $final_model_uri : $final_model_url;
    $final_model_origin = ($auto_path !== '' && $auto_path !== $source_model_uri)
      ? 'converted_output'
      : ($is_source_model_directly_viewable ? 'source_upload_glb_gltf' : 'source_upload_fallback');

    if (($auto_path !== '' || $is_source_model_directly_viewable) && $this->entityHasField($entity, $cfg['viewer_file_name'])) {
      $viewer_field = (string) $cfg['viewer_file_name'];
      if ($this->fieldRequiresTargetId($entity, $viewer_field)) {
        $viewer_values = $this->buildFieldValues($entity, $viewer_field, [$final_model_uri]);
        $this->applyFieldValues($entity, $viewer_field, $viewer_values, $this->getCurrentLanguageId());
        $result['model_fields'][$viewer_field] = [$final_model_uri];
        \Drupal::logger('dfg_3dviewer')->notice(
          'Saved viewer_file_name field "@field" via target_id mapping from "@value" (origin="@origin").',
          [
            '@field' => $viewer_field,
            '@value' => $final_model_uri,
            '@origin' => $final_model_origin,
          ]
        );
      }
      else {
        $scalar_value = $final_model_storage_value;
        $entity->set($viewer_field, $scalar_value);
        $result['model_fields'][$viewer_field] = array_values(array_filter([$scalar_value, $final_model_uri]));
        \Drupal::logger('dfg_3dviewer')->notice(
          'Saved viewer_file_name scalar value "@value" (origin="@origin").',
          [
            '@value' => $scalar_value,
            '@origin' => $final_model_origin,
          ]
        );
      }
    }

    $api_model_field = trim((string) ($cfg['api_3d_file_field'] ?? ''));
    if ($final_model_uri !== '' && $api_model_field !== '' && $this->entityHasField($entity, $api_model_field)) {
      if ($this->fieldRequiresTargetId($entity, $api_model_field)) {
        $api_values = $this->buildFieldValues($entity, $api_model_field, [$final_model_uri]);
        $this->applyFieldValues($entity, $api_model_field, $api_values, $this->getCurrentLanguageId());
        $result['model_fields'][$api_model_field] = [$final_model_uri];
        \Drupal::logger('dfg_3dviewer')->notice(
          'Updated API 3D file field "@field" via target_id mapping from "@value" (origin="@origin").',
          [
            '@field' => $api_model_field,
            '@value' => $final_model_uri,
            '@origin' => $final_model_origin,
          ]
        );
      }
      else {
        $api_scalar_value = $final_model_storage_value;
        $entity->set($api_model_field, $api_scalar_value);
        $result['model_fields'][$api_model_field] = array_values(array_filter([$api_scalar_value, $final_model_uri]));
        \Drupal::logger('dfg_3dviewer')->notice(
          'Updated API 3D file scalar field "@field" to "@value" (origin="@origin").',
          [
            '@field' => $api_model_field,
            '@value' => $api_scalar_value,
            '@origin' => $final_model_origin,
          ]
        );
      }
    }
    elseif ($api_model_field !== '') {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Configured API 3D file field "@field" does not exist on entity @entity_id.',
        [
          '@field' => $api_model_field,
          '@entity_id' => (string) ($entity->id() ?? ''),
        ]
      );
    }

    foreach (self::ADDITIONAL_MODEL_MIRROR_FIELDS as $mirror_field) {
      $mirror_field = trim((string) $mirror_field);
      if ($mirror_field === '' || $mirror_field === $api_model_field || $mirror_field === (string) ($cfg['viewer_file_name'] ?? '')) {
        continue;
      }
      if ($final_model_uri === '') {
        continue;
      }
      $mirror_target_entity = $entity;
      if (!$this->entityHasField($mirror_target_entity, $mirror_field)) {
        $resolved_related = $this->ensureRelated3DViewerEntity($entity);
        if ($resolved_related) {
          $mirror_target_entity = $resolved_related;
        }
      }
      if (!$this->entityHasField($mirror_target_entity, $mirror_field)) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'Additional model mirror field "@field" is not directly available on entity @type:@id. Similar fields: @similar. Field debug: @debug',
          [
            '@field' => $mirror_field,
            '@type' => method_exists($mirror_target_entity, 'getEntityTypeId') ? (string) $mirror_target_entity->getEntityTypeId() : '',
            '@id' => method_exists($mirror_target_entity, 'id') ? (string) $mirror_target_entity->id() : '',
            '@similar' => implode(', ', $this->findSimilarFieldNames($mirror_target_entity, ['converted', 'viewer', '3d', 'model', 'url'])),
            '@debug' => $this->describeFields($mirror_target_entity, $this->findSimilarFieldNames($mirror_target_entity, ['converted', 'viewer', '3d', 'model', 'url'])),
          ]
        );
        continue;
      }

      if ($this->fieldRequiresTargetId($mirror_target_entity, $mirror_field)) {
        $mirror_values = $this->buildFieldValues($mirror_target_entity, $mirror_field, [$final_model_uri]);
        $this->applyFieldValues($mirror_target_entity, $mirror_field, $mirror_values, $this->getCurrentLanguageId());
        $this->saveEntity($mirror_target_entity);
        $result['model_fields'][$mirror_field] = [$final_model_uri];
        \Drupal::logger('dfg_3dviewer')->notice(
          'Updated additional model mirror field "@field" via target_id mapping from "@value" (origin="@origin") on entity @type:@id.',
          [
            '@field' => $mirror_field,
            '@value' => $final_model_uri,
            '@origin' => $final_model_origin,
            '@type' => method_exists($mirror_target_entity, 'getEntityTypeId') ? (string) $mirror_target_entity->getEntityTypeId() : '',
            '@id' => method_exists($mirror_target_entity, 'id') ? (string) $mirror_target_entity->id() : '',
          ]
        );
      }
      else {
        $mirror_target_entity->set($mirror_field, $final_model_storage_value);
        $this->saveEntity($mirror_target_entity);
        $result['model_fields'][$mirror_field] = array_values(array_filter([$final_model_storage_value, $final_model_uri]));
        \Drupal::logger('dfg_3dviewer')->notice(
          'Updated additional model mirror field "@field" to "@value" (origin="@origin") on entity @type:@id.',
          [
            '@field' => $mirror_field,
            '@value' => $final_model_storage_value,
            '@origin' => $final_model_origin,
            '@type' => method_exists($mirror_target_entity, 'getEntityTypeId') ? (string) $mirror_target_entity->getEntityTypeId() : '',
            '@id' => method_exists($mirror_target_entity, 'id') ? (string) $mirror_target_entity->id() : '',
          ]
        );
      }
    }

    $legacy_gallery_field = 'fd6a974b7120d422c7b21b5f1f2315d9';
    if (!empty($images_paths) && $this->entityHasField($entity, $legacy_gallery_field)) {
      $legacy_lang = $this->getCurrentLanguageId();
      $normalized_urls = [];
      foreach ($image_storage_values as $url) {
        $normalized = $this->normalizePublicImageUrl((string) $url, $this->getPreferredPublicBaseUrl($cfg));
        if ($normalized !== '') {
          $normalized_urls[] = $normalized;
        }
      }

      $legacy_applied = $this->forceReplaceUrlValueField($entity, $legacy_gallery_field, $normalized_urls, $legacy_lang);
      \Drupal::logger('dfg_3dviewer')->notice(
        'Forced URL mirror to field "@field". Added @count URLs. Applied before save: @applied. First: @first',
        [
          '@field' => $legacy_gallery_field,
          '@count' => count($normalized_urls),
          '@applied' => $legacy_applied,
          '@first' => (string) ($normalized_urls[0] ?? ''),
        ]
      );
    }

    clearstatcache();
    return $result;
  }

  private function findSimilarFieldNames($entity, array $needles): array {
    if (!is_object($entity) || !method_exists($entity, 'getFields')) {
      return [];
    }

    $matches = [];
    foreach (array_keys($entity->getFields()) as $field_name) {
      $field_name = (string) $field_name;
      $haystack = strtolower($field_name);
      foreach ($needles as $needle) {
        $needle = strtolower((string) $needle);
        if ($needle !== '' && str_contains($haystack, $needle)) {
          $matches[] = $field_name;
          break;
        }
      }
    }

    sort($matches);
    return array_slice(array_values(array_unique($matches)), 0, 30);
  }

  private function describeFields($entity, array $field_names): string {
    if (!is_object($entity) || !method_exists($entity, 'hasField')) {
      return 'n/a';
    }

    $parts = [];
    foreach ($field_names as $field_name) {
      $field_name = (string) $field_name;
      if ($field_name === '' || !$entity->hasField($field_name)) {
        continue;
      }

      $field_type = 'unknown';
      $field_label = '';
      $target_type = '';
      try {
        $definition = $entity->getFieldDefinition($field_name);
        if ($definition && method_exists($definition, 'getLabel')) {
          $field_label = (string) $definition->getLabel();
        }
        if ($definition && method_exists($definition, 'getFieldStorageDefinition')) {
          $storage = $definition->getFieldStorageDefinition();
          if ($storage && method_exists($storage, 'getType')) {
            $field_type = (string) $storage->getType();
          }
          if ($storage && method_exists($storage, 'getSetting')) {
            $target_type = (string) ($storage->getSetting('target_type') ?? '');
          }
        }
      }
      catch (\Throwable $e) {
      }

      $raw = [];
      try {
        $raw = $entity->get($field_name)->getValue();
      }
      catch (\Throwable $e) {
      }

      $encoded = json_encode($raw, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
      if (!is_string($encoded) || $encoded === '') {
        $encoded = '[]';
      }
      if (strlen($encoded) > 220) {
        $encoded = substr($encoded, 0, 220) . '...';
      }

      $meta = $field_type;
      if ($field_label !== '') {
        $meta .= '; label=' . $field_label;
      }
      if ($target_type !== '') {
        $meta .= '; target_type=' . $target_type;
      }

      $parts[] = $field_name . ' [' . $meta . '] ' . $encoded;
    }

    return empty($parts) ? 'n/a' : implode(' | ', $parts);
  }

  private function ensureRelated3DViewerEntity($entity) {
    if (!$this->entityHasField($entity, self::RECONSTRUCTION_MODELS_FIELD)) {
      return NULL;
    }

    try {
      $values = $entity->get(self::RECONSTRUCTION_MODELS_FIELD)->getValue();
      $first = is_array($values[0] ?? null) ? $values[0] : [];
      $target_id = (string) ($first['target_id'] ?? '');
      if ($target_id !== '' && ctype_digit($target_id)) {
        $related = \Drupal::entityTypeManager()->getStorage('wisski_individual')->load((int) $target_id);
        if ($related) {
          return $related;
        }
      }
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Cannot inspect relation field "@field" on entity @id: @msg',
        [
          '@field' => self::RECONSTRUCTION_MODELS_FIELD,
          '@id' => method_exists($entity, 'id') ? (string) $entity->id() : '',
          '@msg' => $e->getMessage(),
        ]
      );
    }

    $created = $this->createWisskiIndividualForBundle(self::VIEWER_BUNDLE_ID);
    if (!$created) {
      return NULL;
    }

    try {
      $entity->set(self::RECONSTRUCTION_MODELS_FIELD, [['target_id' => $created->id()]]);
      $this->saveEntity($entity);
      \Drupal::logger('dfg_3dviewer')->notice(
        'Created related 3D-Viewer entity @related_id and linked it via field "@field" on entity @entity_id.',
        [
          '@related_id' => method_exists($created, 'id') ? (string) $created->id() : '',
          '@field' => self::RECONSTRUCTION_MODELS_FIELD,
          '@entity_id' => method_exists($entity, 'id') ? (string) $entity->id() : '',
        ]
      );
      return $created;
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Created 3D-Viewer entity but could not link it via field "@field" on entity @entity_id: @msg',
        [
          '@field' => self::RECONSTRUCTION_MODELS_FIELD,
          '@entity_id' => method_exists($entity, 'id') ? (string) $entity->id() : '',
          '@msg' => $e->getMessage(),
        ]
      );
    }

    return NULL;
  }

  private function createWisskiIndividualForBundle(string $bundle_id) {
    $storage = \Drupal::entityTypeManager()->getStorage('wisski_individual');
    $attempts = [
      ['bundle' => $bundle_id],
      ['wisski_bundle' => $bundle_id],
      ['bundle_id' => $bundle_id],
      ['type' => $bundle_id],
      ['vid' => $bundle_id],
    ];

    foreach ($attempts as $values) {
      try {
        $entity = $storage->create($values);
        if ($entity && method_exists($entity, 'save')) {
          $entity->save();
          \Drupal::logger('dfg_3dviewer')->notice(
            'Created wisski_individual @id for bundle "@bundle" using keys: @keys',
            [
              '@id' => method_exists($entity, 'id') ? (string) $entity->id() : '',
              '@bundle' => $bundle_id,
              '@keys' => implode(', ', array_keys($values)),
            ]
          );
          return $entity;
        }
      }
      catch (\Throwable $e) {
      }
    }

    \Drupal::logger('dfg_3dviewer')->warning(
      'Unable to create wisski_individual for bundle "@bundle". Tried key variants: bundle, wisski_bundle, bundle_id, type, vid.',
      ['@bundle' => $bundle_id]
    );

    return NULL;
  }

  private function updateXmlExportField($entity, array $cfg): void {
    if (!empty($cfg['lightweight'])) {
      return;
    }

    $field_df = (string) ($cfg['field_df'] ?? '');
    $field_export_viewer = trim((string) ($cfg['export_viewer'] ?? 'export_viewer'));
    $main_url = trim((string) ($cfg['main_url'] ?? ''));

    if ($field_df === '' || $main_url === '' || !$this->entityHasField($entity, $field_df)) {
      return;
    }

    $entity_id = '';
    if (is_object($entity) && method_exists($entity, 'id')) {
      $entity_id = (string) $entity->id();
    }
    if ($entity_id === '') {
      return;
    }

    $main_url = rtrim($main_url, '/');

    try {
      $this->refreshEntityXmlExport($entity_id, $main_url);
      $xml_uri = 'public://xml_structure/' . $entity_id . '.xml';
      $xml_url = $this->uriToUrl($xml_uri, $this->getPreferredPublicBaseUrl($cfg));
      $field_export_viewer_url = trim((string) ($cfg['export_viewer_url'] ?? ''));
      if ($field_export_viewer_url === '') {
        $field_export_viewer_url = 'https://3dtest.dfg-viewer.de/viewer?tx_dlf[id]=@xml_url&tx_dlf[viewer]=';
      }
      if (str_contains($field_export_viewer_url, '@xml_url')) {
        $field_export_viewer_url = str_replace('@xml_url', rawurlencode($xml_url), $field_export_viewer_url);
      }
      else {
        if (!str_contains($field_export_viewer_url, '?')) {
          $field_export_viewer_url .= '?';
        }
        if (!str_ends_with($field_export_viewer_url, '?') && !str_ends_with($field_export_viewer_url, '&')) {
          $field_export_viewer_url .= '&';
        }
        $field_export_viewer_url .= 'tx_dlf[id]=' . rawurlencode($xml_url) . '&tx_dlf[viewer]=';
      }
      $export_url = $this->uriToUrl($field_export_viewer_url, $this->getPreferredPublicBaseUrl($cfg));
      if ($xml_url === NULL || $xml_url === '') {
        throw new \RuntimeException('Cannot resolve XML public URL.');
      }

      $entity->set($field_df, $xml_url);
      if ($field_export_viewer !== '' && $field_export_viewer !== $field_df && $this->entityHasField($entity, $field_export_viewer)) {
        $entity->set($field_export_viewer, $export_url);
        \Drupal::logger('dfg_3dviewer')->notice(
          'Updated XML export field "@field" and export viewer field "@export_field" with URL "@url".',
          [
            '@field' => $field_df,
            '@export_field' => $field_export_viewer,
            '@url' => $xml_url,
          ]
        );
      }
      else {
        \Drupal::logger('dfg_3dviewer')->notice(
          'Updated XML export field "@field" with URL "@url".',
          [
            '@field' => $field_df,
            '@url' => $xml_url,
          ]
        );
      }
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Cannot update XML export field "@field" for entity @entity_id: @msg',
        [
          '@field' => $field_df,
          '@entity_id' => $entity_id,
          '@msg' => $e->getMessage(),
        ]
      );
    }
  }

  private function refreshEntityXmlExport(string $entity_id, string $main_url): void {
    $payload = json_encode([
      'id' => $entity_id,
      'domain' => $main_url,
    ], JSON_THROW_ON_ERROR);
    $request = Request::create(
      '/api/editor/xml-export/' . rawurlencode($entity_id),
      'POST',
      [],
      [],
      [],
      [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_ACCEPT' => 'application/xml',
      ],
      $payload
    );
    $controller = XmlExportController::create(\Drupal::getContainer());
    $response = $controller->export($request, $entity_id);

    if ($response->getStatusCode() !== 200) {
      throw new \RuntimeException('XML export failed with status ' . $response->getStatusCode() . '.');
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
    return is_object($entity) && method_exists($entity, 'hasField') && $entity->hasField($field_name);
  }

  private function getPreferredPublicBaseUrl(array $cfg): string {
    $candidates = [
      trim((string) ($cfg['main_url'] ?? '')),
      trim((string) ($cfg['json_export_base_url'] ?? '')),
    ];

    foreach ($candidates as $candidate) {
      $parts = parse_url($candidate);
      $host = is_array($parts) ? (string) ($parts['host'] ?? '') : '';
      $is_safe = is_array($parts)
        && !empty($parts['scheme'])
        && $host !== ''
        && strpos($host, '_') === FALSE
        && strtolower($host) !== 'default';
      if ($is_safe) {
        return rtrim($candidate, '/');
      }
    }

    return trim((string) ($cfg['main_url'] ?? ''));
  }

  private function pushSafeRequestContext(array $cfg): bool {
    $base_url = $this->getPreferredPublicBaseUrl($cfg);
    $parts = parse_url($base_url);
    $host = is_array($parts) ? (string) ($parts['host'] ?? '') : '';
    if (!is_array($parts)
      || empty($parts['scheme'])
      || $host === ''
      || strpos($host, '_') !== FALSE
      || strtolower($host) === 'default') {
      return FALSE;
    }

    try {
      $request_stack = \Drupal::service('request_stack');
      $current_request = $request_stack->getCurrentRequest();
      $current_host = $current_request ? strtolower((string) $current_request->getHost()) : '';
      if ($current_request && $current_host !== '' && $current_host !== 'default' && strpos($current_host, '_') === FALSE) {
        return FALSE;
      }

      $request = Request::create(rtrim($base_url, '/') . '/');
      $request_stack->push($request);
      if (\Drupal::hasService('router.request_context')) {
        \Drupal::service('router.request_context')->fromRequest($request);
      }

      \Drupal::logger('dfg_3dviewer')->notice(
        'Worker installed canonical request context "@url" instead of CLI host "@host".',
        [
          '@url' => rtrim($base_url, '/'),
          '@host' => $current_host,
        ]
      );
      return TRUE;
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Could not install canonical worker request context from "@url": @msg',
        [
          '@url' => $base_url,
          '@msg' => $e->getMessage(),
        ]
      );
      return FALSE;
    }
  }

  private function popSafeRequestContext(bool $pushed): void {
    if (!$pushed) {
      return;
    }

    try {
      $request_stack = \Drupal::service('request_stack');
      $request_stack->pop();
      $request = $request_stack->getCurrentRequest();
      if ($request && \Drupal::hasService('router.request_context')) {
        \Drupal::service('router.request_context')->fromRequest($request);
      }
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Could not restore request context after conversion: @msg',
        ['@msg' => $e->getMessage()]
      );
    }
  }

  private function repairMalformedPublicFileUrls($entity, array $cfg): void {
    $base_url = rtrim($this->getPreferredPublicBaseUrl($cfg), '/');
    $base_parts = parse_url($base_url);
    $base_host = is_array($base_parts) ? strtolower((string) ($base_parts['host'] ?? '')) : '';
    if (!is_array($base_parts)
      || empty($base_parts['scheme'])
      || $base_host === ''
      || $base_host === 'default'
      || strpos($base_host, '_') !== FALSE) {
      $base_url = '';
    }
    $fields = array_values(array_filter(array_unique(array_merge([
      (string) ($cfg['image_generation'] ?? ''),
      (string) ($cfg['viewer_file_name'] ?? ''),
      (string) ($cfg['api_3d_file_field'] ?? ''),
      'fd6a974b7120d422c7b21b5f1f2315d9',
    ], self::ADDITIONAL_MODEL_MIRROR_FIELDS))));

    foreach ($fields as $field_name) {
      if (!$this->entityHasField($entity, $field_name)) {
        continue;
      }

      try {
        $values = $entity->get($field_name)->getValue();
        $changed = FALSE;
        foreach ($values as &$row) {
          if (!is_array($row)) {
            continue;
          }
          foreach (['value', 'uri'] as $property) {
            $value = trim((string) ($row[$property] ?? ''));
            if ($value === '') {
              continue;
            }

            $parts = parse_url(ltrim($value, '/'));
            $host = is_array($parts) ? strtolower((string) ($parts['host'] ?? '')) : '';
            $path = is_array($parts) ? (string) ($parts['path'] ?? '') : '';
            if ($path === ''
              || !str_starts_with($path, '/sites/default/files/')
              || ($host !== 'default' && strpos($host, '_') === FALSE)) {
              continue;
            }

            $row[$property] = $base_url !== '' ? $base_url . $path : $path;
            $changed = TRUE;
          }
        }
        unset($row);

        if ($changed) {
          $entity->set($field_name, $values);
          \Drupal::logger('dfg_3dviewer')->notice(
            'Repaired malformed CLI file URLs in field "@field" on entity @id.',
            [
              '@field' => $field_name,
              '@id' => method_exists($entity, 'id') ? (string) $entity->id() : '',
            ]
          );
        }
      }
      catch (\Throwable $e) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'Could not repair malformed file URLs in field "@field": @msg',
          [
            '@field' => $field_name,
            '@msg' => $e->getMessage(),
          ]
        );
      }
    }
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
      $public_base_url = trim($public_base_url);
      $base_parts = parse_url($public_base_url);
      $base_host = is_array($base_parts) ? (string) ($base_parts['host'] ?? '') : '';
      $has_safe_base = is_array($base_parts)
        && !empty($base_parts['scheme'])
        && $base_host !== ''
        && strpos($base_host, '_') === FALSE
        && strtolower($base_host) !== 'default';

      // Keep storage deterministic in CLI contexts (e.g. drush) where request
      // host may resolve to container aliases like "dfg_3dviewer".
      if (str_starts_with($uri, 'public://')) {
        $relative_public = '/sites/default/files/' . ltrim(substr($uri, strlen('public://')), '/');
        return $has_safe_base ? rtrim($public_base_url, '/') . $relative_public : $relative_public;
      }

      $generator = \Drupal::service('file_url_generator');
      $relative = (string) $generator->generateString($uri);
      $relative_parts = parse_url($relative);
      $relative_host = is_array($relative_parts) ? (string) ($relative_parts['host'] ?? '') : '';
      $relative_path = is_array($relative_parts) ? (string) ($relative_parts['path'] ?? '') : '';
      $relative_is_absolute = is_array($relative_parts) && !empty($relative_parts['scheme']) && $relative_host !== '';
      $relative_has_bad_host = $relative_is_absolute && strpos($relative_host, '_') !== FALSE;
      if (($relative_has_bad_host || strtolower($relative_host) === 'default')
        && str_starts_with($relative_path, '/sites/default/files/')) {
        $relative = $relative_path;
      }
      if (!$relative_is_absolute && str_starts_with($relative, 'sites/default/files/')) {
        $relative = '/' . ltrim($relative, '/');
      }

      if ($public_base_url !== '' && $has_safe_base) {
        if ($relative_is_absolute) {
          return $relative;
        }
        return rtrim($public_base_url, '/') . '/' . ltrim($relative, '/');
      }

      $absolute = $generator->generateAbsoluteString($uri);
      $host = parse_url($absolute, PHP_URL_HOST);
      if (is_string($host) && (strpos($host, '_') !== FALSE || strtolower($host) === 'default')) {
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
    $entity_type_id = '';
    if (is_object($entity) && method_exists($entity, 'getEntityTypeId')) {
      $entity_type_id = (string) $entity->getEntityTypeId();
    }

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

    if (in_array($field_type, ['image', 'entity_reference'], TRUE)) {
      $main_property = 'target_id';
      $has_value_property = FALSE;
    }

    if ($has_value_property && $main_property !== 'target_id') {
      $main_property = 'value';
    }

    if (!$has_wisski_language && $entity_type_id === 'wisski_individual') {
      // WissKI-backed entities can require language-qualified values even when
      // field metadata does not expose the wisski_language property reliably.
      $has_wisski_language = TRUE;
    }

    if ($main_property === 'target_id') {
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

    if (!empty($values) && method_exists($entity, 'getUntranslated')) {
      try {
        $untranslated = $entity->getUntranslated();
        if ($this->entityHasField($untranslated, $field_name)) {
          $untranslated->set($field_name, $values);
        }
      }
      catch (\Throwable $e) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'Untranslated mirror set failed for field "@field": @msg',
          [
            '@field' => $field_name,
            '@msg' => $e->getMessage(),
          ]
        );
      }
    }

    if (!empty($values)
      && method_exists($entity, 'getTranslationLanguages')
      && method_exists($entity, 'getTranslation')) {
      try {
        $languages = $entity->getTranslationLanguages();
        foreach ($languages as $langcode => $language) {
          if ($langcode === \Drupal\Core\Language\LanguageInterface::LANGCODE_DEFAULT) {
            continue;
          }
          if (!method_exists($entity, 'hasTranslation') || !$entity->hasTranslation($langcode)) {
            continue;
          }
          $translation = $entity->getTranslation($langcode);
          if ($this->entityHasField($translation, $field_name)) {
            $translation->set($field_name, $values);
          }
        }
      }
      catch (\Throwable $e) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'Translation mirror set failed for field "@field": @msg',
          [
            '@field' => $field_name,
            '@msg' => $e->getMessage(),
          ]
        );
      }
    }

    return is_array($applied) ? count($applied) : 0;
  }

  private function applyPlainScalarFieldValues($entity, string $field_name, array $scalar_values, string $lang = 'en'): int {
    if (!$this->entityHasField($entity, $field_name)) {
      return 0;
    }

    clearstatcache();

    $applied = [];
    try {
      $entity->set($field_name, $scalar_values);
      $applied = $entity->get($field_name)->getValue();
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'Plain scalar set() failed for field "@field": @msg',
        [
          '@field' => $field_name,
          '@msg' => $e->getMessage(),
        ]
      );
    }

    if (empty($applied)
      && method_exists($entity, 'hasTranslation')
      && method_exists($entity, 'getTranslation')
      && $entity->hasTranslation($lang)) {
      try {
        $translation = $entity->getTranslation($lang);
        if ($this->entityHasField($translation, $field_name)) {
          $translation->set($field_name, $scalar_values);
          $applied = $translation->get($field_name)->getValue();
        }
      }
      catch (\Throwable $e) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'Plain scalar translation set() failed for field "@field" lang="@lang": @msg',
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

  private function fieldRequiresTargetId($entity, string $field_name): bool {
    try {
      if (!$this->entityHasField($entity, $field_name)) {
        return FALSE;
      }

      $definition = $entity->getFieldDefinition($field_name);
      if (!$definition || !method_exists($definition, 'getFieldStorageDefinition')) {
        return FALSE;
      }

      $storage_definition = $definition->getFieldStorageDefinition();
      if ($storage_definition && method_exists($storage_definition, 'getMainPropertyName')) {
        $main_property = (string) $storage_definition->getMainPropertyName();
        if ($main_property === 'target_id') {
          return TRUE;
        }
      }

      if ($storage_definition && method_exists($storage_definition, 'getType')) {
        $type = (string) $storage_definition->getType();
        if (in_array($type, ['image', 'entity_reference'], TRUE)) {
          return TRUE;
        }
      }
    }
    catch (\Throwable $e) {
      // Fallback below.
    }

    return FALSE;
  }

  private function hasMalformedTargetIdFieldValues($entity, string $field_name): bool {
    if (!$this->entityHasField($entity, $field_name)) {
      return FALSE;
    }

    try {
      $values = $entity->get($field_name)->getValue();
      if (!is_array($values)) {
        return FALSE;
      }

      foreach ($values as $row) {
        if (!is_array($row)) {
          continue;
        }

        if (array_key_exists('target_id', $row)) {
          $target_id = trim((string) $row['target_id']);
          if ($target_id === '' || !ctype_digit($target_id)) {
            return TRUE;
          }
        }
      }
    }
    catch (\Throwable $e) {
      return FALSE;
    }

    return FALSE;
  }

  private function normalizePublicImageUrl(string $url, string $public_base_url = ''): string {
    $url = trim($url);
    if ($url === '') {
      return '';
    }

    $public_base_url = rtrim(trim($public_base_url), '/');
    $base_parts = parse_url($public_base_url);
    $base_host = is_array($base_parts) ? (string) ($base_parts['host'] ?? '') : '';
    $has_base = is_array($base_parts)
      && !empty($base_parts['scheme'])
      && $base_host !== ''
      && strpos($base_host, '_') === FALSE
      && strtolower($base_host) !== 'default';

    if (str_starts_with($url, 'public://')) {
      $relative = '/sites/default/files/' . ltrim(substr($url, strlen('public://')), '/');
      return $has_base ? $public_base_url . $relative : $relative;
    }

    if (str_starts_with($url, '/sites/default/files/')) {
      return $has_base ? $public_base_url . $url : $url;
    }

    $parts = parse_url($url);
    if (!is_array($parts)) {
      return $url;
    }

    $path = (string) ($parts['path'] ?? '');
    $host = (string) ($parts['host'] ?? '');
    $scheme = (string) ($parts['scheme'] ?? '');

    if ($path !== '' && str_starts_with($path, '/sites/default/files/')) {
      if ($host !== '' && (strpos($host, '_') !== FALSE || strtolower($host) === 'default')) {
        return $has_base ? $public_base_url . $path : $path;
      }
      if (!$has_base && in_array(strtolower($scheme), ['http', 'https'], TRUE)) {
        return $path;
      }
      if ($has_base && in_array(strtolower($scheme), ['http', 'https'], TRUE)) {
        return $public_base_url . $path;
      }
    }

    return $url;
  }

  private function forceReplaceUrlValueField($entity, string $field_name, array $urls, string $lang = 'en'): int {
    if (!$this->entityHasField($entity, $field_name)) {
      return 0;
    }

    $rows = [];
    foreach ($urls as $url) {
      $rows[] = ['value' => (string) $url];
    }

    $apply_rows = static function ($target, string $field, array $values): int {
      if (!method_exists($target, 'set') || !method_exists($target, 'get')) {
        return 0;
      }
      $target->set($field, []);
      foreach ($values as $row) {
        $target->get($field)->appendItem($row);
      }
      $applied = $target->get($field)->getValue();
      return is_array($applied) ? count($applied) : 0;
    };

    $applied = 0;
    try {
      $applied = $apply_rows($entity, $field_name, $rows);
    }
    catch (\Throwable $e) {
      \Drupal::logger('dfg_3dviewer')->warning(
        'forceReplaceUrlValueField failed on base entity field "@field": @msg',
        ['@field' => $field_name, '@msg' => $e->getMessage()]
      );
    }

    if (method_exists($entity, 'getUntranslated')) {
      try {
        $untranslated = $entity->getUntranslated();
        if ($this->entityHasField($untranslated, $field_name)) {
          $apply_rows($untranslated, $field_name, $rows);
        }
      }
      catch (\Throwable $e) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'forceReplaceUrlValueField untranslated mirror failed for "@field": @msg',
          ['@field' => $field_name, '@msg' => $e->getMessage()]
        );
      }
    }

    if (method_exists($entity, 'getTranslationLanguages')
      && method_exists($entity, 'hasTranslation')
      && method_exists($entity, 'getTranslation')) {
      try {
        $languages = $entity->getTranslationLanguages();
        foreach ($languages as $langcode => $language) {
          if ($langcode === \Drupal\Core\Language\LanguageInterface::LANGCODE_DEFAULT) {
            continue;
          }
          if (!$entity->hasTranslation($langcode)) {
            continue;
          }
          $translation = $entity->getTranslation($langcode);
          if ($this->entityHasField($translation, $field_name)) {
            $apply_rows($translation, $field_name, $rows);
          }
        }
      }
      catch (\Throwable $e) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'forceReplaceUrlValueField translation mirror failed for "@field": @msg',
          ['@field' => $field_name, '@msg' => $e->getMessage()]
        );
      }
    }

    return $applied;
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

    $entity_probe = \Drupal::entityTypeManager()->getStorage($entity_type)->load($entity_id);
    $formats = $this->fieldRequiresTargetId($entity_probe, $field_name)
      ? ['buildFieldValues']
      : ['plain_scalar_values', 'buildFieldValues', 'legacy_value_wisski_language', 'plain_single_scalar'];

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

  private function ensureModelFieldsPersisted(string $entity_type, string $entity_id, array $viewer_result): void {
    $model_fields = $viewer_result['model_fields'] ?? [];
    if (!is_array($model_fields) || empty($model_fields)) {
      return;
    }

    $lang = trim((string) ($viewer_result['lang'] ?? '')) ?: $this->getCurrentLanguageId();

    foreach ($model_fields as $field_name => $expected_values) {
      $field_name = trim((string) $field_name);
      $expected_values = array_values(array_filter(
        (array) $expected_values,
        static fn($value): bool => is_string($value) && trim($value) !== ''
      ));

      if ($field_name === '' || empty($expected_values)) {
        continue;
      }

      $is_api_field = trim((string) ($viewer_result['api_3d_file_field'] ?? '')) === $field_name;
      [$target_entity_type, $target_entity_id, $target_entity] = $this->resolvePersistenceTargetEntity($entity_type, $entity_id, $field_name);

      $persisted_values = $this->getPersistedFieldValues($target_entity_type, $target_entity_id, $field_name);
      \Drupal::logger('dfg_3dviewer')->notice(
        'Model field "@field" persisted snapshot before retry on @type:@id. API field=@api. Expected candidates: @expected. Persisted raw: @persisted',
        [
          '@field' => $field_name,
          '@type' => $target_entity_type,
          '@id' => $target_entity_id,
          '@api' => $is_api_field ? 'yes' : 'no',
          '@expected' => json_encode($expected_values, JSON_UNESCAPED_SLASHES),
          '@persisted' => json_encode($persisted_values, JSON_UNESCAPED_SLASHES),
        ]
      );
      if ($this->persistedFieldMatchesExpected($persisted_values, $expected_values)) {
        \Drupal::logger('dfg_3dviewer')->notice(
          'Persisted model field "@field" on @type:@id already matches expected value.',
          [
            '@field' => $field_name,
            '@type' => $target_entity_type,
            '@id' => $target_entity_id,
          ]
        );
        continue;
      }

      \Drupal::logger('dfg_3dviewer')->warning(
        'Model field "@field" on @type:@id did not persist as expected. Starting retry.',
        [
          '@field' => $field_name,
          '@type' => $target_entity_type,
          '@id' => $target_entity_id,
        ]
      );

      try {
        $entity = $target_entity;
        if (!$entity || !$this->entityHasField($entity, $field_name)) {
          continue;
        }

        if ($this->fieldRequiresTargetId($entity, $field_name)) {
          $rows = $this->buildFieldValues($entity, $field_name, [$expected_values[0]]);
          $this->applyFieldValues($entity, $field_name, $rows, $lang);
        }
        else {
          $applied = false;
          foreach ($expected_values as $candidate) {
            try {
              $entity->set($field_name, [$candidate]);
              $applied_now = $entity->get($field_name)->getValue();
              if ($this->persistedFieldMatchesExpected(is_array($applied_now) ? $applied_now : [], [$candidate])) {
                $applied = true;
                break;
              }
            }
            catch (\Throwable $e) {
              // Try the next candidate representation.
            }
          }

          if (!$applied) {
            $rows = $this->buildFieldValues($entity, $field_name, [$expected_values[0]]);
            $this->applyFieldValues($entity, $field_name, $rows, $lang);
          }
        }

        $this->saveEntity($entity);
        $persisted_after = $this->getPersistedFieldValues($target_entity_type, $target_entity_id, $field_name);
        \Drupal::logger('dfg_3dviewer')->notice(
          'Model field "@field" persisted snapshot after retry on @type:@id. API field=@api. Expected candidates: @expected. Persisted raw: @persisted',
          [
            '@field' => $field_name,
            '@type' => $target_entity_type,
            '@id' => $target_entity_id,
            '@api' => $is_api_field ? 'yes' : 'no',
            '@expected' => json_encode($expected_values, JSON_UNESCAPED_SLASHES),
            '@persisted' => json_encode($persisted_after, JSON_UNESCAPED_SLASHES),
          ]
        );
        if ($this->persistedFieldMatchesExpected($persisted_after, $expected_values)) {
          \Drupal::logger('dfg_3dviewer')->notice(
            'Retry persisted expected model value for field "@field" on @type:@id.',
            [
              '@field' => $field_name,
              '@type' => $target_entity_type,
              '@id' => $target_entity_id,
            ]
          );
        }
        else {
          \Drupal::logger('dfg_3dviewer')->error(
            'Could not persist expected model value for field "@field" on @type:@id.',
            [
              '@field' => $field_name,
              '@type' => $target_entity_type,
              '@id' => $target_entity_id,
            ]
          );
        }
      }
      catch (\Throwable $e) {
        \Drupal::logger('dfg_3dviewer')->warning(
          'Retry failed for model field "@field" on @type:@id: @msg',
          [
            '@field' => $field_name,
            '@type' => $target_entity_type,
            '@id' => $target_entity_id,
            '@msg' => $e->getMessage(),
          ]
        );
      }
    }
  }

  private function resolvePersistenceTargetEntity(string $entity_type, string $entity_id, string $field_name): array {
    try {
      $storage = \Drupal::entityTypeManager()->getStorage($entity_type);
      $entity = $storage->load($entity_id);
      if (!$entity) {
        return [$entity_type, $entity_id, NULL];
      }

      if ($this->entityHasField($entity, $field_name)) {
        return [$entity_type, $entity_id, $entity];
      }

      if (in_array($field_name, self::ADDITIONAL_MODEL_MIRROR_FIELDS, TRUE)) {
        $related = $this->ensureRelated3DViewerEntity($entity);
        if ($related && $this->entityHasField($related, $field_name)) {
          return [
            method_exists($related, 'getEntityTypeId') ? (string) $related->getEntityTypeId() : $entity_type,
            method_exists($related, 'id') ? (string) $related->id() : $entity_id,
            $related,
          ];
        }
      }

      return [$entity_type, $entity_id, $entity];
    }
    catch (\Throwable $e) {
      return [$entity_type, $entity_id, NULL];
    }
  }

  private function persistedFieldMatchesExpected(array $persisted_values, array $expected_values): bool {
    if (empty($persisted_values) || empty($expected_values)) {
      return FALSE;
    }

    $expected_values = array_values(array_unique(array_map('strval', $expected_values)));
    foreach ($persisted_values as $row) {
      if (!is_array($row)) {
        continue;
      }

      if (array_key_exists('target_id', $row)) {
        $target_id = trim((string) $row['target_id']);
        if ($target_id !== '' && ctype_digit($target_id)) {
          try {
            $file = File::load((int) $target_id);
            if ($file) {
              $uri = trim((string) $file->getFileUri());
              $url = trim((string) ($this->uriToUrl($uri, '') ?? ''));
              $url_path = trim((string) parse_url($url, PHP_URL_PATH));
              foreach ([$uri, $url, $url_path] as $candidate) {
                if ($candidate !== '' && in_array($candidate, $expected_values, TRUE)) {
                  return TRUE;
                }
              }
            }
          }
          catch (\Throwable $e) {
            // Continue with raw comparisons below.
          }
        }
      }

      foreach ($row as $value) {
        $value = trim((string) $value);
        if ($value !== '' && in_array($value, $expected_values, TRUE)) {
          return TRUE;
        }
      }
    }

    return FALSE;
  }

  private function imageLocationToUri(string $location): ?string {
    $location = trim($location);
    if ($location === '') {
      return NULL;
    }

    // Handle malformed values like "/http://host/sites/default/files/...".
    if (preg_match('#^/[a-z][a-z0-9+.-]*://#i', $location)) {
      $location = ltrim($location, '/');
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

  private function truncateLogText(string $text, int $limit = 4000): string {
    $text = trim(preg_replace('/\s+/', ' ', $text));
    if ($text === '') {
      return '[empty]';
    }

    if (strlen($text) <= $limit) {
      return $text;
    }

    return substr($text, 0, $limit) . '... [truncated]';
  }

  private function formatLogTimestamp(): string {
    return date('Y-m-d H:i:s');
  }

}
