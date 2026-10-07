using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

class CompanionWindow : Form {
    Label driver = new Label(), websocket = new Label(), phone = new Label(), message = new Label(), port = new Label();
    ComboBox addresses = new ComboBox();
    Button copy = new Button(), retry = new Button();
    Process backend;
    string pwaUrl = "", localWebUrl = "", pairingUrl = "", lastQr = "";
    PictureBox qr = new PictureBox();
    TextBox endpoint = new TextBox();
    Label caption = new Label();
    bool updating = false, closing = false;
    string selectedAddress = "";
    const string DriverRelease = "https://github.com/BrunnerInnovation/vJoy/releases/tag/v2.2.2.0";
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    [STAThread] static void Main(string[] args) {
        if (args.Length > 0 && args[0] == "--self-test") {
            Application.EnableVisualStyles();
            var window = new CompanionWindow();
            window.ApplyStatus("{\"type\":\"status\",\"virtualController\":\"READY\",\"websocket\":\"LISTENING\",\"phone\":\"DISCONNECTED\",\"port\":8080,\"message\":\"\",\"pwaUrl\":\"\",\"localWebUrl\":\"http://192.168.1.1:8080\",\"selectedAddress\":\"192.168.1.1\",\"addresses\":[{\"name\":\"Wi-Fi\",\"address\":\"192.168.1.1\",\"endpoint\":\"ws://192.168.1.1:8080/?token=test\"}]}");
            bool passed = window.copy.Enabled && window.addresses.Items.Count == 1 && window.message.Text == "";
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
        Text = "FPV Phone Controller"; ClientSize = new Size(560, 660);
        MinimumSize = new Size(590, 480); StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10); BackColor = Color.FromArgb(245, 248, 250);
        var layout = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(24), AutoScroll = true,
            FlowDirection = FlowDirection.TopDown, WrapContents = false };
        Controls.Add(layout);
        layout.Controls.Add(new Label { Text = "FPV Phone Controller", AutoSize = true, Font = new Font(Font.FontFamily, 20, FontStyle.Bold) });
        driver.Text = "Virtual Controller: CHECKING"; websocket.Text = "WebSocket: STARTING"; phone.Text = "Phone: DISCONNECTED"; port.Text = "Port: 8080";
        var statuses = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown };
        foreach (var label in new[] { driver, phone }) { label.AutoSize = true; label.Margin = new Padding(0, 8, 0, 8); statuses.Controls.Add(label); }
        layout.Controls.Add(statuses);
        qr.Size = new Size(320, 320); qr.BackColor = Color.White; qr.Margin = new Padding(85, 10, 0, 8);
        qr.SizeMode = PictureBoxSizeMode.Normal; layout.Controls.Add(qr);
        caption.Text = "Scan this QR with your phone"; caption.AutoSize = true; caption.Margin = new Padding(85, 0, 0, 8);
        layout.Controls.Add(caption);
        message.AutoSize = true; message.MaximumSize = new Size(480, 0); message.ForeColor = Color.FromArgb(150, 50, 30); layout.Controls.Add(message);
        var advanced = new Button { Text = "Advanced >", AutoSize = true };
        layout.Controls.Add(advanced);
        var details = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false, Visible = false };
        layout.Controls.Add(details);
        advanced.Click += delegate { details.Visible = !details.Visible; advanced.Text = details.Visible ? "Advanced v" : "Advanced >"; };
        websocket.AutoSize = true; port.AutoSize = true; details.Controls.Add(websocket); details.Controls.Add(port);
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
        actions.Controls.Add(copy); actions.Controls.Add(retry); details.Controls.Add(actions);
        var links = new FlowLayoutPanel { AutoSize = true };
        AddButton(links, "Open PWA", delegate {
            if (String.IsNullOrEmpty(pwaUrl)) MessageBox.Show("Public PWA is not configured in this preview. Use Local preview, or install the release with the published URL.");
            else Open(pwaUrl);
        });
        AddButton(links, "Local preview", delegate { if (!String.IsNullOrEmpty(localWebUrl)) Open(localWebUrl); });
        AddButton(links, "Install driver", delegate { Open(DriverRelease); Open(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "USER_README.html")); });
        AddButton(links, "Test joystick", delegate { Process.Start("control.exe", "joy.cpl"); });
        details.Controls.Add(links);
        details.Controls.Add(new Label { AutoSize = true, MaximumSize = new Size(470, 0),
            Text = "Connect phone and PC to the same network or USB tethering. If Windows asks, allow access only on a private network." });
        var help = new FlowLayoutPanel { AutoSize = true };
        AddButton(help, "Help", delegate { Open(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "USER_README.html")); });
        AddButton(help, "Firewall", delegate { Process.Start("control.exe", "firewall.cpl"); });
        details.Controls.Add(help);
        Shown += delegate { StartBackend(); };
        FormClosing += delegate { closing = true; StopBackend(); };
    }
    void AddButton(FlowLayoutPanel panel, string title, Action action) {
        var button = new Button { Text = title, AutoSize = true }; button.Click += delegate { action(); }; panel.Controls.Add(button);
    }
    void Open(string target) { try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); } catch (Exception e) { MessageBox.Show(e.Message); } }
    void ClearPairing() { pairingUrl = ""; lastQr = ""; if (qr.Image != null) { qr.Image.Dispose(); qr.Image = null; } copy.Enabled = false; }
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
        process.ErrorDataReceived += (sender, e) => { if (e.Data != null) Post(delegate { if (backend == process) message.Text = e.Data; }); };
        process.Exited += delegate { Post(delegate { if (backend == process) { websocket.Text = "WebSocket: STOPPED"; phone.Text = "Phone\n○ Waiting for connection"; driver.Text = "Virtual Controller\n○ Not available"; ClearPairing(); } }); };
        try { process.Start(); process.BeginOutputReadLine(); process.BeginErrorReadLine(); }
        catch (Exception e) { message.Text = "Cannot start companion: " + e.Message; }
    }
    void Post(Action action) { if (!closing && !IsDisposed && IsHandleCreated) { try { BeginInvoke(action); } catch (InvalidOperationException) {} } }
    void ApplyStatus(string line) {
        try {
            var status = Json.Deserialize<Dictionary<string, object>>(line);
            if ((string)status["type"] == "fatal") { message.Text = (string)status["message"]; return; }
            bool ready = (string)status["virtualController"] == "READY", connected = (string)status["phone"] == "CONNECTED";
            driver.Text = "Virtual Controller\n" + (ready ? "● Ready" : "○ Not available");
            driver.ForeColor = ready ? Color.FromArgb(15, 130, 95) : Color.FromArgb(150, 50, 30);
            phone.Text = "Phone\n" + (connected ? "● Connected" : "○ Waiting for connection");
            phone.ForeColor = connected ? Color.FromArgb(15, 130, 95) : Color.FromArgb(70, 85, 100);
            websocket.Text = "WebSocket: " + status["websocket"]; port.Text = "Port: " + status["port"];
            message.Text = (string)status["message"]; pwaUrl = (string)status["pwaUrl"]; localWebUrl = (string)status["localWebUrl"];
            copy.Enabled = (string)status["websocket"] == "LISTENING"; selectedAddress = (string)status["selectedAddress"];
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
        } catch (Exception e) { updating = false; message.Text = "Status error: " + e.Message; }
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
