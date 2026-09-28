const multer = require('multer');

const maximumFileSize = Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024;
const maximumFiles = 5;
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maximumFileSize,
    files: maximumFiles,
    fields: 10,
    fieldSize: 20 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Unsupported attachment type. Upload a JPG, PNG, WebP, or PDF file.');
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

const parseAttachments = upload.fields([
  { name: 'attachments', maxCount: maximumFiles },
  { name: 'image', maxCount: 1 },
]);

const complaintAttachments = (req, res, next) => {
  parseAttachments(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          error.status = 413;
          error.message = `Each attachment must be ${Math.floor(maximumFileSize / (1024 * 1024))} MB or smaller.`;
        } else {
          error.status = 400;
          error.message = 'The attachment upload is invalid or exceeds the allowed file count.';
        }
      }
      return next(error);
    }

    const files = [...(req.files?.attachments || []), ...(req.files?.image || [])];
    if (files.length > maximumFiles) {
      const tooManyFiles = new Error(`Upload no more than ${maximumFiles} attachments.`);
      tooManyFiles.status = 400;
      return next(tooManyFiles);
    }

    return next();
  });
};

module.exports = { complaintAttachments };
