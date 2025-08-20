// src/theme.js
import { extendTheme } from "@chakra-ui/react";

export const theme = extendTheme({
  config: { initialColorMode: "dark", useSystemColorMode: false },

  fonts: {
    heading:
      "Poppins, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    body: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },

  colors: {
    brand: {
      50: "#e8f1ff",
      100: "#cfe1ff",
      200: "#a9c6ff",
      300: "#7aa5ff",
      400: "#4d86ff",
      500: "#3b82f6", // primary
      600: "#2563eb",
      700: "#1e40af",
      800: "#1e3a8a",
      900: "#172554",
    },
  },

  semanticTokens: {
    colors: {
      // dark
      bg: { default: "#0e1111", _light: "#ffffff" },
      surface: { default: "#232b2b", _light: "#f8fafc" },
      surfaceAlt: { default: "#353839", _light: "#eef2f7" },
      surfaceMut: { default: "#3b444b", _light: "#e5e9ef" },
      border: { default: "#414a4c", _light: "#dbe0e6" },
      text: { default: "#ffffff", _light: "#0f172a" },
      muted: { default: "rgba(255,255,255,0.72)", _light: "#475569" },
    },
  },

  styles: {
    global: {
      "html, body, #root": { height: "100%" },
      body: { bg: "bg", color: "text" },
      "*::placeholder": { color: "whiteAlpha.600" },
    },
  },

  components: {
    Container: { baseStyle: { px: { base: 4, md: 6 } } },

    Button: {
      baseStyle: { _disabled: { opacity: 0.6, cursor: "not-allowed" } },
      variants: {
        solid: {
          bg: "brand.500",
          color: "white",
          _hover: { bg: "brand.600" },
          _active: { bg: "brand.700" },
        },
        outline: {
          borderColor: "border",
          color: "text",
          bg: "transparent",
          _hover: { bg: "surfaceAlt" },
        },
        ghost: {
          color: "text",
          _hover: { bg: "surfaceAlt" },
        },
      },
      defaultProps: { colorScheme: "brand" },
    },

    Input: {
      variants: {
        outline: {
          field: {
            bg: "surface",
            borderColor: "border",
            color: "text",
            _hover: { borderColor: "border" },
            _focus: {
              borderColor: "brand.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
            },
          },
        },
      },
      defaultProps: { variant: "outline" },
    },

    Textarea: {
      variants: {
        outline: {
          bg: "surface",
          borderColor: "border",
          color: "text",
          _hover: { borderColor: "border" },
          _focus: {
            borderColor: "brand.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
          },
        },
      },
      defaultProps: { variant: "outline" },
    },

    Select: {
      variants: {
        outline: {
          field: {
            bg: "surface",
            borderColor: "border",
            color: "text",
            _hover: { borderColor: "border" },
            _focus: {
              borderColor: "brand.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
            },
          },
        },
      },
      defaultProps: { variant: "outline" },
    },

    Menu: {
      baseStyle: {
        list: { bg: "surface", border: "1px solid", borderColor: "border" },
      },
    },

    Popover: {
      baseStyle: {
        content: { bg: "surface", border: "1px solid", borderColor: "border" },
      },
    },

    Table: {
      variants: {
        simple: {
          th: { color: "muted", borderColor: "border" },
          td: { borderColor: "border" },
          tbody: { tr: { _hover: { bg: "surfaceAlt" } } },
        },
      },
    },
  },
});
