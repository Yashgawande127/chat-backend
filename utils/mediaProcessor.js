const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class MediaProcessor {
  constructor() {
    this.thumbnailsDir = path.join(__dirname, '..', 'uploads', 'thumbnails');
    this.ensureDirectoryExists(this.thumbnailsDir);
  }

  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Process and compress images
  async processImage(inputPath, options = {}) {
    try {
      const {
        quality = 80,
        maxWidth = 1920,
        maxHeight = 1080,
        createThumbnail = true,
        thumbnailSize = 300
      } = options;

      const filename = path.basename(inputPath, path.extname(inputPath));
      const outputPath = path.join(path.dirname(inputPath), `${filename}_processed.jpg`);
      const thumbnailPath = path.join(this.thumbnailsDir, `${filename}_thumb.jpg`);

      // Get original dimensions
      const metadata = await sharp(inputPath).metadata();
      
      // Process main image
      let processedImage = sharp(inputPath)
        .jpeg({ quality, progressive: true })
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });

      await processedImage.toFile(outputPath);

      let thumbnailUrl = null;
      if (createThumbnail) {
        // Create thumbnail
        await sharp(inputPath)
          .resize(thumbnailSize, thumbnailSize, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 70 })
          .toFile(thumbnailPath);
        
        thumbnailUrl = `/uploads/thumbnails/${path.basename(thumbnailPath)}`;
      }

      // Get processed file stats
      const stats = fs.statSync(outputPath);

      return {
        processedPath: outputPath,
        thumbnailPath: createThumbnail ? thumbnailPath : null,
        thumbnailUrl,
        dimensions: {
          width: metadata.width,
          height: metadata.height
        },
        size: stats.size,
        url: `/uploads/messages/${path.basename(outputPath)}`
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  }

  // Generate video thumbnail and get metadata
  async processVideo(inputPath, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const { thumbnailTime = '00:00:01' } = options;
        const filename = path.basename(inputPath, path.extname(inputPath));
        const thumbnailPath = path.join(this.thumbnailsDir, `${filename}_thumb.jpg`);

        ffmpeg(inputPath)
          .seekInput(thumbnailTime)
          .frames(1)
          .size('300x300')
          .aspect('1:1')
          .on('end', () => {
            // Get video metadata
            ffmpeg.ffprobe(inputPath, (err, metadata) => {
              if (err) {
                console.error('Error getting video metadata:', err);
                return reject(err);
              }

              const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
              const duration = metadata.format.duration;

              resolve({
                thumbnailPath,
                thumbnailUrl: `/uploads/thumbnails/${path.basename(thumbnailPath)}`,
                duration: Math.round(duration),
                dimensions: {
                  width: videoStream?.width || 0,
                  height: videoStream?.height || 0
                },
                url: `/uploads/messages/${path.basename(inputPath)}`
              });
            });
          })
          .on('error', (err) => {
            console.error('Error generating video thumbnail:', err);
            reject(err);
          })
          .save(thumbnailPath);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Get audio file metadata
  async processAudio(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          console.error('Error getting audio metadata:', err);
          return reject(err);
        }

        const duration = metadata.format.duration;
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        resolve({
          duration: Math.round(duration),
          bitrate: audioStream?.bit_rate,
          sampleRate: audioStream?.sample_rate,
          url: `/uploads/messages/${path.basename(inputPath)}`
        });
      });
    });
  }

  // Compress image if too large
  async compressImage(inputPath, maxSizeKB = 1024) {
    try {
      const stats = fs.statSync(inputPath);
      const currentSizeKB = stats.size / 1024;

      if (currentSizeKB <= maxSizeKB) {
        return inputPath; // No compression needed
      }

      // Calculate quality based on file size
      let quality = Math.max(20, Math.min(80, Math.round((maxSizeKB / currentSizeKB) * 80)));
      
      const filename = path.basename(inputPath, path.extname(inputPath));
      const compressedPath = path.join(path.dirname(inputPath), `${filename}_compressed.jpg`);

      await sharp(inputPath)
        .jpeg({ quality, progressive: true })
        .toFile(compressedPath);

      // Check if compression was successful
      const compressedStats = fs.statSync(compressedPath);
      const compressedSizeKB = compressedStats.size / 1024;

      if (compressedSizeKB > maxSizeKB && quality > 20) {
        // Try with even lower quality
        quality = 20;
        await sharp(inputPath)
          .jpeg({ quality, progressive: true })
          .toFile(compressedPath);
      }

      return compressedPath;
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
    }
  }

  // Clean up temporary files
  async cleanup(filePaths) {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
      }
    }
  }
}

module.exports = new MediaProcessor();
