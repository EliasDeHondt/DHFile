import { ChildProcess, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class PsHost {
  private child: ChildProcess | null = null;
  private starting: Promise<boolean> | null = null;
  private failures = 0;
  private seq = 1;
  private buffer = '';
  private pending = new Map<number, (answer: string | null) => void>();
  ready = false;

  constructor(private file: string, private script: string) {}

  private finishAll() { for (const done of this.pending.values()) done(null); this.pending.clear(); }

  start(): Promise<boolean> {
    if (process.platform !== 'win32' || this.failures >= 3) return Promise.resolve(false);
    if (this.starting) return this.starting;
    this.starting = new Promise<boolean>(resolve => {
      try {
        const file = join(tmpdir(), this.file);
        writeFileSync(file, this.script, 'utf8');
        const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-STA', '-File', file], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
        this.child = p;
        let isReady = false;
        const giveUp = setTimeout(() => { if (!isReady) { this.failures++; p.kill(); resolve(false); } }, 20000);
        p.stdout!.setEncoding('ascii');
        p.stdout!.on('data', (chunk: string) => {
          this.buffer += chunk;
          let nl: number;
          while ((nl = this.buffer.indexOf('\n')) >= 0) {
            const line = this.buffer.slice(0, nl).replace(/\r$/, '');
            this.buffer = this.buffer.slice(nl + 1);
            if (!isReady) { if (line === 'ready') { isReady = true; this.ready = true; clearTimeout(giveUp); resolve(true); } continue; }
            const tab = line.indexOf('\t');
            const id = Number(line.slice(0, tab));
            const done = this.pending.get(id);
            if (done) { this.pending.delete(id); done(line.slice(tab + 1)); }
          }
        });
        p.on('error', () => { this.failures++; clearTimeout(giveUp); resolve(false); });
        p.on('exit', () => {
          this.child = null; this.starting = null; this.ready = false; this.buffer = ''; this.finishAll();
          if (!isReady) { this.failures++; clearTimeout(giveUp); resolve(false); }
        });
        p.stdin!.on('error', () => {});
      } catch { this.failures++; resolve(false); }
    });
    return this.starting;
  }

  stop() { this.child?.kill(); this.child = null; }

  async ask(fields: string[], timeout = 8000): Promise<string | null> {
    if (!(await this.start()) || !this.child?.stdin) return null;
    const id = this.seq++;
    return new Promise<string | null>(resolve => {
      const timer = setTimeout(() => { this.pending.delete(id); resolve(null); }, timeout);
      this.pending.set(id, a => { clearTimeout(timer); resolve(a); });
      this.child!.stdin!.write(`${id}\t${fields.join('\t')}\n`);
    });
  }
}

export const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
