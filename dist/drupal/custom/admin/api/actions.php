<?php
require __DIR__ . '/common.php';

$root = workspace_root();
$body = file_get_contents('php://input');
$data = json_decode($body, true);
if (!$data || !isset($data['action'])) { http_response_code(400); json_response(['error'=>'invalid_request']); }

$action = $data['action'];
if ($action === 'clear_cache') {
    $target = $root . '/viewer/build';
    $out = '';
    if (is_dir($target)) {
        // remove all files
        $cmd = 'rm -rf ' . escapeshellarg($target) . '/*';
        $out = shell_exec($cmd . ' 2>&1');
    } else { $out = 'no build dir'; }
    json_response(['ok'=>true,'output'=>$out]);
}

if ($action === 'rebuild_thumbs') {
    $script = $root . '/scripts/render.sh';
    if (file_exists($script) && is_executable($script)) {
        $out = shell_exec(escapeshellcmd($script) . ' 2>&1');
        json_response(['ok'=>true,'output'=>$out]);
    }
    http_response_code(500); json_response(['error'=>'script_missing']);
}

if ($action === 'diagnostics') {
    $out = [];
    $out['php'] = shell_exec('php -v 2>&1');
    $out['uname'] = shell_exec('uname -a 2>&1');
    $out['df'] = shell_exec('df -h 2>&1');
    json_response(['ok'=>true,'output'=>$out]);
}

if ($action === 'entity_resave') {
    $entity_id = $data['entity_id'] ?? null;
    $entity_type = $data['entity_type'] ?? 'wisski_individual';
    if (!$entity_id) { http_response_code(400); json_response(['error'=>'missing_entity_id']); }
    
    $out = "Attempting to re-save entity $entity_type:$entity_id ...\n\n";
    
    // Try to bootstrap Drupal if available
    $drupal_root = $root;
    if (file_exists($drupal_root . '/index.php')) {
        $out .= "Found index.php, attempting Drupal bootstrap...\n";
        try {
            // Push to Drupal context
            $cwd = getcwd();
            chdir($drupal_root);
            
            // Simple Drupal load without full bootstrap (safer)
            if (function_exists('drush_main')) {
                $out .= "Drush detected, will attempt re-save.\n";
            }
            
            // Try using Drupal's entity loader via autoloader
            if (file_exists($drupal_root . '/vendor/autoload.php')) {
                require_once $drupal_root . '/vendor/autoload.php';
                $out .= "Drupal autoloader loaded.\n";
                
                // Simple check: can we access Drupal\Core ?
                if (class_exists('Drupal\Core\Entity\EntityTypeManager')) {
                    $out .= "Drupal namespace available - attempting entity save.\n";
                    // Real bootstrap would require more setup
                    $out .= "INFO: Full entity re-save requires Drupal context.\n";
                }
            }
            chdir($cwd);
            $out .= "\nTo re-save this entity, use Drupal CLI:\n";
            $out .= "  drush entity:save $entity_type $entity_id\n";
            $out .= "Or access Drupal admin panel and update the entity.\n";
        } catch (\Throwable $e) {
            $out .= "Bootstrap check failed: " . $e->getMessage() . "\n";
            $out .= "\nTo re-save this entity, use Drupal CLI:\n";
            $out .= "  drush entity:save $entity_type $entity_id\n";
        }
    } else {
        $out .= "Drupal not detected in this directory.\n";
        $out .= "To re-save an entity, use:\n";
        $out .= "  drush entity:save $entity_type $entity_id\n";
        $out .= "Or trigger via Drupal admin panel.\n";
    }
    json_response(['ok'=>true,'output'=>$out]);
}

http_response_code(400); json_response(['error'=>'unknown_action']);
