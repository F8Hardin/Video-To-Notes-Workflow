const development = true;
const Queue = require('./queue')
const devAgentManagerQueue = new Queue();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');


const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 2000;

const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  

io.on('connection', (socket) => {
  console.log(`A client connected: ${socket.id}`);

  socket.on("connectingClient", (client) => {
    if (development){ //agent managers waiting in queue for testing with a web client for local quick set up
      if (client.type == "WebClient"){
        agentManager = devAgentManagerQueue.dequeue();

        if (agentManager == "Underflow"){
          console.log("Server in dev mode and no agent manager available.")
          io.to(socket.id).emit("messageFromSocketServer", "Server in dev mode and no agent manager available.")
          return;
        }

        io.to(socket.id).emit("clientReady", { socketId : agentManager });
        io.to(agentManager).emit("clientReady", { socketId : socket.id });

        console.log("Clients paired.")
      } else if (client.type == "AgentManager"){
        console.log("Queuing up an Agent manager for dev testing.")
        devAgentManagerQueue.enqueue(socket.id);
      } else {
        console.log("ERROR: Unrecognized client type connected.");
      }
    } //else will do kubernetes logic
  });

  socket.on("forwardMessageToWebClient", (message) => {
    console.log("Forwarding message to Web Client:", message)
    io.to(message.webClient).emit("messageFromAgentManager", message.data)
  });

  socket.on("forwardMessageToAgentManager", (message) => {
    console.log("Forwarding message to Agent Manager:", message)
    io.to(message.agentManager).emit("messageFromWebClient", message.data)
  });

  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id} (reason: ${reason})`);
  });

  // socket.on("startWatchingPlaylist", async (data) => {
  //   console.log("Starting to watch playlist via link:", data);

  //   if (!data.includes("youtube.com") && !data.includes("youtu.be")) {
  //       io.to(socket.id).emit("startWatchingPlaylist_response", { "success": false, "error": "Invalid YouTube link." });
  //       return;
  //   }

  //   io.to(socket.id).emit("startWatchingPlaylist_response", { "success": true });

  //   startVideoProcessing(data, socket.id);
  // });

});

server.listen(port, () => {
  console.log(`Socket.IO server is running on http://localhost:${port}`);
});
