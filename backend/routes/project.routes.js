import { Router } from 'express';
import { body, param } from 'express-validator';
import * as projectController from '../controllers/project.controllers.js';
import * as messageController from '../controllers/message.controllers.js';
import * as authMiddleware from '../middleware/auth.middleware.js';
import { requireProjectRole } from '../middleware/rbac.middleware.js';
import { ROLES } from '../services/rbac.service.js';

const router = Router();

// 1. Create a new project (Any authenticated user can create; creator becomes OWNER)
router.post('/create',
    authMiddleware.authUser,
    body('name').isString().trim().notEmpty().withMessage('Project name is required'),
    projectController.createProject
);

// 2. Get all projects where user is owner, editor, or viewer
router.get('/all',
    authMiddleware.authUser,
    projectController.getAllProject
);

// 3. Get specific project details (Owner, Editor, Viewer allowed)
router.get('/get-project/:projectId',
    authMiddleware.authUser,
    requireProjectRole([ROLES.OWNER, ROLES.EDITOR, ROLES.VIEWER]),
    projectController.getProjectById
);

// 4. Get persistent messages for project (Owner, Editor, Viewer allowed)
router.get('/:projectId/messages',
    authMiddleware.authUser,
    requireProjectRole([ROLES.OWNER, ROLES.EDITOR, ROLES.VIEWER]),
    messageController.getProjectMessagesController
);

// 5. Update Project FileTree / Save Files (Owner and Editor allowed; Viewer rejected with 403)
router.put('/update-file-tree',
    authMiddleware.authUser,
    body('projectId').isString().notEmpty().withMessage('Project ID is required'),
    body('fileTree').isObject().withMessage('File tree is required'),
    requireProjectRole([ROLES.OWNER, ROLES.EDITOR]),
    projectController.updateFileTree
);

// 6. Invite / Add Users to Project with Role (Owner ONLY)
router.put('/add-user',
    authMiddleware.authUser,
    body('projectId').isString().notEmpty().withMessage('Project ID is required'),
    body('users').isArray({ min: 1 }).withMessage('Users must be an array of user IDs'),
    body('role').optional().isIn([ROLES.EDITOR, ROLES.VIEWER]).withMessage('Role must be editor or viewer'),
    requireProjectRole([ROLES.OWNER]),
    projectController.addUserToProject
);

// 7. Update Member Role (Owner ONLY)
router.put('/update-member-role',
    authMiddleware.authUser,
    body('projectId').isString().notEmpty().withMessage('Project ID is required'),
    body('targetUserId').isString().notEmpty().withMessage('targetUserId is required'),
    body('newRole').isIn([ROLES.EDITOR, ROLES.VIEWER]).withMessage('newRole must be editor or viewer'),
    requireProjectRole([ROLES.OWNER]),
    projectController.updateMemberRole
);

// 8. Remove Member from Project (Owner ONLY)
router.delete('/remove-member',
    authMiddleware.authUser,
    body('projectId').isString().notEmpty().withMessage('Project ID is required'),
    body('targetUserId').isString().notEmpty().withMessage('targetUserId is required'),
    requireProjectRole([ROLES.OWNER]),
    projectController.removeMember
);

// 9. Delete Project Permanently (Owner ONLY)
router.delete('/:projectId',
    authMiddleware.authUser,
    param('projectId').isString().notEmpty().withMessage('Project ID is required'),
    requireProjectRole([ROLES.OWNER]),
    projectController.deleteProject
);

export default router;