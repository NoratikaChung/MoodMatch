// File: functions/src/index.ts

// Import v2 specific https functions
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger"; // Import the v2 logger

// Keep Vision API imports
import * as vision from "@google-cloud/vision";
import {protos} from "@google-cloud/vision";
type Likelihood = protos.google.cloud.vision.v1.Likelihood;

// Import axios and specifically isAxiosError for type checking
import axios, {isAxiosError} from "axios";

// Import Secret Manager client
import {SecretManagerServiceClient} from "@google-cloud/secret-manager";


// --- Client Initializations ---
const visionClient = new vision.ImageAnnotatorClient();
const secretManagerClient = new SecretManagerServiceClient();


// --- Interfaces ---
interface AnalyzeImageData {
  imageUrl: string;
}
interface AnalysisResult {
   labels: { description: string; score: number }[];
   safety: {
     adult: Likelihood | "UNKNOWN"; spoof: Likelihood | "UNKNOWN";
     medical: Likelihood | "UNKNOWN"; violence: Likelihood | "UNKNOWN";
     racy: Likelihood | "UNKNOWN";
   };
}
interface SpotifyRequestData {
  labels: { description: string; score: number }[];
}
interface RecommendedTrack {
    id: string; name: string; artists: string[];
    previewUrl: string | null; spotifyUrl: string; albumImageUrl: string | null;
}
interface SpotifyRecommendationsResult {
  tracks: RecommendedTrack[];
}
interface SpotifyTrackObject {
    id: string; name: string; artists: { name: string }[];
    preview_url: string | null; external_urls: { spotify?: string };
    album?: { images?: { url: string }[] };
}
interface SpotifyArtistObject { name: string; }


// ==================================================================
//        Cloud Function: analyzeImage
// ==================================================================
export const analyzeImage = onCall<AnalyzeImageData>(
  async (request): Promise<AnalysisResult> => {
    const imageUrl = request.data.imageUrl;
    // --- Input Validation ---
    if (
      !imageUrl || typeof imageUrl !== "string" ||
      !imageUrl.startsWith("https://firebasestorage.googleapis.com")
    ) {
      logger.error( "Invalid or missing imageUrl:", imageUrl,
        {structuredData: true} );
      throw new HttpsError( "invalid-argument", "Requires valid 'imageUrl'." );
    }
    logger.info( "Request received for image analysis:", {imageUrl},
      {structuredData: true} );

    try {
      // --- Call Google Cloud Vision API ---
      logger.info("Calling Vision API...", {structuredData: true});
      const [visionApiResponse] = await visionClient.annotateImage({
        image: {source: {imageUri: imageUrl}},
        features: [
          {type: "LABEL_DETECTION", maxResults: 15},
          {type: "SAFE_SEARCH_DETECTION"},
        ],
      });
      logger.info( "Vision API response received.", {structuredData: true} );

      // <<< --- ADDED: Log the full Vision API response --- >>>
      logger.info("Full Vision API Response:", visionApiResponse);
      // <<< --- END ADDED LOGGING --- >>>

      // --- Process Results ---
      const labels = visionApiResponse.labelAnnotations?.map((label) => ({
        description: label.description ?? "N/A", score: label.score ?? 0,
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
      logger.info( "Image analysis complete (Processed):", {analysisResult},
        {structuredData: true} );

      // --- Return Results ---
      return analysisResult;
    } catch (error: unknown) {
      logger.error( "Vision API/Processing Error:", error,
        {structuredData: true} );
      if (error instanceof HttpsError) {
        throw error;
      }
      const message = (error instanceof Error) ?
        error.message : "Unknown analysis error";
      throw new HttpsError(
        "internal", `Analysis failed: ${message}`, error
      );
    }
  });


// ==================================================================
//        Helper Function: getSpotifyAccessToken (Using Secret Manager)
// ==================================================================
const getSpotifyAccessToken = async (): Promise<string> => {
  logger.info("Attempting to get Spotify access token via Secret Manager...");

  const projectId = process.env.GCLOUD_PROJECT ||
                      process.env.GOOGLE_CLOUD_PROJECT;
  const clientIdSecretName = `projects/${projectId}/secrets/spotify-client-id` +
                               "/versions/latest";
  const clientSecretSecretName = `projects/${projectId}/secrets/` +
                                   "spotify-client-secret/versions/latest";

  if (!projectId) {
    logger.error("Google Cloud Project ID not found in environment.");
    throw new HttpsError("internal",
      "Server configuration error (Project ID).");
  }

  logger.debug("Constructed Secret Names:", {
    clientIdSecretName, clientSecretSecretName,
  });

  try {
    // Access secrets concurrently
    const [clientIdResponse, clientSecretResponse] = await Promise.all([
      secretManagerClient.accessSecretVersion({name: clientIdSecretName}),
      secretManagerClient.accessSecretVersion(
        {name: clientSecretSecretName}
      ),
    ]);

    // Extract secret values
    const clientId = clientIdResponse[0]?.payload?.data?.toString();
    const clientSecret = clientSecretResponse[0]?.payload?.data?.toString();

    if (!clientId || !clientSecret) {
      logger.error(
        "Failed to retrieve secrets from Secret Manager.", {
          clientIdExists: !!clientId, clientSecretExists: !!clientSecret,
        });
      throw new HttpsError(
        "internal", "Could not retrieve API credentials."
      );
    }
    logger.info(
      "Successfully retrieved Spotify credentials from Secret Manager."
    );


    // --- Proceed with getting the token ---
    const authString = Buffer.from(`${clientId}:${clientSecret}`)
      .toString("base64");
    const authOptions = {
      url: "https://accounts.spotify.com/api/token",
      method: "post" as const,
      headers: {
        "Authorization": `Basic ${authString}`,
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
        "No access token found in Spotify response", tokenResponse.data
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
        "Axios error details:", error.response?.data || error.message
      );
      const statusText = error.response?.statusText || error.message;
      throw new HttpsError(
        "internal", `Spotify token request failed: ${statusText}`
      );
    }
    const message = (error instanceof Error) ?
      error.message : "Unknown error during token process";
    throw new HttpsError(
      "internal", `Failed to get access token: ${message}`
    );
  }
}; // Closing brace and semicolon for getSpotifyAccessToken


// ==================================================================
//        Helper Function: mapLabelsToSeeds (Corrected Fallback)
// ==================================================================
const mapLabelsToSeeds = (
  labels: { description: string; score: number }[]
): {
    seedGenres: string[]; seedArtists: string[]; seedTracks: string[];
    targetValence?: number; targetEnergy?: number; targetDanceability?: number;
} => {
  const topLabels = labels
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((l) => l.description.toLowerCase());

  logger.info("Top 5 labels for seeding:", topLabels);
  let seedGenres: string[] = [];
  const targetParams: {
        targetValence?: number;
        targetEnergy?: number;
        targetDanceability?: number;
    } = {};

  // --- Example Mapping Logic (Customize heavily!) ---
  if (topLabels.includes("anime") || topLabels.includes("animated cartoon")) {
    seedGenres.push("anime", "j-pop"); targetParams.targetEnergy = 0.7;
  } else if (topLabels.includes("cartoon") || topLabels.includes("animation")) {
    seedGenres.push("pop", "soundtrack");
  } else if (topLabels.includes("fiction")) {
    seedGenres.push("soundtrack", "ambient");
  } else if (topLabels.includes("sky") || topLabels.includes("cloud")) {
    seedGenres.push("ambient", "chill"); targetParams.targetEnergy = 0.4;
  } else if (topLabels.includes("beach") || topLabels.includes("sea")) {
    seedGenres.push("reggae", "tropical"); targetParams.targetValence = 0.7;
  } else if (topLabels.includes("flower") || topLabels.includes("plant")) {
    seedGenres.push("acoustic", "folk"); targetParams.targetValence = 0.6;
  } else if (topLabels.includes("city") || topLabels.includes("night")) {
    seedGenres.push("electronic", "techno"); targetParams.targetEnergy = 0.8;
  } else if (topLabels.includes("party") || topLabels.includes("fun")) {
    seedGenres.push("pop", "dance", "party");
    targetParams.targetValence = 0.8; targetParams.targetEnergy = 0.8;
  } else if (topLabels.includes("food") || topLabels.includes("cafe")) {
    seedGenres.push("jazz", "soul", "cafe");
  } else if (topLabels.includes("sadness") || topLabels.includes("rain")) {
    seedGenres.push("sad", "rainy-day"); targetParams.targetValence = 0.2;
  } else if (topLabels.includes("happiness") || topLabels.includes("smile")) {
    seedGenres.push("happy", "pop");
    targetParams.targetValence = 0.9; targetParams.targetEnergy = 0.7;
  }

  // --- Fallback ---
  if (seedGenres.length === 0) {
    seedGenres.push("pop", "rock", "electronic"); // Use known valid seeds
    logger.warn("No specific genres mapped, using valid defaults.");
  }

  // Limit seeds
  seedGenres = [...new Set(seedGenres)].slice(0, 5);
  logger.info("Mapped Seeds:", {seedGenres, targetParams});

  return {
    seedGenres: seedGenres, seedArtists: [], seedTracks: [], ...targetParams,
  };
}; // Closing brace and semicolon for mapLabelsToSeeds


// ==================================================================
//        Cloud Function: getSpotifyRecommendations
// ==================================================================
export const getSpotifyRecommendations = onCall<SpotifyRequestData>(
  async (request): Promise<SpotifyRecommendationsResult> => {
    logger.info(
      "Received request for Spotify recommendations",
      request.data?.labels?.length
    );
    if (!request.data?.labels || request.data.labels.length === 0) {
      throw new HttpsError(
        "invalid-argument", "Missing 'labels' in request data."
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
        throw new HttpsError(
          "aborted", "Could not determine seeds from labels."
        );
      }

      // Prepare API Call
      const recommendationsUrl =
              "https://api.spotify.com/v1/recommendations";
      const limit = 20;
      const params = new URLSearchParams(
        {limit: limit.toString(), market: "US"});
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
          "target_danceability", seeds.targetDanceability.toString()
        );
      }

      // <<< --- ADDED: Log details before calling Spotify --- >>>
      const fullSpotifyUrl = `${recommendationsUrl}?${params.toString()}`;
      const spotifyHeaders = {"Authorization": `Bearer ${accessToken}`};
      logger.info( "Calling Spotify Recommendations Endpoint:", {
        url: fullSpotifyUrl,
        headers: {
          Authorization: "Bearer [REDACTED]", // Avoid logging token
        },
      });
      // <<< --- END ADDED LOGGING --- >>>


      // Call Spotify API
      const response = await axios.get(recommendationsUrl, {
        headers: spotifyHeaders, // Use the defined headers
        params: params,
      });

      // Process Response
      if (!response.data?.tracks) {
        logger.error(
          "No tracks found in Spotify response", response.data
        );
        throw new HttpsError( "not-found", "No recommendations found." );
      }

      // Map tracks carefully
      const recommendedTracks: RecommendedTrack[] = response.data.tracks
        .map((track: SpotifyTrackObject): RecommendedTrack | null => {
          if (!track?.id || !track?.name) {
            return null;
          }
          return {
            id: track.id, name: track.name,
            artists: track.artists?.map(
              (a: SpotifyArtistObject) => a.name
            ) || ["Unknown"],
            previewUrl: track.preview_url || null,
            spotifyUrl: track.external_urls?.spotify || "",
            albumImageUrl: track.album?.images?.[0]?.url || null,
          };
        })
        .filter((track: RecommendedTrack | null): track is RecommendedTrack =>
          track !== null
        );


      logger.info(
        `Successfully processed ${recommendedTracks.length} recommendations.`
      );

      // Return tracks
      return {tracks: recommendedTracks};
    } catch (error: unknown) {
      logger.error("Error getting Spotify recommendations:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (isAxiosError(error)) {
        logger.error("Axios error details:", error.response?.data);
        const statusText = error.response?.statusText || error.message;
        throw new HttpsError(
          "internal", `Spotify request failed: ${statusText}`
        );
      }
      const message = (error instanceof Error) ?
        error.message : "Unknown error";
      throw new HttpsError(
        "internal", `Recommendation fetch failed: ${message}`
      );
    }
  }
); // Closing parenthesis and semicolon for getSpotifyRecommendations
