const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { startVideoProcessing, videoParserEvents } = require('./videoParser');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  

io.on('connection', (socket) => {
  console.log(`A client connected: ${socket.id}`);

  socket.on('message', (msg) => {
    console.log('Message received:', msg);
    io.emit('message', msg);
  });

  socket.on("startWatchingPlaylist", async (data) => {
    console.log("Starting to watch playlist via link:", data);

    if (!data.includes("youtube.com") && !data.includes("youtu.be")) {
        io.to(socket.id).emit("startWatchingPlaylist_response", { "success": false, "error": "Invalid YouTube link." });
        return;
    }

    io.to(socket.id).emit("startWatchingPlaylist_response", { "success": true });

    startVideoProcessing(data, socket.id);
  });

  const onContentDownloaded = (data) => {
    if (data.socketId === socket.id) {
      console.log("Content Downloaded.");
      io.to(data.socketId).emit("onContentDownloaded", data);
    }
  };

  const onAudioExtracted = (data) => {
    if (data.socketId === socket.id) {
      console.log("Audio Extracted.");
      io.to(data.socketId).emit("onAudioExtracted", data);
    }
  };

  const onAudioTranscriptionComplete = (data) => {
    if (data.socketId === socket.id) {
      console.log("Audio Transcribed.");
      io.to(data.socketId).emit("onAudioTranscriptionComplete", data);
    }
  };

  const onProcessProgress = (data) => {
    if (data.socketId === socket.id) {
      console.log("Process Progress:", data.status);
      io.to(data.socketId).emit("onProcessProgress", data);
    }
  };

  const onProcessingComplete = (data) => {
    if (data.socketId === socket.id) {
      console.log("Processing Complete.");
      io.to(data.socketId).emit("onProcessingComplete", data);
    }
  };

  const onPlaylistFetch = (data) => {
    if (data.socketId === socket.id) {
      console.log("Fetch Event", data);
      io.to(data.socketId).emit("onPlaylistFetch", data);
    }
  };

  videoParserEvents.on('onContentDownloaded', onContentDownloaded);
  videoParserEvents.on('onAudioExtracted', onAudioExtracted);
  videoParserEvents.on('onAudioTranscriptionComplete', onAudioTranscriptionComplete);
  videoParserEvents.on('onProcessProgress', onProcessProgress);
  videoParserEvents.on('onProcessingComplete', onProcessingComplete);
  videoParserEvents.on('onPlaylistFetch', onPlaylistFetch);

  socket.on('disconnect', async () => {
    console.log(`Client disconnected: ${socket.id}`);

    videoParserEvents.off('onContentDownloaded', onContentDownloaded);
    videoParserEvents.off('onAudioExtracted', onAudioExtracted);
    videoParserEvents.off('onAudioTranscriptionComplete', onAudioTranscriptionComplete);
    videoParserEvents.off('onProcessProgress', onProcessProgress);
    videoParserEvents.off('onProcessingComplete', onProcessingComplete);
    videoParserEvents.off('onPlaylistFetch', onPlaylistFetch);

    console.log(`Removed event listeners for ${socket.id}`);
  });

});

const PORT = process.env.PORT || 2000;
server.listen(PORT, () => {
  console.log(`Socket.IO server is running on http://localhost:${PORT}`);
});
