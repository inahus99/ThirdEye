// src/pages/Contact.jsx
import React, { useMemo, useState } from "react";
import {
  Box,
  Grid,
  GridItem,
  Stack,
  Heading,
  Text,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  InputGroup,
  InputLeftElement,
  Button,
  HStack,
  Badge,
  useToast,
  useClipboard,
  Link as ChakraLink,
  Icon,
  Divider,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Tag,
  TagLeftIcon,
  SimpleGrid,
} from "@chakra-ui/react";
import { EmailIcon, InfoOutlineIcon } from "@chakra-ui/icons";
import {
  FiUser,
  FiMail,
  FiExternalLink,
  FiCopy,
  FiLifeBuoy,
  FiBookOpen,
  FiGithub,
  FiZap,
  FiWifi,
  FiDownload,
} from "react-icons/fi";
import { keyframes } from "@emotion/react";

/* --- tiny pulse for the green status dot --- */
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(16,185,129,.45); }
  70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
  100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
`;

export default function Contact() {
  /* ---------- left form state ---------- */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const toast = useToast();

  /* ---------- helpers ---------- */
  const supportEmail = "support@third-eye.work";
  const githubUrl = "https://github.com/your-repo";
  const { hasCopied, onCopy } = useClipboard(supportEmail);

  const mailtoHref = useMemo(() => {
    const sub = encodeURIComponent(
      `[Third Eye] Contact from ${name || "User"}`
    );
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message || ""}`
    );
    return `mailto:${supportEmail}?subject=${sub}&body=${body}`;
  }, [name, email, message]);

  const onSend = (e) => {
    e.preventDefault();
    if (!email || !message) {
      toast({
        title: "Please fill email and message.",
        status: "warning",
        duration: 2000,
      });
      return;
    }
    window.location.href = mailtoHref;
  };

  /* ---------- right-card chips (Simplified) ---------- */
  const metricChips = [
    {
      label: "Email support",
      icon: FiMail,
      bg: "teal.900",
      color: "teal.200",
      hoverBg: "teal.800",
    },
  ];

  /* ---------- quick actions config (Simplified) ---------- */
  const actions = [
    {
      label: "Email Support",
      icon: FiLifeBuoy,
      href: `mailto:${supportEmail}`,
      kind: "primary",
    },
    { label: "GitHub", icon: FiGithub, href: githubUrl, kind: "link" },
    { label: "Docs", icon: FiBookOpen, href: "#", kind: "link" },
  ];

  return (
    <Grid
      templateColumns={{ base: "1fr", xl: "1.15fr 0.85fr" }}
      gap={{ base: 6, md: 8 }}
    >
      {/* LEFT: FORM */}
      <GridItem>
        <Box
          bg="whiteAlpha.100"
          border="1px solid"
          borderColor="whiteAlpha.300"
          rounded="2xl"
          p={{ base: 6, md: 8 }}
          backdropFilter="blur(6px)"
        >
          <Heading size="md" mb={6}>
            Contact us
          </Heading>

          <form onSubmit={onSend}>
            <Stack spacing={5}>
              {/* Name */}
              <FormControl>
                <FormLabel color="gray.300">Name</FormLabel>
                <InputGroup size="lg">
                  <InputLeftElement
                    w="3rem"
                    h="100%"
                    pointerEvents="none"
                    color="gray.400"
                  >
                    <Icon as={FiUser} boxSize="5" />
                  </InputLeftElement>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
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
              </FormControl>

              {/* Email */}
              <FormControl isRequired>
                <FormLabel color="gray.300">Email</FormLabel>
                <InputGroup size="lg">
                  <InputLeftElement
                    w="3rem"
                    h="100%"
                    pointerEvents="none"
                    color="gray.400"
                  >
                    <EmailIcon boxSize="5" />
                  </InputLeftElement>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
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
                    required
                  />
                </InputGroup>
              </FormControl>

              {/* Message */}
              <FormControl isRequired>
                <FormLabel color="gray.300">Message</FormLabel>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help?"
                  bg="#0f1320"
                  borderColor="whiteAlpha.300"
                  _hover={{ borderColor: "whiteAlpha.400" }}
                  _focus={{
                    borderColor: "blue.400",
                    boxShadow: "0 0 0 1px #4299E1",
                  }}
                  color="white"
                  rounded="lg"
                  resize="vertical"
                  minH="160px"
                />
              </FormControl>

              <HStack justify="space-between">
                <HStack color="gray.400">
                  <InfoOutlineIcon />
                  <Text fontSize="sm">This opens your email client.</Text>
                </HStack>
                <Button type="submit" size="lg" colorScheme="blue" rounded="xl">
                  Send
                </Button>
              </HStack>
            </Stack>
          </form>
        </Box>
      </GridItem>

      {/* RIGHT: INFO / STATUS */}
      <GridItem>
        <Box
          bg="whiteAlpha.100"
          border="1px solid"
          borderColor="whiteAlpha.300"
          rounded="2xl"
          p={{ base: 6, md: 8 }}
          backdropFilter="blur(6px)"
          h="100%"
        >
          {/* Header with pulsing dot + status */}
          <HStack justify="space-between" mb={4}>
            <Heading size="md">Get in touch</Heading>
            <HStack>
              <Box
                w="10px"
                h="10px"
                rounded="full"
                bg="green.400"
                animation={`${pulse} 1.6s infinite`}
              />
              <Badge colorScheme="green" variant="subtle">
                OPERATIONAL
              </Badge>
            </HStack>
          </HStack>

          {/* Metric chips – colored + hoverable + icons */}
          <HStack spacing={3} wrap="wrap" mb={4}>
            {metricChips.map((m) => (
              <Tag
                key={m.label}
                size="lg"
                bg={m.bg}
                color={m.color}
                rounded="md"
                border="1px solid"
                borderColor="whiteAlpha.300"
                cursor="default"
                _hover={{ bg: m.hoverBg }}
                transition="background .15s ease"
              >
                <TagLeftIcon as={m.icon} />
                {m.label}
              </Tag>
            ))}
          </HStack>

          <Divider borderColor="whiteAlpha.300" my={4} />

          {/* Quick Actions – colored, hoverable, with icons */}
          <Stack spacing={3} mb={4}>
            <Heading size="sm">Quick actions</Heading>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
              {actions.map((a) => (
                <Button
                  key={a.label}
                  as={ChakraLink}
                  href={a.href}
                  isExternal={a.href.startsWith("http")}
                  leftIcon={<Icon as={a.icon} />}
                  rightIcon={a.kind === "link" ? <FiExternalLink /> : undefined}
                  rounded="lg"
                  variant={a.kind === "primary" ? "solid" : "outline"}
                  colorScheme={a.kind === "primary" ? "blue" : "whiteAlpha"}
                  bg={a.kind === "primary" ? "blue.500" : "transparent"}
                  _hover={{
                    bg: a.kind === "primary" ? "blue.400" : "whiteAlpha.200",
                    transform: "translateY(-1px)",
                  }}
                  _active={{ transform: "translateY(0px)" }}
                >
                  {a.label}
                </Button>
              ))}
            </SimpleGrid>
          </Stack>

          <Divider borderColor="whiteAlpha.300" my={4} />

          {/* Contact details with copy */}
          <Stack spacing={3} mb={4}>
            <Heading size="sm">Contact details</Heading>
            <HStack>
              <Text as="code" bg="blackAlpha.600" px="2" py="1" rounded="md">
                {supportEmail}
              </Text>
              <Button
                size="sm"
                leftIcon={<FiCopy />}
                onClick={() => {
                  onCopy();
                  toast({
                    title: "Email copied!",
                    status: "success",
                    duration: 1200,
                  });
                }}
              >
                {hasCopied ? "Copied!" : "Copy"}
              </Button>
            </HStack>
          </Stack>

          <Divider borderColor="whiteAlpha.300" my={4} />

          {/* FAQ */}
          <Stack spacing={3}>
            <Heading size="sm">FAQ</Heading>
            <Accordion allowToggle>
              <AccordionItem border="none">
                <h2>
                  <AccordionButton
                    rounded="md"
                    _expanded={{ bg: "whiteAlpha.200" }}
                    _hover={{ bg: "whiteAlpha.150" }}
                    border="1px solid"
                    borderColor="whiteAlpha.300"
                    px={4}
                    py={3}
                  >
                    <HStack flex="1" spacing={3} textAlign="left">
                      <Icon as={FiZap} opacity={0.9} />
                      <Text>How often are checks run?</Text>
                    </HStack>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel color="whiteAlpha.800" pb={4}>
                  By default, checks are performed every <b>5 minutes</b>. We
                  dynamically adjust if a target is rate-limited.
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem border="none" mt={3}>
                <h2>
                  <AccordionButton
                    rounded="md"
                    _expanded={{ bg: "whiteAlpha.200" }}
                    _hover={{ bg: "whiteAlpha.150" }}
                    border="1px solid"
                    borderColor="whiteAlpha.300"
                    px={4}
                    py={3}
                  >
                    <HStack flex="1" spacing={3} textAlign="left">
                      <Icon as={FiWifi} opacity={0.9} />
                      <Text>Do you support WebSockets?</Text>
                    </HStack>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel color="whiteAlpha.800" pb={4}>
                  Yes—real-time pushes use <b>Socket.IO</b>. You’ll see status
                  changes and response times update without refreshing.
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem border="none" mt={3}>
                <h2>
                  <AccordionButton
                    rounded="md"
                    _expanded={{ bg: "whiteAlpha.200" }}
                    _hover={{ bg: "whiteAlpha.150" }}
                    border="1px solid"
                    borderColor="whiteAlpha.300"
                    px={4}
                    py={3}
                  >
                    <HStack flex="1" spacing={3} textAlign="left">
                      <Icon as={FiDownload} opacity={0.9} />
                      <Text>Can I export data?</Text>
                    </HStack>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel color="whiteAlpha.800" pb={4}>
                  Absolutely. You can export uptime, incidents, and latency data
                  as a <b>CSV</b> file from the analytics section.
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </Stack>
        </Box>
      </GridItem>
    </Grid>
  );
}
