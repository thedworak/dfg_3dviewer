const MIN_WIDTH = 240;
const MIN_HEIGHT = 180;

export function attachWindowControls(Viewer) {
  Object.assign(Viewer, {
    getWindowState() {
      const container = this.container;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      return {
        position: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
        },
        size: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    },

    applyWindowState(state = {}) {
      const container = this.container;
      state = state || {};
      const position = state.position || {};
      const size = state.size || {};
      const width = Number(size.width);
      const height = Number(size.height);
      const x = Number(position.x);
      const y = Number(position.y);
      if (!container || ![x, y, width, height].every(Number.isFinite)) return false;

      const nextWidth = clampWindowValue(width, MIN_WIDTH, window.innerWidth);
      const nextHeight = clampWindowValue(height, MIN_HEIGHT, window.innerHeight);
      const nextX = clampWindowValue(x, 0, Math.max(0, window.innerWidth - nextWidth));
      const nextY = clampWindowValue(y, 0, Math.max(0, window.innerHeight - nextHeight));

      container.style.position = 'fixed';
      container.style.left = `${nextX}px`;
      container.style.top = `${nextY}px`;
      container.style.width = `${nextWidth}px`;
      container.style.height = `${nextHeight}px`;
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.classList.add('viewer-window-controls-enabled');
      this.manuallyResized = true;
      this.updateSize?.();
      return true;
    },

    setupWindowControls(container) {
      if (!container || container.querySelector('.viewer-window-controls')) return;

      const controls = document.createElement('div');
      controls.className = 'viewer-window-controls';
      controls.setAttribute('aria-label', 'Viewer window controls');

      const dragHandle = document.createElement('div');
      dragHandle.className = 'viewer-window-drag-handle';
      dragHandle.setAttribute('role', 'button');
      dragHandle.setAttribute('aria-label', 'Move viewer window');
      dragHandle.title = 'Move viewer window';
      controls.appendChild(dragHandle);

      ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((corner) => {
        const handle = document.createElement('div');
        handle.className = `viewer-window-resize-handle viewer-window-resize-${corner}`;
        handle.dataset.direction = corner;
        handle.setAttribute('role', 'button');
        handle.setAttribute('aria-label', `Resize viewer window ${corner}`);
        controls.appendChild(handle);
      });

      container.appendChild(controls);
      container.classList.add('viewer-window-controls-enabled');

      const makeFixed = () => {
        const rect = container.getBoundingClientRect();
        container.style.position = 'fixed';
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.top}px`;
        container.style.width = `${rect.width}px`;
        container.style.height = `${rect.height}px`;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
      };

      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
      const updateGeometry = (start, event, mode, direction) => {
        const dx = event.clientX - start.pointerX;
        const dy = event.clientY - start.pointerY;
        let left = start.left;
        let top = start.top;
        let width = start.width;
        let height = start.height;

        if (mode === 'move') {
          left += dx;
          top += dy;
        } else {
          if (direction.includes('left')) {
            left = clamp(start.left + dx, 0, start.right - MIN_WIDTH);
            width = start.right - left;
          } else {
            width = clamp(start.width + dx, MIN_WIDTH, window.innerWidth - start.left);
          }
          if (direction.includes('top')) {
            top = clamp(start.top + dy, 0, start.bottom - MIN_HEIGHT);
            height = start.bottom - top;
          } else {
            height = clamp(start.height + dy, MIN_HEIGHT, window.innerHeight - start.top);
          }
        }

        left = clamp(left, 0, Math.max(0, window.innerWidth - width));
        top = clamp(top, 0, Math.max(0, window.innerHeight - height));
        container.style.left = `${left}px`;
        container.style.top = `${top}px`;
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
      };

      const startInteraction = (event, mode, direction = '') => {
        if (document.fullscreenElement === container) return;
        event.preventDefault();
        event.stopPropagation();
        Viewer.manuallyResized = true;
        makeFixed();
        const rect = container.getBoundingClientRect();
        const start = {
          pointerX: event.clientX,
          pointerY: event.clientY,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };

        let updateFrame = null;
        const move = (moveEvent) => {
          updateGeometry(start, moveEvent, mode, direction);
          if (updateFrame !== null) return;
          updateFrame = requestAnimationFrame(() => {
            updateFrame = null;
            Viewer.updateSize?.();
          });
        };
        const stop = () => {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', stop);
          document.removeEventListener('pointercancel', stop);
          if (updateFrame !== null) {
            cancelAnimationFrame(updateFrame);
            updateFrame = null;
          }
          Viewer.updateSize?.();
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', stop, { once: true });
        document.addEventListener('pointercancel', stop, { once: true });
      };

      dragHandle.addEventListener('pointerdown', (event) => startInteraction(event, 'move'));
      controls.querySelectorAll('.viewer-window-resize-handle').forEach((handle) => {
        handle.addEventListener('pointerdown', (event) => {
          startInteraction(event, 'resize', handle.dataset.direction);
        });
      });
    },
  });
}

function clampWindowValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}