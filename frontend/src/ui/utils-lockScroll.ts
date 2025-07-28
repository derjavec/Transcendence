// utils/scrollLock.ts
export function lockScroll() {
  // Bloquer scroll clavier
  window.addEventListener("keydown", preventArrowScroll, { passive: false });
  // Bloquer scroll de la souris
  window.addEventListener("wheel", preventWheelScroll, { passive: false });
  // Bloquer scroll tactile (phone)
  window.addEventListener("touchmove", preventTouchScroll, { passive: false });
}

export function unlockScroll() {
  window.removeEventListener("keydown", preventArrowScroll);
  window.removeEventListener("wheel", preventWheelScroll);
  window.removeEventListener("touchmove", preventTouchScroll);
}

function preventArrowScroll(e: KeyboardEvent) {
  const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "];
  if (keys.includes(e.key)) {
    e.preventDefault();
  }
}

function preventWheelScroll(e: WheelEvent) {
  e.preventDefault();
}

function preventTouchScroll(e: TouchEvent) {
  e.preventDefault();
}
