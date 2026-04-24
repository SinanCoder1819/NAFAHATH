import express from 'express';
import * as profileController from '../controllers/user/profile.controller.js';
import { getHomePage } from '../controllers/user/home.controller.js';
 
const router = express.Router();

router.get('/', getHomePage);

// Middleware to check if user is logged in (recommended)
// import { isAuthenticated } from '../../middlewares/auth.js';

// Profile Page View
router.get('/profile', profileController.getProfile);

// AJAX Security Actions
router.post('/changePassword', profileController.changePassword);
router.post('/changeEmail', profileController.changeEmail);


router.get('/editProfile', profileController.getEditProfile)

router.post('/updateProfile', profileController.updateProfilePage);





export default router;