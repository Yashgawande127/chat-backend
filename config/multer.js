const multer = require('multer');
const path = require('path');
const fs = require('fs');

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB for images
  video: 100 * 1024 * 1024, // 100MB for videos
  audio: 50 * 1024 * 1024, // 50MB for audio
  document: 25 * 1024 * 1024, // 25MB for documents
  default: 10 * 1024 * 1024 // 10MB default
};

// Allowed file types
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'],
  audio: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed'
  ]
};

// Create upload directories
const createUploadDirs = () => {
  const dirs = ['uploads/messages', 'uploads/avatars', 'uploads/backgrounds', 'uploads/thumbnails', 'uploads/temp'];
  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
};

// Initialize directories
createUploadDirs();

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/messages';
    
    if (req.route.path.includes('avatar')) {
      uploadPath = 'uploads/avatars';
    }
    
    const fullPath = path.join(__dirname, '..', uploadPath);
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const allAllowedTypes = [
    ...ALLOWED_TYPES.image,
    ...ALLOWED_TYPES.video,
    ...ALLOWED_TYPES.audio,
    ...ALLOWED_TYPES.document
  ];

  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Get file category based on mime type
const getFileCategory = (mimeType) => {
  if (ALLOWED_TYPES.image.includes(mimeType)) return 'image';
  if (ALLOWED_TYPES.video.includes(mimeType)) return 'video';
  if (ALLOWED_TYPES.audio.includes(mimeType)) return 'audio';
  if (ALLOWED_TYPES.document.includes(mimeType)) return 'document';
  return 'file';
};

// Get appropriate file size limit
const getFileSizeLimit = (mimeType) => {
  const category = getFileCategory(mimeType);
  return FILE_SIZE_LIMITS[category] || FILE_SIZE_LIMITS.default;
};

// Main upload configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Max 100MB (will be checked per file type)
    files: 5, // Max 5 files at once
  },
  fileFilter: fileFilter
});

// Middleware to check file size based on type
const checkFileSize = (req, res, next) => {
  if (!req.files && !req.file) {
    return next();
  }

  const files = req.files || [req.file];
  
  for (const file of files) {
    const maxSize = getFileSizeLimit(file.mimetype);
    if (file.size > maxSize) {
      return res.status(400).json({
        error: `File ${file.originalname} exceeds maximum size limit of ${Math.round(maxSize / (1024 * 1024))}MB`
      });
    }
  }
  
  next();
};

// Different upload configurations
const uploadConfigs = {
  single: (fieldName) => [upload.single(fieldName), checkFileSize],
  multiple: (fieldName, maxCount = 5) => [upload.array(fieldName, maxCount), checkFileSize],
  fields: (fields) => [upload.fields(fields), checkFileSize]
};

module.exports = {
  upload: uploadConfigs,
  ALLOWED_TYPES,
  FILE_SIZE_LIMITS,
  getFileCategory,
  getFileSizeLimit
};
