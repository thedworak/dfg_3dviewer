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
  <link rel="stylesheet" href="style.css">
  <style>button{margin:.3rem}</style>
</head>
<body>
  <div class="wrap">
    <header class="site"><h1>Maintenance</h1><nav class="admin-links"><a href="index.php">Wróć</a></nav></header>
    <div class="card">
      <h2>Cache & Rebuilds</h2>
      <div>
        <button data-action="clear_cache">Clear Cache</button>
        <button data-action="rebuild_thumbs">Rebuild Thumbnails</button>
        <button data-action="diagnostics">Diagnostics</button>
      </div>
      <pre id="out" style="margin-top:1rem;padding:1rem;border:1px solid #ddd;background:#f9f9f9;white-space:pre-wrap"></pre>
    </div>

    <div class="card">
      <h2>Entity Re-save (Drupal)</h2>
      <p class="muted">Trigger re-save for a specific entity to queue it for model conversion.</p>
      <form id="entityResaveForm">
        <label>Entity ID<input name="entity_id" type="text" placeholder="e.g. 12345" required></label>
        <label>Entity Type<input name="entity_type" type="text" placeholder="e.g. wisski_individual" value="wisski_individual"></label>
        <div style="margin-top:1rem"><button type="submit">Re-save Entity</button></div>
      </form>
      <pre id="entityOut" style="margin-top:1rem;padding:1rem;border:1px solid #ddd;background:#f9f9f9;white-space:pre-wrap;display:none"></pre>
    </div>
  </div>
  <script>
  document.querySelectorAll('button[data-action]').forEach(b=>b.addEventListener('click', async ()=>{
    const action=b.getAttribute('data-action');
    const out=document.getElementById('out'); out.textContent='...';
    const res=await fetch('api/actions.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}, body: JSON.stringify({action})});
    const j=await res.json(); out.textContent=JSON.stringify(j, null, 2);
  }));

  document.getElementById('entityResaveForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const entity_id = document.querySelector('input[name="entity_id"]').value;
    const entity_type = document.querySelector('input[name="entity_type"]').value;
    const outEl = document.getElementById('entityOut');
    outEl.style.display='block';
    outEl.textContent='...';
    const res = await fetch('api/actions.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'entity_resave', entity_id, entity_type})});
    const j = await res.json();
    outEl.textContent = (j.output || JSON.stringify(j, null, 2));
  });
  </script>
</body>
</html>
