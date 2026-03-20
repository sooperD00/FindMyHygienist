const API_BASE = "/api";

export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// TODO: Add typed API functions as endpoints are built
// export async function searchProviders(params: SearchParams): Promise<Provider[]> { ... }
// export async function getProvider(slug: string, id: string): Promise<Provider> { ... }
// export async function register(data: RegisterData): Promise<AuthResponse> { ... }
// export async function login(data: LoginData): Promise<AuthResponse> { ... }
