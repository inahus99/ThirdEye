import React from 'react';
import {
  Box, Flex, HStack, Text, Avatar, Menu, MenuButton, MenuList, MenuItem, Spacer, Badge
} from '@chakra-ui/react';
import { Link, NavLink } from 'react-router-dom';
import {
  FiLogOut, FiHome, FiActivity, FiBarChart2, FiUsers, FiShield, FiFileText  ,FiSettings, FiMail, FiChevronDown, FiGlobe
} from 'react-icons/fi';
import { useAuth } from '../lib/auth-context';

const NavItem = ({ to, icon: Icon, children, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    style={({ isActive }) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      borderRadius: 12,
      textDecoration: 'none',
      color: isActive ? '#fff' : 'rgba(255,255,255,0.8)',
      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent'
    })}
  >
    <Icon /> <span>{children}</span>
  </NavLink>
);

export default function AppShell({ children }) {
  const { user, logout } = useAuth();

  return (
    <Flex minH="100vh">
      {/* Sidebar */}
      <Box as="aside" w={260} p={4} borderRight="1px solid" borderColor="whiteAlpha.200" bg="blackAlpha.400">
        <HStack as={Link} to="/" spacing={2} mb={6} _hover={{ textDecoration: 'none', opacity: 0.9 }} cursor="pointer">
          <Box fontSize="xl">🛡️</Box>
          <Text fontWeight="bold">Third Eye</Text>
        </HStack>

        <nav style={{ display: 'grid', gap: 6 }}>
          <NavItem to="/dashboard" icon={FiHome}>Dashboard</NavItem>
          <NavItem to="/analytics" icon={FiBarChart2}>Analytics</NavItem>
     <NavItem to="/site" icon={FiBarChart2}>Site Overview</NavItem>
        <NavItem to="/logs" icon={FiFileText}>Logs</NavItem> 
          <NavItem to="/clients" icon={FiUsers}>Clients</NavItem>
          <NavItem to="/assets" icon={FiShield}>SSL & Domains</NavItem>
          <NavItem to="/settings" icon={FiSettings}>Settings</NavItem>
          <NavItem to="/contact" icon={FiMail}>Contact</NavItem>
        </nav>
      </Box>

      {/* Main */}
      <Flex direction="column" flex="1" minW={0}>
        <Flex as="header" align="center" px={4} py={3} borderBottom="1px solid" borderColor="whiteAlpha.200" bg="blackAlpha.300" gap={3}>
          <Text fontWeight="semibold">Overview</Text>
          <Badge colorScheme="blue" variant="subtle">Live</Badge>
          <Spacer />
          <Menu placement="bottom-end" autoSelect={false}>
            <MenuButton as={Box} role="button" bg="whiteAlpha.100" _hover={{ bg: 'whiteAlpha.200', transform: 'translateY(-1px)' }}
              _active={{ transform: 'translateY(0)' }} transition="all 0.2s ease" px={2.5} py={1.5} rounded="full"
              border="1px solid" borderColor="whiteAlpha.300" cursor="pointer">
              <HStack spacing={2} maxW="260px">
                <Avatar size="sm" name={user?.email || 'User'} bg="purple.500" color="white" fontWeight="bold" />
                <Text fontSize="sm" color="white" noOfLines={1} maxW="170px">{user?.email}</Text>
                <Box as={FiChevronDown} opacity={0.9} />
              </HStack>
            </MenuButton>
            <MenuList bg="gray.800" borderColor="whiteAlpha.300">
              <MenuItem as={Link} to="/settings">Settings</MenuItem>
              <MenuItem icon={<FiGlobe />} as="a" href="https://rdap.org" target="_blank" rel="noreferrer">RDAP</MenuItem>
              <MenuItem icon={<FiLogOut />} onClick={logout}>Sign out</MenuItem>
            </MenuList>
          </Menu>
        </Flex>

        <Box as="main" p={6}>{children}</Box>
      </Flex>
    </Flex>
  );
}
