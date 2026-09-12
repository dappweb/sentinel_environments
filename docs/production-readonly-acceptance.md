# Public read-only release

The production image enables VITE_PUBLIC_READONLY. It does not initialize benchmark sessions or fetch simulated portfolio, user, news, or watchlist data. Public Nginx exposes only GET/HEAD under /api/chain/robinhood/; benchmark administration and mutations return 403. The API has no published host port.

MSFT quotes require the expected chain/address, positive non-crossed bid/ask, and a source timestamp within two minutes (maximum future skew one minute). Failed refreshes visibly label the retained sample. Charts show only observations during the current visit, with no fabricated historical timeframes.

## Login activation gate

Production inspection on 2026-09-12 found that Privy app cmo5mxvrh01df0el8hmspsmyf permits metakina domains but not microhood.ai. Login is disabled by default until its owner adds https://microhood.ai and https://www.microhood.ai to the Privy allowed origins and configures relevant OAuth redirects. Then set VITE_PRIVY_ENABLED=true, rebuild frontend, and verify login, logout and session restoration with a test account. No authenticated portfolio backend is implemented by this release.

## Release and recovery

Record the commit and previous frontend image before deployment. Keep the previous image with a rollback tag. Deploy only the frontend service; do not restart unrelated workloads or change tunnel configuration. Verify /healthz, /api/chain/robinhood/config, /microhood and a denied /api/status request after deployment.

The public release stores no customer trading or portfolio data. Server-side account data, payments, subscriptions and transaction execution remain unimplemented. External alert delivery and off-host backup/restore drills remain operations follow-up; container health checks alone are not an alerting service.
