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

    $form['#dfg_3dviewer_settings'] = $settings;

	$form['dfg_3dviewer_basenamespace'] = [
		'#default_value' => $settings->get('dfg_3dviewer_basenamespace'),
		'#type' => 'textfield',
		'#title' => $this->t('Change default base namespace'),
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

    $settings->save();
    $this->messenger()->addStatus($this->t('Changed DFG 3D Viewer settings successfully'));
    $form_state->setRedirect('system.admin_config');
  }

}
