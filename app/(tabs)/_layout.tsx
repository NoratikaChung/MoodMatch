// File: app/(tabs)/_layout.tsx 

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../styles/theme'; // Import theme colors

export default function TabLayout() {
  return (
    <Tabs
      // No sceneContainerStyle here

      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: themeColors.pink,
          borderTopWidth: 0,
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 5,
        },
        tabBarActiveTintColor: themeColors.textLight,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
        tabBarLabelStyle: {
            fontSize: 11,
            paddingBottom: 3,
        },
        tabBarIconStyle: {
            marginTop: 3,
        },
        // No sceneContainerStyle here either
      }}>
      <Tabs.Screen
        name="image"
        options={{
          title: 'Image',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="image-outline" size={size} color={color} />
          ),
        }}
      />
       <Tabs.Screen
        name="profile"
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