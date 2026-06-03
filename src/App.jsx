// ============================================================
// FJ Smart Prompt Hub — Versão Responsiva
// Mobile: hamburger drawer | Tablet: sidebar 60px | Desktop: sidebar 220px
// ============================================================

import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";

// ============================================================
// SUPABASE CLIENT
// ============================================================
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "https://kyrqwjakejckyyugtgnz.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cnF3amFrZWpja3l5dWd0Z256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNzc1MjQsImV4cCI6MjA5NTk1MzUyNH0.cuUsab9ylX7in7t7n_lL_TTx-JkQHrE11oKwjvo9sZk";

const supabase = {
  async request(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...options,
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${this._token || SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": options.prefer || "return=representation",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  },

  async signInWithGoogle() {
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${window.location.origin}`;
  },

  async signOut() {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${this._token}` },
    });
    this._token = null;
    this._user = null;
  },

  async getSession() {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.slice(1));
      const token = params.get("access_token");
      if (token) {
        this._token = token;
        localStorage.setItem("sb_token", token);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    if (!this._token) this._token = localStorage.getItem("sb_token");
    if (!this._token) return null;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${this._token}` },
      });
      if (!res.ok) { localStorage.removeItem("sb_token"); this._token = null; return null; }
      const user = await res.json();
      this._user = user;
      return { user, token: this._token };
    } catch { return null; }
  },

  async getPrompts(categorySlug = null, search = "") {
    let q = "/prompts_with_favorites?is_active=eq.true&is_public=eq.true&order=uses_count.desc";
    if (categorySlug && categorySlug !== "all") q += `&category_slug=eq.${categorySlug}`;
    if (search) q += `&or=(title.ilike.*${search}*,description.ilike.*${search}*)`;
    return this.request(q, { headers: { "Accept": "application/json" } });
  },

  async getCategories() {
    return this.request("/categories?is_active=eq.true&order=sort_order");
  },

  async getProfile() {
    const data = await this.request("/profiles?select=*&limit=1");
    return data?.[0] || null;
  },

  async toggleFavorite(promptId, isFavorited) {
    if (isFavorited) {
      return this.request(`/favorites?prompt_id=eq.${promptId}`, { method: "DELETE", prefer: "return=minimal" });
    } else {
      return this.request("/favorites", { method: "POST", body: JSON.stringify({ prompt_id: promptId }) });
    }
  },

  async registerUsage(promptId, variables = {}) {
    return this.request("/prompt_usage", {
      method: "POST",
      body: JSON.stringify({ prompt_id: promptId, variables_used: variables }),
    });
  },

  async saveCustomPrompt(data) {
    return this.request("/custom_prompts", { method: "POST", body: JSON.stringify(data) });
  },

  async getUserAchievements() {
    return this.request("/user_achievements?select=*,achievement:achievements(*)");
  },
};

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bg: "#0A0C10", surface: "#111318", surfaceHover: "#161B24",
  border: "#1E2530", borderLight: "#252D3A",
  accent: "#00D4AA", accentDim: "#00D4AA18", accentGlow: "#00D4AA33",
  gold: "#F5C842", goldDim: "#F5C84218",
  text: "#E8EDF5", textMuted: "#6B7A94", textDim: "#2D3748",
  red: "#FF4D6A", blue: "#4D9FFF", purple: "#A855F7",
};

// ============================================================
// RESPONSIVE HOOK
// breakpoints: mobile < 640px | tablet 640–1024px | desktop > 1024px
// ============================================================
function useBreakpoint() {
  const getBreakpoint = () => {
    const w = window.innerWidth;
    if (w < 640) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  };
  const [bp, setBp] = useState(getBreakpoint);
  useEffect(() => {
    const handler = () => setBp(getBreakpoint());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
}

// ============================================================
// AUTH CONTEXT
// ============================================================
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.getSession().then(async (s) => {
      setSession(s);
      if (s) {
        try { const p = await supabase.getProfile(); setProfile(p); } catch {}
      }
    });
  }, []);

  const signOut = async () => {
    await supabase.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, profile, signOut, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

// ============================================================
// HOOKS
// ============================================================
function usePrompts(categorySlug, search) {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPrompts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await supabase.getPrompts(categorySlug, search);
      setPrompts(data || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [categorySlug, search]);

  useEffect(() => { fetchPrompts(); }, [fetchPrompts]);

  const toggleFavorite = async (promptId, isFavorited) => {
    setPrompts(prev => prev.map(p =>
      p.id === promptId ? { ...p, is_favorited: !isFavorited } : p
    ));
    try { await supabase.toggleFavorite(promptId, isFavorited); }
    catch {
      setPrompts(prev => prev.map(p =>
        p.id === promptId ? { ...p, is_favorited: isFavorited } : p
      ));
    }
  };

  return { prompts, loading, error, toggleFavorite, refetch: fetchPrompts };
}

function useCategories() {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    supabase.getCategories().then(data => {
      setCategories([{ id: "all", slug: "all", label: "Todos", icon: "◈" }, ...(data || [])]);
    }).catch(() => {});
  }, []);
  return categories;
}

// ============================================================
// UI ATOMS
// ============================================================
function Tag({ label }) {
  return (
    <span style={{
      background: C.accentDim, color: C.accent,
      border: `1px solid ${C.accentGlow}`, borderRadius: 4,
      padding: "2px 8px", fontSize: 10,
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.05em", textTransform: "uppercase",
    }}>{label}</span>
  );
}

function Pill({ level }) {
  const map = {
    fácil:    { bg: "#00D4AA18", color: "#00D4AA", border: "#00D4AA33" },
    médio:    { bg: "#F5C84218", color: "#F5C842", border: "#F5C84233" },
    avançado: { bg: "#FF4D6A18", color: "#FF4D6A", border: "#FF4D6A33" },
  };
  const s = map[level] || map.fácil;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 4, padding: "2px 8px", fontSize: 10,
      fontFamily: "'JetBrains Mono', monospace",
    }}>{level}</span>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{
        width: 32, height: 32, border: `2px solid ${C.border}`,
        borderTop: `2px solid ${C.accent}`, borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function EmptyState({ icon = "◎", title, subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 20px" }}>
      <div style={{ fontSize: 36, color: C.textDim, marginBottom: 14 }}>{icon}</div>
      <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ color: C.textDim, fontSize: 12 }}>{subtitle}</div>}
    </div>
  );
}

// ============================================================
// LOGIN PAGE
// ============================================================
function LoginPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: "20px",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');`}</style>
      <div style={{
        background: C.surface, border: `1px solid ${C.borderLight}`,
        borderRadius: 20, padding: "48px 40px", maxWidth: 400, width: "100%",
        textAlign: "center", boxShadow: `0 0 80px ${C.accentGlow}`,
      }}>
        <div style={{
          width: 56, height: 56, background: C.accent, borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, color: C.bg, margin: "0 auto 20px",
        }}>⬡</div>
        <div style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>FJ Smart Prompt Hub</div>
        <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 32, lineHeight: 1.6 }}>
          Biblioteca corporativa de prompts de IA<br />para equipes de alta performance.
        </div>
        <button
          onClick={() => { setLoading(true); supabase.signInWithGoogle(); }}
          disabled={loading}
          style={{
            width: "100%", background: loading ? C.accentDim : C.accent,
            color: loading ? C.accent : C.bg, border: `1px solid ${C.accent}`,
            borderRadius: 10, padding: "14px 20px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "all 0.2s",
          }}
        >
          {loading ? "Redirecionando..." : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </>
          )}
        </button>
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 20 }}>Acesso seguro via Supabase Auth</div>
      </div>
    </div>
  );
}

// ============================================================
// PROMPT MODAL
// ============================================================
function PromptModal({ prompt, onClose }) {
  const bp = useBreakpoint();
  const [vars, setVars] = useState({});
  const [copied, setCopied] = useState(false);
  const [usageRegistered, setUsageRegistered] = useState(false);

  const varNames = [...new Set([...prompt.prompt_text.matchAll(/\{(\w+)\}/g)].map(m => m[1]))];
  const filled = varNames.reduce(
    (text, v) => text.replace(new RegExp(`\\{${v}\\}`, "g"), vars[v] || `{${v}}`),
    prompt.prompt_text
  );

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(filled); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (!usageRegistered) {
      setUsageRegistered(true);
      try { await supabase.registerUsage(prompt.id, vars); } catch {}
    }
  };

  const isMobile = bp === "mobile";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#00000099",
      display: "flex", alignItems: isMobile ? "flex-end" : "center",
      justifyContent: "center", zIndex: 999,
      padding: isMobile ? 0 : 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${C.borderLight}`,
        borderRadius: isMobile ? "18px 18px 0 0" : 18,
        padding: isMobile ? "24px 20px 32px" : 28,
        maxWidth: isMobile ? "100%" : 700,
        width: "100%",
        maxHeight: isMobile ? "90vh" : "90vh",
        overflowY: "auto",
        boxShadow: `0 0 60px ${C.accentGlow}`,
      }}>
        {/* Drag handle on mobile */}
        {isMobile && (
          <div style={{
            width: 40, height: 4, background: C.border,
            borderRadius: 2, margin: "0 auto 20px", flexShrink: 0,
          }} />
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ flex: 1, marginRight: 8 }}>
            <div style={{ color: C.text, fontSize: isMobile ? 15 : 17, fontWeight: 700, marginBottom: 8 }}>{prompt.title}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill level={prompt.difficulty} />
              {(prompt.tags || []).map(t => <Tag key={t} label={t} />)}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: C.bg, border: `1px solid ${C.border}`,
            color: C.textMuted, borderRadius: 8, padding: "6px 12px",
            cursor: "pointer", fontSize: 12, flexShrink: 0, marginLeft: 12,
          }}>✕</button>
        </div>

        {/* Variables */}
        {varNames.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: C.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 10 }}>
              ◈ VARIÁVEIS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {varNames.map(v => (
                <div key={v}>
                  <div style={{ color: C.textMuted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", marginBottom: 5 }}>{v}</div>
                  <input
                    value={vars[v] || ""}
                    onChange={e => setVars(p => ({ ...p, [v]: e.target.value }))}
                    placeholder={`inserir ${v}...`}
                    style={{
                      width: "100%", background: C.bg, border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: "8px 12px", color: C.text,
                      fontSize: 12, outline: "none", boxSizing: "border-box",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prompt text */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: C.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 10 }}>◈ PROMPT</div>
          <div style={{
            background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: 16, color: C.text,
            fontSize: isMobile ? 12 : 13, lineHeight: 1.8,
            fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap",
          }}>{filled}</div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleCopy} style={{
            flex: 1, background: copied ? C.accentDim : C.accent,
            color: copied ? C.accent : C.bg, border: `1px solid ${C.accent}`,
            borderRadius: 10, padding: "12px 20px",
            cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.2s",
          }}>
            {copied ? "✓ copiado e uso registrado!" : "⎘ copiar prompt"}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <span style={{ color: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            ↗ {(prompt.uses_count || 0).toLocaleString()} usos
          </span>
          <span style={{ color: C.gold, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            ★ {prompt.rating_avg || "—"}
          </span>
          <span style={{ color: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            {prompt.category_label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PROMPT CARD
// ============================================================
function PromptCard({ prompt, onOpen, onFavorite }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(prompt)}
      style={{
        background: hovered ? C.surfaceHover : C.surface,
        border: `1px solid ${hovered ? C.borderLight : C.border}`,
        borderRadius: 12, padding: 20, cursor: "pointer",
        transition: "all 0.18s",
        boxShadow: hovered ? `0 0 28px ${C.accentGlow}` : "none",
        position: "relative", overflow: "hidden",
      }}
    >
      {hovered && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1, marginRight: 8 }}>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{prompt.title}</div>
          <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5 }}>{prompt.description}</div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onFavorite(prompt.id, prompt.is_favorited); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: prompt.is_favorited ? C.gold : C.textDim,
            fontSize: 17, padding: 2, transition: "color 0.15s", flexShrink: 0,
          }}
        >
          {prompt.is_favorited ? "★" : "☆"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
        {(prompt.tags || []).slice(0, 3).map(t => <Tag key={t} label={t} />)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Pill level={prompt.difficulty} />
          <span style={{ color: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            ↗ {(prompt.uses_count || 0).toLocaleString()}
          </span>
          {prompt.rating_avg > 0 && (
            <span style={{ color: C.gold, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
              ★ {prompt.rating_avg}
            </span>
          )}
        </div>
        <span style={{
          color: C.accent, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          opacity: hovered ? 1 : 0, transition: "opacity 0.18s",
        }}>ver →</span>
      </div>
    </div>
  );
}

// ============================================================
// SIDEBAR — Desktop (220px) | Tablet (60px collapsed) | Mobile (drawer)
// ============================================================
function Sidebar({ page, setPage, profile, onSignOut, drawerOpen, onCloseDrawer, bp }) {
  const nav = [
    { id: "dashboard",   icon: "◈", label: "Dashboard" },
    { id: "biblioteca",  icon: "⊞", label: "Biblioteca" },
    { id: "favoritos",   icon: "★", label: "Favoritos" },
    { id: "builder",     icon: "◎", label: "Builder" },
    { id: "meu-espaco",  icon: "◇", label: "Meu Espaço" },
  ];

  const isTablet = bp === "tablet";
  const isMobile = bp === "mobile";
  const collapsed = isTablet; // tablet = collapsed icons only

  const handleNav = (id) => {
    setPage(id);
    if (isMobile) onCloseDrawer();
  };

  // Mobile: render as drawer overlay
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {drawerOpen && (
          <div
            onClick={onCloseDrawer}
            style={{
              position: "fixed", inset: 0, background: "#00000080",
              zIndex: 998, backdropFilter: "blur(2px)",
            }}
          />
        )}
        {/* Drawer */}
        <div style={{
          position: "fixed", top: 0, left: 0, bottom: 0,
          width: 240, background: C.surface,
          borderRight: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column",
          padding: "22px 0", flexShrink: 0,
          zIndex: 999,
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}>
          <SidebarContent nav={nav} page={page} onNav={handleNav} profile={profile} onSignOut={onSignOut} collapsed={false} onClose={onCloseDrawer} />
        </div>
      </>
    );
  }

  // Tablet + Desktop: static sidebar
  return (
    <div style={{
      width: collapsed ? 60 : 220,
      background: C.surface,
      borderRight: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column",
      padding: "22px 0", flexShrink: 0,
      transition: "width 0.2s ease",
      overflow: "hidden",
    }}>
      <SidebarContent nav={nav} page={page} onNav={handleNav} profile={profile} onSignOut={onSignOut} collapsed={collapsed} />
    </div>
  );
}

function SidebarContent({ nav, page, onNav, profile, onSignOut, collapsed, onClose }) {
  return (
    <>
      {/* Logo */}
      <div style={{ padding: collapsed ? "0 0 26px" : "0 18px 26px", display: "flex", justifyContent: collapsed ? "center" : "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: collapsed ? 0 : 10 }}>
          <div style={{
            width: 34, height: 34, background: C.accent, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: C.bg, flexShrink: 0,
          }}>⬡</div>
          {!collapsed && (
            <div>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>FJ Smart</div>
              <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>PROMPT HUB</div>
            </div>
          )}
        </div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: collapsed ? "0 6px" : "0 10px" }}>
        {nav.map(item => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                width: "100%", textAlign: collapsed ? "center" : "left",
                background: active ? C.accentDim : "none",
                border: `1px solid ${active ? C.accentGlow : "transparent"}`,
                borderRadius: 8,
                padding: collapsed ? "11px 0" : "10px 12px",
                color: active ? C.accent : C.textMuted,
                cursor: "pointer", fontSize: collapsed ? 18 : 13,
                display: "flex", alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 10,
                marginBottom: 2, transition: "all 0.15s",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <span>{item.icon}</span>
              {!collapsed && item.label}
            </button>
          );
        })}
      </div>

      {/* User footer */}
      <div style={{
        padding: collapsed ? "14px 6px 0" : "14px 18px 0",
        borderTop: `1px solid ${C.border}`, marginTop: 10,
      }}>
        {collapsed ? (
          // Collapsed: just avatar + sign out icon
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: C.bg, fontWeight: 800,
            }}>
              {profile?.full_name?.slice(0, 2).toUpperCase() || "FJ"}
            </div>
            <button onClick={onSignOut} title="Sair" style={{
              background: "none", border: `1px solid ${C.border}`, color: C.textMuted,
              borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 12,
            }}>↩</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: C.bg, fontWeight: 800, flexShrink: 0,
              }}>
                {profile?.full_name?.slice(0, 2).toUpperCase() || "FJ"}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ color: C.text, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {profile?.full_name?.split(" ")[0] || "Usuário"}
                </div>
                <div style={{ color: C.accent, fontSize: 9, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
                  {profile?.plan || "free"}
                </div>
              </div>
            </div>
            <button onClick={onSignOut} style={{
              width: "100%", background: "none",
              border: `1px solid ${C.border}`, color: C.textMuted,
              borderRadius: 6, padding: "6px 10px", cursor: "pointer",
              fontSize: 11, textAlign: "left",
            }}>↩ sair</button>
          </>
        )}
      </div>
    </>
  );
}

// ============================================================
// MOBILE HEADER (hamburger)
// ============================================================
function MobileHeader({ onOpenDrawer, page }) {
  const labels = {
    dashboard: "Dashboard", biblioteca: "Biblioteca",
    favoritos: "Favoritos", builder: "Builder", "meu-espaco": "Meu Espaço",
  };
  return (
    <div style={{
      height: 56, background: C.surface, borderBottom: `1px solid ${C.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, background: C.accent, borderRadius: 7,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, color: C.bg,
        }}>⬡</div>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>FJ Smart</div>
      </div>
      <div style={{ color: C.textMuted, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
        {labels[page] || ""}
      </div>
      <button onClick={onOpenDrawer} style={{
        background: "none", border: `1px solid ${C.border}`,
        color: C.textMuted, borderRadius: 8,
        padding: "6px 10px", cursor: "pointer", fontSize: 16,
        display: "flex", alignItems: "center", gap: 4,
      }}>☰</button>
    </div>
  );
}

// ============================================================
// PAGES
// ============================================================
function Dashboard({ onNavigate }) {
  const bp = useBreakpoint();
  const { profile } = useAuth();
  const { prompts, loading, toggleFavorite } = usePrompts(null, "");
  const [selected, setSelected] = useState(null);

  const featured = prompts.filter(p => p.is_featured).slice(0, 4);

  const hora = new Date().getHours();
  const greeting = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";
  const statsColumns = isMobile ? "1fr 1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)";
  const cardsColumns = isMobile ? "1fr" : "1fr 1fr";

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 6 }}>
          ◈ {greeting.toUpperCase()}, {(profile?.full_name?.split(" ")[0] || "FELIPE").toUpperCase()} —
        </div>
        <div style={{ color: C.text, fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: "-0.03em" }}>Dashboard</div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: statsColumns, gap: 14, marginBottom: 28 }}>
        {[
          { label: "Total de prompts", value: prompts.length, icon: "◈", color: C.accent },
          { label: "Seus usos totais", value: profile?.total_uses || 0, icon: "↗", color: C.blue },
          { label: "Favoritos salvos", value: prompts.filter(p => p.is_favorited).length, icon: "★", color: C.gold },
          { label: "Sequência atual", value: `${profile?.streak_days || 0}d 🔥`, icon: "△", color: C.red },
        ].map(s => (
          <div key={s.label} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: isMobile ? 14 : 18,
          }}>
            <div style={{ color: s.color, fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ color: C.text, fontSize: isMobile ? 18 : 22, fontWeight: 800, marginBottom: 4 }}>{s.value}</div>
            <div style={{ color: C.textMuted, fontSize: isMobile ? 10 : 11 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Featured */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ color: C.textMuted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em" }}>
            ◈ PROMPTS EM DESTAQUE
          </div>
          <button onClick={() => onNavigate("biblioteca")} style={{
            background: "none", border: "none", color: C.accent,
            cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          }}>ver todos →</button>
        </div>
        {loading ? <Spinner /> : (
          <div style={{ display: "grid", gridTemplateColumns: cardsColumns, gap: 14 }}>
            {featured.map(p => (
              <PromptCard key={p.id} prompt={p} onOpen={setSelected} onFavorite={toggleFavorite} />
            ))}
          </div>
        )}
      </div>

      {selected && <PromptModal prompt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Biblioteca() {
  const bp = useBreakpoint();
  const categories = useCategories();
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState(null);
  const { prompts, loading, error, toggleFavorite } = usePrompts(activeCat, search);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isMobile = bp === "mobile";
  const cardsColumns = isMobile ? "1fr" : "1fr 1fr";

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 6 }}>◈ EXPLORE —</div>
        <div style={{ color: C.text, fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: "-0.03em" }}>Biblioteca</div>
      </div>

      <div style={{ position: "relative", marginBottom: 18 }}>
        <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>⌕</span>
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="buscar por título, descrição ou tag..."
          style={{
            width: "100%", background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "11px 14px 11px 36px",
            color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {categories.map(cat => {
          const active = activeCat === cat.slug;
          return (
            <button key={cat.id} onClick={() => setActiveCat(cat.slug)} style={{
              background: active ? C.accentDim : C.surface,
              border: `1px solid ${active ? C.accent : C.border}`,
              color: active ? C.accent : C.textMuted,
              borderRadius: 8, padding: "7px 14px", cursor: "pointer",
              fontSize: 12, display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.15s",
            }}>
              <span>{cat.icon}</span> {cat.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{
          background: "#FF4D6A18", border: "1px solid #FF4D6A33",
          borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16,
        }}>
          Erro ao carregar prompts: {error}. Verifique a conexão com o Supabase.
        </div>
      )}

      {loading ? <Spinner /> : prompts.length === 0 ? (
        <EmptyState icon="◈" title="Nenhum prompt encontrado" subtitle="Tente outra categoria ou termo de busca" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: cardsColumns, gap: 14 }}>
          {prompts.map(p => (
            <PromptCard key={p.id} prompt={p} onOpen={setSelected} onFavorite={toggleFavorite} />
          ))}
        </div>
      )}

      {selected && <PromptModal prompt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Favoritos() {
  const bp = useBreakpoint();
  const { prompts, loading, toggleFavorite } = usePrompts(null, "");
  const [selected, setSelected] = useState(null);
  const favs = prompts.filter(p => p.is_favorited);
  const isMobile = bp === "mobile";

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 6 }}>◈ COLEÇÃO —</div>
        <div style={{ color: C.text, fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: "-0.03em" }}>Favoritos</div>
      </div>
      {loading ? <Spinner /> : favs.length === 0 ? (
        <EmptyState icon="★" title="Nenhum favorito ainda" subtitle="Clique em ☆ em qualquer prompt para salvar aqui" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          {favs.map(p => (
            <PromptCard key={p.id} prompt={p} onOpen={setSelected} onFavorite={toggleFavorite} />
          ))}
        </div>
      )}
      {selected && <PromptModal prompt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Builder() {
  const bp = useBreakpoint();
  const [form, setForm] = useState({ title: "", role: "", task: "", context: "", format: "", tone: "" });
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const roles = ["Gerente de Hotel", "Líder de RH", "Analista de Marketing", "Recepcionista", "Diretor Comercial"];
  const tones = ["Profissional", "Empático", "Direto", "Consultivo", "Inspirador"];
  const formats = ["Texto livre", "Lista de tópicos", "Passo a passo", "Script de fala", "Email"];

  const generate = () => {
    const lines = [`Você é um(a) ${form.role || "[papel]"}.`, "", form.task || "[descreva a tarefa]"];
    if (form.context) lines.push("", `Contexto: ${form.context}`);
    if (form.format) lines.push("", `Formato de resposta: ${form.format}`);
    if (form.tone) lines.push("", `Tom: ${form.tone}`);
    setGenerated(lines.join("\n"));
    setSaved(false);
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(generated); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!generated || !form.title) return;
    setSaving(true);
    try {
      await supabase.saveCustomPrompt({ title: form.title, prompt_text: generated, tags: [], difficulty: "médio" });
      setSaved(true);
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    finally { setSaving(false); }
  };

  const isMobile = bp === "mobile";
  const builderGrid = isMobile ? "1fr" : "1fr 1fr";

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 6 }}>◈ CRIE SEU PRÓPRIO —</div>
        <div style={{ color: C.text, fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: "-0.03em" }}>Prompt Builder</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: builderGrid, gap: 22 }}>
        {/* Left: form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ color: C.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", display: "block", marginBottom: 7 }}>◈ TÍTULO</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Nome do prompt..." style={{
                width: "100%", background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "10px 13px", color: C.text,
                fontSize: 13, outline: "none", boxSizing: "border-box",
              }} />
          </div>

          <div>
            <label style={{ color: C.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", display: "block", marginBottom: 7 }}>◈ PAPEL</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7 }}>
              {roles.map(r => (
                <button key={r} onClick={() => setForm(p => ({ ...p, role: r }))} style={{
                  background: form.role === r ? C.accentDim : C.surface,
                  border: `1px solid ${form.role === r ? C.accent : C.border}`,
                  color: form.role === r ? C.accent : C.textMuted,
                  borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 11,
                }}>{r}</button>
              ))}
            </div>
            <input value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              placeholder="ou escreva livremente..." style={{
                width: "100%", background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "10px 13px", color: C.text, fontSize: 13,
                outline: "none", boxSizing: "border-box",
              }} />
          </div>

          <div>
            <label style={{ color: C.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", display: "block", marginBottom: 7 }}>◈ TAREFA</label>
            <textarea value={form.task} onChange={e => setForm(p => ({ ...p, task: e.target.value }))}
              placeholder="O que você quer que a IA faça?" rows={3} style={{
                width: "100%", background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "10px 13px", color: C.text, fontSize: 13,
                outline: "none", boxSizing: "border-box", resize: "vertical",
                fontFamily: "'DM Sans', sans-serif",
              }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[{ key: "tone", label: "TOM", options: tones }, { key: "format", label: "FORMATO", options: formats }].map(group => (
              <div key={group.key}>
                <label style={{ color: C.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", display: "block", marginBottom: 7 }}>◈ {group.label}</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {group.options.map(o => (
                    <button key={o} onClick={() => setForm(p => ({ ...p, [group.key]: o }))} style={{
                      background: form[group.key] === o ? C.accentDim : C.surface,
                      border: `1px solid ${form[group.key] === o ? C.accent : C.border}`,
                      color: form[group.key] === o ? C.accent : C.textMuted,
                      borderRadius: 6, padding: "6px 9px", cursor: "pointer",
                      fontSize: 11, textAlign: "left",
                    }}>{o}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={generate} style={{
            background: C.accent, color: C.bg, border: "none",
            borderRadius: 10, padding: "13px 20px",
            cursor: "pointer", fontSize: 13, fontWeight: 800,
          }}>◈ Gerar Prompt</button>
        </div>

        {/* Right: preview */}
        <div>
          <div style={{ color: C.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 10 }}>◈ PREVIEW</div>
          <div style={{
            background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: 16, minHeight: isMobile ? 160 : 280,
            color: generated ? C.text : C.textDim, fontSize: 13,
            lineHeight: 1.8, fontFamily: "'JetBrains Mono', monospace",
            whiteSpace: "pre-wrap", marginBottom: 12,
          }}>
            {generated || "// preencha os campos e clique em\n// Gerar Prompt para ver o resultado..."}
          </div>
          {generated && (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleCopy} style={{
                flex: 1, background: copied ? C.accentDim : C.accent,
                color: copied ? C.accent : C.bg, border: `1px solid ${C.accent}`,
                borderRadius: 8, padding: "10px 16px",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
              }}>{copied ? "✓ copiado!" : "⎘ copiar"}</button>
              <button onClick={handleSave} disabled={saving || saved} style={{
                background: saved ? C.accentDim : "none",
                border: `1px solid ${saved ? C.accent : C.border}`,
                color: saved ? C.accent : C.textMuted,
                borderRadius: 8, padding: "10px 16px",
                cursor: saving ? "not-allowed" : "pointer", fontSize: 12,
              }}>{saved ? "✓ salvo!" : saving ? "salvando..." : "salvar"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MeuEspaco() {
  const bp = useBreakpoint();
  const { profile, signOut } = useAuth();
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    supabase.getUserAchievements().then(data => setAchievements(data || [])).catch(() => {});
  }, []);

  const defaultAchievements = [
    { icon: "🚀", label: "Primeiro prompt", unlocked: (profile?.total_uses || 0) >= 1 },
    { icon: "⭐", label: "Primeiro favorito", unlocked: false },
    { icon: "🔥", label: "7 dias seguidos", unlocked: (profile?.streak_days || 0) >= 7 },
    { icon: "💯", label: "100 usos", unlocked: (profile?.total_uses || 0) >= 100 },
    { icon: "💎", label: "500 usos", unlocked: (profile?.total_uses || 0) >= 500 },
    { icon: "⚡", label: "1000 usos", unlocked: (profile?.total_uses || 0) >= 1000 },
    { icon: "◈", label: "Prompt criado", unlocked: false },
    { icon: "🏆", label: "Power user", unlocked: (profile?.total_uses || 0) >= 50 },
  ];

  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";

  const profileGrid = isMobile
    ? "1fr"
    : isTablet
      ? "1fr"
      : "260px 1fr";

  const achievementsColumns = isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)";

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: C.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 6 }}>◈ SEU PERFIL —</div>
        <div style={{ color: C.text, fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: "-0.03em" }}>Meu Espaço</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: profileGrid, gap: 20 }}>
        {/* Profile card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, color: C.bg, fontWeight: 800, margin: "0 auto 12px",
            }}>
              {profile?.full_name?.slice(0, 2).toUpperCase() || "FJ"}
            </div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>{profile?.full_name || "—"}</div>
            <div style={{ color: C.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
              {(profile?.plan || "free").toUpperCase()} · FJ Smart
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            {[
              ["Total de usos", profile?.total_uses || 0],
              ["Sequência atual", `${profile?.streak_days || 0} dias`],
              ["Plano", profile?.plan || "free"],
              ["Membro desde", profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: C.textMuted, fontSize: 12 }}>{l}</span>
                <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ color: C.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 14 }}>◈ CONQUISTAS</div>
            <div style={{ display: "grid", gridTemplateColumns: achievementsColumns, gap: 10 }}>
              {defaultAchievements.map(a => (
                <div key={a.label} style={{
                  background: a.unlocked ? C.goldDim : C.bg,
                  border: `1px solid ${a.unlocked ? "#F5C84233" : C.border}`,
                  borderRadius: 10, padding: "12px 8px", textAlign: "center",
                  opacity: a.unlocked ? 1 : 0.4,
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{a.icon}</div>
                  <div style={{ color: C.textMuted, fontSize: 10, lineHeight: 1.3 }}>{a.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ color: C.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 14 }}>◈ CONTA</div>
            <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 14 }}>{profile?.email}</div>
            <button onClick={signOut} style={{
              background: "#FF4D6A18", color: C.red,
              border: "1px solid #FF4D6A33", borderRadius: 8,
              padding: "9px 18px", cursor: "pointer", fontSize: 12,
            }}>↩ Sair da conta</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APP SHELL — responsive layout controller
// ============================================================
function AppShell() {
  const { session, profile, loading, signOut } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bp = useBreakpoint();

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: ${C.bg}; font-family: 'DM Sans', sans-serif; }
      ::-webkit-scrollbar { width: 5px; }
      ::-webkit-scrollbar-track { background: ${C.bg}; }
      ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
      input, textarea { font-family: 'DM Sans', sans-serif; }
      input::placeholder, textarea::placeholder { color: ${C.textDim}; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Close drawer on resize to non-mobile
  useEffect(() => {
    if (bp !== "mobile") setDrawerOpen(false);
  }, [bp]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.accent, fontSize: 28, marginBottom: 12 }}>⬡</div>
          <div style={{ color: C.textMuted, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>carregando...</div>
        </div>
      </div>
    );
  }

  if (!session) return <LoginPage />;

  const renderPage = () => {
    switch (page) {
      case "dashboard":  return <Dashboard onNavigate={setPage} />;
      case "biblioteca": return <Biblioteca />;
      case "favoritos":  return <Favoritos />;
      case "builder":    return <Builder />;
      case "meu-espaco": return <MeuEspaco />;
      default:           return <Dashboard onNavigate={setPage} />;
    }
  };

  const isMobile = bp === "mobile";

  const contentPadding = isMobile ? "20px 16px 32px" : bp === "tablet" ? "24px 20px" : "28px 32px";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, overflow: "hidden" }}>
      {/* Mobile top header */}
      {isMobile && (
        <MobileHeader onOpenDrawer={() => setDrawerOpen(true)} page={page} />
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar — renders as static on tablet/desktop, drawer on mobile */}
        <Sidebar
          page={page}
          setPage={setPage}
          profile={profile}
          onSignOut={signOut}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
          bp={bp}
        />

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", padding: contentPadding }}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
