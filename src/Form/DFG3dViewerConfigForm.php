<?php

namespace Drupal\dfg_3dviewer\Form;

use Drupal\Core\Form\FormBase;
use Drupal\Core\Form\FormStateInterface;


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
    ];

    $form['#dfg_3dviewer_settings'] = $settings;

	$form['dfg_3dviewer_main_url'] = [
		'#default_value' => $default_settings['main_url'],
		'#type' => 'textfield',
		'#title' => $this->t('Main URL'),
		'#required' => true,
		'#description' => 'Change main URL for used repository',
    ];

	$form['dfg_3dviewer_basenamespace'] = [
		'#default_value' => $settings->get('dfg_3dviewer_basenamespace'),
		'#type' => 'textfield',
		'#title' => $this->t('Default base namespace'),
		'#description' => $this->t('(if different than Main URL)'),
    ];

	$form['dfg_3dviewer_entitybundle'] = [
		'#default_value' => $default_settings['entity_bundle'],
		'#type' => 'textfield',
		'#title' => $this->t('Entity Bundle'),
		'#required' => true,
		'#description' => 'ID of the bundle for the entity given in wisski pathbuilder for 3d_model field',
    ];

	$form['dfg_3dviewer_viewer_file_upload'] = [
		'#default_value' => $default_settings['viewer_file_upload'],
		'#type' => 'textfield',
		'#title' => $this->t('Viewer File Upload'),
		'#required' => true,
		'#description' => 'ID of the bundle for the entity given in wisski pathbuilder for 3d_upload field',
    ];

	$form['dfg_3dviewer_viewer_file_name'] = [
		'#default_value' => $default_settings['viewer_file_name'],
		'#type' => 'textfield',
		'#title' => $this->t('Viewer File Name'),
		'#required' => true,
		'#description' => 'ID of the bundle for the entity given in wisski pathbuilder for viewer_file_name field',
    ];

	$form['dfg_3dviewer_image_generation'] = [
		'#default_value' => $default_settings['image_generation'],
		'#type' => 'textfield',
		'#title' => $this->t('Image Generation'),
		'#required' => true,
		'#description' => 'ID of the bundle for the entity given in wisski pathbuilder for image_generation field',
    ];

	$form['dfg_3dviewer_field_df'] = [
		'#default_value' => $default_settings['field_df'],
		'#type' => 'textfield',
		'#title' => $this->t('Field DF'),
		'#required' => true,
		'#description' => 'Name of the field given for image_generation',
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
    $settings->set('dfg_3dviewer_entitybundle', $new_vals['dfg_3dviewer_entitybundle']);
    $settings->set('dfg_3dviewer_viewer_file_upload', $new_vals['dfg_3dviewer_viewer_file_upload']);
    $settings->set('dfg_3dviewer_viewer_file_name', $new_vals['dfg_3dviewer_viewer_file_name']);
    $settings->set('dfg_3dviewer_image_generation', $new_vals['dfg_3dviewer_image_generation']);
    $settings->set('dfg_3dviewer_field_df', $new_vals['dfg_3dviewer_field_df']);

    $settings->save();
    $this->messenger()->addStatus($this->t('Changed DFG 3D Viewer settings successfully'));
    $form_state->setRedirect('system.admin_config');
  }

}
