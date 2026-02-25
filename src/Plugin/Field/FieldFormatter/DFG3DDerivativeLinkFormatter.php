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

      $elements['#attached']['library'][] = dfg_3dviewer_get_library();

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
                    
          $file_link = \Drupal::service('file_url_generator')->generateString($local_fileuri);
                    
          $url = Url::fromUri(
            \Drupal::service('file_url_generator')->generateString($local_fileuri),
            ['absolute' => FALSE]
          );

          $elements[$delta] = array(
            '#type' => 'link',
            '#title' => $file_link, //$file->getFilename(),
            '#url' => $url,
          );

//        }
      }

      return $elements;

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
