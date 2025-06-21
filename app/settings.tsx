import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, SafeAreaView } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useRouter, Link, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';

export default function SettingsScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const params = useLocalSearchParams();
  const { currentUsername, currentDisplayName, currentPhotoURL, email } = params;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/(tabs)/profile');
    } catch (error: any) {
      console.error('Sign out error:', error);
      Alert.alert('Logout Error', error.message || 'Failed to sign out.');
    }
  };

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <SafeAreaView style={styles.safeArea}>
        <AppHeader>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
                <Ionicons name="arrow-back" size={24} color={themeColors.textLight} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={styles.headerIcon} />
          </View>
        </AppHeader>

        <View style={styles.container}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Display Name:</Text><Text style={styles.infoValue}>{currentDisplayName || 'Not set'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Username:</Text><Text style={styles.infoValue}>@{currentUsername || 'Not set'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Email:</Text><Text style={styles.infoValue}>{email || 'N/A'}</Text></View>
          </View>

          <Text style={styles.sectionTitle}>Actions</Text>

          <Link href={{ pathname: "/profile-edit", params: { mode: 'edit', currentUsername, currentDisplayName, currentPhotoURL }}} asChild>
            {/* <<< THE FIX: Styles are merged into a single object instead of an array >>> */}
            <TouchableOpacity style={{...styles.actionButton, ...styles.editButton}}>
                <Ionicons name="pencil-outline" size={20} color={themeColors.textLight} />
                <Text style={styles.actionButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </Link>

          {/* <<< THE FIX: Styles are merged into a single object instead of an array >>> */}
          <TouchableOpacity style={{...styles.actionButton, ...styles.logoutButton}} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={themeColors.textLight} />
            <Text style={styles.actionButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1 },
  safeArea: { flex: 1 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  headerTitle: { color: themeColors.textLight, fontSize: 22, fontWeight: 'bold' },
  headerIcon: { padding: 5, width: 40 },
  container: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: themeColors.textSecondary, marginTop: 20, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: themeColors.grey, paddingBottom: 5 },
  infoBox: { backgroundColor: themeColors.darkGrey, borderRadius: 10, padding: 15 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  infoLabel: { color: themeColors.textSecondary, fontSize: 16 },
  infoValue: { color: themeColors.textLight, fontSize: 16, fontWeight: '500' },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 25, marginTop: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  actionButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  editButton: { backgroundColor: themeColors.blue },
  logoutButton: { backgroundColor: themeColors.pink },
});