// src/pages/Assets.jsx
import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  Box,
  Divider,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  IconButton,
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
  VStack,
  Button,
  Skeleton,
  SimpleGrid,
} from "@chakra-ui/react";
import { FiRefreshCw, FiShield, FiGlobe, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import { RepeatIcon } from "@chakra-ui/icons";
import dayjs from "dayjs";
import { api } from "../lib/api";
import { socket } from "../lib/socket";

const fmt = (d) => (d ? dayjs(d).format("YYYY-MM-DD") : "—");

const card = {
  bg: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
};

function DaysBadge({ days }) {
  let colorScheme = "gray";
  if (Number.isFinite(days)) {
    if (days <= 7) colorScheme = "red";
    else if (days <= 30) colorScheme = "orange";
    else colorScheme = "green";
  }
  return (
    <Tag colorScheme={colorScheme} size="sm" variant="subtle" rounded="full">
      <TagLabel>{Number.isFinite(days) ? `${days} days` : "n/a"}</TagLabel>
    </Tag>
  );
}

export default function Assets() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sites, setSites] = useState([]);
  const [autoRefresh, setAuto] = useState(true);
  const intervalRef = useRef(null);

  const sortSites = (rows) =>
    rows.slice().sort(
      (a, b) =>
        (a.sslDaysLeft ?? Number.POSITIVE_INFINITY) - (b.sslDaysLeft ?? Number.POSITIVE_INFINITY) ||
        (a.domainDaysLeft ?? Number.POSITIVE_INFINITY) - (b.domainDaysLeft ?? Number.POSITIVE_INFINITY)
    );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get("/websites");
      const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setSites(sortSites(rows));
    } catch (e) {
      toast({ title: "Failed to load websites", description: e.message, status: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (!autoRefresh) return;
    intervalRef.current = setInterval(() => { if (!document.hidden) load(); }, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

  // Socket.IO live updates
  useEffect(() => {
    const onUpdate = (payload) => {
      if (!payload?._id) return;
      setSites((prev) => {
        const idx = prev.findIndex((s) => (s._id || s.id) === payload._id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...prev[idx], ...payload };
        return sortSites(next);
      });
    };
    socket.on("site:update", onUpdate);
    return () => socket.off("site:update", onUpdate);
  }, []);

  const refreshAssets = async () => {
    setRefreshing(true);
    try {
      await api.post("/cron/refresh-assets", {});
      toast({ title: "SSL & Domain refresh started!", description: "Data will update in ~30 seconds.", status: "success" });
      // Reload after 30s to see updated data
      setTimeout(() => load(), 30_000);
    } catch (e) {
      toast({ title: "Refresh failed", description: e.message, status: "error" });
    } finally {
      setRefreshing(false);
    }
  };

  const criticalCount = sites.filter((s) => Number.isFinite(s.sslDaysLeft) && s.sslDaysLeft <= 30).length;
  const healthyCount = sites.filter((s) => Number.isFinite(s.sslDaysLeft) && s.sslDaysLeft > 30).length;
  const unknownCount = sites.filter((s) => !Number.isFinite(s.sslDaysLeft)).length;

  return (
    <Stack spacing={5}>
      <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <VStack align="start" spacing={0}>
          <Heading size="lg" bgGradient="linear(to-r, white, whiteAlpha.700)" bgClip="text">
            Certificates & Domains
          </Heading>
          <Text fontSize="xs" color="whiteAlpha.500">
            SSL and domain expiry for all monitored websites
          </Text>
        </VStack>
        <HStack>
          <Text fontSize="sm" color="whiteAlpha.600">Auto refresh</Text>
          <Switch isChecked={autoRefresh} onChange={(e) => setAuto(e.target.checked)} colorScheme="purple" />
          <Tooltip label="Trigger SSL & Domain refresh now">
            <Button
              size="sm"
              leftIcon={<FiRefreshCw />}
              isLoading={refreshing}
              loadingText="Refreshing…"
              onClick={refreshAssets}
              variant="outline"
              borderColor="whiteAlpha.200"
              _hover={{ bg: "whiteAlpha.100", borderColor: "purple.400" }}
            >
              Refresh SSL
            </Button>
          </Tooltip>
          <Tooltip label="Reload from database">
            <IconButton
              size="sm"
              icon={<RepeatIcon />}
              aria-label="Reload"
              onClick={load}
              variant="ghost"
              _hover={{ bg: "whiteAlpha.100" }}
            />
          </Tooltip>
        </HStack>
      </HStack>

      {/* KPI Summary */}
      <SimpleGrid columns={{ base: 3, md: 3 }} spacing={4}>
        <Box {...card} p={4}>
          <HStack justify="space-between">
            <Stat>
              <StatLabel fontSize="xs" color="whiteAlpha.500" textTransform="uppercase">Healthy</StatLabel>
              <StatNumber fontSize="xl" color="green.300">{healthyCount}</StatNumber>
            </Stat>
            <Icon as={FiCheckCircle} color="green.300" boxSize={6} opacity={0.6} />
          </HStack>
        </Box>
        <Box {...card} p={4} borderColor={criticalCount > 0 ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.1)"}>
          <HStack justify="space-between">
            <Stat>
              <StatLabel fontSize="xs" color="whiteAlpha.500" textTransform="uppercase">Expiring Soon</StatLabel>
              <StatNumber fontSize="xl" color={criticalCount > 0 ? "orange.300" : "whiteAlpha.600"}>{criticalCount}</StatNumber>
            </Stat>
            <Icon as={FiAlertTriangle} color={criticalCount > 0 ? "orange.300" : "whiteAlpha.400"} boxSize={6} opacity={0.6} />
          </HStack>
        </Box>
        <Box {...card} p={4}>
          <HStack justify="space-between">
            <Stat>
              <StatLabel fontSize="xs" color="whiteAlpha.500" textTransform="uppercase">Unknown</StatLabel>
              <StatNumber fontSize="xl" color="whiteAlpha.500">{unknownCount}</StatNumber>
            </Stat>
            <Icon as={FiShield} color="whiteAlpha.300" boxSize={6} opacity={0.6} />
          </HStack>
        </Box>
      </SimpleGrid>

      <Text fontSize="xs" color="whiteAlpha.400">
        Badges turn <Text as="span" color="orange.300" fontWeight="semibold">orange</Text> within 30 days and{" "}
        <Text as="span" color="red.300" fontWeight="semibold">red</Text> within 7 days.
        {unknownCount > 0 && (
          <Text as="span" color="whiteAlpha.500"> Click "Refresh SSL" to populate missing data.</Text>
        )}
      </Text>

      {loading ? (
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          {[1, 2, 3, 4].map((i) => <GridItem key={i}><Skeleton h="180px" rounded="xl" /></GridItem>)}
        </Grid>
      ) : (
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          {sites.map((s) => {
            const sslExpiring = Number.isFinite(s.sslDaysLeft) && s.sslDaysLeft <= 30;
            const domainExpiring = Number.isFinite(s.domainDaysLeft) && s.domainDaysLeft <= 30;
            let hostname = s.url;
            try { hostname = new URL(s.url).hostname; } catch {}

            return (
              <GridItem key={s._id || s.id}>
                <Box
                  {...card}
                  borderColor={sslExpiring || domainExpiring ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.1)"}
                  transition="all 0.2s"
                  _hover={{ borderColor: "rgba(255,255,255,0.2)" }}
                >
                  {/* Header */}
                  <HStack justify="space-between" px={4} py={3} borderBottom="1px solid rgba(255,255,255,0.07)">
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="semibold" fontSize="sm" noOfLines={1}>{hostname}</Text>
                      <Text fontSize="xs" color="whiteAlpha.400" noOfLines={1}>{s.url}</Text>
                    </VStack>
                    <Tag
                      size="sm" variant="subtle" rounded="full"
                      colorScheme={s.status === "UP" ? "green" : s.status === "DOWN" ? "red" : "gray"}
                    >
                      {s.status || "PENDING"}
                    </Tag>
                  </HStack>
                  
                  {/* Body */}
                  <Grid templateColumns="1fr 1fr" gap={0}>
                    {/* SSL */}
                    <Box p={4} borderRight="1px solid rgba(255,255,255,0.07)">
                      <HStack mb={3} spacing={2}>
                        <Icon as={FiShield} color={sslExpiring ? "orange.300" : "blue.300"} />
                        <Text fontWeight="semibold" fontSize="sm">SSL</Text>
                      </HStack>
                      <Stat>
                        <StatLabel fontSize="xs" color="whiteAlpha.500">Valid until</StatLabel>
                        <StatNumber fontSize="md" fontFamily="mono">{fmt(s.sslValidTo)}</StatNumber>
                        <StatHelpText m={0} mt={1}>
                          <HStack spacing={2}>
                            <Text fontSize="xs" color="whiteAlpha.500">Days left:</Text>
                            <DaysBadge days={Number.isFinite(s.sslDaysLeft) ? s.sslDaysLeft : null} />
                          </HStack>
                        </StatHelpText>
                      </Stat>
                    </Box>

                    {/* Domain */}
                    <Box p={4}>
                      <HStack mb={3} spacing={2}>
                        <Icon as={FiGlobe} color={domainExpiring ? "orange.300" : "purple.300"} />
                        <Text fontWeight="semibold" fontSize="sm">Domain</Text>
                      </HStack>
                      <Stat>
                        <StatLabel fontSize="xs" color="whiteAlpha.500">Expires on</StatLabel>
                        <StatNumber fontSize="md" fontFamily="mono">{fmt(s.domainExpiresAt)}</StatNumber>
                        <StatHelpText m={0} mt={1}>
                          <HStack spacing={2}>
                            <Text fontSize="xs" color="whiteAlpha.500">Days left:</Text>
                            <DaysBadge days={Number.isFinite(s.domainDaysLeft) ? s.domainDaysLeft : null} />
                          </HStack>
                        </StatHelpText>
                      </Stat>
                    </Box>
                  </Grid>
                </Box>
              </GridItem>
            );
          })}
          {sites.length === 0 && (
            <GridItem colSpan={2}>
              <Box p={10} {...card} textAlign="center">
                <VStack spacing={3}>
                  <Text fontSize="2xl">🌐</Text>
                  <Text color="whiteAlpha.500">No websites yet. Add one on the Dashboard.</Text>
                </VStack>
              </Box>
            </GridItem>
          )}
        </Grid>
      )}
    </Stack>
  );
}
