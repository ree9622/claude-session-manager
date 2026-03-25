import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  ptyId: string;
  isVisible: boolean;
  isFocused: boolean;
  onFocus: () => void;
}

export interface TerminalViewHandle {
  scrollToBottom: () => void;
  focus: () => void;
  fit: () => void;
}

export const TerminalView = forwardRef<TerminalViewHandle, TerminalViewProps>(
  ({ ptyId, isVisible, isFocused, onFocus }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const fitTimerRef = useRef<number | null>(null);

  const debouncedFit = () => {
    if (fitTimerRef.current) cancelAnimationFrame(fitTimerRef.current);
    fitTimerRef.current = requestAnimationFrame(() => {
      try { fitAddonRef.current?.fit(); } catch {}
    });
  };

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => terminalRef.current?.scrollToBottom(),
    focus: () => terminalRef.current?.focus(),
    fit: () => debouncedFit(),
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#111118',
        foreground: '#e4e4ed',
        cursor: '#7c6bf5',
        cursorAccent: '#111118',
        selectionBackground: 'rgba(124, 107, 245, 0.3)',
        black: '#1a1a24',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e4e4ed',
        brightBlack: '#6b7280',
        brightRed: '#fca5a5',
        brightGreen: '#6ee7b7',
        brightYellow: '#fde68a',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#f9fafb',
      },
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 3000,
      allowProposedApi: true,
      fastScrollModifier: 'alt',
      smoothScrollDuration: 0,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    try { terminal.loadAddon(new WebglAddon()); } catch {}

    fitAddon.fit();

    const removeDataListener = window.api.pty.onData(ptyId, (data) => {
      terminal.write(data);
    });

    const removeExitListener = window.api.pty.onExit(ptyId, () => {
      terminal.write('\r\n\x1b[90m[Session ended]\x1b[0m\r\n');
    });

    terminal.onData((data) => {
      window.api.pty.write(ptyId, data);
    });

    window.api.pty.resize(ptyId, terminal.cols, terminal.rows);

    terminal.onResize(({ cols, rows }) => {
      window.api.pty.resize(ptyId, cols, rows);
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    cleanupRef.current = () => {
      removeDataListener();
      removeExitListener();
    };

    const observer = new ResizeObserver(debouncedFit);
    observer.observe(containerRef.current);

    return () => {
      if (fitTimerRef.current) cancelAnimationFrame(fitTimerRef.current);
      observer.disconnect();
      cleanupRef.current?.();
      terminal.dispose();
    };
  }, [ptyId]);

  useEffect(() => {
    if (isFocused && terminalRef.current) {
      terminalRef.current.scrollToBottom();
      terminalRef.current.focus();
    }
  }, [isFocused]);

  useEffect(() => {
    if (isVisible) debouncedFit();
  }, [isVisible]);

  const handleClick = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollToBottom();
      terminalRef.current.focus();
    }
    onFocus();
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
});
