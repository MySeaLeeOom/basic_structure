import type { Awareness } from "y-protocols/awareness";

const COLORS = [
  "#958DF1", "#F98181", "#FBBC88", "#FAF594",
  "#70CFF8", "#94FADB", "#B9F18D", "#C4B5FD",
];

export function userColor(id?: string): string {
  if (!id) return COLORS[0] ?? "#958DF1";
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length] ?? COLORS[0] ?? "#958DF1";
}

export function createCaretRenderer(awareness: Awareness): (user: { name: string; color: string }) => HTMLElement {
  return (user: { name: string; color: string }) => {
    const cursor = document.createElement("span");
    cursor.classList.add("collaboration-carets__caret");
    cursor.style.borderColor = user.color;

    const label = document.createElement("div");
    label.classList.add("collaboration-carets__label");
    label.style.backgroundColor = user.color;
    label.textContent = user.name;

    let fadeTimer: ReturnType<typeof setTimeout>;
    const show = () => {
      label.style.opacity = "1";
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => { label.style.opacity = "0"; }, 2000);
    };

    show();
    cursor.appendChild(label);
    return cursor;
  };
}
