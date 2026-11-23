import * as THREE from 'three';

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.36)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createCanvasWeaveBumpTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const step = 8;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const parity = ((x / step) + (y / step)) % 2 === 0;
      ctx.fillStyle = parity ? '#bcbcbc' : '#585858';
      ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
      ctx.fillStyle = parity ? '#d8d8d8' : '#707070';
      ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createLeatherGrainBumpTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#757575';
  ctx.fillRect(0, 0, size, size);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.5 + rand() * 3.5;
    const shade = Math.floor(95 + rand() * 90);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createCarbonTwillTexture(anisotropy: number, baseHex: string, accentHex: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  const cell = 16;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const shift = ((x + y) / cell) % 2 === 0;
      ctx.fillStyle = shift ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, y, cell - 1, cell - 1);
    }
  }

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.lineTo(size, size * 0.5);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 8);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createCrestPlateTexture(anisotropy: number, accentHex: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f131b';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, size - 28, size - 28);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2 - 14, 52, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = accentHex;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKI', size / 2, size / 2 - 5);
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('SIALKOT', size / 2, size / 2 + 72);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createGlobeEarthTexture(anisotropy: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian ocean gradient
  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#0c1524');
  ocean.addColorStop(0.5, '#09111d');
  ocean.addColorStop(1, '#0c1524');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  // Graticule grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  for (let lon = 0; lon <= 12; lon++) {
    const x = (lon / 12) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let lat = 0; lat <= 6; lat++) {
    const y = (lat / 6) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Stylized landmass polygons (lat/lng mapped to equirectangular canvas)
  const toXY = (lat: number, lng: number): [number, number] => [
    ((lng + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  const drawLand = (coords: [number, number][]) => {
    ctx.beginPath();
    coords.forEach(([lat, lng], idx) => {
      const [x, y] = toXY(lat, lng);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = '#1d2b3f';
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  };

  // North America
  drawLand([[70, -165], [70, -80], [50, -55], [25, -80], [15, -90], [30, -115], [50, -130]]);
  // South America
  drawLand([[12, -75], [5, -50], [-20, -40], [-55, -68], [-40, -75], [-5, -81]]);
  // Europe
  drawLand([[70, 5], [65, 30], [45, 35], [36, 15], [37, -9], [52, -5], [60, 5]]);
  // Africa
  drawLand([[35, -6], [32, 32], [12, 50], [-34, 24], [-34, 18], [5, 8], [15, -17]]);
  // Asia + Arabian Peninsula + South Asia
  drawLand([[70, 35], [72, 140], [55, 160], [35, 140], [22, 114], [10, 105], [8, 77], [24, 67], [25, 55], [14, 44], [35, 36]]);
  // Australia
  drawLand([[-12, 130], [-18, 146], [-38, 148], [-35, 115], [-20, 118]]);
  // Japan & UK accents
  drawLand([[45, 141], [35, 140], [31, 131], [36, 136]]);
  drawLand([[58, -5], [58, -1], [50, 1], [50, -5]]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}
