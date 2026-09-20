// Apply the transparent window surface before the first stylesheet paint.
// Electron exposes dudidamDesktop from preload; web pop-ups opt in via ?popup=1.
const params = new URLSearchParams(location.search);
const isDesktop = Boolean(window.dudidamDesktop);
const isPopup = params.get('popup') === '1';

document.documentElement.classList.toggle('desktop-surface', isDesktop);
document.documentElement.classList.toggle('popup-surface', isPopup);
document.documentElement.classList.toggle('transparent-surface', isDesktop || isPopup);
