/**
 * Ilustrações vetoriais dos produtos.
 * Leves (sem requisição de imagem), sempre na paleta da marca e únicas por produto.
 * Quando o administrador cadastra uma foto (image_url), a foto tem prioridade.
 */

const C = {
  crust: ["#E8AE62", "#C97A2E", "#8F4F18"],
  sauce: "#B8322A",
  cheese: ["#FFE7A3", "#F2BE55"],
};

function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let s = (h >>> 0) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Espalha pontos dentro de um círculo mantendo distância mínima entre eles. */
function scatter(rand, count, radius, minDist, taken = []) {
  const pts = [];
  for (let tries = 0; pts.length < count && tries < count * 60; tries++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const p = { x: 120 + Math.cos(a) * r, y: 120 + Math.sin(a) * r, rot: rand() * 360 };
    if ([...pts, ...taken].every((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 > minDist ** 2)) pts.push(p);
  }
  taken.push(...pts);
  return pts;
}

const t = (p, extra = "") => `transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)})${extra}"`;

const TOPPINGS = {
  pepperoni: (p) => `<g ${t(p)}><circle r="11" fill="#A3241C"/><circle r="11" fill="none" stroke="#7E1712" stroke-width="2"/><circle cx="-3" cy="-2" r="2" fill="#E0664F" opacity=".8"/><circle cx="4" cy="3" r="1.6" fill="#E0664F" opacity=".7"/><circle cx="2" cy="-5" r="1.2" fill="#6D130F"/></g>`,
  calabresa: (p) => `<g ${t(p)}><ellipse rx="11" ry="10" fill="#B3402B"/><ellipse rx="8" ry="7" fill="#C95A3E"/><circle cx="-3" cy="1" r="1.6" fill="#F3D2B8"/><circle cx="3" cy="-3" r="1.3" fill="#F3D2B8"/><circle cx="2" cy="4" r="1.1" fill="#F3D2B8"/></g>`,
  linguica: (p) => `<g ${t(p)}><circle r="9" fill="#8C4A2B"/><circle r="6.5" fill="#A86040"/><path d="M-4 -1h3M1 3h4M-1 -4h2" stroke="#E8C4A4" stroke-width="1.4" stroke-linecap="round"/></g>`,
  olive: (p) => `<g ${t(p)}><ellipse rx="5.5" ry="4.6" fill="#231A17"/><ellipse rx="2" ry="1.6" fill="#5A3B2E"/></g>`,
  tomato: (p) => `<g ${t(p)}><circle r="10" fill="#D8412F"/><circle r="7.4" fill="#EC6A4F"/><g fill="#F6D27A"><ellipse cx="-3" cy="-2" rx="1.4" ry="2.2"/><ellipse cx="3" cy="-2" rx="1.4" ry="2.2"/><ellipse cx="0" cy="3.5" rx="2.2" ry="1.4"/></g></g>`,
  cherry: (p) => `<g ${t(p)}><circle r="7" fill="#C7361F"/><ellipse cx="-2.4" cy="-2.4" rx="2.2" ry="1.4" fill="#F09A7E" opacity=".8"/></g>`,
  basil: (p) => `<g ${t(p)}><path d="M0 12C-9 6-9-6 0-13C9-6 9 6 0 12Z" fill="#3E7B35"/><path d="M0 10V-10" stroke="#8DBF6A" stroke-width="1.2"/></g>`,
  arugula: (p) => `<g ${t(p)}><path d="M0 14 L-3 8 L-8 6 L-4 2 L-9 -3 L-3 -4 L-5 -10 L0 -7 L5 -10 L3 -4 L9 -3 L4 2 L8 6 L3 8Z" fill="#4F8A3A"/></g>`,
  onion: (p) => `<path ${t(p)} d="M-10 4 A11 11 0 0 1 10 4" fill="none" stroke="#F4E6F0" stroke-width="3" stroke-linecap="round"/>`,
  redonion: (p) => `<path ${t(p)} d="M-10 4 A11 11 0 0 1 10 4" fill="none" stroke="#9D4B7A" stroke-width="3.4" stroke-linecap="round"/>`,
  ham: (p) => `<rect ${t(p)} x="-9" y="-6" width="18" height="12" rx="4" fill="#E79A9A" stroke="#C97474" stroke-width="1.5"/>`,
  parma: (p) => `<path ${t(p)} d="M-13 -2C-6 -10 4 6 13 -3C9 6-3 9-13 -2Z" fill="#D87F7F" stroke="#F2C3B8" stroke-width="1.2"/>`,
  egg: (p) => `<g ${t(p)}><path d="M-10 0C-10-8 8-10 10-2C12 7-8 10-10 0Z" fill="#FFFDF4"/><circle r="4.5" fill="#F4B32D"/></g>`,
  pea: (p) => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#6FA83E" stroke="#4E7F2A"/>`,
  corn: (p) => `<ellipse ${t(p)} rx="3" ry="2.4" fill="#F7C83A"/>`,
  chicken: (p) => `<path ${t(p)} d="M-10 -2C-4-6 4-5 10-2C5 1-3 4-10 -2Z" fill="#E9C28E" stroke="#C9965B" stroke-width="1"/>`,
  catupiry: (p) => `<g ${t(p)}><path d="M-9 0C-9-8 9-8 9 0C9 7-9 7-9 0Z" fill="#FFFBF0"/><path d="M-4 -1C-1-4 3-3 3 0" fill="none" stroke="#EDE2C8" stroke-width="1.5"/></g>`,
  gorgonzola: (p) => `<g ${t(p)}><circle r="7" fill="#F4EFDF"/><path d="M-4 -2l3 2 2-3M1 3l3-1" stroke="#7C93A8" stroke-width="1.4" fill="none"/></g>`,
  parmesan: (p) => `<path ${t(p)} d="M-8 -3L8 -5L6 3L-7 4Z" fill="#F7E7B5" stroke="#E3C77F" stroke-width="1"/>`,
  rosemary: (p) => `<g ${t(p)} stroke="#4C6B39" stroke-width="2" stroke-linecap="round"><path d="M0 -10V10"/><path d="M0 -6l-4-3M0 -2l4-3M0 2l-4-3M0 6l4-3"/></g>`,
  burrata: (p) => `<g transform="translate(${p.x} ${p.y})"><circle r="30" fill="#FFFDF6"/><path d="M-12 -4C-4-14 10-12 14 2C8 12-8 12-12 -4Z" fill="#F3EBD6"/><circle cx="-8" cy="-10" r="6" fill="#FFFFFF" opacity=".9"/></g>`,
  pesto: (p) => `<circle cx="${p.x}" cy="${p.y}" r="${5 + (p.rot % 4)}" fill="#4D7F2E" opacity=".9"/>`,
  strawberry: (p) => `<g ${t(p)}><path d="M0 12C-12 4-12-8 0-9C12-8 12 4 0 12Z" fill="#D92E3A"/><path d="M0 9C-7 3-7-5 0-6C7-5 7 3 0 9Z" fill="#F07C7F"/><g fill="#FFE6A8"><circle cx="-3" cy="-2" r=".9"/><circle cx="3" cy="0" r=".9"/><circle cx="0" cy="4" r=".9"/></g></g>`,
  banana: (p) => `<g ${t(p)}><circle r="10" fill="#F6E3A1"/><circle r="7" fill="#FBEFC6"/><circle r="1.6" fill="#8A6A3A"/></g>`,
  cinnamon: (p) => `<circle cx="${p.x}" cy="${p.y}" r="1.4" fill="#7A4420" opacity=".75"/>`,
  goiabada: (p) => `<rect ${t(p)} x="-8" y="-8" width="16" height="16" rx="3" fill="#8E1F2C" stroke="#B53645" stroke-width="1.4"/>`,
  minas: (p) => `<rect ${t(p)} x="-9" y="-7" width="18" height="14" rx="4" fill="#FFFBEF"/>`,
  sugar: (p) => `<circle cx="${p.x}" cy="${p.y}" r="1.3" fill="#FFFFFF" opacity=".8"/>`,
  bacon: (p) => `<path ${t(p)} d="M-12 -3C-6 -6 -2 0 4 -3C8 -5 11 -4 12 -2L12 3C8 1 5 1 2 3C-4 6-8 1-12 3Z" fill="#B5473A" stroke="#F0B9A8" stroke-width="1"/>`,
};

const PRESETS = {
  margherita: { toppings: [["tomato", 7], ["basil", 6]] },
  calabresa: { toppings: [["calabresa", 11], ["onion", 7], ["olive", 6]] },
  portuguesa: { toppings: [["ham", 8], ["egg", 4], ["pea", 22], ["olive", 5], ["onion", 5]] },
  "quatro-queijos": { cheese: 1.4, toppings: [["gorgonzola", 8], ["parmesan", 10], ["catupiry", 5]] },
  frango: { toppings: [["chicken", 16], ["catupiry", 7], ["corn", 18]] },
  romera: { toppings: [["linguica", 11], ["redonion", 9], ["rosemary", 7]], drizzle: "#E3A62F" },
  pepperoni: { toppings: [["pepperoni", 20]], drizzle: "#D9861F" },
  burrata: { sauce: "#C23A2B", toppings: [["burrata", 1, 0], ["cherry", 9], ["pesto", 10], ["arugula", 4]] },
  parma: { toppings: [["arugula", 9], ["parma", 8], ["parmesan", 8]] },
  "chocolate-morango": { sauce: "#5A2D1C", cheese: 0, toppings: [["strawberry", 14]], drizzle: "#FFF3E0" },
  banana: { sauce: "#F0D38A", toppings: [["banana", 15], ["cinnamon", 60], ["sugar", 30]], drizzle: "#F9EBC8" },
  "romeu-julieta": { sauce: "#FFF4DA", cheese: 0.6, toppings: [["minas", 10], ["goiabada", 10]] },
};

function pizzaSVG(key, seedKey) {
  const preset = PRESETS[key] || PRESETS.margherita;
  const rand = seeded(seedKey || key);
  const uid = `pz${Math.floor(rand() * 1e9)}`;
  const cheese = preset.cheese ?? 1;
  let out = "";

  // Borda com manchas de forno
  out += `<circle cx="120" cy="124" r="104" fill="rgba(0,0,0,.35)"/>`;
  out += `<circle cx="120" cy="120" r="104" fill="url(#${uid}c)"/>`;
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, r = 92 + rand() * 8;
    out += `<ellipse cx="${120 + Math.cos(a) * r}" cy="${120 + Math.sin(a) * r}" rx="${2 + rand() * 4}" ry="${1.5 + rand() * 2}" fill="#6B3714" opacity="${0.25 + rand() * 0.35}" transform="rotate(${a * 57} ${120 + Math.cos(a) * r} ${120 + Math.sin(a) * r})"/>`;
  }

  // Molho com contorno irregular
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, r = 84 + (rand() - 0.5) * 5;
    pts.push(`${(120 + Math.cos(a) * r).toFixed(1)},${(120 + Math.sin(a) * r).toFixed(1)}`);
  }
  out += `<polygon points="${pts.join(" ")}" fill="${preset.sauce || C.sauce}"/>`;

  // Queijo derretido
  if (cheese > 0) {
    for (const p of scatter(rand, Math.round(18 * cheese), 70, 12)) {
      out += `<circle cx="${p.x}" cy="${p.y}" r="${15 + rand() * 12}" fill="url(#${uid}q)" opacity=".8"/>`;
    }
    for (const p of scatter(rand, Math.round(9 * cheese), 72, 14)) {
      out += `<ellipse cx="${p.x}" cy="${p.y}" rx="${2 + rand() * 3}" ry="${1.5 + rand() * 2}" fill="#D48A36" opacity=".55"/>`;
    }
  }

  // Cortes das fatias (por baixo das coberturas, como na vida real)
  out += `<g stroke="rgba(70,30,10,.2)" stroke-width="1.6">${[0, 45, 90, 135].map((a) => `<line x1="120" y1="18" x2="120" y2="222" transform="rotate(${a} 120 120)"/>`).join("")}</g>`;

  // Coberturas
  const taken = [];
  for (const [type, count, radius = 66] of preset.toppings) {
    const draw = TOPPINGS[type];
    const small = ["pea", "corn", "cinnamon", "sugar", "pesto"].includes(type);
    const list = type === "burrata" ? [{ x: 120, y: 120, rot: 0 }] : scatter(rand, count, radius, small ? 6 : 17, small ? [] : taken);
    if (type === "burrata") taken.push({ x: 120, y: 120 }, { x: 132, y: 120 }, { x: 108, y: 120 }, { x: 120, y: 132 }, { x: 120, y: 108 });
    out += list.map(draw).join("");
  }

  if (preset.drizzle) {
    let d = "M58 84";
    for (let i = 0; i < 5; i++) d += ` Q${72 + i * 26} ${i % 2 ? 60 : 190} ${84 + i * 26} ${120 + (rand() - 0.5) * 40}`;
    out += `<path d="${d}" fill="none" stroke="${preset.drizzle}" stroke-width="3" stroke-linecap="round" opacity=".85"/>`;
  }

  // Brilho
  out += `<circle cx="120" cy="120" r="104" fill="url(#${uid}g)"/>`;

  const defs = `<defs>
    <radialGradient id="${uid}c" cx=".5" cy=".45" r=".55"><stop offset=".78" stop-color="${C.crust[0]}"/><stop offset=".9" stop-color="${C.crust[1]}"/><stop offset="1" stop-color="${C.crust[2]}"/></radialGradient>
    <radialGradient id="${uid}q"><stop offset="0" stop-color="${C.cheese[0]}"/><stop offset="1" stop-color="${C.cheese[1]}"/></radialGradient>
    <radialGradient id="${uid}g" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>`;
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${defs}${out}</svg>`;
}

const OTHER = {
  "pao-alho": () => `<svg viewBox="0 0 240 240" aria-hidden="true" focusable="false"><ellipse cx="120" cy="178" rx="98" ry="14" fill="rgba(0,0,0,.3)"/>
    ${[0, 1, 2, 3, 4].map((i) => `<g transform="translate(${38 + i * 40} ${120 + (i % 2) * 6}) rotate(${-8 + i * 4})"><path d="M-22 40C-28 0-24-38 0-44C24-38 28 0 22 40Z" fill="#C9853C"/><path d="M-16 34C-20 2-17-30 0-35C17-30 20 2 16 34Z" fill="#F6DDA0"/><path d="M-12 10C-6 0 6 18 12 4" stroke="#FFF7DE" stroke-width="5" fill="none" stroke-linecap="round"/><g fill="#3E7B35"><circle cx="-6" cy="-12" r="2"/><circle cx="6" cy="-4" r="1.8"/><circle cx="-2" cy="22" r="1.8"/></g></g>`).join("")}</svg>`,
  focaccia: () => `<svg viewBox="0 0 240 240" aria-hidden="true" focusable="false"><rect x="30" y="58" width="184" height="134" rx="18" fill="rgba(0,0,0,.3)"/><rect x="26" y="50" width="188" height="134" rx="18" fill="#C27A30"/><rect x="34" y="56" width="172" height="120" rx="14" fill="#E9B45F"/>
    ${Array.from({ length: 18 }, (_, i) => `<ellipse cx="${52 + (i % 6) * 28 + (i % 12 < 6 ? 0 : 12)}" cy="${76 + Math.floor(i / 6) * 36}" rx="6" ry="4" fill="#C98A3E"/>`).join("")}
    ${[[70, 90], [150, 110], [100, 150], [180, 70], [60, 150]].map(([x, y], i) => `<g transform="translate(${x} ${y}) rotate(${i * 40})" stroke="#4C6B39" stroke-width="2.4" stroke-linecap="round"><path d="M0 -12V12"/><path d="M0 -8l-5-3M0 -2l5-3M0 4l-5-3M0 10l5-3"/></g>`).join("")}
    ${[[110, 80], [170, 150], [60, 118]].map(([x, y]) => `<g fill="#fff"><rect x="${x}" y="${y}" width="3" height="3"/><rect x="${x + 6}" y="${y + 4}" width="2.5" height="2.5"/></g>`).join("")}</svg>`,
  lata: () => `<svg viewBox="0 0 240 240" aria-hidden="true" focusable="false"><ellipse cx="120" cy="206" rx="54" ry="10" fill="rgba(0,0,0,.3)"/>
    <g transform="translate(78 40)"><rect x="0" y="12" width="84" height="150" rx="10" fill="#9B2226"/><rect x="0" y="12" width="20" height="150" fill="#fff" opacity=".12"/><rect x="6" y="0" width="72" height="18" rx="6" fill="#CFC7BD"/><rect x="6" y="156" width="72" height="12" rx="5" fill="#B7ADA2"/>
    <circle cx="42" cy="86" r="24" fill="#E0A948"/><circle cx="42" cy="86" r="18" fill="#9B2226"/><text x="42" y="92" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-weight="700" font-size="14" fill="#FFF8EC">R&amp;R</text>
    ${[[16, 40], [64, 130], [30, 140], [70, 48]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#fff" opacity=".6"/>`).join("")}</g></svg>`,
  suco: () => `<svg viewBox="0 0 240 240" aria-hidden="true" focusable="false"><ellipse cx="120" cy="204" rx="50" ry="9" fill="rgba(0,0,0,.3)"/>
    <path d="M78 52H162L150 198H90Z" fill="#FFF8EC" opacity=".25"/><path d="M82 78H158L148 194H92Z" fill="#F29A2E"/><path d="M82 78H158L156 96H84Z" fill="#F7B955"/>
    <circle cx="160" cy="62" r="26" fill="#F7C548"/><circle cx="160" cy="62" r="20" fill="#FBE08A"/>${[0, 60, 120].map((a) => `<line x1="140" y1="62" x2="180" y2="62" stroke="#F7C548" stroke-width="2" transform="rotate(${a} 160 62)"/>`).join("")}
    <rect x="106" y="24" width="8" height="120" rx="4" fill="#4E7A3E" transform="rotate(12 110 84)"/></svg>`,
  agua: () => `<svg viewBox="0 0 240 240" aria-hidden="true" focusable="false"><ellipse cx="120" cy="208" rx="40" ry="8" fill="rgba(0,0,0,.3)"/>
    <rect x="108" y="22" width="24" height="18" rx="4" fill="#4E7A3E"/><path d="M104 40H136C140 56 152 62 152 80V196C152 202 148 206 142 206H98C92 206 88 202 88 196V80C88 62 100 56 104 40Z" fill="#CFE6EC" opacity=".85"/>
    <rect x="88" y="104" width="64" height="52" fill="#FFF8EC"/><text x="120" y="136" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-weight="700" font-size="14" fill="#9B2226">ÁGUA</text>
    <path d="M96 84V190" stroke="#fff" stroke-width="5" opacity=".6" stroke-linecap="round"/></svg>`,
};

export const ART_OPTIONS = [
  ...Object.keys(PRESETS),
  ...Object.keys(OTHER),
];

/** Retorna HTML da mídia do produto: foto (se houver) ou ilustração. */
export function productMedia(product, { eager = false } = {}) {
  if (product.image_url) {
    const src = encodeURI(product.image_url);
    return `<img src="${src}" alt="" ${eager ? "" : 'loading="lazy"'} decoding="async" />`;
  }
  const key = product.art || "margherita";
  return OTHER[key] ? OTHER[key]() : pizzaSVG(key, `${key}-${product.id ?? ""}`);
}

export { pizzaSVG };
