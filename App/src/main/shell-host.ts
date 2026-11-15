import { b64, PsHost } from './ps-host';
import { OpenWithApp } from '../shared/types';

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public static class DhShell {
  [ComImport, Guid("F04061AC-1659-4a3f-A954-775AA57FC083"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAssocHandler {
    [PreserveSig] int GetName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    [PreserveSig] int GetUIName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    [PreserveSig] int GetIconLocation([MarshalAs(UnmanagedType.LPWStr)] out string path, out int index);
    [PreserveSig] int IsRecommended();
    [PreserveSig] int MakeDefault([MarshalAs(UnmanagedType.LPWStr)] string description);
    [PreserveSig] int Invoke(IntPtr dataObject);
  }
  [ComImport, Guid("973810ae-9599-4b88-9e4d-6ee98c9552da"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IEnumAssocHandlers { [PreserveSig] int Next(int count, [MarshalAs(UnmanagedType.Interface)] out IAssocHandler handler, out int fetched); }
  [ComImport, Guid("b63ea76d-1f85-456f-a19c-48159efa858b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemArray { [PreserveSig] int BindToHandler(IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid bhid, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, out IntPtr ppv); }

  [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int SHAssocEnumHandlers(string ext, int filter, out IEnumAssocHandlers handlers);
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int SHParseDisplayName(string name, IntPtr pbc, out IntPtr pidl, uint sfgaoIn, out uint sfgaoOut);
  [DllImport("shell32.dll")] static extern int SHCreateShellItemArrayFromIDLists(uint count, IntPtr[] pidls, out IShellItemArray items);
  [DllImport("shell32.dll")] static extern int SHDoDragDrop(IntPtr hwnd, IntPtr data, IntPtr source, uint effects, out uint effect);
  [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)] static extern int AssocQueryString(int flags, int str, string assoc, string extra, StringBuilder outp, ref int len);
  [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)] static extern int SHLoadIndirectString(string source, StringBuilder outp, int size, IntPtr reserved);
  [DllImport("ole32.dll")] static extern int OleInitialize(IntPtr reserved);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, IntPtr pid);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint from, uint to, bool attach);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT pt);
  [DllImport("user32.dll")] static extern bool ScreenToClient(IntPtr hwnd, ref POINT pt);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern bool GetGUIThreadInfo(uint thread, ref GUITHREADINFO info);
  [StructLayout(LayoutKind.Sequential)] struct POINT { public int x; public int y; }
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int l, t, r, b; }
  [StructLayout(LayoutKind.Sequential)] struct GUITHREADINFO { public int cbSize; public int flags; public IntPtr hwndActive, hwndFocus, hwndCapture, hwndMenuOwner, hwndMoveSize, hwndCaret; public RECT rcCaret; }

  static readonly Guid BHID_DataObject = new Guid("B8C0BD9F-ED24-455C-83E6-D5390C4FE8C4");
  static readonly Guid IID_IDataObject = new Guid("0000010e-0000-0000-C000-000000000046");
  static bool ole;

  static void Ole() { if (!ole) { OleInitialize(IntPtr.Zero); ole = true; } }

  static IntPtr DataObject(string[] paths) {
    var pidls = new IntPtr[paths.Length];
    try {
      for (int i = 0; i < paths.Length; i++) {
        uint attrs;
        int hr = SHParseDisplayName(paths[i], IntPtr.Zero, out pidls[i], 0, out attrs);
        if (hr != 0) Marshal.ThrowExceptionForHR(hr);
      }
      IShellItemArray items;
      int hr2 = SHCreateShellItemArrayFromIDLists((uint)pidls.Length, pidls, out items);
      if (hr2 != 0) Marshal.ThrowExceptionForHR(hr2);
      IntPtr data;
      int hr3 = items.BindToHandler(IntPtr.Zero, BHID_DataObject, IID_IDataObject, out data);
      Marshal.ReleaseComObject(items);
      if (hr3 != 0) Marshal.ThrowExceptionForHR(hr3);
      return data;
    } finally { foreach (var p in pidls) if (p != IntPtr.Zero) Marshal.FreeCoTaskMem(p); }
  }

  public static string Drag(long hwnd, string[] paths) {
    Ole();
    IntPtr data = DataObject(paths);
    uint me = GetCurrentThreadId(), ui = GetWindowThreadProcessId(new IntPtr(hwnd), IntPtr.Zero);
    bool attached = ui != 0 && ui != me && AttachThreadInput(me, ui, true);
    bool dragging = true;
    var nudger = new System.Threading.Thread(() => {
      int button = GetSystemMetrics(23) != 0 ? 2 : 1;
      while (dragging) {
        System.Threading.Thread.Sleep(40);
        if (!dragging || (GetAsyncKeyState(button) & 0x8000) != 0) continue;
        var info = new GUITHREADINFO(); info.cbSize = Marshal.SizeOf(info);
        if (!GetGUIThreadInfo(me, ref info) || info.hwndCapture == IntPtr.Zero) continue;
        POINT pt; GetCursorPos(out pt); ScreenToClient(info.hwndCapture, ref pt);
        PostMessage(info.hwndCapture, 0x200, IntPtr.Zero, new IntPtr((pt.y << 16) | (pt.x & 0xffff)));
      }
    });
    nudger.IsBackground = true;
    nudger.Start();
    try {
      uint effect;
      int hr = SHDoDragDrop(IntPtr.Zero, data, IntPtr.Zero, 7, out effect);
      return hr < 0 ? "" : "ok:" + effect;
    } finally {
      dragging = false;
      if (attached) AttachThreadInput(me, ui, false);
      Marshal.Release(data);
    }
  }


  static List<IAssocHandler> Handlers(string ext, int filter) {
    var list = new List<IAssocHandler>();
    IEnumAssocHandlers e;
    if (SHAssocEnumHandlers(ext, filter, out e) != 0 || e == null) return list;
    IAssocHandler h; int n;
    while (e.Next(1, out h, out n) == 0 && n == 1 && h != null) list.Add(h);
    Marshal.ReleaseComObject(e);
    return list;
  }

  static string Query(string ext, int what) {
    var sb = new StringBuilder(1024); int len = sb.Capacity;
    return AssocQueryString(0x400, what, ext, null, sb, ref len) == 0 ? sb.ToString() : "";
  }

  static string Json(string s) {
    var b = new StringBuilder("\"");
    foreach (char c in s ?? "") {
      if (c == '"' || c == '\\') b.Append('\\').Append(c);
      else if (c < 32) b.Append("\\u").Append(((int)c).ToString("x4"));
      else b.Append(c);
    }
    return b.Append('"').ToString();
  }

  static string PackagedIcon(string location, int size) {
    if (!location.StartsWith("@{")) return "";
    var sb = new StringBuilder(1024);
    if (SHLoadIndirectString(location, sb, sb.Capacity, IntPtr.Zero) != 0) return "";
    string file = sb.ToString();
    if (!File.Exists(file)) return "";
    using (var src = Image.FromFile(file)) {
      double k = Math.Min(1.0, (double)size / Math.Max(src.Width, src.Height));
      int w = Math.Max(1, (int)Math.Round(src.Width * k)), h = Math.Max(1, (int)Math.Round(src.Height * k));
      using (var dst = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        using (var g = Graphics.FromImage(dst)) { g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = PixelOffsetMode.HighQuality; g.DrawImage(src, 0, 0, w, h); }
        using (var ms = new MemoryStream()) { dst.Save(ms, ImageFormat.Png); return Convert.ToBase64String(ms.ToArray()); }
      }
    }
  }

  public static string Apps(string path, int size) {
    string ext = Path.GetExtension(path);
    var rows = new List<string>();
    if (ext.Length > 1) {
      string def = Query(ext, 4);
      var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      foreach (var h in Handlers(ext, 1)) {
        try {
          string name, label, icon; int index;
          if (h.GetName(out name) != 0 || h.GetUIName(out label) != 0) continue;
          if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(label) || label == "Windows.System.Launcher" || !seen.Add(label)) continue;
          if (h.GetIconLocation(out icon, out index) != 0) icon = "";
          string img = "";
          try { img = PackagedIcon(icon ?? "", size); } catch {}
          string file = !string.IsNullOrEmpty(icon) && !icon.StartsWith("@") && File.Exists(icon) ? icon : File.Exists(name) ? name : "";
          bool isDefault = def.Length > 0 && string.Equals(label, def, StringComparison.OrdinalIgnoreCase);
          string row = "{\"id\":" + Json(name) + ",\"label\":" + Json(label) + ",\"icon\":" + Json(img.Length > 0 ? "" : file) + ",\"img\":" + Json(img) + ",\"isDefault\":" + (isDefault ? "true" : "false") + "}";
          if (isDefault) rows.Insert(0, row); else rows.Add(row);
        } finally { Marshal.ReleaseComObject(h); }
      }
    }
    return Convert.ToBase64String(Encoding.UTF8.GetBytes("[" + string.Join(",", rows) + "]"));
  }

  public static string Invoke(string path, string id) {
    Ole();
    string ext = Path.GetExtension(path);
    if (ext.Length < 2) return "";
    IAssocHandler match = null;
    foreach (int filter in new[] { 1, 0 }) {
      foreach (var h in Handlers(ext, filter)) {
        string name;
        if (match == null && h.GetName(out name) == 0 && string.Equals(name, id, StringComparison.OrdinalIgnoreCase)) match = h;
        else Marshal.ReleaseComObject(h);
      }
      if (match != null) break;
    }
    if (match == null) return "";
    IntPtr data = DataObject(new[] { path });
    try { return match.Invoke(data) >= 0 ? "ok" : ""; }
    finally { Marshal.Release(data); Marshal.ReleaseComObject(match); }
  }
}
'@
[Console]::Out.WriteLine('ready')
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $parts = $line.Split([char]9)
  if ($parts.Length -lt 3) { continue }
  $out = ''
  try {
    $a = @($parts | Select-Object -Skip 2 | ForEach-Object { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) })
    switch ($parts[1]) {
      'apps' { $out = [DhShell]::Apps($a[0], [int]$a[1]) }
      'invoke' { $out = [DhShell]::Invoke($a[0], $a[1]) }
      'drag' { $out = [DhShell]::Drag([long]$a[0], $a[1].Split([char]10)) }
    }
  } catch { $out = '' }
  [Console]::Out.WriteLine($parts[0] + [char]9 + $out)
  [Console]::Out.Flush()
}
`;

const host = new PsHost('dhfile-shell-v1.ps1', SCRIPT);
const appCache = new Map<string, { at: number; apps: OpenWithApp[] }>();

export function warmShell() { host.start(); }
export function stopShell() { host.stop(); }
export const shellReady = () => host.ready;

export async function openWithApps(path: string, ext: string, size: number): Promise<OpenWithApp[]> {
  const key = `${ext.toLowerCase()}|${size}`;
  const hit = appCache.get(key);
  if (hit && Date.now() - hit.at < 120_000) return hit.apps;
  const answer = await host.ask(['apps', b64(path), b64(String(size))], 15000);
  if (answer === null) return [];
  try {
    const apps = JSON.parse(Buffer.from(answer, 'base64').toString('utf8')) as OpenWithApp[];
    appCache.set(key, { at: Date.now(), apps });
    return apps;
  } catch { return []; }
}

export async function openWithApp(path: string, id: string): Promise<boolean> {
  return (await host.ask(['invoke', b64(path), b64(id)], 30000)) === 'ok';
}

export async function shellDrag(hwnd: Buffer, paths: string[]): Promise<boolean> {
  if (!host.ready) { host.start(); return false; }
  const handle = hwnd.length >= 8 ? hwnd.readBigUInt64LE(0) : BigInt(hwnd.readUInt32LE(0));
  const answer = await host.ask(['drag', b64(handle.toString()), b64(paths.join('\n'))], 600_000);
  return !!answer?.startsWith('ok');
}
