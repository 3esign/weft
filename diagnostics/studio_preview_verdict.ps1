param($f,$out,$wait=60)
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type @"
using System;using System.Runtime.InteropServices;
public class U{
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint x,uint y,uint d,int e);
 [DllImport("user32.dll")] public static extern IntPtr SetForegroundWindow(IntPtr h);
}
"@
Get-Process bambu-studio -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 4
Start-Process "C:\Program Files\Bambu Studio\bambu-studio.exe" -ArgumentList "`"$f`""
Start-Sleep -Seconds $wait
$p = Get-Process bambu-studio -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if($p){ [U]::SetForegroundWindow($p.MainWindowHandle) | Out-Null }
Start-Sleep -Seconds 2
[U]::SetCursorPos(253,50)
Start-Sleep -Milliseconds 400
[U]::mouse_event(0x02,0,0,0,0); [U]::mouse_event(0x04,0,0,0,0)
Start-Sleep -Seconds 12
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.X, $b.Y, 0, 0, $bmp.Size)
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "saved $out"
