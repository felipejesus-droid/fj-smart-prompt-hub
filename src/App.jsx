// ============================================================
// FJ Smart Prompt Hub — Tema Matrix Command + CNI Interface
// Versão Responsiva: mobile hamburger | tablet 60px | desktop 220px
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
// DESIGN TOKENS — MATRIX COMMAND + CNI
// ============================================================
const C = {
  // Backgrounds — preto total inspirado no C.N.I
  bg:           "#030A03",
  surface:      "#060F06",
  surfaceHover: "#0A170A",
  // Borders verdes escuros
  border:       "#0D2010",
  borderLight:  "#14301A",
  // Accent principal: Matrix Green
  accent:       "#00FF88",
  accentDim:    "#00FF8810",
  accentGlow:   "#00FF8825",
  // Accent secundário: Deep Violet (CNI synaptic purple)
  violet:       "#7C3AFF",
  violetDim:    "#7C3AFF12",
  violetGlow:   "#7C3AFF28",
  // Strategic Gold — conquistas / favoritos
  gold:         "#DCAF3C",
  goldDim:      "#DCAF3C12",
  // Cyan — status online / dados
  cyan:         "#00D4FF",
  cyanDim:      "#00D4FF10",
  // Textos
  text:         "#C8ECC8",
  textMuted:    "#2A5A2A",
  textDim:      "#0D2010",
  // Danger
  red:          "#FF4D6A",
  // Blue (mantido para compat)
  blue:         "#00D4FF",
  purple:       "#7C3AFF",
};

// ============================================================
// RESPONSIVE HOOK
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
// CNI STATUS BAR — barra de status superior inspirada no C.N.I
// ============================================================
function CniStatusBar() {
  const [time, setTime] = useState(new Date());
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date());
      setUptime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (n) => String(n).padStart(2, "0");
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = uptime % 60;

  return (
    <div style={{
      height: 24,
      background: C.bg,
      borderBottom: `1px solid ${C.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      flexShrink: 0,
    }}>
      <span style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em" }}>
        FJ SMART · PROMPT HUB v2.0 · BUILD MATRIX
      </span>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ color: C.accent, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.08em" }}>
          ● NEURAL LINK: ACTIVE
        </span>
        <span style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
          SYSTEM STATUS: <span style={{ color: C.accent }}>OPTIMAL</span>
        </span>
        <span style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
          UPTIME {fmt(h)}:{fmt(m)}:{fmt(s)}
        </span>
        <span style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
          {time.toLocaleTimeString("pt-BR")}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// UI ATOMS
// ============================================================
function Tag({ label }) {
  return (
    <span style={{
      background: C.accentDim,
      color: C.accent,
      border: `1px solid ${C.accentGlow}`,
      borderRadius: 3,
      padding: "2px 7px",
      fontSize: 9,
      fontFamily: "'Share Tech Mono', monospace",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>{label}</span>
  );
}

function Pill({ level }) {
  const map = {
    fácil:    { bg: C.accentDim,  color: "#00CC6A", border: C.accentGlow },
    médio:    { bg: C.goldDim,    color: C.gold,    border: "#DCAF3C30" },
    avançado: { bg: "#FF4D6A10",  color: C.red,     border: "#FF4D6A30" },
  };
  const s = map[level] || map.fácil;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 3, padding: "2px 7px", fontSize: 9,
      fontFamily: "'Share Tech Mono', monospace",
    }}>{level}</span>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60, flexDirection: "column", gap: 12 }}>
      <div style={{
        width: 32, height: 32,
        border: `2px solid ${C.border}`,
        borderTop: `2px solid ${C.accent}`,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em" }}>
        LOADING DATA STREAM...
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function EmptyState({ icon = "◎", title, subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 20px" }}>
      <div style={{ fontSize: 32, color: C.textDim, marginBottom: 14 }}>{icon}</div>
      <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 6, fontFamily: "'Share Tech Mono', monospace" }}>{title}</div>
      {subtitle && <div style={{ color: C.textDim, fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>{subtitle}</div>}
    </div>
  );
}

// ============================================================
// CNI METRIC CARD — inspired by C.N.I dashboard panels
// ============================================================
function CniMetricCard({ label, value, subValue, color = C.accent, icon }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "14px 16px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Left accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: 2,
        background: color,
        opacity: 0.7,
      }} />
      {/* Top scan line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
      }} />
      <div style={{ color: C.textMuted, fontSize: 8, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 6 }}>
        {icon && <span style={{ marginRight: 5 }}>{icon}</span>}{label}
      </div>
      <div style={{ color, fontSize: 24, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, lineHeight: 1, marginBottom: 3 }}>
        {value}
      </div>
      {subValue && (
        <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>{subValue}</div>
      )}
    </div>
  );
}

// ============================================================
// LOGIN PAGE
// ============================================================
function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1200);
    return () => clearInterval(t);
  }, []);

  const lines = [
    "► INITIALIZING FJ SMART PROTOCOL...",
    "► NEURAL NETWORK: ONLINE",
    "► PROMPT DATABASE: CONNECTED",
    "► AUTH MODULE: READY",
    "► AWAITING USER CREDENTIALS...",
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Share Tech Mono', monospace",
      padding: "20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${C.bg}; font-family: 'Share Tech Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        input, textarea, select, button { font-family: 'Share Tech Mono', monospace; }
        input::placeholder, textarea::placeholder { color: ${C.textDim}; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes pulse-green { 0%,100%{opacity:0.4} 50%{opacity:1} }
      `}</style>

      <div style={{
        background: C.surface,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 16,
        padding: "40px 36px",
        maxWidth: 400,
        width: "100%",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Corner decorations */}
        <div style={{ position: "absolute", top: 8, left: 8, width: 16, height: 16, borderTop: `1px solid ${C.accent}`, borderLeft: `1px solid ${C.accent}`, opacity: 0.6 }} />
        <div style={{ position: "absolute", top: 8, right: 8, width: 16, height: 16, borderTop: `1px solid ${C.accent}`, borderRight: `1px solid ${C.accent}`, opacity: 0.6 }} />
        <div style={{ position: "absolute", bottom: 8, left: 8, width: 16, height: 16, borderBottom: `1px solid ${C.accent}`, borderLeft: `1px solid ${C.accent}`, opacity: 0.6 }} />
        <div style={{ position: "absolute", bottom: 8, right: 8, width: 16, height: 16, borderBottom: `1px solid ${C.accent}`, borderRight: `1px solid ${C.accent}`, opacity: 0.6 }} />

        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56, height: 56,
            border: `1px solid ${C.accent}`,
            borderRadius: 10,
            marginBottom: 16,
            position: "relative",
          }}>
            <span style={{ color: C.accent, fontSize: 26, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>FJ</span>
            <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", width: 20, height: 1, background: C.accent }} />
            <div style={{ position: "absolute", bottom: -1, left: "50%", transform: "translateX(-50%)", width: 20, height: 1, background: C.accent }} />
          </div>
          <div style={{ color: C.accent, fontSize: 20, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 2 }}>
            FJ SMART
          </div>
          <div style={{ color: C.violet, fontSize: 9, letterSpacing: "0.18em" }}>
            INTELIGÊNCIA PESSOAL
          </div>
        </div>

        {/* Terminal readout */}
        <div style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 20,
          textAlign: "left",
        }}>
          {lines.slice(0, Math.min(tick + 1, lines.length)).map((l, i) => (
            <div key={i} style={{ color: i === Math.min(tick, lines.length - 1) ? C.accent : C.textMuted, fontSize: 9, letterSpacing: "0.06em", marginBottom: 3 }}>
              {l}{i === Math.min(tick, lines.length - 1) && <span style={{ animation: "blink 1s infinite" }}>_</span>}
            </div>
          ))}
        </div>

        <div style={{ color: C.textMuted, fontSize: 10, letterSpacing: "0.08em", marginBottom: 22, lineHeight: 1.7 }}>
          BIBLIOTECA CORPORATIVA DE PROMPTS DE IA<br />
          PARA EQUIPES DE ALTA PERFORMANCE
        </div>

        <button
          onClick={() => { setLoading(true); supabase.signInWithGoogle(); }}
          disabled={loading}
          style={{
            width: "100%",
            background: loading ? C.accentDim : "transparent",
            color: loading ? C.accent : C.accent,
            border: `1px solid ${C.accent}`,
            borderRadius: 8,
            padding: "13px 20px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            transition: "all 0.2s",
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          {loading ? "► REDIRECTING..." : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              ► AUTENTICAR COM GOOGLE
            </>
          )}
        </button>

        <div style={{ color: C.textDim, fontSize: 9, marginTop: 16, letterSpacing: "0.08em" }}>
          ACESSO SEGURO VIA SUPABASE AUTH · AES-512
        </div>
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
        background: C.surface,
        border: `1px solid ${C.borderLight}`,
        borderRadius: isMobile ? "14px 14px 0 0" : 14,
        padding: isMobile ? "22px 18px 28px" : 26,
        maxWidth: isMobile ? "100%" : 700,
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: `0 0 60px ${C.accentGlow}`,
        position: "relative",
      }}>
        {/* Corner accents */}
        <div style={{ position: "absolute", top: 8, left: 8, width: 12, height: 12, borderTop: `1px solid ${C.accent}`, borderLeft: `1px solid ${C.accent}`, opacity: 0.5 }} />
        <div style={{ position: "absolute", top: 8, right: 8, width: 12, height: 12, borderTop: `1px solid ${C.accent}`, borderRight: `1px solid ${C.accent}`, opacity: 0.5 }} />

        {isMobile && (
          <div style={{ width: 36, height: 3, background: C.border, borderRadius: 2, margin: "0 auto 18px" }} />
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{ flex: 1, marginRight: 8 }}>
            <div style={{ color: C.text, fontSize: isMobile ? 14 : 16, fontFamily: "'Exo 2', sans-serif", fontWeight: 700, marginBottom: 8 }}>
              {prompt.title}
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <Pill level={prompt.difficulty} />
              {(prompt.tags || []).map(t => <Tag key={t} label={t} />)}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: C.bg, border: `1px solid ${C.border}`,
            color: C.textMuted, borderRadius: 6, padding: "5px 10px",
            cursor: "pointer", fontSize: 11, flexShrink: 0, marginLeft: 10,
            fontFamily: "'Share Tech Mono', monospace",
          }}>✕ ESC</button>
        </div>

        {varNames.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: C.accent, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 10 }}>
              ◈ VARIÁVEIS DE INPUT
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {varNames.map(v => (
                <div key={v}>
                  <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", marginBottom: 5, letterSpacing: "0.08em" }}>{v.toUpperCase()}</div>
                  <input
                    value={vars[v] || ""}
                    onChange={e => setVars(p => ({ ...p, [v]: e.target.value }))}
                    placeholder={`inserir ${v}...`}
                    style={{
                      width: "100%", background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6, padding: "8px 11px", color: C.text,
                      fontSize: 11, outline: "none", boxSizing: "border-box",
                      fontFamily: "'Share Tech Mono', monospace",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={{ color: C.accent, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 10 }}>
            ◈ PROMPT OUTPUT
          </div>
          <div style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderLeft: `2px solid ${C.accent}`,
            borderRadius: 8, padding: 14, color: C.text,
            fontSize: isMobile ? 11 : 12, lineHeight: 1.9,
            fontFamily: "'Share Tech Mono', monospace", whiteSpace: "pre-wrap",
          }}>{filled}</div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleCopy} style={{
            flex: 1,
            background: copied ? C.accentDim : "transparent",
            color: C.accent,
            border: `1px solid ${C.accent}`,
            borderRadius: 8, padding: "11px 18px",
            cursor: "pointer", fontSize: 11, fontWeight: 700,
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: "0.08em",
            transition: "all 0.2s",
          }}>
            {copied ? "✓ COPIADO · USO REGISTRADO" : "⎘ COPIAR PROMPT"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <span style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
            ↗ {(prompt.uses_count || 0).toLocaleString()} USOS
          </span>
          <span style={{ color: C.gold, fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
            ★ {prompt.rating_avg || "—"}
          </span>
          <span style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
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

  // Cor do acento baseada na tag
  const accentColor = prompt.is_favorited ? C.gold
    : (prompt.tags || []).some(t => ["liderança", "gestão"].includes(t?.toLowerCase())) ? C.violet
    : C.accent;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(prompt)}
      style={{
        background: hovered ? C.surfaceHover : C.surface,
        border: `1px solid ${hovered ? C.borderLight : C.border}`,
        borderLeft: `2px solid ${hovered ? accentColor : C.border}`,
        borderRadius: 10,
        padding: "16px 18px",
        cursor: "pointer",
        transition: "all 0.18s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top scan line on hover */}
      {hovered && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)`,
        }} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 9 }}>
        <div style={{ flex: 1, marginRight: 8 }}>
          <div style={{ color: C.text, fontSize: 12, fontFamily: "'Exo 2', sans-serif", fontWeight: 600, marginBottom: 4 }}>
            {prompt.title}
          </div>
          <div style={{ color: C.textMuted, fontSize: 11, lineHeight: 1.5, fontFamily: "'Share Tech Mono', monospace" }}>
            {prompt.description}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onFavorite(prompt.id, prompt.is_favorited); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: prompt.is_favorited ? C.gold : C.textDim,
            fontSize: 16, padding: 2, transition: "color 0.15s", flexShrink: 0,
          }}
        >
          {prompt.is_favorited ? "★" : "☆"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {(prompt.tags || []).slice(0, 3).map(t => <Tag key={t} label={t} />)}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Pill level={prompt.difficulty} />
          <span style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
            ↗ {(prompt.uses_count || 0).toLocaleString()}
          </span>
          {prompt.rating_avg > 0 && (
            <span style={{ color: C.gold, fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
              ★ {prompt.rating_avg}
            </span>
          )}
        </div>
        <span style={{
          color: accentColor, fontSize: 9, fontFamily: "'Share Tech Mono', monospace",
          opacity: hovered ? 1 : 0, transition: "opacity 0.18s",
          letterSpacing: "0.08em",
        }}>ABRIR →</span>
      </div>
    </div>
  );
}

// ============================================================
// SIDEBAR
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
  const collapsed = isTablet;

  const handleNav = (id) => {
    setPage(id);
    if (isMobile) onCloseDrawer();
  };

  if (isMobile) {
    return (
      <>
        {drawerOpen && (
          <div onClick={onCloseDrawer} style={{
            position: "fixed", inset: 0, background: "#00000090",
            zIndex: 998, backdropFilter: "blur(2px)",
          }} />
        )}
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
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => (n + 1) % 4), 1800);
    return () => clearInterval(t);
  }, []);

  const statusLines = ["SYS.ONLINE", "AUTH.VALID", "DATA.SYNC", `${(Math.random() * 300 | 0) + 100} NODES`];

  return (
    <>
      {/* Logo */}
      <div style={{
        padding: collapsed ? "0 0 20px" : "0 16px 20px",
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 12,
        display: "flex",
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        {collapsed ? (
          <div style={{
            width: 32, height: 32, border: `1px solid ${C.accent}`,
            borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
            color: C.accent, fontSize: 14, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
          }}>FJ</div>
        ) : (
          <div>
            <div style={{ color: C.accent, fontSize: 18, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.1em", lineHeight: 1 }}>
              FJ SMART
            </div>
            <div style={{ color: C.violet, fontSize: 8, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginTop: 2 }}>
              INTELIGÊNCIA PESSOAL
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: collapsed ? "0 6px" : "0 10px" }}>
        {nav.map(item => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                width: "100%",
                textAlign: collapsed ? "center" : "left",
                background: active ? C.accentDim : "none",
                border: `1px solid transparent`,
                borderLeft: active ? `2px solid ${C.accent}` : `2px solid transparent`,
                borderRadius: collapsed ? 8 : "0 8px 8px 0",
                padding: collapsed ? "11px 0" : "9px 12px",
                color: active ? C.accent : C.textMuted,
                cursor: "pointer",
                fontSize: collapsed ? 16 : 12,
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 10,
                marginBottom: 2,
                transition: "all 0.15s",
                fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: "0.04em",
              }}
            >
              <span>{item.icon}</span>
              {!collapsed && item.label.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Terminal status (desktop only) */}
      {!collapsed && (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, margin: "8px 0" }}>
          {statusLines.map((l, i) => (
            <div key={i} style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 8,
              color: i === tick ? C.accent : C.textDim,
              marginBottom: 2,
              letterSpacing: "0.06em",
              opacity: i === tick ? 1 : 0.5,
            }}>► {l}</div>
          ))}
        </div>
      )}

      {/* User footer */}
      <div style={{ padding: collapsed ? "12px 6px 0" : "12px 16px 0" }}>
        {collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              border: `1px solid ${C.accent}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, color: C.accent, fontWeight: 700,
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              {profile?.full_name?.slice(0, 2).toUpperCase() || "FJ"}
            </div>
            <button onClick={onSignOut} title="Sair" style={{
              background: "none", border: `1px solid ${C.border}`, color: C.textMuted,
              borderRadius: 5, padding: "4px 7px", cursor: "pointer", fontSize: 11,
              fontFamily: "'Share Tech Mono', monospace",
            }}>↩</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                border: `1px solid ${C.accent}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, color: C.accent, fontWeight: 700, flexShrink: 0,
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                {profile?.full_name?.slice(0, 2).toUpperCase() || "FJ"}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ color: C.text, fontSize: 11, fontFamily: "'Exo 2', sans-serif", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {profile?.full_name?.split(" ")[0] || "Usuário"}
                </div>
                <div style={{ color: C.violet, fontSize: 8, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.08em" }}>
                  {(profile?.plan || "FREE").toUpperCase()} · ONLINE
                </div>
              </div>
            </div>
            <button onClick={onSignOut} style={{
              width: "100%", background: "none",
              border: `1px solid ${C.border}`, color: C.textMuted,
              borderRadius: 5, padding: "5px 9px", cursor: "pointer",
              fontSize: 9, textAlign: "left", fontFamily: "'Share Tech Mono', monospace",
              letterSpacing: "0.06em",
            }}>↩ DESCONECTAR</button>
          </>
        )}
      </div>
    </>
  );
}

// ============================================================
// MOBILE HEADER
// ============================================================
function MobileHeader({ onOpenDrawer, page }) {
  const labels = {
    dashboard: "DASHBOARD", biblioteca: "BIBLIOTECA",
    favoritos: "FAVORITOS", builder: "BUILDER", "meu-espaco": "MEU ESPAÇO",
  };
  return (
    <div style={{
      height: 52,
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 14px", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 26, height: 26, border: `1px solid ${C.accent}`,
          borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
          color: C.accent, fontSize: 12, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
        }}>FJ</div>
        <div style={{ color: C.accent, fontSize: 12, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}>FJ SMART</div>
      </div>
      <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em" }}>
        {labels[page] || ""}
      </div>
      <button onClick={onOpenDrawer} style={{
        background: "none", border: `1px solid ${C.border}`,
        color: C.textMuted, borderRadius: 6,
        padding: "5px 9px", cursor: "pointer", fontSize: 15,
        fontFamily: "'Share Tech Mono', monospace",
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
  const greeting = hora < 12 ? "BOM DIA" : hora < 18 ? "BOA TARDE" : "BOA NOITE";

  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";
  const statsColumns = isMobile ? "1fr 1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)";
  const cardsColumns = isMobile ? "1fr" : "1fr 1fr";

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 5 }}>
          ◈ {greeting}, {(profile?.full_name?.split(" ")[0] || "FELIPE").toUpperCase()} — SISTEMA OPERACIONAL
        </div>
        <div style={{ color: C.text, fontSize: isMobile ? 20 : 24, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.02em" }}>
          Dashboard
        </div>
      </div>

      {/* CNI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: statsColumns, gap: 12, marginBottom: 24 }}>
        <CniMetricCard
          label="TOTAL DE PROMPTS"
          value={prompts.length}
          subValue="NODES ATIVOS"
          color={C.accent}
          icon="◈"
        />
        <CniMetricCard
          label="SEUS USOS TOTAIS"
          value={profile?.total_uses || 0}
          subValue="DATA FLOW"
          color={C.cyan}
          icon="↗"
        />
        <CniMetricCard
          label="FAVORITOS SALVOS"
          value={prompts.filter(p => p.is_favorited).length}
          subValue="COLETADOS"
          color={C.gold}
          icon="★"
        />
        <CniMetricCard
          label="SEQUÊNCIA ATUAL"
          value={`${profile?.streak_days || 0}d`}
          subValue={`${profile?.streak_days >= 7 ? "STREAK ATIVO 🔥" : "CONTINUE"}`}
          color={C.violet}
          icon="△"
        />
      </div>

      {/* Featured prompts */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em" }}>
            ◈ PROMPTS EM DESTAQUE
          </div>
          <button onClick={() => onNavigate("biblioteca")} style={{
            background: "none", border: "none", color: C.accent,
            cursor: "pointer", fontSize: 9, fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: "0.08em",
          }}>VER TODOS →</button>
        </div>
        {loading ? <Spinner /> : (
          <div style={{ display: "grid", gridTemplateColumns: cardsColumns, gap: 12 }}>
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
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 5 }}>◈ EXPLORE —</div>
        <div style={{ color: C.text, fontSize: isMobile ? 20 : 24, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.02em" }}>
          Biblioteca
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>⌕</span>
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="buscar por título, descrição ou tag..."
          style={{
            width: "100%", background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "10px 13px 10px 34px",
            color: C.text, fontSize: 11, outline: "none", boxSizing: "border-box",
            fontFamily: "'Share Tech Mono', monospace",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 7, marginBottom: 20, flexWrap: "wrap" }}>
        {categories.map(cat => {
          const active = activeCat === cat.slug;
          return (
            <button key={cat.id} onClick={() => setActiveCat(cat.slug)} style={{
              background: active ? C.accentDim : C.surface,
              border: `1px solid ${active ? C.accent : C.border}`,
              color: active ? C.accent : C.textMuted,
              borderRadius: 6, padding: "5px 12px", cursor: "pointer",
              fontSize: 9, display: "flex", alignItems: "center", gap: 5,
              transition: "all 0.15s", fontFamily: "'Share Tech Mono', monospace",
              letterSpacing: "0.06em",
            }}>
              <span>{cat.icon}</span> {cat.label.toUpperCase()}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{
          background: "#FF4D6A10", border: "1px solid #FF4D6A30",
          borderRadius: 8, padding: "11px 14px", color: C.red, fontSize: 11, marginBottom: 14,
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          ▲ ERRO: {error}. Verifique a conexão com o Supabase.
        </div>
      )}

      {loading ? <Spinner /> : prompts.length === 0 ? (
        <EmptyState icon="◈" title="NENHUM PROMPT ENCONTRADO" subtitle="Tente outra categoria ou termo de busca" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: cardsColumns, gap: 12 }}>
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
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 5 }}>◈ COLEÇÃO —</div>
        <div style={{ color: C.text, fontSize: isMobile ? 20 : 24, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.02em" }}>
          Favoritos
        </div>
      </div>
      {loading ? <Spinner /> : favs.length === 0 ? (
        <EmptyState icon="★" title="NENHUM FAVORITO AINDA" subtitle="Clique em ☆ em qualquer prompt para salvar aqui" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
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

  const inputStyle = {
    width: "100%", background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 7, padding: "9px 12px", color: C.text,
    fontSize: 11, outline: "none", boxSizing: "border-box",
    fontFamily: "'Share Tech Mono', monospace",
  };

  const labelStyle = {
    color: C.accent, fontSize: 9,
    fontFamily: "'Share Tech Mono', monospace",
    letterSpacing: "0.14em", display: "block", marginBottom: 6,
  };

  const chipStyle = (active) => ({
    background: active ? C.accentDim : C.surface,
    border: `1px solid ${active ? C.accent : C.border}`,
    color: active ? C.accent : C.textMuted,
    borderRadius: 5, padding: "4px 9px", cursor: "pointer",
    fontSize: 9, fontFamily: "'Share Tech Mono', monospace",
    letterSpacing: "0.04em",
    transition: "all 0.15s",
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 5 }}>◈ CRIE SEU PRÓPRIO —</div>
        <div style={{ color: C.text, fontSize: isMobile ? 20 : 24, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.02em" }}>
          Prompt Builder
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: builderGrid, gap: 20 }}>
        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>◈ TÍTULO DO PROMPT</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Nome do prompt..." style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>◈ PAPEL / ROLE</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
              {roles.map(r => (
                <button key={r} onClick={() => setForm(p => ({ ...p, role: r }))} style={chipStyle(form.role === r)}>{r}</button>
              ))}
            </div>
            <input value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              placeholder="ou escreva livremente..." style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>◈ TAREFA / OBJETIVO</label>
            <textarea value={form.task} onChange={e => setForm(p => ({ ...p, task: e.target.value }))}
              placeholder="O que você quer que a IA faça?" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[{ key: "tone", label: "TOM", options: tones }, { key: "format", label: "FORMATO", options: formats }].map(group => (
              <div key={group.key}>
                <label style={labelStyle}>◈ {group.label}</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {group.options.map(o => (
                    <button key={o} onClick={() => setForm(p => ({ ...p, [group.key]: o }))}
                      style={{ ...chipStyle(form[group.key] === o), textAlign: "left" }}>{o}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={generate} style={{
            background: "transparent", color: C.accent,
            border: `1px solid ${C.accent}`,
            borderRadius: 8, padding: "12px 18px",
            cursor: "pointer", fontSize: 11, fontWeight: 700,
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: "0.1em",
            transition: "all 0.2s",
          }}>◈ GERAR PROMPT</button>
        </div>

        {/* Preview */}
        <div>
          <div style={{ color: C.accent, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 8 }}>◈ PREVIEW OUTPUT</div>
          <div style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderLeft: `2px solid ${C.accent}`,
            borderRadius: 10, padding: 14,
            minHeight: isMobile ? 140 : 260,
            color: generated ? C.text : C.textDim,
            fontSize: 11, lineHeight: 1.9,
            fontFamily: "'Share Tech Mono', monospace",
            whiteSpace: "pre-wrap", marginBottom: 10,
          }}>
            {generated || "// preencha os campos e clique em\n// GERAR PROMPT para ver o resultado..."}
          </div>
          {generated && (
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={handleCopy} style={{
                flex: 1,
                background: copied ? C.accentDim : "transparent",
                color: C.accent, border: `1px solid ${C.accent}`,
                borderRadius: 7, padding: "9px 14px",
                cursor: "pointer", fontSize: 10, fontWeight: 700,
                fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: "0.06em",
              }}>{copied ? "✓ COPIADO!" : "⎘ COPIAR"}</button>
              <button onClick={handleSave} disabled={saving || saved} style={{
                background: saved ? C.accentDim : "transparent",
                border: `1px solid ${saved ? C.accent : C.border}`,
                color: saved ? C.accent : C.textMuted,
                borderRadius: 7, padding: "9px 14px",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: 10, fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: "0.06em",
              }}>{saved ? "✓ SALVO!" : saving ? "SALVANDO..." : "SALVAR"}</button>
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
  const profileGrid = isMobile ? "1fr" : bp === "tablet" ? "1fr" : "240px 1fr";
  const achievementsColumns = isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)";

  const panelStyle = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 18,
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 5 }}>◈ SEU PERFIL —</div>
        <div style={{ color: C.text, fontSize: isMobile ? 20 : 24, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.02em" }}>
          Meu Espaço
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: profileGrid, gap: 16 }}>
        {/* Profile card */}
        <div style={{ ...panelStyle }}>
          {/* CNI-style corner */}
          <div style={{ position: "absolute", top: 8, left: 8, width: 10, height: 10, borderTop: `1px solid ${C.accent}`, borderLeft: `1px solid ${C.accent}`, opacity: 0.5 }} />
          <div style={{ position: "absolute", top: 8, right: 8, width: 10, height: 10, borderTop: `1px solid ${C.accent}`, borderRight: `1px solid ${C.accent}`, opacity: 0.5 }} />

          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              border: `1px solid ${C.accent}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: C.accent, fontWeight: 700, margin: "0 auto 10px",
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              {profile?.full_name?.slice(0, 2).toUpperCase() || "FJ"}
            </div>
            <div style={{ color: C.text, fontSize: 14, fontFamily: "'Exo 2', sans-serif", fontWeight: 700 }}>{profile?.full_name || "—"}</div>
            <div style={{ color: C.violet, fontSize: 8, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em", marginTop: 3 }}>
              {(profile?.plan || "FREE").toUpperCase()} · FJ SMART
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            {[
              ["TOTAL DE USOS", profile?.total_uses || 0],
              ["SEQUÊNCIA ATUAL", `${profile?.streak_days || 0} DIAS`],
              ["PLANO", (profile?.plan || "FREE").toUpperCase()],
              ["MEMBRO DESDE", profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).toUpperCase() : "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                <span style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>{l}</span>
                <span style={{ color: C.accent, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Conquistas */}
          <div style={{ ...panelStyle, marginBottom: 14 }}>
            <div style={{ color: C.accent, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 12 }}>
              ◈ CONQUISTAS · COGNITIVE STATUS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: achievementsColumns, gap: 9 }}>
              {defaultAchievements.map(a => (
                <div key={a.label} style={{
                  background: a.unlocked ? C.goldDim : C.bg,
                  border: `1px solid ${a.unlocked ? "#DCAF3C30" : C.border}`,
                  borderLeft: a.unlocked ? `2px solid ${C.gold}` : `2px solid ${C.border}`,
                  borderRadius: 8, padding: "10px 8px", textAlign: "center",
                  opacity: a.unlocked ? 1 : 0.35,
                }}>
                  <div style={{ fontSize: 18, marginBottom: 5 }}>{a.icon}</div>
                  <div style={{ color: a.unlocked ? C.gold : C.textMuted, fontSize: 8, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.4, letterSpacing: "0.04em" }}>
                    {a.label.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conta */}
          <div style={{ ...panelStyle }}>
            <div style={{ color: C.accent, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.14em", marginBottom: 12 }}>◈ CONTA · AUTH MODULE</div>
            <div style={{ color: C.textMuted, fontSize: 10, fontFamily: "'Share Tech Mono', monospace", marginBottom: 12 }}>{profile?.email}</div>
            <button onClick={signOut} style={{
              background: "#FF4D6A0A", color: C.red,
              border: "1px solid #FF4D6A30", borderRadius: 7,
              padding: "8px 16px", cursor: "pointer", fontSize: 9,
              fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.08em",
            }}>↩ DESCONECTAR</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APP SHELL
// ============================================================
function AppShell() {
  const { session, profile, loading, signOut } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bp = useBreakpoint();

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700;800&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: ${C.bg}; font-family: 'Share Tech Mono', monospace; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: ${C.bg}; }
      ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
      input, textarea, select { font-family: 'Share Tech Mono', monospace; }
      input::placeholder, textarea::placeholder { color: ${C.textDim}; }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse-green { 0%,100%{opacity:0.5} 50%{opacity:1} }
      button { font-family: 'Share Tech Mono', monospace; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    if (bp !== "mobile") setDrawerOpen(false);
  }, [bp]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.accent, fontSize: 26, marginBottom: 10, animation: "pulse-green 1.5s infinite" }}>◈</div>
          <div style={{ color: C.textMuted, fontSize: 9, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em" }}>INICIALIZANDO...</div>
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
  const contentPadding = isMobile ? "18px 14px 28px" : bp === "tablet" ? "22px 18px" : "24px 28px";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, overflow: "hidden" }}>
      {/* CNI Status Bar — desktop/tablet only */}
      {!isMobile && <CniStatusBar />}

      {/* Mobile top header */}
      {isMobile && <MobileHeader onOpenDrawer={() => setDrawerOpen(true)} page={page} />}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar
          page={page}
          setPage={setPage}
          profile={profile}
          onSignOut={signOut}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
          bp={bp}
        />
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
