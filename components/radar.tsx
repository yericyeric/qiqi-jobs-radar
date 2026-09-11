"use client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Radar,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  Settings2,
  Plus,
  MapPin,
  Clock3,
  Check,
  ChevronRight,
  X,
  Upload,
  ArrowRight,
  LogOut,
  Target,
  Radio,
  LayoutDashboard,
  FileJson,
  Download,
  Flag,
  CheckCheck,
  Menu,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  type RadarState,
  type Job,
  type Action,
  type Profile,
  type Organization,
  type Application,
  profileSchema,
  jobInputSchema,
  organizationSchema,
  applicationSchema,
  categories,
  stages,
} from "../lib/contracts";
import { makeSample } from "../lib/sample";
import { act, refresh, importJobs } from "../lib/state";
import {
  ageHours,
  freshness,
  posting,
  dismissed,
  latestAction,
  affiliation,
  outreachScore,
  normalize,
} from "../lib/engine";
const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";
const STORE = "qiqi-radar-demo-v1";
import {
  inMarket,
  compareRecentFit,
  marketLabels,
  type Market,
} from "../lib/markets";
type View =
  | "radar"
  | "saved"
  | "hidden"
  | "organizations"
  | "applications"
  | "profile"
  | "admin";
const navigation = [
  { id: "radar", label: "Your radar", icon: Radar },
  { id: "saved", label: "Saved opportunities", icon: Bookmark },
  { id: "hidden", label: "Hidden Market", icon: Radio },
  { id: "organizations", label: "Organizations", icon: Building2 },
  { id: "applications", label: "Applications", icon: BriefcaseBusiness },
] as const;
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/${path}/`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Unable to save changes.");
  return data;
}
function timeLabel(j: Job) {
  const h = ageHours(j);
  return !Number.isFinite(h)
    ? "Posting date unknown"
    : h < 1
      ? "Posted <1h ago"
      : h < 48
        ? `Posted ${Math.floor(h)}h ago`
        : `Posted ${Math.floor(h / 24)}d ago`;
}
const pretty = (s: string) =>
  s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <header className="modal-head">
        <h2>{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
function External({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={15} />
    </a>
  );
}
export default function RadarApp() {
  const [market, setMarket] = useState<Market>("miami");
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        if (localStorage.getItem("qiqi-radar-market") === "charleston")
          setMarket("charleston");
      } catch {
        /* Use Miami when storage is unavailable. */
      }
    });
  }, []);
  const [inverted, setInverted] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        setInverted(localStorage.getItem("qiqi-radar-inverted") === "true");
      } catch {
        /* Theme still works without browser storage. */
      }
    });
  }, []);
  useEffect(() => {
    document.documentElement.dataset.inverted = String(inverted);
    return () => {
      delete document.documentElement.dataset.inverted;
    };
  }, [inverted]);
  function toggleColors() {
    const next = !inverted;
    setInverted(next);
    try {
      localStorage.setItem("qiqi-radar-inverted", String(next));
    } catch {
      /* Keep the current session's selection. */
    }
  }
  const [state, setState] = useState<RadarState | null>(null),
    [view, setView] = useState<View>("radar"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [login, setLogin] = useState(false),
    [key, setKey] = useState("");
  const [query, setQuery] = useState(""),
    [hours, setHours] = useState("48"),
    [fit, setFit] = useState("70"),
    [county, setCounty] = useState("Any"),
    [category, setCategory] = useState("Any"),
    [status, setStatus] = useState("Any"),
    [work, setWork] = useState("Any"),
    [orgFilter, setOrgFilter] = useState("Any"),
    [sort, setSort] = useState("recent-fit"),
    [filters, setFilters] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [importing, setImporting] = useState<"jobs" | "organization" | null>(null),
    [editApp, setEditApp] = useState<Application | null>(null),
    [mobile, setMobile] = useState(false);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        if (DEMO) {
          const raw = localStorage.getItem(STORE);
          let s = makeSample();
          if (raw) {
            const parsed = JSON.parse(raw);
            profileSchema.parse(parsed.profile);
            if (
              !Array.isArray(parsed.jobs) ||
              !Array.isArray(parsed.history) ||
              !Array.isArray(parsed.applications) ||
              !Array.isArray(parsed.organizations) ||
              !Array.isArray(parsed.runs)
            )
              throw new Error(
                "The saved demo data could not be read. Export your browser data before clearing this site’s storage.",
              );
            s = parsed;
          }
          if (s.profile.locationVersion !== 2) {
            const additions = makeSample();
            for (const o of additions.organizations.filter(
              (o) => o.county === "Charleston",
            ))
              if (!s.organizations.some((existing) => existing.id === o.id))
                s.organizations.push(o);
            for (const job of additions.jobs.filter(
              (j) => j.organization.county === "Charleston",
            ))
              if (!s.jobs.some((existing) => existing.id === job.id))
                s.jobs.push(job);
          }
          s = refresh(s);
          localStorage.setItem(STORE, JSON.stringify(s));
          if (alive) setState(s);
        } else {
          const s = await api("state");
          if (alive) setState(s);
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Unable to load radar.");
          if (!DEMO) setLogin(true);
        }
      }
    }
    void load();
    const clock = setInterval(
      () => setState((s) => (s ? refresh(s) : s)),
      60000,
    );
    return () => {
      alive = false;
      clearInterval(clock);
    };
  }, []);
  async function commit(
    path: string,
    method: string,
    body: unknown,
    local: (s: RadarState) => RadarState,
    message: string,
  ) {
    if (busy || !stateRef.current) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = DEMO
        ? local(structuredClone(stateRef.current))
        : await api(path, method, body);
      if (DEMO) localStorage.setItem(STORE, JSON.stringify(next));
      setState(next);
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Changes could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function action(j: Job, a: Action) {
    return commit(
      "action",
      "POST",
      { jobId: j.id, action: a },
      (s) => act(s, j.id, a),
      a === "Dismiss"
        ? "Opportunity dismissed."
        : a === "False Match"
          ? "Feedback saved."
          : a === "Report Closed"
            ? "Marked closed."
            : `Moved to ${a}.`,
    );
  }
  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("login", "POST", { key });
      setKey("");
      setState(await api("state"));
      setLogin(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  const j = state?.jobs.find((x) => x.id === selected);
  function go(v: View) {
    setView(v);
    setMobile(false);
    setNotice("");
  }
  function switchMarket(next: Market) {
    setMarket(next);
    setHours("48");
    setFit("70");
    setSort("recent-fit");
    setCounty("Any");
    setCategory("Any");
    setStatus("Any");
    setWork("Any");
    setOrgFilter("Any");
    setQuery("");
    if (view !== "hidden" && view !== "organizations" && view !== "saved")
      setView("radar");
    try {
      localStorage.setItem("qiqi-radar-market", next);
    } catch {
      /* Selection remains active for this visit. */
    }
  }
  function exportData() {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qiqi-radar-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const saved =
    state?.jobs.filter(
      (j) => latestAction(state.history, j)?.action === "Saved",
    ).length || 0;
  const jobs =
    state?.jobs.filter(
      (j) =>
        !dismissed(state.history, j) &&
        inMarket(j.organization, market) &&
        !["CLOSED", "EXPIRED"].includes(j.status),
    ) || [];
  const filtered = (
    view === "saved"
      ? state?.jobs.filter(
          (j) => latestAction(state.history, j)?.action === "Saved",
        ) || []
      : jobs
  )
    .filter(
      (j) =>
        inMarket(j.organization, market) &&
        (view === "saved" || ageHours(j) <= Number(hours)) &&
        j.score.total >= Number(fit) &&
        (county === "Any" || j.organization.county === county) &&
        (category === "Any" || j.category === category) &&
        (status === "Any" || j.status === status) &&
        (work === "Any" || j.employmentType === work) &&
        (orgFilter === "Any" ||
          (orgFilter === "Small companies"
            ? j.organization.size === "Small"
            : orgFilter === "Chinese/Asian-affiliated"
              ? affiliation(j.organization).length > 0
              : j.organization.type
                  .toLowerCase()
                  .includes(orgFilter.toLowerCase()))) &&
        `${j.title} ${j.organization.name} ${j.location} ${j.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "recent-fit"
        ? compareRecentFit(a, b)
        : sort === "new"
          ? ageHours(a) - ageHours(b)
          : b.score.total - a.score.total || ageHours(a) - ageHours(b),
    );
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to opportunities
      </a>
      <div className="app-shell">
        <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("radar");
            }}
          >
            <span className="brand-icon">
              <Radar size={24} />
            </span>
            <span>
              <span className="brand-name">Qiqi Job Radar</span>
            </span>
          </a>
          <div className="workspace-label">YOUR WORKSPACE</div>
          <nav aria-label="Main navigation">
            {navigation.map((n) => (
              <button
                key={n.id}
                className={`nav-item ${view === n.id ? "active" : ""}`}
                onClick={() => go(n.id)}
                aria-current={view === n.id ? "page" : undefined}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.id === "saved" && saved > 0 && (
                  <span className="nav-count">{saved}</span>
                )}
                {n.id === "hidden" && (
                  <span className="new-label">EXPLORE</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="coverage">
              <span className="pulse-dot" />{" "}
              {market === "miami" ? "SOUTH FLORIDA" : "SOUTH CAROLINA"}
              <div>
                {market === "miami" ? "Miami-Dade + Broward" : "Charleston"}
              </div>
              <p>Opportunities close to your next chapter.</p>
            </div>
            <button
              className={`nav-item ${view === "admin" ? "active" : ""}`}
              onClick={() => go("admin")}
            >
              <Settings2 size={19} />
              Sources & activity
            </button>
            <button
              className={`profile-nav ${view === "profile" ? "active" : ""}`}
              onClick={() => go("profile")}
            >
              <span className="avatar">QS</span>
              <span>
                <strong>{state?.profile.name || "Qiqi Su"}</strong>
                <small>Candidate profile</small>
              </span>
              <ChevronRight size={17} />
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div>
              <Button
                variant="ghost"
                className="mobile-menu"
                aria-label="Toggle navigation"
                onClick={() => setMobile(!mobile)}
              >
                <Menu size={22} />
              </Button>
              <span className="breadcrumb">Your workspace</span>
              <ChevronRight size={14} />
              <strong>
                {view === "radar"
                  ? "Opportunity radar"
                  : view === "hidden"
                    ? "Hidden Market"
                    : pretty(view)}
              </strong>
            </div>
            <div>
              <span className="mode-pill">
                <span className="pulse-dot" />
                {DEMO ? "Demo workspace" : "Private workspace"}
              </span>
              {state && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImporting("jobs")}
                >
                  <Plus size={16} />
                  Import jobs
                </Button>
              )}
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            <section className="market-switch" aria-label="Job search location">
              <div>
                <strong>Where’s your next chapter?</strong>
                <p>Fresh opportunities for Qiqi · 48 hours · 70+ fit</p>
              </div>
              <div
                className="market-buttons"
                role="group"
                aria-label="Choose a job market"
              >
                <Button
                  variant={market === "miami" ? "default" : "outline"}
                  aria-pressed={market === "miami"}
                  onClick={() => switchMarket("miami")}
                >
                  <MapPin size={16} />
                  Miami / South Florida
                </Button>
                <Button
                  variant={market === "charleston" ? "default" : "outline"}
                  aria-pressed={market === "charleston"}
                  onClick={() => switchMarket("charleston")}
                >
                  <MapPin size={16} />
                  Charleston, SC
                </Button>
              </div>
            </section>
            {DEMO && (
              <div className="demo-banner">
                <span>
                  <strong>Interactive demo</strong> · Fictional opportunities.
                  Changes stay in this browser. Automatic search is off.
                </span>
              </div>
            )}
            {error && (
              <div className="message error" role="alert">
                {error}
                <button onClick={() => setError("")} aria-label="Dismiss error">
                  <X size={16} />
                </button>
              </div>
            )}
            {notice && (
              <div className="message success" role="status">
                {notice}
                <button
                  onClick={() => setNotice("")}
                  aria-label="Dismiss notice"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {!state &&
              (login ? (
                <section className="login-panel">
                  <span className="brand-icon">
                    <Radar />
                  </span>
                  <h1>Your next opportunity, in focus.</h1>
                  <p>Enter your private workspace access key.</p>
                  <form onSubmit={signIn}>
                    <label>
                      Access key
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        required
                      />
                    </label>
                    <Button disabled={busy}>
                      {busy ? "Opening radar…" : "Open my radar"}
                      <ArrowRight size={18} />
                    </Button>
                  </form>
                </section>
              ) : (
                <div className="empty">
                  <Radar size={34} />
                  <h2>
                    {error
                      ? "Radar could not be loaded"
                      : "Preparing your radar…"}
                  </h2>
                </div>
              ))}
            {state && (
              <>
                {(view === "radar" || view === "saved") && (
                  <>
                    <section className="page-heading">
                      <div>
                        <div className="eyebrow">
                          A MORE PERSONAL JOB SEARCH
                        </div>
                        <h1>
                          {view === "saved"
                            ? "Worth a closer look."
                            : "Good opportunities. Real possibility."}
                        </h1>
                        <p>
                          Live Entertainment <i>·</i> Events <i>·</i> Production{" "}
                          <i>·</i> Media{" "}
                          <span className="heading-location">
                            <MapPin size={14} />
                            {marketLabels[market]}
                          </span>
                        </p>
                      </div>
                      <span className="radar-stamp">
                        <Radar size={44} />
                      </span>
                    </section>
                    <div className="stat-grid">
                      <button
                        className="stat-card accent-stat"
                        onClick={() => {
                          setHours("48");
                          setFit("80");
                        }}
                      >
                        <span>
                          BEST NEW MATCHES
                          <Target size={18} />
                        </span>
                        <strong>
                          {jobs
                            .filter(
                              (j) => j.score.total >= 80 && ageHours(j) <= 48,
                            )
                            .length.toString()
                            .padStart(2, "0")}
                        </strong>
                        <small>
                          80+ fit · last 48 hours
                          <ArrowUpRight size={15} />
                        </small>
                      </button>
                      <button
                        className="stat-card"
                        onClick={() => {
                          setHours("24");
                          setFit("70");
                        }}
                      >
                        <span>
                          NEW IN 24 HOURS
                          <Clock3 size={18} />
                        </span>
                        <strong>
                          {jobs
                            .filter(
                              (j) => ageHours(j) <= 24 && j.score.total >= 60,
                            )
                            .length.toString()
                            .padStart(2, "0")}
                        </strong>
                        <small>
                          A fresh start
                          <ArrowUpRight size={15} />
                        </small>
                      </button>
                      <button
                        className="stat-card"
                        onClick={() => {
                          setOrgFilter("Small companies");
                          setHours("48");
                        }}
                      >
                        <span>
                          SMALL COMPANIES
                          <Building2 size={18} />
                        </span>
                        <strong>
                          {jobs
                            .filter((j) => j.organization.size === "Small")
                            .length.toString()
                            .padStart(2, "0")}
                        </strong>
                        <small>
                          Local teams, meaningful work
                          <ArrowUpRight size={15} />
                        </small>
                      </button>
                      <button
                        className="stat-card"
                        onClick={() => go("applications")}
                      >
                        <span>
                          YOUR APPLICATIONS
                          <BriefcaseBusiness size={18} />
                        </span>
                        <strong>
                          {state.applications
                            .filter(
                              (a) =>
                                !["Saved", "Planning to Apply"].includes(
                                  a.stage,
                                ),
                            )
                            .length.toString()
                            .padStart(2, "0")}
                        </strong>
                        <small>
                          Keep your next steps moving
                          <ArrowUpRight size={15} />
                        </small>
                      </button>
                    </div>
                    <div className="feed-layout">
                      <section className="feed">
                        <div className="section-title">
                          <div>
                            <h2>
                              {view === "saved"
                                ? "Saved opportunities"
                                : "Your best matches"}
                              <span className="count">{filtered.length}</span>
                            </h2>
                            <p>
                              Picked for your experience. Ordered by
                              possibility.
                            </p>
                          </div>
                        </div>
                        <div className="feed-toolbar">
                          <label className="search-input">
                            <Search size={18} />
                            <input
                              aria-label="Search opportunities"
                              placeholder="Search role, company or keyword"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                            />
                          </label>
                          <Button
                            variant="outline"
                            onClick={() => setFilters(!filters)}
                            aria-expanded={filters}
                          >
                            <SlidersHorizontal size={16} />
                            Filters
                          </Button>
                        </div>
                        <div className="quick-filters">
                          <div role="group" aria-label="Posting age">
                            {[
                              ["24", "24 hours"],
                              ["48", "48 hours"],
                              ["168", "7 days"],
                              ["Infinity", "Any time"],
                            ].map(([v, l]) => (
                              <button
                                key={v}
                                aria-pressed={hours === v}
                                className={hours === v ? "selected" : ""}
                                onClick={() => setHours(v)}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                          <label className="sort-label">
                            Sort
                            <select
                              aria-label="Sort opportunities"
                              value={sort}
                              onChange={(e) => setSort(e.target.value)}
                            >
                              <option value="recent-fit">
                                Recent + best fit
                              </option>
                              <option value="fit">Best fit</option>
                              <option value="new">Newest</option>
                            </select>
                          </label>
                        </div>
                        {filters && (
                          <div className="filter-panel">
                            {[
                              {
                                label: "Fit score",
                                value: fit,
                                set: setFit,
                                options: ["60", "70", "80", "90", "0"],
                              },
                              {
                                label: "Posted within",
                                value: hours,
                                set: setHours,
                                options: ["12", "24", "48", "168", "Infinity"],
                              },
                              {
                                label: "County",
                                value: county,
                                set: setCounty,
                                options:
                                  market === "charleston"
                                    ? ["Any", "Charleston", "Remote"]
                                    : [
                                        "Any",
                                        "Miami-Dade",
                                        "Broward",
                                        "Palm Beach",
                                        "South Florida",
                                        "Remote",
                                      ],
                              },
                              {
                                label: "Category",
                                value: category,
                                set: setCategory,
                                options: ["Any", ...categories],
                              },
                              {
                                label: "Status",
                                value: status,
                                set: setStatus,
                                options: [
                                  "Any",
                                  "ACTIVE",
                                  "LIKELY_ACTIVE",
                                  "REPOSTED",
                                  "UNKNOWN",
                                ],
                              },
                              {
                                label: "Work type",
                                value: work,
                                set: setWork,
                                options: [
                                  "Any",
                                  "Full-time",
                                  "Part-time",
                                  "Temporary",
                                  "Seasonal",
                                  "Contract",
                                  "Internship",
                                ],
                              },
                              {
                                label: "Organization",
                                value: orgFilter,
                                set: setOrgFilter,
                                options: [
                                  "Any",
                                  "Small companies",
                                  "Chinese/Asian-affiliated",
                                  "venue",
                                  "cultural",
                                  "nonprofit",
                                  "museum",
                                  "theat",
                                  "music",
                                  "sports",
                                  "production",
                                  "experiential",
                                ],
                              },
                            ].map((f) => (
                              <label key={f.label}>
                                {f.label}
                                <select
                                  value={f.value}
                                  onChange={(e) => f.set(e.target.value)}
                                >
                                  {f.options.map((o) => (
                                    <option key={o} value={o}>
                                      {o === "Infinity"
                                        ? "Any time"
                                        : o === "theat"
                                          ? "Theaters"
                                          : o}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setFit("70");
                                setSort("recent-fit");
                                setHours("48");
                                setCounty("Any");
                                setCategory("Any");
                                setStatus("Any");
                                setWork("Any");
                                setOrgFilter("Any");
                                setQuery("");
                              }}
                            >
                              Reset filters
                            </Button>
                          </div>
                        )}
                        <div className="job-list">
                          {filtered.map((job, i) => (
                            <JobCard
                              key={job.id}
                              job={job}
                              featured={i === 0}
                              saved={
                                latestAction(state.history, job)?.action ===
                                "Saved"
                              }
                              stage={
                                state.applications.find(
                                  (a) => a.jobId === job.id,
                                )?.stage
                              }
                              busy={busy}
                              onOpen={() => setSelected(job.id)}
                              onSave={() => void action(job, "Saved")}
                            />
                          ))}
                          {!filtered.length && (
                            <div className="empty">
                              <Search size={30} />
                              <h3>No opportunities in this view</h3>
                              <p>
                                {state.jobs.length
                                  ? "Try a wider posting window or reset the filters."
                                  : "Import your first job with its employer source to start your radar."}
                              </p>
                              <Button
                                variant="outline"
                                onClick={() => setImporting("jobs")}
                              >
                                Import jobs
                              </Button>
                            </div>
                          )}
                        </div>
                      </section>
                      <aside className="insights">
                        <section className="focus-card">
                          <div className="aside-eyebrow">
                            <Target size={17} />
                            YOUR SEARCH FOCUS
                          </div>
                          <h3>
                            Experience that
                            <br />
                            connects the dots.
                          </h3>
                          <div className="focus-tags">
                            <span>Live production</span>
                            <span>Event operations</span>
                            <span>Media & content</span>
                          </div>
                          <div className="focus-line">
                            <Check size={15} />
                            Assistant & coordinator roles
                          </div>
                          <div className="focus-line">
                            <Check size={15} />
                            {market === "miami"
                              ? "Miami-Dade & Broward first"
                              : "Charleston, South Carolina"}
                          </div>
                          <Button variant="ghost" onClick={() => go("profile")}>
                            Fine-tune your profile
                            <ArrowRight size={16} />
                          </Button>
                        </section>
                        <section className="hidden-card">
                          <span className="aside-eyebrow">
                            <Radio size={17} />
                            BEYOND THE JOB BOARDS
                          </span>
                          <h3>
                            Some doors are
                            <br />
                            worth knocking on.
                          </h3>
                          <p>
                            Discover local teams where your experience could
                            fit—even without an advertised opening.
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => go("hidden")}
                          >
                            Explore Hidden Market
                            <ArrowUpRight size={16} />
                          </Button>
                        </section>
                        <div className="source-note">
                          <CheckCheck size={19} />
                          <p>
                            Evidence before excitement.
                            <br />
                            <span>
                              Open a match to check its source, date and
                              verification details.
                            </span>
                          </p>
                        </div>
                      </aside>
                    </div>
                  </>
                )}
                {(view === "hidden" || view === "organizations") && (
                  <>
                    <PageHeading
                      eyebrow={
                        view === "hidden"
                          ? "BEYOND THE JOB BOARDS"
                          : "YOUR LOCAL NETWORK"
                      }
                      title={
                        view === "hidden"
                          ? "Find the teams. Open the conversation."
                          : "Organizations worth knowing."
                      }
                      description={`Production houses, venues and cultural teams in ${marketLabels[market]}.`}
                    />
                    <div className="org-tools">
                      <label className="search-input">
                        <Search size={18} />
                        <input
                          placeholder="Search organizations"
                          aria-label="Search organizations"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setOrgFilter(
                            orgFilter === "Chinese/Asian-affiliated"
                              ? "Any"
                              : "Chinese/Asian-affiliated",
                          )
                        }
                        aria-pressed={orgFilter === "Chinese/Asian-affiliated"}
                      >
                        Chinese / Asian affiliation
                      </Button>
                      <Button onClick={() => setImporting("organization")}>
                        <Plus size={17} />
                        Add organization
                      </Button>
                    </div>
                    <p className="muted">
                      Affiliations appear only with explicit public evidence. No
                      ethnicity is inferred from names.
                    </p>
                    <div className="org-grid">
                      {state.organizations
                        .filter(
                          (o) =>
                            inMarket(o, market) &&
                            (view !== "hidden" ||
                              !state.jobs.some(
                                (j) =>
                                  j.organization.id === o.id &&
                                  j.score.total >= 60 &&
                                  !["CLOSED", "EXPIRED"].includes(j.status),
                              )) &&
                            (orgFilter !== "Chinese/Asian-affiliated" ||
                              affiliation(o).length > 0) &&
                            `${o.name} ${o.type} ${o.city}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                        )
                        .map((o) => (
                          <OrganizationCard
                            key={o.id}
                            org={o}
                            hidden={view === "hidden"}
                          />
                        ))}
                    </div>
                    {!state.organizations.length && (
                      <div className="empty">
                        <Building2 />
                        <h3>Your organization directory starts here</h3>
                        <p>
                          Add a team and the public sources that make it
                          relevant.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {view === "applications" && (
                  <>
                    <PageHeading
                      eyebrow="ONE NEXT STEP AT A TIME"
                      title="Keep your momentum."
                      description="Track applications, conversations and follow-ups in one place."
                    />
                    <div className="pipeline">
                      {stages.map((s) => (
                        <div key={s}>
                          <strong>
                            {
                              state.applications.filter((a) => a.stage === s)
                                .length
                            }
                          </strong>
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                    <div className="application-list">
                      {state.applications.map((a) => {
                        const job = state.jobs.find((j) => j.id === a.jobId);
                        if (!job) return null;
                        return (
                          <button
                            key={a.jobId}
                            className="application-row"
                            onClick={() => setEditApp(a)}
                          >
                            <span className="company-avatar">
                              {job.organization.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span>
                              <strong>{job.title}</strong>
                              <small>{job.organization.name}</small>
                            </span>
                            <span className="badge">{a.stage}</span>
                            <span className="muted">
                              {a.followUpDate
                                ? `Follow up ${a.followUpDate}`
                                : a.dateApplied
                                  ? `Applied ${a.dateApplied}`
                                  : "Set your next step"}
                            </span>
                            <ChevronRight size={20} />
                          </button>
                        );
                      })}
                    </div>
                    {!state.applications.length && (
                      <div className="empty">
                        <BriefcaseBusiness size={32} />
                        <h3>Your next chapter starts with one application.</h3>
                        <p>
                          Save a match or mark it applied to start tracking it
                          here.
                        </p>
                        <Button onClick={() => go("radar")}>
                          Explore your radar
                          <ArrowRight size={17} />
                        </Button>
                      </div>
                    )}
                  </>
                )}
                {view === "profile" && (
                  <>
                    <PageHeading
                      eyebrow="THE PERSON BEHIND THE RADAR"
                      title="Built around you, Qiqi."
                      description="Keep your experience accurate. Your profile shapes every match."
                    />
                    <ProfileForm
                      profile={state.profile}
                      busy={busy}
                      onSave={(p) =>
                        commit(
                          "profile",
                          "PUT",
                          p,
                          (s) => refresh({ ...s, profile: p }),
                          "Profile saved. Matches rescored.",
                        )
                      }
                    />
                  </>
                )}
                {view === "admin" && (
                  <>
                    <PageHeading
                      eyebrow="SOURCES & ACTIVITY"
                      title="Know what your radar knows."
                      description="See what was imported, filtered out and combined."
                    />
                    <div className="admin-overview">
                      <section className="panel">
                        <h3>Phase 1 · Manual discovery</h3>
                        <p>
                          Import employer source records and record your
                          verification evidence. Automatic discovery, scheduled
                          checks and email alerts are not connected in this
                          phase.
                        </p>
                        <div className="status-line">
                          <span className="badge">Manual import ready</span>
                          <span className="badge neutral">
                            Automatic search off
                          </span>
                          <span className="badge neutral">Email off</span>
                        </div>
                        <Button onClick={() => setImporting("jobs")}>
                          <Upload size={17} />
                          Import jobs
                        </Button>
                      </section>
                      <section className="panel">
                        <h3>Your data</h3>
                        <p>
                          {DEMO
                            ? "Stored only in this browser. Export a backup before clearing browser data."
                            : "Stored in your private PostgreSQL database. Download a portable JSON snapshot."}
                        </p>
                        <Button variant="outline" onClick={exportData}>
                          <Download size={17} />
                          Export workspace
                        </Button>
                        {!DEMO && (
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await api("logout", "POST", {});
                                setState(null);
                                setLogin(true);
                              } catch (e) {
                                setError(
                                  e instanceof Error
                                    ? e.message
                                    : "Sign out failed.",
                                );
                              }
                            }}
                          >
                            <LogOut size={17} />
                            Sign out
                          </Button>
                        )}
                      </section>
                    </div>
                    <h2 className="activity-title">Import history</h2>
                    {state.runs.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              {[
                                "Run / source",
                                "Found",
                                "Accepted",
                                "Duplicates",
                                "Closed",
                                "Fresh",
                                "80+ fit",
                              ].map((x) => (
                                <th key={x}>{x}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {state.runs.map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <strong>{r.source}</strong>
                                  <small>
                                    {new Date(r.at).toLocaleString()}
                                  </small>
                                  <small>{r.query}</small>
                                  {r.rejections.map((e, i) => (
                                    <details key={i}>
                                      <summary>{e.reason}</summary>
                                      {e.title}
                                    </details>
                                  ))}
                                </td>
                                <td>{r.found}</td>
                                <td>{r.accepted}</td>
                                <td>{r.duplicates}</td>
                                <td>{r.closed}</td>
                                <td>{r.fresh}</td>
                                <td>{r.highFit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty">
                        <LayoutDashboard size={28} />
                        <h3>No imports yet</h3>
                        <p>
                          Your next import will show its counts and rejection
                          reasons here.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            <footer className="app-footer">
              <span>
                <Radar size={15} />
                Qiqi Job Radar
              </span>
              <div className="footer-dedication">
                <span
                  lang="zh-Hans"
                  title="¡Buena suerte y un futuro brillante!"
                >
                  祝你好运，前程似锦！
                </span>
                <span>created by Yeric to Qiqi</span>
              </div>
              <Button
                variant="outline"
                onClick={toggleColors}
                aria-pressed={inverted}
              >
                {inverted ? "Restore colors" : "Invert colors"}
              </Button>
            </footer>
          </main>
        </div>
      </div>
      {j && state && (
        <Modal
          title="Opportunity details"
          onClose={() => setSelected(null)}
          wide
        >
          <JobDetails
            job={j}
            history={state.history.filter((a) => a.jobId === j.id)}
            busy={busy}
            onAction={(a) => void action(j, a)}
          />
        </Modal>
      )}
      {importing && (
        <Modal
          title={
            importing === "jobs"
              ? "Import job opportunities"
              : "Add an organization"
          }
          onClose={() => setImporting(null)}
          wide
        >
          <ImportForm
            kind={importing}
            busy={busy}
            onImport={async (raw) => {
              if (importing === "jobs") {
                const records = (Array.isArray(raw) ? raw : [raw]).map((x) =>
                  jobInputSchema.parse(x),
                );
                if (records.length > 100)
                  throw new Error("Import at most 100 jobs at a time.");
                const ok = await commit(
                  "import",
                  "POST",
                  records,
                  (s) => importJobs(s, records),
                  "Import completed. Open Sources & activity for results.",
                );
                if (ok) setImporting(null);
              } else {
                const org = organizationSchema.parse(raw);
                const ok = await commit(
                  "organization",
                  "POST",
                  org,
                  (s) => {
                    const i = s.organizations.findIndex(
                      (o) => normalize(o.name) === normalize(org.name),
                    );
                    if (i >= 0)
                      s.organizations[i] = {
                        ...org,
                        id: s.organizations[i].id,
                      };
                    else {
                      if (s.organizations.some((o) => o.id === org.id))
                        throw new Error("Organization ID already used");
                      s.organizations.push(org);
                    }
                    return s;
                  },
                  "Organization saved.",
                );
                if (ok) setImporting(null);
              }
            }}
          />
        </Modal>
      )}
      {editApp && (
        <Modal
          title="Application & next steps"
          onClose={() => setEditApp(null)}
        >
          <ApplicationForm
            application={editApp}
            busy={busy}
            onSave={async (a) => {
              const ok = await commit(
                "application",
                "PUT",
                a,
                (s) => {
                  const next = act(s, a.jobId, a.stage);
                  next.applications = next.applications.map((x) =>
                    x.jobId === a.jobId ? a : x,
                  );
                  return next;
                },
                "Application updated.",
              );
              if (ok) setEditApp(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
function JobCard({
  job: j,
  featured,
  saved,
  stage,
  busy,
  onOpen,
  onSave,
}: {
  job: Job;
  featured: boolean;
  saved: boolean;
  stage?: string;
  busy: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <article className={`job-card ${featured ? "featured" : ""}`}>
      <div className="card-top">
        <span className={`company-avatar tone-${j.category.toLowerCase()}`}>
          {j.organization.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div className="job-title">
          <button onClick={onOpen}>
            <h3>{j.title}</h3>
          </button>
          <p>{j.organization.name}</p>
        </div>
        <div className="score">
          <strong>
            {j.score.total}
            <span>/100</span>
          </strong>
          <small>{j.score.label}</small>
        </div>
      </div>
      <div className="job-meta">
        <span>
          <MapPin size={14} />
          {j.location}
        </span>
        <span>{j.employmentType}</span>
        <span>
          {j.organization.size !== "Unknown"
            ? `${j.organization.size} team`
            : j.organization.type}
        </span>
      </div>
      <div className="job-signals">
        <span className={`badge ${ageHours(j) <= 12 ? "fresh" : ""}`}>
          {ageHours(j) <= 12 && <span className="tiny-dot" />}
          {freshness(j)}
        </span>
        <span
          className={`verification ${j.status === "UNKNOWN" ? "uncertain" : ""}`}
        >
          <CheckCheck size={14} />
          {j.isDemo ? "Simulated · " : ""}
          {pretty(j.status)}
        </span>
        {stage && <span className="badge neutral">{stage}</span>}
      </div>
      <div className="fit-line">
        <span>WHY YOU FIT</span>
        <p>
          {j.score.reasons.slice(0, 2).join(" · ") ||
            "Review responsibilities and requirements"}
        </p>
      </div>
      <div className="card-footer">
        <span>
          <Clock3 size={14} />
          {timeLabel(j)}
          {j.isDemo ? " · Sample" : ""}
        </span>
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={busy || saved}
            aria-label={`Save ${j.title}`}
          >
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
            {saved ? "Saved" : "Save"}
          </Button>
          <Button
            variant={featured ? "default" : "outline"}
            size="sm"
            onClick={onOpen}
          >
            View match
            <ArrowUpRight size={16} />
          </Button>
        </div>
      </div>
    </article>
  );
}
function JobDetails({
  job: j,
  history,
  busy,
  onAction,
}: {
  job: Job;
  history: RadarState["history"];
  busy: boolean;
  onAction: (a: Action) => void;
}) {
  const p = posting(j);
  return (
    <div className="detail-body">
      {j.isDemo && (
        <div className="demo-banner">
          Fictional sample. No application or employer contact is available.
        </div>
      )}
      <div className="detail-title">
        <span className="eyebrow">
          {j.category} · {j.organization.county}
        </span>
        <h2>{j.title}</h2>
        <p>
          {j.organization.name} · {j.location}
        </p>
        <span className="big-score">
          {j.score.total}
          <small>{j.score.label}</small>
        </span>
      </div>
      <div className="detail-actions">
        {j.applyUrl &&
          !j.isDemo &&
          !["CLOSED", "EXPIRED"].includes(j.status) && (
            <Button asChild>
              <External href={j.applyUrl}>Apply with employer</External>
            </Button>
          )}
        {!j.isDemo && (
          <Button asChild variant="outline">
            <External href={j.organization.website}>Employer website</External>
          </Button>
        )}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onAction("Saved")}
        >
          <Bookmark size={16} />
          Save
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onAction("Applied")}
        >
          <Check size={16} />
          Mark applied
        </Button>
      </div>
      <section>
        <h3>Why Qiqi fits</h3>
        <ul className="reason-list">
          {j.score.reasons.map((r) => (
            <li key={r}>
              <Check size={16} />
              {r}
            </li>
          ))}
        </ul>
        <div className="score-breakdown">
          {Object.entries(j.score.components).map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <p className="muted">
          Learned preferences can adjust the total by up to 3 points. Profile
          facts stay separate.
        </p>
      </section>
      <section>
        <h3>Responsibilities</h3>
        <p className="preserve-lines">{j.description}</p>
      </section>
      <section>
        <h3>
          Requirements <span className="badge">{j.score.requirementMatch}</span>
        </h3>
        {!j.requirements.length ? (
          <p>Not provided. Eligibility needs review.</p>
        ) : (
          j.requirements.map((r, i) => (
            <div className="requirement" key={i}>
              <p>{r.text}</p>
              <small>
                {r.required ? "Required" : "Preferred"} · {pretty(r.assessment)}
              </small>
              <External href={r.sourceUrl}>Requirement source</External>
            </div>
          ))
        )}
      </section>
      <section>
        <h3>Dates & verification</h3>
        <dl className="facts">
          <div>
            <dt>Original posting</dt>
            <dd>
              {p && !p.estimated ? new Date(p.at).toLocaleString() : "Unknown"}
            </dd>
          </div>
          <div>
            <dt>Estimated posting</dt>
            <dd>
              {p?.estimated ? new Date(p.at).toLocaleString() : "Not used"}
            </dd>
          </div>
          <div>
            <dt>Freshness confidence</dt>
            <dd>{p?.confidence || "Unknown"}</dd>
          </div>
          <div>
            <dt>Discovered</dt>
            <dd>{new Date(j.discoveredAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {j.isDemo ? "Simulated " : ""}
              {pretty(j.status)}
            </dd>
          </div>
          <div>
            <dt>Last checked</dt>
            <dd>
              {j.verification
                ? `${new Date(j.verification.checkedAt).toLocaleString()} · Manual evidence`
                : "Not verified"}
            </dd>
          </div>
          <div>
            <dt>Compensation</dt>
            <dd>{j.salary || "Not provided"}</dd>
          </div>
        </dl>
        {j.salarySource && (
          <External href={j.salarySource}>Salary source</External>
        )}
        {j.verification && (
          <>
            <p className="muted">{j.verification.notes}</p>
            <External href={j.verification.sourceUrl}>
              Verification source
            </External>
          </>
        )}
      </section>
      <section>
        <h3>Source records</h3>
        {j.sources.map((s, i) => (
          <div className="source-record" key={i}>
            <External href={s.url}>{s.name}</External>
            <small>
              {s.kind} · {s.sourcePostedText || "No relative-date claim"} ·
              Captured {new Date(s.capturedAt).toLocaleString()}
            </small>
            {s.originalPostedAt && (
              <small>
                Original date reported:{" "}
                {new Date(s.originalPostedAt).toLocaleString()}
              </small>
            )}
            <p>{s.evidence}</p>
          </div>
        ))}
      </section>
      <section>
        <h3>Feedback</h3>
        <div className="detail-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onAction("Dismiss")}
          >
            Not interested
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onAction("False Match")}
          >
            False match
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => onAction("Report Closed")}
          >
            <Flag size={15} />
            Report closed
          </Button>
        </div>
      </section>
      {history.length > 0 && (
        <section>
          <h3>Activity history</h3>
          {history.map((a, i) => (
            <p className="muted" key={i}>
              {a.action} · {new Date(a.at).toLocaleString()}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
function OrganizationCard({
  org: o,
  hidden,
}: {
  org: Organization;
  hidden: boolean;
}) {
  return (
    <article className="organization-card">
      <div className="card-top">
        <span className="company-avatar">
          <Building2 size={24} />
        </span>
        <span className="badge">{outreachScore(o)} outreach fit</span>
      </div>
      <h3>{o.name}</h3>
      <p>{o.type}</p>
      <span className="job-meta">
        <MapPin size={14} />
        {o.city} · {o.county}
      </span>
      {hidden && (
        <div className="outreach-label">
          {o.lastCheckedForJobs
            ? "Opportunity — no advertised opening"
            : "Outreach prospect — openings not checked"}
        </div>
      )}
      {o.isDemo && (
        <span className="badge neutral">Fictional organization</span>
      )}
      <p className="muted">
        Your production, event logistics and coordination background may support
        this team’s work. {o.notes}
      </p>
      {affiliation(o).map((a) => (
        <div key={a.sourceUrl} className="affiliation">
          <strong>{a.label}</strong>
          <p>{a.evidence}</p>
          <External href={a.sourceUrl}>Public evidence</External>
        </div>
      ))}
      {!o.isDemo && (
        <div className="organization-links">
          <External href={o.website}>Website</External>
          {o.careersUrl && <External href={o.careersUrl}>Careers</External>}
          {o.contactUrl && <External href={o.contactUrl}>Contact</External>}
          {o.publicEmail && (
            <a href={`mailto:${o.publicEmail}`}>{o.publicEmail}</a>
          )}
          {o.publicPhone && <span>{o.publicPhone}</span>}
          {o.publicContactPerson && (
            <span>
              {o.publicContactPerson} · {o.contactPersonTitle}
            </span>
          )}
          {o.contactSource && (
            <External href={o.contactSource}>Contact source</External>
          )}
        </div>
      )}
    </article>
  );
}
function ProfileForm({
  profile,
  busy,
  onSave,
}: {
  profile: Profile;
  busy: boolean;
  onSave: (p: Profile) => Promise<unknown>;
}) {
  const [p, setP] = useState(profile),
    [error, setError] = useState("");
  function list(k: "skills" | "experience" | "education", value: string) {
    setP({ ...p, [k]: value.split("\n") });
  }
  return (
    <form
      className="profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const clean = {
            ...p,
            skills: p.skills.filter(Boolean),
            education: p.education.filter(Boolean),
            experience: p.experience.filter(Boolean),
          };
          profileSchema.parse(clean);
          setError("");
          void onSave(clean);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Check profile fields.");
        }
      }}
    >
      <section className="panel">
        <div className="profile-form-head">
          <span className="avatar large">QS</span>
          <div>
            <h2>Candidate profile</h2>
            <p>Only include experience you can support.</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Full name
            <input
              value={p.name}
              required
              onChange={(e) => setP({ ...p, name: e.target.value })}
            />
          </label>
          <label>
            Career focus
            <input
              value={p.headline}
              onChange={(e) => setP({ ...p, headline: e.target.value })}
            />
          </label>
        </div>
        <label>
          Education · one qualification per line
          <textarea
            rows={3}
            value={p.education.join("\n")}
            onChange={(e) => list("education", e.target.value)}
          />
        </label>
        <label>
          Skills · one skill per line
          <textarea
            rows={7}
            value={p.skills.join("\n")}
            onChange={(e) => list("skills", e.target.value)}
          />
        </label>
        <label>
          Experience · one entry per line
          <textarea
            rows={5}
            value={p.experience.join("\n")}
            onChange={(e) => list("experience", e.target.value)}
          />
        </label>
      </section>
      <section className="panel">
        <h3>Where you want to work</h3>
        {(["Miami-Dade", "Broward", "Palm Beach", "Charleston"] as const).map(
          (c) => (
            <label className="checkbox-label" key={c}>
              <input
                type="checkbox"
                checked={p.counties.includes(c)}
                onChange={(e) =>
                  setP({
                    ...p,
                    counties: e.target.checked
                      ? [...p.counties, c]
                      : p.counties.filter((x) => x !== c),
                  })
                }
              />
              {c}
              {c === "Palm Beach" ? " · optional expansion" : ""}
            </label>
          ),
        )}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={p.remote}
            onChange={(e) => setP({ ...p, remote: e.target.checked })}
          />
          Strongly related remote roles
        </label>
        <label>
          Additional information
          <textarea
            rows={5}
            value={p.notes}
            onChange={(e) => setP({ ...p, notes: e.target.value })}
          />
        </label>
        <p className="muted">
          Years of experience, languages and certifications are never inferred.
          Unknown requirements stay open for review.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button disabled={busy} type="submit">
          {busy ? "Saving…" : "Save profile & rescore"}
          <Check size={17} />
        </Button>
      </section>
    </form>
  );
}
function ImportForm({
  kind,
  busy,
  onImport,
}: {
  kind: "jobs" | "organization";
  busy: boolean;
  onImport: (v: unknown) => Promise<void>;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      className="import-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await onImport(JSON.parse(text));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Invalid JSON.");
        }
      }}
    >
      <p>
        Paste structured JSON or choose a JSON file.{" "}
        {kind === "jobs"
          ? "Include responsibilities, organization and source records. Dates and verification are evidence you enter manually."
          : "Public contact details and affiliations need supporting source URLs."}
      </p>
      <div className="import-help">
        <FileJson size={24} />
        <span>
          See <strong>samples/</strong> in the project for complete import
          examples. Import up to 100 jobs per batch.
        </span>
      </div>
      <label className="upload-label">
        <Upload size={18} />
        Choose JSON file
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 1000000) {
                setError("File must be smaller than 1 MB.");
                return;
              }
              setText(await file.text());
            }
          }}
        />
      </label>
      <label>
        {kind === "jobs"
          ? "Job records (JSON array)"
          : "Organization (JSON object)"}
        <textarea
          className="code-input"
          rows={13}
          required
          value={text}
          placeholder={
            kind === "jobs"
              ? '[{ "title": "…", "organization": { … }, "sources": [ … ] }]'
              : '{ "id": "…", "name": "…", "website": "https://…" }'
          }
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {error && (
        <div role="alert" className="message error">
          {error}
        </div>
      )}
      <Button disabled={busy}>
        <Upload size={17} />
        {busy ? "Importing…" : "Validate & import"}
      </Button>
    </form>
  );
}
function ApplicationForm({
  application,
  busy,
  onSave,
}: {
  application: Application;
  busy: boolean;
  onSave: (a: Application) => Promise<void>;
}) {
  const [a, setA] = useState(application),
    [error, setError] = useState("");
  return (
    <form
      className="application-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          applicationSchema.parse(a);
          setError("");
          void onSave(a);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Check fields.");
        }
      }}
    >
      <label>
        Pipeline stage
        <select
          value={a.stage}
          onChange={(e) =>
            setA({ ...a, stage: e.target.value as Application["stage"] })
          }
        >
          {stages.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          Date applied
          <input
            type="date"
            value={a.dateApplied}
            onChange={(e) => setA({ ...a, dateApplied: e.target.value })}
          />
        </label>
        <label>
          Follow-up date
          <input
            type="date"
            value={a.followUpDate}
            onChange={(e) => setA({ ...a, followUpDate: e.target.value })}
          />
        </label>
      </div>
      {(
        [
          { key: "resumeVersion", label: "Resume version" },
          { key: "applicationUrl", label: "Application URL" },
          { key: "contact", label: "Contact" },
        ] as const
      ).map((f) => (
        <label key={f.key}>
          {f.label}
          <input
            value={a[f.key]}
            type={f.key === "applicationUrl" ? "url" : "text"}
            onChange={(e) => setA({ ...a, [f.key]: e.target.value })}
          />
        </label>
      ))}
      <label>
        Cover letter used
        <textarea
          rows={4}
          value={a.coverLetter}
          onChange={(e) => setA({ ...a, coverLetter: e.target.value })}
        />
      </label>
      <label>
        Notes
        <textarea
          rows={4}
          value={a.notes}
          onChange={(e) => setA({ ...a, notes: e.target.value })}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button disabled={busy}>
        Save next steps
        <Check size={17} />
      </Button>
    </form>
  );
}
