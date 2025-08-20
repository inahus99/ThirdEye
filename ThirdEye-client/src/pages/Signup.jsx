// src/pages/Signup.jsx
import React, { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  Link,
  Stack,
  useToast,
  FormErrorMessage,
} from "@chakra-ui/react";
import { EmailIcon, LockIcon } from "@chakra-ui/icons";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

export default function Signup() {
  const toast = useToast();
  const navigate = useNavigate();
  const { register } = useAuth() ?? {};

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({ email: "", pw: "" });

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email.";
    if (!pw) e.pw = "Password is required.";
    else if (pw.length < 6) e.pw = "Minimum 6 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;

    if (typeof register !== "function") {
      toast({
        title: "Auth not ready",
        description: "`register` is unavailable from auth-context.",
        status: "error",
      });
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await register(email.trim(), pw);
      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          status: "error",
        });
        return;
      }
      toast({ title: "Account created", status: "success" });
      navigate("/dashboard");
    } catch (err) {
      toast({
        title: "Unexpected error",
        description: String(err),
        status: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box p={0}>
      {/* AuthLayout renders the "Sign up" heading */}

      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={6}>
          {/* Email */}
          <FormControl isRequired isInvalid={!!errors.email}>
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
                size="lg"
              />
            </InputGroup>
            <FormErrorMessage>{errors.email}</FormErrorMessage>
          </FormControl>

          {/* Password */}
          <FormControl isRequired isInvalid={!!errors.pw}>
            <FormLabel color="gray.300">Password</FormLabel>
            <InputGroup size="lg">
              <InputLeftElement
                w="3rem"
                h="100%"
                pointerEvents="none"
                color="gray.400"
              >
                <LockIcon boxSize="5" />
              </InputLeftElement>
              <Input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Create a password"
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
                size="lg"
              />
            </InputGroup>
            <FormErrorMessage>{errors.pw}</FormErrorMessage>
          </FormControl>

          <Button
            type="submit"
            size="lg"
            w="100%"
            colorScheme="blue"
            isLoading={submitting}
            loadingText="Creating…"
            rounded="xl"
          >
            Create account
          </Button>
        </Stack>
      </form>

      {/* Footer CTA (same gradient style as Login's "Create one") */}
      <Text mt={6} color="gray.400">
        Already have an account?{" "}
        <Link
          as={RouterLink}
          to="/login"
          px="3"
          py="1.5"
          ml="1"
          rounded="md"
          fontWeight="700"
          color="white"
          bgGradient="linear(to-r, #3B82F6, #2563EB)"
          boxShadow="sm"
          textDecoration="none"
          transition="all .18s ease"
          _hover={{
            transform: "translateY(-1px)",
            boxShadow: "0 8px 20px rgba(37,99,235,.35)",
            bgGradient: "linear(to-r, #60A5FA, #3B82F6)",
          }}
          _active={{ transform: "translateY(0)", boxShadow: "sm" }}
          _focusVisible={{
            boxShadow: "0 0 0 3px rgba(59,130,246,.35)",
            outline: "none",
          }}
        >
          Sign in
        </Link>
      </Text>
    </Box>
  );
}
