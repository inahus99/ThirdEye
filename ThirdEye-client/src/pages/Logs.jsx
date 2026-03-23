// src/pages/Logs.jsx
import React from "react";
import {
  Box, Heading, HStack, VStack, Text, Select, Input, Button,
  Badge, IconButton, Spinner, useToast, Flex, Stat, StatLabel,
  StatNumber,
} from "@chakra-ui/react";
import { RepeatIcon, DownloadIcon } from "@chakra-ui/icons";
import { FiCheckCircle } from "react-icons/fi";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import minMax from "dayjs/plugin/minMax";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

dayjs.extend(duration);
dayjs.extend(minMax);

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
ChartJS.defaults.color = "#94a3b8";
ChartJS.defaults.borderColor = "rgba(148,163,184,0.08)";

const card = {
  bg: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  backdropFilter: "blur(8px)",
};

const gridColor = "rgba(148,163,184,0.08)";

const fmtDate = (d) => (d ? dayjs(d).format("YYYY-MM-DD HH:mm:ss") : "—");
const fmtDur = (a, b) => {
  if (!a) return "—";
  const s = dayjs(a), e = b ? dayjs(b) : dayjs();
  const dur = dayjs.duration(e.diff(s));
  const h = Math.floor(dur.asHours());
  const m = dur.minutes();
  const sec = dur.seconds();
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${sec}s`;
};

const toCsvIncidents = (rows) => {
  const header = ["siteUrl", "status", "startedAt", "endedAt", "durationSeconds", "reason"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  rows.forEach((r) => {
    const startedAt = r.startedAt || r.startTime || null;
    const endedAt = r.endedAt || r.endTime || null;
    const durSec = startedAt ? Math.max(0, Math.round((endedAt ? dayjs(endedAt) : dayjs()).diff(dayjs(startedAt)) / 1000)) : "";
    lines.push([r.siteUrl ?? "", r.status || (endedAt ? "RESOLVED" : "ONGOING"), startedAt ? new Date(startedAt).toISOString() : "", endedAt ? new Date(endedAt).toISOString() : "", durSec, r.reason || r.errorReason || ""].map(esc).join(","));
  });
  return lines.join("\n");
};

const downloadBlob = (text, filename, type = "text/plain;charset=utf-8") => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

function IncidentTimeline({ rows, days = 7 }) {
  const end = dayjs();
  const start = end.subtract(days, "day");

  const dayMarkers = [];
  for (let i = 0; i <= days; i++) {
    const date = start.add(i, "day");
    const totalMs = end.diff(start);
    const pos = ((date.valueOf() - start.valueOf()) / totalMs) * 100;
    if (pos >= 0 && pos <= 100) {
      dayMarkers.push({ date, left: `${pos}%`, showLabel: i === 0 || i === days || i % 2 === 0 });
    }
  }

  const toPct = (d) => {
    const totalMs = end.diff(start);
    const clamped = Math.min(Math.max(dayjs(d).valueOf(), start.valueOf()), end.valueOf());
    return ((clamped - start.valueOf()) / totalMs) * 100;
  };

  const segs = [];
  rows.forEach((r) => {
    const s = r.startedAt || r.startTime;
    if (!s) return;
    const e = r.endedAt || r.endTime || dayjs().toISOString();
    if (dayjs(e).isBefore(start) || dayjs(s).isAfter(end)) return;
    const left = toPct(s);
    const right = toPct(e);
    const width = Math.max(0.5, right - left);
    const ongoing = !r.endedAt && !r.endTime;
    const dur = fmtDur(s, e);
    segs.push({ left, width, ongoing, tooltip: `${ongoing ? "Ongoing" : "Resolved"} • ${dur}\n${fmtDate(s)} → ${fmtDate(e)}` });
  });

  if (!rows.length) {
    return (
      <Flex align="center" justify="center" h="60px" direction="column" gap={1}>
        <Text fontSize="sm" color="whiteAlpha.400">No incidents in the last 7 days</Text>
        <HStack spacing={1} color="green.400">
          <FiCheckCircle size="12px" />
          <Text fontSize="xs">All systems operational</Text>
        </HStack>
      </Flex>
    );
  }

  return (
    <Box>
      <Box position="relative" pt={5} pb={2}>
        <Box h="10px" bg="rgba(255,255,255,0.06)" rounded="full" border="1px solid rgba(255,255,255,0.08)" />
        {dayMarkers.map((m, idx) => (
          <React.Fragment key={idx}>
            <Box position="absolute" left={m.left} top="17px" h="18px" w="1px" bg="rgba(255,255,255,0.15)" />
            {m.showLabel && (
              <Text position="absolute" left={m.left} top="0" transform="translateX(-50%)" fontSize="xs" color="whiteAlpha.400">
                {m.date.format("MMM D")}
              </Text>
            )}
          </React.Fragment>
        ))}
        {segs.map((g, idx) => (
          <Box
            key={idx} position="absolute" left={`${g.left}%`} width={`${g.width}%`}
            top="19px" bottom="7px"
            bg={g.ongoing ? "#f87171" : "#fb923c"}
            rounded="full" opacity={0.85} title={g.tooltip}
            _hover={{ opacity: 1, transform: "scaleY(1.3)" }} transition="all 0.15s"
          />
        ))}
      </Box>
      <HStack justify="center" spacing={4} mt={3} fontSize="xs" color="whiteAlpha.400">
        <HStack spacing={1}><Box w="8px" h="8px" rounded="full" bg="#f87171" /><Text>Ongoing</Text></HStack>
        <HStack spacing={1}><Box w="8px" h="8px" rounded="full" bg="#fb923c" /><Text>Resolved</Text></HStack>
      </HStack>
    </Box>
  );
}

function computeDailyDowntimeMinutes(rows, days = 7) {
  const end = dayjs().endOf("day");
  const start = end.subtract(days - 1, "day").startOf("day");
  const map = new Map();
  for (let i = 0; i < days; i++) map.set(start.add(i, "day").format("YYYY-MM-DD"), 0);
  rows.forEach((r) => {
    const s = dayjs(r.startedAt || r.startTime);
    const e = dayjs(r.endedAt || r.endTime || dayjs());
    if (e.isBefore(start) || s.isAfter(end)) return;
    const clamp = (d, lo, hi) => (d.isBefore(lo) ? lo : d.isAfter(hi) ? hi : d);
    let cur = clamp(s, start, end);
    const stop = clamp(e, start, end);
    while (cur.isBefore(stop)) {
      const dayEnd = cur.endOf("day");
      const segEnd = dayjs.min(dayEnd, stop);
      const minutes = Math.max(0, Math.round(segEnd.diff(cur, "minute", true)));
      map.set(cur.format("YYYY-MM-DD"), (map.get(cur.format("YYYY-MM-DD")) || 0) + minutes);
      cur = dayEnd.add(1, "second");
    }
  });
  return Array.from(map.entries()).map(([date, minutes]) => ({ date, minutes }));
}

export default function Logs() {
  const toast = useToast();
  const [sites, setSites] = React.useState([]);
  const [siteId, setSiteId] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/websites");
        setSites(Array.isArray(res) ? res : res?.items || []);
      } catch (e) {
        toast({ title: "Failed to load sites", description: e.message, status: "error" });
      }
    })();
  }, [toast]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (status !== "all") params.set("status", status);
      params.set("limit", "200");
      const res = await api.get(`/incidents?${params}`);
      setRows(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []);
    } catch (e) {
      toast({ title: "Failed to load incidents", description: e?.response?.data?.error || e.message, status: "error" });
    } finally {
      setLoading(false);
    }
  }, [siteId, status, toast]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    let t = null;
    const bump = () => { clearTimeout(t); t = setTimeout(load, 800); };
    socket.on("analytics:check", bump);
    socket.on("incident:open", bump);
    socket.on("incident:resolve", bump);
    return () => {
      socket.off("analytics:check", bump);
      socket.off("incident:open", bump);
      socket.off("incident:resolve", bump);
      clearTimeout(t);
    };
  }, [load]);

  const filtered = React.useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      (r.siteUrl || "").toLowerCase().includes(needle) ||
      (r.reason || r.errorReason || "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const ongoingCount = React.useMemo(() => filtered.filter((r) => !r.endedAt && !r.endTime).length, [filtered]);
  const resolvedCount = React.useMemo(() => filtered.filter((r) => r.endedAt || r.endTime).length, [filtered]);
  const downtime7 = React.useMemo(() => computeDailyDowntimeMinutes(filtered, 7), [filtered]);
  const totalDowntimeMins = React.useMemo(() => downtime7.reduce((a, d) => a + d.minutes, 0), [downtime7]);

  const downtimeBarData = React.useMemo(() => ({
    labels: downtime7.map((d) => dayjs(d.date).format("MMM D")),
    datasets: [{
      label: "Downtime (min)",
      data: downtime7.map((d) => d.minutes),
      backgroundColor: (ctx) => {
        const { ctx: c, chartArea } = ctx.chart;
        if (!chartArea) return "rgba(248,113,113,0.4)";
        const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        grad.addColorStop(0, "rgba(248,113,113,0.6)");
        grad.addColorStop(1, "rgba(248,113,113,0.1)");
        return grad;
      },
      borderColor: "#f87171",
      borderWidth: 1.5,
      borderRadius: 6,
    }],
  }), [downtime7]);

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.9)",
        titleColor: "#e2e8f0",
        bodyColor: "#94a3b8",
        borderColor: "rgba(248,113,113,0.3)",
        borderWidth: 1,
        padding: 10,
        callbacks: { label: (ctx) => ` ${ctx.parsed.y} min` },
      },
    },
    scales: {
      x: { grid: { color: gridColor }, border: { display: false }, ticks: { font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: gridColor }, border: { display: false }, ticks: { font: { size: 10 }, callback: (v) => `${v}m` } },
    },
  };

  return (
    <VStack align="stretch" spacing={5}>
      {/* Header */}
      <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
        <Heading size="lg" bgGradient="linear(to-r, white, whiteAlpha.700)" bgClip="text">
          Incident Logs
        </Heading>
        <IconButton
          aria-label="Refresh" icon={<RepeatIcon />} onClick={load}
          variant="outline" size="sm" isLoading={loading}
          borderColor="whiteAlpha.200" _hover={{ bg: "whiteAlpha.100", borderColor: "whiteAlpha.400" }}
        />
      </Flex>

      {/* KPI row */}
      <HStack spacing={4}>
        <Box {...card} flex="1" p={4} borderColor={ongoingCount > 0 ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.1)"}>
          <Stat>
            <StatLabel fontSize="xs" color="whiteAlpha.500" textTransform="uppercase" letterSpacing="wider">Ongoing</StatLabel>
            <StatNumber fontSize="2xl" color={ongoingCount > 0 ? "red.300" : "whiteAlpha.500"}>{ongoingCount}</StatNumber>
          </Stat>
        </Box>
        <Box {...card} flex="1" p={4}>
          <Stat>
            <StatLabel fontSize="xs" color="whiteAlpha.500" textTransform="uppercase" letterSpacing="wider">Resolved</StatLabel>
            <StatNumber fontSize="2xl" color="green.300">{resolvedCount}</StatNumber>
          </Stat>
        </Box>
        <Box {...card} flex="1" p={4}>
          <Stat>
            <StatLabel fontSize="xs" color="whiteAlpha.500" textTransform="uppercase" letterSpacing="wider">Total</StatLabel>
            <StatNumber fontSize="2xl">{filtered.length}</StatNumber>
          </Stat>
        </Box>
        <Box {...card} flex="1" p={4} borderColor={totalDowntimeMins > 0 ? "rgba(251,146,60,0.25)" : "rgba(255,255,255,0.1)"}>
          <Stat>
            <StatLabel fontSize="xs" color="whiteAlpha.500" textTransform="uppercase" letterSpacing="wider">Downtime 7d</StatLabel>
            <StatNumber fontSize="2xl" color={totalDowntimeMins > 0 ? "orange.300" : "whiteAlpha.500"}>
              {totalDowntimeMins < 60
                ? `${totalDowntimeMins}m`
                : `${Math.floor(totalDowntimeMins / 60)}h${totalDowntimeMins % 60 > 0 ? ` ${totalDowntimeMins % 60}m` : ""}`}
            </StatNumber>
          </Stat>
        </Box>
      </HStack>

      {/* Filters */}
      <Box {...card} p={4}>
        <Flex gap={3} wrap="wrap" align="center">
          <Select
            placeholder="All sites" value={siteId} onChange={(e) => setSiteId(e.target.value)}
            maxW="280px" bg="rgba(255,255,255,0.04)" border="1px solid rgba(255,255,255,0.1)"
            _hover={{ borderColor: "whiteAlpha.400" }} size="sm" borderRadius="lg"
          >
            {sites.map((s) => (
              <option key={s._id} value={s._id} style={{ background: "#0f172a" }}>{s.url}</option>
            ))}
          </Select>
          <Select
            value={status} onChange={(e) => setStatus(e.target.value)}
            maxW="160px" bg="rgba(255,255,255,0.04)" border="1px solid rgba(255,255,255,0.1)"
            _hover={{ borderColor: "whiteAlpha.400" }} size="sm" borderRadius="lg"
          >
            <option value="all" style={{ background: "#0f172a" }}>All statuses</option>
            <option value="ongoing" style={{ background: "#0f172a" }}>Ongoing</option>
            <option value="resolved" style={{ background: "#0f172a" }}>Resolved</option>
          </Select>
          <Input
            placeholder="Search site or reason…" value={q} onChange={(e) => setQ(e.target.value)}
            maxW="280px" bg="rgba(255,255,255,0.04)" border="1px solid rgba(255,255,255,0.1)"
            _hover={{ borderColor: "whiteAlpha.400" }}
            _focus={{ borderColor: "purple.400", boxShadow: "0 0 0 1px rgba(139,92,246,0.4)" }}
            size="sm" borderRadius="lg"
          />
          <HStack ml="auto" spacing={2}>
            <Button
              size="sm" variant="outline" borderColor="whiteAlpha.200" color="whiteAlpha.700"
              _hover={{ bg: "whiteAlpha.100" }} leftIcon={<DownloadIcon />}
              onClick={() => downloadBlob(toCsvIncidents(filtered), "incidents.csv", "text/csv;charset=utf-8")}
            >
              CSV
            </Button>
            <Button
              size="sm" variant="outline" borderColor="whiteAlpha.200" color="whiteAlpha.700"
              _hover={{ bg: "whiteAlpha.100" }}
              onClick={() => downloadBlob(JSON.stringify(filtered, null, 2), "incidents.json", "application/json")}
            >
              JSON
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* Timeline + Chart side by side */}
      <HStack spacing={4} align="stretch">
        <Box {...card} flex="1" p={5}>
          <Text fontWeight="semibold" fontSize="sm" color="whiteAlpha.900" mb={4}>
            Outage Timeline — last 7 days
          </Text>
          <IncidentTimeline rows={filtered} days={7} />
        </Box>
        <Box {...card} flex="1" p={5}>
          <HStack justify="space-between" mb={4}>
            <Text fontWeight="semibold" fontSize="sm" color="whiteAlpha.900">Daily downtime</Text>
            <Text fontSize="xs" color="whiteAlpha.400">minutes / day</Text>
          </HStack>
          <Box h="140px">
            {downtime7.some((d) => d.minutes > 0) ? (
              <Bar data={downtimeBarData} options={barOpts} />
            ) : (
              <Flex h="100%" align="center" justify="center" direction="column" gap={1}>
                <Box color="green.400"><FiCheckCircle size="28px" /></Box>
                <Text fontSize="sm" color="whiteAlpha.400">No downtime in 7 days</Text>
              </Flex>
            )}
          </Box>
        </Box>
      </HStack>

      {/* Incident table */}
      <Box {...card} overflow="hidden">
        <Box px={5} py={3} borderBottom="1px solid rgba(255,255,255,0.08)">
          <HStack justify="space-between">
            <Text fontWeight="semibold" fontSize="sm" color="whiteAlpha.900">Incident History</Text>
            <Text fontSize="xs" color="whiteAlpha.400">{filtered.length} records</Text>
          </HStack>
        </Box>

        {/* Column headers */}
        <HStack px={5} py={2} spacing={0} bg="rgba(255,255,255,0.02)" borderBottom="1px solid rgba(255,255,255,0.06)">
          {[["Site", 2], ["Status", 1], ["Started", 1.5], ["Ended", 1.5], ["Duration", 1], ["Reason", 2]].map(([h, f]) => (
            <Text key={h} flex={f} fontSize="xs" color="whiteAlpha.400" textTransform="uppercase" letterSpacing="wider" fontWeight="semibold">
              {h}
            </Text>
          ))}
        </HStack>

        <VStack align="stretch" spacing={0} maxH="480px" overflowY="auto">
          {loading && (
            <HStack px={5} py={4} spacing={3}>
              <Spinner size="sm" color="whiteAlpha.400" />
              <Text fontSize="sm" color="whiteAlpha.400">Loading…</Text>
            </HStack>
          )}
          {!loading && filtered.length === 0 && (
            <Flex px={5} py={8} align="center" justify="center" direction="column" gap={2}>
              <Text fontSize="2xl">📋</Text>
              <Text fontSize="sm" color="whiteAlpha.400">No incidents found.</Text>
            </Flex>
          )}
          {!loading && filtered.map((it, i) => {
            const ongoing = !it.endedAt && !it.endTime;
            const started = it.startedAt || it.startTime;
            const ended = it.endedAt || it.endTime;
            return (
              <HStack
                key={it._id} px={5} py={3} spacing={0}
                borderBottom={i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none"}
                bg={ongoing ? "rgba(248,113,113,0.03)" : "transparent"}
                _hover={{ bg: ongoing ? "rgba(248,113,113,0.06)" : "rgba(255,255,255,0.02)" }}
                transition="background 0.1s"
              >
                <Box flex={2} minW={0} pr={3}>
                  <Text fontSize="xs" noOfLines={1} color="whiteAlpha.700" fontFamily="mono">
                    {it.siteUrl || "—"}
                  </Text>
                </Box>
                <Box flex={1}>
                  <Badge
                    colorScheme={ongoing ? "red" : "green"} variant="subtle"
                    px={2} py={0.5} rounded="full" fontSize="xs"
                  >
                    {ongoing ? "ONGOING" : "RESOLVED"}
                  </Badge>
                </Box>
                <Text flex={1.5} fontSize="xs" color="whiteAlpha.500">{fmtDate(started)}</Text>
                <Text flex={1.5} fontSize="xs" color="whiteAlpha.500">{fmtDate(ended)}</Text>
                <Text flex={1} fontSize="xs" color="whiteAlpha.700" fontFamily="mono" fontWeight="medium">
                  {fmtDur(started, ended)}
                </Text>
                <Box flex={2} minW={0}>
                  <Text fontSize="xs" color={ongoing ? "red.300" : "whiteAlpha.500"} noOfLines={1}
                    title={it.reason || it.errorReason || ""}>
                    {it.reason || it.errorReason || "—"}
                  </Text>
                </Box>
              </HStack>
            );
          })}
        </VStack>
      </Box>
    </VStack>
  );
}
