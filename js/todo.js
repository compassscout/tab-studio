/* todo.js — 右下角待办卡片：点击弹窗、输入防抖实时自动保存到 IndexedDB */
import { saveTodoText } from './store.js';
import { debounce } from './utils.js';

export function initTodo() {
  const fab = document.getElementById('todo-fab');
  const modal = document.getElementById('todo-modal');
  const textarea = document.getElementById('todo-text');
  const hint = document.getElementById('todo-saved-hint');

  let loaded = false;
  fab.addEventListener('click', () => {
    modal.classList.toggle('modal-hidden');
    if (!loaded) {
      import('./store.js').then(({ getState }) => {
        const t = getState().todos[0];
        if (t) textarea.value = t.text || '';
        loaded = true;
      });
    }
  });

  const save = debounce(async (val) => {
    await saveTodoText(val);
    const d = new Date();
    hint.textContent = `已自动保存 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }, 500);

  textarea.addEventListener('input', () => {
    hint.textContent = '正在输入…';
    save(textarea.value);
  });
}
