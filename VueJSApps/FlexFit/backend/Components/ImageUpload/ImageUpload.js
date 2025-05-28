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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const rawTitle = req.body.ExerciseTitle;
    if (!rawTitle) return cb(new Error("ExerciseTitle is required"));

    const folderName = rawTitle.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const fullPath = path.join(uploadPath, folderName);

    if (fs.existsSync(fullPath)) {
      return cb(new Error("Folder for this exercise already exists"));
    }

    fs.mkdirSync(fullPath, { recursive: true });
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE }
}).array('images', 3); // max 3 images

module.exports = upload;
