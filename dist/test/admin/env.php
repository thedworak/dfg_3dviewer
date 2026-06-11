<?php
session_start();
if (!isset($_SESSION['admin'])) { header('Location: login.php'); exit; }
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Environment</title>
  <style>body{font-family:Arial;padding:1rem} table{border-collapse:collapse} td,th{padding:.3rem;border:1px solid #ddd}</style>
</head>
<body>
  <h1>Environment (.env)</h1>
  <table id="tbl"><thead><tr><th>Key</th><th>Value</th><th></th></tr></thead><tbody></tbody></table>
  <div style="margin-top:.5rem"><button id="add">Dodaj</button> <button id="save">Zapisz</button> <a href="index.php">Wróć</a></div>
  <hr>
  <h3>Env Schema</h3>
  <form id="uploadEnvSchema" enctype="multipart/form-data">
    <input type="file" name="file" accept="application/json"> <input type="hidden" name="target" value="env"> <button>Upload Env Schema</button>
  </form>
  <button id="deleteEnvSchema">Delete Env Schema</button>
  <div id="envSchemaMsg" style="margin-top:.5rem;color:green"></div>
  <h3>Backups</h3>
  <div id="envBackups">Loading backups...</div>
  <div id="envBackupMsg" style="margin-top:.5rem;color:green"></div>

  <script src="https://cdn.jsdelivr.net/npm/ajv@8.12.0/dist/ajv7.min.js"></script>
  <script>
  let envSchema = null;
  async function loadSchema(){
    try{
      const res = await fetch('api/env_schema.php', {credentials:'same-origin'});
      if (res.status === 200) { envSchema = await res.json(); const el=document.createElement('div'); el.style.fontSize='90%'; el.style.margin='0.5rem 0'; el.textContent='Env schema loaded — validation enabled.'; document.body.insertBefore(el, document.getElementById('tbl')) }
    }catch(e){/* ignore */}
  }

  async function load(){
    const res = await fetch('api/env.php', {credentials:'same-origin'});
    const data = await res.json();
    const tbody = document.querySelector('#tbl tbody'); tbody.innerHTML='';
    for(const k of Object.keys(data)){
      addRow(k, data[k]);
    }
  }
  function addRow(k='',v=''){ const tbody=document.querySelector('#tbl tbody'); const tr=document.createElement('tr'); tr.innerHTML=`<td><input class="k" value="${k}"></td><td><input class="v" value="${v}"></td><td><button class="del">X</button></td>`; tbody.appendChild(tr); tr.querySelector('.del').addEventListener('click',()=>tr.remove()); }
  document.getElementById('add').addEventListener('click',()=>addRow());
  document.getElementById('save').addEventListener('click', async ()=>{
    const rows = document.querySelectorAll('#tbl tbody tr'); const out={};
    rows.forEach(r=>{ const k=r.querySelector('.k').value; const v=r.querySelector('.v').value; if(k) out[k]=v; });
    // client-side validation
    if (envSchema) {
      const Ajv = window.ajv7.Ajv; const ajv = new Ajv({allErrors:true});
      const validate = ajv.compile(envSchema);
      const valid = validate(out);
      if (!valid) {
        alert('Env validation errors:\n' + validate.errors.map(e=>`${e.instancePath} ${e.message}`).join('\n'));
        return;
      }
    } else {
      // basic validation: keys uppercase letters, digits and underscore
      for(const k of Object.keys(out)){
        if (!/^[A-Z0-9_]+$/.test(k)) { alert('Invalid key: ' + k + '\nKeys should be uppercase letters, digits or underscore'); return; }
      }
    }

    const res = await fetch('api/env.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}, body: JSON.stringify(out)});
    const j = await res.json(); alert(JSON.stringify(j));
  });

  await loadSchema();
  load();
  document.getElementById('uploadEnvSchema').addEventListener('submit', async (e)=>{
    e.preventDefault(); const fd = new FormData(e.target); const res = await fetch('api/upload_schema.php',{method:'POST',credentials:'same-origin', body: fd}); const j = await res.json(); document.getElementById('envSchemaMsg').textContent = JSON.stringify(j); if (j.ok) setTimeout(()=>location.reload(),700);
  });
  document.getElementById('deleteEnvSchema').addEventListener('click', async ()=>{
    if (!confirm('Delete env schema file?')) return; const res = await fetch('api/env_schema.php?delete=1',{method:'POST',credentials:'same-origin'}); const j = await res.json(); alert(JSON.stringify(j)); if (j.ok) setTimeout(()=>location.reload(),700);
  });
  async function loadEnvBackups(){
    const res = await fetch('api/backups.php?target=env',{credentials:'same-origin'});
    const j = await res.json();
    const el = document.getElementById('envBackups');
    if (j.error) { el.textContent = JSON.stringify(j); return; }
    if (!j.backups || j.backups.length===0) { el.textContent='No backups found'; return; }
    el.innerHTML='';
    j.backups.forEach(b=>{
      const div=document.createElement('div'); div.textContent = b.file + ' ('+b.ts+') '; const btn=document.createElement('button'); btn.textContent='Restore'; btn.addEventListener('click', async ()=>{ if(!confirm('Restore '+b.file+' ?')) return; const r = await fetch('api/backups.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}, body: JSON.stringify({target:'env', file: b.file})}); const R=await r.json(); document.getElementById('envBackupMsg').textContent = JSON.stringify(R); if(R.ok) setTimeout(()=>location.reload(),700); }); div.appendChild(btn); el.appendChild(div);
    });
  }
  loadEnvBackups();
  </script>
</body>
</html>
