const express = require('express');
const socketIOClient = require('socket.io-client');
const { startProcessingVideo, videoParserEvents } = require('./videoParser');

const socketIoUrl = 'http://localhost:2000';

const app = express();
const port = process.env.PORT || 4000;

let associatedWebClient = null;

// A simple route to verify the manager is running
app.get('/', (req, res) => {
    res.send('Manager service is running');
});

// Start the Express server
const server = app.listen(port, () => {
    console.log(`Manager listening on port ${port}`);
});

const socket = socketIOClient(socketIoUrl);

socket.on('connect', () => {
    console.log('Connected to socket server');
    socket.emit("connectingClient", { type : "AgentManager" })
});

socket.on("clientReady", (data) => {
    console.log("Client ready received from server:", data);
    associatedWebClient = data.socketId
});

socket.on('disconnect', () => {
    console.log('Disconnected from socket server');
});

socket.on('messageFromWebClient', (data) => {
    console.log("Received message from web client:", data);
    socket.emit("forwardMessageToWebClient", { data: "Received request and started processing.", webClient: associatedWebClient});
    //basic extraction of the url when uses is like "hello my AI, help me with this playlist today!" with a nice response too
    //handle requests, talk to LLM and get commands needed
    //startProcessingVideo...
    //maybe need to move this to some a seperate Agent manager script that runs the agent or workflow
    //move video parser in there, have generic Agent events forwarded to web client
    //that file can see the command from the llms json output, execute it
    //as functionality expands, need a dynamic way to add "tools" like video parser to Agent manager

    //next, Set up the basics of the agent manager by moving the video parser there, set up lm studio, forward messages to agent manager and interact with llm to parse data and get command
});

//forward video parsing events to the web client for updates
const onVideoParseEventTriggered = (message) => {
    if (message.socketId === socket.id) {
        console.log("Event fired from Video Parser:", message);
        socket.emit("forwardMessageToWebClient", { data: message, webClient: associatedWebClient});
    }
};

videoParserEvents.on('onContentDownloaded', onVideoParseEventTriggered);
videoParserEvents.on('onAudioExtracted', onVideoParseEventTriggered);
videoParserEvents.on('onAudioTranscriptionComplete', onVideoParseEventTriggered);
videoParserEvents.on('onProcessProgress', onVideoParseEventTriggered);
videoParserEvents.on('onProcessingComplete', onVideoParseEventTriggered);
videoParserEvents.on('onPlaylistFetch', onVideoParseEventTriggered);

socket.on('disconnect', async () => {
  console.log(`Client disconnected: ${socket.id}`);

  videoParserEvents.off('onContentDownloaded', onVideoParseEventTriggered);
  videoParserEvents.off('onAudioExtracted', onVideoParseEventTriggered);
  videoParserEvents.off('onAudioTranscriptionComplete', onVideoParseEventTriggered);
  videoParserEvents.off('onProcessProgress', onVideoParseEventTriggered);
  videoParserEvents.off('onProcessingComplete', onVideoParseEventTriggered);
  videoParserEvents.off('onPlaylistFetch', onVideoParseEventTriggered);

  console.log(`Removed event listeners for ${socket.id}`);
});
