import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet, Text, View, ActivityIndicator, Image, Alert,
  TouchableOpacity, Platform, Dimensions, ScrollView,
  StatusBar
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { auth, storage, functions, db } from "../../firebaseConfig";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { themeColors } from "../../styles/theme";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { httpsCallable } from "firebase/functions";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// --- Interfaces ---
interface RecommendedTrack { id: string; name: string; artists: string[]; previewUrl: string | null; spotifyUrl: string; albumImageUrl: string | null; }
interface GenerateCaptionData { imageUrl: string; }
interface GenerateCaptionResult { caption: string | null; }

type PostCreationStage =
  | "initial" | "uploading" | "imageUploaded" | "selectingPreferences"
  | "selectingSong" | "selectingCaption" | "songConfirmed" | "captionConfirmed" | "bothConfirmed";

export default function CameraScreen() {
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageWidth, setSelectedImageWidth] = useState<number | null>(null);
  const [selectedImageHeight, setSelectedImageHeight] = useState<number | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [screenTitle, setScreenTitle] = useState("Create Post");
  const [playbackInstance, setPlaybackInstance] = useState<Audio.Sound | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentStage, setCurrentStage] = useState<PostCreationStage>("initial");
  const [chosenSong, setChosenSong] = useState<RecommendedTrack | null>(null);
  const [chosenCaption, setChosenCaption] = useState<string | null>(null);
  const [isProcessingSong, setIsProcessingSong] = useState(false);
  const [isProcessingCaption, setIsProcessingCaption] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [allRecommendedTracks, setAllRecommendedTracks] = useState<RecommendedTrack[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [selectedSongForPreview, setSelectedSongForPreview] = useState<RecommendedTrack | null>(null);
  const [generatedCaptionSuggestions, setGeneratedCaptionSuggestions] = useState<string[] | null>(null);
  const [currentCaptionSuggestion, setCurrentCaptionSuggestion] = useState<string | null>(null);

  const resetForNewImageSelection = () => {
    setSelectedImageUri(null); setSelectedImageWidth(null); setSelectedImageHeight(null);
    setUploadedImageUrl(null); setIsUploading(false); setUploadProgress(0);
    setStatusMessage(""); setError("");
    if (playbackInstance) { playbackInstance.unloadAsync(); setPlaybackInstance(null); }
    setCurrentlyPlayingId(null); setIsPlayingAudio(false);
    setCurrentCaptionSuggestion(null); setGeneratedCaptionSuggestions(null);
    setAllRecommendedTracks([]); setCurrentSongIndex(0); setSelectedSongForPreview(null);
    setCurrentStage("initial"); setChosenSong(null); setChosenCaption(null);
    setIsProcessingSong(false); setIsProcessingCaption(false);
    setSelectedLanguage(null); setSelectedMood(null);
    setScreenTitle("Create Post");
  };

  const pickImageFromDevice = async (useCamera: boolean = false) => {
    resetForNewImageSelection();
    try {
      let result: ImagePicker.ImagePickerResult;
      const options: ImagePicker.ImagePickerOptions = { allowsEditing: false, quality: 0.8 };
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission Required", "Camera access needed."); return; }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission Required", "Photo library access needed."); return; }
        result = await ImagePicker.launchImageLibraryAsync({...options, mediaTypes: 'Images' as ImagePicker.MediaTypeOptions });
      }
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        if (asset.width && asset.height) { setSelectedImageWidth(asset.width); setSelectedImageHeight(asset.height); }
        await handleImageUpload(asset.uri);
      }
    } catch (e: any) { console.error("pickImageFromDevice error:", e); setError(`Error selecting image: ${e.message}`); }
  };

  const handleImageUpload = async (imageUri: string) => {
    if (!imageUri) return;
    const currentUser = auth.currentUser;
    if (!currentUser) { Alert.alert("Not Authenticated", "Please log in."); return; }
    setIsUploading(true); setCurrentStage("uploading"); setError(""); setStatusMessage("Starting upload...");
    setUploadProgress(0); setUploadedImageUrl(null);
    try {
      const response = await fetch(imageUri); const blob = await response.blob();
      const filename = `${uuidv4()}.${blob.type.split('/')[1] || 'jpg'}`;
      const path = `user_uploads/${currentUser.uid}/${filename}`;
      const storageRef = ref(storage, path); const task = uploadBytesResumable(storageRef, blob);
      task.on('state_changed', (snap) => {
        const prog = (snap.bytesTransferred / snap.totalBytes) * 100;
        setUploadProgress(prog); setStatusMessage(`Uploading: ${Math.round(prog)}%`);
      }, (err) => {
        console.error("Upload Err:", err); setError(`Upload failed: ${err.message}`);
        setIsUploading(false); setStatusMessage(""); setCurrentStage("initial");
      }, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setUploadedImageUrl(url); setStatusMessage("Image uploaded! Choose an action below.");
        setIsUploading(false); setCurrentStage("imageUploaded"); setScreenTitle("Choose Recommendation");
      });
    } catch (e: any) {
      console.error("Upload Prep Err:", e); setError(`Upload error: ${e.message}`);
      setIsUploading(false); setStatusMessage(""); setCurrentStage("initial");
    }
  };

  const navigateToPreferences = () => {
    setError(""); setCurrentStage("selectingPreferences");
    setScreenTitle("Preferences (Optional)"); setStatusMessage("Choose a language and/or mood, or just proceed.");
  };

  const fetchRecommendationsFromAPI = async () => {
    if (!selectedImageUri) { setError("No image selected."); return; }
    setIsProcessingSong(true); setError(""); setAllRecommendedTracks([]); setSelectedSongForPreview(null);
    setCurrentSongIndex(0); setStatusMessage("Getting song recommendations...");
    setCurrentStage("selectingSong"); setScreenTitle("Finding Recommendations...");
    try {
      const formData = new FormData();
      const response = await fetch(selectedImageUri);
      const blob = await response.blob();
      const filename = selectedImageUri.split('/').pop() || 'image.jpg';
      const blobWithType = new Blob([blob], { type: blob.type || 'image/jpeg' });
      formData.append('file', blobWithType, filename);
      if (selectedLanguage) formData.append('language', selectedLanguage);
      if (selectedMood) formData.append('mood', selectedMood);
      const apiEndpoint = 'https://n0rat1ka-moodmatch-songrecommendationapi.hf.space/recommend';
      const apiResponse = await fetch(apiEndpoint, { method: 'POST', body: formData });
      if (!apiResponse.ok) { throw new Error(`API Error ${apiResponse.status}: ${await apiResponse.text()}`); }
      const result = await apiResponse.json();
      const formattedTracks: RecommendedTrack[] = result.tracks.map((track: any) => ({
        id: track.url, name: track.name, artists: [track.artists],
        previewUrl: null, spotifyUrl: track.url, albumImageUrl: null,
      }));
      if (formattedTracks.length > 0) {
        setAllRecommendedTracks(formattedTracks); setStatusMessage("Success! Please choose your favorite song.");
        setScreenTitle("Choose the best song!");
      } else {
        setAllRecommendedTracks([]); setStatusMessage("🤔 No songs found. Try different preferences?");
        setScreenTitle("No Results");
      }
    } catch (e: any) {
      console.error("API Fetch Err:", e); setError(`Recommendation failed: ${e.message}`);
      setStatusMessage("Error. Please try again.");
      setCurrentStage('selectingPreferences'); setScreenTitle("Preferences (Optional)");
    } finally { setIsProcessingSong(false); }
  };

  const initiateGetCaption = () => {
    if (!uploadedImageUrl) return;
    setIsProcessingCaption(true); setError(""); setCurrentCaptionSuggestion(null); setGeneratedCaptionSuggestions(null);
    setStatusMessage("Generating caption...");
    setCurrentStage("selectingCaption"); setScreenTitle("Select a Caption");
    callGenerateCaption();
  };
  const callGenerateCaption = async () => {
    try {
      const captionFn = httpsCallable<GenerateCaptionData, GenerateCaptionResult>(functions, 'generateCaption');
      const result = (await captionFn({ imageUrl: uploadedImageUrl! })).data as GenerateCaptionResult;
      if (result?.caption) {
        setCurrentCaptionSuggestion(result.caption); setGeneratedCaptionSuggestions([result.caption]);
        setStatusMessage("Caption generated. Confirm or retry.");
      } else { throw new Error("Caption generation returned null."); }
    } catch (e: any) {
      console.error("Caption Gen Err:", e); setError(`Caption failed: ${e.message}`); setStatusMessage("Error. Retry?");
    } finally { setIsProcessingCaption(false); }
  };

  const handleSelectSongForPreview = (track: RecommendedTrack) => setSelectedSongForPreview(track);
  const handleNextSongs = () => {
    setSelectedSongForPreview(null);
    setCurrentSongIndex(prevIndex => {
        const nextIndex = prevIndex + 3;
        return nextIndex >= allRecommendedTracks.length ? 0 : nextIndex;
    });
  };
  const handleConfirmSelectedSong = () => {
    if (selectedSongForPreview) {
      setChosenSong(selectedSongForPreview);
      setCurrentStage(chosenCaption ? "bothConfirmed" : "songConfirmed");
      setScreenTitle("Review & Post"); setStatusMessage("Ready to post!");
    } else { Alert.alert("No song selected", "Please tap on a song to highlight it first."); }
  };

  const handleConfirmCaption = () => {
    if (!currentCaptionSuggestion) { Alert.alert("No Caption", "No caption to confirm."); return; }
    setChosenCaption(currentCaptionSuggestion);
    setCurrentCaptionSuggestion(null); setGeneratedCaptionSuggestions(null);
    setCurrentStage(chosenSong ? "bothConfirmed" : "captionConfirmed");
    setScreenTitle("Review & Post"); setStatusMessage(`Ready to post!`);
  };

  const goBackToSongSelection = () => {
    setChosenSong(null); setCurrentStage("selectingSong");
    setScreenTitle("Choose the best song!");
  };
  const goBackToCaptionSelection = () => {
    setChosenCaption(null); initiateGetCaption();
  };

  const handlePost = async () => {
    if (!uploadedImageUrl || !auth.currentUser) return;
    setStatusMessage("Posting...");
    try {
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      let username = auth.currentUser.email?.split('@')[0] || `User${auth.currentUser.uid.substring(0,5)}`;
      let userProfileImageUrl: string | null = null;
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        username = userData.username || username; userProfileImageUrl = userData.photoURL || null;
      }
      const postData = {
        userId: auth.currentUser.uid, username, userProfileImageUrl,
        imageUrl: uploadedImageUrl, caption: chosenCaption || null,
        song: chosenSong ? { id: chosenSong.id, name: chosenSong.name, artists: chosenSong.artists, albumImageUrl: chosenSong.albumImageUrl, previewUrl: chosenSong.previewUrl, spotifyUrl: chosenSong.spotifyUrl } : null,
        createdAt: serverTimestamp(), likesCount: 0, likedBy: [], commentsCount: 0,
      };
      await addDoc(collection(db, "posts"), postData);
      Alert.alert("Post Created!", "Your content is live in the community feed.");
      resetForNewImageSelection();
    } catch (e: any) {
      console.error("Error posting content:", e); setError(`Failed to post: ${e.message}`);
      setStatusMessage("");
    }
  };

  const windowWidth = Dimensions.get('window').width; const windowHeight = Dimensions.get('window').height;
  const maxDisplayWidth = windowWidth * 0.9;
  let displayWidth: number | null = null; let displayHeight: number | null = null;
  if (selectedImageWidth && selectedImageHeight) {
    const aspectRatio = selectedImageWidth / selectedImageHeight;
    displayWidth = maxDisplayWidth;
    displayHeight = displayWidth / aspectRatio;
    if (displayHeight > (windowHeight * 0.35)) {
      displayHeight = windowHeight * 0.35; displayWidth = displayHeight * aspectRatio;
    }
  }

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContentContainer}>
          <Text style={styles.title}>{screenTitle}</Text>

          {currentStage === "initial" && !isUploading && (
            <><View style={styles.buttonRow}><TouchableOpacity style={[styles.button, styles.pickButton]} onPress={() => pickImageFromDevice(false)}><Text style={styles.buttonText}>Gallery</Text></TouchableOpacity><TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={() => pickImageFromDevice(true)}><Text style={styles.buttonText}>Camera</Text></TouchableOpacity></View><View style={[styles.imageContainer, styles.imagePlaceholder, { width: maxDisplayWidth, height: 200 }]}><Text style={styles.placeholderText}>Select or take an image</Text></View></>
          )}
          {selectedImageUri && displayWidth && displayHeight && (
            <View style={[styles.imageContainer, { width: displayWidth, height: displayHeight }]}><Image source={{ uri: selectedImageUri }} style={styles.selectedImage} resizeMode="contain"/>{isUploading && <View style={styles.imageLoadingOverlay}><ActivityIndicator size="large" color={themeColors.textLight} /><Text style={styles.progressTextOverlay}>{statusMessage}</Text></View>}</View>
          )}

          {error && <Text style={[styles.statusMessageText, styles.errorTextDisplay]}>{error}</Text>}
          {statusMessage && !error && !isUploading && !isProcessingSong && !isProcessingCaption && <Text style={styles.statusMessageText}>{statusMessage}</Text>}

          {(currentStage === 'songConfirmed' || currentStage === 'captionConfirmed' || currentStage === 'bothConfirmed') && (
            <View style={styles.chosenItemsContainer}>
              {chosenSong && <View style={styles.chosenItem}><Ionicons name="musical-notes" size={20} color={themeColors.pink} style={{marginRight: 8}}/><Text style={styles.chosenItemText} numberOfLines={1}>Song: {chosenSong.name}</Text></View>}
              {chosenCaption && <View style={styles.chosenItem}><Ionicons name="chatbubbles" size={20} color={themeColors.blue} style={{marginRight: 8}}/><Text style={styles.chosenItemText} numberOfLines={2}>Caption: {chosenCaption}</Text></View>}
            </View>
          )}

          {currentStage === "imageUploaded" && (
            <View style={styles.actionChoiceContainer}><TouchableOpacity style={[styles.button, styles.songButton]} onPress={navigateToPreferences}><Ionicons name="musical-notes-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}} /><Text style={styles.buttonText}>Get Songs</Text></TouchableOpacity><TouchableOpacity style={[styles.button, styles.captionButton]} onPress={initiateGetCaption}><Ionicons name="chatbubble-ellipses-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}} /><Text style={styles.buttonText}>Get Caption</Text></TouchableOpacity></View>
          )}

          {currentStage === "selectingPreferences" && (
            <View style={styles.resultsSection}>
              <View style={styles.preferenceGrid}>{['english','malay','chinese','tamil','korean','happy','sad','chill','romantic','energetic'].map(item => {
                  const isLanguage = ['english','malay','chinese','tamil','korean'].includes(item);
                  const isSelected = isLanguage ? selectedLanguage === item : selectedMood === item;
                  return (<TouchableOpacity key={item} style={[styles.preferenceButton, isSelected && styles.preferenceButtonSelected]} onPress={() => isLanguage ? setSelectedLanguage(p => p === item ? null : item) : setSelectedMood(p => p === item ? null : item)}><Text style={styles.preferenceButtonText}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text></TouchableOpacity>);
                })}
              </View><TouchableOpacity style={[styles.button, styles.proceedButton]} onPress={fetchRecommendationsFromAPI} disabled={isProcessingSong}><Text style={styles.buttonText}>Proceed</Text></TouchableOpacity>
            </View>
          )}

          {currentStage === "selectingSong" && (
            <View style={styles.resultsSection}>
              {isProcessingSong && <View style={styles.loadingFullWidth}><ActivityIndicator size="large" color={themeColors.pink} /><Text style={styles.progressText}>{statusMessage}</Text></View>}
              {!isProcessingSong && allRecommendedTracks.length > 0 && (
                <><View style={styles.recommendationsScrollContainer}>
                    {allRecommendedTracks.slice(currentSongIndex, currentSongIndex + 3).map((track) => (
                      <TouchableOpacity key={track.id} style={[styles.songCard, selectedSongForPreview?.id === track.id && styles.songCardSelected]} onPress={() => handleSelectSongForPreview(track)}>
                        <View style={styles.songCardIcon}><Ionicons name="musical-notes" size={24} color={themeColors.textLight} /></View>
                        <View style={styles.trackInfo}><Text style={styles.trackName} numberOfLines={1}>{track.name}</Text><Text style={styles.trackArtist} numberOfLines={1}>{track.artists.join(", ")}</Text></View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.songSelectionActions}>
                    <TouchableOpacity onPress={handleNextSongs} style={styles.actionIcon}><Ionicons name="refresh" size={32} color={themeColors.textLight} /></TouchableOpacity>
                    <TouchableOpacity onPress={handleConfirmSelectedSong} style={styles.actionIcon} disabled={!selectedSongForPreview}><Ionicons name="checkmark-circle" size={48} color={selectedSongForPreview ? themeColors.textLight : themeColors.grey} /></TouchableOpacity>
                  </View>
                </>
              )}
              {!isProcessingSong && allRecommendedTracks.length === 0 && <TouchableOpacity style={[styles.buttonSmall, styles.retryButton]} onPress={navigateToPreferences}><Ionicons name="arrow-back" size={18} color={themeColors.textLight} /><Text style={styles.buttonSmallText}>Try Again</Text></TouchableOpacity>}
            </View>
          )}

          {currentStage === "selectingCaption" && (
            <View style={styles.resultsSection}>{isProcessingCaption && <View style={styles.loadingFullWidth}><ActivityIndicator size="large" color={themeColors.blue} /><Text style={styles.progressText}>{statusMessage}</Text></View>}
              {!isProcessingCaption && currentCaptionSuggestion && (
                <><View style={styles.captionTextDisplay}><Text style={styles.captionText}>{currentCaptionSuggestion}</Text></View>
                <View style={styles.captionActions}>
                  <TouchableOpacity style={[styles.buttonSmall, styles.retryButton]} onPress={initiateGetCaption}><Ionicons name="refresh" size={18} color={themeColors.textLight} /><Text style={styles.buttonSmallText}>Retry</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.buttonSmall, styles.confirmButton]} onPress={handleConfirmCaption}><Ionicons name="checkmark" size={18} color={themeColors.textLight} /><Text style={styles.buttonSmallText}>Confirm</Text></TouchableOpacity>
                </View></>
              )}
            </View>
          )}

          {(currentStage === 'songConfirmed' || currentStage === 'captionConfirmed' || currentStage === 'bothConfirmed') && (
            <View style={styles.finalActionsContainer}>
              {chosenSong ? <TouchableOpacity style={[styles.button, styles.backButton]} onPress={goBackToSongSelection}><Ionicons name="arrow-back" size={18} color={themeColors.textLight} style={{marginRight: 6}} /><Text style={styles.buttonText}>Change Song</Text></TouchableOpacity>
              : <TouchableOpacity style={[styles.button, styles.addSongButton]} onPress={navigateToPreferences}><Ionicons name="musical-notes-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}} /><Text style={styles.buttonText}>Add Song</Text></TouchableOpacity>}
              {chosenCaption ? <TouchableOpacity style={[styles.button, styles.backButton]} onPress={goBackToCaptionSelection}><Ionicons name="arrow-back" size={18} color={themeColors.textLight} style={{marginRight: 6}} /><Text style={styles.buttonText}>Change Caption</Text></TouchableOpacity>
              : <TouchableOpacity style={[styles.button, styles.addCaptionButton]} onPress={initiateGetCaption}><Ionicons name="chatbubble-ellipses-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}} /><Text style={styles.buttonText}>Add Caption</Text></TouchableOpacity>}
              <TouchableOpacity style={[styles.button, styles.postButton]} onPress={handlePost}><Ionicons name="send-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}}/><Text style={styles.buttonText}>Post</Text></TouchableOpacity>
            </View>
          )}
        </ScrollView>
        {/* <<< DISCARD BUTTON MOVED TO THE BOTTOM LEFT >>> */}
        {currentStage !== "initial" && !isUploading && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.discardButton} onPress={resetForNewImageSelection}>
              <Ionicons name="trash-outline" size={16} color={themeColors.textLight} />
              <Text style={styles.discardButtonText}>Discard</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
    gradientWrapper: { flex: 1 },
    scrollContentContainer: { alignItems: 'center', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) + 10 : 50, paddingBottom: 150 },
    title: { fontSize: 24, fontWeight: '600', marginBottom: 20, color: themeColors.textLight, textAlign: 'center' },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-around', width: '90%', marginBottom: 20 },
    button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, minHeight: 50, alignItems: 'center', justifyContent: 'center', flex: 1, marginHorizontal: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, flexDirection: 'row' },
    pickButton: { backgroundColor: themeColors.pink },
    cameraButton: { backgroundColor: themeColors.blue },
    buttonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
    imageContainer: { marginVertical: 15, borderRadius: 15, overflow: 'hidden', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: themeColors.pink, position: 'relative', backgroundColor: "rgba(0,0,0,0.1)" },
    imagePlaceholder: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: themeColors.grey },
    placeholderText: { color: themeColors.textSecondary, fontSize: 16 },
    selectedImage: { width: '100%', height: '100%' },
    imageLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', borderRadius: 13 },
    progressTextOverlay: { marginTop: 10, fontSize: 14, color: themeColors.textLight, fontWeight: '500' },
    progressText: { marginTop: 10, fontSize: 14, color: themeColors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
    statusMessageText: { fontSize: 15, color: themeColors.textSecondary, marginVertical: 10, textAlign: 'center', paddingHorizontal: 20 },
    errorTextDisplay: { color: themeColors.errorRed, fontWeight: '500' },
    actionChoiceContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '90%', marginTop: 15, marginBottom: 15 },
    songButton: { backgroundColor: themeColors.pink, maxWidth: '48%' },
    captionButton: { backgroundColor: themeColors.blue, maxWidth: '48%' },
    resultsSection: { width: '90%', marginVertical: 15, alignItems: 'center' },
    recommendationsScrollContainer: { minHeight: 225, width: "100%" },
    trackInfo: { flex: 1, marginRight: 10 },
    trackName: { fontSize: 16, fontWeight: "600", color: themeColors.textLight, marginBottom: 2 },
    trackArtist: { fontSize: 13, color: themeColors.textSecondary },
    buttonSmall: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, elevation: 3, marginHorizontal: 5 },
    buttonSmallText: { color: themeColors.textLight, fontSize: 14, fontWeight: 'bold', marginLeft: 6 },
    retryButton: { backgroundColor: themeColors.grey, marginBottom: 10 },
    chosenItemsContainer: { width: '90%', marginVertical: 15, padding: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, borderWidth: 1, borderColor: themeColors.grey },
    chosenItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    chosenItemText: { color: themeColors.textLight, fontSize: 15, flexShrink: 1 },
    postButton: { backgroundColor: themeColors.successGreen, flex: 0, paddingHorizontal: 40 },
    loadingFullWidth: { width: '100%', alignItems: 'center', marginVertical: 20 },
    preferenceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginVertical: 10 },
    preferenceButton: { backgroundColor: themeColors.grey, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, margin: 5, borderWidth: 2, borderColor: 'transparent' },
    preferenceButtonSelected: { borderColor: themeColors.pink, backgroundColor: 'rgba(236, 72, 153, 0.3)' },
    preferenceButtonText: { color: themeColors.textLight, fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
    proceedButton: { backgroundColor: themeColors.successGreen, marginTop: 20, flex: 0, width: '80%', alignSelf: 'center' },
    songCard: { backgroundColor: 'rgba(50, 50, 50, 0.8)', borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', marginVertical: 6, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    songCardSelected: { borderColor: themeColors.pink, borderWidth: 2 },
    songCardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: themeColors.pink, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    songSelectionActions: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', width: '100%', marginTop: 20 },
    actionIcon: { padding: 10 },
    captionTextDisplay: { backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 15, borderRadius: 8, minHeight: 100, width: '100%', justifyContent: 'center' },
    captionText: { color: themeColors.textLight, fontSize: 16, fontStyle: 'italic' },
    captionActions: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20 },
    confirmButton: { backgroundColor: themeColors.successGreen },
    finalActionsContainer: { width: '90%', alignItems: 'center', gap: 10, marginVertical: 15 },
    addCaptionButton: { backgroundColor: themeColors.blue, flex: 0, paddingHorizontal: 30 },
    addSongButton: { backgroundColor: themeColors.pink, flex: 0, paddingHorizontal: 30 },
    // <<< THE FIX: Using a base button style for consistent padding >>>
    backButton: { backgroundColor: themeColors.grey, flex: 0 },
    footer: { position: 'absolute', bottom: 20, left: 20 },
    discardButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.errorRed, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, elevation: 5 },
    discardButtonText: { color: themeColors.textLight, fontSize: 14, fontWeight: 'bold', marginLeft: 6 },
});