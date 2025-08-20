// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  useToast,
  Divider,
  Spinner,
  IconButton,
  Collapse,
  Tooltip,
} from "@chakra-ui/react";
import {
  AddIcon,
  RepeatIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@chakra-ui/icons";
import dayjs from "dayjs";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip as CTip,
  Legend,
} from "chart.js";
import { api } from "../lib/api";
import { socket } from "../lib/socket";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  CTip,
  Legend
);

const StatusDot = ({ status }) => (
  <Box
    as="span"
    w="10px"
    h="10px"
    rounded="full"
    display="inline-block"
    bg={
      status === "UP" ? "green.400" : status === "DOWN" ? "red.400" : "gray.400"
    }
    mr="2"
  />
);

export default function Dashboard() {
  const toast = useToast();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Simplified state for HTTP-only checks
  const [newUrl, setNewUrl] = useState("");

  // ADVANCED add form state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [bodyMustContain, setBodyMustContain] = useState("");
  const [timeoutMs, setTimeoutMs] = useState(10000);

  const [selectedId, setSelectedId] = useState(null);
  const [lastManual, setLastManual] = useState(null);

  // in-memory history per site
  const historyRef = useRef({});
  const prevStatusRef = useRef({});
  const lastToastAtRef = useRef(0);
  const TOAST_MIN_GAP_MS = 5000;

  const normalizeList = (res) => (Array.isArray(res) ? res : res?.items || []);

  const loadHistoryForSite = async (sid, limit = 50) => {
    if (!sid) return;
    try {
      const res = await api.get(
        `/analytics/checks?siteId=${encodeURIComponent(sid)}&limit=${limit}`
      );
      const rows = res?.items || [];
      const pts = (Array.isArray(rows) ? rows : [])
        .reverse()
        .filter((r) => typeof r.responseTime === "number")
        .map((r) => ({ t: r.createdAt, rt: r.responseTime }));
      historyRef.current[sid] = pts.slice(-100);
    } catch {
      /* ignore */
    }
  };

  // initial load
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/websites");
        const list = normalizeList(res);
        setSites(list);
        if (list[0]) setSelectedId(list[0]._id);
      } catch (e) {
        console.error(e);
        toast({
          title: "Failed to load websites",
          description: e.message,
          status: "error",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  // load chart data when user changes the selected row
  useEffect(() => {
    if (selectedId) loadHistoryForSite(selectedId, 50).catch(() => {});
  }, [selectedId]);

  // live events
  useEffect(() => {
    const onCheck = (evt) => {
      const siteId = evt.site?.toString();
      const { status, responseTime, createdAt } = evt;

      setSites((prev) =>
        prev.map((s) => {
          if (s._id === siteId) {
            return { ...s, status, responseTime, lastChecked: createdAt };
          }
          return s;
        })
      );

      const prev = prevStatusRef.current[siteId];
      if (prev && prev !== status) {
        const now = Date.now();
        if (now - lastToastAtRef.current > TOAST_MIN_GAP_MS) {
          const site = sites.find((s) => s._id === siteId);
          toast({
            title: `Site ${status === "DOWN" ? "DOWN" : "UP"}`,
            description: `${site?.url || siteId} is now ${status}.`,
            status: status === "DOWN" ? "error" : "success",
          });
          lastToastAtRef.current = now;
        }
      }
      prevStatusRef.current[siteId] = status;

      if (selectedId === siteId && typeof responseTime === "number") {
        const arr = historyRef.current[siteId] || [];
        arr.push({ t: createdAt, rt: responseTime });
        historyRef.current[siteId] = arr.slice(-100);
      }
    };

    const onSiteUpdate = (payload) => {
      if (!payload?._id) return;
      setSites((prev) =>
        prev.map((s) => (s._id === payload._id ? { ...s, ...payload } : s))
      );
      if (
        selectedId &&
        payload._id === selectedId &&
        typeof payload.responseTime === "number"
      ) {
        const arr = historyRef.current[selectedId] || [];
        arr.push({
          t: payload.lastChecked || new Date().toISOString(),
          rt: payload.responseTime,
        });
        historyRef.current[selectedId] = arr.slice(-100);
      }
    };

    socket.on("analytics:check", onCheck);
    socket.on("site:update", onSiteUpdate);
    return () => {
      socket.off("analytics:check", onCheck);
      socket.off("site:update", onSiteUpdate);
    };
  }, [toast, selectedId, sites]);

  const upCount = useMemo(
    () => sites.filter((s) => s.status === "UP").length,
    [sites]
  );
  const downCount = useMemo(
    () => sites.filter((s) => s.status === "DOWN").length,
    [sites]
  );
  const selected = useMemo(
    () => sites.find((s) => s._id === selectedId) || null,
    [sites, selectedId]
  );

  const chartData = useMemo(() => {
    if (!selected) return null;
    const pts = historyRef.current[selected._id] || [];
    return {
      labels: pts.map((p) => dayjs(p.t).format("HH:mm:ss")),
      datasets: [
        {
          label: selected.url || "Selected",
          data: pts.map((p) => p.rt),
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 0,
        },
      ],
    };
  }, [selected]);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const manualRefresh = async () => {
    try {
      setRefreshingAll(true);
      for (const s of sites) {
        try {
          await api.post(`/websites/${s._id}/check-now`);
        } catch {
          /* ignore individual failures */
        }
        await sleep(150);
      }
      const res = await api.get("/websites");
      const list = normalizeList(res);
      setSites(list);
      const keep = list.some((x) => x._id === selectedId);
      const sid = keep ? selectedId : list[0]?._id ?? null;
      setSelectedId(sid);
      if (sid) await loadHistoryForSite(sid, 50);
      setLastManual(new Date());
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || e.message || "Unknown error";
      toast({ title: "Refresh failed", description: msg, status: "error" });
    } finally {
      setRefreshingAll(false);
    }
  };

  const addSite = async (e) => {
    e.preventDefault();
    try {
      setAdding(true);
      if (!newUrl.trim()) {
        toast({ title: "URL is required", status: "warning" });
        setAdding(false);
        return;
      }
      const payload = {
        checkType: "HTTP", // Always HTTP
        timeoutMs,
        url: newUrl.trim(),
        expectedStatus,
        bodyMustContain: bodyMustContain.trim(),
      };
      const res = await api.post("/websites", payload);
      const site = res?.item || res?.site || res;
      setSites((prev) => [site, ...prev]);
      setSelectedId(site?._id ?? site?.id ?? null);
      setNewUrl("");
      setBodyMustContain("");
      toast({ title: "Added check", status: "success" });
    } catch (e) {
      const existing = e?.response?.data?.site || e?.body?.site || null;
      if (existing) {
        setSites((prev) => {
          const already = prev.some((p) => p._id === existing._id);
          return already ? prev : [existing, ...prev];
        });
        setSelectedId(existing._id);
        setNewUrl("");
        toast({ title: "Check already exists", status: "info" });
      } else {
        console.error(e);
        const msg = e?.response?.data?.error || e.message || "Unknown error";
        toast({ title: "Add failed", description: msg, status: "error" });
      }
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <Flex align="center" justify="center" minH="60vh">
        <Spinner mr="3" /> <Text>Loading dashboard…</Text>
      </Flex>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      {/* Title + refresh */}
      <Flex wrap="wrap" justify="space-between" align="center" gap={4}>
        <Heading size="lg">Server Monitoring</Heading>
        <Tooltip label="Trigger checks for all and reload">
          <IconButton
            aria-label="Refresh"
            icon={<RepeatIcon />}
            onClick={manualRefresh}
            isLoading={refreshingAll}
            loadingText="Refreshing"
            variant="outline"
            size="sm"
          />
        </Tooltip>
      </Flex>

      {/* Add checker card */}
      <Box
        bg="whiteAlpha.100"
        border="1px solid"
        borderColor="whiteAlpha.200"
        rounded="lg"
        p={4}
      >
        <form onSubmit={addSite}>
          <Flex gap={3} wrap="wrap" align="center">
            <Input
              placeholder="https://example.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              flex="1"
              minW="260px"
            />
            <Button
              type="submit"
              leftIcon={<AddIcon />}
              isLoading={adding}
              colorScheme="blue"
              px={6}
            >
              Add
            </Button>
          </Flex>

          <HStack justify="flex-end" mt={2}>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setShowAdvanced((s) => !s)}
              leftIcon={showAdvanced ? <ChevronUpIcon /> : <ChevronDownIcon />}
            >
              Advanced options
            </Button>
          </HStack>

          <Collapse in={showAdvanced} animateOpacity>
            <HStack spacing={3} wrap="wrap" mt={2}>
              <Input
                placeholder="Timeout (ms)"
                type="number"
                value={timeoutMs}
                onChange={(e) =>
                  setTimeoutMs(parseInt(e.target.value || "10000", 10))
                }
                maxW="180px"
              />
              <Input
                placeholder="Expected status (e.g. 200/301/403)"
                type="number"
                value={expectedStatus}
                onChange={(e) =>
                  setExpectedStatus(parseInt(e.target.value || "200", 10))
                }
                maxW="220px"
              />
              <Input
                placeholder="Response must contain… (optional)"
                value={bodyMustContain}
                onChange={(e) => setBodyMustContain(e.target.value)}
                minW="260px"
              />
            </HStack>
          </Collapse>
        </form>
      </Box>

      {/* Stats */}
      <HStack spacing={4}>
        <Stat
          flex="1"
          bg="whiteAlpha.100"
          border="1px solid"
          borderColor="whiteAlpha.200"
          rounded="lg"
          p={4}
        >
          <StatLabel>Total Checks</StatLabel>
          <StatNumber>{sites.length}</StatNumber>
        </Stat>
        <Stat
          flex="1"
          bg="whiteAlpha.100"
          border="1px solid"
          borderColor="whiteAlpha.200"
          rounded="lg"
          p={4}
        >
          <StatLabel>Up</StatLabel>
          <StatNumber color="green.300">{upCount}</StatNumber>
        </Stat>
        <Stat
          flex="1"
          bg="whiteAlpha.100"
          border="1px solid"
          borderColor="whiteAlpha.200"
          rounded="lg"
          p={4}
        >
          <StatLabel>Down</StatLabel>
          <StatNumber color="red.300">{downCount}</StatNumber>
        </Stat>
      </HStack>

      {/* Chart */}
      <Box
        bg="whiteAlpha.100"
        border="1px solid"
        borderColor="whiteAlpha.200"
        rounded="lg"
        p={4}
      >
        <Flex justify="space-between" align="center" mb={3}>
          <HStack>
            <Text fontWeight="bold">Live Response Time</Text>
            {selected && (
              <Badge colorScheme={selected.status === "UP" ? "green" : "red"}>
                <StatusDot status={selected.status} />
                {selected.status || "PENDING"}
              </Badge>
            )}
          </HStack>
          <Text fontSize="sm" color="whiteAlpha.700">
            Last refresh:{" "}
            {lastManual ? dayjs(lastManual).format("HH:mm:ss") : "–"}
          </Text>
        </Flex>
        <Divider borderColor="whiteAlpha.300" mb={4} />
        {chartData && chartData.labels.length > 0 ? (
          <Line
            data={chartData}
            options={{
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { color: "rgba(255,255,255,0.06)" } },
                y: { grid: { color: "rgba(255,255,255,0.06)" } },
              },
            }}
            height={80}
          />
        ) : (
          <Text color="whiteAlpha.700">Waiting for checks…</Text>
        )}
      </Box>

      {/* Table */}
      <Box
        bg="whiteAlpha.100"
        border="1px solid"
        borderColor="whiteAlpha.200"
        rounded="lg"
        p={2}
      >
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th>Site</Th>
              {/* REMOVED Type column */}
              <Th>Status</Th>
              <Th isNumeric>Response (ms)</Th>
              <Th>Last Checked</Th>
            </Tr>
          </Thead>
        </Table>

        <Divider borderColor="whiteAlpha.200" />

        <Table size="sm" variant="simple">
          <Tbody>
            {sites.map((s) => (
              <Tr
                key={s._id}
                _hover={{ bg: "whiteAlpha.100", cursor: "pointer" }}
                bg={selectedId === s._id ? "whiteAlpha.100" : "transparent"}
                onClick={() => setSelectedId(s._id)}
              >
                <Td>
                  <HStack spacing={2}>
                    <StatusDot status={s.status} />
                    <Text noOfLines={1}>{s.url || "-"}</Text>
                  </HStack>
                </Td>
                {/* REMOVED Type Td */}
                <Td>
                  <Badge colorScheme={s.status === "UP" ? "green" : "red"}>
                    {s.status || "PENDING"}
                  </Badge>
                </Td>
                <Td isNumeric>{s.responseTime ?? "-"}</Td>
                <Td>
                  {s.lastChecked
                    ? dayjs(s.lastChecked).format("YYYY-MM-DD HH:mm:ss")
                    : "-"}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </VStack>
  );
}
