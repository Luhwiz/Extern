// ClaudeService.js
// Service to call Claude API with Firebase authentication

import FirebaseService from './FirebaseService';

const isDev = import.meta.env.DEV;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (isDev ? 'http://localhost:5000' : 'https://externai-backend-production.azurewebsites.net');

async function getAuthToken() {
  try {
    const token = await FirebaseService.getIdToken();
    return token;
  } catch (error) {
    throw new Error('Not authenticated. Please log in.');
  }
}

async function getClaudeCompletion(prompt, maxTokens = 20000, timeout = 60000) {
  console.log('[ClaudeService] Calling Claude via backend proxy...');
  console.log('[ClaudeService] Backend URL:', BACKEND_URL);
  console.log('[ClaudeService] Timeout:', timeout, 'ms');

  try {
    const token = await getAuthToken();

    let response;
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Clean messages - remove id, isStreaming, and other UI-specific properties
      const cleanMessages = (Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }])
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      response = await fetch(`${BACKEND_URL}/api/claude/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: cleanMessages,
          max_tokens: maxTokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
    } catch (fetchError) {
      console.error('[ClaudeService] Fetch error:', fetchError);
      if (fetchError.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout / 1000} seconds. The backend might be slow or Claude API is not responding.`);
      }
      if (fetchError.message === 'Failed to fetch' || fetchError.message.includes('NetworkError')) {
        throw new Error('Cannot connect to backend server. Please ensure the backend is running on port 5000.');
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = 'Request failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error || errorJson.details || errorMsg;
      } catch (e) {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    // Read stream response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            // Handle Anthropic API format
            if (data.type === 'content_block_delta' && data.delta?.text) {
              fullText += data.delta.text;
            } else if (data.delta?.text) {
              fullText += data.delta.text;
            }

            // Handle done signal
            if (data.done || data.type === 'message_stop') {
              return { success: true, message: fullText };
            }

            // Handle errors
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            // Skip invalid JSON
            if (e.message && !e.message.includes('JSON')) {
              throw e; // Re-throw actual errors
            }
          }
        }
      }
    }

    return { success: true, message: fullText };
  } catch (error) {
    console.error('[ClaudeService] Exception:', error);
    return { success: false, error: error.message };
  }
}

async function getClaudeStream(prompt, onChunk, maxTokens = 20000, signal = null, systemPrompt = null, projectState = null, conversationSummary = null) {
  console.log('[ClaudeService] Starting Claude stream via backend...');
  console.log('[ClaudeService] Backend URL:', BACKEND_URL);

  try {
    const token = await getAuthToken();
    const body = {
      messages: Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }],
      max_tokens: maxTokens
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    // Layer 2: Inject project state
    if (projectState) {
      body.projectState = projectState;
      console.log('[ClaudeService] Injecting project state');
    }

    // Layer 3: Inject conversation summary
    if (conversationSummary) {
      body.conversationSummary = conversationSummary;
      console.log('[ClaudeService] Injecting conversation summary');
    }

    let response;
    try {
      response = await fetch(`${BACKEND_URL}/api/claude/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
        signal: signal // Pass abort signal to fetch
      });
    } catch (fetchError) {
      console.error('[ClaudeService] Fetch error:', fetchError);
      if (fetchError.name === 'AbortError') {
        return { success: false, error: 'Request was cancelled', aborted: true };
      }
      if (fetchError.message === 'Failed to fetch') {
        throw new Error('Cannot connect to backend server. Please ensure the backend is running on port 5000.');
      }
      throw fetchError;
    }

    if (!response.ok) {
      const error = await response.json();
      const errorMessage = error.error || 'Request failed';
      const details = error.details ? ` (${error.details})` : '';
      throw new Error(errorMessage + details);
    }

    // Read stream with proper buffering
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = ''; // Buffer for incomplete SSE lines
    let streamDone = false;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining buffer before exiting
        if (buffer.trim()) {
          console.log('[ClaudeService] Processing remaining buffer:', buffer.length, 'chars');
        }
        break;
      }

      // Add new data to buffer
      // Use decoder with stream: true to handle multi-byte characters split across chunks
      buffer += decoder.decode(value, { stream: true });

      // Robustly handle lines
      // We look for lines starting with "data: " and ignore anything else (like raw headers)
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line) continue;

        // CRITICAL FIX: Ignore any line that doesn't strictly start with "data: "
        // This filters out weird raw HTTP headers or binary garbage if the backend misbehaves
        if (!line.startsWith('data: ')) {
          if (line.includes('HTTP/1.1') || line.includes('Content-Type')) {
            console.warn('[ClaudeService] Ignoring raw header line:', line);
          }
          continue;
        }
        // Strictly remove 'data: ' prefix
        const jsonStr = line.substring(6);
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);

          // Handle Anthropic API format - content_block_delta contains the text
          if (data.type === 'content_block_delta' && data.delta?.text) {
            const chunkText = data.delta.text;
            fullText += chunkText;
            if (onChunk) {
              onChunk(chunkText, fullText);
            }
          } else if (data.delta?.text) {
            // Fallback for other formats
            const chunkText = data.delta.text;
            fullText += chunkText;
            if (onChunk) {
              onChunk(chunkText, fullText);
            }
          }

          // Mark stream as done but continue processing remaining chunks
          if (data.done || data.type === 'message_stop') {
            console.log('[ClaudeService] Received done signal. Current length:', fullText.length);
            streamDone = true;
          }

          // Handle errors in stream
          if (data.error) {
            throw new Error(data.error);
          }
        } catch (e) {
          // Only skip JSON parse errors, re-throw actual errors
          if (e.message && !e.message.includes('JSON') && !e.message.includes('Unexpected')) {
            throw e;
          }
          // Log parse errors for debugging
          console.warn('[ClaudeService] JSON parse warning:', jsonStr.substring(0, 50));
        }
      }
    }

    console.log('[ClaudeService] Stream finished. Total length:', fullText.length);
    return { success: true, message: fullText };
  } catch (error) {
    console.error('[ClaudeService] Stream error:', error);
    throw error;
  }
}

export default {
  getClaudeCompletion,
  getClaudeStream,

  // Get user subscription and usage stats
  async getUsage() {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${BACKEND_URL}/api/claude/usage`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage');
      }

      return await response.json();
    } catch (error) {
      console.error('[ClaudeService] Failed to get usage:', error);
      throw error;
    }
  },

  // Summarize conversation messages (Layer 3: Conversation pruning)
  async summarizeConversation(messages) {
    console.log('[ClaudeService] Summarizing', messages.length, 'messages...');

    try {
      const token = await getAuthToken();
      const response = await fetch(`${BACKEND_URL}/api/claude/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ messages })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Summarization failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('[ClaudeService] Summary generated:', result.summary.substring(0, 100) + '...');
      return result.summary;
    } catch (error) {
      console.error('[ClaudeService] Summarization error:', error);
      throw error;
    }
  }
};