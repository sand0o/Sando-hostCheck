# sando.host

VIBE CODING!!!

A minimal, zero-backend network console that runs entirely in the browser. Real Mbps speed test, geo-cross-check across 7 providers, WebRTC leak detection, DNS-over-HTTPS, pseudo-ping, http inspection — all from three static files.

**Live demo:** https://sando-host-ztamhtxp.devinapps.com

![sando.host preview](https://sando-host-ztamhtxp.devinapps.com)

## What it does

Seven inspection modes, switched via the top tab strip. Every measurement is performed client-side with browser-permitted APIs — no proxy server, no logs.

| # | Mode | What it does |
|---|------|--------------|
| 01 | **speed** | Real download / upload Mbps + latency. Two providers: `m-lab` (NDT7 over WebSocket) or `cloudflare` (HTTP streams against `speed.cloudflare.com`). External shortcuts to yandex.ru/internet and speedtest.net are also surfaced. Full SVG speedometer with live tick updates. |
| 02 | **ip info** | Resolves the host through Google DNS-over-HTTPS, then enriches the IP via `ipapi.co` — country, region, city, ISP, ASN, timezone. |
| 03 | **dns** | Six parallel DoH lookups against `dns.google/resolve` — A, AAAA, MX, TXT, NS, CNAME. |
| 04 | **http** | `fetch()` against the URL with `performance.now()` timing. Falls back to `mode: "no-cors"` when CORS blocks header access. |
| 05 | **ping** | 5 short HTTPS probes with min / avg / max / jitter / loss. Pseudo-ping (not ICMP — browsers can't open raw sockets), explicitly labelled as such. |
| 06 | **anonymity** | Three independent leak signals: HTTP-visible IP (ipapi), WebRTC IP via Google STUN (catches classic VPN leaks), browser-vs-IP timezone/locale sanity check. Composite verdict: clean / webrtc-leak / vpn-suspected. |
| 07 | **region** | Cross-check of your public IP against 7 geo providers in parallel: `ipapi.co`, `ipwho.is`, `country.is`, `geojs.io`, `1.1.1.1/cdn-cgi/trace`, `ipinfo.io`, `ipapi.is`. Verdict: `CONSISTENT` / `MISMATCH`. Surfaces datacenter/proxy/VPN flags. |

## Features

- **No backend, no build step** — three files: `index.html`, `styles.css`, `app.js`. Open in a browser, done.
- **i18n** with English + Russian. Toggle persists via `localStorage` (`sando.lang`).
- **History** — last 5 target-mode queries shown as clickable chips below the input. Persists via `localStorage` (`sando.history.v1`).
- **Copy-results** button on the result window — exports the entire output as a markdown table.
- **Responsive** — works on desktop, tablet, and 320px-wide phones. Tabs scroll horizontally on narrow viewports.
- **Cross-browser** — tested in Chrome, Firefox, Edge, and mobile Chrome.

## Run locally

```bash
git clone https://github.com/<your-username>/sando-host.git
cd sando-host
python3 -m http.server 8765
# open http://127.0.0.1:8765
```

Or just open `index.html` directly — all third-party APIs are CORS-friendly so it works from `file://` too.

## Browser limits — what is *not* possible without a server

These features were intentionally omitted because the browser sandbox forbids them:

- ICMP ping (use `traceroute` from a shell instead)
- TCP / UDP raw sockets / port scans
- DNS leak test (requires control of the resolver, not just a query path)
- WHOIS / RDAP with full record fields (most registries lack CORS)
- Scraping non-CORS sites (Netflix, YouTube region detection, etc.)

If you need those, see the [original `ipregion.sh`](https://github.com/vernette/ipregion) script which inspired the `07 region` mode.

## Tech notes

- `dns.google/resolve` (DoH JSON API) — used for both the dns mode and pre-resolving hosts before geo lookups.
- `speed.cloudflare.com/__down` and `__up` — used by the cloudflare provider with `Response.body.getReader()` for true streaming Mbps.
- `locate.measurementlab.net/v2/nearest/ndt/ndt7` — locator for the m-lab provider; speaks NDT7 (WebSocket subprotocol `net.measurementlab.ndt.v7`) for download and upload.
- `RTCPeerConnection` with Google's public STUN server (`stun:stun.l.google.com:19302`) — used in anonymity mode to surface server-reflexive (public) and host (local) IP candidates.
- `Intl.DateTimeFormat().resolvedOptions().timeZone` + `navigator.language` — sanity-checked against IP geolocation to detect VPN use.

## License

MIT — see [LICENSE](./LICENSE).
