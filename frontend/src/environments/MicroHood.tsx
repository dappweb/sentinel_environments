import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useHashRoute } from "../hooks/useHashRoute";
import { useMicrohoodData, type RobinhoodAsset } from "../hooks/useMicrohoodData";
import PrivyAccountButton from "../components/PrivyAccountButton";
import {
  Search,
  Bell,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Gift,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Home,
  BarChart3,
  Repeat,
  User,
  Menu,
  X,
  Star,
  Check,
  ChevronRight,
  Lock,
  Unlock,
  Key,
  AlertTriangle,
  FileText,
  Share2,
  EyeOff,
  Plus,
  Copy,
  Github,
  DollarSign,
  Building,
  Briefcase,
  Sun,
  Moon,
  Settings,
} from "lucide-react";

export const TASK_ID_MICROHOOD = "microhood";

const PROJECT_X_URL = "https://x.com/microhood_ai";
const PROJECT_REPO_URL =
  import.meta.env.VITE_PROJECT_REPO_URL ??
  "https://github.com/microsoft/sentinel_environments";
const ROBINHOOD_MAINNET_EXPLORER = "https://robinhoodchain.blockscout.com";
const MSFT_STOCK_TOKEN_ADDRESS =
  "0xe93237C50D904957Cf27E7B1133b510C669c2e74";
const MICROHOOD_PROJECT_TOKEN_ADDRESS =
  "0x6be1478173ccb95e31d8b22b0b71efde24e2f0c4";

const shortenAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

const TOP_ROBINHOOD_SYMBOLS = [
  "MSFT", "AAPL", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO",
  "AMD", "ORCL", "NFLX", "TSM", "INTC", "CRM", "ADBE", "COST",
  "JPM", "V", "MA", "KO",
];

type StockTokenVisual = {
  background: string;
  foreground: string;
  mark: string;
};

// The public registry may omit a logo URL, and the API can be temporarily
// unavailable while the page is loading. Keep a deterministic local badge for
// every supported symbol so no stock-token surface renders an empty icon.
const STOCK_TOKEN_VISUALS: Record<string, StockTokenVisual> = {
  MSFT: { background: "#0078D4", foreground: "#FFFFFF", mark: "MS" },
  AAPL: { background: "#111827", foreground: "#FFFFFF", mark: "AP" },
  NVDA: { background: "#76B900", foreground: "#0B1A00", mark: "NV" },
  AMZN: { background: "#FF9900", foreground: "#241100", mark: "AM" },
  GOOGL: { background: "#4285F4", foreground: "#FFFFFF", mark: "GO" },
  META: { background: "#0866FF", foreground: "#FFFFFF", mark: "ME" },
  TSLA: { background: "#E82127", foreground: "#FFFFFF", mark: "TS" },
  AVGO: { background: "#CC092F", foreground: "#FFFFFF", mark: "AV" },
  AMD: { background: "#ED1C24", foreground: "#FFFFFF", mark: "AD" },
  ORCL: { background: "#F80000", foreground: "#FFFFFF", mark: "OR" },
  NFLX: { background: "#E50914", foreground: "#FFFFFF", mark: "NF" },
  TSM: { background: "#1E6AA8", foreground: "#FFFFFF", mark: "TS" },
  INTC: { background: "#0071C5", foreground: "#FFFFFF", mark: "IN" },
  CRM: { background: "#0D9DDA", foreground: "#FFFFFF", mark: "CR" },
  ADBE: { background: "#FA0F00", foreground: "#FFFFFF", mark: "AD" },
  COST: { background: "#E31837", foreground: "#FFFFFF", mark: "CO" },
  JPM: { background: "#117ACA", foreground: "#FFFFFF", mark: "JP" },
  V: { background: "#1A1F71", foreground: "#FFFFFF", mark: "V" },
  MA: { background: "#EB001B", foreground: "#FFFFFF", mark: "MA" },
  KO: { background: "#F40009", foreground: "#FFFFFF", mark: "KO" },
};

const getStockTokenVisual = (symbol: string, fallbackColor?: string): StockTokenVisual => {
  const normalized = symbol.trim().toUpperCase() || "TOKEN";
  const preset = STOCK_TOKEN_VISUALS[normalized];
  if (preset) return preset;

  let hash = 0;
  for (const character of normalized) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    background: fallbackColor || `hsl(${hue} 70% 45%)`,
    foreground: "#FFFFFF",
    mark: normalized.slice(0, 2),
  };
};

const DEFAULT_MSFT_STOCK = {
  symbol: "MSFT",
  name: "Microsoft · Robinhood Stock Token",
  price: 0,
  change: 0,
  changePercent: 0,
  color: "#0078D4",
  shares: 0,
  avgCost: 0,
};

const XBrandIcon = ({ size = 16 }: { size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.964 6.817H1.684l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const StockTokenLogo = ({
  asset,
  symbol,
  color,
  size = "h-8 w-8",
}: {
  asset?: Pick<RobinhoodAsset, "tokenSymbol" | "logoUrl">;
  symbol?: string;
  color?: string;
  size?: string;
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedSymbol = (asset?.tokenSymbol ?? symbol ?? "TOKEN").toUpperCase();
  const visual = getStockTokenVisual(resolvedSymbol, color);

  useEffect(() => {
    setImageFailed(false);
  }, [asset?.logoUrl, resolvedSymbol]);

  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-extrabold tracking-[-0.04em] shadow-sm ring-1 ring-black/10`}
      style={{ backgroundColor: visual.background, color: visual.foreground }}
      title={`${resolvedSymbol} stock token icon`}
      aria-label={`${resolvedSymbol} stock token icon`}
    >
      {asset?.logoUrl && !imageFailed ? (
        <img
          src={asset.logoUrl}
          alt={`${resolvedSymbol} logo`}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-white/10">{visual.mark}</span>
      )}
    </span>
  );
};

// ============================================================================
// TYPE DEFINITIONS (UI-only)
// ============================================================================



const formatRelativeTime = (createdAtMs: number): string => {
  const elapsedMs = Date.now() - createdAtMs;
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
};

// ============================================================================
// COMPONENT
// ============================================================================

const MicroHood = () => {
  // ===================== API DATA =====================
  const {
    stocks, watchlist: apiWatchlist, news, portfolio, config,
    robinhoodAssets, robinhoodMsftQuote, robinhoodMsftPriceHistory,
    isLoading, error,
    placeOrder, toggleWatchlist: apiToggleWatchlist,
  } = useMicrohoodData();

  const currentUser = useMemo(() => {
    const raw = config?.selfUser;
    if (!raw) {
      return { id: "user", name: "User", username: "user", avatarUrl: "" };
    }
    return {
      id: raw.id,
      name: raw.name,
      username: raw.username,
      avatarUrl: raw.avatarUrl,
    };
  }, [config?.selfUser]);

  // ===================== DERIVED FROM API =====================
  // Portfolio from API
  const buyingPower = portfolio?.buying_power ?? 10000;
  const portfolioValue = portfolio?.portfolio_value ?? 0;
  const portfolioChange = portfolio?.total_gain ?? 0;
  const portfolioChangePercent = portfolio?.total_gain_percent ?? 0;

  // MCRO shares
  const ownedShares = useMemo(() => {
    const mcro = stocks.find(s => s.symbol === "MCRO");
    return mcro?.shares ?? 0;
  }, [stocks]);

  // allStocksWithCurrentPrices -- directly from API (already has current prices)
  const allStocksWithCurrentPrices = stocks;

  const featuredRobinhoodAssets = useMemo(() => {
    const rank = new Map(TOP_ROBINHOOD_SYMBOLS.map((symbol, index) => [symbol, index]));
    return robinhoodAssets
      .filter((asset) => {
        const symbol = asset.tokenSymbol.toUpperCase();
        return rank.has(symbol) && asset.deployments.some((deployment) => deployment.chainId === 4663);
      })
      .sort((a, b) => (rank.get(a.tokenSymbol.toUpperCase()) ?? 999) - (rank.get(b.tokenSymbol.toUpperCase()) ?? 999));
  }, [robinhoodAssets]);

  const robinhoodAssetBySymbol = useMemo(
    () => new Map(robinhoodAssets.map((asset) => [asset.tokenSymbol.toUpperCase(), asset])),
    [robinhoodAssets],
  );

  // Watchlist from API -- enrich with inWatchlist flag
  const watchlistItems = useMemo(() =>
    apiWatchlist.map(w => ({ ...w, color: "#6B7280", inWatchlist: true })),
    [apiWatchlist]
  );

  // ===================== UI STATE =====================
  const [toast, setToast] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<"buy" | "sell" | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoodRoute, setHoodRoute] = useHashRoute(
    ["home", "search", "transfers", "profile", "crypto", "spending", "retirement"] as const,
    "home",
  );
  const activeTab = hoodRoute.view;
  type HoodTab = "home" | "search" | "transfers" | "profile" | "crypto" | "spending" | "retirement";
  const setActiveTab = useCallback((tab: HoodTab) => setHoodRoute(tab), [setHoodRoute]);

  // UI Panel States
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [buyingPowerExpanded, setBuyingPowerExpanded] = useState(false);
  // Derived from the route so the desktop top nav (Investing/Crypto/Spending/
  // Retirement) survives refresh and shareable URLs. "home" maps to investing.
  const activeNavSection: "investing" | "crypto" | "spending" | "retirement" =
    activeTab === "crypto" || activeTab === "spending" || activeTab === "retirement"
      ? activeTab
      : "investing";
  const setActiveNavSection = useCallback(
    (section: "investing" | "crypto" | "spending" | "retirement") => {
      setHoodRoute(section === "investing" ? "home" : section);
    },
    [setHoodRoute],
  );
  const [editingWatchlist, setEditingWatchlist] = useState(false);

  // Selected stock for detail view
  const [selectedStock, setSelectedStock] = useState<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    color: string;
    shares?: number;
    avgCost?: number;
  }>(DEFAULT_MSFT_STOCK);
  const liveSelectedStock = useMemo(() => {
    if (selectedStock.symbol === "MSFT") {
      return {
        ...selectedStock,
        price: robinhoodMsftQuote?.currentPrice ?? selectedStock.price,
        change: 0,
        changePercent: 0,
        shares: 0,
        avgCost: 0,
      };
    }
    const live = allStocksWithCurrentPrices.find(s => s.symbol === selectedStock.symbol);
    if (!live) return selectedStock;
    return {
      ...selectedStock,
      price: live.currentPrice,
      change: live.change,
      changePercent: live.changePercent,
      shares: live.shares,
      avgCost: live.avgCost,
    };
  }, [selectedStock, allStocksWithCurrentPrices, robinhoodMsftQuote]);

  const isRobinhoodMsft = liveSelectedStock?.symbol === "MSFT";

  // Restore the detail panel selection from the URL hash (#home/SYM) once
  // stocks have loaded, so reloads — including the eval harness's wait_for
  // periodic reload — don't snap the view back to the MCRO fallback.
  useEffect(() => {
    if (hoodRoute.view !== "home" || !hoodRoute.id) return;
    if (selectedStock?.symbol === hoodRoute.id) return;
    const live = allStocksWithCurrentPrices.find(s => s.symbol === hoodRoute.id);
    if (!live) return;
    setSelectedStock({
      symbol: live.symbol,
      name: live.name,
      price: live.currentPrice,
      change: live.change,
      changePercent: live.changePercent,
      color: live.color,
      shares: live.shares,
      avgCost: live.avgCost,
    });
  }, [hoodRoute.view, hoodRoute.id, allStocksWithCurrentPrices, selectedStock?.symbol]);

  // ===================== PRICE HISTORY (depends on liveSelectedStock) =====================
  const currentPrice = useMemo(() => {
    if (isRobinhoodMsft) return robinhoodMsftQuote?.currentPrice ?? liveSelectedStock.price;
    const symbol = liveSelectedStock?.symbol ?? "MCRO";
    return stocks.find(s => s.symbol === symbol)?.currentPrice ?? 0;
  }, [stocks, liveSelectedStock, isRobinhoodMsft, robinhoodMsftQuote]);

  const generatePriceHistory = (startPrice: number, points: number, volatility: number, endPrice: number, seed: number): number[] => {
    let s = seed | 0;
    const rand = () => { s = (Math.imul(1664525, s) + 1013904223) | 0; return (s >>> 0) / 0x100000000; };
    const arr = Array(points).fill(0).map((_, i) =>
      startPrice + (endPrice - startPrice) * (i / points) + Math.sin(i * 0.3) * volatility + (rand() - 0.5) * volatility
    );
    arr[arr.length - 1] = endPrice;
    return arr;
  };

  const priceHistoryByTimeframe = useMemo(() => {
    const p = liveSelectedStock?.price ?? 450;
    const v = p * 0.015;
    const open = p - (liveSelectedStock?.change ?? 0);
    const sym = liveSelectedStock?.symbol ?? "";
    const base = sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    if (isRobinhoodMsft) {
      const low = robinhoodMsftQuote?.dailyLow ?? p;
      const high = robinhoodMsftQuote?.dailyHigh ?? p;
      const observed = robinhoodMsftPriceHistory.length >= 2
        ? robinhoodMsftPriceHistory
        : [low, (low + p) / 2, p].filter((value) => value > 0);
      const range = [low, p, high].filter((value) => value > 0);
      return {
        "1D": observed,
        "1W": range,
        "1M": range,
        "3M": range,
        "YTD": range,
        "1Y": range,
        "ALL": range,
      };
    }
    return {
      "1D":  generatePriceHistory(open,      30, v * 0.3, p, base + 1),
      "1W":  generatePriceHistory(p * 0.97,  50, v,       p, base + 2),
      "1M":  generatePriceHistory(p * 0.93,  50, v * 1.5, p, base + 3),
      "3M":  generatePriceHistory(p * 0.88,  50, v * 2.5, p, base + 4),
      "YTD": generatePriceHistory(p * 0.82,  50, v * 3.5, p, base + 5),
      "1Y":  generatePriceHistory(p * 0.75,  50, v * 4.5, p, base + 6),
      "ALL": generatePriceHistory(p * 0.55,  50, v * 7,   p, base + 7),
    };
  }, [liveSelectedStock, isRobinhoodMsft, robinhoodMsftQuote, robinhoodMsftPriceHistory]);

  const priceHistoryRef = useRef<number[]>([]);
  const lastSymbolRef = useRef<string>("");
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  useEffect(() => {
    if (currentPrice <= 0) return;
    const symbol = liveSelectedStock?.symbol ?? "MCRO";
    if (symbol !== lastSymbolRef.current) {
      lastSymbolRef.current = symbol;
      priceHistoryRef.current = [...priceHistoryByTimeframe["1D"]];
    }
    const hist = priceHistoryRef.current;
    hist.push(currentPrice);
    if (hist.length > 80) hist.shift();
    setPriceHistory([...hist]);
  }, [currentPrice, liveSelectedStock?.symbol, priceHistoryByTimeframe]);

  // For the official MSFT case, 1D uses observed public quote samples; the
  // other timeframes use the current-day range because no historical endpoint
  // is claimed by the read-only Stock Token API.
  const chartData = selectedTimeframe === "1D"
    ? priceHistory
    : (priceHistoryByTimeframe[selectedTimeframe as keyof typeof priceHistoryByTimeframe] ?? []);

  const startingPrice = liveSelectedStock
    ? liveSelectedStock.price - (liveSelectedStock.change ?? 0)
    : currentPrice;
  const priceChange = currentPrice - startingPrice;
  const priceChangePercent = startingPrice > 0 ? (priceChange / startingPrice) * 100 : 0;

  const [orderStep, setOrderStep] = useState<"quantity" | "review">("quantity");
  const [orderTypeSelection, setOrderTypeSelection] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");

  // Full realism state
  const [showCardSettingsModal, setShowCardSettingsModal] = useState(false);
  const [cardFrozen, setCardFrozen] = useState(false);
  const [transferStep, setTransferStep] = useState<"menu" | "to-bank" | "from-bank" | "stocks">("menu");
  const [transferAmount, setTransferAmount] = useState("");
  const [showMoreOptionsDropdown, setShowMoreOptionsDropdown] = useState(false);
  const [transactions, setTransactions] = useState<Array<{ merchant: string; amount: number; date: string; type: "spending" | "order" }>>([
    { merchant: "Coffee Shop", amount: -4.50, date: "Today", type: "spending" },
    { merchant: "Grocery Store", amount: -67.23, date: "Yesterday", type: "spending" },
    { merchant: "Gas Station", amount: -45.00, date: "Dec 18", type: "spending" },
    { merchant: "Restaurant", amount: -32.50, date: "Dec 17", type: "spending" },
    { merchant: "Transfer In", amount: 500.00, date: "Dec 15", type: "spending" },
  ]);
  const [showIRAModal, setShowIRAModal] = useState(false);
  const [iraContribution, setIraContribution] = useState("");
  const [iraBalance, setIraBalance] = useState(7500.00);
  const [notifications, setNotifications] = useState([
    { id: 1, type: "price", title: "MCRO is up 5%", desc: "MicroSystems Corp reached $472.50", time: "2m ago", unread: true },
    { id: 2, type: "order", title: "Order filled", desc: "Bought 1 share of MCRO at $450.00", time: "1h ago", unread: true },
    { id: 3, type: "news", title: "Breaking News", desc: "Tech stocks rally on strong earnings", time: "2h ago", unread: false },
    { id: 4, type: "alert", title: "Price alert", desc: "PEAR crossed your $180 target", time: "3h ago", unread: false },
    { id: 5, type: "dividend", title: "Dividend received", desc: "$12.50 from CHIP", time: "1d ago", unread: false },
  ]);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Theme-aware color classes
  const themeClasses = useMemo(() => ({
    bg: theme === "dark" ? "bg-black" : "bg-white",
    bgSecondary: theme === "dark" ? "bg-gray-900" : "bg-gray-100",
    bgTertiary: theme === "dark" ? "bg-gray-800" : "bg-gray-200",
    bgHover: theme === "dark" ? "hover:bg-gray-900" : "hover:bg-gray-100",
    bgHoverSecondary: theme === "dark" ? "hover:bg-gray-800" : "hover:bg-gray-200",
    bgModal: theme === "dark" ? "bg-gray-900" : "bg-white",
    bgOverlay: theme === "dark" ? "bg-black/80" : "bg-black/50",
    bgCard: theme === "dark" ? "bg-gray-900" : "bg-gray-50",
    bgInput: theme === "dark" ? "bg-gray-800" : "bg-gray-100",
    text: theme === "dark" ? "text-white" : "text-gray-900",
    textSecondary: theme === "dark" ? "text-gray-400" : "text-gray-700",
    textMuted: theme === "dark" ? "text-gray-500" : "text-gray-600",
    border: theme === "dark" ? "border-gray-800" : "border-gray-200",
    borderSecondary: theme === "dark" ? "border-gray-700" : "border-gray-300",
    navActive: theme === "dark" ? "text-white" : "text-gray-900",
    navInactive: theme === "dark" ? "text-gray-500" : "text-gray-700",
    accentText: theme === "dark" ? "text-[#00C805]" : "text-[#007A05]",
    accentHover: theme === "dark" ? "hover:text-[#00C805]" : "hover:text-[#007A05]",
    negativeText: theme === "dark" ? "text-[#FF5000]" : "text-[#B93800]",
    linkText: theme === "dark" ? "text-[#7ABEF0]" : "text-[#005EA8]",
    hoverText: theme === "dark" ? "hover:text-white" : "hover:text-gray-900",
    chartLine: theme === "dark" ? "#4B5563" : "#9CA3AF",
    chartText: theme === "dark" ? "#9CA3AF" : "#4B5563",
  }), [theme]);

  // Toast helper
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const copyAddress = useCallback(async (address: string, label: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      showToast(`${label} copied`);
      window.setTimeout(() => setCopiedAddress(null), 1600);
    } catch {
      showToast("Copy failed");
    }
  }, [showToast]);

  // Handlers
  const handleSelectStock = useCallback((stock: {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    color: string;
    shares?: number;
    avgCost?: number;
  }) => {
    setSelectedStock(stock);
    setHoodRoute("home", stock.symbol);
    setShowSearchModal(false);
    setSearchQuery("");
    showToast(`Viewing ${stock.symbol}`);
  }, [showToast, setHoodRoute]);

  const handleToggleWatchlist = useCallback((symbol: string) => {
    const existing = watchlistItems.find(item => item.symbol === symbol);
    const isCurrentlyInWatchlist = existing?.inWatchlist ?? false;
    apiToggleWatchlist(symbol);
    showToast(isCurrentlyInWatchlist ? `Removed ${symbol} from watchlist` : `Added ${symbol} to watchlist`);
  }, [watchlistItems, showToast, apiToggleWatchlist]);

  const isInWatchlist = useCallback((symbol: string) => {
    const item = watchlistItems.find(w => w.symbol === symbol);
    return item?.inWatchlist ?? false;
  }, [watchlistItems]);

  const handlePlaceOrder = useCallback((type: "buy" | "sell") => {
    if (isRobinhoodMsft) {
      showToast("MSFT is a read-only Robinhood Chain quote");
      return;
    }
    setOrderType(type);
    setShowOrderModal(true);
    setOrderQuantity("1");
    setOrderStep("quantity");
    setOrderTypeSelection("market");
    setLimitPrice("");
  }, [isRobinhoodMsft, showToast]);

  const handleConfirmOrder = useCallback(async () => {
    const qty = parseInt(orderQuantity) || 1;
    const tradingSymbol = liveSelectedStock?.symbol || "MCRO";
    const stockPrice = liveSelectedStock?.price || currentPrice;
    const effectivePrice = orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : stockPrice;
    const orderCost = effectivePrice * qty;

    if (!orderType) return;

    const result = await placeOrder(
      tradingSymbol,
      orderType,
      qty,
      orderTypeSelection,
      orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : undefined,
    );

    if (!result.success) {
      showToast(result.error || "Order failed");
      return;
    }

    // Update local transaction log (cosmetic)
    setTransactions(prev => [{
      merchant: `${orderType === "buy" ? "Buy" : "Sell"} ${qty} ${tradingSymbol} @ ${formatCurrency(effectivePrice)}`,
      amount: orderType === "buy" ? -orderCost : orderCost,
      date: "Just now",
      type: "order" as const,
    }, ...prev]);
    showToast(`${orderType === "buy" ? "Bought" : "Sold"} ${qty} share${qty > 1 ? "s" : ""} of ${tradingSymbol}`);

    setShowOrderModal(false);
  }, [orderType, orderQuantity, currentPrice, liveSelectedStock, showToast, orderTypeSelection, limitPrice, placeOrder]);

  const stockStats = useMemo(() => {
    const s = liveSelectedStock;
    // The Robinhood Chain public quote endpoint does not provide fundamentals
    // or analyst research. Do not show synthetic values for the official MSFT
    // example; keep those fields limited to the simulated benchmark stocks.
    if (!s || isRobinhoodMsft) return null;
    // Deterministic hash so each stock gets stable but different values.
    let h = 0;
    for (let i = 0; i < s.symbol.length; i++) {
      h = (h * 31 + s.symbol.charCodeAt(i)) & 0xffff;
    }
    const h1 = h & 0xff;
    const h2 = (h >> 4) & 0xff;
    const price = s.price;
    const open = price - s.change;
    const dailySwing = price * (0.008 + (h1 % 12) * 0.001);
    const weeklySwing = price * (0.18 + (h2 % 20) * 0.01);
    const volumeBase = price > 300 ? 4 : price > 100 ? 12 : 28;
    const sharesOut = (500 + (h1 % 400)) * 1e6;
    const buyPct = 52 + (h1 % 30);
    const sellPct = 5 + (h2 % 15);
    const holdPct = 100 - buyPct - sellPct;
    
    return {
      open,
      high: Math.max(open + dailySwing, price),
      low: Math.min(open - dailySwing, price),
      volume: `${(volumeBase + (h2 % 10)).toFixed(1)}M`,
      marketCap: `$${(price * sharesOut / 1e12).toFixed(2)}T`,
      peRatio: (14 + (h1 % 32) + (h2 % 8) * 0.25).toFixed(2),
      high52: price + weeklySwing,
      low52: price - weeklySwing,
      buyPct,
      holdPct,
      sellPct,
      analystCount: 20 + (h2 % 35),
    };
  }, [liveSelectedStock, isRobinhoodMsft]);

  const handleTimeframeChange = useCallback((tf: string) => {
    setSelectedTimeframe(tf);
  }, []);

  const _handleComingSoon = useCallback((feature: string) => {
    showToast(`${feature} coming soon!`);
  }, [showToast]);
  void _handleComingSoon; // Mark as intentionally unused for now

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatChange = (value: number, percent: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${formatCurrency(value)} (${sign}${percent.toFixed(2)}%)`;
  };

  // Chart rendering
  const renderChart = () => {
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Need at least two points for a polyline; otherwise the x denominator
    // (length - 1) is 0 and Math.min(...[]) is Infinity, both of which
    // produce NaN coordinates and SVG warnings.
    if (chartData.length < 2) {
      return (
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        />
      );
    }

    const minPrice = Math.min(...chartData) - 5;
    const maxPrice = Math.max(...chartData) + 5;
    const priceRange = maxPrice - minPrice;

    const points = chartData.map((price, i) => {
      const x = padding.left + (i / (chartData.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
      return `${x},${y}`;
    }).join(" ");

    const areaPoints = `${padding.left},${padding.top + chartHeight} ${points} ${padding.left + chartWidth},${padding.top + chartHeight}`;
    const isPositive = currentPrice >= startingPrice;
    const lineColor = isPositive ? "#00C805" : "#FF5000";

    // Previous close line position
    const prevCloseY = padding.top + chartHeight - ((startingPrice - minPrice) / priceRange) * chartHeight;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Previous day close dotted line */}
        <line
          x1={padding.left}
          y1={prevCloseY}
          x2={padding.left + chartWidth}
          y2={prevCloseY}
          stroke={themeClasses.chartLine}
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text
          x={padding.left + chartWidth + 5}
          y={prevCloseY + 4}
          fill={themeClasses.chartText}
          fontSize="10"
          fontFamily="sans-serif"
        >
          {formatCurrency(startingPrice)}
        </text>

        <polygon points={areaPoints} fill="url(#chartGradient)" />
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current price dot with pulse animation */}
        <circle
          cx={padding.left + chartWidth}
          cy={padding.top + chartHeight - ((currentPrice - minPrice) / priceRange) * chartHeight}
          r="6"
          fill={lineColor}
          opacity="0.3"
        >
          <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle
          cx={padding.left + chartWidth}
          cy={padding.top + chartHeight - ((currentPrice - minPrice) / priceRange) * chartHeight}
          r="4"
          fill={lineColor}
        />
      </svg>
    );
  };

  const timeframes = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

  // ---------------------------------------------------------------------------
  // Loading Gate
  // ---------------------------------------------------------------------------
  if (!config || isLoading) {
    const isNetworkError = error && /failed to fetch|networkerror/i.test(error);
    const isNoSession = error && /409/.test(error);
    const isMismatch = error && /environment mismatch/i.test(error);
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">📈</div>
          <h1 className="text-xl font-semibold mb-6 text-white">MicroHood</h1>
          {!error ? (
            <>
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-400">Connecting to MicroHood...</p>
            </>
          ) : isNetworkError ? (
            <>
              <p className="font-medium mb-2 text-white">Could not connect to the server</p>
              <p className="text-sm text-gray-400 mb-3">Make sure the API server is running on port 8000.</p>
              <p className="text-xs font-mono bg-gray-800 rounded px-3 py-2 text-gray-400 mt-2">uvicorn server.server:app --port 8000</p>
            </>
          ) : isNoSession ? (
            <>
              <p className="font-medium mb-2 text-white">No scenario initialized</p>
              <p className="text-sm text-gray-400 mb-3">The server is running but no scenario has been loaded. Use the CLI harness or POST /init to start a scenario.</p>
              <p className="text-xs font-mono bg-gray-800 rounded px-3 py-2 text-gray-400 mt-2">python -m server.run_simulation &lt;scenario.json&gt;</p>
            </>
          ) : isMismatch ? (
            <>
              <p className="font-medium mb-2 text-white">Wrong environment</p>
              <p className="text-sm text-gray-400 mb-3">{error}</p>
              <p className="text-sm text-gray-400">Navigate to the correct environment from the desktop, or re-init with a MicroHood scenario.</p>
            </>
          ) : (
            <>
              <p className="font-medium mb-2 text-white">Connection Error</p>
              <p className="text-sm text-red-400">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg} ${themeClasses.text} transition-colors duration-300`} style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <header className={`border-b ${themeClasses.border} sticky top-0 ${themeClasses.bg} z-40 transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <img src={`${import.meta.env.BASE_URL}desktop/microhood-icon.png`} alt="MicroHood" className="w-8 h-8 object-contain" />
                <span className={`text-xl font-bold ${themeClasses.text}`}>MicroHood</span>
              </div>

              {/* Navigation */}
              <nav className="hidden lg:flex items-center gap-6 text-sm">
                <button
                  onClick={() => setActiveNavSection("investing")}
                  className={`${activeNavSection === "investing" ? `${themeClasses.navActive} font-medium` : themeClasses.textSecondary} ${themeClasses.accentHover} transition-colors`}
                >
                  Investing
                </button>
                <button
                  onClick={() => setActiveNavSection("crypto")}
                  className={`${activeNavSection === "crypto" ? `${themeClasses.navActive} font-medium` : themeClasses.textSecondary} ${themeClasses.accentHover} transition-colors`}
                >
                  Crypto
                </button>
                <button
                  onClick={() => setActiveNavSection("spending")}
                  className={`${activeNavSection === "spending" ? `${themeClasses.navActive} font-medium` : themeClasses.textSecondary} ${themeClasses.accentHover} transition-colors`}
                >
                  Spending
                </button>
                <button
                  onClick={() => setActiveNavSection("retirement")}
                  className={`${activeNavSection === "retirement" ? `${themeClasses.navActive} font-medium` : themeClasses.textSecondary} ${themeClasses.accentHover} transition-colors`}
                >
                  Retirement
                </button>
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSearchModal(true)}
                className={`hidden lg:flex items-center gap-2 ${themeClasses.bgSecondary} rounded-full px-4 py-2 ${themeClasses.bgHoverSecondary} transition-colors`}
              >
                <Search size={16} className={themeClasses.textSecondary} />
                <span className={`text-sm ${themeClasses.textMuted} w-48 text-left`}>Search</span>
              </button>
              <a
                href={PROJECT_X_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="X @microhood_ai"
                title="X @microhood_ai"
                className={`hidden md:flex min-h-10 min-w-10 items-center justify-center rounded-full ${themeClasses.bgHoverSecondary} ${themeClasses.textSecondary} ${themeClasses.hoverText} transition-colors`}
              >
                <XBrandIcon />
              </a>
              <a
                href={PROJECT_REPO_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub source repository"
                title="GitHub source repository"
                className={`hidden md:flex min-h-10 min-w-10 items-center justify-center rounded-full ${themeClasses.bgHoverSecondary} ${themeClasses.textSecondary} ${themeClasses.hoverText} transition-colors`}
              >
                <Github size={17} />
              </a>
              <button
                onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
                className={`p-2 ${themeClasses.bgHoverSecondary} rounded-full transition-colors relative ${showNotificationsPanel ? themeClasses.bgTertiary : ""}`}
              >
                <Bell size={20} className={themeClasses.textSecondary} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#00C805] rounded-full" />
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className={`p-2 ${themeClasses.bgHoverSecondary} rounded-full transition-colors ${showSettingsModal ? themeClasses.bgTertiary : ""}`}
              >
                <Settings size={20} className={themeClasses.textSecondary} />
              </button>
              <PrivyAccountButton
                onUnavailable={() => showToast("Configure VITE_PRIVY_APP_ID to enable Privy login")}
                className={`hidden md:block px-4 py-2 text-sm font-medium ${themeClasses.accentText} hover:bg-[#00C805]/10 rounded-full transition-colors`}
              />
              <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Project identity rail: public links and explicit token provenance. */}
      <div className={`border-b ${themeClasses.border} ${theme === "dark" ? "bg-[#0B0F12]" : "bg-gray-50"}`}>
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className={`flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border ${themeClasses.borderSecondary} px-3 py-2`}>
            <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] ${themeClasses.textSecondary}`}>Project CA</span>
            <a
              href={`${ROBINHOOD_MAINNET_EXPLORER}/address/${MICROHOOD_PROJECT_TOKEN_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className={`min-w-0 flex-1 break-all font-mono text-[10px] ${themeClasses.linkText} transition ${themeClasses.hoverText} sm:text-xs`}
              title="Open MicroHood project contract on Blockscout"
            >
              {MICROHOOD_PROJECT_TOKEN_ADDRESS}
            </a>
            <button
              type="button"
              aria-label="Copy MicroHood project CA"
              title="Copy MicroHood project CA"
              onClick={() => void copyAddress(MICROHOOD_PROJECT_TOKEN_ADDRESS, "Project CA")}
              className={`flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg ${themeClasses.bgTertiary} ${themeClasses.textSecondary} transition ${themeClasses.accentHover}`}
            >
              {copiedAddress === MICROHOOD_PROJECT_TOKEN_ADDRESS ? <Check size={15} /> : <Copy size={15} />}
            </button>
            <a
              href="/landing"
              title="Open the SentinelBench overview page"
              className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] ${themeClasses.linkText} transition ${themeClasses.hoverText}`}
            >
              Overview
            </a>
          </div>
        </div>
      </div>

      {/* X introduction card: persistent project context for every MicroHood view. */}
      <section className={`${themeClasses.bgSecondary} border-b ${themeClasses.border}`} aria-labelledby="project-x-card-title">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-5">
          <div className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${themeClasses.borderSecondary}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${themeClasses.bgTertiary} ${themeClasses.text}`} aria-hidden="true"><XBrandIcon size={18} /></div>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${themeClasses.textSecondary}`}>MicroHood.ai on X</p>
                <h2 id="project-x-card-title" className="mt-1 text-base font-semibold">Follow the project and research updates</h2>
                <p className={`mt-1 max-w-2xl text-sm leading-6 ${themeClasses.textMuted}`}>Public-read market monitoring, benchmark releases, and project notes from <span className={themeClasses.linkText}>@microhood_ai</span>.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <a href={PROJECT_X_URL} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${themeClasses.accentText} ${themeClasses.bgTertiary} ${themeClasses.accentHover}`} aria-label="Follow MicroHood.ai on X"><XBrandIcon size={15} /> Follow on X <ArrowUpRight size={14} /></a>
              <a href={PROJECT_REPO_URL} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${themeClasses.textSecondary} ${themeClasses.bgTertiary} ${themeClasses.hoverText}`} aria-label="Open MicroHood.ai GitHub repository"><Github size={15} /> GitHub <ArrowUpRight size={14} /></a>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className={`md:hidden fixed inset-0 ${themeClasses.bg} z-50 pt-16`}>
          <div className="p-4 space-y-4">
            <button
              onClick={() => { setActiveNavSection("investing"); setMobileMenuOpen(false); }}
              className={`w-full text-left py-3 text-lg border-b ${themeClasses.border} ${activeNavSection === "investing" ? `font-medium ${themeClasses.navActive}` : themeClasses.textSecondary}`}
            >
              Investing
            </button>
            <button
              onClick={() => { setActiveNavSection("crypto"); setMobileMenuOpen(false); }}
              className={`w-full text-left py-3 text-lg border-b ${themeClasses.border} ${activeNavSection === "crypto" ? `font-medium ${themeClasses.navActive}` : themeClasses.textSecondary}`}
            >
              Crypto
            </button>
            <button
              onClick={() => { setActiveNavSection("spending"); setMobileMenuOpen(false); }}
              className={`w-full text-left py-3 text-lg border-b ${themeClasses.border} ${activeNavSection === "spending" ? `font-medium ${themeClasses.navActive}` : themeClasses.textSecondary}`}
            >
              Spending
            </button>
            <button
              onClick={() => { setActiveNavSection("retirement"); setMobileMenuOpen(false); }}
              className={`w-full text-left py-3 text-lg border-b ${themeClasses.border} ${activeNavSection === "retirement" ? `font-medium ${themeClasses.navActive}` : themeClasses.textSecondary}`}
            >
              Retirement
            </button>
            <button
              onClick={() => { setShowSettingsModal(true); setMobileMenuOpen(false); }}
              className={`w-full text-left py-3 text-lg border-b ${themeClasses.border} ${themeClasses.textSecondary} flex items-center gap-2`}
            >
              <Settings size={20} /> Settings
            </button>
            <PrivyAccountButton
              onUnavailable={() => { showToast("Configure VITE_PRIVY_APP_ID to enable Privy login"); setMobileMenuOpen(false); }}
              className="w-full py-3 mt-4 bg-[#00C805] text-black font-bold rounded-full"
            />
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Section Content Based on Nav */}
        {activeNavSection === "crypto" && (
          <div className="space-y-6 mb-8">
            <h1 className="text-3xl font-bold">Crypto</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { symbol: "BTC", name: "Bitcoin", price: 43250.00, change: 2.34, color: "#F7931A" },
                { symbol: "ETH", name: "Ethereum", price: 2280.50, change: -1.23, color: "#627EEA" },
                { symbol: "SOL", name: "Solana", price: 98.75, change: 5.67, color: "#00FFA3" },
                { symbol: "DOGE", name: "Dogecoin", price: 0.085, change: 0.45, color: "#C2A633" },
                { symbol: "ADA", name: "Cardano", price: 0.52, change: -0.89, color: "#0033AD" },
                { symbol: "DOT", name: "Polkadot", price: 7.23, change: 1.12, color: "#E6007A" },
              ].map(crypto => (
                <button
                  key={crypto.symbol}
                  onClick={() => {
                    handleSelectStock({
                      symbol: crypto.symbol,
                      name: crypto.name,
                      price: crypto.price,
                      change: crypto.price * (crypto.change / 100),
                      changePercent: crypto.change,
                      color: crypto.color,
                    });
                    setActiveNavSection("investing");
                  }}
                  className={`${themeClasses.bgSecondary} rounded-xl p-4 text-left ${themeClasses.bgHoverSecondary} transition-colors group`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: crypto.color }}>
                      {crypto.symbol[0]}
                    </div>
                    <div>
                      <p className="font-medium">{crypto.symbol}</p>
                      <p className={`text-sm ${themeClasses.textMuted}`}>{crypto.name}</p>
                    </div>
                    <ChevronRight size={16} className={`${themeClasses.textMuted} ml-auto opacity-0 group-hover:opacity-100 transition-opacity`} />
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(crypto.price)}</p>
                  <p className={`text-sm ${crypto.change >= 0 ? themeClasses.accentText : themeClasses.negativeText}`}>
                    {crypto.change >= 0 ? "+" : ""}{crypto.change.toFixed(2)}%
                  </p>
                </button>
              ))}
            </div>
            <p className={`${themeClasses.textMuted} text-sm text-center`}>Crypto trading available 24/7</p>
          </div>
        )}

        {activeNavSection === "spending" && (
          <div className="space-y-6 mb-8">
            <h1 className="text-3xl font-bold">Spending</h1>
            <div className={`${themeClasses.bgSecondary} rounded-xl p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className={`${themeClasses.textSecondary} text-sm`}>Available to spend</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(buyingPower * 0.6)}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#00C805]/20 flex items-center justify-center">
                  <CreditCard size={24} className={themeClasses.accentText} />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className={`font-medium ${themeClasses.textSecondary}`}>Recent Transactions</h3>
                {transactions.map((tx, i) => (
                  <div key={i} className={`flex items-center justify-between py-2 ${tx.type === "order" ? `${themeClasses.bgTertiary}/50 -mx-2 px-2 rounded-lg` : ""}`}>
                    <div className="flex items-center gap-3">
                      {tx.type === "order" && (
                        <div className="w-8 h-8 rounded-full bg-[#00C805]/20 flex items-center justify-center">
                          <BarChart3 size={14} className={themeClasses.accentText} />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{tx.merchant}</p>
                        <p className={`text-sm ${themeClasses.textMuted}`}>{tx.date}</p>
                      </div>
                    </div>
                    <p className={`font-medium ${tx.amount >= 0 ? themeClasses.accentText : themeClasses.text}`}>
                      {tx.amount >= 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeNavSection === "retirement" && (
          <div className="space-y-6 mb-8">
            <h1 className="text-3xl font-bold">Retirement</h1>
            <div className={`${themeClasses.bgSecondary} rounded-xl p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className={`${themeClasses.textSecondary} text-sm`}>IRA Balance</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(iraBalance)}</p>
                </div>
                <div className="text-right">
                  <p className={`${themeClasses.accentText} text-lg font-medium`}>+12.4%</p>
                  <p className={`${themeClasses.textMuted} text-sm`}>This year</p>
                </div>
              </div>
              <div className={`h-2 ${themeClasses.bgTertiary} rounded-full overflow-hidden mb-6`}>
                <div className="h-full bg-[#00C805] rounded-full" style={{ width: `${Math.min((iraBalance / 50000) * 100, 100)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className={`${themeClasses.bgTertiary} rounded-lg p-4`}>
                  <p className={themeClasses.textSecondary}>Contribution Limit</p>
                  <p className="text-xl font-bold mt-1">$7,000</p>
                  <p className={`${themeClasses.textMuted} mt-1`}>{formatCurrency(Math.min(iraBalance * 0.3, 7000))} contributed</p>
                </div>
                <div className={`${themeClasses.bgTertiary} rounded-lg p-4`}>
                  <p className={themeClasses.textSecondary}>Projected at 65</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(iraBalance * 50)}</p>
                  <p className={`${themeClasses.textMuted} mt-1`}>Based on 7% return</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowIRAModal(true)}
              className="w-full py-3 bg-[#00C805] text-black font-bold rounded-full hover:bg-[#00B504]"
            >
              Contribute to IRA
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3 lg:items-stretch">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Portfolio Value */}
            <div>
              <div className="flex items-baseline gap-3">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                  {formatCurrency(portfolioValue)}
                </h1>
              </div>
              <div className={`flex items-center gap-2 mt-2 text-lg ${portfolioChange >= 0 ? themeClasses.accentText : themeClasses.negativeText}`}>
                {portfolioChange >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                <span className="font-medium">{formatChange(portfolioChange, portfolioChangePercent)}</span>
                <span className={themeClasses.textMuted}>Today</span>
              </div>
            </div>

            {/* Chart */}
            <div className={`${themeClasses.bg} rounded-lg`}>
              <div className="h-52 md:h-64">
                {renderChart()}
              </div>
              {/* Timeframe selector */}
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => handleTimeframeChange(tf)}
                    className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                      selectedTimeframe === tf
                        ? "bg-[#00C805] text-black"
                        : `${themeClasses.textSecondary} ${themeClasses.hoverText} ${themeClasses.bgHoverSecondary}`
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => handlePlaceOrder("buy")}
                className={`flex flex-col items-center gap-2 p-4 ${themeClasses.bgSecondary} rounded-xl ${themeClasses.bgHoverSecondary} transition-colors`}
              >
                {isRobinhoodMsft ? <EyeOff size={24} className={themeClasses.textSecondary} /> : <TrendingUp size={24} className={themeClasses.accentText} />}
                <span className={`text-sm ${themeClasses.textSecondary}`}>{isRobinhoodMsft ? "Observe" : "Invest"}</span>
              </button>
              <button
                onClick={() => setShowTransferModal(true)}
                className={`flex flex-col items-center gap-2 p-4 ${themeClasses.bgSecondary} rounded-xl ${themeClasses.bgHoverSecondary} transition-colors`}
              >
                <Repeat size={24} className={themeClasses.textSecondary} />
                <span className={`text-sm ${themeClasses.textSecondary}`}>Transfer</span>
              </button>
              <button
                onClick={() => setShowRewardsModal(true)}
                className={`flex flex-col items-center gap-2 p-4 ${themeClasses.bgSecondary} rounded-xl ${themeClasses.bgHoverSecondary} transition-colors`}
              >
                <Gift size={24} className={themeClasses.textSecondary} />
                <span className={`text-sm ${themeClasses.textSecondary}`}>Rewards</span>
              </button>
              <button
                onClick={() => setShowCardModal(true)}
                className={`flex flex-col items-center gap-2 p-4 ${themeClasses.bgSecondary} rounded-xl ${themeClasses.bgHoverSecondary} transition-colors`}
              >
                <CreditCard size={24} className={themeClasses.textSecondary} />
                <span className={`text-sm ${themeClasses.textSecondary}`}>Card</span>
              </button>
            </div>

            {/* Buying Power */}
            <button
              onClick={() => setBuyingPowerExpanded(!buyingPowerExpanded)}
              className={`w-full ${themeClasses.bgSecondary} rounded-xl p-5 text-left ${themeClasses.bgHoverSecondary} transition-colors`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`${themeClasses.textSecondary} text-sm`}>Buying Power</p>
                  <p className={`text-2xl font-bold mt-1 ${themeClasses.text}`}>{formatCurrency(buyingPower)}</p>
                </div>
                <ChevronDown size={24} className={`${themeClasses.textMuted} transition-transform ${buyingPowerExpanded ? "rotate-180" : ""}`} />
              </div>
              {buyingPowerExpanded && (
                <div className={`mt-4 pt-4 border-t ${themeClasses.border} space-y-3`}>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>Cash</span>
                    <span className={themeClasses.text}>{formatCurrency(buyingPower * 0.6)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>Margin Available</span>
                    <span className={themeClasses.text}>{formatCurrency(buyingPower * 0.4)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>Pending Deposits</span>
                    <span className={themeClasses.text}>$0.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>Withdrawable Cash</span>
                    <span className={themeClasses.text}>{formatCurrency(buyingPower * 0.5)}</span>
                  </div>
                </div>
              )}
            </button>

            {/* Positions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Stocks</h2>
              </div>
              <div className="space-y-1">
                {/* Show only stocks user owns, with dynamic prices */}
                {allStocksWithCurrentPrices.filter(s => s.shares > 0).map((stock) => {
                  const value = stock.shares * stock.currentPrice;
                  const gain = (stock.currentPrice - stock.avgCost) * stock.shares;
                  const gainPercent = stock.avgCost > 0 ? ((stock.currentPrice - stock.avgCost) / stock.avgCost) * 100 : 0;
                  const isPositive = gain >= 0;

                  return (
                    <button
                      key={stock.symbol}
                      onClick={() => {
                        setSelectedStock({
                          symbol: stock.symbol,
                          name: stock.name,
                          price: stock.currentPrice,
                          change: stock.change,
                          changePercent: stock.changePercent,
                          color: stock.color,
                          shares: stock.shares,
                          avgCost: stock.avgCost,
                        });
                        setHoodRoute("home", stock.symbol);
                      }}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-900 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <StockTokenLogo
                          asset={robinhoodAssetBySymbol.get(stock.symbol.toUpperCase())}
                          symbol={stock.symbol}
                          color={stock.color}
                          size="h-10 w-10"
                        />
                        <div className="text-left">
                          <p className="font-medium">{stock.symbol}</p>
                          <p className={`text-sm ${themeClasses.textMuted}`}>{stock.shares} shares</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(value)}</p>
                        <p className={`text-sm ${isPositive ? themeClasses.accentText : themeClasses.negativeText}`}>
                          {isPositive ? "+" : ""}{gainPercent.toFixed(2)}%
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className={`mt-6 border-t ${themeClasses.border} pt-5`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${themeClasses.textMuted}`}>Robinhood Chain · US stock tokens</p>
                      <p className={`mt-1 text-xs ${themeClasses.textSecondary}`}>Official assets from the public registry · chain 4663</p>
                    </div>
                    <span className={`shrink-0 text-[10px] ${themeClasses.textMuted}`}>{featuredRobinhoodAssets.length} assets</span>
                  </div>
                  {featuredRobinhoodAssets.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {featuredRobinhoodAssets.map((asset) => {
                        const deployment = asset.deployments.find((item) => item.chainId === 4663);
                        if (!deployment) return null;
                        const displayName = asset.tokenName.replace(/\s+•\s+Robinhood Token$/, "");
                        return (
                          <a
                            key={asset.tokenSymbol}
                            href={`${ROBINHOOD_MAINNET_EXPLORER}/address/${deployment.contractAddress}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex min-h-16 items-center justify-between gap-3 rounded-xl ${themeClasses.bgSecondary} px-3 py-2.5 transition ${themeClasses.bgHoverSecondary}`}
                            title={`${displayName} · ${deployment.contractAddress}`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <StockTokenLogo asset={asset} />
                              <span className="min-w-0">
                                <span className={`block font-semibold ${themeClasses.text}`}>{asset.tokenSymbol}</span>
                                <span className={`block truncate text-[10px] ${themeClasses.textMuted}`}>{displayName}</span>
                              </span>
                            </span>
                            <span className={`flex shrink-0 items-center gap-1 text-[10px] font-mono ${themeClasses.linkText}`}>
                              {shortenAddress(deployment.contractAddress)} <ArrowUpRight size={12} />
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={`rounded-xl ${themeClasses.bgSecondary} p-4 text-sm ${themeClasses.textMuted}`}>Loading the official Robinhood asset registry…</p>
                  )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="h-full space-y-6">
            {/* Featured Stock */}
            <div className={`${themeClasses.bgSecondary} rounded-xl overflow-hidden`}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <StockTokenLogo
                      asset={robinhoodAssetBySymbol.get(liveSelectedStock?.symbol?.toUpperCase() || "MSFT")}
                      symbol={liveSelectedStock?.symbol || "MSFT"}
                      color={liveSelectedStock?.color || "#00A4EF"}
                      size="h-12 w-12"
                    />
                    <div>
                      <p className="font-bold text-lg">{liveSelectedStock?.symbol || "MSFT"}</p>
                      <p className={`text-sm ${themeClasses.textSecondary}`}>{liveSelectedStock?.name || "Microsoft · Robinhood Stock Token"}</p>
                      {isRobinhoodMsft && (
                        <p className={`mt-1 font-mono text-[10px] ${themeClasses.textMuted}`}>
                          {shortenAddress(MSFT_STOCK_TOKEN_ADDRESS)} · chain 4663 · read-only
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Watchlist Toggle Button */}
                    <button
                      onClick={() => {
                        handleToggleWatchlist(liveSelectedStock?.symbol || "MCRO");
                      }}
                      className={`p-2 rounded-full transition-all ${
                        isInWatchlist(liveSelectedStock?.symbol || "MCRO")
                          ? `bg-[#00C805]/20 ${themeClasses.accentText}`
                          : `${themeClasses.bgHoverSecondary} ${themeClasses.textMuted}`
                      }`}
                      title={isInWatchlist(liveSelectedStock?.symbol || "MCRO") ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      <Star
                        size={20}
                        fill={isInWatchlist(liveSelectedStock?.symbol || "MCRO") ? "#00C805" : "none"}
                      />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowMoreOptionsDropdown(!showMoreOptionsDropdown)}
                        className={`p-2 ${themeClasses.bgHoverSecondary} rounded-full ${showMoreOptionsDropdown ? themeClasses.bgTertiary : ""}`}
                      >
                        <MoreHorizontal size={20} className={themeClasses.textMuted} />
                      </button>
                      {showMoreOptionsDropdown && (
                        <div className={`absolute right-0 top-full mt-2 w-48 ${themeClasses.bgTertiary} rounded-xl shadow-xl border ${themeClasses.borderSecondary} overflow-hidden z-50`}>
                          <button
                            onClick={() => {
                              handleToggleWatchlist(liveSelectedStock?.symbol || "MCRO");
                              setShowMoreOptionsDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 ${themeClasses.bgHover} text-left`}
                          >
                            <Plus size={16} className={themeClasses.textSecondary} />
                            <span className="text-sm">Add to list</span>
                          </button>
                          <button
                            onClick={() => {
                              const symbol = liveSelectedStock?.symbol || "MCRO";
                              showToast(`Price alert set for ${symbol}`);
                              setShowMoreOptionsDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 ${themeClasses.bgHover} text-left`}
                          >
                            <Bell size={16} className={themeClasses.textSecondary} />
                            <span className="text-sm">Set price alert</span>
                          </button>
                          <button
                            onClick={() => {
                              const symbol = liveSelectedStock?.symbol || "MCRO";
                              navigator.clipboard.writeText(`https://microhood.app/stock/${symbol}`);
                              showToast("Link copied to clipboard!");
                              setShowMoreOptionsDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 ${themeClasses.bgHover} text-left`}
                          >
                            <Share2 size={16} className={themeClasses.textSecondary} />
                            <span className="text-sm">Share</span>
                          </button>
                          <button
                            onClick={() => {
                              showToast("Stock hidden from feed");
                              setShowMoreOptionsDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 ${themeClasses.bgHover} text-left border-t ${themeClasses.borderSecondary}`}
                          >
                            <EyeOff size={16} className={themeClasses.textSecondary} />
                            <span className="text-sm">Hide</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-bold">
                    {isRobinhoodMsft && !robinhoodMsftQuote
                      ? "Resolving…"
                      : formatCurrency(liveSelectedStock?.price || currentPrice)}
                  </span>
                </div>
                {isRobinhoodMsft ? (
                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${themeClasses.textSecondary}`}>
                    {robinhoodMsftQuote ? (
                      <>
                        <span>Bid {formatCurrency(robinhoodMsftQuote.bid)}</span>
                        <span>Ask {formatCurrency(robinhoodMsftQuote.ask)}</span>
                        <span className={themeClasses.accentText}>Live · public read</span>
                      </>
                    ) : (
                      <span>Waiting for the public Robinhood quote…</span>
                    )}
                  </div>
                ) : (
                  <div className={`flex items-center gap-1 ${
                    (liveSelectedStock?.change ?? priceChange) >= 0 ? themeClasses.accentText : themeClasses.negativeText
                  }`}>
                    {(liveSelectedStock?.change ?? priceChange) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    <span className="font-medium">
                      {formatChange(
                        liveSelectedStock?.change ?? priceChange,
                        liveSelectedStock?.changePercent ?? priceChangePercent
                      )}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mt-5">
                  {isRobinhoodMsft ? (
                    <div className={`col-span-2 flex items-center justify-center gap-2 rounded-full ${themeClasses.bgTertiary} py-3 text-sm font-semibold ${themeClasses.textSecondary}`}>
                      <Lock size={15} /> Read-only quote
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handlePlaceOrder("buy")}
                        className="py-3 rounded-full font-bold text-sm transition-all bg-[#00C805] text-black hover:bg-[#00B504] active:scale-[0.98]"
                      >
                        Buy
                      </button>
                      <button
                        onClick={() => handlePlaceOrder("sell")}
                        className="py-3 rounded-full font-bold text-sm transition-all bg-gray-800 text-white hover:bg-gray-700 active:scale-[0.98]"
                      >
                        Sell
                      </button>
                    </>
                  )}
                </div>
                {liveSelectedStock && !isRobinhoodMsft && (
                  <button
                    onClick={() => {
                      setSelectedStock(DEFAULT_MSFT_STOCK);
                      setHoodRoute("home", null);
                    }}
                    className={`w-full mt-3 py-2 text-sm ${themeClasses.accentText} hover:underline`}
                  >
                    ← Back to MSFT
                  </button>
                )}
              </div>

              {/* Your Position */}
              <div className={`border-t ${themeClasses.border} p-5`}>
                <h4 className={`text-sm font-medium ${themeClasses.textSecondary} mb-3`}>{isRobinhoodMsft ? "Portfolio Position" : "Your Position"}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className={themeClasses.textMuted}>Shares</p>
                    <p className="font-medium">{liveSelectedStock?.shares ?? ownedShares}</p>
                  </div>
                  <div>
                    <p className={themeClasses.textMuted}>Market Value</p>
                    <p className="font-medium">
                      {isRobinhoodMsft
                        ? "—"
                        : formatCurrency((liveSelectedStock?.price || currentPrice) * (liveSelectedStock?.shares ?? ownedShares))}
                    </p>
                  </div>
                  <div>
                    <p className={themeClasses.textMuted}>Avg Cost</p>
                    <p className="font-medium">{isRobinhoodMsft ? "—" : liveSelectedStock?.avgCost ? formatCurrency(liveSelectedStock.avgCost) : "$380.50"}</p>
                  </div>
                  <div>
                    <p className={themeClasses.textMuted}>Total Return</p>
                    {isRobinhoodMsft ? (
                      <p className={`font-medium ${themeClasses.textMuted}`}>Read-only</p>
                    ) : (() => {
                        const avgCost = liveSelectedStock?.avgCost || 380.50;
                        const price = liveSelectedStock?.price || currentPrice;
                        const shares = liveSelectedStock?.shares ?? ownedShares;
                        const returnValue = (price - avgCost) * shares;
                        const returnPercent = ((price - avgCost) / avgCost) * 100;
                        return (
                          <p className={`font-medium ${returnValue >= 0 ? themeClasses.accentText : themeClasses.negativeText}`}>
                            {formatCurrency(returnValue)} ({returnPercent.toFixed(2)}%)
                          </p>
                        );
                      })()}
                  </div>
                </div>
              </div>

              {isRobinhoodMsft && robinhoodMsftQuote && (
                <div className={`border-t ${themeClasses.border} p-5`}>
                  <h4 className={`text-sm font-medium ${themeClasses.textSecondary} mb-3`}>Public Quote</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className={themeClasses.textMuted}>Bid</p>
                      <p className="font-medium">{formatCurrency(robinhoodMsftQuote.bid)}</p>
                    </div>
                    <div>
                      <p className={themeClasses.textMuted}>Ask</p>
                      <p className="font-medium">{formatCurrency(robinhoodMsftQuote.ask)}</p>
                    </div>
                    <div>
                      <p className={themeClasses.textMuted}>Day High</p>
                      <p className="font-medium">{formatCurrency(robinhoodMsftQuote.dailyHigh)}</p>
                    </div>
                    <div>
                      <p className={themeClasses.textMuted}>Day Low</p>
                      <p className="font-medium">{formatCurrency(robinhoodMsftQuote.dailyLow)}</p>
                    </div>
                  </div>
                  <p className={`mt-3 text-xs ${themeClasses.textMuted}`}>
                    Public read-only quote · Robinhood Chain {robinhoodMsftQuote.chainId}
                    {robinhoodMsftQuote.isTradingHalt ? " · trading halt reported" : ""}
                  </p>
                  <p className={`mt-1 text-xs ${themeClasses.textMuted}`}>
                    Fundamentals and analyst ratings are not sourced from this endpoint.
                  </p>
                </div>
              )}

              {/* Stats */}
              {stockStats && (
                <div className={`border-t ${themeClasses.border} p-5`}>
                  <h4 className={`text-sm font-medium ${themeClasses.textSecondary} mb-3`}>Stats</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className={themeClasses.textMuted}>Open</p>
                      <p className="font-medium">{formatCurrency(stockStats.open)}</p>
                    </div>
                    <div>
                      <p className={themeClasses.textMuted}>High</p>
                      <p className="font-medium">{formatCurrency(stockStats.high)}</p>
                    </div>
                    <div>
                      <p className={themeClasses.textMuted}>Low</p>
                      <p className="font-medium">{formatCurrency(stockStats.low)}</p>
                    </div>
                    <div>
                      <p className={themeClasses.textMuted}>Volume</p>
                      <p className="font-medium">{stockStats.volume}</p>
                    </div>
                    <div>
                      <p className={themeClasses.textMuted}>Market Cap</p>
                      <p className="font-medium">{stockStats.marketCap}</p>
                    </div>
                    <div>
                      <p className={themeClasses.textMuted}>P/E Ratio</p>
                      <p className="font-medium">{stockStats.peRatio}</p>
                    </div>
                    <div>
                      <p className={themeClasses.textMuted}>52W High</p>
                      <p className="font-medium">{formatCurrency(stockStats.high52)}</p>
                    </div>
                    <div>
                      <p className={themeClasses.textMuted}>52W Low</p>
                      <p className="font-medium">{formatCurrency(stockStats.low52)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Analyst Ratings */}
              {stockStats && (
                <div className={`border-t ${themeClasses.border} p-5`}>
                  <h4 className={`text-sm font-medium ${themeClasses.textSecondary} mb-3`}>Analyst Ratings</h4>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden flex">
                      <div className="bg-[#00C805] h-full" style={{ width: `${stockStats.buyPct}%` }} />
                      <div className="bg-gray-500 h-full" style={{ width: `${stockStats.holdPct}%` }} />
                      <div className="bg-[#FF5000] h-full" style={{ width: `${stockStats.sellPct}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={themeClasses.accentText}>{stockStats.buyPct}% Buy</span>
                    <span className={themeClasses.textSecondary}>{stockStats.holdPct}% Hold</span>
                    <span className={themeClasses.negativeText}>{stockStats.sellPct}% Sell</span>
                  </div>
                  <p className={`text-xs ${themeClasses.textMuted} mt-2`}>Based on {stockStats.analystCount} analyst ratings</p>
                </div>
              )}
            </div>

            {/* Watchlist */}
            <div className={`${themeClasses.bgSecondary} rounded-xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold ${themeClasses.text}`}>Watchlist</h3>
                <button
                  onClick={() => setEditingWatchlist(!editingWatchlist)}
                  className={`${themeClasses.accentText} text-sm hover:underline`}
                >
                  {editingWatchlist ? "Done" : "Edit"}
                </button>
              </div>
              <div className="space-y-3">
                {watchlistItems.filter(item => item.inWatchlist).map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between py-2">
                    {editingWatchlist && (
                      <button
                        onClick={() => apiToggleWatchlist(item.symbol)}
                        className="mr-3 w-6 h-6 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/30"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => !editingWatchlist && handleSelectStock({
                        symbol: item.symbol,
                        name: item.name,
                        price: item.price,
                        change: item.change,
                        changePercent: item.changePercent,
                        color: "#6B7280", // Default gray for watchlist items
                      })}
                      className={`flex-1 flex items-center justify-between ${!editingWatchlist ? `${themeClasses.bgHoverSecondary} -mx-2 px-2 py-1 rounded-lg cursor-pointer` : ""}`}
                      disabled={editingWatchlist}
                    >
                      <div className="text-left">
                        <p className={`font-medium ${themeClasses.text}`}>{item.symbol}</p>
                        <p className={`text-xs ${themeClasses.textMuted}`}>{item.name}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <p className={`font-medium ${themeClasses.text}`}>{formatCurrency(item.price)}</p>
                          <p className={`text-xs ${item.change >= 0 ? themeClasses.accentText : themeClasses.negativeText}`}>
                            {item.change >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
                          </p>
                        </div>
                        {!editingWatchlist && <ChevronRight size={16} className={themeClasses.textMuted} />}
                      </div>
                    </button>
                  </div>
                ))}
                {watchlistItems.filter(item => item.inWatchlist).length === 0 && (
                  <p className={`${themeClasses.textMuted} text-sm text-center py-4`}>No items in watchlist</p>
                )}
              </div>
              {/* Watchlist is fully managed via API -- removed items disappear on next poll */}
            </div>

            {/* News */}
            <div className={`${themeClasses.bgSecondary} rounded-xl p-5`}>
              <h3 className={`font-bold mb-4 ${themeClasses.text}`}>News</h3>
              <div className="space-y-4">
                {[...news].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)).map((item) => (
                  <div key={item.id} className={`border-b ${themeClasses.border} pb-4 last:border-0 last:pb-0`}>
                    <p className={`text-sm ${themeClasses.textSecondary} mb-1`}>{item.source} · {item.created_at ? formatRelativeTime(item.created_at) : item.time}</p>
                    <p className={`text-sm font-medium leading-snug ${themeClasses.text}`}>{item.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* About */}
            <div className={`${themeClasses.bgSecondary} rounded-xl p-5`}>
              <h3 className={`font-bold mb-3 ${themeClasses.text}`}>About</h3>
              <p className={`text-sm ${themeClasses.textSecondary} leading-relaxed`}>
                MicroSystems Corp develops and supports software, services, devices, and solutions worldwide.
                The company operates through Enterprise Solutions, Cloud Infrastructure, and Consumer Technology segments.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className={themeClasses.textMuted}>Headquarters</p>
                  <p className={themeClasses.textSecondary}>Redmond, WA</p>
                </div>
                <div>
                  <p className={themeClasses.textMuted}>Employees</p>
                  <p className={themeClasses.textSecondary}>221,000</p>
                </div>
              </div>
            </div>

            {/* People Also Own */}
            <div className={`${themeClasses.bgSecondary} rounded-xl p-5`}>
              <h3 className={`font-bold mb-4 ${themeClasses.text}`}>People Also Own</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {[
                  { symbol: "PEAR", price: 181.50, change: 1.80 },
                  { symbol: "ALPH", price: 142.30, change: -1.01 },
                  { symbol: "CHIP", price: 495.20, change: 3.27 },
                  { symbol: "RVRS", price: 178.25, change: 1.39 },
                ].map((stock) => (
                  <div key={stock.symbol} className={`flex-shrink-0 ${themeClasses.bgTertiary} rounded-lg p-3 min-w-[100px]`}>
                    <p className={`font-medium text-sm ${themeClasses.text}`}>{stock.symbol}</p>
                    <p className={`text-xs ${themeClasses.textSecondary}`}>{formatCurrency(stock.price)}</p>
                    <p className={`text-xs mt-1 ${stock.change >= 0 ? themeClasses.accentText : themeClasses.negativeText}`}>
                      {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Account */}
            <div className={`${themeClasses.bgSecondary} rounded-xl p-5`}>
              <div className="flex items-center gap-3">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {currentUser.name.split(" ").map((n: string) => n[0]).join("")}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium">{currentUser.name}</p>
                  <p className={`text-sm ${themeClasses.textMuted}`}>@{currentUser.username}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 ${themeClasses.bg} border-t ${themeClasses.border} px-6 py-3 z-40`}>
        <div className="flex items-center justify-around">
          {[
            { icon: Home, label: "Home", tab: "home" as const },
            { icon: Search, label: "Search", tab: "search" as const },
            { icon: BarChart3, label: "Investing", tab: "transfers" as const },
            { icon: User, label: "Profile", tab: "profile" as const },
          ].map(({ icon: Icon, label, tab }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center gap-1 ${
                activeTab === tab ? themeClasses.navActive : themeClasses.textMuted
              }`}
            >
              <Icon size={24} />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Order Modal - Two Step Flow */}
      {showOrderModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-end md:items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6 ${theme === "light" ? "border border-gray-200" : ""}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {orderStep === "review" && (
                  <button
                    onClick={() => setOrderStep("quantity")}
                    className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}
                  >
                    <ChevronDown size={24} className="rotate-90" />
                  </button>
                )}
                <h3 className="text-xl font-bold">
                  {orderStep === "quantity"
                    ? `${orderType === "buy" ? "Buy" : "Sell"} ${liveSelectedStock?.symbol || "MCRO"}`
                    : "Review Order"}
                </h3>
              </div>
              <button onClick={() => setShowOrderModal(false)} className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}>
                <X size={24} />
              </button>
            </div>

            {/* Step 1: Quantity & Order Type */}
            {orderStep === "quantity" && (
              <div className="space-y-4">
                {/* Order Type Selector */}
                <div>
                  <label className={`text-sm ${themeClasses.textSecondary} mb-2 block`}>Order Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setOrderTypeSelection("market")}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        orderTypeSelection === "market"
                          ? `bg-[#00C805]/20 border-2 border-[#00C805] ${themeClasses.accentText}`
                          : `${themeClasses.bgTertiary} border-2 border-transparent ${themeClasses.textSecondary} ${themeClasses.bgHoverSecondary}`
                      }`}
                    >
                      Market Order
                    </button>
                    <button
                      onClick={() => setOrderTypeSelection("limit")}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        orderTypeSelection === "limit"
                          ? `bg-[#00C805]/20 border-2 border-[#00C805] ${themeClasses.accentText}`
                          : `${themeClasses.bgTertiary} border-2 border-transparent ${themeClasses.textSecondary} ${themeClasses.bgHoverSecondary}`
                      }`}
                    >
                      Limit Order
                    </button>
                  </div>
                  <p className={`text-xs ${themeClasses.textMuted} mt-2`}>
                    {orderTypeSelection === "market"
                      ? "Execute immediately at current market price"
                      : "Set a target price for your order"}
                  </p>
                </div>

                {/* Limit Price Input (if limit order) */}
                {orderTypeSelection === "limit" && (
                  <div>
                    <label className={`text-sm ${themeClasses.textSecondary}`}>Limit Price</label>
                    <div className="relative mt-2">
                      <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${themeClasses.textSecondary}`}>$</span>
                      <input
                        type="number"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        placeholder={(liveSelectedStock?.price || currentPrice).toFixed(2)}
                        className={`w-full ${themeClasses.bgInput} border ${themeClasses.borderSecondary} rounded-lg pl-8 pr-4 py-3 text-lg font-medium focus:border-[#00C805] focus:outline-none ${themeClasses.text}`}
                        step="0.01"
                      />
                    </div>
                  </div>
                )}

                {/* Shares Input */}
                <div>
                  <label className={`text-sm ${themeClasses.textSecondary}`}>Shares</label>
                  <input
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    className={`w-full ${themeClasses.bgInput} border ${themeClasses.borderSecondary} rounded-lg px-4 py-3 mt-2 text-lg font-medium focus:border-[#00C805] focus:outline-none ${themeClasses.text}`}
                    min="1"
                  />
                </div>

                {/* Preview */}
                <div className={`${themeClasses.bgTertiary} rounded-lg p-4 space-y-2`}>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>
                      {orderTypeSelection === "market" ? "Market Price" : "Limit Price"}
                    </span>
                    <span>
                      {formatCurrency(orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : (liveSelectedStock?.price || currentPrice))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={themeClasses.textSecondary}>Estimated {orderType === "buy" ? "Cost" : "Credit"}</span>
                    <span className="font-medium">
                      {formatCurrency(
                        (orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : (liveSelectedStock?.price || currentPrice)) *
                        parseInt(orderQuantity || "0")
                      )}
                    </span>
                  </div>
                </div>

                {/* Review Button */}
                <button
                  onClick={() => setOrderStep("review")}
                  disabled={!orderQuantity || parseInt(orderQuantity) < 1}
                  className={`w-full py-4 rounded-full font-bold text-lg transition-all ${
                    !orderQuantity || parseInt(orderQuantity) < 1
                      ? `${themeClasses.bgTertiary} ${themeClasses.textMuted} cursor-not-allowed`
                      : `${themeClasses.bgTertiary} ${themeClasses.text} ${themeClasses.bgHoverSecondary}`
                  }`}
                >
                  Review Order
                </button>
              </div>
            )}

            {/* Step 2: Review & Confirm */}
            {orderStep === "review" && (
              <div className="space-y-4">
                {/* Order Summary */}
                <div className={`${themeClasses.bgTertiary} rounded-xl p-4`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#00A4EF] flex items-center justify-center">
                      <span className="text-white font-bold">{(liveSelectedStock?.symbol || "MCRO").charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-bold">{liveSelectedStock?.symbol || "MCRO"}</p>
                      <p className={`text-xs ${themeClasses.textSecondary}`}>{liveSelectedStock?.name || "MicroSystems Corp"}</p>
                    </div>
                  </div>

                  <div className={`space-y-3 pt-3 border-t ${themeClasses.borderSecondary}`}>
                    <div className="flex justify-between text-sm">
                      <span className={themeClasses.textSecondary}>Order Type</span>
                      <span className="capitalize">{orderTypeSelection}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={themeClasses.textSecondary}>Action</span>
                      <span className={orderType === "buy" ? themeClasses.accentText : themeClasses.negativeText}>
                        {orderType === "buy" ? "Buy" : "Sell"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={themeClasses.textSecondary}>Shares</span>
                      <span>{orderQuantity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={themeClasses.textSecondary}>
                        {orderTypeSelection === "market" ? "Market Price" : "Limit Price"}
                      </span>
                      <span>
                        {formatCurrency(orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : (liveSelectedStock?.price || currentPrice))}
                      </span>
                    </div>
                    <div className={`flex justify-between text-sm pt-2 border-t ${themeClasses.borderSecondary}`}>
                      <span className={`${themeClasses.textSecondary} font-medium`}>
                        Estimated {orderType === "buy" ? "Cost" : "Credit"}
                      </span>
                      <span className="font-bold text-lg">
                        {formatCurrency(
                          (orderTypeSelection === "limit" && limitPrice ? parseFloat(limitPrice) : (liveSelectedStock?.price || currentPrice)) *
                          parseInt(orderQuantity || "0")
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Buying Power / Shares Available Notice */}
                <div className={`text-sm ${themeClasses.textSecondary} text-center`}>
                  {orderType === "buy" ? (
                    <>Buying Power: <span className={themeClasses.text}>{formatCurrency(buyingPower)}</span></>
                  ) : (
                    <>Shares Available: <span className={themeClasses.text}>{ownedShares}</span></>
                  )}
                </div>

                {/* Confirm Button */}
                <button
                  onClick={handleConfirmOrder}
                  className={`w-full py-4 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                    orderType === "buy"
                      ? "bg-[#00C805] text-black hover:bg-[#00B504]"
                      : `bg-[#FF5000] text-white hover:bg-[#E04500]`
                  }`}
                >
                  <Check size={20} />
                  Confirm {orderType === "buy" ? "Purchase" : "Sale"}
                </button>

                <p className={`text-xs ${themeClasses.textMuted} text-center`}>
                  By confirming, you agree to execute this {orderTypeSelection} order
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hints removed -- dev info in dev tools bar */}

      {/* Search Modal */}
      {showSearchModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-start justify-center pt-20`}>
          <div className={`${themeClasses.bgModal} w-full max-w-2xl mx-4 rounded-2xl overflow-hidden ${theme === "light" ? "border border-gray-200" : ""}`}>
            <div className={`p-4 border-b ${themeClasses.border}`}>
              <div className="flex items-center gap-3">
                <Search size={20} className={themeClasses.textSecondary} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stocks, ETFs, crypto..."
                  className={`flex-1 bg-transparent ${themeClasses.text} text-lg focus:outline-none`}
                  autoFocus
                />
                <button onClick={() => { setShowSearchModal(false); setSearchQuery(""); }} className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}>
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {searchQuery.length === 0 ? (
                <div>
                  <p className={`${themeClasses.textMuted} text-sm mb-3`}>Popular Searches</p>
                  <div className="space-y-2">
                    {["MCRO", "PEAR", "ALPH", "VOLT", "CHIP"].map(symbol => (
                      <button key={symbol} onClick={() => setSearchQuery(symbol)} className={`w-full text-left p-3 ${themeClasses.bgHoverSecondary} rounded-lg flex items-center gap-3`}>
                        <div className={`w-8 h-8 rounded-full ${themeClasses.bgTertiary} flex items-center justify-center text-sm font-bold`}>{symbol[0]}</div>
                        <span className={themeClasses.text}>{symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Search results with dynamic prices */}
                  {allStocksWithCurrentPrices
                    .filter(s => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(stock => (
                      <button
                        key={stock.symbol}
                        onClick={() => handleSelectStock({
                          symbol: stock.symbol,
                          name: stock.name,
                          price: stock.currentPrice,
                          change: stock.change,
                          changePercent: stock.changePercent,
                          color: stock.color,
                          shares: stock.shares,
                          avgCost: stock.avgCost,
                        })}
                        className={`w-full text-left p-3 ${themeClasses.bgHoverSecondary} rounded-lg flex items-center justify-between`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: stock.color }}>{stock.symbol[0]}</div>
                          <div>
                            <p className={`${themeClasses.text} font-medium`}>{stock.symbol}</p>
                            <p className={`${themeClasses.textMuted} text-sm`}>{stock.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={themeClasses.text}>{formatCurrency(stock.currentPrice)}</p>
                          <ChevronRight size={16} className={themeClasses.textMuted} />
                        </div>
                      </button>
                    ))}
                  {allStocksWithCurrentPrices.filter(s => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <p className={`${themeClasses.textMuted} text-center py-8`}>No results found for "{searchQuery}"</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Panel */}
      {showNotificationsPanel && !showAllNotifications && (
        <div className={`fixed top-16 right-4 w-80 ${themeClasses.bgSecondary} rounded-xl shadow-xl z-50 border ${themeClasses.border}`}>
          <div className={`p-4 border-b ${themeClasses.border} flex items-center justify-between`}>
            <h3 className="font-bold">Notifications</h3>
            <button onClick={() => setShowNotificationsPanel(false)} className={`${themeClasses.textSecondary} ${themeClasses.hoverText}`}>
              <X size={20} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => {
                  // Mark as read
                  setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
                  // Navigate based on type
                  if (notif.type === "price" || notif.type === "alert") {
                    const symbol = notif.desc.match(/([A-Z]{3,4})/)?.[1] || "MCRO";
                    // Use dynamic prices
                    const stock = allStocksWithCurrentPrices.find(s => s.symbol === symbol);
                    if (stock) {
                      handleSelectStock({
                        symbol: stock.symbol,
                        name: stock.name,
                        price: stock.currentPrice,
                        change: stock.change,
                        changePercent: stock.changePercent,
                        color: stock.color,
                        shares: stock.shares,
                        avgCost: stock.avgCost,
                      });
                    }
                    setShowNotificationsPanel(false);
                  } else if (notif.type === "order") {
                    setActiveNavSection("spending");
                    setShowNotificationsPanel(false);
                  } else {
                    showToast("Notification viewed");
                  }
                }}
                className={`w-full text-left p-4 border-b ${themeClasses.border} last:border-0 ${themeClasses.bgHoverSecondary} transition-colors ${notif.unread ? "bg-[#00C805]/5" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {notif.unread && <span className="w-2 h-2 bg-[#00C805] rounded-full mt-2 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${themeClasses.text}`}>{notif.title}</p>
                    <p className={`text-xs ${themeClasses.textSecondary} mt-0.5`}>{notif.desc}</p>
                    <p className={`text-xs ${themeClasses.textMuted} mt-1`}>{notif.time}</p>
                  </div>
                  <ChevronRight size={14} className={themeClasses.textMuted} />
                </div>
              </button>
            ))}
          </div>
          <div className={`p-3 border-t ${themeClasses.border}`}>
            <button
              onClick={() => setShowAllNotifications(true)}
              className={`w-full text-center text-sm ${themeClasses.accentText} hover:underline`}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}

      {/* Expanded Notifications Panel */}
      {showAllNotifications && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full max-w-lg mx-4 rounded-2xl max-h-[80vh] overflow-hidden ${theme === "light" ? "border border-gray-200" : ""}`}>
            <div className={`p-4 border-b ${themeClasses.border} flex items-center justify-between sticky top-0 ${themeClasses.bgModal}`}>
              <h3 className="text-xl font-bold">All Notifications</h3>
              <button onClick={() => { setShowAllNotifications(false); setShowNotificationsPanel(false); }} className={`${themeClasses.textSecondary} ${themeClasses.hoverText}`}>
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => {
                    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
                    if (notif.type === "price" || notif.type === "alert") {
                      const symbol = notif.desc.match(/([A-Z]{3,4})/)?.[1] || "MCRO";
                      // Use dynamic prices
                      const stock = allStocksWithCurrentPrices.find(s => s.symbol === symbol);
                      if (stock) {
                        handleSelectStock({
                          symbol: stock.symbol,
                          name: stock.name,
                          price: stock.currentPrice,
                          change: stock.change,
                          changePercent: stock.changePercent,
                          color: stock.color,
                          shares: stock.shares,
                          avgCost: stock.avgCost,
                        });
                      }
                      setShowAllNotifications(false);
                      setShowNotificationsPanel(false);
                    } else if (notif.type === "order") {
                      setActiveNavSection("spending");
                      setShowAllNotifications(false);
                      setShowNotificationsPanel(false);
                    } else {
                      showToast("Notification viewed");
                    }
                  }}
                  className={`w-full text-left p-4 border-b ${themeClasses.border} last:border-0 ${themeClasses.bgHoverSecondary} transition-colors ${notif.unread ? "bg-[#00C805]/5" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    {notif.unread && <span className="w-2 h-2 bg-[#00C805] rounded-full mt-2 flex-shrink-0" />}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${themeClasses.text}`}>{notif.title}</p>
                      <p className={`text-xs ${themeClasses.textSecondary} mt-0.5`}>{notif.desc}</p>
                      <p className={`text-xs ${themeClasses.textMuted} mt-1`}>{notif.time}</p>
                    </div>
                    <ChevronRight size={14} className={`${themeClasses.textMuted} mt-1`} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-end md:items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {transferStep !== "menu" && (
                  <button onClick={() => { setTransferStep("menu"); setTransferAmount(""); }} className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}>
                    <ChevronDown size={24} className="rotate-90" />
                  </button>
                )}
                <h3 className={`text-xl font-bold ${themeClasses.text}`}>
                  {transferStep === "menu" && "Transfer"}
                  {transferStep === "to-bank" && "Withdraw to Bank"}
                  {transferStep === "from-bank" && "Deposit from Bank"}
                  {transferStep === "stocks" && "Transfer Stocks"}
                </h3>
              </div>
              <button onClick={() => { setShowTransferModal(false); setTransferStep("menu"); setTransferAmount(""); }} className={`${themeClasses.textSecondary} hover:${themeClasses.text}`}>
                <X size={24} />
              </button>
            </div>

            {transferStep === "menu" && (
              <div className="space-y-4">
                <button
                  onClick={() => setTransferStep("to-bank")}
                  className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors flex items-center gap-4`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Building size={20} className="text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${themeClasses.text}`}>Transfer to your bank</p>
                    <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Move money to your linked bank account</p>
                  </div>
                  <ChevronRight size={20} className={themeClasses.textMuted} />
                </button>
                <button
                  onClick={() => setTransferStep("from-bank")}
                  className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors flex items-center gap-4`}
                >
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <DollarSign size={20} className="text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${themeClasses.text}`}>Transfer from your bank</p>
                    <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Add money from your linked bank account</p>
                  </div>
                  <ChevronRight size={20} className={themeClasses.textMuted} />
                </button>
                <button
                  onClick={() => setTransferStep("stocks")}
                  className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors flex items-center gap-4`}
                >
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Briefcase size={20} className="text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${themeClasses.text}`}>Transfer stocks</p>
                    <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Move stocks to or from another brokerage</p>
                  </div>
                  <ChevronRight size={20} className={themeClasses.textMuted} />
                </button>
                <p className={`text-xs ${themeClasses.textMuted} mt-4 text-center`}>Linked account: Chase ****4523</p>
              </div>
            )}

            {transferStep === "to-bank" && (
              <div className="space-y-4">
                <div className={`${themeClasses.bgSecondary} rounded-xl p-4`}>
                  <p className={`text-sm ${themeClasses.textSecondary} mb-2`}>Available to withdraw</p>
                  <p className={`text-2xl font-bold ${themeClasses.text}`}>{formatCurrency(buyingPower * 0.5)}</p>
                </div>
                <div>
                  <label className={`text-sm ${themeClasses.textSecondary}`}>Amount</label>
                  <div className="relative mt-2">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${themeClasses.textSecondary} text-xl`}>$</span>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className={`w-full ${themeClasses.bgInput} ${themeClasses.border} rounded-lg pl-10 pr-4 py-4 text-2xl font-medium focus:border-[#00C805] focus:outline-none ${themeClasses.text}`}
                    />
                  </div>
                </div>
                <p className={`text-xs ${themeClasses.textMuted}`}>Transfer to Chase ****4523 • 1-3 business days</p>
                <button
                  onClick={() => {
                    const amount = parseFloat(transferAmount);
                    if (amount > 0 && amount <= buyingPower * 0.5) {
                      setTransactions(prev => [{ merchant: "Withdraw to Chase ****4523", amount: -amount, date: "Just now", type: "spending" }, ...prev]);
                      showToast(`Withdrew ${formatCurrency(amount)} to your bank`);
                      setShowTransferModal(false);
                      setTransferStep("menu");
                      setTransferAmount("");
                    } else {
                      showToast("Invalid amount");
                    }
                  }}
                  disabled={!transferAmount || parseFloat(transferAmount) <= 0}
                  className={`w-full py-4 rounded-full font-bold ${
                    !transferAmount || parseFloat(transferAmount) <= 0
                      ? `${themeClasses.bgTertiary} ${themeClasses.textMuted} cursor-not-allowed`
                      : "bg-[#00C805] text-black hover:bg-[#00B504]"
                  }`}
                >
                  Withdraw
                </button>
              </div>
            )}

            {transferStep === "from-bank" && (
              <div className="space-y-4">
                <div className={`${themeClasses.bgSecondary} rounded-xl p-4`}>
                  <p className={`text-sm ${themeClasses.textSecondary} mb-2`}>Current buying power</p>
                  <p className={`text-2xl font-bold ${themeClasses.text}`}>{formatCurrency(buyingPower)}</p>
                </div>
                <div>
                  <label className={`text-sm ${themeClasses.textSecondary}`}>Amount to deposit</label>
                  <div className="relative mt-2">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${themeClasses.textSecondary} text-xl`}>$</span>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className={`w-full ${themeClasses.bgInput} ${themeClasses.border} rounded-lg pl-10 pr-4 py-4 text-2xl font-medium focus:border-[#00C805] focus:outline-none ${themeClasses.text}`}
                    />
                  </div>
                </div>
                <p className={`text-xs ${themeClasses.textMuted}`}>From Chase ****4523 • Instant deposit up to $1,000</p>
                <button
                  onClick={() => {
                    const amount = parseFloat(transferAmount);
                    if (amount > 0 && amount <= 10000) {
                      setTransactions(prev => [{ merchant: "Deposit from Chase ****4523", amount: amount, date: "Just now", type: "spending" }, ...prev]);
                      showToast(`Deposited ${formatCurrency(amount)} instantly`);
                      setShowTransferModal(false);
                      setTransferStep("menu");
                      setTransferAmount("");
                    } else {
                      showToast("Invalid amount (max $10,000)");
                    }
                  }}
                  disabled={!transferAmount || parseFloat(transferAmount) <= 0}
                  className={`w-full py-4 rounded-full font-bold ${
                    !transferAmount || parseFloat(transferAmount) <= 0
                      ? `${themeClasses.bgTertiary} ${themeClasses.textMuted} cursor-not-allowed`
                      : "bg-[#00C805] text-black hover:bg-[#00B504]"
                  }`}
                >
                  Deposit
                </button>
              </div>
            )}

            {transferStep === "stocks" && (
              <div className="space-y-4">
                <div className={`${themeClasses.bgSecondary} rounded-xl p-4 text-center`}>
                  <Briefcase size={32} className={`${themeClasses.textMuted} mx-auto mb-3`} />
                  <p className={`font-medium ${themeClasses.text}`}>Transfer stocks from another brokerage</p>
                  <p className={`text-sm ${themeClasses.textSecondary} mt-2`}>Move your investments to MicroHood with an ACATS transfer</p>
                </div>
                <div className="space-y-3">
                  <button className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors`}>
                    <p className={`font-medium ${themeClasses.text}`}>Full account transfer</p>
                    <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Move all assets from another broker</p>
                  </button>
                  <button className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors`}>
                    <p className={`font-medium ${themeClasses.text}`}>Partial transfer</p>
                    <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Move specific stocks</p>
                  </button>
                </div>
                <button
                  onClick={() => {
                    showToast("Stock transfer initiated - check email for next steps");
                    setShowTransferModal(false);
                    setTransferStep("menu");
                  }}
                  className="w-full py-4 bg-[#00C805] text-black rounded-full font-bold hover:bg-[#00B504]"
                >
                  Start Transfer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rewards Modal */}
      {showRewardsModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-end md:items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6 ${theme === "light" ? "border border-gray-200" : ""}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Rewards</h3>
              <button onClick={() => setShowRewardsModal(false)} className={`${themeClasses.textSecondary} ${themeClasses.hoverText}`}>
                <X size={24} />
              </button>
            </div>
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-[#00C805]/20 flex items-center justify-center mx-auto mb-4">
                <Gift size={32} className={themeClasses.accentText} />
              </div>
              <h4 className="text-2xl font-bold mb-2">Earn Free Stocks</h4>
              <p className={`${themeClasses.textSecondary} text-sm mb-6`}>Invite friends to MicroHood and you'll both get a free stock!</p>
              <button
                onClick={() => {
                  const referralCode = `MH${currentUser.username.toUpperCase().slice(0, 4)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
                  const referralUrl = `https://microhood.app/join?ref=${referralCode}`;
                  navigator.clipboard.writeText(referralUrl);
                  showToast("Referral link copied to clipboard!");
                }}
                className="w-full py-3 bg-[#00C805] text-black font-bold rounded-full hover:bg-[#00B504] flex items-center justify-center gap-2"
              >
                <Copy size={18} />
                Invite Friends
              </button>
              <p className={`text-xs ${themeClasses.textMuted} mt-3`}>Your referral link will be copied to clipboard</p>
            </div>
            <div className={`border-t ${themeClasses.border} mt-4 pt-4`}>
              <p className={`text-sm ${themeClasses.textSecondary} mb-2`}>Your referral stats</p>
              <div className="flex justify-between text-sm">
                <span className={themeClasses.textMuted}>Friends invited</span>
                <span className={themeClasses.text}>3</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className={themeClasses.textMuted}>Free stocks earned</span>
                <span className={themeClasses.accentText}>$45.67</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Modal */}
      {showCardModal && !showCardSettingsModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-end md:items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6 ${theme === "light" ? "border border-gray-200" : ""}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">MicroHood Card</h3>
              <button onClick={() => setShowCardModal(false)} className={`${themeClasses.textSecondary} ${themeClasses.hoverText}`}>
                <X size={24} />
              </button>
            </div>
            <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 mb-6 border ${cardFrozen ? "border-blue-500" : "border-gray-700"} relative overflow-hidden`}>
              {cardFrozen && (
                <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                  <div className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                    <Lock size={16} />
                    Card Frozen
                  </div>
                </div>
              )}
              <div className="flex justify-between items-start mb-8">
                <span className={`text-xl font-bold ${themeClasses.accentText}`}>MicroHood</span>
                <CreditCard size={24} className={themeClasses.textMuted} />
              </div>
              <p className="text-gray-400 text-sm mb-1">Card Number</p>
              <p className="text-white font-mono">•••• •••• •••• 4523</p>
              <div className="flex justify-between mt-4">
                <div>
                  <p className="text-gray-400 text-xs">Valid Thru</p>
                  <p className="text-white text-sm">12/27</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">CVV</p>
                  <p className="text-white text-sm">•••</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className={themeClasses.textSecondary}>Available balance</span>
                <span className={themeClasses.text}>{formatCurrency(buyingPower * 0.6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={themeClasses.textSecondary}>Pending transactions</span>
                <span className={themeClasses.text}>$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={themeClasses.textSecondary}>Cashback earned</span>
                <span className={themeClasses.accentText}>$23.45</span>
              </div>
            </div>
            <button
              onClick={() => setShowCardSettingsModal(true)}
              className={`w-full py-3 mt-6 ${themeClasses.bgTertiary} ${themeClasses.text} font-medium rounded-full ${themeClasses.bgHoverSecondary}`}
            >
              Manage Card
            </button>
          </div>
        </div>
      )}

      {/* Card Settings Modal */}
      {showCardSettingsModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-end md:items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6 ${theme === "light" ? "border border-gray-200" : ""}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowCardSettingsModal(false)} className={`${themeClasses.textSecondary} ${themeClasses.hoverText}`}>
                  <ChevronDown size={24} className="rotate-90" />
                </button>
                <h3 className="text-xl font-bold">Card Settings</h3>
              </div>
              <button onClick={() => { setShowCardSettingsModal(false); setShowCardModal(false); }} className={`${themeClasses.textSecondary} ${themeClasses.hoverText}`}>
                <X size={24} />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setCardFrozen(!cardFrozen);
                  showToast(cardFrozen ? "Card unfrozen" : "Card frozen temporarily");
                }}
                className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors flex items-center gap-4`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cardFrozen ? "bg-green-500/20" : "bg-blue-500/20"}`}>
                  {cardFrozen ? <Unlock size={20} className="text-green-400" /> : <Lock size={20} className="text-blue-400" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{cardFrozen ? "Unfreeze Card" : "Freeze Card"}</p>
                  <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>
                    {cardFrozen ? "Enable card for transactions" : "Temporarily disable all transactions"}
                  </p>
                </div>
              </button>
              <button
                onClick={() => showToast("PIN change request sent to your email")}
                className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors flex items-center gap-4`}
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Key size={20} className="text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Change PIN</p>
                  <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Update your card PIN</p>
                </div>
              </button>
              <button
                onClick={() => showToast("Report submitted - new card will arrive in 5-7 days")}
                className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors flex items-center gap-4`}
              >
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Report Lost or Stolen</p>
                  <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Deactivate and request replacement</p>
                </div>
              </button>
              <button
                onClick={() => showToast("Statements available in your email")}
                className={`w-full p-4 ${themeClasses.bgSecondary} rounded-xl text-left ${themeClasses.bgHoverSecondary} transition-colors flex items-center gap-4`}
              >
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <FileText size={20} className={themeClasses.textSecondary} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">View Statements</p>
                  <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>Download monthly statements</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IRA Contribution Modal */}
      {showIRAModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-end md:items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full md:w-96 md:rounded-2xl rounded-t-2xl p-6 ${theme === "light" ? "border border-gray-200" : ""}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Contribute to IRA</h3>
              <button onClick={() => { setShowIRAModal(false); setIraContribution(""); }} className={`${themeClasses.textSecondary} ${themeClasses.hoverText}`}>
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div className={`${themeClasses.bgSecondary} rounded-xl p-4`}>
                <div className="flex justify-between text-sm mb-2">
                  <span className={themeClasses.textSecondary}>Current IRA Balance</span>
                  <span className={`${themeClasses.text} font-medium`}>{formatCurrency(iraBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={themeClasses.textSecondary}>2024 Contribution Limit</span>
                  <span className={`${themeClasses.text} font-medium`}>$7,000</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className={themeClasses.textSecondary}>Remaining this year</span>
                  <span className={`${themeClasses.accentText} font-medium`}>{formatCurrency(Math.max(0, 7000 - iraBalance * 0.3))}</span>
                </div>
              </div>
              <div>
                <label className={`text-sm ${themeClasses.textSecondary}`}>Contribution Amount</label>
                <div className="relative mt-2">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${themeClasses.textSecondary} text-xl`}>$</span>
                  <input
                    type="number"
                    value={iraContribution}
                    onChange={(e) => setIraContribution(e.target.value)}
                    placeholder="0.00"
                    className={`w-full ${themeClasses.bgInput} border ${themeClasses.borderSecondary} rounded-lg pl-10 pr-4 py-4 text-2xl font-medium focus:border-[#00C805] focus:outline-none ${themeClasses.text}`}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {[100, 500, 1000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setIraContribution(amount.toString())}
                    className={`flex-1 py-2 ${themeClasses.bgTertiary} rounded-lg text-sm ${themeClasses.bgHoverSecondary} transition-colors`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <p className={`text-xs ${themeClasses.textMuted}`}>Contributions from your buying power. Tax-deductible up to annual limit.</p>
              <button
                onClick={() => {
                  const amount = parseFloat(iraContribution);
                  if (amount > 0 && amount <= buyingPower) {
                    setIraBalance(prev => prev + amount);
                    setTransactions(prev => [{ merchant: "IRA Contribution", amount: -amount, date: "Just now", type: "order" }, ...prev]);
                    showToast(`Contributed ${formatCurrency(amount)} to your IRA`);
                    setShowIRAModal(false);
                    setIraContribution("");
                  } else if (amount > buyingPower) {
                    showToast("Insufficient buying power");
                  } else {
                    showToast("Enter a valid amount");
                  }
                }}
                disabled={!iraContribution || parseFloat(iraContribution) <= 0}
                className={`w-full py-4 rounded-full font-bold ${
                  !iraContribution || parseFloat(iraContribution) <= 0
                    ? `${themeClasses.bgTertiary} ${themeClasses.textMuted} cursor-not-allowed`
                    : "bg-[#00C805] text-black hover:bg-[#00B504]"
                }`}
              >
                Contribute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className={`fixed inset-0 ${themeClasses.bgOverlay} z-50 flex items-center justify-center`}>
          <div className={`${themeClasses.bgModal} w-full max-w-md rounded-2xl p-6 mx-4 shadow-2xl ${theme === "light" ? "border border-gray-200" : ""}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${themeClasses.text}`}>Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className={`${themeClasses.textSecondary} ${themeClasses.hoverText}`}>
                <X size={24} />
              </button>
            </div>

            {/* Settings Options */}
            <div className="space-y-4">
              {/* Theme Toggle */}
              <div className={`flex items-center justify-between p-4 ${themeClasses.bgSecondary} rounded-xl`}>
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon size={20} className={themeClasses.accentText} />
                  ) : (
                    <Sun size={20} className={themeClasses.accentText} />
                  )}
                  <div>
                    <p className={`font-medium ${themeClasses.text}`}>Appearance</p>
                    <p className={`text-sm ${themeClasses.textMuted}`}>
                      {theme === "dark" ? "Dark mode" : "Light mode"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  type="button"
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  aria-pressed={theme === "light"}
                  title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    theme === "light" ? "bg-[#00C805]" : themeClasses.bgTertiary
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      theme === "light" ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Notifications Setting */}
              <div className={`flex items-center justify-between p-4 ${themeClasses.bgSecondary} rounded-xl`}>
                <div className="flex items-center gap-3">
                  <Bell size={20} className={themeClasses.textSecondary} />
                  <div>
                    <p className={`font-medium ${themeClasses.text}`}>Notifications</p>
                    <p className={`text-sm ${themeClasses.textMuted}`}>Push and email alerts</p>
                  </div>
                </div>
                <button
                  onClick={() => showToast("Notification settings updated")}
                  className={`px-3 py-1.5 ${themeClasses.bgTertiary} rounded-lg text-sm font-medium ${themeClasses.textSecondary} ${themeClasses.hoverText}`}
                >
                  Manage
                </button>
              </div>

              {/* Privacy Setting */}
              <div className={`flex items-center justify-between p-4 ${themeClasses.bgSecondary} rounded-xl`}>
                <div className="flex items-center gap-3">
                  <Lock size={20} className={themeClasses.textSecondary} />
                  <div>
                    <p className={`font-medium ${themeClasses.text}`}>Privacy & Security</p>
                    <p className={`text-sm ${themeClasses.textMuted}`}>Two-factor authentication</p>
                  </div>
                </div>
                <ChevronRight size={20} className={themeClasses.textMuted} />
              </div>

              {/* Help Setting */}
              <div className={`flex items-center justify-between p-4 ${themeClasses.bgSecondary} rounded-xl`}>
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className={themeClasses.textSecondary} />
                  <div>
                    <p className={`font-medium ${themeClasses.text}`}>Help & Support</p>
                    <p className={`text-sm ${themeClasses.textMuted}`}>FAQs and contact us</p>
                  </div>
                </div>
                <ChevronRight size={20} className={themeClasses.textMuted} />
              </div>
            </div>

            {/* Footer */}
            <div className={`mt-6 pt-4 border-t ${themeClasses.border}`}>
              <p className={`text-center text-sm ${themeClasses.textMuted}`}>MicroHood v2.4.0</p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 ${themeClasses.bgTertiary} ${themeClasses.text} px-6 py-3 rounded-full shadow-lg z-50 animate-pulse`}>
          {toast}
        </div>
      )}
    </div>
  );
};

export default MicroHood;
