// The line under a model's name in the model lists (library, repository,
// admin): small icons instead of words. Each part is an icon, optionally
// followed by a value; the words stay as its tooltip and accessible name.
// The icons themselves are CSS masks (.meta-icon[data-icon] in models-panel.css).

export function metaPart(icon, label, value = "") {
  const part = document.createElement("span");
  part.className = "meta-part";
  part.title = label;
  const glyph = document.createElement("span");
  glyph.className = "meta-icon";
  glyph.dataset.icon = icon;
  part.appendChild(glyph);
  if (value) {
    const text = document.createElement("span");
    text.textContent = value;
    part.appendChild(text);
    glyph.setAttribute("aria-hidden", "true");
    part.setAttribute("aria-label", `${label}: ${value}`);
  } else {
    part.setAttribute("role", "img");
    part.setAttribute("aria-label", label);
  }
  return part;
}

// The caption itself; empty parts (null) are left out.
export function metaCaption(parts) {
  const caption = document.createElement("span");
  caption.className = "models-panel-item-meta";
  caption.append(...parts.filter(Boolean));
  return caption;
}
