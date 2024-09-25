<?php
 /**
 * @file
 * Definition of Drupal\dfg_3dviewer\Plugin\field\formatter\DFG3DViewerFormatter.
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
 *   id = "dfg_3dviewer",
 *   module = "dfg_3dviewer",
 *   label = @Translation("DFG 3D Viewer"),
 *   field_types = {
 *     "file"
 *   }
 * )
 */
#  class WisskiIIPImageFormatter extends ImageFormatterBase {
class DFG3DViewerFormatter extends FileFormatterBase {

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
          $override_basenamespace = \Drupal::service('config.factory')->getEditable('dfg_3dviewer.settings')->get('dfg_3dviewer_basenamespace') . \Drupal::service('file_url_generator')->generateString($file->getFileUri());
          if (is_null($override_basenamespace)) $override_basenamespace = \Drupal::service('file_url_generator')->generateAbsoluteString($file->getFileUri());

          $elements[$delta] = array(
            '#type' => 'html_tag',
            '#tag' => 'p',
            '#attributes' => array('id' => 'DFG_3DViewer', '3d' => $override_basenamespace),
            //'#value' => file_create_url($file->getFileUri()), //$file->getFilename(),
          );
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
