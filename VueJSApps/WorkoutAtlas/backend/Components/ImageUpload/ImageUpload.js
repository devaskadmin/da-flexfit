const multer = require('multer');
const fs = require('fs');
const path = require('path');
const {
  resolveLocalContentRoot,
  DEFAULT_IMAGE_NAME,
  isDefaultExerciseImageReference,
  buildExerciseMediaFolderPath,
} = require('../../services/mediaResolver');

const uploadPath = path.join(__dirname, '../../../public/assets/Excerises'); // adjust if your structure differs

// File type filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

// Max file size = 1GB per image (adjustable)
const MAX_SIZE = 1024 * 1024 * 1024;

// Enhanced storage logic for add/edit
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const rawTitle = req.body.ExerciseTitle;
    if (!rawTitle) return cb(new Error("ExerciseTitle is required"));
    const folderName = rawTitle.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const fullPath = path.join(uploadPath, folderName);
    // Always create the folder if it doesn't exist (for add or edit)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

// Multer middleware: allow up to 2 images per request
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE }
}).array('images', 2); // max 2 images

// Helper to delete images from disk
function deleteImagesFromDisk(exerciseTitle, imagesToDelete = []) {
  if (!exerciseTitle || !Array.isArray(imagesToDelete) || imagesToDelete.length === 0) return;

  const folderName = exerciseTitle.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const fullPath = path.join(uploadPath, folderName);

  for (const img of imagesToDelete) {
    const candidate = String(img || '').trim();
    if (!candidate || isDefaultExerciseImageReference(candidate)) {
      continue;
    }

    const imgPath = path.join(fullPath, candidate);
    if (fs.existsSync(imgPath)) {
      try { fs.unlinkSync(imgPath); } catch (e) { /* ignore */ }
    }
  }
}

function finalizeUploadedExerciseImages(exerciseId, files = []) {
  if (!exerciseId || !Array.isArray(files) || files.length === 0) {
    return [];
  }

  const targetDir = buildExerciseMediaFolderPath(exerciseId);
  fs.mkdirSync(targetDir, { recursive: true });

  const finalFileNames = [];
  const tempFiles = [];

  for (const file of files) {
    const sourcePath = file?.path;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      continue;
    }

    const originalName = String(file.originalname || file.filename || '').trim();
    if (originalName && isDefaultExerciseImageReference(originalName)) {
      throw new Error('The default exercise image is reserved and cannot be replaced or uploaded as a custom exercise file.');
    }

    const filename = path.basename(originalName || file.filename || 'exercise-image.jpg');
    const ext = path.extname(filename) || path.extname(file.originalname || file.filename || '.jpg') || '.jpg';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const destinationPath = path.join(targetDir, uniqueName);

    try {
      fs.renameSync(sourcePath, destinationPath);
      finalFileNames.push(uniqueName);
      tempFiles.push(destinationPath);
    } catch (renameError) {
      try { fs.unlinkSync(sourcePath); } catch (_) {}
      for (const createdPath of tempFiles) {
        try { fs.unlinkSync(createdPath); } catch (_) {}
      }
      throw new Error(`Failed to move uploaded exercise image into storage for ExerciseID ${exerciseId}: ${renameError.message}`);
    }
  }

  return finalFileNames.slice(0, 2);
}

function cleanupExerciseMediaDirectory(exerciseId) {
  const targetDir = buildExerciseMediaFolderPath(exerciseId);
  if (fs.existsSync(targetDir)) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true });
    } catch (_) {
      // best effort cleanup
    }
  }
}

function isProtectedDefaultExerciseImage(value) {
  return isDefaultExerciseImageReference(value);
}

module.exports = {
  upload,
  deleteImagesFromDisk,
  finalizeUploadedExerciseImages,
  cleanupExerciseMediaDirectory,
  isProtectedDefaultExerciseImage,
  resolveLocalContentRoot,
  buildExerciseMediaFolderPath,
  DEFAULT_IMAGE_NAME
};
