import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiSelfUser } from "../types/selfUser";

export interface ApiStock {
  symbol: string;
  name: string;
  color: string;
  orgId: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  shares: number;
  avgCost: number;
}

export interface ApiWatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  inWatchlist: boolean;
}

export interface ApiNews {
  id: string;
  source: string;
  title: string;
  time: string;
  created_at?: number;
}

export interface ApiPortfolio {
  buying_power: number;
  positions_value: number;
  portfolio_value: number;
  total_gain: number;
  total_gain_percent: number;
}

export interface ApiTaskConfig {
  environment: string;
  event_timeline_end: number;
  selfUser?: ApiSelfUser;
}

export interface RobinhoodAsset {
  tokenSymbol: string;
  tokenName: string;
  logoUrl?: string;
  status?: string;
  deployments: Array<{
    contractAddress: string;
    chainId: number;
    networkName?: string;
  }>;
}

export interface RobinhoodMsftQuote {
  symbol: "MSFT";
  currentPrice: number;
  bid: number;
  ask: number;
  dailyHigh: number;
  dailyLow: number;
  generatedAt: string;
  contractAddress: string;
  chainId: number;
  isTradingHalt: boolean;
}

export function useMicrohoodData() {
  const [stocks, setStocks] = useState<ApiStock[]>([]);
  const [watchlist, setWatchlist] = useState<ApiWatchlistItem[]>([]);
  const [news, setNews] = useState<ApiNews[]>([]);
  const [portfolio, setPortfolio] = useState<ApiPortfolio | null>(null);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [robinhoodAssets, setRobinhoodAssets] = useState<RobinhoodAsset[]>([]);
  const [robinhoodMsftQuote, setRobinhoodMsftQuote] = useState<RobinhoodMsftQuote | null>(null);
  const [robinhoodMsftPriceHistory, setRobinhoodMsftPriceHistory] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configLoaded = useRef(false);
  const sessionInitAttempted = useRef(false);
  const mismatch = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRobinhoodAssets = useCallback(async () => {
    try {
      const response = await fetch("/api/chain/robinhood/assets", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { assets?: RobinhoodAsset[] };
      if (Array.isArray(payload.assets)) setRobinhoodAssets(payload.assets);
    } catch {
      // The benchmark remains usable if the public registry is temporarily unavailable.
    }
  }, []);

  const fetchRobinhoodMsftQuote = useCallback(async () => {
    try {
      const response = await fetch("/api/chain/robinhood/prices/MSFT", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as {
        quotes?: Array<{
          tokenSymbol?: string;
          deployments?: Array<{ contractAddress?: string; chainId?: number; networkName?: string }>;
          bid?: string;
          ask?: string;
          dailyHigh?: string;
          dailyLow?: string;
          generatedAt?: string;
          isTradingHalt?: boolean;
        }>;
      };
      const quote = payload.quotes?.find((item) => item.tokenSymbol?.toUpperCase() === "MSFT");
      if (!quote) return;

      const bid = Number(quote.bid);
      const ask = Number(quote.ask);
      const currentPrice = Number(((bid + ask) / 2).toFixed(2));
      if (![bid, ask, currentPrice].every(Number.isFinite) || bid <= 0 || ask <= 0) return;

      const deployment = quote.deployments?.find((item) => item.chainId === 4663);
      const dailyHigh = Number(quote.dailyHigh);
      const dailyLow = Number(quote.dailyLow);
      const nextQuote: RobinhoodMsftQuote = {
        symbol: "MSFT",
        currentPrice,
        bid,
        ask,
        dailyHigh: Number.isFinite(dailyHigh) && dailyHigh > 0 ? dailyHigh : currentPrice,
        dailyLow: Number.isFinite(dailyLow) && dailyLow > 0 ? dailyLow : currentPrice,
        generatedAt: quote.generatedAt ?? "",
        contractAddress: deployment?.contractAddress ?? "0xe93237C50D904957Cf27E7B1133b510C669c2e74",
        chainId: deployment?.chainId ?? 4663,
        isTradingHalt: quote.isTradingHalt ?? false,
      };
      setRobinhoodMsftQuote(nextQuote);
      setRobinhoodMsftPriceHistory((previous) => {
        if (previous[previous.length - 1] === currentPrice) return previous;
        return [...previous, currentPrice].slice(-80);
      });
    } catch {
      // The selected MSFT card keeps its last confirmed quote on transient errors.
    }
  }, []);

  useEffect(() => {
    void fetchRobinhoodAssets();
    const registryPoll = setInterval(fetchRobinhoodAssets, 60_000);
    return () => clearInterval(registryPoll);
  }, [fetchRobinhoodAssets]);

  useEffect(() => {
    void fetchRobinhoodMsftQuote();
    const quotePoll = setInterval(fetchRobinhoodMsftQuote, 15_000);
    return () => clearInterval(quotePoll);
  }, [fetchRobinhoodMsftQuote]);

  const fetchData = useCallback(() => {
    if (mismatch.current) return;

    // Retry config until loaded
    if (!configLoaded.current) {
      fetch("/api/data/config")
        .then(async (r) => {
          if (r.status === 409 && !sessionInitAttempted.current) {
            sessionInitAttempted.current = true;
            const initRes = await fetch("/api/dev_init?environment=microhood", {
              method: "POST",
            });
            if (!initRes.ok) {
              throw new Error(`MicroHood init failed: ${initRes.status}`);
            }
            return fetch("/api/data/config");
          }
          return r;
        })
        .then((r) => {
          if (!r.ok) throw new Error(`Config fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data: ApiTaskConfig) => {
          if (data.environment !== "microhood") {
            mismatch.current = true;
            setError(
              `Environment mismatch: server is running "${data.environment}" but this is the MicroHood UI.`
            );
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch((e) => {
          setError(String(e));
          setIsLoading(false);
        });

      // Data endpoints require a session. Let the next poll run after the
      // config/init request above has established one.
      return;
    }

    // Poll stocks, portfolio, watchlist, news in parallel
    Promise.all([
      fetch("/api/data/microhood-stocks"),
      fetch("/api/data/microhood-portfolio"),
      fetch("/api/data/microhood-watchlist"),
      fetch("/api/data/microhood-news"),
    ])
      .then(async ([stocksRes, portfolioRes, watchlistRes, newsRes]) => {
        if (!stocksRes.ok) throw new Error(`Stocks fetch failed: ${stocksRes.status}`);
        if (!portfolioRes.ok) throw new Error(`Portfolio fetch failed: ${portfolioRes.status}`);
        if (!watchlistRes.ok) throw new Error(`Watchlist fetch failed: ${watchlistRes.status}`);
        if (!newsRes.ok) throw new Error(`News fetch failed: ${newsRes.status}`);

        const [stocksData, portfolioData, watchlistData, newsData] = await Promise.all([
          stocksRes.json(),
          portfolioRes.json(),
          watchlistRes.json(),
          newsRes.json(),
        ]);

        setStocks(stocksData.stocks ?? []);
        setPortfolio(portfolioData as ApiPortfolio);
        setWatchlist(watchlistData.watchlist ?? []);
        setNews(newsData.news ?? []);
        setError(null);
        setIsLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  // Mutation helpers
  const placeOrder = useCallback(
    async (
      symbol: string,
      action: "buy" | "sell",
      quantity: number,
      type: "market" | "limit" = "market",
      limitPrice?: number
    ): Promise<{ success: boolean; error?: string }> => {
      const res = await fetch(`/api/data/microhood-stocks/${symbol}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          quantity,
          type,
          limit_price: limitPrice ?? null,
        }),
      }).catch(() => null);
      if (!res) return { success: false, error: "Network error" };
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.detail || "Order failed" };
      }
      return res.json();
    },
    []
  );

  const toggleWatchlist = useCallback(async (symbol: string) => {
    await fetch(`/api/data/microhood-watchlist/${symbol}/toggle`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  return {
    stocks,
    watchlist,
    news,
    portfolio,
    config,
    robinhoodAssets,
    robinhoodMsftQuote,
    robinhoodMsftPriceHistory,
    isLoading,
    error,
    placeOrder,
    toggleWatchlist,
  };
}
