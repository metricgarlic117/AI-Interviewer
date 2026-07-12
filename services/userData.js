import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  orderBy,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

// --- User Profile ---

export async function createUserProfile(userId, data) {
  try {
    await setDoc(doc(db, "users", userId), {
      ...data,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
}

export async function getUserProfile(userId) {
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
}

export async function updateUserProfile(userId, data) {
  try {
    const docRef = doc(db, "users", userId);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
}

// --- Content References (Resume & JD) ---

export async function saveResume(userId, resumeText, fileName) {
  try {
    const timestamp = Date.now();
    const docRef = await addDoc(collection(db, `users/${userId}/resumes`), {
      text: resumeText,
      fileName,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving resume:", error);
    throw error;
  }
}

export async function getResume(userId, resumeId) {
  try {
    const docSnap = await getDoc(doc(db, `users/${userId}/resumes`, resumeId));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching resume:", error);
    throw error;
  }
}

export async function saveJobDescription(userId, jobDescription) {
  try {
    const timestamp = Date.now();
    const docRef = await addDoc(
      collection(db, `users/${userId}/jobDescriptions`),
      {
        text: jobDescription,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    );
    return docRef.id;
  } catch (error) {
    console.error("Error saving JD:", error);
    throw error;
  }
}

export async function getJobDescription(userId, jdId) {
  try {
    const docSnap = await getDoc(
      doc(db, `users/${userId}/jobDescriptions`, jdId),
    );
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.text;
    }
    return null;
  } catch (error) {
    console.error("Error fetching JD:", error);
    throw error;
  }
}

// --- Interview Messages (Subcollection) ---

export async function saveMessage(userId, interviewId, message) {
  try {
    // Add to subcollection for scalability
    await addDoc(
      collection(db, `users/${userId}/interviews/${interviewId}/messages`),
      {
        ...message,
        timestamp: Date.now(),
      },
    );
  } catch (error) {
    console.error("Error saving message:", error);
    // Non-blocking error logging
  }
}

export async function getSessionMessages(
  userId,
  interviewId,
  limitCount = 100,
) {
  try {
    const q = query(
      collection(db, `users/${userId}/interviews/${interviewId}/messages`),
      orderBy("timestamp", "asc"),
      limit(limitCount),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data());
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
}

// Save resume analysis with references only (OPTIMIZED - No duplicate data)
export async function saveFullResumeAnalysis(
  userId,
  resumeId,
  resumeFileName,
  jobDescriptionId,
  analysis,
) {
  try {
    // Save to user's subcollection - ONLY REFERENCES, NO DUPLICATE TEXT
    await setDoc(doc(db, `users/${userId}/resumeAnalysis/latest`), {
      resumeId,
      jobDescriptionId,
      resumeFileName,
      analysis,
      analyzedAt: Date.now(),
    });

    // Also update prep context based on analysis
    await setDoc(
      doc(db, `users/${userId}/prepContext/main`),
      {
        targetRole:
          analysis.roleFitSummary?.split(" ")[0] || "Software Engineer",
        seniorityLevel: analysis.seniorityAlignment || "Junior",
        lastUpdated: Date.now(),
      },
      { merge: true },
    );

    console.log("Resume analysis saved successfully (optimized)");
  } catch (error) {
    console.error("Error saving resume analysis:", error);
    throw error;
  }
}

// Get resume analysis with hydrated resume and JD data
export async function getResumeAnalysisWithData(userId) {
  try {
    const analysisSnap = await getDoc(
      doc(db, `users/${userId}/resumeAnalysis/latest`),
    );
    if (!analysisSnap.exists()) return null;

    const data = analysisSnap.data();

    // Hydrate resume and JD from references
    const [resumeData, jdData] = await Promise.all([
      data.resumeId ? getResume(userId, data.resumeId) : null,
      data.jobDescriptionId
        ? getJobDescription(userId, data.jobDescriptionId)
        : null,
    ]);

    return {
      ...data,
      resumeText: resumeData?.text || "",
      jobDescription: jdData || "",
    };
  } catch (error) {
    console.error("Error fetching resume analysis:", error);
    return null;
  }
}

// Process interview feedback and save
export async function processInterviewFeedback(
  userId,
  sessionId,
  feedback,
  role,
) {
  try {
    // Save feedback to interview session
    const sessionRef = doc(db, `users/${userId}/interviews`, sessionId);
    await updateDoc(sessionRef, {
      feedback,
      status: "completed",
      completedAt: Date.now(),
    });

    // Update user's recommendation based on performance
    if (feedback.performanceScore < 70 && feedback.weaknesses?.length > 0) {
      await setDoc(doc(db, `users/${userId}/recommendations/current`), {
        type: "review_weakness",
        message: `Focus on improving: ${feedback.weaknesses[0]}`,
        reason: `Your recent ${role} interview showed this as an area for growth.`,
        targetAction: "/setup",
        createdAt: Date.now(),
      });
    }

    console.log("Interview feedback processed successfully");
  } catch (error) {
    console.error("Error processing interview feedback:", error);
    throw error;
  }
}
