import {
    StyleSheet, Text, View, ActivityIndicator, Image,
    Alert, TouchableOpacity, Platform, Dimensions, ScrollView
} from 'react-native';
import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

// --- Gradient ---
import { LinearGradient } from 'expo-linear-gradient'; // <<< ADDED Import

// --- Firebase Imports ---
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, storage, functions } from '../../firebaseConfig';
import { httpsCallable } from "firebase/functions";

// --- Other Imports ---
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { themeColors } from '../../styles/theme';

// --- Interfaces ---
interface AnalysisResult { /* ...interface content remains the same... */
   labels: { description: string; score: number }[];
   safety: {
     adult: string; spoof: string; medical: string;
     violence: string; racy: string;
   };
}
interface AnalyzeImageData { /* ...interface content remains the same... */
  imageUrl: string;
}
interface SpotifyRequestData { /* ...interface content remains the same... */
  labels: { description: string; score: number }[];
}
interface RecommendedTrack { /* ...interface content remains the same... */
    id: string; name: string; artists: string[];
    previewUrl: string | null; spotifyUrl: string; albumImageUrl: string | null;
}
interface SpotifyRecommendationsResult { /* ...interface content remains the same... */
  tracks: RecommendedTrack[];
}

// --- Component ---
export default function TabImageScreen() {
    // --- State Variables ---
    const [functionResponse, setFunctionResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [selectedImageWidth, setSelectedImageWidth] = useState<number | null>(null);
    const [selectedImageHeight, setSelectedImageHeight] = useState<number | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [recommendedTracks, setRecommendedTracks] = useState<RecommendedTrack[] | null>(null);

    // --- Helper Functions (resetState, pickImage, takePicture) ---
    // ... function implementations remain the same ...
    const resetState = () => {
        setSelectedImageUri(null); setSelectedImageWidth(null); setSelectedImageHeight(null);
        setFunctionResponse(''); setError(''); setUploadProgress(0);
        setAnalysisResult(null); setRecommendedTracks(null); setIsLoading(false);
    };
    const pickImage = async () => {
        console.log("--- pickImage ---"); resetState();
        try { /* ... */ } catch (e:any) { /* ... */ }
    };
    const takePicture = async () => {
        console.log("--- takePicture ---"); resetState();
        try { /* ... */ } catch (e:any) { /* ... */ }
    };

    // --- Cloud Function Callers (callGetRecommendations, callAnalyzeFunction) ---
    // ... function implementations remain the same ...
     const callGetRecommendations = async (analysisData: AnalysisResult | null) => {
        if (!analysisData?.labels || analysisData.labels.length === 0) { /* ... */ }
        console.log("Attempting call 'getSpotifyRecommendations'...", /* ... */);
        setError(''); setRecommendedTracks(null);
        setFunctionResponse("🎧 Finding matching songs...");
        try { /* ... */ } catch (error: any) { /* ... */ } finally { setIsLoading(false); }
    };
    const callAnalyzeFunction = async (imageUrl: string) => {
        if (!imageUrl) { /* ... */ }
        console.log("Attempting call 'analyzeImage'...", /* ... */);
        setIsLoading(true); setError(''); setAnalysisResult(null); setRecommendedTracks(null);
        setFunctionResponse("👁️ Analyzing image...");
        try { /* ... */ } catch (error: any) { /* ... */ }
    };

    // --- Upload Image & Trigger Full Flow (handleUploadAndAnalyze) ---
    // ... function implementation remains the same ...
    const handleUploadAndAnalyze = async () => {
        if (!selectedImageUri) { /* ... */ }
        const currentUser = auth.currentUser; if (!currentUser) { /* ... */ }
        console.log("--- handleUploadAndAnalyze ---");
        setIsLoading(true); setError(''); setAnalysisResult(null); setRecommendedTracks(null);
        setFunctionResponse('Starting upload...'); setUploadProgress(0);
        try { /* ... */ } catch (e:any) { /* ... */ }
    };


    // --- Calculate display dimensions ---
    // ... calculation logic remains the same ...
    const windowWidth = Dimensions.get('window').width;
    const windowHeight = Dimensions.get('window').height;
    const maxDisplayWidth = windowWidth * 0.90;
    const maxDisplayHeight = windowHeight * 0.45;
    let displayWidth: number | null = null;
    let displayHeight: number | null = null;
    if (selectedImageWidth && selectedImageHeight && selectedImageWidth > 0 && selectedImageHeight > 0) {
        const scaleX = maxDisplayWidth / selectedImageWidth; const scaleY = maxDisplayHeight / selectedImageHeight;
        const finalScale = Math.min(scaleX, scaleY);
        displayWidth = selectedImageWidth * finalScale; displayHeight = selectedImageHeight * finalScale;
    }

    // --- Render UI ---
    return (
        // <<< WRAP with LinearGradient >>>
        <LinearGradient
            colors={themeColors.backgroundGradient}
            style={styles.gradientWrapper}
        >
            <ScrollView // Main ScrollView
                style={styles.scrollView} // Removed background color from here
                contentContainerStyle={styles.scrollContentContainer}
                keyboardShouldPersistTaps="handled"
            >
                {/* --- Original Content START --- */}
                <Text style={styles.title}>Image Analysis & Song Mood</Text>

                {/* Action Buttons */}
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={[styles.button, styles.pickButton, isLoading ? styles.buttonDisabled : {}]} onPress={pickImage} disabled={isLoading} >
                        <Text style={styles.buttonText}>Library</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.cameraButton, isLoading ? styles.buttonDisabled : {}]} onPress={takePicture} disabled={isLoading} >
                        <Text style={styles.buttonText}>Camera</Text>
                    </TouchableOpacity>
                </View>

                {/* Image Display */}
                {selectedImageUri && displayWidth && displayHeight ? (
                    <View style={[styles.imageContainer, { width: displayWidth, height: displayHeight }]}>
                        <Image source={{ uri: selectedImageUri }} style={styles.selectedImage} resizeMode="contain"/>
                    </View>
                ) : ( /* Placeholder area */
                     <View style={[styles.imageContainer, styles.imagePlaceholder, { width: maxDisplayWidth, height: 200 }]}>
                         <Text style={styles.placeholderText}>Select or take an image</Text>
                     </View>
                 )}

                {/* Recommendations Button */}
                {selectedImageUri && !isLoading && (
                    <TouchableOpacity style={[styles.button, styles.analyzeButton]} onPress={handleUploadAndAnalyze}>
                        <Text style={styles.buttonText}>Get Recommendations</Text>
                    </TouchableOpacity>
                 )}

                {/* Loading / Status / Results Area */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={themeColors.pink} />
                        <Text style={styles.progressText}>{functionResponse}</Text>
                    </View>
                )}

                {/* Spotify Recommendations Display */}
                {!isLoading && recommendedTracks && recommendedTracks.length > 0 && (
                     <View style={[styles.responseContainer, styles.recommendationsBox]}>
                        <Text style={styles.responseText}>Recommended Songs:</Text>
                         <ScrollView style={styles.recommendationsScrollContainer} nestedScrollEnabled={true}>
                             {recommendedTracks.map((track) => (
                                <View key={track.id} style={styles.trackItem}>
                                    {track.albumImageUrl ? (
                                        <Image source={{uri: track.albumImageUrl}} style={styles.albumArt} />
                                    ) : ( <View style={[styles.albumArt, styles.albumArtPlaceholder]} /> )}
                                    <View style={styles.trackInfo}>
                                        <Text style={styles.trackName} numberOfLines={1}>{track.name}</Text>
                                        <Text style={styles.trackArtist} numberOfLines={1}>{track.artists.join(', ')}</Text>
                                    </View>
                                </View>
                             ))}
                         </ScrollView>
                     </View>
                 )}
                {/* No songs found message */}
                 {!isLoading && recommendedTracks && recommendedTracks.length === 0 && (
                     <View style={[styles.responseContainer, styles.infoBox]}>
                         <Text style={styles.responseText}>No specific song recommendations found.</Text>
                     </View>
                 )}
                 {/* Error message */}
                 {!isLoading && error && (
                    <View style={[styles.responseContainer, styles.errorBox]}>
                        <Text style={styles.errorTitle}>Error:</Text>
                        <Text style={styles.errorText} selectable={true}>{error}</Text>
                    </View>
                 )}
                 {/* Bottom padding inside ScrollView */}
                 <View style={{ height: 30 }} />
                 {/* --- Original Content END --- */}
            </ScrollView>
        </LinearGradient>
        // <<< END WRAP >>>
    );
}

// --- Styles ---
const windowHeight = Dimensions.get('window').height;
const styles = StyleSheet.create({
    // <<< ADDED gradient wrapper style >>>
    gradientWrapper: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
        // backgroundColor: 'transparent', // <<< REMOVED this line
    },
    scrollContentContainer: { alignItems: 'center', paddingBottom: 30, paddingTop: 30 },
    title: { fontSize: 24, fontWeight: '600', marginBottom: 25, color: themeColors.textLight, textAlign: 'center', paddingHorizontal: 20 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-around', width: '90%', marginBottom: 20, alignSelf: 'center' },
    button: {
        paddingVertical: 12, paddingHorizontal: 15, borderRadius: 25, minHeight: 48, alignItems: 'center', justifyContent: 'center', flex: 1, marginHorizontal: 8,
        // Shadow for iOS
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
        // Elevation for Android
        elevation: 5,
        // Box shadow for Web <<< ADDED
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    },
    pickButton: { backgroundColor: themeColors.pink },
    cameraButton: { backgroundColor: themeColors.blue },
    analyzeButton: {
         backgroundColor: themeColors.pink, width: '80%', marginTop: 25, marginBottom: 15, alignSelf: 'center', flex: 0,
         // Also add shadows here
         shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
         elevation: 5,
         boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)', // <<< ADDED
    },
    buttonDisabled: { opacity: 0.5, },
    buttonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', textAlign: 'center', },
    imageContainer: { marginVertical: 20, borderRadius: 15, overflow: 'hidden', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: themeColors.pink, },
    imagePlaceholder: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: themeColors.grey },
    placeholderText: { color: themeColors.textSecondary },
    selectedImage: { width: '100%', height: '100%', },
    loadingContainer: { alignItems: 'center', paddingVertical: 40, },
    progressText: { marginTop: 15, fontSize: 14, color: themeColors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
    responseContainer: { padding: 15, borderRadius: 10, width: '90%', borderWidth: 0, alignSelf: 'center', marginVertical: 10, backgroundColor: themeColors.darkGrey },
    errorBox: { backgroundColor: '#5c2020', borderColor: themeColors.errorRed, borderWidth: 1 },
    infoBox: { backgroundColor: themeColors.darkGrey, },
    recommendationsBox: { backgroundColor: themeColors.darkGrey, },
    responseText: { fontWeight: 'bold', marginBottom: 10, color: themeColors.textLight, fontSize: 16, },
    errorTitle: { fontWeight: 'bold', marginBottom: 5, color: themeColors.errorRed, fontSize: 15, },
    errorText: { color: '#ffb0b0', fontSize: 14, },
    recommendationsScrollContainer: { maxHeight: windowHeight * 0.4, width: '100%', },
    trackItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)', },
    albumArt: { width: 45, height: 45, borderRadius: 4, marginRight: 12, },
    albumArtPlaceholder: { backgroundColor: themeColors.grey, opacity: 0.5 },
    trackInfo: { flex: 1, },
    trackName: { fontSize: 15, fontWeight: '600', color: themeColors.textLight, marginBottom: 3, },
    trackArtist: { fontSize: 13, color: themeColors.textSecondary, },
});