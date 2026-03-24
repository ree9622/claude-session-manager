import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';

const STATE_FILE = path.join(os.homedir(), '.claude', 'session-manager-state.json');

export interface SavedTerminal {
  sessionId?: string;
  name: string;
  cwd: string;
}

interface AppState {
  activeTerminals: SavedTerminal[];
  lastSaved: number;
}

export const stateStore = {
  save(terminals: SavedTerminal[]) {
    const state: AppState = {
      activeTerminals: terminals,
      lastSaved: Date.now(),
    };
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      logger.info('state', `Saved ${terminals.length} terminals`);
    } catch (err) {
      logger.error('state', 'Failed to save state', err);
    }
  },

  load(): SavedTerminal[] {
    try {
      if (!fs.existsSync(STATE_FILE)) return [];
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const state: AppState = JSON.parse(raw);
      logger.info('state', `Loaded ${state.activeTerminals.length} terminals from state`);
      return state.activeTerminals;
    } catch (err) {
      logger.error('state', 'Failed to load state', err);
      return [];
    }
  },

  clear() {
    try {
      if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
    } catch {}
  },
};
