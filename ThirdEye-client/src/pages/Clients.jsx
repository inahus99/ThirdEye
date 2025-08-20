// src/pages/Clients.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Heading,
  HStack,
  Badge,
  Spacer,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  TagLabel,
  TagCloseButton,
  Text,
  Tooltip,
  IconButton,
  Link as ChakraLink,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from "@chakra-ui/react";
import {
  FiGlobe,
  FiPlus,
  FiTag,
  FiSearch,
  FiExternalLink,
  FiTrash2,
} from "react-icons/fi";
import { api } from "../lib/api";

/* ---------- helpers ---------- */
const slugify = (v = "") =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 20);

const tagColor = (t) => {
  const k = slugify(t);
  if (/(prod|production)/.test(k)) return "green";
  if (/(stage|staging)/.test(k)) return "yellow";
  if (/(dev|test)/.test(k)) return "purple";
  if (/(eu|europe)/.test(k)) return "blue";
  if (/(us|na)/.test(k)) return "cyan";
  return "gray";
};

// normalize: array or { items: [...] }
const normalizeList = (res) => (Array.isArray(res) ? res : res?.items || []);

export default function Clients() {
  const [sites, setSites] = useState([]);
  const [filter, setFilter] = useState("");
  const [newSite, setNewSite] = useState("");

  // fetch sites
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/websites");
        setSites(normalizeList(res));
      } catch (e) {
        console.error("Load sites failed:", e);
        setSites([]); // ensure array
      }
    })();
  }, []);

  const filteredSites = useMemo(() => {
    const list = Array.isArray(sites) ? sites : [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => (s?.url || "").toLowerCase().includes(q));
  }, [sites, filter]);

  const addSite = async () => {
    const url = newSite.trim();
    if (!/^https?:\/\//i.test(url)) return;
    try {
      const res = await api.post("/websites", { url });
      const site = res?.site || res; // backend returns { ok, site }
      setSites((prev) => [site, ...(prev || [])]);
      setNewSite("");
    } catch (e) {
      // if conflict, backend sends existing site in e.body.site (from api helper)
      const existing = e?.body?.site;
      if (existing) {
        setSites((prev = []) => {
          const already = prev.some((p) => (p._id || p.id) === existing._id);
          return already ? prev : [existing, ...prev];
        });
        setNewSite("");
      } else {
        console.error("Add site failed:", e);
      }
    }
  };

  const removeSite = async (id) => {
    const prev = sites;
    setSites((p = []) => p.filter((s) => (s._id || s.id) !== id));
    try {
      await api.del(`/websites/${id}`);
    } catch (e) {
      console.error("Delete failed:", e);
      setSites(prev); // rollback
    }
  };

  return (
    <Box>
      {/* Header / toolbar */}
      <HStack mb={4} spacing={3} align="center">
        <Heading size="md">Clients</Heading>
        <Badge colorScheme="blue" variant="subtle">
          {Array.isArray(sites) ? `${sites.length} total` : "—"}
        </Badge>
        <Spacer />
        <InputGroup maxW="280px" size="md">
          <InputLeftElement w="2.75rem" h="100%" pointerEvents="none">
            <Icon as={FiSearch} />
          </InputLeftElement>
          <Input
            placeholder="Search sites…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            bg="surface"
            borderColor="border"
            _hover={{ borderColor: "border" }}
            _focus={{
              borderColor: "brand.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
            }}
            color="text"
            rounded="lg"
            pl="2.75rem"
            h="42px"
          />
        </InputGroup>

        <InputGroup maxW="380px" size="md">
          <InputLeftElement w="2.75rem" h="100%" pointerEvents="none">
            <Icon as={FiGlobe} />
          </InputLeftElement>
          <Input
            placeholder="https://new-site.example"
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSite()}
            bg="surface"
            borderColor="border"
            _hover={{ borderColor: "border" }}
            _focus={{
              borderColor: "brand.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
            }}
            color="text"
            rounded="lg"
            pl="2.75rem"
            h="42px"
          />
          <Button
            ml={2}
            size="md"
            h="42px"
            leftIcon={<FiPlus />}
            onClick={addSite}
            colorScheme="blue"
            rounded="lg"
          >
            Add
          </Button>
        </InputGroup>
      </HStack>

      {/* Table card */}
      <Box
        bg="surface"
        border="1px solid"
        borderColor="border"
        rounded="2xl"
        p={0}
        overflow="hidden"
      >
        <Table variant="simple">
          <Thead bg="surfaceAlt">
            <Tr>
              <Th color="muted" fontWeight="600">
                Website
              </Th>
              <Th color="muted" fontWeight="600">
                Tags
              </Th>
              <Th color="muted" fontWeight="600" w="38%">
                Add tag
              </Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {filteredSites.map((site) => (
              <ClientRow
                key={site._id || site.id}
                site={site}
                onRemoveSite={removeSite}
              />
            ))}

            {filteredSites.length === 0 && (
              <Tr>
                <Td colSpan={4}>
                  <Text color="muted" py={8} textAlign="center">
                    No sites match your search.
                  </Text>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}

/* ---------- row (with confirmation dialog) ---------- */
function ClientRow({ site, onRemoveSite }) {
  const [draft, setDraft] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef();

  // local-only tags (since backend model has no tags)
  const [siteTags, setSiteTags] = useState(site.tags || []);

  const addTag = () => {
    const t = slugify(draft);
    if (!t) return;
    setSiteTags((prev) => Array.from(new Set([...(prev || []), t])));
    setDraft("");
  };
  const removeTag = (tag) =>
    setSiteTags((prev) => (prev || []).filter((x) => x !== tag));

  const confirmDelete = async () => {
    await onRemoveSite(site._id || site.id);
    onClose();
  };

  return (
    <Tr _hover={{ bg: "whiteAlpha.50" }}>
      <Td>
        <HStack spacing={2}>
          <Icon as={FiGlobe} opacity={0.85} />
          <ChakraLink
            href={site.url}
            isExternal
            color="blue.300"
            _hover={{ textDecoration: "underline" }}
          >
            {site.url} <Icon as={FiExternalLink} ml="1" />
          </ChakraLink>
        </HStack>
      </Td>

      <Td>
        <HStack spacing={2} wrap="wrap">
          {(siteTags || []).map((tag) => (
            <Tag
              key={tag}
              size="md"
              borderRadius="full"
              colorScheme={tagColor(tag)}
              variant="subtle"
            >
              <TagLabel>{tag}</TagLabel>
              <TagCloseButton onClick={() => removeTag(tag)} />
            </Tag>
          ))}
          {(!siteTags || siteTags.length === 0) && (
            <Text color="whiteAlpha.500">—</Text>
          )}
        </HStack>
      </Td>

      <Td>
        <HStack>
          <Input
            size="sm"
            placeholder="prod / staging / eu"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            bg="surface"
            borderColor="border"
            _hover={{ borderColor: "border" }}
            _focus={{
              borderColor: "brand.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
            }}
            color="text"
            rounded="lg"
          />
          <Button
            size="sm"
            onClick={addTag}
            variant="outline"
            leftIcon={<Icon as={FiTag} />}
            rounded="lg"
          >
            Add
          </Button>
        </HStack>
      </Td>

      <Td textAlign="right">
        <Tooltip label="Remove site">
          <IconButton
            aria-label="Remove site"
            icon={<FiTrash2 />}
            size="sm"
            variant="ghost"
            onClick={onOpen}
          />
        </Tooltip>

        {/* Confirmation dialog */}
        <AlertDialog
          isOpen={isOpen}
          leastDestructiveRef={cancelRef}
          onClose={onClose}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete Site
              </AlertDialogHeader>
              <AlertDialogBody>
                Are you sure you want to delete <b>{site.url}</b>? This action
                cannot be undone.
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={onClose}>
                  Cancel
                </Button>
                <Button colorScheme="red" onClick={confirmDelete} ml={3}>
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </Td>
    </Tr>
  );
}
