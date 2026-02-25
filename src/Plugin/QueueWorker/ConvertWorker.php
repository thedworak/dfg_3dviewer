<?php

namespace Drupal\dfg_3dviewer\Plugin\QueueWorker;

use Drupal\Core\Queue\QueueWorkerBase;
use Drupal\file\Entity\File;
use Drupal\Core\Archiver\Zip;
use Drupal\Core\Archiver\ArchiverException;

/**
 * @QueueWorker(
 *   id = "dfg_3dviewer_convert",
 *   title = @Translation("DFG 3D Viewer Convert Worker"),
 *   cron = {"time" = 120}
 * )
 */
class ConvertWorker extends QueueWorkerBase {

public function processItem($data) {

  $entity_id = $data['entity_id'] ?? NULL;
  $file_id   = $data['file_id'] ?? NULL;

  if (!$entity_id || !$file_id) {
    \Drupal::logger('dfg_3dviewer')
      ->error('Missing entity_id or file_id in queue item.');
    return;
  }

  $entity = \Drupal::entityTypeManager()
    ->getStorage('wisski_individual')
    ->load($entity_id);

  if (!$entity) {
    \Drupal::logger('dfg_3dviewer')
      ->error('Entity not found for ID @id', ['@id' => $entity_id]);
    return;
  }

  $lock = \Drupal::lock();
  $lock_name = 'dfg_3dviewer_convert_' . $entity_id;

  if (!$lock->acquire($lock_name, 3600)) {
    return;
  }

  try {

    $this->updateProgress($entity, 5, 'processing', 'Preparing...');

      if (!$entity_id || !$file_id) {
        return;
      }

      $entity = \Drupal::entityTypeManager()
        ->getStorage('wisski_individual')
        ->load($entity_id);

      if (!$entity) {
        \Drupal::logger('dfg_3dviewer')
          ->error('Entity not found for ID @id', ['@id' => $entity_id]);
        return;
      }

      $file = File::load($file_id);

      if (!$entity || !$file) {
        return;
      }

      $cfg = dfg_3dviewer_config();

      $fs = \Drupal::service('file_system');
      $realpath = $fs->realpath($file->getFileUri());
      $parts = pathinfo($realpath);
      $extension = strtolower($parts['extension']);

      $archives = ['zip','rar','tar','xz','gz'];

      $modulePath = $fs->realpath(
        \Drupal::service('module_handler')
          ->getModule('dfg_3dviewer')->getPath()
      );

      $extractPath = $parts['dirname'] . '/' .
                    $parts['filename'] . '_' .
                    strtoupper($extension) . '/';

      try {

        $entity->set('field_processing_status', 'processing');
        $entity->save();

        /* =======================================================
          ARCHIVE HANDLING
        ======================================================= */

        if (in_array($extension, $archives)) {
          $this->updateProgress($entity, 10, 'processing', 'Extracting archive...');

          if (!is_dir($extractPath)) {
            mkdir($extractPath, 0775, true);
          }

          if ($extension === 'zip') {

            $zip = new Zip($realpath);
            $zip->extract($extractPath);

          } else {

            $map = [
              'rar' => 'rar',
              'tar' => 'tar',
              'gz'  => 'tar',
              'xz'  => 'xz',
            ];

            $result = \Drupal::service('dfg_3dviewer.convert_process')
              ->uncompress(
                $modulePath,
                strtoupper($map[$extension]),
                $realpath,
                $extractPath,
                $parts['filename']
              );

            if (!$result['success']) {
              throw new \Exception('Archive extraction failed');
            }
          }

          /* =======================================================
            FIND FIRST SUPPORTED MODEL
          ======================================================= */
          $this->updateProgress($entity, 25, 'processing', 'Model detected...');

          $allowedFormats = \Drupal::service('dfg_3dviewer.model_format_manager')
            ->getAllowedModelFormats();

          $modelFile = NULL;

          $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($extractPath)
          );

          foreach ($iterator as $fileInfo) {

            if (!$fileInfo->isFile()) {
              continue;
            }

            $ext = strtolower($fileInfo->getExtension());

            if (in_array($ext, $allowedFormats)) {
              $modelFile = $fileInfo->getPathname();
              break;
            }
          }

          if (!$modelFile) {
            throw new \Exception('No supported 3D model found in archive');
          }

        }
        else {
          $modelFile = $realpath;
        }

        /* =======================================================
          CONVERSION
        ======================================================= */
        $this->updateProgress($entity, 35, 'processing', 'Converting to GLTF and generating thumbnails...');

        $convertResult = \Drupal::service('dfg_3dviewer.convert_process')
          ->run(
            $modulePath,
            $modelFile,
            (int) $cfg['lightweight'],
            [
              'c' => 'true',
              'l' => '3',
              'b' => 'true',
              'f' => 'true',
            ]
          );

        if (($convertResult['exit_code'] ?? 1) !== 0) {
          throw new \Exception('Conversion failed');
        }

        /* =======================================================
          BUILD XML
        ======================================================= */

        $this->updateProgress($entity, 95, 'processing', 'Building XML...');

        require_once DRUPAL_ROOT . '/modules/dfg_3dviewer/php/build_xml.php';
        build_xml($entity_id, $cfg['main_url']);

        /* =======================================================
          UPDATE ENTITY FIELDS
        ======================================================= */

        $entity->set('field_processing_status', 'ready');
        $entity->save();

        \Drupal::logger('dfg_3dviewer')
          ->notice('Conversion finished for entity @id', ['@id' => $entity_id]);

      }
      catch (\Throwable $e) {

        \Drupal::logger('dfg_3dviewer')->error(
          'Conversion failed for entity @id: @msg',
          [
            '@id' => $entity_id,
            '@msg' => $e->getMessage(),
          ]
        );
        $this->updateProgress($entity, 100, 'failed', 'Conversion failed');
        $entity->save();
      }
    }
    catch (\Throwable $e) {    
      \Drupal::logger('dfg_3dviewer')->error(
        'Conversion failed for entity @id: @msg',
        [
          '@id' => $entity_id,
          '@msg' => $e->getMessage(),
        ]);
    }
    finally {
      $lock->release($lock_name);
    }
  }

  private function updateProgress($entity, int $percent, string $status, string $message = '') {
      $entity->set('field_processing_progress', $percent);
      $entity->set('field_processing_status', $status);

      if ($message) {
          $entity->set('field_processing_message', $message);
      }

      $entity->save();
  }
}
