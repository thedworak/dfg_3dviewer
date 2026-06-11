<?php
session_start();
if (isset($_SESSION['admin'])) {
    header('Location: index.php');
    exit;
}
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    $pdo = require __DIR__ . '/db.php';
    $stmt = $pdo->prepare('SELECT * FROM admins WHERE username = ?');
    $stmt->execute([$username]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && password_verify($password, $row['password'])) {
        $_SESSION['admin'] = $row['username'];
        header('Location: index.php');
        exit;
    }
    $error = 'Invalid login credentials. Please try again.';
}
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin Login</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="wrap">
    <header class="site"><h1>Panel Admin</h1></header>
    <div class="card">
      <?php if ($error): ?><div class="msg err"><?php echo htmlentities($error) ?></div><?php endif ?>
      <form method="post" class="login-form">
        <label>Username<input name="username" required></label>
        <label>Password<input name="password" type="password" required></label>
        <div style="margin-top:1rem"><button type="submit">Login</button></div>
      </form>
    </div>
    <div class="footer">If you don't have an account, run <code>php viewer/admin/create_admin.php &lt;user&gt; &lt;pass&gt;</code></div>
  </div>
</body>
</html>
