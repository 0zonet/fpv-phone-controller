$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskProject = Split-Path $PSScriptRoot -Parent
$taskIcons = Join-Path $taskProject 'phone/public/icons'
New-Item -ItemType Directory -Path $taskIcons -Force | Out-Null
foreach ($taskSize in @(72,96,128,144,152,192,256,384,512)) {
    $taskBitmap = New-Object System.Drawing.Bitmap($taskSize, $taskSize)
    $taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
    $taskGraphics.SmoothingMode = 'AntiAlias'
    $taskGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#08121c'))
    $taskPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#4ce3b2'), ($taskSize * 0.018))
    $taskBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#4ce3b2'))
    foreach ($taskCenter in @(0.32,0.68)) {
        $taskGraphics.DrawEllipse($taskPen, [single]($taskSize * ($taskCenter - 0.13)), [single]($taskSize * 0.37), [single]($taskSize * 0.26), [single]($taskSize * 0.26))
        $taskGraphics.FillEllipse($taskBrush, [single]($taskSize * ($taskCenter - 0.045)), [single]($taskSize * 0.455), [single]($taskSize * 0.09), [single]($taskSize * 0.09))
    }
    $taskBitmap.Save((Join-Path $taskIcons "icon-${taskSize}x${taskSize}.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $taskBrush.Dispose(); $taskPen.Dispose(); $taskGraphics.Dispose(); $taskBitmap.Dispose()
}
$taskPng = [System.IO.File]::ReadAllBytes((Join-Path $taskIcons 'icon-256x256.png'))
$taskIconPath = Join-Path $taskProject 'desktop/windows/app.ico'
$taskStream = [System.IO.File]::Create($taskIconPath)
$taskWriter = New-Object System.IO.BinaryWriter($taskStream)
$taskWriter.Write([uint16]0); $taskWriter.Write([uint16]1); $taskWriter.Write([uint16]1)
$taskWriter.Write([byte]0); $taskWriter.Write([byte]0); $taskWriter.Write([byte]0); $taskWriter.Write([byte]0)
$taskWriter.Write([uint16]1); $taskWriter.Write([uint16]32)
$taskWriter.Write([uint32]$taskPng.Length); $taskWriter.Write([uint32]22); $taskWriter.Write($taskPng)
$taskWriter.Dispose(); $taskStream.Dispose()
