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
  <style>body{font-family:Arial,Helvetica,sans-serif;padding:1rem}</style>
</head>
<body>
  <h1>Panel Admin</h1>
  <p>Zalogowany jako <strong><?php echo htmlentities($_SESSION['admin']) ?></strong></p>
  <ul>
    <li><a href="settings.php">Viewer Settings</a> (coming)</li>
    <li><a href="env.php">Environment</a> (coming)</li>
    <li><a href="hdri.php">HDRI</a> (coming)</li>
    <li><a href="actions.php">Maintenance</a> (coming)</li>
  </ul>
  <p><a href="logout.php">Wyloguj</a></p>
</body>
</html>
