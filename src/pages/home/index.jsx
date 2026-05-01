// Relay.jsx
import { useState, useCallback, useRef, useEffect } from "react";
import styles from "./relay.module.css";

// ── Constants ────────────────────────────────────────────────────────────
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const METHOD_STYLES = {
  GET:    { color: "var(--m-get-color)",    bg: "var(--m-get-bg)",    border: "var(--m-get-border)" },
  POST:   { color: "var(--m-post-color)",   bg: "var(--m-post-bg)",   border: "var(--m-post-border)" },
  PUT:    { color: "var(--m-put-color)",    bg: "var(--m-put-bg)",    border: "var(--m-put-border)" },
  PATCH:  { color: "var(--m-patch-color)",  bg: "var(--m-patch-bg)",  border: "var(--m-patch-border)" },
  DELETE: { color: "var(--m-delete-color)", bg: "var(--m-delete-bg)", border: "var(--m-delete-border)" },
};

const BODY_TYPES = ["none", "form-data", "raw · JSON"];
const REQ_TABS   = ["Params", "Authorization", "Headers", "Body"];
const RES_TABS   = ["Body", "Headers", "Timeline"];

const DEFAULT_HEADERS = [
  { key: "Authorization", value: "Bearer {{ACCESS_TOKEN}}", enabled: true },
  { key: "Content-Type",  value: "application/json",        enabled: true },
  { key: "Accept",        value: "application/json",        enabled: true },
  { key: "X-Request-ID",  value: "{{$guid}}",               enabled: false },
];

const DEFAULT_PARAMS = [
  { key: "page",     value: "1",  enabled: true },
  { key: "per_page", value: "20", enabled: true },
];

const DEFAULT_BODY = `{
  "ticket_id": 1042,
  "contact_id": 87,
  "association_type": "primary",
  "notify": true
}`;

const TIMELINE_ENTRIES = [
  { time: "0ms",   label: "DNS lookup",      width: 4  },
  { time: "12ms",  label: "TCP connect",      width: 18 },
  { time: "30ms",  label: "TLS handshake",    width: 26 },
  { time: "56ms",  label: "Request sent",     width: 6  },
  { time: "62ms",  label: "Waiting (TTFB)",   width: 54 },
  { time: "116ms", label: "Content download", width: 10 },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function getStatusClass(code) {
  if (!code) return "";
  if (code < 300) return styles.status2xx;
  if (code < 500) return styles.status4xx;
  return styles.status5xx;
}

function tokenizeLine(line) {
  const result = [];
  const m = line.match(/^(\s*)("[\w$@.\- ]+")\s*:\s*(.+)$/);
  if (m) {
    const [, indent, key, rest] = m;
    result.push({ type: "punct", text: indent });
    result.push({ type: "key",   text: key });
    result.push({ type: "punct", text: ": " });
    const val   = rest.replace(/,$/, "");
    const comma = rest.endsWith(",") ? "," : "";
    if (val === "true" || val === "false" || val === "null") {
      result.push({ type: "bool",  text: val });
    } else if (/^-?\d/.test(val)) {
      result.push({ type: "num",   text: val });
    } else if (val.startsWith('"')) {
      result.push({ type: "str",   text: val });
    } else {
      result.push({ type: "punct", text: val });
    }
    if (comma) result.push({ type: "punct", text: "," });
    return result;
  }
  return [{ type: "punct", text: line }];
}

function JsonBlock({ raw }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.85 }}>
      {raw.split("\n").map((line, i) => (
        <div key={i} className={styles.editorLine}>
          <span className={styles.lineNum}>{i + 1}</span>
          {tokenizeLine(line).map((tok, j) => {
            const cls =
              tok.type === "key"  ? styles.tokenKey  :
              tok.type === "str"  ? styles.tokenStr  :
              tok.type === "num"  ? styles.tokenNum  :
              tok.type === "bool" ? styles.tokenBool :
              styles.tokenPunct;
            return <span key={j} className={cls}>{tok.text}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

// ── MethodBtn ─────────────────────────────────────────────────────────────
function MethodBtn({ method, onSelect }) {
  const [open, setOpen] = useState(false);
  const ms = METHOD_STYLES[method];
  return (
    <div className={styles.methodWrapper}>
      <div
        className={styles.methodBtn}
        style={{ color: ms.color, background: ms.bg, borderColor: ms.border }}
        onClick={() => setOpen(o => !o)}
      >
        {method}
        <span className={styles.methodCaret}>▾</span>
      </div>
      {open && (
        <div className={styles.methodMenu}>
          {METHODS.map(m => {
            const s = METHOD_STYLES[m];
            return (
              <div
                key={m}
                className={styles.methodOption}
                style={{ color: s.color, background: method === m ? s.bg : undefined }}
                onClick={() => { onSelect(m); setOpen(false); }}
              >{m}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CopyButton ────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className={`${styles.copyBtn} ${copied ? styles.copied : ""}`} onClick={handle}>
      {copied ? "COPIED ✓" : "COPY"}
    </button>
  );
}

// ── Request panels ────────────────────────────────────────────────────────
function ParamsPanel({ params, setParams }) {
  return (
    <div className={styles.editorArea}>
      <table className={styles.paramsTable}>
        <thead><tr><th style={{ width: 20 }}></th><th>KEY</th><th>VALUE</th></tr></thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i}>
              <td>
                <input type="checkbox" checked={p.enabled}
                  onChange={() => { const n = [...params]; n[i] = { ...p, enabled: !p.enabled }; setParams(n); }}
                  style={{ accentColor: "var(--accent-green)" }}
                />
              </td>
              <td className={styles.tdKey}>{p.key}</td>
              <td className={styles.tdValue}>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className={styles.addRowBtn}
        onClick={() => setParams([...params, { key: "", value: "", enabled: true }])}>
        + Add Param
      </button>
    </div>
  );
}

function HeadersPanel({ headers, setHeaders }) {
  return (
    <div className={styles.editorArea}>
      <table className={styles.headersTable}>
        <thead><tr><th style={{ width: 20 }}></th><th>KEY</th><th>VALUE</th></tr></thead>
        <tbody>
          {headers.map((h, i) => (
            <tr key={i}>
              <td>
                <input type="checkbox" checked={h.enabled}
                  onChange={() => { const n = [...headers]; n[i] = { ...h, enabled: !h.enabled }; setHeaders(n); }}
                  style={{ accentColor: "var(--accent-green)", opacity: h.enabled ? 1 : 0.4 }}
                />
              </td>
              <td className={styles.tdKey}   style={{ opacity: h.enabled ? 1 : 0.4 }}>{h.key}</td>
              <td className={styles.tdValue} style={{ opacity: h.enabled ? 1 : 0.4 }}>{h.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className={styles.addRowBtn}
        onClick={() => setHeaders([...headers, { key: "", value: "", enabled: true }])}>
        + Add Header
      </button>
    </div>
  );
}

function BodyPanel({ bodyType, setBodyType, bodyText, setBodyText }) {
  // Sin toggle edit/preview — siempre muestra highlight + textarea superpuesto
  const sharedStyle = {
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    lineHeight: 1.9,
    padding: "1.5em 2em",
    margin: 0,
    boxSizing: "border-box",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  };

  return (
    <>
      <div className={styles.bodyTypes}>
        {BODY_TYPES.map(bt => (
          <div
            key={bt}
            className={`${styles.bodyType} ${bodyType === bt ? styles.activeBodyType : ""}`}
            onClick={() => setBodyType(bt)}
          >
            <div className={styles.radio}>
              {bodyType === bt && <div className={styles.radioDot} />}
            </div>
            {bt}
          </div>
        ))}
      </div>

      <div className={styles.editorArea} style={{ padding: 0, position: "relative" }}>
        {bodyType === "raw · JSON" ? (
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {/* Capa de highlight — detrás, no interactiva */}
            <div
              aria-hidden="true"
              style={{
                ...sharedStyle,
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {bodyText.split("\n").map((line, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", minHeight: "1.9em" }}>
                  <span style={{
                    color: "var(--text-dimmed)", marginRight: 20,
                    minWidth: 20, textAlign: "right", flexShrink: 0,
                    fontSize: 11, userSelect: "none",
                  }}>{i + 1}</span>
                  {tokenizeLine(line).map((tok, j) => {
                    const color =
                      tok.type === "key"   ? "var(--accent-blue)"   :
                      tok.type === "str"   ? "var(--accent-green)"  :
                      tok.type === "num"   ? "var(--accent-amber)"  :
                      tok.type === "bool"  ? "var(--accent-purple)" :
                      "var(--text-muted)";
                    return <span key={j} style={{ color }}>{tok.text}</span>;
                  })}
                </div>
              ))}
            </div>

            {/* Textarea encima — transparente, solo el caret es visible */}
            <textarea
              value={bodyText}
              onChange={e => setBodyText(e.target.value)}
              spellCheck={false}
              style={{
                ...sharedStyle,
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                resize: "none",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "transparent",
                caretColor: "var(--accent-green)",
                paddingLeft: "calc(2em + 40px)", // alineado con el texto (saltando los line numbers)
              }}
            />
          </div>
        ) : (
          <div className={styles.emptyPanel} style={{ padding: "1.5em 2em" }}>
            — {bodyType} —
          </div>
        )}
      </div>
    </>
  );
}

const AUTH_TYPES = ["No Auth", "Bearer Token", "Basic Auth", "API Key"];

function AuthPanel({ authType, setAuthType, authToken, setAuthToken, authPrefix, setAuthPrefix, authUser, setAuthUser, authPass, setAuthPass, authKey, setAuthKey, authKeyValue, setAuthKeyValue }) {
  const inputStyle = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--text-primary)",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "8px 12px",
    outline: "none",
    boxSizing: "border-box",
    caretColor: "var(--accent-green)",
    transition: "border-color 0.15s",
    width: "100%",
  };
  const labelStyle = {
    fontSize: 9, letterSpacing: "0.1em", color: "var(--text-dimmed)", marginBottom: 4,
  };

  return (
    <div className={styles.editorArea}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>

        {/* Auth type selector */}
        <div>
          <div style={labelStyle}>AUTH TYPE</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {AUTH_TYPES.map(t => (
              <div
                key={t}
                onClick={() => setAuthType(t)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  padding: "5px 12px",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor:  authType === t ? "#1a2a3f" : "var(--border)",
                  background:   authType === t ? "#0a0f1f" : "transparent",
                  color:        authType === t ? "var(--accent-blue)" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >{t}</div>
            ))}
          </div>
        </div>

        {/* No Auth */}
        {authType === "No Auth" && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dimmed)" }}>
            No authorization will be sent.
          </div>
        )}

        {/* Bearer Token */}
        {authType === "Bearer Token" && (
          <>
            {/* Prefix + Token en la misma fila */}
            <div>
              <div style={labelStyle}>PREFIX</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  style={{ ...inputStyle, width: 120, flex: "0 0 120px", color: "var(--accent-blue)" }}
                  value={authPrefix}
                  onChange={e => setAuthPrefix(e.target.value)}
                  placeholder="Bearer"
                  spellCheck={false}
                />
                <div style={{
                  display: "flex", alignItems: "center",
                  fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)",
                }}>+</div>
                <div style={{ flex: 1 }}>
                  <input
                    style={{ ...inputStyle, color: authToken ? "var(--accent-purple)" : "var(--text-muted)" }}
                    value={authToken}
                    onChange={e => setAuthToken(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
            {authToken && (
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: -6 }}>
                → Authorization: {authPrefix || "Bearer"} {authToken.slice(0, 24)}{authToken.length > 24 ? "…" : ""}
              </div>
            )}
          </>
        )}

        {/* Basic Auth */}
        {authType === "Basic Auth" && (
          <>
            <div>
              <div style={labelStyle}>USERNAME</div>
              <input style={inputStyle} value={authUser} onChange={e => setAuthUser(e.target.value)} placeholder="username" spellCheck={false} />
            </div>
            <div>
              <div style={labelStyle}>PASSWORD</div>
              <input style={{ ...inputStyle, color: authPass ? "var(--accent-purple)" : "var(--text-muted)" }}
                type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} placeholder="••••••••" />
            </div>
            {(authUser || authPass) && (
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                → Authorization: Basic {btoa(`${authUser}:${authPass}`).slice(0, 24)}…
              </div>
            )}
          </>
        )}

        {/* API Key */}
        {authType === "API Key" && (
          <>
            <div>
              <div style={labelStyle}>KEY</div>
              <input style={inputStyle} value={authKey} onChange={e => setAuthKey(e.target.value)} placeholder="X-API-Key" spellCheck={false} />
            </div>
            <div>
              <div style={labelStyle}>VALUE</div>
              <input style={{ ...inputStyle, color: authKeyValue ? "var(--accent-purple)" : "var(--text-muted)" }}
                value={authKeyValue} onChange={e => setAuthKeyValue(e.target.value)} placeholder="sk-..." spellCheck={false} />
            </div>
            {(authKey && authKeyValue) && (
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                → {authKey}: {authKeyValue.slice(0, 20)}{authKeyValue.length > 20 ? "…" : ""}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// ── Response panels ───────────────────────────────────────────────────────
function ResponseBodyPanel({ responseData }) {
  if (!responseData) {
    return (
      <div className={styles.responseBody}>
        <div className={styles.responseEmpty}>
          <span className={styles.responseEmptyIcon}>⟳</span>
          Press SEND to fire the request
        </div>
      </div>
    );
  }
  return (
    <div className={styles.responseBody}>
      <CopyButton text={responseData.body} />
      <JsonBlock raw={responseData.body} />
    </div>
  );
}

function ResponseHeadersPanel({ responseData }) {
  const entries = responseData?.headers ? Object.entries(responseData.headers) : [];
  return (
    <div className={styles.responseBody}>
      <table className={styles.headersTable}>
        <thead><tr><th>KEY</th><th>VALUE</th></tr></thead>
        <tbody>
          {entries.map(([k, v], i) => (
            <tr key={i}>
              <td className={styles.tdKey}>{k}</td>
              <td className={styles.tdValue}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelinePanel() {
  return (
    <div className={styles.responseBody}>
      {TIMELINE_ENTRIES.map((e, i) => (
        <div key={i} className={styles.timelineItem}>
          <span className={styles.timelineTime}>{e.time}</span>
          <span className={styles.timelineLabel}>{e.label}</span>
          <div className={styles.timelineBar} style={{ width: `${e.width}%` }} />
        </div>
      ))}
    </div>
  );
}

// ── ResizableDivider ──────────────────────────────────────────────────────
// Horizontal drag handle between left and right panels.
// Calls onResize(newLeftPercent) while dragging.
function ResizableDivider({ onResize, containerRef }) {
  const dragging = useRef(false);

  const onMouseDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.min(Math.max((x / rect.width) * 100, 20), 80);
      onResize(pct);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    // Touch support
    const onTouchMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const pct = Math.min(Math.max((x / rect.width) * 100, 20), 80);
      onResize(pct);
    };
    const onTouchEnd = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend",  onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend",  onTouchEnd);
    };
  }, [onResize, containerRef]);

  return (
    <div
      className={styles.divider}
      onMouseDown={onMouseDown}
      onTouchStart={(e) => { e.preventDefault(); dragging.current = true; }}
    >
      <div className={styles.dividerHandle} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function Relay() {
  const [method, setMethod]     = useState("POST");
  const [url, setUrl]           = useState("http://localhost:9001/api/v1/ticket/associate_contact_to_ticket/");
  const [reqTab, setReqTab]     = useState("Body");
  const [resTab, setResTab]     = useState("Body");
  const [bodyType, setBodyType] = useState("raw · JSON");
  const [bodyText, setBodyText] = useState(DEFAULT_BODY);
  const [headers, setHeaders]   = useState(DEFAULT_HEADERS);
  const [params, setParams]     = useState(DEFAULT_PARAMS);
  const [response, setResponse] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  // ── Auth state ────────────────────────────────────────────────────────
  const [authType,     setAuthType]     = useState("Bearer Token");
  const [authToken,    setAuthToken]    = useState("");
  const [authPrefix,   setAuthPrefix]   = useState("Bearer");
  const [authUser,     setAuthUser]     = useState("");
  const [authPass,     setAuthPass]     = useState("");
  const [authKey,      setAuthKey]      = useState("X-API-Key");
  const [authKeyValue, setAuthKeyValue] = useState("");

  // Responsive: en mobile mostramos una sola sección a la vez
  // "request" | "response"
  const [mobilePanel, setMobilePanel] = useState("request");

  // Split resize — porcentaje del left panel (solo desktop)
  const [splitPct, setSplitPct] = useState(50);
  const mainRef = useRef(null);

  // ── Real fetch ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    setLoading(true);
    setResTab("Body");
    setError(null);

    const reqHeaders = Object.fromEntries(
      headers.filter(h => h.enabled && h.key).map(h => [h.key, h.value])
    );

    // ── Inyectar auth según tipo ────────────────────────────────────────
    if (authType === "Bearer Token" && authToken.trim()) {
      reqHeaders["Authorization"] = `${authPrefix.trim() || "Bearer"} ${authToken.trim()}`;
    } else if (authType === "Basic Auth" && authUser) {
      reqHeaders["Authorization"] = `Basic ${btoa(`${authUser}:${authPass}`)}`;
    } else if (authType === "API Key" && authKey.trim() && authKeyValue.trim()) {
      reqHeaders[authKey.trim()] = authKeyValue.trim();
    }

    const enabledParams = params.filter(p => p.enabled && p.key);
    let fullUrl = url;
    if (enabledParams.length) {
      const qs = new URLSearchParams(enabledParams.map(p => [p.key, p.value])).toString();
      fullUrl = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
    }

    const hasBody = !["GET", "DELETE"].includes(method) && bodyType === "raw · JSON";
    const startTime = performance.now();

    try {
      const res = await fetch(fullUrl, {
        method,
        headers: reqHeaders,
        ...(hasBody && bodyText.trim() ? { body: bodyText } : {}),
      });

      const elapsed = Math.round(performance.now() - startTime);
      const rawText = await res.text();

      let prettyBody = rawText;
      try { prettyBody = JSON.stringify(JSON.parse(rawText), null, 2); } catch { /* no JSON */ }

      const resHeaders = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });

      setResponse({
        status:     res.status,
        statusText: res.statusText,
        time:       elapsed,
        size:       `${new Blob([rawText]).size} B`,
        body:       prettyBody,
        headers:    resHeaders,
      });

      // En mobile, ir automáticamente a la respuesta cuando llega
      setMobilePanel("response");
    } catch (err) {
      setError(err.message);
      setResponse(null);
      setMobilePanel("response");
    } finally {
      setLoading(false);
    }
  }, [url, method, headers, params, bodyType, bodyText, authType, authToken, authPrefix, authUser, authPass, authKey, authKeyValue]);

  return (
    <div className={styles.root}>

      {/* ── REQUEST BAR ──────────────────────────────────────── */}
      <div className={styles.requestBar}>
        <MethodBtn method={method} onSelect={setMethod} />
        <input
          className={styles.urlInput}
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://api.yourproject.com/endpoint/"
          spellCheck={false}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "..." : "SEND"}
        </button>
      </div>

      {/* ── MOBILE PANEL SWITCHER ─────────────────────────────── */}
      <div className={styles.mobileSwitcher}>
        <div
          className={`${styles.mobileSwitchBtn} ${mobilePanel === "request" ? styles.mobileSwitchActive : ""}`}
          onClick={() => setMobilePanel("request")}
        >Request</div>
        <div
          className={`${styles.mobileSwitchBtn} ${mobilePanel === "response" ? styles.mobileSwitchActive : ""}`}
          onClick={() => setMobilePanel("response")}
        >
          Response
          {response && (
            <span className={`${styles.statusBadge} ${getStatusClass(response.status)}`}
              style={{ marginLeft: 6, fontSize: 9, padding: "1px 6px" }}>
              {response.status}
            </span>
          )}
          {loading && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--accent-amber)" }}>…</span>}
        </div>
      </div>

      {/* ── MAIN SPLIT ───────────────────────────────────────── */}
      <div className={styles.main} ref={mainRef}>

        {/* LEFT — request editor */}
        <div
          className={`${styles.leftPanel} ${mobilePanel !== "request" ? styles.mobileHidden : ""}`}
          style={{ width: `${splitPct}%` }}
        >
          <div className={styles.innerTabs}>
            {REQ_TABS.map(t => (
              <div
                key={t}
                className={`${styles.innerTab} ${reqTab === t ? styles.activeInnerTab : ""}`}
                onClick={() => setReqTab(t)}
              >
                {t}
                {t === "Headers" && (
                  <span className={styles.badge}>{headers.filter(h => h.enabled).length}</span>
                )}
              </div>
            ))}
          </div>

          {reqTab === "Body"          && <BodyPanel bodyType={bodyType} setBodyType={setBodyType} bodyText={bodyText} setBodyText={setBodyText} />}
          {reqTab === "Headers"       && <HeadersPanel headers={headers} setHeaders={setHeaders} />}
          {reqTab === "Params"        && <ParamsPanel params={params} setParams={setParams} />}
          {reqTab === "Authorization" && <AuthPanel
            authType={authType}         setAuthType={setAuthType}
            authToken={authToken}       setAuthToken={setAuthToken}
            authPrefix={authPrefix}     setAuthPrefix={setAuthPrefix}
            authUser={authUser}         setAuthUser={setAuthUser}
            authPass={authPass}         setAuthPass={setAuthPass}
            authKey={authKey}           setAuthKey={setAuthKey}
            authKeyValue={authKeyValue} setAuthKeyValue={setAuthKeyValue}
          />}
        </div>

        {/* DIVIDER — solo visible en desktop */}
        <ResizableDivider
          containerRef={mainRef}
          onResize={setSplitPct}
        />

        {/* RIGHT — response */}
        <div
          className={`${styles.rightPanel} ${mobilePanel !== "response" ? styles.mobileHidden : ""}`}
          style={{ width: `${100 - splitPct}%` }}
        >
          <div className={styles.responseHeader}>
            <span className={styles.responseTitle}>RESPONSE</span>
            {response && (
              <>
                <div className={`${styles.statusBadge} ${getStatusClass(response.status)}`}>
                  {response.status} {response.statusText}
                </div>
                <span className={styles.metaPill}>{response.time} ms</span>
                <span className={styles.metaDot}>·</span>
                <span className={styles.metaPill}>{response.size}</span>
              </>
            )}
            {loading && <span className={styles.metaPill} style={{ color: "var(--accent-amber)" }}>sending...</span>}
            {error   && <span className={styles.metaPill} style={{ color: "var(--accent-red)" }}>{error}</span>}
            <div className={styles.headerSpacer} />
            <button className={styles.historyBtn}>⟳ History ▾</button>
          </div>

          <div className={styles.responseTabs}>
            {RES_TABS.map(t => (
              <div
                key={t}
                className={`${styles.responseTab} ${resTab === t ? styles.activeResTab : ""}`}
                onClick={() => setResTab(t)}
              >{t}</div>
            ))}
          </div>

          {resTab === "Body"     && <ResponseBodyPanel    responseData={response} />}
          {resTab === "Headers"  && <ResponseHeadersPanel responseData={response} />}
          {resTab === "Timeline" && <TimelinePanel />}
        </div>
      </div>
    </div>
  );
}