import { Router } from 'express';
import * as aiController from '../controllers/ai.controllers.js';
import * as authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

router.get('/get-result', aiController.getResult);

// Dedicated SSE streaming endpoint for AI coding assistant
router.post('/stream-code', authMiddleware.authUser, aiController.streamCode);

export default router;