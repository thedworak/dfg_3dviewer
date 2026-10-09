(function () {

  const progressWrapper = document.querySelector('[data-3d-progress]');

  if (!progressWrapper) {
    return;
  }

  const entityId = progressWrapper.dataset.entityId;

  function checkProgress() {

    fetch('/dfg-3dviewer/progress/' + entityId)
      .then(r => r.json())
      .then(data => {

        const bar = document.querySelector('#progress-bar');
        const label = document.querySelector('#progress-label');

        if (!bar || !label) return;

        bar.style.width = data.progress + '%';
        label.innerText = data.progress + '%';

        if (data.status === 'ready') {
          location.reload();
        }
      });
  }

  setInterval(checkProgress, 3000);

})();