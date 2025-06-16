import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { themeColors } from '../../styles/theme';

interface ScreenHeaderProps {
  title: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const ScreenHeader = ({ title, leftIcon, rightIcon }: ScreenHeaderProps) => {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.iconContainer}>{leftIcon}</View>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.iconContainer}>{rightIcon}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    backgroundColor: themeColors.pink,
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 10,
    paddingBottom: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 5,
  },
  headerTitle: {
    color: themeColors.textLight,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  iconContainer: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ScreenHeader;