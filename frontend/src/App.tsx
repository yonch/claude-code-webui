import { useState } from 'react'
import { ChatMessage, ChatRequest, StreamResponse } from '@shared/types'
import './App.css'

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:8080/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input.trim() } as ChatRequest),
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, assistantMessage])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const data: StreamResponse = JSON.parse(line)
            
            if (data.type === 'message' && data.data) {
              assistantContent += data.data + '\n'
              setMessages(prev => prev.map((msg, index) => 
                index === prev.length - 1 
                  ? { ...msg, content: assistantContent }
                  : msg
              ))
            } else if (data.type === 'error') {
              console.error('Stream error:', data.error)
            } else if (data.type === 'done') {
              break
            }
          } catch (e) {
            console.error('Failed to parse JSON:', e)
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: Failed to get response',
        timestamp: Date.now()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage()
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Claude Code Web UI</h1>
      
      <div style={{ 
        height: '400px', 
        overflowY: 'auto', 
        border: '1px solid #ccc', 
        padding: '10px', 
        marginBottom: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        {messages.map((message, index) => (
          <div key={index} style={{
            marginBottom: '10px',
            padding: '10px',
            backgroundColor: message.role === 'user' ? '#e3f2fd' : '#f3e5f5',
            borderRadius: '5px'
          }}>
            <strong>{message.role === 'user' ? 'You' : 'Assistant'}:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', margin: '5px 0 0 0' }}>
              {message.content}
            </pre>
          </div>
        ))}
        {isLoading && (
          <div style={{ padding: '10px', fontStyle: 'italic' }}>
            Thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '5px'
          }}
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default App
