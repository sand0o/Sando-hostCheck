/* sando.host — front-end inspector
   No images. Real APIs where browsers allow:
   - IP info   : ipapi.co (after DoH resolve)
   - DNS       : Google DNS-over-HTTPS (dns.google/resolve)
   - HTTP      : fetch() + Performance timing
   - Ping      : repeated tiny fetches (pseudo-ping; not ICMP)
   - Anonymity : WebRTC STUN candidates + timezone/language sanity checks
   - Speed     : speed.cloudflare.com or m-lab NDT7 (WebSocket)
   - Region    : 7 geo-providers in parallel, consensus check
*/

(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    hostInput: $("hostInput"),
    inputLine: document.querySelector(".input-line"),
    runBtn: $("runBtn"),
    modes: document.querySelectorAll(".mode"),
    hostHint: $("hostHint"),
    providerRow: $("providerRow"),
    providers: document.querySelectorAll(".provider[data-provider]"),
    resultTitle: $("resultTitle"),
    resultStatus: $("resultStatus"),
    resultBody: $("resultBody"),
    ipValue: $("ipValue"),
    year: $("year"),
    langs: document.querySelectorAll(".lang"),
    historyRow: $("historyRow"),
    historyChips: $("historyChips"),
    historyClear: $("historyClear"),
    copyBtn: $("copyBtn"),
  };

  // speed is the new default — moved to position 01
  let activeAction = "speed";
  // m-lab is default — works better on RU IPs and through varied geos
  let activeProvider = "mlab";
  let lang = "en";

  // modes that don't need a hostname/ip target
  const NO_TARGET = new Set(["anon", "speed", "region"]);

  /* ============= i18n ============= */
  const STRINGS = {
    en: {
      yourIp: "your ip",
      ledeMain: "a single console for diagnostics — geolocation, dns, http, latency.",
      ledeFade: "no clutter, no images, just signal.",
      modeSpeed: "speed",
      modeInfo: "ip info",
      modeDns: "dns",
      modeHttp: "http",
      modePing: "ping",
      modeAnon: "anonymity",
      modeRegion: "region",
      run: "run",
      via: "via",
      recent: "recent",
      clear: "clear",
      copy: "copy",
      copied: "copied",
      copyFail: "copy failed",
      placeholder: "waiting for input — pick a mode and type a host above.",
      madeBy: "made by sando",
      placeholderInput: "hostname or ip address",
      placeholderNoTarget: "no target needed for this mode",
      hintInfo:   "enter a hostname or ip — geolocation + isp + asn.",
      hintDns:    "enter a hostname — a / aaaa / mx / txt / ns / cname records.",
      hintHttp:   "enter a hostname or url — status code, redirects, response time.",
      hintPing:   "enter a hostname or url — five pseudo-ping probes (https, not icmp).",
      hintAnon:   "no target needed — checks for vpn / webrtc / locale leaks.",
      hintSpeed:  "no target needed — measures latency, download and upload speed.",
      hintRegion: "no target needed — your ip across 7 geolocation providers, side-by-side.",
      statusIdle: "idle",
      statusRunning: "running…",
      statusOk: "ok",
      statusErr: "error",
      statusWarn: "warn",
      statusNoInput: "no input",
      statusDone: "done",
      statusNoLeak: "no leak",
      statusLeak: "leak",
      statusUncertain: "uncertain",
      statusConsistent: "consistent",
      statusMismatch: "mismatch",
      statusNoData: "no data",
      statusUnreachable: "unreachable",
      statusNoNetwork: "no network",
      statusNoServer: "no server",
      statusWsBlocked: "ws blocked",
      statusNoUrls: "no urls",
      statusNoRecords: "no records",
      statusHttp: "http",
      // misc result-side
      enterHostFirst: "enter a hostname or ip address first.",
      ipapiError: "ipapi returned an error.",
      lookupFailed: "lookup failed",
      couldNotResolve: (h) => `could not resolve ${h} to an ip address.`,
      noAaaaRecord: "no a / aaaa record",
      // speed
      server: "server",
      latency: "latency",
      download: "download",
      upload: "upload",
      location: "location",
      measuring: "measuring…",
      starting: "starting…",
      locating: "locating nearest m-lab node …",
      cantReachSpeed: "could not reach speed.cloudflare.com.",
      cantReachLocator: (e) => `could not reach m-lab locator: ${e}`,
      noServers: "no servers returned",
      noDownloadUrl: "m-lab locator returned no download url.",
      wsFailed: "websocket connection to m-lab failed (provider may block ws).",
      mlabNote: "note: m-lab is open-source NDT7. servers run by research/edu networks.",
      handshakeRtt: "handshake-rtt",
      // ping
      pingNote: "note: this is a browser-side pseudo-ping using https fetches, not icmp.",
      probe: (i) => `probe ${i}`,
      lost: "lost",
      // anon
      verdictGood: "no obvious leaks — browser, webrtc and ipapi agree.",
      verdictWebRTC: "webrtc ip differs from public ip — likely vpn leak via webrtc.",
      verdictTz: "timezone mismatch — looks like a vpn (browser tz ≠ ip tz).",
      verdictNoStun: "webrtc returned no public ip — vpn or strict firewall, hard to say.",
      verdictInconclusive: "inconclusive — not enough signal to decide.",
      anonDnsNote: "note: dns leak detection requires a backend — not done here.",
      hiddenBlocked: "hidden / blocked",
      mdnsHidden: "hidden via mdns (good for privacy)",
      // region
      regionScanning: (n) => `querying ${n} ip-geo providers in parallel …`,
      regionAllAgree: (n, c) => `all ${n} providers agree on ${c}`,
      regionDisagree: (frags) => `disagreement — ${frags}  (cdn / anycast / vpn signal)`,
      regionNoResp: "no providers responded",
      regionMultiIp: (ips) => `${ips} — multiple ips (possible v4/v6 mix)`,
      regionNote: "note: cdn anycast (cloudflare colo) often differs from ip registration country.",
    },
    ru: {
      yourIp: "ваш ip",
      ledeMain: "одна консоль для диагностики — геолокация, dns, http, задержка.",
      ledeFade: "ничего лишнего, без картинок, только сигнал.",
      modeSpeed: "скорость",
      modeInfo: "ip",
      modeDns: "dns",
      modeHttp: "http",
      modePing: "пинг",
      modeAnon: "анонимность",
      modeRegion: "регион",
      run: "запустить",
      via: "через",
      recent: "недавние",
      clear: "очистить",
      copy: "копировать",
      copied: "скопировано",
      copyFail: "не скопировалось",
      placeholder: "ожидание ввода — выберите режим и введите хост выше.",
      madeBy: "создано sando",
      placeholderInput: "hostname или ip-адрес",
      placeholderNoTarget: "для этого режима ввод не нужен",
      hintInfo:   "введи хост или ip — геолокация + провайдер + asn.",
      hintDns:    "введи хост — a / aaaa / mx / txt / ns / cname записи.",
      hintHttp:   "введи хост или url — статус-код, редиректы, время ответа.",
      hintPing:   "введи хост или url — пять псевдо-пинг проб (https, не icmp).",
      hintAnon:   "ввод не нужен — проверка на vpn / webrtc / локаль.",
      hintSpeed:  "ввод не нужен — задержка, скорость скачивания и отдачи.",
      hintRegion: "ввод не нужен — твой ip у 7 гео-провайдеров рядом друг с другом.",
      statusIdle: "ожидание",
      statusRunning: "выполняется…",
      statusOk: "ок",
      statusErr: "ошибка",
      statusWarn: "внимание",
      statusNoInput: "пусто",
      statusDone: "готово",
      statusNoLeak: "без утечек",
      statusLeak: "утечка",
      statusUncertain: "неясно",
      statusConsistent: "сходится",
      statusMismatch: "расхождение",
      statusNoData: "нет данных",
      statusUnreachable: "недоступно",
      statusNoNetwork: "нет сети",
      statusNoServer: "нет сервера",
      statusWsBlocked: "ws заблокирован",
      statusNoUrls: "нет url",
      statusNoRecords: "записей нет",
      statusHttp: "http",
      enterHostFirst: "сначала введи хост или ip-адрес.",
      ipapiError: "ipapi вернул ошибку.",
      lookupFailed: "запрос не удался",
      couldNotResolve: (h) => `не удалось зарезолвить ${h} в ip-адрес.`,
      noAaaaRecord: "нет a / aaaa записей",
      server: "сервер",
      latency: "задержка",
      download: "скачивание",
      upload: "отдача",
      location: "местоположение",
      measuring: "измеряю…",
      starting: "стартую…",
      locating: "ищу ближайший m-lab узел …",
      cantReachSpeed: "speed.cloudflare.com недоступен.",
      cantReachLocator: (e) => `m-lab locator недоступен: ${e}`,
      noServers: "серверов не получено",
      noDownloadUrl: "m-lab locator не вернул url скачивания.",
      wsFailed: "websocket к m-lab не подключился (возможно провайдер режет ws).",
      mlabNote: "заметка: m-lab — это open-source NDT7. серверы хостят университеты и сети провайдеров.",
      handshakeRtt: "rtt-рукопожатие",
      pingNote: "заметка: это псевдо-пинг через https-фетчи в браузере, не icmp.",
      probe: (i) => `проба ${i}`,
      lost: "потеряна",
      verdictGood: "явных утечек нет — браузер, webrtc и ipapi согласны.",
      verdictWebRTC: "webrtc-ip отличается от публичного — похоже на утечку vpn через webrtc.",
      verdictTz: "несовпадение часовых поясов — похоже на vpn (tz браузера ≠ tz ip).",
      verdictNoStun: "webrtc не отдал публичный ip — vpn или жёсткий firewall, точно не сказать.",
      verdictInconclusive: "неоднозначно — недостаточно сигнала для вывода.",
      anonDnsNote: "заметка: проверка dns-утечек требует бэкенда — здесь её нет.",
      hiddenBlocked: "скрыт / заблокирован",
      mdnsHidden: "скрыт через mdns (хорошо для приватности)",
      regionScanning: (n) => `параллельный запрос к ${n} ip-гео провайдерам …`,
      regionAllAgree: (n, c) => `все ${n} провайдеров согласны: ${c}`,
      regionDisagree: (frags) => `расхождение — ${frags}  (cdn / anycast / vpn-сигнал)`,
      regionNoResp: "ни один провайдер не ответил",
      regionMultiIp: (ips) => `${ips} — несколько ip (возможна смесь v4/v6)`,
      regionNote: "заметка: cdn anycast (cloudflare colo) часто отличается от страны регистрации ip.",
    },
  };

  function t(key, ...args) {
    const v = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
    return typeof v === "function" ? v(...args) : v;
  }

  function applyI18n() {
    document.documentElement.setAttribute("lang", lang);
    // generic data-i18n elements
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const val = t(key);
      if (typeof val === "string") el.textContent = val;
    });
    // input placeholder
    if (els.hostInput) {
      els.hostInput.placeholder = NO_TARGET.has(activeAction)
        ? t("placeholderNoTarget")
        : t("placeholderInput");
    }
    // current hint
    if (els.hostHint) els.hostHint.textContent = currentHint();
    // status pill — update only the idle label, others handle on change
    if (els.resultStatus.classList.length === 1 /* only base class */) {
      els.resultStatus.textContent = t("statusIdle");
    }
  }

  function currentHint() {
    const k = {
      info: "hintInfo", dns: "hintDns", http: "hintHttp", ping: "hintPing",
      anon: "hintAnon", speed: "hintSpeed", region: "hintRegion",
    }[activeAction] || "hintInfo";
    return t(k);
  }

  /* ---- year ---- */
  els.year.textContent = String(new Date().getFullYear());

  /* ---- own IP ---- */
  fetch("https://ipapi.co/json/")
    .then((r) => r.json())
    .then((d) => {
      if (d && d.ip) els.ipValue.textContent = d.ip;
      else els.ipValue.textContent = "n/a";
    })
    .catch(() => {
      els.ipValue.textContent = "n/a";
    });

  /* ---- language switch ---- */
  els.langs.forEach((b) => {
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      els.langs.forEach((bb) =>
        bb.setAttribute("aria-selected", bb === b ? "true" : "false")
      );
      try { localStorage.setItem("sando.lang", lang); } catch (_) {}
      applyI18n();
      renderHistory();
    });
  });
  // restore lang from storage
  try {
    const stored = localStorage.getItem("sando.lang");
    if (stored && STRINGS[stored]) {
      lang = stored;
      els.langs.forEach((bb) =>
        bb.setAttribute("aria-selected", bb.dataset.lang === lang ? "true" : "false")
      );
    }
  } catch (_) {}

  /* ---- mode tabs ---- */
  els.modes.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveMode(tab.dataset.action);
    });
  });

  function setActiveMode(action) {
    activeAction = action;
    els.modes.forEach((t) =>
      t.setAttribute("aria-selected", t.dataset.action === action ? "true" : "false")
    );
    els.resultTitle.textContent = `stdout · ${activeAction}`;
    if (els.hostHint) els.hostHint.textContent = currentHint();
    const isNoTarget = NO_TARGET.has(activeAction);
    // hide input field entirely on no-target modes; keep run button visible
    els.hostInput.disabled = isNoTarget;
    if (isNoTarget) els.hostInput.value = "";
    els.hostInput.placeholder = isNoTarget
      ? t("placeholderNoTarget")
      : t("placeholderInput");
    if (els.inputLine) els.inputLine.classList.toggle("is-no-target", isNoTarget);
    if (els.providerRow) els.providerRow.hidden = activeAction !== "speed";
  }

  /* ---- provider selector (speed mode only) ---- */
  els.providers.forEach((b) => {
    b.addEventListener("click", () => {
      activeProvider = b.dataset.provider;
      els.providers.forEach((bb) =>
        bb.setAttribute("aria-selected", bb === b ? "true" : "false")
      );
    });
  });

  /* ---- run ---- */
  els.runBtn.addEventListener("click", run);
  els.hostInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") run();
  });

  /* ---- copy results ---- */
  els.copyBtn.addEventListener("click", copyResults);

  /* ---- history ---- */
  els.historyClear.addEventListener("click", () => {
    saveHistory([]);
    renderHistory();
  });

  /* ---- init ---- */
  setActiveMode("speed");
  applyI18n();
  renderHistory();

  /* ---- helpers ---- */
  function setStatus(state, labelOrKey) {
    els.resultStatus.classList.remove("is-running", "is-ok", "is-err", "is-warn");
    if (state === "running") els.resultStatus.classList.add("is-running");
    if (state === "ok") els.resultStatus.classList.add("is-ok");
    if (state === "err") els.resultStatus.classList.add("is-err");
    if (state === "warn") els.resultStatus.classList.add("is-warn");
    // remember the i18n key on the element so a lang-switch can re-render
    if (labelOrKey && /^[a-z][a-zA-Z0-9]+$/.test(labelOrKey) && STRINGS.en[labelOrKey] != null) {
      els.resultStatus.dataset.i18n = labelOrKey;
      const v = t(labelOrKey);
      els.resultStatus.textContent = typeof v === "string" ? v : labelOrKey;
    } else {
      delete els.resultStatus.dataset.i18n;
      els.resultStatus.textContent = labelOrKey;
    }
  }

  function clearBody() {
    els.resultBody.innerHTML = "";
  }

  function rowEl(k, v, kind) {
    const row = document.createElement("div");
    row.className = "result-row";
    const ke = document.createElement("span");
    ke.className = "k";
    ke.textContent = k;
    const ve = document.createElement("span");
    ve.className = "v" + (kind ? " " + kind : "");
    ve.textContent = v ?? "—";
    row.appendChild(ke);
    row.appendChild(ve);
    return row;
  }

  function pushRow(k, v, kind) {
    els.resultBody.appendChild(rowEl(k, v, kind));
  }

  function pushScan(text) {
    const wrap = document.createElement("div");
    wrap.className = "scan";
    wrap.innerHTML =
      `<span class="scan-dots"><span></span><span></span><span></span></span>` +
      `<span>${text}</span>`;
    els.resultBody.appendChild(wrap);
    return wrap;
  }

  function pushError(msg) {
    const e = document.createElement("div");
    e.className = "error-line";
    e.textContent = "× " + msg;
    els.resultBody.appendChild(e);
  }

  function pushInfo(msg) {
    const e = document.createElement("div");
    e.style.color = "var(--fg-2)";
    e.textContent = "ℹ " + msg;
    els.resultBody.appendChild(e);
  }

  function normalizeHost(raw) {
    if (!raw) return "";
    let h = raw.trim();
    h = h.replace(/^https?:\/\//i, "");
    h = h.replace(/\/.*$/, "");
    return h;
  }

  /* ---- main run dispatcher ---- */
  async function run() {
    const host = normalizeHost(els.hostInput.value);
    const noTarget = NO_TARGET.has(activeAction);
    if (!noTarget && !host) {
      clearBody();
      setStatus("err", "statusNoInput");
      pushError(t("enterHostFirst"));
      return;
    }
    clearBody();
    setStatus("running", "statusRunning");
    els.resultTitle.textContent = noTarget
      ? `stdout · ${activeAction}`
      : `stdout · ${activeAction} · ${host}`;
    // remember query for history (only modes that take a host)
    if (host && !noTarget) addToHistory(activeAction, host);
    try {
      switch (activeAction) {
        case "info":  await runInfo(host); break;
        case "dns":   await runDns(host); break;
        case "http":  await runHttp(host); break;
        case "ping":  await runPing(host); break;
        case "anon":   await runAnon(); break;
        case "speed":  await runSpeed(); break;
        case "region": await runRegion(); break;
        default:       await runInfo(host);
      }
    } catch (e) {
      setStatus("err", "statusErr");
      pushError(e?.message || String(e));
    }
  }

  /* ---- IP Info ---- */
  function isIp(s) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || /^[0-9a-f:]+$/i.test(s) && s.includes(":");
  }

  async function resolveToIp(host) {
    if (isIp(host)) return host;
    // try A then AAAA via Google DoH
    for (const t of ["A", "AAAA"]) {
      try {
        const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${t}`);
        const d = await r.json();
        if (d.Answer && d.Answer.length) {
          const ip = d.Answer.find((a) => a.type === (t === "A" ? 1 : 28))?.data;
          if (ip) return ip;
        }
      } catch (_) {}
    }
    return null;
  }

  async function runInfo(host) {
    const scan = pushScan(`resolving ${host} …`);
    const ip = await resolveToIp(host);
    if (!ip) {
      scan.remove();
      setStatus("err", "noAaaaRecord");
      pushError(t("couldNotResolve", host));
      return;
    }
    scan.textContent = "";
    scan.innerHTML =
      `<span class="scan-dots"><span></span><span></span><span></span></span>` +
      `<span>fetching geolocation for ${ip} …</span>`;
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    scan.remove();
    if (!r.ok) {
      setStatus("err", `http ${r.status}`);
      pushError(t("ipapiError"));
      return;
    }
    const d = await r.json();
    if (d.error) {
      setStatus("err", "lookupFailed");
      pushError(d.reason || t("lookupFailed"));
      return;
    }
    pushRow("input",     host);
    pushRow("ip",        d.ip || ip);
    pushRow("country",   `${d.country_name || "—"} (${d.country_code || "—"})`);
    pushRow("region",    d.region);
    pushRow("city",      d.city);
    pushRow("postal",    d.postal);
    pushRow("lat / lon", d.latitude && d.longitude ? `${d.latitude}, ${d.longitude}` : "—");
    pushRow("timezone",  d.timezone);
    pushRow("isp / org", d.org);
    pushRow("asn",       d.asn);
    setStatus("ok", "statusOk");
  }

  /* ---- DNS ---- */
  async function runDns(host) {
    const types = ["A", "AAAA", "MX", "TXT", "NS", "CNAME"];
    const scan = pushScan(`querying ${types.length} record types …`);
    const results = await Promise.all(
      types.map((t) =>
        fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${t}`)
          .then((r) => r.json())
          .then((d) => ({ type: t, answers: (d.Answer || []).map((a) => a.data) }))
          .catch(() => ({ type: t, answers: [] }))
      )
    );
    scan.remove();
    let anyHit = false;
    for (const r of results) {
      if (r.answers.length === 0) {
        pushRow(r.type.toLowerCase(), "—");
      } else {
        anyHit = true;
        for (const ans of r.answers) {
          pushRow(r.type.toLowerCase(), ans);
        }
      }
    }
    setStatus(anyHit ? "ok" : "err", anyHit ? "statusOk" : "statusNoRecords");
  }

  /* ---- HTTP ---- */
  async function runHttp(host) {
    const url = host.startsWith("http") ? host : `https://${host}`;
    const scan = pushScan(`fetching ${url} …`);
    const t0 = performance.now();
    let status = 0, ok = false, mode = "cors", err = null, redirected = false, finalUrl = "";
    try {
      const r = await fetch(url, { method: "GET", mode: "cors", redirect: "follow" });
      status = r.status; ok = r.ok; redirected = r.redirected; finalUrl = r.url;
    } catch (e1) {
      err = e1;
      try {
        // Some hosts block CORS. Try no-cors as fallback to at least confirm reachability.
        await fetch(url, { method: "GET", mode: "no-cors", redirect: "follow" });
        mode = "no-cors";
        ok = true;
        err = null;
      } catch (e2) {
        err = e2;
      }
    }
    const ms = Math.round(performance.now() - t0);
    scan.remove();

    pushRow("target", url);
    if (status) pushRow("status", String(status), ok ? "good" : "bad");
    pushRow("reachable", ok ? "yes" : "no", ok ? "good" : "bad");
    pushRow("mode", mode);
    if (redirected) pushRow("redirected", finalUrl || "yes");
    pushRow("duration", `${ms} ms`);
    if (!ok && err) pushError(err.message || String(err));
    setStatus(ok ? "ok" : "err", ok ? "statusOk" : "statusUnreachable");
  }

  /* ---- Ping (pseudo) ---- */
  async function runPing(host) {
    const url = host.startsWith("http") ? host : `https://${host}`;
    const probes = 5;
    const scan = pushScan(`pinging ${url} × ${probes} …`);
    const samples = [];
    for (let i = 0; i < probes; i++) {
      const t0 = performance.now();
      let okOne = false;
      try {
        await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Math.random(), {
          method: "GET",
          mode: "no-cors",
          cache: "no-store",
        });
        okOne = true;
      } catch (_) {
        okOne = false;
      }
      const ms = performance.now() - t0;
      samples.push({ i: i + 1, ms, ok: okOne });
    }
    scan.remove();

    const okSamples = samples.filter((s) => s.ok).map((s) => s.ms);
    const lost = probes - okSamples.length;
    const min = okSamples.length ? Math.min(...okSamples) : 0;
    const max = okSamples.length ? Math.max(...okSamples) : 0;
    const avg = okSamples.length ? okSamples.reduce((a, b) => a + b, 0) / okSamples.length : 0;
    const jitter =
      okSamples.length > 1
        ? Math.sqrt(okSamples.map((x) => (x - avg) ** 2).reduce((a, b) => a + b, 0) / okSamples.length)
        : 0;

    for (const s of samples) {
      const widthPct = Math.min(100, (s.ms / 600) * 100);
      const row = document.createElement("div");
      row.className = "result-row";
      const ke = document.createElement("span");
      ke.className = "k";
      ke.textContent = t("probe", s.i);
      const ve = document.createElement("span");
      ve.className = "v " + (s.ok ? "good" : "bad");
      if (s.ok) {
        ve.textContent = Math.round(s.ms) + " ms ";
        const bar = document.createElement("span");
        bar.className = "bar";
        bar.style.width = widthPct + "%";
        ve.appendChild(bar);
      } else {
        ve.textContent = t("lost");
      }
      row.appendChild(ke);
      row.appendChild(ve);
      els.resultBody.appendChild(row);
    }

    pushRow("min / avg / max", okSamples.length
      ? `${Math.round(min)} / ${Math.round(avg)} / ${Math.round(max)} ms`
      : "—",
      okSamples.length ? "good" : "bad");
    pushRow("jitter", okSamples.length ? `${jitter.toFixed(1)} ms` : "—");
    pushRow("loss", `${Math.round((lost / probes) * 100)}%`,
      lost === 0 ? "good" : lost === probes ? "bad" : "warn");

    pushInfo(t("pingNote"));
    setStatus(okSamples.length ? "ok" : "err", okSamples.length ? "statusOk" : "statusUnreachable");
  }

  /* =============================================================
   * Anonymity check
   *  - pulls public ip + geolocation from ipapi.co
   *  - gathers webrtc ice candidates via google's public stun server,
   *    extracting srflx (server-reflexive / public) and host (local) ips
   *  - compares stun-public-ip vs ipapi-ip → vpn / dns leak signal
   *  - compares browser timezone vs ipapi timezone → likely-vpn signal
   *  - shows browser fingerprint (ua, locale, platform, connection)
   * ============================================================= */
  async function runAnon() {
    const scan = pushScan("collecting public ip + geolocation …");
    let ipa = {};
    try {
      const r = await fetch("https://ipapi.co/json/");
      ipa = await r.json();
    } catch (_) { ipa = {}; }

    scan.querySelector("span:last-child").textContent = "gathering webrtc ice candidates …";
    const rtc = await getWebRTCInfo();
    scan.remove();

    /* ---- summary block ---- */
    const browserTz = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
      catch (_) { return ""; }
    })();
    const ipTz = ipa.timezone || "";
    const tzMatch = browserTz && ipTz && browserTz === ipTz;

    const ipaIp = ipa.ip || "";
    const stunIp = (rtc.publicIps || [])[0] || "";
    const ipMatch = stunIp && ipaIp && stunIp === ipaIp;
    const noStun = rtc.supported && (rtc.publicIps || []).length === 0;

    /* verdict */
    let verdict, verdictKind;
    if (ipMatch && tzMatch) {
      verdict = t("verdictGood");
      verdictKind = "good";
    } else if (!ipMatch && stunIp && ipaIp) {
      verdict = t("verdictWebRTC");
      verdictKind = "bad";
    } else if (!tzMatch && browserTz && ipTz) {
      verdict = t("verdictTz");
      verdictKind = "warn";
    } else if (noStun) {
      verdict = t("verdictNoStun");
      verdictKind = "warn";
    } else {
      verdict = t("verdictInconclusive");
      verdictKind = "warn";
    }
    pushRow("verdict", verdict, verdictKind);

    /* ---- ip ---- */
    pushRow("public ip (http)", ipaIp || "—");
    pushRow("public ip (webrtc)",
      stunIp || (noStun ? t("hiddenBlocked") : "—"),
      stunIp ? (ipMatch ? "good" : "bad") : "warn");
    if ((rtc.localIps || []).length) {
      pushRow("local ip (webrtc)", rtc.localIps.join(", "));
    } else if (rtc.supported) {
      pushRow("local ip (webrtc)", t("mdnsHidden"), "good");
    }

    /* ---- geo ---- */
    if (ipa.country_name) pushRow("ip country", `${ipa.country_name} (${ipa.country_code})`);
    if (ipa.city)         pushRow("ip city", ipa.city);
    if (ipa.org)          pushRow("ip isp / org", ipa.org);
    if (ipa.asn)          pushRow("ip asn", ipa.asn);

    /* ---- locale match ---- */
    if (ipTz)      pushRow("ip timezone",      ipTz);
    if (browserTz) pushRow("browser timezone", browserTz, tzMatch ? "good" : (ipTz ? "warn" : ""));

    const lang = navigator.language || "—";
    const langs = (navigator.languages || []).join(", ") || lang;
    pushRow("browser locale", `${lang}  (all: ${langs})`);

    /* ---- fingerprint ---- */
    const ua = navigator.userAgentData?.brands?.map(b => `${b.brand} ${b.version}`).join(", ")
      || navigator.userAgent || "—";
    const platform = navigator.userAgentData?.platform || navigator.platform || "—";
    pushRow("user agent", ua);
    pushRow("platform",   platform);
    if (navigator.connection) {
      const c = navigator.connection;
      const parts = [];
      if (c.effectiveType) parts.push(c.effectiveType);
      if (typeof c.downlink === "number") parts.push(`~${c.downlink} Mbps`);
      if (typeof c.rtt === "number") parts.push(`${c.rtt} ms rtt`);
      if (c.saveData) parts.push("save-data on");
      if (parts.length) pushRow("connection", parts.join(" · "));
    }

    pushInfo(t("anonDnsNote"));

    setStatus(
      verdictKind === "good" ? "ok" : verdictKind === "bad" ? "err" : "warn",
      verdictKind === "good" ? "statusNoLeak" : verdictKind === "bad" ? "statusLeak" : "statusUncertain"
    );
  }

  function getWebRTCInfo() {
    return new Promise((resolve) => {
      if (typeof RTCPeerConnection === "undefined") {
        resolve({ supported: false, ips: [], localIps: [], publicIps: [] });
        return;
      }
      const ips = new Set();
      const localIps = new Set();
      const publicIps = new Set();
      let pc;
      try {
        pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
      } catch (_) {
        resolve({ supported: false, ips: [], localIps: [], publicIps: [] });
        return;
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try { pc.close(); } catch (_) {}
        resolve({
          supported: true,
          ips: [...ips],
          localIps: [...localIps],
          publicIps: [...publicIps],
        });
      };

      try { pc.createDataChannel("sando"); } catch (_) {}

      pc.onicecandidate = (e) => {
        if (!e.candidate) { finish(); return; }
        const cand = e.candidate.candidate || "";
        // cand: "candidate:foundation component proto priority ip port typ <type> ..."
        const parts = cand.split(" ");
        const ip = parts[4];
        const typ = parts[parts.indexOf("typ") + 1];
        if (!ip) return;
        if (ip.endsWith(".local")) {
          ips.add("mdns hidden");
          return;
        }
        ips.add(ip);
        if (typ === "host") localIps.add(ip);
        if (typ === "srflx" || typ === "prflx") publicIps.add(ip);
      };

      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .catch(() => finish());

      setTimeout(finish, 3500);
    });
  }

  /* =============================================================
   * Speed test — dispatches on activeProvider:
   *   - cloudflare : speed.cloudflare.com __down / __up streams
   *   - mlab       : NDT7 over WebSocket against nearest M-Lab server
   * ============================================================= */
  async function runSpeed() {
    if (activeProvider === "mlab") return runSpeedMlab();
    return runSpeedCloudflare();
  }

  async function runSpeedCloudflare() {
    const SPEED = "https://speed.cloudflare.com";

    /* --- latency --- */
    pushRow(t("server"), "speed.cloudflare.com");
    const latRow = pushLiveRow(t("latency"), t("measuring"));
    const lats = [];
    for (let i = 0; i < 15; i++) {
      const t0 = performance.now();
      try {
        await fetch(`${SPEED}/__down?bytes=0&_=${Math.random()}`, { cache: "no-store" });
        lats.push(performance.now() - t0);
      } catch (_) {}
    }
    if (!lats.length) {
      latRow.set("failed", "bad");
      setStatus("err", "statusNoNetwork");
      pushError(t("cantReachSpeed"));
      return;
    }
    lats.sort((a, b) => a - b);
    const median = lats[Math.floor(lats.length / 2)];
    const min = lats[0];
    const jitter = Math.sqrt(
      lats.map((x) => (x - median) ** 2).reduce((a, b) => a + b, 0) / lats.length
    );
    latRow.set(
      `min ${Math.round(min)} ms · median ${Math.round(median)} ms · jitter ${jitter.toFixed(1)} ms`,
      median < 80 ? "good" : median < 200 ? "warn" : "bad"
    );

    /* --- speedometers (download + upload side by side) --- */
    const meters = pushSpeedometers();
    meters.dl.start();
    const dlMbps = await measureDownload(SPEED, 4, 25 * 1024 * 1024, (mbps) => {
      meters.dl.update(mbps);
    });
    meters.dl.finish(dlMbps);

    meters.ul.start();
    const ulMbps = await measureUpload(SPEED, 2, 10 * 1024 * 1024, (mbps) => {
      meters.ul.update(mbps);
    });
    meters.ul.finish(ulMbps);

    setStatus("ok", "statusDone");
  }

  function pushLiveRow(k, initial) {
    const row = document.createElement("div");
    row.className = "result-row";
    const ke = document.createElement("span"); ke.className = "k"; ke.textContent = k;
    const ve = document.createElement("span"); ve.className = "v"; ve.textContent = initial;
    row.appendChild(ke); row.appendChild(ve);
    els.resultBody.appendChild(row);
    return {
      set(text, kind) {
        ve.textContent = text;
        ve.className = "v" + (kind ? " " + kind : "");
      }
    };
  }

  function pushBarRow() {
    const row = document.createElement("div");
    row.className = "result-row speed-bar-row";
    const ke = document.createElement("span"); ke.className = "k"; ke.textContent = "";
    const ve = document.createElement("span"); ve.className = "v";
    const track = document.createElement("span"); track.className = "speed-track";
    const fill = document.createElement("span"); fill.className = "speed-fill";
    track.appendChild(fill);
    ve.appendChild(track);
    row.appendChild(ke); row.appendChild(ve);
    els.resultBody.appendChild(row);
    return {
      set(pct) { fill.style.width = Math.max(0, Math.min(100, pct)) + "%"; }
    };
  }

  async function measureDownload(base, streams, perStream, onTick) {
    let totalBytes = 0;
    const expected = streams * perStream;
    const t0 = performance.now();
    let lastTick = t0;

    let interval = setInterval(() => {
      const sec = (performance.now() - t0) / 1000;
      if (sec <= 0) return;
      const mbps = (totalBytes * 8) / sec / 1e6;
      onTick(mbps, (totalBytes / expected) * 100);
      lastTick = performance.now();
    }, 200);

    const tasks = [];
    for (let i = 0; i < streams; i++) {
      tasks.push((async () => {
        const r = await fetch(`${base}/__down?bytes=${perStream}&_=${Math.random()}`,
          { cache: "no-store" });
        if (!r.body) {
          // fallback: arrayBuffer (no streaming)
          const ab = await r.arrayBuffer();
          totalBytes += ab.byteLength;
          return;
        }
        const reader = r.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
        }
      })());
    }
    await Promise.all(tasks);
    clearInterval(interval);
    const sec = (performance.now() - t0) / 1000;
    return (totalBytes * 8) / sec / 1e6;
  }

  async function measureUpload(base, streams, perStream, onTick) {
    // build random payload once (re-used across streams)
    const payload = new Uint8Array(perStream);
    crypto.getRandomValues(payload.subarray(0, Math.min(perStream, 65536)));

    let bytesSent = 0;
    const expected = streams * perStream;
    const t0 = performance.now();
    let interval = setInterval(() => {
      const sec = (performance.now() - t0) / 1000;
      if (sec <= 0) return;
      const mbps = (bytesSent * 8) / sec / 1e6;
      onTick(mbps, (bytesSent / expected) * 100);
    }, 200);

    const tasks = [];
    for (let i = 0; i < streams; i++) {
      tasks.push((async () => {
        await fetch(`${base}/__up?_=${Math.random()}`, {
          method: "POST",
          body: payload,
          cache: "no-store",
        });
        bytesSent += perStream;
      })());
    }
    await Promise.all(tasks);
    clearInterval(interval);
    const sec = (performance.now() - t0) / 1000;
    return (bytesSent * 8) / sec / 1e6;
  }

  /* =============================================================
   * M-Lab NDT7 (WebSocket based, real measurement to nearest server)
   *   1. locate.measurementlab.net/v2/nearest/ndt/ndt7 → server urls
   *   2. wss download for ~10s, count incoming bytes
   *   3. wss upload for ~10s, send 8KB chunks while bufferedAmount low
   * ============================================================= */
  async function runSpeedMlab() {
    const serverRow = pushLiveRow(t("server"), t("locating"));
    let server;
    try {
      const r = await fetch("https://locate.measurementlab.net/v2/nearest/ndt/ndt7");
      const data = await r.json();
      if (!data.results || !data.results.length) throw new Error(t("noServers"));
      server = data.results[0];
    } catch (e) {
      setStatus("err", "statusNoServer");
      pushError(t("cantReachLocator", e.message || e));
      return;
    }

    const machine = server.machine || "(unknown)";
    const urls = server.urls || {};
    // urls keys can vary slightly across deployments; try the common ones.
    const dlUrl = urls["wss:///ndt/v7/download"] || urls["wss://ndt/v7/download"]
      || Object.values(urls).find((u) => /\/ndt\/v7\/download/.test(String(u)));
    const ulUrl = urls["wss:///ndt/v7/upload"]   || urls["wss://ndt/v7/upload"]
      || Object.values(urls).find((u) => /\/ndt\/v7\/upload/.test(String(u)));

    serverRow.set(`m-lab · ${machine}`);

    if (!dlUrl) {
      setStatus("err", "statusNoUrls");
      pushError(t("noDownloadUrl"));
      return;
    }

    /* --- latency: handshake-rtt across multiple ws connections --- */
    const latRow = pushLiveRow(t("latency"), t("measuring"));
    const lats = [];
    for (let i = 0; i < 6; i++) {
      const t0 = performance.now();
      const ok = await new Promise((resolve) => {
        let s;
        try { s = new WebSocket(dlUrl, "net.measurementlab.ndt.v7"); }
        catch (_) { resolve(false); return; }
        const to = setTimeout(() => { try { s.close(); } catch (_) {} resolve(false); }, 3000);
        s.onopen = () => {
          clearTimeout(to);
          lats.push(performance.now() - t0);
          try { s.close(); } catch (_) {}
          resolve(true);
        };
        s.onerror = () => { clearTimeout(to); resolve(false); };
      });
      if (!ok && i === 0) break;
    }
    if (!lats.length) {
      latRow.set("could not connect", "bad");
      setStatus("err", "statusWsBlocked");
      pushError(t("wsFailed"));
      return;
    }
    lats.sort((a, b) => a - b);
    const median = lats[Math.floor(lats.length / 2)];
    const min = lats[0];
    const jitter = Math.sqrt(
      lats.map((x) => (x - median) ** 2).reduce((a, b) => a + b, 0) / lats.length
    );
    latRow.set(
      `min ${Math.round(min)} ms · median ${Math.round(median)} ms · jitter ${jitter.toFixed(1)} ms (${t("handshakeRtt")})`,
      median < 80 ? "good" : median < 200 ? "warn" : "bad"
    );

    /* --- speedometers --- */
    const meters = pushSpeedometers();
    meters.dl.start();
    const dlMbps = await ndt7Download(dlUrl, 10000, (mbps) => {
      meters.dl.update(mbps);
    });
    meters.dl.finish(dlMbps);

    if (ulUrl) {
      meters.ul.start();
      const ulMbps = await ndt7Upload(ulUrl, 10000, (mbps) => {
        meters.ul.update(mbps);
      });
      meters.ul.finish(ulMbps);
    }

    if (server.location && (server.location.city || server.location.country)) {
      const loc = [server.location.city, server.location.country].filter(Boolean).join(", ");
      pushRow(t("location"), loc);
    }

    pushInfo(t("mlabNote"));
    setStatus("ok", "statusDone");
  }

  function ndt7Download(url, durationMs, onTick) {
    return new Promise((resolve) => {
      let ws;
      try { ws = new WebSocket(url, "net.measurementlab.ndt.v7"); }
      catch (_) { resolve(0); return; }
      ws.binaryType = "arraybuffer";
      let totalBytes = 0;
      let t0 = 0;
      let interval = null;
      const finish = () => {
        if (interval) clearInterval(interval);
        const sec = t0 ? (performance.now() - t0) / 1000 : 1;
        resolve((totalBytes * 8) / sec / 1e6);
      };
      ws.onopen = () => {
        t0 = performance.now();
        interval = setInterval(() => {
          const sec = (performance.now() - t0) / 1000;
          if (sec <= 0) return;
          const mbps = (totalBytes * 8) / sec / 1e6;
          const pct = Math.min(100, (sec / (durationMs / 1000)) * 100);
          onTick(mbps, pct);
        }, 200);
        setTimeout(() => { try { ws.close(); } catch (_) {} }, durationMs);
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") return; // measurement json
        totalBytes += ev.data.byteLength;
      };
      ws.onclose = finish;
      ws.onerror = finish;
    });
  }

  function ndt7Upload(url, durationMs, onTick) {
    return new Promise((resolve) => {
      let ws;
      try { ws = new WebSocket(url, "net.measurementlab.ndt.v7"); }
      catch (_) { resolve(0); return; }
      ws.binaryType = "arraybuffer";

      const chunkSize = 8192;
      const chunk = new Uint8Array(chunkSize);
      crypto.getRandomValues(chunk);

      let bytesQueued = 0;
      let bytesAcked = 0;
      let t0 = 0;
      let stopped = false;
      let interval = null;
      let pumpTimer = null;

      const finish = () => {
        stopped = true;
        if (interval) clearInterval(interval);
        if (pumpTimer) clearInterval(pumpTimer);
        const sec = t0 ? (performance.now() - t0) / 1000 : 1;
        // server-acked bytes ≈ bytesQueued - bufferedAmount at close
        const buffered = ws.bufferedAmount || 0;
        bytesAcked = Math.max(0, bytesQueued - buffered);
        resolve((bytesAcked * 8) / sec / 1e6);
      };

      ws.onopen = () => {
        t0 = performance.now();
        const HIGH_WATER = 1 << 22; // 4MB
        const pump = () => {
          if (stopped) return;
          while (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < HIGH_WATER) {
            ws.send(chunk);
            bytesQueued += chunkSize;
          }
        };
        pumpTimer = setInterval(pump, 8);

        interval = setInterval(() => {
          const sec = (performance.now() - t0) / 1000;
          if (sec <= 0) return;
          const buffered = ws.bufferedAmount || 0;
          const acked = Math.max(0, bytesQueued - buffered);
          const mbps = (acked * 8) / sec / 1e6;
          const pct = Math.min(100, (sec / (durationMs / 1000)) * 100);
          onTick(mbps, pct);
        }, 200);

        setTimeout(() => { try { ws.close(); } catch (_) {} }, durationMs);
      };
      ws.onmessage = () => {}; // server sends progress json, ignore
      ws.onclose = finish;
      ws.onerror = finish;
    });
  }

  /* =============================================================
   * Region (ipregion-style cross-check)
   *  Hits ~8 public ip-geo providers in parallel and shows what
   *  each one thinks about the same ip — country / city / asn.
   *  A consensus row at the top calls out disagreement (vpn /
   *  anycast / cdn signals show up here).
   * ============================================================= */
  const REGION_SOURCES = [
    {
      name: "ipapi.co",
      url: "https://ipapi.co/json/",
      parse: (j) => ({
        ip: j.ip, code: j.country_code, country: j.country_name,
        region: j.region, city: j.city, org: j.org,
        asn: j.asn || "",
      }),
    },
    {
      name: "ipwho.is",
      url: "https://ipwho.is/",
      parse: (j) => ({
        ip: j.ip, code: j.country_code, country: j.country,
        region: j.region, city: j.city,
        org: j.connection && j.connection.org,
        asn: j.connection && j.connection.asn ? "AS" + j.connection.asn : "",
      }),
    },
    {
      name: "country.is",
      url: "https://api.country.is/",
      parse: (j) => ({ ip: j.ip, code: j.country }),
    },
    {
      name: "geojs.io",
      url: "https://get.geojs.io/v1/ip/geo.json",
      parse: (j) => ({
        ip: j.ip, code: j.country_code, country: j.country,
        region: j.region, city: j.city, org: j.organization_name,
        asn: j.asn ? "AS" + j.asn : "",
      }),
    },
    {
      name: "1.1.1.1/trace",
      url: "https://1.1.1.1/cdn-cgi/trace",
      text: true,
      parse: (txt) => {
        const m = {};
        for (const raw of txt.split(/\r?\n/)) {
          const line = raw.trim();
          if (!line) continue;
          const i = line.indexOf("=");
          if (i > 0) m[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        }
        return {
          ip: m.ip,
          code: m.loc || undefined,
          region: m.colo ? "colo:" + m.colo : "",
        };
      },
    },
    {
      name: "ipinfo.io",
      url: "https://ipinfo.io/json",
      parse: (j) => {
        const m = j.org && j.org.match(/^(AS\d+)\s+(.+)/);
        return {
          ip: j.ip, code: j.country, region: j.region, city: j.city,
          org: m ? m[2] : j.org, asn: m ? m[1] : "",
        };
      },
    },
    {
      name: "ipapi.is",
      url: "https://api.ipapi.is/",
      parse: (j) => ({
        ip: j.ip,
        code: j.location && j.location.country_code,
        country: j.location && j.location.country,
        region: j.location && j.location.state,
        city: j.location && j.location.city,
        org: j.asn && j.asn.org,
        asn: j.asn && j.asn.asn ? "AS" + j.asn.asn : "",
        flags: {
          datacenter: !!j.is_datacenter,
          proxy: !!j.is_proxy,
          tor: !!j.is_tor,
          vpn: !!j.is_vpn,
        },
      }),
    },
  ];

  async function runRegion() {
    pushScan(t("regionScanning", REGION_SOURCES.length));

    const results = await Promise.all(
      REGION_SOURCES.map(async (src) => {
        const t0 = performance.now();
        try {
          const r = await fetch(src.url, { cache: "no-store" });
          if (!r.ok) throw new Error("HTTP " + r.status);
          const data = src.text ? await r.text() : await r.json();
          const out = src.parse(data) || {};
          out._ms = Math.round(performance.now() - t0);
          out._source = src.name;
          return { ok: true, ...out };
        } catch (e) {
          return { ok: false, _source: src.name, _err: e.message || String(e) };
        }
      })
    );

    // clear running scan rows
    clearBody();

    /* --- consensus --- */
    const codes = results.filter((r) => r.ok && r.code).map((r) => r.code.toUpperCase());
    const tally = {};
    codes.forEach((c) => (tally[c] = (tally[c] || 0) + 1));
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    const total = codes.length;
    const allAgree = sorted.length === 1 && top && top[1] === total;

    let verdictText, verdictKind;
    if (!total) {
      verdictText = t("regionNoResp");
      verdictKind = "bad";
    } else if (allAgree) {
      verdictText = t("regionAllAgree", total, top[0]);
      verdictKind = "good";
    } else {
      const frags = sorted.map(([c, n]) => `${n}× ${c}`).join("  ·  ");
      verdictText = t("regionDisagree", frags);
      verdictKind = "warn";
    }
    pushRow("verdict", verdictText, verdictKind);

    /* --- ip cross-check --- */
    const ips = [...new Set(results.filter((r) => r.ok && r.ip).map((r) => r.ip))];
    if (ips.length > 1) {
      pushRow("public ip", t("regionMultiIp", ips.join(", ")), "warn");
    } else if (ips.length === 1) {
      pushRow("public ip", ips[0]);
    }

    /* --- per-source rows --- */
    for (const r of results) {
      if (!r.ok) {
        pushRow(r._source, `(${r._err})`, "bad");
        continue;
      }
      const code = r.code ? r.code.toUpperCase() : "?";
      const isMajority = top && code === top[0];
      const parts = [code];
      if (r.region && !/^colo:/.test(r.region)) parts.push(r.region);
      if (r.city) parts.push(r.city);
      if (r.region && /^colo:/.test(r.region)) parts.push(r.region);
      if (r.asn || r.org) {
        parts.push([r.asn, r.org].filter(Boolean).join(" "));
      }
      const flagStr = r.flags
        ? Object.entries(r.flags).filter(([, v]) => v).map(([k]) => k).join("/")
        : "";
      if (flagStr) parts.push("[" + flagStr + "]");
      pushRow(
        r._source,
        parts.join(" · ") + `  (${r._ms} ms)`,
        isMajority ? "good" : "bad"
      );
    }

    pushInfo(t("regionNote"));

    setStatus(verdictKind === "good" ? "ok" : verdictKind === "bad" ? "err" : "warn",
              verdictKind === "good" ? "statusConsistent" : verdictKind === "bad" ? "statusNoData" : "statusMismatch");
  }

  /* =============================================================
   * Speedometer (SVG semicircle, log scale 0…1000+ Mbps).
   * Two side-by-side: download (↓) + upload (↑).
   * ============================================================= */
  const SVG_NS = "http://www.w3.org/2000/svg";

  function pushSpeedometers() {
    const row = document.createElement("div");
    row.className = "speedo-row";
    const dl = createSpeedometer({ arrow: "↓", text: t("download") });
    const ul = createSpeedometer({ arrow: "↑", text: t("upload") });
    row.appendChild(dl.el);
    row.appendChild(ul.el);
    els.resultBody.appendChild(row);
    return { dl, ul };
  }

  function createSpeedometer(label) {
    const wrap = document.createElement("div");
    wrap.className = "speedo";

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "speedo-svg");
    svg.setAttribute("viewBox", "0 0 200 130");
    svg.setAttribute("aria-hidden", "true");

    // Background + fill arcs (semicircle from (20,100) over the top to (180,100))
    const arcD = "M 20 100 A 80 80 0 0 1 180 100";

    const arcBg = document.createElementNS(SVG_NS, "path");
    arcBg.setAttribute("class", "speedo-arc-bg");
    arcBg.setAttribute("d", arcD);
    svg.appendChild(arcBg);

    const arcFill = document.createElementNS(SVG_NS, "path");
    arcFill.setAttribute("class", "speedo-arc-fill");
    arcFill.setAttribute("d", arcD);
    arcFill.setAttribute("pathLength", "100");
    arcFill.setAttribute("stroke-dasharray", "100");
    arcFill.setAttribute("stroke-dashoffset", "100");
    svg.appendChild(arcFill);

    // Tick marks at 1, 10, 100, 1000 Mbps (log positions)
    const ticks = [
      { mbps: 1,    label: "1"   },
      { mbps: 10,   label: "10"  },
      { mbps: 100,  label: "100" },
      { mbps: 1000, label: "1k"  },
    ];
    for (const tk of ticks) {
      const pct = mbpsToPct(tk.mbps);
      const theta = Math.PI * (1 - pct);
      const cos = Math.cos(theta), sin = Math.sin(theta);
      const tick = document.createElementNS(SVG_NS, "line");
      tick.setAttribute("class", "speedo-tick");
      tick.setAttribute("x1", String(100 + 88 * cos));
      tick.setAttribute("y1", String(100 - 88 * sin));
      tick.setAttribute("x2", String(100 + 76 * cos));
      tick.setAttribute("y2", String(100 - 76 * sin));
      svg.appendChild(tick);

      const lab = document.createElementNS(SVG_NS, "text");
      lab.setAttribute("class", "speedo-tick-label");
      lab.setAttribute("x", String(100 + 99 * cos));
      lab.setAttribute("y", String(100 - 99 * sin + 2));
      lab.textContent = tk.label;
      svg.appendChild(lab);
    }

    // Needle from center pointing up; rotated by transform.
    const needle = document.createElementNS(SVG_NS, "line");
    needle.setAttribute("class", "speedo-needle");
    needle.setAttribute("x1", "100");
    needle.setAttribute("y1", "100");
    needle.setAttribute("x2", "100");
    needle.setAttribute("y2", "32");
    svg.appendChild(needle);

    const pin = document.createElementNS(SVG_NS, "circle");
    pin.setAttribute("class", "speedo-pin");
    pin.setAttribute("cx", "100");
    pin.setAttribute("cy", "100");
    pin.setAttribute("r", "4");
    svg.appendChild(pin);

    wrap.appendChild(svg);

    const readout = document.createElement("div");
    readout.className = "speedo-readout";
    const value = document.createElement("div");
    value.className = "speedo-value";
    value.textContent = "0.0";
    const unit = document.createElement("div");
    unit.className = "speedo-unit";
    unit.textContent = "Mbps";
    readout.appendChild(value);
    readout.appendChild(unit);
    wrap.appendChild(readout);

    const lbl = document.createElement("div");
    lbl.className = "speedo-label";
    const arrow = document.createElement("span");
    arrow.className = "speedo-arrow";
    arrow.textContent = label.arrow;
    const text = document.createElement("span");
    text.className = "speedo-label-text";
    text.textContent = label.text;
    lbl.appendChild(arrow);
    lbl.appendChild(text);
    wrap.appendChild(lbl);

    function applyValue(mbps) {
      const safe = Math.max(0, Number(mbps) || 0);
      const pct = mbpsToPct(safe);
      arcFill.setAttribute("stroke-dashoffset", String(100 - pct * 100));
      needle.style.transform = `rotate(${-90 + 180 * pct}deg)`;
      value.textContent = safe < 10 ? safe.toFixed(1) : Math.round(safe).toString();
    }

    return {
      el: wrap,
      start() {
        wrap.classList.add("is-active");
        wrap.classList.remove("is-done");
        applyValue(0);
      },
      update(mbps) { applyValue(mbps); },
      finish(mbps) {
        applyValue(mbps);
        wrap.classList.remove("is-active");
        wrap.classList.add("is-done");
      },
    };
  }

  function mbpsToPct(mbps) {
    // log10(1+x) / log10(1001): 0→0, 1→0.10, 10→0.35, 100→0.67, 1000→1
    if (mbps <= 0) return 0;
    return Math.min(1, Math.log10(mbps + 1) / Math.log10(1001));
  }

  /* =============================================================
   * History — last 5 successful runs in localStorage.
   * Stored as { action, host, ts }. Click a chip → re-run it.
   * ============================================================= */
  const HISTORY_KEY = "sando.history.v1";
  const HISTORY_LIMIT = 5;

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function saveHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch (_) {}
  }
  function addToHistory(action, host) {
    const list = loadHistory().filter(
      (e) => !(e.action === action && e.host === host)
    );
    list.unshift({ action, host, ts: Date.now() });
    saveHistory(list.slice(0, HISTORY_LIMIT));
    renderHistory();
  }
  function renderHistory() {
    const list = loadHistory();
    if (!list.length) {
      els.historyRow.hidden = true;
      els.historyChips.innerHTML = "";
      return;
    }
    els.historyRow.hidden = false;
    els.historyChips.innerHTML = "";
    for (const entry of list) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "history-chip";
      chip.title = `${entry.action} · ${entry.host}`;
      const modeKey = `mode${entry.action[0].toUpperCase()}${entry.action.slice(1)}`;
      const modeLabel = STRINGS[lang]?.[modeKey] || entry.action;
      const span1 = document.createElement("span");
      span1.className = "history-chip-mode";
      span1.textContent = modeLabel;
      const span2 = document.createElement("span");
      span2.textContent = entry.host;
      chip.appendChild(span1);
      chip.appendChild(span2);
      chip.addEventListener("click", () => {
        setActiveMode(entry.action);
        els.hostInput.value = entry.host;
        run();
      });
      els.historyChips.appendChild(chip);
    }
  }

  /* =============================================================
   * Copy results — walks the result body and emits a markdown table.
   * ============================================================= */
  function copyResults() {
    const lines = [];
    const titleSpan = els.resultTitle.textContent.trim();
    lines.push(`# ${titleSpan}`);
    lines.push("");

    const body = els.resultBody;
    for (const node of body.children) {
      if (node.classList.contains("placeholder")) continue;
      if (node.classList.contains("scan")) continue;
      if (node.classList.contains("speedo-row")) {
        // pull mbps from each speedo-value
        const speedos = node.querySelectorAll(".speedo");
        speedos.forEach((s) => {
          const lbl = s.querySelector(".speedo-label-text")?.textContent || "";
          const val = s.querySelector(".speedo-value")?.textContent || "";
          if (lbl) lines.push(`| ${lbl} | ${val} Mbps |`);
        });
        continue;
      }
      if (node.classList.contains("result-row")) {
        const k = (node.querySelector(".k")?.textContent || "").trim();
        let v = (node.querySelector(".v")?.textContent || "").trim();
        // collapse multiple spaces
        v = v.replace(/\s+/g, " ");
        if (k || v) lines.push(`| ${k} | ${v} |`);
        continue;
      }
      if (node.classList.contains("error-line")) {
        lines.push(`> ${node.textContent.trim()}`);
        continue;
      }
      // fallback: any other text node
      const txt = node.textContent.trim();
      if (txt) lines.push(txt);
    }
    lines.push("");
    lines.push(`— sando.host (${activeAction})`);
    const text = lines.join("\n");
    const showCopied = () => {
      els.copyBtn.classList.add("is-copied");
      const labelSpan = els.copyBtn.querySelector(".copy-label");
      if (labelSpan) labelSpan.textContent = t("copied");
      setTimeout(() => {
        els.copyBtn.classList.remove("is-copied");
        if (labelSpan) labelSpan.textContent = t("copy");
      }, 1400);
    };
    const showFail = () => {
      const labelSpan = els.copyBtn.querySelector(".copy-label");
      if (labelSpan) labelSpan.textContent = t("copyFail");
      setTimeout(() => { if (labelSpan) labelSpan.textContent = t("copy"); }, 1400);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopied, () => fallbackCopy(text, showCopied, showFail));
    } else {
      fallbackCopy(text, showCopied, showFail);
    }
  }

  function fallbackCopy(text, ok, fail) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const success = document.execCommand("copy");
      document.body.removeChild(ta);
      success ? ok() : fail();
    } catch (_) { fail(); }
  }
})();
