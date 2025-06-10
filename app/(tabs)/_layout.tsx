// File: app/(tabs)/_layout.tsx (Tabs Reordered: Camera, Community, Chat, Profile)

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Pressable, View, StyleSheet } from 'react-native';
import { themeColors } from '../../styles/theme';

const CustomFlexTabButton = (props: any) => {
  const { accessibilityState, children, onPress, onLongPress, style } = props;
  const focused = accessibilityState?.selected;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        stylesInternalTabs.customTabButtonContainer, // Use renamed style object
        { opacity: pressed ? 0.7 : 1 },
        style
      ]}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
    >
      {children}
    </Pressable>
  );
};

// Renamed to avoid conflict if this file itself is imported elsewhere or for clarity
const stylesInternalTabs = StyleSheet.create({
  customTabButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function TabLayout() {
  console.log("--- TabLayout in (tabs) RENDERING with Reordered Tabs ---");
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: themeColors.darkGrey },
        headerTintColor: themeColors.textLight,
        headerTitleStyle: { color: themeColors.textLight },
        tabBarStyle: {
          backgroundColor: themeColors.pink,
          borderTopWidth: 0,
           shadowOffset: { width: 0, height: -1 },
           shadowOpacity: 0.1,
           shadowRadius: 3,
           elevation: 5,
           flexDirection: 'row',
        },
        tabBarActiveTintColor: themeColors.textLight,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
        tabBarLabelStyle: { fontSize: 11, paddingBottom: 3 },
        tabBarIconStyle: { marginTop: 3 },
      }}>

      {/* === REORDERED Visible Tab Screens === */}
      {/* 1. Camera Tab */}
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "camera" : "camera-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />
      {/* 2. Community Tab */}
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "people" : "people-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />
      {/* 3. Chat Tab */}
      <Tabs.Screen
        name="chat" // Corresponds to app/(tabs)/chat.tsx (your ChatListScreen)
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />
      {/* 4. Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />
      {/* === END Reordered Visible Tab Screens === */}


      {/* --- Hidden Screen for User Profile View (Keep this definition) --- */}
      <Tabs.Screen
        name="userProfile" // Assumes app/(tabs)/userProfile.tsx still exists
        options={
          ({ navigation }) => ({
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
            tabBarButton: () => null,
          })
        }
      />
      {/* === END Hidden User Profile Screen === */}

    </Tabs>
  );
}