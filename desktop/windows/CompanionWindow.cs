using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;

class CompanionWindow : Form {
    Label driver = new Label(), websocket = new Label(), phone = new Label(), message = new Label(), port = new Label();
    ComboBox addresses = new ComboBox();
    Button copy = new Button(), retry = new Button(), regenerate = new Button(), repair = new Button();
    Button checkAgain = new Button(), usePort = new Button(), networkSettings = new Button(), disconnectPhone = new Button();
    bool driverRequired = false;
    string repairNote = null;
    Label network = new Label(), checks = new Label(), deviceInfo = new Label();
    Process backend;
    string pwaUrl = "", localWebUrl = "", pairingUrl = "", lastQr = "";
    PictureBox qr = new PictureBox();
    TextBox endpoint = new TextBox();
    Label caption = new Label();
    bool updating = false, closing = false;
    string selectedAddress = "";
    static readonly string DataFolder = Environment.GetEnvironmentVariable("FPV_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FPVPhoneController");
    static readonly string LogsFolder = Path.Combine(DataFolder, "logs");
    static readonly string BetaVersion = ((System.Reflection.AssemblyInformationalVersionAttribute)Attribute.GetCustomAttribute(typeof(CompanionWindow).Assembly, typeof(System.Reflection.AssemblyInformationalVersionAttribute))).InformationalVersion;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    [STAThread] static void Main(string[] args) {
        if (args.Length > 0 && args[0] == "--self-test") {
            Application.EnableVisualStyles();
            var window = new CompanionWindow();
            window.ApplyStatus("{\"type\":\"status\",\"virtualController\":\"READY\",\"websocket\":\"LISTENING\",\"phone\":\"DISCONNECTED\",\"port\":8080,\"message\":\"\",\"pwaUrl\":\"\",\"localWebUrl\":\"http://192.168.1.1:8080\",\"selectedAddress\":\"192.168.1.1\",\"addresses\":[{\"name\":\"Wi-Fi\",\"address\":\"192.168.1.1\",\"endpoint\":\"ws://192.168.1.1:8080/?token=test\"}]}");
            bool passed = window.copy.Enabled && window.addresses.Items.Count == 1 && window.message.Text == "";
            var readyStatus = Json.Deserialize<Dictionary<string, object>>("{\"type\":\"status\",\"virtualController\":\"READY\",\"websocket\":\"LISTENING\",\"phone\":\"DISCONNECTED\",\"port\":8080,\"message\":\"\",\"pwaUrl\":\"\",\"localWebUrl\":\"http://192.168.1.1:8080\",\"selectedAddress\":\"192.168.1.1\",\"addresses\":[{\"name\":\"Wi-Fi\",\"address\":\"192.168.1.1\",\"endpoint\":\"ws://192.168.1.1:8080/?token=test\"}]}");
            var missingStatus = new Dictionary<string, object>(readyStatus);
            missingStatus["virtualController"] = "NOT AVAILABLE"; missingStatus["websocket"] = "STOPPED";
            missingStatus["issueCode"] = "DRIVER_MISSING";
            window.ApplyStatus(Json.Serialize(missingStatus));
            passed = passed && window.driverRequired && window.driver.Text == "Virtual Controller\n○ Needs repair"
                && window.message.Text == "The virtual controller needs repair."
                && window.repair.Text == "Repair driver" && window.checkAgain.Text == "Check again";
            var elevated = window.RepairStartInfo();
            passed = passed && elevated.Verb == "runas" && elevated.UseShellExecute && elevated.FileName.EndsWith("companion-engine.exe")
                && elevated.Arguments.Contains("vjoy-setup.cjs\" --repair --install always --state-dir \"");
            window.FinishRepair(-1, true);
            window.ApplyStatus(Json.Serialize(missingStatus));
            passed = passed && window.message.Text == "Repair was cancelled. Click Repair driver to try again." && window.repair.Enabled;
            missingStatus["issueCode"] = "DEVICE_UNAVAILABLE";
            window.ApplyStatus(Json.Serialize(missingStatus));
            passed = passed && window.driverRequired;
            var limited = new Dictionary<string, object>(readyStatus);
            limited["device"] = new Dictionary<string, object> { { "id", 3 }, { "axes", 4 }, { "buttons", 4 } };
            window.ApplyStatus(Json.Serialize(limited));
            passed = passed && !window.driverRequired && window.driver.Text == "Virtual Controller\n● Ready"
                && window.deviceInfo.Text == "vJoy device 3 · 4 axes · 4 buttons\nThis vJoy device has 4 buttons; buttons above 4 are ignored.";
            window.ApplyStatus(Json.Serialize(readyStatus));
            passed = passed && window.deviceInfo.Text == "" && window.message.Text == "";
            window.ApplyStatus("{\"type\":\"metrics\",\"packetsPerSecond\":60,\"axes\":{\"throttle\":0.5,\"yaw\":0,\"pitch\":0,\"roll\":0},\"failsafe\":false}");
            passed = passed && window.message.Text == "" && !window.usePort.Visible;
            var busy = new Dictionary<string, object>(readyStatus); busy["websocket"] = "STOPPED"; busy["issueCode"] = "PORT_BUSY"; busy["message"] = "Port already in use.";
            window.ApplyStatus(Json.Serialize(busy));
            passed = passed && window.portBusy && window.usePort.Text == "Use another port";
            var offline = new Dictionary<string, object>(readyStatus); offline["websocket"] = "STOPPED"; offline["issueCode"] = "NETWORK_MISSING";
            window.ApplyStatus(Json.Serialize(offline));
            passed = passed && !window.portBusy && window.networkMissing && NetworkSettingsTarget == "ms-settings:network";
            int free = FindFreePort(8080); passed = passed && free >= 8081 && free <= 8099;
            window.ApplyStatus(Json.Serialize(readyStatus));
            if (args.Length > 1) {
                window.ApplyStatus(File.ReadAllText(args[1]));
                passed = passed && window.qr.Image != null && window.qr.Image.Width == 320 && window.regenerate.Enabled && !String.IsNullOrEmpty(window.pairingUrl);
            }
            if (!passed) Console.Error.WriteLine(window.message.Text);
            Environment.Exit(passed ? 0 : 1);
        }
        bool created;
        using (var mutex = new Mutex(true, "Local\\FPVPhoneController", out created)) {
            if (!created) { MessageBox.Show("FPV Phone Controller is already running."); return; }
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new CompanionWindow());
        }
    }
    CompanionWindow() {
        Text = "FPV Phone Controller"; ClientSize = new Size(590, 820);
        MinimumSize = new Size(590, 480); StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10); BackColor = Color.FromArgb(245, 248, 250);
        var layout = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(24), AutoScroll = true,
            FlowDirection = FlowDirection.TopDown, WrapContents = false };
        Controls.Add(layout);
        layout.Controls.Add(new Label { Text = "FPV Phone Controller", AutoSize = true, Font = new Font(Font.FontFamily, 20, FontStyle.Bold) });
        layout.Controls.Add(new Label { Text = "v" + BetaVersion, AutoSize = true, ForeColor = Color.FromArgb(70, 85, 100) });
        var onboarding = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false };
        onboarding.Controls.Add(new Label { AutoSize = true, MaximumSize = new Size(480, 0),
            Text = "1. Connect your PC and phone to the same network\n2. Scan the QR code\n3. Open your FPV simulator\n4. Select the virtual controller" });
        AddButton(onboarding, "Got it", delegate {
            onboarding.Visible = false;
            try { Directory.CreateDirectory(DataFolder); File.WriteAllText(Path.Combine(DataFolder, "onboarding.hidden"), "1"); }
            catch (Exception e) { TechnicalLog("preferences_error", e.ToString()); }
        });
        onboarding.Visible = !File.Exists(Path.Combine(DataFolder, "onboarding.hidden")); layout.Controls.Add(onboarding);
        driver.Text = "Virtual Controller: CHECKING"; websocket.Text = "WebSocket: STARTING"; phone.Text = "Phone: DISCONNECTED"; port.Text = "Port: 8080";
        var statuses = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown };
        network.Text = "Network: Checking";
        foreach (var label in new[] { driver, websocket, network, phone }) { label.AutoSize = true; label.Margin = new Padding(0, 4, 0, 4); statuses.Controls.Add(label); }
        layout.Controls.Add(statuses);
        qr.Size = new Size(320, 320); qr.BackColor = Color.White; qr.Margin = new Padding(85, 10, 0, 8);
        qr.SizeMode = PictureBoxSizeMode.Normal; layout.Controls.Add(qr);
        caption.Text = "Scan this QR with your phone"; caption.AutoSize = true; caption.Margin = new Padding(85, 0, 0, 8);
        layout.Controls.Add(caption);
        message.AutoSize = true; message.MaximumSize = new Size(480, 0); message.ForeColor = Color.FromArgb(150, 50, 30); layout.Controls.Add(message);
        repair.Text = "Repair driver"; repair.AutoSize = true; repair.Visible = false;
        repair.BackColor = Color.FromArgb(30, 140, 105); repair.ForeColor = Color.White; repair.FlatStyle = FlatStyle.Flat;
        repair.Click += delegate { RepairDriver(); };
        layout.Controls.Add(repair);
        checkAgain.Text = "Check again"; checkAgain.AutoSize = true; checkAgain.Visible = false;
        checkAgain.Click += delegate { Restart(); };
        layout.Controls.Add(checkAgain);
        usePort.Text = "Use another port"; usePort.AutoSize = true; usePort.Visible = false;
        usePort.Click += delegate { UseAnotherPort(); };
        layout.Controls.Add(usePort);
        networkSettings.Text = "Open network settings"; networkSettings.AutoSize = true; networkSettings.Visible = false;
        networkSettings.Click += delegate { Open(NetworkSettingsTarget); };
        layout.Controls.Add(networkSettings);
        disconnectPhone.Text = "Disconnect phone"; disconnectPhone.AutoSize = true; disconnectPhone.Visible = false;
        disconnectPhone.Click += delegate { SendCommand("disconnect-phone"); };
        layout.Controls.Add(disconnectPhone);
        var advanced = new Button { Text = "Advanced >", AutoSize = true };
        layout.Controls.Add(advanced);
        var details = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false, Visible = false };
        layout.Controls.Add(details);
        advanced.Click += delegate { details.Visible = !details.Visible; advanced.Text = details.Visible ? "Advanced v" : "Advanced >"; };
        port.AutoSize = true; checks.AutoSize = true; details.Controls.Add(port); details.Controls.Add(checks);
        deviceInfo.AutoSize = true; deviceInfo.MaximumSize = new Size(470, 0); details.Controls.Add(deviceInfo);
        details.Controls.Add(new Label { Text = "PC network", AutoSize = true });
        addresses.Width = 470; addresses.DropDownStyle = ComboBoxStyle.DropDownList;
        addresses.SelectedIndexChanged += delegate {
            if (updating || addresses.SelectedItem == null) return;
            selectedAddress = ((AddressItem)addresses.SelectedItem).Address; Restart();
        };
        details.Controls.Add(addresses);
        details.Controls.Add(new Label { Text = "WebSocket endpoint (manual fallback)", AutoSize = true });
        endpoint.ReadOnly = true; endpoint.Width = 470; details.Controls.Add(endpoint);
        var actions = new FlowLayoutPanel { AutoSize = true };
        copy.Text = "Copy connection link"; copy.AutoSize = true; copy.Enabled = false;
        copy.Click += delegate { if (!String.IsNullOrEmpty(pairingUrl)) { Clipboard.SetText(pairingUrl); copy.Text = "Copied"; } };
        retry.Text = "Retry"; retry.AutoSize = true; retry.Click += delegate { Restart(); };
        regenerate.Text = "Regenerate QR"; regenerate.AutoSize = true; regenerate.Enabled = false;
        regenerate.Click += delegate { TechnicalLog("qr_regenerate_requested", "Connection restarted; old QR expires."); Restart(); };
        actions.Controls.Add(copy); actions.Controls.Add(regenerate); actions.Controls.Add(retry);
        layout.Controls.Add(actions); layout.Controls.SetChildIndex(actions, layout.Controls.IndexOf(advanced));
        var links = new FlowLayoutPanel { AutoSize = true };
        AddButton(links, "Open PWA", delegate {
            if (String.IsNullOrEmpty(pwaUrl)) MessageBox.Show("Public PWA is not configured in this preview. Use Local preview, or install the release with the published URL.");
            else Open(pwaUrl);
        });
        AddButton(links, "Local preview", delegate { if (!String.IsNullOrEmpty(localWebUrl)) Open(localWebUrl); });
        AddButton(links, "Test joystick", delegate { Process.Start("control.exe", "joy.cpl"); });
        details.Controls.Add(links);
        details.Controls.Add(new Label { AutoSize = true, MaximumSize = new Size(470, 0),
            Text = "Connect phone and PC to the same network or USB tethering. If Windows asks, allow access only on a private network." });
        var help = new FlowLayoutPanel { AutoSize = true };
        AddButton(help, "Help", delegate { Open(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "USER_README.html")); });
        AddButton(help, "Firewall", delegate { Process.Start("control.exe", "firewall.cpl"); });
        AddButton(help, "Open logs folder", delegate {
            try { Directory.CreateDirectory(LogsFolder); Open(LogsFolder); }
            catch (Exception e) { TechnicalLog("logs_folder_error", e.ToString()); MessageBox.Show("Cannot open logs. Check disk space and app permissions."); }
        });
        AddButton(help, "Show instructions", delegate { onboarding.Visible = true; });
        details.Controls.Add(help);
        details.Controls.Add(new Label { AutoSize = true, MaximumSize = new Size(470, 0), ForeColor = Color.FromArgb(70, 85, 100),
            Text = "Virtual controller driver: vJoy " + DesktopConfiguration.VJOY_VERSION + " by Shaul Eizikovich and contributors, MIT License. Source: " + DesktopConfiguration.VJOY_PROJECT_URL + ". Uninstalling FPV Phone Controller keeps vJoy, because other apps may use it." });
        var about = new FlowLayoutPanel { AutoSize = true };
        AddButton(about, "Third-party licenses", delegate { Open(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "licenses")); });
        details.Controls.Add(about);
        Shown += delegate { StartBackend(); };
        FormClosing += delegate { closing = true; StopBackend(); };
    }
    void AddButton(FlowLayoutPanel panel, string title, Action action) {
        var button = new Button { Text = title, AutoSize = true }; button.Click += delegate { action(); }; panel.Controls.Add(button);
    }
    void Open(string target) { try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); } catch (Exception e) { TechnicalLog("open_error", e.ToString()); MessageBox.Show("Cannot open this item. Check the installation or open the logs folder."); } }
    static string Quote(string value) { return "\"" + value + "\""; }
    ProcessStartInfo RepairStartInfo() {
        var directory = AppDomain.CurrentDomain.BaseDirectory;
        return new ProcessStartInfo(Path.Combine(directory, "runtime", "companion-engine.exe"),
            Quote(Path.Combine(directory, "vjoy-setup.cjs")) + " --repair --install always --state-dir " + Quote(DataFolder)) {
            UseShellExecute = true, Verb = "runas", WindowStyle = ProcessWindowStyle.Hidden, WorkingDirectory = directory };
    }
    void RepairDriver() {
        repair.Enabled = false; checkAgain.Enabled = false; repairNote = null;
        message.Text = "Repairing the virtual controller. Approve the Windows permission prompt; this can take a minute.";
        StopBackend(); ClearPairing();
        var info = RepairStartInfo();
        var worker = new Thread(delegate () {
            int code = -1; bool cancelled = false;
            try { using (var process = Process.Start(info)) { process.WaitForExit(); code = process.ExitCode; } }
            catch (System.ComponentModel.Win32Exception e) { cancelled = e.NativeErrorCode == 1223; TechnicalLog("repair_start_error", e.ToString()); }
            catch (Exception e) { TechnicalLog("repair_start_error", e.ToString()); }
            Post(delegate { FinishRepair(code, cancelled); StartBackend(); });
        });
        worker.IsBackground = true; worker.Start();
    }
    // Exit codes match SetupExit in desktop/src/drivers/vjoy/vjoy-setup.ts.
    void FinishRepair(int code, bool cancelled) {
        repair.Enabled = true; checkAgain.Enabled = true;
        TechnicalLog("repair_finished", "exit=" + code + " cancelled=" + cancelled);
        repairNote = cancelled ? "Repair was cancelled. Click Repair driver to try again."
            : code == 0 ? null
            : code == 22 ? "All 16 vJoy devices are in use by other apps. Remove one you no longer need, then click Repair driver."
            : code == 21 ? "The virtual controller could not be configured. Restart Windows, then click Repair driver again."
            : "The driver could not be repaired. Restart Windows and try again, or open the logs folder.";
        if (repairNote != null) message.Text = repairNote;
    }
    static void TechnicalLog(string name, string detail) {
        try { Directory.CreateDirectory(LogsFolder); string file = Path.Combine(LogsFolder, "window.jsonl");
            detail = Regex.Replace(detail, "token=[^\\s&]+", "token=[redacted]", RegexOptions.IgnoreCase);
            detail = Regex.Replace(detail, "\\b[a-f0-9]{48}\\b", "[redacted]", RegexOptions.IgnoreCase);
            if (File.Exists(file) && new FileInfo(file).Length > 2097152) File.WriteAllText(file, "");
            File.AppendAllText(file, new JavaScriptSerializer().Serialize(new { time = DateTime.UtcNow.ToString("o"), level = "info", version = BetaVersion, @event = name, detail = detail }) + Environment.NewLine);
        } catch {}
    }
    const string NetworkSettingsTarget = "ms-settings:network";
    bool portBusy = false, networkMissing = false;
    static readonly string PortFile = Path.Combine(DataFolder, "port.txt");
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
    int currentPort = 8080;
    void UseAnotherPort() {
        int next = FindFreePort(currentPort);
        if (next == 0) { message.Text = "No free port was found between 8081 and 8099. Close other apps, then Retry."; return; }
        try { Directory.CreateDirectory(DataFolder); File.WriteAllText(PortFile, next.ToString()); }
        catch (Exception e) { TechnicalLog("port_save_error", e.ToString()); }
        TechnicalLog("port_changed", currentPort + " -> " + next); Restart();
    }
    void SendCommand(string command) {
        var process = backend;
        try { if (process != null && !process.HasExited) { process.StandardInput.WriteLine(command); process.StandardInput.Flush(); } }
        catch (Exception e) { TechnicalLog("command_error", e.ToString()); }
    }
    void ClearPairing() { pairingUrl = ""; lastQr = ""; if (qr.Image != null) { qr.Image.Dispose(); qr.Image = null; } copy.Enabled = false; regenerate.Enabled = false; }
    void Restart() { StopBackend(); ClearPairing(); copy.Text = "Copy connection link"; StartBackend(); }
    void StartBackend() {
        var directory = AppDomain.CurrentDomain.BaseDirectory;
        var info = new ProcessStartInfo(Path.Combine(directory, "runtime", "companion-engine.exe"), "\"" + Path.Combine(directory, "companion.cjs") + "\"") {
            WorkingDirectory = directory, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true
        };
        if (!String.IsNullOrEmpty(selectedAddress)) info.EnvironmentVariables["FPV_BIND_ADDRESS"] = selectedAddress;
        int saved = SavedPort(); if (saved != 0) info.EnvironmentVariables["PORT"] = saved.ToString(); else info.EnvironmentVariables.Remove("PORT");
        info.EnvironmentVariables.Remove("NODE_OPTIONS"); info.EnvironmentVariables.Remove("NODE_PATH");
        var process = new Process { StartInfo = info, EnableRaisingEvents = true }; backend = process;
        process.OutputDataReceived += (sender, e) => { if (e.Data != null) Post(delegate { if (backend == process) ApplyStatus(e.Data); }); };
        process.ErrorDataReceived += (sender, e) => { if (e.Data != null) { TechnicalLog("backend_stderr", e.Data); Post(delegate { if (backend == process) message.Text = "An app error occurred. Open logs folder for diagnostics."; }); } };
        process.Exited += delegate { Post(delegate { if (backend == process) { websocket.Text = "WebSocket: STOPPED"; phone.Text = "Phone\n○ Waiting for connection"; if (!driverRequired) driver.Text = "Virtual Controller\n○ Not available"; ClearPairing(); } }); };
        try { process.Start(); process.BeginOutputReadLine(); process.BeginErrorReadLine(); }
        catch (Exception e) { TechnicalLog("backend_start_error", e.ToString()); message.Text = "Cannot start the companion. Reinstall this beta or open the logs folder."; }
    }
    void Post(Action action) { if (!closing && !IsDisposed && IsHandleCreated) { try { BeginInvoke(action); } catch (InvalidOperationException) {} } }
    void ApplyStatus(string line) {
        try {
            var status = Json.Deserialize<Dictionary<string, object>>(line);
            if ((string)status["type"] == "fatal") { message.Text = (string)status["message"]; return; }
            // Live "metrics" lines are for the new UI; this window only reads "status".
            if ((string)status["type"] != "status") return;
            bool ready = (string)status["virtualController"] == "READY", connected = (string)status["phone"] == "CONNECTED";
            string issueCode = status.ContainsKey("issueCode") ? (string)status["issueCode"] : "";
            driverRequired = issueCode == "DRIVER_MISSING" || issueCode == "DRIVER_MISMATCH" || issueCode == "DEVICE_UNAVAILABLE";
            driver.Text = "Virtual Controller\n" + (driverRequired ? "○ Needs repair" : ready ? "● Ready" : "○ Not available");
            driver.ForeColor = ready ? Color.FromArgb(15, 130, 95) : Color.FromArgb(150, 50, 30);
            bool lost = status.ContainsKey("issueCode") && (string)status["issueCode"] == "PHONE_LOST";
            phone.Text = "Phone   " + (connected ? "● Connected" : lost ? "○ Connection lost" : "○ Waiting");
            phone.ForeColor = connected ? Color.FromArgb(15, 130, 95) : Color.FromArgb(70, 85, 100);
            websocket.Text = "WebSocket server   " + ((string)status["websocket"] == "LISTENING" ? "● Ready" : "○ Not available"); port.Text = "Port: " + status["port"];
            object healthValue;
            if (status.TryGetValue("health", out healthValue)) {
                var health = (Dictionary<string, object>)healthValue;
                network.Text = "Network   " + health["network"];
                checks.Text = "Driver: " + health["driver"] + " | Device: " + health["device"] + "\nPort: " + health["port"] + " | QR: " + health["qr"];
            }
            message.Text = (string)status["message"]; pwaUrl = (string)status["pwaUrl"]; localWebUrl = (string)status["localWebUrl"];
            if (ready) repairNote = null;
            if (driverRequired) message.Text = repairNote ?? "The virtual controller needs repair.";
            checkAgain.Visible = driverRequired; repair.Visible = driverRequired;
            portBusy = issueCode == "PORT_BUSY"; networkMissing = issueCode == "NETWORK_MISSING";
            usePort.Visible = portBusy; networkSettings.Visible = networkMissing; disconnectPhone.Visible = connected;
            currentPort = Convert.ToInt32(status["port"]);
            object deviceValue;
            var device = status.TryGetValue("device", out deviceValue) ? deviceValue as Dictionary<string, object> : null;
            deviceInfo.Text = device == null ? "" : DeviceDescription(Convert.ToInt32(device["id"]), Convert.ToInt32(device["axes"]), Convert.ToInt32(device["buttons"]));
            qr.Visible = !driverRequired; caption.Visible = !driverRequired;
            copy.Enabled = (string)status["websocket"] == "LISTENING"; selectedAddress = (string)status["selectedAddress"];
            regenerate.Enabled = copy.Enabled; retry.Visible = !copy.Enabled && !driverRequired;
            object link, image;
            if (status.TryGetValue("pairingUrl", out link)) pairingUrl = (string)link;
            if (status.TryGetValue("qrPngBase64", out image) && (string)image != lastQr && copy.Enabled) {
                string encoded = (string)image;
                if (!String.IsNullOrEmpty(encoded)) {
                    using (var stream = new MemoryStream(Convert.FromBase64String(encoded)))
                    using (var bitmap = Image.FromStream(stream)) {
                        if (qr.Image != null) qr.Image.Dispose();
                        qr.Image = new Bitmap(bitmap);
                    }
                }
                lastQr = encoded;
            }
            if (!copy.Enabled) ClearPairing();
            caption.Text = copy.Enabled ? "Scan this QR with your phone" : "Waiting for companion...";
            updating = true; addresses.Items.Clear();
            foreach (object value in (System.Collections.IEnumerable)status["addresses"]) {
                var item = (Dictionary<string, object>)value;
                var address = new AddressItem { Name = (string)item["name"], Address = (string)item["address"], Endpoint = (string)item["endpoint"] };
                addresses.Items.Add(address); if (address.Address == selectedAddress) addresses.SelectedItem = address;
            }
            updating = false;
            var chosen = addresses.SelectedItem as AddressItem;
            endpoint.Text = chosen == null ? "" : chosen.Endpoint;
        } catch (Exception e) { TechnicalLog("status_error", e.ToString()); updating = false; message.Text = "Could not read app status. Retry or open the logs folder."; }
    }
    static string DeviceDescription(int id, int axes, int buttons) {
        string text = "vJoy device " + id + " · " + axes + " axes · " + buttons + " buttons";
        if (buttons < 8) text += "\nThis vJoy device has " + buttons + " buttons; buttons above " + buttons + " are ignored.";
        return text;
    }
    void StopBackend() {
        var process = backend; backend = null; if (process == null) return;
        try { if (!process.HasExited) { process.StandardInput.WriteLine("shutdown"); process.StandardInput.Flush();
            if (!process.WaitForExit(4000)) process.Kill(); } } catch (InvalidOperationException) {}
        finally { process.Dispose(); }
    }
    class AddressItem {
        public string Name, Address, Endpoint;
        public override string ToString() { return Name + " — " + Address; }
    }
}

