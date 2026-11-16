/**
    * @author Group DH Team
    * @see https://group-dh.com
    * @since 16/11/2026
**/

import { b64, PsHost } from './ps-host';

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class DhIcons {
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
  [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx; public int cy; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct SHFILEINFO { public IntPtr hIcon; public int iIcon; public uint dwAttributes; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szDisplayName; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string szTypeName; }

  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory factory);
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  static extern IntPtr SHGetFileInfo(string path, uint attrs, ref SHFILEINFO info, uint size, uint flags);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);

  const uint SHGFI_SYSICONINDEX = 0x4000, SHGFI_USEFILEATTRIBUTES = 0x10, FILE_ATTRIBUTE_NORMAL = 0x80;
  const int SIIGBF_ICONONLY = 0x4;
  static int generic = -2;

  static int IndexOf(string ext) {
    var info = new SHFILEINFO();
    SHGetFileInfo("x" + ext, FILE_ATTRIBUTE_NORMAL, ref info, (uint)Marshal.SizeOf(info), SHGFI_SYSICONINDEX | SHGFI_USEFILEATTRIBUTES);
    return info.iIcon;
  }

  public static bool IsGeneric(string ext) {
    if (generic == -2) generic = IndexOf(".dhfile-no-such-type");
    return IndexOf(ext) == generic;
  }

  public static string Png(string path, int size) {
    IShellItemImageFactory factory;
    SHCreateItemFromParsingName(path, IntPtr.Zero, typeof(IShellItemImageFactory).GUID, out factory);
    IntPtr hbm;
    int hr = factory.GetImage(new SIZE { cx = size, cy = size }, SIIGBF_ICONONLY, out hbm);
    Marshal.ReleaseComObject(factory);
    if (hr != 0 || hbm == IntPtr.Zero) return "";
    try {
      using (var src = Image.FromHbitmap(hbm)) {
        int w = src.Width, h = src.Height;
        using (var dst = new Bitmap(w, h, PixelFormat.Format32bppPArgb)) {
          var a = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, src.PixelFormat);
          var b = dst.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppPArgb);
          var row = new byte[w * 4];
          bool anyAlpha = false;
          for (int y = 0; y < h; y++) {
            Marshal.Copy(IntPtr.Add(a.Scan0, y * a.Stride), row, 0, row.Length);
            for (int i = 3; i < row.Length && !anyAlpha; i += 4) if (row[i] != 0) anyAlpha = true;
            Marshal.Copy(row, 0, IntPtr.Add(b.Scan0, y * b.Stride), row.Length);
          }
          src.UnlockBits(a); dst.UnlockBits(b);
          using (var ms = new MemoryStream()) {
            if (anyAlpha) dst.Save(ms, ImageFormat.Png); else src.Save(ms, ImageFormat.Png);
            return Convert.ToBase64String(ms.ToArray());
          }
        }
      }
    } finally { DeleteObject(hbm); }
  }
}
'@
[Console]::Out.WriteLine('ready')
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $parts = $line.Split([char]9)
  if ($parts.Length -lt 4) { continue }
  $out = ''
  try {
    $path = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($parts[3]))
    if ($parts[2] -eq '1' -and [DhIcons]::IsGeneric([IO.Path]::GetExtension($path))) { $out = 'generic' }
    else { $out = [DhIcons]::Png($path, [int]$parts[1]) }
  } catch { $out = '' }
  [Console]::Out.WriteLine($parts[0] + [char]9 + $out)
  [Console]::Out.Flush()
}
`;

const host = new PsHost('dhfile-icons-v1.ps1', SCRIPT);

export function warmIcons() { host.start(); }
export function stopIcons() { host.stop(); }

export async function shellIcon(path: string, size: number, byExtension: boolean): Promise<Buffer | 'generic' | null> {
  const answer = await host.ask([String(size), byExtension ? '1' : '0', b64(path)]);
  if (!answer) return null;
  if (answer === 'generic') return 'generic';
  return Buffer.from(answer, 'base64');
}