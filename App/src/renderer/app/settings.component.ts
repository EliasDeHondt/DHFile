import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Settings, SIDE_SECTIONS, SideSection } from '../../shared/types';
import { bridge } from './bridge';
import { t, TextKey, TPipe } from './i18n';
import { IconComponent } from './icon.component';
import { LockService } from './lock.service';
import { StateService } from './state.service';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  state = inject(StateService);
  lock = inject(LockService);
  s = this.state.settings;
  section = this.state.settingsSection;
  lockTimes = [5, 10, 15, 30, 60, 120, 240, 480].map(value => ({ value, n: value < 60 ? value : value / 60, label: (value < 60 ? 'common.minutes' : value === 60 ? 'common.hour' : 'common.hours') as TextKey }));
  defaultBusy = signal(false);
  defaultActual = signal<boolean | null>(null);

  constructor() { bridge.isDefaultFolderApp().then(v => this.defaultActual.set(v)); }

  go(section: string) { this.section.set(section); }
  sections = SIDE_SECTIONS;
  toggleSection(id: SideSection, show: boolean) { const rest = this.s().hiddenSections.filter(x => x !== id); this.set('hiddenSections', show ? rest : [...rest, id]); }
  set<K extends keyof Settings>(key: K, value: Settings[K]) { this.state.saveSettings({ [key]: value } as Partial<Settings>); }
  num(key: 'autoLockMinutes', value: string) { const n = Number(value); if (Number.isFinite(n)) this.set(key, n); }

  async pickStart() { const p = await bridge.pickFolder(); if (p) this.state.saveSettings({ startup: 'custom', startupPath: p }); }

  async setDefault(on: boolean) {
    this.defaultBusy.set(true);
    const r = await bridge.setDefaultFolderApp(on);
    this.defaultBusy.set(false);
    if (!r.ok) { this.state.toast(r.error === 'dev' ? t('gen.defaultDev') : t('gen.defaultFailed'), 'error'); this.defaultActual.set(await bridge.isDefaultFolderApp()); return; }
    this.set('defaultFolderApp', on);
    this.defaultActual.set(on);
    this.state.toast(t(on ? 'gen.defaultOn' : 'gen.defaultOff'));
  }

  openJson() { bridge.openSettingsFile(); }
  openSite() { bridge.openLink('https://eliasdh.com'); }
}
