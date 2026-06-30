Add-Type -AssemblyName System.Drawing
$exe = 'release\win-unpacked\Soul Sanctuary.exe'
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exe)
$stream = [System.IO.File]::OpenWrite('release\unpacked-icon.png')
$icon.ToBitmap().Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$stream.Close()
Write-Host 'saved release\unpacked-icon.png'
