// src/pages/Assets.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftAddon,
  Kbd,
  Spinner,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Tag,
  TagLabel,
  Text,
  Tooltip,
  useToast,
  Switch,
} from "@chakra-ui/react";
import { FiRefreshCw, FiShield, FiGlobe } from "react-icons/fi";
import dayjs from "dayjs";
import { api } from "../lib/api";
import { socket } from "../lib/socket";

const IS_PROD =
  process.env.NODE_ENV === "production" ||
  process.env.REACT_APP_HIDE_CRON === "true";
const fmt = (d) => (d ? dayjs(d).format("YYYY-MM-DD") : "—");

function DaysBadge({ days }) {
  let colorScheme = "gray";
  if (Number.isFinite(days)) {
    if (days <= 7) colorScheme = "red";
    else if (days <= 30) colorScheme = "orange";
    else colorScheme = "green";
  }
  return (
    <Tag colorScheme={colorScheme} size="md" variant="subtle">
      <TagLabel>{Number.isFinite(days) ? `${days} days` : "n/a"}</TagLabel>
    </Tag>
  );
}

export default function Assets() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [sites, setSites] = useState([]);
  const [autoRefresh, setAuto] = useState(true);
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("cron_api_key") || ""
  );
  const intervalRef = useRef(null);
  const latestAutoRef = useRef(autoRefresh);

  const sortSites = (rows) =>
    rows
      .slice()
      .sort(
        (a, b) =>
          (a.sslDaysLeft ?? Number.POSITIVE_INFINITY) -
            (b.sslDaysLeft ?? Number.POSITIVE_INFINITY) ||
          (a.domainDaysLeft ?? Number.POSITIVE_INFINITY) -
            (b.domainDaysLeft ?? Number.POSITIVE_INFINITY)
      );

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get("/websites"); // /api/websites via api client
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setSites(sortSites(rows));
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
  };

  useEffect(() => {
    load();
  }, []);

  // Keep latest toggle in ref
  useEffect(() => {
    latestAutoRef.current = autoRefresh;
  }, [autoRefresh]);

  // StrictMode-safe auto refresh (every 60s) — fallback to sockets
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!autoRefresh) return;

    const tick = async () => {
      if (document.hidden) return;
      try {
        await load();
      } catch {}
    };

    // run once now to prove it works
    tick();
    intervalRef.current = setInterval(tick, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  // Merge live updates from Socket.IO (site:update)
  useEffect(() => {
    const onUpdate = (payload) => {
      if (!payload?._id) return;
      setSites((prev) => {
        const idx = prev.findIndex((s) => (s._id || s.id) === payload._id);
        if (idx === -1) return prev; // unknown site; keep as-is
        const merged = { ...prev[idx], ...payload };
        const next = [...prev];
        next[idx] = merged;
        return sortSites(next);
      });
    };
    socket.on("site:update", onUpdate);
    return () => socket.off("site:update", onUpdate);
  }, []);

  const runDaily = async () => {
    if (!apiKey.trim()) {
      toast({ title: "Set CRON_API_KEY first", status: "warning" });
      return;
    }
    setRunning(true);
    try {
      // api client should prefix this to /api/run-daily
      await api.get(`/run-daily?apiKey=${encodeURIComponent(apiKey.trim())}`);
      toast({ title: "Daily asset check triggered", status: "success" });
      setTimeout(load, 1200);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Unknown error";
      toast({ title: "Trigger failed", description: msg, status: "error" });
    } finally {
      setRunning(false);
    }
  };
  const runAll = async () => {
    if (!apiKey.trim()) {
      toast({ title: "Set CRON_API_KEY first", status: "warning" });
      return;
    }
    setRunning(true);
    try {
      await api.get(`/run-checks?apiKey=${encodeURIComponent(apiKey.trim())}`);
      toast({ title: "All sites rechecked", status: "success" });
      setTimeout(load, 800);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Unknown error";
      toast({ title: "Recheck failed", description: msg, status: "error" });
    } finally {
      setRunning(false);
    }
  };

  const saveKey = () => {
    localStorage.setItem("cron_api_key", apiKey.trim());
    toast({ title: "Saved", status: "success", duration: 900 });
  };

  return (
    <Stack spacing={6}>
      <HStack justify="space-between" align="center">
        <Heading size="lg">Certificates & Domains</Heading>

        {IS_PROD ? (
          // PRODUCTION: no CRON API UI, just info + reload + auto toggle
          <HStack>
            <Tag colorScheme="green" variant="subtle">
              Auto-updated by scheduler
            </Tag>
            <HStack>
              <Text fontSize="sm" color="whiteAlpha.700">
                Auto refresh
              </Text>
              <Switch
                isChecked={autoRefresh}
                onChange={(e) => setAuto(e.target.checked)}
              />
            </HStack>
            <Tooltip label="Refresh list from database">
              <IconButton
                aria-label="Reload"
                size="sm"
                icon={<FiRefreshCw />}
                onClick={load}
              />
            </Tooltip>
          </HStack>
        ) : (
          // DEVELOPMENT: show CRON API input + run button + auto toggle
          <HStack>
            <InputGroup size="sm" w={{ base: "240px", md: "320px" }}>
              <InputLeftAddon>CRON_API_KEY</InputLeftAddon>
              <Input
                placeholder="paste key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </InputGroup>
            <Button size="sm" onClick={saveKey} variant="outline">
              Save
            </Button>
            <Tooltip label="Run daily asset check now">
              <IconButton
                aria-label="Run"
                size="sm"
                icon={<FiRefreshCw />}
                isLoading={running}
                onClick={runDaily}
              />
            </Tooltip>
            <HStack>
              <Text fontSize="sm" color="whiteAlpha.700">
                Auto refresh
              </Text>
              <Switch
                isChecked={autoRefresh}
                onChange={(e) => setAuto(e.target.checked)}
              />
            </HStack>
          </HStack>
        )}
      </HStack>

      <Text color="whiteAlpha.700">
        This page shows <Kbd>SSL</Kbd> and <Kbd>Domain</Kbd> expiry for each
        monitored website. Badges turn <b>orange</b> 30 days out and <b>red</b>{" "}
        7 days out.
      </Text>

      {loading ? (
        <HStack mt={6}>
          <Spinner />
          <Text>Loading…</Text>
        </HStack>
      ) : (
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          {sites.map((s) => (
            <GridItem key={s._id || s.id}>
              <Card
                bg="whiteAlpha.100"
                border="1px solid"
                borderColor="whiteAlpha.200"
              >
                <CardHeader>
                  <HStack justify="space-between" align="center">
                    <Text fontWeight="semibold" noOfLines={1}>
                      {s.url}
                    </Text>
                    <Tag
                      size="sm"
                      variant="subtle"
                      colorScheme={
                        s.status === "UP"
                          ? "green"
                          : s.status === "DOWN"
                          ? "red"
                          : "gray"
                      }
                    >
                      {s.status || "PENDING"}
                    </Tag>
                  </HStack>
                </CardHeader>
                <CardBody pt={0}>
                  <Divider mb={4} borderColor="whiteAlpha.300" />
                  <Grid
                    templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
                    gap={4}
                  >
                    {/* SSL */}
                    <Box
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      rounded="lg"
                      p={4}
                    >
                      <HStack mb={2} spacing={2}>
                        <Icon as={FiShield} opacity={0.9} />
                        <Text fontWeight="semibold">SSL</Text>
                      </HStack>
                      <Stat>
                        <StatLabel>Valid until</StatLabel>
                        <StatNumber fontSize="lg">
                          {fmt(s.sslValidTo)}
                        </StatNumber>
                        <StatHelpText>
                          <HStack spacing={2}>
                            <Text>Days left:</Text>
                            <DaysBadge
                              days={
                                Number.isFinite(s.sslDaysLeft)
                                  ? s.sslDaysLeft
                                  : null
                              }
                            />
                          </HStack>
                        </StatHelpText>
                      </Stat>
                    </Box>

                    {/* Domain */}
                    <Box
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      rounded="lg"
                      p={4}
                    >
                      <HStack mb={2} spacing={2}>
                        <Icon as={FiGlobe} opacity={0.9} />
                        <Text fontWeight="semibold">Domain</Text>
                      </HStack>
                      <Stat>
                        <StatLabel>Expires on</StatLabel>
                        <StatNumber fontSize="lg">
                          {fmt(s.domainExpiresAt)}
                        </StatNumber>
                        <StatHelpText>
                          <HStack spacing={2}>
                            <Text>Days left:</Text>
                            <DaysBadge
                              days={
                                Number.isFinite(s.domainDaysLeft)
                                  ? s.domainDaysLeft
                                  : null
                              }
                            />
                          </HStack>
                        </StatHelpText>
                      </Stat>
                    </Box>
                  </Grid>
                </CardBody>
              </Card>
            </GridItem>
          ))}
          {sites.length === 0 && (
            <GridItem>
              <Box
                p={6}
                border="1px dashed"
                borderColor="whiteAlpha.300"
                rounded="lg"
              >
                <Text color="whiteAlpha.700">
                  No websites yet. Add one on the Dashboard.
                </Text>
              </Box>
            </GridItem>
          )}
        </Grid>
      )}
    </Stack>
  );
}
