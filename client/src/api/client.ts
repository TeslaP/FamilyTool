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

  async deleteTransaction(id: number) {
    return this.request<{ deleted: boolean; id: number }>(`/transactions/${id}`, {
      method: "DELETE",
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

  async getImportStatus() {
    return this.request<{ total: number; categorised: number; uncategorised: number; failed: number; isProcessing: boolean }>("/import/status");
  }

  async getPacing(month: string) {
    return this.request<any>(`/transactions/pacing?month=${month}`);
  }

  async getTrajectory(year: number) {
    return this.request<any>(`/trajectory?year=${year}`);
  }
}

export const api = new ApiClient();
