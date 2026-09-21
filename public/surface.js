// Apply the transparent window surface before the first stylesheet paint.
// Electron exposes dudidamDesktop from preload; web pop-ups opt in via ?popup=1.
const params = new URLSearchParams(location.search);
const isDesktop = Boolean(window.dudidamDesktop);
const isPopup = params.get('popup') === '1';
const isPanel = isDesktop && params.has('panel');

document.documentElement.classList.toggle('desktop-surface', isDesktop && !isPanel);
document.documentElement.classList.toggle('panel-surface', isPanel);
document.documentElement.classList.toggle('popup-surface', isPopup);
document.documentElement.classList.toggle('transparent-surface', (isDesktop && !isPanel) || isPopup);
