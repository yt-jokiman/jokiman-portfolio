const menuButton = document.querySelector('.menu-button');
const navLinks = document.querySelector('.nav-links');
const progress = document.querySelector('.progress');

menuButton.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
  menuButton.textContent = isOpen ? 'CLOSE' : 'MENU';
});

navLinks.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  navLinks.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'メニューを開く');
  menuButton.textContent = 'MENU';
}));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0}%`;
}

window.addEventListener('scroll', updateProgress, { passive: true });
updateProgress();
document.getElementById('year').textContent = new Date().getFullYear();
