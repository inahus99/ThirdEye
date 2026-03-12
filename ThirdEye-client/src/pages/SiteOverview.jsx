// src/pages/SiteOverview.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Box, Heading, Select, Text, SimpleGrid, HStack, VStack, Badge, Stat,
  Button, StatLabel, StatNumber, StatHelpText, Divider, Spinner, Tooltip,
  Switch, IconButton, useToast, Flex,
} from "@chakra-ui/react";
import { DownloadIcon, RepeatIcon, ExternalLinkIcon, LockIcon, ArrowUpIcon, ArrowDownIcon, TimeIcon } from "@chakra-ui/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { api, qs } from "../lib/api";
import { socket } from "../lib/socket";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip as CTip,
  Filler,
} from "chart.js";

dayjs.extend(relativeTime);

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, CTip, Filler);
ChartJS.defaults.color = "#94a3b8";
ChartJS.defaults.borderColor = "rgba(148,163,184,0.08)";

const card = {
  bg: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  backdropFilter: "blur(8px)",
};

const LINE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(15,23,42,0.9)",
      titleColor: "#e2e8f0",
      bodyColor: "#94a3b8",
      borderColor: "rgba(99,102,241,0.3)",
      borderWidth: 1,
      padding: 10,
      callbacks: { label: (ctx) => ` ${ctx.parsed.y} ms` },
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(148,163,184,0.06)" },
      border: { display: false },
      ticks: { maxTicksLimit: 8, font: { size: 10 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: "rgba(148,163,184,0.06)" },
      border: { display: false },
      ticks: { font: { size: 10 }, callback: (v) => `${v}ms` },
    },
  },
};

const fmtDate = (d) => (d ? dayjs(d).format("YYYY-MM-DD HH:mm:ss") : "—");
const plural = (n, s) => `${n} ${s}${n === 1 ? "" : "s"}`;

const toCsv = (rows) => {
  const header = ["status", "responseTime", "createdAt", "site"];
  const lines = [header.join(",")];
  rows.forEach((r) => {
    const vals = [r.status ?? "", r.responseTime ?? "", r.createdAt ? new Date(r.createdAt).toISOString() : "", r.site ?? ""];
    lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  });
  return lines.join("\n");
};

async function fetchChecksCompat(siteId, limit = 100) {
  const variants = [qs({ siteId, limit }), qs({ site: siteId, limit }), qs({ website: siteId, limit })];
  for (const v of variants) {
    try {
      const res = await api.get(`/analytics/checks${v}`);
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.items)) return res.items;
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.results)) return res.results;
    } catch { /* try next */ }
  }
  return [];
}

const StatusPulse = ({ status }) => (
  <Box position="relative" display="inline-flex" alignItems="center">
    {status === "UP" && (
      <Box
        position="absolute" w="18px" h="18px" rounded="full" bg="green.400" opacity={0.3}
        animation="ping 1.5s cubic-bezier(0,0,0.2,1) infinite"
        sx={{ "@keyframes ping": { "75%,100%": { transform: "scale(2)", opacity: 0 } } }}
      />
    )}
    <Box
      w="12px" h="12px" rounded="full"
      bg={status === "UP" ? "green.400" : status === "DOWN" ? "red.400" : "gray.500"}
    />
  </Box>
);

function DaysLeftBar({ days, max = 90 }) {
  if (typeof days !== "number") return null;
  const pct = Math.min(100, Math.max(0, (days / max) * 100));
  const color = days <= 7 ? "#f87171" : days <= 30 ? "#fbbf24" : "#4ade80";
  return (
    <Box w="100%" bg="rgba(255,255,255,0.08)" rounded="full" h="4px" mt={1}>
      <Box h="4px" rounded="full" bg={color} w={`${pct}%`} transition="width 0.4s ease" />
    </Box>
  );
}

function EmptyStateSiteOverview() {
  return (
    <Box textAlign="center" py={20}>
      <Box fontSize="56px" mb={4}>🔭</Box>
      <Heading size="lg" mb={2} bgGradient="linear(to-r, white, whiteAlpha.600)" bgClip="text">
        No websites yet
      </Heading>
      <Text color="whiteAlpha.500" mb={6}>
        Add your first website to start monitoring uptime & response time.
      </Text>
      <HStack spacing={3} justify="center">
        <a href="/dashboard">
          <Button bgGradient="linear(to-r, purple.500, blue.500)" color="white"
            _hover={{ bgGradient: "linear(to-r, purple.600, blue.600)" }}>
            Go to Dashboard
          </Button>
        </a>
        <a href="/clients">
          <Button variant="outline" borderColor="whiteAlpha.300" color="whiteAlpha.700"
            _hover={{ bg: "whiteAlpha.100" }}>
            Open Clients
          </Button>
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
  const [refreshingSsl, setRefreshingSsl] = useState(false);

  const intervalRef = useRef(null);
  const latestIdRef = useRef(siteId);
  const getId = (s) => s?._id || s?.id || s?.siteId || null;

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/websites");
        const list = Array.isArray(res) ? res : (res?.items || []);
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
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!siteId) { setSiteRow(null); return; }
    const found = sites.find((s) => getId(s) === siteId) || null;
    setSiteRow(found);
  }, [siteId, sites]);

  const fetchAnalytics = async (currentId) => {
    const [u, h, c] = await Promise.all([
      api.get(`/analytics/uptime${qs({ siteId: currentId, hours: 24 })}`).catch(() => null),
      api.get(`/analytics/uptime-hourly${qs({ siteId: currentId, hours: 24 })}`).catch(() => []),
      fetchChecksCompat(currentId, 100),
    ]);
    setUptime(u || null);
    setHourly(Array.isArray(h) ? h : []);
    setChecks(Array.isArray(c) ? c : []);
  };

  useEffect(() => {
    if (!siteId) return;
    latestIdRef.current = siteId;
    fetchAnalytics(siteId).catch((e) => setError(`Failed to load analytics: ${e.message}`));
  }, [siteId]);

  useEffect(() => {
    const onCheck = (evt) => {
      const evtSite = evt?.site?.toString?.() || evt?.site;
      if (!evtSite || !latestIdRef.current) return;
      if (evtSite.toString() !== latestIdRef.current.toString()) return;
      setChecks((prev) => [{ _id: `${evtSite}-${evt.createdAt}`, ...evt }, ...prev].slice(0, 200));
    };
    socket.on("analytics:check", onCheck);
    return () => socket.off("analytics:check", onCheck);
  }, []);

  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (!autoRefresh || !siteId) return;
    const tick = async () => {
      if (document.hidden) return;
      const id = latestIdRef.current;
      if (!id) return;
      try { await fetchAnalytics(id); } catch {}
    };
    tick();
    intervalRef.current = setInterval(tick, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, siteId]);

  const hourBlocks = useMemo(() => {
    const colorFor = (p) => {
      if (p == null) return "rgba(255,255,255,0.08)";
      if (p >= 99) return "#4ade80";
      if (p >= 80) return "#fbbf24";
      return "#f87171";
    };
    return hourly.map((h, idx) => ({
      key: `${h.hour}-${idx}`, hour: h.hour,
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
    return { avg, p95, min: nums[0], max: nums[n - 1], count: n };
  }, [checks]);

  const stableSince = useMemo(() => {
    if (!checks.length) return null;
    const latest = checks[0]?.status;
    let i = 1;
    while (i < checks.length && checks[i].status === latest) i++;
    const pivot = checks[Math.max(0, i - 1)];
    return pivot?.createdAt ? dayjs(pivot.createdAt).fromNow() : null;
  }, [checks]);

  const chartData = useMemo(() => {
    const pts = [...checks].reverse().filter((c) => typeof c.responseTime === "number");
    if (!pts.length) return null;
    const isDown = siteRow?.status === "DOWN";
    const color = isDown ? "248,113,113" : "129,140,248";
    return {
      labels: pts.map((c) => dayjs(c.createdAt).format("HH:mm")),
      datasets: [{
        data: pts.map((c) => c.responseTime),
        borderColor: isDown ? "#f87171" : "#818cf8",
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: isDown ? "#f87171" : "#818cf8",
        fill: true,
        backgroundColor: (ctx) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return `rgba(${color},0.1)`;
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, `rgba(${color},0.3)`);
          grad.addColorStop(1, `rgba(${color},0)`);
          return grad;
        },
      }],
    };
  }, [checks, siteRow?.status]);

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
        const list = Array.isArray(resList) ? resList : (resList?.items || []);
        setSites(list);
        const found = list.find((s) => getId(s) === id);
        if (found) setSiteRow(found);
      } catch {}
    }
  };

  const refreshSslDomain = async () => {
    if (!siteId) return;
    setRefreshingSsl(true);
    try {
      const res = await api.post(`/websites/${siteId}/refresh-ssl`);
      const site = res?.item || res;
      if (site) replaceSiteInList(site);
      toast({ title: "SSL & domain info refreshed", status: "success", duration: 2500 });
    } catch (e) {
      toast({ title: "SSL refresh failed", description: e.message, status: "error" });
    } finally {
      setRefreshingSsl(false);
    }
  };

  if (loading) return (
    <VStack align="stretch" spacing={5} pt={4}>
      {[120, 80, 200, 160].map((h, i) => (
        <Box key={i} h={`${h}px`} {...card} rounded="xl" />
      ))}
    </VStack>
  );
  if (error) return <Text color="red.300" mt={4}>{error}</Text>;
  if (!sites.length) return <EmptyStateSiteOverview />;
  if (!siteRow) return <Text mt={4} color="whiteAlpha.500">Select a site to view details.</Text>;

  const status = siteRow.status || "PENDING";
  const isUp = status === "UP";
  const sslDaysLeft = siteRow.sslDaysLeft;
  const domainDaysLeft = siteRow.domainDaysLeft;
  const sslBadgeColor = typeof sslDaysLeft === "number" ? (sslDaysLeft <= 7 ? "red" : sslDaysLeft <= 30 ? "yellow" : "green") : "gray";
  const domainBadgeColor = typeof domainDaysLeft === "number" ? (domainDaysLeft <= 7 ? "red" : domainDaysLeft <= 30 ? "yellow" : "green") : "gray";
  const checkedAgo = siteRow.lastChecked ? dayjs(siteRow.lastChecked).fromNow() : "Not checked yet";
  const rt = siteRow.responseTime != null ? `${siteRow.responseTime} ms` : "—";
  const uptimePct = typeof uptime?.uptimePercent === "number" ? uptime.uptimePercent : null;

  const exportCsv = () => {
    if (!checks.length) { toast({ title: "No checks to export", status: "info" }); return; }
    const blob = new Blob([toCsv(checks)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (siteRow.url || "site").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    a.href = url; a.download = `${safe}_checks.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openSite = () => { if (siteRow?.url) window.open(siteRow.url, "_blank", "noopener,noreferrer"); };
  const hostname = siteRow.url ? (() => { try { return new URL(siteRow.url).hostname; } catch { return siteRow.url; } })() : "—";

  return (
    <VStack align="stretch" spacing={5}>
      {/* Header */}
      <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
        <VStack align="start" spacing={0}>
          <Heading size="lg" bgGradient="linear(to-r, white, whiteAlpha.700)" bgClip="text">
            Site Overview
          </Heading>
          <Text fontSize="xs" color="whiteAlpha.400">{hostname}</Text>
        </VStack>
        <HStack spacing={2} wrap="wrap">
          <Select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            maxW="320px"
            bg="rgba(255,255,255,0.04)"
            border="1px solid rgba(255,255,255,0.1)"
            _hover={{ borderColor: "whiteAlpha.400" }}
            size="sm"
            borderRadius="lg"
          >
            {sites.map((s) => {
              const id = getId(s);
              return <option key={id} value={id} style={{ background: "#0f172a" }}>{s.url || id}</option>;
            })}
          </Select>
          <Tooltip label="Open site"><IconButton aria-label="Open" icon={<ExternalLinkIcon />} size="sm" variant="outline" borderColor="whiteAlpha.200" _hover={{ bg: "whiteAlpha.100" }} onClick={openSite} /></Tooltip>
          <Tooltip label="Export CSV"><IconButton aria-label="CSV" icon={<DownloadIcon />} size="sm" variant="outline" borderColor="whiteAlpha.200" _hover={{ bg: "whiteAlpha.100" }} onClick={exportCsv} /></Tooltip>
          <Tooltip label="Trigger check now">
            <IconButton
              aria-label="Refresh" icon={<RepeatIcon />} size="sm" variant="outline"
              borderColor="whiteAlpha.200" _hover={{ bg: "whiteAlpha.100" }}
              onClick={async () => {
                try { await api.post(`/websites/${siteId}/check-now`); } catch {}
                try { await fetchAnalytics(siteId); await refreshSelectedSite(siteId); } catch {}
              }}
            />
          </Tooltip>
          <HStack {...card} px={3} py={1.5} rounded="lg" spacing={2}>
            <Text fontSize="xs" color="whiteAlpha.600">Auto</Text>
            <Switch isChecked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} size="sm" colorScheme="purple" />
          </HStack>
        </HStack>
      </Flex>

      {/* Hero status banner */}
      <Box
        {...card}
        p={5}
        borderColor={isUp ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}
        bgGradient={isUp
          ? "linear(to-r, rgba(74,222,128,0.05), rgba(255,255,255,0.02))"
          : "linear(to-r, rgba(248,113,113,0.05), rgba(255,255,255,0.02))"}
      >
        <Flex align="center" justify="space-between" wrap="wrap" gap={4}>
          <HStack spacing={4}>
            <StatusPulse status={status} />
            <VStack align="start" spacing={0}>
              <Text fontSize="xs" color="whiteAlpha.500" textTransform="uppercase" letterSpacing="wider">Current Status</Text>
              <HStack spacing={2}>
                <Text fontSize="2xl" fontWeight="bold" color={isUp ? "green.300" : status === "DOWN" ? "red.300" : "gray.400"}>
                  {status}
                </Text>
                {rt !== "—" && (
                  <Badge variant="subtle" colorScheme={siteRow.responseTime > 500 ? "yellow" : "blue"} fontSize="sm" px={2}>
                    {rt}
                  </Badge>
                )}
              </HStack>
              {stableSince && <Text fontSize="xs" color="whiteAlpha.400">Stable since {stableSince}</Text>}
            </VStack>
          </HStack>
          <SimpleGrid columns={3} spacing={6}>
            <VStack align="center" spacing={0}>
              <Text fontSize="xs" color="whiteAlpha.500" textTransform="uppercase" letterSpacing="wider">Uptime 24h</Text>
              <Text fontSize="xl" fontWeight="bold" color={uptimePct === null ? "whiteAlpha.400" : uptimePct >= 99 ? "green.300" : "yellow.300"}>
                {uptimePct !== null ? `${uptimePct}%` : "—"}
              </Text>
            </VStack>
            <VStack align="center" spacing={0}>
              <Text fontSize="xs" color="whiteAlpha.500" textTransform="uppercase" letterSpacing="wider">Samples</Text>
              <Text fontSize="xl" fontWeight="bold">{uptime?.total ?? "—"}</Text>
            </VStack>
            <VStack align="center" spacing={0}>
              <Text fontSize="xs" color="whiteAlpha.500" textTransform="uppercase" letterSpacing="wider">Last check</Text>
              <Text fontSize="sm" fontWeight="medium" color="whiteAlpha.700">{checkedAgo}</Text>
            </VStack>
          </SimpleGrid>
        </Flex>
      </Box>

      {/* Uptime bar (hourly) */}
      <Box {...card} p={5}>
        <HStack justify="space-between" mb={4}>
          <Text fontWeight="semibold" fontSize="sm" color="whiteAlpha.900">Last 24h — hourly uptime</Text>
          <HStack spacing={3} fontSize="xs" color="whiteAlpha.400">
            <HStack spacing={1}><Box w="8px" h="8px" rounded="sm" bg="#4ade80" /><Text>≥99%</Text></HStack>
            <HStack spacing={1}><Box w="8px" h="8px" rounded="sm" bg="#fbbf24" /><Text>80–98%</Text></HStack>
            <HStack spacing={1}><Box w="8px" h="8px" rounded="sm" bg="#f87171" /><Text>&lt;80%</Text></HStack>
          </HStack>
        </HStack>
        {hourBlocks.length === 0 ? (
          <Text color="whiteAlpha.400" fontSize="sm">No check data in the last 24 hours.</Text>
        ) : (
          <HStack spacing={1} align="stretch">
            {hourBlocks.map((b) => (
              <Tooltip key={b.key} label={`${b.hour} • ${b.hint}`} hasArrow>
                <Box flex="1" h="24px" bg={b.color} rounded="sm" opacity={0.85} _hover={{ opacity: 1, transform: "scaleY(1.1)" }} transition="all 0.15s" />
              </Tooltip>
            ))}
          </HStack>
        )}
      </Box>

      {/* Response time chart */}
      <Box {...card} p={5}>
        <HStack justify="space-between" mb={4}>
          <Text fontWeight="semibold" fontSize="sm" color="whiteAlpha.900">Response Time</Text>
          {rtStats && (
            <HStack spacing={3}>
              <Badge variant="subtle" colorScheme="blue" fontSize="xs">Avg {rtStats.avg}ms</Badge>
              <Badge variant="subtle" colorScheme="purple" fontSize="xs">P95 {rtStats.p95}ms</Badge>
              <Badge variant="subtle" colorScheme="green" fontSize="xs">Min {rtStats.min}ms</Badge>
              <Badge variant="subtle" colorScheme="orange" fontSize="xs">Max {rtStats.max}ms</Badge>
            </HStack>
          )}
        </HStack>
        <Box h="160px">
          {chartData ? (
            <Line data={chartData} options={LINE_OPTS} />
          ) : (
            <Flex h="100%" align="center" justify="center" direction="column" gap={2}>
              <Text fontSize="xl">📈</Text>
              <Text color="whiteAlpha.400" fontSize="sm">No response-time data yet.</Text>
            </Flex>
          )}
        </Box>
      </Box>

      {/* SSL & Domain */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box {...card} p={5}>
          <HStack justify="space-between" mb={3}>
            <HStack spacing={2}>
              <Box p={1.5} rounded="md" bg="rgba(129,140,248,0.15)">
                <LockIcon color="purple.300" boxSize={3.5} />
              </Box>
              <Heading size="sm" color="whiteAlpha.900">SSL Certificate</Heading>
            </HStack>
            <Tooltip label="Re-check SSL & domain expiry">
              <IconButton
                aria-label="Refresh SSL" icon={<RepeatIcon />} size="xs" variant="ghost"
                color="whiteAlpha.500" _hover={{ color: "white", bg: "whiteAlpha.100" }}
                isLoading={refreshingSsl} onClick={refreshSslDomain}
              />
            </Tooltip>
          </HStack>
          <Divider borderColor="rgba(255,255,255,0.08)" mb={4} />
          <VStack align="stretch" spacing={3}>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color="whiteAlpha.500">Valid until</Text>
              <Badge colorScheme={sslBadgeColor} variant="subtle" fontSize="xs">{fmtDate(siteRow.sslValidTo)}</Badge>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color="whiteAlpha.500">Days left</Text>
              <Badge colorScheme={sslBadgeColor} variant="subtle" fontSize="sm" fontWeight="bold">
                {typeof sslDaysLeft === "number" ? plural(sslDaysLeft, "day") : "—"}
              </Badge>
            </Flex>
            {typeof sslDaysLeft === "number" && <DaysLeftBar days={sslDaysLeft} />}
            {siteRow.sslCheckedAt && (
              <Text fontSize="xs" color="whiteAlpha.300">Last checked {dayjs(siteRow.sslCheckedAt).fromNow()}</Text>
            )}
          </VStack>
        </Box>

        <Box {...card} p={5}>
          <HStack justify="space-between" mb={3}>
            <HStack spacing={2}>
              <Box p={1.5} rounded="md" bg="rgba(74,222,128,0.12)">
                <TimeIcon color="green.300" boxSize={3.5} />
              </Box>
              <Heading size="sm" color="whiteAlpha.900">Domain Registration</Heading>
            </HStack>
            <Tooltip label="Re-check SSL & domain expiry">
              <IconButton
                aria-label="Refresh domain" icon={<RepeatIcon />} size="xs" variant="ghost"
                color="whiteAlpha.500" _hover={{ color: "white", bg: "whiteAlpha.100" }}
                isLoading={refreshingSsl} onClick={refreshSslDomain}
              />
            </Tooltip>
          </HStack>
          <Divider borderColor="rgba(255,255,255,0.08)" mb={4} />
          <VStack align="stretch" spacing={3}>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color="whiteAlpha.500">Root domain</Text>
              <Badge variant="subtle" colorScheme="gray" fontSize="xs">{siteRow.domainRoot || "—"}</Badge>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color="whiteAlpha.500">Expires</Text>
              <Badge colorScheme={domainBadgeColor} variant="subtle" fontSize="xs">{fmtDate(siteRow.domainExpiresAt)}</Badge>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color="whiteAlpha.500">Days left</Text>
              <Badge colorScheme={domainBadgeColor} variant="subtle" fontSize="sm" fontWeight="bold">
                {typeof domainDaysLeft === "number" ? plural(domainDaysLeft, "day") : "—"}
              </Badge>
            </Flex>
            {typeof domainDaysLeft === "number" && <DaysLeftBar days={domainDaysLeft} max={365} />}
            {siteRow.domainCheckedAt && (
              <Text fontSize="xs" color="whiteAlpha.300">Last checked {dayjs(siteRow.domainCheckedAt).fromNow()}</Text>
            )}
          </VStack>
        </Box>
      </SimpleGrid>

      {/* Recent checks */}
      <Box {...card} overflow="hidden">
        <Box px={5} py={3} borderBottom="1px solid rgba(255,255,255,0.08)">
          <HStack justify="space-between">
            <Text fontWeight="semibold" fontSize="sm" color="whiteAlpha.900">Recent Checks</Text>
            <Text fontSize="xs" color="whiteAlpha.400">{checks.length} records</Text>
          </HStack>
        </Box>
        <VStack align="stretch" spacing={0} maxH="360px" overflowY="auto">
          {checks.length === 0 && (
            <Text px={5} py={4} color="whiteAlpha.400" fontSize="sm">No checks yet for this site.</Text>
          )}
          {checks.map((c, i) => (
            <HStack
              key={c._id || `${c.site}-${c.createdAt}`}
              px={5} py={2.5} spacing={4}
              borderBottom={i < checks.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none"}
              _hover={{ bg: "rgba(255,255,255,0.02)" }}
              transition="background 0.1s"
            >
              <Badge
                colorScheme={c.status === "UP" ? "green" : "red"}
                variant="subtle" px={2} py={0.5} rounded="full" fontSize="xs" minW="40px" textAlign="center"
              >
                {c.status}
              </Badge>
              <Text fontSize="sm" color="whiteAlpha.500">{fmtDate(c.createdAt)}</Text>
              <Text
                fontSize="sm" ml="auto" fontFamily="mono"
                color={typeof c.responseTime === "number" && c.responseTime > 500 ? "yellow.300" : "whiteAlpha.600"}
              >
                {typeof c.responseTime === "number" ? `${c.responseTime}ms` : "—"}
              </Text>
            </HStack>
          ))}
        </VStack>
      </Box>
    </VStack>
  );
}
