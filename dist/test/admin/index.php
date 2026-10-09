<?php
session_start();
if (!isset($_SESSION['admin'])) {
    header('Location: login.php');
    exit;
}
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin Panel</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="wrap">
    <header class="site"><h1>Admin Panel</h1><nav class="admin-links"><a href="logout.php">Logout</a></nav></header>
    <div class="card">
      <p>Logged in as <strong><?php echo htmlentities($_SESSION['admin']) ?></strong></p>
      <div class="flex">
        <a class="small" href="settings.php">Viewer Settings</a>
        <a class="small" href="env.php">Environment</a>
        <a class="small" href="hdri.php">HDRI</a>
        <a class="small" href="actions.php">Maintenance</a>
      </div>
    </div>
  </div>
</body>
</html>
