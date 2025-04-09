// File: app/(tabs)/_layout.tsx (Added Caption Tab)

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Ensure Ionicons is imported
import { themeColors } from '../../styles/theme'; // Import theme colors

export default function TabLayout() {
  return (
    <Tabs
      // sceneContainerStyle={{ backgroundColor: 'transparent' }}
      // ^ We confirmed this prop doesn't exist directly on Expo Router's Tabs
      // Background is handled by LinearGradient in individual screens now.

      screenOptions={{
        headerShown: false, // Keep headers hidden
        tabBarStyle: {
          backgroundColor: themeColors.pink, // Pink background for tab bar
          borderTopWidth: 0, // Remove top border
          // Shadow/elevation for visual separation
           shadowOffset: { width: 0, height: -1 },
           shadowOpacity: 0.1,
           shadowRadius: 3,
           elevation: 5,
        },
        tabBarActiveTintColor: themeColors.textLight, // White for active icon/label
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)', // Semi-transparent white
        tabBarLabelStyle: {
            fontSize: 11,
            paddingBottom: 3, // Adjust spacing
        },
        tabBarIconStyle: {
            marginTop: 3, // Adjust spacing
        },
      }}>

      {/* Screen 1: Image Analysis & Song Recs */}
      <Tabs.Screen
        name="image" // Corresponds to app/(tabs)/image.tsx
        options={{
          title: 'Songs', // Changed title
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="musical-notes-outline" size={size} color={color} /> // Changed icon
          ),
        }}
      />

      {/* Screen 2: AI Caption Generation (NEW) */}
      <Tabs.Screen
        name="caption" // Corresponds to app/(tabs)/caption.tsx
        options={{
          title: 'Caption',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Screen 3: User Profile */}
       <Tabs.Screen
        name="profile" // Corresponds to app/(tabs)/profile.tsx
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}