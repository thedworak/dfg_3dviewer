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

    private function normalizeViewerUrl(string $value): string {
      $value = trim($value);
      if ($value === '') {
        return $value;
      }

      $config = \Drupal::service('config.factory')->getEditable('dfg_3dviewer.settings');
      $main_url = (string) (
        $config->get('dfg_3dviewer_main_url')
        ?? $config->get('main_url')
        ?? ''
      );
      $main_url = rtrim(trim($main_url), '/');

      if ($main_url !== '') {
        if (!preg_match('#^https?://#i', $main_url)) {
          $main_url = 'https://' . $main_url;
        }

        $value = preg_replace('#^https?://(default|dfg_3dviewer)(?=/)#i', $main_url, $value);

        $escaped = preg_quote($main_url, '#');
        $value = preg_replace(
          "#https?://[^/]+/sites/default/files/wisski_original/{$escaped}#i",
          $main_url,
          $value
        );

        if (strpos($value, '/sites/default/files/') === 0) {
          $value = $main_url . $value;
        }
      }

      return $value;
    }

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

        $elements['#attached']['library'][] = dfg_3dviewer_get_library();

        foreach($derivative_values as $delta => $derivative_value) {
          $raw_value = isset($derivative_value['value']) ? (string) $derivative_value['value'] : '';
          $normalized_value = $this->normalizeViewerUrl($raw_value);
          
          // here you probably still have to check if $derivative_value['value'] is still existing          
          $elements[$delta] = array(
            '#type' => 'html_tag',
            '#tag' => 'p',
            '#attributes' => array('id' => 'DFG_3DViewer', '3d' => $normalized_value),
          );        
        }
      } else {

        $files = $this->getEntitiesToView($items, $langcode);

        $elements['#attached']['library'][] = dfg_3dviewer_get_library();

        foreach ($files as $delta => $file) {

          $uri = $file->getFileUri();

          $relative_url = \Drupal::service('file_url_generator')
            ->generateString($uri);
          $relative_url = $this->normalizeViewerUrl((string) $relative_url);

          $elements[$delta] = [
            '#type' => 'html_tag',
            '#tag' => 'p',
            '#attributes' => [
              'id' => 'DFG_3DViewer',
              '3d' => $relative_url,
            ],
          ];
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
