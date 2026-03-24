import fs from 'fs';
import path from 'path';
import os from 'os';

const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'session-manager-settings.json');

interface Settings {
  closeToTray: boolean;
  startOnLogin: boolean;
  lang: string;
  firstRun: boolean;
}

const defaults: Settings = {
  closeToTray: false,
  startOnLogin: false,
  lang: 'ko',
  firstRun: true,
};

let cache: Settings | null = null;

export const settings = {
  load(): Settings {
    if (cache) return cache;
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        cache = { ...defaults, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) };
        return cache!;
      }
    } catch {}
    cache = { ...defaults };
    return cache;
  },

  save(partial: Partial<Settings>) {
    const current = this.load();
    cache = { ...current, ...partial };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(cache, null, 2));
  },

  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.load()[key];
  },

  set<K extends keyof Settings>(key: K, value: Settings[K]) {
    this.save({ [key]: value });
  },
};
