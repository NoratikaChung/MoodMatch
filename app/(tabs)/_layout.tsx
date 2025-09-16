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
        stylesInternalTabs.customTabButtonContainer,
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

      <Tabs.Screen
        name="camera"
        options={{
          title: '',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "camera" : "camera-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="community"
        options={{
          title: '',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "people" : "people-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: '',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: '',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />

    </Tabs>
  );
}