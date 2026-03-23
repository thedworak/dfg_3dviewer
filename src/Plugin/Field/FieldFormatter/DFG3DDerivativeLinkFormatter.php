<?php
 /**
 * @file
 * Definition of Drupal\dfg_3dviewer\Plugin\field\formatter\DFG3DDerivativeLinkFormatter.
 */
   
  namespace Drupal\dfg_3dviewer\Plugin\Field\FieldFormatter;
   
  use Drupal\Core\Entity\EntityStorageInterface;
  use Drupal\Core\Field\FieldItemListInterface;
  use Drupal\Core\Field\FieldDefinitionInterface;
  use Drupal\Core\Link;
  use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
  use Drupal\Core\Session\AccountInterface;
  use Drupal\Core\Url;
  use Drupal\image\Entity\ImageStyle;
  use Symfony\Component\DependencyInjection\ContainerInterface;
  use Drupal\Core\Form\FormStateInterface;
  use Drupal\Core\Cache\Cache;
  use Drupal\image\Plugin\Field\FieldFormatter\ImageFormatterBase;
  use Drupal\colorbox\Plugin\Field\FieldFormatter\ColorboxFormatter;
  use Drupal\Core\Template\Attribute;
  use Drupal\file\Plugin\Field\FieldFormatter\FileFormatterBase;
    
  /**
 * Plugin implementation of the 'wisski_iip_image' formatter.
 *
 * @FieldFormatter(
 *   id = "dfg_3dderivativelink",
 *   module = "dfg_3dderivativelink",
 *   label = @Translation("DFG 3D Derivative Link"),
 *   field_types = {
 *     "file"
 *   }
 * )
 */
#  class WisskiIIPImageFormatter extends ImageFormatterBase {
class DFG3DDerivativeLinkFormatter extends FileFormatterBase {

    /**
     * {@inheritdoc}
     */
    public function viewElements(FieldItemListInterface $items, $langcode) {


//      $elements = parent::viewElements($items, $langcode);
      $elements = array();

      $files = $this->getEntitiesToView($items, $langcode);

      dfg_3dviewer_attach_assets($elements);

      // get the config
      $cfg = dfg_3dviewer_config();

      foreach ($files as $delta => $file) {

          // get the filename
          $filename = $file->getFilename();

          // get pathinfo
          $pathinfo = pathinfo($file->getFilename());

          // pathinfo without the first extension so bla.tar.gz goes to bla.tar
          $local_filename = $pathinfo['filename'];

          // bla.tar.gz -> gz
          $extension = $pathinfo['extension'];

          // thats something like public://2022-01/bla.tar.gz
          $local_fileuri = $file->getFileUri();

          // we do a switch for compressed file formats because they are handled otherwise.
          if($extension == "tar" || $extension == "zip" || $extension == "gz" || $extension == "xz" || $extension == "rar") {
            $local_fileuri = str_replace("." . $extension, "_" . strtoupper($extension), $local_fileuri);

            $local_fileuri = $local_fileuri . "/gltf/" . $local_filename . ".glb";

           } if($extension == "glb" || $extension == "gltf") {
             // do nothing - just party :D

           } else {
             $local_fileuri = str_replace($filename, "gltf/" . $filename . ".glb", $local_fileuri);
           }

          $file_link = $this->uriToUrl($local_fileuri, (string) ($cfg['main_url'] ?? ''));

          $url =  Url::fromUri($file_link);



          $elements[$delta] = array(
            '#type' => 'link',
            '#title' => $file_link, //$file->getFilename(),
            '#url' => $url,
          );

//        }
      }

      return $elements;

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
          if ($relative_path !== '' && str_starts_with($relative_path, '/sites/default/files/')) {
            return rtrim($public_base_url, '/') . $relative_path;
          }
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

    /**
     * {@inheritdoc}
     */
    public static function defaultSettings() {
      return [
//        'wisski_inline' => 'FALSE',
      ] + parent::defaultSettings();
    }
    
    /**
     * {@inheritdoc}
     */
    public function settingsForm(array $form, FormStateInterface $form_state) {

      $element = parent::settingsForm($form, $form_state);
      return $element;
    }
    
    /**
     * {@inheritdoc}
     */
    public function settingsSummary() {
      return parent::settingsSummary();
    }
  }
