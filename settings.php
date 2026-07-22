$settings['dfg_env'] = 'drupal_custom'; // possible values 'prod', 'test', 'drupal', 'drupal_custom'
// For custom builds use drupal_custom; then clear cache (drush cr) to apply library switch.
$settings['XSLT_URL'] = 'https://raw.githubusercontent.com/slub/dfg-viewer/e54305a9fa58951d3f3d1dd7e64554cb2ee881eb/Resources/Public/XSLT/exportSingleToMetsMods.xsl'; // URL to XSLT files for custom builds