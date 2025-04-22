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
//      $elements = parent::viewElements($items, $langcode);    
      $elements = array();

      // By Mark:
      // get the derivative field id
      // here must be some handling if this is empty.
      $derivative_field_id = \Drupal::service('config.factory')->getEditable('dfg_3dviewer.settings')->get('dfg_3dviewer_viewer_file_name');

      // store the derivative values to an array.
      $derivative_values = array();
      
      // only act if we have a field id, otherwise it will die.
      if(!empty($derivative_field_id))
        $derivative_values = $items->getEntity()->get($derivative_field_id)->getValue();

      // if we have derivative values, act on that and not on the real values.
      if(!empty($derivative_values)) {
        $elements = array();

        $elements['#attached']['library'][] = 'dfg_3dviewer/dfg_3dviewer';

        foreach($derivative_values as $delta => $derivative_value) {
          
          // here you probably still have to check if $derivative_value['value'] is still existing          
          $elements[$delta] = array(
            '#type' => 'html_tag',
            '#tag' => 'p',
            '#attributes' => array('id' => 'DFG_3DViewer', '3d' => $derivative_value['value']),
          );        
        }
      } else {

        $files = $this->getEntitiesToView($items, $langcode);

        $elements['#attached']['library'][] = 'dfg_3dviewer/dfg_3dviewer';

        foreach ($files as $delta => $file) {
          $override_basenamespace = \Drupal::service('config.factory')->getEditable('dfg_3dviewer.settings')->get('dfg_3dviewer_basenamespace') . \Drupal::service('file_url_generator')->generateString($file->getFileUri());

          if (is_null($override_basenamespace)) $override_basenamespace = \Drupal::service('file_url_generator')->generateAbsoluteString($file->getFileUri());

          $elements[$delta] = array(
            '#type' => 'html_tag',
            '#tag' => 'p',
            '#attributes' => array('id' => 'DFG_3DViewer', '3d' => $override_basenamespace),
          );
        }
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
