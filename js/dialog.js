/* dialog.js — 通用弹层：打开/关闭、确认框、文本输入框 */

export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  const backdrop = document.querySelector(`[data-close="${id}"]`);
  backdrop?.classList.add('open');
}
export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  const backdrop = document.querySelector(`[data-close="${id}"]`);
  backdrop?.classList.remove('open');
}
export function closeAllModals() {
  document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
  document.querySelectorAll('.sheet-backdrop.open').forEach((b) => b.classList.remove('open'));
}
export function anyModalOpen() { return !!document.querySelector('.modal.open'); }

let confirmResolve = null;
export function confirmAction(text, { okText = '确定', danger = true } = {}) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    const textEl = document.getElementById('confirm-text');
    const ok = document.getElementById('confirm-ok');
    if (textEl) textEl.textContent = text;
    if (ok) {
      ok.textContent = okText;
      ok.className = 'btn ' + (danger ? 'danger' : 'primary');
    }
    openModal('confirm-modal');
  });
}

/** 自定义文本输入弹窗（替代 window.prompt） */
export function askText({ title = '请输入', value = '', placeholder = '', okText = '确定' } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop open';
    backdrop.style.zIndex = '1250';

    const modal = document.createElement('section');
    modal.className = 'modal open';
    modal.style.zIndex = '1260';
    modal.style.width = 'min(380px, 92vw)';
    modal.innerHTML = `
      <div class="modal-head"><h3></h3><button class="icon-btn" data-x><svg><use href="#i-close"/></svg></button></div>
      <div class="modal-body"><label class="form-row"><span>${placeholder ? '' : ''}</span><input type="text" data-input></label><div class="form-error" data-error></div></div>
      <div class="modal-foot"><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>${okText}</button></div>`;
    modal.querySelector('h3').textContent = title;
    const input = modal.querySelector('[data-input]');
    input.value = value;
    input.placeholder = placeholder;

    const done = (val) => {
      modal.remove(); backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const submit = () => done(input.value.trim() || null);
    const onKey = (e) => {
      if (e.key === 'Escape') done(null);
      if (e.key === 'Enter') submit();
    };
    modal.querySelector('[data-ok]').addEventListener('click', submit);
    modal.querySelector('[data-cancel]').addEventListener('click', () => done(null));
    modal.querySelector('[data-x]').addEventListener('click', () => done(null));
    backdrop.addEventListener('click', () => done(null));
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    setTimeout(() => { input.focus(); input.select(); }, 30);
  });
}

export function initDialogs() {
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) {
      const id = closer.dataset.close;
      if (id === 'confirm-modal' && confirmResolve) { confirmResolve(false); confirmResolve = null; }
      closeModal(id);
    }
    if (e.target.classList.contains('sheet-backdrop')) {
      const id = e.target.dataset.close;
      if (id === 'confirm-modal' && confirmResolve) { confirmResolve(false); confirmResolve = null; }
    }
  });
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    if (confirmResolve) { confirmResolve(true); confirmResolve = null; }
    closeModal('confirm-modal');
  });
  document.getElementById('confirm-cancel')?.addEventListener('click', () => {
    if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
    closeModal('confirm-modal');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (anyModalOpen()) {
      if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
      closeAllModals();
    }
  });
}
