import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron';

const INVOKE = ['app:info', 'settings:get', 'settings:set', 'settings:open-file', 'fs:list', 'fs:peek', 'fs:drives', 'fs:network', 'fs:resolve', 'fs:mkdir', 'fs:newfile', 'fs:rename', 'fs:trash', 'fs:delete', 'fs:transfer', 'fs:props', 'fs:readonly', 'fs:preview', 'shell:open', 'shell:shortcut', 'shell:apps', 'shell:open-app', 'clip:read-files', 'sys:default-app', 'sys:default-app-status', 'folder:pick', 'lock:status', 'lock:setup', 'lock:unlock', 'lock:verify', 'lock:change'];
const SEND = ['fs:watch', 'fs:search', 'fs:search-cancel', 'props:cancel', 'shell:open-with', 'shell:terminal', 'shell:vscode', 'shell:explorer', 'shell:recycle', 'clip:write-files', 'clip:write-text', 'drag:start', 'link:open', 'window:new', 'window:close', 'window:chrome', 'lock:lock', 'lock:activity'];
const EVENTS = ['fs:changed', 'search:results', 'props:update', 'settings:changed', 'theme:system', 'window:fullscreen', 'lock:changed'];

contextBridge.exposeInMainWorld('dhfile', {
  invoke: (channel: string, ...args: unknown[]) => INVOKE.includes(channel) ? ipcRenderer.invoke(channel, ...args) : Promise.reject(new Error('blocked channel ' + channel)),
  send: (channel: string, ...args: unknown[]) => { if (SEND.includes(channel)) ipcRenderer.send(channel, ...args); },
  on: (channel: string, listener: (payload: any) => void) => {
    if (!EVENTS.includes(channel)) return () => {};
    const fn = (_e: IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on(channel, fn);
    return () => ipcRenderer.removeListener(channel, fn);
  },
  pathForFile: (file: File) => { try { return webUtils.getPathForFile(file); } catch { return ''; } },
});
