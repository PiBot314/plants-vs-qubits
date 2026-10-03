const KEY = "blochit.settings";

export interface Settings {
  /** Index into the game screen's speed list. */
  speedIdx: number;
  /** What a qubit shows inside its circle. */
  qubitLabels: "amplitudes" | "bloch";
}

const DEFAULTS: Settings = { speedIdx: 2, qubitLabels: "amplitudes" };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<Settings>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadSettings(), ...patch }));
  } catch {
    /* storage unavailable: settings are session-only */
  }
}
