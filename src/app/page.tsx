"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { io, Socket } from "socket.io-client";

var socketIOUrl = "http://localhost:2000";

// Define a type for chat messages
type ChatMessage = {
  type: "sent" | "received";
  text: string;
};

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  // isLocked true means the input and button are disabled
  const [isLocked, setIsLocked] = useState(true);

  // Ref for the messages container
  const messageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socketIO = io(socketIOUrl);
    setSocket(socketIO);

    socketIO.on("connect", () => {
      console.log("Connected to socket io server with id:", socketIO.id);
      setIsLocked(false);
    });

    socketIO.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server");
    });

    socketIO.on("message", (message) => {
      console.log("Message from server:", message);
    });

    socketIO.on("startWatchingPlaylist_response", (message) => {
      console.log("Received start watching confirmation.", message);
      if (message.success) {
        updateMessages("received", "Successfully initiated watching process.");
      } else {
        updateMessages("received", "Failed to initiate watching process. Please try again. " + message.error);
        setIsLocked(false);
      }
    });

    // Listen for the processComplete event to unlock the input and button
    socketIO.on("onProcessingComplete", (message) => {
      console.log("Process complete received, unlocking input.");
      if (message.success) {
        updateMessages("received", "Process is complete. You may now review the notes.");
      } else {
        updateMessages("received", "Process failed: " + message.error);
      }
      setIsLocked(false);
    });

    socketIO.on("onContentDownloaded", (message) => {
      updateMessages("received", message.status);
    });

    socketIO.on("onAudioExtracted", (message) => {
      updateMessages("received", message.status);
    });

    socketIO.on("onAudioTranscriptionComplete", (message) => {
      updateMessages("received", message.status);
    });

    socketIO.on("onProcessProgress", (message) => {
      updateMessages("received", message.status);
    });

    socketIO.on("onPlaylistFetch", (message) => {
      updateMessages("received", message.status);
    });

    return () => {
      socketIO.disconnect();
    };
  }, []);

  // Auto-scroll to the bottom whenever messages update
  useEffect(() => {
    if (messageContainerRef.current) {
      const container = messageContainerRef.current;
      const isAtBottom =
        container.scrollHeight - container.clientHeight <= container.scrollTop + 10;
      if (!isAtBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages]);

  // Generic function to update messages by adding a new one
  function updateMessages(messageType: "sent" | "received", messageString: string) {
    setMessages((prev) => [...prev, { type: messageType, text: messageString }]);
  }

  function sendMessage(message: string) {
    // Sends message to web socket server to initiate request
    socket?.emit("startWatchingPlaylist", message);
  }

  // Handler for sending a message
  const handleSend = async () => {
    if (inputValue.trim()) {
      setIsLocked(true);
      const sentText = inputValue.trim();
      // Add the sent message to the chat
      updateMessages("sent", sentText);
      setInputValue(""); // Clear input field

      try {
        sendMessage(sentText);
      } catch (error) {
        updateMessages("received", "Error sending message.");
      }
    }
  };

  return (
    <div className="min-h-screen w-full p-8 sm:p-20 flex flex-col font-[family-name:var(--font-geist-sans)]">
      {/* Main Chat Window fills available vertical space */}
      <main className="flex flex-col flex-1 border border-gray-300 rounded p-4 mb-4">
        {/* Messages area: grows and scrolls */}
        <div ref={messageContainerRef} className="flex-1 overflow-y-auto">
          {messages.map((msg, index) => (
            <div key={index} className="w-full flex my-2">
              <div
                className={`p-2 rounded break-words whitespace-normal max-w-xs ${
                  msg.type === "sent"
                    ? "bg-blue-700 text-white ml-auto"
                    : "bg-green-700 text-white"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>
        {/* Input area pinned to the bottom */}
        <div className="flex items-center mt-2">
          <input
            type="text"
            placeholder="Enter a YouTube playlist link."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLocked}
            className="flex-1 p-2 border border-gray-400 rounded mr-2 disabled:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLocked}
            className="p-2 rounded bg-blue-500 text-white disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            Enter
          </button>
        </div>
      </main>

      {/* Footer remains unchanged */}
      <footer className="flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image aria-hidden src="/file.svg" alt="File icon" width={16} height={16} />
          Learn
        </a>
      </footer>
    </div>
  );
}
