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
    $error = 'Nieprawidłowe dane logowania';
}
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin Login</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;padding:2rem} form{max-width:320px}</style>
</head>
<body>
  <h1>Panel Admin</h1>
  <?php if ($error): ?><p style="color:red"><?php echo htmlentities($error) ?></p><?php endif ?>
  <form method="post">
    <div><label>Użytkownik<br><input name="username" required></label></div>
    <div><label>Hasło<br><input name="password" type="password" required></label></div>
    <div style="margin-top:1rem"><button type="submit">Zaloguj</button></div>
  </form>
</body>
</html>
