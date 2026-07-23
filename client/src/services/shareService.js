import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage, auth } from "../lib/firebase";

/**
 * Upload any Blob/File to Firebase Storage and return a public URL.
 *
 * @param {Blob}   blob       - The file blob (PDF, JSON, etc.)
 * @param {string} folder     - Storage folder: "articles" | "roadmaps" | "shares"
 * @param {string} filename   - e.g. "my-roadmap.json"
 * @returns {Promise<string>} - Public download URL
 */
export async function uploadAndGetShareLink(blob, folder, filename) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to generate a share link.");
  }

  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${user.uid}/${timestamp}_${safeName}`;
  const storageRef = ref(storage, path);

  console.log(`[ShareService] Uploading to path: ${path}`);
  const snapshot = await uploadBytes(storageRef, blob, {
    contentType: blob.type || "application/octet-stream",
    customMetadata: {
      uploadedBy: user.uid,
      originalName: filename,
      uploadedAt: new Date().toISOString(),
    },
  });
  console.log(`[ShareService] Upload complete:`, snapshot.metadata.fullPath);

  const url = await getDownloadURL(snapshot.ref);
  console.log(`[ShareService] Share URL:`, url);

  return url;
}

/**
 * Delete a previously uploaded file by its full storage path.
 *
 * @param {string} fullPath - e.g. "roadmaps/uid123/1234567890_roadmap.json"
 */
export async function deleteSharedFile(fullPath) {
  try {
    const storageRef = ref(storage, fullPath);
    await deleteObject(storageRef);
    console.log(`[ShareService] Deleted path: ${fullPath}`);
  } catch (err) {
    console.warn(`[ShareService] Deletion failed for ${fullPath}:`, err.message);
  }
}
