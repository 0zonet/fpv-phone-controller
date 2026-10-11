using System;
using System.Diagnostics;

static class DesktopConfiguration {
    public const string VJOY_DOWNLOAD_URL = "https://www.vjoy.org/download-for-windows";
}

static class ExternalLinks {
    public static void OpenVJoy(Action<ProcessStartInfo> launch) {
        launch(new ProcessStartInfo(DesktopConfiguration.VJOY_DOWNLOAD_URL) { UseShellExecute = true });
    }
}
