// src/index.jsx
import React, { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { theme } from "./theme";

// Layouts / providers
import AppShell from "./components/AppShell";
import AuthLayout from "./components/AuthLayout";
import { AuthProvider } from "./lib/auth-context";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Clients from "./pages/Clients";
import Assets from "./pages/Assets";
import Settings from "./pages/Settings";
import Contact from "./pages/Contact";
import SiteOverview from "./pages/SiteOverview";
import Logs from "./pages/Logs";
import "./styles.css";
// side-effect import: initializes Socket.IO connection once
import "./lib/socket";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <StrictMode>
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route
              path="/login"
              element={
                <AuthLayout title="Sign in">
                  <Login />
                </AuthLayout>
              }
            />
            <Route
              path="/signup"
              element={
                <AuthLayout title="Sign up">
                  <Signup />
                </AuthLayout>
              }
            />

            {/* App pages (unprotected) */}
            <Route
              path="/dashboard"
              element={
                <AppShell>
                  <Dashboard />
                </AppShell>
              }
            />
            <Route
              path="/site"
              element={
                <AppShell>
                  <SiteOverview />
                </AppShell>
              }
            />
            <Route
              path="/analytics"
              element={
                <AppShell>
                  <Analytics />
                </AppShell>
              }
            />
            <Route
              path="/clients"
              element={
                <AppShell>
                  <Clients />
                </AppShell>
              }
            />
            <Route
              path="/logs"
              element={
                <AppShell>
                  <Logs />
                </AppShell>
              }
            />
            <Route
              path="/assets"
              element={
                <AppShell>
                  <Assets />
                </AppShell>
              }
            />

            <Route
              path="/settings"
              element={
                <AppShell>
                  <Settings />
                </AppShell>
              }
            />

            <Route
              path="/contact"
              element={
                <AppShell>
                  <Contact />
                </AppShell>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ChakraProvider>
  </StrictMode>
);
