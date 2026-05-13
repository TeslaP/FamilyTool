# Phase 3: Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete React frontend — login, navigation shell, dashboard with drilldowns, import page with preview/confirm, review queue with inline editing and rule creation, and forecast view.

**Architecture:** React 18 SPA with React Router, Tailwind CSS for styling, shadcn/ui components, Recharts for charts. Communicates with the Express backend via `/api` proxy. JWT stored in localStorage.

**Tech Stack:** React 18, TypeScript, React Router 6, Tailwind CSS, shadcn/ui, Recharts, Vite

---

## File Structure (Phase 3)

```
client/src/
├── main.tsx
├── App.tsx                       # Root with AuthProvider + Router
├── index.css                     # Tailwind directives
├── lib/
│   └── utils.ts                  # cn() helper for class merging
├── api/
│   └── client.ts                 # Fetch wrapper with JWT auth
├── hooks/
│   ├── useAuth.ts                # Auth context + token management
│   └── useApi.ts                 # Data fetching hook
├── components/
│   ├── Layout.tsx                # Nav shell (sidebar + main content)
│   ├── MonthSelector.tsx         # Month picker (prev/next/current)
│   ├── MetricCard.tsx            # Key metric display card
│   ├── Breadcrumb.tsx            # Drilldown breadcrumb trail
│   ├── CategoryDropdown.tsx      # Category selector (hierarchical)
│   ├── FileDropZone.tsx          # Drag-and-drop file upload
│   └── EmptyState.tsx            # Empty state with guidance
├── pages/
│   ├── Login.tsx                 # Login form
│   ├── Dashboard.tsx             # Main dashboard with metrics + charts
│   ├── DashboardDrilldown.tsx    # Category/merchant drilldown view
│   ├── Import.tsx                # File upload + preview + confirm
│   ├── Review.tsx                # Transaction review queue
│   └── Forecast.tsx              # Budget forecast view
└── types/
    └── index.ts                  # Shared TypeScript interfaces
```

---

## Task 1: Shared Types, API Client & Auth

**Files:**
- Create: `client/src/types/index.ts`
- Create: `client/src/api/client.ts`
- Create: `client/src/hooks/useAuth.ts`
- Create: `client/src/lib/utils.ts`

- [ ] **Step 1: Install shadcn/ui dependencies**

```bash
cd /Users/pteslenko/Familytool && npm install clsx tailwind-merge class-variance-authority lucide-react -w client
```

- [ ] **Step 2: Create utility helper (client/src/lib/utils.ts)**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getPreviousMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  if (m === 1) return `${year - 1}-12`;
  return `${year}-${String(m - 1).padStart(2, "0")}`;
}

export function getNextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  if (m === 12) return `${year + 1}-01`;
  return `${year}-${String(m + 1).padStart(2, "0")}`;
}
```

- [ ] **Step 3: Create shared types (client/src/types/index.ts)**

```typescript
export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  type: "income" | "expense" | "transfer";
  sortOrder: number;
  isActive: number;
}

export interface Transaction {
  id: number;
  sourceFileId: number;
  transactionDate: string;
  valueDate: string;
  amount: number;
  direction: "income" | "expense" | "transfer";
  startBalance: number;
  endBalance: number;
  rawDescription: string;
  merchantName: string | null;
  categoryId: number | null;
  isRecurring: number;
  fingerprint: string;
  confidence: number;
  categorisationMethod: "ai" | "rule" | "manual" | "failed" | null;
  isReviewed: number;
  createdAt: string;
}

export interface ImportPreview {
  rowCount: number;
  newCount: number;
  duplicateCount: number;
  dateRange: { from: string | null; to: string | null };
  transactions: PreviewTransaction[];
}

export interface PreviewTransaction {
  transactionDate: string;
  valueDate: string;
  amount: number;
  direction: "income" | "expense" | "transfer";
  startBalance: number;
  endBalance: number;
  rawDescription: string;
  fingerprint: string;
  isDuplicate: boolean;
  ruleMatch: {
    merchantName: string;
    categoryId: number;
    direction: string;
    confidence: number;
  } | null;
}

export interface ImportResult {
  imported: number;
  duplicatesSkipped: number;
  aiCategorised: number;
  aiFailed: number;
  fileName: string;
}

export interface MonthlyAggregates {
  month: string;
  categoryId: number;
  income: number;
  expense: number;
  transferOut: number;
  recurringAmount: number;
  transactionCount: number;
}

export interface SummaryData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  totalTransfers: number;
  netCashflow: number;
  categoryBreakdown: { category: string; amount: number; direction: string }[];
  previousMonth: { totalIncome: number; totalExpenses: number } | null;
}

export interface SummaryResponse {
  summary: string;
  data: SummaryData;
}
```

- [ ] **Step 4: Create API client (client/src/api/client.ts)**

```typescript
const API_BASE = "/api";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem("token");
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
      this.setToken(null);
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  async login(username: string, password: string): Promise<string> {
    const { token } = await this.request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.setToken(token);
    return token;
  }

  logout() {
    this.setToken(null);
  }

  async getCategories() {
    return this.request<import("../types").Category[]>("/categories");
  }

  async getTransactions(params: { month?: string; needsReview?: boolean } = {}) {
    const query = new URLSearchParams();
    if (params.month) query.set("month", params.month);
    if (params.needsReview) query.set("needsReview", "true");
    return this.request<import("../types").Transaction[]>(`/transactions?${query}`);
  }

  async updateTransaction(id: number, data: { categoryId?: number; merchantName?: string; direction?: string }) {
    return this.request<import("../types").Transaction>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async createRule(transactionId: number, data: { matchType: string; matchValue: string }) {
    return this.request<any>(`/transactions/${transactionId}/create-rule`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async importPreview(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return this.request<import("../types").ImportPreview>("/import/preview", {
      method: "POST",
      body: formData,
    });
  }

  async importConfirm(fileName: string, transactions: any[]) {
    return this.request<import("../types").ImportResult>("/import/confirm", {
      method: "POST",
      body: JSON.stringify({ fileName, transactions }),
    });
  }

  async generateSummary(month: string) {
    return this.request<import("../types").SummaryResponse>("/summary/generate", {
      method: "POST",
      body: JSON.stringify({ month }),
    });
  }
}

export const api = new ApiClient();
```

- [ ] **Step 5: Create auth hook (client/src/hooks/useAuth.ts)**

```typescript
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "../api/client";

interface AuthContext {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!api.getToken());

  const login = async (username: string, password: string) => {
    await api.login(username, password);
    setIsAuthenticated(true);
  };

  const logout = () => {
    api.logout();
    setIsAuthenticated(false);
  };

  return (
    <AuthCtx.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthContext {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 6: Commit**

```bash
git add client/src/
git commit -m "feat: shared types, API client, and auth hook"
```

---

## Task 2: Login Page & Navigation Shell

**Files:**
- Rewrite: `client/src/App.tsx`
- Create: `client/src/pages/Login.tsx`
- Create: `client/src/components/Layout.tsx`

- [ ] **Step 1: Create Login page (client/src/pages/Login.tsx)**

```typescript
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Family Finance</h1>
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Layout shell (client/src/components/Layout.tsx)**

```typescript
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LayoutDashboard, Upload, CheckSquare, TrendingUp, LogOut } from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/import", icon: Upload, label: "Import" },
  { to: "/review", icon: CheckSquare, label: "Review" },
  { to: "/forecast", icon: TrendingUp, label: "Forecast" },
];

export function Layout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-semibold text-gray-900">Family Finance</h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                  isActive ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t">
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 w-full"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite App.tsx with auth routing**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Import } from "./pages/Import";
import { Review } from "./pages/Review";
import { Forecast } from "./pages/Forecast";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<Import />} />
        <Route path="/review" element={<Review />} />
        <Route path="/forecast" element={<Forecast />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Create placeholder pages**

Create minimal placeholder components for Dashboard, Import, Review, Forecast that just show a heading. They'll be implemented in subsequent tasks.

`client/src/pages/Dashboard.tsx`:
```typescript
export function Dashboard() {
  return <div className="p-6"><h2 className="text-xl font-semibold">Dashboard</h2><p className="text-gray-500 mt-2">Coming in next task.</p></div>;
}
```

`client/src/pages/Import.tsx`:
```typescript
export function Import() {
  return <div className="p-6"><h2 className="text-xl font-semibold">Import</h2><p className="text-gray-500 mt-2">Coming in next task.</p></div>;
}
```

`client/src/pages/Review.tsx`:
```typescript
export function Review() {
  return <div className="p-6"><h2 className="text-xl font-semibold">Review</h2><p className="text-gray-500 mt-2">Coming in next task.</p></div>;
}
```

`client/src/pages/Forecast.tsx`:
```typescript
export function Forecast() {
  return <div className="p-6"><h2 className="text-xl font-semibold">Forecast</h2><p className="text-gray-500 mt-2">Coming in next task.</p></div>;
}
```

- [ ] **Step 5: Verify in browser**

Start `npm run dev` and verify:
- `/login` shows login form
- Login with admin/changeme redirects to dashboard
- Sidebar navigation works
- Logout returns to login

- [ ] **Step 6: Commit**

```bash
git add client/src/
git commit -m "feat: login page, navigation shell, and protected routing"
```

---

## Task 3: Dashboard — Metrics & Charts

**Files:**
- Rewrite: `client/src/pages/Dashboard.tsx`
- Create: `client/src/components/MonthSelector.tsx`
- Create: `client/src/components/MetricCard.tsx`
- Create: `client/src/hooks/useApi.ts`

- [ ] **Step 1: Install Recharts**

```bash
cd /Users/pteslenko/Familytool && npm install recharts -w client
```

- [ ] **Step 2: Create useApi hook (client/src/hooks/useApi.ts)**

```typescript
import { useState, useEffect, useCallback } from "react";

export function useApi<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}
```

- [ ] **Step 3: Create MonthSelector (client/src/components/MonthSelector.tsx)**

```typescript
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth, getPreviousMonth, getNextMonth, getCurrentMonth } from "../lib/utils";

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export function MonthSelector({ month, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(getPreviousMonth(month))} className="p-1 hover:bg-gray-100 rounded">
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-medium min-w-[140px] text-center">{formatMonth(month)}</span>
      <button onClick={() => onChange(getNextMonth(month))} className="p-1 hover:bg-gray-100 rounded" disabled={month >= getCurrentMonth()}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create MetricCard (client/src/components/MetricCard.tsx)**

```typescript
import { cn } from "../lib/utils";

interface Props {
  label: string;
  value: string;
  change?: { value: string; positive: boolean } | null;
  className?: string;
}

export function MetricCard({ label, value, change, className }: Props) {
  return (
    <div className={cn("bg-white border rounded-lg p-4", className)}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
      {change && (
        <p className={cn("text-xs mt-1", change.positive ? "text-green-600" : "text-red-600")}>
          {change.positive ? "+" : ""}{change.value} vs last month
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement Dashboard page**

`client/src/pages/Dashboard.tsx` — full implementation with:
- MonthSelector at top
- 4 MetricCards (income, expenses, net cashflow, savings rate)
- Spending by category bar chart (Recharts BarChart)
- Income vs expenses trend line chart (last 6 months)
- Top merchants list
- AI summary section (with generate button)
- All data fetched from `/api/transactions` and `/api/summary/generate`

The dashboard should:
- Use `useApi` to fetch transactions for the selected month
- Calculate metrics from the transaction data client-side
- Group transactions by category for the bar chart
- Show empty state when no data

- [ ] **Step 6: Verify in browser**

- Dashboard shows metrics and charts
- Month selector navigates between months
- Empty months show empty state
- Charts are readable and clickable

- [ ] **Step 7: Commit**

```bash
git add client/src/
git commit -m "feat: dashboard with metrics, charts, and month navigation"
```

---

## Task 4: Dashboard Drilldown

**Files:**
- Create: `client/src/pages/DashboardDrilldown.tsx`
- Create: `client/src/components/Breadcrumb.tsx`
- Modify: `client/src/App.tsx` (add drilldown route)

- [ ] **Step 1: Create Breadcrumb (client/src/components/Breadcrumb.tsx)**

```typescript
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} />}
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-gray-900">{crumb.label}</Link>
          ) : (
            <span className="text-gray-900 font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create DashboardDrilldown page**

This page handles URL params to show:
- `/dashboard/category/:id` — subcategory or merchant breakdown
- `/dashboard/merchant/:name` — individual transactions for a merchant

Uses `useSearchParams` for month, reads category/merchant from URL params. Shows a table of transactions at the leaf level, or a breakdown chart at intermediate levels.

- [ ] **Step 3: Add route to App.tsx**

```typescript
<Route path="/dashboard/category/:categoryId" element={<DashboardDrilldown />} />
<Route path="/dashboard/merchant/:merchantName" element={<DashboardDrilldown />} />
```

- [ ] **Step 4: Update Dashboard charts to link to drilldowns**

Bar chart categories link to `/dashboard/category/:id?month=...`
Top merchants link to `/dashboard/merchant/:name?month=...`

- [ ] **Step 5: Verify in browser**

- Click a category → shows subcategory/merchant breakdown
- Click a merchant → shows individual transactions
- Breadcrumb navigation works
- Back button works naturally

- [ ] **Step 6: Commit**

```bash
git add client/src/
git commit -m "feat: dashboard drilldown navigation with breadcrumbs"
```

---

## Task 5: Import Page

**Files:**
- Rewrite: `client/src/pages/Import.tsx`
- Create: `client/src/components/FileDropZone.tsx`

- [ ] **Step 1: Create FileDropZone (client/src/components/FileDropZone.tsx)**

```typescript
import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { cn } from "../lib/utils";

interface Props {
  onFile: (file: File) => void;
  accept: string;
  disabled?: boolean;
}

export function FileDropZone({ onFile, accept, disabled }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
        dragging ? "border-gray-900 bg-gray-50" : "border-gray-300 hover:border-gray-400",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Upload className="mx-auto mb-2 text-gray-400" size={24} />
      <p className="text-sm text-gray-600">Drop a .TAB or .XLS file here</p>
      <p className="text-xs text-gray-400 mt-1">or click to browse</p>
      <input type="file" accept={accept} onChange={handleChange} className="hidden" id="file-input" disabled={disabled} />
      <label htmlFor="file-input" className="absolute inset-0 cursor-pointer" />
    </div>
  );
}
```

- [ ] **Step 2: Implement Import page**

Full flow:
1. File drop zone (idle state)
2. After file selected → call `/api/import/preview` → show preview (row count, date range, duplicates, estimated categories)
3. Preview shows a summary table and confirm/cancel buttons
4. On confirm → call `/api/import/confirm` → show results (imported, duplicates skipped, AI categorised, failed)
5. Results state shows link to Review page for failed items

States: idle → previewing (loading) → preview → confirming (loading) → done

- [ ] **Step 3: Verify in browser**

- Drop a .TAB file → shows preview
- Cancel returns to idle
- Confirm shows results
- Duplicate detection visible in preview
- Link to Review works

- [ ] **Step 4: Commit**

```bash
git add client/src/
git commit -m "feat: import page with file drop, preview, and confirm flow"
```

---

## Task 6: Review Page

**Files:**
- Rewrite: `client/src/pages/Review.tsx`
- Create: `client/src/components/CategoryDropdown.tsx`

- [ ] **Step 1: Create CategoryDropdown (client/src/components/CategoryDropdown.tsx)**

Hierarchical dropdown that shows parent > child categories. Groups by parent, shows children indented.

```typescript
import { useMemo } from "react";
import type { Category } from "../types";

interface Props {
  categories: Category[];
  value: number | null;
  onChange: (categoryId: number) => void;
}

export function CategoryDropdown({ categories, value, onChange }: Props) {
  const grouped = useMemo(() => {
    const parents = categories.filter((c) => !c.parentId);
    return parents.map((parent) => ({
      parent,
      children: categories.filter((c) => c.parentId === parent.id),
    }));
  }, [categories]);

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className="text-sm border rounded px-2 py-1 w-full"
    >
      <option value="">— Select —</option>
      {grouped.map(({ parent, children }) => (
        <optgroup key={parent.id} label={parent.name}>
          {children.map((child) => (
            <option key={child.id} value={child.id}>{child.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Implement Review page**

- Fetches transactions with `needsReview=true` for the selected month
- Table columns: date, description, amount, category (editable dropdown), merchant (editable text), confidence, actions
- Inline editing: click category → dropdown appears → select → saves via PATCH
- Inline editing: click merchant → text input → blur/enter saves
- "Save as rule" button on each row → calls create-rule API
- Bulk select + assign category
- Filter controls: month selector, category filter, confidence threshold
- Shows count of items remaining

- [ ] **Step 3: Verify in browser**

- Review shows uncategorised transactions
- Category can be changed inline
- Merchant can be edited
- "Save as rule" creates a rule
- Bulk actions work
- List updates after edits

- [ ] **Step 4: Commit**

```bash
git add client/src/
git commit -m "feat: review page with inline editing and rule creation"
```

---

## Task 7: Forecast Page

**Files:**
- Rewrite: `client/src/pages/Forecast.tsx`

- [ ] **Step 1: Implement Forecast page**

Layout:
- Header with "Next Month Forecast" and the month
- Key number prominently displayed: **"Remaining after fixed costs: €X"**
- Three sections:
  1. Fixed costs (recurring) — list with amounts, total
  2. Variable costs (projected from 3-month average) — list with amounts, total  
  3. Summary: projected income − fixed − variable = remaining

Data sources:
- Fetch transactions from last 3 months to calculate averages
- Identify recurring transactions (isRecurring = 1) for fixed costs
- Group by category, calculate averages for variable
- Show monthly budgets if user has overridden any
- Bottom: savings/investment goal progress if configured

Each row is editable (user can override the projected amount for a category).

- [ ] **Step 2: Verify in browser**

- Shows next month's forecast
- Fixed costs listed separately from variable
- "Remaining" number is prominent
- Amounts are editable
- Empty state shown when no historical data

- [ ] **Step 3: Commit**

```bash
git add client/src/
git commit -m "feat: forecast page with fixed/variable breakdown and budget overrides"
```

---

## Task 8: Empty States & Polish

**Files:**
- Create: `client/src/components/EmptyState.tsx`
- Modify: all pages to use empty states
- Polish: spacing, typography, responsive tweaks

- [ ] **Step 1: Create EmptyState component**

```typescript
import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="text-center py-12">
      {icon && <div className="text-gray-300 mb-3 flex justify-center">{icon}</div>}
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Add empty states to all pages**

- Dashboard: "No transactions yet. Import a bank export to get started." with link to Import
- Review: "All caught up! No transactions need review." (success state)
- Forecast: "Import at least 2 months of data to see forecasts."

- [ ] **Step 3: Polish pass**

- Ensure consistent spacing across pages
- Check table alignment and readability
- Verify mobile doesn't completely break (basic responsive)
- Check color contrast and text sizes
- Verify keyboard navigation works on forms

- [ ] **Step 4: Commit**

```bash
git add client/src/
git commit -m "feat: empty states and UI polish"
```

---

## Task 9: Integration Test & Final Verification

- [ ] **Step 1: Start dev server and test full flow**

```bash
npm run dev
```

Test the golden path in browser:
1. Login with admin/changeme
2. See empty dashboard
3. Navigate to Import
4. Upload samples/test-3rows.tab
5. See preview with 3 rows
6. Confirm import
7. See results (3 imported, 3 AI failed)
8. Navigate to Review
9. See 3 transactions needing review
10. Categorise one (change category via dropdown)
11. Save as rule
12. Navigate to Dashboard
13. See metrics update
14. Click category for drilldown
15. Navigate back via breadcrumb
16. Check Forecast page

- [ ] **Step 2: Run server tests to ensure nothing broke**

```bash
npm test -w server -- --run
```

- [ ] **Step 3: Build client to verify no TypeScript errors**

```bash
npm run build -w client
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 3 complete — full frontend with all views"
```

---

## Phase 3 Deliverables

After completing all tasks:

- Login page with JWT auth
- Navigation shell with sidebar
- Dashboard: metrics, charts, month selector, AI summary
- Dashboard drilldown: category → merchant → transactions
- Import page: file drop → preview → confirm → results
- Review page: inline editing, rule creation, bulk actions
- Forecast page: fixed/variable breakdown, budget overrides
- Empty states for all pages
- Responsive, keyboard-friendly, calm design
- Full integration with Phase 1+2 backend APIs

## What's Next (Phase 4 — if needed)

- Seed data import (existing spreadsheet bootstrap)
- Settings page (AI toggle, backup management)
- Category management UI
- Performance optimization (virtual lists for large datasets)
