// src/pages/Analytics.jsx
import React, { useEffect, useMemo, useState } from "react";
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
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { Link as RouterLink } from "react-router-dom";

// charts
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
);
ChartJS.defaults.color = "#cbd5e1";
ChartJS.defaults.borderColor = "rgba(255,255,255,0.08)";

function EmptyState() {
  return (
    <Container maxW="4xl" py={14}>
      <VStack spacing={8} textAlign="center">
        <Box fontSize="64px" lineHeight="1" role="img" aria-label="chart">
          📊
        </Box>
        <VStack spacing={2}>
          <Heading size="lg">Nothing to analyze yet</Heading>
          <Text color="whiteAlpha.700">
            Add a website first to start collecting uptime and response-time
            analytics.
          </Text>
        </VStack>
        <Button as={RouterLink} to="/dashboard" colorScheme="blue" size="md">
          Go to Dashboard
        </Button>
        <HStack spacing={4} mt={2} flexWrap="wrap" justify="center">
          <Text color="whiteAlpha.700">
            Tip: Paste a URL and press <Kbd>Enter</Kbd>. Checks run
            automatically every few minutes.
          </Text>
        </HStack>
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

  const getId = (s) => s?._id || s?.id || s?.siteId || null;
  const q = (o) =>
    `?${new URLSearchParams(
      Object.fromEntries(
        Object.entries(o).filter(([, v]) => v !== undefined && v !== null)
      )
    )}`;

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
        const first = getId(list[0]);
        if (first) setSiteId(first);
      } catch (e) {
        if (!cancelled) setSites([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Compatibility fetch for checks (siteId | site | website)
  const fetchChecksCompat = async (sid, limit = 200) => {
    const tryKeys = ["siteId", "site", "website"];
    for (const key of tryKeys) {
      try {
        const res = await api.get(
          `/analytics/checks${q({ [key]: sid, limit })}`
        );
        const rows = Array.isArray(res) ? res : res?.items || [];
        if (rows.length) return rows;
      } catch {
        /* try next key */
      }
    }

    try {
      const res = await api.get(
        `/analytics/checks${q({ siteId: sid, limit })}`
      );
      return Array.isArray(res) ? res : res?.items || [];
    } catch {
      return [];
    }
  };

  // Load analytics for a site
  const loadAnalytics = async (sid) => {
    if (!sid) return;
    try {
      const [hist, up, hr] = await Promise.all([
        fetchChecksCompat(sid, 200),
        api
          .get(`/analytics/uptime${q({ siteId: sid, hours: 24 })}`)
          .catch(() => null),
        api
          .get(`/analytics/uptime-hourly${q({ siteId: sid, hours: 24 })}`)
          .catch(() => []),
      ]);
      setHistory(hist);
      setUptime(up || null);
      setHourly(Array.isArray(hr) ? hr : hr?.items || []);
    } catch (e) {
      toast({
        title: "Analytics error",
        description: e.message,
        status: "error",
      });
    }
  };

  useEffect(() => {
    if (siteId) loadAnalytics(siteId);
  }, [siteId]);

  // Live updates (optimistic only)
  useEffect(() => {
    if (!siteId) return;
    const onCheck = (p) => {
      if (p?.site?.toString?.() === siteId.toString()) {
        setHistory((prev) =>
          [{ _id: `${p.site}-${p.createdAt}`, ...p }, ...prev].slice(0, 200)
        );
      }
    };
    socket.on("analytics:check", onCheck);
    return () => socket.off("analytics:check", onCheck);
  }, [siteId]);

  // Uptime %
  const uptimePct = useMemo(() => {
    if (!uptime) return null;
    if (typeof uptime.uptimePercent === "number") return uptime.uptimePercent;
    if (typeof uptime.uptime === "number") return Math.round(uptime.uptime);
    const up = uptime.upCount ?? uptime.ok;
    const total = uptime.total;
    if (typeof up === "number" && typeof total === "number" && total > 0) {
      return Math.round((up / total) * 100);
    }
    return null;
  }, [uptime]);

  const samplesText = useMemo(() => {
    if (!uptime) return "Samples: 0";
    const up = uptime.upCount ?? uptime.ok ?? 0;
    const total = uptime.total ?? 0;
    return `Samples: ${total} • UP: ${up}`;
  }, [uptime]);

  // Charts
  const uptimeBar = useMemo(() => {
    const labels = hourly.map((h) => h.hour);
    const data = hourly.map((h) =>
      typeof h.percent === "number" ? h.percent : 0
    );
    return {
      labels,
      datasets: [
        {
          label: "Uptime %",
          data,
          backgroundColor: "rgba(34,197,94,0.35)",
          borderColor: "#22c55e",
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    };
  }, [hourly]);

  const rtLine = useMemo(() => {
    const rows = history.slice().reverse();
    const labels = rows.map((c) => new Date(c.createdAt).toLocaleTimeString());
    const data = rows.map((c) =>
      typeof c.responseTime === "number" ? c.responseTime : null
    );
    return {
      labels,
      datasets: [
        {
          label: "Response time (ms)",
          data,
          spanGaps: true,
          borderWidth: 2,
          borderColor: "#60a5fa",
          pointRadius: 0,
          tension: 0.3,
          fill: true,
          backgroundColor: "rgba(96,165,250,0.12)",
        },
      ],
    };
  }, [history]);

  const gridColor = "rgba(255,255,255,0.08)";
  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { grid: { color: gridColor } },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20 },
        grid: { color: gridColor },
      },
    },
  };
  const lineOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { grid: { color: gridColor } },
      y: { beginAtZero: true, grid: { color: gridColor } },
    },
  };

  if (loading) return <Spinner mt={6} />;
  if (!sites.length) return <EmptyState />;

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="lg">Analytics</Heading>
        <IconButton
          size="sm"
          variant="outline"
          aria-label="Refresh analytics"
          icon={<RepeatIcon />}
          onClick={() => siteId && loadAnalytics(siteId)}
        />
      </HStack>

      {/* Site picker */}
      <HStack spacing={4} mb={6}>
        <Text minW="72px">Website:</Text>
        <Select
          maxW="420px"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          {sites.map((s) => {
            const id = getId(s);
            const label = s?.url || s?.name || id;
            return (
              <option key={id} value={id}>
                {label}
              </option>
            );
          })}
        </Select>
      </HStack>

      {/* Charts */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
        <Box
          bg="surface"
          border="1px solid"
          borderColor="border"
          rounded="xl"
          p={4}
          minH="320px"
        >
          <HStack justify="space-between" mb={1}>
            <Text>Uptime (last 24h)</Text>
            <Badge
              colorScheme={
                typeof uptimePct === "number" && uptimePct >= 99
                  ? "green"
                  : "yellow"
              }
            >
              {typeof uptimePct === "number" ? uptimePct : "N/A"}%
            </Badge>
          </HStack>
          <Text mt={1} fontSize="sm" color="muted">
            {samplesText}
          </Text>
          <Box mt={3} h="250px">
            {hourly.length ? (
              <Bar data={uptimeBar} options={barOpts} />
            ) : (
              <VStack h="100%" justify="center" color="muted">
                <Text>No hourly uptime data yet.</Text>
                <Text fontSize="sm">
                  Checks will appear automatically after a little while.
                </Text>
              </VStack>
            )}
          </Box>
        </Box>

        <Box
          bg="surface"
          border="1px solid"
          borderColor="border"
          rounded="xl"
          p={4}
          minH="320px"
        >
          <Text fontWeight="semibold" mb={2}>
            Response time (recent checks)
          </Text>
          <Box h="280px">
            {history.length ? (
              <Line data={rtLine} options={lineOpts} />
            ) : (
              <VStack h="100%" justify="center" color="muted">
                <Text>No checks yet.</Text>
                <Text fontSize="sm">
                  Once monitoring runs, data will show here.
                </Text>
              </VStack>
            )}
          </Box>
        </Box>
      </SimpleGrid>

      {/* Recent checks list */}
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
          {history.length === 0 && (
            <Text px={4} py={3} color="muted">
              No checks found in this window.
            </Text>
          )}
          {history.map((c) => (
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
                {new Date(c.createdAt).toLocaleString()}
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
