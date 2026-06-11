<?php
session_start();
if (!isset($_SESSION['admin'])) { header('Location: login.php'); exit; }
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Maintenance</title>
  <style>body{font-family:Arial;padding:1rem} button{margin:.3rem}</style>
</head>
<body>
  <h1>Maintenance</h1>
  <div>
    <button data-action="clear_cache">Clear Cache</button>
    <button data-action="rebuild_thumbs">Rebuild Thumbnails</button>
    <button data-action="diagnostics">Diagnostics</button>
  </div>
  <pre id="out" style="margin-top:1rem;padding:1rem;border:1px solid #ddd;background:#f9f9f9"></pre>
  <p><a href="index.php">Wróć</a></p>
  <script>
  document.querySelectorAll('button[data-action]').forEach(b=>b.addEventListener('click', async ()=>{
    const action=b.getAttribute('data-action');
    const out=document.getElementById('out'); out.textContent='...';
    const res=await fetch('api/actions.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}, body: JSON.stringify({action})});
    const j=await res.json(); out.textContent=JSON.stringify(j, null, 2);
  }));
  </script>
</body>
</html>
