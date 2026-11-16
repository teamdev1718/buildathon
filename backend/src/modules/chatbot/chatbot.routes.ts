import { route } from '../../lib/api.js';
import { limiter } from '../../lib/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { chat, chatInput } from './chatbot.service.js';

route({ method: 'post', path: '/chatbot/message', body: chatInput, protected: true,
  middleware: [limiter(15, 60_000), requireAuth], summary: 'Answer a support question with FAQ or Gemini' },
({ message }) => chat(message));

