import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Heading,
  HStack,
  Stack,
  Text,
  Badge,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  useToast,
  Spacer,
  Divider,
  Code,
} from "@chakra-ui/react";
import {
  FiLink,
  FiCheckCircle,
  FiXCircle,
  FiCopy,
  FiActivity,
  FiRefreshCw,
} from "react-icons/fi";

const LS_KEY = "third-eye.api_override";

const useToastMock = () => {
  return (options) => {
    console.log("Toast:", options);

    alert(
      `${options.title}${options.description ? `: ${options.description}` : ""}`
    );
  };
};

const dot = (ok) => (
  <Box
    w="10px"
    h="10px"
    rounded="full"
    bg={ok ? "green.400" : "red.400"}
    boxShadow={
      ok ? "0 0 0 3px rgba(16,185,129,.25)" : "0 0 0 3px rgba(239,68,68,.25)"
    }
  />
);
function join(base, path) {
  const b = (base || "").replace(/\/+$/, "");
  const p = (path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

export default function Settings() {
  const toast = useToastMock();

  const [apiUrl, setApiUrl] = useState("http://localhost:5000");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null); // { ok, ms, status, endpoint }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setApiUrl(saved);
    } catch {}
  }, []);

  const curl = useMemo(
    () =>
      `curl -s ${JSON.stringify(
        join(apiUrl, "/api/health")
      )} || curl -s ${JSON.stringify(join(apiUrl, "/health"))}`,
    [apiUrl]
  );

  const save = () => {
    localStorage.setItem(LS_KEY, apiUrl);
    toast({
      title: "Saved",
      description: "API URL override stored in your browser.",
      status: "success",
    });
  };

  const clear = () => {
    localStorage.removeItem(LS_KEY);
    setApiUrl("http://localhost:5000");
    setResult(null);
    toast({ title: "Cleared", status: "info" });
  };

  const testApi = async () => {
    setTesting(true);
    setResult(null);

    const t0 = performance.now();
    const endpoints = ["/api/health", "/health", "/api/ping", "/ping", "/"];
    let ok = false,
      status = 0,
      endpoint = "",
      text = "";

    for (const ep of endpoints) {
      try {
        const res = await fetch(join(apiUrl, ep), { method: "GET" });
        status = res.status;
        endpoint = ep;
        text = await res.text().catch(() => "");
        if (res.ok) {
          ok = true;
          break;
        }
      } catch {
        // CORS/network failure – try next
      }
    }

    const ms = Math.max(1, Math.round(performance.now() - t0));
    setResult({ ok, ms, status, endpoint, text });
    setTesting(false);

    toast({
      title: ok ? "API reachable" : "API test failed",
      description: ok
        ? `Responded in ${ms} ms (${endpoint || "/"})`
        : "Couldn’t reach any health endpoint.",
      status: ok ? "success" : "error",
    });
  };

  return (
    <Box>
      {/* Page title */}
      <HStack mb={6} spacing={3}>
        <Heading size="xl">Settings</Heading>
      </HStack>

      {/* API URL card (with test) */}
      <Box
        bg="whiteAlpha.100"
        border="1px solid"
        borderColor="whiteAlpha.300"
        rounded="2xl"
        p={{ base: 6, md: 8 }}
        backdropFilter="blur(6px)"
        overflow="hidden"
        maxW="100%"
      >
        <Heading size="md" mb={2}>
          API URL override
        </Heading>
        <Text color="whiteAlpha.800" mb={4}>
          Defaults to <Code>http://localhost:5000</Code>. You can point the
          client at a different backend during local dev or after deploying.
        </Text>

        <Stack spacing={4}>
          <InputGroup size="lg">
            <InputLeftElement
              w="3rem"
              h="100%"
              pointerEvents="none"
              color="gray.400"
            >
              <Icon as={FiLink} boxSize="5" />
            </InputLeftElement>
            <Input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.yourapp.com"
              bg="#0f1320"
              borderColor="whiteAlpha.300"
              _hover={{ borderColor: "whiteAlpha.400" }}
              _focus={{
                borderColor: "blue.400",
                boxShadow: "0 0 0 1px #4299E1",
              }}
              color="white"
              rounded="lg"
              pl="3.5rem"
            />
          </InputGroup>

          <HStack>
            <Button
              colorScheme="blue"
              rounded="xl"
              onClick={save}
              leftIcon={<FiCheckCircle />}
            >
              Save
            </Button>
            <Button
              variant="outline"
              rounded="xl"
              onClick={clear}
              leftIcon={<FiXCircle />}
            >
              Clear
            </Button>
            <Spacer />+{" "}
            <Button
              rounded="xl"
              leftIcon={<FiActivity />}
              onClick={testApi}
              isLoading={testing}
              loadingText="Testing…"
              variant="solid"
              colorScheme="teal"
            >
              Test API
            </Button>
          </HStack>

          {result && (
            <Box
              mt={2}
              p={3}
              rounded="lg"
              border="1px solid"
              borderColor="whiteAlpha.300"
              bg="whiteAlpha.50"
            >
              <HStack>
                {dot(result.ok)}
                <Text fontWeight="600">
                  {result.ok ? "Reachable" : "Unreachable"}
                </Text>
                <Badge>{result.ms} ms</Badge>
                {result.endpoint ? (
                  <Badge colorScheme="purple">
                    endpoint: {result.endpoint}
                  </Badge>
                ) : null}
                <Badge colorScheme={result.ok ? "green" : "red"}>
                  HTTP {result.status || "—"}
                </Badge>
              </HStack>
            </Box>
          )}

          <Divider borderColor="whiteAlpha.300" />

          <Stack spacing={2}>
            <Text color="whiteAlpha.800" fontWeight="600">
              Quick tools
            </Text>
            <HStack>
              <Button
                variant="outline"
                leftIcon={<FiCopy />}
                rounded="lg"
                onClick={async () => {
                  await navigator.clipboard.writeText(apiUrl);
                  toast({
                    title: "Copied API URL",
                    status: "success",
                    duration: 1000,
                  });
                }}
              >
                Copy API URL
              </Button>
              <Button
                variant="ghost"
                leftIcon={<FiRefreshCw />}
                rounded="lg"
                onClick={() => setResult(null)}
              >
                Clear test result
              </Button>
            </HStack>

            <Box
              as="pre"
              p={3}
              bg="#0b0f1a"
              border="1px solid"
              borderColor="whiteAlpha.300"
              rounded="md"
              fontSize="sm"
              whiteSpace="pre-wrap" // wrap long lines
              wordBreak="break-all" // break very long tokens
              maxW="100%" // never exceed the card
            >
              {curl}
            </Box>

            <Text color="whiteAlpha.600" fontSize="sm">
              Tip: when deployed, set <Code>REACT_APP_API_URL</Code> on Vercel
              to your Render server URL. This override is mainly for quick
              testing.
            </Text>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
