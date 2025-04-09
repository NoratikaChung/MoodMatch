/* eslint-disable max-len */ // Keep disabling max-len

// File: functions/src/index.ts (Includes ALL functions + generateCaption - Final Lint Attempt)

// Import v2 specific https functions
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger"; // Import the v2 logger

// Import Firebase Admin SDK modules
import {initializeApp, getApps} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore"; // Use Admin SDK v10+ style

// Keep Vision API imports
import * as vision from "@google-cloud/vision";
import {protos} from "@google-cloud/vision";
type Likelihood = protos.google.cloud.vision.v1.Likelihood;

// Import axios and specifically isAxiosError for type checking
import axios, {isAxiosError} from "axios";

// Import Secret Manager client
import {SecretManagerServiceClient} from "@google-cloud/secret-manager";

// --- <<< NEW: Import Google AI SDK >>> ---
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// --- Initialize Firebase Admin SDK ---
if (getApps().length === 0) {
  initializeApp();
}
const dbAdmin = getFirestore();

// --- Client Initializations ---
const visionClient = new vision.ImageAnnotatorClient();
const secretManagerClient = new SecretManagerServiceClient();
// --- Google AI Client (will be initialized with key later) ---
let genAI: GoogleGenerativeAI | null = null;
const genAIError: string | null = null;

// --- Interfaces ---
interface AnalyzeImageData {
  imageUrl: string;
}
interface AnalysisResult {
  labels: Array<{description: string; score: number}>;
  safety: {
    adult: Likelihood | "UNKNOWN";
    spoof: Likelihood | "UNKNOWN";
    medical: Likelihood | "UNKNOWN";
    violence: Likelihood | "UNKNOWN";
    racy: Likelihood | "UNKNOWN";
  };
}
interface SpotifyRequestData {
  labels: Array<{description: string; score: number}>;
}
interface RecommendedTrack {
  id: string;
  name: string;
  artists: string[];
  previewUrl: string | null;
  spotifyUrl: string;
  albumImageUrl: string | null;
}
interface SpotifyRecommendationsResult {
  tracks: RecommendedTrack[];
}
interface SpotifyTrackObject {
  id: string;
  name: string;
  artists: Array<{name: string}>;
  preview_url: string | null;
  external_urls: {spotify?: string};
  album?: {images?: Array<{url: string}>};
}
interface SpotifyArtistObject {
  name: string;
}
// --- NEW Interface for Caption Generation ---
interface GenerateCaptionData {
  imageUrl: string;
  attempt?: number;
}
interface GenerateCaptionResult {
  caption: string | null; // Null if generation failed
}

// ==================================================================
// Helper: Initialize Google AI Client with Secret
// ==================================================================
const initializeGenAI = async () => {
  if (genAI) {
    return;
  }
  if (genAIError) {
    throw new HttpsError("internal", `Gemini API initialization failed previously: ${genAIError}`);
  }
  logger.info("Initializing Google Generative AI client...");
  try {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      throw new Error("Google Cloud Project ID not found in environment.");
    }
    const secretName = `projects/${projectId}/secrets/gemini-api-key/versions/latest`;
    logger.debug("Accessing Gemini API Key secret:", secretName);
    const [version] = await secretManagerClient.accessSecretVersion({name: secretName});
    const apiKey = version.payload?.data?.toString();
    if (!apiKey) {
      throw new Error("Failed to retrieve Gemini API Key from Secret Manager.");
    }
    logger.info("Successfully retrieved Gemini API Key.");
    genAI = new GoogleGenerativeAI(apiKey);
    logger.info("Google Generative AI client initialized.");
  } catch (error: unknown) {
    logger.error("Failed to initialize Google Generative AI client:", error);
    let genAIError = "Unknown initialization error.";
    if (error instanceof Error) {
      genAIError = error.message;
    }
    throw new HttpsError("internal", `Gemini API initialization failed: ${genAIError}`);
  }
};

// ==================================================================
//        Cloud Function: analyzeImage
// ==================================================================
export const analyzeImage = onCall<AnalyzeImageData>(
  async (request): Promise<AnalysisResult> => {
    const imageUrl = request.data.imageUrl;
    if (
      !imageUrl ||
      typeof imageUrl !== "string" ||
      !imageUrl.startsWith("https://firebasestorage.googleapis.com")
    ) {
      logger.error("Invalid or missing imageUrl:", imageUrl, {
        structuredData: true,
      });
      throw new HttpsError("invalid-argument", "Requires valid 'imageUrl'.");
    }
    logger.info(
      "Request received for image analysis:",
      {imageUrl}, // Corrected spacing
      {structuredData: true},
    );
    try {
      logger.info("Calling Vision API...", {structuredData: true});
      const [visionApiResponse] = await visionClient.annotateImage({
        image: {source: {imageUri: imageUrl}}, // Corrected spacing
        features: [
          {type: "LABEL_DETECTION", maxResults: 15}, // Corrected spacing
          {type: "SAFE_SEARCH_DETECTION"}, // Corrected spacing
        ],
      });
      logger.info("Vision API response received.", {structuredData: true});
      const labels =
        visionApiResponse.labelAnnotations?.map((label) => ({
          description: label.description ?? "N/A",
          score: label.score ?? 0,
        })) || [];
      const safeSearch = visionApiResponse.safeSearchAnnotation;
      const safetyRatings = {
        adult: safeSearch?.adult ?? "UNKNOWN",
        spoof: safeSearch?.spoof ?? "UNKNOWN",
        medical: safeSearch?.medical ?? "UNKNOWN",
        violence: safeSearch?.violence ?? "UNKNOWN",
        racy: safeSearch?.racy ?? "UNKNOWN",
      };
      const analysisResult: AnalysisResult = {
        labels: labels,
        safety: safetyRatings as AnalysisResult["safety"],
      };
      logger.info(
        "Image analysis complete (Processed):",
        {analysisResult}, // Corrected spacing
        {structuredData: true},
      );
      return analysisResult;
    } catch (error: unknown) {
      logger.error("Vision API/Processing Error:", error, {
        structuredData: true,
      });
      if (error instanceof HttpsError) {
        throw error;
      }
      const message = error instanceof Error ?
        error.message : // Operator at end
        "Unknown analysis error";
      throw new HttpsError("internal", `Analysis failed: ${message}`, error);
    }
  },
);

// ==================================================================
//        Helper Function: getSpotifyAccessToken
// ==================================================================
const getSpotifyAccessToken = async (): Promise<string> => {
  logger.info("Attempting to get Spotify access token via Secret Manager...");
  const projectId =
    process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  const clientIdSecretName = `projects/${projectId}/secrets/spotify-client-id/versions/latest`;
  const clientSecretSecretName = `projects/${projectId}/secrets/spotify-client-secret/versions/latest`;
  if (!projectId) {
    logger.error("Google Cloud Project ID not found in environment.");
    throw new HttpsError(
      "internal",
      "Server configuration error (Project ID).",
    );
  }
  logger.debug("Constructed Secret Names:", {
    clientIdSecretName,
    clientSecretSecretName,
  });
  try {
    const [clientIdResponse, clientSecretResponse] = await Promise.all([
      secretManagerClient.accessSecretVersion({name: clientIdSecretName}),
      secretManagerClient.accessSecretVersion({name: clientSecretSecretName}),
    ]);
    const clientId = clientIdResponse[0]?.payload?.data?.toString();
    const clientSecret = clientSecretResponse[0]?.payload?.data?.toString();
    if (!clientId || !clientSecret) {
      logger.error("Failed to retrieve secrets from Secret Manager.", {
        clientIdExists: !!clientId,
        clientSecretExists: !!clientSecret,
      });
      throw new HttpsError("internal", "Could not retrieve API credentials.");
    }
    logger.info(
      "Successfully retrieved Spotify credentials from Secret Manager.",
    );
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );
    const authOptions = {
      url: "https://accounts.spotify.com/api/token",
      method: "post" as const,
      headers: {
        "Authorization": `Basic ${authString}`, // Quoted key
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "grant_type=client_credentials",
    };
    const tokenResponse = await axios(authOptions);
    if (tokenResponse.data?.access_token) {
      logger.info("Successfully obtained Spotify access token.");
      return tokenResponse.data.access_token;
    } else {
      logger.error(
        "No access token found in Spotify response",
        tokenResponse.data,
      );
      throw new Error("Could not obtain access token from Spotify.");
    }
  } catch (error: unknown) {
    logger.error("Error fetching secrets or Spotify token:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    if (isAxiosError(error)) {
      logger.error(
        "Axios error details:",
        error.response?.data || error.message,
      );
      const statusText = error.response?.statusText || error.message;
      throw new HttpsError(
        "internal",
        `Spotify token request failed: ${statusText}`,
      );
    }
    const message = error instanceof Error ?
      error.message : // Operator at end
      "Unknown error during token process";
    throw new HttpsError(
      "internal",
      `Failed to get access token: ${message}`,
    );
  }
};

// ==================================================================
// Helper Function: includesAny
// ==================================================================
const includesAny = (sourceLabels: string[], targetLabels: string[]): boolean => {
  return sourceLabels.some((label) => targetLabels.includes(label));
};

// ==================================================================
//        Helper Function: mapLabelsToSeeds
// ==================================================================
const mapLabelsToSeeds = (
  labels: Array<{description: string; score: number}>,
): {
  seedGenres: string[];
  seedArtists: string[];
  seedTracks: string[];
  targetValence?: number;
  targetEnergy?: number;
  targetDanceability?: number;
} => {
  const topLabels = labels
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((l) => l.description.toLowerCase());

  logger.info("Top 5 labels for seeding:", topLabels);

  const potentialSeedGenres = new Set<string>();
  const targetParams: {
    targetValence?: number;
    targetEnergy?: number;
    targetDanceability?: number;
  } = {};
  let hasSpecificTheme = false;

  // --- Step 1: Prioritize Mood Mappings ---
  if (includesAny(topLabels, ["sadness", "rain", "gloomy", "sorrow"])) {
    potentialSeedGenres.add("sad").add("acoustic").add("ambient").add("piano");
    targetParams.targetValence = 0.2;
    targetParams.targetEnergy = 0.3;
  } else if (
    includesAny(topLabels, [
      "happiness", "smile", "joy", "laughing", "cheerful",
    ])
  ) {
    potentialSeedGenres.add("happy").add("pop").add("dance");
    targetParams.targetValence = 0.9;
    targetParams.targetEnergy = 0.7;
    targetParams.targetDanceability = 0.6;
  } else if (includesAny(topLabels, ["calm", "serene", "peaceful"])) {
    potentialSeedGenres
      .add("ambient")
      .add("chill")
      .add("acoustic")
      .add("new-age");
    targetParams.targetEnergy = 0.2;
    targetParams.targetValence = 0.7;
  }

  // --- Step 2: Add Thematic Seeds ---
  if (includesAny(topLabels, ["beach", "sea", "ocean", "coast", "tropical"])) {
    potentialSeedGenres.add("reggae").add("tropical").add("chill").add("summer");
    targetParams.targetValence = targetParams.targetValence ?? 0.7;
    targetParams.targetEnergy = targetParams.targetEnergy ?? 0.6;
    hasSpecificTheme = true;
  }
  if (includesAny(topLabels, ["sunset", "sunrise", "dusk", "dawn"])) {
    potentialSeedGenres.add("chill").add("ambient").add("trip-hop").add("r-n-b");
    targetParams.targetEnergy = targetParams.targetEnergy ?? 0.4;
    targetParams.targetValence = targetParams.targetValence ?? 0.5;
    hasSpecificTheme = true;
  }
  if (
    includesAny(topLabels, [
      "nature", "forest", "mountain", "landscape", "tree", "outdoors",
    ])
  ) {
    potentialSeedGenres
      .add("ambient")
      .add("acoustic")
      .add("folk")
      .add("new-age")
      .add("nature");
    targetParams.targetEnergy = targetParams.targetEnergy ?? 0.3;
    targetParams.targetValence = targetParams.targetValence ?? 0.6;
    hasSpecificTheme = true;
  }
  if (
    includesAny(topLabels, [
      "flower", "plant", "petal", "pink", "spring", "bloom", "flora",
    ])
  ) {
    potentialSeedGenres
      .add("acoustic")
      .add("folk")
      .add("indie-pop")
      .add("pop")
      .add("ambient");
    targetParams.targetValence = targetParams.targetValence ?? 0.7;
    targetParams.targetEnergy = targetParams.targetEnergy ?? 0.5;
    hasSpecificTheme = true;
  }
  if (includesAny(topLabels, ["city", "cityscape", "urban", "street"])) {
    if (topLabels.includes("night")) {
      potentialSeedGenres
        .add("electronic")
        .add("techno")
        .add("house")
        .add("hip-hop")
        .add("jazz");
      targetParams.targetEnergy = targetParams.targetEnergy ?? 0.7;
    } else {
      potentialSeedGenres.add("pop").add("indie-pop").add("hip-hop").add("funk");
      targetParams.targetEnergy = targetParams.targetEnergy ?? 0.6;
    }
    hasSpecificTheme = true;
  }
  if (includesAny(topLabels, ["sky", "cloud"])) {
    if (potentialSeedGenres.size === 0) {
      potentialSeedGenres.add("ambient").add("chill");
      targetParams.targetEnergy = targetParams.targetEnergy ?? 0.4;
    }
  }

  if (
    includesAny(topLabels, [
      "party", "fun", "celebration", "crowd", "concert",
    ])
  ) {
    potentialSeedGenres.add("pop").add("dance").add("party").add("funk").add("disco");
    targetParams.targetValence = 0.8;
    targetParams.targetEnergy = 0.8;
    targetParams.targetDanceability = 0.8;
    hasSpecificTheme = true;
  }
  if (includesAny(topLabels, ["food", "restaurant", "cafe", "coffee"])) {
    potentialSeedGenres
      .add("jazz")
      .add("soul")
      .add("acoustic")
      .add("lounge")
      .add("bossa-nova")
      .add("cafe");
    targetParams.targetEnergy = targetParams.targetEnergy ?? 0.4;
    targetParams.targetValence = targetParams.targetValence ?? 0.6;
    hasSpecificTheme = true;
  }
  if (includesAny(topLabels, ["sports", "fitness", "running"])) {
    potentialSeedGenres
      .add("electronic")
      .add("pop")
      .add("hip-hop")
      .add("workout")
      .add("rock");
    targetParams.targetEnergy = 0.8;
    targetParams.targetDanceability = 0.7;
    hasSpecificTheme = true;
  }

  let isNiche = false;
  if (includesAny(topLabels, ["anime", "animated cartoon"])) {
    potentialSeedGenres.add("anime").add("j-pop");
    targetParams.targetEnergy = targetParams.targetEnergy ?? 0.7;
    isNiche = true;
  }
  if (includesAny(topLabels, ["cartoon", "animation"])) {
    if (!potentialSeedGenres.has("anime")) {
      potentialSeedGenres.add("children").add("soundtrack");
      isNiche = true;
    }
    potentialSeedGenres.add("pop");
  }

  if (includesAny(topLabels, ["dog", "cat", "pet"])) {
    if (potentialSeedGenres.size === 0) {
      potentialSeedGenres.add("pop").add("acoustic").add("indie-pop");
      targetParams.targetValence = targetParams.targetValence ?? 0.7;
    }
  }

  // --- Step 3: Ensure Broad Seeds if Only Niche/None Found ---
  if (!hasSpecificTheme && isNiche) {
    logger.info("Only niche seeds found, adding broader genres.");
    potentialSeedGenres.add("pop").add("electronic");
  }

  // --- Step 4: Final Fallback ---
  if (potentialSeedGenres.size === 0 && Object.keys(targetParams).length === 0) {
    potentialSeedGenres
      .add("pop")
      .add("rock")
      .add("electronic")
      .add("hip-hop")
      .add("indie");
    logger.warn("No specific seeds or params mapped, using broad default genres.");
  } else if (potentialSeedGenres.size === 0 && Object.keys(targetParams).length > 0) {
    potentialSeedGenres.add("pop");
    logger.warn("Only target params found, adding 'pop' as seed genre.");
  }

  // --- Step 5: Convert Set to Array and Limit ---
  const finalSeedGenres = Array.from(potentialSeedGenres).slice(0, 5);

  logger.info("Final Mapped Seeds:", {
    seedGenres: finalSeedGenres,
    targetParams, // Corrected spacing
  });

  return {
    seedGenres: finalSeedGenres,
    seedArtists: [],
    seedTracks: [],
    ...targetParams,
  };
};

// ==================================================================
//        Cloud Function: getSpotifyRecommendations
// ==================================================================
export const getSpotifyRecommendations = onCall<SpotifyRequestData>(
  async (request): Promise<SpotifyRecommendationsResult> => {
    logger.info(
      "Received request for Spotify recommendations",
      request.data?.labels?.length,
    );
    if (!request.data?.labels || request.data.labels.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Missing 'labels' in request data.",
      );
    }

    try {
      const accessToken = await getSpotifyAccessToken();
      const seeds = mapLabelsToSeeds(request.data.labels);

      if (
        seeds.seedGenres.length === 0 &&
        seeds.seedArtists.length === 0 &&
        seeds.seedTracks.length === 0
      ) {
        logger.warn(
          "No valid seeds (genre, artist, track) generated from labels.",
        );
        return {tracks: []};
      }

      const recommendationsUrl = "https://api.spotify.com/v1/recommendations";
      const limit = 20;
      const params = new URLSearchParams({
        limit: limit.toString(),
        // market: "US", // Keep market commented out
      });
      if (seeds.seedGenres.length > 0) {
        params.append("seed_genres", seeds.seedGenres.join(","));
      }
      if (seeds.targetValence !== undefined) {
        params.append("target_valence", seeds.targetValence.toString());
      }
      if (seeds.targetEnergy !== undefined) {
        params.append("target_energy", seeds.targetEnergy.toString());
      }
      if (seeds.targetDanceability !== undefined) {
        params.append(
          "target_danceability",
          seeds.targetDanceability.toString(),
        );
      }

      const spotifyHeaders = {Authorization: `Bearer ${accessToken}`};

      logger.debug("Calling Spotify Recommendations Endpoint:", {
        url: recommendationsUrl,
        params: params.toString(),
        headers: {Authorization: "Bearer [REDACTED]"}, // Corrected spacing
      });

      const response = await axios.get(recommendationsUrl, {
        headers: spotifyHeaders,
        params: params,
      });

      if (!response.data?.tracks) {
        logger.warn("No tracks array found in Spotify response", response.data);
        return {tracks: []};
      }

      const recommendedTracks: RecommendedTrack[] = response.data.tracks
        .map((track: SpotifyTrackObject): RecommendedTrack | null => {
          if (!track?.id || !track?.name) {
            return null;
          }
          return {
            id: track.id,
            name: track.name,
            artists:
              track.artists?.map((a: SpotifyArtistObject) => a.name) || [
                "Unknown",
              ],
            previewUrl: track.preview_url || null,
            spotifyUrl: track.external_urls?.spotify || "",
            albumImageUrl: track.album?.images?.[0]?.url || null,
          };
        })
        .filter(
          (track: RecommendedTrack | null): track is RecommendedTrack =>
            track !== null,
        );

      logger.info(
        `Successfully processed ${recommendedTracks.length} recommendations.`,
      );
      return {tracks: recommendedTracks};
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 404) {
        logger.warn("Spotify API returned 404 (Not Found) for the request.", {
          url: error.config?.url,
          params: error.config?.params?.toString(), // Corrected spacing
        });
        return {tracks: []};
      }

      logger.error("Error getting Spotify recommendations:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (isAxiosError(error)) {
        logger.error("Axios error details:", error.response?.data);
        const statusText = error.response?.statusText || "Unknown Axios Error";
        throw new HttpsError(
          "internal",
          `Spotify request failed: ${statusText}`,
        );
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new HttpsError(
        "internal",
        `Recommendation fetch failed: ${message}`,
      );
    }
  },
);

// ==================================================================
//        Cloud Function: checkUsernameAvailability
// ==================================================================
export const checkUsernameAvailability = onCall<{ username: string }>(
  async (request): Promise<{ exists: boolean }> => {
    const username = request.data.username?.trim().toLowerCase();

    if (!username || username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      logger.warn("Invalid username format received:", request.data.username);
      throw new HttpsError(
        "invalid-argument",
        "Username must be 3+ chars and contain only lowercase letters, numbers, or underscores.",
      );
    }

    logger.info("Checking username availability for:", username);

    try {
      const usersRef = dbAdmin.collection("users");
      const querySnapshot = await usersRef
        .where("username", "==", username)
        .limit(1)
        .get();

      const exists = !querySnapshot.empty;
      logger.info(`Username '${username}' exists: ${exists}`);

      return {exists: exists};
    } catch (error: unknown) {
      logger.error("Error checking username availability:", error, {
        username: username, // Corrected spacing
      });
      throw new HttpsError(
        "internal",
        "Could not check username availability.",
        error,
      );
    }
  },
);


// ==================================================================
//        Cloud Function: generateCaption (NEW)
// ==================================================================
export const generateCaption = onCall<GenerateCaptionData>(
  async (request): Promise<GenerateCaptionResult> => {
    await initializeGenAI(); // Ensure client is initialized
    if (!genAI) {
      throw new HttpsError("internal", "Gemini AI Client not available.");
    }

    const imageUrl = request.data.imageUrl;
    const attempt = request.data.attempt || 1;

    if (
      !imageUrl || typeof imageUrl !== "string" ||
      !imageUrl.startsWith("https://firebasestorage.googleapis.com")
    ) {
      logger.error("Invalid or missing imageUrl for caption generation:", imageUrl);
      throw new HttpsError("invalid-argument", "Requires a valid Firebase Storage 'imageUrl'.");
    }

    logger.info(`Received request for caption generation (Attempt ${attempt}):`, {imageUrl});

    try {
      const imageResponse = await axios.get(imageUrl, {responseType: "arraybuffer"});
      const imageBytes = Buffer.from(imageResponse.data, "binary").toString("base64");
      const mimeType = imageResponse.headers["content-type"] || "image/jpeg";

      if (!mimeType.startsWith("image/")) {
        throw new Error(`Invalid content type fetched: ${mimeType}`);
      }

      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
        safetySettings: [
          {category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
          {category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
          {category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
          {category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
        ],
      });

      // --- <<< MODIFIED PROMPT >>> ---
      let prompt = "Generate one short, engaging social media caption for this image. Be creative and relevant. Do not include hashtags.";
      if (attempt > 1) {
        // Add variations for subsequent attempts
        const variations = [
          "Give me a different creative caption for this picture.",
          "Suggest another social media caption, focusing on a different aspect.",
          "Provide one more unique caption idea for this image.",
          "Generate an alternative short caption.",
        ];
          // Pick a variation based on attempt number (cycles through)
        prompt = variations[(attempt - 2) % variations.length] + " Do not include hashtags.";
      }
      logger.info(`Using prompt for attempt ${attempt}: "${prompt}"`);
      // --- <<< END MODIFIED PROMPT >>> ---

      const imagePart = {
        inlineData: {
          data: imageBytes,
          mimeType: mimeType,
        },
      };

      logger.info("Sending request to Gemini Pro Vision...");
      const result = await model.generateContent([prompt, imagePart]);

      const response = result.response;

      if (response.promptFeedback?.blockReason) {
        logger.warn("Gemini generation blocked.", {blockReason: response.promptFeedback.blockReason});
        throw new HttpsError("unavailable", `Caption generation blocked: ${response.promptFeedback.blockReason}.`);
      }

      const candidate = response.candidates?.[0];
      // Check if parts array exists and has at least one element with text
      if (!candidate?.content?.parts?.[0]?.text) {
        const finishReason = candidate?.finishReason ?? "UNKNOWN";
        const safetyRatings = candidate?.safetyRatings ?? [];
        logger.warn("Gemini did not return valid content.", {finishReason, safetyRatings}); // Corrected spacing
        throw new HttpsError("unavailable", `AI could not generate a caption. Reason: ${finishReason}`);
      }

      const caption = candidate.content.parts[0].text;
      logger.info("Generated caption:", caption);
      return {caption: caption.trim()};
    } catch (error: unknown) {
      logger.error("Error generating caption with Gemini:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (isAxiosError(error)) {
        logger.error("Axios error fetching image for Gemini:", error.response?.data || error.message);
        throw new HttpsError("internal", `Failed to fetch image: ${error.message}`);
      }
      const message = error instanceof Error ? error.message : "Unknown generation error";
      throw new HttpsError("internal", `Caption generation failed: ${message}`);
    }
  },
);
