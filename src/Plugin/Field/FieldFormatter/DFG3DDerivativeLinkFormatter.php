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

#      dpm(serialize($items), "items");


//      $elements = parent::viewElements($items, $langcode);    
      $elements = array();

      $files = $this->getEntitiesToView($items, $langcode);

      $elements['#attached']['library'][] = 'dfg_3dviewer/dfg_3dviewer';

      foreach ($files as $delta => $file) {

//        if(strtolower(substr($file->getFilename(), -4)) == ".pdf") {

#          dpm(serialize($file), "file");
/*
          $elements[$delta] = array(
            '#type' => 'link',
            '#title' => $file->getFilename(),
            '#url' => Url::fromUri(file_create_url($file->getFileUri())),
          );
*/

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
                    
          $file_link = file_create_url($local_fileuri);
                    
          $url =  Url::fromUri($file_link);
          


          $elements[$delta] = array(
            '#type' => 'link',
            '#title' => $file_link, //$file->getFilename(),
            '#url' => $url,
//            '#tag' => 'p',
//            '#attributes' => array('id' => 'DFG_3DViewer', '3d' => file_create_url($file->getFileUri())),
            //'#value' => file_create_url($file->getFileUri()), //$file->getFilename(),
          );

//        }
      }
/*      
      $elements['#attached']['library'][] = 'wisski_iip_image/iipmooviewer';
      $elements['#attached']['library'][] = 'wisski_iip_image/iip_integration';
      $elements['#attached']['drupalSettings']['wisski']['iip']['config'] = \Drupal::config('wisski_iip_image.config')->get();

      $files = $this->getEntitiesToView($items, $langcode);

#      dpm($files, "files");

      // Early opt-out if the field is empty.
      if (empty($files)) {
        return $elements;
      }
      
      $service = \Drupal::service('image.toolkit.manager');
      $toolkit = $service->getDefaultToolkit();
#      dpm($toolkit);
#      $config = $this->configFactory->getEditable('imagemagick.settings');
      
      if(empty($toolkit) || $toolkit->getPluginId() !== "imagemagick") {
        $this->messenger()->addError('Your default toolkit is not imagemagick. Please use imagemagick for this module.');
        return $elements;
      }
      
      $config = \Drupal::service('config.factory')->getEditable('imagemagick.settings');
      
      $formats = $config->get('image_formats');
      
      if(!isset($formats["PTIF"])) {
        $this->messenger()->addStatus("PTIF was not a valid image format. We enabled it for you. Make sure it is supported by your imagemagick configuration.");
        $formats["PTIF"] = array('mime_type' => "image/tiff", "enabled" => TRUE);
        $config->set('image_formats', $formats);
        $config->save();
      }
      

      $image_style_name = 'wisski_pyramid';

      if(! $image_style = ImageStyle::load($image_style_name)) {
        $values = array('name'=>$image_style_name,'label'=>'Wisski Pyramid Style');
        $image_style = ImageStyle::create($values);
        $image_style->addImageEffect(array('id' => 'WisskiPyramidalTiffImageEffect'));
        $image_style->save();
      }

      foreach ($files as $delta => $file) {

        if(strtolower(substr($file->getFilename(), -4)) == ".pdf") {

#          dpm(serialize($file), "file");

          $elements[$delta] = array(
            '#type' => 'link',
            '#title' => $file->getFilename(),
            '#url' => Url::fromUri(file_create_url($file->getFileUri())),
          );
        }

        // in case of prerendered files - use these paths.        
        $prerendered_paths = \Drupal::config('wisski_iip_image.settings')->get('wisski_iip_image_prerendered_path');

        // if there are paths
        if(!empty($prerendered_paths)) {
          $mainbreak = FALSE;

          // try if any of them has files
          foreach($prerendered_paths as $prerendered_path) {
            $image_uri = $prerendered_path . $file->getFilename();

            // if we find anything break here
            if(file_exists($image_uri)) {
              $mainbreak = TRUE;
            }
          }
          // continue with next image
          if($mainbreak)
            continue;
          // if we did not find anything we generate a derivative
        }

        $image_uri = ImageStyle::load('wisski_pyramid')->buildUri($file->getFileUri());

        if(!file_exists($image_uri))
          $image_style->createDerivative($file->getFileUri(),$image_uri);

#        $url = Url::fromUri(file_create_url($image_uri));     

      }
#      dpm($elements);

#      dpm(serialize($elements), "ele");
*/
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

/*      $element['wisski_inline'] = [
        '#type' => 'checkbox',
        '#title' => $this->t('Inline mode for IIP'),
        '#default_value' => $this->getSetting('wisski_inline'),
      ];
 */     
 //     $element = $element + parent::settingsForm($form, $form_state);
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
