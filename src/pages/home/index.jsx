// Relay.jsx
// Drop-in API client component. Zero external deps beyond React.
// Usage: <Relay />

import { useState, useRef, useCallback } from "react";
import styles from "./home.module.css";

// ── Constants ────────────────────────────────────────────────────────────
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const METHOD_STYLES = {
  GET:    { color: "var(--m-get-color)",    bg: "var(--m-get-bg)",    border: "var(--m-get-border)" },
  POST:   { color: "var(--m-post-color)",   bg: "var(--m-post-bg)",   border: "var(--m-post-border)" },
  PUT:    { color: "var(--m-put-color)",    bg: "var(--m-put-bg)",    border: "var(--m-put-border)" },
  PATCH:  { color: "var(--m-patch-color)",  bg: "var(--m-patch-bg)",  border: "var(--m-patch-border)" },
  DELETE: { color: "var(--m-delete-color)", bg: "var(--m-delete-bg)", border: "var(--m-delete-border)" },
};

const BODY_TYPES = ["none", "form-data", "urlencoded", "raw · JSON", "binary"];
const REQ_TABS   = ["Params", "Authorization", "Headers", "Body", "Scripts"];
const RES_TABS   = ["Body", "Headers", "Timeline"];

const DEFAULT_TABS = [
  { id: 1, method: "GET",    label: "GET /users/",             url: "http://localhost:8000/api/v1/users/" },
  { id: 2, method: "POST",   label: "POST /ticket/associate",  url: "http://localhost:9001/api/v1/ticket/associate_contact_to_ticket/" },
  { id: 3, method: "DELETE", label: "DELETE /comments/:id",    url: "http://localhost:8000/api/v1/comments/42/" },
];

const DEFAULT_HEADERS = [
  { key: "Authorization", value: "Bearer {{ACCESS_TOKEN}}", enabled: true },
  { key: "Content-Type",  value: "application/json",        enabled: true },
  { key: "Accept",        value: "application/json",        enabled: true },
  { key: "X-Request-ID",  value: "{{$guid}}",               enabled: false },
];

const DEFAULT_PARAMS = [
  { key: "page",     value: "1",    enabled: true },
  { key: "per_page", value: "20",   enabled: true },
];

const DEFAULT_BODY = `{
  "ticket_id": 1042,
  "contact_id": 87,
  "association_type": "primary",
  "notify": true
}`;

const MOCK_RESPONSE_RAW = `{
  "status": "success",
  "message": "Contact associated successfully",
  "data": {
    "id": 5521,
    "ticket_id": 1042,
    "contact_id": 87,
    "type": "primary",
    "notified": true,
    "created_at": "2026-04-15T09:41:00Z"
  }
}`;

const TIMELINE_ENTRIES = [
  { time: "0ms",   label: "DNS lookup",        width: 4  },
  { time: "12ms",  label: "TCP connect",        width: 18 },
  { time: "30ms",  label: "TLS handshake",      width: 26 },
  { time: "56ms",  label: "Request sent",       width: 6  },
  { time: "62ms",  label: "Waiting (TTFB)",     width: 54 },
  { time: "116ms", label: "Content download",   width: 10 },
];

const RES_HEADERS = [
  { key: "Content-Type",   value: "application/json; charset=utf-8" },
  { key: "Allow",          value: "GET, POST, HEAD, OPTIONS"        },
  { key: "X-Frame-Options", value: "DENY"                           },
  { key: "Vary",           value: "Accept, Cookie"                  },
  { key: "Server",         value: "nginx/1.25.3"                    },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function getStatusClass(code) {
  if (!code) return "";
  if (code < 300) return styles.status2xx;
  if (code < 500) return styles.status4xx;
  return styles.status5xx;
}

function tokenizeLine(line) {
  // Simple JSON syntax highlight tokenizer
  const result = [];
  // match: optional indent, key, colon, value
  const m = line.match(/^(\s*)("[\w$@.\- ]+")\s*:\s*(.+)$/);
  if (m) {
    const [, indent, key, rest] = m;
    result.push({ type: "punct",  text: indent });
    result.push({ type: "key",    text: key });
    result.push({ type: "punct",  text: ": " });
    const val = rest.replace(/,$/, "");
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
  const lines = raw.split("\n");
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.85 }}>
      {lines.map((line, i) => (
        <div key={i} className={styles.editorLine}>
          <span className={styles.lineNum}>{i + 1}</span>
          {tokenizeLine(line).map((tok, j) => {
            const cls =
              tok.type === "key"   ? styles.tokenKey   :
              tok.type === "str"   ? styles.tokenStr   :
              tok.type === "num"   ? styles.tokenNum   :
              tok.type === "bool"  ? styles.tokenBool  :
              styles.tokenPunct;
            return <span key={j} className={cls}>{tok.text}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────
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

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      className={`${styles.copyBtn} ${copied ? styles.copied : ""}`}
      onClick={handle}
    >
      {copied ? "COPIED ✓" : "COPY"}
    </button>
  );
}

// ── Request editor panels ─────────────────────────────────────────────────
function ParamsPanel({ params, setParams }) {
  return (
    <div className={styles.editorArea}>
      <table className={styles.paramsTable}>
        <thead>
          <tr>
            <th style={{ width: 20 }}></th>
            <th>KEY</th>
            <th>VALUE</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i}>
              <td>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={() => {
                    const next = [...params];
                    next[i] = { ...p, enabled: !p.enabled };
                    setParams(next);
                  }}
                  style={{ accentColor: "var(--accent-green)" }}
                />
              </td>
              <td className={styles.tdKey}>{p.key}</td>
              <td className={styles.tdValue}>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className={styles.addRowBtn}
        onClick={() => setParams([...params, { key: "", value: "", enabled: true }])}
      >+ Add Param</button>
    </div>
  );
}

function HeadersPanel({ headers, setHeaders }) {
  return (
    <div className={styles.editorArea}>
      <table className={styles.headersTable}>
        <thead>
          <tr>
            <th style={{ width: 20 }}></th>
            <th>KEY</th>
            <th>VALUE</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h, i) => (
            <tr key={i}>
              <td>
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={() => {
                    const next = [...headers];
                    next[i] = { ...h, enabled: !h.enabled };
                    setHeaders(next);
                  }}
                  style={{ accentColor: "var(--accent-green)", opacity: h.enabled ? 1 : 0.4 }}
                />
              </td>
              <td className={styles.tdKey} style={{ opacity: h.enabled ? 1 : 0.4 }}>{h.key}</td>
              <td className={styles.tdValue} style={{ opacity: h.enabled ? 1 : 0.4 }}>{h.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className={styles.addRowBtn}
        onClick={() => setHeaders([...headers, { key: "", value: "", enabled: true }])}
      >+ Add Header</button>
    </div>
  );
}

function BodyPanel({ bodyType, setBodyType, bodyText, setBodyText }) {
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
      <div className={styles.editorArea}>
        {bodyType === "raw · JSON" ? (
          <JsonBlock raw={bodyText} />
        ) : (
          <div className={styles.emptyPanel}>— {bodyType} —</div>
        )}
      </div>
    </>
  );
}

function AuthPanel() {
  return (
    <div className={styles.editorArea}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 400 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--text-dimmed)" }}>AUTH TYPE</div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-blue)",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)", padding: "8px 12px",
        }}>Bearer Token</div>
        <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--text-dimmed)", marginTop: 4 }}>TOKEN</div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-purple)",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)", padding: "8px 12px",
        }}>{"{{ACCESS_TOKEN}}"}</div>
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
  return (
    <div className={styles.responseBody}>
      <table className={styles.headersTable}>
        <thead>
          <tr><th>KEY</th><th>VALUE</th></tr>
        </thead>
        <tbody>
          {RES_HEADERS.map((h, i) => (
            <tr key={i}>
              <td className={styles.tdKey}>{h.key}</td>
              <td className={styles.tdValue}>{h.value}</td>
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

// ── Main component ────────────────────────────────────────────────────────
export default function Relay() {
  const [openTabs, setOpenTabs]     = useState(DEFAULT_TABS);
  const [activeTabId, setActiveTabId] = useState(2);

  const [method, setMethod]         = useState("POST");
  const [url, setUrl]               = useState(DEFAULT_TABS[1].url);
  const [reqTab, setReqTab]         = useState("Body");
  const [resTab, setResTab]         = useState("Body");
  const [bodyType, setBodyType]     = useState("raw · JSON");
  const [bodyText]                  = useState(DEFAULT_BODY);
  const [headers, setHeaders]       = useState(DEFAULT_HEADERS);
  const [params, setParams]         = useState(DEFAULT_PARAMS);
  const [response, setResponse]     = useState(null);
  const [loading, setLoading]       = useState(false);

  const nextId = useRef(openTabs.length + 1);

  const handleSend = useCallback(async () => {
    setLoading(true);
    setResTab("Body");
    // Simulate network delay, then return mock response
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    setResponse({
      status: 201,
      statusText: "Created",
      time: Math.floor(100 + Math.random() * 80),
      size: "480 B",
      body: MOCK_RESPONSE_RAW,
    });
    setLoading(false);
  }, []);

  const handleTabClick = (tab) => {
    setActiveTabId(tab.id);
    setMethod(tab.method);
    setUrl(tab.url);
    setResponse(null);
  };

  const handleAddTab = () => {
    const id = ++nextId.current;
    const newTab = { id, method: "GET", label: `GET /new-request`, url: "" };
    setOpenTabs(t => [...t, newTab]);
    setActiveTabId(id);
    setMethod("GET");
    setUrl("");
    setResponse(null);
  };

  const handleCloseTab = (e, id) => {
    e.stopPropagation();
    const filtered = openTabs.filter(t => t.id !== id);
    setOpenTabs(filtered);
    if (activeTabId === id && filtered.length) {
      handleTabClick(filtered[filtered.length - 1]);
    }
  };

  const ms = METHOD_STYLES[method];

  return (
    <div className={styles.root}>

      {/* ── TOPBAR ─────────────────────────────────────────── */}
      <div className={styles.topbar}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>R</div>
          <span className={styles.logoName}>relay</span>
        </div>

        <div className={styles.tabStrip}>
          {openTabs.map(tab => {
            const tms = METHOD_STYLES[tab.method];
            return (
              <div
                key={tab.id}
                className={`${styles.requestTab} ${activeTabId === tab.id ? styles.activeTab : ""}`}
                onClick={() => handleTabClick(tab)}
              >
                <div className={styles.tabDot} style={{ background: tms.color }} />
                {tab.label}
                <span
                  className={styles.tabClose}
                  onClick={e => handleCloseTab(e, tab.id)}
                >×</span>
              </div>
            );
          })}
          <div className={styles.tabAdd} onClick={handleAddTab}>+</div>
        </div>

        <div className={styles.topbarSpacer} />
        <div className={styles.envSelect}>ENV: local ▾</div>
      </div>

      {/* ── REQUEST BAR ─────────────────────────────────────── */}
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

      {/* ── MAIN SPLIT ──────────────────────────────────────── */}
      <div className={styles.main}>

        {/* LEFT — request editor */}
        <div className={styles.leftPanel}>
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

          {reqTab === "Body" && (
            <BodyPanel
              bodyType={bodyType}
              setBodyType={setBodyType}
              bodyText={bodyText}
              setBodyText={() => {}}
            />
          )}
          {reqTab === "Headers" && (
            <HeadersPanel headers={headers} setHeaders={setHeaders} />
          )}
          {reqTab === "Params" && (
            <ParamsPanel params={params} setParams={setParams} />
          )}
          {reqTab === "Authorization" && <AuthPanel />}
          {reqTab === "Scripts" && (
            <div className={styles.editorArea}>
              <div className={styles.emptyPanel}>— Pre/post request scripts coming soon —</div>
            </div>
          )}
        </div>

        {/* RIGHT — response */}
        <div className={styles.rightPanel}>
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
            {loading && (
              <span className={styles.metaPill} style={{ color: "var(--accent-amber)" }}>
                sending...
              </span>
            )}
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

      {/* ── STATUS BAR ──────────────────────────────────────── */}
      <div className={styles.statusBar}>
        <span className={styles.statusItem}>RELAY</span>
        <span className={styles.statusDot}>·</span>
        <span className={styles.statusItem}>iris · local</span>
        <span className={styles.statusDot}>·</span>
        <span className={styles.statusItem} style={{ color: "var(--text-muted)" }}>
          {method} {url || "—"}
        </span>
        <div className={styles.statusSpacer} />
        <span className={styles.statusItem}>JSON</span>
        <span className={styles.statusDot}>·</span>
        <span className={styles.statusItem}>UTF-8</span>
      </div>

    </div>
  );
}