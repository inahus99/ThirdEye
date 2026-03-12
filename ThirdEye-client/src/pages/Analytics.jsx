// src/pages/Analytics.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Heading,
  Select,
  Text,
  Badge,
  Divider,
  VStack,
  HStack,
  Spinner,
  SimpleGrid,
  Container,
  Button,
  Kbd,
  IconButton,
  useToast,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Skeleton,
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { Link as RouterLink } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler);
ChartJS.defaults.color = "#94a3b8";
ChartJS.defaults.borderColor = "rgba(148,163,184,0.08)";

const card = {
  bg: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
};

const gridColor = "rgba(148,163,184,0.08)";

const BAR_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(15,23,42,0.9)",
      titleColor: "#e2e8f0",
      bodyColor: "#94a3b8",
      borderColor: "rgba(99,102,241,0.3)",
      borderWidth: 1,
      padding: 10,
      callbacks: { label: (ctx) => ` ${ctx.parsed.y ?? "—"}%` },
    },
  },
  scales: {
    x: { grid: { color: gridColor }, border: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
    y: {
      beginAtZero: true, max: 100,
      ticks: { stepSize: 25, font: { size: 10 }, callback: (v) => `${v}%` },
      grid: { color: gridColor },
      border: { display: false },
    },
  },
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
      borderColor: "rgba(96,165,250,0.3)",
      borderWidth: 1,
      padding: 10,
      callbacks: { label: (ctx) => ` ${ctx.parsed.y ?? "—"} ms` },
    },
  },
  scales: {
    x: { grid: { color: gridColor }, border: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 10 } } },
    y: {
      beginAtZero: true,
      ticks: { font: { size: 10 }, callback: (v) => `${v}ms` },
      grid: { color: gridColor },
      border: { display: false },
    },
  },
};

function EmptyState() {
  return (
    <Container maxW="4xl" py={14}>
      <VStack spacing={6} textAlign="center">
        <Box fontSize="64px" lineHeight="1">📊</Box>
        <VStack spacing={2}>
          <Heading size="lg">Nothing to analyze yet</Heading>
          <Text color="whiteAlpha.600">Add a website first to start collecting uptime and response-time analytics.</Text>
        </VStack>
        <Button as={RouterLink} to="/dashboard" bgGradient="linear(to-r, purple.500, blue.500)" color="white"
          _hover={{ bgGradient: "linear(to-r, purple.600, blue.600)" }}>
          Go to Dashboard
        </Button>
        <Text color="whiteAlpha.500" fontSize="sm">
          Tip: Paste a URL and press <Kbd>Enter</Kbd>. Checks run automatically.
        </Text>
      </VStack>
    </Container>
  );
}

export default function Analytics() {
  const toast = useToast();
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [history, setHistory] = useState([]);
  const [uptime, setUptime] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const getId = (s) => s?._id || s?.id || null;

  // Load websites
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/websites");
        const list = Array.isArray(res) ? res : res?.items || [];
        if (cancelled) return;
        setSites(list);
        const firstId = getId(list[0]);
        if (firstId) setSiteId(firstId);
      } catch {
        if (!cancelled) setSites([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadAnalytics = useCallback(async (sid) => {
    if (!sid) return;
    setAnalyticsLoading(true);
    try {
      const [hist, up, hr] = await Promise.all([
        api.get(`/analytics/checks?siteId=${sid}&limit=200`).then(r => Array.isArray(r) ? r : r?.items || []).catch(() => []),
        api.get(`/analytics/uptime?siteId=${sid}&hours=24`).catch(() => null),
        api.get(`/analytics/uptime-hourly?siteId=${sid}&hours=24`).catch(() => []),
      ]);
      setHistory(hist);
      setUptime(up);
      setHourly(Array.isArray(hr) ? hr : hr?.items || []);
    } catch (e) {
      toast({ title: "Analytics error", description: e.message, status: "error" });
    } finally {
      setAnalyticsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (siteId) loadAnalytics(siteId);
  }, [siteId]);

  // Live socket updates
  useEffect(() => {
    if (!siteId) return;
    const onCheck = (p) => {
      if (p?.site?.toString?.() !== siteId.toString()) return;
      setHistory((prev) => [{ _id: `${p.site}-${p.createdAt}`, ...p }, ...prev].slice(0, 200));
    };
    socket.on("analytics:check", onCheck);
    return () => socket.off("analytics:check", onCheck);
  }, [siteId]);

  const uptimePct = useMemo(() => {
    if (!uptime) return null;
    if (typeof uptime.uptimePercent === "number") return uptime.uptimePercent;
    const up = uptime.upCount;
    const total = uptime.total;
    if (typeof up === "number" && typeof total === "number" && total > 0) return Math.round((up / total) * 100);
    return null;
  }, [uptime]);

  const uptimeColor = uptimePct === null ? "gray" : uptimePct >= 99 ? "green" : uptimePct >= 95 ? "yellow" : "red";

  const uptimeBar = useMemo(() => ({
    labels: hourly.map((h) => h.hour),
    datasets: [{
      label: "Uptime %",
      data: hourly.map((h) => typeof h.percent === "number" ? h.percent : null),
      backgroundColor: (ctx) => {
        const chart = ctx.chart;
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return "rgba(74,222,128,0.4)";
        const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        grad.addColorStop(0, "rgba(74,222,128,0.7)");
        grad.addColorStop(1, "rgba(74,222,128,0.1)");
        return grad;
      },
      borderColor: "#4ade80",
      borderWidth: 1.5,
      borderRadius: 4,
      spanGaps: true,
    }],
  }), [hourly]);

  const rtLine = useMemo(() => {
    const rows = history.slice().reverse();
    return {
      labels: rows.map((c) => new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })),
      datasets: [{
        label: "Response time (ms)",
        data: rows.map((c) => typeof c.responseTime === "number" ? c.responseTime : null),
        spanGaps: true,
        borderColor: "#60a5fa",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "#60a5fa",
        tension: 0.4,
        fill: true,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "rgba(96,165,250,0.1)";
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, "rgba(96,165,250,0.25)");
          grad.addColorStop(1, "rgba(96,165,250,0)");
          return grad;
        },
      }],
    };
  }, [history]);

  if (loading) return (
    <VStack align="stretch" spacing={6}>
      <Skeleton h="40px" rounded="lg" />
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        <Skeleton h="300px" rounded="xl" />
        <Skeleton h="300px" rounded="xl" />
      </SimpleGrid>
      <Skeleton h="200px" rounded="xl" />
    </VStack>
  );
  if (!sites.length) return <EmptyState />;

  const selectedSite = sites.find((s) => getId(s) === siteId);

  return (
    <Box>
      <HStack justify="space-between" mb={5}>
        <VStack align="start" spacing={0}>
          <Heading size="lg" bgGradient="linear(to-r, white, whiteAlpha.700)" bgClip="text">Analytics</Heading>
          {selectedSite && <Text fontSize="xs" color="whiteAlpha.500">{selectedSite.url}</Text>}
        </VStack>
        <HStack>
          <Select
            maxW="320px"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            bg="rgba(255,255,255,0.04)"
            border="1px solid rgba(255,255,255,0.1)"
            _hover={{ borderColor: "whiteAlpha.400" }}
            size="sm"
            borderRadius="lg"
          >
            {sites.map((s) => {
              const id = getId(s);
              return <option key={id} value={id} style={{ background: "#0f172a" }}>{s?.url || id}</option>;
            })}
          </Select>
          <IconButton
            size="sm" variant="outline" aria-label="Refresh analytics"
            icon={<RepeatIcon />}
            isLoading={analyticsLoading}
            onClick={() => siteId && loadAnalytics(siteId)}
            borderColor="whiteAlpha.200"
            _hover={{ bg: "whiteAlpha.100" }}
          />
        </HStack>
      </HStack>

      {/* KPI row */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={5}>
        <Box {...card} p={4}>
          <Stat>
            <StatLabel fontSize="xs" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="wider">Uptime (24h)</StatLabel>
            <StatNumber fontSize="xl" color={uptimePct === null ? "whiteAlpha.400" : uptimePct >= 99 ? "green.300" : "yellow.300"}>
              {uptimePct !== null ? `${uptimePct}%` : "—"}
            </StatNumber>
          </Stat>
        </Box>
        <Box {...card} p={4}>
          <Stat>
            <StatLabel fontSize="xs" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="wider">Samples</StatLabel>
            <StatNumber fontSize="xl">{uptime?.total ?? "—"}</StatNumber>
          </Stat>
        </Box>
        <Box {...card} p={4}>
          <Stat>
            <StatLabel fontSize="xs" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="wider">UP checks</StatLabel>
            <StatNumber fontSize="xl" color="green.300">{uptime?.upCount ?? "—"}</StatNumber>
          </Stat>
        </Box>
        <Box {...card} p={4}>
          <Stat>
            <StatLabel fontSize="xs" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="wider">Avg Response</StatLabel>
            <StatNumber fontSize="xl" color="blue.300">
              {history.length > 0
                ? `${Math.round(history.filter(c => typeof c.responseTime === "number").reduce((a, c) => a + c.responseTime, 0) / Math.max(history.filter(c => typeof c.responseTime === "number").length, 1))}ms`
                : "—"}
            </StatNumber>
          </Stat>
        </Box>
      </SimpleGrid>

      {/* Charts */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} mb={5}>
        <Box {...card} p={5} minH="300px">
          <HStack justify="space-between" mb={3}>
            <Text fontWeight="semibold" fontSize="sm">Uptime (last 24h)</Text>
            <Badge colorScheme={uptimeColor} variant="subtle" px={2} py={0.5} rounded="full" fontSize="xs">
              {uptimePct !== null ? `${uptimePct}%` : "N/A"}
            </Badge>
          </HStack>
          <Box h="240px">
            {analyticsLoading ? (
              <VStack h="100%" justify="center"><Spinner size="sm" /><Text fontSize="sm" color="whiteAlpha.500">Loading…</Text></VStack>
            ) : hourly.filter(h => h.percent !== null).length ? (
              <Bar data={uptimeBar} options={BAR_OPTS} />
            ) : (
              <VStack h="100%" justify="center" color="whiteAlpha.500">
                <Text>No hourly data yet.</Text>
                <Text fontSize="sm">Checks will appear automatically.</Text>
              </VStack>
            )}
          </Box>
        </Box>

        <Box {...card} p={5} minH="300px">
          <Text fontWeight="semibold" fontSize="sm" mb={3}>Response Time (recent)</Text>
          <Box h="240px">
            {analyticsLoading ? (
              <VStack h="100%" justify="center"><Spinner size="sm" /><Text fontSize="sm" color="whiteAlpha.500">Loading…</Text></VStack>
            ) : history.filter(c => typeof c.responseTime === "number").length ? (
              <Line data={rtLine} options={LINE_OPTS} />
            ) : (
              <VStack h="100%" justify="center" color="whiteAlpha.500">
                <Text>No checks yet.</Text>
                <Text fontSize="sm">Once monitoring runs, data will show here.</Text>
              </VStack>
            )}
          </Box>
        </Box>
      </SimpleGrid>

      {/* Recent checks */}
      <Box {...card} overflow="hidden">
        <Box px={5} py={3} borderBottom="1px solid rgba(255,255,255,0.08)">
          <HStack justify="space-between">
            <Text fontWeight="semibold" fontSize="sm">Recent Checks</Text>
            <Text fontSize="xs" color="whiteAlpha.400">{history.length} records</Text>
          </HStack>
        </Box>
        <VStack align="stretch" spacing={0} maxH="50vh" overflowY="auto">
          {history.length === 0 && (
            <Text px={5} py={4} color="whiteAlpha.500" fontSize="sm">No checks found.</Text>
          )}
          {history.map((c, i) => (
            <HStack
              key={c._id || `${c.site}-${c.createdAt}-${i}`}
              px={5} py={2.5}
              spacing={4}
              borderBottom={i < history.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none"}
              _hover={{ bg: "rgba(255,255,255,0.02)" }}
              transition="background 0.1s"
            >
              <Badge
                colorScheme={c.status === "UP" ? "green" : "red"}
                variant="subtle" px={2} py={0.5} rounded="full" fontSize="xs" minW="40px" textAlign="center"
              >
                {c.status}
              </Badge>
              <Text fontSize="sm" color="whiteAlpha.600">{new Date(c.createdAt).toLocaleString()}</Text>
              <Text fontSize="sm" ml="auto" color={typeof c.responseTime === "number" && c.responseTime > 500 ? "yellow.300" : "whiteAlpha.500"} fontFamily="mono">
                {typeof c.responseTime === "number" ? `${c.responseTime}ms` : "—"}
              </Text>
            </HStack>
          ))}
        </VStack>
      </Box>
    </Box>
  );
}
