import React, { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const videoRef = useRef(null);
  const [lastUserMessageTime, setLastUserMessageTime] = useState(Date.now());
  const [isListening, setIsListening] = useState(false);

  const systemMessage = {
    role: "system",
    content: "You are a friendly teddy bear designed for toddlers. Your purpose is to provide educational insights, teach new things, sing songs, and engage in playful conversation. Keep your responses short, simple, and age-appropriate. If the toddler doesn't engage with you for a while, proactively ask them a question or suggest an activity."
  };

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = useRef(null);

  useEffect(() => {
    if (!SpeechRecognition) {
      console.log("Speech Recognition API is not supported in this browser.");
      return;
    }

    recognition.current = new SpeechRecognition();
    recognition.current.continuous = false;
    recognition.current.lang = 'en-US';

    recognition.current.onstart = () => {
      setIsListening(true);
      console.log("Listening started");
    };

    recognition.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');

      if (typeof transcript === 'string') {
        setInputText(transcript);
        sendMessage(transcript);
      } else {
        console.warn("Transcript is not a string:", transcript);
      }
      setIsListening(false);
    };

    recognition.current.onend = () => {
      setIsListening(false);
      console.log("Listening ended");
    };

    recognition.current.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };
  }, []);

  useEffect(() => {
    async function getVideo() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }

    getVideo();
  }, []);

  useEffect(() => {
    const inactivityTimeout = setTimeout(() => {
      if (Date.now() - lastUserMessageTime > 15000) { // 15 seconds of inactivity
        const proactiveMessage = {
          role: "assistant",
          content: "Hi there! What's your favorite animal today? Or would you like to sing a song with me?"
        };
        setMessages(prevMessages => [...prevMessages, proactiveMessage]);
      }
    }, 15000); // Check every 15 seconds

    return () => clearTimeout(inactivityTimeout);
  }, [lastUserMessageTime]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  const sendMessage = async (voiceInput = null) => {
    const messageText = voiceInput || inputText;

    if (typeof messageText === 'string' && messageText.trim() !== '') {
      const userMessage = { text: messageText, sender: 'user' };
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setInputText('');
      setLastUserMessageTime(Date.now());

      try {
        const apiMessages = [...messages, userMessage].map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://video-ai-chatbot.com',
            'X-Title': 'TeddyAI',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            "model": "openchat/openchat-7b:free",
            "messages": [systemMessage, ...apiMessages]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
          throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Gemini API Response:", data);

        if (data.choices && data.choices.length > 0) {
          const aiMessage = { text: data.choices[0].message.content, sender: 'ai' };
          setMessages(prevMessages => [...prevMessages, aiMessage]);
          speak(aiMessage.text);
        } else {
          console.warn("No choices returned from Gemini API.");
          const errorMessage = { text: "The AI didn't provide a response. Please try again.", sender: 'ai' };
          setMessages(prevMessages => [...prevMessages, errorMessage]);
        }

      } catch (error) {
        console.error("Error calling Gemini API:", error);
        let errorMessageText = "Failed to get a response from the AI. There might be an issue with the OpenRouter API. Please try again later.";
        if (error.message.startsWith("OpenRouter API Error")) {
          errorMessageText = error.message;
        }
        const errorMessage = { text: errorMessageText, sender: 'ai' };
        setMessages(prevMessages => [...prevMessages, errorMessage]);
      }
    }
  };

  const startListening = () => {
    if (SpeechRecognition && recognition.current) {
      recognition.current.start();
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="App">
      <div className="top-box">
        <video ref={videoRef} width="200" height="150" autoPlay muted className="camera-feed" />
        <h1>TeddyAI</h1>
      </div>
      <div className="chat-container">
        <div className="message-list">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.sender}`}>
              {message.text}
            </div>
          ))}
        </div>
        <div className="input-area">
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type your message..."
          />
          <button onClick={() => sendMessage()}>Send</button>
          {SpeechRecognition && (
            <button onClick={startListening} disabled={isListening} className="voice-button">
              {isListening ? 'Listening...' : 'Speak'}
            </button>
          )}
        </div>
      </div>
      <p>Teddy Bear Companion</p>
    </div>
  );
}

export default App;
