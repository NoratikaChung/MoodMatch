// File: app/(tabs)/_layout.tsx (Complete Code - Attempting Explicit Centering with flex: 1)

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { themeColors } from '../../styles/theme'; // Ensure path is correct

export default function TabLayout() {
  // No router needed directly in layout for this setup

  return (
    <Tabs
      screenOptions={{
        // Default header options
        headerShown: false,
        headerStyle: { backgroundColor: themeColors.darkGrey },
        headerTintColor: themeColors.textLight,
        headerTitleStyle: { color: themeColors.textLight },

        // --- Tab Bar specific styles ---
        tabBarStyle: {
          backgroundColor: themeColors.pink,
          borderTopWidth: 0,
           shadowOffset: { width: 0, height: -1 },
           shadowOpacity: 0.1,
           shadowRadius: 3,
           elevation: 5,
           // Keep default flex direction (row) and alignment
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
        // --- ADDING tabBarItemStyle with flex: 1 ---
        // This tells each *rendered* item to try and take up equal space
        tabBarItemStyle: {
          flex: 1,
          // Add other item-specific styles here if needed, e.g., justifyContent: 'center'
        },
        // --- END ADDITION ---
        // --- End Tab Bar specific styles ---
      }}>

      {/* Screen 1: Songs */}
      <Tabs.Screen name="image" options={{ title: 'Songs', tabBarIcon: ({ color, size }) => (<Ionicons name="musical-notes-outline" size={size} color={color} />), }} />
      {/* Screen 2: Caption */}
      <Tabs.Screen name="caption" options={{ title: 'Caption', tabBarIcon: ({ color, size }) => (<Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />), }} />
      {/* Screen 3: Community */}
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: ({ color, size }) => (<Ionicons name="people-outline" size={size} color={color} />), }} />
      {/* Screen 4: Chat */}
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: ({ color, size }) => (<Ionicons name="chatbubbles-outline" size={size} color={color} />), }} />
      {/* Screen 5: Profile (Own) */}
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => (<Ionicons name="person-circle-outline" size={size} color={color} />), }} />


      {/* --- Screen 6: Hidden User Profile Screen --- */}
      <Tabs.Screen
        name="userProfile" // File: app/(tabs)/userProfile.tsx
        options={
          ({ navigation }) => ({
            href: null,
            headerShown: true,
            title: 'User Profile',
            headerStyle: { backgroundColor: themeColors.darkGrey },
            headerTintColor: themeColors.textLight,
            headerTitleStyle: { color: themeColors.textLight },
            headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 15 }} >
                <Ionicons name="chevron-back" size={28} color={themeColors.textLight} />
              </TouchableOpacity>
            ),
            // --- Keep ensuring NO button is rendered ---
            tabBarButton: () => null,
          })
        }
      />
      {/* --- End Hidden Screen --- */}

    </Tabs>
  );
}