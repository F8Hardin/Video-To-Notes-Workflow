const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ytpl = require('ytpl');
const ffmpeg = require('fluent-ffmpeg');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');

const ffmpegPath = "C:\\Users\\Fate\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe"
const videoParserEvents = new EventEmitter();

async function fetchPlaylistVideos(playlistUrl) {
    try {
        const playlist = await ytpl(playlistUrl);
        return playlist.items.map(item => item.url);
    } catch (error) {
        throw new Error("Failed to fetch playlist videos");
    }
}

function getVideoFilename(index) {
    return `video_${index}.mp4`;
}

function getAudioFilename(index) {
    return `audio_${index}.wav`;
}


async function downloadVideo(videoUrl, index, socketId) {
    return new Promise((resolve, reject) => {
        const outputFolder = path.join(__dirname, "videos");
        if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

        const videoPath = path.join(outputFolder, getVideoFilename(index));
        const tempVideoPath = videoPath + ".part";  // Temporary .part file

        const ffmpegPath = "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe";  // Ensure correct path

        const command = `yt-dlp --no-cache-dir --ffmpeg-location "${ffmpegPath}" -o "${videoPath}" "${videoUrl}"`;

        console.log(`[DEBUG] Running yt-dlp for video ${index + 1}: ${command}`);

        exec(command, async (error, stdout, stderr) => {
            if (error) {
                console.error(`[ERROR] yt-dlp failed for video ${index + 1}:`, stderr);
                reject(new Error(`yt-dlp failed: ${stderr}`));
                return;
            }

            console.log(`[DEBUG] yt-dlp successfully downloaded video ${index + 1}.`);

            // 🔹 Fix: Wait for the file to be released before renaming
            let retries = 3;
            while (retries > 0 && fs.existsSync(tempVideoPath)) {
                console.log(`[DEBUG] Waiting for file release... ${retries} retries left.`);
                await new Promise((r) => setTimeout(r, 2000));  // Wait 2 seconds
                retries--;
            }

            if (fs.existsSync(tempVideoPath)) {
                console.error(`[ERROR] File still locked after retries: ${tempVideoPath}`);
                reject(new Error(`File locked: ${tempVideoPath}`));
                return;
            }

            videoParserEvents.emit("onContentDownloaded", { socketId, status: `Video ${index + 1} downloaded` });
            resolve(videoPath);
        });
    });
}

// Extract audio from a single video
async function extractAudio(videoPath, index, socketId) {
    return new Promise((resolve, reject) => {
        const outputFolder = path.dirname(videoPath);
        const audioPath = path.join(outputFolder, getAudioFilename(index));

        ffmpeg(videoPath)
            .output(audioPath)
            .audioCodec('pcm_s16le')
            .format('wav')
            .on('end', () => {
                videoParserEvents.emit("onAudioExtracted", { socketId, status: `Audio extracted from Video ${index + 1}` });
                resolve(audioPath);
            })
            .on('error', reject)
            .run();
    });
}

// Transcribe audio using Whisper
async function transcribeAudio(audioPath, index, socketId) {
    return new Promise((resolve, reject) => {
        // const whisperProcess = spawn('python3', ['whisper_transcriber.py', audioPath]);

        // let transcript = "";

        // whisperProcess.stdout.on('data', (data) => {
        //     transcript += data.toString();
        // });

        // whisperProcess.stderr.on('data', (data) => {
        //     console.error(`Whisper error: ${data.toString()}`);
        // });

        // whisperProcess.on('close', (code) => {
        //     if (code === 0) {
        //         videoParserEvents.emit("onAudioTranscriptionComplete", { socketId, status: `Transcription complete for Video ${index + 1}` });
        //         resolve(transcript);
        //     } else {
        //         reject(new Error(`Whisper transcription failed for Video ${index + 1}`));
        //     }
        // });
        resolve(['test','transcript'])
    });
}

function cleanVideoUrl(videoUrl) {
    return videoUrl.replace(/&list=.*$/, '');  // Remove playlist context
}

// Process an entire playlist
async function startVideoProcessing(playlistUrl, socketId) {
    let transcripts = [];
    try {
        videoParserEvents.emit("onPlaylistFetch", { socketId, status: "Fetching playlist videos..." });

        const videoUrls = (await fetchPlaylistVideos(playlistUrl)).map(cleanVideoUrl);
        videoParserEvents.emit("onPlaylistFetch", { socketId, status: "Fetched videos." });
        const totalVideos = videoUrls.length;
        console.log("Total videos:", totalVideos)
        let completedVideos = 0;

        console.log("Video URLs:", videoUrls)

        for (let i = 0; i < totalVideos; i++) {
            const videoPath = await downloadVideo(videoUrls[i], i, socketId);
            console.log("Obtained video path.")
            const audioPath = await extractAudio(videoPath, i, socketId);
            console.log("Obtained audio path.")
            const transcript = await transcribeAudio(audioPath, i, socketId);
            console.log("Obtained transcript.")
            transcripts.push({ videoIndex: i + 1, transcript });

            completedVideos++;
            const progress = ((completedVideos / totalVideos) * 100).toFixed(2);

            videoParserEvents.emit("onProcessProgress", {
                socketId,
                status: `Processed ${completedVideos} of ${totalVideos} videos`,
                progress,
            });
        }

        //send transcripts to LLM first, adding a few more steps before its complete
        videoParserEvents.emit("onProcessingComplete", {
            socketId,
            status: "All videos processed successfully",
            transcripts,
        });
    } catch (error) {
        console.error("Processing error:", error);
        videoParserEvents.emit("onProcessingComplete", {
            socketId,
            status: String(error),
            transcripts,
        });
    }
}

module.exports = { startVideoProcessing, videoParserEvents };
