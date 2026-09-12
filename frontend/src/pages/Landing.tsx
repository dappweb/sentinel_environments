import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Github,
  Layers3,
  LockKeyhole,
  Radio,
  ScanLine,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { routes, RouteConfig } from "../router/routes";

const README_URL = "https://github.com/microsoft/sentinel_environments#readme";
const PROJECT_DOMAIN_URL =
  import.meta.env.VITE_PROJECT_DOMAIN_URL ?? "https://microhood.ai";
const PROJECT_X_URL = "https://x.com/microhood_ai";
const RESEARCH_X_URL = "https://x.com/MSFTResearch";
const PROJECT_REPO_URL =
  import.meta.env.VITE_PROJECT_REPO_URL ??
  "https://github.com/microsoft/sentinel_environments";
const BLOG_URL =
  "https://www.microsoft.com/en-us/research/blog/tell-me-when-building-agents-that-can-wait-monitor-and-act/";
const ROBINHOOD_STOCK_TOKEN_DOCS =
  "https://docs.robinhood.com/chain/stock-token-apis";
const ROBINHOOD_CHAIN_DOCS = "https://docs.robinhood.com/chain/";
const ROBINHOOD_MAINNET_EXPLORER = "https://robinhoodchain.blockscout.com";
const MSFT_STOCK_TOKEN_ADDRESS =
  "0xe93237C50D904957Cf27E7B1133b510C669c2e74";
const MICROHOOD_PROJECT_TOKEN_ADDRESS =
  "0x6be1478173ccb95e31d8b22b0b71efde24e2f0c4";

const DISPLAY_FONT =
  '"Aptos Display", "Segoe UI Variable Display", Bahnschrift, system-ui, sans-serif';
const BODY_FONT =
  '"Aptos", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
const MONO_FONT =
  '"Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace';

const NAVY = "#071421";
const MICROSOFT_BLUE = "#0078D4";
const ROBINHOOD_GREEN = "#00C805";
const INK = "#102235";
const INK_SOFT = "#506174";
const MUTED = "#7B8A9A";
const CANVAS = "#F4F7FA";
const RULE = "#DCE5ED";

const assetBase = `${import.meta.env.BASE_URL}desktop/`;
const MICROHOOD_LOGO = `${assetBase}microhood-icon.png`;

interface Author {
  name: string;
  affiliation: string;
  photo: string;
  profileUrl: string;
}

const AUTHORS: Author[] = [
  {
    name: "Matheus Kunzler Maldaner",
    affiliation: "University of Florida",
    photo: "/author-photos/matheus.jpeg",
    profileUrl: "https://matheuskunzler.com",
  },
  {
    name: "Adam Fourney",
    affiliation: "Microsoft Research",
    photo: "/author-photos/adam.png",
    profileUrl: "https://www.adamfourney.com",
  },
  {
    name: "Amanda Swearngin",
    affiliation: "Microsoft Research",
    photo: "/author-photos/amanda.png",
    profileUrl: "https://amaswea.github.io",
  },
  {
    name: "Hussein Mozannar",
    affiliation: "Microsoft Research",
    photo: "/author-photos/hussein.png",
    profileUrl: "https://husseinmozannar.github.io",
  },
  {
    name: "Gagan Bansal",
    affiliation: "Microsoft Research",
    photo: "/author-photos/gagan.png",
    profileUrl: "https://homes.cs.washington.edu/~bansalg/",
  },
  {
    name: "Maya Murad",
    affiliation: "Microsoft Research",
    photo: "/author-photos/maya.png",
    profileUrl: "https://www.mayamurad.com",
  },
];

type ModalKind = "about" | "authors";

const cardImageMap: Record<string, string> = {
  micromail: `${assetBase}micromail-icon.png`,
  microchat: `${assetBase}teams-icon.png`,
  microdin: `${assetBase}microdin-icon.png`,
  microfy: `${assetBase}microfy-icon.png`,
  microgram: `${assetBase}microgram-icon.png`,
  microhood: MICROHOOD_LOGO,
  microhub: `${assetBase}github-icon.png`,
  microlendar: `${assetBase}microlendar-icon.png`,
  microscholar: `${assetBase}microscholar-icon.png`,
  microtube: `${assetBase}microtube-icon.png`,
};

const envTheme: Record<
  string,
  { accent: string; soft: string; category: string; span: string }
> = {
  micromail: { accent: "#1B9CE5", soft: "#E8F5FD", category: "Email", span: "lg:col-span-3" },
  microhub: { accent: "#536475", soft: "#EDF1F4", category: "Code", span: "lg:col-span-3" },
  microgram: { accent: "#D6477C", soft: "#FCECF2", category: "Photos", span: "lg:col-span-2" },
  microlendar: { accent: "#D85C69", soft: "#FFF0F1", category: "Calendar", span: "lg:col-span-2" },
  microscholar: { accent: "#B27A16", soft: "#FFF7DF", category: "Research", span: "lg:col-span-2" },
  microchat: { accent: "#6451C7", soft: "#F0EEFD", category: "Chat", span: "lg:col-span-3" },
  microdin: { accent: "#087F78", soft: "#E5F7F4", category: "Network", span: "lg:col-span-3" },
  microhood: { accent: ROBINHOOD_GREEN, soft: "#E8FBE9", category: "Trading", span: "lg:col-span-2" },
  microtube: { accent: "#D54B4B", soft: "#FDECEC", category: "Video", span: "lg:col-span-2" },
  microfy: { accent: "#5F9A20", soft: "#EFF9E5", category: "Music", span: "lg:col-span-2" },
};

const environmentRoutes: RouteConfig[] = routes.filter(
  (route) => route.category === "environment" && route.component !== null
);

const shortAddress = (address: string) =>
  `${address.slice(0, 8)}…${address.slice(-6)}`;

const Sparkline = () => (
  <svg
    viewBox="0 0 420 152"
    role="img"
    aria-label="MSFT Stock Token monitoring sparkline"
    className="h-full w-full"
  >
    <defs>
      <linearGradient id="msft-fill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={ROBINHOOD_GREEN} stopOpacity="0.28" />
        <stop offset="100%" stopColor={ROBINHOOD_GREEN} stopOpacity="0" />
      </linearGradient>
    </defs>
    {[28, 66, 104, 142].map((y) => (
      <line
        key={y}
        x1="0"
        x2="420"
        y1={y}
        y2={y}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
      />
    ))}
    <path
      d="M0 124 C22 123 27 98 47 103 S73 88 91 99 S115 77 132 84 S150 54 169 70 S191 67 209 74 S230 38 250 49 S270 33 287 50 S308 58 328 37 S354 48 374 28 S399 39 420 15 V152 H0 Z"
      fill="url(#msft-fill)"
    />
    <path
      d="M0 124 C22 123 27 98 47 103 S73 88 91 99 S115 77 132 84 S150 54 169 70 S191 67 209 74 S230 38 250 49 S270 33 287 50 S308 58 328 37 S354 48 374 28 S399 39 420 15"
      fill="none"
      stroke={ROBINHOOD_GREEN}
      strokeLinecap="round"
      strokeWidth="3"
    />
    <circle cx="420" cy="15" r="5" fill={ROBINHOOD_GREEN} />
    <circle cx="420" cy="15" r="9" fill="none" stroke={ROBINHOOD_GREEN} strokeOpacity="0.26" />
  </svg>
);

const Landing = () => {
  const navigate = useNavigate();
  const [busyEnv, setBusyEnv] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const envSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!modal) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const openEnvironment = async (route: RouteConfig) => {
    if (busyEnv) return;
    const envName = route.base_task ?? route.path.replace(/^\//, "");
    setBusyEnv(envName);
    setError(null);
    try {
      const res = await fetch(
        `/api/dev_init?environment=${encodeURIComponent(envName)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Init failed (${res.status})`);
      }
      navigate(route.path);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to initialize environment. Is the API server running?"
      );
      setBusyEnv(null);
    }
  };

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress(null), 1600);
    } catch {
      setCopiedAddress(null);
    }
  };

  const microhoodRoute = environmentRoutes.find(
    (route) => (route.base_task ?? route.path.replace(/^\//, "")) === "microhood"
  );

  return (
    <div
      className="min-h-screen overflow-x-hidden antialiased"
      style={{ background: CANVAS, color: INK, fontFamily: BODY_FONT }}
    >
      <section className="relative overflow-hidden" style={{ background: NAVY }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px), radial-gradient(circle at 78% 18%, rgba(0,120,212,0.32), transparent 27%), radial-gradient(circle at 22% 85%, rgba(0,200,5,0.13), transparent 25%)",
            backgroundSize: "56px 56px, 56px 56px, auto, auto",
          }}
        />
        <header className="relative z-10 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
            <a href="/" className="group flex min-h-11 items-center gap-3 text-white">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[9px] bg-white p-1 shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-transform group-hover:rotate-3">
                <img src={MICROHOOD_LOGO} alt="MicroHood" className="h-full w-full object-contain" draggable={false} />
              </span>
              <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">
                Micro<span style={{ color: "#7ABEF0" }}>Hood</span>
                <span className="ml-2" style={{ color: "rgba(255,255,255,0.48)" }}>/ SentinelBench</span>
              </span>
            </a>

            <nav className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.12em] sm:gap-3">
              <button type="button" onClick={() => setModal("about")} className="inline-flex min-h-11 items-center rounded-md px-2.5 transition hover:bg-white/10 hover:text-white" style={{ color: "rgba(255,255,255,0.78)" }}>About</button>
              <button type="button" onClick={() => setModal("authors")} className="hidden min-h-11 items-center rounded-md px-2.5 transition hover:bg-white/10 hover:text-white sm:inline-flex" style={{ color: "rgba(255,255,255,0.78)" }}>Authors</button>
              <a href={README_URL} target="_blank" rel="noreferrer" className="hidden min-h-11 items-center rounded-md px-2.5 transition hover:bg-white/10 hover:text-white sm:inline-flex" style={{ color: "rgba(255,255,255,0.78)" }}>README <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></a>
              <a href={PROJECT_DOMAIN_URL} target="_blank" rel="noreferrer" className="hidden min-h-11 items-center rounded-md px-2.5 transition hover:bg-white/10 hover:text-white lg:inline-flex" style={{ color: "#7ABEF0" }}>microhood.ai <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></a>
              <a href={PROJECT_X_URL} target="_blank" rel="noreferrer" aria-label="X @microhood_ai" className="hidden min-h-11 items-center rounded-md px-2.5 transition hover:bg-white/10 hover:text-white lg:inline-flex" style={{ color: "rgba(255,255,255,0.78)" }}>X <span className="ml-1 normal-case tracking-normal">@microhood_ai</span></a>
              <a href={PROJECT_REPO_URL} target="_blank" rel="noreferrer" className="ml-1 inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.24)" }}><Github className="h-3.5 w-3.5" /><span className="hidden sm:inline">Source</span></a>
            </nav>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-[1440px] px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-20 lg:px-12 lg:pt-24">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.68)" }}><span className="inline-flex items-center gap-2 text-[#93C5FD]"><CircleDot className="h-3.5 w-3.5" style={{ color: ROBINHOOD_GREEN }} /> Agent observability / 01</span><span className="h-px w-8" style={{ background: "rgba(255,255,255,0.35)" }} /><span>Long-horizon evaluation</span></div>

          <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1.04fr)_minmax(420px,0.96fr)] lg:items-end lg:gap-16">
            <div>
              <h1 className="max-w-4xl text-[clamp(3.2rem,7.5vw,7.8rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-white" style={{ fontFamily: DISPLAY_FONT }}>Wait for<br /><span style={{ color: "#77C4F7" }}>the signal.</span><br />Act with precision.</h1>
              <p className="mt-8 max-w-2xl text-[16px] leading-[1.7] sm:text-[19px]" style={{ color: "rgba(255,255,255,0.74)" }}>SentinelBench measures whether an AI agent can monitor a living interface, hold context across time, and act only when the moment is right — from inboxes to an MSFT Stock Token on Robinhood Chain.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <button type="button" onClick={() => envSectionRef.current?.scrollIntoView({ behavior: "smooth" })} className="inline-flex min-h-12 items-center gap-3 rounded-md px-5 text-[13px] font-semibold uppercase tracking-[0.1em] transition hover:-translate-y-0.5" style={{ background: ROBINHOOD_GREEN, color: "#041108" }}>Explore environments <ArrowRight className="h-4 w-4" /></button>
                {microhoodRoute ? <button type="button" onClick={() => void openEnvironment(microhoodRoute)} disabled={busyEnv !== null} className="inline-flex min-h-12 items-center gap-3 rounded-md border px-5 text-[13px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: "rgba(0,200,5,0.45)" }}>Open MicroHood <ArrowUpRight className="h-4 w-4" /></button> : null}
                <a href={BLOG_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-3 rounded-md border px-5 text-[13px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.25)" }}><BookOpen className="h-4 w-4" /> Read the paper</a>
              </div>
              <div className="mt-11 grid max-w-xl grid-cols-3 border-t pt-5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.62)" }}><div><strong className="block text-[23px] tracking-normal text-white">10</strong>surfaces</div><div><strong className="block text-[23px] tracking-normal text-white">100</strong>scenarios</div><div><strong className="block text-[23px] tracking-normal text-white">∞</strong>time horizon</div></div>
            </div>

            <div className="relative lg:pb-3">
              <div className="absolute -inset-8 rounded-full bg-[#0078D4]/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-2xl border shadow-2xl" style={{ borderColor: "rgba(255,255,255,0.17)", background: "rgba(15,36,56,0.88)" }}>
                <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                  <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-white p-1"><img src={MICROHOOD_LOGO} alt="" className="h-full w-full object-contain" /></div><div><p className="font-mono text-[13px] font-semibold tracking-[0.08em] text-white">MSFT / USD</p><p className="mt-0.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.58)" }}>Robinhood Stock Token</p></div></div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ borderColor: "rgba(0,200,5,0.45)", color: "#83F28A" }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: ROBINHOOD_GREEN }} />Read-only</span>
                </div>
                <div className="px-5 pb-5 pt-6">
                  <div className="flex items-end justify-between"><div><p className="text-[42px] font-semibold leading-none tracking-[-0.06em] text-white" style={{ fontFamily: DISPLAY_FONT }}>1.0004<span className="ml-1 text-[18px]" style={{ color: "rgba(255,255,255,0.58)" }}>×</span></p><p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "#83F28A" }}><Activity className="h-3.5 w-3.5" />Multiplier verified onchain</p></div><div className="text-right font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.58)" }}><p>MAINNET</p><p className="mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>CHAIN 4663</p></div></div>
                  <div className="mt-6 h-[152px] rounded-lg border px-2 py-3" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(2,9,16,0.28)" }}><Sparkline /></div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-[11px]"><div className="rounded-lg border p-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}><p className="uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.58)" }}>Canonical asset</p><p className="mt-2 font-mono" style={{ color: "rgba(255,255,255,0.86)" }}>{shortAddress(MSFT_STOCK_TOKEN_ADDRESS)}</p></div><div className="rounded-lg border p-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}><p className="uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.58)" }}>Agent mode</p><p className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[#83F28A]"><ShieldCheck className="h-3.5 w-3.5" />Observe</p></div></div>
                </div>
                <div className="flex items-center justify-between border-t px-5 py-3 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.62)" }}><span className="inline-flex items-center gap-2"><Radio className="h-3.5 w-3.5" />Public registry → RPC</span><span>MSFT CASE / 01</span></div>
              </div>
            </div>
          </div>
        </main>
      </section>

      <section className="relative border-b" style={{ background: "#FFFFFF", borderColor: RULE }}>
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12"><div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
          <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: "#E8F3FC", color: MICROSOFT_BLUE }}><Database className="h-4 w-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: MUTED }}>01 / Resolve</p><p className="mt-1 text-[14px] font-semibold" style={{ color: INK }}>Canonical asset registry</p></div></div><ArrowRight className="hidden h-4 w-4 lg:block" style={{ color: RULE }} />
          <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: "#E8FBE9", color: "#08A90C" }}><ScanLine className="h-4 w-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: MUTED }}>02 / Verify</p><p className="mt-1 text-[14px] font-semibold" style={{ color: INK }}>Bytecode · decimals · multiplier</p></div></div><ArrowRight className="hidden h-4 w-4 lg:block" style={{ color: RULE }} />
          <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: "#FFF5DE", color: "#AA7114" }}><Clock3 className="h-4 w-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: MUTED }}>03 / Observe</p><p className="mt-1 text-[14px] font-semibold" style={{ color: INK }}>Wait for the benchmark condition</p></div></div>
        </div></div>
      </section>

      <section className="relative border-b" style={{ background: "#102235", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xl font-semibold text-white" style={{ borderColor: "rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.08)" }} aria-hidden="true">𝕏</div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#7ABEF0" }}>Follow the project</p>
                <h2 className="mt-2 text-[clamp(1.5rem,3vw,2.35rem)] font-semibold leading-tight tracking-[-0.04em] text-white" style={{ fontFamily: DISPLAY_FONT }}>Signals, releases, and research notes.</h2>
                <p className="mt-3 max-w-2xl text-[14px] leading-[1.7]" style={{ color: "rgba(255,255,255,0.68)" }}>Follow <span className="font-semibold text-white">@microhood_ai</span> for MicroHood.ai updates, benchmark context, and public-read research. The project is independent and makes no investment or profit claims.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <a href={PROJECT_X_URL} target="_blank" rel="noreferrer" aria-label="Follow MicroHood.ai on X" className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-[11px] font-semibold uppercase tracking-[0.12em] transition hover:-translate-y-0.5 hover:bg-white/15" style={{ background: "#FFFFFF", color: INK }}>Follow on X <ArrowUpRight className="h-3.5 w-3.5" /></a>
              <a href={PROJECT_REPO_URL} target="_blank" rel="noreferrer" aria-label="Open MicroHood.ai GitHub repository" className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.24)" }}><Github className="h-3.5 w-3.5" /> GitHub <ArrowUpRight className="h-3.5 w-3.5" /></a>
            </div>
          </div>
        </div>
      </section>

      <section className="relative" style={{ background: CANVAS }}>
        <div className="mx-auto max-w-[1440px] px-5 pb-20 pt-16 sm:px-8 lg:px-12 lg:pb-28 lg:pt-24">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div><div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.19em]" style={{ color: MICROSOFT_BLUE }}><span className="h-2 w-2 rounded-full" style={{ background: MICROSOFT_BLUE }} />Case 01 / Asset identity</div><h2 className="mt-5 max-w-xl text-[clamp(2.6rem,5vw,5.2rem)] font-semibold leading-[0.95] tracking-[-0.06em]" style={{ color: INK, fontFamily: DISPLAY_FONT }}>One ticker.<br />Two identities.</h2><p className="mt-6 max-w-lg text-[16px] leading-[1.7]" style={{ color: INK_SOFT }}>The homepage uses the official MSFT Stock Token as the integration case and keeps the supplied Microhood project CA visible without implying that it is Microsoft equity.</p><div className="mt-8 flex flex-wrap gap-2"><span className="inline-flex min-h-9 items-center gap-2 rounded-full border bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ borderColor: RULE, color: INK_SOFT }}><LockKeyhole className="h-3.5 w-3.5" />No wallet writes</span><span className="inline-flex min-h-9 items-center gap-2 rounded-full border bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ borderColor: RULE, color: INK_SOFT }}><Check className="h-3.5 w-3.5" style={{ color: ROBINHOOD_GREEN }} />Registry verified</span></div></div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border bg-white p-5 shadow-[0_14px_40px_rgba(20,50,80,0.06)] sm:col-span-2 sm:p-7" style={{ borderColor: RULE }}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: MICROSOFT_BLUE }}>Official Robinhood Stock Token</p><h3 className="mt-3 text-[42px] font-semibold leading-none tracking-[-0.06em]" style={{ color: INK, fontFamily: DISPLAY_FONT }}>MSFT</h3><p className="mt-2 text-[13px]" style={{ color: MUTED }}>Microsoft · Robinhood Chain mainnet · 18 decimals</p></div><a href={`${ROBINHOOD_MAINNET_EXPLORER}/address/${MSFT_STOCK_TOKEN_ADDRESS}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition hover:bg-[#E8F3FC]" style={{ color: MICROSOFT_BLUE }}>Explorer <ExternalLink className="h-3.5 w-3.5" /></a></div><div className="mt-6 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: RULE, background: "#F8FAFC" }}><code className="break-all text-[12px] leading-6" style={{ color: INK, fontFamily: MONO_FONT }}>{MSFT_STOCK_TOKEN_ADDRESS}</code><button type="button" onClick={() => void copyAddress(MSFT_STOCK_TOKEN_ADDRESS)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition hover:bg-white" style={{ color: INK_SOFT }}>{copiedAddress === MSFT_STOCK_TOKEN_ADDRESS ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedAddress === MSFT_STOCK_TOKEN_ADDRESS ? "Copied" : "Copy address"}</button></div></div>

              <div className="rounded-xl border bg-[#102235] p-5 shadow-[0_14px_40px_rgba(20,50,80,0.09)] sm:p-6" style={{ borderColor: "#102235" }}><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9FCFF0]">Provided project CA</p><span className="rounded-full bg-[#263A4C] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#F9D77A]">Separate</span></div><p className="mt-4 break-all text-[12px] leading-6" style={{ color: "rgba(255,255,255,0.88)", fontFamily: MONO_FONT }}>{MICROHOOD_PROJECT_TOKEN_ADDRESS}</p><div className="mt-5 flex flex-wrap gap-2"><a href={`${ROBINHOOD_MAINNET_EXPLORER}/address/${MICROHOOD_PROJECT_TOKEN_ADDRESS}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#F9D77A] transition hover:bg-white/10">Explorer <ExternalLink className="h-3.5 w-3.5" /></a><button type="button" onClick={() => void copyAddress(MICROHOOD_PROJECT_TOKEN_ADDRESS)} className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition hover:bg-white/10 hover:text-white" style={{ color: "rgba(255,255,255,0.72)" }}>{copiedAddress === MICROHOOD_PROJECT_TOKEN_ADDRESS ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedAddress === MICROHOOD_PROJECT_TOKEN_ADDRESS ? "Copied" : "Copy CA"}</button></div><p className="mt-4 text-[11px] leading-[1.55]" style={{ color: "rgba(255,255,255,0.62)" }}>Displayed as a project token address, not as Microsoft equity or an official Robinhood Stock Token.</p></div>

              <div className="rounded-xl border bg-white p-5 sm:p-6" style={{ borderColor: RULE }}><p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUTED }}>Integration boundary</p><div className="mt-5 space-y-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "#E8F5FD", color: MICROSOFT_BLUE }}><WalletCards className="h-4 w-4" /></span><span className="text-[13px] font-semibold" style={{ color: INK }}>No wallet connection</span></div><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "#E8FBE9", color: "#08A90C" }}><Radio className="h-4 w-4" /></span><span className="text-[13px] font-semibold" style={{ color: INK }}>Public reads only</span></div><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "#FFF5DE", color: "#AA7114" }}><Layers3 className="h-4 w-4" /></span><span className="text-[13px] font-semibold" style={{ color: INK }}>Adapter-ready boundary</span></div></div></div>
            </div>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-5 text-[11px] font-semibold uppercase tracking-[0.13em]" style={{ borderColor: RULE, color: MUTED }}><span>Source of truth: public registry + chain RPC</span><div className="flex flex-wrap items-center gap-5"><a href={ROBINHOOD_STOCK_TOKEN_DOCS} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 transition hover:text-[#0078D4]">Stock Token API <ArrowUpRight className="h-3.5 w-3.5" /></a><a href={ROBINHOOD_CHAIN_DOCS} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 transition hover:text-[#0078D4]">Chain docs <ArrowUpRight className="h-3.5 w-3.5" /></a></div></div>
        </div>
      </section>

      {error && <div className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12"><div role="alert" className="rounded-lg border px-4 py-3 text-[13px]" style={{ borderColor: "#F0A6A6", background: "#FFF4F4", color: INK }}><strong className="mr-1" style={{ color: "#C43B3B" }}>Couldn&apos;t open environment.</strong>{error}</div></div>}

      <section ref={envSectionRef} className="relative border-t" style={{ background: "#FFFFFF", borderColor: RULE }}>
        <div className="mx-auto max-w-[1440px] px-5 pb-24 pt-16 sm:px-8 lg:px-12 lg:pb-32 lg:pt-24">
          <div className="flex flex-col justify-between gap-6 border-b pb-8 sm:flex-row sm:items-end" style={{ borderColor: RULE }}><div><div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.19em]" style={{ color: MICROSOFT_BLUE }}><Sparkles className="h-3.5 w-3.5" />Benchmark surfaces</div><h2 className="mt-4 text-[clamp(2.5rem,5vw,5rem)] font-semibold leading-[0.94] tracking-[-0.06em]" style={{ color: INK, fontFamily: DISPLAY_FONT }}>Ten surfaces.<br /><span style={{ color: MICROSOFT_BLUE }}>One test.</span></h2></div><div className="max-w-sm text-[14px] leading-[1.65]" style={{ color: INK_SOFT }}>Choose a living interface. We boot it with scenario data and let the agent discover the moment that matters.</div></div>
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-6">
            {environmentRoutes.map((route, index) => {
              const envName = route.base_task ?? route.path.replace(/^\//, "");
              const theme = envTheme[envName] ?? { accent: MICROSOFT_BLUE, soft: "#E8F3FC", category: "App", span: "lg:col-span-2" };
              const isBusy = busyEnv === envName;
              const isDisabled = busyEnv !== null && busyEnv !== envName;
              const image = cardImageMap[envName];
              return <li key={route.path} className={theme.span} style={{ animation: "landing-rise 0.55s ease both", animationDelay: `${index * 55}ms` }}><button type="button" onClick={() => void openEnvironment(route)} disabled={isDisabled} aria-busy={isBusy} className="group relative flex min-h-[235px] h-full w-full flex-col items-start justify-between overflow-hidden rounded-xl border p-5 text-left transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(19,52,82,0.12)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:p-6" style={{ background: theme.soft, borderColor: `${theme.accent}32`, color: INK }}><span className="absolute right-0 top-0 h-1 w-1/2 origin-right scale-x-50 transition duration-300 group-hover:scale-x-100" style={{ background: theme.accent }} /><div className="flex w-full items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-white/80 p-1.5" style={{ boxShadow: "0 5px 14px rgba(20,50,80,0.07)" }}>{image ? <img src={image} alt="" className="h-full w-full object-contain" draggable={false} /> : <Code2 className="h-5 w-5" style={{ color: theme.accent }} />}</span><span className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.accent }}>{String(index + 1).padStart(2, "0")} / {theme.category}</span></div><div className="w-full"><h3 className="text-[clamp(1.65rem,2.8vw,2.55rem)] font-semibold leading-none tracking-[-0.05em]" style={{ color: INK, fontFamily: DISPLAY_FONT }}>{route.title}</h3><p className="mt-3 max-w-[30ch] text-[13px] leading-[1.6]" style={{ color: INK_SOFT }}>{route.description}</p><span className="mt-5 inline-flex min-h-11 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: theme.accent }}>{isBusy ? "Booting" : "Open surface"}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></div></button></li>;
            })}
          </ul>
        </div>
      </section>

      <footer className="relative overflow-hidden" style={{ background: NAVY, color: "white" }}><div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16"><div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end"><div><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[9px] bg-white p-1"><img src={MICROHOOD_LOGO} alt="MicroHood" className="h-full w-full object-contain" /></span><span className="text-[13px] font-semibold uppercase tracking-[0.14em]">MicroHood / SentinelBench</span></div><p className="mt-6 max-w-xl text-[15px] leading-[1.7]" style={{ color: "rgba(255,255,255,0.68)" }}>A benchmark for agents that need to notice what changed — and know when not to act.</p></div><div className="flex flex-wrap gap-x-6 gap-y-3 text-[11px] font-semibold uppercase tracking-[0.14em] lg:justify-end" style={{ color: "rgba(255,255,255,0.68)" }}><a href={PROJECT_DOMAIN_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 transition hover:text-white" style={{ color: "#7ABEF0" }}>microhood.ai <ArrowUpRight className="h-3.5 w-3.5" /></a><a href={PROJECT_X_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 transition hover:text-white" style={{ color: "rgba(255,255,255,0.78)" }}>X @microhood_ai <ArrowUpRight className="h-3.5 w-3.5" /></a><a href={RESEARCH_X_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 transition hover:text-white" style={{ color: "#93C5FD" }}>Research @MSFTResearch <ArrowUpRight className="h-3.5 w-3.5" /></a><a href={README_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 transition hover:text-white">README <ArrowUpRight className="h-3.5 w-3.5" /></a><a href={BLOG_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 transition hover:text-white">Paper <ArrowUpRight className="h-3.5 w-3.5" /></a><a href={PROJECT_REPO_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 transition hover:text-white"><Github className="h-3.5 w-3.5" />Open source</a></div></div><div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-[10px] uppercase tracking-[0.16em]" style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}><span><a href={RESEARCH_X_URL} target="_blank" rel="noreferrer" className="transition hover:text-white">Microsoft Research · AI Frontiers</a></span><span>Public reads only · no order execution</span></div></div></footer>

      {modal && <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8" role="dialog" aria-modal="true"><div className="absolute inset-0" style={{ background: "rgba(7,20,33,0.72)" }} onClick={() => setModal(null)} /><div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl" style={{ background: "#FFFFFF", borderColor: RULE, color: INK }}><div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: RULE }}><span className="text-[12px] font-semibold uppercase tracking-[0.15em]">{modal === "about" ? "About SentinelBench" : "Authors"}</span><button type="button" onClick={() => setModal(null)} aria-label="Close" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition hover:bg-[#F1F5F8]" style={{ color: INK_SOFT }}><ChevronDown className="h-4 w-4 rotate-45" /></button></div><div className="max-h-[72vh] overflow-y-auto px-7 py-7">{modal === "about" ? <div className="space-y-5"><div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: MICROSOFT_BLUE }}><Sparkles className="h-3.5 w-3.5" />Research benchmark</div><h2 className="text-4xl font-semibold leading-[0.95] tracking-[-0.06em] sm:text-5xl" style={{ fontFamily: DISPLAY_FONT }}>Agents that <span style={{ color: MICROSOFT_BLUE }}>wait, watch, act.</span></h2><p className="max-w-prose text-[15px] leading-[1.75]" style={{ color: INK_SOFT }}>SentinelBench evaluates AI agents on <strong>long-horizon monitoring tasks</strong> across ten high-fidelity web-app replicas. Each task evolves over time and becomes satisfiable only at the specified moment.</p><p className="max-w-prose text-[15px] leading-[1.75]" style={{ color: INK_SOFT }}>The MSFT Robinhood Chain case extends that idea to a public, read-only asset boundary: resolve the canonical token, validate its deployment, then observe without silently escalating into wallet or trade permissions.</p><div className="flex flex-wrap gap-3 pt-2"><a href={README_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ background: INK, color: "white" }}>README <ArrowUpRight className="h-3.5 w-3.5" /></a><a href={BLOG_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: RULE, color: INK }}>Blog post <ArrowUpRight className="h-3.5 w-3.5" /></a></div></div> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{AUTHORS.map((author) => <a key={author.name} href={author.profileUrl} target="_blank" rel="noreferrer" className="group flex flex-col gap-3 rounded-xl p-3 transition hover:bg-[#F5F8FA]"><div className="aspect-square w-full overflow-hidden rounded-xl" style={{ background: "#F1F5F8" }}><img src={author.photo} alt={author.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /></div><div><p className="text-[14px] font-semibold" style={{ color: INK }}>{author.name}</p><p className="mt-1 text-[11px]" style={{ color: MUTED }}>{author.affiliation}</p></div></a>)}</div>}</div></div></div>}
    </div>
  );
};

export default Landing;
