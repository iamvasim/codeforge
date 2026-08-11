import {Router} from 'express';
import * as userController from '../controllers/user.controllers.js';
import {body} from 'express-validator';
import * as authMiddleware from '../middleware/auth.middleware.js';
const router = Router();

router.post('/register',
    body('email').isEmail().withMessage('email must be valid'),
    body('password').isLength({ min: 4 }).withMessage('password must be at least 4 characters long'),
    userController.createUserController);

router.post('/login',
    body('email').isEmail().withMessage('email must be valid'),
    body('password').isLength({ min: 4 }).withMessage('password must be at least 4 characters long'),
    userController.loginUserController);

router.get('/profile',authMiddleware.authUser,userController.profileController);
router.get('/logout',authMiddleware.authUser, userController.logoutController);
router.get('/all', authMiddleware.authUser, userController.getAllUsersController);


export default router;