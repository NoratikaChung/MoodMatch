import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { themeColors } from '../styles/theme';

interface AppHeaderProps {
  children?: React.ReactNode;
}

const AppHeader: React.FC<AppHeaderProps> = ({ children }) => {
  return (
    <View style={styles.headerContainer}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: themeColors.pink,
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight : 0) + 10,
    paddingBottom: 15,
    paddingHorizontal: 15,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
});

export default AppHeader;