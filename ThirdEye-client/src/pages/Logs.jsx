// src/pages/Logs.jsx
import React from "react";
import {
  Box,
  Heading,
  HStack,
  VStack,
  Text,
  Select,
  Input,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  Spinner,
  useToast,
  Divider,
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import minMax from "dayjs/plugin/minMax";

import { api } from "../lib/api";
import { socket } from "../lib/socket";

// charts
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

// Extend dayjs with the necessary plugins
dayjs.extend(duration);
dayjs.extend(minMax);
// --------------------

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
ChartJS.defaults.color = "#cbd5e1";
ChartJS.defaults.borderColor = "rgba(255,255,255,0.08)";

const fmtDate = (d) => (d ? dayjs(d).format("YYYY-MM-DD HH:mm:ss") : "—");
const fmtDur = (a, b) => {
  if (!a) return "—";
  const s = dayjs(a),
    e = b ? dayjs(b) : dayjs();
  const dur = dayjs.duration(e.diff(s));
  const h = Math.floor(dur.asHours());
  const m = dur.minutes();
  const sec = dur.seconds();
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${sec}s`;
};

const toCsvIncidents = (rows) => {
  const header = [
    "siteUrl",
    "status",
    "startedAt",
    "endedAt",
    "durationSeconds",
    "reason",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const lines = [header.join(",")];
  rows.forEach((r) => {
    const startedAt = r.startedAt || r.startTime || null;
    const endedAt = r.endedAt || r.endTime || null;
    const durSec = startedAt
      ? Math.max(
          0,
          Math.round(
            (endedAt ? dayjs(endedAt) : dayjs()).diff(dayjs(startedAt)) / 1000
          )
        )
      : "";
    const line = [
      r.siteUrl ?? "",
      r.status || (endedAt ? "RESOLVED" : "ONGOING"),
      startedAt ? new Date(startedAt).toISOString() : "",
      endedAt ? new Date(endedAt).toISOString() : "",
      durSec,
      r.reason || r.errorReason || "",
    ];
    lines.push(line.map(esc).join(","));
  });
  return lines.join("\n");
};

const downloadBlob = (text, filename, type = "text/plain;charset=utf-8") => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// timeline (last N days)
function IncidentTimeline({ rows, days = 7 }) {
  const end = dayjs();
  const start = end.subtract(days, "day");

  // ---  Generate markers for each day ---
  const dayMarkers = [];
  for (let i = 0; i <= days; i++) {
    const date = start.add(i, "day");
    const totalMs = end.diff(start);
    const pos = ((date.valueOf() - start.valueOf()) / totalMs) * 100;

    if (pos >= 0 && pos <= 100) {
      dayMarkers.push({
        date: date,
        left: `${pos}%`,

        showLabel: i === 0 || i === days || i % 2 === 0,
      });
    }
  }

  const toPct = (d) => {
    const totalMs = end.diff(start);
    const clamped = Math.min(
      Math.max(dayjs(d).valueOf(), start.valueOf()),
      end.valueOf()
    );
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
    const width = Math.max(0.5, right - left); //  0.5 for a minimum visible width
    const ongoing = !r.endedAt && !r.endTime;

    const dur = fmtDur(s, e);
    const tooltip = `Status: ${
      ongoing ? "Ongoing" : "Resolved"
    }\nDuration: ${dur}\nFrom: ${fmtDate(s)}\nTo: ${fmtDate(e)}`;

    segs.push({ left, width, ongoing, tooltip });
  });

  return (
    <Box>
      <Box position="relative" pt={5} pb={2}>
        {/* Main timeline bar */}
        <Box
          h="12px"
          bg="whiteAlpha.100"
          rounded="full"
          border="1px solid"
          borderColor="whiteAlpha.200"
        />

        {/* Day markers and labels */}
        {dayMarkers.map((m, idx) => (
          <React.Fragment key={idx}>
            {/* Tick mark */}
            <Box
              position="absolute"
              left={m.left}
              top="16px"
              h="20px"
              w="1px"
              bg="whiteAlpha.300"
            />
            {/* Date Label */}
            {m.showLabel && (
              <Text
                position="absolute"
                left={m.left}
                top="0"
                transform="translateX(-50%)"
                fontSize="xs"
                color="muted"
              >
                {m.date.format("MMM D")}
              </Text>
            )}
          </React.Fragment>
        ))}

        {/* Incident segments on top of the timeline bar */}
        {segs.map((g, idx) => (
          <Box
            key={idx}
            position="absolute"
            left={`${g.left}%`}
            width={`${g.width}%`}
            top="21px"
            bottom="9px"
            bg={g.ongoing ? "red.500" : "orange.400"}
            rounded="full"
            opacity={0.9}
            title={g.tooltip}
            _hover={{ transform: "scaleY(1.2)", opacity: 1 }}
            transition="transform 0.1s ease-in-out"
          />
        ))}
      </Box>
      <Text mt={2} fontSize="xs" color="muted" textAlign="center">
        Red = ongoing, Orange = resolved outages
      </Text>
    </Box>
  );
}

// Compute per-day downtime minutes for the last N days
function computeDailyDowntimeMinutes(rows, days = 7) {
  const end = dayjs().endOf("day");
  const start = end.subtract(days - 1, "day").startOf("day");

  // Prepare a map for each date → minutes
  const map = new Map();
  for (let i = 0; i < days; i++) {
    const d = start.add(i, "day").format("YYYY-MM-DD");
    map.set(d, 0);
  }

  rows.forEach((r) => {
    const s = dayjs(r.startedAt || r.startTime);
    const e = dayjs(r.endedAt || r.endTime || dayjs());

    if (e.isBefore(start) || s.isAfter(end)) return;

    // Clamp to window
    const clamp = (d, lo, hi) => (d.isBefore(lo) ? lo : d.isAfter(hi) ? hi : d);
    let cur = clamp(s, start, end);
    const stop = clamp(e, start, end);

    while (cur.isBefore(stop)) {
      const dayEnd = cur.endOf("day");
      const segEnd = dayjs.min(dayEnd, stop);
      const minutes = Math.max(0, Math.round(segEnd.diff(cur, "minute", true)));
      const key = cur.format("YYYY-MM-DD");
      map.set(key, (map.get(key) || 0) + minutes);
      cur = dayEnd.add(1, "second"); // jump into next day
    }
  });

  // To array (in chronological order)
  return Array.from(map.entries()).map(([date, minutes]) => ({
    date,
    minutes,
  }));
}

export default function Logs() {
  const toast = useToast();
  const [sites, setSites] = React.useState([]);
  const [siteId, setSiteId] = React.useState("");
  const [status, setStatus] = React.useState("all"); // all | ongoing | resolved
  const [q, setQ] = React.useState(""); // text filter on siteUrl / reason
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // load sites for filter dropdown
  React.useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/websites");
        const list = Array.isArray(res) ? res : res?.items || [];
        setSites(list);
      } catch (e) {
        toast({
          title: "Failed to load sites",
          description: e.message,
          status: "error",
        });
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
      const list = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? res
        : [];
      setRows(list);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Server error";
      toast({
        title: "Failed to load incidents",
        description: msg,
        status: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [siteId, status, toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  // live auto-refresh (debounced) when checks/incident events arrive
  React.useEffect(() => {
    let t = null;
    const bump = () => {
      clearTimeout(t);
      t = setTimeout(load, 800);
    };
    const onCheck = () => bump();
    const onOpen = () => bump();
    const onResolve = () => bump();

    socket.on("analytics:check", onCheck);
    socket.on("incident:open", onOpen);
    socket.on("incident:resolve", onResolve);

    return () => {
      socket.off("analytics:check", onCheck);
      socket.off("incident:open", onOpen);
      socket.off("incident:resolve", onResolve);
      clearTimeout(t);
    };
  }, [load]);

  // client-side quick filter
  const filtered = React.useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter(
      (r) =>
        (r.siteUrl || "").toLowerCase().includes(needle) ||
        (r.reason || r.errorReason || "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  // summary chips
  const ongoingCount = React.useMemo(
    () => filtered.filter((r) => !r.endedAt && !r.endTime).length,
    [filtered]
  );
  const totalCount = filtered.length;

  // charts data (last 7 days)
  const downtime7 = React.useMemo(
    () => computeDailyDowntimeMinutes(filtered, 7),
    [filtered]
  );
  const downtimeBarData = React.useMemo(
    () => ({
      labels: downtime7.map((d) => dayjs(d.date).format("MMM D")),
      datasets: [
        {
          label: "Total downtime (minutes)",
          data: downtime7.map((d) => d.minutes),
          backgroundColor: "rgba(248,113,113,0.35)",
          borderColor: "#f87171",
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    }),
    [downtime7]
  );

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { grid: { color: "rgba(255,255,255,0.08)" } },
      y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.08)" } },
    },
  };

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align="center" wrap="wrap" gap={3}>
        <Heading size="lg">Logs</Heading>
        <HStack>
          <Badge colorScheme="red" variant="subtle">
            {ongoingCount} ongoing
          </Badge>
          <Badge colorScheme="blue" variant="subtle">
            {totalCount} total
          </Badge>
          <IconButton
            aria-label="Refresh"
            icon={<RepeatIcon />}
            onClick={load}
            variant="outline"
            size="sm"
            isLoading={loading}
          />
        </HStack>
      </HStack>

      {/* Filters */}
      <HStack spacing={3} wrap="wrap">
        <Select
          placeholder="All sites"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          maxW="320px"
        >
          {sites.map((s) => (
            <option key={s._id} value={s._id}>
              {s.url}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          maxW="200px"
        >
          <option value="all">All</option>
          <option value="ongoing">Ongoing</option>
          <option value="resolved">Resolved</option>
        </Select>
        <Input
          placeholder="Filter by site or reason…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxW="360px"
        />
        <Button onClick={load} variant="outline" size="sm">
          Apply
        </Button>
        <Button
          size="sm"
          onClick={() =>
            downloadBlob(
              toCsvIncidents(filtered),
              "incidents.csv",
              "text/csv;charset=utf-8"
            )
          }
        >
          Export CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadBlob(
              JSON.stringify(filtered, null, 2),
              "incidents.json",
              "application/json"
            )
          }
        >
          Export JSON
        </Button>
      </HStack>

      {/* Timeline */}
      <Box
        bg="surface"
        border="1px solid"
        borderColor="border"
        rounded="xl"
        p={4}
      >
        <Text fontWeight="semibold" mb={2}>
          Outage Timeline (last 7 days)
        </Text>
        <IncidentTimeline rows={filtered} days={7} />
      </Box>

      {/* Total downtime per day (bar) */}
      <Box
        bg="surface"
        border="1px solid"
        borderColor="border"
        rounded="xl"
        p={4}
        minH="280px"
      >
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="semibold">Total downtime per day</Text>
          <Text fontSize="sm" color="muted">
            Last 7 days
          </Text>
        </HStack>
        <Box h="220px">
          {downtime7.length ? (
            <Bar data={downtimeBarData} options={barOpts} />
          ) : (
            <HStack p={3}>
              <Text color="muted">
                No downtime recorded in the last 7 days.
              </Text>
            </HStack>
          )}
        </Box>
      </Box>

      {/* Table */}
     {/* Table */}
<Box
  bg="surface"
  border="1px solid"
  borderColor="border"
  rounded="xl"
  p={0}
>
  <Box px={4} py={3}>
    <Text fontWeight="semibold">Incident history</Text>
  </Box>
  <Divider borderColor="border" />

  {/* The table is now wrapped in a Box with a max height and scrollbar */}
  <Box maxH="500px" overflowY="auto">
    <Table size="sm" variant="simple">
      <Thead>
        <Tr>
          <Th>Site</Th>
          <Th>Status</Th>
          <Th>Start</Th>
          <Th>End</Th>
          <Th>Duration</Th>
          <Th>Reason</Th>
        </Tr>
      </Thead>
      <Tbody>
        {loading && (
          <Tr>
            <Td colSpan={6}>
              <HStack p={3}>
                <Spinner size="sm" />
                <Text>Loading…</Text>
              </HStack>
            </Td>
          </Tr>
        )}
        {!loading && filtered.length === 0 && (
          <Tr>
            <Td colSpan={6}>
              <Text px={4} py={3} color="muted">
                No incidents found.
              </Text>
            </Td>
          </Tr>
        )}
        {!loading &&
          filtered.map((it) => {
            const ongoing = !it.endedAt && !it.endTime;
            const started = it.startedAt || it.startTime;
            const ended = it.endedAt || it.endTime;
            return (
              <Tr key={it._id}>
                <Td>
                  <a href={`/site?siteId=${it.siteId}`}>
                    <Text noOfLines={1}>{it.siteUrl}</Text>
                  </a>
                </Td>
                <Td>
                  <Badge
                    colorScheme={ongoing ? "red" : "green"}
                    variant="subtle"
                  >
                    {ongoing ? "ONGOING" : "RESOLVED"}
                  </Badge>
                </Td>
                <Td>{fmtDate(started)}</Td>
                <Td>{fmtDate(ended)}</Td>
                <Td>{fmtDur(started, ended)}</Td>
                <Td>
                  <Text
                    noOfLines={1}
                    title={it.reason || it.errorReason || ""}
                  >
                    {it.reason || it.errorReason || "—"}
                  </Text>
                </Td>
              </Tr>
            );
          })}
      </Tbody>
    </Table>
  </Box>
</Box>
    </VStack>
  );
}
