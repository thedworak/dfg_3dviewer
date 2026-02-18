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
      return;
    }

    $entity = \Drupal::entityTypeManager()
      ->getStorage('wisski_individual')
      ->load($entity_id);

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

      $entity->set('processing_status', 'processing');
      $entity->save();

      /* =======================================================
         1ARCHIVE HANDLING
      ======================================================= */

      if (in_array($extension, $archives)) {

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

      require DRUPAL_ROOT . '/modules/dfg_3dviewer/php/build_xml.php';
      build_xml($entity_id, $cfg['main_url']);

      /* =======================================================
         UPDATE ENTITY FIELDS
      ======================================================= */

      $entity->set('processing_status', 'ready');
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

      $entity->set('processing_status', 'failed');
      $entity->save();
    }
  }
}
