using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;

class CompanionWindow : Form {
    Label driver = new Label(), websocket = new Label(), phone = new Label(), message = new Label(), port = new Label();
    ComboBox addresses = new ComboBox();
    Button copy = new Button(), retry = new Button(), regenerate = new Button(), install = new Button();
    Button checkAgain = new Button(), copyDownload = new Button();
    bool driverRequired = false;
    Action<ProcessStartInfo> launchBrowser = info => { Process.Start(info); };
    Label network = new Label(), checks = new Label();
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
            passed = passed && window.driverRequired && window.driver.Text == "Virtual Controller\n○ Driver required"
                && window.message.Text == "FPV Phone Controller requires vJoy to create the virtual joystick."
                && window.install.Text == "Install vJoy" && window.checkAgain.Text == "Check again";
            ProcessStartInfo opened = null;
            window.launchBrowser = info => { opened = info; };
            window.OpenVJoyDownload();
            passed = passed && opened != null && opened.FileName == DesktopConfiguration.VJOY_DOWNLOAD_URL
                && opened.UseShellExecute && !window.IsDisposed && window.driverRequired;
            window.launchBrowser = info => { throw new InvalidOperationException("Simulated browser failure"); };
            window.OpenVJoyDownload();
            passed = passed && window.message.Text == "Unable to open the vJoy download page." && window.copyDownload.Enabled;
            window.ApplyStatus(Json.Serialize(readyStatus));
            passed = passed && !window.driverRequired && window.driver.Text == "Virtual Controller\n● Ready" && !window.copyDownload.Enabled;
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
        install.Text = "Install vJoy"; install.AutoSize = true; install.Visible = false;
        install.BackColor = Color.FromArgb(30, 140, 105); install.ForeColor = Color.White; install.FlatStyle = FlatStyle.Flat;
        install.Click += delegate { OpenVJoyDownload(); };
        layout.Controls.Add(install);
        copyDownload.Text = "Copy download link"; copyDownload.AutoSize = true;
        copyDownload.Visible = false; copyDownload.Enabled = false;
        copyDownload.Click += delegate {
            try { Clipboard.SetText(DesktopConfiguration.VJOY_DOWNLOAD_URL); copyDownload.Text = "Copied"; }
            catch (Exception e) { TechnicalLog("copy_download_error", e.ToString()); message.Text = "Unable to copy the download link. Visit " + DesktopConfiguration.VJOY_DOWNLOAD_URL; }
        };
        layout.Controls.Add(copyDownload);
        checkAgain.Text = "Check again"; checkAgain.AutoSize = true; checkAgain.Visible = false;
        checkAgain.Click += delegate { Restart(); };
        layout.Controls.Add(checkAgain);
        var advanced = new Button { Text = "Advanced >", AutoSize = true };
        layout.Controls.Add(advanced);
        var details = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false, Visible = false };
        layout.Controls.Add(details);
        advanced.Click += delegate { details.Visible = !details.Visible; advanced.Text = details.Visible ? "Advanced v" : "Advanced >"; };
        port.AutoSize = true; checks.AutoSize = true; details.Controls.Add(port); details.Controls.Add(checks);
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
        AddButton(links, "Install vJoy", delegate { OpenVJoyDownload(); });
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
        Shown += delegate { StartBackend(); };
        FormClosing += delegate { closing = true; StopBackend(); };
    }
    void AddButton(FlowLayoutPanel panel, string title, Action action) {
        var button = new Button { Text = title, AutoSize = true }; button.Click += delegate { action(); }; panel.Controls.Add(button);
    }
    void Open(string target) { try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); } catch (Exception e) { TechnicalLog("open_error", e.ToString()); MessageBox.Show("Cannot open this item. Check the installation or open the logs folder."); } }
    void OpenVJoyDownload() {
        copyDownload.Visible = false; copyDownload.Enabled = false; copyDownload.Text = "Copy download link";
        try { ExternalLinks.OpenVJoy(launchBrowser); }
        catch (Exception e) {
            TechnicalLog("vjoy_download_page_error", e.ToString());
            message.Text = "Unable to open the vJoy download page.";
            copyDownload.Visible = true; copyDownload.Enabled = true;
        }
    }
    static void TechnicalLog(string name, string detail) {
        try { Directory.CreateDirectory(LogsFolder); string file = Path.Combine(LogsFolder, "window.jsonl");
            detail = Regex.Replace(detail, "token=[^\\s&]+", "token=[redacted]", RegexOptions.IgnoreCase);
            detail = Regex.Replace(detail, "\\b[a-f0-9]{48}\\b", "[redacted]", RegexOptions.IgnoreCase);
            if (File.Exists(file) && new FileInfo(file).Length > 2097152) File.WriteAllText(file, "");
            File.AppendAllText(file, new JavaScriptSerializer().Serialize(new { time = DateTime.UtcNow.ToString("o"), level = "info", version = BetaVersion, @event = name, detail = detail }) + Environment.NewLine);
        } catch {}
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
            bool ready = (string)status["virtualController"] == "READY", connected = (string)status["phone"] == "CONNECTED";
            driverRequired = status.ContainsKey("issueCode") && (string)status["issueCode"] == "DRIVER_MISSING";
            driver.Text = "Virtual Controller\n" + (driverRequired ? "○ Driver required" : ready ? "● Ready" : "○ Not available");
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
            if (driverRequired) message.Text = "FPV Phone Controller requires vJoy to create the virtual joystick.";
            checkAgain.Visible = driverRequired;
            copyDownload.Visible = false; copyDownload.Enabled = false;
            qr.Visible = !driverRequired; caption.Visible = !driverRequired;
            copy.Enabled = (string)status["websocket"] == "LISTENING"; selectedAddress = (string)status["selectedAddress"];
            regenerate.Enabled = copy.Enabled; retry.Visible = !copy.Enabled && !driverRequired;
            object issue;
            install.Visible = status.TryGetValue("issueCode", out issue) && ((string)issue == "DRIVER_MISSING" || (string)issue == "DRIVER_MISMATCH");
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

