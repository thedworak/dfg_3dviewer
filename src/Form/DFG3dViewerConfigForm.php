<?php

namespace Drupal\dfg_3dviewer\Form;

use Drupal\Core\Form\FormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\File\FileSystemInterface;


/**
 *
 */
class DFG3dViewerConfigForm extends FormBase {

  /**
   *
   */
  public function getFormId() {

    return 'dfg_3dviewer_settings_form';
  }

  /**
   *
   */
  public function buildForm(array $form, FormStateInterface $form_state) {
	
    $settings = $this->configFactory()->getEditable('dfg_3dviewer.settings');
    $default_config = \Drupal::config('dfg_3dviewer.settings');
    $default_settings = [
      'entity_bundle' => $default_config->get('dfg_3dviewer_entitybundle'),
      'viewer_file_upload' => $default_config->get('dfg_3dviewer_viewer_file_upload'),
      'image_generation' => $default_config->get('dfg_3dviewer_image_generation'),
      'viewer_file_name' => $default_config->get('dfg_3dviewer_viewer_file_name'),
      'field_df' => $default_config->get('dfg_3dviewer_field_df'),
      'main_url' => $default_config->get('dfg_3dviewer_main_url'),
      'metadata_url' => $default_config->get('dfg_3dviewer_metadata_url'),
      'basenamespace' => $default_config->get('dfg_3dviewer_basenamespace'),
      'container' => $default_config->get('dfg_3dviewer_container'),
      'lightweight' => $default_config->get('dfg_3dviewer_lightweight'),
      'salt' => $default_config->get('dfg_3dviewer_salt'),
      'scale_container_x' => $default_config->get('dfg_3dviewer_scale_container_x'),
      'scale_container_y' => $default_config->get('dfg_3dviewer_scale_container_y'),
      'gallery_container' => $default_config->get('dfg_3dviewer_gallery_container'),
      'gallery_image_class' => $default_config->get('dfg_3dviewer_gallery_image_class'),
      'gallery_image_id' => $default_config->get('dfg_3dviewer_gallery_image_id'),
      'base_module_path' => $default_config->get('dfg_3dviewer_base_module_path'),
      'entity_id_uri' => $default_config->get('dfg_3dviewer_entity_id_uri'),
      'view_entity_path' => $default_config->get('dfg_3dviewer_view_entity_path'),
      'attribute_id' => $default_config->get('dfg_3dviewer_attribute_id'),
    ];

    $form['#dfg_3dviewer_settings'] = $settings;
	
	$form['#attached']['library'][] = 'dfg_3dviewer/dfg_3dviewer';

	$form['dfg_3dviewer_main_url'] = [
		'#default_value' => $default_settings['main_url'],
		'#type' => 'textfield',
		'#title' => $this->t('Main URL'),
		'#required' => true,
		'#description' => 'Change <b>main URL</b> for used repository',
    ];

	$form['dfg_3dviewer_basenamespace'] = [
		'#default_value' => $default_settings['basenamespace'],
		'#type' => 'textfield',
		'#title' => $this->t('Default base namespace'),
		'#description' => $this->t('(if different than Main URL)'),
    ];

	$form['dfg_3dviewer_metadata_url'] = [
		'#default_value' => $default_settings['metadata_url'],
		'#type' => 'textfield',
		'#title' => $this->t('Metadata URL'),
		'#description' => '<b>URL</b> of the instance that serves metadata content',
		'#states' => [
			'visible' => [
				':input[name="dfg_3dviewer_lightweight"]' => ['checked' => FALSE],
			]
		]
    ];

	$form['dfg_3dviewer_container'] = [
		'#default_value' => $default_settings['container'],
		'#type' => 'textfield',
		'#title' => $this->t('Container ID'),
		'#required' => true,
		'#description' => '<b>ID</b> of the main container for the Viewer',
    ];

	$form['dfg_3dviewer_entitybundle'] = [
		'#default_value' => $default_settings['entity_bundle'],
		'#type' => 'textfield',
		'#title' => $this->t('Entity Bundle ID'),
		'#required' => true,
		'#description' => '<b>ID</b> of the bundle for the entity given in wisski pathbuilder for 3d_model field',
    ];

	$form['dfg_3dviewer_viewer_file_upload'] = [
		'#default_value' => $default_settings['viewer_file_upload'],
		'#type' => 'textfield',
		'#title' => $this->t('Viewer File Upload ID'),
		'#required' => true,
		'#description' => '<b>ID</b> of the bundle for the entity given in wisski pathbuilder for 3d_upload field',
    ];

	$form['dfg_3dviewer_viewer_file_name'] = [
		'#default_value' => $default_settings['viewer_file_name'],
		'#type' => 'textfield',
		'#title' => $this->t('Viewer File Name ID'),
		'#required' => true,
		'#description' => '<b>ID</b> of the bundle for the entity given in wisski pathbuilder for viewer_file_name field',
    ];

	$form['dfg_3dviewer_image_generation'] = [
		'#default_value' => $default_settings['image_generation'],
		'#type' => 'textfield',
		'#title' => $this->t('Image Generation'),
		'#required' => true,
		'#description' => '<b>ID</b> of the bundle for the entity given in wisski pathbuilder for image_generation field',
		'#states' => [
			'visible' => [
				':input[name="dfg_3dviewer_lightweight"]' => ['checked' => FALSE],
			]
		]
    ];

	$form['dfg_3dviewer_field_df'] = [
		'#default_value' => $default_settings['field_df'],
		'#type' => 'textfield',
		'#title' => $this->t('Field DF'),
		'#required' => true,
		'#description' => 'Name of the field given for <b>image_generation</b>',
		'#states' => [
			'visible' => [
				':input[name="dfg_3dviewer_lightweight"]' => ['checked' => FALSE],
			]
		]
    ];

	$form['scale_wrapper'] = [
		'#type' => 'container',
		'#attributes' => [
			'class' => ['scale-fields-wrapper', 'flex-container'],
		],
	];

	$form['scale_wrapper']['dfg_3dviewer_scale_container_x'] = [
		'#default_value' => $default_settings['scale_container_x'],
		'#type' => 'textfield',
		'#title' => $this->t('Scale container X'),
		'#required' => true,
		'#description' => '<b>Width</b> scale of the container',
		'#attributes' => [
			'class' => ['half-width'],
		],
    ];

	$form['scale_wrapper']['dfg_3dviewer_scale_container_y'] = [
		'#default_value' => $default_settings['scale_container_y'],
		'#type' => 'textfield',
		'#title' => $this->t('Scale container Y'),
		'#required' => true,
		'#description' => '<b>Height</b> scale of the container',
		'#attributes' => [
			'class' => ['half-width'],
		],
    ];

	$form['dfg_3dviewer_salt'] = [
		'#default_value' => $default_settings['salt'],
		'#type' => 'textfield',
		'#title' => $this->t('Salt'),
		'#required' => true,
		'#description' => 'Random <b>salt</b> string used with server scripts for security reasons. Change it after installation.',
    ];

	$form['gallery_wrapper'] = [
		'#type' => 'container',
		'#attributes' => [
			'class' => ['gallery-fields-wrapper', 'gallery-container'],
		],
		'#states' => [
			'visible' => [
				':input[name="dfg_3dviewer_lightweight"]' => ['checked' => FALSE],
			]
		]
	];

	$form['gallery_wrapper']['dfg_3dviewer_gallery_container'] = [
		'#default_value' => $default_settings['gallery_container'],
		'#type' => 'textfield',
		'#title' => $this->t('Gallery container element name'),
		'#required' => false,
		'#description' => '<b>Name</b> of the element with gallery URLs',
		'#states' => [
			'visible' => [
				':input[name="dfg_3dviewer_lightweight"]' => ['checked' => FALSE],
			],
			'required' => [
				':input[name="dfg_3dviewer_lightweight"]' => ['checked' => FALSE],
			]
		]
    ];

	$form['gallery_wrapper']['dfg_3dviewer_gallery_image_class'] = [
		'#default_value' => $default_settings['gallery_image_class'],
		'#type' => 'textfield',
		'#title' => $this->t('Gallery class name for images'),
		'#required' => false,
		'#description' => '<b>Class</b> name for gallery images',
		'#states' => [
			'visible' => [
				':input[name="dfg_3dviewer_lightweight"]' => ['checked' => FALSE],
			],
			'required' => [
				':input[name="dfg_3dviewer_lightweight"]' => ['checked' => FALSE],
			]
		]
    ];

	$form['gallery_wrapper']['dfg_3dviewer_gallery_image_id'] = [
		'#default_value' => $default_settings['gallery_gallery_image_id'],
		'#type' => 'textfield',
		'#title' => $this->t('Gallery ID name for images'),
		'#required' => false,
		'#description' => '<b>ID</b> name for gallery images',
		'#states' => [
			'visible' => [
				':input[name="dfg_3dviewer_lightweight"]' => ['checked' => FALSE],
			],
			'required' => [
				':input[name="dfg_3dviewer_lightweight"]' => ['checked' => FALSE],
			]
		]
    ];

	$form['dfg_3dviewer_base_module_path'] = [
		'#default_value' => $default_settings['base_module_path'],
		'#type' => 'textfield',
		'#title' => $this->t('Path for the Viewer module'),
		'#required' => true,
		'#description' => 'Real <b>path</b> for the Viewer module',
    ];

	$form['dfg_3dviewer_entity_id_uri'] = [
		'#default_value' => $default_settings['entity_id_uri'],
		'#type' => 'textfield',
		'#title' => $this->t('Regex for entity ID'),
		'#required' => false,
		'#description' => '<b>Regex</b> that allows get ID of the entity',
    ];

	$form['dfg_3dviewer_view_entity_path'] = [
		'#default_value' => $default_settings['view_entity_path'],
		'#type' => 'textfield',
		'#title' => $this->t('Path with navigate content'),
		'#required' => true,
		'#description' => '<b>Path</b> that allows navigate to the entity',
    ];

	$form['dfg_3dviewer_attribute_id'] = [
		'#default_value' => $default_settings['attribute_id'],
		'#type' => 'textfield',
		'#title' => $this->t('Attribute ID with WissKI content'),
		'#required' => true,
		'#description' => '<b>ID</b> that allows get more specific data from WissKI',
    ];

	$form['dfg_3dviewer_lightweight'] = [
		'#default_value' => $default_settings['lightweight'],
		'#type' => 'checkbox',
		'#title' => $this->t('<b>Lightweight</b> version. If checked, 3D Viewer will provide only basic operations.'),
		'#required' => false
    ];

    $form['submit'] = [
		'#type' => 'submit',
		'#value' => $this->t('Submit'),
    ];
    return $form;
  }

  /**
   *
   */
  public function submitForm(array &$form, FormStateInterface $form_state) {

    $settings = $form['#dfg_3dviewer_settings'];
    $new_vals = $form_state->getValues();
    $settings->set('dfg_3dviewer_basenamespace', $new_vals['dfg_3dviewer_basenamespace']);
    $settings->set('dfg_3dviewer_main_url', $new_vals['dfg_3dviewer_main_url']);
    $settings->set('dfg_3dviewer_metadata_url', $new_vals['dfg_3dviewer_metadata_url']);
    $settings->set('dfg_3dviewer_entitybundle', $new_vals['dfg_3dviewer_entitybundle']);
    $settings->set('dfg_3dviewer_container', $new_vals['dfg_3dviewer_container']);
    $settings->set('dfg_3dviewer_viewer_file_upload', $new_vals['dfg_3dviewer_viewer_file_upload']);
    $settings->set('dfg_3dviewer_viewer_file_name', $new_vals['dfg_3dviewer_viewer_file_name']);
    $settings->set('dfg_3dviewer_image_generation', $new_vals['dfg_3dviewer_image_generation']);
    $settings->set('dfg_3dviewer_field_df', $new_vals['dfg_3dviewer_field_df']);
    $settings->set('dfg_3dviewer_lightweight', $new_vals['dfg_3dviewer_lightweight']);
    $settings->set('dfg_3dviewer_salt', $new_vals['dfg_3dviewer_salt']);
    $settings->set('dfg_3dviewer_scale_container_x', $new_vals['dfg_3dviewer_scale_container_x']);
    $settings->set('dfg_3dviewer_scale_container_y', $new_vals['dfg_3dviewer_scale_container_y']);
    $settings->set('dfg_3dviewer_gallery_container', $new_vals['dfg_3dviewer_gallery_container']);
    $settings->set('dfg_3dviewer_gallery_image_class', $new_vals['dfg_3dviewer_gallery_image_class']);
    $settings->set('dfg_3dviewer_gallery_image_id', $new_vals['dfg_3dviewer_gallery_image_id']);
    $settings->set('dfg_3dviewer_base_module_path', $new_vals['dfg_3dviewer_base_module_path']);
    $settings->set('dfg_3dviewer_entity_id_uri', $new_vals['dfg_3dviewer_entity_id_uri']);
    $settings->set('dfg_3dviewer_view_entity_path', $new_vals['dfg_3dviewer_view_entity_path']);
    $settings->set('dfg_3dviewer_attribute_id', $new_vals['dfg_3dviewer_attribute_id']);

    $settings->save();

	// Create an array with only the keys you want to store
	$data_to_store = [
		'baseNamespace' => $new_vals['dfg_3dviewer_basenamespace'],
		'mainUrl' => $new_vals['dfg_3dviewer_main_url'],
		'metadataUrl' => $new_vals['dfg_3dviewer_metadata_url'],
		'baseModulePath' => $new_vals['dfg_3dviewer_base_module_path'],
		'entity' => [
			'bundle' => $new_vals['dfg_3dviewer_entitybundle'],
			'fieldDf' => $new_vals['dfg_3dviewer_field_df'],
			'idUri' => $new_vals['dfg_3dviewer_entity_id_uri'],
			'viewEntityPath' => $new_vals['dfg_3dviewer_view_entity_path'],
			'attributeId' => $new_vals['dfg_3dviewer_attribute_id'],
		],
		'viewer' => [
			'container' => $new_vals['dfg_3dviewer_container'],
			'fileUpload' => $new_vals['dfg_3dviewer_viewer_file_upload'],
			'fileName' => $new_vals['dfg_3dviewer_viewer_file_name'],
			'imageGeneration' => $new_vals['dfg_3dviewer_image_generation'],
			'lightweight' => $new_vals['dfg_3dviewer_lightweight'],
			'salt' => $new_vals['dfg_3dviewer_salt'],
			'scaleContainer' => [
				'x' => $new_vals['dfg_3dviewer_scale_container_x'],
				'y' => $new_vals['dfg_3dviewer_scale_container_y']
			],
			'gallery' => [
				'container' => $new_vals['dfg_3dviewer_gallery_container'],
				'imageClass' => $new_vals['dfg_3dviewer_gallery_image_class'],
				'imageId' => $new_vals['dfg_3dviewer_gallery_image_id'],
			]
		],
	];

	// Convert to JSON
	$json_data = json_encode($data_to_store, JSON_PRETTY_PRINT);

	// Get module path (e.g., modules/custom/your_module/)
	$module_path = \Drupal::service('extension.list.module')->getPath('dfg_3dviewer');

	// Build full file path
	$file_path = DRUPAL_ROOT . '/' . $module_path . '/viewer/viewer-settings.json';

	// Save file
	file_put_contents($file_path, $json_data);

	$this->messenger()->addStatus($this->t('Viewer settings saved to external file.'));
	$form_state->setRedirect('system.admin_config');

    $this->messenger()->addStatus($this->t('Changed DFG 3D Viewer settings successfully'));
    $form_state->setRedirect('system.admin_config');
  }

}
