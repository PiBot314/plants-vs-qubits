import "./style.css";
import { Cleanup } from "./ui/dom";
import { mountStart } from "./ui/startScreen";
import { mountLevelSelect } from "./ui/levelSelect";
import { mountGame } from "./ui/gameScreen";

export type Route = { name: "start" } | { name: "levels" } | { name: "game"; id: number };
export type Navigate = (r: Route) => void;

const app = document.getElementById("app")!;
let cleanup: Cleanup | null = null;

const navigate: Navigate = (r) => {
  cleanup?.();
  app.replaceChildren();
  if (r.name === "start") cleanup = mountStart(app, navigate);
  else if (r.name === "levels") cleanup = mountLevelSelect(app, navigate);
  else cleanup = mountGame(app, r.id, navigate);
};

function makeStars() {
  const field = document.getElementById("stars")!;
  for (let i = 0; i < 160; i++) {
    const d = document.createElement("div");
    const size = Math.random() < 0.9 ? 1 : 2;
    d.className = "star";
    d.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${size}px;height:${size}px;--o:${0.25 + Math.random() * 0.6};--t:${3 + Math.random() * 5}s;--d:${-Math.random() * 8}s`;
    field.append(d);
  }
}

makeStars();
navigate({ name: "start" });
