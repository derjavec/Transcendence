//matrix-bg.ts

export function initMatrixBackground(): void {
  const existingCanvas = document.getElementById('matrixCanvas') as HTMLCanvasElement;
  if (existingCanvas) 
    return;
  //creer un canvas por le fond
  const canvas = document.createElement('canvas');
  canvas.id = 'matrixCanvas';
  // configurer le canvas pour qu'il soit fixe + qu'il prenne la taille de la fenetre + ne bloque pas les clicks
  canvas.className = 'fixed top-0 left-0 w-full h-full z-0 pointer-events-none';
  document.body.appendChild(canvas);

  // preparer les lettre pour la pluie
  const letters = Array(256).join("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789あいうえおカキクケコさしすせそ").split("");
  const fontSize = 14;
  let columns: number;
  let drops: number[];

  // canvas responsive
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = Math.floor(canvas.width / fontSize);
    drops = Array(columns).fill(1);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function draw() {
    const ctx = canvas.getContext('2d');
    if (!ctx) 
      return;
    // dessiner le fond noir
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // definir le vert matrix des lettres
    ctx.fillStyle = "#00FF41";
    ctx.font = `${fontSize}px monospace`;

    drops.forEach((y, index) => {
      // prendre un caractere au hasard
      const text = letters[Math.floor(Math.random() * letters.length)];
      const x = index * fontSize;
      // afficher le caractere random
      ctx.fillText(text, x, y * fontSize);
      //si on sort du canvas -> on revient en haut de la fenetre
      if (y * fontSize > canvas.height && Math.random() > 0.975) {
        drops[index] = 0;
      }
      // si non, on remplit le caracter suivant (vers le bas)
      drops[index] += 0.3;
    });
  }

  function loop() {
    draw();
    requestAnimationFrame(loop); // appelle Draw une fois par frame
  }

  loop();
}
