<?php
session_start();
if (!isset($_SESSION['admin'])) { header('Location: login.php'); exit; }
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Viewer Settings</title>
  <link href="https://cdn.jsdelivr.net/npm/jsoneditor@9.9.0/dist/jsoneditor.min.css" rel="stylesheet">
  <style>body{font-family:Arial;padding:1rem} #editor{height:60vh;border:1px solid #ddd}</style>
</head>
<body>
  <h1>Viewer Settings</h1>
  <div style="margin-bottom:.5rem">
    <button id="viewTree">Tree View</button>
    <button id="viewForm">Form View</button>
  </div>
  <div id="editor"></div>
  <div style="margin-top:1rem">
    <button id="save">Zapisz</button>
    <button id="reload">Wczytaj</button>
    <a href="index.php">Wróć</a>
  </div>
  <hr>
  <h3>Schema management</h3>
  <form id="uploadSchema" enctype="multipart/form-data">
    <input type="file" name="file" accept="application/json"> <input type="hidden" name="target" value="settings"> <button>Upload Schema</button>
  </form>
  <button id="deleteSchema">Delete Schema</button>
  <div id="schemaMsg" style="margin-top:.5rem;color:green"></div>
  <h3>Backups</h3>
  <div id="backupsList">Loading backups...</div>
  <div id="backupMsg" style="margin-top:.5rem;color:green"></div>

  <script src="https://cdn.jsdelivr.net/npm/jsoneditor@9.9.0/dist/jsoneditor.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/ajv@8.12.0/dist/ajv7.min.js"></script>
  <script>
  const container = document.getElementById('editor');
  let editor = null;
  let schema = null;

  function createEditor(mode){
    if(editor) editor.destroy();
    const options = {mode: mode};
    if (mode === 'form' && schema) options.schema = schema;
    editor = new JSONEditor(container, options);
  }

  async function loadSchema() {
    const res = await fetch('api/settings_schema.php', {credentials:'same-origin'});
    if (res.status === 200) {
      schema = await res.json();
      const el = document.createElement('div'); el.style.fontSize='90%'; el.style.margin='0.5rem 0'; el.textContent = 'Schema loaded — validation enabled.'; document.body.insertBefore(el, container);
    }
  }

  async function load() {
    const res = await fetch('api/settings.php', {credentials: 'same-origin'});
    const data = await res.json();
    if (!editor) createEditor('tree');
    try { editor.set(data); } catch(e) { console.error(e); }
  }

  document.getElementById('reload').addEventListener('click', load);
  document.getElementById('viewTree').addEventListener('click', ()=>{ createEditor('tree'); load(); });
  document.getElementById('viewForm').addEventListener('click', ()=>{ createEditor('form'); load(); });

  document.getElementById('save').addEventListener('click', async ()=>{
    const data = editor.get();
    if (schema) {
      const Ajv = window.ajv7.Ajv; const ajv = new Ajv({allErrors:true});
      const validate = ajv.compile(schema);
      const valid = validate(data);
      if (!valid) {
        alert('Validation errors:\n' + validate.errors.map(e=>`${e.instancePath} ${e.message}`).join('\n'));
        return;
      }
    }
    const res = await fetch('api/settings.php', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
    const j = await res.json();
    alert(JSON.stringify(j));
  });

  // load schema then data
  await loadSchema();
  createEditor('tree');
  load();
  // upload schema
  document.getElementById('uploadSchema').addEventListener('submit', async (e)=>{
    e.preventDefault(); const fd = new FormData(e.target); const res = await fetch('api/upload_schema.php',{method:'POST',credentials:'same-origin', body: fd}); const j = await res.json(); document.getElementById('schemaMsg').textContent = JSON.stringify(j); if (j.ok) setTimeout(()=>location.reload(),700);
  });
  document.getElementById('deleteSchema').addEventListener('click', async ()=>{
    if (!confirm('Delete schema file?')) return; const res = await fetch('api/settings_schema.php?delete=1',{method:'POST',credentials:'same-origin'}); const j = await res.json(); alert(JSON.stringify(j)); if (j.ok) setTimeout(()=>location.reload(),700);
  });
  // backups
  async function loadBackups(){
    const res = await fetch('api/backups.php?target=settings',{credentials:'same-origin'});
    const j = await res.json();
    const el = document.getElementById('backupsList');
    if (j.error) { el.textContent = JSON.stringify(j); return; }
    if (!j.backups || j.backups.length===0) { el.textContent='No backups found'; return; }
    el.innerHTML='';
    j.backups.forEach(b=>{
      const div=document.createElement('div'); div.textContent = b.file + ' ('+b.ts+') '; const btn=document.createElement('button'); btn.textContent='Restore'; btn.addEventListener('click', async ()=>{ if(!confirm('Restore '+b.file+' ?')) return; const r = await fetch('api/backups.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}, body: JSON.stringify({target:'settings', file: b.file})}); const R=await r.json(); document.getElementById('backupMsg').textContent = JSON.stringify(R); if(R.ok) setTimeout(()=>location.reload(),700); }); div.appendChild(btn); el.appendChild(div);
    });
  }
  loadBackups();
  </script>
</body>
</html>
