// Меню на узком экране. Остальной сайт работает без JS.
(function () {
  var top = document.querySelector('.top');
  var btn = top && top.querySelector('.burger');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var open = top.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? 'Закрыть' : 'Меню';
  });
})();
