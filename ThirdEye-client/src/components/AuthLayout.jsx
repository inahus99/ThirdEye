// src/components/AuthLayout.jsx
import React from "react";
import {
  Box, Container, Grid, GridItem, Heading, Stack, Text, HStack, Icon,
} from "@chakra-ui/react";
import { CheckCircleIcon, TimeIcon, RepeatIcon, StarIcon } from "@chakra-ui/icons";
import { Link as RouterLink } from "react-router-dom";

const Feature = ({ icon, title, desc }) => (
  <HStack align="start" spacing={3}>
    <Icon as={icon} color="blue.300" boxSize="5" mt="1" />
    <Box>
      <Text fontWeight="bold">{title}</Text>
      <Text color="whiteAlpha.700" fontSize="sm">{desc}</Text>
    </Box>
  </HStack>
);

export default function AuthLayout({ title = "Sign in", children }) {
  return (
    <Box
      minH="100vh"
      bg="#0a0f15"
      color="white"
      position="relative"
      overflow="hidden"
      _before={{
        content:'""', position:'absolute', inset:0,
        bgGradient:
          'radial(110rem 50rem at 90% -10%, rgba(76,134,255,.18), transparent), radial(90rem 50rem at -15% 110%, rgba(45,212,191,.14), transparent)',
      }}
      _after={{
        content:'""', position:'absolute', inset:0, pointerEvents:'none',
        boxShadow:'inset 0 0 200px rgba(0,0,0,0.45)',
      }}
    >
      <Container
        maxW="8xl"
        minH="100vh"
        position="relative"
        display="flex"
        alignItems="center"
        px={{ base: 4, md: 10 }}
        py={0}
        zIndex={1}
      >
      
        <HStack
          as={RouterLink}
          to="/"
          spacing={3}
          position="absolute"
          top={{ base: 6, md: 8 }}
          left={{ base: 4, md: 10 }}
          _hover={{ opacity: 0.9, textDecoration: "none" }}
        >
          <Box fontSize={{ base: "2xl", md: "3xl" }}>🛡️</Box>
          <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="extrabold" color="whiteAlpha.900">
            Third Eye
          </Text>
        </HStack>

        <Grid
          w="100%"
          pt={{ base: 16, md: 24 }}         
          templateColumns={{ base: "1fr", lg: "1.2fr 1fr" }}
          gap={{ base: 8, md: 14 }}
          alignItems="stretch"
        >
          {/* LEFT: features & hero */}
          <GridItem display="flex">
            <Stack spacing={8} justify="center">
              <Heading as="h1" size="xl" lineHeight="1.1">
                Monitor smarter. Deploy with confidence.
              </Heading>

              <Stack spacing={5}>
                <Feature icon={CheckCircleIcon} title="Adaptable performance"
                  desc="Scales with your workload and surfaces the right signal at the right time." />
                <Feature icon={StarIcon} title="Great UX"
                  desc="Clean, fast UI. Dark mode first. Keyboard friendly." />
                <Feature icon={RepeatIcon} title="Automation ready"
                  desc="Cron-based checks + real-time WebSocket pushes." />
                <Feature icon={TimeIcon} title="Built to last"
                  desc="Historical trends and uptime summaries in one place." />
              </Stack>
            </Stack>
          </GridItem>

          {/* RIGHT: form card */}
          <GridItem display="flex">
            <Box
              flex="1"
              bg="whiteAlpha.120"
              border="1px solid"
              borderColor="whiteAlpha.300"
              rounded="2xl"
              boxShadow="2xl"
              p={{ base: 8, md: 10 }}
              backdropFilter="blur(8px)"
              maxW="640px"
              w="100%"
              ml="auto"
            >
              <Heading as="h2" size="md" mb={6}>{title}</Heading>
              {children}
            </Box>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
}
