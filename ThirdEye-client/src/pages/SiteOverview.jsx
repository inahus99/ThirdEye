// src/pages/SiteOverview.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Box,
  Heading,
  Select,
  Text,
  SimpleGrid,
  HStack,
  VStack,
  Badge,
  Stat,
  Button,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  Spinner,
  Tooltip,
  Switch,
  IconButton,
  useToast,
} from "@chakra-ui/react";
import { DownloadIcon, RepeatIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { api, qs } from "../lib/api";
import { socket } from "../lib/socket";

dayjs.extend(relativeTime);

const fmtDate = (d) => (d ? dayjs(d).format("YYYY-MM-DD HH:mm:ss") : "—");
const plural = (n, s) => `${n} ${s}${n === 1 ? "" : "s"}`;
const toCsv = (rows) => {
  const header = ["status", "responseTime", "createdAt", "site"];
  const lines = [header.join(",")];
  rows.forEach((r) => {
    const vals = [
      r.status ?? "",
      r.responseTime ?? "",
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
      r.site ?? "",
    ];
    lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  });
  return lines.join("\n");
};

// ---- robust checks fetch: handles siteId|site|website AND array|{items} ----
async function fetchChecksCompat(siteId, limit = 100) {
  const variants = [
    qs({ siteId, limit }),
    qs({ site: siteId, limit }),
    qs({ website: siteId, limit }),
  ];
  for (const v of variants) {
    try {
      const res = await api.get(`/analytics/checks${v}`);
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.items)) return res.items;
      // if API returns a paged object with `data` or `results`
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.results)) return res.results;
    } catch {
      // try next shape
    }
  }
  return [];
}

function EmptyStateSiteOverview() {
  return (
    <Box textAlign="center" py={16}>
      <Heading size="lg" mt={4}>
        No websites yet
      </Heading>
      <Text color="muted" mt={2}>
        Add your first website to start monitoring uptime & response time.
      </Text>
      <HStack spacing={3} justify="center" mt={6}>
        <a href="/dashboard">
          <Button colorScheme="blue">Go to Dashboard</Button>
        </a>
        <a href="/clients">
          <Button variant="outline">Open Clients</Button>
        </a>
      </HStack>
    </Box>
  );
}

export default function SiteOverview() {
  const toast = useToast();
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [siteRow, setSiteRow] = useState(null);

  const [uptime, setUptime] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [checks, setChecks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const intervalRef = useRef(null);
  const latestIdRef = useRef(siteId);

  const getId = (s) => s?._id || s?.id || s?.siteId || null;

  // ---- load sites
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/websites");
        const list = Array.isArray(res) ? res : res?.items || [];
        if (cancel) return;
        setSites(list);
        if (list.length) {
          const first = getId(list[0]);
          setSiteId(first || "");
          setSiteRow(list[0] || null);
        } else {
          setSiteId("");
          setSiteRow(null);
        }
      } catch (e) {
        if (!cancel) setError(`Failed to load sites: ${e.message}`);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // keep selected row in sync
  useEffect(() => {
    if (!siteId) {
      setSiteRow(null);
      return;
    }
    const found = sites.find((s) => getId(s) === siteId) || null;
    setSiteRow(found);
  }, [siteId, sites]);

  // ---- analytics fetch
  const fetchAnalytics = async (currentId) => {
    const [u, h, c] = await Promise.all([
      api
        .get(`/analytics/uptime${qs({ siteId: currentId, hours: 24 })}`)
        .catch(() => null),
      api
        .get(`/analytics/uptime-hourly${qs({ siteId: currentId, hours: 24 })}`)
        .catch(() => []),
      fetchChecksCompat(currentId, 100),
    ]);
    setUptime(u || null);
    setHourly(Array.isArray(h) ? h : []);
    setChecks(Array.isArray(c) ? c : []);
  };

  useEffect(() => {
    if (!siteId) return;
    latestIdRef.current = siteId;
    fetchAnalytics(siteId).catch((e) =>
      setError(`Failed to load analytics: ${e.message}`)
    );
  }, [siteId]);

  // ----  append checks for current site
  useEffect(() => {
    const onCheck = (evt) => {
      const evtSite = evt?.site?.toString?.() || evt?.site;
      if (!evtSite || !latestIdRef.current) return;
      if (evtSite.toString() !== latestIdRef.current.toString()) return;

      // Optimistic prepend; cap to 200
      setChecks((prev) =>
        [{ _id: `${evtSite}-${evt.createdAt}`, ...evt }, ...prev].slice(0, 200)
      );
    };

    socket.on("analytics:check", onCheck);
    return () => socket.off("analytics:check", onCheck);
  }, []);

  // ---- auto refresh (30s)
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!autoRefresh || !siteId) return;
    const tick = async () => {
      if (document.hidden) return;
      const id = latestIdRef.current;
      if (!id) return;
      try {
        await fetchAnalytics(id);
      } catch {}
    };
    tick();
    intervalRef.current = setInterval(tick, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, siteId]);

  // ---- derived UI
  const hourBlocks = useMemo(() => {
    const colorFor = (p) => {
      if (p == null) return "gray.600";
      if (p >= 99) return "green.400";
      if (p >= 80) return "yellow.400";
      return "red.400";
    };
    return hourly.map((h, idx) => ({
      key: `${h.hour}-${idx}`,
      hour: h.hour,
      color: colorFor(h.percent),
      hint: h.percent == null ? "no samples" : `${Math.round(h.percent)}%`,
    }));
  }, [hourly]);

  const rtStats = useMemo(() => {
    const nums = checks
      .map((c) => (typeof c.responseTime === "number" ? c.responseTime : null))
      .filter((n) => n != null)
      .sort((a, b) => a - b);
    const n = nums.length;
    if (!n) return null;
    const avg = Math.round(nums.reduce((a, b) => a + b, 0) / n);
    const p95 = nums[Math.min(n - 1, Math.floor(0.95 * n))];
    const min = nums[0];
    const max = nums[n - 1];
    return { avg, p95, min, max, count: n };
  }, [checks]);

  const stableSince = useMemo(() => {
    if (!checks.length) return null;
    const latest = checks[0]?.status;
    let i = 1;
    while (i < checks.length && checks[i].status === latest) i++;
    const pivot = checks[Math.max(0, i - 1)];
    return pivot?.createdAt ? dayjs(pivot.createdAt).fromNow() : null;
  }, [checks]);

  // ---- helpers
  const replaceSiteInList = (updated) => {
    const id = getId(updated);
    setSites((prev) => {
      const idx = prev.findIndex((s) => getId(s) === id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updated };
      return copy;
    });
    setSiteRow((prev) => (getId(prev) === id ? { ...prev, ...updated } : prev));
  };

  const refreshSelectedSite = async (id) => {
    if (!id) return;
    try {
      const res = await api.get(`/websites/${id}`);
      const site = res?.item || res;
      if (site) replaceSiteInList(site);
    } catch {
      try {
        const resList = await api.get("/websites");
        const list = Array.isArray(resList) ? resList : resList?.items || [];
        setSites(list);
        const found = list.find((s) => getId(s) === id);
        if (found) setSiteRow(found);
      } catch {}
    }
  };

  // ---- render
  if (loading) return <Spinner mt={6} />;
  if (error)
    return (
      <Text color="red.300" mt={4}>
        {error}
      </Text>
    );
  if (!sites.length) return <EmptyStateSiteOverview />;
  if (!siteRow) return <Text mt={4}>Select a site to view details.</Text>;

  const status = siteRow.status || "PENDING";
  const isUp = status === "UP";
  const sslDaysLeft = siteRow.sslDaysLeft;
  const sslValidTo = fmtDate(siteRow.sslValidTo);
  const sslBadgeColor =
    typeof sslDaysLeft === "number"
      ? sslDaysLeft <= 7
        ? "red"
        : sslDaysLeft <= 30
        ? "yellow"
        : "green"
      : "gray";
  const domainDaysLeft = siteRow.domainDaysLeft;
  const domainExpiresAt = fmtDate(siteRow.domainExpiresAt);
  const domainBadgeColor =
    typeof domainDaysLeft === "number"
      ? domainDaysLeft <= 7
        ? "red"
        : domainDaysLeft <= 30
        ? "yellow"
        : "green"
      : "gray";
  const checkedAgo = siteRow.lastChecked
    ? dayjs(siteRow.lastChecked).fromNow()
    : "Not checked yet";
  const rt = siteRow.responseTime != null ? `${siteRow.responseTime} ms` : "—";

  const exportCsv = () => {
    if (!checks.length) {
      toast({ title: "No checks to export", status: "info" });
      return;
    }
    const blob = new Blob([toCsv(checks)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (siteRow.url || "site")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    a.href = url;
    a.download = `${safe}_checks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openSite = () => {
    if (siteRow?.url) window.open(siteRow.url, "_blank", "noopener,noreferrer");
  };

  return (
    <Box>
      <Heading size="lg" mb={6}>
        Site Overview
      </Heading>

      {/* Picker + actions */}
      <HStack mb={6} spacing={4} wrap="wrap">
        <HStack spacing={4}>
          <Text minW="72px">Website:</Text>
          <Select
            maxW="480px"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {sites.map((s) => {
              const id = getId(s);
              return (
                <option key={id} value={id}>
                  {s.url || id}
                </option>
              );
            })}
          </Select>
        </HStack>

        <HStack ml="auto" spacing={2}>
          <Tooltip label="Open website">
            <IconButton
              aria-label="Open website"
              icon={<ExternalLinkIcon />}
              variant="outline"
              onClick={openSite}
            />
          </Tooltip>
          <Tooltip label="Export recent checks (CSV)">
            <IconButton
              aria-label="Export CSV"
              icon={<DownloadIcon />}
              variant="outline"
              onClick={exportCsv}
            />
          </Tooltip>
          <Tooltip label="Refresh now">
            <IconButton
              aria-label="Refresh"
              icon={<RepeatIcon />}
              variant="outline"
              onClick={async () => {
                try {
                  await api.post(`/websites/${siteId}/check-now`);
                } catch {}
                try {
                  await fetchAnalytics(siteId);
                  await refreshSelectedSite(siteId);
                } catch {}
              }}
            />
          </Tooltip>
          <HStack pl={2}>
            <Text fontSize="sm" color="muted">
              Auto refresh
            </Text>
            <Switch
              isChecked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
          </HStack>
        </HStack>
      </HStack>

      {/* Status row */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={6}>
        <Box
          bg="surface"
          border="1px solid"
          borderColor="border"
          rounded="xl"
          p={4}
        >
          <Stat>
            <StatLabel>Current Status</StatLabel>
            <StatNumber>
              <Badge
                colorScheme={isUp ? "green" : "red"}
                variant="subtle"
                fontSize="md"
                px={2}
                py={1}
                rounded="md"
              >
                {status}
              </Badge>
            </StatNumber>
            <StatHelpText mt={2} color="muted">
              Response time: {rt}
            </StatHelpText>
            {stableSince && (
              <StatHelpText mt={1} color="muted">
                Stable since {stableSince}
              </StatHelpText>
            )}
          </Stat>
        </Box>
        <Box
          bg="surface"
          border="1px solid"
          borderColor="border"
          rounded="xl"
          p={4}
        >
          <Stat>
            <StatLabel>Last Checked</StatLabel>
            <StatNumber fontSize="lg">
              {fmtDate(siteRow.lastChecked)}
            </StatNumber>
            <StatHelpText mt={2} color="muted">
              {checkedAgo}
            </StatHelpText>
          </Stat>
        </Box>
        <Box
          bg="surface"
          border="1px solid"
          borderColor="border"
          rounded="xl"
          p={4}
        >
          <Stat>
            <StatLabel>Uptime (24h)</StatLabel>
            <StatNumber fontSize="lg">
              {typeof uptime?.uptimePercent === "number"
                ? `${uptime.uptimePercent}%`
                : "N/A"}
            </StatNumber>
            <StatHelpText mt={2} color="muted">
              Samples: {uptime?.total ?? 0} • UP: {uptime?.upCount ?? 0}
            </StatHelpText>
          </Stat>
        </Box>
      </SimpleGrid>

      {/* Uptime bar (hourly) */}
      <Box
        bg="surface"
        border="1px solid"
        borderColor="border"
        rounded="xl"
        p={4}
        mb={6}
      >
        <HStack justify="space-between" mb={3}>
          <Text fontWeight="semibold">Last 24h (hourly)</Text>
          <Text fontSize="sm" color="muted">
            Green ≥ 99%, Yellow 80–98%, Red &lt; 80%
          </Text>
        </HStack>
        <HStack spacing={1}>
          {hourBlocks.length === 0 && (
            <Text color="muted">No check data in the last 24 hours.</Text>
          )}
          {hourBlocks.map((b) => (
            <Tooltip key={b.key} label={`${b.hour} • ${b.hint}`} hasArrow>
              <Box flex="1" h="16px" bg={b.color} rounded="sm" />
            </Tooltip>
          ))}
        </HStack>
      </Box>

      {/* SSL & Domain */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={6}>
        <Box
          bg="surface"
          border="1px solid"
          borderColor="border"
          rounded="xl"
          p={4}
        >
          <Heading size="sm" mb={2}>
            SSL Certificate
          </Heading>
          <Divider borderColor="border" mb={3} />
          <VStack align="start" spacing={2}>
            <HStack>
              <Text>Valid until:</Text>
              <Badge colorScheme={sslBadgeColor} variant="subtle">
                {fmtDate(siteRow.sslValidTo)}
              </Badge>
            </HStack>
            <HStack>
              <Text>Days left:</Text>
              <Badge colorScheme={sslBadgeColor} variant="subtle">
                {typeof sslDaysLeft === "number"
                  ? plural(sslDaysLeft, "day")
                  : "—"}
              </Badge>
            </HStack>
            {siteRow.sslError && (
              <Text color="red.300" fontSize="sm">
                Note: {siteRow.sslError}
              </Text>
            )}
          </VStack>
        </Box>
        <Box
          bg="surface"
          border="1px solid"
          borderColor="border"
          rounded="xl"
          p={4}
        >
          <Heading size="sm" mb={2}>
            Domain Registration
          </Heading>
          <Divider borderColor="border" mb={3} />
          <VStack align="start" spacing={2}>
            <HStack>
              <Text>TLD:</Text>
              <Badge variant="subtle">{siteRow.domainTLD || "—"}</Badge>
            </HStack>
            <HStack>
              <Text>Expires at:</Text>
              <Badge colorScheme={domainBadgeColor} variant="subtle">
                {fmtDate(siteRow.domainExpiresAt)}
              </Badge>
            </HStack>
            <HStack>
              <Text>Days left:</Text>
              <Badge colorScheme={domainBadgeColor} variant="subtle">
                {typeof domainDaysLeft === "number"
                  ? plural(domainDaysLeft, "day")
                  : "—"}
              </Badge>
            </HStack>
            {siteRow.domainError && (
              <Text color="red.300" fontSize="sm">
                Note: {siteRow.domainError}
              </Text>
            )}
          </VStack>
        </Box>
      </SimpleGrid>

      {/* Response time quick stats */}
      <Box
        bg="surface"
        border="1px solid"
        borderColor="border"
        rounded="xl"
        p={4}
        mb={6}
      >
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="semibold">Response time (recent checks)</Text>
          {rtStats && (
            <Text fontSize="sm" color="muted">
              {rtStats.count} samples
            </Text>
          )}
        </HStack>
        {rtStats ? (
          <HStack spacing={3} wrap="wrap">
            <Badge variant="subtle" colorScheme="blue">
              Avg: {rtStats.avg} ms
            </Badge>
            <Badge variant="subtle" colorScheme="purple">
              P95: {rtStats.p95} ms
            </Badge>
            <Badge variant="subtle" colorScheme="green">
              Fastest: {rtStats.min} ms
            </Badge>
            <Badge variant="subtle" colorScheme="orange">
              Slowest: {rtStats.max} ms
            </Badge>
          </HStack>
        ) : (
          <Text color="muted">No response-time data yet.</Text>
        )}
      </Box>

      {/* Recent checks */}
      <Box
        bg="surface"
        border="1px solid"
        borderColor="border"
        rounded="xl"
        p={0}
      >
        <Box px={4} py={3}>
          <Text fontWeight="semibold">Recent checks</Text>
        </Box>
        <Divider borderColor="border" />
        <VStack align="stretch" spacing={0} maxH="50vh" overflowY="auto">
          {checks.length === 0 && (
            <Text px={4} py={3} color="muted">
              No checks yet for this site.
            </Text>
          )}
          {checks.map((c) => (
            <HStack
              key={c._id || `${c.site}-${c.createdAt}`}
              px={4}
              py={2.5}
              _notLast={{ borderBottom: "1px solid", borderColor: "border" }}
              spacing={4}
            >
              <Badge
                colorScheme={c.status === "UP" ? "green" : "red"}
                variant="subtle"
              >
                {c.status}
              </Badge>
              <Text fontSize="sm" color="muted">
                {fmtDate(c.createdAt)}
              </Text>
              <Text fontSize="sm" ml="auto" color="muted">
                {typeof c.responseTime === "number"
                  ? `${c.responseTime} ms`
                  : "—"}
              </Text>
            </HStack>
          ))}
        </VStack>
      </Box>
    </Box>
  );
}
