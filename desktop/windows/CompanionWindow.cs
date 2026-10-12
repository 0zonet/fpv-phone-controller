using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// Native host for the HTML UI in ui/ (docs/design/Desk*.dc.html). It owns the Node backend process,
// forwards every backend stdout line to the page with PostWebMessageAsJson and runs the page's commands.
class CompanionWindow : Form {
    WebView2 view = new WebView2();
    Process backend;
    bool closing = false, pageReady = false, selfTest = false, repairing = false, firewallChecked = false, firewallBusy = false;
    string selectedAddress = "", pairingUrl = "", lastStatus = null, lastFatal = null, repairNote = "";
    int currentPort = 8080;
    List<Dictionary<string, object>> addresses = new List<Dictionary<string, object>>();
    TaskCompletionSource<bool> pageLoaded = new TaskCompletionSource<bool>();
    TaskCompletionSource<Dictionary<string, object>> selfTestReply;
    static readonly string DataFolder = Environment.GetEnvironmentVariable("FPV_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FPVPhoneController");
    static readonly string LogsFolder = Path.Combine(DataFolder, "logs");
    static readonly string PortFile = Path.Combine(DataFolder, "port.txt");
    static readonly string AppFolder = AppDomain.CurrentDomain.BaseDirectory;
    static readonly string EnginePath = Path.GetFullPath(Path.Combine(AppFolder, "runtime", "companion-engine.exe"));
    static readonly string BetaVersion = ((System.Reflection.AssemblyInformationalVersionAttribute)Attribute.GetCustomAttribute(typeof(CompanionWindow).Assembly, typeof(System.Reflection.AssemblyInformationalVersionAttribute))).InformationalVersion;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    const string NetworkSettingsTarget = "ms-settings:network";
    const string WebViewRuntimeUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";

    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    [STAThread] static int Main(string[] args) {
        // System-DPI aware: crisp text, and WebView2 scales the page itself.
        try { SetProcessDpiAwarenessContext(new IntPtr(-2)); } catch (EntryPointNotFoundException) {}
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        if (args.Length > 0 && args[0] == "--self-test") return SelfTest(args.Length > 1 ? args[1] : null);
        // Elevated by the window (one UAC). The program path is always this installation's engine, never an argument.
        if (args.Length > 0 && args[0] == "--firewall-allow") {
            try { return Firewall.AllowOnPrivateNetworks(EnginePath); } catch (Exception e) { TechnicalLog("firewall_allow_error", e.ToString()); return 1; }
        }
        bool created;
        using (var mutex = new Mutex(true, "Local\\FPVPhoneController", out created)) {
            if (!created) { MessageBox.Show("FPV Phone Controller is already running."); return 0; }
            Application.Run(new CompanionWindow(false));
        }
        return 0;
    }

    CompanionWindow(bool test) {
        selfTest = test;
        Text = "FPV Phone Controller"; BackColor = Color.FromArgb(13, 13, 18); StartPosition = FormStartPosition.CenterScreen;
        float scale = 1;
        using (var graphics = CreateGraphics()) scale = graphics.DpiX / 96f;
        ClientSize = new Size((int)(440 * scale), (int)(640 * scale));
        MinimumSize = new Size(Width - ClientSize.Width + (int)(400 * scale), Height - ClientSize.Height + (int)(560 * scale));
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch {}
        view.Dock = DockStyle.Fill; view.DefaultBackgroundColor = BackColor; Controls.Add(view);
        HandleCreated += delegate { ApplyDarkTitleBar(); };
        if (test) { StartPosition = FormStartPosition.Manual; Location = new Point(-4000, -4000); ShowInTaskbar = false; }
        Shown += async delegate { await InitializeView(); if (!selfTest) StartBackend(); };
        FormClosing += delegate { closing = true; StopBackend(); };
    }

    // Native caption painted dark (#0D0D12) instead of a custom title bar.
    void ApplyDarkTitleBar() {
        int on = 1, caption = 0x00120D0D, text = 0x00F6F2F2;
        try {
            DwmSetWindowAttribute(Handle, 20, ref on, 4);
            DwmSetWindowAttribute(Handle, 35, ref caption, 4);
            DwmSetWindowAttribute(Handle, 36, ref text, 4);
        } catch (Exception e) { TechnicalLog("titlebar_error", e.Message); }
    }

    async Task InitializeView() {
        try {
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(DataFolder, "WebView2"));
            await view.EnsureCoreWebView2Async(environment);
            var web = view.CoreWebView2;
            bool devTools = Environment.GetEnvironmentVariable("FPV_DEVTOOLS") == "1";
            web.Settings.AreDevToolsEnabled = devTools; web.Settings.AreDefaultContextMenusEnabled = devTools;
            web.Settings.IsZoomControlEnabled = false; web.Settings.IsStatusBarEnabled = false;
            web.Settings.AreBrowserAcceleratorKeysEnabled = devTools; web.Settings.IsGeneralAutofillEnabled = false;
            web.SetVirtualHostNameToFolderMapping("app.fpv", Path.Combine(AppFolder, "ui"), CoreWebView2HostResourceAccessKind.DenyCors);
            web.WebMessageReceived += OnWebMessage;
            web.NavigationStarting += delegate (object sender, CoreWebView2NavigationStartingEventArgs e) {
                if (!e.Uri.StartsWith("https://app.fpv/")) { e.Cancel = true; Open(e.Uri); }
            };
            web.NewWindowRequested += delegate (object sender, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; Open(e.Uri); };
            web.ProcessFailed += delegate (object sender, CoreWebView2ProcessFailedEventArgs e) {
                TechnicalLog("webview_process_failed", e.ProcessFailedKind.ToString());
                if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited || e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessUnresponsive) { pageReady = false; web.Reload(); }
            };
            web.Navigate("https://app.fpv/index.html");
        } catch (Exception e) {
            TechnicalLog("webview_error", e.ToString());
            ShowFallback();
            pageLoaded.TrySetResult(false);
        }
    }

    // Without the WebView2 Runtime (part of Windows 11) the window cannot draw its UI.
    void ShowFallback() {
        Controls.Remove(view);
        var panel = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, Padding = new Padding(24), BackColor = BackColor };
        panel.Controls.Add(new Label { AutoSize = true, MaximumSize = new Size(ClientSize.Width - 48, 0), ForeColor = Color.FromArgb(242, 242, 246), Font = new Font("Segoe UI", 11),
            Text = "This window needs the Microsoft Edge WebView2 Runtime, which is part of Windows 11. Install it, then open FPV Phone Controller again." });
        var install = new Button { Text = "Get WebView2 Runtime", AutoSize = true, ForeColor = Color.FromArgb(18, 18, 22), BackColor = Color.FromArgb(242, 242, 246), FlatStyle = FlatStyle.Flat };
        install.Click += delegate { Open(WebViewRuntimeUrl); };
        panel.Controls.Add(install); Controls.Add(panel);
    }

    void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e) {
        Dictionary<string, object> message;
        try { message = Json.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson); } catch { return; }
        object value; string command = message.TryGetValue("cmd", out value) ? value as string : null;
        if (command == null) return;
        if (command != "selftest-result") TechnicalLog("ui_command", command);
        switch (command) {
            case "ready":
                pageReady = true;
                PostHost(new Dictionary<string, object> { { "version", BetaVersion }, { "repairing", repairing }, { "repairNote", repairNote }, { "backendStopped", backend == null && !selfTest && lastStatus == null } });
                if (lastStatus != null) Post(lastStatus);
                if (lastFatal != null) Post(lastFatal);
                pageLoaded.TrySetResult(true);
                break;
            case "copy-link": CopyText(pairingUrl, "Link copied"); break;
            case "copy-endpoint": CopyText(SelectedEndpoint(), "Endpoint copied"); break;
            case "new-qr": TechnicalLog("qr_regenerate_requested", "Connection restarted; old QR expires."); Restart(); break;
            case "retry": case "check-again": Restart(); break;
            case "repair": RepairDriver(); break;
            case "use-port": UseAnotherPort(); break;
            case "network-settings": Open(NetworkSettingsTarget); break;
            case "firewall-allow": AllowFirewall(); break;
            case "firewall-settings": Start("control.exe", "firewall.cpl"); break;
            case "disconnect-phone": SendCommand("disconnect-phone"); break;
            case "select-network":
                if (message.TryGetValue("address", out value) && value is string && (string)value != selectedAddress) { selectedAddress = (string)value; Restart(); }
                break;
            case "test-joystick": Start("control.exe", "joy.cpl"); break;
            case "help": Open(Path.Combine(AppFolder, "USER_README.html")); break;
            case "licenses": Open(Path.Combine(AppFolder, "licenses")); break;
            case "open-pwa": OpenPwa(); break;
            case "local-preview": OpenLocalPreview(); break;
            case "open-logs":
                try { Directory.CreateDirectory(LogsFolder); Open(LogsFolder); }
                catch (Exception error) { TechnicalLog("logs_folder_error", error.ToString()); Toast("Cannot open the logs folder"); }
                break;
            case "selftest-result":
                if (selfTestReply != null && message.TryGetValue("result", out value)) selfTestReply.TrySetResult(value as Dictionary<string, object>);
                break;
        }
    }

    void Post(string json) {
        if (closing || !pageReady || view.CoreWebView2 == null) return;
        try { view.CoreWebView2.PostWebMessageAsJson(json); } catch (Exception e) { TechnicalLog("post_error", e.Message); }
    }
    void PostHost(Dictionary<string, object> values) { values["type"] = "host"; Post(Json.Serialize(values)); }
    void Toast(string text) { PostHost(new Dictionary<string, object> { { "toast", text } }); }

    // One backend stdout line. Status lines are kept so a reloaded page can be brought up to date.
    void ApplyLine(string line) {
        Dictionary<string, object> message;
        try { message = Json.Deserialize<Dictionary<string, object>>(line); }
        catch (Exception e) { TechnicalLog("status_error", e.Message); return; }
        object type; if (!message.TryGetValue("type", out type)) return;
        if ((string)type == "status") {
            lastStatus = line; lastFatal = null;
            object value;
            pairingUrl = message.TryGetValue("pairingUrl", out value) ? value as string ?? "" : "";
            if (message.TryGetValue("selectedAddress", out value) && value is string && (string)value != "") selectedAddress = (string)value;
            if (message.TryGetValue("port", out value)) currentPort = Convert.ToInt32(value);
            addresses.Clear();
            if (message.TryGetValue("addresses", out value) && value is System.Collections.IEnumerable)
                foreach (object entry in (System.Collections.IEnumerable)value) { var item = entry as Dictionary<string, object>; if (item != null) addresses.Add(item); }
            if (message.TryGetValue("virtualController", out value) && (string)value == "READY") repairNote = "";
            object attempted, issue;
            bool noAttempt = !(message.TryGetValue("phoneAttempted", out attempted) && Convert.ToBoolean(attempted));
            if (noAttempt && message.TryGetValue("issueCode", out issue) && (string)issue == "CONNECTION_HELP" && !firewallChecked) CheckFirewall();
        } else if ((string)type == "fatal") lastFatal = line;
        Post(line);
    }
    string SelectedEndpoint() {
        foreach (var item in addresses) { object address; if (item.TryGetValue("address", out address) && (string)address == selectedAddress) return item["endpoint"] as string ?? ""; }
        return "";
    }
    void CopyText(string text, string done) {
        if (String.IsNullOrEmpty(text)) return;
        try { Clipboard.SetText(text); Toast(done); } catch (Exception e) { TechnicalLog("clipboard_error", e.Message); Toast("Could not copy. Try again."); }
    }
    void OpenPwa() {
        object url = null; var status = lastStatus == null ? null : Json.Deserialize<Dictionary<string, object>>(lastStatus);
        if (status != null && status.TryGetValue("pwaUrl", out url) && !String.IsNullOrEmpty(url as string)) Open((string)url);
        else Toast("The public controller page is not configured in this preview");
    }
    void OpenLocalPreview() {
        object url = null; var status = lastStatus == null ? null : Json.Deserialize<Dictionary<string, object>>(lastStatus);
        if (status != null && status.TryGetValue("localWebUrl", out url) && !String.IsNullOrEmpty(url as string)) Open((string)url);
    }

    static void Start(string file, string arguments) {
        try { Process.Start(file, arguments); } catch (Exception e) { TechnicalLog("open_error", e.ToString()); }
    }
    void Open(string target) {
        try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }
        catch (Exception e) { TechnicalLog("open_error", e.ToString()); Toast("Cannot open this item. Check the installation or open the logs folder."); }
    }
    static string Quote(string value) { return "\"" + value + "\""; }

    ProcessStartInfo RepairStartInfo() {
        return new ProcessStartInfo(Path.Combine(AppFolder, "runtime", "companion-engine.exe"),
            Quote(Path.Combine(AppFolder, "vjoy-setup.cjs")) + " --repair --install always --state-dir " + Quote(DataFolder)) {
            UseShellExecute = true, Verb = "runas", WindowStyle = ProcessWindowStyle.Hidden, WorkingDirectory = AppFolder };
    }
    void RepairDriver() {
        if (repairing) return;
        repairing = true; repairNote = "";
        PostHost(new Dictionary<string, object> { { "repairing", true }, { "repairNote", "" } });
        StopBackend();
        var info = RepairStartInfo();
        var worker = new Thread(delegate () {
            int code = -1; bool cancelled = false;
            try { using (var process = Process.Start(info)) { process.WaitForExit(); code = process.ExitCode; } }
            catch (System.ComponentModel.Win32Exception e) { cancelled = e.NativeErrorCode == 1223; TechnicalLog("repair_start_error", e.ToString()); }
            catch (Exception e) { TechnicalLog("repair_start_error", e.ToString()); }
            Dispatch(delegate { FinishRepair(code, cancelled); Restart(); });
        });
        worker.IsBackground = true; worker.Start();
    }
    // Exit codes match SetupExit in desktop/src/drivers/vjoy/vjoy-setup.ts.
    void FinishRepair(int code, bool cancelled) {
        repairing = false;
        TechnicalLog("repair_finished", "exit=" + code + " cancelled=" + cancelled);
        repairNote = cancelled ? "Repair was cancelled. Click Repair driver to try again."
            : code == 0 ? ""
            : code == 22 ? "All 16 vJoy devices are in use by other apps. Remove one you no longer need, then click Repair driver."
            : code == 21 ? "The virtual controller could not be configured. Restart Windows, then click Repair driver again."
            : "The driver could not be repaired. Restart Windows and try again, or open the logs folder.";
        PostHost(new Dictionary<string, object> { { "repairing", false }, { "repairNote", repairNote } });
    }

    // Firewall heuristic input: read on a worker thread (COM enumeration can take a moment), then sent to the page.
    void CheckFirewall() {
        firewallChecked = true;
        string address = selectedAddress;
        var worker = new Thread(delegate () {
            var status = Firewall.Check(EnginePath, address);
            TechnicalLog("firewall_check", "block=" + status.BlockRule + " public=" + status.PublicNetwork + " allow=" + status.AllowRule + (status.Error != null ? " error=" + status.Error : ""));
            Dispatch(delegate { PostHost(new Dictionary<string, object> { { "firewall", FirewallValue(status) } }); });
        });
        worker.IsBackground = true; worker.Start();
    }
    static Dictionary<string, object> FirewallValue(Firewall.Status status) {
        return new Dictionary<string, object> { { "blockRule", status.BlockRule }, { "publicNetwork", status.PublicNetwork }, { "allowRule", status.AllowRule }, { "error", status.Error } };
    }
    ProcessStartInfo FirewallStartInfo() {
        return new ProcessStartInfo(Application.ExecutablePath, "--firewall-allow") { UseShellExecute = true, Verb = "runas", WindowStyle = ProcessWindowStyle.Hidden, WorkingDirectory = AppFolder };
    }
    // D5: on demand only, one UAC, scoped rule (this program, TCP, Private profile, local subnet).
    void AllowFirewall() {
        if (firewallBusy) return;
        firewallBusy = true; PostHost(new Dictionary<string, object> { { "firewallBusy", true } });
        var info = FirewallStartInfo(); string address = selectedAddress;
        var worker = new Thread(delegate () {
            int code = -1; bool cancelled = false;
            try { using (var process = Process.Start(info)) { process.WaitForExit(); code = process.ExitCode; } }
            catch (System.ComponentModel.Win32Exception e) { cancelled = e.NativeErrorCode == 1223; TechnicalLog("firewall_start_error", e.ToString()); }
            catch (Exception e) { TechnicalLog("firewall_start_error", e.ToString()); }
            var status = Firewall.Check(EnginePath, address);
            TechnicalLog("firewall_allow_finished", "exit=" + code + " cancelled=" + cancelled + " allow=" + status.AllowRule + " block=" + status.BlockRule);
            Dispatch(delegate {
                firewallBusy = false;
                PostHost(new Dictionary<string, object> { { "firewallBusy", false }, { "firewall", FirewallValue(status) },
                    { "toast", cancelled ? "Firewall change cancelled" : code == 0 ? "Allowed on private networks. Scan the QR again." : "Could not change the firewall. Open the logs folder." } });
            });
        });
        worker.IsBackground = true; worker.Start();
    }

    // The chosen port persists; otherwise the next start would go back to 8080 and fail again.
    static int SavedPort() {
        try { int value; if (File.Exists(PortFile) && Int32.TryParse(File.ReadAllText(PortFile).Trim(), out value) && value >= 1024 && value <= 65535) return value; }
        catch (Exception e) { TechnicalLog("port_read_error", e.ToString()); }
        return 0;
    }
    static int FindFreePort(int current) {
        for (int candidate = 8081; candidate <= 8099; candidate++) {
            if (candidate == current) continue;
            try { var listener = new TcpListener(IPAddress.Any, candidate); listener.Start(); listener.Stop(); return candidate; }
            catch (SocketException) {}
        }
        return 0;
    }
    void UseAnotherPort() {
        int next = FindFreePort(currentPort);
        if (next == 0) { Toast("No free port between 8081 and 8099. Close other apps, then try again."); return; }
        try { Directory.CreateDirectory(DataFolder); File.WriteAllText(PortFile, next.ToString()); }
        catch (Exception e) { TechnicalLog("port_save_error", e.ToString()); }
        TechnicalLog("port_changed", currentPort + " -> " + next); Restart();
    }
    void SendCommand(string command) {
        var process = backend;
        try { if (process != null && !process.HasExited) { process.StandardInput.WriteLine(command); process.StandardInput.Flush(); } }
        catch (Exception e) { TechnicalLog("command_error", e.ToString()); }
    }

    static void TechnicalLog(string name, string detail) {
        try { Directory.CreateDirectory(LogsFolder); string file = Path.Combine(LogsFolder, "window.jsonl");
            detail = Regex.Replace(detail, "token=[^\\s&\"]+", "token=[redacted]", RegexOptions.IgnoreCase);
            detail = Regex.Replace(detail, "\\b[a-f0-9]{48}\\b", "[redacted]", RegexOptions.IgnoreCase);
            if (File.Exists(file) && new FileInfo(file).Length > 2097152) File.WriteAllText(file, "");
            File.AppendAllText(file, new JavaScriptSerializer().Serialize(new { time = DateTime.UtcNow.ToString("o"), level = "info", version = BetaVersion, @event = name, detail = detail }) + Environment.NewLine);
        } catch {}
    }

    void Restart() {
        StopBackend(); lastStatus = null; lastFatal = null; pairingUrl = ""; firewallChecked = false;
        PostHost(new Dictionary<string, object> { { "reset", true }, { "backendStopped", false } });
        if (!repairing && !selfTest) StartBackend();
    }
    void StartBackend() {
        var info = new ProcessStartInfo(Path.Combine(AppFolder, "runtime", "companion-engine.exe"), Quote(Path.Combine(AppFolder, "companion.cjs"))) {
            WorkingDirectory = AppFolder, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true
        };
        if (!String.IsNullOrEmpty(selectedAddress)) info.EnvironmentVariables["FPV_BIND_ADDRESS"] = selectedAddress;
        int saved = SavedPort(); if (saved != 0) info.EnvironmentVariables["PORT"] = saved.ToString(); else info.EnvironmentVariables.Remove("PORT");
        info.EnvironmentVariables.Remove("NODE_OPTIONS"); info.EnvironmentVariables.Remove("NODE_PATH");
        var process = new Process { StartInfo = info, EnableRaisingEvents = true }; backend = process;
        process.OutputDataReceived += (sender, e) => { if (e.Data != null) Dispatch(delegate { if (backend == process) ApplyLine(e.Data); }); };
        process.ErrorDataReceived += (sender, e) => { if (e.Data != null) TechnicalLog("backend_stderr", e.Data); };
        process.Exited += delegate { Dispatch(delegate { if (backend == process) PostHost(new Dictionary<string, object> { { "backendStopped", true } }); }); };
        try { process.Start(); process.BeginOutputReadLine(); process.BeginErrorReadLine(); }
        catch (Exception e) {
            TechnicalLog("backend_start_error", e.ToString()); backend = null;
            PostHost(new Dictionary<string, object> { { "backendStopped", true } });
        }
    }
    void Dispatch(Action action) { if (!closing && !IsDisposed && IsHandleCreated) { try { BeginInvoke(action); } catch (InvalidOperationException) {} } }
    void StopBackend() {
        var process = backend; backend = null; if (process == null) return;
        try { if (!process.HasExited) { process.StandardInput.WriteLine("shutdown"); process.StandardInput.Flush();
            if (!process.WaitForExit(4000)) process.Kill(); } } catch (InvalidOperationException) {}
        finally { process.Dispose(); }
    }

    // --self-test [status.json]: loads the real UI off-screen, feeds it status lines and checks what it renders.
    static int SelfTest(string fixture) {
        var window = new CompanionWindow(true);
        int result = 1;
        window.Shown += async delegate {
            var failures = new List<string>();
            try { result = await window.RunSelfTest(fixture, failures) ? 0 : 1; }
            catch (Exception e) { failures.Add(e.ToString()); result = 1; }
            foreach (var failure in failures) Console.Error.WriteLine(failure);
            window.Close();
        };
        var timeout = new System.Windows.Forms.Timer { Interval = 25000 };
        timeout.Tick += delegate { Console.Error.WriteLine("Self-test timed out"); result = 2; window.Close(); };
        timeout.Start();
        Application.Run(window);
        return result;
    }
    async Task<Dictionary<string, object>> Render(string line) {
        selfTestReply = new TaskCompletionSource<Dictionary<string, object>>();
        if (line != null) ApplyLine(line);
        Post("{\"type\":\"selftest\"}");
        return await selfTestReply.Task;
    }
    static List<string> Strings(object value) {
        var list = new List<string>();
        var items = value as System.Collections.IEnumerable;
        if (items != null) foreach (object item in items) list.Add(Convert.ToString(item));
        return list;
    }
    static string Chips(Dictionary<string, object> summary) { return String.Join("|", Strings(summary["chips"])); }
    async Task<bool> RunSelfTest(string fixture, List<string> failures) {
        if (!await pageLoaded.Task) { failures.Add("WebView2 UI did not load"); return false; }
        Action<bool, string> check = (ok, name) => { if (!ok) failures.Add("FAIL " + name); };
        var ready = new Dictionary<string, object> { { "type", "status" }, { "version", BetaVersion }, { "virtualController", "READY" }, { "websocket", "LISTENING" },
            { "phone", "DISCONNECTED" }, { "port", 8080 }, { "message", "" }, { "issueCode", "" }, { "pwaUrl", "" }, { "localWebUrl", "http://192.168.1.1:8080" },
            { "selectedAddress", "192.168.1.1" }, { "pairingUrl", "https://example.invalid/connect?data=x" }, { "qrPngBase64", "" },
            { "addresses", new object[] { new Dictionary<string, object> { { "name", "Wi-Fi" }, { "address", "192.168.1.1" }, { "endpoint", "ws://192.168.1.1:8080/?token=test" } } } } };
        var view = await Render(Json.Serialize(ready));
        check((string)view["screen"] == "qr" && Chips(view) == "Ready|Ready|Waiting", "ready -> QR screen, chips Ready/Ready/Waiting (" + view["screen"] + " " + Chips(view) + ")");
        check(SelectedEndpoint() == "ws://192.168.1.1:8080/?token=test" && pairingUrl.StartsWith("https://"), "copy targets");
        check(((string)view["version"]) == "v" + BetaVersion, "version shown");
        var missing = new Dictionary<string, object>(ready); missing["virtualController"] = "NOT AVAILABLE"; missing["websocket"] = "STOPPED"; missing["issueCode"] = "DRIVER_MISSING";
        view = await Render(Json.Serialize(missing));
        check((string)view["screen"] == "problem-vjoy" && Chips(view) == "Driver needed|Paused|Paused" && ((string)view["primary"]).StartsWith("Repair driver"), "DRIVER_MISSING -> repair screen");
        var elevated = RepairStartInfo();
        check(elevated.Verb == "runas" && elevated.UseShellExecute && elevated.FileName.EndsWith("companion-engine.exe")
            && elevated.Arguments.Contains("vjoy-setup.cjs\" --repair --install always --state-dir \""), "Repair driver runs the bundled setup elevated");
        FinishRepair(-1, true);
        check(repairNote == "Repair was cancelled. Click Repair driver to try again." && !repairing, "cancelled UAC note");
        missing["issueCode"] = "DEVICE_UNAVAILABLE";
        view = await Render(Json.Serialize(missing));
        check((string)view["screen"] == "problem-vjoy" && Chips(view).StartsWith("Not configured|"), "DEVICE_UNAVAILABLE -> repair screen");
        var busy = new Dictionary<string, object>(ready); busy["websocket"] = "STOPPED"; busy["issueCode"] = "PORT_BUSY";
        view = await Render(Json.Serialize(busy));
        check((string)view["screen"] == "problem-port" && ((string)view["primary"]).StartsWith("Use another port") && Chips(view) == "Ready|Port busy|Paused", "PORT_BUSY -> port screen");
        int free = FindFreePort(8080); check(free >= 8081 && free <= 8099, "free port search");
        var offline = new Dictionary<string, object>(ready); offline["websocket"] = "STOPPED"; offline["issueCode"] = "NETWORK_MISSING";
        view = await Render(Json.Serialize(offline));
        check((string)view["screen"] == "problem-network" && ((string)view["primary"]).StartsWith("Open network settings"), "NETWORK_MISSING -> network screen");
        var rejected = new Dictionary<string, object>(ready); rejected["issueCode"] = "PAIRING_REJECTED"; rejected["phoneAttempted"] = true;
        view = await Render(Json.Serialize(rejected));
        check((string)view["screen"] == "problem-pairing" && Chips(view) == "Ready|Ready|Old QR", "PAIRING_REJECTED -> old QR screen");
        var failed = new Dictionary<string, object>(ready); failed["websocket"] = "STOPPED"; failed["virtualController"] = "NOT AVAILABLE"; failed["issueCode"] = "STARTUP_FAILED"; failed["message"] = "Error: at Object.<anonymous> (C:\\x.js:1:1)";
        view = await Render(Json.Serialize(failed));
        check((string)view["screen"] == "problem-startup" && !((string)view["title"]).Contains("Error:"), "STARTUP_FAILED -> generic screen, no raw error");
        view = await Render("{\"type\":\"fatal\",\"message\":\"boom\"}");
        check((string)view["screen"] == "problem-startup", "fatal -> startup screen");
        var connected = new Dictionary<string, object>(ready); connected["phone"] = "CONNECTED";
        await Render(Json.Serialize(connected));
        view = await Render("{\"type\":\"metrics\",\"packetsPerSecond\":60,\"axes\":{\"throttle\":0.5,\"yaw\":0,\"pitch\":0,\"roll\":0},\"failsafe\":false}");
        check((string)view["screen"] == "connected" && Chips(view) == "Ready|Ready|Connected" && Strings(view["buttons"]).Contains("disconnect-phone"), "connected screen with Disconnect phone");
        check(Convert.ToBoolean(view["fonts"]), "bundled fonts load");
        var firewall = Firewall.Check(EnginePath, "");
        check(firewall.Error == null, "firewall rules can be read without admin (" + firewall.Error + ")");
        var allow = FirewallStartInfo();
        check(allow.Verb == "runas" && allow.Arguments == "--firewall-allow" && allow.FileName == Application.ExecutablePath, "Allow on private networks runs this exe elevated");
        var waiting = new Dictionary<string, object>(ready); waiting["issueCode"] = "CONNECTION_HELP"; waiting["phoneAttempted"] = false;
        await Render(Json.Serialize(waiting));
        Post("{\"type\":\"host\",\"firewall\":{\"blockRule\":true,\"publicNetwork\":false,\"allowRule\":false}}");
        view = await Render(null);
        check((string)view["screen"] == "problem-firewall" && ((string)view["primary"]).StartsWith("Allow on private networks"), "block rule + no attempts -> firewall screen");
        if (fixture != null) {
            view = await Render(File.ReadAllText(fixture));
            check((string)view["screen"] == "qr" && Convert.ToBoolean(view["qr"]), "real status renders the QR image");
        }
        return failures.Count == 0;
    }
}
