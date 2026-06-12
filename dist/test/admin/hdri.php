<?php
session_start();
if (!isset($_SESSION['admin'])) { header('Location: login.php'); exit; }
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HDRI</title>
  <link rel="stylesheet" href="style.css">
  <style>li{margin:.3rem 0}</style>
</head>
<body>
  <div class="wrap">
    <header class="site"><h1>HDRI</h1><nav class="admin-links"><a href="index.php">Wróć</a></nav></header>
    <div class="card">
      <form id="upload" enctype="multipart/form-data">
        <input type="file" name="file"> <button>Upload</button>
      </form>
      <ul id="list"></ul>
    </div>
    <p class="footer">Manage HDRI files used by the viewer.</p>
  </div>

  <script>
  async function load(){
    const res = await fetch('api/hdri.php', {credentials:'same-origin'});
    const data = await res.json();
    const ul = document.getElementById('list'); ul.innerHTML='';
    data.files.forEach(f=>{ const li=document.createElement('li'); li.textContent=f + ' '; const del=document.createElement('button'); del.textContent='Usuń'; del.addEventListener('click', ()=> delFile(f)); li.appendChild(del); ul.appendChild(li); });
  }
  async function delFile(filename){ if(!confirm('Usuń '+filename+' ?')) return; const res=await fetch('api/hdri.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'delete',file:filename})}); const j=await res.json(); alert(JSON.stringify(j)); load(); }
  document.getElementById('upload').addEventListener('submit', async (e)=>{
    e.preventDefault(); const f=e.target.file.files[0]; if(!f){alert('Wybierz plik'); return;} const fd=new FormData(); fd.append('file', f); const res=await fetch('api/hdri.php',{method:'POST',credentials:'same-origin', body: fd}); const j=await res.json(); alert(JSON.stringify(j)); load();
  });
  load();
  </script>
</body>
</html>
