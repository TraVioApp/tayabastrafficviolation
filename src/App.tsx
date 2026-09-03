import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import {
  Plus,
  Check,
  X,
  User,
  Car,
  FileText,
  MapPin,
  Users,
  LogOut,
  DollarSign,
  AlertCircle,
  Info,
  Loader2,
  FileSpreadsheet,
  Sun,
  Moon,
  LayoutDashboard,
  Printer,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Reports } from "./pages/Reports";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";

interface ViolationRecord {
  id: string;
  referenceNumber: string;
  driverName: string;
  driverAddress: string;
  licenseNumber: string;
  licenseIssueDate: string;
  driverBirthdate: string;
  contactNumber: string;
  email: string;
  plateNumber: string;
  vehicleType: string;
  numberOfWheels?: string | number | null;
  registrationNumber: string;
  ownerName: string;
  ownerAddress: string;
  violations: Array<{
    name: string;
    fine: number;
    severity: string;
  }>;
  violationDate: string;
  violationTime: string;
  location: string;
  speed: string;
  officerNotes: string;
  vehicleImage?: string | null;
  plateImage?: string | null;
  signature?: string | null;
  totalAmount: number;
  status: "pending" | "paid" | "cancelled";
  createdAt: string;
  officerId: string;
}

interface Enforcer {
  id: string;
  username: string;
  name: string;
  badgeNumber: string;
  station: string;
  rank: string;
  dateJoined: string;
  password?: string;
  status?: "active" | "inactive";
  isSystemAdmin?: boolean;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("tms_isLoggedIn") === "true");
  // const [isOfficer, setIsOfficer] = useState(false); // removed unused state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminDisplayName, setAdminDisplayName] = useState(() => {
    try {
      return localStorage.getItem("tms_admin_name") || "";
    } catch (e) {
      return "";
    }
  });
  const [activeTab, setActiveTab] = useState<"dashboard" | "violations" | "officers" | "reports">("dashboard");
  
  // Default to dark mode unless user explicitly set a preference
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light") return false;
      if (stored === "dark") return true;
    } catch (e) {
      // ignore storage errors
    }
    // no preference set -> default to dark
    return true;
  });
  
  // Violations States
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [selectedViolation, setSelectedViolation] = useState<ViolationRecord | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  
  // Officers States
  const [enforcers, setEnforcers] = useState<Enforcer[]>([]);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [officerSearchQuery, setOfficerSearchQuery] = useState("");
  const [showAddOfficerModal, setShowAddOfficerModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [savingOfficer, setSavingOfficer] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<Enforcer | null>(null);
  
  // New Officer Form
  const [newOfficer, setNewOfficer] = useState({
    name: "",
    username: "",
    password: "",
    badgeNumber: "",
    station: "",
    rank: "Traffic Enforcer I",
    dateJoined: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  });

  // Theme toggle handler
  const toggleTheme = () => {
    const root = document.documentElement;
    root.classList.toggle("dark");
    const newIsDark = root.classList.contains("dark");
    setIsDark(newIsDark);
    localStorage.setItem("theme", newIsDark ? "dark" : "light");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("tms_isLoggedIn");
    try { localStorage.removeItem("tms_admin_name"); } catch {}
    setAdminDisplayName("");
    setShowLogoutConfirm(false);
  };

  // Ensure the document root has the correct class on first render and keep localStorage in sync
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      try { localStorage.setItem("theme", "dark"); } catch {}
    } else {
      root.classList.remove("dark");
      try { localStorage.setItem("theme", "light"); } catch {}
    }
  }, [isDark]);

  // Helper: check credentials against enforcers table and confirm admin status
  const checkAdminCredentials = async (username: string, password: string) => {
    try {
      // Try to read is_system_admin (new schema)
      const { data, error } = await supabase
        .from("enforcers")
        .select("id, is_system_admin, status, name")
        .eq("username", username)
        .eq("password", password)
        .single();

      if (error) {
        // If column does not exist (Postgres code 42703), fall back to legacy check
        if ((error as any)?.code === "42703") {
          console.warn("is_system_admin column missing; using legacy admin detection");
          const { data: legacyData, error: legacyError } = await supabase
            .from("enforcers")
            .select("id, name, status")
            .eq("username", username)
            .eq("password", password)
            .single();

          if (legacyError) throw legacyError;
          // Legacy heuristic: username 'admin' or name contains 'Portal Administrator'
          const isAdminLegacy = (legacyData?.name && legacyData.name.toLowerCase().includes("portal administrator"));
          return { ...legacyData, is_system_admin: isAdminLegacy };
        }
        throw error;
      }
      return data;
    } catch (e) {
      console.error("Failed to verify credentials", e);
      return null;
    }
  };

  

  // Simple DB-backed login: allows both portal admins and regular officers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const enforcer = await checkAdminCredentials(username, password);

      if (!enforcer) {
        toast.error("Invalid username or password");
        return;
      }

      // If user is a system admin, grant full admin access
      if (enforcer.is_system_admin) {
        if (enforcer.status === "inactive") {
          toast.error("Account is deactivated. Access denied.");
          return;
        }
        // success admin login
        setIsLoggedIn(true);
        const displayName = (enforcer && (enforcer.name || enforcer.id || username)) || "System Admin";
        setAdminDisplayName(displayName);
        try { localStorage.setItem("tms_admin_name", displayName); } catch {}
        localStorage.setItem("tms_isLoggedIn", "true");
        toast.success("Welcome back, Portal Administrator");
      } else {
        // Regular officer login – restrict to officer view only
        // Officer login attempt – deny access to admin app
        toast.error("Access denied: Officers cannot use the admin portal.");
        // Ensure no login state is set
        setIsLoggedIn(false);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Login failed: " + e.message);
    }
  };


  // Fetch data
  const fetchViolations = async () => {
    setViolationsLoading(true);
    try {
      const { data, error } = await supabase
        .from("violations")
        .select("id, referenceNumber, driverName, driverAddress, licenseNumber, licenseIssueDate, driverBirthdate, contactNumber, email, plateNumber, vehicleType, numberOfWheels, registrationNumber, ownerName, ownerAddress, violations, violationDate, violationTime, location, speed, officerNotes, totalAmount, status, createdAt, officerId")
        .order("createdAt", { ascending: false });

      if (error) throw error;
      setViolations(data || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load violation records: " + e.message);
    } finally {
      setViolationsLoading(false);
    }
  };

  const fetchEnforcers = async () => {
    setOfficersLoading(true);
    try {
      const { data, error } = await supabase
        .from("enforcers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Normalize snake_case fields to camelCase for UI components
      const normalized = (data || []).map((off: any) => ({
        ...off,
        badgeNumber: off.badge_number,
        dateJoined: off.date_joined,
        isSystemAdmin: off.is_system_admin,
      }));
      setEnforcers(normalized);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load officers: " + e.message);
    } finally {
      setOfficersLoading(false);
    }
  };

  

  useEffect(() => {
    let subscription: any = null;
    if (isLoggedIn) {
      fetchViolations();
      fetchEnforcers();

      // Subscribe to realtime changes on enforcers table
      subscription = supabase
        .channel('public:enforcers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'enforcers' }, payload => {
          console.log('enforcers realtime payload', payload);
          fetchEnforcers();
        })
        .subscribe();
    }

    return () => {
      if (subscription && subscription.unsubscribe) {
        try { subscription.unsubscribe(); } catch (e) { /* ignore */ }
      }
    };
  }, [isLoggedIn]);

  // Fetch full details of a specific violation when clicked
  const handleViewViolation = async (recordId: string) => {
    setLoadingDetails(recordId);
    try {
      const { data, error } = await supabase
        .from("violations")
        .select("*")
        .eq("id", recordId)
        .single();
        
      if (error) throw error;
      setSelectedViolation(data);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load violation details: " + e.message);
    } finally {
      setLoadingDetails(null);
    }
  };

  // Mark pending as paid
  const handleMarkAsPaid = async (recordId: string) => {
    setUpdatingPaymentId(recordId);
    try {
      const { error } = await supabase
        .from("violations")
        .update({ status: "paid" })
        .eq("id", recordId);

      if (error) throw error;
      
      toast.success("Payment marked as PAID successfully");
      
      // Update state locally
      setViolations(prev =>
        prev.map(v => (v.id === recordId ? { ...v, status: "paid" } : v))
      );
      if (selectedViolation?.id === recordId) {
        setSelectedViolation(prev => prev ? { ...prev, status: "paid" } : null);
      }
    } catch (e: any) {
      toast.error("Failed to process payment status: " + e.message);
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const handlePrintViolations = () => {
    const table = document.querySelector(".violation-report-card .data-table")?.outerHTML;
    if (!table) {
      toast.error("Unable to prepare the violation report for printing");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=750");
    if (!printWindow) {
      toast.error("Please allow pop-ups to print the violation report");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Traffic Violation Report</title>
          <style>
            @page { margin: 14mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #000; background: #fff; font-family: Arial, sans-serif; }
            h1 { margin: 0 0 4px; font-size: 20px; }
            p { margin: 0 0 18px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { padding: 8px 7px; border: 1px solid #cbd5e1; color: #000; text-align: left; }
            th { background: #e2e8f0; font-weight: 700; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .print-hide { display: none !important; }
          </style>
        </head>
        <body>
          <h1>Traffic Violation Report</h1>
          <p>Status filter: ${statusFilter.toUpperCase()}${searchQuery ? " | Search filter applied" : ""}</p>
          ${table}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    }, 250);
  };

  // Save (add or edit) officer handler
  const handleSaveOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficer.name || !newOfficer.username || !newOfficer.password || !newOfficer.badgeNumber || !newOfficer.station) {
      toast.error("Please fill in all officer details");
      return;
    }
    setSavingOfficer(true);
    try {
      const localCustom = JSON.parse(localStorage.getItem("tms_custom_enforcers") || "[]");
      
      if (editingOfficer) {
        // Edit flow
        const updatedOfficerRecord = {
          ...editingOfficer,
          ...newOfficer,
        };
        // Try to update the DB for real enforcers (IDs from DB). If the record is a local-only one (id starts with OFF-), skip DB update
        let dbUpdated = false;
        try {
          if (!updatedOfficerRecord.id?.startsWith?.("OFF-")) {
            const { error } = await supabase
              .from("enforcers")
              .update({
                name: updatedOfficerRecord.name,
                username: updatedOfficerRecord.username,
                password: updatedOfficerRecord.password,
                badgeNumber: updatedOfficerRecord.badgeNumber,
                station: updatedOfficerRecord.station,
                rank: updatedOfficerRecord.rank,
                dateJoined: updatedOfficerRecord.dateJoined,
              })
              .eq("id", updatedOfficerRecord.id);

            if (error) {
              console.error("DB update failed", error);
              toast.error("DB update failed: " + (error.message || JSON.stringify(error)));
            } else {
              dbUpdated = true;
              toast.success("Officer details updated in database");
            }
          } else {
            // The record is local-only (temporary id). Try to insert it as a new DB row.
            try {
              const toInsert = { ...updatedOfficerRecord };
              // Remove temporary id before insert
              if (toInsert.id) delete (toInsert as any).id;
              const { data: inserted, error: insertErr } = await supabase
                .from("enforcers")
                .insert([toInsert])
                .select();

              if (insertErr) {
                console.error("DB insert for local record failed", insertErr);
                toast.error("Failed to persist local officer to DB: " + (insertErr.message || JSON.stringify(insertErr)));
              } else {
                dbUpdated = true;
                toast.success("Local officer persisted to database");
                // remove local override for this temp id below
                console.log('Inserted local -> DB row:', inserted);
              }
            } catch (insEx: any) {
              console.error("Exception inserting local officer", insEx);
              toast.error("Exception inserting local officer: " + (insEx.message || insEx));
            }
          }
        } catch (dbErr: any) {
          console.warn("Exception during DB update, saving locally", dbErr?.message || dbErr);
          toast.warning("Could not update database, changes saved locally");
        }

        if (dbUpdated) {
          // DB is now authoritative: remove any local override for this id
          const remaining = localCustom.filter((e: Enforcer) => e.id !== updatedOfficerRecord.id);
          localStorage.setItem("tms_custom_enforcers", JSON.stringify(remaining));
        } else {
          // Update in custom enforcers (keep local overrides in sync)
          const existingIndex = localCustom.findIndex((e: Enforcer) => e.id === editingOfficer.id);
          if (existingIndex > -1) {
            localCustom[existingIndex] = updatedOfficerRecord;
          } else {
            localCustom.push(updatedOfficerRecord);
          }
          localStorage.setItem("tms_custom_enforcers", JSON.stringify(localCustom));
        }
      } else {
        // Add flow
        const payload = { ...newOfficer };
        // Ensure password is set (required by DB schema)
        if (!payload.password) {
          payload.password = "password123"; // default password for new officers
        }
        // Try to insert into DB first
        try {
          const { data: insertedData, error: insertError } = await supabase
            .from("enforcers")
            .insert([payload])
            .select();

          if (insertError) {
            console.error("DB insert failed", insertError);
            // fallback to local-only storage
            const newEnforcerRecord = { id: `OFF-${Math.floor(10000 + Math.random() * 90000)}`, ...newOfficer };
            localCustom.push(newEnforcerRecord);
            localStorage.setItem("tms_custom_enforcers", JSON.stringify(localCustom));
            toast.success("Officer added locally (DB insert failed)");
          } else {
            // Insert succeeded — remove any pending local entry if present and rely on fetchEnforcers to show DB row
            const remaining = localCustom.filter((e: Enforcer) => e.username !== newOfficer.username);
            console.log('Inserted new enforcer:', insertedData);
            localStorage.setItem("tms_custom_enforcers", JSON.stringify(remaining));
            toast.success("Officer added to database");
          }
        } catch (insEx: any) {
          console.error("Exception inserting officer", insEx);
          const newEnforcerRecord = { id: `OFF-${Math.floor(10000 + Math.random() * 90000)}`, ...newOfficer };
          localCustom.push(newEnforcerRecord);
          localStorage.setItem("tms_custom_enforcers", JSON.stringify(localCustom));
          toast.success("Officer added locally (exception during DB insert)");
        }
      }

      setShowAddOfficerModal(false);
      setEditingOfficer(null);
      
      // Reset form
      setNewOfficer({
        name: "",
        username: "",
        password: "",
        badgeNumber: "",
        station: "",
        rank: "Traffic Enforcer I",
        dateJoined: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      });
      fetchEnforcers();
    } catch (e: any) {
      toast.error("Failed to save officer: " + e.message);
    } finally {
      setSavingOfficer(false);
    }
  };

  // Delete officer handler
  const handleDeleteOfficer = async (officerId: string) => {
    try {
      // Add to deleted IDs in local storage
      const localDeleted = JSON.parse(localStorage.getItem("tms_deleted_enforcer_ids") || "[]");
      if (!localDeleted.includes(officerId)) {
        localDeleted.push(officerId);
        localStorage.setItem("tms_deleted_enforcer_ids", JSON.stringify(localDeleted));
      }
      
      // Also remove from custom enforcers if it was there
      const localCustom = JSON.parse(localStorage.getItem("tms_custom_enforcers") || "[]");
      const updatedCustom = localCustom.filter((e: Enforcer) => e.id !== officerId);
      localStorage.setItem("tms_custom_enforcers", JSON.stringify(updatedCustom));
      
      // Try DB delete just in case
      await supabase.from("enforcers").delete().eq("id", officerId);
      
      toast.success("Officer deleted from directory");
      fetchEnforcers();
    } catch (e: any) {
      console.error(e);
      toast.error("Error deleting officer");
    }
  };

  // Toggle officer active status handler
  // Toggle officer active status handler (sync with Supabase)
  const handleToggleOfficerStatus = async (officerId: string) => {
    try {
      // Fetch current status from DB to avoid relying on local state
      const { data: currentRow, error: fetchErr } = await supabase
        .from("enforcers")
        .select("status")
        .eq("id", officerId)
        .single();

      if (fetchErr) throw fetchErr;

      const currentStatus: string = (currentRow && currentRow.status) || "active";
      const newStatus = currentStatus === "active" ? "inactive" : "active";

      // Update DB status
      const { error } = await supabase
        .from("enforcers")
        .update({ status: newStatus })
        .eq("id", officerId);

      if (error) throw error;

      // Keep localStorage in sync for existing client-side overrides
      const localInactive = JSON.parse(localStorage.getItem("tms_inactive_enforcer_ids") || "[]");
      if (newStatus === "inactive") {
        if (!localInactive.includes(officerId)) {
          localInactive.push(officerId);
          localStorage.setItem("tms_inactive_enforcer_ids", JSON.stringify(localInactive));
        }
        toast.success("Officer deactivated successfully");
      } else {
        const updated = localInactive.filter((id: string) => id !== officerId);
        localStorage.setItem("tms_inactive_enforcer_ids", JSON.stringify(updated));
        toast.success("Officer activated successfully");
      }

      // Refresh list from DB
      fetchEnforcers();
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to update officer status: " + (e.message || e));
    }
  };

  // Calculated stats
  const totalCollected = violations
    .filter(v => v.status === "paid")
    .reduce((sum, v) => sum + Number(v.totalAmount || 0), 0);

  const totalPending = violations
    .filter(v => v.status === "pending")
    .reduce((sum, v) => sum + Number(v.totalAmount || 0), 0);

  // Filtered lists
  const filteredViolations = violations.filter(v => {
    const matchesSearch =
      v.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.plateNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.referenceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.location?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || v.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredEnforcers = enforcers.filter(e =>
    e.name?.toLowerCase().includes(officerSearchQuery.toLowerCase()) ||
    e.badgeNumber?.toLowerCase().includes(officerSearchQuery.toLowerCase()) ||
    e.station?.toLowerCase().includes(officerSearchQuery.toLowerCase())
  );

  if (!isLoggedIn) {
    return (
      <>
        <Toaster position="top-right" theme={isDark ? "dark" : "light"} />
        <LoginPage
          username={username}
          password={password}
          setUsername={setUsername}
          setPassword={setPassword}
          handleLogin={handleLogin}
        />
      </>
    );
  }

  // PORTAL DASHBOARD RENDER
  return (
    <div className="layout-wrapper">
      <Toaster position="top-right" theme={isDark ? "dark" : "light"} />
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="flex items-center gap-3 mb-2 sidebar-logo px-1">
          <img src="/LGU-logo-big.png" alt="LGU Logo" className="sidebar-logo-img w-12 h-auto object-contain drop-shadow-sm" />
          <span className="font-bold text-lg text-foreground sidebar-logo-text">TMS Admin</span>
        </div>

        {/* top area intentionally left minimal; profile moved to footer */}

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "dashboard"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="nav-text">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab("violations")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "violations"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="nav-text">Violation Reports</span>
          </button>

          <button
            onClick={() => setActiveTab("officers")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "officers"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="nav-text">Officers Directory</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "reports"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="nav-text">Reports</span>
          </button>
          <button onClick={toggleTheme} className="mobile-nav-action" title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
          </button>
          <button onClick={() => setShowLogoutConfirm(true)} className="mobile-nav-action mobile-nav-logout" title="Logout">
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </nav>

        <div className="mt-auto space-y-2">
          {/* Admin profile summary */}
          <div className="px-3 py-2 rounded-md bg-muted/10 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center">{(adminDisplayName || "A").charAt(0)}</div>
              <div className="flex-1">
                <div className="font-semibold text-foreground">{adminDisplayName || "Portal Admin"}</div>
                <div className="text-xs text-muted-foreground">Signed In</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="top-nav">
          <div className="top-nav-brand">
            <span className="top-nav-eyebrow">Traffic Management System</span>
            <strong>Admin Portal</strong>
          </div>
          <div className="top-nav-actions">
            <button onClick={toggleTheme} className="theme-toggle-btn top-nav-button" title={isDark ? "Switch to light mode" : "Switch to dark mode"} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="top-nav-button top-nav-logout"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
        {/* Header */}
        <div className="main-content-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {activeTab === "dashboard" ? "Dashboard" : activeTab === "violations" ? "Violation Records" : activeTab === "officers" ? "Officers Directory" : "Reports"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {activeTab === "dashboard"
                ? "Review traffic enforcement activity and performance analytics."
                : activeTab === "violations" 
                ? "Track, search, and verify payment states of enforcer reports." 
                : activeTab === "officers" 
                  ? "Manage and authorize enforcer personnel active directory." 
                  : "Generate financial and violation reports by year, officer, and month."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === "violations" ? (
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); fetchViolations(); }} className="btn btn-secondary text-sm">
                Refresh Records
              </button>
            ) : activeTab === "officers" ? (
              <button onClick={() => setShowAddOfficerModal(true)} className="btn btn-primary">
                <Plus className="w-4 h-4" /> Add Officer
              </button>
            ) : null}
          </div>
        </div>

        {activeTab === "dashboard" && (
          <Dashboard
            violations={violations}
            enforcers={enforcers}
            loading={violationsLoading || officersLoading}
          />
        )}

        {/* Statistical Summary Cards */}
        {activeTab === "violations" && (
          <div className="screen-only grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="stat-card">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Total Reports</p>
                <h3 className="text-3xl font-bold mt-1 text-foreground">{violations.length}</h3>
              </div>
              <div className="icon-container bg-blue-500/10 text-blue-500">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            <div className="stat-card">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Pending Penalties</p>
                <h3 className="text-3xl font-bold mt-1 text-amber-500">
                  ₱{totalPending.toLocaleString()}
                </h3>
              </div>
              <div className="icon-container bg-amber-500/10 text-amber-500">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="stat-card">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Collected Revenue</p>
                <h3 className="text-3xl font-bold mt-1 text-emerald-500">
                  ₱{totalCollected.toLocaleString()}
                </h3>
              </div>
              <div className="icon-container bg-emerald-500/10 text-emerald-500">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="stat-card">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Active Officers</p>
                <h3 className="text-3xl font-bold mt-1 text-blue-400">{enforcers.length}</h3>
              </div>
              <div className="icon-container bg-blue-500/10 text-blue-400">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="screen-only">
            <Reports />
          </div>
        )}

        {/* VIOLATIONS TAB */}
        {activeTab === "violations" && (
          <div className="violation-report-card card pt-5">
            {/* Filter Tools */}
            <div className="violation-filter-tools flex flex-col md:flex-row gap-4 p-5 pb-0">
              <div className="flex-1">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search driver name, plate number, or reference number..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-group">
                {(["all", "pending", "paid"] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`filter-btn ${statusFilter === filter ? "active" : ""}`}
                  >
                    {filter}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePrintViolations}
                  className="btn btn-secondary print-button"
                  title={`Print ${statusFilter === "all" ? "all" : statusFilter} filtered violation records`}
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </div>

            <div className="print-report-header">
              <h1>Traffic Violation Report</h1>
              <p>Status: {statusFilter.toUpperCase()} {searchQuery ? ` | Search: ${searchQuery}` : ""}</p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mt-4">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference No.</th>
                    <th>Driver Name</th>
                    <th>Plate Number</th>
                    <th>Date & Time</th>
                    <th className="text-right">Amount</th>
                    <th className="text-center">Status</th>
                    <th className="text-center print-hide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {violationsLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Synchronizing real-time logs...
                      </td>
                    </tr>
                  ) : filteredViolations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No violation records match your query
                      </td>
                    </tr>
                  ) : (
                    filteredViolations.map(record => (
                      <tr key={record.id}>
                        <td className="font-mono text-xs text-blue-400">{record.referenceNumber}</td>
                        <td className="font-medium text-foreground">{record.driverName}</td>
                        <td className="font-mono text-xs text-foreground">{record.plateNumber}</td>
                        <td className="text-muted-foreground text-sm">
                          {record.violationDate} at {record.violationTime}
                        </td>
                        <td className="text-right font-bold text-foreground">
                          ₱{Number(record.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="text-center print-hide">
                          <span className={`badge ${record.status === "paid" ? "badge-paid" : "badge-pending"}`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewViolation(record.id)}
                              disabled={loadingDetails === record.id}
                              className="btn btn-secondary py-1.5 px-3 text-xs"
                            >
                              {loadingDetails === record.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <FileText className="w-4 h-4" />
                                  View
                                </>
                              )}
                            </button>
                            {record.status === "pending" && (
                              <button
                                onClick={() => handleMarkAsPaid(record.id)}
                                disabled={updatingPaymentId === record.id}
                                className="btn py-1.5 px-3 text-xs bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                              >
                                {updatingPaymentId === record.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Mark Paid
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* OFFICERS TAB */}
        {activeTab === "officers" && (
          <div className="screen-only card mt-5">
            <div className="pt-5 pb-0">
              <input
                type="text"
                className="input-field"
                placeholder="Search by officer name, badge number, station..."
                value={officerSearchQuery}
                onChange={e => setOfficerSearchQuery(e.target.value)}
              />
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Officer ID</th>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>Badge Number</th>
                    <th>Assigned Station</th>
                    <th>Rank</th>
                    <th>Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {officersLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Fetching personnel directory...
                      </td>
                    </tr>
                  ) : filteredEnforcers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No enforcer matches found
                      </td>
                    </tr>
                  ) : (
                    filteredEnforcers.map(officer => (
                      <tr key={officer.id} className={officer.status === "inactive" ? "opacity-60" : ""}>
                        <td className="font-mono text-xs text-blue-400 font-semibold">
                          {officer.id}
                        </td>
                        <td className="font-medium text-foreground">{officer.name}</td>
                        <td className="text-muted-foreground">{officer.username}</td>
                        <td className="font-mono text-xs text-foreground">{officer.badgeNumber}</td>
                        <td className="text-muted-foreground">{officer.station}</td>
                        <td className="text-muted-foreground">{officer.rank}</td>
                        <td>
                          <span className={`badge ${officer.status === "active" ? "badge-paid" : "badge-pending"}`}>
                            {officer.status || "active"}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingOfficer(officer);
                                setNewOfficer({
                                  name: officer.name,
                                  username: officer.username,
                                  password: officer.password || "",
                                  badgeNumber: officer.badgeNumber,
                                  station: officer.station,
                                  rank: officer.rank,
                                  dateJoined: officer.dateJoined,
                                });
                                setShowAddOfficerModal(true);
                              }}
                              className="btn btn-secondary py-1.5 px-3 text-xs"
                            >
                              Edit
                            </button>
                            
                            {!officer.isSystemAdmin && (
                              <>
                                <button
                                  onClick={() => handleToggleOfficerStatus(officer.id)}
                                  className={`btn py-1.5 px-3 text-xs transition-colors ${
                                    officer.status === "active"
                                      ? "bg-amber-600/10 text-amber-500 hover:bg-amber-600/20"
                                      : "bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20"
                                  }`}
                                >
                                  {officer.status === "active" ? "Deactivate" : "Activate"}
                                </button>
                                
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete ${officer.name}?`)) {
                                      handleDeleteOfficer(officer.id);
                                    }
                                  }}
                                  className="btn btn-danger py-1.5 px-3 text-xs bg-red-600/10 text-red-500 hover:bg-red-600/20"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-content w-full max-w-md space-y-5" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-xl font-bold text-foreground">Confirm Logout</h3>
              <p className="text-sm text-muted-foreground mt-2">Are you sure you want to sign out of the admin portal?</p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="btn btn-secondary">Cancel</button>
              <button type="button" onClick={handleLogout} className="btn btn-danger">Logout</button>
            </div>
          </div>
        </div>
      )}

      {/* VIOLATION DETAILS MODAL */}
      {selectedViolation && (
        <div className="modal-overlay" onClick={() => setSelectedViolation(null)}>
          <div className="modal-content w-full max-w-3xl max-h-[90vh] overflow-y-auto p-10 space-y-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
              <div>
                <h3 className="text-xl font-bold text-foreground">Violation Audit File</h3>
                <p className="text-xs text-blue-400 font-mono mt-1">Ref: {selectedViolation.referenceNumber}</p>
              </div>
              <button
                onClick={() => setSelectedViolation(null)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Driver & Vehicle Details */}
              <div className="space-y-5">
                <div className="modal-section space-y-4">
                  <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                    <User className="w-4 h-4" /> Driver Details
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Name:</span> <span className="font-semibold text-foreground">{selectedViolation.driverName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">License ID:</span> <span className="font-mono text-foreground">{selectedViolation.licenseNumber}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Birthdate:</span> <span className="text-foreground">{selectedViolation.driverBirthdate}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Address:</span> <span className="text-foreground text-right max-w-[180px]">{selectedViolation.driverAddress}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Contact:</span> <span className="text-foreground">{selectedViolation.contactNumber || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{selectedViolation.email || "N/A"}</span></div>
                  </div>
                </div>

                <div className="modal-section space-y-4">
                  <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                    <Car className="w-4 h-4" /> Vehicle Details
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Plate Number:</span> <span className="font-mono font-semibold text-foreground">{selectedViolation.plateNumber}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Vehicle Type:</span> <span className="text-foreground">{selectedViolation.vehicleType}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Number of Wheels:</span> <span className="text-foreground">{selectedViolation.numberOfWheels ?? "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Reg. Number:</span> <span className="font-mono text-foreground">{selectedViolation.registrationNumber || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Owner Name:</span> <span className="text-foreground">{selectedViolation.ownerName || "N/A"}</span></div>
                  </div>
                </div>

                <div className="modal-section space-y-4">
                  <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                    <Info className="w-4 h-4" /> Log Metadata
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Officer ID:</span> <span className="font-mono text-foreground">{selectedViolation.officerId}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Recorded At:</span> <span className="text-foreground">{new Date(selectedViolation.createdAt).toLocaleString()}</span></div>
                  </div>
                </div>
              </div>

              {/* Offenses, Photos & Status */}
              <div className="space-y-5">
                <div className="modal-section space-y-4">
                  <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                    <FileText className="w-4 h-4" /> Violations & Fines
                  </div>
                  <div className="space-y-3 max-h-[160px] overflow-y-auto">
                    {selectedViolation.violations?.map((v: any, index: number) => (
                      <div key={index} className="flex justify-between items-center text-xs p-2.5 bg-card rounded-lg">
                        <div>
                          <p className="font-medium text-foreground">{typeof v === 'string' ? v : v.name}</p>
                          {v.severity && <p className="text-[10px] text-amber-500 uppercase font-semibold mt-0.5">{v.severity}</p>}
                        </div>
                        <p className="font-bold text-foreground">₱{Number(v.fine || 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-4" style={{ borderTop: '1px solid hsl(var(--border) / 0.3)' }}>
                    <span className="text-xs text-muted-foreground font-semibold uppercase">Total Penalty Due:</span>
                    <span className="text-lg font-bold text-foreground">₱{Number(selectedViolation.totalAmount || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="modal-section space-y-4">
                  <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                    <MapPin className="w-4 h-4" /> Offense Event Details
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Date/Time:</span> <span className="text-foreground">{selectedViolation.violationDate} at {selectedViolation.violationTime}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Location:</span> <span className="text-foreground text-right max-w-[200px]">{selectedViolation.location}</span></div>
                    {selectedViolation.officerNotes && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid hsl(var(--border) / 0.3)' }}>
                        <span className="text-muted-foreground block mb-1">Officer Notes:</span>
                        <p className="text-muted-foreground bg-card p-2.5 rounded-lg text-[11px] font-mono leading-relaxed">{selectedViolation.officerNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence/Image Storage Display */}
            {(selectedViolation.vehicleImage || selectedViolation.plateImage || selectedViolation.signature) && (
              <div className="modal-section space-y-3">
                <div className="text-blue-400 font-medium text-sm">Evidence Vault</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedViolation.vehicleImage && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Vehicle Image</span>
                      <img src={selectedViolation.vehicleImage} alt="Vehicle" className="w-full h-32 object-cover rounded-lg" />
                    </div>
                  )}
                  {selectedViolation.plateImage && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Plate Image</span>
                      <img src={selectedViolation.plateImage} alt="Plate" className="w-full h-32 object-cover rounded-lg" />
                    </div>
                  )}
                  {selectedViolation.signature && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Driver Signature</span>
                      <div className="bg-white p-2 rounded-lg flex items-center justify-center h-32">
                        <img src={selectedViolation.signature} alt="Signature" className="max-h-full object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid hsl(var(--border) / 0.3)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase font-bold">Status:</span>
                <span className={`badge ${selectedViolation.status === "paid" ? "badge-paid" : "badge-pending"}`}>
                  {selectedViolation.status}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedViolation(null)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
                {selectedViolation.status === "pending" && (
                  <button
                    onClick={() => handleMarkAsPaid(selectedViolation.id)}
                    disabled={updatingPaymentId === selectedViolation.id}
                    className="btn bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                  >
                    {updatingPaymentId === selectedViolation.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Verify and Mark as Paid
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT OFFICER MODAL */}
      {showAddOfficerModal && (
        <div className="modal-overlay" onClick={() => {
          setShowAddOfficerModal(false);
          setEditingOfficer(null);
          setNewOfficer({
            name: "",
            username: "",
            password: "",
            badgeNumber: "",
            station: "",
            rank: "Traffic Enforcer I",
            dateJoined: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          });
        }}>
          <div className="modal-content w-full max-w-md p-10 space-y-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
              <h3 className="text-xl font-bold text-foreground">
                {editingOfficer ? "Edit Enforcer Profile" : "Register Enforcer"}
              </h3>
              <button
                onClick={() => {
                  setShowAddOfficerModal(false);
                  setEditingOfficer(null);
                  setNewOfficer({
                    name: "",
                    username: "",
                    password: "",
                    badgeNumber: "",
                    station: "",
                    rank: "Traffic Enforcer I",
                    dateJoined: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                  });
                }}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOfficer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold uppercase">Officer Full Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Officer John Doe"
                  value={newOfficer.name}
                  onChange={e => setNewOfficer(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold uppercase">Badge Number</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. TM-2026-9876"
                  value={newOfficer.badgeNumber}
                  onChange={e => setNewOfficer(prev => ({ ...prev, badgeNumber: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold uppercase">Assigned Station / Division</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. District IV Traffic Division"
                  value={newOfficer.station}
                  onChange={e => setNewOfficer(prev => ({ ...prev, station: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold uppercase">Enforcer Rank</label>
                <select
                  className="input-field"
                  value={newOfficer.rank}
                  onChange={e => setNewOfficer(prev => ({ ...prev, rank: e.target.value }))}
                >
                  <option value="Traffic Enforcer I">Traffic Enforcer I</option>
                  <option value="Traffic Enforcer II">Traffic Enforcer II</option>
                  <option value="Traffic Enforcer III">Traffic Enforcer III</option>
                  <option value="Senior Inspector">Senior Inspector</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-semibold uppercase">Username</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. jdoe99"
                    value={newOfficer.username}
                    onChange={e => setNewOfficer(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-semibold uppercase">Password / Key</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. pass123"
                    value={newOfficer.password}
                    onChange={e => setNewOfficer(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4" style={{ borderTop: '1px solid hsl(var(--border) / 0.3)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddOfficerModal(false);
                    setEditingOfficer(null);
                    setNewOfficer({
                      name: "",
                      username: "",
                      password: "",
                      badgeNumber: "",
                      station: "",
                      rank: "Traffic Enforcer I",
                      dateJoined: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                    });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOfficer}
                  className="btn btn-primary"
                >
                  {savingOfficer ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : editingOfficer ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {editingOfficer ? "Save Changes" : "Register Officer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
