# c0r7x · perps terminal

Single-file perpetual-futures data terminal. Aggregates live feeds from
Binance, Bybit, OKX, Bitget, Gate, KuCoin, Coinbase International, Hyperliquid,
and Aster into one dense, keyboard-friendly view.

## Stack

- Static HTML, no build step
- Tailwind (CDN) for layout
- ECharts 5.5 + TradingView lightweight-charts for visualisation
- Multi-venue REST + WebSocket, with circuit breakers and per-feed health

## Layout

```
index.html     Entire app (HTML + CSS + JS in one file)
_headers       Netlify security + cache headers
_redirects     Netlify SPA fallback
robots.txt     Search engine directives
sitemap.xml    Single-URL sitemap
```

## Run locally

Any static server works:

```
python3 -m http.server 8080
# then open http://localhost:8080
```

## Deploy

Drop this folder on Netlify (or equivalent). `_headers` and `_redirects`
are picked up automatically. Point the domain's apex A record and `www`
CNAME at the host per their docs.
