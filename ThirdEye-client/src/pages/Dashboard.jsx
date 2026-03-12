// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Box,
  Button,
  Badge,
  Flex,
  Heading,
  HStack,
  VStack,
  Text,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useToast,
  Divider,
  Spinner,
  IconButton,
  Collapse,
  Tooltip,
  Skeleton,
} from "@chakra-ui/react";
import {
  AddIcon,
  RepeatIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TimeIcon,
} from "@chakra-ui/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip as CTip,
  Legend,
  Filler,
} from "chart.js";
import { api } from "../lib/api";
import { socket } from "../lib/socket";

dayjs.extend(relativeTime);

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, CTip, Legend, Filler);
ChartJS.defaults.color = "#94a3b8";
ChartJS.defaults.borderColor = "rgba(148,163,184,0.08)";

const card = {
  bg: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  backdropFilter: "blur(8px)",
};

const StatusPulse = ({ status }) => (
  <Box position="relative" display="inline-flex" alignItems="center">
    {status === "UP" && (
      <Box
        position="absolute"
        w="14px" h="14px"
        rounded="full"
        bg="green.400"
        opacity={0.3}
        animation="ping 1.5s cubic-bezier(0,0,0.2,1) infinite"
        sx={{ "@keyframes ping": { "75%,100%": { transform: "scale(2)", opacity: 0 } } }}
      />
    )}
    <Box
      w="10px" h="10px"
      rounded="full"
      bg={status === "UP" ? "green.400" : status === "DOWN" ? "red.400" : "gray.500"}
    />
  </Box>
);

const CHART_OPTIONS = {
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

export default function Dashboard() {
  const toast = useToast();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [bodyMustContain, setBodyMustContain] = useState("");
  const [timeoutMs, setTimeoutMs] = useState(10000);
  const [selectedId, setSelectedId] = useState(null);
  const [historyMap, setHistoryMap] = useState({});
  const [lastManual, setLastManual] = useState(null);
  const prevStatusRef = useRef({});
  const lastToastAtRef = useRef(0);

  const normalizeList = (res) => (Array.isArray(res) ? res : res?.items || []);

  const loadHistoryForSite = useCallback(async (sid, limit = 60) => {
    if (!sid) return;
    try {
      const res = await api.get(`/analytics/checks?siteId=${encodeURIComponent(sid)}&limit=${limit}`);
      const rows = Array.isArray(res?.items) ? res.items : [];
      const pts = rows
        .reverse()
        .filter((r) => typeof r.responseTime === "number")
        .map((r) => ({ t: r.createdAt, rt: r.responseTime }));
      setHistoryMap((prev) => ({ ...prev, [sid]: pts.slice(-100) }));
    } catch { /* ignore */ }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/websites");
        const list = normalizeList(res);
        setSites(list);
        if (list[0]) {
          setSelectedId(list[0]._id);
          // Eagerly load history for all sites in parallel
          list.forEach((s) => loadHistoryForSite(s._id, 60));
        }
      } catch (e) {
        toast({ title: "Failed to load websites", description: e.message, status: "error" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Live socket events
  useEffect(() => {
    const onCheck = (evt) => {
      const siteId = evt.site?.toString();
      const { status, responseTime, createdAt } = evt;

      setSites((prev) => prev.map((s) => s._id === siteId ? { ...s, status, responseTime, lastChecked: createdAt } : s));

      const prev = prevStatusRef.current[siteId];
      if (prev && prev !== status) {
        const now = Date.now();
        if (now - lastToastAtRef.current > 5000) {
          toast({
            title: `Site ${status}`,
            description: `${siteId} is now ${status}.`,
            status: status === "DOWN" ? "error" : "success",
          });
          lastToastAtRef.current = now;
        }
      }
      prevStatusRef.current[siteId] = status;

      if (typeof responseTime === "number") {
        setHistoryMap((prev) => {
          const arr = [...(prev[siteId] || []), { t: createdAt, rt: responseTime }];
          return { ...prev, [siteId]: arr.slice(-100) };
        });
      }
    };

    const onSiteUpdate = (payload) => {
      if (!payload?._id) return;
      setSites((prev) => prev.map((s) => s._id === payload._id ? { ...s, ...payload } : s));
    };

    socket.on("analytics:check", onCheck);
    socket.on("site:update", onSiteUpdate);
    return () => {
      socket.off("analytics:check", onCheck);
      socket.off("site:update", onSiteUpdate);
    };
  }, [toast]);

  const upCount = useMemo(() => sites.filter((s) => s.status === "UP").length, [sites]);
  const downCount = useMemo(() => sites.filter((s) => s.status === "DOWN").length, [sites]);
  const selected = useMemo(() => sites.find((s) => s._id === selectedId) || null, [sites, selectedId]);
  const avgResponseTime = useMemo(() => {
    const withTime = sites.filter((s) => typeof s.responseTime === "number");
    if (!withTime.length) return null;
    return Math.round(withTime.reduce((a, s) => a + s.responseTime, 0) / withTime.length);
  }, [sites]);

  const chartData = useMemo(() => {
    if (!selected) return null;
    const pts = historyMap[selected._id] || [];
    if (!pts.length) return null;
    return {
      labels: pts.map((p) => dayjs(p.t).format("HH:mm")),
      datasets: [{
        label: "Response Time",
        data: pts.map((p) => p.rt),
        borderColor: selected.status === "DOWN" ? "#f87171" : "#818cf8",
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: selected.status === "DOWN" ? "#f87171" : "#818cf8",
        fill: true,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "transparent";
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          const color = selected.status === "DOWN" ? "248,113,113" : "129,140,248";
          grad.addColorStop(0, `rgba(${color},0.3)`);
          grad.addColorStop(1, `rgba(${color},0)`);
          return grad;
        },
      }],
    };
  }, [selected, historyMap]);

  const manualRefresh = async () => {
    try {
      setRefreshingAll(true);
      for (const s of sites) {
        try { await api.post(`/websites/${s._id}/check-now`); } catch { /* ignore */ }
      }
      const res = await api.get("/websites");
      const list = normalizeList(res);
      setSites(list);
      if (selectedId) await loadHistoryForSite(selectedId, 60);
      setLastManual(new Date());
    } catch (e) {
      toast({ title: "Refresh failed", description: e.message, status: "error" });
    } finally {
      setRefreshingAll(false);
    }
  };

  const addSite = async (e) => {
    e.preventDefault();
    if (!newUrl.trim()) { toast({ title: "URL is required", status: "warning" }); return; }
    try {
      setAdding(true);
      const res = await api.post("/websites", {
        checkType: "HTTP",
        timeoutMs,
        url: newUrl.trim(),
        expectedStatus,
        bodyMustContain: bodyMustContain.trim(),
      });
      const site = res?.item || res?.site || res;
      setSites((prev) => [site, ...prev]);
      setSelectedId(site?._id);
      setNewUrl("");
      setBodyMustContain("");
      toast({ title: "Monitor added!", status: "success" });
    } catch (e) {
      const existing = e?.body?.site;
      if (existing) {
        setSites((prev) => prev.some((p) => p._id === existing._id) ? prev : [existing, ...prev]);
        setSelectedId(existing._id);
        setNewUrl("");
        toast({ title: "Already monitoring this site", status: "info" });
      } else {
        toast({ title: "Add failed", description: e.message, status: "error" });
      }
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <VStack align="stretch" spacing={6}>
        <Skeleton h="40px" rounded="lg" />
        <Skeleton h="60px" rounded="lg" />
        <HStack spacing={4}><Skeleton flex="1" h="90px" rounded="lg" /><Skeleton flex="1" h="90px" rounded="lg" /><Skeleton flex="1" h="90px" rounded="lg" /></HStack>
        <Skeleton h="200px" rounded="lg" />
        <Skeleton h="220px" rounded="lg" />
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={5}>
      {/* Header */}
      <Flex wrap="wrap" justify="space-between" align="center" gap={4}>
        <VStack align="start" spacing={0}>
          <Heading size="lg" bgGradient="linear(to-r, white, whiteAlpha.700)" bgClip="text">
            Server Monitoring
          </Heading>
          {lastManual && (
            <Text fontSize="xs" color="whiteAlpha.500">
              Last refresh: {dayjs(lastManual).fromNow()}
            </Text>
          )}
        </VStack>
        <Tooltip label="Trigger checks for all and reload">
          <IconButton
            aria-label="Refresh"
          icon={<RepeatIcon />}
            onClick={manualRefresh}
            isLoading={refreshingAll}
            variant="outline"
            size="sm"
            borderColor="whiteAlpha.200"
            _hover={{ bg: "whiteAlpha.100", borderColor: "whiteAlpha.400" }}
          />
        </Tooltip>
      </Flex>

      {/* Add checker */}
      <Box {...card} p={4}>
        <form onSubmit={addSite}>
          <Flex gap={3} wrap="wrap" align="center">
            <Input
              placeholder="https://example.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              flex="1"
              minW="260px"
              bg="whiteAlpha.50"
              border="1px solid"
              borderColor="whiteAlpha.200"
              _hover={{ borderColor: "whiteAlpha.400" }}
              _focus={{ borderColor: "purple.400", boxShadow: "0 0 0 1px rgba(139,92,246,0.4)" }}
            />
            <Button
              type="submit"
              leftIcon={<AddIcon />}
              isLoading={adding}
              bgGradient="linear(to-r, purple.500, blue.500)"
              color="white"
              _hover={{ bgGradient: "linear(to-r, purple.600, blue.600)", transform: "translateY(-1px)", shadow: "lg" }}
              _active={{ transform: "translateY(0)" }}
              transition="all 0.2s"
              px={6}
            >
              Add Monitor
            </Button>
          </Flex>
          <HStack justify="flex-end" mt={2}>
            <Button
              size="xs"
              variant="ghost"
              color="whiteAlpha.600"
              onClick={() => setShowAdvanced((s) => !s)}
              leftIcon={showAdvanced ? <ChevronUpIcon /> : <ChevronDownIcon />}
            >
              Advanced options
            </Button>
          </HStack>
          <Collapse in={showAdvanced} animateOpacity>
            <HStack spacing={3} wrap="wrap" mt={2}>
              <Input placeholder="Timeout (ms)" type="number" value={timeoutMs}
                onChange={(e) => setTimeoutMs(parseInt(e.target.value || "10000", 10))}
                maxW="180px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" size="sm" />
              <Input placeholder="Expected status (e.g. 200)" type="number" value={expectedStatus}
                onChange={(e) => setExpectedStatus(parseInt(e.target.value || "200", 10))}
                maxW="220px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" size="sm" />
              <Input placeholder="Response must contain… (optional)" value={bodyMustContain}
                onChange={(e) => setBodyMustContain(e.target.value)}
                minW="260px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" size="sm" />
            </HStack>
          </Collapse>
        </form>
      </Box>

      {/* Stats */}
      <HStack spacing={4}>
        <Box {...card} flex="1" p={5}>
          <Stat>
            <StatLabel color="whiteAlpha.600" fontSize="xs" textTransform="uppercase" letterSpacing="wider">Total Monitors</StatLabel>
            <StatNumber fontSize="2xl" fontWeight="bold">{sites.length}</StatNumber>
            <StatHelpText color="whiteAlpha.500" m={0}><TimeIcon mr={1} />Active checks</StatHelpText>
          </Stat>
        </Box>
        <Box {...card} flex="1" p={5} borderColor={upCount > 0 ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.1)"}>
          <Stat>
            <StatLabel color="whiteAlpha.600" fontSize="xs" textTransform="uppercase" letterSpacing="wider">Online</StatLabel>
            <StatNumber fontSize="2xl" fontWeight="bold" color="green.300">
              <ArrowUpIcon mr={1} boxSize={4} />{upCount}
            </StatNumber>
            <StatHelpText color="whiteAlpha.500" m={0}>Sites up</StatHelpText>
          </Stat>
        </Box>
        <Box {...card} flex="1" p={5} borderColor={downCount > 0 ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.1)"}>
          <Stat>
            <StatLabel color="whiteAlpha.600" fontSize="xs" textTransform="uppercase" letterSpacing="wider">Offline</StatLabel>
            <StatNumber fontSize="2xl" fontWeight="bold" color={downCount > 0 ? "red.300" : "whiteAlpha.600"}>
              <ArrowDownIcon mr={1} boxSize={4} />{downCount}
            </StatNumber>
            <StatHelpText color="whiteAlpha.500" m={0}>Sites down</StatHelpText>
          </Stat>
        </Box>
        {avgResponseTime !== null && (
          <Box {...card} flex="1" p={5}>
            <Stat>
              <StatLabel color="whiteAlpha.600" fontSize="xs" textTransform="uppercase" letterSpacing="wider">Avg Response</StatLabel>
              <StatNumber fontSize="2xl" fontWeight="bold" color="blue.300">{avgResponseTime}<Text as="span" fontSize="sm" ml={1} color="whiteAlpha.500">ms</Text></StatNumber>
              <StatHelpText color="whiteAlpha.500" m={0}>Across all sites</StatHelpText>
            </Stat>
          </Box>
        )}
      </HStack>

      {/* Chart */}
      <Box {...card} p={5}>
        <Flex justify="space-between" align="center" mb={4}>
          <HStack spacing={3}>
            <Text fontWeight="semibold" fontSize="sm" color="whiteAlpha.900">Live Response Time</Text>
            {selected && (
              <Badge
                px={2} py={1}
                rounded="full"
                fontSize="xs"
                colorScheme={selected.status === "UP" ? "green" : selected.status === "DOWN" ? "red" : "gray"}
                variant="subtle"
              >
                <HStack spacing={1}>
                  <StatusPulse status={selected.status} />
                  <Text>{selected.url ? new URL(selected.url).hostname : "—"}</Text>
                </HStack>
              </Badge>
            )}
          </HStack>
          <Text fontSize="xs" color="whiteAlpha.400">
            {lastManual ? dayjs(lastManual).format("HH:mm:ss") : "–"}
          </Text>
        </Flex>
        <Box h="180px">
          {chartData ? (
            <Line data={chartData} options={CHART_OPTIONS} />
          ) : (
            <Flex h="100%" align="center" justify="center" direction="column" gap={2}>
              <Box fontSize="32px">📡</Box>
              <Text color="whiteAlpha.500" fontSize="sm">Waiting for checks…</Text>
              <Text color="whiteAlpha.300" fontSize="xs">Click a site below or trigger a refresh</Text>
            </Flex>
          )}
        </Box>
      </Box>

      {/* Table */}
      <Box {...card} overflow="hidden">
        <Box px={5} py={3} borderBottom="1px solid rgba(255,255,255,0.08)">
          <Text fontWeight="semibold" fontSize="sm" color="whiteAlpha.800">Monitors</Text>
        </Box>
        <Table size="sm" variant="unstyled">
          <Thead>
            <Tr borderBottom="1px solid rgba(255,255,255,0.06)">
              <Th color="whiteAlpha.400" fontSize="xs" textTransform="uppercase" py={3} px={5}>Site</Th>
              <Th color="whiteAlpha.400" fontSize="xs" textTransform="uppercase">Status</Th>
              <Th color="whiteAlpha.400" fontSize="xs" textTransform="uppercase" isNumeric>Response</Th>
              <Th color="whiteAlpha.400" fontSize="xs" textTransform="uppercase">Last Checked</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sites.length === 0 && (
              <Tr>
                <Td colSpan={4} textAlign="center" py={10}>
                  <VStack spacing={2}>
                    <Text fontSize="xl">🔭</Text>
                    <Text color="whiteAlpha.500" fontSize="sm">No monitors yet. Add one above.</Text>
                  </VStack>
                </Td>
              </Tr>
            )}
            {sites.map((s) => (
              <Tr
                key={s._id}
                cursor="pointer"
                transition="background 0.15s"
                bg={selectedId === s._id ? "rgba(129,140,248,0.08)" : "transparent"}
                _hover={{ bg: selectedId === s._id ? "rgba(129,140,248,0.12)" : "rgba(255,255,255,0.03)" }}
                onClick={() => { setSelectedId(s._id); loadHistoryForSite(s._id, 60); }}
                borderLeft={selectedId === s._id ? "2px solid" : "2px solid transparent"}
                borderLeftColor={selectedId === s._id ? "purple.400" : "transparent"}
              >
                <Td py={3} px={5}>
                  <HStack spacing={3}>
                    <StatusPulse status={s.status} />
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                        {s.url ? (() => { try { return new URL(s.url).hostname; } catch { return s.url; } })() : "—"}
                      </Text>
                      <Text fontSize="xs" color="whiteAlpha.400" noOfLines={1}>{s.url}</Text>
                    </VStack>
                  </HStack>
                </Td>
                <Td py={3}>
                  <Badge
                    px={2} py={0.5} rounded="full" fontSize="xs" fontWeight="semibold"
                    colorScheme={s.status === "UP" ? "green" : s.status === "DOWN" ? "red" : "gray"}
                    variant="subtle"
                  >
                    {s.status || "PENDING"}
                  </Badge>
                </Td>
                <Td isNumeric py={3}>
                  <Text fontSize="sm" color={s.responseTime > 500 ? "yellow.300" : "whiteAlpha.800"} fontFamily="mono">
                    {typeof s.responseTime === "number" ? `${s.responseTime}ms` : "—"}
                  </Text>
                </Td>
                <Td py={3}>
                  <VStack align="start" spacing={0}>
                    <Text fontSize="xs" color="whiteAlpha.700">
                      {s.lastChecked ? dayjs(s.lastChecked).fromNow() : "—"}
                    </Text>
                    <Text fontSize="xs" color="whiteAlpha.300">
                      {s.lastChecked ? dayjs(s.lastChecked).format("HH:mm:ss") : ""}
                    </Text>
                  </VStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </VStack>
  );
}
