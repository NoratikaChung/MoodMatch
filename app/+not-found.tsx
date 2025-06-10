// app/+not-found.tsx
import { Link, Stack } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NotFoundScreen() {
  console.log("--- RENDERING NotFoundScreen ---");
  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/(tabs)/camera" style={styles.link}>
          <Text style={styles.linkText}>Go to Home Screen!</Text>
        </Link>
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  link: { marginTop: 15, paddingVertical: 15, },
  linkText: { fontSize: 14, color: '#2e78b7' },
});