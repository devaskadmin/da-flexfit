const multer = require('multer');
const fs = require('fs');
const path = require('path');

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
    const imgPath = path.join(fullPath, img);
    if (fs.existsSync(imgPath)) {
      try { fs.unlinkSync(imgPath); } catch (e) { /* ignore */ }
    }
  }
}

module.exports = {
  upload,
  deleteImagesFromDisk
};
