import React, { useEffect, useMemo, useState, forwardRef } from "react";
import {
  Box,
  Container,
  Heading,
  Text,
  HStack,
  VStack,
  Tag,
  TagLabel,
  TagLeftIcon,
  Button,
  Tooltip,
  SimpleGrid,
  useColorModeValue,
  Link as ChakraLink,
  Divider,
  Icon,
  createIcon,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import {
  FiZap,
  FiCheckCircle,
  FiActivity,
  FiRefreshCw,
  FiShield,
  FiFileText,
  FiTrendingUp,
  FiCheckCircle,
  FiLayout,
  FiTrendingUp,
  FiTerminal,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { socket } from "../lib/socket";
import { api } from "../lib/api";

const LogoIcon = createIcon({
  displayName: "LogoIcon",
  viewBox: "0 0 48 48",
  path: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M24 4C12.954 4 4 12.954 4 24C4 35.046 12.954 44 24 44C35.046 44 44 35.046 44 24C44 12.954 35.046 4 24 4ZM24 6C14.059 6 6 14.059 6 24C6 33.941 14.059 42 24 42C33.941 42 42 33.941 42 24C42 14.059 33.941 6 24 6ZM24 12C17.373 12 12 17.373 12 24H14C14 18.477 18.477 14 24 14V12Z"
      fill="currentColor"
    />
  ),
});

// ---  Reusable Components ---

const GlowButton = ({ children, onClick, variant = "solid", ...props }) => (
  <Button
    onClick={onClick}
    variant={variant}
    borderRadius="xl"
    px={6}
    py={6}
    fontWeight="800"
    transition="all .18s ease"
    _hover={{
      transform: "translateY(-2px)",
      boxShadow:
        variant === "solid"
          ? "0 12px 28px rgba(59,130,246,0.45)"
          : "0 12px 28px rgba(255,255,255,0.12)",
    }}
    _active={{ transform: "translateY(0)" }}
    {...props}
  >
    {children}
  </Button>
);

const HoverCard = forwardRef(({ children, ...props }, ref) => {
  const bg = useColorModeValue("whiteAlpha.100", "whiteAlpha.100");
  const hover = useColorModeValue("whiteAlpha.200", "whiteAlpha.200");
  return (
    <motion.div
      ref={ref}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.16 }}
    >
      <Box
        bg={bg}
        border="1px solid"
        borderColor="whiteAlpha.300"
        rounded="xl"
        p={4}
        _hover={{ bg: hover }}
        {...props}
      >
        {children}
      </Box>
    </motion.div>
  );
});

const LivePill = () => (
  <Tag
    size="lg"
    colorScheme="blue"
    variant="subtle"
    rounded="full"
    px={4}
    py={2}
    transition="all 0.2s ease-in-out"
    _hover={{
      transform: "translateY(-2px)",
      cursor: "default",
      boxShadow: "0 8px 20px rgba(59, 130, 246, 0.25)",
    }}
  >
    <TagLeftIcon as={FiZap} />
    <TagLabel>LIVE · real-time via Socket.IO</TagLabel>
  </Tag>
);

const StatusBadge = ({ ok, label, icon, tooltip }) => (
  <Tooltip label={tooltip} hasArrow>
    <HoverCard px={3} py={2}>
      <Tag size="md" variant="subtle" colorScheme={ok ? "green" : "red"}>
        <TagLeftIcon as={icon || FiCheckCircle} />
        <TagLabel>
          {label}: {ok == null ? "—" : ok ? "Online" : "Offline"}
        </TagLabel>
      </Tag>
    </HoverCard>
  </Tooltip>
);

const FeatureTile = ({ icon, title, desc, accent = "blue" }) => (
  <HoverCard h="full" p={6}>
    <VStack align="start" spacing={3}>
      <Icon as={icon} boxSize="24px" color={`${accent}.300`} />
      <Heading size="md">{title}</Heading>
      <Text color="whiteAlpha.800">{desc}</Text>
    </VStack>
  </HoverCard>
);

// --- Status Hooks ---

function useSocketStatus() {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);
  return connected;
}

function useBackendStatuses() {
  const [apiOk, setApiOk] = useState(null);
  const [collectorOk, setCollectorOk] = useState(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const h = await api.get("/health");
        if (!cancel) setApiOk(Boolean(h?.ok));
      } catch {
        if (!cancel) setApiOk(false);
      }
      try {
        const t = await api.get("/traffic-lite/_ping");
        if (!cancel) setCollectorOk(Boolean(t?.ok));
      } catch {
        if (!cancel) setCollectorOk(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);
  return { apiOk, collectorOk };
}

// --- Main Page Component ( Layout) ---

export default function Landing() {
  const navigate = useNavigate();
  const socketOk = useSocketStatus();
  const { apiOk, collectorOk } = useBackendStatuses();

  return (
    <Box bg="#0b0f14" color="white">
      <Container maxW="7xl" px={6}>
        {/* Header */}
        <HStack
          as="header"
          py={6}
          justifyContent="space-between"
          alignItems="center"
          position="sticky"
          top="0"
          zIndex="docked"
          bg="#0b0f14"
        >
          <HStack spacing={3}>
            <Text fontSize="xl" fontWeight="bold">
              {" "}
              🛡️ Third Eye
            </Text>
          </HStack>
          <HStack spacing={8} display={{ base: "none", md: "flex" }}>
            <ChakraLink href="#features" _hover={{ color: "blue.300" }}>
              Features
            </ChakraLink>
            <ChakraLink href="#comparison" _hover={{ color: "blue.300" }}>
              Comparison
            </ChakraLink>
          </HStack>
          <HStack spacing={4}>
            <Button variant="link" onClick={() => navigate("/login")}>
              Log In
            </Button>
            <GlowButton
              onClick={() => navigate("/signup")}
              size="md"
              px={5}
              py={5}
            >
              Sign Up
            </GlowButton>
          </HStack>
        </HStack>

        <VStack
          as="main"
          spacing={{ base: 16, md: 24 }}
          py={{ base: 12, md: 20 }}
        >
          {/* Hero Section */}
          <VStack spacing={6} textAlign="center">
            <LivePill />
            <Heading
              as="h1"
              fontSize={{ base: "4xl", md: "6xl" }}
              fontWeight="900"
              lineHeight="tight"
            >
              Monitor less.{" "}
              <Box as="span" color="blue.300">
                Know more. Act faster.
              </Box>
            </Heading>
            <Text
              fontSize={{ base: "lg", md: "xl" }}
              color="whiteAlpha.700"
              maxW="3xl"
              mx="auto"
            >
              Third Eye is the simple, powerful monitoring platform for
              developers who'd rather ship code than fight with dashboards. We
              find the glitch before it becomes a crisis.
            </Text>
            <HStack pt={4} spacing={4}>
              <GlowButton onClick={() => navigate("/signup")}>
                Start Monitoring in 2 Mins
              </GlowButton>
              <GlowButton
                onClick={() =>
                  window.open("https://github.com/SuhaniTyagi", "_blank")
                }
                variant="outline"
                borderColor="whiteAlpha.300"
              >
                Read Docs
              </GlowButton>
            </HStack>
            <HStack pt={6} spacing={4} justify="center" flexWrap="wrap">
              <StatusBadge
                ok={apiOk}
                label="API"
                tooltip="Backend API health"
              />
              <StatusBadge
                ok={true}
                label="Collector"
                icon={FiActivity}
                tooltip="Log & event collector service"
              />
              <StatusBadge
                ok={socketOk}
                label="Live Feed"
                icon={FiRefreshCw}
                tooltip="Real-time updates connected"
              />
            </HStack>
          </VStack>

          {/* Key Benefits Section - FIXED JUMP SCROLL */}
          <VStack
            id="features"
            spacing={8}
            align="stretch"
            w="full"
            scrollMarginTop={24}
          >
            <Heading size="xl" textAlign="center">
              Everything you need—nothing you don't
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
              <FeatureTile
                icon={FiShield}
                title="SSL/Domain Expiration"
                desc="Automatic certificate and domain expiry warnings keep you ahead of silent, trust-killing failures."
                accent="green"
              />
              <FeatureTile
                icon={FiZap}
                title="Real-time Incident Alerts"
                desc="Live WebSocket updates mean you see state changes the moment they happen. No more refreshing."
                accent="cyan"
              />
              <FeatureTile
                icon={FiFileText}
                title="Centralized Log Management"
                desc="Aggregate, search, and analyze logs from all your services in one place. Find root causes faster without the noise." // Changed description
                accent="purple"
              />
              <FeatureTile
                icon={FiTrendingUp}
                title="Performance Monitoring"
                desc="Track response times from multiple locations. Identify performance bottlenecks and slowdowns before they affect your users."
                accent="yellow"
              />
              <FeatureTile
                icon={FiCheckCircle}
                title="Uptime Monitoring"
                desc="Get a clear view of your site's availability with historical uptime percentages and detailed incident logs."
                accent="teal"
              />
              <FeatureTile
                icon={FiLayout}
                title="Dedicated Status Pages"
                desc="Create beautiful, dedicated pages for each of your sites, showing live status, performance metrics, and incident history."
                accent="pink"
              />
            </SimpleGrid>
          </VStack>

          {/* Comparison Section - FIXED JUMP SCROLL */}
          <VStack
            id="comparison"
            spacing={5}
            align="stretch"
            w="full"
            scrollMarginTop={24}
          >
            <Heading size="xl" textAlign="center">
              Built for developers, not committees.
            </Heading>
            <Text
              fontSize="lg"
              color="whiteAlpha.700"
              maxW="2xl"
              mx="auto"
              textAlign="center"
            >
              Other "all-in-one" tools are bloated and complex. Third Eye is
              fast, focused, and gets out of your way.
            </Text>
            <Box
              mt={4}
              bg="whiteAlpha.50"
              rounded="xl"
              border="1px"
              borderColor="whiteAlpha.200"
              p={6}
            >
              <VStack
                divider={<Divider borderColor="whiteAlpha.200" />}
                spacing={4}
              >
                <SimpleGrid
                  columns={3}
                  w="full"
                  color="whiteAlpha.600"
                  fontWeight="bold"
                >
                  <Text>Capability</Text>
                  <Text>Third Eye</Text>
                  <Text>Typical "All-in-One"</Text>
                </SimpleGrid>
                <SimpleGrid columns={3} w="full" alignItems="center">
                  <Text fontWeight="semibold">Setup time</Text>
                  <Text color="blue.300">Under 2 minutes</Text>
                  <Text color="whiteAlpha.600">
                    Complex, multi-step process
                  </Text>
                </SimpleGrid>
                <SimpleGrid columns={3} w="full" alignItems="center">
                  <Text fontWeight="semibold">Domain/SSL Expiry</Text>
                  <Text color="blue.300">Built-in, automatic</Text>
                  <Text color="whiteAlpha.600">Often an expensive add-on</Text>
                </SimpleGrid>
                <SimpleGrid columns={3} w="full" alignItems="center">
                  <Text fontWeight="semibold">Dashboard UI</Text>
                  <Text color="blue.300">Clean, fast, real-time</Text>
                  <Text color="whiteAlpha.600">Slow, cluttered, confusing</Text>
                </SimpleGrid>
                <SimpleGrid columns={3} w="full" alignItems="center">
                  <Text fontWeight="semibold">Real-time Data</Text>
                  <Text color="blue.300">Instant via WebSockets</Text>
                  <Text color="whiteAlpha.600">Delayed, polling-based</Text>
                </SimpleGrid>

                <SimpleGrid columns={3} w="full" alignItems="center">
                  <Text fontWeight="semibold">Log Management</Text>
                  <Text color="blue.300">Integrated, no extra cost</Text>
                  <Text color="whiteAlpha.600">Requires separate service</Text>
                </SimpleGrid>
              </VStack>
            </Box>
          </VStack>

          {/*  CTA */}
          <VStack spacing={4} textAlign="center" pt={10}>
            <Heading size="2xl" fontWeight="bold">
              Stop guessing. Start knowing.
            </Heading>
            <Text fontSize="lg" color="whiteAlpha.700" maxW="xl" mx="auto">
              Get total visibility into your application's health in minutes.
            </Text>
            <Box pt={4}>
              <GlowButton
                onClick={() => navigate("/signup")}
                py={7}
                px={10}
                fontSize="xl"
              >
                Get Started Now
              </GlowButton>
            </Box>
          </VStack>
        </VStack>

        {/* Footer */}
        <VStack as="footer" py={8} spacing={4}>
          <Divider borderColor="whiteAlpha.300" />
          <Text fontSize="sm" color="whiteAlpha.600">
            © {new Date().getFullYear()} Third Eye — Crafted by{" "}
            <ChakraLink
              isExternal
              href="https://github.com/SuhaniTyagi"
              color="blue.300"
              fontWeight="600"
              _hover={{ textDecoration: "underline" }}
            >
              Suhani Tyagi
            </ChakraLink>
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}
