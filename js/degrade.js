/* degrade.js — 经典脚本（非 module）：file:// 直开时 ES module 受浏览器 CORS 限制无法加载，
   延迟探测主模块是否启动；未启动则显示静态降级提示。扩展环境内主模块正常启动，不显示。 */
window.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    var booted = window.__APP_BOOTED__ === true;
    var inExtension = typeof chrome !== 'undefined' && !!chrome.runtime;
    if (!booted && !inExtension) {
      var note = document.getElementById('degraded-note');
      if (note) note.style.display = 'block';
    }
  }, 500);
});
