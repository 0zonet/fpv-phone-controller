using System;
using System.Collections;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Reflection;

// Windows Firewall diagnostics and the scoped allow rule (D5), through the firewall and network-list COM APIs.
// Reading needs no admin; Allow runs elevated in a separate process (FPVPhoneController.exe --firewall-allow).
static class Firewall {
    public const string RuleName = "FPV Phone Controller (private network)";
    const int Inbound = 1, Block = 0, Allow = 1, Tcp = 6, PrivateProfile = 2;

    public class Status {
        /** An enabled inbound block rule for the companion engine (often created by cancelling the Windows prompt). */
        public bool BlockRule;
        /** The network of the selected address is Public, where Windows blocks unsolicited inbound connections. */
        public bool PublicNetwork;
        /** Our scoped allow rule already exists and is enabled. */
        public bool AllowRule;
        /** Set when the COM query failed; the heuristic then stays silent. */
        public string Error;
    }

    static object Get(object target, string name) { return target.GetType().InvokeMember(name, BindingFlags.GetProperty, null, target, null); }
    static void Set(object target, string name, object value) { target.GetType().InvokeMember(name, BindingFlags.SetProperty, null, target, new[] { value }); }
    static object Call(object target, string name) { return target.GetType().InvokeMember(name, BindingFlags.InvokeMethod, null, target, null); }
    static object Policy() { return Activator.CreateInstance(Type.GetTypeFromProgID("HNetCfg.FwPolicy2", true)); }
    static bool SameProgram(object rule, string program) {
        var application = Get(rule, "ApplicationName") as string;
        return application != null && String.Equals(Environment.ExpandEnvironmentVariables(application), program, StringComparison.OrdinalIgnoreCase);
    }

    public static Status Check(string program, string address) {
        var status = new Status();
        try {
            foreach (object rule in (IEnumerable)Get(Policy(), "Rules")) {
                if (!Convert.ToBoolean(Get(rule, "Enabled")) || Convert.ToInt32(Get(rule, "Direction")) != Inbound) continue;
                if (Convert.ToString(Get(rule, "Name")) == RuleName) { status.AllowRule = true; continue; }
                if (Convert.ToInt32(Get(rule, "Action")) == Block && SameProgram(rule, program)) status.BlockRule = true;
            }
            status.PublicNetwork = NetworkCategory(address) == 0;
        } catch (Exception e) { status.Error = e.GetType().Name + ": " + e.Message; }
        return status;
    }

    /** 0 = Public, 1 = Private, 2 = Domain, -1 = unknown (network list manager). */
    public static int NetworkCategory(string address) {
        if (String.IsNullOrEmpty(address)) return -1;
        Guid adapter = Guid.Empty;
        foreach (var adapterInfo in NetworkInterface.GetAllNetworkInterfaces())
            foreach (var unicast in adapterInfo.GetIPProperties().UnicastAddresses)
                if (unicast.Address.AddressFamily == AddressFamily.InterNetwork && unicast.Address.ToString() == address) adapter = new Guid(adapterInfo.Id);
        if (adapter == Guid.Empty) return -1;
        var manager = Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("DCB00C01-570F-4A9B-8D69-199FDBA5723B"), true));
        foreach (object connection in (IEnumerable)Call(manager, "GetNetworkConnections"))
            if ((Guid)Call(connection, "GetAdapterId") == adapter) return Convert.ToInt32(Call(Call(connection, "GetNetwork"), "GetCategory"));
        return -1;
    }

    /**
     * Elevated: disables inbound block rules for exactly this program (other apps' rules are untouched)
     * and creates or updates one allow rule: this program, TCP, Private profile, local subnet only.
     */
    public static int AllowOnPrivateNetworks(string program) {
        var policy = Policy();
        var rules = Get(policy, "Rules");
        object existing = null;
        foreach (object rule in (IEnumerable)rules) {
            if (Convert.ToString(Get(rule, "Name")) == RuleName) { existing = rule; continue; }
            if (Convert.ToInt32(Get(rule, "Direction")) == Inbound && Convert.ToInt32(Get(rule, "Action")) == Block
                && Convert.ToBoolean(Get(rule, "Enabled")) && SameProgram(rule, program)) Set(rule, "Enabled", false);
        }
        var target = existing ?? Activator.CreateInstance(Type.GetTypeFromProgID("HNetCfg.FWRule", true));
        if (existing == null) Set(target, "Name", RuleName);
        Set(target, "Description", "Lets your phone reach FPV Phone Controller on private networks only. Created on request from the app.");
        Set(target, "ApplicationName", program);
        Set(target, "Protocol", Tcp);
        Set(target, "Direction", Inbound);
        Set(target, "Action", Allow);
        Set(target, "Profiles", PrivateProfile);
        Set(target, "RemoteAddresses", "LocalSubnet");
        Set(target, "Grouping", "FPV Phone Controller");
        Set(target, "Enabled", true);
        if (existing == null) rules.GetType().InvokeMember("Add", BindingFlags.InvokeMethod, null, rules, new[] { target });
        return 0;
    }
}
