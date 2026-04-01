import { useState, useRef } from 'react'

function VoiceInput({ onTranscript, disabled }) {
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef(null)

  const isSupported = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  const toggleRecording = () => {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      if (transcript) onTranscript(transcript)
    }

    recognition.onerror = () => setRecording(false)
    recognition.onend = () => setRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  if (!isSupported) return null

  return (
    <button
      type="button"
      onClick={toggleRecording}
      disabled={disabled}
      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition ${
        recording
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      } ${disabled ? 'opacity-50' : ''}`}
      title={recording ? 'Stop recording' : 'Start voice input'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
        <path d="M6 10a1 1 0 0 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A8 8 0 0 0 20 10a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
      </svg>
    </button>
  )
}

export default VoiceInput
